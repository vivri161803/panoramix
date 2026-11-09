import { describe, expect, it } from "vitest";
import { summarizeUsage, type UsageRaw } from "@/lib/usage-stats";
import { renderUsageEmail } from "@/lib/email/templates";

const since = new Date("2026-11-02T08:00:00Z");
const before = "2026-10-20T10:00:00Z";
const inside = "2026-11-05T10:00:00Z";

const raw: UsageRaw = {
  users: [
    { id: "a", created_at: before, last_sign_in_at: inside },
    { id: "b", created_at: inside, last_sign_in_at: inside },
    { id: "c", created_at: before, last_sign_in_at: before },
    { id: "d", created_at: before, last_sign_in_at: null },
  ],
  plans: [
    { id: "p1", created_at: before },
    { id: "p2", created_at: inside },
    { id: "p3", created_at: before },
  ],
  members: [{ plan_id: "p1" }, { plan_id: "p1" }, { plan_id: "p2" }],
  pendingInvites: 2,
  activeMeds: 9,
  // "c" non ha rifatto l'accesso ma ha registrato un movimento; null = utente eliminato
  stockEvents: [{ created_by: "c" }, { created_by: "a" }, { created_by: null }],
  preps: [{ created_by: "a" }],
  alertRuns: [
    { status: "sent", recipients: ["x", "y"] },
    { status: "failed", recipients: ["x"] },
  ],
  notificationRuns: [
    { status: "sent", recipients: ["x", "y", "z"] },
    { status: "sending", recipients: null },
  ],
};

describe("summarizeUsage", () => {
  const u = summarizeUsage(raw, since);

  it("conta account, accessi e persone attive senza doppioni", () => {
    expect(u.accounts).toEqual({ total: 4, created: 1, signedIn: 2 });
    expect(u.recorded).toBe(2);
    expect(u.active).toBe(3);
  });

  it("conta piani nuovi e condivisi", () => {
    expect(u.plans).toEqual({ total: 3, created: 1, shared: 2 });
    expect(u.members).toBe(3);
    expect(u.pendingInvites).toBe(2);
    expect(u.activeMeds).toBe(9);
    expect(u.movements).toBe(4);
  });

  it("conta solo gli invii riusciti e i loro destinatari", () => {
    expect(u.emails).toEqual({ alerts: 1, notifications: 1, failed: 1, recipients: 5, recipientsPerDay: 0.7 });
  });

  it("senza dati restituisce zeri", () => {
    const empty = summarizeUsage({ users: [], plans: [], members: [], pendingInvites: 0, activeMeds: 0, stockEvents: [], preps: [], alertRuns: [], notificationRuns: [] }, since);
    expect(empty.active).toBe(0);
    expect(empty.emails.recipientsPerDay).toBe(0);
  });
});

describe("renderUsageEmail", () => {
  const dates = { from: "2026-11-02", to: "2026-11-09", appUrl: "https://panoramix.example" };

  it("oggetto, periodo e numeri in HTML e nel testo", () => {
    const e = renderUsageEmail(summarizeUsage(raw, since), dates);
    expect(e.subject).toBe("[Panoramix] Utilizzo: 3 persone attive negli ultimi 7 giorni");
    expect(e.text).toContain("Dal 2 novembre al 9 novembre 2026.");
    expect(e.text).toContain("• Piani condivisi: 2");
    expect(e.text).toContain("• Destinatari al giorno, in media: 0,7");
    expect(e.html).toContain("Hanno fatto l&#39;accesso");
    expect(e.text).not.toContain("Gmail ne accetta");
  });

  it("singolare con una persona attiva", () => {
    const one = summarizeUsage({ ...raw, users: [raw.users[0]], stockEvents: [], preps: [] }, since);
    expect(renderUsageEmail(one, dates).subject).toBe("[Panoramix] Utilizzo: 1 persona attiva negli ultimi 7 giorni");
  });

  it("avvisa quando gli invii si avvicinano al limite di Gmail", () => {
    const busy = summarizeUsage({ ...raw, alertRuns: Array.from({ length: 1500 }, () => ({ status: "sent", recipients: ["a", "b"] })) }, since);
    const e = renderUsageEmail(busy, dates);
    expect(e.text).toContain("Gmail ne accetta circa 500");
    expect(e.text).toContain("EMAIL_PROVIDER=resend");
  });
});
