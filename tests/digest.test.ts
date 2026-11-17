import { describe, expect, it } from "vitest";
import { forecastPlan } from "@/lib/forecast";
import { buildPrepReminderItems, buildSummaryMeds } from "@/lib/digest";
import { isoWeekday } from "@/lib/dates";
import { medication, planSettings } from "./helpers/fixtures";

// Domenica 15 novembre 2026: giorno di preparazione del portapillole
const SAT = "2026-11-14";
const SUN = "2026-11-15";

describe("promemoria del portapillole", () => {
  it("elenca le dosi dei 7 giorni, con il cambio di dose della settimana", () => {
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
    ];
    expect(buildPrepReminderItems(meds, SUN)).toEqual([
      { name: "Ramipril", strength: "5 mg", color: "#FFC020", phrase: "1 al mattino", changeNote: undefined },
      { name: "Prednisone", strength: "5 mg", color: "#FFC020", phrase: "2 al mattino", changeNote: "Dal mer 18 nov: 1 al mattino" },
    ]);
  });

  it("esclude i medicinali al bisogno, conclusi e senza dosi nella settimana", () => {
    const meds = [
      medication({ id: "c", name: "Paracetamolo", frequencyType: "as_needed", stockQty: 10 }),
      medication({ id: "d", name: "Conclusa", endDate: "2026-11-14" }),
      medication({ id: "e", name: "Il mese prossimo", startDate: "2026-12-01" }),
      medication({ id: "f", name: "Sospesa", doseChanges: [{ from: "2026-11-10", doseMorning: 0, doseNoon: 0, doseEvening: 0 }] }),
    ];
    expect(buildPrepReminderItems(meds, SUN)).toEqual([]);
  });

  it("include flaconi e siringhe con dosi nella settimana", () => {
    const meds = [
      medication({ id: "g", name: "Collirio", form: "collirio", shape: "flacone", pillsPerPack: 1, stockQty: 1, reorderDays: 30, doseMorning: 1, doseEvening: 1 }),
      medication({ id: "h", name: "Eparina", form: "iniezione", shape: "siringa", frequencyType: "weekdays", weekdays: [3] }),
    ];
    expect(buildPrepReminderItems(meds, SUN).map((i) => i.name)).toEqual(["Collirio", "Eparina"]);
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
    const s = buildSummaryMeds(forecastPlan(planSettings(), meds, today));
    expect(s.map((m) => [m.name, m.status])).toEqual([
      ["Finita", "out"],
      ["Ok", "ok"],
    ]);
  });
});
