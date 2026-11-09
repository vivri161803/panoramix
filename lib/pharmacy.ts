// Lista per la farmacia: cosa ordinare, quante confezioni e il testo da condividere.
// Funzioni pure, usate sia dal server sia dal browser.

import { addDays, formatDayMonthYear, type ISODate } from "./dates";
import { dosesAt, dosesBetween, dosesPhrase, type Forecast, type MedicationData, type MedStatus } from "./forecast";

/** Giorni di terapia da coprire con l'ordine. */
export const ORDER_TARGET_DAYS = 30;

export interface PharmacyItem {
  id: string;
  name: string;
  strength: string;
  color: string;
  shape: string;
  pillsPerPack: number;
  rx: boolean;
  status: MedStatus;
  ordered: boolean;
  /** proposta iniziale nella lista */
  selected: boolean;
  /** confezioni suggerite */
  packs: number;
  /** "1 al mattino" (vuoto per i medicinali al bisogno) */
  phrase: string;
}

/**
 * Confezioni per coprire `targetDays` di terapia oltre le compresse già in casa
 * (dalla prossima preparazione, nel portapillole settimanale). Almeno 1.
 */
export function suggestedPacks(
  med: MedicationData,
  f: Pick<Forecast, "stock" | "asNeeded">,
  start: ISODate,
  targetDays = ORDER_TARGET_DAYS,
): number {
  if (f.asNeeded) return 1;
  const need = dosesBetween(med, start, addDays(start, targetDays - 1));
  const missing = need - f.stock;
  return Math.max(1, Math.ceil(missing / med.pillsPerPack - 1e-9));
}

export interface PharmacyMed extends MedicationData {
  name: string;
  strength: string;
  color: string;
  shape: string;
  requiresPrescription: boolean;
}

/** Medicine in corso con la proposta di ordine: selezionate quelle esaurite o sotto soglia e non ancora ordinate. */
export function buildPharmacyItems<M extends PharmacyMed>(items: { med: M; forecast: Forecast }[], today: ISODate, nextPrep: ISODate | null): PharmacyItem[] {
  const start = nextPrep && nextPrep > today ? nextPrep : today;
  return items
    .filter((i) => !i.forecast.ended)
    .map(({ med, forecast: f }) => ({
      id: med.id,
      name: med.name,
      strength: med.strength,
      color: med.color,
      shape: med.shape,
      pillsPerPack: med.pillsPerPack,
      rx: med.requiresPrescription,
      status: f.status,
      ordered: !!med.orderedAt,
      selected: (f.status === "out" || f.status === "order") && !med.orderedAt,
      packs: suggestedPacks(med, f, start),
      phrase: f.asNeeded ? "" : dosesPhrase(dosesAt(med, today)),
    }));
}

export interface PharmacyLine {
  name: string;
  strength: string;
  packs: number;
  pillsPerPack: number;
  rx: boolean;
  phrase: string;
}

const label = (l: PharmacyLine) => `${l.name}${l.strength ? ` ${l.strength}` : ""}`;
const packsText = (l: PharmacyLine) => `${l.packs} ${l.packs === 1 ? "confezione" : "confezioni"} da ${l.pillsPerPack}`;

/** Testo per la farmacia, diviso tra medicine con e senza ricetta. */
export function pharmacyText(patientName: string, lines: PharmacyLine[], today: ISODate): string {
  if (!lines.length) return "";
  const rx = lines.filter((l) => l.rx);
  const free = lines.filter((l) => !l.rx);
  const block = (title: string, ls: PharmacyLine[]) => (ls.length ? [title, ...ls.map((l) => `• ${label(l)} — ${packsText(l)}`), ""] : []);
  return [
    `Medicine per ${patientName} (${formatDayMonthYear(today)})`,
    "",
    ...block("Con ricetta:", rx),
    ...block("Senza ricetta:", free),
  ]
    .join("\n")
    .trim();
}

/** Richiesta della ricetta al medico (la manda l'utente, Panoramix non contatta nessuno). */
export function doctorRequestText(patientName: string, lines: PharmacyLine[], senderName: string): string | null {
  const rx = lines.filter((l) => l.rx);
  if (!rx.length) return null;
  const items = rx.map((l) => `– ${label(l)}, ${packsText(l)}${l.phrase ? ` (${l.phrase})` : ""}`);
  return [`Buongiorno dottore,`, `per ${patientName} avrei bisogno della ricetta per:`, ...items, `Grazie,`, senderName].join("\n").trim();
}
