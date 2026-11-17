# Goldfish Annotated Review Report: Stage 9 (Implementation Readiness)

**Status: resolved** (2026-11-16). The author chose option (a) for E1–E4 and accepted every PROPOSE FIX. The design files in `design/` were replaced with the export the author gave.

**Target:** `categorie.md` (DetailedRange 926–1554)
**Findings:** [implementation_readiness_report.md](./implementation_readiness_report.md), round 1 (7 Blocker, 13 Major, 12 Nit)
**Rule for every fix:** the simplest option that removes the problem.
**Design source given by the author:** the Claude Design project «Interfaccia Panoramix confermata» (claude.ai artifact `NSEwJHneHc9P4CNh3kiuXL`), page `Presidi.dc.html` sections 07–10 and component `Presidio.dc.html`.

Summary: **4 ESCALATE** (author decisions), **all other Blockers, Majors and Nits PROPOSE FIX**, **0 CONTEST**.

---

## What the design settles

The repository's `design/Presidi.dc.html` and `design/Presidio.dc.html` are an older export. The design the author gave has:

- `Presidio.dc.html`: `SHAPES` with the 10 categories (`w, h, rot, stock, len, step`), the drawing of each (`parts`), the icon view and the tube view (`view: 'icona' | 'tubo'`, `days`, `scaleMax`, `stock: 'auto' | 'pezzi' | 'livello'`), and an `ALIAS` table for the old shape names.
- `Presidi.dc.html` section 10 «Glifi e parole»: the 10 line glyphs (24×24 viewBox, stroke 1.8, `currentColor`), the 5×2 selector with `aria-pressed`, and a table of words and AIFA keywords per category.

This resolves **B6** (see [6]) and gives a keyword list for R2.5 (see E4).

---

## ESCALATE: author decisions

### [E1] B5: how the two migrations are tested
- **(a) Manual only** *(recommended)*: correctness is checked by the «Prova della migrazione sui dati veri» on the production dump, with the expected values written in the Verification Plan; R1.4 stops promising `tests/db` cases. No new harness for an alpha app.
- (b) A SQL test script per migration (reset to the previous migration, insert fixtures, apply, assert), with a path and a command.

### [E2] M4: actions during the already-prepared week
- **(a) Base actions on `max(today, stock_as_of)`** *(recommended)*: one helper in `lib/actions/stock.ts` and `lib/actions/medications.ts`; otherwise a recount in that week counts the pillbox doses twice and the stock stays wrong until the next recount.
- (b) Accept it and list it in the risks table.

### [E3] M13 and Stage 8 Z3: how fractional stock is stored
- **(a) Plain `numeric` (no scale, still `>= 0`)** *(recommended)*: no `roundStock`, no `STOCK_TOL`, no drift test; display rounding stays in `formatQty`/`levelPhrase`. Removes M13 and Z3 together.
- (b) Keep `numeric(10,3)` and `roundStock`; say «un singolo arrotondamento» and let the drift test allow one day of difference.

### [E4] The AIFA keyword list (R2.5 k1–k9)
- `review_status.md` says k1–k9 were written by the agent because the brief did not contain the request's list. The design's table has one:
  pillola COMPRESS · CAPSUL · PASTIGL · CONFETT; bustina BUSTIN · GRANULAT · POLVERE ORALE; liquido SCIROPPO · SOLUZIONE ORALE · SOSPENSIONE ORALE · GOCCE ORALI; iniezione INIETT · INFUS · SIRINGA · PENNA · FIALA; gocce COLLIRIO · OFTALM · AURICOL · NASAL; inalatore INALAZ · NEBULIZZ · AEROSOL; cerotto CEROTT · TRANSDERM; crema CREMA · POMATA · UNGUENTO · GEL · SCHIUMA; supposta SUPPOST · OVUL · RETTAL · VAGINAL; altro: no match.
- **(a) Use the design's list** *(recommended)*, in the design's order, matched at the **start of a word** (`\bCOMPRESS`), after the exceptions e1–e7. The exceptions still win: e7 sends GOCCE ORALI to gocce (brief) although the design lists it under liquido; e5 sends non-solid vaginal/rectal forms to crema. The `altro` word becomes «unità» as in the design.
- (b) Keep k1–k9 as written.

---

## PROPOSE FIX: Blocker

| # | Finding | Proposed edit |
|---|---|---|
| [1] | B1 new plans start with the reminder on | Item 26: `prep_reminder: false` in `nuovo/page.tsx`. Item 20: fallback `?? false`. Item 31 or 32: a plan created from the form has `prep_reminder = false`. Item 33: update `app/(app)/piani/nuovo/README.md`. |
| [2] | B2 word functions without `frequencyType` | Item 36: `m` is `{ category, daysPerPack, frequencyType }`; word mode = `frequencyType === 'as_needed' ? defaultMode(category) : (isLevel(m) ? 'livello' : 'pezzi')`. |
| [3] | B3 files missing from R1 and R2 | R1: item 20 removes `PlanFormMed`, `meds`, `counts`, the `Pill` import and the recount block, shows the reminder switch always, and replaces the copy at lines 199 and 237; item 13 removes `planSchema.counts`; item 14 removes the mode-change branch; item 26 stops passing `meds`; item 12 becomes `lib/usage.ts` + `lib/usage-stats.ts` (remove `preps`). R2: new items for `app/(app)/piani/page.tsx` (`Presidio` with `category`/`pillShape`), `lib/pills.ts` (`pillLook` takes `shape: string \| null`), `components/DoseChangesPanel.tsx` (limit 999, `doseStep`/`doseWord`), `tests/e2e/aifa.spec.ts` (new labels) and `tests/e2e/sharing.spec.ts` (choose a category first). |
| [4] | B4 e2e depends on the seed | Item 62 creates its own user, plan and 10 medicines with `admin()` in `beforeAll` (as `sharing.spec.ts`), with the rows listed, including an as-needed syrup and an as-needed tablet. The email check moves to `tests/alert-template.test.ts`. Item 35 drops «per i test e2e». |
| [5] | B5 migration tests | Per E1. |
| [6] | B6 design files lack the 10 glyphs | Replace `design/Presidi.dc.html` and `design/Presidio.dc.html` with the export the author gave (done before the edits). Item 51: `PRESIDIO_GEO` keyed by category from `Presidio.dc.html` `SHAPES`/`parts`; `view: "icon" \| "tube"` and `days` follow the design's `view`/`days`/`scaleMax`; the level tube is a filled band, the pieces tube stacks icons; `FormGlyph` becomes `CategoryGlyph({ category, size })` with the 10 line glyphs of section 10; iniezione at level uses the iniezione geometry with the word «penna». |
| [7] | B7 statements about code that is not there | Rewrite items 7 and 12 (preparations are read in `runDailyAlerts`, `alerts.ts:89, 99–104`; `buildPlanEmail` only drops `nextPrep`; usage email has no preparations row). Delete the false claims in items 2, 4, 35 and 45. |

## PROPOSE FIX: Major

| # | Finding | Proposed edit |
|---|---|---|
| [8] | M1 level stock input | `levelQtySchema = { closed: int ≥ 0, open: 0 \| 0.1 \| 0.5 \| 1 }`; `recountStock` uses it when `isLevel(med)`; arrivals stay an integer ≥ 1 of boxes; the create form for level asks closed + open, default `closed = 0, open = 1`. Item 46 lists the four values. |
| [9] | M2 mode change | The check moves to `updateMedication` (compares `isLevel(saved)` with the input, returns a field error); on a mode change the form asks `pills_per_pack` again (level default 1); the `count` event has `delta = qty_after`, `meta.reason = 'mode_change'`. |
| [10] | M3 SQL for X | One `with weekly_start as (…) update …` statement; runs filtered by `week_start + 6 >= mode_since`; X = first `prep_weekday` after the last `week_start` (same formula as the no-run case); `extract(isodow from …)::int`; full `alter table public.plans`. Add the weekly → daily → weekly case to the dry run. |
| [11] | M4 | Per E2. |
| [12] | M5 `levelPhrase` | Ordered cases (≤ 0 «finito»; < 1 «meno di un/una»; remainder in [0.25, 0.75) «e mezzo/a», 1 written «un/una»; otherwise round), null coverage shows only the quantity; expected strings for 0, 0.25, 0.5, 0.75, 0.967, 1.5, 2, 2.9 in item 58; reuse `formatQty`'s half rounding. |
| [13] | M6 dose limit 999 | `doseSchema`, `doseChangeSchema`, `MedicationForm.tsx:448`, `DoseChangesPanel.tsx:127` all go to 999; a numeric input next to the ± buttons. |
| [14] | M7 `prepReminder` flow and weekly leftovers | Item 24 passes `prepReminder={b.settings.prepReminder}` to `DispenserGrid`, removes `weekly`, the weekly first cell and the old `dispenserView` call; item 22 makes the prop optional (default `false`); item 25 removes the mode label. |
| [15] | M8 reminder email copy | New intro without «Portapillole preparato»; no total and no «Da mettere» sum; `ReminderItem` loses `missing` and `need`. |
| [16] | M9 `MEDICATION_COLUMNS` | Item 45: `category, shape, days_per_pack` instead of `form, shape, reorder_days`. |
| [17] | M10 level stock in emails, pharmacy, history | Level medicines use `levelPhrase` and `containerWord`; `SummaryMed` and `AlertEmailMed` gain `category` and `daysPerPack`; history page uses `containerWord`. |
| [18] | M11 Goal 1 grep | Exclude `pack\.form`; add `tests scripts supabase/seed.sql` to the paths. |
| [19] | M12 initial values | Item 57: `category: null` (form state only), `shape: null`, `days_per_pack: null`. |
| [20] | M13 | Per E3. |

## PROPOSE FIX: Nit

All 12 Nits (N1–N12 in the findings report) are applied as written there.
