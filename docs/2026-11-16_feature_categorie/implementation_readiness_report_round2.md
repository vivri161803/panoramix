# Stage 9, round 2: Implementation Readiness Re-audit

**Target:** `docs/2026-11-16_feature_categorie/categorie.md`, DetailedRange 945–1804 (rewritten after round 1)
**Reviewers:** `egm-implementation-readiness`, `egm-codebase-details` (standard `implementation-readiness-standard`), `egm-style` (no standard). Fresh contexts; background `concepts_brief.md`; the first two read the code and `design/`.
**Raw totals:** readiness 1 / 5 / 9, codebase 1 / 8 / 10, style 0 / 2 / 6 (Blocker / Major / Nit). Two say NOT READY.
**After merging duplicates:** 1 Blocker, 11 Majors, 15 Nits.

**Progress since round 1:** 7 → 1 Blockers. Both code reviewers confirm that the R1 SQL now reproduces `relevantRuns`/`nextPrepDue`, that file paths, line numbers and constraint names are accurate, and that file coverage against the leftover-name greps is essentially complete.

**Two findings come from round-1 fixes, and the main context confirmed both:**
- B1: the round-1 decision E2 (`max(today, stock_as_of)`) was applied to recounts too. A recount asks for the total *including* the pillbox, so dating it in the future leaves the pillbox doses unconsumed. `lib/forecast.ts:253` returns `stockQty` unchanged while `stockAsOf >= today`.
- M5: the round-1 decision E4 took the word «unità» for `altro` from the design, but the brief (line 126) says «pezzi», «per non confonderla con le unità di insulina».

---

## 🔴 Blocker

**B1. A recount saved at a future `stock_as_of` overestimates stock, so alerts arrive late.** *(readiness B1, codebase B1; confirmed)*
- **Lines:** item 15 (1142–1146), item 16 (1153–1155), item 30 test (1292–1293)
- **Problem:** after R1, `stock_as_of = X` can be up to 7 days ahead. Items 15–16 date every stock write at `maxDate(today, stockAsOf)`, including `recountStock` and the form count, whose question includes the pillbox. The doses from today to X−1 are then counted in the total and never consumed. This breaks the brief's rule «gli avvisi arrivano prima, mai dopo».
- **Fix:** split the rule. A full count (`recountStock`, the form count, the R2 `mode_change` count) is dated **today**. Changes to home stock (`arrivePacks`, `takeAsNeeded`, `undoStockEvent`, the `updateMedication` rebase) use `maxDate(today, stockAsOf)`. Rewrite the item 30 test: a recount with a future `stock_as_of` saves at today; an arrival saves at `stock_as_of`. Update R1.1.

## 🟡 Major

**M1. Coverage ignores the pillbox days still covered while `stock_as_of` is in the future.** *(readiness M1, codebase M1)*
- **Lines:** item 3 (1031–1032), item 6 (1066–1067), item 28
- **Problem:** `coveredDaysFrom(med, stock, today)` consumes from today, but `stock` is home stock only until X. A medicine whose whole supply is in the pillbox shows coverage 0 and «Scorta finita», and the first cron sends `under_7`/`last_pack`. The old weekly branch added the pillbox days (`forecast.ts:408–410`). `buildPharmacyItems` over-orders the same way.
- **Fix:** `from = maxDate(today, med.stockAsOf)`; coverage = `diffDays(today, from) + coveredDaysFrom(med, stock, from)` (null stays null); use `from` in `suggestedPacks`; add a test in item 28 (`stock_as_of = today + 3` keeps 3 extra days). Carry it into item 38.

**M2. The date rule misses other code paths that write or forecast stock.** *(readiness B1 part, codebase M2)*
- **Lines:** item 15, item 16
- **Problem:** `undoStockEvent` (`stock.ts:115–148`), `closeEpisodesIfAbove` (line 31), the `fNew` forecast in `recountStock` (line 77) and `p_expected_as_of: bundle.today` in `updateMedication` (`medications.ts:125`) all assume today.
- **Fix:** list each one with the date it must use (the date of the event it follows).

**M3. The input contract for level stock is undefined.** *(readiness M2, codebase M3)*
- **Lines:** items 46–48, 60 (1475–1508, 1695–1696)
- **Problem:** `levelQtySchema` is an object, but `medicationSchema` names no field for it, `recountStock` takes `qty: number`, and the test «accetta 1,1, rifiuta 1,3» implies a number. Missing `stock_qty` on create in pezzi mode is not specified.
- **Fix:** choose one: (a) `level_stock: levelQtySchema.optional()` in `medicationSchema` (required when `days_per_pack != null` on create or mode change; `stock_qty` required otherwise) and `recountStock(planId, medId, qty: number | { closed, open })`; or (b) keep a number and validate `Number.isInteger(q − open)` with `open ∈ {0, 0.1, 0.5, 1}`. Rewrite the test to match.

**M4. `frequencyType` does not reach the word functions in pharmacy, alerts, digest and email types.** *(readiness M3)*
- **Lines:** items 39, 41, 42, 49
- **Problem:** `PharmacyItem`/`PharmacyLine`, `toEmailMed`, `buildSummaryMeds`, `SummaryMed`, `AlertEmailMed` carry only `category` and `daysPerPack`; an as-needed flacone would be «monodose» in the pharmacy list and in emails.
- **Fix:** add `frequencyType` (or a precomputed word mode) to each type and item.

**M5. The word for `altro` contradicts the brief.** *(readiness M4, codebase M8; confirmed — introduced in round 1)*
- **Lines:** R2.3 table (line 497), item 36
- **Problem:** the brief says «pezzi», not «unità», to avoid confusion with insulin units; R2.3 now says «unità / unità», taken from the design, and the change is not in «Differenze rispetto al brief».
- **Fix:** restore «pezzo / pezzi» (masculine), or record the change with the author's approval.

**M6. The `Presidio` props cannot draw the counting mode, and differ from the design without saying so.** *(readiness M5, codebase M4)*
- **Lines:** item 51 (1543–1548), item 54
- **Problem:** the design component has `shape` (not `category`), `view: "icona" | "tubo"`, a `stock` prop (`auto | pezzi | livello`) that chooses stacked pieces or a level band, `scaleMax`, `size: number | "s" | "l"` and `rotate`. The plan's props have no mode, so gocce a pezzi and iniezione a livello draw wrongly; `rotate` (used at `MedicationForm.tsx:365`, `disponibilita/page.tsx:171`) and `scaleMax` are missing.
- **Fix:** write the signature, e.g. `{ category; pillShape?; color; size?: number | "s" | "l"; rotate?; view?: "icon" | "tube"; level?: boolean; days?; scaleMax? = 60 }`, with `level` defaulting to `defaultMode(category) === "livello"`; item 54 passes `level`; list the renames from the design.

**M7. `aifa_packs.form` is confused with `medications.form`.** *(codebase M5, readiness N2)*
- **Lines:** item 60 (1685–1687), Verification grep (1767–1771)
- **Problem:** `tests/helpers/aifa-sample.ts` holds only `aifa_packs` rows, whose `form` stays; `tests/aifa-parse.test.ts:103` reads that column and matches `\.form\b`; `-r` also scans README files, where item 63's own wording matches `lib/presidi`.
- **Fix:** take `aifa-sample.ts` out of item 60 (or say its `form` stays); in `tests/aic.test.ts` only the expected outputs change; restrict the grep to `--include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.sql'` and exclude the AIFA lines.

**M8. The `PlanForm` line ranges in item 20 delete state that must stay.** *(codebase M6)*
- **Lines:** item 20 (1196)
- **Problem:** lines 49–53 declare `error`, `fieldErrors`, `confirmDelete`, `pending`; `MODES` (32–35), the `StockMode` import (7) and the mode fieldset (136–163, 194) are not listed.
- **Fix:** «righe 7, 14–21, 27, 32–35, 48, 54, 73–81 e 136–194 (fieldset «Modalità delle scorte», compreso il blocco 164–193)».

**M9. The e2e setup in item 62 cannot run as written.** *(codebase M7, readiness N3)*
- **Lines:** 1711–1737
- **Problem:** `admin()` is in `tests/db/setup.ts`, not in `sharing.spec.ts`; e2e specs build the service client inline (`aifa.spec.ts:41`). `beforeAll` runs before the magic-link login, so `owner_id` does not exist yet. The rows have no doses or start dates, and `medications_dose_positive` needs a dose > 0.
- **Fix:** cite `aifa.spec.ts:41`; log in first, read `profiles.id` by email, then insert; give dose and start date per row.

**M10. `levelPhrase` mixes «1» and «un», and disagrees with CUJ 6 and the brief.** *(style M1)*
- **Lines:** item 36 (1384–1393), item 58 (1665–1669); CUJ 6 line 241
- **Problem:** rule 3 writes «un flacone e mezzo», rule 4 writes «1 flacone»; CUJ 6 and the brief write «1 inalatore e mezzo»; rule 3 does not say the container word agrees with n; no full output string («circa N giorni · …») is given.
- **Fix:** one convention (digit everywhere is the simplest and matches CUJ 6 and the brief); `containerWord(m, n)` in rule 3; two complete expected strings.

**M11. Test edits are filed under items for other files, and some R2 changes are untested.** *(style M2, readiness N9, codebase N8)*
- **Lines:** item 59 (1681–1683), item 62 (1735–1737)
- **Problem:** `tests/alert-template.test.ts`, `tests/email-templates.test.ts` and `tests/digest.test.ts` need R2 changes but no R2 item names them; there are no `reorder` expectations in the template tests to remove; nothing checks that 0,967 flaconi do not render as «1».
- **Fix:** one R2 item for the three test files, with the cases (category names, `levelText`, `doseWord`, 0,967).

## 🟢 Nit

| # | Lines | Problem → Fix | Source |
|---|---|---|---|
| N1 | 1345–1346 | Drop `medications_reorder_days_check` (inline, keeps its name after the rename) before creating `medications_days_per_pack_check`. | readiness N1, codebase N10 |
| N2 | 1302–1306 | Item 32: remove `stock_mode` and `mode_since` from the plan insert at `cron.db.test.ts:42`. | readiness N4 |
| N3 | 1464–1467 | Item 45: also change the `Medication` interface (`db-types.ts:139–141`) and drop the `MedForm` import (line 4). | readiness N5, codebase N5 |
| N4 | 1415, 1428–1433 | Delete `pillsText` (`view.ts:82–84`, no callers), which uses `pillsWord`. | readiness N6, codebase N3 |
| N5 | 1374–1378 | Name the dose heading function that replaces `howMany` at `MedicationForm.tsx:436`, e.g. `doseQuestion(m)`. | readiness N7 |
| N6 | 1423–1425 | `PharmacyItem.phrase` (`pharmacy.ts:69`) passes `doseWord` to `dosesPhrase`. | readiness N8 |
| N7 | e5 (line 591) | Say whether exceptions match at word start too, or write them as stems (VAGINAL, RETTAL, OVUL, SUPPOST, CAPSUL, COMPRESS). | readiness N9 |
| N8 | 1153 | `lib/actions/medications.ts` does not call `forecastPlan`. | codebase N1 |
| N9 | 1424 | `PharmacyLine` has no `shape`; it gains `category`, `daysPerPack`, `frequencyType`, passed at `PharmacyList.tsx:42`. | codebase N2 |
| N10 | 1407 | `suggestedPacks` is in `lib/pharmacy.ts`, not `lib/forecast.ts`; leave it to item 39. | codebase N4 |
| N11 | 1613–1616 | Name the form-state type, e.g. `Omit<MedicationInput, "category"> & { category: Category \| null }`. | codebase N6 |
| N12 | 1637–1639 | `DoseChangesPanel` needs `category`, `daysPerPack`, `frequencyType` props, passed from `medicinali/[medId]/page.tsx:56–63`. | codebase N7 |
| N13 | 1166–1168, 1234 | Item 17: the plain-text line `templates.ts:122` also uses `need`/`missing`/`pillsWord`. Item 24: list the imports that become unused (`addDays`, `dateOfTimestampRome`, `formatRange`, `formatRelative`, `formatTimeRome`, `formatQty`, `IconAlertCircle`, `IconXCircle`). | codebase N9, extra |
| N14 | 948–950, 1398, 1451 | Process notes and placeholder items 37 and 43; «dal rinomina» → «dalla rinomina». Renumber in reading order, or cut the intro to one sentence. | style N1, N2 |
| N15 | 1391–1392, 1540, 1567, 1704, 1711, 1730–1733, 1785–1794 | Redundant `formatQty` sentence; units for «contorno a 2», «glifo da 24»; literal value for 0,9666…; «utente suo»; «parola giusta» → the two words of `CATEGORIES`; negative check rewritten as a rule; define «dose giornaliera 0». | style N3–N6 |

---

## Where the loop stands

This was the one re-audit the Stage 9 flow allows (`egm-review` Critic and Readiness subflows: «max 1 re-audit»). The findings are narrower than in round 1: one Blocker and most Majors concern the post-migration week for former weekly plans (B1, M1, M2), the level-stock input contract (M3) and specification gaps the code reviewers could see only after round 1 filled in the detail.

---

## Resolution (applied to categorie.md on 2026-11-16)

The author asked to fix the round-2 findings without another review round. Rule: the simplest fix that removes the problem.

| # | Resolution |
|---|---|
| B1 | R1.1 and items 15, 16, 30: a full count (`recountStock`, a stock typed in the form, the mode-change count) is dated today; arrivals, as-needed takes and their undo use `maxDate(today, stockAsOf)`. The item 30 test checks both. |
| M1 | Items 3, 6, 28, 38, 39 and R1.1: coverage and the pharmacy need start from `maxDate(today, stockAsOf)`, adding the days up to it; test with `stock_as_of = today + 3`. |
| M2 | Item 15 lists `undoStockEvent`, `closeEpisodesIfAbove` and the `fNew` forecast; item 16 fixes `p_expected_as_of`. |
| M3 | Option (b): the stock stays a number; new `isLevelQty(q)` (fraction 0, 0,1 or 0,5); `recountStock` keeps its signature; `stock_qty` is required on create. `levelQtySchema` removed. |
| M4 | `frequencyType` added in items 39, 41, 42, 49. |
| M5 | `altro` back to «pezzo / pezzi» (masculine), as in the brief. |
| M6 | Item 51 gives the full `Presidio` signature (with `level`, `rotate`, `scaleMax`, `size: number \| "s" \| "l"`) and the name differences from the design; item 54 passes `level`. |
| M7 | Item 60 keeps `aifa_packs.form` (`aifa-sample.ts` unchanged); the grep is limited to code files and excludes the two AIFA lines. |
| M8 | Item 20 lists the exact `PlanForm` lines and keeps lines 49–53. |
| M9 | Item 62: login first, service client as in `aifa.spec.ts:41`, `profiles.id` by email, dose per row. |
| M10 | Digits everywhere («1 flacone e mezzo», «2 penne e mezza»), `containerWord(m, n)` in the rules, two full expected strings. |
| M11 | New item 68 for `alert-template`, `email-templates` and `digest` tests (including 0,967 → «meno di un flacone»). |
| N1–N15 | Applied: `medications_reorder_days_check` dropped; item 32 insert; `Medication` interface; `pillsText` removed; `doseQuestion`; pharmacy `doseWord`; e5 written as stems; `forecastPlan` and `suggestedPacks` references fixed; `PharmacyLine` fields; form-state type; `DoseChangesPanel` props; templates line 122; unused imports in item 24; placeholder items 37 and 43 removed with a one-line note; «la rinomina»; units; `29/30`; explicit verification checks. |

New split: FeatureRange 1–950, DetailedRange 951–1911. Not re-reviewed: the flow allows one Stage 9 re-audit, and it was this round.
