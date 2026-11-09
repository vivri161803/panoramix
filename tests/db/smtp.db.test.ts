// Invio vero via SMTP verso il Mailpit del Supabase locale, con le connessioni riusate dei controlli automatici.
// Avvio: npm run test:db

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getEmailProvider, SMTP_POOL_CONNECTIONS } from "@/lib/email/provider";
import { runPool } from "@/lib/batch";

const MAILPIT = process.env.TEST_MAILPIT_URL ?? "";
const enabled = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(MAILPIT);

async function inbox(to: string): Promise<{ Subject: string }[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=100`);
  if (!res.ok) throw new Error(`Mailpit ${res.status}`);
  return ((await res.json()) as { messages: { Subject: string }[] }).messages;
}

describe.skipIf(!enabled)("SMTP con connessioni riusate", () => {
  it("manda molte email in parallelo su poche connessioni e le consegna tutte", async () => {
    Object.assign(process.env, {
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: process.env.TEST_SMTP_PORT ?? "54325",
      SMTP_USER: "test@test.localhost",
      SMTP_PASSWORD: "qualsiasi",
    });
    const to = `pool-${Date.now().toString(36)}@test.localhost`;
    const N = 25;
    const provider = getEmailProvider({ pooled: true });
    try {
      await runPool(Array.from({ length: N }, (_, i) => i), { concurrency: SMTP_POOL_CONNECTIONS + 2 }, async (i) => {
        await provider.send({ to: [to], subject: `Prova ${i}`, html: `<p>${i}</p>`, text: String(i) });
      });
    } finally {
      provider.close?.();
    }
    // Mailpit indicizza in modo asincrono: qualche tentativo prima di arrendersi
    let got: { Subject: string }[] = [];
    for (let i = 0; i < 20 && got.length < N; i++) {
      got = await inbox(to);
      if (got.length < N) await new Promise((r) => setTimeout(r, 150));
    }
    expect(new Set(got.map((m) => m.Subject))).toEqual(new Set(Array.from({ length: N }, (_, i) => `Prova ${i}`)));
  }, 30_000);
});
