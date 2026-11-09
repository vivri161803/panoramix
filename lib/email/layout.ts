// Impaginazione comune delle email (stesso aspetto dell'avviso: tabelle e stili inline).

export const FONT = "'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface LayoutData {
  subject: string;
  /** testo nascosto mostrato come anteprima nella casella */
  preheader: string;
  title: string;
  /** paragrafo sotto il titolo (testo semplice) */
  intro: string;
  /** contenuto HTML già pronto */
  body: string;
  cta?: { url: string; label: string };
  /** righe in fondo (testo semplice) */
  footer: string[];
  /** indirizzo dell'app, per il logo */
  appUrl: string;
  /** banner informativo in alto (testo semplice) */
  banner?: string;
}

export function renderLayout(d: LayoutData): string {
  const logo = `${new URL(d.appUrl).origin}/email-logo.png`;
  const footer = d.footer.map((t, i) => `<p style="margin:${i ? "8px" : "0"} 0 0;font:400 14px/1.5 ${FONT};color:#44505C;">${esc(t)}</p>`).join("");
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(d.subject)}</title></head>
<body style="margin:0;padding:0;background:#E7EBEF;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(d.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E7EBEF;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #DAE0E6;border-radius:18px;">
  <tr><td style="padding:22px 28px;border-bottom:1px solid #DAE0E6;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" style="padding-right:10px;"><img src="${esc(logo)}" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border:1px solid #DAE0E6;border-radius:8px;background:#F4F3EE;"></td>
      <td valign="middle" style="font:600 19px/1 ${FONT};color:#0E1620;letter-spacing:-.02em;">Panoramix</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:28px;">
    ${d.banner ? `<p style="margin:0 0 16px;padding:10px 14px;border-radius:10px;background:#E5EDFB;color:#1E4DA6;font:600 15px/1.4 ${FONT};">${esc(d.banner)}</p>` : ""}
    <h1 style="margin:0 0 10px;font:650 26px/1.2 ${FONT};font-weight:600;color:#0E1620;letter-spacing:-.02em;">${esc(d.title)}</h1>
    <p style="margin:0 0 20px;font:400 17px/1.5 ${FONT};color:#44505C;">${esc(d.intro)}</p>
    ${d.body}
    ${
      d.cta
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:6px;"><tr><td style="border-radius:12px;background:#132030;">
      <a href="${esc(d.cta.url)}" style="display:inline-block;padding:15px 24px;font:600 17px/1 ${FONT};color:#FFFFFF;text-decoration:none;border-radius:12px;">${esc(d.cta.label)}</a>
    </td></tr></table>`
        : ""
    }
  </td></tr>
  <tr><td style="padding:20px 28px;border-top:1px solid #DAE0E6;background:#F3F5F7;border-radius:0 0 18px 18px;">${footer}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** Tabella a due colonne (etichetta · valore) dentro una scheda. */
export function infoCard(opts: { title: string; color?: string; chip?: { label: string; tone: "ok" | "order" | "out" | "ordered" }; rows: [string, string][]; tone?: "ok" | "order" | "out" }): string {
  const tones = {
    ok: { border: "#DAE0E6", bg: "#FFFFFF" },
    order: { border: "#E3A54A", bg: "#FFFFFF" },
    out: { border: "#AE2418", bg: "#FCEAE7" },
  };
  const chips = {
    ok: { bg: "#E3F4EA", fg: "#1D6B3E", bc: "#8CCBA4" },
    order: { bg: "#FFF0D9", fg: "#8A4A00", bc: "#E3A54A" },
    out: { bg: "#AE2418", fg: "#FFFFFF", bc: "#AE2418" },
    ordered: { bg: "#E5EDFB", fg: "#1E4DA6", bc: "#9DB8EA" },
  };
  const t = tones[opts.tone ?? "ok"];
  const chip = opts.chip
    ? `<td align="right" valign="middle"><span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${chips[opts.chip.tone].bg};color:${chips[opts.chip.tone].fg};border:1px solid ${chips[opts.chip.tone].bc};font:600 14px/1 ${FONT};white-space:nowrap;">${esc(opts.chip.label)}</span></td>`
    : "";
  const dot = opts.color ? `<td width="30" valign="middle"><div style="width:20px;height:20px;border-radius:10px;background:${esc(opts.color)};"></div></td>` : "";
  const rows = opts.rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 0;color:#44505C;font:400 16px/1.4 ${FONT};">${esc(label)}</td><td align="right" style="padding:4px 0;font:600 16px/1.4 ${FONT};color:#0E1620;">${esc(value)}</td></tr>`,
    )
    .join("");
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1.5px solid ${t.border};border-radius:14px;background:${t.bg};margin:0 0 14px;">
  <tr><td style="padding:18px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${dot}
      <td valign="middle" style="font:600 19px/1.2 ${FONT};color:#0E1620;">${esc(opts.title)}</td>
      ${chip}
    </tr></table>
    ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">${rows}</table>` : ""}
  </td></tr>
</table>`;
}

/** Riquadro grigio con un messaggio (es. "Tutto in ordine"). */
export function noteBox(text: string, tone: "info" | "ok" | "warn" = "info"): string {
  const c = { info: ["#EDF0F3", "#0E1620"], ok: ["#E3F4EA", "#1D6B3E"], warn: ["#FFF0D9", "#8A4A00"] }[tone];
  return `<p style="margin:0 0 16px;padding:14px 16px;border-radius:12px;background:${c[0]};color:${c[1]};font:600 16px/1.45 ${FONT};">${esc(text)}</p>`;
}
