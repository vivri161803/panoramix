import { describe, expect, it } from "vitest";
import { forecastMedication, forecastPlan } from "@/lib/forecast";
import { buildPharmacyItems, doctorRequestText, pharmacyText, suggestedPacks, type PharmacyLine } from "@/lib/pharmacy";
import { MON, medication, planSettings } from "./helpers/fixtures";

const ctx = { plan: planSettings(), today: MON };

describe("lista per la farmacia", () => {
  it("confezioni per coprire 30 giorni oltre le compresse in casa, almeno 1", () => {
    const m = medication({ doseMorning: 1, pillsPerPack: 28, stockQty: 5 });
    const f = forecastMedication(m, ctx);
    // servono 30, ne ho 5 → mancano 25 → 1 confezione da 28
    expect(suggestedPacks(m, f, MON)).toBe(1);
    const twice = medication({ doseMorning: 1, doseEvening: 1, pillsPerPack: 28, stockQty: 5 });
    // servono 60, mancano 55 → 2 confezioni
    expect(suggestedPacks(twice, forecastMedication(twice, ctx), MON)).toBe(2);
    const plenty = medication({ stockQty: 200 });
    expect(suggestedPacks(plenty, forecastMedication(plenty, ctx), MON)).toBe(1);
  });

  it("al bisogno: una confezione", () => {
    const m = medication({ frequencyType: "as_needed", stockQty: 2 });
    expect(suggestedPacks(m, forecastMedication(m, ctx), MON)).toBe(1);
  });

  it("propone le medicine esaurite o sotto soglia non ancora ordinate, salta quelle concluse", () => {
    const meds = [
      medication({ id: "a", name: "A", stockQty: 3 }),
      medication({ id: "b", name: "B", stockQty: 3, orderedAt: "2026-11-08T10:00:00Z" }),
      medication({ id: "c", name: "C", stockQty: 300 }),
      medication({ id: "d", name: "D", stockQty: 0, endDate: "2026-11-05" }),
    ];
    const fc = forecastPlan(planSettings(), meds, [], MON);
    const items = buildPharmacyItems(fc.items, MON, fc.nextPrep);
    expect(items.map((i) => i.id).sort()).toEqual(["a", "b", "c"]);
    expect(Object.fromEntries(items.map((i) => [i.id, i.selected]))).toEqual({ a: true, b: false, c: false });
    expect(items.find((i) => i.id === "b")!.ordered).toBe(true);
    expect(items.find((i) => i.id === "a")!.phrase).toBe("1 al mattino");
  });

  it("testo diviso tra con e senza ricetta, e richiesta al medico solo per le ricette", () => {
    const lines: PharmacyLine[] = [
      { name: "Ramipril", strength: "5 mg", packs: 1, pillsPerPack: 28, rx: true, phrase: "1 al mattino" },
      { name: "Cardioaspirina", strength: "100 mg", packs: 2, pillsPerPack: 30, rx: false, phrase: "1 a pranzo" },
    ];
    expect(pharmacyText("Nonna Anna", lines, MON)).toBe(
      "Medicine per Nonna Anna (9 novembre 2026)\n\nCon ricetta:\n• Ramipril 5 mg — 1 confezione da 28\n\nSenza ricetta:\n• Cardioaspirina 100 mg — 2 confezioni da 30",
    );
    expect(doctorRequestText("Nonna Anna", lines, "Carlo Bianchi")).toBe(
      "Buongiorno dottore,\nper Nonna Anna avrei bisogno della ricetta per:\n– Ramipril 5 mg, 1 confezione da 28 (1 al mattino)\nGrazie,\nCarlo Bianchi",
    );
    expect(doctorRequestText("Nonna Anna", [lines[1]], "Carlo")).toBeNull();
    expect(pharmacyText("Nonna Anna", [], MON)).toBe("");
  });
});
