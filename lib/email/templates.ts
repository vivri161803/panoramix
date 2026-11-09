// Email di invito, promemoria del portapillole, riepilogo settimanale e avviso tecnico.
// Funzioni pure: HTML + versione solo testo.

import { capitalize, formatLong, formatRelative, type ISODate } from "@/lib/dates";
import { daysWord, formatQty, pillsWord, type MedStatus } from "@/lib/forecast";
import { ROLE_LABEL, ROLE_SUB, type MemberRole } from "@/lib/roles";
import { EMAIL_DISCLAIMER } from "./alert-template";
import { esc, FONT, infoCard, noteBox, renderLayout } from "./layout";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const lines = (parts: (string | null | false | undefined)[]) => parts.filter((x) => x !== null && x !== false && x !== undefined).join("\n");

// ——— Invito ———

export interface InviteEmailData {
  inviterName: string;
  inviterEmail: string;
  patientName: string;
  role: MemberRole;
  inviteeEmail: string;
  appUrl: string;
}

export function renderInviteEmail(d: InviteEmailData): RenderedEmail {
  const subject = `${d.inviterName} ti invita a seguire le medicine di ${d.patientName}`;
  const title = `Ti hanno dato accesso al piano di ${d.patientName}`;
  const intro = `${d.inviterName} usa Panoramix per tenere il conto delle medicine di ${d.patientName} e ti ha invitato con il permesso «${ROLE_LABEL[d.role]}».`;
  const how = `Entra in Panoramix con questo indirizzo (${d.inviteeEmail}): troverai l’invito in cima a «I miei piani» e potrai accettarlo o rifiutarlo.`;
  const url = `${d.appUrl}/piani`;
  const footer = [EMAIL_DISCLAIMER, `Non conosci ${d.inviterName}? Ignora questa email: senza accettare non succede nulla. Rispondendo scrivi a ${d.inviterEmail}.`];
  const html = renderLayout({
    subject,
    preheader: intro,
    title,
    intro,
    body: `${noteBox(ROLE_SUB[d.role])}<p style="margin:0 0 20px;font:400 17px/1.5 ${FONT};color:#44505C;">${esc(how)}</p>`,
    cta: { url, label: "Apri Panoramix" },
    footer,
    appUrl: d.appUrl,
  });
  const text = lines([title, "", intro, "", ROLE_SUB[d.role], "", how, "", `Apri Panoramix: ${url}`, "", "—", ...footer]);
  return { subject, html, text };
}

// ——— Promemoria del portapillole ———

export interface ReminderItem {
  name: string;
  strength: string;
  color: string;
  /** compresse da mettere nel portapillole per i 7 giorni */
  need: number;
  /** compresse che mancano in casa */
  missing: number;
  /** "1 al mattino e ½ alla sera" (dosi del primo giorno) */
  phrase: string;
  /** "Dal 18 nov: ½ al mattino" se la dose cambia durante la settimana */
  changeNote?: string;
}

export interface ReminderEmailData {
  patientName: string;
  managerName: string;
  prepDate: ISODate;
  today: ISODate;
  items: ReminderItem[];
  planUrl: string;
  settingsUrl: string;
  appUrl: string;
}

export function renderPrepReminderEmail(d: ReminderEmailData): RenderedEmail {
  const when = formatRelative(d.prepDate, d.today).toLowerCase();
  const day = formatLong(d.prepDate);
  const missing = d.items.filter((i) => i.missing > 0);
  const subject = `Panoramix · ${d.patientName}: ${when} si prepara il portapillole`;
  const title = `${capitalize(when)} si prepara il portapillole di ${d.patientName}`;
  const intro = `${capitalize(day)} è il giorno di preparazione. Ecco cosa serve per i 7 giorni: quando hai finito premi «Portapillole preparato» nell’app, così le scorte si aggiornano.`;
  const total = d.items.reduce((s, i) => s + i.need, 0);
  const cards = d.items
    .map((i) =>
      infoCard({
        title: `${i.name}${i.strength ? ` ${i.strength}` : ""}`,
        color: i.color,
        tone: i.missing > 0 ? "out" : "ok",
        chip: i.missing > 0 ? { label: `Ne mancano ${formatQty(i.missing)}`, tone: "out" } : undefined,
        rows: [
          ["Da mettere", `${formatQty(i.need)} ${pillsWord(i.need)}`],
          ["Dosi", i.phrase || "—"],
          ...(i.changeNote ? ([["Cambio di dose", i.changeNote]] as [string, string][]) : []),
        ],
      }),
    )
    .join("");
  const status = missing.length
    ? noteBox(`Attenzione: ${missing.map((i) => `mancano ${formatQty(i.missing)} ${i.name}`).join(", ")}. Conviene procurarle prima della preparazione.`, "warn")
    : noteBox(`In casa c’è tutto: ${formatQty(total)} ${pillsWord(total)} in tutto.`, "ok");
  const footer = [EMAIL_DISCLAIMER, `Ricevi questo promemoria perché segui il piano di ${d.patientName}. Puoi disattivarlo dalle impostazioni del piano: ${d.settingsUrl}`];
  const html = renderLayout({
    subject,
    preheader: intro,
    title,
    intro,
    body: status + cards,
    cta: { url: d.planUrl, label: "Apri il piano" },
    footer,
    appUrl: d.appUrl,
  });
  const text = lines([
    title,
    "",
    intro,
    "",
    missing.length ? `ATTENZIONE: ${missing.map((i) => `mancano ${formatQty(i.missing)} ${i.name}`).join(", ")}.` : `In casa c’è tutto: ${formatQty(total)} ${pillsWord(total)} in tutto.`,
    "",
    ...d.items.map((i) => `• ${i.name}${i.strength ? ` ${i.strength}` : ""}: ${formatQty(i.need)} ${pillsWord(i.need)} (${i.phrase || "—"})${i.changeNote ? ` · ${i.changeNote}` : ""}${i.missing > 0 ? ` · ne mancano ${formatQty(i.missing)}` : ""}`),
    "",
    `Apri il piano: ${d.planUrl}`,
    "",
    "—",
    ...footer,
  ]);
  return { subject, html, text };
}

// ——— Riepilogo settimanale ———

export interface SummaryMed {
  name: string;
  strength: string;
  color: string;
  status: MedStatus;
  qty: number;
  coverageDays: number | null;
  runOutDate: ISODate | null;
  asNeeded: boolean;
}

export interface SummaryEmailData {
  patientName: string;
  today: ISODate;
  nextPrep: ISODate | null;
  meds: SummaryMed[];
  planUrl: string;
  settingsUrl: string;
  appUrl: string;
}

const STATUS_TEXT: Record<MedStatus, string> = { ok: "In ordine", order: "Da ordinare", ordered: "Ordinata", out: "Esaurita" };

function coverage(m: SummaryMed): string {
  if (m.asNeeded) return "al bisogno";
  if (m.coverageDays === null) return "fino alla fine della terapia";
  return `${m.coverageDays} ${daysWord(m.coverageDays)}`;
}

export function summaryHeadline(meds: SummaryMed[]): { text: string; tone: "ok" | "warn" } {
  const out = meds.filter((m) => m.status === "out").length;
  const order = meds.filter((m) => m.status === "order").length;
  const ordered = meds.filter((m) => m.status === "ordered").length;
  if (!out && !order) {
    return { text: ordered ? `Nessuna medicina da ordinare (${ordered} già ordinat${ordered > 1 ? "e" : "a"}, in arrivo).` : "Tutto in ordine: nessuna medicina da ordinare.", tone: "ok" };
  }
  const parts = [out ? `${out} esaurit${out > 1 ? "e" : "a"}` : "", order ? `${order} da ordinare` : ""].filter(Boolean);
  return { text: `${capitalize(parts.join(" e "))}: apri il piano per i dettagli.`, tone: "warn" };
}

export function renderWeeklySummaryEmail(d: SummaryEmailData): RenderedEmail {
  const head = summaryHeadline(d.meds);
  const subject = `Panoramix · ${d.patientName}: riepilogo della settimana`;
  const title = `Le scorte di ${d.patientName} questa settimana`;
  const intro = `${head.text}${d.nextPrep ? ` Prossima preparazione del portapillole: ${formatLong(d.nextPrep)}.` : ""}`;
  const tone = (s: MedStatus) => (s === "out" ? "out" : s === "order" ? "order" : "ok");
  const cards = d.meds
    .map((m) =>
      infoCard({
        title: `${m.name}${m.strength ? ` ${m.strength}` : ""}`,
        color: m.color,
        tone: tone(m.status),
        chip: { label: STATUS_TEXT[m.status], tone: m.status },
        rows: [
          ["Compresse in casa", formatQty(m.qty)],
          ["Copertura", coverage(m)],
          ...(m.runOutDate && !m.asNeeded ? ([["Finisce", formatLong(m.runOutDate)]] as [string, string][]) : []),
        ],
      }),
    )
    .join("");
  const footer = [EMAIL_DISCLAIMER, `Ricevi il riepilogo del lunedì perché segui il piano di ${d.patientName}. Puoi disattivarlo dalle impostazioni del piano: ${d.settingsUrl}`];
  const html = renderLayout({
    subject,
    preheader: intro,
    title,
    intro,
    body: noteBox(head.text, head.tone) + (cards || noteBox("Nel piano non ci sono medicine in corso.")),
    cta: { url: d.planUrl, label: "Apri il piano" },
    footer,
    appUrl: d.appUrl,
  });
  const text = lines([
    title,
    "",
    intro,
    "",
    ...d.meds.map(
      (m) =>
        `• ${m.name}${m.strength ? ` ${m.strength}` : ""} — ${STATUS_TEXT[m.status]}: ${formatQty(m.qty)} in casa, ${coverage(m)}${m.runOutDate && !m.asNeeded ? `, finisce ${formatLong(m.runOutDate)}` : ""}`,
    ),
    "",
    `Apri il piano: ${d.planUrl}`,
    "",
    "—",
    ...footer,
  ]);
  return { subject, html, text };
}

// ——— Avviso tecnico per chi gestisce l'app ———

export function renderOpsEmail(d: { title: string; problems: string[]; appUrl: string; when: string }): RenderedEmail {
  const subject = `[Panoramix] ${d.title}`;
  const intro = `Controllo automatico del ${d.when}. Gli utenti potrebbero non aver ricevuto avvisi o promemoria.`;
  const list = `<ul style="margin:0 0 20px;padding-left:20px;font:400 16px/1.5 ${FONT};color:#0E1620;">${d.problems.map((p) => `<li style="margin:0 0 6px;">${esc(p)}</li>`).join("")}</ul>`;
  const hint = "Dettagli nei log di Vercel e nelle tabelle cron_runs, alert_runs e notification_runs su Supabase.";
  const html = renderLayout({ subject, preheader: d.problems[0] ?? d.title, title: d.title, intro, body: list + noteBox(hint), footer: ["Email tecnica di Panoramix: arriva solo all’indirizzo impostato in OPS_ALERT_EMAIL."], appUrl: d.appUrl });
  const text = lines([d.title, "", intro, "", ...d.problems.map((p) => `• ${p}`), "", hint]);
  return { subject, html, text };
}
