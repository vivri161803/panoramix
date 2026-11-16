# New plan (`/piani/nuovo`)

## Overview
Form to create a new plan for a person being cared for.

## Interface
- `default NuovoPianoPage()` (`page.tsx`) - `metadata.title = "Nuovo piano"`.
  Renders `PlanForm` (`components/PlanForm`) with `managerEmail = profile.email`, no meds, and defaults
  `stock_mode: "daily"`, `prep_weekday: 7`, `alert_under_14: true`, `alert_under_7: false`,
  `alert_last_pack: true`, `prep_reminder: true`, `weekly_summary: false`, `recipients: []`.

## Invariants
- Requires a complete profile (`requireProfile`).

## Side Effects
- None in the page; creation is done by `PlanForm`'s server action.

## Verification
- Run: `npm test`
- Run: `npm run typecheck`
