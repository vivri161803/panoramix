import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";

export interface EmailMessage {
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id?: string }>;
  /** Chiude le connessioni aperte (serve solo con `pooled`). */
  close?(): void;
}

export interface ProviderOptions {
  /**
   * Per i controlli automatici: tiene aperte poche connessioni SMTP e le riusa per tutti gli invii,
   * invece di aprirne una nuova (con TLS e login) per ogni email. Va chiuso con `close()` alla fine.
   */
  pooled?: boolean;
}

/** Connessioni SMTP aperte insieme durante un controllo automatico. */
export const SMTP_POOL_CONNECTIONS = 3;

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Configurazione email incompleta: manca ${name}`);
  return v;
}

/** Gmail (o altro SMTP) con password per le app. */
class SmtpProvider implements EmailProvider {
  readonly name = "smtp";
  private transport;

  constructor(opts: ProviderOptions) {
    const port = Number(process.env.SMTP_PORT || 465);
    const base = {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: required("SMTP_USER"), pass: required("SMTP_PASSWORD") },
    };
    this.transport = opts.pooled
      ? nodemailer.createTransport({ ...base, pool: true, maxConnections: SMTP_POOL_CONNECTIONS, maxMessages: 100 })
      : nodemailer.createTransport(base);
  }

  close() {
    this.transport.close();
  }

  async send(m: EmailMessage) {
    const info = await this.transport.sendMail({
      // con Gmail il mittente deve essere la casella stessa; il nome mostrato è "Panoramix"
      from: { name: env.mailFromName(), address: process.env.MAIL_FROM_ADDRESS || required("SMTP_USER") },
      to: m.to,
      replyTo: m.replyTo,
      subject: m.subject,
      html: m.html,
      text: m.text,
    });
    return { id: info.messageId };
  }
}

/** Resend via API HTTP (richiede un dominio verificato su Resend). */
class ResendProvider implements EmailProvider {
  readonly name = "resend";

  async send(m: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${required("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${env.mailFromName()} <${required("MAIL_FROM_ADDRESS")}>`,
        to: m.to,
        reply_to: m.replyTo,
        subject: m.subject,
        html: m.html,
        text: m.text,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { id?: string };
    return { id: data.id };
  }
}

/** Si cambia fornitore con EMAIL_PROVIDER=smtp|resend, senza toccare il resto. */
export function getEmailProvider(opts: ProviderOptions = {}): EmailProvider {
  return env.emailProvider() === "resend" ? new ResendProvider() : new SmtpProvider(opts);
}
