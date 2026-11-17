Implementiamo il rilascio 1 (R1) della feature «categorie», seguendo il piano in `docs/2026-11-16_feature_categorie/categorie.md`.

**Stato di partenza**
- La revisione EGM del piano è conclusa (`docs/2026-11-16_feature_categorie/review_status.md`). Non serve rileggere i rapporti `*_report.md`.
- Nulla è in un commit: la cartella `docs/` è nuova, e `design/Presidi.dc.html` e `design/Presidio.dc.html` sono stati sostituiti con l'export aggiornato del progetto grafico. Prima di toccare il codice crea un branch da `main` (per esempio `feature/scorte-giornaliere`) e chiedimi se mettere quei file nel primo commit.

**Cosa leggere**
1. `AGENTS.md`: questa versione di Next.js ha API diverse da quelle che conosci. Leggi la guida in `node_modules/next/dist/docs/` prima di scrivere codice di app, pagine o server action.
2. In `categorie.md`:
   - la sezione «Rilascio 1» del piano tecnico (R1.1–R1.4) per le regole;
   - il piano dettagliato (`## Detailed Implementation Plan`, circa dalla riga 951), punti 1–33, per i file e i passi esatti;
   - il Verification Plan in fondo.

   Se piano tecnico e piano dettagliato non coincidono, vale il piano dettagliato. Se un numero di riga citato non corrisponde più al codice, cerca il simbolo e dimmelo.

**Regole già decise (non riaprirle)**
- La scorta scende ogni giorno in tutti i piani; il portapillole diventa solo un promemoria (`prep_reminder`, spento per i piani nuovi).
- Dopo la migrazione `stock_as_of` può essere nel futuro. Copertura e lista farmacia partono da `max(oggi, stock_as_of)`. Arrivi, prese al bisogno e annullamenti si salvano a `max(oggi, stock_as_of)`. Un riconteggio o una scorta scritta nel modulo contano anche il portapillole e si salvano a oggi.
- La migrazione `supabase/migrations/20261117000100_daily_stock.sql` ha l'SQL completo nel punto 1. Non ha un test automatico: si verifica a mano sul dump dei dati veri.

**Come procedere**
- Fai un piano di lavoro in ordine: migrazione e tipi, poi `lib/forecast.ts` e la logica, poi azioni, email, interfaccia, test e README (punti 1–33).
- Dopo ogni gruppo esegui `npm run typecheck` e `npm test`. Alla fine esegui anche `npm run test:db`, `npm run test:e2e`, `npm run lint` e il comando grep di R1 del Verification Plan, che non deve stampare niente.
- Non fare commit senza chiedermelo.
- R2 (punti 34–68) è un rilascio separato: non iniziarlo.
