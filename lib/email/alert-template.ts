// Email di avviso: HTML compatibile con i client (tabelle, stili inline) + versione solo testo.
// Design: UI_mobile_pc/PanoramixEmail.dc.html

import { formatLong, type ISODate } from "@/lib/dates";
import { daysWord, formatQty, type MedStatus } from "@/lib/forecast";

export interface AlertEmailMed {
  name: string;
  strength: string;
  color: string;
  status: MedStatus;
  qty: number;
  coverageDays: number | null;
  runOutDate: ISODate | null;
  requiresPrescription: boolean;
  pillsPerPack: number;
  /** "1 al mattino" */
  dosesPhrase: string;
  asNeeded: boolean;
}

export interface AlertEmailData {
  patientName: string;
  managerFirstName: string;
  managerFullName: string;
  planUrl: string;
  settingsUrl: string;
  /** solo modalità settimanale */
  nextPrep: ISODate | null;
  today: ISODate;
  meds: AlertEmailMed[];
  test?: boolean;
}

export const EMAIL_DISCLAIMER =
  "Panoramix è un promemoria: i conti si basano sui dati inseriti nel piano. Non dà consigli medici, non controlla le interazioni tra farmaci e non contatta medici o farmacie. Per dosi e terapie segui sempre le indicazioni del medico o del farmacista.";

const FONT = "'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function alertSubject(d: AlertEmailData): string {
  const n = d.meds.length;
  return `${d.test ? "[Prova] " : ""}Panoramix · ${d.patientName}: ${n} ${n === 1 ? "medicina" : "medicine"} da ordinare`;
}

function medLabel(m: AlertEmailMed) {
  return `${m.name}${m.strength ? ` ${m.strength}` : ""}`;
}

function coverageText(m: AlertEmailMed) {
  if (m.asNeeded) return "al bisogno";
  if (m.coverageDays === null) return "fino alla fine della terapia";
  return `${m.coverageDays} ${daysWord(m.coverageDays)}`;
}

function runOutText(m: AlertEmailMed) {
  if (m.asNeeded || !m.runOutDate) return "—";
  return formatLong(m.runOutDate);
}

/** Testo pronto da copiare e inoltrare al medico (l'app non lo invia). */
export function doctorText(d: AlertEmailData): string | null {
  const rx = d.meds.filter((m) => m.requiresPrescription);
  if (!rx.length) return null;
  const lines = rx.map((m) => `– ${medLabel(m)}, 1 confezione da ${m.pillsPerPack} compresse${m.dosesPhrase && !m.asNeeded ? ` (${m.dosesPhrase})` : ""}`);
  return `Buongiorno dottore,\nper ${d.patientName} avrei bisogno della ricetta per:\n${lines.join("\n")}\nGrazie,\n${d.managerFullName}`;
}

/** Logo dell'app (public/email-logo.png), sullo stesso dominio dei link dell'email. */
function logoUrl(d: AlertEmailData): string {
  return `${new URL(d.planUrl).origin}/email-logo.png`;
}

function intro(d: AlertEmailData): string {
  const hello = `Ciao ${d.managerFirstName || ""}`.trim() + ",";
  const prep = d.nextPrep ? ` la prossima preparazione del portapillole è ${formatLong(d.nextPrep)}.` : "";
  const n = d.meds.length;
  const below = n === 1 ? "Questa medicina è sotto soglia: è il momento di ordinarla." : "Queste medicine sono sotto soglia: è il momento di ordinarle.";
  return prep ? `${hello}${prep} ${below}` : `${hello} ${below[0].toLowerCase()}${below.slice(1)}`;
}

export function renderAlertEmail(d: AlertEmailData): { subject: string; html: string; text: string } {
  const subject = alertSubject(d);
  const n = d.meds.length;
  const title = `${n} ${n === 1 ? "medicina" : "medicine"} da ordinare per ${d.patientName}`;
  const doc = doctorText(d);

  const medBlocks = d.meds
    .map((m) => {
      const out = m.status === "out";
      const chip = out
        ? { bg: "#AE2418", fg: "#FFFFFF", bc: "#AE2418", label: "Esaurita" }
        : { bg: "#FFF0D9", fg: "#8A4A00", bc: "#E3A54A", label: "Da ordinare" };
      const row = (label: string, value: string) =>
        `<tr><td style="padding:4px 0;color:#44505C;font:400 16px/1.4 ${FONT};">${label}</td><td align="right" style="padding:4px 0;font:650 16px/1.4 ${FONT};font-weight:600;color:#0E1620;">${esc(value)}</td></tr>`;
      return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1.5px solid ${out ? "#AE2418" : "#E3A54A"};border-radius:14px;background:${out ? "#FCEAE7" : "#FFFFFF"};margin:0 0 14px;">
  <tr><td style="padding:18px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="30" valign="middle"><div style="width:20px;height:20px;border-radius:10px;background:${esc(m.color)};"></div></td>
      <td valign="middle" style="font:600 19px/1.2 ${FONT};color:#0E1620;">${esc(m.name)} <span style="font-weight:500;color:#44505C;">${esc(m.strength)}</span></td>
      <td align="right" valign="middle"><span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${chip.bg};color:${chip.fg};border:1px solid ${chip.bc};font:600 14px/1 ${FONT};white-space:nowrap;">${chip.label}</span></td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
      ${row("Compresse rimaste", formatQty(m.qty))}
      ${row("Giorni di copertura", coverageText(m))}
      ${row("Finisce", runOutText(m))}
      ${row("Ricetta", m.requiresPrescription ? "Serve la ricetta" : "Non serve")}
    </table>
  </td></tr>
</table>`;
    })
    .join("");

  const docBlock = doc
    ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:14px;background:#EDF0F3;margin:6px 0 20px;">
  <tr><td style="padding:18px 20px;">
    <div style="font:600 16px/1.3 ${FONT};color:#0E1620;">Testo pronto per il medico</div>
    <div style="font:400 15px/1.4 ${FONT};color:#44505C;margin:4px 0 10px;">Copialo e invialo tu per chiedere la ricetta: Panoramix non lo manda a nessuno.</div>
    <div style="background:#FFFFFF;border:1px solid #DAE0E6;border-radius:10px;padding:14px 16px;font:400 16px/1.55 ${FONT};color:#0E1620;">${esc(doc).replace(/\n/g, "<br>")}</div>
  </td></tr>
</table>`
    : "";

  const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#E7EBEF;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E7EBEF;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #DAE0E6;border-radius:18px;">
  <tr><td style="padding:22px 28px;border-bottom:1px solid #DAE0E6;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" style="padding-right:10px;"><img src="${esc(logoUrl(d))}" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border:0;border-radius:8px;background:#132030;"></td>
      <td valign="middle" style="font:600 19px/1 ${FONT};color:#0E1620;letter-spacing:-.02em;">Panoramix</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:28px;">
    ${d.test ? `<p style="margin:0 0 16px;padding:10px 14px;border-radius:10px;background:#E5EDFB;color:#1E4DA6;font:600 15px/1.4 ${FONT};">Email di prova: mostra come arriverebbe l’avviso con le scorte di oggi.</p>` : ""}
    <h1 style="margin:0 0 10px;font:650 26px/1.2 ${FONT};font-weight:600;color:#0E1620;letter-spacing:-.02em;">${esc(title)}</h1>
    <p style="margin:0 0 20px;font:400 17px/1.5 ${FONT};color:#44505C;">${esc(intro(d))}</p>
    ${medBlocks}
    ${docBlock}
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:12px;background:#132030;">
      <a href="${esc(d.planUrl)}" style="display:inline-block;padding:15px 24px;font:600 17px/1 ${FONT};color:#FFFFFF;text-decoration:none;border-radius:12px;">Apri il piano</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:20px 28px;border-top:1px solid #DAE0E6;background:#F3F5F7;border-radius:0 0 18px 18px;">
    <p style="margin:0 0 8px;font:400 14px/1.5 ${FONT};color:#44505C;">${esc(EMAIL_DISCLAIMER)}</p>
    <p style="margin:0;font:400 14px/1.5 ${FONT};color:#44505C;">Ricevi questa email perché sei tra i destinatari del piano ${esc(d.patientName)}. Rispondendo scrivi a ${esc(d.managerFullName)}. <a href="${esc(d.settingsUrl)}" style="color:#1C5CC8;">Gestisci gli avvisi</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const textMeds = d.meds
    .map(
      (m) =>
        `• ${medLabel(m)} — ${m.status === "out" ? "ESAURITA" : "Da ordinare"}\n  Compresse rimaste: ${formatQty(m.qty)}\n  Giorni di copertura: ${coverageText(m)}\n  Finisce: ${runOutText(m)}\n  Ricetta: ${m.requiresPrescription ? "serve la ricetta" : "non serve"}`,
    )
    .join("\n\n");
  const text = [
    d.test ? "[EMAIL DI PROVA]\n" : null,
    title,
    "",
    intro(d),
    "",
    textMeds,
    doc ? `\n— Testo pronto per il medico (copialo e invialo tu) —\n${doc}` : null,
    "",
    `Apri il piano: ${d.planUrl}`,
    "",
    "—",
    EMAIL_DISCLAIMER,
    `Ricevi questa email perché sei tra i destinatari del piano ${d.patientName}. Gestisci gli avvisi: ${d.settingsUrl}`,
  ]
    .filter((x) => x !== null)
    .join("\n");

  return { subject, html, text };
}
