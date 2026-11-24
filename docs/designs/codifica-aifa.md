# Codifica dei file AIFA: UTF-8 oppure Windows-1252

Stato: bozza, 24 novembre 2026.

## 1. Problema

Il 21, 22 e 23 novembre 2026 l'import notturno è fallito sulla sola sorgente `carenze`, con
"AIFA ha cambiato le colonne di carenze: … attese `Classe di rimborsabilità` … trovate
`Classe di rimborsabilitÃ`".

- `SOURCES.carenze.encoding` è fisso a `windows-1252` (`scripts/aifa/parse.mjs`).
- In quei giorni AIFA ha pubblicato il file in UTF-8: la `à` diventa i byte `C3 A0`, che letti
  come Windows-1252 danno `Ã` più uno spazio non separabile, poi tolto dal `trim()`.
- Il 24 novembre il file è tornato in Windows-1252 (`à` = `E0`) e l'import è riuscito.

Il controllo delle intestazioni ha fatto il suo lavoro: le tabelle sono rimaste quelle del 20
novembre. Ma le colonne non erano cambiate, era cambiata solo la codifica. L'import non deve
fermarsi per questo.

## 2. Comportamento voluto

### 2.1 Codifica riconosciuta da sola
Per ogni sorgente, il file scaricato si legge prima come UTF-8 in modo stretto (un byte non valido
è un errore, non un carattere di sostituzione). Se la lettura riesce si usa quella; se fallisce si
legge come Windows-1252.

- Vale per tutte e cinque le sorgenti, non solo per `carenze`: anche `trasparenza` è in
  Windows-1252 e può cambiare allo stesso modo; per i file ASCII le due letture coincidono.
- Un file Windows-1252 con lettere accentate non è quasi mai UTF-8 valido (`à` = `E0` da sola non
  forma una sequenza UTF-8), quindi non viene scambiato per UTF-8.
- Il BOM UTF-8 iniziale continua a essere tolto da `parseCsv`.

### 2.2 Le colonne cambiate bloccano ancora
Il controllo delle intestazioni resta identico e si fa sul testo già decodificato. Se AIFA cambia
davvero il nome o l'ordine delle colonne, l'import si ferma come oggi e le tabelle restano quelle
dell'ultimo import riuscito.

### 2.3 Si vede quando la codifica cambia
`SOURCES[*].encoding` diventa la codifica **attesa**. Quando il file è stato letto con una codifica
diversa, la riga di riepilogo dell'import lo dice, ad esempio
`carenze: 2525 righe, dati al 2026-11-24, 6 s (letto come UTF-8, atteso Windows-1252)`.
È solo un'informazione: l'import resta riuscito.

### 2.4 Contenuto identico in entrambe le codifiche
Lo stesso elenco salvato in UTF-8 o in Windows-1252 produce le stesse righe nelle tabelle (stessi
accenti, `Sì`, virgolette tipografiche).

## 3. Fuori ambito
- Altre codifiche (UTF-16, ISO-8859-15): non viste nei file AIFA.
- Salvare la codifica usata in `aifa_imports`: richiede una migrazione; per ora basta il log
  del workflow.
- Il ritardo dell'avvio programmato su GitHub (03:30 UTC, parte tra le 10:48 e le 14:08).
- Il 502 del 9 novembre: è già gestito dai tre tentativi di download.

## 4. Dove si tocca
- `scripts/aifa/parse.mjs`: `decode` restituisce il testo e la codifica usata.
- `scripts/import-aifa.mjs`: usa la nuova `decode` e aggiunge la nota alla riga di riepilogo.
- `tests/aifa-parse.test.ts`, `tests/db/aifa-import.db.test.ts`, `tests/fixtures/aifa/`.
- `scripts/aifa/README.md`: regole comuni, sezioni carenze e trasparenza, Interface.
