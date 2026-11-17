# Dieci categorie AIFA per i medicinali e scorte giorno per giorno

*   **Author:** Carlo Bianchi
*   **Status:** Proposed
*   **Date:** 2026-11-16
*   **Brief:** [concepts_brief.md](./concepts_brief.md)

## Overview

Appoteca aiuta chi gestisce le medicine di un familiare a sapere quanto dura la
scorta di ogni medicinale e quando riordinarlo. Oggi la classificazione dei
medicinali è fatta a mano. Ci sono quattro valori in `medications.form`
(compressa, iniezione, cerotto, collirio), forme in `shape` (tonda, ovale,
capsula per le compresse; siringa, penna, fiala, cerotto, cerotto-tondo,
bustina, flacone, monodose per gli altri) e un campo `reorder_days` usato solo
per il flacone di collirio. Inoltre ogni piano può tenere le scorte in due modi:
giorno per giorno oppure «settimanale», quando le compresse escono solo con la
preparazione del portapillole.

Questo design fa due cose, in due rilasci separati:

1.  **Scorte giorno per giorno in tutti i piani (R1).** La modalità settimanale
    sparisce. Il portapillole resta come promemoria e non modifica più le
    scorte.
2.  **Dieci categorie ricavate dalla forma farmaceutica AIFA (R2)** (Agenzia
    Italiana del Farmaco, il cui elenco dei medicinali l'app già importa):
    pillola, bustina, liquido, iniezione, gocce, inalatore, cerotto, crema,
    supposta, altro. Prendono il posto di `form` e delle forme dei presidi.
    Ogni categoria ha la sua icona (dal componente Presidio del progetto
    grafico), le sue parole («12 siringhe», «circa 18 giorni · 1 flacone») e
    un modo di conteggio, a pezzi o a livello.

L'app è in alpha e la usano poche famiglie. La regola guida dell'autore è la
soluzione più semplice che funziona.

### Glossario

*   **Piano:** la terapia di una persona, cioè i suoi medicinali più le
    impostazioni (giorno del portapillole, avvisi). Le scorte si calcolano per
    piano.
*   **Dispenser:** la scheda di ogni medicinale nella pagina del piano. Mostra la
    copertura come un tubo verticale su una scala da 0 a 60 giorni, con il
    testo della scorta e il pulsante di riconteggio.
*   **Presidio:** oggi indica due cose. Le «forme di presidio» sono i valori di
    `shape` che non sono compresse (siringa, cerotto, flacone…). `Presidio` è
    anche il componente che disegna le icone (`components/ui/Presidio.tsx`).
    Dopo R2 resta solo il componente.
*   **Progetto grafico:** l'export del progetto di design «Interfaccia
    Panoramix confermata» in `design/Presidi.dc.html` (pagina Presidi, sezioni
    07–10: categorie, scala, Dispenser, glifi e parole) e
    `design/Presidio.dc.html` (le 10 icone e il tubo). L'export è stato
    aggiornato il 2026-11-16. È il riferimento per icone, glifi, parole e
    parole chiave AIFA.
*   **AIC:** il codice di autorizzazione stampato sulla scatola; la scansione lo
    cerca nei dati AIFA.
*   **Brief:** [concepts_brief.md](./concepts_brief.md), il documento di
    partenza, rivisto due volte. Questo design è poi passato dalle revisioni
    EGM raccolte in questa cartella: fase 5 ([zoom_out_report.md](./zoom_out_report.md)),
    fase 6 ([comprehension_report.md](./comprehension_report.md)) e fase 7
    ([critic_report.md](./critic_report.md)).

### Soluzione proposta, in breve

*   La scorta scende ogni giorno in tutti i piani. Il portapillole manda solo un
    promemoria con le dosi dei 7 giorni da preparare.
*   Nuova colonna `medications.category` con 10 valori, riempita dai dati
    esistenti con una tabella di corrispondenza che copre tutte le 11 coppie
    (form, shape) ammesse oggi.
*   Un medicinale è «a livello» se ha `days_per_pack` (il vecchio
    `reorder_days`), altrimenti è «a pezzi». A livello la scorta si conta in
    contenitori (flaconi, tubi, inalatori) e scende di `1 / days_per_pack` per
    ogni giorno con una dose. Una sola funzione, `consumptionOn(med, day)`, dà
    il consumo del giorno per entrambi i modi.
*   `categoryFromForm` assegna la categoria quando si scansiona una scatola, e
    `categoryFromAifa` suggerisce anche il modo di conteggio.
*   Una sola tabella di parole per categoria, Presidio con 10 glifi, un selettore
    di categoria nel modulo e un Dispenser con la fascia di livello.

### Differenze rispetto al brief

Le revisioni del design hanno cambiato cinque decisioni del brief. L'autore le
ha approvate tutte.

| Brief | Questo design | Perché | Fonte |
| --- | --- | --- | --- |
| A livello si consuma ogni giorno di calendario. | Si consuma solo nei giorni con una dose («giorni di uso»). | Pause, cicli e giorni esclusi non devono consumare. | Fase 5, M4 |
| «Quanti giorni dura» si precompila da volume ÷ dose. | Il campo parte vuoto; `packVolumeFromDescription` non c'è. | Il volume della scatola (ml, g) spesso non è nell'unità della dose (gocce, applicazioni). | Fase 5, M1 |
| Il modo viene solo dal default della categoria. | La forma o la descrizione AIFA può indicare il modo: PENNA o MULTIDOSE → livello, MONODOSE → pezzi (R2.5). | Una penna di insulina a pezzi perderebbe 40 penne al giorno con una dose di 40 unità. | Fase 7, D4 |
| Al bisogno: «Finita una confezione». | «Finito un {contenitore}» («Finito un flacone»), accordato al genere. | Toglie un contenitore, non una scatola. | Fase 6, C9 |
| Una parola per categoria. | Due eccezioni per il modo non di default (R2.3). | Altrimenti «30 flaconi» per 30 monodose. | Alt. O |

## The Problem

**Sciroppi, inalatori, creme, bustine e supposte non trovano posto
nell'app.** Con quattro forme fatte a mano non si possono gestire. Chi
scansiona una scatola di questi medicinali deve scegliere una forma che non è la
sua, e l'app usa parole sbagliate («compresse» per uno sciroppo). Per questi
medicinali, inoltre, non arrivano avvisi di riordino. La classificazione
dipende dall'esperienza dell'autore e non copre l'elenco AIFA, che l'app già
importa (`scripts/aifa/parse.mjs`).

**Non si sa quanto contiene una confezione di colliri e creme.** Per una
compressa la scorta è un numero di pezzi. Per un flacone di collirio o un tubo
di crema nessuno conta le gocce o i grammi. Oggi il flacone ha un caso a parte
(`reorder_days`, con un promemoria dedicato), e la sua scorta non scende mai
(`lib/forecast.ts:252`). Senza un modello comune, ogni nuova categoria «a
volume» richiederebbe un altro caso speciale.

**La modalità settimanale complica tutto il resto.** In modalità settimanale la
scorta scende solo quando si conferma il portapillole. Questo comporta due
regole di discesa in `lib/forecast.ts`, tre RPC (`apply_prep`, `undo_prep`,
`change_stock_mode`), una tabella `prep_runs` e un pannello dedicato. La prima
revisione ha mostrato che, con le nuove categorie, la modalità settimanale
avrebbe lasciato ferme le scorte di iniezioni e cerotti, oppure avrebbe
richiesto una terza regola. Togliere la discesa settimanale elimina la
seconda regola di discesa e il codice che la sostiene.

**Lo schema rifiuta i valori delle nuove categorie.** Le dosi sono limitate a
0–20 in `numeric(4,1)`: 40 UI (unità internazionali) di insulina o 30 ml di
sciroppo non ci stanno. La scorta è `numeric(8,1)` a passi di 0,5: una scorta
che scende di 1/30 al giorno verrebbe rifiutata al primo salvataggio.

## Goals

1.  **Categoria sempre presente.** Dopo la migrazione ogni riga di `medications`
    ha una `category` tra i 10 valori, e nessun codice dell'app legge più
    `form`, `stock_mode`, `mode_since` o `prep_runs`.
2.  **Stessa data di esaurimento per flaconi a dose giornaliera e compresse
    nei piani giornalieri.** Ogni flacone
    esistente con una dose ogni giorno ha la stessa data di esaurimento del
    giorno prima (il vecchio giorno del promemoria di riordino); gli avvisi
    seguono le soglie del piano (R2.4). Ogni compressa nei piani giornalieri ha
    gli stessi giorni di copertura del giorno prima.
3.  **Il promemoria non arriva a chi non lo usava.** Il promemoria del
    portapillole parte solo per i piani che erano settimanali o che lo accendono
    da `PlanForm`.
4.  **Categoria giusta alla scansione.** `categoryFromForm` passa i test su almeno
    20 forme AIFA reali, compresi i casi delle eccezioni di R2.5, che sono gli
    errori trovati nelle revisioni del brief.
5.  **Parole e icone giuste ovunque.** Un medicinale di ogni categoria attraversa
    modulo, Dispenser, calendario, foglio A4, scheda terapia, lista farmacia ed
    email con l'icona (o, nelle email, il nome) e la parola del contenitore e
    della dose corrette. C'è un test per categoria.
6.  **Avvisi di riordino per i medicinali a livello.** Sciroppi, inalatori,
    colliri e creme ricevono gli avvisi di soglia e «ultima confezione» con le
    stesse regole delle compresse.
7.  **Suite verde.** `npm test`, `npm run test:db`, `npm run test:e2e`,
    `npm run typecheck` e `npm run lint` passano dopo ciascuno dei due rilasci.

## Non-Goals

*   **Consumo calcolato dal volume per dose che segue i cambi di dose** (colonna
    `pack_volume`) e **precompilazione dal volume** di «Per quanti giorni di
    uso dura un {contenitore}?». L'utente scrive i giorni a mano: il volume
    della scatola (ml, g) spesso non è nell'unità della dose (gocce,
    applicazioni).
*   **Colonna `count_mode` separata.** Il modo di conteggio dipende solo dalla
    presenza di `days_per_pack`.
*   **Scorta a livello in ml, gocce o grammi.** La scorta resta in contenitori.
*   **Riga «cosa manca» nel promemoria** e avviso anticipato «Ne mancano N per la
    prossima preparazione».
*   **Segnale «da ricontrollare»** sui medicinali migrati.
*   **Migrazione in più fasi**, tabella di backup o prova a secco degli avvisi.
    Basta un `pg_dump` prima della migrazione.
*   **Spareggio con il codice ATC** (la classificazione
    anatomica-terapeutica-chimica dei principi attivi), fixture con tutte le
    forme AIFA, colonne di tracciamento della classificazione.
*   **Icone SVG nelle email** (i client di posta le tolgono) e classificazione
    automatica dei prodotti senza AIC.
*   **Etichette di uso comune** («Compresse e capsule»): si usano quelle del
    design.

## Open Questions

Nessuna domanda aperta. Le due domande della prima stesura hanno una risposta
nel piano tecnico:

*   Promemoria del portapillole senza `computePrep`: vedi «R1.3 Promemoria del
    portapillole».
*   Data di riordino dei flaconi con la scorta che scende: vedi «R2.4 Flaconi
    esistenti: stessa data di esaurimento».

## Critical User Journeys (CUJs)

### CUJ 1: Aggiungere uno sciroppo scansionando la scatola

*   **Given**: un piano giornaliero; la scatola ha un AIC presente nei dati AIFA
    con forma «SCIROPPO» e descrizione «1 FLACONE 150 ML».
*   **When**: l'utente scansiona la scatola, scrive la dose «5 ml la mattina e
    la sera» e salva.
*   **Then**: la categoria è già «Liquido». Il modulo chiede «Per quanti
    giorni di uso dura un flacone?», con il campo vuoto; l'utente scrive 15.
    Nel Dispenser compare una fascia piena con «circa 15 giorni · 1 flacone».
    Quando la copertura scende sotto la soglia del piano, arriva l'avviso di
    riordino.

### CUJ 2: Aggiungere un medicinale senza scansione

*   **Given**: un prodotto senza AIC (per esempio una crema galenica).
*   **When**: l'utente apre «Aggiungi medicinale».
*   **Then**: vede la griglia 5×2 delle categorie senza nessuna preselezionata.
    Sceglie «Crema» e il modulo chiede «Per quanti giorni di uso dura un
    tubo?». Con il link «Conta a pezzi» può passare al conteggio a pezzi.

### CUJ 3: Un piano che usava il portapillole settimanale

*   **Given**: un piano in modalità settimanale con il portapillole preparato
    domenica.
*   **When**: si applica la migrazione del rilascio 1.
*   **Then**: la scorta resta quella di prima fino alla fine della settimana già
    preparata, poi scende ogni giorno. Il sabato alle 17:00 UTC arriva il
    promemoria con le dosi dei 7 giorni dalla domenica. Il pulsante «Portapillole
    preparato» non c'è più. Se l'utente riconta, la domanda è «Quante ne hai in
    tutto, comprese quelle nel portapillole?».

### CUJ 4: Un piano giornaliero che non usava il portapillole

*   **Given**: un piano giornaliero con `prep_reminder = true` (il default di
    oggi).
*   **When**: si applica la migrazione del rilascio 1.
*   **Then**: `prep_reminder` diventa `false`, e non arriva nessun promemoria
    nuovo. Le scorte e gli avvisi restano identici.

### CUJ 5: Un collirio in flacone esistente

*   **Given**: un collirio in flacone con `reorder_days = 30`, `stock_as_of` di
    10 giorni fa e un promemoria di riordino tra 20 giorni.
*   **When**: si applica la migrazione del rilascio 2.
*   **Then**: il medicinale è «Gocce», a livello, con `days_per_pack = 30` e
    scorta 1. Il Dispenser mostra «circa 20 giorni · meno di un flacone», e la
    data di esaurimento è la stessa del giorno prima. Gli avvisi di soglia
    possono arrivare prima di quanto arrivava il vecchio promemoria (R2.4), e al
    primo cron può arrivare un'email «ultima confezione» (accettato nel
    brief).

### CUJ 6: Riconteggio di un medicinale a livello

*   **Given**: un inalatore a livello con 2 inalatori in casa.
*   **When**: l'utente apre il riconteggio.
*   **Then**: indica «Inalatori chiusi: 1» e «Quello aperto: metà». La scorta
    diventa 1,5, e il Dispenser mostra «1 inalatore e mezzo».

## Technical Plan (Architecture)

Il lavoro è diviso in due rilasci. Il rilascio 1 (R1) si può pubblicare da solo e
non dipende dal rilascio 2 (R2). R2 parte dal codice di R1.

Questa sezione descrive le regole e il perché. L'elenco dei file, l'ordine
esatto dei passi SQL e le firme delle funzioni sono nel
[piano dettagliato](#detailed-implementation-plan): se le due sezioni non
coincidono, vale il piano dettagliato e questa sezione va corretta.

```text
                       RILASCIO 1: scorte giorno per giorno
 cron 17:00 UTC ──► piani con prep_reminder e domani = prep_weekday
        │
        ▼
 buildPrepReminderItems(meds, prepDate) ──► email del promemoria
 tolti: apply_prep, undo_prep, change_stock_mode, prep_runs, ramo settimanale
```

```text
                       RILASCIO 2: tassonomia
 AIFA (aifa_packs.form, pack_description)
        │
        ▼
 categoryFromForm(forma) ──► category
        │
        ▼
 MedicationForm: selettore 5×2, «Quanti pezzi» / «Quanti giorni di uso dura»
        │ salva
        ▼
 medications(category, shape solo per pillola, days_per_pack, pills_per_pack, stock_qty numeric)
        │
        ▼
 lib/forecast.ts  consumptionOn(med, day) ──► currentStock, coveredDaysFrom, suggestedPacks
        │                                         (R1 toglie il ramo settimanale; R2 introduce consumptionOn)
        ▼
 forecastMedication ──► Forecast ──► lib/view.ts (Dispenser) · lib/alerts.ts (email)
                                   · lib/pharmacy.ts (farmacia) · lib/digest.ts (promemoria)
        │
        ▼
 lib/categories.ts: etichetta, parole, genere, passo ──► Presidio, Dispenser, stampa, email
```

### Rilascio 1: scorte giorno per giorno

#### R1.1 Modello delle scorte

Oggi `PlanSettings` porta `stockMode` e `modeSince`, e ogni calcolo di scorta ha
un ramo settimanale. Dopo R1:

*   `PlanSettings` perde `stockMode` e `modeSince`. Restano `prepWeekday`, i tre
    interruttori degli avvisi e `prepReminder`. Il tipo `StockMode`, `PrepRunData`
    e `PrepItem` spariscono.
*   Dopo la migrazione `stock_as_of` di un piano che era settimanale può
    essere nel futuro (R1.4): fino a quel giorno le dosi escono dal
    portapillole già preparato, e la scorta salvata è solo quella in casa.
    Quindi:
    *   la copertura parte da `max(oggi, stock_as_of)` e somma i giorni che
        mancano a quella data;
    *   arrivi, prese al bisogno e i loro annullamenti cambiano la scorta in
        casa e la salvano alla data `max(oggi, stock_as_of)`;
    *   un riconteggio, o una scorta scritta nel modulo, conta tutto, anche il
        portapillole, e si salva a oggi.
*   `currentStock(med, today)` perde il parametro `mode`. La scorta scende ogni
    giorno per ogni medicinale programmato. In R1 il flacone (`reorderDays`)
    resta com'è oggi, cioè fermo; il suo calcolo cambia solo in R2.
*   `forecastMedication(med, { plan, today })`: si tolgono il ramo `weekly`, i
    campi `homeDays` e `nextPrepNeed` di `Forecast` e la condizione
    `notEnoughForPrep`. La copertura parte da `max(today, stockAsOf)` (vedi
    sopra).
*   `forecastPlan(plan, meds, today)` perde il parametro `runs` e i campi
    `nextPrep`, `prepOverdue`, `latestRun`, `prepWeek` e `prepPreview`.
*   `statusReason` perde il parametro `mode` e i due rami settimanali
    («Ne mancano N per la prossima preparazione» e «Dopo la preparazione
    restano…»).
*   Si cancellano `relevantRuns`, `latestActiveRun`, `nextPrepDue`,
    `prepWeekStart`, `computePrep`, `applyPrep` e `undoPrep`.

**Calendario.** `calendarWeekStart` resta e cambia solo la condizione: la
settimana del calendario e del foglio A4 comincia dal giorno di preparazione se
il piano ha `prepReminder` acceso, altrimenti il lunedì. Il foglio A4 serve a
riempire il portapillole, quindi deve partire dallo stesso giorno. La
migrazione lascia il promemoria acceso solo sui piani settimanali che lo
avevano acceso (R1.4). Il primo giorno della settimana cambia solo per i piani
settimanali che avevano il promemoria spento: il loro calendario comincia dal
lunedì.

**Lista farmacia.** `buildPharmacyItems` perde `nextPrep`: il fabbisogno dei 30
giorni di ogni medicinale parte da `max(oggi, stock_as_of)`.

**Email.** Si tolgono «Prossima preparazione del portapillole» dal riepilogo
settimanale (`lib/email/templates.ts:178`) e dal testo per il medico
(`lib/email/alert-template.ts:84`).

**Statistiche d'uso.** `lib/usage.ts` conta le preparazioni da `prep_runs`. Il
conteggio si toglie insieme alla tabella.

#### R1.2 Interfaccia

*   Si cancellano `components/PrepPanel.tsx` e le azioni `preparePillbox` e
    `undoPillbox` in `lib/actions/stock.ts`.
*   `components/PlanForm.tsx` perde la scelta della modalità. Resta l'interruttore
    «Promemoria per preparare il portapillole». Il selettore del giorno compare
    solo quando l'interruttore è acceso. Il default per un piano nuovo diventa
    spento (`lib/schemas.ts`: `prep_reminder` default `false`).
*   `lib/actions/plans.ts` non chiama più `change_stock_mode`. Salvare il piano
    è un normale `update` di `plans`.
*   Il riconteggio chiede «Quante ne hai in tutto?». Quando il piano ha
    `prep_reminder` acceso, la domanda continua con «, comprese quelle nel
    portapillole». Questa è l'unica domanda di riconteggio a pezzi; R2 ne
    accorda solo la parola alla categoria.
*   La pagina Storico continua a mostrare gli eventi `prep` e `prep_undo` già
    salvati, con le etichette di oggi.

#### R1.3 Promemoria del portapillole

Oggi il promemoria parte se `stock_mode = 'weekly'` e domani è il giorno di
preparazione dovuto (`fc.nextPrep`), e il contenuto viene da `computePrep`. Dopo
R1 la regola non dipende più dalle preparazioni:

*   **Quando:** il cron delle 17:00 UTC sceglie i piani con `prep_reminder`
    acceso e con `isoWeekday(domani) = prep_weekday`.
*   **Cosa:** una nuova funzione pura in `lib/digest.ts`,
    `buildPrepReminderItems(meds, prepDate)`. Per ogni medicinale non al bisogno
    e non concluso, somma le dosi dei 7 giorni da `prepDate` con `dosesBetween`
    e tiene quelli con somma > 0. Ogni voce ha nome, dosaggio, colore, la frase
    delle dosi in vigore il giorno di preparazione (`dosesPhrase`) e l'eventuale
    cambio di dose nella settimana (come oggi). Non ci sono il campo `missing`
    né la riga «cosa manca».
*   In R1 la frase resta in compresse («1 al mattino»). In R2 usa la parola della
    dose della categoria («1 goccia la sera»).
*   `renderPrepReminderEmail` perde la colonna «mancano».

#### R1.4 Migrazione di R1

Un unico file, `supabase/migrations/20261117000100_daily_stock.sql`, eseguito in
transazione. Prima si fa un `pg_dump` del database di produzione. Il deploy della
migrazione e del codice avviene fuori dagli orari dei cron (07:00 e 17:00 UTC).

1.  `drop function` di `public.apply_prep(uuid, date, date, jsonb)`,
    `public.undo_prep(uuid, date)` e
    `public.change_stock_mode(uuid, text, date, jsonb)`.
2.  **Spostamento di `stock_as_of` nei piani settimanali.** Per ogni piano con
    `stock_mode = 'weekly'` si calcola il giorno X da cui le scorte iniziano a
    scendere:
    *   se esiste una preparazione attiva (`undone_at is null`), X è il
        `week_start` più recente + 7;
    *   altrimenti X è il primo giorno con `isodow = prep_weekday` da
        `mode_since` in poi.

    In modalità settimanale la scorta salvata è quella in casa: le compresse
    nel portapillole sono già state scalate alla preparazione. Per questo la
    scorta può cominciare a scendere ogni giorno solo da X, quando il
    portapillole già preparato è finito.

    Poi, per i medicinali di quel piano che non sono flaconi
    (`reorder_days is null`), `stock_as_of = greatest(stock_as_of, X)`. Il
    flacone non scende in R1, e il suo `stock_as_of` è il giorno da cui conta
    il promemoria di riordino: spostarlo ritarderebbe il promemoria.
    Il `greatest` serve per chi ha ricontato dopo X: in quel caso il conteggio è
    già quello giusto. Se X è nel passato (preparazione in ritardo), la scorta
    inizia a scendere da X: se l'utente ha preparato senza premere il pulsante,
    la scorta salvata è più alta del vero e scalarla è corretto. Se invece non
    ha preparato, gli avvisi arrivano prima del necessario.
3.  `update plans set prep_reminder = (prep_reminder and stock_mode =
    'weekly')` e
    `alter column prep_reminder set default false`.
4.  `drop table prep_runs` (cancella anche RLS e indici), poi
    `alter table plans drop column stock_mode, drop column mode_since`.
5.  Il check di `stock_events.type` resta invariato: `prep` e `prep_undo`
    restano validi per lo storico.

Il calcolo di X si fa in SQL con una CTE (punto 1 del piano dettagliato), con
la stessa regola del codice di oggi: conta solo le preparazioni del periodo
settimanale in corso. La migrazione non ha un test automatico, perché
`tests/db` lavora su un database già migrato. Si verifica a mano sul dump dei
dati veri (Verification Plan): preparazione attiva, nessuna preparazione,
riconteggio dopo X, flacone non spostato, piano settimanale con il promemoria
spento che resta spento.

### Rilascio 2: dieci categorie

#### R2.1 Schema

```text
medications
  category       text not null, check in (pillola, bustina, liquido, iniezione, gocce,
                                          inalatore, cerotto, crema, supposta, altro)
  shape          text null, check ((category = 'pillola') = (shape is not null))
                            e shape in (tonda, ovale, capsula)
  days_per_pack  integer null, check between 1 and 365          (era reorder_days)
                 check (frequency_type <> 'as_needed' or days_per_pack is null)
  pills_per_pack integer not null, check between 1 and 10000    (unità di scorta per confezione:
                                                                 pezzi, o contenitori a livello)
  stock_qty      numeric not null, check >= 0                   (senza scala, niente passo 0,5)
  dose_*         numeric(5,1), check between 0 and 999 e passo 0,5
dose_changes.dose_*            come sopra
stock_events.delta, qty_after  numeric (senza scala)
```

Il vincolo su `days_per_pack` con `as_needed` mette per iscritto la regola del
brief: un medicinale al bisogno si conta sempre a pezzi.

La colonna `pills_per_pack` non cambia nome, ma cambia significato: è il numero
di unità di scorta in una confezione, cioè pezzi a pezzi e contenitori a
livello.

#### R2.2 Modo di conteggio e consumo

```text
isLevel(med) = med.daysPerPack != null

consumptionOn(med, day):
  se isLevel(med):  1 / daysPerPack  se dosesOn(med, day) > 0   (un giorno di uso)
                    0                altrimenti
  altrimenti:       dosesOn(med, day)                         (come oggi)

consumptionBetween(med, from, to) = somma di consumptionOn sui giorni da from a to
```

*   `currentStock`, `coveredDaysFrom` e `suggestedPacks` usano
    `consumptionOn` e `consumptionBetween` al posto di `dosesOn` e
    `dosesBetween`. `dosesOn` resta per il calendario, il promemoria e le frasi.
*   Il ramo `reorderDays` di `forecastMedication` sparisce. Un medicinale a
    livello passa dallo stesso calcolo di copertura, soglie e «ultima
    confezione» delle compresse. Il campo `Forecast.reorder` e i testi «giorni al
    promemoria di riordino» spariscono.
*   A livello la scorta è un numero di contenitori, anche frazionario.
    `pills_per_pack` dice quanti contenitori ci sono in una scatola. Quindi
    `arrivePacks` (+ `packs × pills_per_pack`), «ultima confezione»
    (`stock ≤ pills_per_pack`), il tubo dei medicinali al bisogno
    (`lib/view.ts:70`) e `suggestedPacks` funzionano senza casi speciali.
*   **Nessun arrotondamento nel database.** La scorta si salva come
    `numeric` senza scala, quindi 1/30 di flacone resta com'è e il valore
    salvato coincide con quello calcolato. Si arrotonda solo per mostrarla
    (`formatQty`, `levelPhrase`). I confronti di copertura usano l'`EPS` già
    presente in `lib/forecast.ts`.
*   **Giorni di uso, non quantità.** A livello un giorno con una dose consuma
    `1 / daysPerPack`, qualunque sia la dose. Un giorno senza dose non consuma:
    i giorni esclusi di uno schema a giorni della settimana, la pausa di un
    ciclo, una sospensione con dose 0. «Quanti giorni di uso dura» vuol dire
    quindi giorni in cui il medicinale si usa. Un cambio della quantità (da 1 a
    2 gocce) non cambia il consumo: si aggiorna a mano «quanti giorni di uso
    dura» oppure si riconta.

#### R2.3 Parole per categoria

`lib/categories.ts` sostituisce `lib/presidi.ts`. Ha una sola tabella:

| category | etichetta | contenitore (sing./plur.) | genere | dose a livello | passo | modo di default |
| --- | --- | --- | --- | --- | --- | --- |
| pillola | Pillola | compressa / compresse | f | – | 0,5 | pezzi |
| bustina | Bustina | bustina / bustine | f | – | 1 | pezzi |
| liquido | Liquido | flacone / flaconi | m | ml / ml | 0,5 | livello |
| iniezione | Iniezione | siringa / siringhe | f | unità / unità | 1 | pezzi |
| gocce | Gocce | flacone / flaconi | m | goccia / gocce | 1 | livello |
| inalatore | Inalatore | inalatore / inalatori | m | erogazione / erogazioni | 1 | livello |
| cerotto | Cerotto | cerotto / cerotti | m | – | 1 | pezzi |
| crema | Crema | tubo / tubi | m | applicazione / applicazioni | 1 | livello |
| supposta | Supposta | supposta / supposte | f | – | 1 | pezzi |
| altro | Altro | pezzo / pezzi | m | – | 1 | pezzi |

Legenda: «genere» è il genere grammaticale del contenitore, per accordare
«rimasto» / «rimasta». «Passo» è il passo del campo della dose nel modulo; il
database accetta sempre passi di 0,5 (R2.1), quindi un passo di 1 è solo più
stretto.

Regole:

*   **Parola della dose.** A pezzi la dose si dice con la parola del contenitore
    («2 compresse», «1 siringa»). A livello si dice con la colonna «dose a
    livello» («5 ml», «1 goccia»). Se una categoria senza parola di dose a
    livello passa a livello, si usa la parola del contenitore.
*   **Due eccezioni nel modo non di default**, perché la parola del contenitore
    cambia:
    *   gocce a pezzi (colliri monodose): contenitore «monodose / monodose»,
        femminile;
    *   iniezione a livello (penne multidose): contenitore «penna / penne»,
        femminile.

    Senza queste eccezioni 30 monodose diventerebbero «30 flaconi», e 40 unità
    di insulina in una penna diventerebbero «40 siringhe».
*   **Medicinali al bisogno.** Un medicinale al bisogno è sempre a pezzi, ma
    le sue parole seguono `defaultMode(category)`, non il modo effettivo. Un
    collirio in flacone al bisogno resta quindi «flacone», non «monodose».
    Liquido e crema a pezzi dicono la dose con la parola del contenitore
    («1 flacone»): è il caso di chi conta flaconi interi.
*   Funzioni esportate: `isLevel(med)`, `defaultMode(category)`,
    `containerWord(med, n)`, `doseWord(med, n)`, `leftWord(med, n)`
    («compresse rimaste», «tubo rimasto»), `howMany(med)` («Quante compresse»,
    «Per quanti giorni di uso dura un tubo?») e `doseStep(med)`. Prendono
    `{ category, daysPerPack, frequencyType }` al posto di `shape`.
*   `pillsWord` in `lib/forecast.ts` e `unitWord`/`leftWord` in `lib/presidi.ts`
    spariscono. Chi li usa (`lib/view.ts`, `lib/alerts.ts`,
    `lib/actions/stock.ts`, `lib/email/templates.ts`) passa a
    `lib/categories.ts`.

**Frasi a livello nel Dispenser.** `levelPhrase(stock, coverageDays, med)`
restituisce «circa N giorni · 2 flaconi». N è la copertura in giorni. La
quantità si dice in contenitori interi, mezzi, o «meno di un flacone».
Articolo e «mezzo/mezza» si accordano con il genere del contenitore («una
penna e mezza»).

#### R2.4 Flaconi esistenti: stessa data di esaurimento

Oggi un flacone con `reorder_days = N` e `stock_as_of = S` ha il promemoria il
giorno S + N, e la sua scorta salvata non scende mai. Dopo la migrazione
`stock_qty = 1`, `pills_per_pack = 1`, `days_per_pack = N` e `stock_as_of = S`.
La scorta di oggi è `1 − (oggi − S) / N`, e la copertura è `scorta × N =
N − (oggi − S)`. Il primo giorno non coperto è quindi S + N, lo stesso di
prima. La scorta di oggi non viene salvata: si calcola.

Questo vale per i flaconi con una dose ogni giorno. Un flacone con uno schema
non giornaliero consuma solo nei giorni di uso (R2.2), quindi la sua data di
esaurimento si sposta più avanti. La prova della migrazione sui dati veri
elenca questi flaconi ([Verification Plan](#verification-plan)); l'autore ne
corregge
`days_per_pack` a mano, se ce ne sono.

Cambiano invece **i giorni in cui arrivano gli avvisi**:

*   Prima l'unico avviso era il giorno S + N, anche con gli avvisi del piano
    spenti.
*   Dopo valgono gli interruttori del piano: «meno di 14 giorni» arriva il
    giorno S + N − 14, «meno di 7» il giorno S + N − 7, e «ultima confezione»
    al primo cron (la scorta è 1 = `pills_per_pack`).
*   Con gli avvisi del piano spenti, il flacone non manda più nessun avviso.

Per i flaconi con una dose ogni giorno gli avvisi arrivano quindi prima o lo
stesso giorno di oggi. Fanno eccezione i flaconi con uno schema non
giornaliero (data più avanti, vedi sopra) e i piani con gli avvisi spenti
(nessun avviso). Il brief accetta gli avvisi anticipati e l'email «ultima
confezione». Gli altri due casi sono nella tabella dei rischi: la prova sui
dati veri elenca i piani interessati, e l'autore scrive a mano ai loro
proprietari (Ordine di rilascio).

#### R2.5 Mappatura AIFA

*   `lib/categories.ts` esporta `categoryFromForm(forma: string): Category`.
    Funzione pura. Normalizza in maiuscolo senza accenti. Poi controlla, nella
    tabella sotto, prima le eccezioni e poi le parole chiave. Eccezioni e
    parole chiave valgono a inizio parola (`\bCOMPRESS` trova COMPRESSA e COMPRESSE), riga per riga:
    vince la prima riga che corrisponde. Se non trova niente restituisce
    `altro`.

Tabella di `categoryFromForm`:

| # | Se la forma contiene | category |
| --- | --- | --- |
| | **Eccezioni** | |
| e1 | POLVERE PER INALAZIONE | inalatore |
| e2 | GRANULATO o POLVERE PER SOSPENSIONE ORALE | bustina |
| e3 | GELATINOSA | pillola |
| e4 | UNGUENTO OFTALMICO o GEL OFTALMICO | crema |
| e5 | VAGINAL o RETTAL, senza OVUL, SUPPOST, CAPSUL né COMPRESS | crema |
| e6 | SPRAY NASALE | gocce |
| e7 | GOCCE ORALI | gocce |
| | **Parole chiave del progetto grafico, in ordine** | |
| k1 | COMPRESS, CAPSUL, PASTIGL, CONFETT | pillola |
| k2 | BUSTIN, GRANULAT, POLVERE ORALE | bustina |
| k3 | SCIROPPO, SOLUZIONE ORALE, SOSPENSIONE ORALE, GOCCE ORALI | liquido |
| k4 | INIETT, INFUS, SIRINGA, PENNA, FIALA | iniezione |
| k5 | COLLIRIO, OFTALM, AURICOL, NASAL | gocce |
| k6 | INALAZ, NEBULIZZ, AEROSOL | inalatore |
| k7 | CEROTT, TRANSDERM | cerotto |
| k8 | CREMA, POMATA, UNGUENTO, GEL, SCHIUMA | crema |
| k9 | SUPPOST, OVUL, RETTAL, VAGINAL | supposta |

Le parole chiave sono quelle della tabella «Parole e parole chiave AIFA per
categoria» del progetto grafico (pagina Presidi, sezione 10), nel suo ordine.
Le eccezioni sono gli errori che le revisioni del brief hanno trovato con le
sole parole chiave, e vengono prima:

*   GEL trova anche GELATINOSA, quindi e3 manda le capsule gelatinose alle
    pillole;
*   una polvere per inalazione in capsule sarebbe una pillola (k1), quindi e1
    la manda agli inalatori, anche con GELATINOSA;
*   il progetto grafico mette GOCCE ORALI tra i liquidi (k3), ma il brief le
    vuole tra le gocce: vale e7;
*   le forme vaginali e rettali non solide (gel, schiume, soluzioni) vanno in
    crema per e5; quelle solide restano supposte (k9) o pillole (k1).

Le parole del liquido dicono «ORALE», quindi «SOLUZIONE INIETTABILE» è
un'iniezione e «COLLIRIO, SOLUZIONE» è gocce. Una forma che non contiene
nessuna parola, per esempio «SOLUZIONE CUTANEA», va in `altro`.

*   `lib/aic.ts`: `formFromAifa` si sostituisce con
    `categoryFromAifa(forma, descrizione)`. Restituisce
    `{ category, shape, mode }`:
    *   `shape` vale solo per le pillole (`capsula` se la forma contiene
        CAPSUL, altrimenti `null` e la sceglie l'utente);
    *   `mode` è `livello` se la forma o la descrizione della confezione
        contiene PENNA o MULTIDOSE, `pezzi` se contiene MONODOSE, altrimenti
        `defaultMode(category)`. Così una penna di insulina si conta a livello
        e un collirio monodose a pezzi.

    `AicLookup` perde `form` e prende `category`, `shape` e `mode`.
*   `scripts/aifa/parse.mjs`: si aggiunge SUPPOST a `UNITS_RE`.

#### R2.6 Modulo «Aggiungi medicinale»

*   Un selettore di categoria a 10 pulsanti (griglia 5×2, glifo ed etichetta,
    `aria-pressed`). Con la scansione la categoria è preselezionata, senza
    scansione nessuna. Il resto del modulo compare dopo la scelta.
*   Per la pillola resta il selettore della forma (tonda, ovale, capsula).
*   **Campo di quantità per confezione:**
    *   modo di default «pezzi»: «Quanti {contenitori} in una confezione?»
        (`pills_per_pack`);
    *   modo di default «livello»: «Per quanti giorni di uso dura un
        {contenitore}?» (`days_per_pack`, campo vuoto) e, sotto, «Quanti
        {contenitori} in una confezione?» con valore 1.
    *   Con la scansione il modo di partenza è il `mode` di
        `categoryFromAifa` (R2.5), non il default della categoria.
    *   Un link «Conta a pezzi» / «Conta a giorni» passa all'altro modo e
        svuota o riempie `days_per_pack`.
    *   Con frequenza «al bisogno» il campo dei giorni non compare, e il modo è
        sempre a pezzi.
*   **Scorta nella modifica di un medicinale:**
    *   a pezzi: il campo della scorta resta com'è oggi;
    *   a livello: la scorta non è un campo del modulo. Si mostra in sola
        lettura con `levelPhrase`, con un link «Riconta» al riconteggio del
        Dispenser. Il modulo non può quindi mandare una scorta frazionaria
        arrotondata a 0,5, che diventerebbe un falso riconteggio;
    *   **cambio di modo:** se il salvataggio passa da pezzi a livello o
        viceversa, la scorta vecchia è in un'altra unità (pezzi o contenitori).
        Il modulo chiede allora la scorta nel modo nuovo (un numero di pezzi,
        oppure contenitori chiusi più quello aperto), e il salvataggio la
        registra come riconteggio. La scorta vecchia non passa mai da un modo
        all'altro.
*   Il passo dei campi dose viene da `doseStep`, e l'etichetta delle dosi dalla
    parola della dose.

#### R2.7 Presidio e Dispenser

*   `components/ui/Presidio.tsx` disegna le 10 icone di
    `design/Presidio.dc.html` (pagina Presidi, sezioni 07–09). Props:
    `category`, `pillShape`, `color`, `size`, `view` (`"icon"` o `"tube"`) e
    `days`, come nel progetto grafico. Il selettore del modulo usa i 10 glifi
    al tratto della sezione 10 (`CategoryGlyph`).
*   `components/Dispenser.tsx`, sulla scala 0–60 già esistente:
    *   **a pezzi:** icone della categoria impilate fino all'altezza dei giorni
        di copertura; sotto, il testo con i pezzi veri («26 compresse»);
    *   **a livello:** una fascia piena nel colore del medicinale fino ai giorni
        di copertura; sotto, `levelPhrase`;
    *   oltre 60 giorni: tubo pieno e «60+»;
    *   etichetta della categoria accanto all'icona per tutte le categorie.
*   **Riconteggio:**
    *   a pezzi: la domanda di R1.2, con la parola e il genere della
        categoria da `howMany` («Quanti cerotti hai in tutto?»);
    *   a livello: «{Contenitori} chiusi» (intero ≥ 0, con `containerWord`)
        più «Quello aperto: pieno, metà, quasi finito o nessuno» (1, 0,5, 0,1
        o 0), accordati al genere. La scorta salvata è la somma. «Confezione»
        resta la parola della scatola.
*   **Al bisogno nelle categorie a livello:** il pulsante «− Presa 1» diventa
    «Finito un {contenitore}», accordato al genere (per esempio «Finito un
    flacone», con `containerWord`) e chiama l'azione esistente `takeAsNeeded`
    con quantità 1. Toglie un contenitore, non una scatola: la scorta a livello si conta in
    contenitori. Un medicinale al bisogno non è mai `isLevel` (non ha
    `days_per_pack`), quindi il pulsante dipende da
    `defaultMode(category) === "livello"`.

#### R2.8 Altre viste

*   Calendario, foglio A4 (`app/(print)/piani/[id]/stampa`) e scheda terapia
    (`app/(print)/piani/[id]/terapia`) mostrano l'icona Presidio, il nome della
    categoria e la dose con la sua parola.
*   Le email (avvisi, riepilogo, promemoria) mostrano il pallino del colore e il
    nome della categoria, senza SVG.
*   Lista farmacia: «2 confezioni da 1 flacone», con la parola del contenitore.

#### R2.9 Migrazione di R2

Un unico file, `supabase/migrations/20261118000100_categories.sql`, in
transazione. Prima si fa un `pg_dump` del database di produzione. Il deploy della
migrazione e del codice avviene fuori dagli orari dei cron (07:00 e 17:00 UTC).

1.  `alter table medications add column category text`.
2.  `update` con un `CASE` su (form, shape), secondo questa tabella. Il check
    di oggi su `shape` ammette solo queste 11 coppie:

    | form | shape | category | shape dopo | modo |
    | --- | --- | --- | --- | --- |
    | compressa | tonda, ovale, capsula (3) | pillola | invariata | pezzi |
    | iniezione | siringa, penna, fiala (3) | iniezione | `null` | pezzi |
    | cerotto | cerotto, cerotto-tondo, bustina (3) | cerotto | `null` | pezzi |
    | collirio | flacone | gocce | `null` | livello (`days_per_pack` = vecchio `reorder_days`) |
    | collirio | monodose | gocce | `null` | pezzi |

    I cerotti in bustina restano cerotti: oggi si creano solo da una forma AIFA
    di cerotto. Penne, fiale e siringhe prendono la parola «siringhe».
3.  `do $$ … assert not exists (select 1 from medications where category is
    null) … $$`.
4.  `alter column category set not null` e check sui 10 valori.
5.  `drop constraint medications_reorder_days_flacone`, poi
    `rename column reorder_days to days_per_pack`. Oggi questo vincolo
    garantisce che solo i flaconi abbiano `reorder_days`, quindi dopo la
    rinomina sono a livello solo gli ex flaconi.
6.  Flaconi (`shape = 'flacone'`): `stock_qty = 1`, `pills_per_pack = 1`,
    `stock_as_of` invariato. Per i flaconi al bisogno anche
    `days_per_pack = null`. Poi un secondo `assert`: ogni flacone ha
    `days_per_pack` oppure è al bisogno.
7.  `drop constraint medications_shape_check`, `alter column shape drop not
    null`, `update … set shape = null where category <> 'pillola'`, poi il nuovo
    check su `shape`.
8.  `drop column form` (con il suo check).
9.  Tipi e limiti: si cambiano tipo e check di dosi, `stock_qty`,
    `pills_per_pack`, `stock_events.delta` e `stock_events.qty_after`,
    ricreando i check con il loro nome. Nelle migrazioni non ci sono viste. Gli
    unici vincoli a passi di 0,5 sono `mod(x * 2, 1) = 0` su `stock_qty` e
    sulle tre dosi: quello su `stock_qty` si toglie, quelli sulle dosi restano
    con il nuovo limite. Le RPC rimaste prendono `p_qty_after numeric` senza
    arrotondare.
10. Check `days_per_pack` con `as_needed`.

### Ordine di rilascio

1.  R1: `pg_dump` di produzione, migrazione `daily_stock`, codice di R1, poi
    un'email scritta a mano dall'autore a chi usava il portapillole
    settimanale: da ora le scorte scendono ogni giorno, e quando si riconta si
    conta anche ciò che è nel portapillole.
2.  R2: `pg_dump` di produzione, migrazione `categories`, codice di R2, poi
    un'email scritta a mano dall'autore ai proprietari dei piani che la prova
    sui dati veri elenca: piani con tutti gli avvisi spenti e almeno un
    flacone (il flacone non manda più il promemoria), e flaconi con uno
    schema non giornaliero. I glifi nuovi possono essere semplici all'inizio.
    Le icone nel calendario e nella stampa possono arrivare dopo il Dispenser,
    purché parole e nomi di categoria siano già giusti.
3.  In entrambi i rilasci i README di contratto delle cartelle toccate si
    aggiornano nello stesso commit.

## Alternatives Considered

### A. Tenere le categorie fatte a mano di oggi

*   **Pro:** nessuna migrazione; il codice di oggi funziona.
*   **Contro:** sciroppi, inalatori, creme, bustine e supposte restano senza
    posto; la scelta dipende dall'esperienza di chi inserisce il medicinale.
*   **Decisione:** scartata. Le categorie fatte a mano non coprono l'elenco
    AIFA che l'app già importa. ([brief, Key Decisions](./concepts_brief.md#key-decisions--staging-for-next-steps))

### B. Tenere `form` accanto a `category`

*   **Pro:** migrazione più leggera; il codice che legge `form` (una quarantina
    di file) può cambiare poco alla volta.
*   **Contro:** due tassonomie da tenere allineate, con il rischio che dicano cose
    diverse sullo stesso medicinale.
*   **Decisione:** scartata. La nuova tassonomia sostituisce la vecchia, e
    tenerle entrambe raddoppia i casi da gestire. ([brief, Key Decisions](./concepts_brief.md#key-decisions--staging-for-next-steps))

### C. Migrare con la tabella ALIAS del design

*   **Pro:** la tabella ALIAS del progetto grafico, che traduce le vecchie forme
    (`shape`) nelle nuove categorie, esiste già.
*   **Contro:** trasforma i cerotti in bustina (`shape = 'bustina'`) in bustine
    orali e manda le compresse in `altro`.
*   **Decisione:** scartata. Produce categorie sbagliate su righe esistenti; la
    migrazione usa un `CASE` su (form, shape) che copre tutte le 11 coppie
    ammesse. ([brief, Alternatives Weighed](./concepts_brief.md#alternatives-weighed), prima revisione)

### D. Portapillole solo per pillola, bustina e supposta, con due regole di discesa

*   **Pro:** conserva la discesa settimanale per chi la usa.
*   **Contro:** nei piani settimanali iniezioni e cerotti non scenderebbero più,
    oppure servirebbe una seconda regola di discesa per categoria; il codice
    settimanale (RPC, `prep_runs`, rami in `lib/forecast.ts`) resta.
*   **Decisione:** scartata. Il portapillole prende tutto ciò che è
    programmato, quindi la discesa settimanale si toglie e il portapillole
    diventa un promemoria. ([brief, Key Decisions](./concepts_brief.md#key-decisions--staging-for-next-steps))

### E. Migrazione in tre fasi con tabella di backup e prova a secco degli avvisi

*   **Pro:** si può tornare indietro senza `pg_dump`; si vedono in anticipo le
    email che partiranno.
*   **Contro:** tre migrazioni, una tabella in più da cancellare dopo, codice che
    deve funzionare con entrambi gli schemi.
*   **Decisione:** scartata. Con un'app in alpha e poche famiglie, un
    `pg_dump` prima della migrazione basta. ([brief, Key Decisions](./concepts_brief.md#key-decisions--staging-for-next-steps))

### F. `count_mode` come colonna salvata

*   **Pro:** il modo di conteggio è esplicito e si legge con una query.
*   **Contro:** «a livello» equivale ad «ha `days_per_pack`»; una seconda colonna
    può andare fuori sincrono e chiede un vincolo in più.
*   **Decisione:** scartata. Il modo si ricava da `days_per_pack`. Anche il
    nome `stock_mode` era stato scartato perché si confonde con
    `plans.stock_mode`. ([brief, Alternatives Weighed](./concepts_brief.md#alternatives-weighed), seconda revisione)

### G. `pack_volume` salvato, con consumo = dose ÷ volume

*   **Pro:** il consumo segue i cambi di dose; non serve aggiornare a mano
    «quanti giorni dura».
*   **Contro:** una colonna in più, una regola di precedenza con
    `days_per_pack`, nuovi limiti; per colliri e creme nessuno conosce il volume
    per dose, e i dati AIFA spesso non hanno il volume.
*   **Decisione:** scartata. Le stesse ragioni valgono per la precompilazione
    di `days_per_pack` da volume ÷ dose, che il brief teneva: il volume della
    scatola è in ml o g, la dose spesso in gocce o applicazioni, e il numero
    proposto sarebbe sbagliato. ([brief, Alternatives Weighed](./concepts_brief.md#alternatives-weighed), seconda revisione; precompilazione
    tolta nella fase 5, [zoom_out_report.md](./zoom_out_report.md) M1)

### H. Modello con unità esplicite (`pack_unit`, `dose_unit`)

*   **Pro:** il più generale: ogni medicinale dice in che unità si conta e si
    dosa.
*   **Contro:** più colonne, più controlli e più conversioni di quante ne servano
    per dieci categorie.
*   **Decisione:** scartato. Troppe colonne e controlli per un'app in alpha;
    le parole per (categoria, modo) in `lib/categories.ts` coprono i casi noti
    senza colonne nuove. ([brief, Alternatives Weighed](./concepts_brief.md#alternatives-weighed))

### I. Scorta a livello in ml o gocce

*   **Pro:** la scorta ha un significato fisico preciso.
*   **Contro:** il fattore gocce/ml non è noto; lo storico di `stock_events`
    mescolerebbe contenitori e millilitri.
*   **Decisione:** scartata. La scorta a livello si conta in contenitori, che
    l'utente sa contare. ([brief, Alternatives Weighed](./concepts_brief.md#alternatives-weighed))

### J. Mappatura AIFA con le sole parole chiave, senza eccezioni

*   **Pro:** una regola sola, facile da leggere.
*   **Contro:** circa dieci forme AIFA classificate male. Le eccezioni e1–e7
    di R2.5 ne coprono le classi, per esempio GEL dentro GELATINOSA o POLVERE
    PER INALAZIONE in capsule classificata come pillola.
*   **Decisione:** scartata. Una breve lista di eccezioni, controllata prima
    delle parole chiave, elimina quelle classi di errori. ([brief, Alternatives Weighed](./concepts_brief.md#alternatives-weighed), prima revisione)

### K. Spareggio con il codice ATC e fixture con tutte le forme AIFA

*   **Pro:** classificazione più precisa sui casi ambigui; copertura completa dei
    test.
*   **Contro:** una seconda fonte di verità da mantenere; una fixture grande da
    aggiornare a ogni import AIFA.
*   **Decisione:** scartata. Con almeno 20 forme reali nei test e il fallback
    `altro`, un errore si corregge dal selettore del modulo (e, se cambia il
    modo, con un riconteggio). ([brief, Alternatives Weighed](./concepts_brief.md#alternatives-weighed))

### L. Etichette di uso comune («Compresse e capsule», «Supposte e ovuli») (rimandata)

*   **Pro:** più chiare per chi non conosce il design.
*   **Contro:** non coincidono con il progetto grafico.
*   **Decisione:** rimandata. Per ora si usano le etichette del design, per
    coerenza; cambiarle dopo vuol dire cambiare una riga per categoria in
    `lib/categories.ts`. ([brief, Alternatives Weighed](./concepts_brief.md#alternatives-weighed))

### M. Cancellare e reinserire i medicinali da sistemare

*   **Pro:** nessun caso speciale nella migrazione.
*   **Contro:** si perde lo storico di `stock_events` e di `alert_log`.
*   **Decisione:** scartata. Le correzioni in SQL tengono lo storico e coprono
    tutti i casi noti. ([brief, Alternatives Weighed](./concepts_brief.md#alternatives-weighed))

### N. Segnale «da ricontrollare» sui medicinali migrati

*   **Pro:** rete di sicurezza per righe migrate male.
*   **Contro:** con le correzioni in SQL nessuna riga lo accenderebbe (piani
    settimanali sistemati con `stock_as_of`, flaconi normalizzati a 1, tutte le
    coppie coperte, cerotti in bustina che sono cerotti veri).
*   **Decisione:** scartato. Nessuna riga migrata lo accenderebbe, quindi
    sarebbe una colonna e un'etichetta senza effetto. Confermato dall'autore
    il 2026-11-16. ([brief, Key Decisions](./concepts_brief.md#key-decisions--staging-for-next-steps), punto 1)

### O. Una sola parola per categoria, senza eccezioni per il modo

*   **Pro:** la tabella del brief resta di una riga per categoria.
*   **Contro:** con il modo non di default le parole diventano sbagliate: 30
    colliri monodose diventano «30 flaconi», 40 unità di insulina in una penna
    diventano «40 siringhe».
*   **Decisione:** scartata. Due eccezioni (gocce a pezzi, iniezione a livello)
    nella stessa tabella di R2.3 bastano a dare le parole giuste. Confermato
    dall'autore il 2026-11-16.

## Risks & Mitigations

| Rischio | Impatto | Mitigazione | Dove |
| --- | --- | --- | --- |
| Al primo cron dopo R2 gli avvisi di soglia arrivano prima di quanto arrivava il promemoria del flacone, e parte un'email «ultima confezione» per flacone. | Qualche email in più, una volta. | Accettato nel brief. | R2.4, CUJ 5 |
| Un flacone in un piano con tutti gli avvisi spenti non manda più il promemoria. | La persona resta senza collirio senza preavviso. | La prova sui dati veri elenca questi piani; l'autore scrive ai proprietari. | R2.4, Ordine di rilascio |
| Un flacone con uno schema non giornaliero ha la data di esaurimento più avanti. | Avvisi più tardi di oggi. | La prova sui dati veri elenca questi flaconi; l'autore corregge `days_per_pack`. | R2.4, Verification Plan |
| Un piano settimanale con X molto nel passato (preparazione non registrata da settimane). | Copertura a 0 al primo cron e avvisi per tutti i medicinali. | La prova di R1 elenca i piani con X più vecchio di 7 giorni; l'autore decide a mano. | R1.4, Verification Plan |
| Un piano settimanale con il promemoria spento perde il giorno di inizio del calendario. | Il calendario comincia dal lunedì. | Accettato: basta riaccendere il promemoria. | R1.1 |
| L'utente scrive i giorni di calendario al posto dei giorni di uso («un tubo mi dura un mese» per una crema a giorni alterni). | La copertura si allunga e gli avvisi arrivano tardi. | Etichetta «Per quanti giorni di uso dura un {contenitore}?». | R2.2, R2.6 |
| Il modo di conteggio di partenza è sbagliato (per esempio una penna non riconosciuta). | Consumo sbagliato: la copertura crolla o si allunga. | `categoryFromAifa` legge PENNA, MULTIDOSE e MONODOSE; il link «Conta a pezzi / a giorni» corregge. | R2.5, R2.6 |
| Una forma AIFA non riconosciuta. | Categoria `altro` e parole generiche. | Si corregge con un tocco nel selettore; i test coprono ogni riga della tabella. | R2.5 |
| Il riconteggio a livello ha solo quattro valori per il contenitore aperto. | Un riconteggio può spostare gli avvisi di qualche giorno. | Accettato: si può ricontare quando serve. | R2.7 |
| Il codice vecchio legge le colonne tolte durante il deploy. | Errori nei cron. | Migrazione e codice si pubblicano uno dopo l'altro fuori dagli orari dei cron. | NFR |
| Il rollback ripristina il `pg_dump`. | Si perdono le modifiche fatte dopo il dump, compreso `alert_log`. | Rollback solo nelle prime ore dopo il rilascio. | NFR |
| Chi usava il portapillole settimanale riconta come prima, senza le compresse nel portapillole. | Scorta più bassa del vero, avvisi anticipati. | La domanda di riconteggio cita il portapillole; email dell'autore dopo R1. | R1.2, Ordine di rilascio |

## Non-Functional Requirements

*   **Rollout e rollback.** Ogni rilascio ha una sola migrazione in
    transazione: se un'istruzione fallisce (compreso l'`assert` di R2.9), non
    cambia niente. Prima di ciascun rilascio si fa un `pg_dump` di produzione.
    Il rollback di R1 o di R2 dopo il commit è il ripristino del `pg_dump` più
    il deploy del codice precedente. Si perdono le modifiche fatte dopo il
    dump, compreso `alert_log`, quindi alcuni avvisi possono ripartire: il
    rollback ha senso solo nelle prime ore. Migrazione e codice si
    pubblicano uno dopo l'altro fuori dagli orari dei cron (07:00 e 17:00 UTC),
    perché il codice vecchio legge le colonne tolte.
*   **Sicurezza.** `drop table prep_runs` cancella anche le sue regole RLS. Le
    colonne nuove di `medications` ricadono sotto le regole RLS di tabella già
    esistenti. Nessuna nuova RPC.
*   **Prestazioni.** `consumptionOn` ha lo stesso costo di `dosesOn`: il ciclo
    di `coveredDaysFrom` (al massimo `HORIZON_DAYS`) non cambia.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

Le migrazioni già pubblicate non si toccano: lo schema cambia solo con i due file
nuovi. I percorsi sono relativi alla radice del repository, e i numeri di riga
sono quelli del codice al 2026-11-16. La numerazione non è progressiva: ogni
punto sta nella sezione del suo rilascio, e i numeri 37 e 43 non sono usati.

### Rilascio 1: scorte giorno per giorno

#### Database

##### 1. `supabase/migrations/20261117000100_daily_stock.sql` (Create)

*   **Tipo:** migrazione SQL, in transazione.
*   **Modifiche:** i passi di R1.4, in quest'ordine:
    1.  `drop function public.apply_prep(uuid, date, date, jsonb)`,
        `public.undo_prep(uuid, date)` e
        `public.change_stock_mode(uuid, text, date, jsonb)`.
    2.  Una sola istruzione che calcola X e sposta `stock_as_of`:

        ```sql
        with last_run as (
          select r.plan_id, max(r.week_start) as week_start
          from public.prep_runs r
          join public.plans p on p.id = r.plan_id
          where r.undone_at is null
            and r.week_start + 6 >= p.mode_since
          group by r.plan_id
        ),
        weekly_start as (
          select p.id as plan_id,
                 b.base + ((p.prep_weekday - extract(isodow from b.base)::int + 7) % 7) as x
          from public.plans p
          left join last_run l on l.plan_id = p.id
          cross join lateral (select coalesce(l.week_start + 1, p.mode_since) as base) b
          where p.stock_mode = 'weekly'
        )
        update public.medications m
        set stock_as_of = greatest(m.stock_as_of, w.x)
        from weekly_start w
        where m.plan_id = w.plan_id and m.reorder_days is null;
        ```

        X è il primo `prep_weekday` dopo l'ultima settimana preparata nel
        periodo settimanale in corso (`week_start + 6 >= mode_since`, come
        `relevantRuns` in `lib/forecast.ts:259–263`), oppure, senza
        preparazioni, il primo `prep_weekday` da `mode_since` in poi. È la
        stessa regola di `nextPrepDue` (`lib/forecast.ts:278`). I flaconi non
        si spostano.
    3.  `update public.plans set prep_reminder = (prep_reminder and
        stock_mode = 'weekly')`, poi `alter table public.plans alter column
        prep_reminder set default false`.
    4.  `drop table public.prep_runs`.
    5.  `alter table public.plans drop column stock_mode, drop column
        mode_since`.
*   **Perché:** toglie la discesa settimanale senza chiedere un nuovo conteggio,
    e lascia il promemoria solo a chi lo usava.

##### 2. `supabase/seed.sql` (Modify)

*   **Tipo:** dati di sviluppo, eseguiti a mano.
*   **Modifiche:** si tolgono `stock_mode` e `mode_since` dall'`insert` di
    `plans`. Il piano di esempio, che era `'weekly'`, prende
    `prep_reminder = true`.
*   **Perché:** il seed deve girare sullo schema nuovo.

#### Logica di dominio

##### 3. `lib/forecast.ts` (Modify)

*   **Tipo:** modulo TypeScript, funzioni pure.
*   **Modifiche:**
    *   Si tolgono `StockMode`, `PrepRunData`, `PrepItem`, `relevantRuns`,
        `latestActiveRun`, `nextPrepDue`, `prepWeekStart`, `computePrep`,
        `applyPrep` e `undoPrep`, e gli import che restano inutili
        (`onOrAfterWeekday`, se nessun'altra funzione lo usa).
    *   `calendarWeekStart(date, plan)`: prende
        `Pick<PlanSettings, "prepReminder" | "prepWeekday">` e restituisce
        `onOrBeforeWeekday(date, plan.prepReminder ? plan.prepWeekday : 1)`.
        `lib/week.ts` e le pagine del calendario e del foglio A4 non cambiano.
    *   `PlanSettings`: `{ prepWeekday, prepReminder, alertUnder14,
        alertUnder7, alertLastPack }`.
    *   `currentStock(med, today)`: senza parametro `mode`.
    *   `Forecast`: senza `homeDays` e `nextPrepNeed`.
    *   `ForecastContext`: `{ plan, today }`.
    *   `forecastMedication`: senza il ramo `weekly` e senza
        `notEnoughForPrep`. La copertura parte da
        `from = maxDate(today, med.stockAsOf)`:
        `coverageDays = diffDays(today, from) + coveredDaysFrom(med, stock, from)`,
        e resta `null` quando `coveredDaysFrom` restituisce `null`. Così i
        giorni già nel portapillole dopo la migrazione contano come coperti.
    *   `statusReason(f, endDate)`: senza `mode` e senza i due testi
        settimanali.
    *   `PlanForecast`: senza `nextPrep`, `prepOverdue`, `latestRun`,
        `prepWeek` e `prepPreview`. `forecastPlan(plan, meds, today)`.
*   **Perché:** una sola regola di discesa (R1.1). `maxDate` resta
    importato.

##### 4. `lib/digest.ts` (Modify)

*   **Tipo:** modulo TypeScript, funzioni pure.
*   **Modifiche:** `buildReminderItems(meds, prep, prepDate)` diventa
    `buildPrepReminderItems(meds, prepDate)`. Filtra i medicinali non al
    bisogno e non conclusi alla data `prepDate`, calcola
    `dosesBetween(m, prepDate, prepDate + 6)` e tiene quelli con somma > 0.
    Restituisce il nuovo `ReminderItem` (punto 17).
*   **Perché:** il contenuto del promemoria non dipende più da `computePrep`
    (R1.3).

##### 5. `lib/notify.ts` (Modify)

*   **Tipo:** modulo server.
*   **Modifiche:**
    *   `planForecast` chiama `forecastPlan(settings, meds, today)`.
    *   In `runPrepReminders` il filtro diventa `(p) => p.prep_reminder`, e il
        builder restituisce `null` se `isoWeekday(tomorrow) !== p.prep_weekday`.
        Le voci vengono da `buildPrepReminderItems(meds, tomorrow)`.
    *   In `runWeeklySummaries` si toglie `nextPrep: fc.nextPrep` (riga 168).
    *   Si toglie l'import di `toPrepRun` (riga 5).
*   **Perché:** il promemoria parte per chi lo ha acceso, il giorno prima della
    preparazione.

##### 6. `lib/pharmacy.ts` (Modify)

*   **Tipo:** modulo TypeScript.
*   **Modifiche:** `buildPharmacyItems(items, today)` senza `nextPrep`; per
    ogni medicinale `start = maxDate(today, med.stockAsOf)`. Si aggiorna il
    commento di `suggestedPacks`.
*   **Perché:** non c'è più una prossima preparazione da cui partire.

##### 7. `lib/alerts.ts` (Modify)

*   **Tipo:** modulo server.
*   **Modifiche:**
    *   `runDailyAlerts` non legge più le preparazioni: si tolgono
        `runsByPlan`, l'argomento costruito con `toPrepRun` (righe 89 e
        99–104) e l'import di `toPrepRun` (riga 4).
    *   `buildPlanEmail` non passa più `nextPrep: forecast.nextPrep` (riga 47).
*   **Perché:** il campo `nextPrep` sparisce da `PlanForecast`.

##### 8. `lib/view.ts` (Modify)

*   **Tipo:** modulo TypeScript.
*   **Modifiche:** `dispenserView(med, f, today)` senza `mode`; chiama
    `statusReason(f, med.endDate)`.
*   **Perché:** segue la nuova firma di `statusReason`.

##### 9. `lib/db-types.ts` (Modify)

*   **Tipo:** tipi delle righe del database.
*   **Modifiche:** `PlanRow` senza `stock_mode` e `mode_since`; si tolgono
    `PrepRunRow` e `toPrepRun`. `PLAN_COLUMNS` (riga 129) senza le due colonne.
    `toPlanSettings` restituisce il nuovo `PlanSettings`, con
    `prepReminder`. `StockEventType` mantiene `prep` e `prep_undo`.
*   **Perché:** allineamento allo schema di R1.

##### 10. `lib/data.ts` (Modify)

*   **Tipo:** lettura dati per le pagine.
*   **Modifiche:** si tolgono le due query su `prep_runs` (righe 88 e 121) e i
    campi che le restituiscono.
*   **Perché:** la tabella `prep_runs` non esiste più.

##### 11. `lib/cron-data.ts` (Modify)

*   **Tipo:** lettura dati per i cron.
*   **Modifiche:** si toglie la lettura di `prep_runs` (righe 42–43) e il campo
    `runs` di `CronData`.
*   **Perché:** la tabella `prep_runs` non esiste più.

##### 12. `lib/usage.ts` e `lib/usage-stats.ts` (Modify)

*   **Tipo:** statistiche d'uso.
*   **Modifiche:** `lib/usage.ts` non legge più `prep_runs`. In
    `lib/usage-stats.ts` il campo `preps` sparisce da `UsageRaw` (riga 17) e
    da `summarizeUsage` (righe 41 e 53), dove oggi entra nei «Movimenti
    registrati» e nel conteggio degli utenti attivi.
*   **Perché:** la tabella `prep_runs` non esiste più.

##### 13. `lib/schemas.ts` (Modify)

*   **Tipo:** schemi zod.
*   **Modifiche:** `planSchema` perde `stock_mode` e `counts` (righe 29–32);
    `prep_reminder: z.boolean().default(false)`.
*   **Perché:** il default di un piano nuovo è senza promemoria, e il
    riconteggio al cambio di modo sparisce.

##### 14. `lib/actions/plans.ts` (Modify)

*   **Tipo:** server action.
*   **Modifiche:** si toglie la chiamata a `change_stock_mode` con il ramo del
    cambio di modo e dei conteggi (righe 75–94). Creazione e modifica del
    piano scrivono solo le colonne rimaste.
*   **Perché:** la RPC non esiste più.

##### 15. `lib/actions/stock.ts` (Modify)

*   **Tipo:** server action.
*   **Modifiche:**
    *   si tolgono `preparePillbox` e `undoPillbox`;
    *   le altre azioni chiamano `currentStock(med, today)` e
        `forecastMedication(med, { plan, today })` con le nuove firme;
    *   date della scorta salvata (R1.1), sia in `stock_as_of` sia in
        `effective_date` dell'evento:
        *   `arrivePacks` e `takeAsNeeded` cambiano la scorta in casa: data
            `maxDate(today, med.stockAsOf)`;
        *   `recountStock` conta tutto, anche il portapillole: data `today`;
        *   `undoStockEvent` (righe 115–148) usa la data dell'evento che
            annulla: `maxDate(today, med.stockAsOf)` per `arrival` e `use`,
            `today` per `count`;
    *   `closeEpisodesIfAbove` (riga 31) riceve la data della scorta appena
        salvata e la usa come `stockAsOf` al posto di `bundle.today`; lo
        stesso vale per la previsione `fNew` di `recountStock` (riga 77).
*   **Perché:** il pannello del portapillole sparisce. Un riconteggio datato
    nel futuro lascerebbe le dosi del portapillole senza scalarle, e gli
    avvisi arriverebbero tardi.

##### 16. `lib/actions/medications.ts` (Modify)

*   **Tipo:** server action.
*   **Modifiche:** la chiamata a `currentStock` (riga 96) segue la nuova
    firma. In `updateMedication`:
    *   senza una scorta nuova, la scorta riportata ha data
        `maxDate(today, med.stockAsOf)`;
    *   con una scorta scritta nel modulo, che conta anche il portapillole, la
        data è `today`;
    *   l'evento che segue (`record_stock_event`, righe 117–128) passa
        `p_expected_as_of` uguale a quella data, non `bundle.today`
        (riga 125).
*   **Perché:** compilazione, e la stessa regola del punto 15.

##### 17. `lib/email/templates.ts` (Modify)

*   **Tipo:** template email.
*   **Modifiche:**
    *   `ReminderItem` perde `need` e `missing` (righe 57–60): restano nome,
        dosaggio, colore, `phrase` e `changeNote`.
    *   `renderPrepReminderEmail`: l'introduzione (riga 84) diventa «{Giorno}
        è il giorno di preparazione. Ecco le dosi dei 7 giorni da mettere nel
        portapillole.»; spariscono la riga «Da mettere», il chip «Ne mancano»,
        l'avviso «Attenzione: mancano…» e il riquadro «In casa c'è tutto: N
        compresse in tutto» (righe 94, 103, 120), anche nella versione testo
        (riga 122). Ogni scheda mostra le dosi e l'eventuale cambio di dose.
    *   `renderWeeklySummaryEmail`: senza la frase «Prossima preparazione del
        portapillole» (riga 178) e senza il campo `nextPrep`.
*   **Perché:** R1.1 e R1.3. Il promemoria comprende anche flaconi e siringhe,
    quindi un totale in compresse non ha senso.

##### 18. `lib/email/alert-template.ts` (Modify)

*   **Tipo:** template email.
*   **Modifiche:** si toglie `nextPrep` da `AlertEmailData` e dalla frase per il
    medico (riga 84).
*   **Perché:** R1.1.

#### Interfaccia

##### 19. `components/PrepPanel.tsx` (Delete)

*   **Perché:** il pulsante «Portapillole preparato» e il suo annullamento
    spariscono.

##### 20. `components/PlanForm.tsx` (Modify)

*   **Tipo:** componente client.
*   **Modifiche:**
    *   si toglie la scelta tra «giorno per giorno» e «portapillole
        settimanale», con il riconteggio al cambio di modo: righe 7 (import di
        `StockMode`), 14–21 e 27 (`PlanFormMed`, prop `meds`, import di
        `Pill`), 32–35 (`MODES`), 48 (`counts`), 54 (`modeChanged`), 73–81 e
        136–194 (riquadro «Modalità delle scorte», compreso il blocco
        164–193). Restano `error`, `fieldErrors`, `confirmDelete` e `pending`
        (righe 49–53);
    *   l'interruttore «Promemoria del portapillole» compare sempre (oggi solo
        con `stock_mode === "weekly"`, riga 232), con valore di riserva
        `?? false` (riga 234) e sottotitolo «La sera prima del giorno di
        preparazione, con le dosi dei 7 giorni. Il calendario e il foglio A4
        cominciano da quel giorno.» (riga 237);
    *   il riquadro «Giorno di preparazione» compare solo con l'interruttore
        acceso; il testo della riga 199 diventa «Il giorno in cui riempi il
        portapillole.».
*   **Perché:** R1.2. Il sottotitolo dice che l'interruttore sposta anche
    l'inizio della settimana (R1.1).

##### 21. `components/PlanHeader.tsx` (Modify)

*   **Tipo:** componente.
*   **Modifiche:** la riga della modalità (riga 9) diventa «Promemoria del
    portapillole {giorno}» se `prep_reminder` è acceso, altrimenti niente.
*   **Perché:** `stock_mode` non esiste più.

##### 22. `components/Dispenser.tsx` (Modify)

*   **Tipo:** componente client.
*   **Modifiche:** nuova prop facoltativa `prepReminder?: boolean` (default
    `false`, così l'anteprima in `MedicationForm.tsx:591` non cambia). Il
    titolo del riconteggio è «Quante ne hai in tutto?», con «, comprese quelle
    nel portapillole» quando è `true`.
*   **Perché:** R1.2.

##### 23. `components/DispenserGrid.tsx` (Modify)

*   **Tipo:** componente client.
*   **Modifiche:** nuova prop `prepReminder: boolean`, passata a ogni
    `Dispenser`.
*   **Perché:** R1.2.

##### 24. `app/(app)/piani/[id]/page.tsx` (Modify)

*   **Tipo:** pagina.
*   **Modifiche:** non mostra più `PrepPanel` e non legge `prepPreview`,
    `prepWeek` o `latestRun`; si tolgono `weekly` (riga 25), la prima cella
    settimanale (righe 52–77) e il `mode` nella chiamata a `dispenserView`
    (riga 26); passa `prepReminder={b.settings.prepReminder}` a
    `DispenserGrid` (riga 137). Si tolgono gli import che restano inutili:
    `addDays`, `dateOfTimestampRome`, `formatRange`, `formatRelative`,
    `formatTimeRome`, `formatQty`, `IconAlertCircle` e `IconXCircle`.
*   **Perché:** R1.2.

##### 25. `app/(app)/piani/page.tsx` (Modify)

*   **Tipo:** pagina.
*   **Modifiche:** la riga «Prossima preparazione» (righe 63–66) e la
    dicitura «settimanale / giorno per giorno» (righe 71 e 84) spariscono;
    resta «Copertura minima» per tutti i piani.
*   **Perché:** `nextPrep` e `stock_mode` non esistono più.

##### 26. `app/(app)/piani/nuovo/page.tsx` e `app/(app)/piani/[id]/modifica/page.tsx` (Modify)

*   **Tipo:** pagine.
*   **Modifiche:** non passano più `stock_mode` né `meds` a `PlanForm`. In
    `nuovo/page.tsx` il valore iniziale diventa `prep_reminder: false`
    (oggi `true`, riga 22).
*   **Perché:** il modulo non ha più il riconteggio, e un piano nuovo parte
    senza promemoria (Goal 3).

##### 27. `app/(app)/piani/[id]/farmacia/page.tsx`, `app/(app)/piani/[id]/medicinali/[medId]/page.tsx`, `app/(app)/piani/[id]/medicinali/nuovo/page.tsx` e `components/MedicationForm.tsx` (Modify)

*   **Tipo:** pagine e componente client.
*   **Modifiche:**
    *   le pagine non leggono `nextPrep` e non lo passano a `MedicationForm`;
        la farmacia chiama `buildPharmacyItems(items, today)`;
    *   `components/MedicationForm.tsx` perde la prop `nextPrep` e il ramo
        `settings.stockMode === "weekly"` (righe 33, 95 e 193–194), con i
        testi che dipendono da quel ramo; chiama
        `forecastMedication(med, { plan: settings, today })` e
        `dispenserView(med, fc, today)`.
*   **Perché:** compilazione (Goal 7).

#### Test di R1

##### 28. `tests/forecast.test.ts` (Modify)

*   **Modifiche:** si tolgono i test di `computePrep`, `nextPrepDue`,
    `prepWeekStart` e del ramo settimanale. Il test di `calendarWeekStart`
    resta e usa `prepReminder` al posto di `stockMode`. Si aggiunge: la scorta
    scende ogni giorno a partire da `stock_as_of`, con le stesse coperture di
    prima per un piano che era giornaliero (Goal 2); un medicinale con
    `stock_as_of = oggi + 3` ha 3 giorni di copertura in più di uno con
    `stock_as_of = oggi` e la stessa scorta.

##### 29. `tests/digest.test.ts` (Modify)

*   **Modifiche:** test di `buildPrepReminderItems`: esclude i medicinali al
    bisogno e conclusi; include quelli con dosi nei 7 giorni, anche flaconi e
    siringhe; riporta il cambio di dose che cade nella settimana.

##### 30. `tests/pharmacy.test.ts`, `tests/alert-template.test.ts`, `tests/email-templates.test.ts`, `tests/usage.test.ts`, `tests/actions.test.ts` (Modify)

*   **Modifiche:** si tolgono `nextPrep`, `preps`, `need`, `missing`,
    `stock_mode` e `mode_since` dagli input e dalle attese. Casi nuovi:
    *   `tests/actions.test.ts`: un piano creato con i valori iniziali del
        modulo ha `prep_reminder = false`; con `stock_as_of` nel futuro,
        `recountStock` salva a oggi e `arrivePacks` salva alla data
        `stock_as_of`;
    *   `tests/email-templates.test.ts`: il promemoria non contiene
        «Portapillole preparato», «Da mettere» né «In casa c'è tutto».

##### 31. `tests/helpers/fixtures.ts` (Modify)

*   **Modifiche:** `PlanSettings` e `PlanRow` di prova senza i campi tolti, con
    `prepReminder`.

##### 32. `tests/db/cron.db.test.ts` (Modify)

*   **Modifiche:** l'`insert` del piano (riga 42) perde `stock_mode` e
    `mode_since`. Il promemoria parte per un piano con `prep_reminder = true`
    quando domani è `prep_weekday`; non parte con `prep_reminder = false`;
    non parte negli altri giorni (Goal 3).
*   **Nota:** la migrazione di R1 non ha un test automatico. `tests/db`
    lavora su un database già migrato e non può caricare righe dello schema
    vecchio; la migrazione si verifica a mano sul dump dei dati veri
    (Verification Plan).

#### Documentazione di R1

##### 33. README di contratto (Modify)

*   `lib/README.md`, `lib/actions/README.md`, `lib/email/README.md`,
    `components/README.md`, `supabase/README.md`,
    `supabase/migrations/README.md`, `app/(app)/piani/README.md`,
    `app/(app)/piani/[id]/README.md`, `app/(app)/piani/nuovo/README.md`
    (righe 9–10: piano nuovo senza promemoria),
    `app/(app)/piani/[id]/farmacia/README.md`,
    `app/(app)/piani/[id]/calendario/README.md`,
    `app/api/cron/reminders/README.md` e `README.md`.
*   **Modifiche:** si toglie ogni riferimento alla modalità settimanale, a
    `prep_runs` e alle tre RPC; si descrive il promemoria nuovo.

### Rilascio 2: dieci categorie

#### Database

##### 34. `supabase/migrations/20261118000100_categories.sql` (Create)

*   **Tipo:** migrazione SQL, in transazione.
*   **Modifiche:** i passi di R2.9. Il `CASE` per `category` segue la tabella
    delle 11 coppie di R2.9: la categoria dipende solo da `form`, e `shape`
    decide solo se resta; il modo viene da `days_per_pack`, cioè dal vecchio
    `reorder_days`. Due blocchi `do $$ … assert … $$`: dopo il passo 2
    nessuna `category` è nulla; dopo il passo 6 ogni flacone ha
    `days_per_pack is not null` oppure `frequency_type = 'as_needed'`.
    `stock_qty`, `stock_events.delta` e `stock_events.qty_after` diventano
    `numeric` senza scala. I check si ricreano con i nomi
    `medications_dose_morning_check`, `medications_dose_noon_check`,
    `medications_dose_evening_check`, `medications_stock_qty_check`,
    `medications_pills_per_pack_check` e i loro equivalenti in
    `dose_changes`. Il check di `reorder_days` era scritto nella colonna e
    dopo la rinomina si chiama ancora `medications_reorder_days_check`: si
    cancella con `drop constraint` e si ricrea come
    `medications_days_per_pack_check`. Nuovi vincoli:
    `medications_category_check`, `medications_shape_check`,
    `medications_days_per_pack_as_needed`.
*   **Perché:** R2.1 e R2.9.

##### 35. `supabase/seed.sql` (Modify)

*   **Modifiche:** l'`insert` di `medications` prende `category` (e
    `days_per_pack` per i medicinali a livello). `shape` resta solo per le
    pillole. Si aggiunge almeno un medicinale per ogni categoria, con uno
    sciroppo, un inalatore e una crema a livello.
*   **Perché:** il seed serve per provare l'app a mano con tutte le categorie.

#### Logica di dominio

##### 36. `lib/presidi.ts` → `lib/categories.ts` (Rename e Modify)

*   **Tipo:** modulo TypeScript, funzioni pure. Si rinomina il file con
    `git mv`, così resta la storia (non serve un punto a parte per
    cancellare `lib/presidi.ts`); la tabella delle parole e le funzioni
    `leftWord`, `doseWord`, `howMany` e `doseStep` esistono già e cambiano
    chiave, da `shape` a categoria e modo.
*   **API:**
    *   `CATEGORIES` (la tabella di R2.3), `type Category`, `CATEGORY_IDS`.
    *   `isLevel(m: { daysPerPack }): boolean` (al posto di
        `usesReorderDays`).
    *   `defaultMode(category): "pezzi" | "livello"`.
    *   `containerWord(m, n)`, `doseWord(m, n)`, `leftWord(m, n)`,
        `doseStep(m)`, `levelPhrase(stock, coverageDays, m)`.
    *   Al posto di `howMany`, quattro domande con un nome ciascuna:
        `perPackQuestion(m)` («Quante compresse in una confezione?»),
        `daysQuestion(m)` («Per quanti giorni di uso dura un tubo?») e
        `recountQuestion(m, prepReminder)` («Quanti cerotti hai in tutto?»,
        con «, compresi quelli nel portapillole» accordato al genere) e
        `doseQuestion(m)` per il titolo delle dosi nel modulo («Quante gocce»,
        «Quanti ml», oggi `howMany(f.shape)` in `MedicationForm.tsx:436`).
    *   `m` è `{ category, daysPerPack, frequencyType }`. Il modo delle
        parole è `frequencyType === "as_needed" ? defaultMode(category) :
        (isLevel(m) ? "livello" : "pezzi")`.
    *   `categoryFromForm(forma): Category`, con la tabella di eccezioni e
        parole chiave di R2.5.
    *   `levelPhrase(stock, coverageDays, m)` restituisce
        «circa {coverageDays} giorni · {quantità}». La quantità `q` si scrive
        con queste regole, nell'ordine, con il numero sempre in cifre:
        1.  `q ≤ 0`: «finito» / «finita»;
        2.  `q < 1`: «meno di un flacone» / «meno di una penna»;
        3.  resto `r = q − floor(q)` con `0,25 ≤ r < 0,75`:
            «{floor(q)} {containerWord(m, floor(q))} e mezzo» / «e mezza»
            («1 flacone e mezzo», «2 penne e mezza»);
        4.  altrimenti «{round(q)} {containerWord(m, round(q))}».

        Con `coverageDays === null` (terapia che finisce prima della scorta)
        la frase è solo la quantità.
*   **Perché:** una sola fonte per parole, modo e mappatura (R2.3, R2.5).

##### 38. `lib/forecast.ts` (Modify)

*   **Modifiche:**
    *   `MedicationData`: `category: Category`, `daysPerPack: number | null`
        al posto di `reorderDays`.
    *   Nuove `consumptionOn(med, day)` e `consumptionBetween(med, from, to)`
        (R2.2).
    *   `currentStock` e `coveredDaysFrom` usano `consumptionOn`.
        `coveredDaysFrom` prende il medicinale (con `daysPerPack`) al posto del
        solo `Schedule` (riga 357). La copertura parte sempre da
        `maxDate(today, med.stockAsOf)`, come in R1 (punto 3).
    *   I confronti di copertura usano l'`EPS` già presente nel file per i
        numeri decimali.
    *   Si tolgono il ritorno anticipato di `currentStock` su `reorderDays`
        (riga 252), il ramo `reorderDays` di `forecastMedication`,
        `Forecast.reorder` e il testo «È ora di riordinare il flacone».
    *   Si toglie `pillsWord`.
    *   `dosesPhrase(s, word?)` accetta una funzione `(n) => string` per la
        parola della dose; senza parametro resta com'è.
*   **Perché:** un solo calcolo di consumo per entrambi i modi; le frasi delle
    dosi dicono «ml», «gocce» o «erogazioni».

##### 39. `lib/pharmacy.ts` (Modify)

*   **Modifiche:**
    *   `suggestedPacks` (riga 32) usa `consumptionBetween`, da
        `maxDate(today, med.stockAsOf)`;
    *   `PharmacyItem` prende `category`, `daysPerPack` e `frequencyType` al
        posto di `shape`; `PharmacyLine` (righe 73–80) prende gli stessi tre
        campi, che `PharmacyList.tsx:42` passa;
    *   `packsText` scrive «2 confezioni da 1 flacone» con `containerWord`;
    *   `phrase` (riga 69) passa `doseWord` a `dosesPhrase` («5 ml al
        mattino»).
*   **Perché:** R2.2 e R2.8.

##### 40. `lib/view.ts` (Modify)

*   **Modifiche:** `DispenserView` prende `category`, `pillShape`
    (`shape` o `null`), `level: boolean` e `levelText` (da `levelPhrase`).
    `qtyWord` viene da `leftWord` di `lib/categories.ts`. Si tolgono i testi
    del promemoria di riordino e `pillsText` (righe 82–84, nessuno la usa).
*   **Perché:** il Dispenser mostra fascia e parole per categoria.

##### 41. `lib/alerts.ts` (Modify)

*   **Modifiche:** `toEmailMed` passa `categoryLabel`, `category`,
    `daysPerPack`, `frequencyType`, `unit` da `containerWord` e, a livello,
    `levelText` da `levelPhrase`; senza `reorder`.
*   **Perché:** le email mostrano il nome della categoria e la scorta a
    livello senza arrotondarla a mezze unità.

##### 42. `lib/digest.ts` (Modify)

*   **Modifiche:** le voci del promemoria usano `doseWord` nella frase delle
    dosi («1 goccia la sera») e portano `categoryLabel`. `buildSummaryMeds`
    porta `category`, `daysPerPack`, `frequencyType` e, a livello,
    `levelText`.
*   **Perché:** R1.3, seconda parte, e la scorta a livello nel riepilogo.

##### 44. `lib/aic.ts` (Modify)

*   **Modifiche:** `formFromAifa` diventa `categoryFromAifa(forma,
    descrizione)` (R2.5), che restituisce anche `mode`. Riceve ancora
    `pack.form` (riga 237), cioè la colonna `aifa_packs.form`, che resta.
    `AicLookup`: `category`, `shape` e `mode` al posto di `form` e `shape`.
    `packToForm` usa la nuova funzione.
*   **Perché:** la scansione precompila categoria e modo.

##### 45. `lib/db-types.ts` (Modify)

*   **Modifiche:** `MedicationRow`: `category`, `shape: string | null`,
    `days_per_pack`, niente `form` né `reorder_days`. `MEDICATION_COLUMNS`
    (riga 125) seleziona `category, shape, days_per_pack` al posto di
    `form, shape, reorder_days`. L'interfaccia `Medication` (righe 139–141)
    perde `form: MedForm` e prende `category: Category` e
    `shape: string | null`; si toglie l'import di `MedForm` (riga 4).
    `toMedication` mappa `daysPerPack`.
*   **Perché:** allineamento allo schema di R2. Senza il cambio di
    `MEDICATION_COLUMNS` ogni query sui medicinali fallirebbe a runtime, e il
    controllo dei tipi non se ne accorgerebbe.

##### 46. `lib/schemas.ts` (Modify)

*   **Modifiche:**
    *   `medicationSchema`: `category: z.enum(CATEGORY_IDS)`; `shape`
        obbligatoria solo se `category === 'pillola'`, altrimenti `null`;
        `days_per_pack` 1–365 opzionale, vietato con `as_needed`; dosi 0–999 a
        passi di 0,5; `pills_per_pack` 1–10.000; `stock_qty` opzionale e
        sempre un numero (il controllo sul modo è nel punto 47).
    *   `doseSchema` (riga 101, usato da `takeAsNeeded`) e `doseChangeSchema`
        (righe 106–108): dosi 0–999.
    *   La scorta resta sempre un numero. Il modulo e il riconteggio a livello
        mandano `chiusi + aperto`. Nuova `isLevelQty(q)`: vera se `q ≥ 0` e
        `q − floor(q)` vale 0, 0,1 o 0,5 (con tolleranza `1e-9`); il
        contenitore aperto pieno (1) è già un intero. `qtySchema` (passi di
        0,5) resta per la scorta a pezzi. Gli arrivi restano un intero ≥ 1 di
        confezioni.
*   **Perché:** gli stessi limiti del database (R2.1).

##### 47. `lib/actions/medications.ts` (Modify)

*   **Modifiche:**
    *   salva `category`, `shape` e `days_per_pack`;
    *   alla creazione `stock_qty` è obbligatoria: a pezzi passa da
        `qtySchema`, a livello da `isLevelQty` (il modulo parte da 0 chiusi e
        l'aperto pieno, cioè 1);
    *   a livello, senza cambio di modo, non registra nessun riconteggio:
        `stock_qty` non arriva dal modulo;
    *   cambio di modo: `updateMedication` confronta `isLevel` del medicinale
        salvato con `days_per_pack` dell'input. Se il modo cambia e manca la
        scorta nel modo nuovo, restituisce un errore sul campo della scorta;
        la scorta indicata passa da `qtySchema` o da `isLevelQty` secondo il
        modo nuovo.
        Altrimenti salva `stock_qty` = la scorta indicata, `pills_per_pack`
        come indicato di nuovo nel modulo, e registra un evento `count` con
        `qty_after = stock_qty`, `delta = qty_after` e
        `meta.reason = 'mode_change'`.
*   **Perché:** R2.6. La scorta non passa mai da un'unità all'altra, e
    `pills_per_pack` cambia significato con il modo.

##### 48. `lib/actions/stock.ts` (Modify)

*   **Modifiche:** `recountStock(planId, medicationId, qty: number)` tiene la
    sua firma e valida `qty` con `isLevelQty` quando `isLevel(med)`,
    altrimenti con `qtySchema`. «Finito un {contenitore}» usa
    `takeAsNeeded(planId, medicationId, 1)`, senza una nuova azione; i
    messaggi di `takeAsNeeded` («Indica quante compresse…») usano
    `containerWord`. `pillsWord` diventa `containerWord`.
*   **Perché:** R2.2 e R2.7.

##### 49. `lib/email/templates.ts` e `lib/email/alert-template.ts` (Modify)

*   **Modifiche:** ogni medicinale mostra il pallino del colore, il nome della
    categoria e la parola del contenitore. Le righe «Compresse rimaste»
    (`alert-template.ts:113, 167`) e «Compresse in casa» (`templates.ts:188,
    213`) diventano «{Contenitori} rimasti/e» con `formatQty` a pezzi e
    `levelText` a livello. `SummaryMed` e `AlertEmailMed` prendono `category`,
    `daysPerPack`, `frequencyType` e `levelText`. Il testo «promemoria di riordino» sparisce.
*   **Perché:** R2.8; 0,967 flaconi non diventano «1».

##### 50. `scripts/aifa/parse.mjs` (Modify)

*   **Modifiche:** `SUPPOST[EA]` in `UNITS_RE`.
*   **Perché:** i pezzi per confezione delle supposte si leggono dalla
    descrizione.

#### Interfaccia

##### 51. `components/ui/Presidio.tsx` (Modify)

*   **Fonte:** `design/Presidio.dc.html` e `design/Presidi.dc.html` (sezioni
    07–10), sostituiti il 2026-11-16 con l'export del progetto «Interfaccia
    Panoramix confermata».
*   **Modifiche:**
    *   `PRESIDIO_GEO` per categoria, con i valori `w, h, rot, len, step` di
        `SHAPES` e i disegni di `parts` in `Presidio.dc.html` (corpo neutro,
        contorno di 2 unità del viewBox, una zona nel colore del medicinale).
        Per la pillola delega a `Pill` con `pillShape`.
    *   Firma:

        ```ts
        Presidio({ category, pillShape, color, size, rotate, view, level, days, scaleMax }: {
          category: Category; pillShape?: string | null; color: string;
          size?: number | "s" | "l"; rotate?: number;
          view?: "icon" | "tube"; level?: boolean; days?: number; scaleMax?: number;
        })
        ```

        Default: `view = "icon"`, `level = defaultMode(category) === "livello"`,
        `scaleMax = 60`. `view = "icon"` disegna l'icona inclinata di `rot` (o
        di `rotate`, che oggi usano `MedicationForm.tsx:365` e
        `disponibilita/page.tsx:171`); `view = "tube"` disegna il tubo del
        Dispenser sulla scala 0–`scaleMax`, con le icone impilate fino a
        `days` se `level` è falso, o una fascia piena fino a `days` se è vero,
        e «60+» oltre la scala. `size` vale per l'icona (numero) o per il tubo
        (`"s"` / `"l"`). `Dispenser.tsx` usa questa vista e non tiene più un
        disegno suo.
    *   Differenze di nome rispetto al design: `shape` → `category`,
        `"icona"` / `"tubo"` → `"icon"` / `"tube"`, `stock` (`auto | pezzi |
        livello`) → `level` (booleano, `auto` è il default), più `pillShape`
        per la forma della pillola.
    *   Iniezione a livello (penne) usa la geometria dell'iniezione, con la
        parola «penna».
    *   `FormGlyph({ form })` (riga 140) diventa
        `CategoryGlyph({ category, size })`, con i 10 glifi al tratto della
        sezione 10 di `Presidi.dc.html` (viewBox 24×24, tratto 1,8 unità,
        `currentColor`).
*   **Perché:** R2.7; `MedForm` sparisce con `lib/presidi.ts`.

##### 52. `components/ui/Pill.tsx` (Modify)

*   **Modifiche:** disegna solo le pillole; il ramo `isPresidio` sparisce. Chi
    deve disegnare qualunque medicinale usa `Presidio`.
*   **Perché:** una sola via d'ingresso per le icone.

##### 53. `components/MedicationForm.tsx` (Modify)

*   **Modifiche:**
    *   selettore 5×2 delle categorie con `CategoryGlyph` (righe 19 e 410),
        come nella sezione 10 del design: pulsanti con `aria-pressed`, glifo
        di 24 px ed etichetta;
    *   selettore della forma solo per la pillola;
    *   domande da `perPackQuestion`, `daysQuestion` e `doseQuestion`, con
        il link per
        cambiare modo; con un cambio di modo su un medicinale salvato, il
        modulo chiede di nuovo `pills_per_pack` (a livello parte da 1) e la
        scorta nel modo nuovo;
    *   alla creazione di un medicinale a livello, la scorta si chiede come
        contenitori chiusi più quello aperto (default 0 chiusi, aperto pieno);
    *   in modifica, a livello, scorta in sola lettura con `levelPhrase` e
        link «Riconta»;
    *   con la scansione il modo di partenza è il `mode` di `AicLookup`;
    *   dosi: passo e parola da `lib/categories.ts`, limite 999 al posto di
        `Math.min(20, …)` (riga 448), e un campo numerico accanto ai pulsanti
        ± per scrivere la dose direttamente.
*   **Perché:** R2.6.

##### 54. `components/Dispenser.tsx` (Modify)

*   **Modifiche:** il tubo viene da `Presidio` con `view = "tube"` e
    `level={view.level}`, così gocce a pezzi e iniezione a livello si
    disegnano nel modo giusto;
    etichetta della categoria; testo sotto il tubo con `leftWord` a pezzi e
    `levelPhrase` a livello; riconteggio a livello con contenitori chiusi e
    quello aperto (anche «nessuno», 0); titolo del riconteggio da
    `recountQuestion`; «Finito un {contenitore}» al bisogno quando
    `defaultMode(category) === "livello"` (non `isLevel`).
*   **Perché:** R2.7.

##### 55. `components/PharmacyList.tsx` (Modify)

*   **Modifiche:** `Presidio` al posto di `Pill`; righe con la parola del
    contenitore da `PharmacyLine` (riga 42).
*   **Perché:** R2.8.

##### 56. `app/(app)/piani/[id]/calendario/page.tsx`, `app/(print)/piani/[id]/stampa/page.tsx`, `app/(print)/piani/[id]/terapia/page.tsx` (Modify)

*   **Modifiche:** `Presidio`, nome della categoria e dose con la sua parola.
    `pillLook` (punto 65) riceve `shape` o `null`.
*   **Perché:** R2.8.

##### 57. `app/(app)/piani/[id]/disponibilita/page.tsx`, `app/(app)/piani/[id]/medicinali/[medId]/page.tsx`, `app/(app)/piani/[id]/medicinali/[medId]/storico/page.tsx`, `app/(app)/piani/[id]/medicinali/nuovo/page.tsx` (Modify)

*   **Modifiche:**
    *   `Presidio` con `category` al posto di `Pill` con `shape`; i dati del
        modulo passano `category` e `days_per_pack`;
    *   nella pagina di modifica (`medicinali/[medId]/page.tsx:52`), per un
        medicinale a livello `stock_qty` non si passa al modulo;
    *   in `nuovo/page.tsx` i valori iniziali (oggi `form: "compressa",
        shape: "tonda"`, righe 29–30) diventano `category: null`,
        `shape: null`, `days_per_pack: null`. Lo stato del modulo ha il tipo
        `Omit<MedicationInput, "category"> & { category: Category | null }`,
        e il modulo non si può inviare finché `category` è `null`;
    *   nello storico, «compresse» (riga 67) diventa `containerWord`, e a
        livello la quantità si scrive con 3 decimali al massimo invece che a
        mezze unità.
*   **Perché:** `form` e le forme dei presidi non esistono più.

##### 64. `app/(app)/piani/page.tsx` (Modify, R2)

*   **Modifiche:** `<Pill shape={i.med.shape}>` (riga 97) diventa
    `<Presidio category={i.med.category} pillShape={i.med.shape}>`.
*   **Perché:** dopo R2 `shape` può essere `null` e `Pill` disegna solo
    pillole.

##### 65. `lib/pills.ts` (Modify)

*   **Modifiche:** `pillLook(atcCode, shape)` (riga 48) accetta `shape: string
    | null` e, con `null`, restituisce il colore senza forma.
*   **Perché:** stampa e scheda terapia lo chiamano per ogni medicinale.

##### 66. `components/DoseChangesPanel.tsx` (Modify)

*   **Modifiche:** nuove props `category`, `daysPerPack` e `frequencyType`,
    passate da `medicinali/[medId]/page.tsx` (righe 56–63, punto 57); limite
    999 al posto di `Math.min(20, …)` (riga 127), passo da `doseStep` e parola
    da `doseWord` al posto di «Mezza compressa» (righe 121–127), con lo
    stesso campo numerico del punto 53.
*   **Perché:** un cambio di dose di 40 unità di insulina deve essere
    possibile.

#### Test di R2

##### 58. `tests/categories.test.ts` (Create)

*   **Casi:**
    *   `categoryFromForm` su almeno 20 forme reali, compresi «CAPSULA MOLLE
        GELATINOSA» → pillola, «GRANULATO PER SOSPENSIONE ORALE» → bustina,
        «POLVERE PER INALAZIONE, CAPSULA RIGIDA» → inalatore, «POLVERE PER
        INALAZIONE IN CAPSULA GELATINOSA» → inalatore, «UNGUENTO OFTALMICO» →
        crema, «GEL VAGINALE» → crema, «SPRAY NASALE, SOLUZIONE» → gocce,
        «GOCCE ORALI, SOLUZIONE» → gocce, «SOLUZIONE ORALE» → liquido,
        «SCIROPPO» → liquido, «SOLUZIONE INIETTABILE» → iniezione,
        «COLLIRIO, SOLUZIONE» → gocce, «SOSPENSIONE PER NEBULIZZATORE» →
        inalatore, «CEROTTO TRANSDERMICO» → cerotto, «SCHIUMA CUTANEA» →
        crema, «SUPPOSTE» → supposta, «COMPRESSA RIVESTITA» → pillola, una
        forma sconosciuta → altro (Goal 4). Almeno un caso per ogni riga della
        tabella di R2.5.
    *   `categoryFromAifa`: PENNA → iniezione a livello, MONODOSE → gocce a
        pezzi, MULTIDOSE → livello, altrimenti il modo di default.
    *   Parole: singolare, plurale e genere per ogni categoria; le due
        eccezioni (gocce a pezzi, iniezione a livello); un collirio in
        flacone al bisogno dice «flacone», non «monodose».
    *   quantità di `levelPhrase` con un flacone: 0 → «finito», 0,25 →
        «meno di un flacone», 0,5 → «meno di un flacone», 0,967 → «meno di un
        flacone», 1,2 → «1 flacone», 1,5 → «1 flacone e mezzo», 1,75 →
        «2 flaconi», 2 → «2 flaconi», 2,9 → «3 flaconi»; con una penna 1,5 →
        «1 penna e mezza», 2,5 → «2 penne e mezza». Frasi complete:
        `levelPhrase(1.5, 18, sciroppo)` → «circa 18 giorni · 1 flacone e
        mezzo»; `levelPhrase(0, 0, sciroppo)` → «circa 0 giorni · finito»;
        con `coverageDays = null` → solo la quantità.

##### 59. `tests/forecast.test.ts` (Modify)

*   **Casi:**
    *   `consumptionOn` nei due modi e fuori dalle date di terapia;
    *   a livello, nessun consumo nei giorni esclusi di uno schema `weekdays`,
        nella pausa di un `cycle` e con dose 0;
    *   flacone migrato con `stock_qty = 1`, `days_per_pack = 30` e
        `stock_as_of` 10 giorni fa, schema giornaliero: copertura 20 e data di
        esaurimento uguale a `stock_as_of + 30` (Goal 2);
    *   scorta 1/3 su un flacone da 30 giorni dà 10 giorni di copertura.
    *   Si tolgono i test del promemoria del flacone («flacone di collirio:
        promemoria di riordino», righe 362–385).

##### 60. `tests/aic.test.ts`, `tests/aifa-parse.test.ts`, `tests/pharmacy.test.ts`, `tests/actions.test.ts`, `tests/dose-changes.test.ts`, `tests/helpers/fixtures.ts` (Modify)

*   **Modifiche:** nei medicinali di prova `form` e `reorderDays` diventano
    `category` e `daysPerPack`. Il campo `form` delle righe `aifa_packs`
    resta: `tests/helpers/aifa-sample.ts` non cambia, `tests/aifa-parse.test.ts`
    (riga 103) legge ancora `form`, e in `tests/aic.test.ts` cambiano solo
    le attese di `packToForm` (per esempio «Gocce orali» → `{ category:
    "gocce", … }` alla riga 124). Casi nuovi per «2 confezioni da 1 flacone», SUPPOSTE in
    `UNITS_RE` e dosi fino a 999. In `tests/actions.test.ts`:
    *   modificare `days_per_pack` di un medicinale a livello non registra
        nessun evento `count`;
    *   un cambio di modo senza la scorta nel modo nuovo restituisce un errore
        sul campo; con la scorta, salva quella scorta e registra un `count`
        con `meta.reason = 'mode_change'`;
    *   `recountStock` a livello accetta 1,1 (1 chiuso + quasi finito) e 2
        (1 chiuso + pieno), e rifiuta 1,3;
    *   `takeAsNeeded` con quantità 1 su uno sciroppo al bisogno toglie 1
        flacone.

##### 61. `tests/db/aifa.db.test.ts`, `tests/db/cron.db.test.ts`, `tests/db/sharing.db.test.ts` (Modify)

*   **Modifiche:** gli `insert` usano `category`. Casi nuovi in `cron`: un
    medicinale a livello riceve «meno di 14 giorni» e «ultima confezione»;
    dosi 999 e scorta `29/30` (0,966666…) accettate e rilette uguali dal
    database; `days_per_pack` con
    `as_needed` rifiutato.
*   **Nota:** come per R1, la migrazione di R2 si verifica a mano sul dump
    dei dati veri (Verification Plan).

##### 62. `tests/e2e/categories.spec.ts` (Create)

*   **Preparazione**, nell'ordine:
    1.  il test entra con un utente creato dal test, con il link magico come
        in `tests/e2e/aifa.spec.ts`;
    2.  con un client service role creato come in `tests/e2e/aifa.spec.ts:41`
        (`createClient(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY)`),
        legge `profiles.id` dall'email dell'utente;
    3.  inserisce un piano di quell'utente e questi 12 medicinali, tutti con
        inizio oggi, senza fine, dose solo al mattino:

    | category | modo | `days_per_pack` | `pills_per_pack` | `stock_qty` | frequenza | `dose_morning` |
    | --- | --- | --- | --- | --- | --- | --- |
    | pillola (tonda) | pezzi | – | 30 | 26 | giornaliera | 1 |
    | bustina | pezzi | – | 20 | 9 | giornaliera | 1 |
    | liquido | livello | 15 | 1 | 1 | giornaliera | 5 |
    | iniezione | pezzi | – | 6 | 12 | giornaliera | 1 |
    | gocce | livello | 30 | 1 | 2 | giornaliera | 1 |
    | inalatore | livello | 45 | 1 | 1 | giornaliera | 2 |
    | cerotto | pezzi | – | 3 | 7 | giornaliera | 1 |
    | crema | livello | 20 | 1 | 1 | giornaliera | 1 |
    | supposta | pezzi | – | 10 | 6 | giornaliera | 1 |
    | altro | pezzi | – | 10 | 3 | giornaliera | 1 |
    | liquido | pezzi | – | 1 | 2 | al bisogno | 5 |
    | pillola (ovale) | pezzi | – | 20 | 10 | al bisogno | 1 |

    Le dosi rispettano `medications_dose_positive` (dose totale > 0), anche
    per i medicinali al bisogno.

*   **Casi:** per ognuna delle 10 categorie la pagina del piano mostra il
    Dispenser con l'etichetta della categoria e la parola del contenitore di
    `CATEGORIES` (R2.3); il calendario, il foglio A4, la scheda terapia e la
    lista farmacia mostrano l'etichetta della categoria e la parola della
    dose (Goal 5). Lo sciroppo al bisogno mostra «Finito un flacone», la compressa
    al bisogno «− Presa 1».
*   **Email:** il nome della categoria nell'email di avviso si controlla nel
    punto 68.

##### 67. `tests/e2e/aifa.spec.ts` e `tests/e2e/sharing.spec.ts` (Modify)

*   **Modifiche:** in `aifa.spec.ts` le etichette «Compresse per confezione»
    e «Compresse in casa» (righe 82 e 85) diventano quelle nuove di
    `perPackQuestion` e della scorta; in `sharing.spec.ts` (righe 56–58) il
    test sceglie la categoria «Pillola» prima di compilare il modulo.
*   **Perché:** R2.6 cambia le etichette e mostra il modulo solo dopo la
    scelta della categoria.

##### 68. `tests/alert-template.test.ts`, `tests/email-templates.test.ts` e `tests/digest.test.ts` (Modify, R2)

*   **Casi:**
    *   `tests/alert-template.test.ts`: con un medicinale per categoria,
        l'email di avviso contiene l'etichetta della categoria e la parola del
        contenitore; un flacone con scorta 0,967 mostra «meno di un flacone»,
        non «1»; un collirio in flacone al bisogno dice «flacone»;
    *   `tests/email-templates.test.ts`: il riepilogo settimanale mostra
        `levelText` per i medicinali a livello e «Flaconi rimasti» al posto
        di «Compresse in casa»;
    *   `tests/digest.test.ts`: la frase delle dosi usa `doseWord` («1 goccia
        la sera», «5 ml al mattino»); `buildSummaryMeds` porta `category`,
        `daysPerPack`, `frequencyType` e `levelText`.
*   **Perché:** R2 cambia i template e `lib/digest.ts` (punti 42 e 49).

#### Documentazione di R2

##### 63. README di contratto (Modify)

*   `lib/README.md`, `lib/actions/README.md`, `lib/email/README.md`,
    `components/README.md`, `components/ui/README.md`,
    `supabase/migrations/README.md`, `scripts/aifa/README.md`,
    `app/(app)/piani/[id]/medicinali/nuovo/README.md`,
    `app/(app)/piani/[id]/README.md`, `app/(print)/piani/[id]/stampa/README.md`,
    `app/(print)/piani/[id]/terapia/README.md` e `README.md`.
*   **Modifiche:** `lib/presidi.ts` diventa `lib/categories.ts`; le 10
    categorie, i due modi di conteggio e le nuove props di `Presidio`. In
    `lib/README.md` e `supabase/migrations/README.md`: «`pills_per_pack` =
    unità di scorta per confezione (pezzi, o contenitori a livello)».

### Verification Plan

*   **Build e tipi:** `npm run typecheck` dopo ogni rilascio. Dopo R2 questo
    comando non stampa niente (Goal 1):
    `grep -rnE --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.sql' '\.form\b|"form"|reorder_days|reorderDays|stock_mode|stockMode|mode_since|modeSince|prep_runs|lib/presidi' app lib components scripts tests supabase/seed.sql | grep -v -e 'lib/aic.ts:.*pack\.form' -e 'tests/aifa-parse.test.ts'`.
    Le righe escluse leggono la colonna `aifa_packs.form`, che resta: `pack.form`
    in `lib/aic.ts` e `?.form` in `tests/aifa-parse.test.ts`. I README non
    entrano nel controllo. Dopo R1 si esegue lo stesso comando senza
    `\.form\b|"form"|reorder_days|reorderDays|lib/presidi`, prima di
    chiudere il rilascio.
*   **Unit test:** `npm test`.
*   **Database:** `npm run test:db`.
*   **E2E:** `npm run test:e2e`.
*   **Lint:** `npm run lint`.
*   **Prova della migrazione sui dati veri:** è l'unica verifica delle due
    migrazioni. Prima di ciascun rilascio si ripristina il `pg_dump` di
    produzione su un Supabase locale, si applica la migrazione e si
    controllano a mano:
    *   R1: per ogni piano che era settimanale, `stock_as_of` di ogni
        medicinale che non è un flacone uguale a `greatest(stock_as_of, X)`,
        con X calcolato a mano dalle sue preparazioni; `stock_as_of` dei
        flaconi uguale a prima della migrazione; `prep_reminder` acceso solo
        sui piani settimanali che lo avevano acceso; per i piani con
        preparazioni precedenti a `mode_since`, X viene solo da preparazioni
        con `week_start + 6 >= mode_since` o, se non ce ne sono, da
        `mode_since`; l'elenco dei piani settimanali con X più
        vecchio di 7 giorni, che l'autore guarda a mano.
    *   R2: nessuna `category` nulla; ogni coppia (form, shape) di prima ha
        la categoria e il modo della tabella di R2.9; per ogni flacone,
        `stock_as_of + days_per_pack` uguale al vecchio
        `stock_as_of + reorder_days`; per ogni medicinale a pezzi, la
        copertura calcolata dall'app uguale a quella prima della migrazione
        (Goal 2);
    *   R2: l'elenco dei flaconi a livello con `frequency_type <> 'daily'`, o
        con somma delle tre dosi uguale a 0 nella riga di `medications` o in un
        `dose_changes` in vigore. Per questi la data di esaurimento cambia
        (R2.4); l'autore ne corregge `days_per_pack` a mano;
    *   R2: l'elenco dei piani con tutti gli avvisi spenti e almeno un
        flacone, ai cui proprietari l'autore scrive (Ordine di rilascio).

--------------------------------------------------------------------------------

<!-- Provenance: Indicates initial structural drafting via EGM. -->

*Drafted with EGM*
