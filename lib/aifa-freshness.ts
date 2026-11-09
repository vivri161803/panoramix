// Dati AIFA fermi da troppo tempo? Il controllo del mattino lo mette nell'email tecnica.
// Se un import non va, le tabelle restano quelle dell'ultimo import riuscito (scripts/import-aifa.mjs):
// qui ci si accorge che il file non arriva più, o non si legge più, da oltre una settimana.

import { formatDayMonthYear } from "./dates";

export const AIFA_SOURCES = ["confezioni", "principi_attivi", "atc", "carenze", "trasparenza"] as const;
export type AifaSource = (typeof AIFA_SOURCES)[number];

export const AIFA_SOURCE_LABEL: Record<AifaSource, string> = {
  confezioni: "anagrafica delle confezioni",
  principi_attivi: "principi attivi",
  atc: "anagrafica ATC",
  carenze: "farmaci carenti",
  trasparenza: "lista di trasparenza",
};

/** Giorni senza import riuscito oltre i quali parte l'avviso. */
export const AIFA_STALE_DAYS = 7;

export interface AifaImportRow {
  source: string;
  status: "running" | "ok" | "skipped" | "failed";
  finished_at: string | null;
  error: string | null;
}

const DAY_MS = 86_400_000;

/** Messaggi per l'email tecnica: una riga per sorgente ferma da più di AIFA_STALE_DAYS giorni. */
export function staleAifaProblems(rows: AifaImportRow[], now: Date): string[] {
  if (!rows.length) {
    return ["Nessun import dei dati AIFA: lancia a mano il workflow “Import dati AIFA” su GitHub (Actions → Run workflow)."];
  }
  const problems: string[] = [];
  for (const source of AIFA_SOURCES) {
    const mine = rows.filter((r) => r.source === source && r.finished_at).sort((a, b) => (a.finished_at! < b.finished_at! ? 1 : -1));
    const lastGood = mine.find((r) => r.status === "ok" || r.status === "skipped");
    const lastGoodAt = lastGood ? new Date(lastGood.finished_at!) : null;
    if (lastGoodAt && now.getTime() - lastGoodAt.getTime() <= AIFA_STALE_DAYS * DAY_MS) continue;
    const lastFail = mine.find((r) => r.status === "failed" && (!lastGoodAt || new Date(r.finished_at!) > lastGoodAt));
    const since = lastGoodAt
      ? `da ${Math.floor((now.getTime() - lastGoodAt.getTime()) / DAY_MS)} giorni (ultimo import riuscito il ${formatDayMonthYear(lastGoodAt.toISOString().slice(0, 10))})`
      : "da più di due mesi o mai";
    const why = lastFail?.error ? ` Ultimo errore: ${lastFail.error.slice(0, 300).replace(/[.\s]+$/, "")}.` : " Il workflow non risulta partito.";
    problems.push(
      `Dati AIFA (${AIFA_SOURCE_LABEL[source]}) non aggiornati ${since}.${why} Le tabelle restano quelle dell'ultimo import riuscito finché il file non torna leggibile.`,
    );
  }
  return problems;
}
