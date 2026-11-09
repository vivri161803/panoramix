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

## Anagrafica confezioni · `confezioni_fornitura.csv`

`https://drive.aifa.gov.it/farmaci/confezioni_fornitura.csv`, circa 82 MB, circa 160.000 righe,
aggiornato ogni notte. Codifica: ASCII (accenti scritti come apostrofo, `UNITA'`). Tutti i campi
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

`https://drive.aifa.gov.it/farmaci/PA_confezioni.csv`, circa 12 MB, circa 340.000 righe. ASCII.

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

`https://drive.aifa.gov.it/farmaci/atc.csv`, 92 righe. ASCII.

```
CODICE_ATC;DESCRIZIONE
```

Contiene solo una piccola parte dei codici (livelli misti). Le etichette dei 14 gruppi mostrate
nell'app sono in `lib/atc.ts`; questa tabella serve solo come riferimento.

## Farmaci carenti · `elenco_medicinali_carenti.csv`

`https://www.aifa.gov.it/documents/20142/847339/elenco_medicinali_carenti.csv`, circa 0,9 MB,
circa 2.500 righe, aggiornato ogni settimana circa. Codifica **Windows-1252** (`Sì`,
`rimborsabilità`, virgolette tipografiche). Righe `\r\n`, con `\r` o `\n` dentro i campi.

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
circa 8.600 righe, aggiornata ogni mese circa. Codifica **Windows-1252**, righe `\r\n`.

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
- Test: `tests/aifa-parse.test.ts` (parser), `tests/aifa-freshness.test.ts` (avviso),
  `tests/db/aifa-import.db.test.ts` (pipeline completa sul Supabase locale: primo import, secondo
  giro saltato, file mancante, colonne cambiate, file troppo corto, confezione tolta).
