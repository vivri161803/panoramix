// Test sul database locale (regole di accesso e controlli automatici).
// Richiede Supabase locale avviato: `npx supabase start` (Docker).
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
  TEST_MAILPIT_URL: status.MAILPIT_URL ?? status.INBUCKET_URL ?? "",
};
const r = spawnSync("npx", ["vitest", "run", "tests/db", ...process.argv.slice(2)], { stdio: "inherit", env });
process.exit(r.status ?? 1);
