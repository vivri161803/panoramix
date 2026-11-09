import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  aic9,
  checkShrink,
  decode,
  doseUnitsFromDescription,
  HeaderMismatchError,
  itDate,
  itWordsDate,
  num,
  parseCsv,
  parseSource,
  requiresPrescription,
  SOURCES,
} from "../scripts/aifa/parse.mjs";

const FILES = {
  confezioni: "confezioni_fornitura.csv",
  principi_attivi: "PA_confezioni.csv",
  atc: "atc.csv",
  carenze: "elenco_medicinali_carenti.csv",
  trasparenza: "Lista_farmaci_equivalenti.csv",
} as const;
type Source = keyof typeof FILES;

function fixture(name: Source): string {
  const bytes = readFileSync(new URL(`./fixtures/aifa/${FILES[name]}`, import.meta.url));
  return decode(bytes, SOURCES[name].encoding);
}

describe("parseCsv", () => {
  it("gestisce virgolette raddoppiate, a capo nei campi e terminatori misti", () => {
    const rows = [...parseCsv('a;"b ""c"" d";e\r\n"x\ny";2\rz;;\n')];
    expect(rows).toEqual([
      ["a", 'b "c" d', "e"],
      ["x\ny", "2"],
      ["z", "", ""],
    ]);
  });
});

describe("normalizzatori", () => {
  it("AIC sempre a 9 cifre", () => {
    expect(aic9("27161064")).toBe("027161064");
    expect(aic9("4155024")).toBe("004155024");
    expect(aic9("A027161064")).toBe("027161064");
    expect(aic9(" 045348036 ")).toBe("045348036");
    expect(aic9("12345678901")).toBeNull();
    expect(aic9("N.D.")).toBeNull();
  });

  it("numeri con virgola, punto ed euro", () => {
    expect(num("5,63 €")).toBe(5.63);
    expect(num(" 0.0")).toBe(0);
    expect(num("1.234,50 €")).toBe(1234.5);
    expect(num("160")).toBe(160);
    expect(num("")).toBeNull();
    expect(num("N.D.")).toBeNull();
  });

  it("date in cifre e in parole", () => {
    expect(itDate("05/11/2026")).toBe("2026-11-05");
    expect(itDate("31/02/2026")).toBeNull();
    expect(itDate("")).toBeNull();
    expect(itWordsDate("Prezzo Pubblico 15 ottobre 2026")).toBe("2026-10-15");
    expect(itWordsDate("Prezzo Pubblico 1 marzo 2027")).toBe("2027-03-01");
    expect(itWordsDate("Prezzo Pubblico")).toBeNull();
  });

  it("compresse per confezione dalla descrizione", () => {
    expect(doseUnitsFromDescription('"5 MG COMPRESSE" 28 COMPRESSE')).toBe(28);
    expect(doseUnitsFromDescription("500 MG COMPRESSE-10 COMPRESSE")).toBe(10);
    expect(doseUnitsFromDescription("<5 MG COMPRESSE> 14 COMPRESSE IN BLISTER PVC/AL")).toBe(14);
    expect(doseUnitsFromDescription("5 MG COMPRESSE- 28 (2X14) COMPRESSE IN BLISTER")).toBe(28);
    expect(doseUnitsFromDescription("20 MG CAPSULE RIGIDE GASTRORESISTENTI- 14 CAPSULE")).toBe(14);
    expect(doseUnitsFromDescription("100 mg/ml gocce orali, soluzione> flacone da 30 ml")).toBeNull();
    expect(doseUnitsFromDescription("500 MG COMPRESSE")).toBeNull();
  });

  it("regime di fornitura → ricetta", () => {
    expect(requiresPrescription("Medicinali soggetti a prescrizione medica")).toBe(true);
    expect(requiresPrescription("Medicinali non soggetti a prescrizione medica, da banco.")).toBe(false);
    expect(requiresPrescription("")).toBeNull();
  });
});

describe("sorgenti AIFA sulle fixture vere", () => {
  it("confezioni", () => {
    const { rows } = parseSource("confezioni", fixture("confezioni"));
    expect(rows.length).toBe(13);
    const triatec = rows.find((r) => r.aic === "027161064");
    expect(triatec).toEqual({
      aic: "027161064",
      name: "TRIATEC",
      pack_description: "<5 MG COMPRESSE> 14 COMPRESSE IN BLISTER PVC/AL",
      form: "Compressa",
      atc_code: "C09AA05",
      dose_units: 14,
      rx_regime: "Medicinali soggetti a prescrizione medica",
    });
    expect(rows.find((r) => r.aic === "012745081")?.dose_units).toBeNull(); // gocce
    expect(rows.find((r) => r.aic === "026783098")?.form).toMatch(/Capsula/);
  });

  it("principi attivi: N.D. tolti, più principi numerati", () => {
    const { rows } = parseSource("principi_attivi", fixture("principi_attivi"));
    expect(rows.some((r) => r.aic === "000140018")).toBe(false);
    // riga N.D. accanto a un principio attivo vero: resta solo quello vero
    expect(rows.filter((r) => r.aic === "048373029").map((r) => r.ingredient)).toEqual(["FEXOFENADINA"]);
    const combo = rows.filter((r) => r.aic === "044091039");
    expect(combo).toEqual([
      { aic: "044091039", ingredient: "AMLODIPINA", qty: 10, unit: "milligrammi", position: 1 },
      { aic: "044091039", ingredient: "VALSARTAN", qty: 160, unit: "milligrammi", position: 2 },
    ]);
    // quantità vuota: principio attivo senza dosaggio
    expect(rows.find((r) => r.aic === "012745028")).toMatchObject({ ingredient: "PARACETAMOLO", qty: null, unit: null });
  });

  it("ATC", () => {
    const { rows } = parseSource("atc", fixture("atc"));
    expect(rows[0]).toEqual({ code: "B03AC03", description: "COMPLESSO FERRO-SORBITOLO-ACIDO CITRICO" });
  });

  it("carenze: preambolo, Windows-1252, a capo nei campi, date", () => {
    const { rows, sourceDate } = parseSource("carenze", fixture("carenze"));
    expect(sourceDate).toBe("2026-11-05");
    expect(rows.length).toBe(9);
    const abacavir = rows.find((r) => r.aic === "045348036")!;
    expect(abacavir.started_on).toBe("2025-07-28");
    expect(abacavir.expected_end).toBeNull();
    expect(abacavir.equivalent).toBe("Sì");
    expect(abacavir.form_strength.startsWith('"600 MG/300 MG')).toBe(true);
    const aciclovir = rows.find((r) => r.aic === "034583017")!;
    expect(aciclovir.expected_end).toBe("2027-06-30");
    expect(rows.find((r) => r.aic === "039073022")?.reasons).toMatch(/[\r\n]/);
  });

  it("trasparenza: AIC completati, prezzi, data dei prezzi dall'intestazione", () => {
    const { rows, sourceDate } = parseSource("trasparenza", fixture("trasparenza"));
    expect(sourceDate).toBe("2026-10-15");
    const triatec = rows.find((r) => r.aic === "027161064")!;
    expect(triatec).toMatchObject({ name: "TRIATEC", group_code: "DRA", reference_price: 1.8, public_price: 3.4, price_difference: 1.6, prices_as_of: "2026-10-15" });
    expect(rows.every((r) => /^\d{9}$/.test(r.aic))).toBe(true);
    expect(rows.some((r) => r.note !== "")).toBe(true);
  });

  it("intestazioni cambiate: errore leggibile, nessuna riga", () => {
    const changed = fixture("trasparenza").replace("Codice gruppo equivalenza", "Gruppo");
    expect(() => parseSource("trasparenza", changed)).toThrow(HeaderMismatchError);
    expect(() => parseSource("trasparenza", changed)).toThrow(/AIFA ha cambiato le colonne di trasparenza/);
    expect(() => parseSource("carenze", fixture("carenze").split("\n").slice(2).join("\n"))).toThrow(/carenze/);
  });

  it("troppe righe senza AIC: il file è rotto", () => {
    const broken = fixture("confezioni").replace(/^"0(\d{8})"/gm, '"X$1"');
    expect(() => parseSource("confezioni", broken)).toThrow(/senza codice valido/);
  });
});

describe("checkShrink", () => {
  it("rifiuta un file con meno della metà delle righe di prima", () => {
    expect(() => checkShrink("confezioni", 70000, 160000)).toThrow(/sembra incompleto/);
    expect(() => checkShrink("confezioni", 150000, 160000)).not.toThrow();
    expect(() => checkShrink("confezioni", 13, null)).not.toThrow();
    // tabelle piccole o primo import: nessun confronto
    expect(() => checkShrink("atc", 1, 10)).not.toThrow();
  });
});
