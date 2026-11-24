# Dati AIFA

Fonte: [AIFA, open data](https://www.aifa.gov.it/open-data), licenza CC-BY 4.0.
`scripts/import-aifa.mjs` scarica i cinque file e li copia nelle tabelle `aifa_*` (vedi
`supabase/migrations/20261110000100_aifa.sql`). Parser e normalizzatori sono in
`scripts/aifa/parse.mjs` (funzioni pure, testate con le fixture in `tests/fixtures/aifa/`).

Formati verificati il 9 novembre 2026 sui file veri.

## Regole comuni

- Separatore `;`. Campi tra virgolette quando contengono `;`, virgolette (raddoppiate: `""`) o a capo.
  Serve un lettore CSV vero: nell'elenco carenti 40 righe hanno un a capo dentro un campo.
- AIC: sempre testo a 9 cifre. La lista di trasparenza li scrive **senza zeri iniziali**
  (8 cifre, a volte 7): vanno completati con `padStart(9, "0")`.
- Testo in maiuscolo come nel file: nel database resta così, l'app lo sistema per la vista.
- Le intestazioni vengono confrontate esattamente (dopo aver tolto spazi ai lati): se AIFA cambia
  le colonne l'import si ferma con un errore e non scrive nulla.
- **Codifica riconosciuta da sola**, per tutte e cinque le sorgenti: il file si legge prima come
  UTF-8 stretto (un byte non valido è un errore) e, se non è UTF-8 valido, come Windows-1252. Per i
  file ASCII le due letture coincidono. `SOURCES[*].encoding` è la codifica **attesa**: se il file
  arriva in un'altra, la riga di riepilogo lo dice (`carenze: 2525 righe, dati al 2026-11-24, 6 s
  (letto come UTF-8, atteso Windows-1252)`) e l'import resta riuscito. Il 21–23 novembre 2026 AIFA
  ha pubblicato l'elenco dei carenti in UTF-8 e l'import si era fermato per "colonne cambiate".

## Anagrafica confezioni · `confezioni_fornitura.csv`

`https://drive.aifa.gov.it/farmaci/confezioni_fornitura.csv`, circa 82 MB, circa 160.000 righe,
aggiornato ogni notte. Codifica: ASCII (accenti scritti come apostrofo, `UNITA'`), letto come UTF-8
(`encoding: "utf-8"` in `SOURCES`, di cui ASCII è un sottoinsieme). Tutti i campi
tra virgolette tranne `CODICE_DITTA`. Righe terminate da `\n`.

```
"CODICE_AIC";"COD_FARMACO";"COD_CONFEZIONE";"DENOMINAZIONE";"DESCRIZIONE";"CODICE_DITTA";"RAGIONE_SOCIALE";"STATO_AMMINISTRATIVO";"TIPO_PROCEDURA";"FORMA";"CODICE_ATC";"PA_ASSOCIATI";"FORNITURA";"LINK_FI";"LINK_RCP"
```

- Si importano `CODICE_AIC`, `DENOMINAZIONE`, `DESCRIZIONE`, `FORMA`, `CODICE_ATC`, `FORNITURA`.
- **Non c'è una colonna con le unità posologiche.** `dose_units` si ricava da `DESCRIZIONE`:
  l'ultimo "numero + COMPRESSE/CAPSULE/…" (`"5 MG COMPRESSE" 28 COMPRESSE` → 28,
  `500 MG COMPRESSE-10 COMPRESSE` → 10). Circa un terzo delle confezioni ha un numero di compresse
  leggibile, il resto sono gocce, creme, fiale.
- `FORNITURA` è il regime di fornitura in parole ("Medicinali soggetti a prescrizione medica",
  "Medicinali non soggetti a prescrizione medica, da banco.", …). Richiede ricetta se inizia con
  "Medicinali soggetti".
- `STATO_AMMINISTRATIVO` e titolare non si importano (fuori ambito).
- Esiste anche `confezioni.csv` (senza `FORNITURA`, campi senza virgolette): non si usa.

## Principi attivi · `PA_confezioni.csv`

`https://drive.aifa.gov.it/farmaci/PA_confezioni.csv`, circa 12 MB, circa 340.000 righe. ASCII, letto come UTF-8.

```
CODICE_AIC;PRINCIPIO_ATTIVO;QUANTITA;UNITA_MISURA
```

- Una riga per principio attivo: circa 24.500 confezioni ne hanno più di uno (l'ordine del file
  diventa `position`).
- Quantità con il punto decimale e a volte uno spazio davanti (` 0.0`). Vuota per molte righe.
- `N.D.` come principio attivo o come unità, `Q.TA E UM NON PRESENTI SU ET`, quantità vuota o
  `0.0` con unità `N.D.` → `null`. Un principio attivo `N.D.` non si importa.
- Unità in parole, italiano o inglese: `milligrammi`, `microgrammi`, `grammi`,
  `milligram(s)/millilitre`, `international unit(s)`, `percent`, … (vedi `UNIT_ABBR` in `parse.mjs`).

## Anagrafica ATC · `atc.csv`

`https://drive.aifa.gov.it/farmaci/atc.csv`, ASCII, letto come UTF-8. La lunghezza cambia: 92 righe il 9 novembre 2026
in un download, 7.219 nel primo import di produzione dello stesso giorno.

```
CODICE_ATC;DESCRIZIONE
```

Livelli misti (gruppo, sottogruppo, principio attivo). Le etichette dei 14 gruppi mostrate
nell'app sono in `lib/atc.ts`; questa tabella serve solo come riferimento.

## Farmaci carenti · `elenco_medicinali_carenti.csv`

`https://www.aifa.gov.it/documents/20142/847339/elenco_medicinali_carenti.csv`, circa 0,9 MB,
circa 2.500 righe, aggiornato ogni settimana circa. Codifica attesa **Windows-1252** (`Sì`,
`rimborsabilità`, virgolette tipografiche); dal 21 al 23 novembre 2026 è arrivato in UTF-8, letto
lo stesso (vedi Regole comuni). Righe `\r\n`, con `\r` o `\n` dentro i campi.

Due righe di preambolo, poi l'intestazione:

```
NB: I medicinali carenti, per i quali il Titolare AIC non abbia provveduto … ;;;;;;;;;;;;
Elenco dei farmaci carenti aggiornato al 05/11/2026;;;;;;;;;;;;
Nome medicinale;Codice AIC;Principio attivo;Forma farmaceutica e dosaggio;Titolare AIC;Data inizio;Fine presunta;Equivalente;Motivazioni;Suggerimenti/Indicazioni AIFA;Nota AIFA;Classe di rimborsabilità;Codice ATC
```

- La data di aggiornamento (`aggiornato al gg/mm/aaaa`) diventa `source_date` dell'import.
- Date `gg/mm/aaaa` → ISO. `Fine presunta` spesso vuota.
- `Equivalente` vale `Sì`/`No`.
- Lo stesso AIC può comparire due volte (2 casi): la tabella non ha `aic` come chiave.

## Lista di trasparenza · `Lista_farmaci_equivalenti.csv`

`https://www.aifa.gov.it/documents/20142/825643/Lista_farmaci_equivalenti.csv`, circa 1,8 MB,
circa 8.600 righe, aggiornata ogni mese circa. Codifica attesa **Windows-1252** (anche UTF-8 si legge, vedi Regole
comuni), righe `\r\n`.

```
Principio attivo;Confezione di riferimento;ATC;AIC;Farmaco;Confezione;Ditta;Prezzo riferimento SSN;Prezzo Pubblico 15 ottobre 2026;Differenza;Nota;Codice gruppo equivalenza
```

- La colonna del prezzo al pubblico contiene la data **in parole** (`Prezzo Pubblico 15 ottobre 2026`):
  si riconosce per prefisso e la data diventa `prices_as_of` e `source_date`.
- AIC senza zeri iniziali (vedi sopra); ogni AIC compare una volta sola.
- Prezzi con virgola decimale e simbolo dell'euro: `5,63 €` → `5.63`.
- `Codice gruppo equivalenza`: circa 1.000 gruppi (`DRA`, `H4B`, …).

## Import

- Lo SHA-256 del file scaricato si confronta con l'ultimo import riuscito della stessa sorgente:
  se è uguale l'import si registra come `skipped` (vale come controllo riuscito per l'avviso di
  freschezza) e non tocca le tabelle.
- Il download si riprova fino a 3 volte (dopo 15 e 30 secondi) se il sito risponde 5xx, 408, 429 o
  chiude la connessione: il primo import di produzione ha preso un 502 momentaneo sulle carenze.
- Le righe nuove si scrivono con un `import_id` nuovo, a blocchi di 1000, poi la funzione
  `aifa_finish_import` cancella quelle con `import_id` diverso, nel database, senza limite di
  tempo dell'API. Se l'import si interrompe a metà restano anche le righe vecchie: nessun dato
  manca, il giro successivo pulisce.
- **Le tabelle vecchie restano finché il file nuovo non è buono.** File non trovato, colonne
  cambiate, troppe righe senza AIC o file con meno della metà delle righe dell'ultimo import
  (`checkShrink`): l'import si registra come `failed` e non tocca le tabelle. `--force` salta il
  controllo della lunghezza.
- **Avviso dopo 7 giorni.** Il controllo del mattino (`app/api/cron/alerts`) chiama
  `findStaleAifa` (`lib/ops.ts`, regole in `lib/aifa-freshness.ts`): ogni sorgente senza un import
  `ok` o `skipped` da più di 7 giorni finisce nell'email tecnica a `OPS_ALERT_EMAIL`, con l'ultimo
  errore. Parte ogni mattina finché il problema resta.
- Test: `tests/aifa-parse.test.ts` (parser), `tests/aifa-encoding.test.ts` (codifica),
  `tests/aifa-freshness.test.ts` (avviso), `tests/db/aifa-import.db.test.ts` (pipeline completa sul
  Supabase locale: primo import, secondo giro saltato, file mancante, colonne cambiate, file troppo
  corto, confezione tolta, carenze e trasparenza in UTF-8).

## Interface

Modulo ES `parse.mjs`, importato da `scripts/import-aifa.mjs` e da `tests/aifa-parse.test.ts`.

- `parseCsv(text, delimiter = ";")`: generatore di righe (array di stringhe); toglie il BOM,
  gestisce `""`, a capo dentro i campi e righe `\r\n`, `\r` o `\n`.
- `aic9(s)`: AIC a 9 cifre con zeri iniziali (toglie una `A` iniziale); `null` se non è un AIC.
- `text(s)`: testo ripulito; `null` per vuoti, `N.D.`, `ND`, `Q.TA E UM NON PRESENTI SU ET`.
- `num(s)`: numero con virgola o punto, `€` e spazi ammessi; `null` se non valido.
- `itDate(s)`: `gg/mm/aaaa` → ISO; `itWordsDate(s)`: `15 ottobre 2026` → ISO; `null` se non valide.
- `doseUnitsFromDescription(desc)`: ultimo "numero + COMPRESSE/CAPSULE/SUPPOSTE/…" (`UNITS_RE`), tra 1 e 1000.
- `requiresPrescription(regime)`: `true`/`false` dal prefisso di `FORNITURA`, altrimenti `null`.
- `SOURCES`: le cinque sorgenti (`confezioni`, `principi_attivi`, `atc`, `carenze`, `trasparenza`)
  con `url`, `encoding` (codifica attesa), `preamble`, `headers`, `table`, `key`, `map(r, ctx)` e, per `carenze` e
  `trasparenza`, `sourceDate`.
- `decode(bytes)`: → `{ text, encoding }`; UTF-8 stretto se i byte sono UTF-8 valido, altrimenti
  Windows-1252 (`encoding` è `"utf-8"` o `"windows-1252"`). Il BOM resta nel testo e lo toglie `parseCsv`.
- `parseSource(name, content)`: → `{ rows, sourceDate, total, skipped }`.
- `HeaderMismatchError`: errore per intestazioni cambiate, file vuoto o troppe righe scartate.
- `checkShrink(name, rows, previousRows)` e `MIN_ROWS_SHARE` (0,5): rifiuto dei file troppo corti.

Tabelle di destinazione per sorgente (`SOURCES[*].table` / `key`): `aifa_packs` (`aic`),
`aifa_pack_ingredients` (`aic`, `position`), `aifa_atc` (`code`), `aifa_shortages` (nessuna chiave),
`aifa_transparency` (`aic`).

## Invariants

- Funzioni pure: nessuna rete, nessun database, nessun file (commento in testa a `parse.mjs`).
- `parseSource` lancia `HeaderMismatchError` se l'intestazione non coincide con `spec.headers`
  (confronto esatto dopo `trim`, oppure per prefisso con `{ prefix }`): in quel caso non si importa nulla.
- `parseSource` lancia se il file non ha righe dati, o se le righe scartate superano
  `MAX_SKIPPED_SHARE` (2%), tranne per `principi_attivi`.
- Con `spec.key` i doppioni di chiave si tolgono e vale l'ultima riga; senza chiave (`carenze`)
  si tengono tutte.
- `position` di `principi_attivi` è assegnata da `parseSource` nell'ordine del file, a partire da 1 per AIC.
- `checkShrink` non controlla nulla se l'ultimo import aveva meno di 20 righe (o nessuno);
  altrimenti lancia se `rows < previousRows * MIN_ROWS_SHARE`.
- Le date restituite sono stringhe ISO `aaaa-mm-gg` oppure `null` (date impossibili comprese).

## Side Effects

- None: `parse.mjs` non scrive né legge nulla fuori dagli argomenti. Download, scrittura delle
  tabelle `aifa_*` e registro `aifa_imports` sono in `scripts/import-aifa.mjs` (vedi `../README.md`).

## Verification

- Run: `npm test` (vitest; parser in `tests/aifa-parse.test.ts`, fixture in `tests/fixtures/aifa/`)
- Pipeline completa sul Supabase locale: `npm run test:db` (`tests/db/aifa-import.db.test.ts`)
