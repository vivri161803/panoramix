import { describe, expect, it } from "vitest";
import { forecastPlan } from "@/lib/forecast";
import { buildReminderItems, buildSummaryMeds } from "@/lib/digest";
import { isoWeekday } from "@/lib/dates";
import { medication, planSettings } from "./helpers/fixtures";

// Sabato 14 novembre 2026: domani (domenica 15) si prepara il portapillole
const SAT = "2026-11-14";
const SUN = "2026-11-15";
const weekly = planSettings({ stockMode: "weekly", prepWeekday: 7, modeSince: "2026-11-09" });

describe("promemoria del portapillole", () => {
  it("la vigilia del giorno di preparazione elenca cosa mettere e cosa manca", () => {
    const meds = [
      medication({ id: "a", name: "Ramipril", doseMorning: 1, stockQty: 4, stockAsOf: SAT }),
      medication({
        id: "b",
        name: "Prednisone",
        doseMorning: 2,
        stockQty: 50,
        stockAsOf: SAT,
        doseChanges: [{ from: "2026-11-18", doseMorning: 1, doseNoon: 0, doseEvening: 0 }],
      }),
      medication({ id: "c", name: "Paracetamolo", frequencyType: "as_needed", stockQty: 10, stockAsOf: SAT }),
    ];
    const fc = forecastPlan(weekly, meds, [], SAT);
    expect(fc.nextPrep).toBe(SUN);
    expect(fc.prepWeek).toBe(SUN);
    const items = buildReminderItems(meds, fc.prepPreview, SUN);
    expect(items).toEqual([
      { name: "Ramipril", strength: "5 mg", color: "#FFC020", need: 7, missing: 3, phrase: "1 al mattino", changeNote: undefined },
      // 15-17: 3×2, 18-21: 4×1 → 10
      { name: "Prednisone", strength: "5 mg", color: "#FFC020", need: 10, missing: 0, phrase: "2 al mattino", changeNote: "Dal mer 18 nov: 1 al mattino" },
    ]);
  });
});

describe("riepilogo settimanale", () => {
  it("parte il lunedì", () => {
    expect(isoWeekday("2026-11-16")).toBe(1);
  });

  it("medicine in corso dalla più urgente, senza quelle concluse", () => {
    const today = "2026-11-16";
    const meds = [
      medication({ id: "ok", name: "Ok", stockQty: 100, stockAsOf: today }),
      medication({ id: "out", name: "Finita", stockQty: 0, stockAsOf: today }),
      medication({ id: "end", name: "Conclusa", endDate: "2026-11-10", stockAsOf: today }),
    ];
    const s = buildSummaryMeds(forecastPlan(planSettings(), meds, [], today));
    expect(s.map((m) => [m.name, m.status])).toEqual([
      ["Finita", "out"],
      ["Ok", "ok"],
    ]);
  });
});
