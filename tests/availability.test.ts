import { describe, expect, it } from "vitest";
import { buildAvailability, type ShortageRow, type TransparencyRow } from "@/lib/availability";
import { medication } from "./helpers/fixtures";
import { SAMPLE_SHORTAGES, SAMPLE_TRANSPARENCY } from "./helpers/aifa-sample";

const shortages = SAMPLE_SHORTAGES as ShortageRow[];
const transparency = SAMPLE_TRANSPARENCY as TransparencyRow[];

describe("buildAvailability", () => {
  it("medicinale carente", () => {
    const [a] = buildAvailability([medication({ id: "acarbosio", aic: "047612027" })], shortages, transparency);
    expect(a.noAic).toBe(false);
    expect(a.shortages).toHaveLength(1);
    expect(a.shortages[0]).toMatchObject({ started_on: "2026-06-30", expected_end: "2026-12-31", reasons: "Problemi produttivi" });
    expect(a.group).toBeNull(); // non è nella lista di trasparenza
  });

  it("non carente, con gruppo di equivalenza in ordine di prezzo", () => {
    const [a] = buildAvailability([medication({ aic: "027161064" })], shortages, transparency);
    expect(a.shortages).toEqual([]);
    expect(a.group).toMatchObject({ code: "DRA", referencePrice: 1.8, pricesAsOf: "2026-10-15" });
    expect(a.group!.equivalents.map((e) => [e.name, e.publicPrice, e.difference, e.isPlan])).toEqual([
      ["RAMIPRIL ALTER", 1.8, 0, false],
      ["KRUPIL", 2.17, 0.37, false],
      ["TRIATEC", 3.4, 1.6, true],
    ]);
  });

  it("senza AIC", () => {
    const [a] = buildAvailability([medication({ aic: null })], shortages, transparency);
    expect(a).toMatchObject({ noAic: true, shortages: [], group: null });
  });

  it("prezzi mancanti o in testo: in fondo, senza rompere l'ordine", () => {
    const rows: TransparencyRow[] = [
      { ...transparency[0], aic: "000000001", name: "B SENZA PREZZO", public_price: null, price_difference: null },
      { ...transparency[0], aic: "000000002", name: "A TESTO", public_price: "2.50", price_difference: "0.70", reference_price: "1.80" },
      { ...transparency[0], aic: "000000003", name: "C PLAN", public_price: 1.8, price_difference: 0 },
    ];
    const [a] = buildAvailability([medication({ aic: "000000003" })], [], rows);
    expect(a.group!.referencePrice).toBe(1.8);
    expect(a.group!.equivalents.map((e) => [e.name, e.publicPrice])).toEqual([
      ["C PLAN", 1.8],
      ["A TESTO", 2.5],
      ["B SENZA PREZZO", null],
    ]);
  });

  it("più medicinali: ognuno con i suoi dati, nell'ordine del piano", () => {
    const res = buildAvailability([medication({ id: "x", aic: null }), medication({ id: "y", aic: "050238118" })], shortages, transparency);
    expect(res.map((r) => r.med.id)).toEqual(["x", "y"]);
    expect(res[1].group!.equivalents.find((e) => e.isPlan)?.name).toBe("RAMIPRIL ALTER");
  });
});
