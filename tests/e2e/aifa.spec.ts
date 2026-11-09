// Dati AIFA nel browser, contro Supabase locale: codice AIC → modulo compilato, colore dal gruppo
// ATC, legenda, scheda Disponibilità con carenza ed equivalenti. Lo scanner si apre e si chiude
// (la fotocamera vera si prova a mano sul telefono).

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadAifaSample } from "../helpers/aifa-sample";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const run = Date.now().toString(36);
const OWNER = `aifa-${run}@test.localhost`;
const PATIENT = `Nonno AIFA ${run}`;

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

test.beforeAll(async () => {
  const admin = createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await loadAifaSample(admin);
});

test("codice AIC, colore per gruppo e scheda Disponibilità", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Crea il primo piano" }).click();
  await page.getByLabel("Nome della persona").fill(PATIENT);
  await page.getByRole("button", { name: "Crea piano" }).click();
  await expect(page.getByRole("heading", { name: PATIENT })).toBeVisible();
  const planUrl = page.url();

  // lo scanner si apre e si chiude (senza fotocamera propone la foto)
  await page.getByRole("link", { name: "Aggiungi il primo medicinale" }).click();
  await page.getByRole("button", { name: "Inquadra il codice sulla scatola" }).click();
  const dialog = page.getByRole("dialog", { name: "Inquadra il codice sulla scatola" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Scatta una foto" })).toBeVisible();
  await dialog.getByRole("button", { name: "Chiudi" }).click();
  await expect(dialog).toHaveCount(0);

  // codice non valido e codice che non c'è
  await page.getByLabel("oppure scrivi il codice AIC").fill("12345");
  await page.getByRole("button", { name: "Cerca" }).click();
  await expect(page.getByText(/Questo codice non contiene l’AIC/)).toBeVisible();
  await page.getByLabel("oppure scrivi il codice AIC").fill("099999999");
  await page.getByRole("button", { name: "Cerca" }).click();
  await expect(page.getByText(/non è nell'anagrafica AIFA/)).toBeVisible();

  // Triatec dal codice del bollino: campi compilati, gruppo in sola lettura
  await page.getByLabel("oppure scrivi il codice AIC").fill("A027161064");
  await page.getByRole("button", { name: "Cerca" }).click();
  await expect(page.getByText("Dati presi da AIFA: controllali prima di salvare")).toBeVisible();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Triatec");
  await expect(page.getByLabel(/^Dosaggio/)).toHaveValue("Ramipril 5 mg");
  await expect(page.getByLabel("Compresse per confezione")).toHaveValue("14");
  await expect(page.getByText("Cuore e circolazione")).toBeVisible();
  await expect(page.getByLabel("A cosa serve")).toHaveCount(0);
  await page.getByLabel(/Compresse in casa/).fill("10");
  await page.getByRole("button", { name: "Salva e aggiungine un altro" }).click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("");
  await expect(page).toHaveURL(`${planUrl}/medicinali/nuovo`);

  // Acarbosio, carente
  await page.getByLabel("oppure scrivi il codice AIC").fill("047612027");
  await page.getByRole("button", { name: "Cerca" }).click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Acarbosio Aurobindo");
  await page.getByLabel(/Compresse in casa/).fill("20");
  await page.getByRole("button", { name: "Salva e aggiungine un altro" }).click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("");
  await expect(page).toHaveURL(`${planUrl}/medicinali/nuovo`);

  // a mano, senza codice: "A cosa serve" è obbligatorio
  await page.getByLabel("Nome", { exact: true }).fill("Vitamina D");
  await page.getByLabel(/Compresse in casa/).fill("4");
  await page.getByRole("button", { name: "Salva medicinale" }).click();
  await expect(page.getByText("Scegli a cosa serve il medicinale.")).toBeVisible();
  await page.getByLabel("A cosa serve").selectOption({ label: "Non so" });
  await page.getByRole("button", { name: "Salva medicinale" }).click();
  await expect(page).toHaveURL(planUrl);

  // legenda dei gruppi sotto il dispenser
  const legend = page.getByRole("region", { name: "Colori" });
  await expect(legend.getByText("Cuore e circolazione")).toBeVisible();
  await expect(legend.getByText("Stomaco, intestino e metabolismo")).toBeVisible();
  await expect(legend.getByText("Non so")).toBeVisible();

  // scheda Disponibilità
  await page.getByRole("link", { name: "Disponibilità" }).click();
  await expect(page).toHaveURL(`${planUrl}/disponibilita`);
  const triatec = page.getByRole("region", { name: "Triatec" });
  await expect(triatec.getByText("Non risulta tra i farmaci carenti")).toBeVisible();
  await expect(triatec.getByText("Prezzo di riferimento SSN:")).toContainText("1,80");
  const rows = triatec.getByRole("row");
  await expect(rows.nth(1)).toContainText("RAMIPRIL ALTER");
  await expect(rows.nth(1)).toContainText("Nessuna differenza");
  await expect(triatec.locator("tr[aria-current]")).toContainText("TRIATEC");
  const acarbosio = page.getByRole("region", { name: "Acarbosio Aurobindo" });
  await expect(acarbosio.getByText("In carenza")).toBeVisible();
  await expect(acarbosio.getByText("Problemi produttivi")).toBeVisible();
  await expect(acarbosio.getByText("Nessun equivalente nelle liste di trasparenza AIFA.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Vitamina D" }).getByText("Aggiungi il codice AIC per vedere carenze ed equivalenti.")).toBeVisible();
  await expect(page.getByText(/Dati AIFA aggiornati: farmaci carenti al 5 novembre 2026/)).toBeVisible();

  // a 320 px le tre schede restano dentro lo schermo
  await page.setViewportSize({ width: 320, height: 700 });
  const nav = page.getByRole("navigation", { name: "Viste del piano" });
  const box = await nav.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
