// Server Actions con Supabase, Next e email simulati: permessi e parametri passati al database.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { forecastPlan, type DoseChange } from "@/lib/forecast";
import type { Medication, PlanRow } from "@/lib/db-types";
import { OWNER_ONLY_MESSAGE, READ_ONLY_MESSAGE, type PlanRole } from "@/lib/roles";
import { MON, medication, planSettings } from "./helpers/fixtures";

// ——— finti Next, Supabase ed email ———

type Result = { data?: unknown; error?: { code?: string; message?: string; hint?: string } | null };

const db = vi.hoisted(() => ({
  results: {} as Record<string, unknown[]>,
  calls: [] as { table: string; ops: [string, unknown[]][] }[],
  rpc: [] as [string, Record<string, unknown>][],
  rpcResult: { data: "ev-1", error: null } as { data: unknown; error: unknown },
  sent: [] as { to: string[]; subject: string }[],
  sendFails: false,
  bundle: null as unknown,
}));

function builder(table: string) {
  const queue = db.results[table] ?? [];
  const result = (queue.length ? queue.shift() : { data: [], error: null }) as Result;
  const entry = { table, ops: [] as [string, unknown[]][] };
  db.calls.push(entry);
  const b: Record<string, unknown> = {};
  for (const m of ["select", "insert", "update", "delete", "upsert", "eq", "in", "is", "order", "limit", "maybeSingle", "single"]) {
    b[m] = (...args: unknown[]) => {
      entry.ops.push([m, args]);
      return b;
    };
  }
  b.then = (res: (r: Result) => unknown, rej: (e: unknown) => unknown) => Promise.resolve({ error: null, ...result }).then(res, rej);
  return b;
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: vi.fn() }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (t: string) => builder(t),
    rpc: async (name: string, params: Record<string, unknown>) => {
      db.rpc.push([name, params]);
      return db.rpcResult;
    },
  }),
}));
vi.mock("@/lib/email/provider", () => ({
  getEmailProvider: () => ({
    name: "test",
    send: async (m: { to: string[]; subject: string }) => {
      if (db.sendFails) throw new Error("SMTP giù");
      db.sent.push({ to: m.to, subject: m.subject });
      return {};
    },
  }),
}));
vi.mock("@/lib/data", () => ({
  getPlanBundle: async () => db.bundle,
  requireProfile: async () => (db.bundle as { profile: unknown }).profile,
  fullName: (p: { first_name?: string; last_name?: string } | null, fallback = "") => `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || fallback,
}));

import { arrivePacks, markOrdered, preparePillbox, recountStock, takeAsNeeded, undoStockEvent } from "@/lib/actions/stock";
import { addDoseChange, createMedication, deleteDoseChange, updateMedication } from "@/lib/actions/medications";
import { deletePlan, updatePlan } from "@/lib/actions/plans";
import { inviteMember, leavePlan } from "@/lib/actions/sharing";
import { sendTestEmail } from "@/lib/actions/email";

const PLAN: PlanRow = {
  id: "11111111-1111-1111-1111-111111111111",
  owner_id: "owner",
  patient_name: "Nonna Anna",
  notes: "",
  stock_mode: "daily",
  mode_since: "2026-11-02",
  prep_weekday: 7,
  alert_under_14: true,
  alert_under_7: false,
  alert_last_pack: true,
  prep_reminder: true,
  weekly_summary: false,
  created_at: "2026-11-01T00:00:00Z",
};

function setBundle(role: PlanRole, meds: Medication[], extra: Record<string, unknown> = {}) {
  const settings = planSettings();
  db.bundle = {
    profile: { id: role === "owner" ? "owner" : "me", email: role === "owner" ? "carlo@x.it" : "maria@x.it", first_name: "Carlo", last_name: "Bianchi" },
    role,
    ownerName: "Carlo Bianchi",
    plan: PLAN,
    settings,
    medications: meds,
    runRows: [],
    recipients: [],
    members: [],
    invites: [],
    today: MON,
    forecast: forecastPlan(settings, meds, [], MON),
    ...extra,
  };
}

const daily = medication({ id: "daily", name: "Ramipril", stockQty: 20, stockAsOf: MON });
const prn = medication({ id: "prn", name: "Paracetamolo", frequencyType: "as_needed", stockQty: 6, stockAsOf: "2026-11-01" });

const validMed = {
  name: "Nuovo",
  strength: "",
  description: "",
  pills_per_pack: 30,
  requires_prescription: false,
  aic: null,
  atc_code: "C",
  shape: "tonda" as const,
  dose_morning: 1,
  dose_noon: 0,
  dose_evening: 0,
  frequency_type: "daily" as const,
  weekdays: [],
  interval_days: null,
  cycle_on: null,
  cycle_off: null,
  start_date: MON,
  end_date: null,
  stock_qty: 10,
};

beforeEach(() => {
  db.results = {};
  db.calls = [];
  db.rpc = [];
  db.rpcResult = { data: "ev-1", error: null };
  db.sent = [];
  db.sendFails = false;
});

describe("sola lettura", () => {
  beforeEach(() => setBundle("viewer", [daily, prn]));

  it("chi ha sola lettura non cambia scorte, medicinali né portapillole", async () => {
    const results = await Promise.all([
      arrivePacks(PLAN.id, daily.id, 1),
      recountStock(PLAN.id, daily.id, 3),
      takeAsNeeded(PLAN.id, prn.id, 1),
      markOrdered(PLAN.id, [daily.id]),
      preparePillbox(PLAN.id),
      createMedication(PLAN.id, validMed),
      addDoseChange(PLAN.id, daily.id, { effective_date: "2026-11-20", dose_morning: 0.5, dose_noon: 0, dose_evening: 0 }),
      deleteDoseChange(PLAN.id, daily.id, "dc"),
    ]);
    for (const r of results) expect(r).toEqual({ ok: false, error: READ_ONLY_MESSAGE, fieldErrors: undefined });
    expect(db.rpc).toEqual([]);
    expect(db.calls).toEqual([]);
  });
});

describe("solo il proprietario", () => {
  beforeEach(() => setBundle("editor", [daily]));

  it("chi può modificare non cambia impostazioni, persone né elimina il piano", async () => {
    const input = { patient_name: "X", notes: "", stock_mode: "daily" as const, prep_weekday: 7, alert_under_14: true, alert_under_7: false, alert_last_pack: true, recipients: [] };
    for (const r of await Promise.all([updatePlan(PLAN.id, input), deletePlan(PLAN.id), inviteMember(PLAN.id, { email: "a@b.it", role: "viewer" }), sendTestEmail(PLAN.id)])) {
      expect(r).toMatchObject({ ok: false, error: OWNER_ONLY_MESSAGE });
    }
    expect(db.calls).toEqual([]);
  });

  it("ma può aggiornare le scorte", async () => {
    const r = await arrivePacks(PLAN.id, daily.id, 2);
    expect(r.ok).toBe(true);
    expect(db.rpc[0][1]).toMatchObject({ p_type: "arrival", p_delta: 60, p_qty_after: 80, p_clear_ordered: true });
  });
});

describe("presa al bisogno", () => {
  beforeEach(() => setBundle("owner", [daily, prn]));

  it("toglie le compresse prese e registra un movimento 'use'", async () => {
    const r = await takeAsNeeded(PLAN.id, prn.id, 1);
    expect(r).toEqual({ ok: true, message: "Paracetamolo: presa 1 compressa, ne restano 5", data: { eventId: "ev-1" } });
    expect(db.rpc).toEqual([
      [
        "record_stock_event",
        {
          p_medication_id: "prn",
          p_type: "use",
          p_delta: -1,
          p_qty_after: 5,
          p_effective_date: MON,
          p_expected_qty: 6,
          p_expected_as_of: "2026-11-01",
          p_clear_ordered: false,
          p_meta: { taken: 1 },
        },
      ],
    ]);
  });

  it("mezze compresse e mai sotto zero", async () => {
    await takeAsNeeded(PLAN.id, prn.id, 0.5);
    expect(db.rpc[0][1]).toMatchObject({ p_delta: -0.5, p_qty_after: 5.5 });
    await takeAsNeeded(PLAN.id, prn.id, 10);
    expect(db.rpc[1][1]).toMatchObject({ p_delta: -6, p_qty_after: 0 });
  });

  it("rifiuta i medicinali a orario, le quantità non valide e le scorte finite", async () => {
    expect(await takeAsNeeded(PLAN.id, daily.id, 1)).toMatchObject({ ok: false, error: "Si registrano le prese solo per i medicinali al bisogno." });
    expect(await takeAsNeeded(PLAN.id, prn.id, 0.3)).toMatchObject({ ok: false });
    expect(await takeAsNeeded(PLAN.id, prn.id, 0)).toMatchObject({ ok: false });
    setBundle("owner", [{ ...prn, stockQty: 0 }]);
    expect(await takeAsNeeded(PLAN.id, prn.id, 1)).toMatchObject({ ok: false, error: expect.stringContaining("risulta finita") });
    expect(db.rpc).toEqual([]);
  });

  it("si può annullare: rimette le compresse", async () => {
    db.results.stock_events = [{ data: { id: "ev-9", type: "use", delta: -1, meta: { taken: 1 } } }];
    const r = await undoStockEvent(PLAN.id, prn.id, "ev-9");
    expect(r.ok).toBe(true);
    expect(db.rpc[0][1]).toMatchObject({ p_type: "adjust", p_delta: 1, p_qty_after: 7, p_meta: { undo_of: "ev-9" } });
  });
});

describe("segna come ordinate", () => {
  it("aggiorna solo quelle non ancora ordinate", async () => {
    const already = medication({ id: "x", orderedAt: "2026-11-08T10:00:00Z" });
    setBundle("owner", [daily, already]);
    const r = await markOrdered(PLAN.id, [daily.id, already.id, "estraneo"]);
    expect(r).toEqual({ ok: true, message: "1 medicinale segnato come ordinato" });
    const call = db.calls.find((c) => c.table === "medications")!;
    expect(call.ops.find(([m]) => m === "in")![1]).toEqual(["id", ["daily"]]);
  });
});

describe("cambi di dose", () => {
  const changes: DoseChange[] = [
    { id: "past", from: "2026-11-05", doseMorning: 2, doseNoon: 0, doseEvening: 0 },
    { id: "future", from: "2026-11-20", doseMorning: 0.5, doseNoon: 0, doseEvening: 0 },
  ];

  beforeEach(() => setBundle("owner", [{ ...daily, doseChanges: changes }, prn]));

  it("programma un cambio da domani in poi", async () => {
    const r = await addDoseChange(PLAN.id, daily.id, { effective_date: "2026-11-20", dose_morning: 0.5, dose_noon: 0, dose_evening: 0 });
    expect(r).toEqual({ ok: true, message: "Ramipril da ven 20 nov: ½ al mattino" });
    const up = db.calls.find((c) => c.table === "dose_changes")!.ops.find(([m]) => m === "upsert")!;
    expect(up[1]).toEqual([{ medication_id: "daily", effective_date: "2026-11-20", dose_morning: 0.5, dose_noon: 0, dose_evening: 0 }, { onConflict: "medication_id,effective_date" }]);
  });

  it("rifiuta oggi, date passate, dopo la fine e i medicinali al bisogno", async () => {
    expect(await addDoseChange(PLAN.id, daily.id, { effective_date: MON, dose_morning: 1, dose_noon: 0, dose_evening: 0 })).toMatchObject({ ok: false, fieldErrors: { effective_date: expect.any(String) } });
    expect(await addDoseChange(PLAN.id, prn.id, { effective_date: "2026-11-20", dose_morning: 1, dose_noon: 0, dose_evening: 0 })).toMatchObject({ ok: false });
    setBundle("owner", [{ ...daily, endDate: "2026-11-15" }]);
    expect(await addDoseChange(PLAN.id, daily.id, { effective_date: "2026-11-20", dose_morning: 1, dose_noon: 0, dose_evening: 0 })).toMatchObject({ ok: false, error: "Il cambio è dopo la fine della terapia." });
    expect(db.calls).toEqual([]);
  });

  it("salvando il medicinale i cambi già iniziati confluiscono nelle dosi, quelli futuri restano", async () => {
    db.results.medications = [{ data: [{ id: "daily" }] }];
    await expect(updateMedication(PLAN.id, daily.id, { ...validMed, name: "Ramipril", stock_qty: 20 })).rejects.toThrow("REDIRECT");
    const del = db.calls.find((c) => c.table === "dose_changes")!;
    expect(del.ops).toEqual([
      ["delete", []],
      ["in", ["id", ["past"]]],
    ]);
  });
});

describe("colore dal gruppo ATC", () => {
  beforeEach(() => setBundle("owner", [daily]));
  const inserted = () => db.calls.find((c) => c.table === "medications")!.ops.find(([op]) => op === "insert")![1][0] as Record<string, unknown>;

  it("il colore lo calcola il server dalla lettera scelta", async () => {
    db.results.medications = [{ data: { id: "new" } }];
    await expect(createMedication(PLAN.id, { ...validMed, atc_code: "n" })).rejects.toThrow("REDIRECT");
    expect(inserted()).toMatchObject({ atc_code: "N", aic: null, color: "#8D5BF5" });
  });

  it("“Non so”: grigio e atc_code vuoto", async () => {
    db.results.medications = [{ data: { id: "new" } }];
    await expect(createMedication(PLAN.id, { ...validMed, atc_code: "?" })).rejects.toThrow("REDIRECT");
    expect(inserted()).toMatchObject({ atc_code: null, color: "#9AA1A9" });
  });

  it("con l'AIC vale il codice ATC dell'anagrafica AIFA", async () => {
    db.results.aifa_packs = [{ data: { atc_code: "B01AC06" } }];
    db.results.medications = [{ data: { id: "new" } }];
    await expect(createMedication(PLAN.id, { ...validMed, aic: "024840074", atc_code: "C" })).rejects.toThrow("REDIRECT");
    expect(inserted()).toMatchObject({ aic: "024840074", atc_code: "B01AC06", color: "#12C2B0" });
  });

  it("senza gruppo il modulo non si salva", async () => {
    expect(await createMedication(PLAN.id, { ...validMed, atc_code: "" })).toMatchObject({ ok: false, fieldErrors: { atc_code: "Scegli a cosa serve il medicinale." } });
    expect(await createMedication(PLAN.id, { ...validMed, aic: "12345" })).toMatchObject({ ok: false, fieldErrors: { aic: "Il codice AIC ha 9 cifre." } });
  });
});

describe("inviti", () => {
  beforeEach(() =>
    setBundle("owner", [daily], {
      members: [{ plan_id: PLAN.id, user_id: "m1", role: "viewer", created_at: "", profile: { first_name: "Maria", last_name: "T", email: "maria@x.it" } }],
      invites: [{ id: "i1", plan_id: PLAN.id, email: "luca@x.it", role: "editor", created_at: "" }],
    }),
  );

  it("non si invita sé stessi, chi ha già accesso o chi è già invitato", async () => {
    expect(await inviteMember(PLAN.id, { email: "Carlo@x.it", role: "viewer" })).toMatchObject({ ok: false, error: "Sei già il proprietario del piano." });
    expect(await inviteMember(PLAN.id, { email: "maria@x.it", role: "editor" })).toMatchObject({ ok: false, error: "Questa persona ha già accesso al piano." });
    expect(await inviteMember(PLAN.id, { email: "luca@x.it", role: "viewer" })).toMatchObject({ ok: false, error: "Questa persona è già stata invitata." });
    expect(await inviteMember(PLAN.id, { email: "non-una-email", role: "viewer" })).toMatchObject({ ok: false, fieldErrors: { email: expect.any(String) } });
    expect(db.calls).toEqual([]);
  });

  it("salva l'invito e manda l'email all'invitato", async () => {
    const r = await inviteMember(PLAN.id, { email: " Nuovo@X.it ", role: "editor" });
    expect(r).toEqual({ ok: true, message: "Invito inviato a nuovo@x.it" });
    expect(db.calls[0].ops[0]).toEqual(["insert", [{ plan_id: PLAN.id, email: "nuovo@x.it", role: "editor" }]]);
    expect(db.sent).toEqual([{ to: ["nuovo@x.it"], subject: "Carlo Bianchi ti invita a seguire le medicine di Nonna Anna" }]);
  });

  it("se l'email non parte l'invito resta valido e lo dice", async () => {
    db.sendFails = true;
    const r = await inviteMember(PLAN.id, { email: "nuovo@x.it", role: "viewer" });
    expect(r).toMatchObject({ ok: true, message: expect.stringContaining("l’email non è partita") });
  });

  it("limite di 10 persone", async () => {
    db.results.plan_invites = [{ error: { code: "23514", hint: "members_limit" } }];
    expect(await inviteMember(PLAN.id, { email: "nuovo@x.it", role: "viewer" })).toMatchObject({ ok: false, error: "Hai raggiunto il massimo di 10 persone per piano." });
  });

  it("il proprietario non può 'lasciare' il proprio piano", async () => {
    expect(await leavePlan(PLAN.id)).toMatchObject({ ok: false });
  });
});
