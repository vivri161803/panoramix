import { z } from "zod";
import { isISODate } from "./dates";
import { PILL_COLOR_HEXES, PILL_SHAPE_IDS } from "./pills";

const halfStep = (label: string, max: number) =>
  z
    .number(`${label}: inserisci un numero.`)
    .min(0, `${label}: non può essere negativo.`)
    .max(max, `${label}: al massimo ${max}.`)
    .refine((n) => Number.isInteger(n * 2), `${label}: usa multipli di ½.`);

const isoDate = (msg: string) => z.string().refine(isISODate, msg);

export const emailField = z.string().trim().toLowerCase().pipe(z.email("Controlla l’indirizzo email."));

export const planSchema = z
  .object({
    patient_name: z.string().trim().min(1, "Scrivi il nome della persona.").max(80, "Al massimo 80 caratteri."),
    notes: z.string().trim().max(2000, "Al massimo 2000 caratteri."),
    stock_mode: z.enum(["daily", "weekly"], "Scegli la modalità delle scorte."),
    prep_weekday: z.number().int().min(1).max(7),
    alert_under_14: z.boolean(),
    alert_under_7: z.boolean(),
    alert_last_pack: z.boolean(),
    recipients: z.array(emailField).max(5, "Al massimo 5 destinatari aggiuntivi."),
    /** obbligatori se cambia la modalità: nuovo conteggio di ogni medicinale */
    counts: z
      .array(z.object({ medication_id: z.uuid(), qty: halfStep("Conteggio", 100000) }))
      .optional(),
  })
  .refine((p) => new Set(p.recipients).size === p.recipients.length, { message: "Un indirizzo è ripetuto.", path: ["recipients"] });

export type PlanInput = z.input<typeof planSchema>;

export const FREQUENCIES = ["daily", "weekdays", "every_n_days", "cycle", "as_needed"] as const;

export const medicationSchema = z
  .object({
    name: z.string().trim().min(1, "Scrivi il nome del medicinale.").max(80, "Al massimo 80 caratteri."),
    strength: z.string().trim().max(40, "Al massimo 40 caratteri."),
    description: z.string().trim().max(200, "Al massimo 200 caratteri."),
    pills_per_pack: z.number("Indica quante compresse ci sono in una confezione.").int("Usa un numero intero.").min(1, "Almeno 1 compressa per confezione.").max(1000, "Al massimo 1000."),
    requires_prescription: z.boolean(),
    color: z.enum(PILL_COLOR_HEXES, "Scegli un colore."),
    shape: z.enum(PILL_SHAPE_IDS, "Scegli una forma."),
    dose_morning: halfStep("Mattina", 20),
    dose_noon: halfStep("Pranzo", 20),
    dose_evening: halfStep("Sera", 20),
    frequency_type: z.enum(FREQUENCIES, "Scegli la frequenza."),
    weekdays: z.array(z.number().int().min(1).max(7)),
    interval_days: z.number().int().min(2, "Almeno ogni 2 giorni.").max(365, "Al massimo ogni 365 giorni.").nullable(),
    cycle_on: z.number().int().min(1, "Almeno 1 giorno sì.").max(365).nullable(),
    cycle_off: z.number().int().min(1, "Almeno 1 giorno no.").max(365).nullable(),
    start_date: isoDate("Indica la data di inizio."),
    end_date: isoDate("Data di fine non valida.").nullable(),
    stock_qty: halfStep("Scorta in casa", 100000),
  })
  .superRefine((m, ctx) => {
    if (m.dose_morning + m.dose_noon + m.dose_evening <= 0) {
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
export const packsSchema = z.number().int("Usa un numero intero di confezioni.").min(1, "Almeno 1 confezione.").max(100, "Al massimo 100 confezioni.");
