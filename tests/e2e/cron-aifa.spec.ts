// Controllo del mattino e dati AIFA, contro l'app vera in locale: /api/cron/alerts con il segreto
// di prova, dati AIFA fermi da 9 giorni (file non trovato) e controllo dell'email tecnica in Mailpit.

import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadAifaSample } from "../helpers/aifa-sample";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const OPS = "ops@test.localhost"; // OPS_ALERT_EMAIL in playwright.config.ts
const AUTH = { Authorization: "Bearer e2e" }; // CRON_SECRET in playwright.config.ts
const run = Date.now().toString(36);
const SOURCES = ["confezioni", "principi_attivi", "atc", "carenze", "trasparenza"];
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

let admin: SupabaseClient;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  admin = createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await admin.from("aifa_imports").delete().not("id", "is", null);
  // tutte le sorgenti ferme da 9 giorni tranne i principi attivi; le carenze falliscono da allora
  await admin.from("aifa_imports").insert([
    ...SOURCES.map((source) => ({ source, status: "ok", rows: 10, started_at: daysAgo(9), finished_at: daysAgo(9) })),
    { source: "principi_attivi", status: "skipped", started_at: daysAgo(1), finished_at: daysAgo(1) },
    ...[8, 4, 1].map((d) => ({ source: "carenze", status: "failed", started_at: daysAgo(d), finished_at: daysAgo(d), error: `Download non riuscito (404 Not Found) [${run}]` })),
  ]);
});

test.afterAll(async () => {
  await loadAifaSample(admin); // import riusciti di oggi per gli altri test
});

async function opsMails(): Promise<string[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${OPS}`)}&limit=50`);
  const { messages } = (await res.json()) as { messages: { ID: string }[] };
  const texts: string[] = [];
  for (const m of messages) texts.push(((await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as { Text: string }).Text);
  return texts.filter((t) => t.includes(run));
}

async function cron(request: APIRequestContext, query = "") {
  const res = await request.get(`/api/cron/alerts${query}`, { headers: AUTH });
  return { status: res.status(), body: (await res.json()) as { problems: string[] } };
}

test("senza il segreto il controllo non parte", async ({ request }) => {
  expect((await request.get("/api/cron/alerts?dry=1")).status()).toBe(401);
});

test("prova a secco: i dati AIFA fermi compaiono tra i problemi, nessuna email", async ({ request }) => {
  const { status, body } = await cron(request, "?dry=1");
  expect(status).toBe(207);
  const aifa = body.problems.filter((p) => p.startsWith("Dati AIFA"));
  expect(aifa).toHaveLength(4); // i principi attivi sono stati controllati ieri
  const carenze = aifa.find((p) => p.includes("farmaci carenti"))!;
  expect(carenze).toMatch(/non aggiornati da 9 giorni/);
  expect(carenze).toContain("404 Not Found");
  expect(carenze).toMatch(/restano quelle dell'ultimo import riuscito/);
  expect(aifa.some((p) => p.includes("principi attivi"))).toBe(false);
  expect(await opsMails()).toEqual([]);
});

test("controllo vero: parte l'email tecnica a OPS_ALERT_EMAIL", async ({ request }) => {
  const { body } = await cron(request);
  expect(body.problems.filter((p) => p.startsWith("Dati AIFA"))).toHaveLength(4);
  await expect.poll(async () => (await opsMails()).length, { timeout: 15_000 }).toBe(1);
  const [text] = await opsMails();
  expect(text).toContain("Dati AIFA (farmaci carenti) non aggiornati da 9 giorni");
  expect(text).toContain("Dati AIFA (anagrafica delle confezioni)");
  expect(text).toContain("aifa_imports");
  expect(text).toContain("Avvisi e promemoria sono partiti");
});

test("dati di nuovo freschi: nessun problema AIFA", async ({ request }) => {
  await admin.from("aifa_imports").insert(SOURCES.map((source) => ({ source, status: "skipped", finished_at: new Date().toISOString() })));
  const { body } = await cron(request, "?dry=1");
  expect(body.problems.filter((p) => p.startsWith("Dati AIFA"))).toEqual([]);
});
