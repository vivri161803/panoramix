# Ticket — Codifica dei file AIFA: UTF-8 oppure Windows-1252

Design doc: docs/designs/codifica-aifa.md
Criteri approvati: sì (2026-11-24)
Comando test: `npm test && npm run test:db` (il secondo richiede Supabase locale in Docker; se la shell non ha ancora il gruppo docker: `sg docker -c "npm run test:db"`)
Branch: feat/codifica-aifa

Stati: `todo` · `in-corso` · `attesa-umano` · `fatto` · `bloccato`

---

## T1 · L'elenco dei carenti in UTF-8 si importa   [fatto]
Tipo: tracer bullet
Fonte: §1, §2.1, §2.2, §2.4
Dipende da: —
Codice esistente toccato: scripts/aifa/parse.mjs (`decode`), scripts/import-aifa.mjs (`importSource`), tests/aifa-parse.test.ts, tests/db/aifa-import.db.test.ts
Obiettivo: un elenco dei farmaci carenti pubblicato in UTF-8, come quello del 21–23 novembre, passa per tutto l'import (lettura, controllo colonne, scrittura nel database) invece di fermarsi. I file in Windows-1252 continuano a funzionare e un vero cambio di colonne continua a bloccare.
Accettazione:
- T1-A1 — Dato l'elenco dei carenti salvato in UTF-8, quando parte l'import, allora l'import riesce e nel database ci sono le stesse righe che si ottengono dal file in Windows-1252, con accenti e `Sì` scritti correttamente.
- T1-A2 — Dato l'elenco dei carenti in Windows-1252 come quello di oggi, quando parte l'import, allora il risultato è identico a prima della modifica.
- T1-A3 — Dato un elenco dei carenti in UTF-8 con una colonna rinominata, quando parte l'import, allora l'import si ferma con "AIFA ha cambiato le colonne di carenze" e le tabelle restano quelle dell'ultimo import riuscito.
- T1-A4 — Dato un file che non è UTF-8 valido (byte accentati in Windows-1252), quando viene letto, allora non compaiono caratteri di sostituzione (`�`) e il testo è quello Windows-1252.
Fuori scope: segnalare nel log la codifica usata (T2); altre codifiche oltre a UTF-8 e Windows-1252; salvare la codifica in `aifa_imports`.
Registro:
- base: 256a43aa0278af36bae16b876a01f697371ca561
- caratterizzazione: cc1cd63 — snapshot di parseSource sulle cinque fixture (tests/aifa-parse.test.ts, tests/__snapshots__/)
- primo congelamento: d1cd698 — T1-A1 e T1-A2 (db) confrontavano anche la colonna `id` generata dal database: vedi D1
- test congelati: a25ef07 — tests/aifa-encoding.test.ts, tests/db/aifa-import.db.test.ts (T1-A1…A3)
- implementazione: 8947f51 — `decode(bytes)` prova UTF-8 stretto (BOM lasciato a `parseCsv`), altrimenti Windows-1252, e restituisce `{ text, encoding }`
- review: correttezza OK, conformità OK, nessun giro di fix. Sha finale: 8947f51
- MINORE: scripts/aifa/README.md descrive ancora `decode(bytes, encoding)` (da aggiornare in T2, che tocca il README)
- MINORE: `SOURCES[*].encoding` non è più letto dal codice di produzione; diventa la codifica attesa in T2 (§2.3), il confronto lo fa `importSource`
- MINORE: i test congelati passano un secondo argomento a `decode` che viene ignorato; warning del linter `no-unused-vars` su `_i`/`_id` in tests/db/aifa-import.db.test.ts:129

## T2 · Il log dice quando AIFA ha cambiato codifica   [fatto]
Tipo: fetta verticale
Fonte: §2.1, §2.3
Dipende da: T1
Codice esistente toccato: scripts/import-aifa.mjs (riga di riepilogo), scripts/aifa/README.md, tests/db/aifa-import.db.test.ts
Obiettivo: chi legge il log del workflow vede quando un file è arrivato in una codifica diversa da quella attesa; la regola vale per tutte le sorgenti, compresa la lista di trasparenza.
Accettazione:
- T2-A1 — Dato l'elenco dei carenti in UTF-8, quando l'import finisce, allora la riga di `carenze` dice che il file è stato letto come UTF-8 invece di Windows-1252 e l'import risulta riuscito.
- T2-A2 — Dati tutti i file nella codifica attesa, quando l'import finisce, allora le righe di riepilogo sono uguali a quelle di oggi, senza note sulla codifica.
- T2-A3 — Data la lista di trasparenza salvata in UTF-8, quando parte l'import, allora l'import riesce con gli stessi prezzi e la stessa data dei prezzi del file in Windows-1252, e la riga di riepilogo lo segnala.
Fuori scope: email o avvisi per il cambio di codifica (il cambio non è un errore); campo nel database.
Registro:
- base: 1dd2f9b5891e7e3a5280be4878e9e3c4bac166a8
- caratterizzazione: 74189ea — formato delle cinque righe di riepilogo con `--force` (tests/db/aifa-import.db.test.ts)
- test congelati: 3298ba8 — tests/db/aifa-import.db.test.ts (T2-A1…A3)
- implementazione: dc8e9c2 — `encodingNote` in scripts/import-aifa.mjs aggiunge ` (letto come …, atteso …)` quando `decode` usa una codifica diversa da `SOURCES[*].encoding`; README di scripts/aifa aggiornato (regole comuni, carenze, trasparenza, Interface, test)
- review: correttezza OK, conformità OK, nessun giro di fix. Sha finale: dc8e9c2
- MINORE: nel test sul database l'esclusione di `import_id`/`id` è duplicata (righe 129 e 189) e dà warning `no-unused-vars`
- MINORE: due righe di scripts/aifa/README.md (99 e 149) vanno a capo più tardi delle altre
- MINORE (mio): un file `carenze` o `trasparenza` tutto ASCII (senza accenti) verrebbe segnalato come "letto come UTF-8": è innocuo, ma improbabile con i file AIFA veri, che hanno sempre `à` nell'intestazione di carenze

---

## Copertura
| Sezione del doc | Requisito | Ticket |
|---|---|---|
| §1 | Un file carenze in UTF-8 non deve far fallire l'import | T1 (A1) |
| §2.1 | Lettura UTF-8 stretta, altrimenti Windows-1252 | T1 (A1, A2, A4) |
| §2.1 | Vale per tutte le sorgenti, compresa trasparenza | T2 (A3) |
| §2.2 | Le colonne cambiate bloccano ancora, tabelle intatte | T1 (A3) |
| §2.3 | La riga di riepilogo segnala la codifica diversa, import riuscito | T2 (A1, A2) |
| §2.4 | Stesse righe nel database qualunque sia la codifica | T1 (A1), T2 (A3) |
| §4 | README di `scripts/aifa` aggiornato | T2 |

## Domande aperte
- —

## Deviazioni

### D1 · T1 · I test sul database confrontavano anche l'id generato   [accettata]
Il design dice: §2.4, stesse righe nelle tabelle qualunque sia la codifica.
La realtà: i test congelati T1-A1 e T1-A2 in tests/db/aifa-import.db.test.ts confrontavano le righe di `aifa_shortages` inclusa la colonna `id` (identity), che cambia a ogni import perché `carenze` reinserisce le righe. Con l'implementazione il resto delle righe coincide.
Proposta: escludere `id` dal confronto, come già `import_id`.
Impatto: solo i test di T1.
Decisione (utente, 2026-11-24): correggere i test e ricongelarli.
