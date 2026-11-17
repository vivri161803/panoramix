// Dieci categorie nel browser, contro Supabase locale: un medicinale per categoria attraversa
// Dispenser, calendario, foglio A4, scheda terapia e lista farmacia con l'etichetta della categoria e
// le parole giuste (contenitore e dose). L'email di avviso si controlla in tests/alert-template.test.ts.

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { CATEGORIES } from "../../lib/categories";
import { todayInRome } from "../../lib/dates";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const run = Date.now().toString(36);
const OWNER = `categorie-${run}@test.localhost`;
const PATIENT = `Nonna Categorie ${run}`;

async function magicLink(to: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages[0]) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string };
      const link = msg.Text.match(/https?:\/\/\S+verify\S+/)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Nessun link di accesso per ${to}`);
}

async function login(page: Page) {
  await page.goto("/accesso");
  await page.getByLabel("Email").fill(OWNER);
  await page.getByRole("button", { name: "Invia il link" }).click();
  await expect(page.getByText("Ti abbiamo inviato un link")).toBeVisible();
  await page.goto(await magicLink(OWNER));
  await page.getByLabel("Nome", { exact: true }).fill("Carla");
  await page.getByLabel("Cognome").fill("E2E");
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page).toHaveURL(/\/piani$/);
}

/** I 12 medicinali del piano (punto 62): nome, categoria, giorni per contenitore, confezione, scorta, al bisogno, dose. */
const MEDS = [
  { name: "Med pillola", category: "pillola", shape: "tonda", days: null, pack: 30, stock: 26, prn: false, dose: 1 },
  { name: "Med bustina", category: "bustina", shape: null, days: null, pack: 20, stock: 9, prn: false, dose: 1 },
  { name: "Med liquido", category: "liquido", shape: null, days: 15, pack: 1, stock: 1, prn: false, dose: 5 },
  { name: "Med iniezione", category: "iniezione", shape: null, days: null, pack: 6, stock: 12, prn: false, dose: 1 },
  { name: "Med gocce", category: "gocce", shape: null, days: 30, pack: 1, stock: 2, prn: false, dose: 1 },
  { name: "Med inalatore", category: "inalatore", shape: null, days: 45, pack: 1, stock: 1, prn: false, dose: 2 },
  { name: "Med cerotto", category: "cerotto", shape: null, days: null, pack: 3, stock: 7, prn: false, dose: 1 },
  { name: "Med crema", category: "crema", shape: null, days: 20, pack: 1, stock: 1, prn: false, dose: 1 },
  { name: "Med supposta", category: "supposta", shape: null, days: null, pack: 10, stock: 6, prn: false, dose: 1 },
  { name: "Med altro", category: "altro", shape: null, days: null, pack: 10, stock: 3, prn: false, dose: 1 },
  { name: "Sciroppo al bisogno", category: "liquido", shape: null, days: null, pack: 1, stock: 2, prn: true, dose: 5 },
  { name: "Compressa al bisogno", category: "pillola", shape: "ovale", days: null, pack: 20, stock: 10, prn: true, dose: 1 },
] as const;

/** Testo della scorta nel Dispenser per ogni categoria (contenitore da CATEGORIES, R2.3). */
const STOCK_TEXT: Record<string, RegExp> = {
  pillola: /26\s*compresse rimaste/,
  bustina: /9\s*bustine rimaste/,
  liquido: /circa 15 giorni · 1 flacone/,
  iniezione: /12\s*siringhe rimaste/,
  gocce: /circa 60 giorni · 2 flaconi/,
  inalatore: /circa 45 giorni · 1 inalatore/,
  cerotto: /7\s*cerotti rimasti/,
  crema: /circa 20 giorni · 1 tubo/,
  supposta: /6\s*supposte rimaste/,
  altro: /3\s*pezzi rimasti/,
};

/** Dose del mattino con la sua parola. */
const DOSE_TEXT: Record<string, string> = {
  pillola: "1 compressa",
  bustina: "1 bustina",
  liquido: "5 ml",
  iniezione: "1 siringa",
  gocce: "1 goccia",
  inalatore: "2 erogazioni",
  cerotto: "1 cerotto",
  crema: "1 applicazione",
  supposta: "1 supposta",
  altro: "1 pezzo",
};

test("dieci categorie: Dispenser, calendario, foglio A4, scheda terapia e lista farmacia", async ({ page }) => {
  await login(page);
  const admin = createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: profile } = await admin.from("profiles").select("id").eq("email", OWNER).single();
  const { data: plan, error } = await admin.from("plans").insert({ owner_id: profile!.id, patient_name: PATIENT }).select("id").single();
  expect(error).toBeNull();
  const planId = plan!.id;
  const today = todayInRome();
  const { error: mErr } = await admin.from("medications").insert(
    MEDS.map((m) => ({
      plan_id: planId,
      name: m.name,
      category: m.category,
      shape: m.shape,
      days_per_pack: m.days,
      pills_per_pack: m.pack,
      stock_qty: m.stock,
      stock_as_of: today,
      start_date: today,
      frequency_type: m.prn ? "as_needed" : "daily",
      dose_morning: m.dose,
      color: "#FF5E4D",
    })),
  );
  expect(mErr).toBeNull();

  // Dispenser: etichetta della categoria e parola del contenitore
  await page.goto(`/piani/${planId}`);
  for (const c of CATEGORIES) {
    const card = page.getByRole("group", { name: new RegExp(`^Med ${c.id} `) });
    await expect(card).toContainText(c.label);
    await expect(card).toContainText(STOCK_TEXT[c.id]);
  }
  await expect(page.getByRole("group", { name: /^Sciroppo al bisogno/ }).getByRole("button", { name: /Finito un flacone/ })).toHaveText("Finito un flacone");
  await expect(page.getByRole("group", { name: /^Compressa al bisogno/ }).getByRole("button", { name: /Presa di/ })).toHaveText("− Presa 1");

  await page.goto(`/piani/${planId}/calendario`);
  for (const c of CATEGORIES) {
    await expect(page.getByText(`Med ${c.id}`, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(c.label, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  }
  for (const d of Object.values(DOSE_TEXT)) await expect(page.getByText(d, { exact: true }).filter({ visible: true }).first()).toBeVisible();

  await page.goto(`/piani/${planId}/stampa`);
  const sheet = page.locator("#px-sheet");
  for (const c of CATEGORIES) await expect(sheet).toContainText(c.label);
  for (const d of Object.values(DOSE_TEXT)) await expect(sheet).toContainText(`· ${d}`);

  await page.goto(`/piani/${planId}/terapia`);
  for (const c of CATEGORIES) await expect(page.locator("body")).toContainText(c.label);
  for (const w of ["compressa", "ml", "goccia", "erogazioni", "applicazione", "siringa", "cerotto", "supposta", "pezzo", "bustina"]) {
    await expect(page.locator("tbody")).toContainText(w);
  }

  await page.goto(`/piani/${planId}/farmacia`);
  for (const c of CATEGORIES) await expect(page.getByText(new RegExp(`^${c.label} · `)).first()).toBeVisible();
  await expect(page.getByText("Liquido · 1 flacone per confezione").first()).toBeVisible();
  await expect(page.getByText("Pillola · 30 compresse per confezione")).toBeVisible();
});
