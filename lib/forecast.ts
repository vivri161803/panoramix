// Logica di dominio di Appoteca, senza dipendenze dal database.
// Riferimento: specifica funzionale §4–§8.

import {
  addDays,
  diffDays,
  isoWeekday,
  maxDate,
  onOrBeforeWeekday,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
  type ISODate,
} from "./dates";
import { isLevel, type Category } from "./categories";

// ——— Tipi ———

export type FrequencyType = "daily" | "weekdays" | "every_n_days" | "cycle" | "as_needed";
export type Slot = "morning" | "noon" | "evening";
export type AlertType = "under_14" | "under_7" | "last_pack";
export type MedStatus = "out" | "order" | "ordered" | "ok";

export const SLOTS: Slot[] = ["morning", "noon", "evening"];
export const ALERT_TYPES: AlertType[] = ["under_14", "under_7", "last_pack"];
export const STATUS_RANK: Record<MedStatus, number> = { out: 0, order: 1, ordered: 2, ok: 3 };

export interface Doses {
  doseMorning: number;
  doseNoon: number;
  doseEvening: number;
}

/** Cambio di dose programmato: dal giorno `from` valgono queste dosi. */
export interface DoseChange extends Doses {
  from: ISODate;
  /** riga del database, se salvato */
  id?: string;
}

export interface Schedule extends Doses {
  frequencyType: FrequencyType;
  /** giorni ISO, 1 = lunedì … 7 = domenica */
  weekdays: number[];
  intervalDays: number | null;
  cycleOn: number | null;
  cycleOff: number | null;
  startDate: ISODate;
  endDate: ISODate | null;
  /** cambi di dose programmati, in qualsiasi ordine */
  doseChanges?: DoseChange[];
}

export interface MedicationData extends Schedule {
  id: string;
  pillsPerPack: number;
  /** conteggio di riferimento */
  stockQty: number;
  stockAsOf: ISODate;
  orderedAt: string | null;
  category: Category;
  /** a livello: giorni di uso per contenitore (la scorta è in contenitori); null = a pezzi */
  daysPerPack?: number | null;
}

export interface PlanSettings {
  /** giorno ISO della preparazione del portapillole */
  prepWeekday: number;
  /** promemoria del portapillole acceso: la sera prima di prepWeekday arriva l'email con le dosi */
  prepReminder: boolean;
  alertUnder14: boolean;
  alertUnder7: boolean;
  alertLastPack: boolean;
}

const EPS = 1e-9;
/** Oltre questo orizzonte la scorta si considera "non in esaurimento". */
export const HORIZON_DAYS = 3 * 366;

// ——— Dosi ———

export function totalPerDose(s: Pick<Schedule, "doseMorning" | "doseNoon" | "doseEvening">): number {
  return s.doseMorning + s.doseNoon + s.doseEvening;
}

export function slotDose(s: Doses, slot: Slot): number {
  return slot === "morning" ? s.doseMorning : slot === "noon" ? s.doseNoon : s.doseEvening;
}

/** Dosi in vigore in un giorno: quelle del medicinale o dell'ultimo cambio già iniziato. */
export function dosesAt(s: Schedule, date: ISODate): Doses {
  let best: DoseChange | null = null;
  for (const c of s.doseChanges ?? []) if (c.from <= date && (!best || c.from > best.from)) best = c;
  const d = best ?? s;
  return { doseMorning: d.doseMorning, doseNoon: d.doseNoon, doseEvening: d.doseEvening };
}

/** Lo schema con le dosi in vigore in quel giorno (per riepiloghi e frasi). */
export function scheduleAt<S extends Schedule>(s: S, date: ISODate): S {
  return { ...s, ...dosesAt(s, date) };
}

/** Cambi di dose ancora da iniziare dopo `today`, in ordine di data. */
export function upcomingChanges(s: Schedule, today: ISODate): DoseChange[] {
  return (s.doseChanges ?? []).filter((c) => c.from > today).sort((a, b) => (a.from < b.from ? -1 : 1));
}

/** La frequenza prevede l'assunzione in questo giorno? (Rispetta inizio e fine.) */
export function isScheduledOn(s: Schedule, date: ISODate): boolean {
  if (s.frequencyType === "as_needed") return false;
  if (date < s.startDate) return false;
  if (s.endDate && date > s.endDate) return false;
  const sinceStart = diffDays(s.startDate, date);
  switch (s.frequencyType) {
    case "daily":
      return true;
    case "weekdays":
      return s.weekdays.includes(isoWeekday(date));
    case "every_n_days": {
      const n = Math.max(1, s.intervalDays ?? 1);
      return sinceStart % n === 0;
    }
    case "cycle": {
      const on = Math.max(1, s.cycleOn ?? 1);
      const off = Math.max(0, s.cycleOff ?? 0);
      return sinceStart % (on + off) < on;
    }
  }
}

/** Dosi di un giorno = somma delle fasce, se quel giorno la frequenza la prevede. */
export function dosesOn(s: Schedule, date: ISODate): number {
  return isScheduledOn(s, date) ? totalPerDose(dosesAt(s, date)) : 0;
}

export function slotDoseOn(s: Schedule, date: ISODate, slot: Slot): number {
  return isScheduledOn(s, date) ? slotDose(dosesAt(s, date), slot) : 0;
}

/** Somma delle dosi previste da `from` a `to` compresi. */
export function dosesBetween(s: Schedule, from: ISODate, to: ISODate): number {
  if (to < from) return 0;
  let total = 0;
  const days = diffDays(from, to);
  for (let i = 0; i <= days; i++) total += dosesOn(s, addDays(from, i));
  return total;
}

/** Fabbisogno settimanale (riepilogo, non si inserisce): media per le frequenze irregolari. */
export function weeklyNeed(s: Schedule): { perWeek: number; approx: boolean } {
  const tot = totalPerDose(s);
  switch (s.frequencyType) {
    case "daily":
      return { perWeek: tot * 7, approx: false };
    case "weekdays":
      return { perWeek: tot * new Set(s.weekdays).size, approx: false };
    case "every_n_days": {
      const n = Math.max(1, s.intervalDays ?? 1);
      return { perWeek: (tot * 7) / n, approx: 7 % n !== 0 };
    }
    case "cycle": {
      const on = Math.max(1, s.cycleOn ?? 1);
      const off = Math.max(0, s.cycleOff ?? 0);
      return { perWeek: (tot * 7 * on) / (on + off), approx: true };
    }
    case "as_needed":
      return { perWeek: 0, approx: false };
  }
}

// ——— Formattazione delle quantità (arrotondare solo qui, mostrando ½) ———

export function formatQty(n: number): string {
  const r = Math.round(n * 2) / 2;
  const whole = Math.floor(r + EPS);
  const half = r - whole > 0.25;
  if (whole === 0 && half) return "½";
  return half ? `${whole}½` : String(whole);
}

export function daysWord(n: number): string {
  return n === 1 ? "giorno" : "giorni";
}

const SLOT_PHRASE: Record<Slot, string> = { morning: "al mattino", noon: "a pranzo", evening: "alla sera" };
export const SLOT_LABEL: Record<Slot, string> = { morning: "Mattina", noon: "Pranzo", evening: "Sera" };

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** "1 al mattino e ½ alla sera"; con la parola della dose "5 ml al mattino", "1 goccia alla sera". */
export function dosesPhrase(s: Doses, word?: (n: number) => string): string {
  return joinList(
    SLOTS.filter((k) => slotDose(s, k) > 0).map((k) => {
      const q = slotDose(s, k);
      return `${formatQty(q)}${word ? ` ${word(q)}` : ""} ${SLOT_PHRASE[k]}`;
    }),
  );
}

export function frequencyPhrase(s: Schedule): string {
  switch (s.frequencyType) {
    case "daily":
      return "tutti i giorni";
    case "weekdays": {
      const days = [...new Set(s.weekdays)].sort((a, b) => a - b);
      if (days.length === 0) return "nessun giorno scelto";
      if (days.length === 7) return "tutti i giorni";
      if (days.length === 1) return `ogni ${WEEKDAYS_LONG[days[0] - 1]}`;
      return joinList(days.map((d) => WEEKDAYS_SHORT[d - 1]));
    }
    case "every_n_days":
      return `ogni ${s.intervalDays ?? "?"} giorni`;
    case "cycle":
      return `${s.cycleOn ?? "?"} giorni sì e ${s.cycleOff ?? "?"} no`;
    case "as_needed":
      return "al bisogno";
  }
}

/** Riepilogo dello schema: "1 al mattino, tutti i giorni → 7 a settimana". */
export function scheduleSummary(s: Schedule): string {
  if (s.frequencyType === "as_needed") return "Al bisogno: non entra nel calendario né nelle previsioni";
  if (totalPerDose(s) <= 0) return "Imposta almeno una dose";
  const { perWeek, approx } = weeklyNeed(s);
  const text = `${dosesPhrase(s)}, ${frequencyPhrase(s)} → ${approx ? "in media " : ""}${formatQty(perWeek)} a settimana`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ——— Scorte (§6) ———

/** Il medicinale è uscito da calendario e previsioni (data di fine passata)? */
export function hasEnded(s: Schedule, today: ISODate): boolean {
  return !!s.endDate && s.endDate < today;
}

/**
 * Consumo della scorta in un giorno. A pezzi: le dosi del giorno. A livello: 1 / daysPerPack nei giorni
 * con almeno una dose (giorni di uso), qualunque sia la dose; niente nei giorni senza dose.
 */
export function consumptionOn(med: Schedule & Pick<MedicationData, "daysPerPack">, date: ISODate): number {
  const doses = dosesOn(med, date);
  if (isLevel(med)) return doses > 0 ? 1 / med.daysPerPack! : 0;
  return doses;
}

/** Consumo da `from` a `to` compresi. */
export function consumptionBetween(med: Schedule & Pick<MedicationData, "daysPerPack">, from: ISODate, to: ISODate): number {
  if (to < from) return 0;
  let total = 0;
  const days = diffDays(from, to);
  for (let i = 0; i <= days; i++) total += consumptionOn(med, addDays(from, i));
  return total;
}

/**
 * Scorta in casa oggi: riferimento − consumo previsto dal giorno del riferimento a ieri compreso
 * (il conteggio si considera fatto a inizio giornata). Se il riferimento è nel futuro
 * (dosi già nel portapillole preparato, dopo la migrazione delle scorte giorno per giorno)
 * vale il riferimento.
 */
export function currentStock(med: MedicationData, today: ISODate): number {
  if (med.frequencyType === "as_needed") return med.stockQty;
  if (med.stockAsOf >= today) return med.stockQty;
  const used = consumptionBetween(med, med.stockAsOf, addDays(today, -1));
  return Math.max(0, med.stockQty - used);
}

// ——— Copertura, esaurimento, stato (§5, §7) ———

export interface Forecast {
  /** scorta in casa oggi */
  stock: number;
  /** giorni consecutivi coperti da oggi; null = non si esaurisce (fine terapia coperta o oltre l'orizzonte) */
  coverageDays: number | null;
  /** primo giorno non coperto; null se non si esaurisce */
  runOutDate: ISODate | null;
  lastPack: boolean;
  ended: boolean;
  asNeeded: boolean;
  triggered: AlertType[];
  status: MedStatus;
}

export interface ForecastContext {
  plan: PlanSettings;
  today: ISODate;
}

/** Giorni consecutivi coperti partendo da `start` con la scorta `stock` (pezzi o contenitori). null = nessun esaurimento. */
function coveredDaysFrom(med: MedicationData, stock: number, start: ISODate): number | null {
  let rem = stock;
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const day = addDays(start, i);
    if (med.endDate && day > med.endDate) return null;
    const need = consumptionOn(med, day);
    if (need > rem + EPS) return i;
    rem -= need;
  }
  return null;
}

export function forecastMedication(med: MedicationData, ctx: ForecastContext): Forecast {
  const { plan, today } = ctx;
  const stock = currentStock(med, today);
  const lastPack = stock <= med.pillsPerPack + EPS;
  const ended = hasEnded(med, today);
  const asNeeded = med.frequencyType === "as_needed";
  const ordered = !!med.orderedAt;

  if (ended) {
    return { stock, coverageDays: null, runOutDate: null, lastPack, ended, asNeeded, triggered: [], status: "ok" };
  }

  if (asNeeded) {
    const triggered: AlertType[] = plan.alertLastPack && lastPack ? ["last_pack"] : [];
    const status: MedStatus = stock <= EPS ? "out" : ordered ? "ordered" : triggered.length ? "order" : "ok";
    return { stock, coverageDays: null, runOutDate: null, lastPack, ended, asNeeded, triggered, status };
  }

  // Con stock_as_of nel futuro i giorni fino a quella data sono già nel portapillole: contano come coperti.
  const from = maxDate(today, med.stockAsOf);
  const covered = coveredDaysFrom(med, stock, from);
  const coverageDays = covered === null ? null : diffDays(today, from) + covered;

  const runOutDate = coverageDays === null ? null : addDays(today, coverageDays);

  // Le soglie scattano solo se la medicina finirà davvero prima della fine della terapia.
  const triggered: AlertType[] = [];
  if (coverageDays !== null) {
    if (plan.alertUnder14 && coverageDays < 14) triggered.push("under_14");
    if (plan.alertUnder7 && coverageDays < 7) triggered.push("under_7");
    if (plan.alertLastPack && lastPack) triggered.push("last_pack");
  }

  const out = coverageDays === 0;
  const status: MedStatus = out ? "out" : ordered ? "ordered" : triggered.length ? "order" : "ok";

  return { stock, coverageDays, runOutDate, lastPack, ended, asNeeded, triggered, status };
}

/** Testo breve che spiega lo stato (sotto il dispenser). */
export function statusReason(f: Forecast, endDate: ISODate | null): string {
  if (f.ended) return endDate ? "Terapia conclusa" : "";
  if (f.status === "out") {
    return f.stock <= EPS ? "Scorta finita" : "Non basta per oggi";
  }
  if (f.status === "ordered") return "Ordinata, in arrivo";
  if (f.status === "order") {
    const onlyLastPack = f.triggered.length === 1 && f.triggered[0] === "last_pack";
    if (onlyLastPack || f.coverageDays === null) return "È rimasta l’ultima confezione";
    return `Restano ${f.coverageDays} ${daysWord(f.coverageDays)}: è ora di ordinare`;
  }
  return "";
}

/** Dopo un nuovo conteggio: lo stato "Ordinata" si toglie se la scorta è tornata sopra tutte le soglie. */
export function recountClearsOrdered(f: Forecast): boolean {
  return f.triggered.length === 0 && f.status !== "out";
}

// ——— Episodi di avviso (§8) ———

export interface OpenEpisode {
  alertType: AlertType;
  sentAt: string | null;
}

export interface AlertDecision {
  /** soglie per cui aprire un nuovo episodio */
  open: AlertType[];
  /** soglie per cui chiudere l'episodio aperto (scorta tornata sopra soglia) */
  close: AlertType[];
  /** soglie da includere nell'email di oggi */
  send: AlertType[];
}

/**
 * Per ogni soglia: quando viene superata l'avviso parte una sola volta per episodio.
 * L'episodio si chiude quando la soglia non è più superata; la volta successiva può ripartire.
 * Un medicinale "Ordinata" non genera avvisi (l'episodio resta aperto e non inviato).
 */
export function evaluateAlerts(triggered: AlertType[], ordered: boolean, open: OpenEpisode[]): AlertDecision {
  const decision: AlertDecision = { open: [], close: [], send: [] };
  for (const t of ALERT_TYPES) {
    const isTriggered = triggered.includes(t);
    const episode = open.find((e) => e.alertType === t);
    if (isTriggered && !episode) {
      decision.open.push(t);
      if (!ordered) decision.send.push(t);
    } else if (isTriggered && episode && !episode.sentAt && !ordered) {
      decision.send.push(t);
    } else if (!isTriggered && episode) {
      decision.close.push(t);
    }
  }
  return decision;
}

// ——— Calendario (§9) ———

export interface CalendarItem {
  medicationId: string;
  qty: number;
}

export interface CalendarDay {
  date: ISODate;
  slots: Record<Slot, CalendarItem[]>;
}

/** Inizio della settimana del calendario e del foglio A4: giorno di preparazione (con il promemoria acceso) o lunedì. */
export function calendarWeekStart(date: ISODate, plan: Pick<PlanSettings, "prepReminder" | "prepWeekday">): ISODate {
  return onOrBeforeWeekday(date, plan.prepReminder ? plan.prepWeekday : 1);
}

export function buildWeek(meds: (Schedule & { id: string })[], weekStart: ISODate): CalendarDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const slots = { morning: [], noon: [], evening: [] } as Record<Slot, CalendarItem[]>;
    for (const m of meds) {
      for (const slot of SLOTS) {
        const qty = slotDoseOn(m, date, slot);
        if (qty > 0) slots[slot].push({ medicationId: m.id, qty });
      }
    }
    return { date, slots };
  });
}

// ——— Riepilogo del piano ———

export interface PlanForecast<M extends MedicationData = MedicationData> {
  today: ISODate;
  items: { med: M; forecast: Forecast }[];
  /** medicine da ordinare (esaurite o sotto soglia, non ancora ordinate) */
  toOrder: M[];
  worst: MedStatus;
}

export function forecastPlan<M extends MedicationData>(
  plan: PlanSettings,
  meds: M[],
  today: ISODate,
): PlanForecast<M> {
  const ctx: ForecastContext = { plan, today };
  const items = meds
    .map((med) => ({ med, forecast: forecastMedication(med, ctx) }))
    .sort((a, b) => STATUS_RANK[a.forecast.status] - STATUS_RANK[b.forecast.status]);
  const toOrder = items
    .filter((i) => (i.forecast.status === "out" || i.forecast.status === "order") && !i.med.orderedAt)
    .map((i) => i.med);
  return {
    today,
    items,
    toOrder,
    worst: items[0]?.forecast.status ?? "ok",
  };
}
