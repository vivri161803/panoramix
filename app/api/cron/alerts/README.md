# Cron: daily alerts (`/api/cron/alerts`)

## Overview
Route handler invoked by Vercel Cron every day at 07:00 UTC (`vercel.json`
schedule `0 7 * * *`). It runs the daily low-stock alerts and, on summary days
(Mondays, per `isSummaryDay`), the weekly summaries and the usage report sent to
`OPS_ALERT_EMAIL`. Problems are collected and forwarded to ops.

## Interface
- `GET(req: NextRequest)` (`route.ts:GET`) - returns JSON:
  - `401 { error: "Non autorizzato" }` when `authorized(req)` fails.
  - `200` / `207` `{ ...runDailyAlerts result, summary, usage, problems }` (`207` when `problems` is non-empty).
  - `500 { error, problems }` when the run throws.
- `maxDuration = 60` (`route.ts:maxDuration`).
- Query flags (`route.ts:GET`):
  - `?dry=1` - compute without writing or sending (skips `findMissedRun` and `notifyOps`, passes `dryRun` to `sendUsageReport`).
  - `?riepilogo=1` - force `runWeeklySummaries` on a non-summary day.
  - `?utilizzo=1` - force `sendUsageReport` (`force: true`).
- Depends on: `createAdminClient` (`lib/supabase/admin`), `runDailyAlerts` (`lib/alerts`),
  `isSummaryDay` / `runWeeklySummaries` (`lib/notify`), `findMissedRun` / `findStaleAifa` /
  `notifyOps` (`lib/ops`), `sendUsageReport` (`lib/usage`), `todayInRome` (`lib/dates`),
  `CRON_TIME_BUDGET_MS` (`lib/batch`), `authorized` ([../README.md](../README.md)).

## Invariants
- Every request must pass `authorized(req)` (Bearer `CRON_SECRET`) before any work.
- `deadline = Date.now() + CRON_TIME_BUDGET_MS` is passed to `runDailyAlerts` and `runWeeklySummaries` so no new plans start after the budget, leaving time to persist results and notify.
- "Today" is always `todayInRome()`.
- A failure in `sendUsageReport` is caught and recorded in `problems`; it does not abort the run.
- `findStaleAifa` problems (AIFA data not refreshed for more than 7 days, per the route comment) are always included, even in dry runs.

## Side Effects
- Uses the Supabase service-role admin client (bypasses RLS).
- Sends alert, weekly-summary and usage-report emails via the `lib/` runners (skipped with `?dry=1`).
- Calls `notifyOps("alerts", today, problems)` unless dry, which may email `OPS_ALERT_EMAIL`.
- Logs `[cron] esito:` / `[cron] controllo non riuscito:` to the console.

## Verification
- Run: `npm test` (see `tests/batch.test.ts`)
- Run: `npm run test:e2e` (see `tests/e2e/cron-aifa.spec.ts`)
- Run: `npm run typecheck`
