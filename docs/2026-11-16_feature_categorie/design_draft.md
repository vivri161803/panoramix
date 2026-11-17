# Dieci categorie AIFA per i medicinali e scorte giorno per giorno

*   **Author:** Carlo Bianchi
*   **Status:** Draft
*   **Date:** 2026-11-16
*   **Brief di partenza:** [concepts_brief.md](./concepts_brief.md)

--------------------------------------------------------------------------------

## Overview

Appoteca aiuta chi gestisce le medicine di un familiare a sapere quanto dura la
scorta di ogni medicinale e quando riordinarlo. Oggi la classificazione dei
medicinali è fatta a mano. Ci sono quattro valori in `medications.form`
(compressa, iniezione, cerotto, collirio), otto forme di presidio in `shape` e un
campo `reorder_days` usato solo per il flacone di collirio. Inoltre ogni piano
può tenere le scorte in due modi: giorno per giorno oppure «settimanale»,
quando le compresse escono solo con la preparazione del portapillole.

Questo design fa due cose, in due rilasci separati:

1.  **Scorte giorno per giorno in tutti i piani.** La modalità settimanale
    sparisce. Il portapillole resta come promemoria e non modifica più le
    scorte.
2.  **Dieci categorie ricavate dalla forma farmaceutica AIFA:** pillola,
    bustina, liquido, iniezione, gocce, inalatore, cerotto, crema, supposta,
    altro. Prendono il posto di `form` e delle forme dei presidi. Ogni categoria
    ha la sua icona (dal componente Presidio del progetto grafico), le sue parole
    («12 siringhe», «circa 18 giorni · 1 flacone») e un modo di conteggio, a
    pezzi o a livello.

L'app è in alpha e la usano poche famiglie. La regola guida dell'autore è la
soluzione più semplice che funziona.

## The Problem

**Molti medicinali non trovano posto nell'app.** Con quattro forme fatte a mano
non si possono gestire sciroppi, inalatori, creme, bustine o supposte. Chi
scansiona una scatola di questi medicinali deve scegliere una forma che non è la
sua, e l'app usa parole sbagliate («compresse» per uno sciroppo). Per questi
medicinali, inoltre, non arrivano avvisi di riordino utili. La classificazione
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
richiesto una terza regola. Togliere la discesa settimanale risolve il problema
alla radice.

**Lo schema rifiuta i valori delle nuove categorie.** Le dosi sono limitate a
0–20 in `numeric(4,1)`: 40 UI di insulina o 30 ml di sciroppo non ci stanno. La
scorta è `numeric(8,1)` a passi di 0,5: una scorta che scende di 1/30 al giorno
verrebbe rifiutata al primo salvataggio.

### Soluzione proposta, in breve

*   La scorta scende ogni giorno in tutti i piani. Il portapillole manda solo un
    promemoria con le dosi dei 7 giorni da preparare.
*   Nuova colonna `medications.category` con 10 valori, riempita dai dati
    esistenti con una tabella di corrispondenza che copre tutte le 11 coppie
    (form, shape) ammesse oggi.
*   Un medicinale è «a livello» se ha `days_per_pack` (il vecchio
    `reorder_days`), altrimenti è «a pezzi». A livello la scorta si conta in
    contenitori (flaconi, tubi, inalatori) e scende di `1 / days_per_pack` al
    giorno. Una sola funzione, `consumptionOn(med, day)`, dà il consumo del
    giorno per entrambi i modi.
*   `categoryFromForm` assegna la categoria quando si scansiona una scatola.
*   Una sola tabella di parole per categoria, Presidio con 10 glifi, un selettore
    di categoria nel modulo e un Dispenser con la fascia di livello.

## Goals

1.  **Categoria sempre presente.** Dopo la migrazione ogni riga di `medications`
    ha una `category` tra i 10 valori, e nessun codice dell'app legge più
    `form`, `stock_mode`, `mode_since` o `prep_runs`.
2.  **Nessun cambiamento per i medicinali già in uso.** Ogni flacone esistente ha
    la stessa data di esaurimento del giorno prima (il vecchio giorno del
    promemoria di riordino); gli avvisi seguono le soglie del piano (R2.4). Ogni compressa nei piani
    giornalieri ha gli stessi giorni di copertura del giorno prima.
3.  **Il promemoria non arriva a chi non lo usava.** Il promemoria del
    portapillole parte solo per i piani che erano settimanali o che lo accendono
    da `PlanForm`.
4.  **Categoria giusta alla scansione.** `categoryFromForm` passa i test su circa
    20 forme AIFA reali, compresi tutti i casi trovati nelle due revisioni.
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
    `pack_volume`). Il rapporto volume ÷ dose serve solo a precompilare «Quanti
    giorni dura una confezione?».
*   **Colonna `count_mode` separata.** Il modo di conteggio dipende solo dalla
    presenza di `days_per_pack`.
*   **Scorta a livello in ml, gocce o grammi.** La scorta resta in contenitori.
*   **Riga «cosa manca» nel promemoria** e avviso anticipato «Ne mancano N per la
    prossima preparazione».
*   **Segnale «da ricontrollare»** sui medicinali migrati.
*   **Migrazione in più fasi**, tabella di backup o prova a secco degli avvisi.
    Basta un `pg_dump` prima della migrazione.
*   **Spareggio con il codice ATC**, fixture con tutte le forme AIFA, colonne di
    tracciamento della classificazione.
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
*   **Then**: la categoria è già «Liquido». Il modulo chiede «Quanti giorni dura
    una confezione?», precompilato a 15 (150 ÷ 10). Nel Dispenser compare una
    fascia piena con «circa 15 giorni · 1 flacone». Quando la copertura scende
    sotto la soglia del piano, arriva l'avviso di riordino.

### CUJ 2: Aggiungere un medicinale senza scansione

*   **Given**: un prodotto senza AIC (per esempio una crema galenica).
*   **When**: l'utente apre «Aggiungi medicinale».
*   **Then**: vede la griglia 5×2 delle categorie senza nessuna preselezionata.
    Sceglie «Crema» e il modulo chiede quanti giorni dura un tubo. Con il link
    «Conta a pezzi» può passare al conteggio a pezzi.

### CUJ 3: Un piano che usava il portapillole settimanale

*   **Given**: un piano in modalità settimanale con il portapillole preparato
    domenica.
*   **When**: si applica la migrazione del rilascio 1.
*   **Then**: la scorta resta quella di prima fino alla fine della settimana già
    preparata, poi scende ogni giorno. Il sabato alle 17:00 arriva il promemoria
    con le dosi dei 7 giorni dalla domenica. Il pulsante «Portapillole
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
    data di riordino è la stessa del giorno prima. Al primo cron può arrivare
    un'email «ultima confezione» (accettato).

### CUJ 6: Riconteggio di un medicinale a livello

*   **Given**: un inalatore a livello con 2 inalatori in casa.
*   **When**: l'utente apre il riconteggio.
*   **Then**: indica «Confezioni chiuse: 1» e «Quella aperta: metà». La scorta
    diventa 1,5, e il Dispenser mostra «1 inalatore e mezzo».

## Technical Plan (Architecture)

Il lavoro è diviso in due rilasci. Il rilascio 1 (R1) si può pubblicare da solo e
non dipende dal rilascio 2 (R2). R2 parte dal codice di R1.

```text
                       RILASCIO 2: tassonomia
 AIFA (aifa_packs.form, pack_description)
        │
        ▼
 categoryFromForm(forma) ──► category        packVolumeFromDescription(desc)
        │                                              │ (solo precompilazione)
        ▼                                              ▼
 MedicationForm: selettore 5×2, «Quanti pezzi» / «Quanti giorni dura» ◄─┘
        │ salva
        ▼
 medications(category, shape solo per pillola, days_per_pack, pills_per_pack, stock_qty numeric(10,3))
        │
        ▼
 lib/forecast.ts  consumptionOn(med, day) ──► currentStock, coveredDaysFrom, suggestedPacks
        │                                         (un solo calcolo, RILASCIO 1 lo prepara)
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
*   `currentStock(med, today)` perde il parametro `mode`. La scorta scende ogni
    giorno per ogni medicinale programmato. In R1 il flacone (`reorderDays`)
    resta com'è oggi, cioè fermo; il suo calcolo cambia solo in R2.
*   `forecastMedication(med, { plan, today })`: si tolgono il ramo `weekly`, i
    campi `homeDays` e `nextPrepNeed` di `Forecast` e la condizione
    `notEnoughForPrep`. La copertura è sempre `coveredDaysFrom(med, stock, today)`.
*   `forecastPlan(plan, meds, today)` perde il parametro `runs` e i campi
    `nextPrep`, `prepOverdue`, `latestRun`, `prepWeek` e `prepPreview`.
*   `statusReason` perde il parametro `mode` e i due rami settimanali
    («Ne mancano N per la prossima preparazione» e «Dopo la preparazione
    restano…»).
*   Si cancellano `relevantRuns`, `latestActiveRun`, `nextPrepDue`,
    `prepWeekStart`, `computePrep`, `applyPrep`, `undoPrep` e
    `calendarWeekStart`.

**Calendario.** Senza `calendarWeekStart` la settimana del calendario e del
foglio A4 comincia sempre il lunedì. Prima, nei piani settimanali, cominciava
dal giorno di preparazione. È un piccolo cambio visibile solo a chi usava il
portapillole: il promemoria del sabato sera elenca già le dosi dalla domenica.

**Lista farmacia.** `buildPharmacyItems` perde `nextPrep`: il fabbisogno dei 30
giorni si calcola sempre da oggi.

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
*   Il riconteggio chiede «Quante ne hai in tutto, comprese quelle nel
    portapillole?» quando il piano ha `prep_reminder` acceso, e «Quante ne
    conti adesso?» negli altri piani.
*   La pagina Storico continua a mostrare gli eventi `prep` e `prep_undo` già
    salvati, con le etichette di oggi.

#### R1.3 Promemoria del portapillole

Oggi il promemoria parte se `stock_mode = 'weekly'` e domani è il giorno di
preparazione dovuto (`fc.nextPrep`), e il contenuto viene da `computePrep`. Dopo
R1 la regola non dipende più dalle preparazioni:

*   **Quando:** il cron delle 17:00 sceglie i piani con `prep_reminder` acceso e
    con `isoWeekday(domani) = prep_weekday`.
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
transazione:

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

    Poi, per i medicinali di quel piano, `stock_as_of = greatest(stock_as_of, X)`.
    Il `greatest` serve per chi ha ricontato dopo X: in quel caso il conteggio è
    già quello giusto. Se X è nel passato (preparazione in ritardo), la scorta
    inizia a scendere da X: se l'utente ha preparato senza premere il pulsante,
    la scorta salvata è più alta del vero e scalarla è corretto. Se invece non
    ha preparato, gli avvisi arrivano prima del necessario, mai dopo.
3.  `update plans set prep_reminder = (stock_mode = 'weekly')` e
    `alter column prep_reminder set default false`.
4.  `drop table prep_runs` (cancella anche RLS e indici), poi
    `alter table plans drop column stock_mode, drop column mode_since`.
5.  Il check di `stock_events.type` resta invariato: `prep` e `prep_undo`
    restano validi per lo storico.

Il calcolo di X si fa in SQL con una funzione di supporto temporanea (creata e
cancellata nello stesso file) oppure con una CTE. Il test in `tests/db` verifica
i tre casi: preparazione attiva, nessuna preparazione, riconteggio dopo X.

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
  pills_per_pack integer not null, check between 1 and 10000
  stock_qty      numeric(10,3) not null, check >= 0             (niente passo 0,5)
  dose_*         numeric(5,1), check between 0 and 999 e passo 0,5
dose_changes.dose_*            come sopra
stock_events.delta, qty_after  numeric(10,3)
```

Il vincolo su `days_per_pack` con `as_needed` mette per iscritto la regola del
brief: un medicinale al bisogno si conta sempre a pezzi.

#### R2.2 Modo di conteggio e consumo

```text
isLevel(med) = med.daysPerPack != null

consumptionOn(med, day):
  se isLevel(med):  1 / daysPerPack  se startDate <= day e (endDate nullo o day <= endDate)
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
*   **Arrotondamento.** Il database salva la scorta con 3 decimali. Prima di
    mandare `qty_after` a `record_stock_event`, le azioni lo arrotondano a 3
    decimali con una funzione `roundStock`, così il valore atteso al
    salvataggio successivo coincide con quello salvato. In `coveredDaysFrom` il
    confronto `need > rem + tol` usa `tol = 0.0005`, cioè l'errore massimo di
    arrotondamento. Senza questa tolleranza, 0,3333 salvato come 0,333 su un
    flacone da 30 giorni darebbe 9 giorni invece di 10.
*   **Cambi di dose e sospensioni.** A livello il consumo non segue le dosi:
    anche una sospensione (dose 0) continua a consumare il flacone. È la
    conseguenza della scelta dei giorni di calendario. Per una sospensione lunga
    si aggiorna a mano «quanti giorni dura» oppure si riconta.

#### R2.3 Parole per categoria

`lib/categories.ts` sostituisce `lib/presidi.ts`. Ha una sola tabella:

| category | etichetta | contenitore (sing./plur.) | genere | dose a livello | passo | modo di default |
| --- | --- | --- | --- | --- | --- | --- |
| pillola | Pillola | compressa / compresse | f | – | 0,5 | pezzi |
| bustina | Bustina | bustina / bustine | f | – | 1 | pezzi |
| liquido | Liquido | flacone / flaconi | m | ml | 0,5 | livello |
| iniezione | Iniezione | siringa / siringhe | f | unità | 1 | pezzi |
| gocce | Gocce | flacone / flaconi | m | goccia / gocce | 1 | livello |
| inalatore | Inalatore | inalatore / inalatori | m | erogazione / erogazioni | 1 | livello |
| cerotto | Cerotto | cerotto / cerotti | m | – | 1 | pezzi |
| crema | Crema | tubo / tubi | m | applicazione / applicazioni | 1 | livello |
| supposta | Supposta | supposta / supposte | f | – | 1 | pezzi |
| altro | Altro | pezzo / pezzi | m | – | 1 | pezzi |

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
        dose in «unità».

    Senza queste eccezioni 30 monodose diventerebbero «30 flaconi», e 40 unità
    di insulina in una penna diventerebbero «40 siringhe».
*   Funzioni esportate: `containerWord(med, n)`, `doseWord(med, n)`,
    `leftWord(med, n)` («compresse rimaste», «tubo rimasto»), `howMany(med)`
    («Quante compresse», «Quanti giorni dura un tubo?») e `doseStep(med)`.
    Prendono `{ category, daysPerPack }` al posto di `shape`.
*   `pillsWord` in `lib/forecast.ts` e `unitWord`/`leftWord` in `lib/presidi.ts`
    spariscono. Chi li usa (`lib/view.ts`, `lib/alerts.ts`,
    `lib/actions/stock.ts`, `lib/email/templates.ts`) passa a
    `lib/categories.ts`.

**Frasi a livello nel Dispenser.** `levelPhrase(stock, med)` restituisce
«circa N giorni · 2 flaconi». N è la copertura in giorni. Per la quantità: un
numero intero si scrive com'è; con resto tra 0,25 e 0,75 si scrive «1 flacone e
mezzo»; sotto 1 si scrive «meno di un flacone»; gli altri resti si arrotondano
all'intero più vicino.

#### R2.4 Flaconi esistenti: stessa data di esaurimento

Oggi un flacone con `reorder_days = N` e `stock_as_of = S` ha il promemoria il
giorno S + N, e la sua scorta salvata non scende mai. Dopo la migrazione
`stock_qty = 1`, `pills_per_pack = 1`, `days_per_pack = N` e `stock_as_of = S`.
La scorta di oggi è `1 − (oggi − S) / N`, e la copertura è `scorta × N =
N − (oggi − S)`. Il primo giorno non coperto è quindi S + N, lo stesso di
prima. La scorta di oggi non viene salvata (si calcola), quindi qui
l'arrotondamento a 3 decimali non entra.

Cambiano invece **i giorni in cui arrivano gli avvisi**:

*   Prima l'unico avviso era il giorno S + N, anche con gli avvisi del piano
    spenti.
*   Dopo valgono gli interruttori del piano: «meno di 14 giorni» arriva il
    giorno S + N − 14, «meno di 7» il giorno S + N − 7, e «ultima confezione»
    al primo cron (la scorta è 1 = `pills_per_pack`).
*   Con gli avvisi del piano spenti, il flacone non manda più nessun avviso.

Gli avvisi arrivano quindi prima o uguali, mai dopo, tranne quando gli avvisi
del piano sono spenti. Il brief accetta entrambe le cose («Cambi di
comportamento da sapere»). Il Goal 2 si legge così: stessa data di
esaurimento, non stesso giorno del primo avviso.

#### R2.5 Mappatura AIFA

*   `lib/categories.ts` esporta `categoryFromForm(forma: string): Category`.
    Funzione pura. Normalizza in maiuscolo senza accenti, poi controlla prima la
    lista di eccezioni del brief e poi le parole chiave a parola intera, in
    ordine. Se non trova niente restituisce `altro`.
*   `packVolumeFromDescription(desc): { qty: number; unit: "ml" | "erogazioni" |
    "g" } | null` legge «150 ML», «200 EROGAZIONI» e «30 G».
*   `lib/aic.ts`: `formFromAifa` si sostituisce con
    `categoryFromAifa(forma, desc)`. Restituisce
    `{ category, shape, packVolume }`, dove `shape` vale solo per le pillole
    (`capsula` se la forma contiene CAPSUL, altrimenti `null` e la sceglie
    l'utente). `AicLookup` perde `form` e prende `category`, `shape` e
    `pack_volume`.
*   `scripts/aifa/parse.mjs`: si aggiunge SUPPOST a `UNITS_RE`.

#### R2.6 Modulo «Aggiungi medicinale»

*   Un selettore di categoria a 10 pulsanti (griglia 5×2, glifo ed etichetta,
    `aria-pressed`). Con la scansione la categoria è preselezionata, senza
    scansione nessuna. Il resto del modulo compare dopo la scelta.
*   Per la pillola resta il selettore della forma (tonda, ovale, capsula).
*   **Campo di quantità per confezione:**
    *   modo di default «pezzi»: «Quanti {contenitori} in una confezione?»
        (`pills_per_pack`);
    *   modo di default «livello»: «Quanti giorni dura un {contenitore}?»
        (`days_per_pack`) e, sotto, «Quanti {contenitori} in una confezione?»
        con valore 1.
    *   Un link «Conta a pezzi» / «Conta a giorni» passa all'altro modo e
        svuota o riempie `days_per_pack`.
    *   Con frequenza «al bisogno» il campo dei giorni non compare, e il modo è
        sempre a pezzi.
*   **Precompilazione dei giorni:** se c'è `pack_volume` dalla scansione e le
    dosi sono già scritte, il campo dei giorni propone
    `floor(volume / dose giornaliera)`. Il valore si aggiorna finché l'utente non
    tocca il campo.
*   Il passo dei campi dose viene da `doseStep`, e l'etichetta delle dosi dalla
    parola della dose.

#### R2.7 Presidio e Dispenser

*   `components/ui/Presidio.tsx` disegna i 10 glifi del design (tab 10,
    pagina Presidi, sezioni 07–10). Props: `category`, `pillShape`, `color`,
    `size`, `view` (`"icon"` o `"tube"`) e `days`. Le geometrie di oggi
    (siringa, cerotto, flacone, monodose) si riusano per le categorie
    corrispondenti.
*   `components/Dispenser.tsx`, sulla scala 0–60 già esistente:
    *   **a pezzi:** icone della categoria impilate fino all'altezza dei giorni
        di copertura; sotto, il testo con i pezzi veri («26 compresse»);
    *   **a livello:** una fascia piena nel colore del medicinale fino ai giorni
        di copertura; sotto, `levelPhrase`;
    *   oltre 60 giorni: tubo pieno e «60+»;
    *   etichetta della categoria accanto all'icona per tutte le categorie.
*   **Riconteggio:**
    *   a pezzi: «Quante ne hai in tutto?» (con la frase del portapillole se il
        piano ha il promemoria acceso, come in R1);
    *   a livello: «Confezioni chiuse» (intero ≥ 0) più «Quella aperta: piena,
        metà o quasi finita» (1, 0,5 o 0,1). La scorta salvata è la somma.
*   **Al bisogno nelle categorie a livello:** il pulsante «− Presa 1» diventa
    «Finita una confezione» e toglie 1.

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
2.  `update` con un `CASE` su (form, shape), secondo la tabella del brief.
3.  `do $$ … assert not exists (select 1 from medications where category is
    null) … $$`.
4.  `alter column category set not null` e check sui 10 valori.
5.  `drop constraint if exists medications_reorder_days_flacone`, poi
    `rename column reorder_days to days_per_pack`.
6.  Flaconi (`shape = 'flacone'`): `stock_qty = 1`, `pills_per_pack = 1`,
    `stock_as_of` invariato. Per i flaconi al bisogno anche
    `days_per_pack = null`.
7.  `drop constraint medications_shape_check`, `alter column shape drop not
    null`, `update … set shape = null where category <> 'pillola'`, poi il nuovo
    check su `shape`.
8.  `drop column form` (con il suo check).
9.  Tipi e limiti: si cambiano tipo e check di dosi, `stock_qty`,
    `pills_per_pack`, `stock_events.delta` e `stock_events.qty_after`,
    ricreando i check con il loro nome.
10. Check `days_per_pack` con `as_needed`.

Il punto 6 va prima del punto 9 solo per chiarezza: `stock_qty = 1` è valido sia
con il vecchio check sia con il nuovo.

### Ordine di rilascio

1.  R1: migrazione `daily_stock`, codice di R1, una riga a chi usava il
    portapillole settimanale.
2.  R2: migrazione `categories`, codice di R2. I glifi nuovi possono essere
    semplici all'inizio. Le icone nel calendario e nella stampa possono arrivare
    dopo il Dispenser, purché parole e nomi di categoria siano già giusti.
3.  In entrambi i rilasci i README di contratto delle cartelle toccate si
    aggiornano nello stesso commit.

## Alternatives Considered

### A. Tenere le categorie fatte a mano di oggi

*   **Pro:** nessuna migrazione; il codice di oggi funziona.
*   **Contro:** sciroppi, inalatori, creme, bustine e supposte restano senza
    posto; la scelta dipende dall'esperienza di chi inserisce il medicinale.
*   **Motivo dello scarto:** Scartata dall'autore: le categorie fatte a mano non
    coprono l'elenco AIFA che l'app già importa.

### B. Tenere `form` accanto a `category`

*   **Pro:** migrazione più leggera; il codice che legge `form` (una quarantina
    di file) può cambiare poco alla volta.
*   **Contro:** due tassonomie da tenere allineate, con il rischio che dicano cose
    diverse sullo stesso medicinale.
*   **Motivo dello scarto:** Scartata dall'autore: la nuova tassonomia
    sostituisce la vecchia, e tenerle entrambe raddoppia i casi da gestire.

### C. Migrare con la tabella ALIAS del design

*   **Pro:** la tabella esiste già nel progetto grafico.
*   **Contro:** trasforma i cerotti in bustina (`shape = 'bustina'`) in bustine
    orali e manda le compresse in `altro`.
*   **Motivo dello scarto:** Scartata nella prima revisione: produce categorie
    sbagliate su righe esistenti. La migrazione usa un `CASE` su (form, shape)
    che copre tutte le 11 coppie ammesse.

### D. Portapillole solo per pillola, bustina e supposta, con due regole di discesa

*   **Pro:** conserva la discesa settimanale per chi la usa.
*   **Contro:** nei piani settimanali iniezioni e cerotti non scenderebbero più,
    oppure servirebbe una seconda regola di discesa per categoria; il codice
    settimanale (RPC, `prep_runs`, rami in `lib/forecast.ts`) resta.
*   **Motivo dello scarto:** Scartata dall'autore: il portapillole prende tutto
    ciò che è programmato, quindi la discesa settimanale si toglie e il
    portapillole diventa un promemoria.

### E. Migrazione in tre fasi con tabella di backup e prova a secco degli avvisi

*   **Pro:** si può tornare indietro senza `pg_dump`; si vedono in anticipo le
    email che partiranno.
*   **Contro:** tre migrazioni, una tabella in più da cancellare dopo, codice che
    deve funzionare con entrambi gli schemi.
*   **Motivo dello scarto:** Scartata dall'autore: l'app è in alpha con poche
    famiglie; un `pg_dump` prima della migrazione basta.

### F. `count_mode` come colonna salvata

*   **Pro:** il modo di conteggio è esplicito e si legge con una query.
*   **Contro:** «a livello» equivale ad «ha `days_per_pack`»; una seconda colonna
    può andare fuori sincrono e chiede un vincolo in più.
*   **Motivo dello scarto:** Scartata nella seconda revisione: il modo si ricava
    da `days_per_pack`. Anche il nome `stock_mode` era stato scartato perché si
    confonde con `plans.stock_mode`.

### G. `pack_volume` salvato, con consumo = dose ÷ volume

*   **Pro:** il consumo segue i cambi di dose; non serve aggiornare a mano
    «quanti giorni dura».
*   **Contro:** una colonna in più, una regola di precedenza con
    `days_per_pack`, nuovi limiti; per colliri e creme nessuno conosce il volume
    per dose, e i dati AIFA spesso non hanno il volume.
*   **Motivo dello scarto:** Scartata nella seconda revisione: il rapporto
    volume ÷ dose resta solo per precompilare `days_per_pack` nel modulo.

### H. Modello con unità esplicite (`pack_unit`, `dose_unit`)

*   **Pro:** il più generale: ogni medicinale dice in che unità si conta e si
    dosa.
*   **Contro:** più colonne, più controlli e più conversioni di quante ne servano
    per dieci categorie.
*   **Motivo dello scarto:** Scartato dall'autore: troppe colonne e controlli per
    un'app in alpha. Le parole per (categoria, modo) in `lib/categories.ts`
    coprono i casi noti senza colonne nuove.

### I. Scorta a livello in ml o gocce

*   **Pro:** la scorta ha un significato fisico preciso.
*   **Contro:** il fattore gocce/ml non è noto; lo storico di `stock_events`
    mescolerebbe contenitori e millilitri.
*   **Motivo dello scarto:** Scartata dall'autore: la scorta a livello si conta
    in contenitori, che l'utente sa contare.

### J. Mappatura AIFA con le sole parole chiave nell'ordine della richiesta

*   **Pro:** una regola sola, facile da leggere.
*   **Contro:** almeno dieci classi di errori, per esempio GEL dentro
    GELATINOSA o POLVERE PER INALAZIONE in capsule classificata come pillola.
*   **Motivo dello scarto:** Scartata nella prima revisione: si aggiungono una
    breve lista di eccezioni e il confronto a parola intera.

### K. Spareggio con il codice ATC e fixture con tutte le forme AIFA

*   **Pro:** classificazione più precisa sui casi ambigui; copertura completa dei
    test.
*   **Contro:** una seconda fonte di verità da mantenere; una fixture grande da
    aggiornare a ogni import AIFA.
*   **Motivo dello scarto:** Scartata dall'autore: con circa 20 forme reali nei
    test e il fallback `altro`, un errore costa un tocco nel selettore.

### L. Etichette di uso comune («Compresse e capsule», «Supposte e ovuli»)

*   **Pro:** più chiare per chi non conosce il design.
*   **Contro:** non coincidono con il progetto grafico.
*   **Motivo dello scarto:** Rimandata dall'autore: si usano le etichette del
    design per coerenza; cambiarle dopo costa una riga per categoria.

### M. Cancellare e reinserire i medicinali da sistemare

*   **Pro:** nessun caso speciale nella migrazione.
*   **Contro:** si perde lo storico di `stock_events` e di `alert_log`.
*   **Motivo dello scarto:** Scartata dall'autore: le correzioni in SQL tengono
    lo storico e coprono tutti i casi noti.

### N. Segnale «da ricontrollare» sui medicinali migrati

*   **Pro:** rete di sicurezza per righe migrate male.
*   **Contro:** con le correzioni in SQL nessuna riga lo accenderebbe (piani
    settimanali sistemati con `stock_as_of`, flaconi normalizzati a 1, tutte le
    coppie coperte, cerotti in bustina che sono cerotti veri).
*   **Motivo dello scarto:** Scartato dall'autore il 2026-11-16, su proposta
    della seconda revisione.

### O. Una sola parola per categoria, senza eccezioni per il modo

*   **Pro:** la tabella del brief resta di una riga per categoria.
*   **Contro:** con il modo non di default le parole diventano sbagliate: 30
    colliri monodose diventano «30 flaconi», 40 unità di insulina in una penna
    diventano «40 siringhe».
*   **Motivo dello scarto:** emerso durante la stesura: si aggiungono due
    eccezioni (gocce a pezzi, iniezione a livello) nella stessa tabella.
    Scartata dall'autore il 2026-11-16 nella riconciliazione con il brief.

--------------------------------------------------------------------------------

## Non-Functional Requirements

*   **Rollout e rollback.** Ogni rilascio ha una sola migrazione in transazione:
    se un `assert` fallisce, non cambia niente. Prima di R2 si fa un `pg_dump`
    di produzione. Il rollback di R1 o di R2 dopo il commit è il ripristino del
    `pg_dump` più il deploy del codice precedente. Migrazione e codice si
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
nuovi. I percorsi sono relativi alla radice del repository.

### Rilascio 1: scorte giorno per giorno

#### Database

##### 1. `supabase/migrations/20261117000100_daily_stock.sql` (Create)

*   **Tipo:** migrazione SQL.
*   **Modifiche:** i passi di R1.4, in quest'ordine:
    1.  `drop function public.apply_prep(uuid, date, date, jsonb)`,
        `public.undo_prep(uuid, date)` e
        `public.change_stock_mode(uuid, text, date, jsonb)`.
    2.  Una CTE `weekly_start(plan_id, x)`: per ogni piano con
        `stock_mode = 'weekly'`, `x = max(week_start) + 7` tra i `prep_runs`
        con `undone_at is null`. Se non ce ne sono, `x` è il primo giorno da
        `mode_since` con `extract(isodow) = prep_weekday`, cioè
        `mode_since + ((prep_weekday - isodow(mode_since) + 7) % 7)`.
    3.  `update medications m set stock_as_of = greatest(m.stock_as_of, w.x)
        from weekly_start w where m.plan_id = w.plan_id`.
    4.  `update plans set prep_reminder = (stock_mode = 'weekly')`, poi
        `alter column prep_reminder set default false`.
    5.  `drop table public.prep_runs`.
    6.  `alter table public.plans drop column stock_mode, drop column
        mode_since`.
*   **Perché:** toglie la discesa settimanale senza chiedere un nuovo conteggio,
    e spegne il promemoria per chi non lo usava.

##### 2. `supabase/seed.sql` (Modify)

*   **Tipo:** dati di sviluppo.
*   **Modifiche:** si tolgono `stock_mode` e `mode_since` dagli `insert` di
    `plans` e ogni `insert` in `prep_runs`. Il piano di esempio che era
    settimanale prende `prep_reminder = true`.
*   **Perché:** il seed deve girare sullo schema nuovo.

#### Logica di dominio

##### 3. `lib/forecast.ts` (Modify)

*   **Tipo:** modulo TypeScript, funzioni pure.
*   **Modifiche:**
    *   Si tolgono `StockMode`, `PrepRunData`, `PrepItem`, `relevantRuns`,
        `latestActiveRun`, `nextPrepDue`, `prepWeekStart`, `computePrep`,
        `applyPrep`, `undoPrep` e `calendarWeekStart`.
    *   `PlanSettings`: `{ prepWeekday, prepReminder, alertUnder14,
        alertUnder7, alertLastPack }`.
    *   `currentStock(med, today)`: senza parametro `mode`.
    *   `Forecast`: senza `homeDays` e `nextPrepNeed`.
    *   `ForecastContext`: `{ plan, today }`.
    *   `forecastMedication`: senza il ramo `weekly` e senza
        `notEnoughForPrep`.
    *   `statusReason(f, endDate)`: senza `mode` e senza i due testi
        settimanali.
    *   `PlanForecast`: senza `nextPrep`, `prepOverdue`, `latestRun`,
        `prepWeek` e `prepPreview`. `forecastPlan(plan, meds, today)`.
*   **Perché:** una sola regola di discesa (R1.1).

##### 4. `lib/week.ts` (Modify)

*   **Tipo:** modulo TypeScript.
*   **Modifiche:** `resolveWeek(param, today)` usa
    `onOrBeforeWeekday(date, 1)` al posto di `calendarWeekStart`, e non
    riceve più `settings`.
*   **Perché:** il calendario parte sempre il lunedì.

##### 5. `lib/digest.ts` (Modify)

*   **Tipo:** modulo TypeScript, funzioni pure.
*   **Modifiche:** `buildReminderItems(meds, prep, prepDate)` diventa
    `buildPrepReminderItems(meds, prepDate)`. Filtra i medicinali non al
    bisogno e non conclusi alla data `prepDate`. Calcola
    `need = dosesBetween(m, prepDate, prepDate + 6)` e tiene quelli con
    `need > 0`. Restituisce `ReminderItem` senza `missing`.
    `buildSummaryMeds` smette di leggere i campi settimanali.
*   **Perché:** il contenuto del promemoria non dipende più da `computePrep`
    (R1.3).

##### 6. `lib/notify.ts` (Modify)

*   **Tipo:** modulo server.
*   **Modifiche:** `planForecast` chiama `forecastPlan(settings, meds, today)`.
    In `runPrepReminders`, il filtro diventa `(p) => p.prep_reminder`, e il
    builder restituisce `null` se `isoWeekday(tomorrow) !== p.prep_weekday`.
    Le voci vengono da `buildPrepReminderItems(meds, tomorrow)`.
*   **Perché:** il promemoria parte per chi lo ha acceso, il giorno prima della
    preparazione.

##### 7. `lib/pharmacy.ts` (Modify)

*   **Tipo:** modulo TypeScript.
*   **Modifiche:** `buildPharmacyItems(items, today)` senza `nextPrep`;
    `start = today`. Si aggiorna il commento di `suggestedPacks`.
*   **Perché:** non c'è più una prossima preparazione da cui partire.

##### 8. `lib/alerts.ts` (Modify)

*   **Tipo:** modulo TypeScript.
*   **Modifiche:** `buildPlanEmail` non passa più `nextPrep` e non riceve più
    le preparazioni.
*   **Perché:** il campo `nextPrep` sparisce da `PlanForecast`.

##### 9. `lib/view.ts` (Modify)

*   **Tipo:** modulo TypeScript.
*   **Modifiche:** `dispenserView(med, f, today)` senza `mode`; chiama
    `statusReason(f, med.endDate)`.
*   **Perché:** segue la nuova firma di `statusReason`.

##### 10. `lib/db-types.ts` (Modify)

*   **Tipo:** tipi delle righe del database.
*   **Modifiche:** `PlanRow` senza `stock_mode` e `mode_since`; si tolgono
    `PrepRunRow` e `toPrepRun`. `PLAN_COLUMNS` (riga 129) senza le due colonne.
    `toPlanSettings` restituisce il nuovo `PlanSettings`, con
    `prepReminder`. `StockEventType` mantiene `prep` e `prep_undo`.
*   **Perché:** allineamento allo schema di R1.

##### 11. `lib/data.ts` (Modify)

*   **Tipo:** lettura dati per le pagine.
*   **Modifiche:** si tolgono le due query su `prep_runs` (righe 88 e 121) e i
    campi che le restituiscono.
*   **Perché:** la tabella non esiste più.

##### 12. `lib/cron-data.ts` (Modify)

*   **Tipo:** lettura dati per i cron.
*   **Modifiche:** si toglie la lettura di `prep_runs` (righe 42–43) e il campo
    `runs` di `CronData`.
*   **Perché:** come sopra.

##### 13. `lib/usage.ts` (Modify)

*   **Tipo:** statistiche d'uso.
*   **Modifiche:** si toglie la lettura di `prep_runs` e il campo `preps` di
    `UsageRaw` e del riepilogo. L'email d'uso perde la riga delle
    preparazioni.
*   **Perché:** come sopra.

##### 14. `lib/schemas.ts` (Modify)

*   **Tipo:** schemi zod.
*   **Modifiche:** lo schema del piano perde `stock_mode`;
    `prep_reminder: z.boolean().default(false)`.
*   **Perché:** il default di un piano nuovo è senza promemoria.

##### 15. `lib/actions/plans.ts` (Modify)

*   **Tipo:** server action.
*   **Modifiche:** si toglie la chiamata a `change_stock_mode`. Creazione e
    modifica del piano scrivono solo le colonne rimaste.
*   **Perché:** la RPC non esiste più.

##### 16. `lib/actions/stock.ts` (Modify)

*   **Tipo:** server action.
*   **Modifiche:** si tolgono `preparePillbox` e `undoPillbox`.
    `currentStock(med, today)` e `forecastMedication(med, { plan, today })`
    nelle altre azioni.
*   **Perché:** il pannello del portapillole sparisce.

##### 17. `lib/actions/medications.ts` (Modify)

*   **Tipo:** server action.
*   **Modifiche:** le chiamate a `currentStock` e `forecastPlan` seguono le
    nuove firme.
*   **Perché:** compilazione.

##### 18. `lib/email/templates.ts` (Modify)

*   **Tipo:** template email.
*   **Modifiche:** `renderPrepReminderEmail` senza la colonna «mancano»;
    `renderWeeklySummaryEmail` senza la frase «Prossima preparazione del
    portapillole» e senza il campo `nextPrep`.
*   **Perché:** R1.1 e R1.3.

##### 19. `lib/email/alert-template.ts` (Modify)

*   **Tipo:** template email.
*   **Modifiche:** si toglie `nextPrep` da `AlertEmailData` e dalla frase per il
    medico (riga 84).
*   **Perché:** R1.1.

#### Interfaccia

##### 20. `components/PrepPanel.tsx` (Delete)

*   **Perché:** il pulsante «Portapillole preparato» e il suo annullamento
    spariscono.

##### 21. `components/PlanForm.tsx` (Modify)

*   **Tipo:** componente client.
*   **Modifiche:** si toglie la scelta tra «giorno per giorno» e «portapillole
    settimanale». Resta l'interruttore del promemoria; il selettore del giorno
    compare solo quando l'interruttore è acceso.
*   **Perché:** R1.2.

##### 22. `components/PlanHeader.tsx` (Modify)

*   **Tipo:** componente.
*   **Modifiche:** la riga della modalità (riga 9) diventa «Promemoria del
    portapillole {giorno}» se `prep_reminder` è acceso, altrimenti niente.
*   **Perché:** `stock_mode` non esiste più.

##### 23. `components/Dispenser.tsx` (Modify)

*   **Tipo:** componente client.
*   **Modifiche:** riceve `prepReminder: boolean`. Il titolo del riconteggio è
    «Quante ne hai in tutto, comprese quelle nel portapillole?» quando è
    `true`, altrimenti «Quante ne conti adesso?».
*   **Perché:** R1.2.

##### 24. `components/DispenserGrid.tsx` (Modify)

*   **Tipo:** componente client.
*   **Modifiche:** passa `prepReminder` a ogni `Dispenser`.
*   **Perché:** come sopra.

##### 25. `app/(app)/piani/[id]/page.tsx` (Modify)

*   **Tipo:** pagina.
*   **Modifiche:** non mostra più `PrepPanel` e non legge `prepPreview`,
    `prepWeek` o `latestRun`.
*   **Perché:** R1.2.

##### 26. `app/(app)/piani/page.tsx` (Modify)

*   **Tipo:** pagina.
*   **Modifiche:** la riga «Prossima preparazione» (righe 63–66) sparisce;
    resta «Copertura minima» per tutti i piani.
*   **Perché:** `nextPrep` non esiste più.

##### 27. `app/(app)/piani/nuovo/page.tsx` e `app/(app)/piani/[id]/modifica/page.tsx` (Modify)

*   **Tipo:** pagine.
*   **Modifiche:** non passano più `stock_mode` a `PlanForm`.
*   **Perché:** compilazione.

##### 28. `app/(app)/piani/[id]/calendario/page.tsx` e `app/(print)/piani/[id]/stampa/page.tsx` (Modify)

*   **Tipo:** pagine.
*   **Modifiche:** `resolveWeek(param, today)`.
*   **Perché:** il calendario parte il lunedì.

##### 29. `app/(app)/piani/[id]/farmacia/page.tsx` e `app/(app)/piani/[id]/medicinali/[medId]/page.tsx` e `app/(app)/piani/[id]/medicinali/nuovo/page.tsx` (Modify)

*   **Tipo:** pagine.
*   **Modifiche:** non leggono `nextPrep`; `buildPharmacyItems(items, today)`.
*   **Perché:** compilazione.

#### Test di R1

##### 30. `tests/forecast.test.ts` (Modify)

*   **Modifiche:** si tolgono i test di `computePrep`, `nextPrepDue`,
    `prepWeekStart`, `calendarWeekStart` e del ramo settimanale. Si aggiunge:
    la scorta scende ogni giorno a partire da `stock_as_of`, con le stesse
    coperture di oggi per un piano giornaliero (criterio 3).

##### 31. `tests/digest.test.ts` (Modify)

*   **Modifiche:** test di `buildPrepReminderItems`: esclude i medicinali al
    bisogno e conclusi; include quelli con dosi nei 7 giorni; riporta il cambio
    di dose che cade nella settimana.

##### 32. `tests/pharmacy.test.ts`, `tests/alert-template.test.ts`, `tests/email-templates.test.ts`, `tests/usage.test.ts`, `tests/actions.test.ts` (Modify)

*   **Modifiche:** si tolgono `nextPrep`, `preps`, `stock_mode` e
    `mode_since` dagli input e dalle attese.

##### 33. `tests/helpers/fixtures.ts` (Modify)

*   **Modifiche:** `PlanSettings` e `PlanRow` di prova senza i campi tolti, con
    `prepReminder`.

##### 34. `tests/db/cron.db.test.ts` (Modify)

*   **Modifiche:** il promemoria parte per un piano con `prep_reminder = true`
    quando domani è `prep_weekday`; non parte con `prep_reminder = false`;
    non parte negli altri giorni (criterio 4).

#### Documentazione di R1

##### 35. README di contratto (Modify)

*   `lib/README.md`, `lib/actions/README.md`, `lib/email/README.md`,
    `components/README.md`, `supabase/README.md`,
    `supabase/migrations/README.md`, `app/(app)/piani/README.md`,
    `app/(app)/piani/[id]/README.md`, `app/(app)/piani/nuovo/README.md`,
    `app/(app)/piani/[id]/farmacia/README.md`,
    `app/(app)/piani/[id]/calendario/README.md`,
    `app/api/cron/reminders/README.md` e `README.md`.
*   **Modifiche:** si toglie ogni riferimento alla modalità settimanale, a
    `prep_runs` e alle tre RPC; si descrive il promemoria nuovo.

### Rilascio 2: dieci categorie

#### Database

##### 36. `supabase/migrations/20261118000100_categories.sql` (Create)

*   **Tipo:** migrazione SQL.
*   **Modifiche:** i passi di R2.9. Il `CASE` per `category`:
    `form = 'compressa'` → `pillola`; `iniezione` → `iniezione`; `cerotto` →
    `cerotto`; `collirio` → `gocce`. Il blocco `do $$ … assert … $$` controlla
    che nessuna `category` sia nulla e che ogni flacone abbia
    `days_per_pack is not null` oppure `frequency_type = 'as_needed'`. I check
    si ricreano con i nomi `medications_dose_morning_check`,
    `medications_dose_noon_check`, `medications_dose_evening_check`,
    `medications_stock_qty_check`, `medications_pills_per_pack_check` e i loro
    equivalenti in `dose_changes`. Nuovi vincoli: `medications_category_check`,
    `medications_shape_check`, `medications_days_per_pack_as_needed`.
*   **Perché:** R2.1 e R2.9.

##### 37. `supabase/seed.sql` (Modify)

*   **Modifiche:** gli `insert` di `medications` usano `category` e
    `days_per_pack` al posto di `form` e `reorder_days`. `shape` resta solo
    per le pillole. Si aggiunge almeno un medicinale per ogni categoria, con
    uno sciroppo, un inalatore e una crema a livello.
*   **Perché:** il seed serve per lo sviluppo e per i test e2e (criterio 6).

#### Logica di dominio

##### 38. `lib/categories.ts` (Create)

*   **Tipo:** modulo TypeScript, funzioni pure.
*   **API:**
    *   `CATEGORIES` (la tabella di R2.3), `type Category`, `CATEGORY_IDS`.
    *   `isLevel(m: { daysPerPack }): boolean`.
    *   `defaultMode(category): "pezzi" | "livello"`.
    *   `containerWord(m, n)`, `doseWord(m, n)`, `leftWord(m, n)`,
        `howMany(m)`, `doseStep(m)`, `levelPhrase(stock, coverageDays, m)`.
        `m` è `{ category, daysPerPack }`.
    *   `categoryFromForm(forma): Category`, con la lista di eccezioni e le
        parole chiave a parola intera.
    *   `packVolumeFromDescription(desc): { qty, unit } | null`.
*   **Perché:** una sola fonte per parole, modo e mappatura (R2.3, R2.5).

##### 39. `lib/presidi.ts` (Delete)

*   **Perché:** sostituito da `lib/categories.ts`.

##### 40. `lib/forecast.ts` (Modify)

*   **Modifiche:**
    *   `MedicationData`: `category: Category`, `daysPerPack: number | null`
        al posto di `reorderDays`.
    *   Nuove `consumptionOn(med, day)` e `consumptionBetween(med, from, to)`
        (R2.2).
    *   `currentStock`, `coveredDaysFrom` usano `consumptionOn`;
        `coveredDaysFrom` usa la tolleranza `STOCK_TOL = 0.0005`.
    *   Si toglie il ramo `reorderDays` di `forecastMedication`,
        `Forecast.reorder` e il testo «È ora di riordinare il flacone».
    *   Nuova `roundStock(n) = Math.round(n * 1000) / 1000`.
    *   Si toglie `pillsWord`.
*   **Perché:** un solo calcolo di consumo per entrambi i modi.

##### 41. `lib/pharmacy.ts` (Modify)

*   **Modifiche:** `suggestedPacks` usa `consumptionBetween`. `PharmacyItem`
    prende `category` e `daysPerPack` al posto di `shape`, e `packsText`
    scrive «2 confezioni da 1 flacone» con `containerWord`.
*   **Perché:** R2.2 e R2.8.

##### 42. `lib/view.ts` (Modify)

*   **Modifiche:** `DispenserView` prende `category`, `pillShape`
    (`shape` o `null`), `level: boolean` e `levelText` (da `levelPhrase`).
    `qtyWord` viene da `leftWord` di `lib/categories.ts`. Si tolgono i testi
    del promemoria di riordino.
*   **Perché:** il Dispenser mostra fascia e parole per categoria.

##### 43. `lib/alerts.ts` (Modify)

*   **Modifiche:** `toEmailMed` passa `categoryLabel` e `unit` da
    `containerWord`; senza `reorder`.
*   **Perché:** le email mostrano il nome della categoria.

##### 44. `lib/digest.ts` (Modify)

*   **Modifiche:** le voci del promemoria usano `doseWord` nella frase delle
    dosi («1 goccia la sera») e portano `categoryLabel`.
*   **Perché:** R1.3, seconda parte.

##### 45. `lib/forecast.ts`, funzione `dosesPhrase` (Modify, stesso file del punto 40)

*   **Modifiche:** `dosesPhrase(s, word?)` accetta una funzione
    `(n) => string` per la parola della dose; senza parametro resta come oggi.
*   **Perché:** le frasi delle dosi dicono «ml», «gocce» o «erogazioni».

##### 46. `lib/aic.ts` (Modify)

*   **Modifiche:** `formFromAifa` diventa `categoryFromAifa(forma, desc)`
    (R2.5). `AicLookup`: `category`, `shape`, `pack_volume` al posto di
    `form` e `shape`. `packToForm` usa la nuova funzione.
*   **Perché:** la scansione precompila categoria e giorni.

##### 47. `lib/pills.ts` (Modify)

*   **Modifiche:** nessun cambiamento di logica; il commento dice che le forme
    valgono solo per `category = 'pillola'`.
*   **Perché:** chiarezza del contratto.

##### 48. `lib/db-types.ts` (Modify)

*   **Modifiche:** `MedicationRow`: `category`, `shape: string | null`,
    `days_per_pack`, niente `form` né `reorder_days`. `toMedication` mappa
    `daysPerPack` e converte `stock_qty` da stringa a numero.
*   **Perché:** allineamento allo schema di R2.

##### 49. `lib/schemas.ts` (Modify)

*   **Modifiche:** schema del medicinale: `category: z.enum(CATEGORY_IDS)`;
    `shape` obbligatoria solo se `category === 'pillola'`, altrimenti `null`;
    `days_per_pack` 1–365 opzionale, vietato con `as_needed`; dosi 0–999 a
    passi di 0,5; `pills_per_pack` 1–10.000; quantità del riconteggio e degli
    arrivi a passi di 0,5 (pezzi) o, a livello, intero di confezioni chiuse più
    una delle tre frazioni.
*   **Perché:** gli stessi limiti del database (R2.1).

##### 50. `lib/actions/medications.ts` (Modify)

*   **Modifiche:** salva `category`, `shape` e `days_per_pack`; quando si
    passa da livello a pezzi o viceversa, il salvataggio scrive o cancella
    `days_per_pack` senza toccare `stock_qty`.
*   **Perché:** R2.6.

##### 51. `lib/actions/stock.ts` (Modify)

*   **Modifiche:** `qty_after` passa da `roundStock`. Nuova azione
    `finishPack(planId, medicationId)` per «Finita una confezione», che toglie
    1 come evento `use`. `pillsWord` diventa `containerWord`.
*   **Perché:** R2.2 e R2.7.

##### 52. `lib/email/templates.ts` e `lib/email/alert-template.ts` (Modify)

*   **Modifiche:** ogni medicinale mostra il pallino del colore, il nome della
    categoria e la parola del contenitore; il testo «promemoria di riordino»
    sparisce.
*   **Perché:** R2.8.

##### 53. `scripts/aifa/parse.mjs` (Modify)

*   **Modifiche:** `SUPPOST[EA]` in `UNITS_RE`.
*   **Perché:** i pezzi per confezione delle supposte si leggono dalla
    descrizione.

#### Interfaccia

##### 54. `components/ui/Presidio.tsx` (Modify)

*   **Modifiche:** props `category`, `pillShape`, `color`, `size`, `view`,
    `days`. Geometrie in `PRESIDIO_GEO` per le 10 categorie, dal design. Per
    la pillola delega a `Pill` con `pillShape`.
*   **Perché:** R2.7.

##### 55. `components/ui/Pill.tsx` (Modify)

*   **Modifiche:** disegna solo le pillole; il ramo `isPresidio` sparisce. Chi
    deve disegnare qualunque medicinale usa `Presidio`.
*   **Perché:** una sola via d'ingresso per le icone.

##### 56. `components/MedicationForm.tsx` (Modify)

*   **Modifiche:** selettore 5×2 delle categorie; selettore della forma solo
    per la pillola; campi «Quanti pezzi» o «Quanti giorni dura» con il link per
    cambiare modo; precompilazione dei giorni da `pack_volume`; passo e parola
    della dose da `lib/categories.ts`.
*   **Perché:** R2.6.

##### 57. `components/Dispenser.tsx` (Modify)

*   **Modifiche:** icone impilate a pezzi, fascia a livello, «60+», etichetta
    della categoria, riconteggio a livello con confezioni chiuse e quella
    aperta, «Finita una confezione» al bisogno.
*   **Perché:** R2.7.

##### 58. `components/PharmacyList.tsx` (Modify)

*   **Modifiche:** `Presidio` al posto di `Pill`; righe con la parola del
    contenitore.
*   **Perché:** R2.8.

##### 59. `app/(app)/piani/[id]/calendario/page.tsx`, `app/(print)/piani/[id]/stampa/page.tsx`, `app/(print)/piani/[id]/terapia/page.tsx` (Modify)

*   **Modifiche:** `Presidio`, nome della categoria e dose con la sua parola.
*   **Perché:** R2.8.

##### 60. `app/(app)/piani/[id]/disponibilita/page.tsx`, `app/(app)/piani/[id]/medicinali/[medId]/page.tsx`, `app/(app)/piani/[id]/medicinali/[medId]/storico/page.tsx`, `app/(app)/piani/[id]/medicinali/nuovo/page.tsx` (Modify)

*   **Modifiche:** `Presidio` con `category` al posto di `Pill` con `shape`;
    i dati del modulo passano `category` e `days_per_pack`.
*   **Perché:** `form` e le forme dei presidi non esistono più.

#### Test di R2

##### 62. `tests/categories.test.ts` (Create)

*   **Casi:** `categoryFromForm` su circa 20 forme reali, compresi
    «CAPSULA MOLLE GELATINOSA» → pillola, «GRANULATO PER SOSPENSIONE ORALE» →
    bustina, «POLVERE PER INALAZIONE, CAPSULA RIGIDA» → inalatore,
    «UNGUENTO OFTALMICO» → crema, «GEL VAGINALE» → crema, «SPRAY NASALE,
    SOLUZIONE» → gocce, «GOCCE ORALI, SOLUZIONE» → gocce, una forma
    sconosciuta → altro (criterio 5). `packVolumeFromDescription` su «150 ML»,
    «200 EROGAZIONI», «30 G» e su una descrizione senza volume. Parole:
    singolare, plurale, genere e le due eccezioni per ogni categoria.

##### 63. `tests/forecast.test.ts` (Modify)

*   **Casi:** `consumptionOn` nei due modi e fuori dalle date di terapia;
    flacone migrato con `stock_qty = 1`, `days_per_pack = 30` e
    `stock_as_of` 10 giorni fa: copertura 20 e data di esaurimento uguale a
    `stock_as_of + 30` (criterio 2); scorta 0,333 salvata su 30 giorni dà 10
    giorni grazie a `STOCK_TOL`.

##### 64. `tests/aic.test.ts`, `tests/aifa-parse.test.ts`, `tests/pharmacy.test.ts`, `tests/actions.test.ts`, `tests/dose-changes.test.ts`, `tests/helpers/fixtures.ts`, `tests/helpers/aifa-sample.ts` (Modify)

*   **Modifiche:** `form` e `reorderDays` diventano `category` e
    `daysPerPack`; casi nuovi per «2 confezioni da 1 flacone», SUPPOSTE in
    `UNITS_RE` e dosi fino a 999.

##### 65. `tests/db/aifa.db.test.ts`, `tests/db/cron.db.test.ts`, `tests/db/sharing.db.test.ts` (Modify)

*   **Modifiche:** gli `insert` usano `category`. Casi nuovi in `cron`: un
    medicinale a livello riceve «meno di 14 giorni» e «ultima confezione»;
    dosi 999 e scorta 0,967 accettate dal database; `days_per_pack` con
    `as_needed` rifiutato.

##### 66. `tests/e2e/categories.spec.ts` (Create)

*   **Casi:** per ognuna delle 10 categorie del seed, la pagina del piano
    mostra il Dispenser con l'etichetta e la parola giuste; il calendario, il
    foglio A4, la scheda terapia e la lista farmacia mostrano il nome e la
    parola; l'email di avviso renderizzata contiene il nome della categoria
    (criterio 6).

#### Documentazione di R2

##### 67. README di contratto (Modify)

*   `lib/README.md`, `lib/actions/README.md`, `lib/email/README.md`,
    `components/README.md`, `components/ui/README.md`,
    `supabase/migrations/README.md`, `scripts/aifa/README.md`,
    `app/(app)/piani/[id]/medicinali/nuovo/README.md`,
    `app/(app)/piani/[id]/README.md`, `app/(print)/piani/[id]/stampa/README.md`,
    `app/(print)/piani/[id]/terapia/README.md` e `README.md`.
*   **Modifiche:** `lib/presidi.ts` diventa `lib/categories.ts`; le 10
    categorie, i due modi di conteggio e le nuove props di `Presidio`.

### Verification Plan

*   **Build e tipi:** `npm run typecheck` dopo ogni rilascio; nessun
    riferimento a `stock_mode`, `mode_since`, `prep_runs`, `form` o
    `reorder_days` resta fuori dalle migrazioni vecchie
    (`grep -rE "stock_mode|mode_since|prep_runs|reorder_days|\bform\b" app lib components`
    senza risultati pertinenti; criterio 1).
*   **Unit test:** `npm test`.
*   **Database:** `npm run test:db`.
*   **E2E:** `npm run test:e2e`.
*   **Lint:** `npm run lint`.
*   **Prova della migrazione sui dati veri:** prima di ciascun rilascio si
    ripristina il `pg_dump` di produzione su un Supabase locale, si applica la
    migrazione e si controllano a mano:
    *   R1: per ogni piano che era settimanale, `stock_as_of` dei medicinali
        uguale al valore atteso; `prep_reminder` acceso solo su quei piani.
    *   R2: nessuna `category` nulla; per ogni flacone, `stock_as_of +
        days_per_pack` uguale al vecchio `stock_as_of + reorder_days`; per ogni
        compressa nei piani giornalieri, la copertura calcolata dall'app uguale
        a quella del giorno prima (criteri 2 e 3).

--------------------------------------------------------------------------------

<!-- Provenance: Indicates initial structural drafting via EGM. -->

*Drafted with EGM*
