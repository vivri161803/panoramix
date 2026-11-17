# lib/actions

## Overview
Next.js Server Actions (`"use server"`) for every user-initiated change: auth and profile, plans, medications and dose changes, stock movements and the pillbox, sharing and invites, AIC lookup, and the test email. Each action loads context through `lib/data.ts` (`getPlanBundle` / `requireProfile`), checks the role with `lib/roles.ts`, validates input with the zod schemas in `lib/schemas.ts`, writes through the RLS-bound `createClient()` from `lib/supabase/server.ts`, and returns an `ActionResult` or redirects.

## Interface
- `common.ts` (`import "server-only"`, not an action module)
  - `type ActionResult<T>`: `{ ok: true; message?; data? }` or `{ ok: false; error; fieldErrors? }`
  - `fail(error, fieldErrors?)`, `zodFail(err)` (the first issue for each field path)
  - `dbError(e, fallback?)`: maps Postgres/PostgREST errors to Italian messages. It handles the hints `stale_stock`, `recipients_limit`, `not_latest`, and `already_undone`, and the codes `40001`, `23505`, `42501`/`PGRST301`, and `23514`.
  - `flash(text)`: sets the `px_flash` cookie (30 s) for a toast after a redirect
- `auth.ts`: `sendMagicLink(prev, formData)`, `saveProfile(prev, formData)`, `signOut()`, `deleteAccount(prev, formData)` (requires typing `ELIMINA`; calls the RPC `delete_my_account`)
- `aifa.ts`: `lookupAic(raw, format?)` returns `ActionResult<AicLookup>`. It reads `aifa_packs` and `aifa_pack_ingredients`, and needs a signed-in user.
- `plans.ts`: `createPlan(input)`, `updatePlan(planId, input)`, `deletePlan(planId)`
- `medications.ts`: `createMedication(planId, input, another?)`, `updateMedication(planId, medicationId, input)`, `deleteMedication(planId, medicationId)`, `addDoseChange(planId, medicationId, input)`, `deleteDoseChange(planId, medicationId, changeId)`
- `stock.ts`: `arrivePacks`, `recountStock`, `toggleOrdered`, `undoStockEvent`, `takeAsNeeded`, `markOrdered(planId, medicationIds)`
- `sharing.ts`: `inviteMember`, `cancelInvite`, `changeAccess(planId, { userId? , inviteId? }, role)`, `removeMember`, `leavePlan`, `acceptInvite(inviteId)`, `declineInvite(inviteId)`
- `email.ts`: `sendTestEmail(planId)`

## Invariants
- Authorization is checked in the action before any write. Medication and stock changes require `canEdit(role)` (owner or editor), and fail with `READ_ONLY_MESSAGE` otherwise. Plan settings, recipients, sharing, deleting a plan, and `sendTestEmail` require `isOwner(role)`, and fail with `OWNER_ONLY_MESSAGE` otherwise. RLS still applies on top because every write uses the user client.
- Stock writes use optimistic concurrency. `record_stock_event` is called with `p_expected_qty` / `p_expected_as_of` (the stored reference), and `updateMedication` filters its `update` on `stock_qty` and `stock_as_of`. A mismatch surfaces as "Le scorte sono cambiate nel frattempo".
- `updateMedication` moves the stock reference to `maxDate(today, stockAsOf)` (`currentStock`) before saving the new schedule, or to `today` when the form changes the stock (a count that includes the pillbox). It deletes dose changes that have already started, and records a `count` event only when the entered quantity differs from the computed stock.
- `createMedication` requires `stock_qty` (pieces: multiples of ½ via `qtySchema`; level: closed containers + the open one via `levelQtySchema`/`isLevelQty`) and writes an initial `stock_events` row with `type: "count"` and `meta.initial: true`.
- Counting mode (`isLevel`): a level med edited without a mode change records no `count` (the form sends no stock). A mode change requires the stock in the new mode (field error on `stock_qty` otherwise) and records a `count` with `delta = qty_after` and `meta.reason = 'mode_change'`; the old stock never crosses units.
- `recountStock` validates with `levelQtySchema` for level meds (1,1 and 2 ok, 1,3 refused), `qtySchema` otherwise. «Finito un {contenitore}» is `takeAsNeeded(planId, id, 1)`.
- `atc_code` is resolved from `aifa_packs` when the AIC is known. The form's `"?"` (`ATC_UNKNOWN_VALUE`) is stored as `null`, and `color` is always derived with `atcColor(atcCode)`. `shape` is saved only for `pillola`; `days_per_pack` is saved only for non-`as_needed` meds.
- Dose changes must start after `today` and on or before `endDate`, and are not allowed for `as_needed` meds. Upserts use `onConflict: "medication_id,effective_date"`.
- `undoStockEvent` reverses only the latest event, and only if it is an `arrival`, `count`, or `use`. It records an opposite `adjust` event and restores `meta.prev_ordered_at`.
- `recountStock` clears "ordered" only when `recountClearsOrdered(forecast)` is true. After an arrival or recount, open `alert_log` episodes whose threshold no longer triggers are closed.
- Stock dates: `arrivePacks`, `takeAsNeeded` and the undo of an `arrival` or `use` save at `maxDate(today, stockAsOf)` (they change only the stock at home; the days up to a future `stockAsOf` are already in the pillbox). `recountStock` and the undo of a `count` save at `today`. `closeEpisodesIfAbove` evaluates the forecast with the date just saved.
- `createPlan` / `updatePlan` write only `plans` columns; there is no stock-mode change any more.
- Recipients cannot include the owner's own email. Invites are rejected for the owner, for existing members, and for already-invited emails. The database hint `members_limit` caps a plan at 10 people.
- `leavePlan` is refused for the owner. `declineInvite` deletes only invites that match the caller's lowercased email.

## Side Effects
- Database writes through the user client:
  - tables `profiles`, `plans`, `plan_recipients`, `medications`, `dose_changes`, `stock_events`, `alert_log`, `plan_members`, `plan_invites`
  - RPCs `record_stock_event`, `accept_plan_invite`, `delete_my_account`
- Supabase Auth: `signInWithOtp` (magic link redirecting to `${APP_URL}/auth/confirm`) and `signOut`.
- Email through `getEmailProvider().send`: invitations (`inviteMember`) and the owner-only test email (`sendTestEmail`). If the invite email fails, the invite is still saved.
- Next.js cache and navigation: `revalidatePath("/piani/<id>", "layout")` and `revalidatePath("/piani")`, plus `redirect(...)` after create, update, and delete flows.
- Cookies: `flash()` sets `px_flash`.
- `console.error` logging for auth, email, and unmapped database errors.

## Verification
- Run: `npm test` (see `tests/actions.test.ts` and `tests/dose-changes.test.ts`)
- Run: `npm run test:db` (RPCs and RLS)
- Run: `npm run typecheck`
