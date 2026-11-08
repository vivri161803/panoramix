# Panoramix

Panoramix aiuta chi gestisce le medicine di un familiare a sapere **quando** va presa ogni compressa (calendario per fasce, anche stampabile), a tenere il **conto delle scorte** in casa e a ricevere un’**email in tempo** quando una medicina va riordinata.

> Panoramix è un promemoria: non dà consigli medici, non controlla interazioni e non contatta medici o farmacie.

- Specifica funzionale: decide il comportamento.
- Export di Claude Design in [`UI_mobile_pc/`](UI_mobile_pc): decide l’aspetto (token, componenti, schermate telefono e desktop, email e foglio A4).

## Stack

- **Next.js 16** (App Router, Server Actions) + TypeScript, **Tailwind CSS 4** con i token del design (`app/globals.css`).
- **Supabase**: Postgres, Auth con link magico via email, Row Level Security. Progetto in regione UE (Francoforte).
- **Email**: Nodemailer via SMTP Gmail con password per le app, dietro l’interfaccia `EmailProvider` (`lib/email/provider.ts`). Si passa a Resend con `EMAIL_PROVIDER=resend`.
- **Controllo giornaliero**: Vercel Cron alle 07:00 UTC su `/api/cron/alerts`, protetto da `CRON_SECRET`. Tutte le date si calcolano nel fuso **Europe/Rome**.
- **Test**: Vitest.

## Struttura

| Percorso | Cosa contiene |
| --- | --- |
| `lib/forecast.ts` | Logica di dominio pura: dosi, fabbisogno, scorta attuale, copertura, esaurimento, stato, soglie ed episodi, portapillole, calendario |
| `lib/dates.ts` | Date di calendario senza fusi, “oggi” a Roma, formattazione in italiano |
| `lib/actions/` | Server Actions con validazione zod (accesso, piani, medicinali, scorte, email di prova) |
| `lib/alerts.ts` | Controllo giornaliero: episodi, un’email al giorno per piano, idempotenza |
| `lib/email/` | `EmailProvider` (SMTP/Resend) e modello HTML + testo dell’avviso |
| `supabase/migrations/` | Schema, RLS e funzioni SQL versionate |
| `supabase/seed.sql` | Dati d’esempio, marcati `[ESEMPIO]` |
| `supabase/templates/magic-link.html` | Modello italiano dell’email con il link di accesso |
| `tests/` | Test Vitest della logica di dominio |
| `app/icon.svg` | Icona “Vischio di pillole”: unica fonte del disegno. `node scripts/build-icons.mjs` rigenera `public/email-logo.png` e `app/apple-icon.png` |

### Pagine

`/accesso` · `/benvenuto` (nome e cognome al primo accesso) · `/piani` · `/piani/nuovo` · `/piani/[id]` (dispenser) · `/piani/[id]/calendario` · `/piani/[id]/stampa` (A4) · `/piani/[id]/modifica` · `/piani/[id]/medicinali/nuovo` · `/piani/[id]/medicinali/[medId]` · `/piani/[id]/medicinali/[medId]/storico` · `/account` (con eliminazione dei dati).

## Setup locale

Serve Node.js 20.9 o successivo.

```bash
npm install
cp .env.example .env.local   # poi compila i valori
npm run dev                  # http://localhost:3000
```

Per l’accesso in locale aggiungi `http://localhost:3000/**` tra i Redirect URLs di Supabase (vedi sotto) oppure usa direttamente l’app pubblicata.

## Variabili d’ambiente

Tutte elencate in [`.env.example`](.env.example). Nel repository non ci sono mai valori reali.

| Variabile | Dove si prende | Note |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys | chiave **publishable** (o `anon` legacy) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys | chiave **secret** (o `service_role` legacy). Solo lato server, la usa solo il cron |
| `EMAIL_PROVIDER` | — | `smtp` (default) oppure `resend` |
| `SMTP_HOST` / `SMTP_PORT` | — | `smtp.gmail.com` / `465` |
| `SMTP_USER` | la casella Gmail | è anche il mittente reale |
| `SMTP_PASSWORD` | password per le app di Google | 16 caratteri, senza spazi |
| `MAIL_FROM_NAME` | — | `Panoramix` |
| `RESEND_API_KEY`, `MAIL_FROM_ADDRESS` | resend.com | solo con `EMAIL_PROVIDER=resend` |
| `CRON_SECRET` | `openssl rand -hex 32` | Vercel lo manda come `Authorization: Bearer …` |
| `APP_URL` | l’indirizzo dell’app | es. `https://panoramix.vercel.app`, senza barra finale |

## Database e migrazioni

Le migrazioni sono in `supabase/migrations/` e vanno applicate in ordine:

1. `…_schema.sql` — tabelle `profiles`, `plans`, `plan_recipients`, `medications`, `stock_events`, `prep_runs`, `alert_log`, `alert_runs`, `cron_runs`.
2. `…_rls.sql` — Row Level Security: ogni riga è raggiungibile solo dal proprietario del piano.
3. `…_functions.sql` — operazioni atomiche: `record_stock_event`, `apply_prep`, `undo_prep`, `change_stock_mode`, `delete_my_account`.

Con la [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
npx supabase login
npx supabase link --project-ref <ref-del-progetto>
npx supabase db push
```

In alternativa incolla i tre file, nell’ordine, nell’SQL Editor di Supabase.

Per avere dati di prova: accedi una volta all’app, sostituisci la tua email in `supabase/seed.sql` ed eseguilo nell’SQL Editor. Crea il piano “[ESEMPIO] Nonna Anna”.

### Come scendono le scorte

Ogni medicinale ha un conteggio di riferimento (`stock_qty` + `stock_as_of`).

- **Giorno per giorno**: scorta di oggi = riferimento − dosi previste dal giorno del riferimento a ieri compreso.
- **Portapillole settimanale**: le compresse escono solo con “Portapillole preparato” (7 giorni di dosi dal giorno di preparazione), annullabile esattamente grazie a `prep_runs.deductions`.

Ogni movimento “ribasa” il riferimento: calcola la scorta attuale, applica il movimento, salva quantità e data di oggi e registra l’evento in `stock_events`.

## Email

### Password per le app di Gmail

1. Sul tuo account Google attiva la **verifica in due passaggi** (myaccount.google.com → Sicurezza).
2. Apri <https://myaccount.google.com/apppasswords>.
3. Scrivi un nome, per esempio “Panoramix”, e premi **Crea**.
4. Copia la password di 16 caratteri (senza spazi): è il valore di `SMTP_PASSWORD`. Google non te la mostrerà più.

Gmail invia al massimo circa 500 email al giorno: per un uso familiare basta e avanza.

### Link di accesso

In Supabase si configura lo stesso SMTP Gmail (Authentication → Emails → SMTP Settings) e il modello italiano di `supabase/templates/magic-link.html` per “Magic Link” e “Confirm signup”, così i link non arrivano dal mittente di prova di Supabase.

### Avvisi

- Un controllo al giorno alle 07:00 UTC (le 8:00 in inverno, le 9:00 con l’ora legale; sul piano Hobby di Vercel l’orario ha un’ora di tolleranza).
- Per ogni medicinale e soglia attiva l’avviso parte una volta per “episodio”; l’episodio si chiude quando la scorta torna sopra soglia (arrivo o nuovo conteggio).
- Al massimo un’email al giorno per piano, a gestore + destinatari, con `Reply-To` del gestore. Se il cron gira due volte nello stesso giorno non manda doppioni (`alert_runs`).
- Esiti ed errori finiscono nelle tabelle `alert_runs` e `cron_runs` e nei log di Vercel.
- Nelle impostazioni del piano c’è “Mandami un’email di prova”: arriva solo al gestore e non tocca gli avvisi veri.

### Esecuzione manuale del cron

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<app>.vercel.app/api/cron/alerts
```

Con `?dry=1` calcola cosa manderebbe senza scrivere nulla né inviare.

## Test

```bash
npm test            # Vitest: logica di dominio e criteri di accettazione
npm run typecheck   # tipi TypeScript
npm run lint
```

I test coprono mezze compresse, giorni della settimana, ogni N giorni, cicli, data di fine, al bisogno, preparazione e annullamento, passaggio all’ora legale e i criteri di accettazione 2–5 della specifica.

## Deploy

Vercel collegato al repository, dominio predefinito `.vercel.app`, funzioni nella regione `fra1` (vicino al database). Il cron è dichiarato in [`vercel.json`](vercel.json). Le variabili si impostano in Vercel → Project → Settings → Environment Variables.
