import type { Medication } from "@/lib/db-types";
import type { MedicationData, PlanSettings } from "@/lib/forecast";

// Lunedì 9 novembre 2026
export const MON = "2026-11-09";

export function medData(over: Partial<MedicationData> = {}): MedicationData {
  return {
    id: "m1",
    doseMorning: 1,
    doseNoon: 0,
    doseEvening: 0,
    frequencyType: "daily",
    weekdays: [],
    intervalDays: null,
    cycleOn: null,
    cycleOff: null,
    startDate: "2026-11-01",
    endDate: null,
    pillsPerPack: 30,
    stockQty: 30,
    stockAsOf: MON,
    orderedAt: null,
    ...over,
  };
}

export function medication(over: Partial<Medication> = {}): Medication {
  return {
    ...medData(),
    planId: "p1",
    name: "Ramipril",
    strength: "5 mg",
    description: "",
    requiresPrescription: false,
    color: "#FFC020",
    shape: "capsula",
    ...over,
  };
}

export function planSettings(over: Partial<PlanSettings> = {}): PlanSettings {
  return {
    stockMode: "daily",
    prepWeekday: 7,
    modeSince: "2026-11-02",
    alertUnder14: true,
    alertUnder7: false,
    alertLastPack: true,
    ...over,
  };
}
