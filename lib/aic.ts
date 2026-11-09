// Codice AIC: lettura dai codici a barre della scatola e dati del modulo a partire dall'anagrafica
// AIFA. Funzioni pure, usate dallo scanner (client) e da lookupAic (server). Test: tests/aic.test.ts.

import { doseUnitsFromDescription, requiresPrescription } from "@/scripts/aifa/parse.mjs";

export type ScanFormat = "data_matrix" | "code_39" | "code_128" | "ean_13" | "manual" | string;

export interface ScanResult {
  aic?: string;
  gtin?: string;
  /** datamatrix: GS1 DataMatrix (AI 716); bollino: Code 39 con "A"; numero: 9 cifre senza "A" */
  source: "datamatrix" | "bollino" | "numero" | "altro";
  /** messaggio da mostrare se il codice non contiene l'AIC */
  message?: string;
}

export const NO_AIC_MESSAGE = "Questo codice non contiene l’AIC: scrivi le 9 cifre che trovi sotto il codice a barre.";
/** Il bollino ha due codici: quello con la A è l'AIC, l'altro è il numero progressivo. */
export const SERIAL_HINT = "Codice non trovato. Sul bollino ci sono due codici a barre: inquadra quello che inizia con la A.";

const GS = "\x1d";

// Application Identifier GS1: lunghezza fissa (cifre del valore) o variabile (fino a GS).
// L'AIC è nell'AI 716 "NHRN Italy AIC" (DM 6 marzo 2025, GU n. 84 del 10 aprile 2025).
const FIXED: Record<string, number> = { "00": 18, "01": 14, "02": 14, "11": 6, "12": 6, "13": 6, "15": 6, "16": 6, "17": 6, "20": 2 };
const VARIABLE_3 = new Set(["240", "241", "710", "711", "712", "713", "714", "715", "716"]);
const VARIABLE_2 = new Set(["10", "21", "22", "30", "37", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99"]);

/** Separa una stringa GS1 (senza identificatore di simbologia) negli Application Identifier. */
export function parseGs1(data: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < data.length) {
    if (data[i] === GS) {
      i++;
      continue;
    }
    const ai2 = data.slice(i, i + 2);
    const ai3 = data.slice(i, i + 3);
    if (FIXED[ai2] !== undefined) {
      const len = FIXED[ai2];
      const v = data.slice(i + 2, i + 2 + len);
      if (v.length !== len) return null;
      out[ai2] = v;
      i += 2 + len;
    } else if (VARIABLE_3.has(ai3) || VARIABLE_2.has(ai2)) {
      const ai = VARIABLE_3.has(ai3) ? ai3 : ai2;
      const start = i + ai.length;
      let end = data.indexOf(GS, start);
      // alcuni lettori perdono il GS: l'AIC ha comunque 9 cifre
      if (ai === "716" && (end < 0 || end - start > 9) && /^\d{9}/.test(data.slice(start))) end = start + 9;
      if (end < 0) end = data.length;
      out[ai] = data.slice(start, end);
      i = end;
    } else {
      return Object.keys(out).length ? out : null;
    }
  }
  return out;
}

/** Legge il codice inquadrato (o scritto): AIC se c'è, altrimenti un messaggio. */
export function parseScan(raw: string, format: ScanFormat = "manual"): ScanResult {
  let s = String(raw ?? "").replace(/\r|\n/g, "").trim();
  // identificatori di simbologia: ]d2 DataMatrix GS1, ]C1 GS1-128, ]Q3 QR GS1
  const symbology = s.match(/^\](d2|C1|Q3|e0)/);
  if (symbology) s = s.slice(3);
  // alcuni lettori scrivono il GS come testo
  s = s.replace(/<GS>|\{GS\}|\\x1d/gi, GS);

  const gs1Likely = !!symbology || s.includes(GS) || format === "data_matrix" || (/^01\d{14}/.test(s) && s.length > 16);
  if (gs1Likely) {
    const ais = parseGs1(s);
    if (ais?.["716"] && /^\d{9}$/.test(ais["716"])) return { aic: ais["716"], gtin: ais["01"], source: "datamatrix" };
    if (ais) return { gtin: ais["01"], source: "altro", message: NO_AIC_MESSAGE };
  }

  const compact = s.replace(/[\s.-]/g, "");
  if (format !== "ean_13") {
    const withA = compact.match(/^A(\d{9})$/i);
    if (withA) return { aic: withA[1], source: "bollino" };
    if (/^\d{9}$/.test(compact)) return { aic: compact, source: "numero" };
  }
  return { source: "altro", message: NO_AIC_MESSAGE };
}

// ——— Dati AIFA → modulo ———

const SMALL_WORDS = new Set(["e", "di", "da", "del", "della", "con", "per", "in", "a", "al"]);

/** "AMLODIPINA E VALSARTAN DOC" → "Amlodipina e Valsartan Doc"; parole con cifre restano così. */
export function titleCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (/\d/.test(w) ? w.toUpperCase() : i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** "ACIDO ACETILSALICILICO" → "Acido acetilsalicilico" */
export function sentenceCase(s: string): string {
  const t = s.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const UNIT_ABBR: Record<string, string> = {
  milligrammi: "mg",
  microgrammi: "µg",
  grammi: "g",
  "milligram(s)/millilitre": "mg/ml",
  "microgram(s)/millilitre": "µg/ml",
  "milligram(s)/gram": "mg/g",
  "microgram(s)/gram": "µg/g",
  "microgram(s)/hour": "µg/h",
  "milligram(s)/24 hours": "mg/24 h",
  "microgram(s)/24 hours": "µg/24 h",
  "international unit(s)": "UI",
  "international unit(s)/milli#": "UI/ml",
  "unit(s)/millilitre": "U/ml",
  unita: "U",
  "million units": "milioni U",
  percent: "%",
  "gram percent": "%",
  millilitre: "ml",
  litro: "l",
  "gram(s)/litre": "g/l",
  "millimole(s)/millilitre": "mmol/ml",
  "millimole(s)/litre": "mmol/l",
  milliequivalenti: "mEq",
};

export function abbrUnit(unit: string | null): string {
  if (!unit) return "";
  const k = unit.trim().toLowerCase();
  return UNIT_ABBR[k] ?? k;
}

/** 2.5 → "2,5"; 25000 → "25.000" */
export function formatAmount(n: number): string {
  return n.toLocaleString("it-IT", { maximumFractionDigits: 3 });
}

export interface IngredientRow {
  ingredient: string;
  qty: number | string | null;
  unit: string | null;
  position: number;
}

export const STRENGTH_MAX = 40;

const DESC_UNIT: Record<string, string> = { mg: "mg", mcg: "µg", g: "g", ui: "UI", "u.i.": "UI", ml: "ml", "%": "%" };

/** Dosaggio in testa alla descrizione: "<5 MG COMPRESSE> 14 …" → "5 mg", "10 MG/160 MG …" → "10 mg/160 mg". */
export function strengthFromDescription(desc: string): string {
  // quantità + unità, eventualmente "per ml/g" (100 MG/ML), ripetute con / o + (10 MG/160 MG)
  const m = desc.match(/^[\s<"']*((?:\d+(?:[.,]\d+)?\s*(?:MG|MCG|U\.I\.|UI|ML|G|%)(?:\s*\/\s*(?:ML|G)(?![A-Z]))?(?![A-Z])\s*[/+]?\s*)+)/i);
  if (!m) return "";
  return m[1]
    .trim()
    .replace(/[/+]$/, "")
    .replace(/\s*([/+])\s*/g, "$1")
    .replace(/(\d)\s*(MG|MCG|U\.I\.|UI|ML|G|%)/gi, (_, d: string, u: string) => (u === "%" ? `${d}%` : `${d} ${DESC_UNIT[u.toLowerCase()]}`))
    .replace(/\/(ML|G)\b/gi, (_, u: string) => `/${u.toLowerCase()}`)
    .slice(0, STRENGTH_MAX);
}

/**
 * Dosaggio per principio attivo, al massimo 40 caratteri:
 * "Ramipril 5 mg", "Amlodipina 10 mg + Valsartan 160 mg". Se non ci sta, solo le quantità
 * ("10 mg + 160 mg"); se mancano i dati, ricavato dalla descrizione della confezione.
 */
export function buildStrength(ingredients: IngredientRow[], description: string): string {
  const rows = [...ingredients].sort((a, b) => a.position - b.position);
  const full = rows.filter((r) => r.qty !== null && r.qty !== "" && Number(r.qty) > 0);
  if (full.length && full.length === rows.length) {
    const amounts = full.map((r) => `${formatAmount(Number(r.qty))} ${abbrUnit(r.unit)}`.trim());
    const named = full.map((r, i) => `${sentenceCase(r.ingredient)} ${amounts[i]}`).join(" + ");
    if (named.length <= STRENGTH_MAX) return named;
    const bare = amounts.join(" + ");
    if (bare.length <= STRENGTH_MAX) return bare;
  }
  const fromDesc = strengthFromDescription(description);
  if (fromDesc) return fromDesc;
  // nessun dosaggio: almeno il principio attivo, se c'è e ci sta
  const names = rows.map((r) => sentenceCase(r.ingredient)).join(" + ");
  return names.length <= STRENGTH_MAX ? names : "";
}

export interface AifaPackRow {
  aic: string;
  name: string;
  pack_description: string;
  form: string;
  atc_code: string | null;
  dose_units: number | null;
  rx_regime: string | null;
}

export interface AicLookup {
  aic: string;
  name: string;
  strength: string;
  pills_per_pack: number | null;
  atc_code: string | null;
  /** forma suggerita: capsula se la forma farmaceutica è una capsula */
  shape: "capsula" | null;
  /** solo se il file AIFA ha il regime di fornitura */
  requires_prescription: boolean | null;
  /** descrizione della confezione, per il riquadro "Dati presi da AIFA" */
  pack_description: string;
}

/** Dati del modulo a partire da una confezione AIFA e dai suoi principi attivi. */
export function packToForm(pack: AifaPackRow, ingredients: IngredientRow[]): AicLookup {
  return {
    aic: pack.aic,
    name: titleCase(pack.name).slice(0, 80),
    strength: buildStrength(ingredients, pack.pack_description),
    pills_per_pack: pack.dose_units ?? doseUnitsFromDescription(pack.pack_description),
    atc_code: pack.atc_code,
    shape: /capsul/i.test(pack.form) ? "capsula" : null,
    requires_prescription: requiresPrescription(pack.rx_regime),
    pack_description: pack.pack_description,
  };
}
