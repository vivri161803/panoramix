// Controlli automatici sul Postgres locale vero: avvisi, promemoria, riepilogo, controllo saltato.
// Avvio: npm run test:db

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanup, enabled, makeUser, admin as adminClient, type TestUser } from "./setup";

const sent = vi.hoisted(() => [] as { to: string[]; subject: string }[]);

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/provider", () => ({
  getEmailProvider: () => ({
    name: "test",
    send: async (m: { to: string[]; subject: string }) => {
      sent.push({ to: m.to, subject: m.subject });
      return {};
    },
  }),
}));

import { runDailyAlerts } from "@/lib/alerts";
import { loadCronData } from "@/lib/cron-data";
import { runPrepReminders, runWeeklySummaries } from "@/lib/notify";
import { findMissedRun } from "@/lib/ops";
import { addDays, onOrAfterWeekday } from "@/lib/dates";

describe.skipIf(!enabled)("controlli automatici", () => {
  let admin: SupabaseClient;
  // un sabato lontano nel futuro, per non mescolarsi con altri dati locali
  const SAT = onOrAfterWeekday("2031-03-01", 6);
  const SUN = addDays(SAT, 1);
  const MON = addDays(SAT, 2);
  let owner: TestUser, member: TestUser;
  let planId: string;

  beforeAll(async () => {
    admin = adminClient();
    [owner, member] = await Promise.all([makeUser("Proprietario"), makeUser("Membro")]);
    const { data: plan } = await admin
      .from("plans")
      .insert({ owner_id: owner.id, patient_name: "Nonno Cron", stock_mode: "weekly", prep_weekday: 7, mode_since: SAT, weekly_summary: true, prep_reminder: true })
      .select("id")
      .single();
    planId = plan!.id;
    await admin.from("plan_members").insert({ plan_id: planId, user_id: member.id, role: "viewer" });
    await admin.from("plan_recipients").insert({ plan_id: planId, email: "badante@test.localhost" });
    const { data: med } = await admin
      .from("medications")
      .insert({ plan_id: planId, name: "Prednisone", pills_per_pack: 20, color: "#FF5E4D", shape: "tonda", dose_morning: 2, frequency_type: "daily", start_date: SAT, stock_qty: 9, stock_as_of: SAT })
      .select("id")
      .single();
    await admin.from("dose_changes").insert({ medication_id: med!.id, effective_date: addDays(SUN, 3), dose_morning: 1 });
  });

  afterAll(cleanup);

  const mine = (to: string[]) => to.includes(owner.email);

  it("promemoria la sera prima della preparazione, a tutti, una volta sola", async () => {
    sent.length = 0;
    const r = await runPrepReminders(admin, SAT);
    expect(r.plans.find((p) => p.planId === planId)?.outcome).toBe("sent");
    const mail = sent.find((m) => mine(m.to))!;
    expect(mail.subject).toBe("Panoramix · Nonno Cron: domani si prepara il portapillole");
    expect(mail.to.sort()).toEqual([owner.email, member.email, "badante@test.localhost"].sort());
    const again = await runPrepReminders(admin, SAT);
    expect(again.plans.find((p) => p.planId === planId)?.outcome).toBe("already_sent_today");
    // non è la vigilia: niente promemoria
    const other = await runPrepReminders(admin, addDays(SAT, -1));
    expect(other.plans.find((p) => p.planId === planId)).toBeUndefined();
  });

  it("avviso di scorta bassa al proprietario, ai destinatari e alle persone con accesso", async () => {
    sent.length = 0;
    const r = await runDailyAlerts(admin, SAT);
    expect(r.plans.find((p) => p.planId === planId)?.outcome).toBe("sent");
    const mail = sent.find((m) => mine(m.to))!;
    expect(mail.subject).toBe("Panoramix · Nonno Cron: 1 medicina da ordinare");
    expect(mail.to).toContain(member.email);
  });

  it("riepilogo settimanale per i piani che lo chiedono", async () => {
    sent.length = 0;
    const r = await runWeeklySummaries(admin, MON);
    expect(r.plans.find((p) => p.planId === planId)?.outcome).toBe("sent");
    expect(sent.find((m) => mine(m.to))!.subject).toBe("Panoramix · Nonno Cron: riepilogo della settimana");
    await admin.from("plans").update({ weekly_summary: false }).eq("id", planId);
    const off = await runWeeklySummaries(admin, addDays(MON, 7));
    expect(off.plans.find((p) => p.planId === planId)).toBeUndefined();
  });

  it("si accorge se ieri il controllo non è partito", async () => {
    const day = "2032-06-10";
    await admin.from("cron_runs").delete().gte("run_date", "2032-06-01").lte("run_date", "2032-06-30");
    // nessuno storico: nessun allarme (primo giorno)
    expect(await findMissedRun(admin, "reminders", day)).toBeNull();
    await admin.from("cron_runs").insert({ run_date: "2032-06-08", kind: "reminders", finished_at: new Date().toISOString() });
    expect(await findMissedRun(admin, "reminders", day)).toContain("non è partito");
    // partito ma non finito conta come saltato
    await admin.from("cron_runs").insert({ run_date: "2032-06-09", kind: "reminders" });
    expect(await findMissedRun(admin, "reminders", day)).toContain("non è partito");
    await admin.from("cron_runs").update({ finished_at: new Date().toISOString() }).eq("run_date", "2032-06-09").eq("kind", "reminders");
    expect(await findMissedRun(admin, "reminders", day)).toBeNull();
    // gli avvisi del mattino hanno il loro storico
    expect(await findMissedRun(admin, "alerts", day)).toBeNull();
    await admin.from("cron_runs").delete().gte("run_date", "2032-06-01").lte("run_date", "2032-06-30");
  });
});

// Supabase restituisce al massimo 1000 righe per richiesta: il controllo deve leggerle tutte.
describe.skipIf(!enabled)("controlli automatici con molti dati", () => {
  let admin: SupabaseClient;
  let owner: TestUser;
  let lowPlanId: string;
  const DAY = "2033-04-04";
  const PLANS = 260;
  const MEDS_PER_PLAN = 4;

  beforeAll(async () => {
    admin = adminClient();
    owner = await makeUser("Volume");
    const { data: plans, error } = await admin
      .from("plans")
      .insert(Array.from({ length: PLANS }, (_, i) => ({ owner_id: owner.id, patient_name: `Volume ${i}` })))
      .select("id");
    if (error || !plans) throw new Error(`piani: ${error?.message}`);
    const med = (planId: string, name: string, stock: number) => ({
      plan_id: planId, name, pills_per_pack: 20, color: "#FF5E4D", shape: "tonda", dose_morning: 1,
      frequency_type: "daily", start_date: DAY, stock_qty: stock, stock_as_of: DAY,
    });
    const meds = plans.flatMap((p, i) => Array.from({ length: MEDS_PER_PLAN }, (_, j) => med(p.id, `Med ${i}-${j}`, 1000)));
    const { error: mErr } = await admin.from("medications").insert(meds);
    if (mErr) throw new Error(`medicinali: ${mErr.message}`);
    // un piano in più, creato per ultimo, con una medicina quasi finita
    const { data: low } = await admin.from("plans").insert({ owner_id: owner.id, patient_name: "Volume scorta bassa" }).select("id").single();
    lowPlanId = low!.id;
    await admin.from("medications").insert(med(lowPlanId, "Ultima medicina", 2));
  }, 60_000);

  afterAll(cleanup);

  it("legge tutti i piani e tutte le medicine, anche oltre le 1000 righe", async () => {
    const data = await loadCronData(admin);
    const mine = new Set(data.plans.filter((p) => p.owner_id === owner.id).map((p) => p.id));
    expect(mine.size).toBe(PLANS + 1);
    expect(data.meds.filter((m) => mine.has(m.planId))).toHaveLength(PLANS * MEDS_PER_PLAN + 1);
    expect(data.profiles.get(owner.id)?.email).toBe(owner.email);
  });

  it("trova la medicina quasi finita anche nel piano creato per ultimo", async () => {
    const r = await runDailyAlerts(admin, DAY, true);
    expect(r.errors).toEqual([]);
    expect(r.plans.find((p) => p.planId === lowPlanId)).toMatchObject({ outcome: "would_send", medications: ["Ultima medicina"] });
    expect(r.plansChecked).toBeGreaterThanOrEqual(PLANS + 1);
  });

  it("se il tempo è finito non controlla altri piani e lo segnala", async () => {
    const r = await runDailyAlerts(admin, DAY, true, { deadline: Date.now() - 1 });
    expect(r.plansChecked).toBe(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/^Tempo esaurito: \d+ piani su \d+ non sono stati controllati \(avvisi\)/);
    const p = await runPrepReminders(admin, DAY, true, { deadline: Date.now() - 1 });
    expect(p.plansChecked).toBe(0);
  });
});
