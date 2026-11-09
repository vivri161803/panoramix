import { defineConfig, devices } from "@playwright/test";

// Test end-to-end nel browser contro Supabase locale (vedi scripts/test-e2e.mjs, che imposta le variabili).
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, locale: "it-IT", timezoneId: "Europe/Rome", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/accesso`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.TEST_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.TEST_SUPABASE_ANON_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "",
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "54325",
      SMTP_USER: "panoramix@localhost",
      SMTP_PASSWORD: "locale",
      CRON_SECRET: "e2e",
      APP_URL: `http://localhost:${PORT}`,
      OPS_ALERT_EMAIL: "ops@test.localhost",
    },
  },
});
