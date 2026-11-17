# lib

## Overview
Shared application logic for Appoteca, a Next.js 16 App Router app. It has three layers:

- **Pure domain logic**, with no database or framework dependency: forecasting, dates, schemas, ATC/AIC parsing, pharmacy lists, view models, and usage counting.
- **Server-only data access** (`import "server-only"`): session and plan loading for pages, and bulk loading with the service role for the automated jobs.
- **Automated jobs (cron)**: the daily stock alerts, evening and Monday notifications, ops monitoring, and the usage report.

User-initiated writes live in `./actions`, email rendering and delivery in `./email`, and Supabase client factories in `./supabase`.

## Interface

### Subdirectories
- [actions](./actions/README.md): Server Actions for auth, plans, medications, stock and pillbox, sharing, AIC lookup, and the test email.
- [email](./email/README.md): email provider (SMTP or Resend) and pure HTML/text email renderers.
- [supabase](./supabase/README.md): `createClient()` (user session, RLS) and `createAdminClient()` (service role).

### Domain (pure)
- `forecast.ts`: the core domain model.
  - Types: `FrequencyType`, `Slot`, `AlertType` (`under_14` | `under_7` | `last_pack`), `MedStatus` (`out` | `order` | `ordered` | `ok`), `STATUS_RANK`, `HORIZON_DAYS = 3 * 366`, `SLOTS` (`morning`, `noon`, `evening`), `SLOT_LABEL`, `ALERT_TYPES`, and the interfaces `Doses`, `Schedule`, `MedicationData`, `PlanSettings` (`prepWeekday`, `prepReminder`, three alert switches), `DoseChange`, `ForecastContext` (`{ plan, today }`), `Forecast`, `PlanForecast`, `OpenEpisode`, `AlertDecision`, `CalendarItem`, `CalendarDay`.
  - Doses per slot: `totalPerDose`, `slotDose`, `slotDoseOn`.
  - Schedule: `dosesAt`, `scheduleAt`, `upcomingChanges`, `isScheduledOn`, `dosesOn`, `dosesBetween`, `weeklyNeed`, `hasEnded`.
  - Stock: `currentStock(med, today)`.
  - Forecast and alerts: `forecastMedication`, `forecastPlan`, `statusReason`, `recountClearsOrdered`, `evaluateAlerts`.
  - Calendar: `calendarWeekStart` (prep weekday when `prepReminder` is on, otherwise Monday), `buildWeek`.
  - Text: `formatQty`, `pillsWord`, `daysWord`, `dosesPhrase`, `frequencyPhrase`, `scheduleSummary`.
- `dates.ts`: `ISODate` (`"YYYY-MM-DD"` string), `isISODate`, `TIME_ZONE = "Europe/Rome"`, `todayInRome`, `addDays`, `diffDays`, `maxDate`, `isoWeekday`, `onOrBeforeWeekday`, `onOrAfterWeekday`, and Italian formatters (`formatShort`, `formatLong`, `formatDayMonthYear`, `formatRange`, `formatRelative`, `formatTimeRome`, `dateOfTimestampRome`, `formatNumeric`, `capitalize`, and the weekday names `WEEKDAYS_LETTER`, `WEEKDAYS_SHORT`, `WEEKDAYS_LONG`).
- `schemas.ts`: zod schemas `planSchema`, `medicationSchema`, `doseChangeSchema`, `inviteSchema`, `qtySchema`, `doseSchema`, `packsSchema`, `emailField`, plus the constants `FREQUENCIES` and `ROLES` and the inferred input types `PlanInput`, `MedicationInput`, `DoseChangeInput`, `InviteInput`.
- `roles.ts`: `MemberRole`, `PlanRole`, `ROLE_LABEL`, `ROLE_SUB`, `canEdit`, `isOwner`, `READ_ONLY_MESSAGE`, `OWNER_ONLY_MESSAGE`, `uniqueEmails`.
- `db-types.ts`: row interfaces (`PlanRow`, `MedicationRow`, `StockEventRow`, `ProfileRow`, `MemberRow`, `InviteRow`, `MyInviteRow`, `RecipientRow`, `DoseChangeRow`), `StockEventType`, `MEDICATION_COLUMNS`, `PLAN_COLUMNS`, `Medication`, and the converters `toMedication`, `toPlanSettings`.
- `aic.ts`: barcode and AIC parsing (`parseGs1`, `parseScan`, `ScanFormat`, `ScanResult`, `NO_AIC_MESSAGE`, `SERIAL_HINT`) and AIFA-to-form mapping (`packToForm`, `formFromAifa`, `buildStrength`, `strengthFromDescription`, `abbrUnit`, `formatAmount`, `STRENGTH_MAX = 40`, `titleCase`, `sentenceCase`, `AifaPackRow`, `IngredientRow`, `AicLookup`). It imports helpers from `scripts/aifa/parse.mjs`.
- `atc.ts`: `AtcGroup`, `ATC_GROUPS`, `ATC_UNKNOWN`, `ATC_UNKNOWN_VALUE = "?"`, `ATC_CODE_RE`, `atcGroup`, `atcColor`, `atcLabel`, `groupsPresent`.
- `presidi.ts`: medication forms and medical-supply shapes (`FORMS`, `FORM_IDS`, `MedForm`, `PRESIDIO_SHAPES`, `ALL_SHAPE_IDS`, `isPresidio`, `formOf`, `unitWord`, `leftWord`, `doseWord`, `howMany`, `doseStep`, `usesReorderDays`).
- `pills.ts`: `PILL_COLORS`, `PILL_COLOR_HEXES`, `PillColor`, `colorName`, `PILL_SHAPES`, `PILL_SHAPE_IDS`, `PillShape`, `pillLook`, `pillStyle` (returns React `CSSProperties`), `PILL_RATIO`.
- `pharmacy.ts`: `ORDER_TARGET_DAYS = 30`, `PharmacyMed`, `PharmacyLine`, `suggestedPacks`, `buildPharmacyItems`, `pharmacyText`, `doctorRequestText`.
- `digest.ts`: `changeLabel`, `buildPrepReminderItems(meds, prepDate)`, `buildSummaryMeds` (inputs for the reminder and summary emails).
- `view.ts`: `DispenserView`, `dispenserView`, `pillsText`, `daysText` (serializable view models for client components).
- `week.ts`: `resolveWeek(param, settings, today)` (clamped to ±371 days) and `weekGrid`.
- `availability.ts`: row types `ShortageRow`, `TransparencyRow`, `AifaStatusRow`, result types `MedAvailability`, `Equivalent`, `buildAvailability` (pure) and `loadAvailability(supabase, meds)`, which reads the AIFA shortage and transparency tables.
- `aifa-freshness.ts`: `AifaSource`, `AifaImportRow`, `AIFA_SOURCES`, `AIFA_SOURCE_LABEL`, `AIFA_STALE_DAYS = 7`, `staleAifaProblems(rows, now)`.
- `usage-stats.ts`: `USAGE_DAYS = 7`, `GMAIL_DAILY_LIMIT = 500`, `UsageRaw`, `UsageStats`, `summarizeUsage`.
- `batch.ts`: `PAGE_SIZE = 1000`, `selectAll`, `groupBy`, `runPool` (`PoolOptions`), `CronRunOptions`, `CRON_CONCURRENCY = 5`, `CRON_TIME_BUDGET_MS = 45_000`, `timeoutMessage`.
- `pdf.ts`: `A4_PT`, `jpegToA4Pdf(jpeg, width, height)`.
- `theme.ts`: `THEME_COOKIE = "px-theme"`, `THEMES`, `parseTheme`, `THEME_COLOR`.

### Server-only data access
- `env.ts`: the `env` accessor object. Required: `supabaseUrl`, `supabaseAnonKey`, `supabaseServiceRoleKey`, `cronSecret`. With defaults: `appUrl`, `emailProvider`, `mailFromName`, `opsEmail`.
- `data.ts`: React-`cache`d `getSessionUser`, `getProfile`, and `getPlanBundle(planId)`; `requireProfile`, `listPlans`, `listMyInvites`, `getStockEvents`, `fullName`, `initials`; the types `PlanBundle` and `PlanListEntry`.
- `cron-data.ts`: `CronData`, `loadCronData(admin)`, `planAudience(data, plan)`.

### Automated jobs (server-only, take the admin client)
- `alerts.ts`: `runDailyAlerts(admin, today, dryRun?, opts?)` returns `DailyRunResult`. Also exports `buildPlanEmail` and `toEmailMed`.
- `notify.ts`: `runPrepReminders` (plans with `prep_reminder` on, when tomorrow is `prep_weekday`) and `runWeeklySummaries` return `NotifyResult`. Also exports `isSummaryDay` (Monday), `NotificationKind` and `NotifyOptions`.
- `ops.ts`: `CronKind`, `CRON_LABEL`, `findMissedRun`, `findStaleAifa`, `startCronRun`, `finishCronRun`, `notifyOps`.
- `usage.ts`: `collectUsage(admin, now?)` and `sendUsageReport(admin, today, { dryRun?, force? })`, which returns `UsageReportResult`.

## Invariants
- Calendar days are `ISODate` strings. Arithmetic uses whole UTC days, so daylight-saving changes do not shift results. "Today" is always `todayInRome()`.
- Stock goes down every day in every plan: `currentStock` is `stockQty` minus the doses scheduled from `stockAsOf` through yesterday. The pillbox is only a reminder (`prepReminder`) and never changes stock. `stockAsOf` can be in the future (after the daily-stock migration, the days already in a prepared pillbox): coverage and the pharmacy list start from `maxDate(today, stockAsOf)`, the days before it count as covered. Arrivals, as-needed takes and their undos save at `maxDate(today, stockAsOf)`; a recount or a stock typed in the form counts the pillbox too and saves at today.
- Alert thresholds fire only when the med will actually run out before the end of therapy. In `forecastMedication`, `coverageDays === null` means no alerts. Ended meds are `ok` with no alerts. `as_needed` meds can only trigger `last_pack`. An eye-drop bottle with `reorderDays` triggers `under_14` when the reorder day arrives, even if the plan's alerts are off.
- `evaluateAlerts`: each threshold sends at most once per episode. The episode closes when the threshold no longer triggers. A med marked as ordered does not send.
- The automated jobs send at most one email per plan per day. Alerts are claimed with an `alert_runs` row, and reminders and summaries with a `notification_runs` row keyed by kind. A unique violation (`23505`) means the email was already handled, and only a `failed` row is retried. This is what makes rerunning a job on the same day safe.
- Bulk reads with the service role must paginate with `selectAll`, ordered on a unique key, because Supabase returns at most 1000 rows per request.
- `runPool` processes `CRON_CONCURRENCY` plans at a time and starts no new plan after `deadline`. Skipped plans are reported with `timeoutMessage`.
- Recipients of plan emails are the owner, the extra recipients, and the members, deduplicated and lowercased (`planAudience` / `uniqueEmails`).
- Modules marked `import "server-only"` (`env`, `data`, `cron-data`, `alerts`, `notify`, `ops`, `usage`) must not be imported by client components. Pure modules such as `pharmacy.ts` and `aic.ts` are shared by server and browser.
- `getPlanBundle` returns `notFound()` for a malformed UUID or an inaccessible plan. `requireProfile` redirects to `/accesso` when there is no session, and to `/benvenuto` when the first or last name is missing.

## Side Effects
- `data.ts` and `availability.ts` read through the user client (RLS). `data.ts` covers `profiles`, `plans`, `plan_members`, `plan_invites`, `plan_recipients`, `medications`, `stock_events`, and the RPC `my_plan_invites`. `availability.ts` covers `aifa_shortages`, `aifa_transparency`, and the RPC `aifa_status`.
- `alerts.ts` writes through the admin client to `cron_runs`, `alert_log` (open, close, and `sent_at`), and `alert_runs`, and sends email through a pooled provider.
- `notify.ts` writes `notification_runs` and sends email through a pooled provider.
- `ops.ts` reads `cron_runs` and `aifa_imports`, inserts and updates `cron_runs`, and sends the technical email to `env.opsEmail()`. `notifyOps` never throws.
- `usage.ts` reads Auth users (`auth.admin.listUsers`), `plans`, `plan_members`, `plan_invites`, `medications`, `stock_events`, `alert_runs`, `notification_runs`, and `cron_runs`, then emails the report to `env.opsEmail()`.
- `env.ts` reads `process.env` and throws on a missing required variable. The `OPS_ALERT_EMAIL` accessor has a hard-coded fallback address.
- The automated jobs log to `console.info` and `console.error` with a `[cron]` prefix.
- All other root modules are pure.

## Verification
- Run: `npm test` (vitest; unit tests in `tests/`, for example `tests/forecast.test.ts`, `tests/aic.test.ts`, `tests/availability.test.ts`, `tests/batch.test.ts`, `tests/pharmacy.test.ts`, `tests/usage.test.ts`)
- Run: `npm run test:db`
- Run: `npm run typecheck`
