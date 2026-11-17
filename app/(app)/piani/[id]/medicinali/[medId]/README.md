# Edit medication (`/piani/[id]/medicinali/[medId]`)

## Overview
Edit form for an existing medication in a plan, plus the panel for scheduled
dose changes.

## Interface
- `default ModificaMedicinalePage({ params })` (`page.tsx`) - `metadata.title = "Modifica medicinale"`.
  Renders `MedicationForm` (`components/MedicationForm`) prefilled from the medication and
  `DoseChangesPanel` (`components/DoseChangesPanel`) with `upcomingChanges(m, b.today)`.
- Subdirectories:
  - [storico](./storico/README.md) - stock movement history for this medication.

## Invariants
- Users without edit rights (`!canEdit(b.role)`) are redirected to `/piani/[id]`.
- `notFound()` if the medication is not in `b.forecast.items`.
- The form shows the doses in effect today (`dosesAt(m, b.today)`); changes already started are merged there on save.
- `atc_code` falls back to `ATC_UNKNOWN_VALUE` when the medication has no ATC code and its colour is `ATC_UNKNOWN.color`, otherwise `""`.
- `DoseChangesPanel` is omitted for `frequencyType === "as_needed"`.

## Side Effects
- Page reads only; saving is done by the server actions used by `MedicationForm` / `DoseChangesPanel`.

## Verification
- Run: `npm test`
- Run: `npm run typecheck`
