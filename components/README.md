# components

## Overview

Feature-level React components for Appoteca, a medication stock planner built
on the Next.js 16 App Router (see `AGENTS.md` at the repository root). Almost
every file here is a client component (`"use client"`). Each one renders one
screen area (the dispenser grid, the medication and plan forms, the pharmacy
list, sharing panels) and sends mutations to server actions in `@/lib/actions/*`.
Domain logic (forecasting, dates, pill and presidio shapes, roles, pharmacy
text) lives in `@/lib/*`. Shared presentational primitives live in
[`ui/`](./ui/README.md). User-facing text is in Italian.

## Interface

### Subdirectories

- [`ui/`](./ui/README.md): icons, `Pill`, `Presidio`, `StatusChip`, `Switch`,
  `FieldError`, `AppIcon`, and `Disclaimer`.

### Components

| File | Exports | Server actions / external APIs used |
| --- | --- | --- |
| `Toast.tsx` | `ToastProvider({ children })`, `useToast()` returns `(text, undo?) => void` | Reads and clears the `px_flash` cookie |
| `Dispenser.tsx` | `Dispenser({ med: DispenserView, size?, scaleMax = 60, actions?, historyHref?, prepReminder = false })`, `DispenserActions` (`onArrive`, `onOrdered`, `onRecount`, `onTake`, `historyHref`, `editHref`, `busy?`) | None. Pure UI that reports user intent through `actions` callbacks |
| `DispenserGrid.tsx` | `DispenserGrid({ planId, meds, readOnly = false, prepReminder })` | `arrivePacks`, `recountStock`, `takeAsNeeded`, `toggleOrdered`, `undoStockEvent` (`@/lib/actions/stock`) |
| `PharmacyList.tsx` | `PharmacyList({ planId, patientName, senderName, today, items, editable })` | `markOrdered` (`@/lib/actions/stock`). Also `navigator.share`, `navigator.clipboard.writeText`, `window.print` |
| `MedicationForm.tsx` | `MedicationForm({ planId, planName, medicationId?, initial, settings, today, extra?, currentColor? })` | `createMedication`, `updateMedication`, `deleteMedication` (`@/lib/actions/medications`), `lookupAic` (`@/lib/actions/aifa`) |
| `BarcodeScanner.tsx` | `default BarcodeScanner({ onDetected(raw, format), onClose })` | `navigator.mediaDevices.getUserMedia`, native `BarcodeDetector` or the `barcode-detector/ponyfill` (zxing-wasm), `navigator.vibrate` |
| `DoseChangesPanel.tsx` | `DoseChangesPanel({ planId, medicationId, today, endDate, current, changes })`, `DoseChangeView` | `addDoseChange`, `deleteDoseChange` (`@/lib/actions/medications`) |
| `PlanForm.tsx` | `PlanForm({ planId?, initial, managerEmail, medCount, extra? })` | `createPlan`, `updatePlan`, `deletePlan` (`@/lib/actions/plans`) |
| `PlanHeader.tsx` | `PlanHeader({ plan: PlanRow, tab, role: PlanRole, ownerName })` | None. A server-compatible module with no `"use client"`. It renders `LeavePlanButton` |
| `MembersPanel.tsx` | `MembersPanel({ planId, ownerEmail, members, invites })`, `MemberItem`, `InviteItem` | `inviteMember`, `changeAccess`, `removeMember`, `cancelInvite` (`@/lib/actions/sharing`) |
| `InvitesList.tsx` | `InvitesList({ invites: MyInviteRow[] })` | `acceptInvite`, `declineInvite` (`@/lib/actions/sharing`) |
| `LeavePlanButton.tsx` | `LeavePlanButton({ planId, patientName })` | `leavePlan` (`@/lib/actions/sharing`) |
| `ProfileForm.tsx` | `ProfileForm({ firstName, lastName, submitLabel, next })` | `saveProfile` (`@/lib/actions/auth`), through `useActionState` |
| `TestEmailButton.tsx` | `TestEmailButton({ planId, email })` | `sendTestEmail` (`@/lib/actions/email`) |
| `ThemePicker.tsx` | `ThemePicker({ initial: Theme })` | Writes the `THEME_COOKIE` cookie, `document.documentElement.dataset.theme`, and `meta[name="theme-color"]` |

## Invariants

- Components that call `useToast()` (`DispenserGrid`,
  `PharmacyList`, `DoseChangesPanel`, `MembersPanel`, `InvitesList`,
  `LeavePlanButton`) must render inside `ToastProvider`. Outside a provider,
  the default context value is a no-op, so messages are silently dropped.
- Server action results follow the `ActionResult` shape
  (`@/lib/actions/common`): `{ ok: true, message?, data? }` or
  `{ ok: false, error, fieldErrors? }`. The undo buttons depend on the
  returned `data`. Stock actions return `data.eventId`, which
  `undoStockEvent` consumes.
- The recount question is "Quante ne hai in tutto?", followed by ", comprese
  quelle nel portapillole" when the plan has `prep_reminder` on
  (`DispenserGrid` passes `prepReminder` to every `Dispenser`).
- `PlanForm` has no stock-mode choice. The "Promemoria del portapillole"
  switch is always shown (default off), and the prep weekday picker appears
  only when it is on. `PlanHeader` shows "Promemoria del portapillole
  {giorno}" only when `prep_reminder` is on.
- `DispenserGrid` passes no `actions` when `readOnly` is true. `Dispenser`
  then shows only the history link (`historyHref`) and no mutation controls.
- `PlanHeader` shows "Impostazioni piano" only when `isOwner(role)` and
  "Aggiungi medicinale" only when `canEdit(role)` (`@/lib/roles`). These are
  UI gates only. Authorization must still be enforced by the server actions.
- `MedicationForm` loads `BarcodeScanner` with `next/dynamic` and
  `{ ssr: false }`, so the camera and WebAssembly code download only when
  the scanner opens. `BarcodeScanner` is a default export because of this.
- `BarcodeScanner` loads the zxing `.wasm` files from `/zxing/` (served from
  `public/zxing`, no CDN). If a `Permissions-Policy` header is ever added, it
  must include `camera=(self)` (comment in `BarcodeScanner.tsx`).
- `Dispenser` draws stock on a shared 0 to `scaleMax` day scale (default 60).
  Its tube geometry depends on `PRESIDIO_GEO` from `ui/Presidio.tsx`.
- `MedicationForm.setType` rounds half doses up to whole units when the new
  shape has `doseStep(shape) === 1`, because presidi cannot be split.
- Client-side email checks in `PlanForm.addRecipient` and
  `MembersPanel.invite` use `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` on the
  lowercased, trimmed input. They are a convenience only, and the server
  actions validate again.

## Side Effects

- Server action calls (database writes and email) through
  `@/lib/actions/{stock,medications,plans,sharing,auth,email,aifa}`, as
  listed in the Interface table. `lookupAic` reads the Supabase tables `aifa_packs`
  and `aifa_pack_ingredients` on the server. `sendTestEmail` sends an email
  only to the plan's profile email (`b.profile.email` in
  `lib/actions/email.ts`).
- Cookies: `ToastProvider` reads the `px_flash` cookie on every pathname
  change and then deletes it (`Max-Age=0`). `ThemePicker` writes
  `THEME_COOKIE` with `max-age=31536000; samesite=lax`, plus `secure` over
  HTTPS.
- DOM: `ThemePicker` sets or removes `document.documentElement.dataset.theme`
  and rewrites the `theme-color` meta tags. `PharmacyList` calls
  `window.print()`.
- Browser device APIs: `BarcodeScanner` opens the rear camera with
  `getUserMedia`, can turn on the torch through `applyConstraints`, vibrates on
  a successful read, and reads user-chosen photos with `createImageBitmap`.
  Its cleanup stops every media track and removes the `keydown` (Escape)
  listener.
- Clipboard and share sheet: `PharmacyList` uses `navigator.share` when it is
  available and falls back to `navigator.clipboard.writeText`.
- Timers: `ToastProvider` auto-dismisses toasts after 7000 ms.
  `BarcodeScanner` polls for barcodes every 180 ms. `Dispenser` clears its
  pill animation state about 900 ms after the longest animation delay.

## Verification

- Run: `npm test` (vitest). Also run `npm run typecheck`
  (`next typegen && tsc --noEmit`).
