// Righe delle tabelle (vedi supabase/migrations) e conversione verso i tipi di dominio.

import type { FrequencyType, MedicationData, PlanSettings, PrepRunData, StockMode } from "./forecast";

export interface ProfileRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface PlanRow {
  id: string;
  owner_id: string;
  patient_name: string;
  notes: string;
  stock_mode: StockMode;
  mode_since: string;
  prep_weekday: number;
  alert_under_14: boolean;
  alert_under_7: boolean;
  alert_last_pack: boolean;
  created_at: string;
}

export interface RecipientRow {
  id: string;
  plan_id: string;
  email: string;
}

export interface MedicationRow {
  id: string;
  plan_id: string;
  name: string;
  strength: string;
  description: string;
  pills_per_pack: number;
  requires_prescription: boolean;
  color: string;
  shape: string;
  dose_morning: number | string;
  dose_noon: number | string;
  dose_evening: number | string;
  frequency_type: FrequencyType;
  weekdays: number[];
  interval_days: number | null;
  cycle_on: number | null;
  cycle_off: number | null;
  start_date: string;
  end_date: string | null;
  stock_qty: number | string;
  stock_as_of: string;
  ordered_at: string | null;
  archived: boolean;
  created_at: string;
}

export type StockEventType = "count" | "arrival" | "prep" | "prep_undo" | "adjust";

export interface StockEventRow {
  id: string;
  medication_id: string;
  type: StockEventType;
  delta: number | string;
  qty_after: number | string;
  effective_date: string;
  meta: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface PrepRunRow {
  id: string;
  plan_id: string;
  week_start: string;
  deductions: Record<string, number | string>;
  created_at: string;
  undone_at: string | null;
}

export const MEDICATION_COLUMNS =
  "id, plan_id, name, strength, description, pills_per_pack, requires_prescription, color, shape, dose_morning, dose_noon, dose_evening, frequency_type, weekdays, interval_days, cycle_on, cycle_off, start_date, end_date, stock_qty, stock_as_of, ordered_at, archived, created_at";

export const PLAN_COLUMNS =
  "id, owner_id, patient_name, notes, stock_mode, mode_since, prep_weekday, alert_under_14, alert_under_7, alert_last_pack, created_at";

/** Medicinale pronto per la logica di dominio e per l'interfaccia. */
export interface Medication extends MedicationData {
  planId: string;
  name: string;
  strength: string;
  description: string;
  requiresPrescription: boolean;
  color: string;
  shape: string;
}

export function toMedication(r: MedicationRow): Medication {
  return {
    id: r.id,
    planId: r.plan_id,
    name: r.name,
    strength: r.strength,
    description: r.description,
    requiresPrescription: r.requires_prescription,
    color: r.color,
    shape: r.shape,
    pillsPerPack: Number(r.pills_per_pack),
    doseMorning: Number(r.dose_morning),
    doseNoon: Number(r.dose_noon),
    doseEvening: Number(r.dose_evening),
    frequencyType: r.frequency_type,
    weekdays: (r.weekdays ?? []).map(Number),
    intervalDays: r.interval_days,
    cycleOn: r.cycle_on,
    cycleOff: r.cycle_off,
    startDate: r.start_date,
    endDate: r.end_date,
    stockQty: Number(r.stock_qty),
    stockAsOf: r.stock_as_of,
    orderedAt: r.ordered_at,
  };
}

export function toPlanSettings(r: PlanRow): PlanSettings {
  return {
    stockMode: r.stock_mode,
    prepWeekday: r.prep_weekday,
    modeSince: r.mode_since,
    alertUnder14: r.alert_under_14,
    alertUnder7: r.alert_under_7,
    alertLastPack: r.alert_last_pack,
  };
}

export function toPrepRun(r: PrepRunRow): PrepRunData {
  return {
    id: r.id,
    weekStart: r.week_start,
    deductions: Object.fromEntries(Object.entries(r.deductions ?? {}).map(([k, v]) => [k, Number(v)])),
    undoneAt: r.undone_at,
  };
}
