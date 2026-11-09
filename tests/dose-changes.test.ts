import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  buildWeek,
  currentStock,
  dosesAt,
  dosesBetween,
  dosesOn,
  forecastMedication,
  scheduleAt,
  scheduleSummary,
  slotDoseOn,
  upcomingChanges,
} from "@/lib/forecast";
import { changeLabel } from "@/lib/digest";
import { MON, medData, planSettings } from "./helpers/fixtures";

const taper = medData({
  doseMorning: 2,
  doseChanges: [
    { from: "2026-11-16", doseMorning: 1, doseNoon: 0, doseEvening: 0 },
    { from: "2026-11-12", doseMorning: 1.5, doseNoon: 0, doseEvening: 0 },
    { from: "2026-11-20", doseMorning: 0, doseNoon: 0, doseEvening: 0 },
  ],
});

describe("cambi di dose programmati", () => {
  it("vale l'ultimo cambio già iniziato, in qualsiasi ordine siano salvati", () => {
    expect(dosesAt(taper, "2026-11-11").doseMorning).toBe(2);
    expect(dosesAt(taper, "2026-11-12").doseMorning).toBe(1.5);
    expect(dosesAt(taper, "2026-11-15").doseMorning).toBe(1.5);
    expect(dosesAt(taper, "2026-11-16").doseMorning).toBe(1);
    expect(dosesAt(taper, "2026-11-25").doseMorning).toBe(0);
  });

  it("le dosi del giorno e della fascia seguono il cambio", () => {
    expect(dosesOn(taper, "2026-11-11")).toBe(2);
    expect(dosesOn(taper, "2026-11-13")).toBe(1.5);
    expect(slotDoseOn(taper, "2026-11-17", "morning")).toBe(1);
    expect(dosesOn(taper, "2026-11-21")).toBe(0);
  });

  it("le dosi tra due date sommano i diversi periodi", () => {
    // 10-11: 2+2, 12-15: 4×1,5, 16-19: 4×1, 20: 0
    expect(dosesBetween(taper, "2026-11-10", "2026-11-20")).toBe(4 + 6 + 4 + 0);
  });

  it("la scorta di oggi scala con le dosi in vigore giorno per giorno", () => {
    const m = { ...taper, stockQty: 20, stockAsOf: "2026-11-10" };
    // dal 10 al 13 compresi: 2 + 2 + 1,5 + 1,5 = 7
    expect(currentStock(m, "daily", "2026-11-14")).toBe(13);
  });

  it("la copertura tiene conto della riduzione futura (terapia a scalare)", () => {
    const m = medData({ doseMorning: 2, stockQty: 10, stockAsOf: MON, doseChanges: [{ from: addDays(MON, 3), doseMorning: 1, doseNoon: 0, doseEvening: 0 }] });
    // 3 giorni da 2 (6) + 4 giorni da 1 = 10 → 7 giorni
    const f = forecastMedication(m, { plan: planSettings(), today: MON });
    expect(f.coverageDays).toBe(7);
    const senza = forecastMedication({ ...m, doseChanges: [] }, { plan: planSettings(), today: MON });
    expect(senza.coverageDays).toBe(5);
  });

  it("una sospensione (dose zero) ferma il consumo e non fa scattare avvisi", () => {
    const m = medData({ doseMorning: 1, stockQty: 5, stockAsOf: MON, doseChanges: [{ from: addDays(MON, 2), doseMorning: 0, doseNoon: 0, doseEvening: 0 }] });
    const f = forecastMedication(m, { plan: planSettings(), today: MON });
    expect(f.coverageDays).toBeNull();
    expect(f.triggered).not.toContain("under_14");
  });

  it("il calendario mostra la nuova dose dal giorno del cambio", () => {
    const week = buildWeek([{ ...taper, id: "m1" }], MON);
    expect(week.map((d) => d.slots.morning[0]?.qty ?? 0)).toEqual([2, 2, 2, 1.5, 1.5, 1.5, 1.5]);
  });

  it("riepilogo e frasi usano le dosi in vigore nel giorno chiesto", () => {
    expect(scheduleSummary(scheduleAt(taper, "2026-11-13"))).toBe("1½ al mattino, tutti i giorni → 10½ a settimana");
    expect(scheduleAt(taper, "2026-11-13").doseChanges).toBe(taper.doseChanges);
  });

  it("cambi futuri in ordine di data ed etichetta leggibile", () => {
    expect(upcomingChanges(taper, "2026-11-12").map((c) => c.from)).toEqual(["2026-11-16", "2026-11-20"]);
    expect(changeLabel({ from: "2026-11-16", doseMorning: 1, doseNoon: 0, doseEvening: 0.5 })).toBe("Dal lun 16 nov: 1 al mattino e ½ alla sera");
    expect(changeLabel({ from: "2026-11-20", doseMorning: 0, doseNoon: 0, doseEvening: 0 })).toBe("Dal ven 20 nov: sospesa");
  });

  it("senza cambi tutto resta come prima", () => {
    const m = medData();
    expect(dosesAt(m, "2030-01-01")).toEqual({ doseMorning: 1, doseNoon: 0, doseEvening: 0 });
    expect(upcomingChanges(m, MON)).toEqual([]);
  });
});
