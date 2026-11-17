// Contenuto di promemoria e riepiloghi a partire dalle previsioni (funzioni pure).

import { addDays, formatShort, type ISODate } from "./dates";
import type { Medication } from "./db-types";
import { categoryLabel, doseWord, isLevel, levelPhrase } from "./categories";
import { dosesAt, dosesBetween, dosesPhrase, hasEnded, totalPerDose, upcomingChanges, type DoseChange, type PlanForecast } from "./forecast";
import type { ReminderItem, SummaryMed } from "./email/templates";

/** "Dal 18 nov: ½ al mattino" oppure "Dal 18 nov: sospesa". */
export function changeLabel(c: DoseChange): string {
  return `Dal ${formatShort(c.from)}: ${totalPerDose(c) > 0 ? dosesPhrase(c) : "sospesa"}`;
}

/**
 * Cosa mettere nel portapillole per i 7 giorni da `prepDate`: ogni medicinale non al bisogno
 * e non concluso con almeno una dose nella settimana (anche flaconi e siringhe).
 */
export function buildPrepReminderItems(meds: Medication[], prepDate: ISODate): ReminderItem[] {
  const weekEnd = addDays(prepDate, 6);
  return meds
    .filter((m) => m.frequencyType !== "as_needed" && !hasEnded(m, prepDate))
    .filter((m) => dosesBetween(m, prepDate, weekEnd) > 0)
    .map((m) => {
      const change = upcomingChanges(m, prepDate).find((c) => c.from <= weekEnd);
      return {
        name: m.name,
        strength: m.strength,
        color: m.color,
        categoryLabel: categoryLabel(m.category),
        phrase: dosesPhrase(dosesAt(m, prepDate), (n) => doseWord(m, n)),
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
      category: med.category,
      daysPerPack: med.daysPerPack ?? null,
      frequencyType: med.frequencyType,
      levelText: isLevel(med) ? levelPhrase(f.stock, f.coverageDays, med) : "",
    }));
}
