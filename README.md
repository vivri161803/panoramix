# Panoramix

Panoramix aiuta chi gestisce le medicine di un familiare a sapere **quando** va presa ogni compressa (calendario per fasce, anche stampabile), a tenere il **conto delle scorte** in casa e a ricevere un’**email in tempo** quando una medicina va riordinata.

Funzioni principali:

- **Piani condivisi**: il proprietario invita altre persone con un account, in **sola lettura** o con **permesso di modifica** (scorte, portapillole, medicinali). Impostazioni, destinatari, persone con accesso ed eliminazione restano del proprietario.
- **Medicinali al bisogno**: pulsante «Presa 1» (o mezze compresse) che scala le scorte e si può annullare.
- **Cambi di dose programmati**: da una data le dosi cambiano (terapie a scalare, sospensioni); scorte, calendario e avvisi ne tengono conto.
- **Lista per la farmacia**: medicine da ordinare con le confezioni suggerite (30 giorni), testo da copiare, condividere o mandare su WhatsApp e richiesta della ricetta al medico. «Segna come ordinate» per più medicine insieme.
- **Scheda terapia**: foglio A4 con la terapia in corso (per visite e pronto soccorso), stampabile o in PDF.
- **Promemoria del portapillole** la sera prima della preparazione e **riepilogo del lunedì** (facoltativo).
- **Avviso tecnico** a `OPS_ALERT_EMAIL` se un controllo automatico fallisce o il giorno prima non è partito.

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
| `lib/notify.ts` | Promemoria del portapillole e riepilogo settimanale (un invio al giorno per piano e tipo) |
| `lib/ops.ts` | Controllo saltato ed email tecnica a chi gestisce l’app |
| `lib/cron-data.ts` | Dati per i controlli automatici e destinatari di ogni piano |
| `lib/roles.ts` | Ruoli sul piano (proprietario, modifica, sola lettura) |
| `lib/pharmacy.ts` · `lib/digest.ts` | Lista per la farmacia, contenuto di promemoria e riepiloghi (funzioni pure) |
| `lib/email/` | `EmailProvider` (SMTP/Resend), avviso, invito, promemoria, riepilogo, email tecnica |
| `supabase/migrations/` | Schema, RLS e funzioni SQL versionate |
| `supabase/seed.sql` | Dati d’esempio, marcati `[ESEMPIO]` |
| `supabase/templates/magic-link.html` | Modello italiano dell’email con il link di accesso |
| `tests/` | Vitest: dominio, email, Server Actions (`tests/*.test.ts`); database locale (`tests/db`); browser con Playwright (`tests/e2e`) |
| `app/icon.svg` | Icona “Vischio di pillole”: unica fonte del disegno. `node scripts/build-icons.mjs` rigenera `public/email-logo.png` e `app/apple-icon.png` |

### Pagine

`/accesso` · `/benvenuto` (nome e cognome al primo accesso) · `/piani` (con gli inviti ricevuti) · `/piani/nuovo` · `/piani/[id]` (dispenser) · `/piani/[id]/calendario` · `/piani/[id]/stampa` (A4) · `/piani/[id]/terapia` (scheda terapia A4) · `/piani/[id]/farmacia` · `/piani/[id]/modifica` (solo proprietario, con persone con accesso) · `/piani/[id]/medicinali/nuovo` · `/piani/[id]/medicinali/[medId]` (con cambi di dose) · `/piani/[id]/medicinali/[medId]/storico` · `/account` (con eliminazione dei dati).

Chi ha **sola lettura** vede dispenser, calendario, storico, lista farmacia e scheda terapia; le pagine di modifica lo riportano al piano. Le Server Actions controllano il ruolo e, in più, le regole RLS del database bloccano ogni scrittura non permessa.

## Setup locale

Serve Node.js 20.9 o successivo.

```bash
npm install
cp .env.example .env.local   # poi compila i valori
npm run dev                  # http://localhost:3000
```

Per l’accesso in locale aggiungi `http://localhost:3000/**` tra i Redirect URLs di Supabase (vedi sotto) oppure usa direttamente l’app pubblicata.

### Supabase locale (consigliato per provare senza toccare i dati veri)

Serve Docker. `supabase/config.toml` è già pronto: le migrazioni si applicano all’avvio e le email (link di accesso compresi) finiscono in Mailpit, senza partire davvero.

```bash
npx supabase start          # Postgres, Auth e Mailpit in Docker
npx supabase status -o env  # URL e chiavi locali da copiare in .env.local
```

In `.env.local` usa `API_URL`, `ANON_KEY` e `SERVICE_ROLE_KEY` del Supabase locale, `SMTP_HOST=127.0.0.1`, `SMTP_PORT=54325` (utente e password qualsiasi) e `APP_URL=http://localhost:3000`. Le email si leggono su <http://127.0.0.1:54324>. `npx supabase db reset` riparte da zero; per i dati d’esempio vedi `supabase/seed.sql`.

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
| `OPS_ALERT_EMAIL` | — | chi riceve le email tecniche se un controllo automatico fallisce (default `bianchicarlo2002@icloud.com`) |

## Database e migrazioni

Le migrazioni sono in `supabase/migrations/` e vanno applicate in ordine:

1. `…_schema.sql` — tabelle `profiles`, `plans`, `plan_recipients`, `medications`, `stock_events`, `prep_runs`, `alert_log`, `alert_runs`, `cron_runs`.
2. `…_rls.sql` — Row Level Security: ogni riga è raggiungibile solo dal proprietario del piano.
3. `…_functions.sql` — operazioni atomiche: `record_stock_event`, `apply_prep`, `undo_prep`, `change_stock_mode`, `delete_my_account`.
4. `…_fk_indexes.sql` — indici sulle chiavi esterne `created_by`.
5. `…_sharing.sql` — piani condivisi: `plan_members`, `plan_invites` (massimo 10 persone per piano), funzioni `plan_role`, `can_view_plan`, `can_edit_plan`, `my_plan_invites`, `accept_plan_invite` e regole RLS aggiornate (lettura per i membri, scrittura per proprietario e chi ha il permesso di modifica).
6. `…_features.sql` — movimento `use` (presa al bisogno), `dose_changes`, impostazioni `prep_reminder` e `weekly_summary`, `notification_runs`, colonna `kind` in `cron_runs`.

Gli inviti si accettano entrando con l’email invitata: l’invito compare in cima a «I miei piani» (`my_plan_invites`) e `accept_plan_invite` controlla che l’indirizzo coincida.

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

- **Al bisogno**: non entrano nelle previsioni; ogni «Presa» registra un movimento `use` e toglie le compresse dal riferimento.
- **Cambi di dose** (`dose_changes`): per ogni giorno valgono le dosi dell’ultimo cambio già iniziato (`dosesAt` in `lib/forecast.ts`), quindi consumo, copertura, portapillole e calendario seguono la terapia a scalare. Si programmano da domani in poi; salvando il medicinale i cambi già iniziati confluiscono nelle sue dosi.

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

### Promemoria, riepiloghi e destinatari

- **Promemoria del portapillole**: secondo cron alle 17:00 UTC (18:00 o 19:00) su `/api/cron/reminders`. Parte per i piani settimanali con il promemoria attivo quando domani è il giorno di preparazione, con cosa mettere, cosa manca e i cambi di dose della settimana.
- **Riepilogo del lunedì**: con il controllo del mattino, per i piani con «Riepilogo del lunedì» attivo (spento di default).
- Avvisi, promemoria e riepiloghi vanno a proprietario, destinatari aggiuntivi e persone con accesso al piano, senza doppioni. Un invio al giorno per piano e tipo (`alert_runs`, `notification_runs`).

### Avviso tecnico

Se un controllo fallisce (errore, invio non riuscito) o se il controllo del giorno prima non risulta finito in `cron_runs` (mentre nella settimana precedente girava), parte un’email a `OPS_ALERT_EMAIL`. Se è proprio l’SMTP a non funzionare l’email non può partire: resta l’errore nei log di Vercel.

### Esecuzione manuale del cron

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<app>.vercel.app/api/cron/alerts
curl -H "Authorization: Bearer $CRON_SECRET" https://<app>.vercel.app/api/cron/reminders
```

Con `?dry=1` calcola cosa manderebbe senza scrivere nulla né inviare; su `/api/cron/alerts` `?riepilogo=1` manda il riepilogo anche se non è lunedì.

## Test

```bash
npm test            # Vitest: dominio, email, Server Actions (veloce, senza database)
npm run test:db     # regole RLS e controlli automatici sul Supabase locale (npx supabase start)
npm run test:e2e    # Playwright nel browser contro Supabase locale e Mailpit (porta 3100)
npm run typecheck   # tipi TypeScript
npm run lint
```

- `npm test` copre mezze compresse, giorni della settimana, ogni N giorni, cicli, data di fine, al bisogno, preparazione e annullamento, ora legale, i criteri 2–5 della specifica, cambi di dose, lista farmacia, promemoria e riepiloghi, email e le Server Actions (permessi per ruolo, presa al bisogno e annullamento, cambi di dose, inviti) con Supabase simulato.
- `npm run test:db` usa utenti veri dell’Auth locale: chi non è invitato non vede nulla, solo l’invitato accetta l’invito, la sola lettura non scrive in nessuna tabella né funzione, il permesso di modifica non tocca impostazioni e persone, limite di 10 persone, uscita dal piano; poi avvisi, promemoria (una volta sola), riepilogo e controllo saltato. Gira solo su un indirizzo `localhost`.
- `npm run test:e2e` rifà il percorso nel browser: accesso con il link da Mailpit, nuovo piano, medicinale al bisogno e presa, lista per la farmacia, invito, accettazione e verifica della sola lettura. Prima volta: `npx playwright install chromium`; ferma gli altri `npm run dev` del progetto.

## Deploy

Vercel collegato al repository, dominio predefinito `.vercel.app`, funzioni nella regione `fra1` (vicino al database). I due cron (avvisi alle 07:00 UTC, promemoria alle 17:00 UTC) sono dichiarati in [`vercel.json`](vercel.json). Prima di pubblicare codice che usa tabelle nuove applica le migrazioni al progetto Supabase (`npx supabase db push`). Le variabili si impostano in Vercel → Project → Settings → Environment Variables.
