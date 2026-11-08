// Logica di dominio di Panoramix, senza dipendenze dal database.
// Riferimento: specifica funzionale §4–§8.

import {
  addDays,
  diffDays,
  isoWeekday,
  maxDate,
  onOrAfterWeekday,
  onOrBeforeWeekday,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
  type ISODate,
} from "./dates";

// ——— Tipi ———

export type FrequencyType = "daily" | "weekdays" | "every_n_days" | "cycle" | "as_needed";
export type StockMode = "daily" | "weekly";
export type Slot = "morning" | "noon" | "evening";
export type AlertType = "under_14" | "under_7" | "last_pack";
export type MedStatus = "out" | "order" | "ordered" | "ok";

export const SLOTS: Slot[] = ["morning", "noon", "evening"];
export const ALERT_TYPES: AlertType[] = ["under_14", "under_7", "last_pack"];
export const STATUS_RANK: Record<MedStatus, number> = { out: 0, order: 1, ordered: 2, ok: 3 };

export interface Schedule {
  doseMorning: number;
  doseNoon: number;
  doseEvening: number;
  frequencyType: FrequencyType;
  /** giorni ISO, 1 = lunedì … 7 = domenica */
  weekdays: number[];
  intervalDays: number | null;
  cycleOn: number | null;
  cycleOff: number | null;
  startDate: ISODate;
  endDate: ISODate | null;
}

export interface MedicationData extends Schedule {
  id: string;
  pillsPerPack: number;
  /** conteggio di riferimento */
  stockQty: number;
  stockAsOf: ISODate;
  orderedAt: string | null;
}

export interface PlanSettings {
  stockMode: StockMode;
  /** giorno ISO della preparazione del portapillole */
  prepWeekday: number;
  /** giorno da cui vale la modalità attuale */
  modeSince: ISODate;
  alertUnder14: boolean;
  alertUnder7: boolean;
  alertLastPack: boolean;
}

export interface PrepRunData {
  id: string;
  weekStart: ISODate;
  deductions: Record<string, number>;
  undoneAt: string | null;
}

const EPS = 1e-9;
/** Oltre questo orizzonte la scorta si considera "non in esaurimento". */
export const HORIZON_DAYS = 3 * 366;

// ——— Dosi ———

export function totalPerDose(s: Pick<Schedule, "doseMorning" | "doseNoon" | "doseEvening">): number {
  return s.doseMorning + s.doseNoon + s.doseEvening;
}

export function slotDose(s: Schedule, slot: Slot): number {
  return slot === "morning" ? s.doseMorning : slot === "noon" ? s.doseNoon : s.doseEvening;
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
  return isScheduledOn(s, date) ? totalPerDose(s) : 0;
}

export function slotDoseOn(s: Schedule, date: ISODate, slot: Slot): number {
  return isScheduledOn(s, date) ? slotDose(s, slot) : 0;
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

export function pillsWord(n: number): string {
  return Math.abs(n - 1) < EPS ? "compressa" : "compresse";
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

/** "1 al mattino e ½ alla sera" */
export function dosesPhrase(s: Schedule): string {
  return joinList(SLOTS.filter((k) => slotDose(s, k) > 0).map((k) => `${formatQty(slotDose(s, k))} ${SLOT_PHRASE[k]}`));
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
 * Scorta in casa oggi.
 * Giorno per giorno: riferimento − dosi previste dal giorno del riferimento a ieri compreso
 * (il conteggio si considera fatto a inizio giornata).
 * Portapillole settimanale: le compresse escono solo con la preparazione, quindi vale il riferimento.
 */
export function currentStock(med: MedicationData, mode: StockMode, today: ISODate): number {
  if (mode === "weekly" || med.frequencyType === "as_needed") return med.stockQty;
  if (med.stockAsOf >= today) return med.stockQty;
  const used = dosesBetween(med, med.stockAsOf, addDays(today, -1));
  return Math.max(0, med.stockQty - used);
}

/** Preparazioni attive che valgono per la modalità attuale, dalla più recente. */
function relevantRuns(plan: PlanSettings, runs: PrepRunData[]): PrepRunData[] {
  return runs
    .filter((r) => !r.undoneAt && addDays(r.weekStart, 6) >= plan.modeSince)
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}

export function latestActiveRun(plan: PlanSettings, runs: PrepRunData[]): PrepRunData | null {
  return relevantRuns(plan, runs)[0] ?? null;
}

/**
 * Prossima preparazione dovuta (modalità settimanale).
 * Dopo una preparazione: il giorno di preparazione successivo.
 * Senza preparazioni: il primo giorno di preparazione da quando vale la modalità
 * (si assume che il portapillole fosse già pieno fino a quel giorno).
 * Può essere nel passato: in quel caso la preparazione è in ritardo.
 */
export function nextPrepDue(plan: PlanSettings, runs: PrepRunData[]): ISODate {
  const last = latestActiveRun(plan, runs);
  if (last) return onOrAfterWeekday(addDays(last.weekStart, 1), plan.prepWeekday);
  return onOrAfterWeekday(plan.modeSince, plan.prepWeekday);
}

/**
 * Settimana che verrebbe preparata premendo "Portapillole preparato" oggi:
 * quella dovuta, oppure — se si è saltata più di una settimana — l'ultima iniziata.
 */
export function prepWeekStart(plan: PlanSettings, runs: PrepRunData[], today: ISODate): ISODate {
  const due = nextPrepDue(plan, runs);
  if (due > today) return due;
  return maxDate(due, onOrBeforeWeekday(today, plan.prepWeekday));
}

export interface PrepItem {
  medicationId: string;
  need: number;
  take: number;
  /** compresse che mancano per la settimana */
  missing: number;
}

/** Calcola cosa togliere dalle scorte per i 7 giorni da `weekStart`. */
export function computePrep(meds: MedicationData[], weekStart: ISODate): PrepItem[] {
  const weekEnd = addDays(weekStart, 6);
  return meds
    .filter((m) => m.frequencyType !== "as_needed")
    .map((m) => {
      const need = dosesBetween(m, weekStart, weekEnd);
      const take = Math.min(m.stockQty, need);
      return { medicationId: m.id, need, take, missing: Math.max(0, need - take) };
    })
    .filter((i) => i.need > 0);
}

/** Applica una preparazione alle scorte (versione pura di apply_prep). */
export function applyPrep(stock: Record<string, number>, items: PrepItem[]): Record<string, number> {
  const out = { ...stock };
  for (const i of items) out[i.medicationId] = (out[i.medicationId] ?? 0) - i.take;
  return out;
}

/** Annulla una preparazione: restituisce esattamente quanto tolto. */
export function undoPrep(stock: Record<string, number>, deductions: Record<string, number>): Record<string, number> {
  const out = { ...stock };
  for (const [id, take] of Object.entries(deductions)) if (id in out) out[id] += take;
  return out;
}

// ——— Copertura, esaurimento, stato (§5, §7) ———

export interface Forecast {
  /** scorta in casa oggi */
  stock: number;
  /** giorni consecutivi coperti da oggi; null = non si esaurisce (fine terapia coperta o oltre l'orizzonte) */
  coverageDays: number | null;
  /** primo giorno non coperto; null se non si esaurisce */
  runOutDate: ISODate | null;
  /** solo modalità settimanale: giorni coperti dalle scorte in casa a partire dalla prossima preparazione */
  homeDays: number | null;
  /** solo modalità settimanale: compresse necessarie per la prossima preparazione */
  nextPrepNeed: number | null;
  lastPack: boolean;
  ended: boolean;
  asNeeded: boolean;
  triggered: AlertType[];
  status: MedStatus;
}

export interface ForecastContext {
  plan: PlanSettings;
  today: ISODate;
  /** solo modalità settimanale */
  nextPrep?: ISODate;
}

/** Giorni consecutivi coperti partendo da `start` con `stock` compresse. null = nessun esaurimento. */
function coveredDaysFrom(s: Schedule, stock: number, start: ISODate): number | null {
  let rem = stock;
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const day = addDays(start, i);
    if (s.endDate && day > s.endDate) return null;
    const need = dosesOn(s, day);
    if (need > rem + EPS) return i;
    rem -= need;
  }
  return null;
}

export function forecastMedication(med: MedicationData, ctx: ForecastContext): Forecast {
  const { plan, today } = ctx;
  const weekly = plan.stockMode === "weekly";
  const stock = currentStock(med, plan.stockMode, today);
  const lastPack = stock <= med.pillsPerPack + EPS;
  const ended = hasEnded(med, today);
  const asNeeded = med.frequencyType === "as_needed";
  const ordered = !!med.orderedAt;

  if (ended) {
    return { stock, coverageDays: null, runOutDate: null, homeDays: null, nextPrepNeed: null, lastPack, ended, asNeeded, triggered: [], status: "ok" };
  }

  if (asNeeded) {
    const triggered: AlertType[] = plan.alertLastPack && lastPack ? ["last_pack"] : [];
    const status: MedStatus = stock <= EPS ? "out" : ordered ? "ordered" : triggered.length ? "order" : "ok";
    return { stock, coverageDays: null, runOutDate: null, homeDays: null, nextPrepNeed: null, lastPack, ended, asNeeded, triggered, status };
  }

  let coverageDays: number | null;
  let homeDays: number | null = null;
  let nextPrepNeed: number | null = null;

  if (weekly) {
    const nextPrep = ctx.nextPrep ?? today;
    // giorni già nel portapillole (negativo se la preparazione è in ritardo)
    const inPillbox = diffDays(today, nextPrep);
    homeDays = coveredDaysFrom(med, stock, nextPrep);
    coverageDays = homeDays === null ? null : Math.max(0, inPillbox + homeDays);
    nextPrepNeed = dosesBetween(med, nextPrep, addDays(nextPrep, 6));
  } else {
    coverageDays = coveredDaysFrom(med, stock, today);
  }

  const runOutDate = coverageDays === null ? null : addDays(today, coverageDays);

  // Le soglie scattano solo se la medicina finirà davvero prima della fine della terapia.
  const triggered: AlertType[] = [];
  if (coverageDays !== null) {
    if (plan.alertUnder14 && coverageDays < 14) triggered.push("under_14");
    if (plan.alertUnder7 && coverageDays < 7) triggered.push("under_7");
    if (plan.alertLastPack && lastPack) triggered.push("last_pack");
  }

  const notEnoughForPrep = weekly && nextPrepNeed !== null && nextPrepNeed > stock + EPS;
  const out = coverageDays === 0 || notEnoughForPrep;
  const status: MedStatus = out ? "out" : ordered ? "ordered" : triggered.length ? "order" : "ok";

  return { stock, coverageDays, runOutDate, homeDays, nextPrepNeed, lastPack, ended, asNeeded, triggered, status };
}

/** Testo breve che spiega lo stato (sotto il dispenser). */
export function statusReason(f: Forecast, mode: StockMode, endDate: ISODate | null): string {
  if (f.ended) return endDate ? "Terapia conclusa" : "";
  if (f.status === "out") {
    if (f.nextPrepNeed !== null && f.nextPrepNeed > f.stock + EPS && f.coverageDays !== 0) {
      return `Ne mancano ${formatQty(f.nextPrepNeed - f.stock)} per la prossima preparazione`;
    }
    return f.stock <= EPS ? "Scorta finita" : "Non basta per oggi";
  }
  if (f.status === "ordered") return "Ordinata, in arrivo";
  if (f.status === "order") {
    const onlyLastPack = f.triggered.length === 1 && f.triggered[0] === "last_pack";
    if (onlyLastPack || f.coverageDays === null) return "È rimasta l’ultima confezione";
    if (mode === "weekly" && f.homeDays !== null) {
      const after = Math.max(0, f.homeDays - 7);
      return `Dopo la preparazione restano ${after} ${daysWord(after)}`;
    }
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

/** Inizio della settimana del calendario: giorno di preparazione (settimanale) o lunedì. */
export function calendarWeekStart(date: ISODate, plan: Pick<PlanSettings, "stockMode" | "prepWeekday">): ISODate {
  return onOrBeforeWeekday(date, plan.stockMode === "weekly" ? plan.prepWeekday : 1);
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
  /** solo modalità settimanale */
  nextPrep: ISODate | null;
  prepOverdue: boolean;
  latestRun: PrepRunData | null;
  /** settimana che si preparerebbe premendo ora il pulsante */
  prepWeek: ISODate | null;
  /** cosa si toglierebbe premendo ora il pulsante */
  prepPreview: PrepItem[];
  items: { med: M; forecast: Forecast }[];
  /** medicine da ordinare (esaurite o sotto soglia, non ancora ordinate) */
  toOrder: M[];
  worst: MedStatus;
}

export function forecastPlan<M extends MedicationData>(
  plan: PlanSettings,
  meds: M[],
  runs: PrepRunData[],
  today: ISODate,
): PlanForecast<M> {
  const weekly = plan.stockMode === "weekly";
  const nextPrep = weekly ? nextPrepDue(plan, runs) : null;
  const ctx: ForecastContext = { plan, today, nextPrep: nextPrep ?? undefined };
  const items = meds
    .map((med) => ({ med, forecast: forecastMedication(med, ctx) }))
    .sort((a, b) => STATUS_RANK[a.forecast.status] - STATUS_RANK[b.forecast.status]);
  const prepWeek = weekly ? prepWeekStart(plan, runs, today) : null;
  const active = items.filter((i) => !i.forecast.ended).map((i) => i.med);
  const toOrder = items
    .filter((i) => (i.forecast.status === "out" || i.forecast.status === "order") && !i.med.orderedAt)
    .map((i) => i.med);
  return {
    today,
    nextPrep,
    prepOverdue: !!nextPrep && nextPrep < today,
    latestRun: weekly ? latestActiveRun(plan, runs) : null,
    prepWeek,
    prepPreview: prepWeek ? computePrep(active, prepWeek) : [],
    items,
    toOrder,
    worst: items[0]?.forecast.status ?? "ok",
  };
}
