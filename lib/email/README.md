# lib/email

## Overview
Outgoing email for Appoteca. It has two parts: a provider abstraction that sends a message through SMTP (nodemailer) or the Resend HTTP API, and pure renderers that build each email as `{ subject, html, text }`. The HTML uses tables and inline styles so it works across mail clients. Only `provider.ts` is server-only. The template modules are pure functions with no I/O.

## Interface
- `provider.ts` (`import "server-only"`)
  - `interface EmailMessage { to: string[]; replyTo?; subject; html; text }`
  - `interface EmailProvider { name; send(message): Promise<{ id? }>; close?() }`
  - `interface ProviderOptions { pooled?: boolean }`: a pooled SMTP transport reuses connections across one automated run and must be closed with `close()`.
  - `SMTP_POOL_CONNECTIONS = 3`
  - `getEmailProvider(opts?)`: returns a `ResendProvider` when `env.emailProvider() === "resend"`, otherwise an `SmtpProvider`.
- `layout.ts` (shared layout)
  - `FONT`, `esc(s)` (HTML escape), `interface LayoutData`, `renderLayout(d)` (full HTML document with logo, banner, title, intro, body, CTA, and footer)
  - `infoCard(opts)` (two-column label/value card with a tone and an optional chip), `noteBox(text, tone)`
- `alert-template.ts` (daily stock alert)
  - `interface AlertEmailMed` (with `category`, `daysPerPack`, `frequencyType`, `levelText`, `unit` from `containerWord`), `interface AlertEmailData`, `EMAIL_DISCLAIMER`. Each med shows the colour dot, the category name (no SVG: mail clients strip it) and «{Contenitori} rimasti/e».
  - `alertSubject(d)` (adds a `[Prova] ` prefix when `test`), `doctorText(d)` (prescription-request text for meds with `requiresPrescription`, or `null`), `renderAlertEmail(d)`
- `templates.ts` (other emails; all return `RenderedEmail`)
  - `interface RenderedEmail { subject; html; text }`
  - `InviteEmailData` / `renderInviteEmail(d)`: plan invitation
  - `ReminderItem` (name, strength, color, `categoryLabel`, `phrase` with the dose word, `changeNote?`), `ReminderEmailData` / `renderPrepReminderEmail(d)`: pillbox preparation reminder with the doses of the 7 days (no quantities to deduct and no "missing" note)
  - `SummaryMed` (with `category`, `daysPerPack`, `frequencyType`, `levelText`), `SummaryEmailData`, `summaryHeadline(meds)` / `renderWeeklySummaryEmail(d)`: Monday summary (no next pillbox preparation). Each med shows the category name and «{Contenitori} rimasti/e» (`formatQty` for pieces, `levelText` for level meds, never rounded to whole containers).
  - `renderOpsEmail({ title, problems, appUrl, when })`: technical alert for the ops address. The intro changes when every problem starts with `"Dati AIFA"`.
  - `renderUsageEmail(stats, { from, to, appUrl })`: weekly usage report. A warning note appears when `recipientsPerDay >= GMAIL_DAILY_LIMIT * 0.8`.

## Invariants
- Escape all interpolated text with `esc()` before it goes into HTML. `alert-template.ts` keeps its own private copy of `esc` and `FONT`.
- Every renderer returns both `html` and a plain-text `text` version. Keep them in sync when you change content.
- The logo URL is always `<origin>/email-logo.png`, built from `appUrl` (layout) or `planUrl` (alert).
- `doctorText` and the invite footer only produce text for the user to forward. The app never contacts doctors or pharmacies (see `EMAIL_DISCLAIMER`).
- When `getEmailProvider({ pooled: true })` is used, call `close()` when the run ends. The callers in `lib/alerts.ts` and `lib/notify.ts` do this in a `finally` block.

## Side Effects
- `SmtpProvider.send` sends mail through nodemailer. Settings come from `SMTP_HOST` (default `smtp.gmail.com`), `SMTP_PORT` (default 465, with `secure` when the port is 465), `SMTP_USER`, and `SMTP_PASSWORD`. The from address is `MAIL_FROM_ADDRESS`, or `SMTP_USER` if that is unset.
- `ResendProvider.send` makes a `POST https://api.resend.com/emails` request with `RESEND_API_KEY` and `MAIL_FROM_ADDRESS`, and throws on a non-2xx response.
- The provider throws `Configurazione email incompleta: manca <VAR>` when a required variable is missing.
- `layout.ts`, `alert-template.ts`, and `templates.ts` have no side effects.

## Verification
- Run: `npm test` (see `tests/alert-template.test.ts` and `tests/email-templates.test.ts`)
- Run: `npm run typecheck`
