# Stage 6: Comprehension Test Report

**Target:** `docs/2026-11-16_feature_categorie/categorie.md`, FeatureRange 1–739, DetailedRange 740–1342
**Reviewer:** `egm-comprehension`. It started with no conversation history, had no background files and applied no document standard.
**Result:** 0 Blockers, 5 Major findings, 8 Nits. The reviewer could restate both releases without gaps in the reasoning. The document is not self-contained in four places, all of which depend on the brief or on earlier reviews that the document doesn't include.

## What this proposes

The document plans two separate releases for Appoteca, an app that tracks how long each medicine supply lasts and when to reorder.

- **Release 1 (R1)** removes the "weekly" stock mode. In that mode, stock dropped only when the user confirmed they had filled the pillbox ("portapillole"). After R1:
  - stock drops every day in every plan;
  - the pillbox becomes only an email reminder that lists the next 7 days of doses;
  - a migration moves `stock_as_of` forward for weekly plans, so pills already in the pillbox are not subtracted twice;
  - the migration turns the reminder on only for plans that were weekly, and drops `prep_runs` and three RPCs.
- **Release 2 (R2)** replaces the hand-made `form`/`shape` classification with 10 categories: pillola, bustina, liquido, iniezione, gocce, inalatore, cerotto, crema, supposta and altro. When a box is scanned, the category comes from its AIFA pharmaceutical form. Each category has an icon, words for its container and dose, and a default counting mode.
- **Counting modes.** A medicine with `days_per_pack` is counted "a livello" (by level); any other medicine is counted "a pezzi" (by piece). By level, stock is a fractional number of containers and drops by `1/days_per_pack` on each day with a dose. One function, `consumptionOn`, gives the daily consumption for both modes, so bottles, creams and inhalers get the same reorder alerts as tablets.

## How the existing system works, per this document

Each plan (apparently one person's set of medicines plus settings) is either daily or weekly. In daily plans, stock drops by the scheduled doses each day. In weekly plans, stock drops only when the user presses "Portapillole preparato". That press is recorded in `prep_runs` through the `apply_prep`/`undo_prep` RPCs, and `lib/forecast.ts` holds a second set of rules for it.

Each medicine has one of four hand-picked `form` values and one of eight `shape` values. Eye-drop bottles are a special case: their stock never drops, and a single reorder reminder fires on `stock_as_of + reorder_days`. The schema caps doses at 0–20 and allows stock only in steps of 0.5. That can't hold insulin units, millilitres or fractions of a bottle. The app already imports the AIFA list of medicines and looks boxes up by their AIC code.

---

## Findings

### 🟡 Major

**C1. The migration mapping depends on a table that is only in the brief.**
- **Lines:** 70–72, 558, 611–612, 707–708, 1038–1040
- **Problem:**
  - The document says the migration covers «tutte le 11 coppie (form, shape)» and uses «un `CASE` su (form, shape), secondo la tabella del brief».
  - It never lists the 11 pairs or today's 8 `shape` values. The only mapping shown, at line 1039, uses `form` alone.
  - So a reader can't see how `shape` changes the result. For example, does a monodose eye drop become gocce a pezzi? What happens to a `cerotto` with `shape = 'bustina'`?
  - As a result, Goal 1 can't be checked from this document.
- **Fix:** Put the 11-row table inline in R2.9 or in the migration item: (form, shape) → (category, shape, days_per_pack). List the 8 current `shape` values in the Overview.

**C2. The AIFA classification rules are not in the document.**
- **Lines:** 476–479, 675, 1070–1071
- **Problem:** `categoryFromForm` checks «la lista di eccezioni del brief e poi le parole chiave a parola intera, in ordine». Neither list appears, and neither does their order. Alternative J refers to «l'ordine della richiesta», but «richiesta» is never introduced. This logic is the core of R2.5, and a reader can't review it.
- **Fix:** Add the ordered keyword → category list and the exception list to R2.5.

**C3. The «criterio N» references don't match the numbered Goals.**
- **Lines:** 993, 1015, 1056, 1254, 1265, 1296, 1318, 1333
- **Problem:** The plan cites «criterio 1…6», but the document has Goals 1–7, and the numbers don't line up:
  - «criterio 3» matches Goal 2;
  - «criterio 4» matches Goal 3;
  - «criterio 5» matches Goal 4;
  - «criterio 6» matches Goal 5;
  - «criteri 2 e 3» (line 1333) is Goal 2 alone.
- **Fix:** Rewrite the references as «Goal N».

**C4. Goal 4 points to cases the document never lists.**
- **Lines:** 56, 95–96, 649–652, 677, 709–710
- **Problem:** Goal 4 asks for tests on «tutti i casi trovati nelle due revisioni», and several decisions cite the first, second or third review. Those reviews are neither linked nor summarised. Alternative J speaks of «almeno dieci classi di errori» but names only two.
- **Fix:** List the cases inline, ideally as the fixture list of the `tests/categories.test.ts` item, or link the review records.

**C5. Core project terms are never defined.**
- **Lines:** 15, 28, 79–80, 148, 519–520, 605–608
- **Problem:**
  - **Dispenser:** the main view for each medicine (a tube on a 0–60-day scale). It is used from the Overview on and never described.
  - **Presidio:** means both the old non-tablet shapes and the icon component.
  - **Progetto grafico / design:** «tab 10, pagina Presidi, sezioni 07–10» and «tabella ALIAS del design» are cited without a link.
  - **Piano:** the central entity, never defined.
- **Fix:** Add a short glossary after the Overview and link the design file.

### 🟢 Nit

| # | Lines | Finding | Fix |
|---|---|---|---|
| C6 | 52–53, 164–168, 309–322 | The weekly stock rule is only implied: the saved stock leaves out the pills already in the pillbox. Moving `stock_as_of` only makes sense with that rule in mind. | Add one sentence to The Problem or R1.4. |
| C7 | 184–186 vs 447–472 | CUJ 5 says «data di riordino», but R2.4 says the run-out date stays the same and the alert days change. | Write «data di esaurimento» in CUJ 5, and say that alerts may arrive earlier. |
| C8 | 441 vs 1068 | `levelPhrase` has two signatures: `(stock, med)` and `(stock, coverageDays, m)`. | Use one signature in both places. |
| C9 | 536–540, 1280–1281 | «Finita una confezione» removes one container, not one box. The two match only when `pills_per_pack = 1`. | Build the label with `containerWord` («Finito un flacone»), or say this explicitly. |
| C10 | 42, 62, 121, 142–143 | AIFA, AIC, ATC and UI are never expanded. | Expand each on first use. |
| C11 | 471–472 | «Cambi di comportamento da sapere» points to a section of the brief that the document doesn't include. | Quote the accepted changes inline. |
| C12 | 165, 287, 304 | Cron times are given as UTC in one place and with no time zone in others («sabato alle 17:00»). | Give the time zone every time. |
| C13 | 403–414, 349, 579 | The R2.3 table has no legend: «genere» is grammatical gender, and «passo» is the dose step in the form, which looks like it clashes with the 0.5 step in the database. Line 579 doesn't say how the one-line notice reaches users. | Add a legend under the table, and say whether the notice goes by email or in the app. |

---

## Resolution (applied to categorie.md on 2026-11-16)

The rule for every fix was to take the simplest option that removes the problem.

| # | Resolution |
|---|---|
| C1 | The 11-pair (form, shape) → (category, shape, mode) table is now inline in R2.9 step 2, and the migration item points to it. The Overview lists every current `shape` value. |
| C2 | R2.5 now holds the ordered table: exceptions e1–e7 from the brief, then keywords k1–k9. **The keyword list is new**: the brief cites «le parole chiave della richiesta» but doesn't include them, so the author should check k1–k9. The categories test covers each row. |
| C3 | Every «criterio N» is now «Goal N» (1→1, 2/3→2, 4→3, 5→4, 6→5). |
| C4 | Goal 4 and Alt. J now point to exceptions e1–e7 as the review-found cases. The test item lists the cases. |
| C5 | Added a glossary after the Overview: Piano, Dispenser, Presidio, Progetto grafico (`design/Presidi.dc.html`, `design/Presidio.dc.html`), AIC, Brief. Alt. C says what the ALIAS table is. |
| C6 | R1.4 states that in weekly mode the pills in the pillbox are already subtracted. |
| C7 | CUJ 5 says «data di esaurimento» and mentions that threshold alerts may arrive earlier. |
| C8 | One signature everywhere: `levelPhrase(stock, coverageDays, med)`. |
| C9 | The label is «Finito un {contenitore}» («Finito un flacone»). The text says it removes one container. |
| C10 | AIFA, AIC, ATC and UI are expanded on first use. |
| C11 | R2.4 no longer points to a brief section; it gives the reason inline. |
| C12 | Every cron time says UTC. |
| C13 | Added a legend for «genere» and «passo» under the R2.3 table. The R1 notice is an email the author writes by hand (new decision). |
