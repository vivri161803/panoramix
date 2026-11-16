# Drift Report — 2026-11-16

Scope: the 37 EGM contracts created by `egm-bootstrap`, plus the EGM sections added to `scripts/aifa/README.md` and to the root `README.md`.

Checks run on each contract:

- Every identifier in backticks was searched for in the source tree (`app`, `components`, `lib`, `scripts`, `supabase`, root configs and `.github/workflows`). No contract names a symbol that does not exist. The only tokens not found were file-name fragments and placeholders (`AGENTS`, `toml`, `YYYY`, `aaaa`, `_rls`, …).
- Every exported symbol, and every SQL table, function and trigger, in the directory's own files was checked for a mention in its contract.
- Numeric and behavioural claims were checked by hand against the source, for example cron and pool limits, timeouts, retry policy, cookie attributes, print scaling, config ports and the colour palette.

## app/(app)/README.md

No drift detected

## app/(app)/account/README.md

No drift detected

## app/(app)/piani/README.md

No drift detected

## app/(app)/piani/[id]/README.md

No drift detected

## app/(app)/piani/[id]/calendario/README.md

No drift detected

## app/(app)/piani/[id]/disponibilita/README.md

No drift detected

## app/(app)/piani/[id]/farmacia/README.md

No drift detected

## app/(app)/piani/[id]/medicinali/README.md

No drift detected

## app/(app)/piani/[id]/medicinali/[medId]/README.md

No drift detected

## app/(app)/piani/[id]/medicinali/[medId]/storico/README.md

No drift detected

## app/(app)/piani/[id]/medicinali/nuovo/README.md

No drift detected

## app/(app)/piani/[id]/modifica/README.md

No drift detected

## app/(app)/piani/nuovo/README.md

No drift detected

## app/(auth)/README.md

No drift detected

## app/(auth)/accesso/README.md

No drift detected

## app/(auth)/benvenuto/README.md

No drift detected

## app/(print)/README.md

No drift detected

## app/(print)/piani/README.md

No drift detected

## app/(print)/piani/[id]/README.md

No drift detected

## app/(print)/piani/[id]/stampa/README.md

No drift detected

## app/(print)/piani/[id]/terapia/README.md

No drift detected

## app/README.md

No drift detected

## app/api/README.md

No drift detected

## app/api/cron/README.md

No drift detected

## app/api/cron/alerts/README.md

No drift detected

## app/api/cron/reminders/README.md

No drift detected

## app/auth/README.md

No drift detected

## app/auth/confirm/README.md

No drift detected

## components/README.md

No drift detected

## components/ui/README.md

No drift detected

## lib/README.md

- **Fixed on 2026-11-16:** contract updated; the re-run reports no drift.
- Coverage gap: 47 exported symbols in `lib/*.ts` are not mentioned in the contract. Most are supporting types and constants:
  - `forecast.ts`: `ALERT_TYPES`, `SLOTS`, `SLOT_LABEL`, `slotDose`, `slotDoseOn`, `totalPerDose`, `AlertDecision`, `CalendarDay`, `CalendarItem`, `Doses`, `ForecastContext`, `OpenEpisode`, `PrepItem`. Note that `SLOTS`, `SLOT_LABEL` and `slotDose` are used by the calendar and therapy pages.
  - `dates.ts`: `WEEKDAYS_LETTER`, `WEEKDAYS_LONG`, `WEEKDAYS_SHORT`, `capitalize`, `formatNumeric`, `isISODate`, `maxDate`.
  - `aic.ts`: `STRENGTH_MAX`, `ScanResult`, `abbrUnit`, `formatAmount`.
  - `availability.ts`: `AifaStatusRow`, `Equivalent`, `MedAvailability`, `ShortageRow`, `TransparencyRow`.
  - `pills.ts`: `PILL_COLOR_HEXES`, `PILL_SHAPE_IDS`, `PillColor`, `PillShape`, `colorName`.
  - `schemas.ts`: `DoseChangeInput`, `InviteInput`, `MedicationInput`, `PlanInput`.
  - `pharmacy.ts`: `PharmacyLine`, `PharmacyMed`.
  - `aifa-freshness.ts`: `AifaImportRow`, `AifaSource`.
  - `batch.ts`: `CronRunOptions`, `PoolOptions`.
  - `atc.ts`: `AtcGroup`.
  - `presidi.ts`: `FORM_IDS`.
  - `notify.ts`: `NotifyOptions`.
  - `usage.ts`: `UsageReportResult`.

## lib/actions/README.md

No drift detected

## lib/email/README.md

No drift detected

## lib/supabase/README.md

No drift detected

## scripts/README.md

No drift detected

## supabase/README.md

- **Fixed on 2026-11-16:** contract updated; the re-run reports no drift.
- Wrong port: the contract says `config.toml` puts local SMTP (Mailpit) on `54324`. In `supabase/config.toml` `[local_smtp]`, `port = 54324` is the web interface; the SMTP port is `smtp_port = 54325`. That is the port `playwright.config.ts` and the root README use for `SMTP_PORT`.

## supabase/migrations/README.md

No drift detected

## scripts/aifa/README.md

- **Fixed on 2026-11-16:** contract updated; the re-run reports no drift.
- Encoding mismatch: the human-written sections say `confezioni_fornitura.csv` and `PA_confezioni.csv` are ASCII, while `scripts/aifa/parse.mjs` `SOURCES` declares `encoding: "utf-8"` for them. The behaviour is the same because ASCII is a subset of UTF-8, but the doc and the code disagree.

## README.md

No drift detected
