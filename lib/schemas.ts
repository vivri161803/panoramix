import { z } from "zod";
import { isISODate } from "./dates";
import { CATEGORY_IDS, doseStep } from "./categories";
import { ATC_CODE_RE, ATC_UNKNOWN_VALUE } from "./atc";

const halfStep = (label: string, max: number) =>
  z
    .number(`${label}: inserisci un numero.`)
    .min(0, `${label}: non può essere negativo.`)
    .max(max, `${label}: al massimo ${max}.`)
    .refine((n) => Number.isInteger(n * 2), `${label}: usa multipli di ½.`);

const PILL_SHAPE_IDS = ["tonda", "ovale", "capsula"] as const;

/**
 * Scorta a livello: contenitori chiusi (intero) più quello aperto (pieno 1, metà 0,5, quasi finito 0,1,
 * nessuno 0). Vera se q ≥ 0 e la parte decimale vale 0, 0,1 o 0,5.
 */
export function isLevelQty(q: number): boolean {
  if (!Number.isFinite(q) || q < 0) return false;
  const r = q - Math.floor(q + 1e-9);
  return [0, 0.1, 0.5, 1].some((v) => Math.abs(r - v) < 1e-9);
}

export const levelQtySchema = z
  .number("Quantità: inserisci un numero.")
  .max(100000, "Quantità: al massimo 100000.")
  .refine(isLevelQty, "Indica i contenitori chiusi e quanto resta in quello aperto.");

const isoDate = (msg: string) => z.string().refine(isISODate, msg);

export const emailField = z.string().trim().toLowerCase().pipe(z.email("Controlla l’indirizzo email."));

export const planSchema = z
  .object({
    patient_name: z.string().trim().min(1, "Scrivi il nome della persona.").max(80, "Al massimo 80 caratteri."),
    notes: z.string().trim().max(2000, "Al massimo 2000 caratteri."),
    prep_weekday: z.number().int().min(1).max(7),
    alert_under_14: z.boolean(),
    alert_under_7: z.boolean(),
    alert_last_pack: z.boolean(),
    prep_reminder: z.boolean().default(false),
    weekly_summary: z.boolean().default(false),
    recipients: z.array(emailField).max(5, "Al massimo 5 destinatari aggiuntivi."),
  })
  .refine((p) => new Set(p.recipients).size === p.recipients.length, { message: "Un indirizzo è ripetuto.", path: ["recipients"] });

export type PlanInput = z.input<typeof planSchema>;

export const FREQUENCIES = ["daily", "weekdays", "every_n_days", "cycle", "as_needed"] as const;

export const medicationSchema = z
  .object({
    name: z.string().trim().min(1, "Scrivi il nome del medicinale.").max(80, "Al massimo 80 caratteri."),
    strength: z.string().trim().max(40, "Al massimo 40 caratteri."),
    description: z.string().trim().max(200, "Al massimo 200 caratteri."),
    pills_per_pack: z.number("Indica quanti pezzi ci sono in una confezione.").int("Usa un numero intero.").min(1, "Almeno 1 per confezione.").max(10000, "Al massimo 10000."),
    requires_prescription: z.boolean(),
    /** codice AIC a 9 cifre, se il medicinale viene dall'anagrafica AIFA */
    aic: z.string().regex(/^\d{9}$/, "Il codice AIC ha 9 cifre.").nullable(),
    /** codice ATC completo o lettera del gruppo; "?" = "Non so". Il colore lo calcola il server. */
    atc_code: z
      .string("Scegli a cosa serve il medicinale.")
      .trim()
      .toUpperCase()
      .refine((v) => v === ATC_UNKNOWN_VALUE || ATC_CODE_RE.test(v), "Scegli a cosa serve il medicinale."),
    category: z.enum(CATEGORY_IDS, "Scegli la categoria del medicinale."),
    /** solo per le pillole */
    shape: z.enum(PILL_SHAPE_IDS, "Scegli una forma.").nullable(),
    dose_morning: halfStep("Mattina", 999),
    dose_noon: halfStep("Pranzo", 999),
    dose_evening: halfStep("Sera", 999),
    frequency_type: z.enum(FREQUENCIES, "Scegli la frequenza."),
    weekdays: z.array(z.number().int().min(1).max(7)),
    interval_days: z.number().int().min(2, "Almeno ogni 2 giorni.").max(365, "Al massimo ogni 365 giorni.").nullable(),
    cycle_on: z.number().int().min(1, "Almeno 1 giorno sì.").max(365).nullable(),
    cycle_off: z.number().int().min(1, "Almeno 1 giorno no.").max(365).nullable(),
    start_date: isoDate("Indica la data di inizio."),
    end_date: isoDate("Data di fine non valida.").nullable(),
    /** scorta in casa: a pezzi multipli di ½, a livello contenitori chiusi + quello aperto (controllo nell'azione) */
    stock_qty: z.number("Scorta in casa: inserisci un numero.").min(0, "Scorta in casa: non può essere negativa.").max(100000, "Scorta in casa: al massimo 100000.").nullish(),
    /** a livello: per quanti giorni di uso dura un contenitore; null = a pezzi */
    days_per_pack: z.number("Indica per quanti giorni dura.").int("Usa un numero intero.").min(1, "Almeno 1 giorno.").max(365, "Al massimo 365 giorni.").nullish(),
  })
  .superRefine((m, ctx) => {
    // la forma conta solo per le pillole (per le altre categorie l'azione salva null)
    if (m.category === "pillola" && m.shape == null) {
      ctx.addIssue({ code: "custom", path: ["shape"], message: "Scegli una forma." });
    }
    if (m.frequency_type === "as_needed" && m.days_per_pack != null) {
      ctx.addIssue({ code: "custom", path: ["days_per_pack"], message: "Un medicinale al bisogno si conta a pezzi." });
    }
    if (doseStep({ category: m.category }) === 1 && [m.dose_morning, m.dose_noon, m.dose_evening].some((d) => !Number.isInteger(d))) {
      ctx.addIssue({ code: "custom", path: ["doses"], message: "Per questo tipo le dosi sono intere." });
    }
    // al bisogno non ci sono fasce: si prende quando serve e si registra la presa
    if (m.frequency_type !== "as_needed" && m.dose_morning + m.dose_noon + m.dose_evening <= 0) {
      ctx.addIssue({ code: "custom", path: ["doses"], message: "Imposta almeno una fascia con una dose maggiore di zero." });
    }
    if (m.frequency_type === "weekdays" && m.weekdays.length === 0) {
      ctx.addIssue({ code: "custom", path: ["weekdays"], message: "Scegli almeno un giorno della settimana." });
    }
    if (m.frequency_type === "every_n_days" && m.interval_days == null) {
      ctx.addIssue({ code: "custom", path: ["interval_days"], message: "Indica ogni quanti giorni." });
    }
    if (m.frequency_type === "cycle" && (m.cycle_on == null || m.cycle_off == null)) {
      ctx.addIssue({ code: "custom", path: ["cycle_on"], message: "Indica i giorni sì e i giorni no." });
    }
    if (m.end_date && m.end_date < m.start_date) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "La fine non può essere prima dell’inizio." });
    }
  });

export type MedicationInput = z.input<typeof medicationSchema>;

export const qtySchema = halfStep("Quantità", 100000);
export const doseSchema = halfStep("Dose", 999);

export const doseChangeSchema = z
  .object({
    effective_date: isoDate("Indica da che giorno vale la nuova dose."),
    dose_morning: halfStep("Mattina", 999),
    dose_noon: halfStep("Pranzo", 999),
    dose_evening: halfStep("Sera", 999),
  });

export type DoseChangeInput = z.input<typeof doseChangeSchema>;

export const ROLES = ["viewer", "editor"] as const;
export const inviteSchema = z.object({
  email: emailField,
  role: z.enum(ROLES, "Scegli cosa può fare."),
});

export type InviteInput = z.input<typeof inviteSchema>;
export const packsSchema = z.number().int("Usa un numero intero di confezioni.").min(1, "Almeno 1 confezione.").max(100, "Al massimo 100 confezioni.");
