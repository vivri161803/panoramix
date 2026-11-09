// Contenuto di promemoria e riepiloghi a partire dalle previsioni (funzioni pure).

import { addDays, formatShort, type ISODate } from "./dates";
import type { Medication } from "./db-types";
import { dosesAt, dosesPhrase, totalPerDose, upcomingChanges, type DoseChange, type PlanForecast, type PrepItem } from "./forecast";
import type { ReminderItem, SummaryMed } from "./email/templates";

/** "Dal 18 nov: ½ al mattino" oppure "Dal 18 nov: sospesa". */
export function changeLabel(c: DoseChange): string {
  return `Dal ${formatShort(c.from)}: ${totalPerDose(c) > 0 ? dosesPhrase(c) : "sospesa"}`;
}

/** Cosa mettere nel portapillole per la settimana che inizia `prepDate`. */
export function buildReminderItems(meds: Medication[], prep: PrepItem[], prepDate: ISODate): ReminderItem[] {
  const byId = new Map(meds.map((m) => [m.id, m]));
  const weekEnd = addDays(prepDate, 6);
  return prep
    .filter((i) => byId.has(i.medicationId))
    .map((i) => {
      const m = byId.get(i.medicationId)!;
      const change = upcomingChanges(m, prepDate).find((c) => c.from <= weekEnd);
      return {
        name: m.name,
        strength: m.strength,
        color: m.color,
        need: i.need,
        missing: i.missing,
        phrase: dosesPhrase(dosesAt(m, prepDate)),
        changeNote: change ? changeLabel(change) : undefined,
      };
    });
}

/** Medicine in corso del piano per il riepilogo settimanale (dalla peggiore). */
export function buildSummaryMeds(fc: PlanForecast<Medication>): SummaryMed[] {
  return fc.items
    .filter((i) => !i.forecast.ended)
    .map(({ med, forecast: f }) => ({
      name: med.name,
      strength: med.strength,
      color: med.color,
      status: f.status,
      qty: f.stock,
      coverageDays: f.coverageDays,
      runOutDate: f.runOutDate,
      asNeeded: f.asNeeded,
    }));
}
