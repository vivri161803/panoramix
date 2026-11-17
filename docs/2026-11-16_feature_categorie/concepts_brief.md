# Dieci categorie AIFA per i medicinali (Presidio)

* **Author:** Carlo Bianchi
* **Date:** 2026-11-16
* **Stato:** finale, dopo due revisioni Goldfish (7 revisori ciascuna); tutte le decisioni confermate dall'autore

## Overview

Oggi Appoteca classifica i medicinali con una tassonomia fatta a mano: `medications.form` con quattro valori (compressa, iniezione, cerotto, collirio), otto forme di presidio in `shape` e `reorder_days` per il flacone di collirio. La proposta la sostituisce con dieci categorie ricavate dalla forma farmaceutica AIFA: pillola, bustina, liquido, iniezione, gocce, inalatore, cerotto, crema, supposta, altro. Le icone vengono dal componente Presidio del progetto grafico (tab 10, pagina Presidi, sezioni 07–10).

Insieme alla tassonomia la proposta semplifica le scorte. In tutti i piani la scorta scende giorno per giorno, e il portapillole settimanale diventa solo un promemoria che non tocca più le scorte.

Per chi lo usa: chi gestisce le medicine di un familiare scansiona la scatola e trova già la categoria, le parole giuste («12 siringhe», «circa 18 giorni · 1 flacone») e gli avvisi di riordino anche per sciroppi, inalatori e creme. Per colliri e creme si indica a mano quanti giorni dura una confezione, perché nessuno conosce le gocce o i grammi di una confezione.

Regola guida dell'autore: la soluzione più semplice che funziona. L'app è in alpha, con poche famiglie.

## Analysis

### Proposta

#### 1. Le scorte scendono sempre giorno per giorno

- **Cosa sparisce:**
  - `plans.stock_mode` e `plans.mode_since`;
  - le RPC `apply_prep`, `undo_prep` e `change_stock_mode`;
  - la tabella `prep_runs`, insieme alle sue regole RLS e al suo indice;
  - il pulsante «Portapillole preparato» con il suo annullamento (`components/PrepPanel.tsx`);
  - il ramo `weekly` in `lib/forecast.ts`: `currentStock` riga 252, `forecastMedication` righe 405-411 e 426-438, `computePrep`, `nextPrep` e `calendarWeekStart`.
  - Gli eventi storici `prep` e `prep_undo` in `stock_events` restano, con le loro etichette nella pagina Storico.
- **Il portapillole resta come promemoria.** Ci sono già `plans.prep_weekday` (default domenica) e `plans.prep_reminder`, modificabili da `components/PlanForm.tsx`. Il cron delle 17:00 manda il promemoria quando domani è `prep_weekday` e `prep_reminder` è acceso. Il promemoria elenca tutto ciò che è programmato nei 7 giorni dal giorno di preparazione, di ogni categoria, tranne i medicinali al bisogno. Ogni voce ha la sua dose («2 compresse la mattina», «1 goccia la sera»). Per ora non c'è la riga «cosa manca».
- **Il promemoria non deve partire a tutti.** Oggi `prep_reminder` vale `true` di default ed è bloccato solo dalla condizione `stock_mode === 'weekly'` (`lib/notify.ts:126`). Prima di togliere la colonna, la migrazione esegue `update plans set prep_reminder = (stock_mode = 'weekly')`, e il default passa a `false`. Il selettore del giorno compare quando il promemoria è acceso.
- **Piani settimanali esistenti, senza chiedere un nuovo conteggio.** In modalità settimanale `stock_qty` è già la scorta in casa, fuori dal portapillole. La migrazione sposta `stock_as_of` al giorno dopo la fine della settimana già preparata: `last prep_runs.week_start + 7`, oppure il primo `prep_weekday` da `mode_since` in poi. Da quel giorno la scorta scende ogni giorno. Se il calcolo sbaglia, gli avvisi arrivano prima, mai dopo.
- **Il costo per chi usa l'app:** chi riconta a metà settimana deve contare anche quello che è nel portapillole. Il riconteggio chiede «Quante ne hai in tutto, comprese quelle nel portapillole?». Nelle email e nel Dispenser sparisce l'avviso anticipato «Ne mancano N per la prossima preparazione». Gli avvisi di soglia invece arrivano come prima, perché la copertura settimanale contava già i giorni del portapillole (`lib/forecast.ts:410`).

#### 2. Categorie e modo di conteggio

- Nuova colonna `medications.category`: testo con un check sui 10 valori.
- **Modo di conteggio.** Un medicinale è «a livello» se ha `days_per_pack`, altrimenti è «a pezzi». È la stessa regola di oggi (`usesReorderDays`). Non c'è una colonna `count_mode` da tenere allineata: cambiare modo vuol dire scrivere o cancellare `days_per_pack`.
  - Default nel modulo: per liquido, gocce, inalatore e crema compare il campo «Quanti giorni dura una confezione?». Per le altre categorie compare «Quanti pezzi in una confezione?». Un link «Conta a pezzi / Conta a giorni» passa all'altro modo, per esempio per i colliri monodose a pezzi o per le penne multidose a giorni.
- `reorder_days` viene rinominata in `days_per_pack`, con lo stesso limite 1–365.
- `shape` resta solo per la pillola (tonda, ovale, capsula). Per le altre categorie è `null`, con il vincolo `(category = 'pillola') = (shape is not null)`. Per penne, fiale e siringhe esistenti la parola diventa quella della categoria, «siringhe».

#### 3. Come si calcolano i giorni

Una sola funzione in `lib/forecast.ts`, `consumptionOn(med, day)`, restituisce il consumo del giorno nell'unità della scorta. Tutti i calcoli di scorta passano da lì:

- **a pezzi:** la dose del giorno (`dosesOn`), come oggi;
- **a livello:** `1 / days_per_pack` per ogni giorno di calendario tra inizio e fine della terapia. Si usano i giorni di calendario perché è così che una persona stima «un tubo mi dura un mese». Non segue i cambi di dose: se la dose cambia, si aggiorna a mano «quanti giorni dura».

A livello la scorta si conta in **contenitori singoli** (flaconi, tubi, inalatori, penne), e `pills_per_pack` dice quanti contenitori ci sono in una scatola (di solito 1). Così «+1 confezione» (`arrivePacks`), «ultima confezione» (`stock ≤ pills_per_pack`), il tubo dei medicinali al bisogno (`lib/view.ts:70`) e la lista per la farmacia (`lib/pharmacy.ts`) funzionano senza regole a parte, purché usino `consumptionOn`.

Giorni = scorta ÷ consumo giornaliero, come nella richiesta. Il rapporto volume ÷ volume per dose serve solo a **precompilare** «Quanti giorni dura una confezione?»: se AIFA dà il volume (150 ML, 200 EROGAZIONI) e l'utente ha scritto le dosi, il modulo propone volume ÷ dose giornaliera, e l'utente può correggere il valore.

**Medicinali al bisogno a livello** (per esempio una crema): restano a pezzi, contati in contenitori. Al posto di «Presa 1» c'è «Finita una confezione», che toglie 1. Così non si sottraggono millilitri da un conteggio di tubi.

#### 4. Migrazione

Una sola migrazione, poi subito il codice nuovo. Prima si fa un `pg_dump`, che non costa nulla. Le due cose partono una dopo l'altra fuori dagli orari dei cron (07:00 e 17:00 UTC), perché il codice vecchio legge le colonne tolte.

Ordine:

1. `drop function` di `apply_prep(uuid,date,date,jsonb)`, `undo_prep(uuid,date)` e `change_stock_mode(uuid,text,date,jsonb)`, con la firma completa.
2. Sui piani settimanali: spostamento di `stock_as_of` e `prep_reminder` (punto 1). Poi `drop table prep_runs` e `drop column stock_mode, mode_since`.
3. Su `medications`:
   - aggiunta di `category` nullabile;
   - riempimento con un `CASE` su (form, shape), vedi la tabella sotto;
   - `set not null` su `category`;
   - rinomina di `reorder_days` in `days_per_pack`;
   - `shape` diventa nullabile e si azzera fuori dalla pillola;
   - si aggiunge il nuovo vincolo su `shape`;
   - si toglie `form`, e con lei si tolgono i vecchi check su `form` e `shape`;
   - si toglie il check `medications_reorder_days_flacone`, con `if exists`.
4. Flaconi: `stock_qty = 1`, `pills_per_pack = 1`, `stock_as_of` invariato. Così la data del riordino resta identica a oggi.
5. Nuovi limiti (punto 5) e `supabase/seed.sql` aggiornato.

| form, shape | category | modo |
| --- | --- | --- |
| compressa, tonda/ovale/capsula | pillola, `shape` invariata | pezzi |
| iniezione, siringa/penna/fiala | iniezione | pezzi |
| cerotto, cerotto/cerotto-tondo/bustina | cerotto | pezzi |
| collirio, flacone | gocce | livello (`days_per_pack` = vecchio `reorder_days`) |
| collirio, monodose | gocce | pezzi |

Il check attuale su `shape` ammette solo queste 11 coppie, quindi la tabella le copre tutte. Dopo il `CASE`, un `assert` (nessuna `category` nulla) ferma la migrazione se qualcosa sfugge.

I cerotti in bustina (`shape='bustina'`) restano cerotti: `formFromAifa` li crea solo da una forma farmaceutica di cerotto. L'autore controlla a mano le poche righe inserite senza scansione.

**Cambi di comportamento da sapere:**
- Il promemoria del flacone prima partiva anche con gli avvisi del piano spenti; ora segue gli interruttori del piano come ogni altro medicinale.
- Il primo cron può mandare un'email «ultima confezione» per ogni flacone, perché ogni flacone ora è 1 confezione. Con poche famiglie in alpha si accetta.

#### 5. Limiti dello schema

- Dosi per fascia in `medications` e `dose_changes`: il tipo passa da `numeric(4,1)` a `numeric(5,1)`, il limite da 0–20 a 0–999, sempre a passi di 0,5. Si ricreano i check con il loro nome. Copre insulina (40 UI), gocce orali (40) e sciroppi (30 ml).
- `stock_qty`, `stock_events.delta` e `stock_events.qty_after` passano da `numeric(8,1)` con passi di 0,5 a `numeric(10,3)` senza vincolo di passo. Serve perché a livello il consumo giornaliero è una frazione: dopo 1 giorno un flacone da 30 giorni vale 0,967, e ogni salvataggio di quella cifra oggi verrebbe rifiutato. Il passo 0,5 resta solo su ciò che l'utente scrive nei moduli.
- `pills_per_pack`: limite da 1–1000 a 1–10.000.
- Gli stessi limiti vanno in zod (`lib/schemas.ts`).

#### 6. Mappatura AIFA

- `categoryFromForm(forma)` in `lib/categories.ts` è una funzione pura. Prima controlla una breve lista di eccezioni:
  - GELATINOSA → pillola;
  - GRANULATO o POLVERE PER SOSPENSIONE ORALE → bustina;
  - POLVERE PER INALAZIONE in capsule → inalatore;
  - UNGUENTO o GEL OFTALMICO → crema;
  - forme VAGINALI e RETTALI non solide → crema;
  - SPRAY NASALE → gocce;
  - GOCCE ORALI → gocce.

  Poi applica le parole chiave della richiesta, a parola intera (`\bGEL\b`) e nell'ordine dato. Se nulla corrisponde, restituisce `altro`.
- La funzione decide solo la categoria. Il modo viene dal default della categoria.
- Test su circa 20 forme reali, compresi tutti i casi delle revisioni. Niente fixture con tutte le forme AIFA e niente spareggio con il codice ATC.
- `packVolumeFromDescription(desc)` legge «150 ML», «200 EROGAZIONI» e «30 G» dalla descrizione della confezione. Serve solo a precompilare i giorni e ha i suoi test.
- In `scripts/aifa/parse.mjs` si aggiunge solo SUPPOST a `UNITS_RE`. EROGAZIONI non va lì, perché è il volume di un inalatore e non un numero di pezzi.
- `formFromAifa` viene sostituita subito.

#### 7. Parole e icone

- `lib/categories.ts` sostituisce `lib/presidi.ts` con una sola tabella per categoria:
  - etichetta (quelle del design: Pillola, Bustina, Liquido, …);
  - parola del contenitore: compresse, bustine, flaconi, siringhe, flaconi, inalatori, cerotti, tubi, supposte, pezzi;
  - parola della dose: ml, gocce, erogazioni, applicazioni;
  - genere, per «rimasto» o «rimasta»;
  - passo della dose: 0,5 per pillola e liquido, 1 per il resto.

  Per `altro` la parola è «pezzi», non «unità», per non confonderla con le unità di insulina.
- `components/ui/Presidio.tsx` esiste già. Va esteso con i 10 glifi del design e con le props `category`, `pillShape`, `color`, `size`, `view` (icona o tubo) e `days`.
- Nel modulo «Aggiungi medicinale» c'è un selettore a 10 pulsanti (griglia 5×2, glifo al tratto ed etichetta, `aria-pressed`). Senza scansione non c'è nessuna categoria preselezionata.
- Calendario, foglio A4 e scheda terapia mostrano l'icona SVG con il nome della categoria e l'unità della dose. Le email mostrano solo il nome della categoria e il pallino del colore, perché i client di posta tolgono gli SVG.

#### 8. Dispenser

La scala 0–60 con le tacche a 7 e 14 esiste già (`components/Dispenser.tsx:3`). Le modifiche:

- **A pezzi:** le icone della categoria si impilano fino all'altezza dei giorni di copertura. Sotto il tubo resta il testo con i pezzi veri («26 compresse»), perché il numero di icone segue l'altezza e non i pezzi.
- **A livello:** una fascia piena nel colore del medicinale. Il testo è «circa N giorni · 2 flaconi»; per una quantità non intera, «1 flacone e mezzo» oppure «meno di un flacone».
- **Etichetta:** il nome della categoria è sempre accanto all'icona, anche per le compresse.
- **Oltre 60 giorni:** tubo pieno con «60+», come nel design.
- **Riconteggio:**
  - a pezzi: «Quante ne hai in tutto?»;
  - a livello: «Confezioni chiuse» più «Quella aperta: piena, metà o quasi finita» (1, 0,5 o 0,1).

  Le frasi si costruiscono dalla tabella delle parole, così il genere è giusto.

### Cosa hanno trovato le revisioni

**Prima revisione.** Ha bloccato quattro idee della richiesta originale:
- la tabella ALIAS del design come mappa di migrazione: un cerotto in bustina sarebbe diventato una bustina orale;
- la rimozione di `reorder_days`: era l'unico dato di copertura dei flaconi;
- un portapillole ristretto ad alcune categorie: nei piani settimanali iniezioni e cerotti non sarebbero più scesi;
- i limiti della dose a 20.

Ha mostrato anche:
- una decina di forme AIFA classificate male dalle parole chiave in ordine;
- che i dati AIFA non hanno il volume;
- che una quarantina di file leggono `form` e `shape`.

**Seconda revisione.** Ha confermato che togliere la discesa settimanale risolve il problema del portapillole. Ha trovato due blocchi nella prima proposta:
- a livello la scorta diventa frazionaria e il tipo `numeric(8,1)` con passo 0,5 la rifiuta;
- una dose di 1000 non sta in `numeric(4,1)`.

Ha trovato anche:
- che, togliendo `stock_mode`, il promemoria del portapillole sarebbe partito per tutti;
- che i flaconi non avrebbero mantenuto la stessa copertura senza normalizzarli a 1;
- che quasi nessuna delle condizioni previste per il segnale «da ricontrollare» poteva scattare davvero.

Le correzioni sono tutte nella proposta qui sopra. Nella seconda revisione tre revisori su sette hanno proposto di togliere `pack_volume` e la colonna `count_mode`: la proposta lo fa.

## Criteri di accettazione

1. Dopo la migrazione nessuna riga ha `category` nulla e nessun codice dell'app legge `form`, `stock_mode`, `mode_since` o `prep_runs`.
2. Ogni flacone esistente ha la stessa data di riordino del giorno prima.
3. Ogni compressa nei piani giornalieri ha gli stessi giorni di copertura del giorno prima.
4. Il promemoria del portapillole parte solo per i piani che erano settimanali o che lo accendono.
5. `categoryFromForm` passa i test sulle forme reali, compresi tutti i casi delle revisioni.
6. Un medicinale per ogni categoria attraversa modulo, Dispenser, calendario, foglio A4, scheda terapia, lista farmacia ed email con l'icona o il nome e la parola giusta (un test per categoria).
7. `npm test`, `npm run test:db`, `npm run test:e2e`, `npm run typecheck` e `npm run lint` passano.

## Rilascio e comunicazione

- Due rilasci separati. Il primo toglie la discesa settimanale: è quasi solo codice cancellato, più la correzione di `prep_reminder`. Il secondo introduce la tassonomia. All'inizio le nuove categorie possono usare glifi semplici; le icone in calendario e stampa possono arrivare dopo il Dispenser.
- A chi usava il portapillole settimanale si scrive una riga: da ora le scorte scendono ogni giorno, e quando si riconta si conta anche ciò che è nel portapillole.
- I README di contratto toccati (`lib/`, `components/`, `components/ui/`, `supabase/migrations/`, `scripts/aifa/`, `lib/email/`, le pagine coinvolte) e il README principale si aggiornano nello stesso rilascio.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  1. Dieci categorie in `medications.category`, con migrazione da (form, shape) e `shape` solo per la pillola.
  2. Scorte giorno per giorno in tutti i piani; portapillole come solo promemoria.
  3. Modo livello con `days_per_pack` (il vecchio `reorder_days`) e scorta in contenitori; una sola funzione di consumo.
  4. `categoryFromForm` e `packVolumeFromDescription` con test.
  5. Limiti e tipi dello schema allargati.
  6. Tabella unica di parole, Presidio con 10 glifi, selettore 5×2, Dispenser con fascia di livello ed etichette.
  7. Calendario, foglio A4, scheda terapia, lista farmacia ed email con icona o nome e parola giusta.
* **Out-of-Scope Non-Goals:**
  - Calcolo con il volume per dose che segue i cambi di dose (`pack_volume`).
  - Colonna `count_mode` separata.
  - Riga «cosa manca» nel promemoria del portapillole.
  - Avviso anticipato «Ne mancano N per la prossima preparazione».
  - Segnale «da ricontrollare» (le correzioni in SQL coprono tutti i casi).
  - Migrazione in più fasi, tabella di backup, prova a secco degli avvisi.
  - Spareggio con il codice ATC, fixture di tutte le forme AIFA, colonne di tracciamento.
  - Icone SVG nelle email, classificazione automatica dei prodotti senza AIC.

## Alternatives Weighed

- **Categorie fatte a mano come oggi.** Scartata dall'autore: dipendono dalla sua esperienza e non coprono l'elenco AIFA.
- **Tenere `form` accanto a `category`.** Scartata dall'autore: la nuova tassonomia sostituisce la vecchia.
- **Migrazione con la tabella ALIAS del design.** Scartata nella prima revisione: trasforma i cerotti in bustina in bustine orali e manda le compresse in `altro`.
- **Portapillole solo per pillola, bustina e supposta, con due regole di discesa.** Scartata dall'autore: il portapillole prende tutto ciò che è programmato, e la discesa settimanale si toglie.
- **Migrazione in tre fasi con backup e prova a secco.** Scartata dall'autore: l'app è in alpha.
- **Il nome `stock_mode` per il modo di conteggio.** Scartato: si confonde con `plans.stock_mode`.
- **`count_mode` come colonna salvata.** Scartata nella seconda revisione: «a livello» equivale ad «ha `days_per_pack`», e una seconda colonna può andare fuori sincrono.
- **`pack_volume` salvato, con consumo = dose ÷ volume.** Scartato nella seconda revisione: aggiunge una colonna, una regola di precedenza e dei limiti, e per colliri e creme nessuno conosce il volume per dose. Il rapporto volume ÷ dose resta solo come precompilazione di `days_per_pack`.
- **Modello con unità esplicite (`pack_unit`, `dose_unit`).** Scartato: è il più generale, ma ha troppe colonne e controlli per un'app in alpha.
- **Scorta a livello in ml o gocce.** Scartata: il fattore gocce/ml non è noto, e lo storico di `stock_events` mescolerebbe unità diverse.
- **Mappatura con le sole parole chiave nell'ordine della richiesta.** Scartata nella prima revisione: almeno dieci classi di errori, per esempio GEL dentro GELATINOSA.
- **Etichette di uso comune («Compresse e capsule», «Supposte e ovuli»).** Rimandate: si usano quelle del design per coerenza; il cambio costa poco più avanti.
- **Cancellare e reinserire i medicinali da sistemare.** Sostituita da una correzione in SQL dove possibile, perché tiene lo storico.

## Key Decisions & Staging for Next Steps

Decise dall'autore:
- Le 10 categorie sostituiscono `form` e le forme dei presidi.
- Giorni = scorta ÷ consumo giornaliero, una sola formula.
- Il calendario contiene tutti i medicinali programmati, esclusi quelli al bisogno.
- Tutto si allinea al nuovo progetto grafico, compresse comprese.
- Le scorte scendono giorno per giorno in tutti i piani; il portapillole diventa un promemoria per tutto ciò che è programmato.
- `reorder_days` diventa `days_per_pack`.
- I limiti dello schema si allargano.
- Le migrazioni si gestiscono nel modo più semplice, perché l'app è in alpha.

Proposte dopo la seconda revisione, confermate dall'autore il 2026-11-16 (nessun segnale «da ricontrollare», precompilazione dei giorni da volume ÷ dose, un'email «ultima confezione» per flacone accettata, due rilasci separati):
1. **Segnale «da ricontrollare».** L'autore l'aveva chiesto. La seconda revisione mostra che, con le correzioni in SQL, nessuna riga lo accenderebbe:
   - i piani settimanali si sistemano spostando `stock_as_of`;
   - i flaconi si normalizzano a 1;
   - le 11 coppie (form, shape) sono tutte coperte;
   - i cerotti in bustina sono cerotti veri.

   Proposta: non aggiungerlo. Se l'autore lo vuole comunque come rete di sicurezza, va nella versione minima: un booleano che toglie il medicinale dagli avvisi e dalla lista farmacia, con un'etichetta nel Dispenser, e che si spegne da solo con il primo riconteggio.
2. **Precompilare «quanti giorni dura» da volume ÷ dose** invece di salvare il volume. La formula «volume / volume per dose» dell'autore resta, ma si applica una volta sola nel modulo. Se la dose cambia, i giorni vanno aggiornati a mano.
3. **Un'email «ultima confezione» per ogni flacone al primo cron**, accettata invece di pre-registrare gli avvisi.
4. **Due rilasci separati** (prima la rimozione della discesa settimanale, poi la tassonomia) oppure uno solo.
