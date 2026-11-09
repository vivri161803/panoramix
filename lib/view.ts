// Dati già pronti per l'interfaccia (serializzabili verso i componenti client).

import { formatShort, type ISODate } from "./dates";
import { changeLabel } from "./digest";
import type { Medication } from "./db-types";
import { daysWord, formatQty, pillsWord, statusReason, upcomingChanges, type Forecast, type MedStatus, type StockMode } from "./forecast";

export interface DispenserView {
  id: string;
  name: string;
  strength: string;
  color: string;
  shape: string;
  qty: number;
  qtyText: string;
  qtyWord: string;
  perPack: number;
  rx: boolean;
  /** giorni per il livello del tubo; null = oltre la scala */
  days: number | null;
  daysText: string;
  daysWord: string;
  endLabel: string;
  status: MedStatus;
  reason: string;
  ordered: boolean;
  asNeeded: boolean;
  /** prossimo cambio di dose programmato, es. "Dal mer 18 nov: ½ al mattino" */
  nextChange: string;
}

export function dispenserView(med: Medication, f: Forecast, mode: StockMode, today: ISODate): DispenserView {
  const next = f.asNeeded || f.ended ? undefined : upcomingChanges(med, today)[0];
  let daysText = "";
  let dWord = "";
  let endLabel: string;
  if (f.asNeeded) {
    dWord = "Al bisogno: non entra nelle previsioni";
    endLabel = f.stock <= 0 ? "Finita" : `${formatQty(f.stock / med.pillsPerPack)} confezioni circa`;
  } else if (f.ended) {
    dWord = "Terapia conclusa";
    endLabel = med.endDate ? `Conclusa ${formatShort(med.endDate)}` : "";
  } else if (f.coverageDays === null) {
    daysText = "∞";
    dWord = med.endDate ? "basta fino alla fine della terapia" : "non si esaurisce a breve";
    endLabel = med.endDate ? `Fine terapia ${formatShort(med.endDate)}` : "Copertura oltre i 3 anni";
  } else {
    daysText = String(f.coverageDays);
    dWord = f.coverageDays === 1 ? "giorno di copertura" : "giorni di copertura";
    endLabel = f.stock <= 0 && f.coverageDays === 0 ? "Finita" : `Finisce ${formatShort(f.runOutDate!)}`;
  }
  let reason = statusReason(f, mode, med.endDate);
  if (f.status === "out" && med.orderedAt) reason = `${reason} · già ordinata`;
  return {
    id: med.id,
    name: med.name,
    strength: med.strength,
    color: med.color,
    shape: med.shape,
    qty: f.stock,
    qtyText: formatQty(f.stock),
    qtyWord: f.stock === 1 ? "compressa rimasta" : "compresse rimaste",
    perPack: med.pillsPerPack,
    rx: med.requiresPrescription,
    days: f.asNeeded ? Math.min(60, Math.round((f.stock / med.pillsPerPack) * 30)) : f.coverageDays,
    daysText,
    daysWord: dWord,
    endLabel,
    status: f.status,
    reason,
    ordered: !!med.orderedAt,
    asNeeded: f.asNeeded,
    nextChange: next ? changeLabel(next) : "",
  };
}

export function pillsText(n: number): string {
  return `${formatQty(n)} ${pillsWord(n)}`;
}

export function daysText(n: number): string {
  return `${n} ${daysWord(n)}`;
}
