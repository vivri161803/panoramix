# Plan dashboard (`/piani/[id]`)

## Overview
Main page of a plan: summary (soonest to run out), the count of medicines to
order, the stock dispenser grid and the ATC colour legend. Parent of all per-plan app pages.

## Interface
- `generateMetadata({ params })` (`page.tsx`) - title = `plan.patient_name`.
- `default PianoPage({ params })` (`page.tsx`) - uses `getPlanBundle` (`lib/data`), `dispenserView` (`lib/view`),
  `canEdit` (`lib/roles`), `groupsPresent` (`lib/atc`), `PlanHeader` (`tab="dispenser"`), `DispenserGrid` (with `prepReminder={b.settings.prepReminder}`).
- `Legend({ codes, colors })` - local; renders ATC groups present in the plan.
- Subdirectories:
  - [calendario](./calendario/README.md) - weekly dose calendar.
  - [disponibilita](./disponibilita/README.md) - AIFA shortages and equivalents.
  - [farmacia](./farmacia/README.md) - pharmacy order list.
  - [modifica](./modifica/README.md) - owner-only plan settings.
  - [medicinali](./medicinali/README.md) - add / edit medications and stock history.
- Print pages for the same URL prefix live in the `(print)` group: [../../../(print)/piani/[id]/README.md](../../../(print)/piani/[id]/README.md).

## Invariants
- All pages here load data through `getPlanBundle(id)`, which calls `requireProfile` and returns 404 (`notFound`) for a non-UUID id or a plan the user cannot read.
- With no medications, shows an empty state; the "Aggiungi il primo medicinale" link appears only when `canEdit(b.role)`.
- `DispenserGrid` is `readOnly` without edit rights.

## Side Effects
- Page reads only (Supabase via `getPlanBundle`); stock mutations are server actions in `DispenserGrid`.

## Verification
- Run: `npm test`
- Run: `npm run test:e2e`
- Run: `npm run typecheck`
