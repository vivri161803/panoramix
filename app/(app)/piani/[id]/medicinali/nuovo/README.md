# New medication (`/piani/[id]/medicinali/nuovo`)

## Overview
Form to add a medication to a plan.

## Interface
- `default NuovoMedicinalePage({ params })` (`page.tsx`) - `metadata.title = "Nuovo medicinale"`.
  Renders `MedicationForm` with defaults: `pills_per_pack: 30`, `category: null`,
  `shape: null`, `days_per_pack: null`, `dose_morning: 1`, `frequency_type: "daily"`, `interval_days: 2`,
  `cycle_on: 21`, `cycle_off: 7`, `start_date: b.today`, `stock_qty: null`, `aic: null`, `atc_code: ""`.
  The form cannot be sent until a category is chosen (or comes from a scan).

## Invariants
- Users without edit rights (`!canEdit(b.role)`) are redirected to `/piani/[id]`.
- Colour is not set here: it comes from the ATC group (from AIFA via the AIC code or the "A cosa serve" choice), per the page comment.

## Side Effects
- None in the page; creation is done by `MedicationForm`'s server action.

## Verification
- Run: `npm test`
- Run: `npm run typecheck`
