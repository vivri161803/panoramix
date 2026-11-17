# Stage 5: Initial Zoom Out Report

**Target:** `docs/2026-11-16_feature_categorie/categorie.md` (lines 1–1300)
**Reviewers:** `egm-zoom-out`, `egm-inventive-catalyst`. Each started with no conversation history.
**Background context given:** `concepts_brief.md`
**Split:** FeatureRange 1–719, DetailedRange 720–1300

## Verdict

No Blockers. 5 Major findings and 8 Nits remain after removing duplicates. Both reviewers found two of the same problems: the prefill units and the missing R1 `pg_dump`. Both reviewers accept the overall direction:
- the categories come from AIFA,
- the weekly mode is removed rather than given a third rule,
- `reorder_days` becomes `days_per_pack` instead of a new `count_mode` column,
- R1 and R2 ship separately.

Most Majors come from one root cause. In level mode, `days_per_pack` does three jobs at once: it flags the mode, sets the consumption rate, and sets the unit of `stock_qty`. Findings M2, M3 and N1 all follow from this.

---

## 🟡 Major

### M1. Prefill «quanti giorni dura» = volume ÷ dose mixes units *(both reviewers)*
- **Lines:** 144–145 (CUJ 1), 397–402, 466–467, 492–495, 1061, 1229–1230
- **Problem:** `floor(volume / dose giornaliera)` is only right when the pack and the dose use the same unit. That holds for liquido (ml/ml) and inalatore (erogazioni/erogazioni).
  - **Gocce:** the pack is in ML and the dose is in gocce. For a 10 ML collirio at 1 goccia × 2, the form proposes 5 days when the real answer is weeks.
  - **Crema:** the pack is in G and the dose is in applicazioni.
  - **Monodose:** for «20 CONTENITORI MONODOSE DA 0,3 ML», the parser reads 0.3 ml as the volume.

  The field keeps updating until the user touches it, so a wrong value is likely to be accepted. CUJ 1 tests only the safe case.
- **Fix options:**
  - (a) Cut the prefill entirely. Remove `packVolumeFromDescription` and `AicLookup.pack_volume`, and leave the field empty in CUJ 1. The brief already accepts that the user types this value.
  - (b) Keep it, but prefill only when the parsed unit matches the category's dose unit. Add a `prefillUnit` column to the R2.3 table: liquido → ml, inalatore → erogazioni, all others → none. Drop the G parsing. Add tests that gocce and crema get no prefill.

### M2. Switching mode reinterprets `stock_qty` in a different unit
- **Lines:** 488–489, 1148–1150 (item 50), 111–112, 615–622 (Alt. F)
- **Problem:**
  - At level, `stock_qty` counts containers. In pieces mode, it counts pieces. Saving a mode switch «senza toccare `stock_qty`» turns 0.967 flaconi into 0.967 monodose, and 30 monodose into 30 flaconi.
  - `updateMedication` (`lib/actions/medications.ts:96–100`) rebases the stock under the old mode before it saves, so the old-unit fraction is what gets carried over.
  - `stock_events` then mixes units for the same medicine. That is the reason the document gives for rejecting Alternative I (line 648), so the design accepts here the flaw it rejects there.
- **Fix:** Treat a mode switch as a recount. When `isLevel` changes in a save, require a new quantity in the new unit, record it as a `count` event with `meta.mode_change`, and never carry `stock_qty` across. Mode can still be derived from `days_per_pack`; only the transition needs a guard, such as a zod refine.

### M3. The edit form cannot round-trip a fractional level stock
- **Lines:** 377–387, 1136–1144 (item 49), 1146–1151 (item 50)
- **Problem:**
  - The edit page fills `stock_qty` with `forecast.stock` (`app/(app)/piani/[id]/medicinali/[medId]/page.tsx:52`). The input has `step={0.5}` (`components/MedicationForm.tsx:336`), and zod checks `halfStep` (`lib/schemas.ts:67`).
  - A level value such as 0.9666 either fails validation or gets snapped to 1 or 0.5. A snapped value makes `updateMedication` record a false `count` event, which silently resets the stock.
  - The rebase at line 100 also skips `roundStock`.
  - The document's own fix for dose changes («si aggiorna a mano quanti giorni dura») goes through this form.
- **Fix:** For level medicines, show the stock read-only through `levelPhrase`, with a «Riconta» link to the closed-plus-open widget. Send `stock_qty` only on an explicit recount. Pass every stock that `updateMedication` writes, including the rebase, through `roundStock`. Add an e2e test: edit `days_per_pack` on a level medicine and check that no `count` event appears.

### M4. Level consumption ignores the schedule, not only the dose
- **Lines:** 357–360, 384–387
- **Problem:** Level consumption is `1 / daysPerPack` on every calendar day. `Schedule` also supports `weekdays`, `every_n_days` and `cycle` (`lib/forecast.ts:121/159/210`). A cream used on Mon/Wed/Fri, or a cyclic product in its week off, loses stock on days it is not used. Updating «quanti giorni dura» by hand cannot fix a cycle, because a cycle alternates.
- **Fix:** Consume `dosesOn(med, day) > 0 ? 1 / daysPerPack : 0`, and relabel the field «Quanti giorni di uso dura un {contenitore}?». Daily schedules don't change, so Goal 2 still holds. Suspensions and days off stop consuming. The R2 verification should check whether any migrated bottle has a schedule that isn't daily.

### M5. Removing `calendarWeekStart` breaks the printed sheet for pillbox users
- **Lines:** 243–250, 781–787 (item 4), 963–967 (item 28)
- **Problem:** Today `calendarWeekStart` is one line (`lib/forecast.ts:512–513`). It starts the calendar week and the A4 sheet on the prep day, and that sheet is what people use to fill the pillbox. The design keeps the pillbox reminder but moves every week to Monday. The reason given, «il promemoria del sabato sera elenca già le dosi dalla domenica», doesn't help someone filling a pillbox that runs Sunday to Saturday from a sheet that runs Monday to Sunday.
- **Fix:** Keep the function and change only its condition: `plan.prepReminder ? plan.prepWeekday : 1`. Drop items 4 and 28 and the «piccolo cambio visibile» paragraph. Update the test at `tests/forecast.test.ts:334–335` instead of deleting it.
- **Note:** The inventive-catalyst reviewer treated Monday weeks as a settled constraint and did not raise this. Decide whether that trade-off is intended.

---

## 🟢 Nit

| # | Lines | Finding | Fix |
|---|---|---|---|
| N1 | 95, 343–346, 377–383, 1076–1079 | Storing level stock as fractional containers needs `numeric(10,3)`, `roundStock` and a tolerance. Each rebase can add up to 0.0005 of drift. | Optional: store level stock in whole days (`containers × days_per_pack`) with one `unitsPerContainer(med)` helper. If you keep the current model, add a test that saves many times and checks for drift. |
| N2 | 117–118, 560–561, 706–709, 1286 | Both reviewers: the rollback assumes a `pg_dump` exists before R1, but the plan requires one only before R2. | Write «prima di ciascun rilascio» in the NFR. Add the dump as step 0 of each release in «Ordine di rilascio». |
| N3 | 518–519, 1155–1158 (item 51) | `finishPack` duplicates `takeAsNeeded(planId, medId, 1)` (`lib/actions/stock.ts:151–180`), which already validates, clamps and supports undo. | Call `takeAsNeeded` with qty 1. Pick the toast wording with `containerWord`. |
| N4 | 341, 518–519 | As-needed medicines are never `isLevel`, so «Finita una confezione» needs a second, unnamed predicate. | State that the button depends on `defaultMode(category) === "livello"`, and test it. |
| N5 | 377–383, 430–434, 736–740, 555–556, 1123–1127 | The Technical Plan goes down to code level: tolerance constants, rounding bands, the isodow formula, and a comment-only item 47. | Keep the rule in the Technical Plan and move the constants to the tests. Drop item 47. |
| N6 | 372–376, 440 | In level mode `pills_per_pack` means "containers per box", but its name and contracts still say pills. | Add one sentence to R2.1 and to the README contracts (items 35 and 67). |
| N7 | 87–90, 446–458 | Goal 2's title («Nessun cambiamento») contradicts its body, and R2.4 has to re-read it. | Rename it «Stessa data di esaurimento per i medicinali già in uso». Drop the paragraph that re-reads it. |
| N8 | 1280–1281; 1214→1222 | The `\bform\b` grep matches `<form>` and `MedicationForm`. The numbering skips item 61. | Grep for the specific old identifiers. Renumber the items, or say what item 61 was. |

---

## Reuse checks that came back clean
- The design reuses `isoWeekday`, `onOrBeforeWeekday` and `dosesBetween` correctly.
- Extending `components/ui/Presidio.tsx` is better than writing a new component.
- `lib/categories.ts` replaces `lib/presidi.ts` with a one-to-one API mapping.
- `categoryFromForm` is new code that is needed; nothing in the codebase already does this.

---

## Resolution (applied to categorie.md on 2026-11-16)

The rule for every fix was to take the simplest option that removes the problem.

| # | Resolution |
|---|---|
| M1 | Cut the prefill (option a). `packVolumeFromDescription` and `pack_volume` are gone, and the days field starts empty. The Non-Goals and Alt. G say why. |
| M2 | A mode switch on a saved medicine requires the stock in the new mode and records it as a `count`. The stock is never carried from one unit to the other. |
| M3 | For a level medicine, the edit form shows the stock read-only (`levelPhrase` plus «Riconta») and sends no `stock_qty`. The rebase in `updateMedication` goes through `roundStock`. Action tests cover this. |
| M4 | `consumptionOn` at level is `1 / daysPerPack` only on days where `dosesOn > 0`. The label is now «Quanti giorni di uso dura». R2.4 and the Verification Plan list the bottles that aren't on a daily schedule. |
| M5 | `calendarWeekStart` stays, with `prepReminder ? prepWeekday : 1`. The old items 4 and 28 are removed, and the test is kept. |
| N1 | Kept fractional containers. Added a drift test to the `tests/forecast.test.ts` item. |
| N2 | A `pg_dump` is taken before each release (R1.4, Ordine di rilascio, NFR). |
| N3 | Uses `takeAsNeeded(…, 1)`. `finishPack` is removed. |
| N4 | The button depends on `defaultMode(category) === "livello"`. Covered by an e2e case. |
| N5 | Rounding constants moved to items 38/40 and the tests. `levelPhrase` bands moved to `lib/categories.ts`. The «punto 6 / punto 9» note and the `lib/pills.ts` item are removed. |
| N6 | `pills_per_pack` meaning stated in R2.1 and in the README item. |
| N7 | Goal 2 renamed «Stessa data di esaurimento…». The paragraph in R2.4 that re-read it is removed. |
| N8 | The grep lists the exact old identifiers. Items are renumbered 1–63. |
