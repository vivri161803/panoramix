// Date di calendario come stringhe "AAAA-MM-GG", senza ore né fusi.
// I calcoli usano giorni UTC interi, quindi il cambio dell'ora legale non sposta nulla;
// il fuso Europe/Rome serve solo a stabilire che giorno è "oggi".

export type ISODate = string;

export const TIME_ZONE = "Europe/Rome";
const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string") return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function toUTC(date: ISODate): number {
  const m = ISO_RE.exec(date);
  if (!m) throw new Error(`Data non valida: ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUTC(ms: number): ISODate {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Oggi nel fuso Europe/Rome. */
export function todayInRome(now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTC(toUTC(date) + days * DAY_MS);
}

/** Giorni da `from` a `to` (positivo se `to` è dopo). */
export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

/** Giorno della settimana ISO: 1 = lunedì … 7 = domenica. */
export function isoWeekday(date: ISODate): number {
  const d = new Date(toUTC(date)).getUTCDay();
  return d === 0 ? 7 : d;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

/** Ultimo giorno ≤ `date` che cade nel giorno della settimana `weekday`. */
export function onOrBeforeWeekday(date: ISODate, weekday: number): ISODate {
  const back = (isoWeekday(date) - weekday + 7) % 7;
  return addDays(date, -back);
}

/** Primo giorno ≥ `date` che cade nel giorno della settimana `weekday`. */
export function onOrAfterWeekday(date: ISODate, weekday: number): ISODate {
  const fwd = (weekday - isoWeekday(date) + 7) % 7;
  return addDays(date, fwd);
}

// ——— Formattazione in italiano ———

export const WEEKDAYS_LONG = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
export const WEEKDAYS_SHORT = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
export const WEEKDAYS_LETTER = ["L", "M", "M", "G", "V", "S", "D"];
const MONTHS_LONG = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const MONTHS_SHORT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

function parts(date: ISODate) {
  const d = new Date(toUTC(date));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: isoWeekday(date) - 1 };
}

/** "dom 8 nov" */
export function formatShort(date: ISODate): string {
  const p = parts(date);
  return `${WEEKDAYS_SHORT[p.wd]} ${p.d} ${MONTHS_SHORT[p.m]}`;
}

/** "domenica 8 novembre" */
export function formatLong(date: ISODate): string {
  const p = parts(date);
  return `${WEEKDAYS_LONG[p.wd]} ${p.d} ${MONTHS_LONG[p.m]}`;
}

/** "8 novembre 2026" */
export function formatDayMonthYear(date: ISODate): string {
  const p = parts(date);
  return `${p.d} ${MONTHS_LONG[p.m]} ${p.y}`;
}

/** "8 novembre" */
export function formatDayMonth(date: ISODate): string {
  const p = parts(date);
  return `${p.d} ${MONTHS_LONG[p.m]}`;
}

/** "08/11/2026" */
export function formatNumeric(date: ISODate): string {
  const p = parts(date);
  return `${String(p.d).padStart(2, "0")}/${String(p.m + 1).padStart(2, "0")}/${p.y}`;
}

/** "9 – 15 novembre 2026" oppure "28 dic – 3 gen 2027" */
export function formatRange(from: ISODate, to: ISODate): string {
  const a = parts(from);
  const b = parts(to);
  if (a.y === b.y && a.m === b.m) return `${a.d} – ${b.d} ${MONTHS_LONG[b.m]} ${b.y}`;
  if (a.y === b.y) return `${a.d} ${MONTHS_SHORT[a.m]} – ${b.d} ${MONTHS_SHORT[b.m]} ${b.y}`;
  return `${a.d} ${MONTHS_SHORT[a.m]} ${a.y} – ${b.d} ${MONTHS_SHORT[b.m]} ${b.y}`;
}

/** "Oggi", "Domani", "Ieri" oppure "domenica 8 novembre" */
export function formatRelative(date: ISODate, today: ISODate): string {
  const diff = diffDays(today, date);
  if (diff === 0) return "Oggi";
  if (diff === 1) return "Domani";
  if (diff === -1) return "Ieri";
  return capitalize(formatLong(date));
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Ora "10:42" nel fuso di Roma per un timestamp. */
export function formatTimeRome(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Giorno di calendario (Roma) di un timestamp. */
export function dateOfTimestampRome(iso: string): ISODate {
  return todayInRome(new Date(iso));
}
