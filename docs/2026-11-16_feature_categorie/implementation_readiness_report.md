# Stage 9: Implementation Readiness Report

**Target:** `docs/2026-11-16_feature_categorie/categorie.md`, DetailedRange 926–1554
**Reviewers:** `egm-implementation-readiness` and `egm-codebase-details` (standard `implementation-readiness-standard`), `egm-style` (no standard). Each started with no conversation history; the only background file was `concepts_brief.md`; the first two read the codebase read-only.
**Round:** 1. All three reviewers completed.
**Raw totals:** readiness 2 / 12 / 6, codebase 6 / 10 / 9, style 0 / 6 / 9 (Blocker / Major / Nit). Two say FAIL, style says «not ready».
**After merging duplicates:** 7 Blockers, 13 Majors, 12 Nits.

The main context checked these against the repository and they hold: `app/(app)/piani/nuovo/page.tsx:22` passes `prep_reminder: true` and `components/PlanForm.tsx:234` falls back to `?? true`; `supabase/config.toml` has `[db.seed] enabled = false` («si esegue a mano»); `design/` holds only `Presidi.dc.html` and `Presidio.dc.html`, without inalatore, crema, supposta or the 10 line glyphs; `lib/db-types.ts:125` `MEDICATION_COLUMNS` and `lib/aic.ts:237` `pack.form`; `Math.min(20, …)` in `MedicationForm.tsx:448` and `DoseChangesPanel.tsx:127`; `UsageRaw` lives in `lib/usage-stats.ts`.

Why this matters more than usual: since Stage 8 the Technical Plan says (lines 247–248) that the Detailed Plan wins on any conflict, so every gap below is binding on the implementer.

---

## 🔴 Blocker

**B1. New plans still start with the pillbox reminder on.** *(codebase B1, readiness M6; confirmed)*
- **Lines:** 1067–1072 (item 13), 1118–1124 (item 20), 1161–1165 (item 26); Goal 3
- **Problem:** item 13 relies on the zod default `false`, but `nuovo/page.tsx:22` passes `prep_reminder: true` and `PlanForm.tsx:234` falls back to `?? true`. After R1 the switch shows on every plan, so every new plan gets the reminder.
- **Fix:** item 26 sets `prep_reminder: false` in `nuovo/page.tsx`; item 20 changes the fallback to `?? false`; add a test that a plan created from the form has `prep_reminder = false`; update `app/(app)/piani/nuovo/README.md` in item 33.

**B2. The word functions cannot tell an as-needed medicine apart, so their own test fails.** *(codebase B2, readiness M1, style M1)*
- **Lines:** 1263–1267 (item 36) vs 1458–1460 (item 58) and R2.3 line 518
- **Problem:** item 36 says `m` is `{ category, daysPerPack }`; R2.3 says `{ category, daysPerPack, frequencyType }`. Without `frequencyType`, an as-needed flacone (no `daysPerPack`) gets «monodose», and the test «un collirio in flacone al bisogno dice "flacone"» cannot pass.
- **Fix:** item 36: `m` is `{ category, daysPerPack, frequencyType }`; word mode = `frequencyType === 'as_needed' ? defaultMode(category) : (isLevel(m) ? 'livello' : 'pezzi')`.

**B3. The R1 and R2 file lists leave out files that must change for typecheck, lint and e2e (Goal 7).** *(readiness B1, codebase M1, M3, B6 part)*
- **Lines:** R1 items 13, 14, 20, 26; R2 items 34–62
- **Missing or incomplete:**
  - R1: `components/PlanForm.tsx` keeps the mode-change recount (`PlanFormMed`, `meds`, `counts`, the `Pill` import, lines 48–193) and now-false copy (line 199 «le dosi dei 7 giorni escono dalle scorte», line 237 «cosa manca»); the reminder switch must become unconditional (today it shows only when weekly, line 232). `planSchema.counts` (`lib/schemas.ts:29–32`) and the mode-change branch of item 14 stay. Both pages in item 26 still pass `meds`.
  - R1: `lib/usage-stats.ts` (where `UsageRaw` and `preps` live, lines 17, 41, 53) is not listed; item 12 names the wrong file.
  - R2: `app/(app)/piani/page.tsx:97` (`<Pill shape={i.med.shape}>`, `shape` becomes nullable); `lib/pills.ts:48` `pillLook(atcCode, shape: string)` (used by stampa and terapia); `components/DoseChangesPanel.tsx:121–127` (cap 20, step 0.5, «Mezza compressa»).
  - R2 tests: `tests/e2e/aifa.spec.ts:82,85` uses the old labels; `tests/e2e/sharing.spec.ts:56–58` fills the form without choosing a category, which R2.6 hides until a category is chosen.
- **Fix:** add each file with its exact change, as listed above.

**B4. The e2e test of item 62 depends on a seed that never runs in e2e.** *(readiness B2, codebase B3, style M6; confirmed)*
- **Lines:** 1250–1254 (item 35), 1497–1504 (item 62); Goal 5
- **Problem:** `supabase/config.toml` disables the seed; `seed.sql` raises an exception unless the profile `sostituisci@esempio.it` exists; the e2e specs create their own data with the admin client. The seed also lacks the as-needed syrup and tablet that item 62 checks. How the «email di avviso renderizzata» is checked is not decided.
- **Fix:** item 62 logs in like `aifa.spec.ts` and creates the plan and one medicine per category with `admin()` in `beforeAll`, as `sharing.spec.ts` does; list the rows (category, mode, `days_per_pack`, `pills_per_pack`, `stock_qty`, frequency), including an as-needed syrup and an as-needed tablet. Move the email check to a unit test on the renderer (`tests/alert-template.test.ts`). Drop «per i test e2e» from item 35.

**B5. Neither data migration has an automated test, and the `tests/db` harness cannot run one.** *(codebase B4, readiness M4)*
- **Lines:** 1182–1212, 1445–1504; R1.4 lines 401–405
- **Problem:** R1.4 promises `tests/db` cases (active prep, no prep, recount after X, flacone not moved, weekly plan with the reminder off). No item implements them, and `tests/db/setup.ts` talks through PostgREST to an already-migrated database, so it cannot insert pre-migration rows. The R2 `CASE` over 11 pairs is only checked by hand.
- **Fix (choice):** either (a) state that migration correctness is checked only by the manual «Prova della migrazione sui dati veri» and correct R1.4, or (b) add a SQL test script per migration (reset to the previous migration, insert fixtures, apply, assert), with path and command.

**B6. The design files do not contain the 10 category glyphs.** *(codebase B5, readiness M10, Stage 8 Z5; confirmed)*
- **Lines:** 1394–1399 (item 51), 1409 (item 53), 1262; R2.7 and glossary
- **Problem:** `design/Presidi.dc.html` and `design/Presidio.dc.html` have only today's supply shapes; there is no pillola, liquido, inalatore, crema, supposta or altro geometry, no «tab 10, sezioni 07–10», and no source for the 10 line glyphs of the 5×2 selector. `FormGlyph({ form: MedForm })` (`Presidio.tsx:140`, used at `MedicationForm.tsx:19, 410`) breaks when `MedForm` goes, and nothing replaces it. `view="tube"` and `days` are not defined; the penna geometry for iniezione at level is not stated.
- **Fix (needs the author):** commit the design export that has the 10 glyphs, or inline their geometry in the plan. Item 51: `FormGlyph` becomes `CategoryGlyph({ category, size })`; define `view="tube"` and `days`, or say `Dispenser` keeps `PRESIDIO_GEO` keyed by category; map iniezione at level to `penna`.

**B7. Several items describe code that is not there.** *(codebase B6)*
- **Lines:** 962–964, 996–1001, 1022–1027, 1059–1065, 1250–1251, 1342–1343
- **Problem:** item 12: `UsageRaw` is in `lib/usage-stats.ts`, and the usage email has no preparations row (`preps` feeds «Movimenti registrati»). Item 7: preparations are read in `runDailyAlerts` (`alerts.ts:89, 99–104`, `toPrepRun` import at line 4), not in `buildPlanEmail`, which only needs `nextPrep: forecast.nextPrep` removed (line 47). Item 4: `buildSummaryMeds` reads no weekly fields. Item 2: `seed.sql` has no `prep_runs` insert. Item 35: the seed's `medications` insert has neither `form` nor `reorder_days`. Item 45: `toMedication` already does `Number(r.stock_qty)`.
- **Fix:** rewrite items 7 and 12 as above; delete the false claims in items 2, 4, 35 and 45.

---

## 🟡 Major

**M1. Level stock input is not specified for creation, recount and validation.** *(readiness M2, codebase M6 and N9, style M2)*
- **Lines:** 1346–1356 (item 46), 1371–1377, 1407–1416
- **Problem:** `recountStock` validates with `qtySchema` (half steps, `lib/schemas.ts:100`), which rejects 1.1; item 46 gives the rule only in prose and says «tre frazioni» against four values (0, 0.1, 0.5, 1); it applies the same rule to arrivals, which are `packs × pills_per_pack`; item 53 says nothing about the stock field when **creating** a level medicine (CUJ 1 ends with «1 flacone»).
- **Fix:** define `levelQtySchema` (`{ closed: int ≥ 0, open: 0 | 0.1 | 0.5 | 1 }`); `recountStock` picks it when `isLevel(med)`; arrivals stay an integer ≥ 1 of boxes; the create form for level asks closed + open, default `closed = 0, open = 1`.

**M2. The mode-change rule needs data zod does not have, and `pills_per_pack` changes meaning.** *(readiness M3, codebase M6)*
- **Lines:** 1353–1355, 1366–1367
- **Problem:** there is no «schema di modifica»; one `medicationSchema` serves create and update, and a `refine` cannot see the saved mode. On a mode change `pills_per_pack` silently switches from pieces to containers per box (a 30-monodose box switched to level would add 30 flaconi per box). The `count` event's `delta` mixes units.
- **Fix:** do the check in `updateMedication` (compare `isLevel(saved)` with the input) and return a field error; on a mode change the form asks `pills_per_pack` again (level default 1); the `count` event has `delta = qty_after` and `meta.reason = 'mode_change'`.

**M3. The SQL for X does not mirror today's code and has syntax errors.** *(readiness M7, codebase M7, style N2, Stage 8 Z7)*
- **Lines:** 942–952 (item 1)
- **Problem:** the code ignores runs with `week_start + 6 < mode_since` (`forecast.ts:259–263`) and computes the next prep as the first `prep_weekday` after `week_start` (`forecast.ts:278`), not `week_start + 7`. A CTE lives inside one statement, but steps 2 and 3 are separate. `isodow(…)` is not a Postgres function; `extract(isodow …)` returns numeric; `alter column` lacks `alter table public.plans`.
- **Fix:** write one `with weekly_start as (…) update …` statement, filter `week_start + 6 >= mode_since`, use the same «first `prep_weekday` after» formula for both cases, cast with `::int`, and add a weekly → daily → weekly case.

**M4. A future `stock_as_of` is reset by any action during the prepared week.** *(readiness M8)*
- **Lines:** 947–949
- **Problem:** X can be in the future; `arrivePacks`, `recountStock`, `takeAsNeeded` and `updateMedication` write `effective_date = today`, so an action in that week restarts the daily decrease at once and counts the pillbox doses twice.
- **Fix (choice):** accept it in the risks table (alerts earlier), or have those actions use `maxDate(today, med.stockAsOf)`.

**M5. `levelPhrase` is not precise enough to implement or test.** *(readiness M9, style M5, codebase N6)*
- **Lines:** 1270–1272 (item 36), 1462 (item 58)
- **Problem:** the order of «sotto 1» and the 0.25–0.75 rule is not stated (0.5 fits both), the bounds are not inclusive/exclusive, «1 flacone e mezzo» conflicts with «una penna e mezza», stock 0 and `coverageDays === null` are not handled, and the test lists inputs without expected strings.
- **Fix:** ordered cases: `stock ≤ 0` → «finito»; `< 1` → «meno di un/una {c}»; `r = stock − floor`; `0.25 ≤ r < 0.75` → «{n} {c} e mezzo/a» (n = 1 written «un/una»); otherwise round. Say what null coverage shows. Give the expected string for 0, 0.25, 0.5, 0.75, 0.967, 1.5, 2, 2.9. Reuse the half rounding of `formatQty` (Stage 8 Z4).

**M6. The new dose limit of 999 reaches only one schema and the stepper.** *(readiness M11, codebase M2)*
- **Lines:** 1346–1356, 1407–1416
- **Problem:** `doseSchema` (`schemas.ts:101`, used by `takeAsNeeded`) and `doseChangeSchema` (106–108) stay at 20; `MedicationForm.tsx:448` and `DoseChangesPanel.tsx:127` cap at 20. Entry is stepper-only, so 40 UI takes 40 taps.
- **Fix:** list all four limits with the new value; add a numeric input next to the ± buttons.

**M7. The `prepReminder` data flow and leftover weekly branches on the plan pages.** *(readiness M12, codebase N1, N2)*
- **Lines:** 1133–1159 (items 22–25)
- **Problem:** nobody passes `prepReminder` to `DispenserGrid` (`[id]/page.tsx:137`); item 24 misses `weekly` (line 25), the weekly first cell (52–77) and `dispenserView(…, stockMode, …)` (26); item 25 misses the mode label (line 71, 84); the preview `<Dispenser>` in `MedicationForm.tsx:591` has no value.
- **Fix:** item 24 passes `prepReminder={b.settings.prepReminder}` and lists the removals; item 22 makes the prop optional (default `false`); item 25 removes the label.

**M8. The reminder email still describes the weekly behaviour.** *(codebase M4)*
- **Lines:** 1096–1102, 1319–1323
- **Problem:** `renderPrepReminderEmail` says «premi "Portapillole preparato" … così le scorte si aggiornano» (`templates.ts:84`), and «Da mettere: N compresse» / «In casa c'è tutto: N compresse» (94, 103, 120) sum mixed units, now that the reminder includes flaconi and siringhe. `ReminderItem.missing` and `need` (57–60) need a decision.
- **Fix:** give the new intro text, drop or per-category the totals, and give the new `ReminderItem` type.

**M9. `MEDICATION_COLUMNS` still selects the removed columns.** *(codebase M5; confirmed)*
- **Lines:** 1339–1344 (item 45)
- **Problem:** `lib/db-types.ts:125` selects `form, shape, reorder_days`; after R2 every medication query fails at runtime, and typecheck does not catch it.
- **Fix:** item 45 replaces them with `category, shape, days_per_pack`.

**M10. Emails, pharmacy and history round level stock to half units.** *(codebase M8, readiness N5)*
- **Lines:** 1379–1384, 1437–1443
- **Problem:** «Compresse rimaste» (`alert-template.ts:113, 167`), «Compresse in casa» (`templates.ts:188, 213`) and the history page (`storico/page.tsx:67`) use `formatQty` and the word «compresse»; 0.967 flaconi shows as «1».
- **Fix:** for level medicines use `levelPhrase` and `containerWord`; list the fields this adds to `SummaryMed` and `AlertEmailMed`.

**M11. The Goal 1 grep can never come back empty.** *(all three; confirmed)*
- **Lines:** 1523–1527
- **Problem:** `\.form\b` matches `lib/aic.ts:237` (`pack.form`, the AIFA column that stays). The grep also skips `tests`, `scripts` and `supabase/seed.sql`, though the sentence claims none remain.
- **Fix:** exclude `pack\.form` (or narrow the pattern), and either add the other paths or narrow the sentence.

**M12. A new medicine has no initial values for «no category chosen».** *(codebase M10)*
- **Lines:** 1437–1443 (item 57)
- **Problem:** `nuovo/page.tsx:29–30` passes `form: "compressa", shape: "tonda"`; `MedicationInput` will require `category`.
- **Fix:** give the initial object (`category: null` in the form state only, `shape: null`, `days_per_pack: null`).

**M13. The rounding claims are wider than the tolerance.** *(style M4; see Stage 8 Z3)*
- **Lines:** 1289–1291, 1474–1476
- **Problem:** `STOCK_TOL = 0.0005` is the error of one rounding, but the drift test does ten rounded saves and expects the same coverage.
- **Fix (choice):** say «un singolo arrotondamento» and allow at most one day of difference over ten saves; or apply Stage 8 Z3 (plain `numeric`, no `roundStock`, no tolerance, no drift test).

---

## 🟢 Nit

| # | Lines | Problem → Fix | Source |
|---|---|---|---|
| N1 | 1005–1013 | Item 5 misses `nextPrep: fc.nextPrep` (`notify.ts:168`) and the `toPrepRun` import (line 5). | readiness N1, codebase N3 |
| N2 | 1232–1246 | After the rename the check keeps the name `medications_reorder_days_check`; rename it to `medications_days_per_pack_check`. | readiness N3, codebase N5 |
| N3 | 959–965 | Item 2: say the seed plan changes from `'weekly'` to `prep_reminder = true`; no `prep_runs` inserts exist. | readiness N4 |
| N4 | 1279–1296 | `coveredDaysFrom` takes `Schedule` but `consumptionOn` needs `daysPerPack`; the `reorderDays` early return (line 252) must go; `onOrAfterWeekday` and `maxDate` become unused imports. | codebase N4 |
| N5 | 1298–1303, 1426–1430 | `PharmacyLine` has no `category` / `daysPerPack` for `packsText`. | codebase N7 |
| N6 | 1464–1476 | Delete the old flacone reminder tests (`tests/forecast.test.ts:362–385`) and the `reorder` assertions. | codebase N8 |
| N7 | 1265–1266, 1420–1423 | `howMany` serves three questions; split into named functions; say how «, comprese quelle nel portapillole» agrees in gender. | readiness N6 |
| N8 | 1236–1237 | «`shape` decide … per il collirio, il modo»: the mode comes from `days_per_pack`. | style N1 |
| N9 | 1057, 1065, 1145 | Chained «come sopra»; give the reason directly. | style N3 |
| N10 | 1085–1086, 1172, 1174, 1178–1180, 1189–1190, 1362 | Verbless sentences; «oggi» for both «current code» and today's date; a verification step inside «Perché». | style N4–N6 |
| N11 | 1461, 1286–1288, 1325 | «due eccezioni per ogni categoria» misreads; repeated sentence in item 38; item 43 is a second entry for `lib/forecast.ts`. | style N7, N8 |
| N12 | 1536, 1542–1543 | «valore atteso», «del giorno prima», «piani giornalieri» are undefined after R1; write `greatest(stock_as_of, X)`, «prima della migrazione», «medicinale a pezzi». | style N9 |

---

## Decisions for the author

- **B5:** test the migrations only by hand on the real-data dump (simplest), or add a SQL test harness.
- **B6:** where the 10 glyphs come from (a new design export, or geometry written into the plan).
- **M4:** accept that an action in the prepared week restarts the decrease, or base actions on `max(today, stock_as_of)`.
- **M13:** keep 3-decimal storage and loosen the test, or switch to plain `numeric` (Stage 8 Z3).

---

## Resolution (applied to categorie.md on 2026-11-16)

Proposals are in [goldfish_review_report_stage9.md](./goldfish_review_report_stage9.md). The author gave the design project «Interfaccia Panoramix confermata» as the source for the icons (page Presidi), chose the recommended option for the four decisions and accepted all fixes. The Detailed Implementation Plan was rewritten in one pass; items keep their numbers 1–63, new items are 64–67, and item 43 is merged into 38.

| # | Resolution |
|---|---|
| B1 | Item 26 sets `prep_reminder: false` in `nuovo/page.tsx`; item 20 uses `?? false`; item 30 tests it; item 33 updates the README. |
| B2 | Item 36: `m` is `{ category, daysPerPack, frequencyType }`, with the word-mode rule. |
| B3 | Item 20 removes the mode-change recount from `PlanForm` and rewrites its copy; items 13, 14, 26 drop `counts`/`meds`; item 12 covers `lib/usage-stats.ts`; new items 64 (`piani/page.tsx`), 65 (`lib/pills.ts`), 66 (`DoseChangesPanel.tsx`), 67 (`aifa.spec.ts`, `sharing.spec.ts`). |
| B4 | Item 62 creates its own user, plan and 12 medicines with `admin()` (table in the item); the email check moves to `tests/alert-template.test.ts`; item 35 no longer claims an e2e use. |
| B5 | Decision (a): migrations are checked only on the real-data dump. R1.4, items 32 and 61 and the Verification Plan say so, with the expected values. |
| B6 | `design/Presidi.dc.html` and `design/Presidio.dc.html` replaced with the given export (10 icons, tube view, 10 line glyphs, word table). Item 51 specifies `PRESIDIO_GEO`, `view`/`days`, `CategoryGlyph`; glossary and R2.7 point to the new files. |
| B7 | Items 2, 4, 7, 12, 35, 45 corrected to match the code. |
| M1 | `levelQtySchema` (item 46), used by `recountStock` (item 48) and at creation (items 47, 53). |
| M2 | Mode-change check in `updateMedication`; `pills_per_pack` asked again; `count` event with `meta.reason = 'mode_change'` (item 47). |
| M3 | Item 1 has the full SQL statement, with the `mode_since` filter and the same X rule as `nextPrepDue` (also Stage 8 Z7). |
| M4 | Decision (a): actions save at `max(today, stock_as_of)` (R1.1, items 15, 16, 30). |
| M5 | `levelPhrase` rules ordered, with expected strings in item 58 (also Stage 8 Z4). |
| M6 | Dose limit 999 in `doseSchema`, `doseChangeSchema`, `MedicationForm`, `DoseChangesPanel`, plus a numeric input. |
| M7 | Items 22–25: optional `prepReminder`, passed from the plan page; weekly leftovers removed. |
| M8 | Item 17: new reminder intro, no totals, `ReminderItem` without `need`/`missing`. |
| M9 | Item 45 updates `MEDICATION_COLUMNS`. |
| M10 | Items 41, 42, 49, 57: `levelText` and `containerWord` in emails, summary and history. |
| M11 | The grep excludes `pack\.form` and covers `scripts`, `tests`, `supabase/seed.sql`. |
| M12 | Item 57 gives the initial values for a new medicine. |
| M13 | Decision (a): `numeric` without scale; `roundStock`, `STOCK_TOL` and the drift test removed (also Stage 8 Z3). |
| N1–N12 | Applied. |
| E4 | R2.5 now uses the AIFA keyword list from the design (section 10), matched at the start of a word, after exceptions e1–e7; «altro» uses the word «unità». |

Stage 8 Nits Z3, Z4, Z5 (rename `presidi.ts` → `categories.ts`, `FormGlyph`), Z6 (switch subtitle in item 20) and Z7 are resolved by the same edits.

New split: FeatureRange 1–944, DetailedRange 945–end.
