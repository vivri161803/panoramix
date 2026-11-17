// Dati già pronti per l'interfaccia (serializzabili verso i componenti client).

import { formatShort, type ISODate } from "./dates";
import { changeLabel } from "./digest";
import type { Medication } from "./db-types";
import { categoryLabel, containerWord, isLevel, leftWord, levelPhrase, type Category } from "./categories";
import { formatQty, statusReason, upcomingChanges, type Forecast, type FrequencyType, type MedStatus } from "./forecast";

export interface DispenserView {
  id: string;
  name: string;
  strength: string;
  color: string;
  category: Category;
  categoryLabel: string;
  /** forma della pillola (tonda, ovale, capsula) o null */
  pillShape: string | null;
  daysPerPack: number | null;
  frequencyType: FrequencyType;
  /** a livello: la scorta è in contenitori e il tubo è una fascia piena */
  level: boolean;
  /** a livello: «circa 18 giorni · 1 flacone e mezzo» */
  levelText: string;
  qty: number;
  qtyText: string;
  /** «compresse rimaste», «flaconi rimasti» */
  qtyWord: string;
  /** parola del contenitore per 1 e per tanti: «compressa» / «compresse» */
  unitOne: string;
  unitMany: string;
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

export function dispenserView(med: Medication, f: Forecast, today: ISODate): DispenserView {
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
  const level = isLevel(med);
  let reason = statusReason(f, med.endDate);
  if (f.status === "out" && med.orderedAt) reason = `${reason} · già ordinata`;
  return {
    id: med.id,
    name: med.name,
    strength: med.strength,
    color: med.color,
    category: med.category,
    categoryLabel: categoryLabel(med.category),
    pillShape: med.shape,
    daysPerPack: med.daysPerPack ?? null,
    frequencyType: med.frequencyType,
    level,
    levelText: level ? levelPhrase(f.stock, f.ended ? null : f.coverageDays, med) : "",
    qty: f.stock,
    qtyText: formatQty(f.stock),
    qtyWord: leftWord(med, f.stock),
    unitOne: containerWord(med, 1),
    unitMany: containerWord(med, 2),
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

export function daysText(n: number): string {
  return `${n} ${n === 1 ? "giorno" : "giorni"}`;
}
