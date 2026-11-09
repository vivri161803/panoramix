import { describe, expect, it } from "vitest";
import { buildStrength, NO_AIC_MESSAGE, packToForm, parseGs1, parseScan, strengthFromDescription, titleCase } from "@/lib/aic";
import { SAMPLE_INGREDIENTS, SAMPLE_PACKS } from "./helpers/aifa-sample";

const GS = "\x1d";
// GS1 DataMatrix come lo prevede il DM 6 marzo 2025: GTIN, scadenza, lotto, seriale, AIC (AI 716)
const DM = `0108012345678904${"17"}270331${"10"}LOTTO42${GS}21ABC123XYZ${GS}716027161064`;

describe("parseScan · DataMatrix GS1", () => {
  it("legge l'AIC dall'AI 716, con e senza identificatore ]d2", () => {
    expect(parseScan(`]d2${DM}`, "data_matrix")).toEqual({ aic: "027161064", gtin: "08012345678904", source: "datamatrix" });
    expect(parseScan(DM, "data_matrix")).toMatchObject({ aic: "027161064", source: "datamatrix" });
  });

  it("AI 716 in mezzo, chiuso da GS", () => {
    const s = `]d20108012345678904716050238118${GS}17270331${"10"}L1${GS}21SN99`;
    expect(parseScan(s, "data_matrix")).toMatchObject({ aic: "050238118" });
  });

  it("lettore che perde il GS dopo l'AIC", () => {
    expect(parseScan("010801234567890471602716106417270331", "data_matrix")).toMatchObject({ aic: "027161064" });
  });

  it("GS scritto come testo", () => {
    expect(parseScan(`0108012345678904<GS>716027161064`, "data_matrix")).toMatchObject({ aic: "027161064" });
  });

  it("DataMatrix senza AIC: messaggio", () => {
    const r = parseScan(`]d20108012345678904172703311010LOTTO${GS}21SN`, "data_matrix");
    expect(r).toEqual({ gtin: "08012345678904", source: "altro", message: NO_AIC_MESSAGE });
  });

  it("parseGs1 separa i campi", () => {
    expect(parseGs1(DM)).toEqual({ "01": "08012345678904", "17": "270331", "10": "LOTTO42", "21": "ABC123XYZ", "716": "027161064" });
  });
});

describe("parseScan · bollino e codice scritto", () => {
  it("bollino con la A", () => {
    expect(parseScan("A027161064", "code_39")).toEqual({ aic: "027161064", source: "bollino" });
    expect(parseScan("a027161064", "code_39")).toMatchObject({ aic: "027161064" });
  });

  it("9 cifre senza A (può essere il numero progressivo)", () => {
    expect(parseScan("027161064", "code_39")).toEqual({ aic: "027161064", source: "numero" });
    expect(parseScan(" 027 161 064 ")).toMatchObject({ aic: "027161064" });
  });

  it("codici non validi", () => {
    expect(parseScan("8012345678904", "ean_13")).toEqual({ source: "altro", message: NO_AIC_MESSAGE });
    expect(parseScan("12345", "code_128")).toMatchObject({ source: "altro" });
    expect(parseScan("A12345678", "code_39")).toMatchObject({ source: "altro" });
    expect(parseScan("", "manual")).toMatchObject({ source: "altro" });
  });
});

describe("dosaggio per il modulo", () => {
  it("un principio attivo", () => {
    expect(buildStrength([{ ingredient: "RAMIPRIL", qty: 5, unit: "milligrammi", position: 1 }], "")).toBe("Ramipril 5 mg");
    expect(buildStrength([{ ingredient: "ACIDO ACETILSALICILICO", qty: "100", unit: "milligrammi", position: 1 }], "")).toBe("Acido acetilsalicilico 100 mg");
    expect(buildStrength([{ ingredient: "RAMIPRIL", qty: 2.5, unit: "milligrammi", position: 1 }], "")).toBe("Ramipril 2,5 mg");
    expect(buildStrength([{ ingredient: "COLECALCIFEROLO", qty: 25000, unit: "international unit(s)", position: 1 }], "")).toBe("Colecalciferolo 25.000 UI");
  });

  it("più principi attivi, nell'ordine del file", () => {
    const combo = [
      { ingredient: "VALSARTAN", qty: 80, unit: "milligrammi", position: 2 },
      { ingredient: "AMLODIPINA", qty: 5, unit: "milligrammi", position: 1 },
    ];
    expect(buildStrength(combo, "")).toBe("Amlodipina 5 mg + Valsartan 80 mg");
  });

  it("troppo lungo: solo le quantità", () => {
    const long = [
      { ingredient: "OLMESARTAN MEDOXOMIL", qty: 40, unit: "milligrammi", position: 1 },
      { ingredient: "AMLODIPINA BESILATO", qty: 10, unit: "milligrammi", position: 2 },
      { ingredient: "IDROCLOROTIAZIDE", qty: 25, unit: "milligrammi", position: 3 },
    ];
    const s = buildStrength(long, "");
    expect(s).toBe("40 mg + 10 mg + 25 mg");
    expect(s.length).toBeLessThanOrEqual(40);
  });

  it("dati mancanti: dalla descrizione della confezione", () => {
    expect(buildStrength([{ ingredient: "PARACETAMOLO", qty: null, unit: null, position: 1 }], "500 MG COMPRESSE-10 COMPRESSE")).toBe("500 mg");
    expect(buildStrength([], "<5 MG COMPRESSE> 14 COMPRESSE IN BLISTER PVC/AL")).toBe("5 mg");
    expect(buildStrength([], "10 MG/160 MG COMPRESSE RIVESTITE CON FILM- 28 COMPRESSE")).toBe("10 mg/160 mg");
    expect(buildStrength([{ ingredient: "PARACETAMOLO", qty: null, unit: null, position: 1 }], "100 mg/ml gocce orali")).toBe("100 mg/ml");
    expect(buildStrength([{ ingredient: "SENNA FOGLIA", qty: null, unit: null, position: 1 }], "10 BUSTINE FILTRO G 2")).toBe("Senna foglia");
    expect(strengthFromDescription(" 20% (200G/L) SOLUZIONE")).toBe("20%");
  });
});

describe("packToForm", () => {
  const ing = (aic: string) => SAMPLE_INGREDIENTS.filter((i) => i.aic === aic);
  const pack = (aic: string) => SAMPLE_PACKS.find((p) => p.aic === aic)!;

  it("compila nome, dosaggio, compresse, ATC, ricetta", () => {
    expect(packToForm(pack("044091039"), ing("044091039"))).toEqual({
      aic: "044091039",
      name: "Amlodipina e Valsartan Doc",
      strength: "Amlodipina 10 mg + Valsartan 160 mg",
      pills_per_pack: 28,
      atc_code: "C09DB01",
      shape: null,
      requires_prescription: true,
      pack_description: pack("044091039").pack_description,
    });
  });

  it("capsule e compresse dalla descrizione se manca il numero", () => {
    expect(packToForm({ ...pack("026783098"), dose_units: null }, ing("026783098"))).toMatchObject({ shape: "capsula", pills_per_pack: 14 });
  });

  it("nomi in maiuscolo diventano leggibili", () => {
    expect(titleCase("RAMIPRIL ALTER")).toBe("Ramipril Alter");
    expect(titleCase("TACHIPIRINA 1000")).toBe("Tachipirina 1000");
  });
});
