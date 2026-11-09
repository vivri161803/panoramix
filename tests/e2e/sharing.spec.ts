// Percorso completo nel browser, contro Supabase locale e Mailpit:
// accesso con link, nuovo piano, medicinale al bisogno, presa, lista farmacia,
// invito in sola lettura, accettazione e verifica che non si possa modificare.

import { expect, test, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const run = Date.now().toString(36);
const OWNER = `owner-${run}@test.localhost`;
const VIEWER = `viewer-${run}@test.localhost`;
const PATIENT = `Nonna E2E ${run}`;

/** Aspetta l'email con il link di accesso in Mailpit e restituisce il link. */
async function magicLink(to: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string; Subject: string }[] };
    const login = messages.find((m) => !m.Subject.includes("invita"));
    if (login) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${login.ID}`)).json()) as { Text: string };
      const link = msg.Text.match(/https?:\/\/\S+verify\S+/)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Nessun link di accesso per ${to}`);
}

async function login(page: Page, email: string, first: string) {
  await page.goto("/accesso");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Invia il link" }).click();
  await expect(page.getByText("Ti abbiamo inviato un link")).toBeVisible();
  await page.goto(await magicLink(email));
  await expect(page).toHaveURL(/\/benvenuto/);
  await page.getByLabel("Nome", { exact: true }).fill(first);
  await page.getByLabel("Cognome").fill("E2E");
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page).toHaveURL(/\/piani$/);
}

test("piano condiviso: il proprietario aggiorna, chi ha sola lettura guarda", async ({ browser }) => {
  const ownerPage = await (await browser.newContext()).newPage();
  await login(ownerPage, OWNER, "Carlo");

  // nuovo piano
  await ownerPage.getByRole("link", { name: "Crea il primo piano" }).click();
  await ownerPage.getByLabel("Nome della persona").fill(PATIENT);
  await ownerPage.getByRole("button", { name: "Crea piano" }).click();
  await expect(ownerPage.getByRole("heading", { name: PATIENT })).toBeVisible();
  const planUrl = ownerPage.url();

  // medicinale al bisogno con 6 compresse in casa
  await ownerPage.getByRole("link", { name: "Aggiungi il primo medicinale" }).click();
  await ownerPage.getByLabel("Nome", { exact: true }).fill("Paracetamolo");
  await ownerPage.getByRole("radio", { name: "Al bisogno" }).click();
  await ownerPage.getByLabel("A cosa serve").selectOption({ label: "Sistema nervoso" });
  await ownerPage.getByLabel(/Scorta in casa|Compresse in casa/).fill("6");
  await ownerPage.getByRole("button", { name: "Salva medicinale" }).click();
  await expect(ownerPage).toHaveURL(planUrl);

  // presa al bisogno: 6 → 5
  await ownerPage.getByRole("button", { name: /Presa una compressa di Paracetamolo/ }).click();
  await expect(ownerPage.getByText("Paracetamolo: presa 1 compressa, ne restano 5")).toBeVisible();

  // lista per la farmacia
  await ownerPage.goto(`${planUrl}/farmacia`);
  await ownerPage.getByRole("checkbox").check();
  await expect(ownerPage.locator("pre").first()).toContainText(`Medicine per ${PATIENT}`);
  await expect(ownerPage.locator("pre").first()).toContainText("• Paracetamolo — 1 confezione da");

  // invito in sola lettura
  await ownerPage.goto(`${planUrl}/modifica`);
  await ownerPage.getByLabel("Invita una persona").fill(VIEWER);
  await ownerPage.getByRole("button", { name: "Manda l’invito" }).click();
  await expect(ownerPage.getByText(`Invito inviato a ${VIEWER}`)).toBeVisible();
  await expect(ownerPage.getByText("Invito in attesa")).toBeVisible();

  // la persona invitata entra, accetta e vede il piano in sola lettura
  const viewerPage = await (await browser.newContext()).newPage();
  await login(viewerPage, VIEWER, "Maria");
  await expect(viewerPage.getByText(`Carlo E2E ti invita a seguire il piano di ${PATIENT}`)).toBeVisible();
  await viewerPage.getByRole("button", { name: "Accetta" }).click();
  await expect(viewerPage).toHaveURL(planUrl);
  await expect(viewerPage.getByText("Piano condiviso da Carlo E2E")).toBeVisible();
  await expect(viewerPage.getByText("5", { exact: true }).first()).toBeVisible();
  await expect(viewerPage.getByRole("button", { name: /Presa una compressa/ })).toHaveCount(0);
  await expect(viewerPage.getByRole("button", { name: /Arrivata confezione/ })).toHaveCount(0);
  await expect(viewerPage.getByRole("link", { name: "Impostazioni piano" })).toHaveCount(0);

  // le pagine di modifica rimandano al piano
  await viewerPage.goto(`${planUrl}/modifica`);
  await expect(viewerPage).toHaveURL(planUrl);
  await viewerPage.goto(`${planUrl}/medicinali/nuovo`);
  await expect(viewerPage).toHaveURL(planUrl);

  // lo storico dice chi ha registrato la presa
  await viewerPage.getByRole("link", { name: "Storico" }).click();
  await expect(viewerPage.getByText(/Presa al bisogno/)).toBeVisible();
  await expect(viewerPage.getByText(/da Carlo E2E/).first()).toBeVisible();

  // la scheda Disponibilità si apre anche in sola lettura
  await viewerPage.goto(`${planUrl}/disponibilita`);
  await expect(viewerPage.getByRole("heading", { name: "Carenze ed equivalenti" })).toBeVisible();
  await expect(viewerPage.getByText("Aggiungi il codice AIC per vedere carenze ed equivalenti.")).toBeVisible();
  await expect(viewerPage.getByRole("link", { name: "Aggiungi il codice →" })).toHaveCount(0);

  // il piano compare tra i suoi, segnato come condiviso
  await viewerPage.goto("/piani");
  await expect(viewerPage.getByText(`Condiviso da Carlo E2E · Sola lettura`)).toBeVisible();
});
