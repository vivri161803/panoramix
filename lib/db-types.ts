// Righe delle tabelle (vedi supabase/migrations) e conversione verso i tipi di dominio.

import type { FrequencyType, MedicationData, PlanSettings, PrepRunData, StockMode } from "./forecast";
import type { MemberRole } from "./roles";

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
  prep_reminder: boolean;
  weekly_summary: boolean;
  created_at: string;
}

export interface MemberRow {
  plan_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  profile: { first_name: string; last_name: string; email: string } | null;
}

export interface InviteRow {
  id: string;
  plan_id: string;
  email: string;
  role: MemberRole;
  created_at: string;
}

/** Invito ricevuto (da my_plan_invites) */
export interface MyInviteRow {
  id: string;
  plan_id: string;
  patient_name: string;
  role: MemberRole;
  owner_name: string;
  created_at: string;
}

export interface DoseChangeRow {
  id: string;
  effective_date: string;
  dose_morning: number | string;
  dose_noon: number | string;
  dose_evening: number | string;
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
  dose_changes?: DoseChangeRow[] | null;
}

export type StockEventType = "count" | "arrival" | "prep" | "prep_undo" | "adjust" | "use";

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
  "id, plan_id, name, strength, description, pills_per_pack, requires_prescription, color, shape, dose_morning, dose_noon, dose_evening, frequency_type, weekdays, interval_days, cycle_on, cycle_off, start_date, end_date, stock_qty, stock_as_of, ordered_at, archived, created_at, dose_changes(id, effective_date, dose_morning, dose_noon, dose_evening)";

export const PLAN_COLUMNS =
  "id, owner_id, patient_name, notes, stock_mode, mode_since, prep_weekday, alert_under_14, alert_under_7, alert_last_pack, prep_reminder, weekly_summary, created_at";

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
  const changes = (r.dose_changes ?? [])
    .map((c) => ({
      id: c.id,
      from: c.effective_date,
      doseMorning: Number(c.dose_morning),
      doseNoon: Number(c.dose_noon),
      doseEvening: Number(c.dose_evening),
    }))
    .sort((a, b) => (a.from < b.from ? -1 : 1));
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
    doseChanges: changes,
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
