# Cron endpoints (`/api/cron`)

## Overview
Groups the scheduled jobs triggered by Vercel Cron (`vercel.json` `crons`) and
the shared-secret check they use. `/api/cron` is listed in
`PUBLIC_PATHS` in `proxy.ts`, so these routes skip the session redirect and
rely on `authorized` instead.

## Interface
- `authorized(req: NextRequest): boolean` (`auth.ts:authorized`) - true only when
  the `Authorization` header equals `Bearer ${process.env.CRON_SECRET}`.
- Subdirectories:
  - [alerts](./alerts/README.md) - daily low-stock alerts, Monday summaries and usage report (07:00 UTC).
  - [reminders](./reminders/README.md) - evening pill-organiser prep reminders (17:00 UTC).

## Invariants
- `authorized` returns `false` when `CRON_SECRET` is unset (fail closed).
- Comparison uses `timingSafeEqual` after a length check, to avoid timing leaks.

## Side Effects
- `auth.ts`: none (reads `process.env.CRON_SECRET` and the request header only).
- Child routes: see their contracts.

## Verification
- Run: `npm test`
- Run: `npm run test:e2e`
