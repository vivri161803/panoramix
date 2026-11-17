# Stage 8: Intermediate Zoom Out Report

**Target:** `docs/2026-11-16_feature_categorie/categorie.md`, full file (1–1538; `## Detailed Implementation Plan` at line 920)
**Reviewer:** `egm-zoom-out`. It started with no conversation history; the only background file was `concepts_brief.md`; no standard was assigned. It also read the code it comments on (`lib/presidi.ts`, `lib/forecast.ts`, `components/MedicationForm.tsx`, `components/ui/Presidio.tsx` and others).
**Result:** 0 Blockers, 2 Majors, 5 Nits. The reviewer approves the scope once the two Majors are fixed.

The main context checked both Majors: `components/MedicationForm.tsx:33, 95, 193–194` uses `nextPrep` and `settings.stockMode`, and the R1 file list has no item for it; R2.9 step 3 and item 34 describe different `assert`s.

## What holds up

The scope stays lean: no `count_mode`, no `pack_volume`, no «da ricontrollare» flag, no ATC tie-break and no multi-phase migration. Level mode is just «has `days_per_pack`», and one function (`consumptionOn`) covers both modes. Removing the weekly stock decrement deletes 3 RPCs, a table and a forecast branch. The reviewer found no premature optimisation and no speculative interfaces.

---

## 🟡 Major

**Z1. The Technical Plan repeats the Detailed Plan in implementation detail, and the two copies already disagree.**
- **Lines:** R1.1 285–300 vs item 3 (967–984); R1.4 363–400 vs item 1 (932–949); R2.2 431–465 vs item 38 (1266–1279); R2.3 509–517 vs item 36 (1246–1256); R2.9 689–724 vs item 34 (1220–1229).
- **Problem:** the Technical Plan lists helpers to delete, signatures and ordered SQL steps, and the Detailed Plan says them again. Two drifts already exist:
  - R1.4 (line 396) leaves «funzione di supporto temporanea … oppure una CTE» open; item 1 chooses a CTE.
  - R2.9 step 3 only asserts that no `category` is null; item 34 also asserts that every flacone has `days_per_pack` or is `as_needed`.
- **Fix:** keep intent and invariants in the Technical Plan (for example «X is the day after the last prepared week; flaconi do not move; `greatest` keeps later recounts», «the migration fails if a category is null or a scheduled flacone has no `days_per_pack`»). Keep ordered SQL steps, deletion lists and signatures only in the Detailed Plan. At minimum: drop the «CTE or temporary function» choice and make the R2 assert the same in both places.

**Z2. The R1 Detailed Plan leaves out `components/MedicationForm.tsx`, so R1 will not typecheck.** *(confirmed)*
- **Lines:** R1 items 19–27 (1107–1165); item 27 says the medicine pages «non leggono `nextPrep`».
- **Problem:** `MedicationForm.tsx` declares a `nextPrep` prop (line 33), reads `settings.stockMode === "weekly"` (95), and calls `forecastMedication(…, nextPrep)` and `dispenserView(med, fc, settings.stockMode, today)` (193–194). R1 removes all of these, so Goal 7 fails, and the Verification Plan grep (line 1510) finds `stockMode`.
- **Fix:** add an R1 «Modify» item for `components/MedicationForm.tsx`: remove `nextPrep` and the weekly branch, call `forecastMedication(med, { plan, today })` and `dispenserView(med, fc, today)`. Re-run the leftover-reference grep over `components/` before closing the R1 file list (the reviewer counted 42 files with matches outside the migrations today).

---

## 🟢 Nit

| # | Lines | Problem | Fix |
|---|---|---|---|
| Z3 | 416, 454–458, items 38 and 59 | `numeric(10,3)` forces `roundStock`, `STOCK_TOL` and a drift test. Plain `numeric` keeps full precision, and display rounding already lives in `formatQty` (`lib/forecast.ts:178–186`, «arrotondare solo qui»). | Use unconstrained `numeric` (still `check >= 0`) for `stock_qty`, `delta`, `qty_after`, and drop `roundStock`, `STOCK_TOL` and the drift test; or say why 3 decimals are wanted. |
| Z4 | 519–523, item 36 | `levelPhrase` re-implements the half-unit rounding that `formatQty` (`lib/forecast.ts:180`) already does with the same 0.25 threshold. | Reuse that rounding (or a shared `roundHalf`) and only add the words. |
| Z5 | items 36–37, 51 | `lib/categories.ts` is listed as Create + Delete of `lib/presidi.ts`, but `presidi.ts` already has the word table and `leftWord`, `doseWord`, `howMany`, `doseStep`, `usesReorderDays`. `FormGlyph({ form: MedForm })` in `components/ui/Presidio.tsx:140` is not mentioned and breaks when `MedForm` goes. | Describe it as «rename `lib/presidi.ts` to `lib/categories.ts`, keyed by category». Say whether the 5×2 selector reuses `FormGlyph` or removes it. |
| Z6 | 302–309, item 3, Risks row | The calendar start day now depends on an email toggle; after R1 `prep_reminder` really means «uses a pillbox». | Say so in R1.2 and make the `PlanForm` label say it. No new column. |
| Z7 | 366–372, item 1 | The current code (`relevantRuns`, `lib/forecast.ts:259–262`) only counts runs with `week_start + 6 >= mode_since`; the migration takes `max(week_start)` over all active runs, so a weekly → daily → weekly plan could get an X from the old period. | Add `and week_start + 6 >= mode_since` to the CTE and the mode-switch case to the R1 DB tests. |

---

## Resolution (applied to categorie.md on 2026-11-16)

The author asked to fix only the two Majors. The rule was the simplest fix that removes the problem.

| # | Resolution |
|---|---|
| Z1 | Minimal fix, no rewrite of the Technical Plan. Its introduction now says that the Detailed Plan is authoritative for files, SQL step order and signatures, and that the Technical Plan must be corrected if the two differ. R1.4 now says the CTE (no more «oppure una funzione temporanea»). R2.9 and item 34 now describe the same two `assert`s: after step 2, no null `category`; after step 6, every flacone has `days_per_pack` or is as-needed. |
| Z2 | Item 27 now also covers `components/MedicationForm.tsx`: no `nextPrep` prop, no weekly branch, `forecastMedication(med, { plan: settings, today })` and `dispenserView(med, fc, today)`. A check of every file in `app`, `lib`, `components`, `scripts` and `tests` that names a symbol R1 removes found that this was the only file missing from the R1 list. |
| Z3–Z7 | Not applied in Stage 8. Resolved later by the Stage 9 fixes (see `implementation_readiness_report.md`, Resolution). |

New split: FeatureRange 1–925, DetailedRange 926–1554.
