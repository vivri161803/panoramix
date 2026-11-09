// Test end-to-end (Playwright) contro Supabase locale: l'app parte sulla porta 3100
// con le variabili del database locale, qualunque cosa ci sia in .env.local.
// Richiede `npx supabase start` (Docker) e `npx playwright install chromium`.
// Ferma prima eventuali `npm run dev` aperti su questo progetto.
import { execSync, spawnSync } from "node:child_process";

let status;
try {
  status = JSON.parse(execSync("npx -y supabase@2 status -o json", { stdio: ["ignore", "pipe", "ignore"] }).toString());
} catch {
  console.error("Supabase locale non è avviato: esegui `npx supabase start` (serve Docker) e riprova.");
  process.exit(1);
}
const env = {
  ...process.env,
  TEST_SUPABASE_URL: status.API_URL,
  TEST_SUPABASE_ANON_KEY: status.ANON_KEY,
  TEST_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  MAILPIT_URL: status.MAILPIT_URL ?? status.INBUCKET_URL,
};
const r = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], { stdio: "inherit", env });
process.exit(r.status ?? 1);
