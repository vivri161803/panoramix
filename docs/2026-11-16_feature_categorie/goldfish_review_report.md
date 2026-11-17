# Goldfish Annotated Review Report: Stage 7 (Critic Review)

**Status: resolved** (2026-11-16). The author accepted every PROPOSE FIX and chose option (a) for E1, E2 and E3. All edits are applied to `categorie.md`; the two DECLINE items are recorded only.

**Target:** `categorie.md` (FeatureRange 1–827)
**Findings:** [critic_report.md](./critic_report.md), round 1 (15 Major, 14 Nit)
**Rule for every fix:** the simplest option that removes the problem.

Summary of suggestions: **3 ESCALATE** (need a decision from the author), **24 PROPOSE FIX**, **2 DECLINE**, **0 CONTEST**.

Evidence checked outside the document:
- `supabase/migrations/20261115000100_reorder_days.sql:10–11` already has `check ((shape = 'flacone') = (reorder_days is not null))`, so no non-flacone row can have `reorder_days` (D7).
- `supabase/migrations/*.sql` has no views. The only 0.5-step checks are `mod(x * 2, 1) = 0` on `stock_qty` and the three doses (`20261108000100_schema.sql:82–94`, `20261109000200_features.sql:60–62`). The RPC parameters (`p_qty_after numeric`) do not round (D9).
- The «terza revisione» in Alt. G is Stage 5 of this EGM review: `zoom_out_report.md` M1 (prefill cut) and M4 (usage days), both applied with the author's approval (S2, D3).

---

## ESCALATE: decisions only the author can make

### [E1] D3: usage days instead of calendar days (`egm-design`), Major
*   **Scope:** lines 96–100, 422–428, 563–565
*   **Problem:** the brief chose calendar days; Stage 5 (M4) switched to usage days so that pauses, cycles and days off stop consuming. The reviewer's risk is that a user who thinks «un tubo mi dura un mese» types 30 for a cream used 3 times a week, so alerts arrive weeks late.
*   ***AI Suggestion:*** ESCALATE. The trade-off is real either way, and you already chose usage days in Stage 5.
*   ***Options:***
    *   **(a) Keep usage days and only record the change** in «Differenze rispetto al brief» (S2) and in the risks table (S1). The label already says «giorni di uso». *(recommended: no new code)*
    *   (b) Keep usage days and, when the schedule is not daily, show the calendar equivalent under the field («≈ 70 giorni di calendario»). One line in R2.6 and one function.
    *   (c) Go back to calendar days, as in the brief. Then R2.2, R2.4 (non-daily flaconi) and the Stage 5 M4 resolution must be reverted.

### [E2] D4: wrong default mode for insulin pens and single-dose eye drops (`egm-design`), Major
*   **Scope:** lines 84–85, 439, 458–466, 548–551, 560–567
*   **Problem:** a scanned pen («SOLUZIONE INIETTABILE IN PENNA PRERIEMPITA») defaults to pezzi, so a dose of 40 units removes 40 pens a day. «COLLIRIO … CONTENITORE MONODOSE» defaults to level.
*   ***AI Suggestion:*** ESCALATE. The brief says «La funzione decide solo la categoria. Il modo viene dal default della categoria», so changing it reverses a brief decision.
*   ***Options:***
    *   **(a) `categoryFromAifa` also returns a mode hint:** PENNA or MULTIDOSE → livello; MONODOSE → pezzi; otherwise the category default. Three keywords, tested with the 20 real forms. Recorded in «Differenze rispetto al brief». *(recommended)*
    *   (b) Keep the brief's rule, and add a warning in the form when a pezzi dose is greater than `pills_per_pack`.
    *   (c) Accept the risk and list it in the risks table only.

### [E3] D8: flaconi in plans with every alert off go silent after R2 (`egm-design`), Major
*   **Scope:** lines 497–508, 658–668
*   **Problem:** today a flacone reminds even with the plan's alerts off; after R2 it sends nothing, and nobody is told.
*   ***AI Suggestion:*** ESCALATE: this decides whether the migration may change a user's settings.
*   ***Options:***
    *   **(a) The R2 dry run lists those plans, and the author writes to their owners by hand**, as R1 already does for weekly users. *(recommended: no setting changes)*
    *   (b) The migration turns on `alert_under_7` for plans with all alerts off and at least one flacone.
    *   (c) Accept it (alpha) and list it in the risks table only.

---

## PROPOSE FIX: Major

### [1] D1: the R1 shift of `stock_as_of` delays the flacone reminder (`egm-design`)
*   **Scope:** line 348 (R1.4 step 2), line 363
*   ***Justification:*** confirmed in the text; for a flacone `stock_as_of` is the reminder anchor.
*   ***Proposed Edit:***
    *   Line 348: «Poi, per i medicinali di quel piano che non sono flaconi (`reorder_days is null`), `stock_as_of = greatest(stock_as_of, X)`. Il flacone non scende in R1 e il suo `stock_as_of` è il giorno da cui conta il promemoria, quindi non si sposta.»
    *   Line 363: «…i quattro casi: preparazione attiva, nessuna preparazione, riconteggio dopo X, flacone (non spostato).»

### [2] D2: the R1 migration turns the reminder on for weekly plans that had it off (`egm-design`)
*   **Scope:** lines 354, 277–279
*   ***Proposed Edit:***
    *   Line 354: `update plans set prep_reminder = (prep_reminder and stock_mode = 'weekly')`.
    *   Lines 277–279: «La migrazione lascia il promemoria acceso solo sui piani settimanali che lo avevano acceso (R1.4). Il primo giorno della settimana cambia solo per i piani settimanali che avevano il promemoria spento: il loro calendario comincia dal lunedì.»
    *   This change also goes in the risks table (S1) as a low-impact change.

### [3] D5: as-needed migrated flaconi get «monodose» and «Finito un monodose» (`egm-design`)
*   **Scope:** lines 458–463, 604–610
*   ***Proposed Edit:*** add a rule to R2.3: «Per un medicinale al bisogno le parole seguono `defaultMode(category)`, non il modo effettivo: un collirio in flacone al bisogno resta "flacone".» In R2.7, «Finito un {contenitore}» → «Finit{o|a} un{|a} {contenitore}», with gender from the table. Add «flacone di collirio al bisogno migrato» to the test cases. For liquido/crema switched to pezzi, add: «A pezzi liquido e crema dicono la dose con la parola del contenitore ("1 flacone"): è il caso di chi conta flaconi interi, ed è voluto.»

### [4] D6: the level recount cannot save zero (`egm-design`)
*   **Scope:** lines 602–603, 218
*   ***Proposed Edit:*** «Quello aperto: pieno, metà, quasi finito o nessuno (1, 0,5, 0,1 o 0)». The coarse steps go in the risks table (S1).

### [5] D7: guard on `reorder_days` (`egm-design`)
*   **Scope:** line 644
*   ***Justification:*** the constraint exists (see evidence), so the risk cannot happen, but the text says `if exists`, which suggests otherwise.
*   ***Proposed Edit:*** «`drop constraint medications_reorder_days_flacone` (oggi garantisce che solo i flaconi abbiano `reorder_days`, quindi dopo il rinomina solo gli ex flaconi sono a livello), poi `rename column reorder_days to days_per_pack`.»

### [6] D9: nobody has checked whether SQL rounds stock (`egm-design`)
*   **Scope:** R2.9 step 9 (lines 653–655)
*   ***Proposed Edit:*** add: «Nelle migrazioni non ci sono viste. Gli unici vincoli a passi di 0,5 sono `mod(x * 2, 1) = 0` su `stock_qty` e sulle tre dosi; quello su `stock_qty` si toglie, quelli sulle dosi restano con il nuovo limite. Le RPC rimaste prendono `p_qty_after numeric` senza arrotondare.»

### [7] S1: there is no Risks & Mitigations section (`egm-structural`, `egm-design`)
*   **Scope:** new H2 between «Alternatives Considered» and «Non-Functional Requirements»
*   ***Proposed Edit:*** `## Risks & Mitigations`, a table Rischio | Impatto | Mitigazione | Dove. Rows: earlier alerts and the «ultima confezione» email at the first cron (accepted, R2.4); flaconi silent with alerts off (E3); non-daily flaconi with a later date (dry run, R2.4); weekly plans with X far in the past (dry run, R1.4, from N6); usage-day misreading (E1); wrong default mode (E2); AIFA form not recognised (fallback `altro`, selector); coarse level recount (R2.7); old code reading dropped columns (deploy outside the cron times); rollback loses later writes (NFR, from N1); recount meaning changes for weekly users (manual email, Ordine di rilascio).

### [8] S2: a «terza revisione» reverses brief decisions with no record (`egm-structural`, `egm-style`, `egm-design`)
*   **Scope:** lines 55–56, 133–136, 736–739; new subsection under Overview
*   ***Proposed Edit:***
    *   Line 56: «…il documento di partenza, rivisto due volte. Questo design è poi passato dalle revisioni EGM in questa cartella (`zoom_out_report.md`, `comprehension_report.md`, `critic_report.md`).»
    *   New `### Differenze rispetto al brief`, one line per change with its source: usage days instead of calendar days (Stage 5 M4); no volume ÷ dose prefill (Stage 5 M1); «Finito un {contenitore}» instead of «Finita una confezione» (Stage 6 C9); two word exceptions for the non-default mode (Alt. O); plus E2(a) if chosen.
    *   Alt. G, line 736: «Nella revisione Zoom Out del design (fase 5, M1)…» instead of «Nella terza revisione».

### [9] S3: rejection reasons credit the author without a link (`egm-structural`, `egm-style`, `egm-design`)
*   **Scope:** lines 677–808
*   ***Proposed Edit:*** rename the field «Motivo dello scarto» to «Decisione». Each one starts with the trade-off and ends with its source: «([brief, Key Decisions](./concepts_brief.md#key-decisions--staging-for-next-steps))», «(brief, prima/seconda revisione)» or «(revisione EGM, fase N)». In N the trade-off moves from «Contro» into «Decisione». In O «emerso durante la stesura» goes away. L's heading becomes «L. … (rimandata)».

### [10] S4: the only diagram covers R2 alone (`egm-structural`, `egm-style`, `egm-design`)
*   **Scope:** lines 226–248
*   ***Proposed Edit:*** add a four-line R1 block above it (`cron 17:00 UTC ─► piani con prep_reminder e domani = prep_weekday ─► buildPrepReminderItems ─► email`; `tolti: apply_prep, undo_prep, change_stock_mode, prep_runs`). Line 241: «(R1 toglie il ramo settimanale; R2 introduce `consumptionOn`)».

### [11] W1: the «mai dopo» claims contradict the same section (`egm-style`)
*   **Scope:** lines 352–353, 506–508
*   ***Proposed Edit:*** line 353: «…gli avvisi arrivano prima del necessario.» Lines 506–508: «Per i flaconi con una dose ogni giorno gli avvisi arrivano quindi prima o lo stesso giorno di oggi. Fanno eccezione i flaconi con uno schema non giornaliero (data più avanti, vedi sopra) e i piani con gli avvisi spenti (nessun avviso). Il brief accetta gli avvisi anticipati e l'email "ultima confezione"; gli altri due casi sono nella tabella dei rischi.»

### [12] W2: «confezione» means both the box and one container (`egm-style`)
*   **Scope:** lines 218, 579, 602–603
*   ***Proposed Edit:*** keep «confezione» only for the box. Recount: «{Contenitori} chiusi» (intero ≥ 0) and «Quello aperto», with the word from `containerWord`. CUJ 6: «indica "Inalatori chiusi: 1" e "Quello aperto: metà"». Line 579: «oppure contenitori chiusi più quello aperto».

### [13] W3: the recount question differs between R1.2 and R2.7 (`egm-style`)
*   **Scope:** lines 192–193, 301–303, 600–601
*   ***Proposed Edit:*** R1.2 defines one question: «Quante ne hai in tutto?», plus «, comprese quelle nel portapillole» when the reminder is on. R2.7: «a pezzi: la domanda di R1.2, con "Quant{e|i} {contenitori}" accordato al genere (`howMany`)». CUJ 3 already matches.

### [14] W4: the rollback sentence promises an `assert` that R1 does not have (`egm-style`)
*   **Scope:** lines 814–815
*   ***Proposed Edit:*** «Ogni rilascio ha una sola migrazione in transazione: se un'istruzione fallisce (compreso l'`assert` di R2.9), non cambia niente.»

---

## PROPOSE FIX: Nit

| # | Proposed Edit |
|---|---|
| N1 | NFR, rollback: add «(si perdono le modifiche fatte dopo il dump, compreso `alert_log`: alcuni avvisi possono ripartire)». |
| N4 | R2.5: move e3 (POLVERE PER INALAZIONE) above e1 (GELATINOSA), and add «POLVERE PER INALAZIONE IN CAPSULA GELATINOSA» to the test forms. |
| N5 | R2.3: «`levelPhrase` accorda articolo e "mezzo/mezza" con il genere del contenitore ("una penna e mezza")». |
| N6 | Covered by the R1 dry run row in the risks table: the dry run lists weekly plans whose X is more than 7 days in the past. |
| N7 | Add `isLevel(med)` and `defaultMode(category)` to the exported functions list (R2.3). |
| N8 | Table: «ml / ml», «unità / unità». The injection exception keeps only «contenitore penna / penne». |
| N9 | Goal 2 heading: «Stessa data di esaurimento per flaconi a dose giornaliera e compresse nei piani giornalieri». Goal 4 and Alt. K: «almeno 20 forme AIFA reali». |
| N10 | Line 60 «Molti medicinali» → «Sciroppi, inalatori, creme, bustine e supposte»; line 64 → «non arrivano avvisi di riordino»; lines 81–82 → «Togliere la discesa settimanale elimina la seconda regola di discesa e il codice che la sostiene»; line 775 → «un errore si corregge dal selettore (e, se cambia il modo, con un riconteggio)». |
| N11 | `### Glossario` as a heading; «Soluzione proposta, in breve» moves to the end of Overview; the Overview list items get «(R1)» and «(R2)». |
| N12 | Line 494: `([Verification Plan](#verification-plan))`; line 212 «(accettato nel brief)»; lines 134–135 and 564 use «Per quanti giorni di uso dura un {contenitore}?». |
| N13 | Metadata key «Brief di partenza» → «Brief»; keep only the `---` rule before the Detailed Plan. |
| N14 | Re-wrap the long lines at about 80 columns; keep «app in alpha» in the Overview and in Alt. E and H only. |

## DECLINE

| # | Justification |
|---|---|
| N2 | Tolerance and drift: Stage 5 N1 already added a drift test (many saves in a row) to the `tests/forecast.test.ts` item. A per-day tolerance adds a rule without a known failure. |
| N3 | Flacone `stock_qty = 1` without an event: the old flacone stock never dropped (`lib/forecast.ts:252`, line 72), so its value carried no information to keep. |
