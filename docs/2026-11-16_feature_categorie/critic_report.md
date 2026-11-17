# Stage 7: Critic Review Report

**Target:** `docs/2026-11-16_feature_categorie/categorie.md`, FeatureRange 1–827 (`## Detailed Implementation Plan` is at line 828)
**Reviewers:** `egm-design` and `egm-structural` (standard `feature-spec-standard`), `egm-style` (no standard). Each started with no conversation history; the only background file was `concepts_brief.md`.
**Round:** 1. All three reviewers completed. None was recorded as not run.
**Raw totals:** design 0 / 10 / 8, structural 0 / 4 / 7, style 0 / 5 / 10 (Blocker / Major / Nit).
**After merging duplicates:** 0 Blockers, 15 Majors, 14 Nits.

The main context checked the two most serious findings (D1 and D2) against the text at lines 335–355; both are confirmed as written.

---

## 🟡 Major

### Migration and data behaviour

**D1. The R1 shift of `stock_as_of` also delays the eye-drop bottle reminder.** *(design M1, confirmed)*
- **Lines:** 335–353 (update at 348), 260–262, 483–489
- **Problem:** `stock_as_of = greatest(stock_as_of, X)` runs on every medicine in a weekly plan, flaconi included. For a flacone, `stock_as_of` is the anchor of its only reminder (`stock_as_of + reorder_days`), and R1 says the flacone stays as it is. Moving the anchor to X postpones the reminder by up to X − S days. That is a late alert, against the document's own «mai dopo» rule. R2.4 then carries the moved date forward as the «stessa data».
- **Fix:** add `and reorder_days is null` to the update (and consider excluding `as_needed`). Add a flacone case to the `tests/db` cases at line 363.

**D2. The R1 migration turns the reminder on for weekly plans that had it off.** *(design M2, confirmed)*
- **Lines:** 354–355; Goal 3 (115–117); CUJ 4 (197–201)
- **Problem:** `prep_reminder = (stock_mode = 'weekly')` sets it to true for every weekly plan, including those whose user had set it to false. Goal 3 says the reminder must not reach anyone who was not using it.
- **Fix:** `prep_reminder = (prep_reminder and stock_mode = 'weekly')`. Then check line 278 («no plan's calendar start day changes»): a weekly plan with the reminder off would now start its calendar on Monday.

**D3. Level mode counts usage days, not calendar days, which reverses a brief decision and can delay alerts.** *(design M3)*
- **Lines:** 96–100, 422–428, 491–495, 563–565
- **Problem:** the brief (line 48) chose calendar days on purpose, because that is how people estimate. The spec uses «giorni di uso» (days with a dose). A user with a cream used 3 times a week who answers «un tubo mi dura un mese» types 30; coverage stretches about 2.3×, and alerts arrive weeks late. The change has no alternative entry and no recorded confirmation (see S2).
- **Fix:** add an alternative «giorni di calendario vs giorni di uso» with the trade-off and the author's decision. Reduce the misreading: label the field «Per quanti giorni in cui lo usi dura un {contenitore}?», or, for non-daily schedules, show the calendar equivalent before saving («≈ 70 giorni di calendario»).

**D4. Default modes give wrong consumption for insulin pens and single-dose eye drops.** *(design M4)*
- **Lines:** 84–85, 439, 458–466, 560–567, 512–551
- **Problem:** The Problem section cites «40 UI di insulina», but `iniezione` defaults to pezzi, where one dose unit is one container. A scanned pen with dose 40 loses 40 pens a day, so coverage hits zero and alerts flood in. «COLLIRIO … CONTENITORE MONODOSE» has the opposite problem: it defaults to level.
- **Fix:** let `categoryFromAifa` also return a mode hint (PENNA / MULTIDOSE → livello, MONODOSE → pezzi) and test it. As a fallback, label the pezzi dose field with the container word and warn when the dose exceeds `pills_per_pack`.

**D5. Migrated as-needed eye-drop bottles get the «monodose» words.** *(design M5)*
- **Lines:** 458–463, 604–610, 646–648
- **Problem:** step 6 sets `days_per_pack = null` for as-needed flaconi, so they become gocce counted in pezzi, and R2.3 maps that to «monodose». They show «1 monodose rimasta» and, since `defaultMode(gocce) = livello`, the button «Finito un monodose» (wrong noun, wrong gender; «Finito un» is hard-coded masculine). The same happens with «Conta a pezzi» on liquido or crema («5 flaconi» per day).
- **Fix:** for as-needed medicines pick the words with `defaultMode(category)`, as the button does. Inflect «Finito/Finita un/una» by gender. Add a migrated as-needed flacone to the tests, and either list the liquido/crema pezzi case as an exception or say why it isn't needed.

**D6. The level recount cannot record zero or «only sealed containers».** *(design M6)*
- **Lines:** 599–603, 214–219
- **Problem:** the recount is closed containers plus an open one worth 1, 0.5 or 0.1. A user with nothing left can't save 0, and «2 closed, none open» needs a workaround. The three values are coarse, so a recount can move alerts either way.
- **Fix:** add a «nessuno aperto / finito» option worth 0, and note the coarse values among the risks (S1).

**D7. Non-flacone rows with `reorder_days` are not checked before the rename.** *(design M7)*
- **Lines:** 628–648 (644–645)
- **Problem:** `drop constraint if exists` admits the constraint might be missing. A non-flacone row with `reorder_days` would become level, and its 28 tablets would be read as 28 containers: silent over-coverage and late alerts.
- **Fix:** before the rename, `assert not exists (select 1 from medications where reorder_days is not null and shape <> 'flacone')`.

**D8. Flaconi in plans with all alerts off lose their only reminder without notice.** *(design M8)*
- **Lines:** 497–508, 210–212, 658–668
- **Problem:** today a flacone reminds even when the plan's alerts are off. After R2 it sends nothing and nobody is told. Communication is planned only for R1.
- **Fix:** add a query to the real-data dry run that lists those plans. Either email their owners in R2 or turn `alert_under_7` on for them in the migration.

**D9. Nobody has checked that SQL does not round stock again.** *(design M10)*
- **Lines:** 377–383, 417–421, 653–655
- **Problem:** the spec moves rounding to `roundStock` in TypeScript and widens the columns, but does not list the RPCs, triggers or views that read or write `stock_qty`, `delta` or `qty_after`. Any `::numeric(8,1)`, `round(x*2)/2` or 0.5-step check would round level stock back to 0.5 steps, and a dependent view would make `ALTER COLUMN TYPE` fail.
- **Fix:** record the result of a grep over `supabase/migrations` for those columns and casts. List each function or view to recreate in R2.9 step 9.

### Document structure and traceability

**S1. There is no Risks & Mitigations section.** *(structural 1, design M9)*
- **Lines:** whole range; risks are scattered at 88–90, 210–212, 491–508, 812–824, 131–151
- **Problem:** the standard requires failure modes, security, scale limits and their mitigations to be explicit. Today they are spread across R2.4, CUJ 5 and the NFR, and some are missing.
- **Fix:** add `## Rischi e mitigazioni` (between Alternatives and NFR, or as an H3 of NFR) as a table: Rischio | Impatto | Mitigazione | Riferimento. Minimum rows: earlier alerts and the «ultima confezione» email on the first cron; flaconi silent with alerts off (D8); non-daily flaconi with a later date; wrong X in weekly plans, including X far in the past (N6); usage-day misreading (D3) and wrong default mode (D4); AIFA misclassification falling back to `altro`; old code reading dropped columns during deploy; rollback cost and data loss (N1); recount semantics for former weekly users; coarse level recount (D6).

**S2. A «terza revisione» reverses brief decisions with no record.** *(structural 3, style M2, design M3 / N8)*
- **Lines:** 56, 133–136, 736–739, 806–808; related 96–99, 422–428
- **Problem:** line 56 says the brief was reviewed twice, but Alternative G cites a third review that is defined nowhere. That review drops the volume ÷ dose pre-fill, which the brief records as confirmed by the author (brief lines 52, 113, 233, 241). The consumption unit also changes (D3) with no note. «è caduta» doesn't say who decided. Alternative O starts with process narration («emerso durante la stesura»).
- **Fix:** add a short «Differenze rispetto al brief» subsection under Overview: for each reversed decision, the brief's decision, the new one, the reason, and who decided and when. Update line 56. In O, keep only the decision and its reason.

**S3. Rejection reasons credit the author or a review, with no link.** *(structural 2 and 9, style N8, design N7)*
- **Lines:** 677, 686, 697, 707, 717, 725, 736, 747, 756, 765, 774, 781, 788, 797–798, 806–808
- **Problem:** the standard forbids attributing a rejection to a maintainer without linking the discussion. Nearly every «Motivo dello scarto» begins «Scartata dall'autore» or «Scartata nella … revisione», which also repeats the field name. In N the real trade-off is in «Contro», not in the reason. O starts in lowercase. L is deferred, not rejected, but sits among the rejected ones.
- **Fix:** start each reason with the concrete trade-off, then link the source, for example «([brief, Key Decisions](./concepts_brief.md#key-decisions--staging-for-next-steps))». Rename the field to «Decisione:» or drop «Scartata». Mark L «(rimandata)» in its heading.

**S4. The only architecture diagram covers R2 alone and blurs the release boundary.** *(structural 4, style N10, design N8)*
- **Lines:** 226–248 (241)
- **Problem:** R1's flow (17:00 UTC cron → `prep_reminder` / `prep_weekday` → `buildPrepReminderItems`, and removal of the RPCs and `prep_runs`) has no diagram. The note «(un solo calcolo, RILASCIO 1 lo prepara)» next to `consumptionOn` suggests R1 delivers part of R2, which it doesn't.
- **Fix:** add a small R1 diagram, or label each box R1 or R2. Reword the note: «(R1 toglie il ramo settimanale; R2 introduce `consumptionOn`)».

### Wording that changes meaning

**W1. The «mai dopo» claims are contradicted in the same section.** *(style M1; see D1)*
- **Lines:** 353, 506–508
- **Problem:** line 506 says alerts arrive «prima o uguali, mai dopo, tranne quando gli avvisi del piano sono spenti». Lines 491–493 say non-daily flaconi get a later date, and alerts that are switched off never arrive, which is not «later». «prima o uguali» is ungrammatical.
- **Fix:** «Per i flaconi con una dose ogni giorno gli avvisi arrivano prima o lo stesso giorno di oggi. Fanno eccezione i flaconi con schema non giornaliero (data più avanti, vedi sopra) e i piani con gli avvisi spenti (nessun avviso).» At line 353, limit the claim to its case. After fixing D1, check that line 353 is still true.

**W2. «Confezione» means both the box and one container.** *(style M3)*
- **Lines:** 218, 579, 602–603, 619 (definition at 388)
- **Problem:** line 388 and line 619 use «confezione» for the box. The level recount («Confezioni chiuse» + «Quella aperta») and line 579 use it for a single container. The two match only when `pills_per_pack = 1`, so an implementer can't tell whether «Confezioni chiuse: 1» for a box of 2 inhalers means stock 1 or 2.
- **Fix:** reserve «confezione» for the box. In the recount use the container word built with `containerWord` («Flaconi chiusi» / «Quello aperto»).

**W3. The recount question differs between R1.2 and R2.7 and ignores gender.** *(style M4)*
- **Lines:** 300–303, 600–601; gender rule at 447–448
- **Problem:** R1.2 says «Quante ne conti adesso?», R2.7 says «Quante ne hai in tutto?». Both are hard-coded feminine, but cerotti need «Quanti». The e2e tests check these strings.
- **Fix:** state one template once, for example «Quant{e|i} {contenitori} hai in tutto?», add the pillbox phrase as a suffix, and have R2.7 refer to R1.2.

**W4. The rollback sentence promises an `assert` R1 doesn't have.** *(style M5)*
- **Lines:** 814–815
- **Problem:** «se un `assert` fallisce, non cambia niente» is said of every release, but only R2.9 has an `assert`. The guarantee comes from the transaction.
- **Fix:** «Ogni rilascio ha una sola migrazione in transazione: se un'istruzione fallisce (compreso l'`assert` di R2.9), non cambia niente.»

---

## 🟢 Nit

| # | Lines | Problem | Fix | Source |
|---|---|---|---|---|
| N1 | 814–819 | Restoring the `pg_dump` loses every write made after the migration; losing `alert_log` sends duplicate emails. | Say so. Limit rollback to the first hours, or export new `stock_events` and `alert_log` rows before restoring. | design N1, style N10 |
| N2 | 417–421 | «tollerano l'errore di arrotondamento» names no value. `STOCK_TOL = 0.0005` is per save; with `days_per_pack` up to 365 one day is 0.00274, so errors add up. | State the tolerance and where it applies. Consider basing it on half a day of consumption. | style N5, design N2 |
| N3 | 483–486, 646–648 | Setting flaconi to `stock_qty = 1` writes no `stock_events` row and breaks the `qty_after` chain in Storico. | Write a `count` event, or keep values above 1 and document them. | design N3 |
| N4 | 523, 541–546 | e1 is redundant with whole-word matching and comes before e3, so «POLVERE PER INALAZIONE IN CAPSULA GELATINOSA» becomes pillola. | Drop e1 or move it after e3; add that string as a test. | design N4 |
| N5 | 477–479, 136 | `levelPhrase` needs article and «mezzo/mezza» to agree with the container («penna»). | Build the phrase from the gender column. | design N5 |
| N6 | 349–353 | A weekly plan with X months in the past drops to coverage 0 on the first cron and sends alerts for every medicine. | List those plans in the R1 dry run and decide by hand. | design N6 |
| N7 | 467–470, 395, 610 | `defaultMode` and `isLevel` are used but missing from the exported functions list. | Add them, or name their module. | style N7 |
| N8 | 439, 462–463 | The injection «unità» exception repeats the table; «ml» and «unità» lack the sing./plur. pair. | Keep only «penna / penne» in the exception; write «ml / ml», «unità / unità». | style N6 |
| N9 | 107–114, 118–119, 774 | Goal 2's heading claims more than its body; «circa 20 forme» is a loose criterion. | «Stessa data di esaurimento per flaconi a dose giornaliera e compresse nei piani giornalieri»; «almeno 20 forme AIFA reali, comprese e1–e7». | style N3, N4 |
| N10 | 60, 64, 82, 775, 782 | Vague or emphatic phrases: «Molti medicinali», «avvisi utili», «alla radice», «un errore costa un tocco» (a wrong mode also needs a recount). | Name the categories; use plain statements; mention the recount. | style N1, N2, N9 |
| N11 | 38, 89, 49, 113, 119 | Glossary is a bold paragraph, not a heading. «Soluzione proposta» sits under The Problem. R1/R2 are used before line 223 defines them. | `### Glossario`; move the solution summary to the end of Overview; label the Overview items (R1) and (R2). | structural 5, 6, 7 |
| N12 | 494, 507, 212, 134–135, 564 | «(Verification Plan)» is not a link. «Il brief accetta entrambe le cose» and «(accettato)» have no clear referent. «Quanti giorni di uso dura?» has no subject. | Link `#verification-plan`; name what is accepted and by whom; use line 177's wording everywhere. | structural 8, style N10 |
| N13 | 3–6, 8, 810, 826 | Metadata keys mix English and Italian. `---` rules appear between only some H2s. | Use one language for the keys; keep only the rule before the Detailed Plan. | structural 10, 11 |
| N14 | 85, 146, 173, 181, 190, 313, 477, 664, 816; 35, 508, 717, 748 | Lines not re-wrapped after edits. «l'app è in alpha / poche famiglie» is repeated four times. | Re-wrap. Keep the alpha remark in the Overview and where it decides an alternative. | structural 10, style N10 |

---

## Not merged, for the record

- Structural also confirmed: no skipped heading levels, all code fences closed and tagged, consistent tables and list markers, valid relative links to the brief.
- The style reviewer found little promotional language; the problems are calibration and terminology.

---

## Resolution (applied to categorie.md on 2026-11-16)

Proposals and reasons are in [goldfish_review_report.md](./goldfish_review_report.md). The author accepted all of them and chose the recommended option for the three decisions.

| # | Resolution |
|---|---|
| D1 | R1.4 moves `stock_as_of` only for non-flaconi (`reorder_days is null`); a flacone case is added to the `tests/db` cases and to the R1 dry run. |
| D2 | `prep_reminder = (prep_reminder and stock_mode = 'weekly')`. R1.1 now says that only weekly plans with the reminder off see their calendar start on Monday. |
| D3 | Usage days kept (as decided in Stage 5). Recorded in «Differenze rispetto al brief» and in the risks table. |
| D4 | `categoryFromAifa(forma, descrizione)` also returns `mode`: PENNA or MULTIDOSE → livello, MONODOSE → pezzi. The form starts in that mode. Recorded as a change from the brief; tests added. |
| D5 | Words for as-needed medicines follow `defaultMode(category)`; «Finito un {contenitore}» agrees in gender; test for an as-needed flacone. |
| D6 | The open container can be «nessuno» (0). |
| D7 | `drop constraint` without `if exists`, with the reason (the constraint already limits `reorder_days` to flaconi). |
| D8 | The R2 dry run lists plans with every alert off and at least one flacone; the author writes to their owners (Ordine di rilascio). |
| D9 | R2.9 step 9 records that the migrations have no views and which 0.5-step checks exist. |
| S1 | New `## Risks & Mitigations` table with 12 rows. |
| S2 | Glossary entry for the brief links Stages 5–7; new «Differenze rispetto al brief» table; Alt. G cites Stage 5 M1 instead of a «terza revisione». |
| S3 | Every alternative has «Decisione:» with the trade-off first and a link to the brief section; L is marked «(rimandata)». |
| S4 | Added an R1 diagram; the R2 note now says R1 removes the weekly branch and R2 introduces `consumptionOn`. |
| W1 | «mai dopo» removed; R2.4 lists the two exceptions. |
| W2 | The recount uses «{Contenitori} chiusi» / «Quello aperto»; «confezione» is only the box. |
| W3 | One recount question, defined in R1.2; R2.7 only adapts the word and gender. |
| W4 | NFR: «se un'istruzione fallisce (compreso l'`assert` di R2.9)». |
| N1, N4–N14 | Applied (rollback data loss, e1/e3 order, gender in `levelPhrase`, R1 dry run for old X, exported functions, table pairs, Goal 2 heading and «almeno 20», wording, glossary heading and moved summary, links, metadata and rules, line wrapping). |
| N2, N3 | Declined: the drift test from Stage 5 covers N2; the old flacone stock never dropped, so N3 loses no information. |

The Detailed Implementation Plan was aligned with these changes (items 1, 22, 44, 53, 54, 58 and the Verification Plan). New split: FeatureRange 1–919, DetailedRange 920–1538.
