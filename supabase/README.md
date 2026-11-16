# supabase

## Overview

Supabase CLI project for Appoteca (formerly Panoramix; CLI `project_id = "panoramix"`).
It holds the local stack configuration, the ordered database migrations that define the
whole `public` schema and its Row Level Security, an optional sample-data seed, and the
HTML email template for Auth magic links. The Next.js app and server jobs talk to this
database through the Supabase API; there is no application code here.

## Interface

- [migrations](./migrations/README.md) - schema DDL, RLS policies, RPC functions and triggers (tables `profiles`, `plans`, `plan_recipients`, `plan_members`, `plan_invites`, `medications`, `stock_events`, `prep_runs`, `dose_changes`, `alert_log`, `alert_runs`, `notification_runs`, `cron_runs`, `aifa_*`).
- `seed.sql` - sample data, for testing only:
  - inserts a few real AIFA rows into `aifa_packs`, `aifa_pack_ingredients`, `aifa_shortages`, `aifa_transparency` (all tagged `import_id = '00000000-0000-4000-8000-00000000a1fa'`, mirroring `tests/helpers/aifa-sample.ts`), idempotent via `on conflict do nothing` / `where not exists`;
  - creates the plan `[ESEMPIO] Nonna Anna` (weekly mode) with five `medications` and an initial `count` `stock_events` row each, for the profile whose email is set in `v_email` (placeholder `sostituisci@esempio.it`, must be edited before running).
- `config.toml` - Supabase CLI local stack settings: API port `54321`, DB port `54322` (Postgres `major_version = 17`), Studio `54323`, local email testing (Mailpit) web interface `54324` and SMTP `smtp_port = 54325`; `[db.migrations] enabled = true`; `[db.seed] enabled = false` with `sql_paths = ["./seed.sql"]`; Auth `site_url = "http://localhost:3000"`, redirect URLs for ports 3000 and 3100, email signup enabled, email confirmations disabled, `auth.rate_limit.email_sent = 2`.
- templates - `templates/magic-link.html`, the HTML body for the Supabase "Magic Link" and "Confirm signup" emails (pasted in the dashboard under Authentication -> Emails -> Templates; uses `{{ .SiteURL }}`). Not code.

## Invariants

- Schema changes go in new timestamped files under `migrations/`; see [migrations](./migrations/README.md) for the access and data invariants.
- The seed is not applied automatically (`[db.seed] enabled = false`); it is meant to be run manually in the SQL Editor after the target user has signed in once, and raises an exception if no `profiles` row matches `v_email`.
- In production the `aifa_*` tables are filled by `scripts/import-aifa.mjs` (service role), not by the seed.
- `supabase/.temp` is CLI-generated state and is not part of the contract.

## Side Effects

- `npx supabase start` / `supabase db reset` apply `migrations/` to the local Postgres in Docker.
- Running `seed.sql` writes to the `aifa_*` tables, `plans`, `medications`, and `stock_events`.
- The local stack captures Auth emails in local SMTP instead of sending them.

## Verification

- Run: `npm run test:db` (`scripts/test-db.mjs`; requires `npx supabase start`, reads `supabase status`, runs `tests/db` with `--no-file-parallelism`).
- Also: `npm test`.
