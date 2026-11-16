# Cron: prep reminders (`/api/cron/reminders`)

## Overview
Route handler invoked by Vercel Cron every day at 17:00 UTC (`vercel.json`
schedule `0 17 * * *`). It sends reminders to people who prepare the weekly
pill organiser on the following day.

## Interface
- `GET(req: NextRequest)` (`route.ts:GET`) - returns JSON:
  - `401 { error: "Non autorizzato" }` when `authorized(req)` fails.
  - `200` / `207` `{ ...runPrepReminders result, problems }` (`207` when `problems` is non-empty).
  - `500 { error, problems }` when the run throws.
- `maxDuration = 60` (`route.ts:maxDuration`).
- Query flag `?dry=1` - compute without writing or sending.
- Depends on: `createAdminClient` (`lib/supabase/admin`), `runPrepReminders` (`lib/notify`),
  `findMissedRun` / `startCronRun` / `finishCronRun` / `notifyOps` (`lib/ops`),
  `todayInRome` (`lib/dates`), `CRON_TIME_BUDGET_MS` (`lib/batch`), `authorized` ([../README.md](../README.md)).

## Invariants
- Every request must pass `authorized(req)` before any work.
- Outside dry runs, `findMissedRun` is checked and `startCronRun` records the run before `runPrepReminders`; `finishCronRun(admin, runId, result)` is always called afterwards (with `runId = null` in dry runs).
- `deadline = Date.now() + CRON_TIME_BUDGET_MS` bounds the batch.

## Side Effects
- Uses the Supabase service-role admin client.
- Writes cron-run bookkeeping via `startCronRun` / `finishCronRun` (not in dry runs).
- Sends reminder emails via `runPrepReminders` (skipped with `?dry=1`).
- Calls `notifyOps("reminders", today, problems)` unless dry.
- Logs `[cron] promemoria:` / `[cron] promemoria non riusciti:`.

## Verification
- Run: `npm test`
- Run: `npm run typecheck`
