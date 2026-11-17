# supabase/migrations

## Overview

Ordered Postgres DDL for the Appoteca (formerly Panoramix) database on Supabase.
Every file is applied in filename (timestamp) order by the Supabase CLI. Together they
define the `public` schema: care plans (`plans`) owned by a Supabase Auth user, their
medications and stock ledger, low-stock alert bookkeeping,
plan sharing, and read-only AIFA reference data. Stock forecasting is computed in
`lib/forecast.ts`; these migrations only persist results atomically and enforce access
via Row Level Security (RLS).

| File | Purpose |
| --- | --- |
| `20261108000100_schema.sql` | Core tables, `rome_today()`, recipient limit trigger, Auth -> `profiles` triggers |
| `20261108000200_rls.sql` | Enables RLS on core tables, `owns_plan` / `owns_medication`, first owner-only policies |
| `20261108000300_functions.sql` | Atomic stock RPCs (`record_stock_event`, `apply_prep`, `undo_prep`, `change_stock_mode`, `delete_my_account`) and grants; the three prep/mode RPCs are dropped by `20261117000100` |
| `20261108000400_fk_indexes.sql` | Indexes on `created_by` FKs of `stock_events` and `prep_runs` (table dropped by `20261117000100`) |
| `20261109000100_sharing.sql` | `plan_members`, `plan_invites`, role helpers, replaces owner-only policies with role-aware ones |
| `20261109000200_features.sql` | `use` stock event type, `dose_changes`, `notification_runs`, `plans.prep_reminder` / `weekly_summary`, `cron_runs.kind` |
| `20261110000100_aifa.sql` | `aifa_*` reference tables, `aifa_status()`, `aifa_finish_import()`, `medications.aic` / `atc_code`, extended color palette |
| `20261114000100_presidi.sql` | `medications.form` (`compressa`, `iniezione`, `cerotto`, `collirio`) and form-dependent `shape` check (replaced by `20261118000100`) |
| `20261115000100_reorder_days.sql` | `medications.reorder_days`, required exactly when `shape = 'flacone'` (backfilled to 30; renamed `days_per_pack` by `20261118000100`) |
| `20261117000100_daily_stock.sql` | Daily stock in every plan: drops `apply_prep`, `undo_prep`, `change_stock_mode`, `prep_runs`, `plans.stock_mode` / `mode_since`; moves `stock_as_of` of weekly plans' non-bottle meds to the day their prepared pillbox runs out; keeps `prep_reminder` only on weekly plans that had it, default `false` |
| `20261118000100_categories.sql` | Ten categories: `medications.category`, `days_per_pack` (was `reorder_days`), `shape` only for pills, `form` dropped, doses up to 999, `stock_qty` / `stock_events` quantities as `numeric` without scale |

## Interface

### Tables (`public` schema)

- `profiles` - one row per `auth.users` row (`id`, `email`, `first_name`, `last_name`).
- `plans` - one assisted person per plan (`owner_id`, `patient_name`, `notes`, `prep_weekday` 1-7, `alert_under_14`, `alert_under_7`, `alert_last_pack`, `prep_reminder` default `false`, `weekly_summary`).
- `plan_recipients` - extra alert email recipients per plan, unique `(plan_id, email)`.
- `plan_members` - shared access, PK `(plan_id, user_id)`, `role` `viewer|editor`, `invited_by`.
- `plan_invites` - pending invites by email, unique `(plan_id, email)`, `role` `viewer|editor`.
- `medications` - per-plan medication: dosage (`dose_morning`, `dose_noon`, `dose_evening`), `frequency_type` (`daily`, `weekdays`, `every_n_days`, `cycle`, `as_needed`) with `weekdays` / `interval_days` / `cycle_on` / `cycle_off`, stock reference (`stock_qty`, `stock_as_of`), `ordered_at`, `archived`, `color`, `category` (`pillola`, `bustina`, `liquido`, `iniezione`, `gocce`, `inalatore`, `cerotto`, `crema`, `supposta`, `altro`), `shape` (only for `pillola`), `days_per_pack` (level meds: days of use per container), `aic`, `atc_code`, `pills_per_pack` (stock units per box: pieces, or containers for level meds), `requires_prescription`.
- `stock_events` - append-only stock ledger; `type` in `count`, `arrival`, `prep`, `prep_undo`, `adjust`, `use`; `delta`, `qty_after`, `effective_date`, `meta`.
- `dose_changes` - scheduled dose changes per medication, unique `(medication_id, effective_date)`; total dose 0 means suspension.
- `alert_log` - alert episodes per medication and `alert_type` (`under_14`, `under_7`, `last_pack`), `episode_start`, `sent_at`, `closed_at`.
- `alert_runs` - one alert email per plan per day, unique `(plan_id, run_date)`, `status` `sending|sent|failed`.
- `notification_runs` - one reminder/summary per plan, `kind` (`prep_reminder`, `weekly_summary`) and day, unique `(plan_id, kind, run_date)`.
- `cron_runs` - scheduled job outcomes; `kind` `alerts|reminders`, `plans_checked`, `emails_sent`, `errors`.
- `aifa_imports` - import log; `source` in `confezioni`, `principi_attivi`, `atc`, `carenze`, `trasparenza`; `status` `running|ok|skipped|failed`.
- `aifa_packs` (PK `aic`), `aifa_pack_ingredients` (PK `(aic, position)`), `aifa_atc` (PK `code`), `aifa_shortages`, `aifa_transparency` (PK `aic`, `group_code`) - AIFA reference data, each row tagged with `import_id`.

### Functions callable by `authenticated`

- `record_stock_event(p_medication_id, p_type, p_delta, p_qty_after, p_effective_date, p_expected_qty, p_expected_as_of, p_clear_ordered default false, p_meta default '{}') returns uuid` - security invoker; `p_type` in `count`, `arrival`, `adjust`, `use`.
- `delete_my_account() returns void` - security definer.
- `my_plan_invites() returns table (id, plan_id, patient_name, role, owner_name, created_at)` - security definer.
- `accept_plan_invite(p_invite_id) returns uuid` - security definer, returns the plan id.
- `aifa_status() returns table (source, source_date, checked_at)` - security definer; latest `ok`/`skipped` import per source.
- RLS helpers (security definer, stable): `owns_plan(uuid)`, `owns_medication(uuid)`, `plan_role(uuid)` (`owner`/`editor`/`viewer`/null), `can_view_plan(uuid)`, `can_edit_plan(uuid)`, `can_view_medication(uuid)`, `can_edit_medication(uuid)`, `shares_plan_with(uuid)`.
- `rome_today()` - current date in `Europe/Rome` (execute revoked from `anon` only).

### Functions callable only by `service_role`

- `aifa_finish_import(p_import_id, p_rows, p_source_date default null) returns void` - deletes rows of the source table whose `import_id <> p_import_id`, marks the import `ok`.

### Triggers (not callable directly)

- `plan_recipients_limit` -> `enforce_recipients_limit()`; `plan_invites_limit` -> `enforce_invites_limit()`.
- `on_auth_user_created` -> `handle_new_user()`; `on_auth_user_email_changed` -> `handle_user_email_change()` (on `auth.users`).

## Invariants

- Calendar dates use `Europe/Rome` (`rome_today()` is the default for `start_date`, `stock_as_of`). `stock_as_of` can be in the future for meds of plans that were weekly before `20261117000100_daily_stock.sql`.
- RLS is enabled on every `public` table; `anon` has all table privileges revoked (`revoke all on all tables in schema public from anon` plus per-table revokes on later tables).
- Access roles: plan owner (`plans.owner_id`), `editor`, `viewer` via `plan_members`. `can_view_*` gates reads; `can_edit_*` gates writes on `medications`, `stock_events` (insert), `dose_changes`, `alert_log` (update). Plan settings (`plans` update/delete), `plan_recipients`, `plan_invites` management, `plan_members` role changes are owner-only (`owns_plan` / `owner_id = auth.uid()`).
- `plan_members` cannot be inserted by clients; membership is created only via `accept_plan_invite`. Members may delete their own membership. Only `plan_members.role` and `plan_invites.role` are client-updatable; invitees can delete (decline) invites addressed to their profile email.
- `profiles`: users read their own row and rows of people sharing a plan (`shares_plan_with`); only `first_name` / `last_name` are updatable; `email` mirrors `auth.users`.
- `stock_events` is append-only for clients (update/delete revoked). `alert_log` is read-only for clients except `closed_at`. `alert_runs` and `notification_runs` are read-only (owner only). `cron_runs` and `aifa_imports` have no client access (service role only). `aifa_*` reference tables are `select`-only for `authenticated`.
- Max 5 `plan_recipients` per plan (`hint = 'recipients_limit'`); max 10 `plan_members` + `plan_invites` per plan (`hint = 'members_limit'`). Both triggers lowercase/trim the email and lock the plan row `for update`.
- `record_stock_event` uses optimistic concurrency: the medication row must still match `p_expected_qty` and `p_expected_as_of`, otherwise SQLSTATE `40001`, `hint = 'stale_stock'`.
- `stock_events.type` still accepts `prep` and `prep_undo`, so the history of past pillbox preparations stays readable; no code writes them any more.
- At most one open `alert_log` episode per `(medication_id, alert_type)` (`alert_log_open_episode`); `alert_runs` / `notification_runs` uniqueness makes daily sends idempotent.
- `medications` checks: doses `numeric(5,1)` in 0.5 steps between 0 and 999 with a positive total (same for `dose_changes`); `stock_qty numeric >= 0` with no scale and no step (a level stock like 29/30 is stored as is); `pills_per_pack` 1–10000; `end_date >= start_date`; frequency parameters present for their `frequency_type`; `category` in the 10 values; `shape` set if and only if `category = 'pillola'` (`tonda`, `ovale`, `capsula`); `days_per_pack` 1–365 and null for `as_needed` (`medications_days_per_pack_as_needed`); `color` restricted to a fixed 15-color palette (color is computed server side from ATC, `lib/atc.ts`); `aic` is 9 digits; `atc_code` is a full or partial ATC code.
- All functions set `search_path = ''`. New migrations must be added as new timestamped files; existing files are history and should not be edited.

## Side Effects

- `handle_new_user` inserts a `profiles` row on `auth.users` insert; `handle_user_email_change` syncs `profiles.email`.
- `delete_my_account` deletes the caller from `auth.users`, cascading to `profiles`, owned `plans` and all child rows; `created_by` / `invited_by` references become null.
- Stock RPCs update `medications.stock_qty` / `stock_as_of` (and optionally clear `ordered_at`) and append `stock_events` rows in a single transaction.
- `accept_plan_invite` upserts `plan_members` and deletes the invite.
- `aifa_finish_import` bulk-deletes stale rows from the `aifa_*` table of the import's source and updates `aifa_imports`. Writes to `aifa_*` come from `scripts/import-aifa.mjs` with the service role (file formats in `scripts/aifa/README.md`).
- `20261115000100_reorder_days.sql` backfills `reorder_days = 30` on existing `flacone` medications.
- `20261118000100_categories.sql` fills `category` from the 11 old `(form, shape)` pairs, renames `reorder_days` to `days_per_pack`, sets old bottles to `stock_qty = 1`, `pills_per_pack = 1` (same run-out date, `days_per_pack = null` if as-needed), clears `shape` outside pills, drops `form`, and widens doses/stock types. `stock_events.delta` / `qty_after` become `numeric` without scale.

## Verification

- Run: `npm run test:db` (needs local Supabase via `npx supabase start`; runs `tests/db` sequentially).
- Also: `npm test`.
