# scripts

## Overview

Script Node (ES module, `.mjs`) lanciati a mano, da `package.json` o da GitHub Actions: import
notturno dei dati AIFA in Supabase, avvio dei test sul database locale e dei test end-to-end,
generazione delle icone PNG. Non fanno parte del bundle dell'app Next.js.

## Interface

- `import-aifa.mjs`: import dei dati AIFA nelle tabelle `aifa_*`.
  `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/import-aifa.mjs [sorgente…] [--dir cartella] [--force]`
  - `sorgente`: una o più chiavi di `SOURCES` (`confezioni`, `principi_attivi`, `atc`, `carenze`,
    `trasparenza`); di default tutte.
  - `--dir`: legge i file da una cartella (stesso nome del file nell'URL AIFA) invece di scaricarli.
  - `--force`: importa anche se lo SHA-256 è uguale all'ultimo import riuscito e salta `checkShrink`.
  - Codici di uscita: `0` tutto bene, `1` almeno una sorgente non riuscita, `2` sorgente sconosciuta
    o variabili d'ambiente mancanti.
  - Lanciato ogni notte da `.github/workflows/aifa-import.yml`.
- `test-db.mjs`: `npm run test:db`. Legge `npx -y supabase@2 status -o json` e lancia
  `npx vitest run tests/db --no-file-parallelism` con `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`,
  `TEST_SUPABASE_SERVICE_ROLE_KEY`, `TEST_MAILPIT_URL`. Gli argomenti extra passano a vitest.
- `test-e2e.mjs`: `npm run test:e2e`. Come sopra, ma lancia `npx playwright test` con
  `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY`, `MAILPIT_URL`.
- `build-icons.mjs`: `node scripts/build-icons.mjs`. Genera `public/email-logo.png` (96×96) e
  `app/apple-icon.png` (180×180, senza angoli arrotondati) da `app/icon.svg` con `sharp`.
- Sottocartelle:
  - [aifa](./aifa/README.md) - parser puri dei file AIFA (`parse.mjs`: `SOURCES`, `parseSource`,
    `checkShrink`, `decode`, normalizzatori) e formati dei cinque file.

## Invariants

- `import-aifa.mjs` controlla tutto il file (`parseSource`, poi `checkShrink` se manca `--force`)
  prima di scrivere: se una sorgente fallisce, le sue tabelle restano quelle dell'ultimo import riuscito.
- File identico all'ultimo import `ok` (stesso `file_sha256`, senza `--force`): si registra una riga
  `status: "skipped"` in `aifa_imports` e le tabelle non si toccano.
- Le righe si scrivono con il nuovo `import_id` a blocchi di `BATCH` (1000): `upsert` su `spec.key`
  oppure `insert` se la sorgente non ha chiave; poi `aifa_finish_import` (RPC) chiude l'import.
- Ogni sorgente non riuscita lascia una riga `status: "failed"` in `aifa_imports` con l'errore
  (troncato a 2000 caratteri), sia prima sia dopo l'apertura dell'import.
- Download: fino a 3 tentativi con attesa di 15 s × tentativo; gli errori 4xx diversi da 408 e 429
  sono permanenti e non si riprovano. Timeout di 10 minuti per download.
- Scritture sul database: fino a 3 tentativi con attesa di 1 s × tentativo (`withRetry`).
- `test-db.mjs` e `test-e2e.mjs` escono con codice 1 se Supabase locale non è avviato; altrimenti
  escono con il codice del processo figlio. I test sul database girano un file alla volta
  (`--no-file-parallelism`) perché condividono lo stesso database.

## Side Effects

- `import-aifa.mjs`: richieste HTTP ai file AIFA (`drive.aifa.gov.it`, `www.aifa.gov.it`) con
  `User-Agent` dedicato; con `--dir` legge invece file locali. Scrive con la service role su
  Supabase: `aifa_imports`, `aifa_packs`, `aifa_pack_ingredients`, `aifa_atc`, `aifa_shortages`,
  `aifa_transparency`, e chiama la funzione `aifa_finish_import`, che cancella le righe con
  `import_id` diverso. Uscita `1` fa partire l'email di GitHub Actions al proprietario.
- `test-db.mjs`, `test-e2e.mjs`: avviano processi figli (`npx supabase`, `npx vitest`,
  `npx playwright`) che usano il Supabase locale (Docker); i test scrivono sul database locale.
- `build-icons.mjs`: legge `app/icon.svg`, sovrascrive `public/email-logo.png` e `app/apple-icon.png`.

## Verification

- Run: `npm test` (vitest; `tests/aifa-parse.test.ts` copre i parser usati dall'import)
- Sul Supabase locale (`npx supabase start`): `npm run test:db` (`tests/db/aifa-import.db.test.ts`
  copre l'import completo) e `npm run test:e2e`
