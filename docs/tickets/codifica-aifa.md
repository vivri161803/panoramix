# Ticket — Codifica dei file AIFA: UTF-8 oppure Windows-1252

Design doc: docs/designs/codifica-aifa.md (non ancora versionato)
Criteri approvati: sì (2026-11-24)
Comando test: `npm test && npm run test:db` (il secondo richiede Supabase locale in Docker; se la shell non ha ancora il gruppo docker: `sg docker -c "npm run test:db"`)
Branch: feat/codifica-aifa

Stati: `todo` · `in-corso` · `attesa-umano` · `fatto` · `bloccato`

---

## T1 · L'elenco dei carenti in UTF-8 si importa   [todo]
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
Registro: —

## T2 · Il log dice quando AIFA ha cambiato codifica   [todo]
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
Registro: —

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
(compilata da implement)
