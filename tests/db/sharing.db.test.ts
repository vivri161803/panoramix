// Regole di accesso (RLS) dei piani condivisi, sul Postgres locale vero.
// Avvio: npm run test:db

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, enabled, makeUser, type TestUser } from "./setup";

describe.skipIf(!enabled)("piani condivisi: regole di accesso", () => {
  let owner: TestUser, viewer: TestUser, stranger: TestUser;
  let planId: string, medId: string;

  const today = new Date().toISOString().slice(0, 10);

  async function stockOf(u: TestUser) {
    const { data } = await u.db.from("medications").select("stock_qty, stock_as_of").eq("id", medId).maybeSingle();
    return data as { stock_qty: number; stock_as_of: string } | null;
  }

  beforeAll(async () => {
    [owner, viewer, stranger] = await Promise.all([makeUser("Carlo"), makeUser("Maria"), makeUser("Estraneo")]);
    const { data: plan, error } = await owner.db.from("plans").insert({ owner_id: owner.id, patient_name: "Nonna Test" }).select("id").single();
    if (error) throw error;
    planId = plan.id;
    const { data: med, error: mErr } = await owner.db
      .from("medications")
      .insert({ plan_id: planId, name: "Ramipril", pills_per_pack: 28, color: "#FF5E4D", shape: "tonda", dose_morning: 1, frequency_type: "daily", stock_qty: 20 })
      .select("id, stock_as_of")
      .single();
    if (mErr) throw mErr;
    medId = med.id;
    await owner.db.from("plan_recipients").insert({ plan_id: planId, email: "badante@test.localhost" });
  });

  afterAll(cleanup);

  it("senza invito non si vede nulla del piano", async () => {
    expect((await stranger.db.from("plans").select("id").eq("id", planId)).data).toEqual([]);
    expect((await stranger.db.from("medications").select("id").eq("plan_id", planId)).data).toEqual([]);
    const upd = await stranger.db.from("medications").update({ stock_qty: 999 }).eq("id", medId).select("id");
    expect(upd.data).toEqual([]);
    expect((await stockOf(owner))!.stock_qty).toBe(20);
  });

  it("l'invitato vede l'invito (con nome del piano e di chi invita) ma non ancora il piano", async () => {
    const { error } = await owner.db.from("plan_invites").insert({ plan_id: planId, email: viewer.email.toUpperCase(), role: "viewer" });
    expect(error).toBeNull();
    const { data } = await viewer.db.rpc("my_plan_invites");
    expect(data).toEqual([expect.objectContaining({ plan_id: planId, patient_name: "Nonna Test", role: "viewer", owner_name: "Carlo Test" })]);
    expect((await viewer.db.from("plans").select("id").eq("id", planId)).data).toEqual([]);
    // gli altri non vedono inviti non loro
    expect((await stranger.db.rpc("my_plan_invites")).data).toEqual([]);
    expect((await stranger.db.from("plan_invites").select("id")).data).toEqual([]);
  });

  it("solo l'invitato può accettare il suo invito", async () => {
    const inviteId = ((await viewer.db.rpc("my_plan_invites")).data as { id: string }[])[0].id;
    const steal = await stranger.db.rpc("accept_plan_invite", { p_invite_id: inviteId });
    expect(steal.error?.hint).toBe("invite_not_found");
    const ok = await viewer.db.rpc("accept_plan_invite", { p_invite_id: inviteId });
    expect(ok.error).toBeNull();
    expect(ok.data).toBe(planId);
    expect((await viewer.db.rpc("my_plan_invites")).data).toEqual([]);
  });

  it("sola lettura: vede piano, medicinali, storico e nome del proprietario", async () => {
    expect((await viewer.db.from("plans").select("id").eq("id", planId)).data).toHaveLength(1);
    expect((await viewer.db.from("medications").select("id").eq("plan_id", planId)).data).toHaveLength(1);
    expect((await viewer.db.from("profiles").select("first_name").eq("id", owner.id)).data).toEqual([{ first_name: "Carlo" }]);
    // ma non chi non condivide piani con lui
    expect((await viewer.db.from("profiles").select("id").eq("id", stranger.id)).data).toEqual([]);
    // né i destinatari email o gli altri inviti del piano
    expect((await viewer.db.from("plan_recipients").select("email").eq("plan_id", planId)).data).toEqual([]);
  });

  it("sola lettura: non cambia nulla", async () => {
    const before = (await stockOf(owner))!;
    expect((await viewer.db.from("medications").update({ stock_qty: 1 }).eq("id", medId).select("id")).data).toEqual([]);
    const ev = await viewer.db.rpc("record_stock_event", {
      p_medication_id: medId,
      p_type: "count",
      p_delta: -19,
      p_qty_after: 1,
      p_effective_date: today,
      p_expected_qty: before.stock_qty,
      p_expected_as_of: before.stock_as_of,
    });
    expect(ev.error).not.toBeNull();
    expect((await viewer.db.from("stock_events").insert({ medication_id: medId, type: "count", delta: 1, qty_after: 1, effective_date: today })).error).not.toBeNull();
    expect((await viewer.db.from("dose_changes").insert({ medication_id: medId, effective_date: "2030-01-01", dose_morning: 1 })).error).not.toBeNull();
    expect((await viewer.db.from("plans").update({ patient_name: "Hack" }).eq("id", planId).select("id")).data).toEqual([]);
    expect((await viewer.db.from("medications").delete().eq("id", medId).select("id")).data).toEqual([]);
    expect((await viewer.db.from("plan_invites").insert({ plan_id: planId, email: "x@test.localhost", role: "editor" })).error).not.toBeNull();
    // non può darsi da solo il permesso di modifica
    expect((await viewer.db.from("plan_members").update({ role: "editor" }).eq("plan_id", planId).eq("user_id", viewer.id).select("role")).data).toEqual([]);
    expect((await stockOf(owner))!.stock_qty).toBe(before.stock_qty);
  });

  it("con il permesso di modifica aggiorna scorte e dosi, ma non le impostazioni del piano", async () => {
    const promote = await owner.db.from("plan_members").update({ role: "editor" }).eq("plan_id", planId).eq("user_id", viewer.id).select("role");
    expect(promote.data).toEqual([{ role: "editor" }]);
    const editor = viewer;
    const before = (await stockOf(editor))!;
    const ev = await editor.db.rpc("record_stock_event", {
      p_medication_id: medId,
      p_type: "use",
      p_delta: -1,
      p_qty_after: before.stock_qty - 1,
      p_effective_date: today,
      p_expected_qty: before.stock_qty,
      p_expected_as_of: before.stock_as_of,
    });
    expect(ev.error).toBeNull();
    const { data: events } = await owner.db.from("stock_events").select("type, created_by").eq("id", ev.data as string);
    expect(events).toEqual([{ type: "use", created_by: editor.id }]);
    expect((await editor.db.from("dose_changes").insert({ medication_id: medId, effective_date: "2030-01-01", dose_morning: 0.5 })).error).toBeNull();
    expect((await owner.db.from("dose_changes").select("dose_morning").eq("medication_id", medId)).data).toEqual([{ dose_morning: 0.5 }]);
    // impostazioni e persone restano del proprietario
    expect((await editor.db.from("plans").update({ weekly_summary: true }).eq("id", planId).select("id")).data).toEqual([]);
    expect((await editor.db.from("plan_invites").insert({ plan_id: planId, email: "y@test.localhost", role: "viewer" })).error).not.toBeNull();
    expect((await editor.db.from("plans").delete().eq("id", planId).select("id")).data).toEqual([]);
  });

  it("tipo di movimento non valido rifiutato dal database", async () => {
    const s = (await stockOf(owner))!;
    const bad = await owner.db.rpc("record_stock_event", {
      p_medication_id: medId,
      p_type: "prep",
      p_delta: 0,
      p_qty_after: s.stock_qty,
      p_effective_date: today,
      p_expected_qty: s.stock_qty,
      p_expected_as_of: s.stock_as_of,
    });
    expect(bad.error?.message).toContain("Tipo di movimento non valido");
  });

  it("le tabelle degli invii automatici sono in sola lettura per tutti", async () => {
    expect((await owner.db.from("notification_runs").insert({ plan_id: planId, kind: "weekly_summary", run_date: today, status: "sent" })).error).not.toBeNull();
    expect((await owner.db.from("notification_runs").select("id")).error).toBeNull();
  });

  it("al massimo 10 persone (membri + inviti) per piano", async () => {
    const emails = Array.from({ length: 9 }, (_, i) => ({ plan_id: planId, email: `p${i}@test.localhost`, role: "viewer" }));
    expect((await owner.db.from("plan_invites").insert(emails)).error).toBeNull(); // 1 membro + 9 inviti
    const over = await owner.db.from("plan_invites").insert({ plan_id: planId, email: "troppi@test.localhost", role: "viewer" });
    expect(over.error?.hint).toBe("members_limit");
    // l'invitato può rifiutare; il proprietario annullare
    expect((await owner.db.from("plan_invites").delete().eq("plan_id", planId).like("email", "p%@test.localhost").select("id")).data).toHaveLength(9);
  });

  it("chi ha accesso può lasciare il piano e da lì non lo vede più", async () => {
    const left = await viewer.db.from("plan_members").delete().eq("plan_id", planId).eq("user_id", viewer.id).select("user_id");
    expect(left.data).toEqual([{ user_id: viewer.id }]);
    expect((await viewer.db.from("plans").select("id").eq("id", planId)).data).toEqual([]);
    expect((await viewer.db.from("profiles").select("id").eq("id", owner.id)).data).toEqual([]);
  });
});
