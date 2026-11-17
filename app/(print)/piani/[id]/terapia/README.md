# Therapy sheet (`/piani/[id]/terapia`)

## Overview
A4 printable summary of the current therapy for a plan: regular medicines with
morning / noon / evening doses, as-needed medicines, notes and the email
disclaimer.

## Interface
- `default TerapiaPage({ params })` (`page.tsx`) - `metadata.title = "Scheda terapia"`.
  Uses `getPlanBundle`, `dosesAt`, `slotDose`, `frequencyPhrase`, `upcomingChanges`,
  `SLOTS`, `formatQty` (`lib/forecast`), `changeLabel` (`lib/digest`), `pillLook` (`lib/pills`), `categoryLabel` / `doseWord` (`lib/categories`), `Presidio` (`components/ui/Presidio`),
  `EMAIL_DISCLAIMER` (`lib/email/alert-template`).
- Reuses `PrintButton` and `print.css` from [../stampa/README.md](../stampa/README.md);
  file name `Terapia <patient> <today>.pdf`.

## Invariants
- Medicines whose `endDate` is before `today` are excluded; `frequencyType === "as_needed"` ones are listed separately.
- Doses shown are those in effect today (`dosesAt(m, b.today)`), each with its dose word (`doseWord`: «compressa», «ml», «gocce»); upcoming changes appear in the notes column.
- Each medicine shows the `Presidio` icon of its category and the category name.

## Side Effects
- Reads plan data via `getPlanBundle`; browser printing via `PrintButton`.

## Verification
- Run: `npm run test:e2e`
- Run: `npm run typecheck`
