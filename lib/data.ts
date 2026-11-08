import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  MEDICATION_COLUMNS,
  PLAN_COLUMNS,
  toMedication,
  toPlanSettings,
  toPrepRun,
  type MedicationRow,
  type PlanRow,
  type PrepRunRow,
  type ProfileRow,
  type RecipientRow,
  type StockEventRow,
} from "@/lib/db-types";
import { todayInRome } from "@/lib/dates";
import { forecastPlan } from "@/lib/forecast";

export interface SessionUser {
  id: string;
  email: string;
}

/** Utente collegato (verifica il token). null se non c'è sessione. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: String(claims.email ?? "") };
});

export const getProfile = cache(async (): Promise<ProfileRow | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, email, first_name, last_name").eq("id", user.id).maybeSingle();
  return (data as ProfileRow | null) ?? null;
});

/** Richiede accesso e profilo completo (nome e cognome). */
export async function requireProfile(): Promise<ProfileRow> {
  const user = await getSessionUser();
  if (!user) redirect("/accesso");
  const profile = await getProfile();
  if (!profile || !profile.first_name.trim() || !profile.last_name.trim()) redirect("/benvenuto");
  return profile;
}

export function initials(p: Pick<ProfileRow, "first_name" | "last_name">): string {
  return `${p.first_name.trim().charAt(0)}${p.last_name.trim().charAt(0)}`.toUpperCase() || "?";
}

/** Tutti i piani del gestore, con medicinali e preparazioni per i riepiloghi. */
export async function listPlans() {
  await requireProfile();
  const supabase = await createClient();
  const { data: plans, error } = await supabase.from("plans").select(PLAN_COLUMNS).order("created_at", { ascending: true });
  if (error) throw new Error("Non riesco a leggere i piani. Riprova tra poco.");
  const planRows = (plans ?? []) as PlanRow[];
  if (planRows.length === 0) return [];
  const ids = planRows.map((p) => p.id);
  const [{ data: meds }, { data: runs }] = await Promise.all([
    supabase.from("medications").select(MEDICATION_COLUMNS).in("plan_id", ids).eq("archived", false).order("created_at"),
    supabase.from("prep_runs").select("id, plan_id, week_start, deductions, created_at, undone_at").in("plan_id", ids).is("undone_at", null).order("week_start", { ascending: false }),
  ]);
  const today = todayInRome();
  return planRows.map((p) => {
    const m = ((meds ?? []) as MedicationRow[]).filter((x) => x.plan_id === p.id).map(toMedication);
    const r = ((runs ?? []) as PrepRunRow[]).filter((x) => x.plan_id === p.id).slice(0, 5).map(toPrepRun);
    return { plan: p, forecast: forecastPlan(toPlanSettings(p), m, r, today) };
  });
}

export type PlanListEntry = Awaited<ReturnType<typeof listPlans>>[number];

/** Un piano con tutto il necessario per le sue pagine. 404 se non è del gestore. */
export const getPlanBundle = cache(async (planId: string) => {
  const profile = await requireProfile();
  if (!/^[0-9a-f-]{36}$/i.test(planId)) notFound();
  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select(PLAN_COLUMNS).eq("id", planId).maybeSingle();
  if (!plan) notFound();
  const [{ data: meds }, { data: runs }, { data: recipients }] = await Promise.all([
    supabase.from("medications").select(MEDICATION_COLUMNS).eq("plan_id", planId).eq("archived", false).order("created_at"),
    supabase.from("prep_runs").select("id, plan_id, week_start, deductions, created_at, undone_at").eq("plan_id", planId).order("week_start", { ascending: false }).limit(10),
    supabase.from("plan_recipients").select("id, plan_id, email").eq("plan_id", planId).order("created_at"),
  ]);
  const planRow = plan as PlanRow;
  const runRows = (runs ?? []) as PrepRunRow[];
  const medications = ((meds ?? []) as MedicationRow[]).map(toMedication);
  const today = todayInRome();
  return {
    profile,
    plan: planRow,
    settings: toPlanSettings(planRow),
    medications,
    runRows,
    recipients: (recipients ?? []) as RecipientRow[],
    today,
    forecast: forecastPlan(toPlanSettings(planRow), medications, runRows.map(toPrepRun), today),
  };
});

export type PlanBundle = Awaited<ReturnType<typeof getPlanBundle>>;

export async function getStockEvents(medicationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_events")
    .select("id, medication_id, type, delta, qty_after, effective_date, meta, created_by, created_at")
    .eq("medication_id", medicationId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as StockEventRow[];
}
