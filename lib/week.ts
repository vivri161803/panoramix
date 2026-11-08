import { addDays, diffDays, formatRange, isISODate, type ISODate } from "./dates";
import { buildWeek, calendarWeekStart, type PlanSettings } from "./forecast";
import type { Medication } from "./db-types";

/** Settimana richiesta (?settimana=AAAA-MM-GG) normalizzata all'inizio settimana del piano. */
export function resolveWeek(param: unknown, settings: PlanSettings, today: ISODate) {
  const current = calendarWeekStart(today, settings);
  const asked = typeof param === "string" && isISODate(param) ? calendarWeekStart(param, settings) : current;
  // limite ragionevole: un anno avanti o indietro
  const start = Math.abs(diffDays(current, asked)) > 371 ? current : asked;
  return {
    start,
    end: addDays(start, 6),
    current,
    isCurrent: start === current,
    prev: addDays(start, -7),
    next: addDays(start, 7),
    label: formatRange(start, addDays(start, 6)),
  };
}

export function weekGrid(meds: Medication[], start: ISODate) {
  const days = buildWeek(meds, start);
  const byId = new Map(meds.map((m) => [m.id, m]));
  // in legenda solo le medicine presenti nella settimana
  const used = new Set(days.flatMap((d) => [...d.slots.morning, ...d.slots.noon, ...d.slots.evening].map((i) => i.medicationId)));
  const legend = meds.filter((m) => used.has(m.id));
  return { days, byId, legend };
}
