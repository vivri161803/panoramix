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
  type InviteRow,
  type MemberRow,
  type MyInviteRow,
  type PrepRunRow,
  type ProfileRow,
  type RecipientRow,
  type StockEventRow,
} from "@/lib/db-types";
import { todayInRome } from "@/lib/dates";
import { forecastPlan } from "@/lib/forecast";
import type { MemberRole, PlanRole } from "@/lib/roles";

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

export function fullName(p: Pick<ProfileRow, "first_name" | "last_name"> | null | undefined, fallback = ""): string {
  return `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || fallback;
}

/** Nome e cognome delle persone che condividono un piano con me (RLS: solo loro). */
async function profileNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, email, first_name, last_name").in("id", unique);
  return new Map(((data ?? []) as ProfileRow[]).map((p) => [p.id, fullName(p, p.email)]));
}

/** Piani propri e condivisi, con medicinali e preparazioni per i riepiloghi. */
export async function listPlans() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: plans, error }, { data: memberships }] = await Promise.all([
    supabase.from("plans").select(PLAN_COLUMNS).order("created_at", { ascending: true }),
    supabase.from("plan_members").select("plan_id, role").eq("user_id", profile.id),
  ]);
  if (error) throw new Error("Non riesco a leggere i piani. Riprova tra poco.");
  const planRows = (plans ?? []) as PlanRow[];
  if (planRows.length === 0) return [];
  const ids = planRows.map((p) => p.id);
  const roleOf = new Map(((memberships ?? []) as { plan_id: string; role: MemberRole }[]).map((m) => [m.plan_id, m.role]));
  const [{ data: meds }, { data: runs }, names] = await Promise.all([
    supabase.from("medications").select(MEDICATION_COLUMNS).in("plan_id", ids).eq("archived", false).order("created_at"),
    supabase.from("prep_runs").select("id, plan_id, week_start, deductions, created_at, undone_at").in("plan_id", ids).is("undone_at", null).order("week_start", { ascending: false }),
    profileNames(planRows.filter((p) => p.owner_id !== profile.id).map((p) => p.owner_id)),
  ]);
  const today = todayInRome();
  return planRows.map((p) => {
    const m = ((meds ?? []) as MedicationRow[]).filter((x) => x.plan_id === p.id).map(toMedication);
    const r = ((runs ?? []) as PrepRunRow[]).filter((x) => x.plan_id === p.id).slice(0, 5).map(toPrepRun);
    const role: PlanRole = p.owner_id === profile.id ? "owner" : (roleOf.get(p.id) ?? "viewer");
    return { plan: p, role, ownerName: role === "owner" ? "" : (names.get(p.owner_id) ?? ""), forecast: forecastPlan(toPlanSettings(p), m, r, today) };
  });
}

/** Inviti ricevuti e non ancora accettati. */
export async function listMyInvites(): Promise<MyInviteRow[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_plan_invites");
  return (data ?? []) as MyInviteRow[];
}

export type PlanListEntry = Awaited<ReturnType<typeof listPlans>>[number];

/** Un piano con tutto il necessario per le sue pagine. 404 se l'utente non ha accesso. */
export const getPlanBundle = cache(async (planId: string) => {
  const profile = await requireProfile();
  if (!/^[0-9a-f-]{36}$/i.test(planId)) notFound();
  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select(PLAN_COLUMNS).eq("id", planId).maybeSingle();
  if (!plan) notFound();
  const planRow = plan as PlanRow;
  const owner = planRow.owner_id === profile.id;
  const [{ data: meds }, { data: runs }, { data: recipients }, { data: membership }, { data: members }, { data: invites }, names] = await Promise.all([
    supabase.from("medications").select(MEDICATION_COLUMNS).eq("plan_id", planId).eq("archived", false).order("created_at"),
    supabase.from("prep_runs").select("id, plan_id, week_start, deductions, created_at, undone_at").eq("plan_id", planId).order("week_start", { ascending: false }).limit(10),
    owner ? supabase.from("plan_recipients").select("id, plan_id, email").eq("plan_id", planId).order("created_at") : Promise.resolve({ data: [] }),
    owner ? Promise.resolve({ data: null }) : supabase.from("plan_members").select("role").eq("plan_id", planId).eq("user_id", profile.id).maybeSingle(),
    owner
      ? supabase
          .from("plan_members")
          .select("plan_id, user_id, role, created_at, profile:profiles!plan_members_user_id_fkey(first_name, last_name, email)")
          .eq("plan_id", planId)
          .order("created_at")
      : Promise.resolve({ data: [] }),
    owner ? supabase.from("plan_invites").select("id, plan_id, email, role, created_at").eq("plan_id", planId).order("created_at") : Promise.resolve({ data: [] }),
    owner ? Promise.resolve(new Map<string, string>()) : profileNames([planRow.owner_id]),
  ]);
  const role: PlanRole = owner ? "owner" : ((membership as { role: MemberRole } | null)?.role ?? "viewer");
  const runRows = (runs ?? []) as PrepRunRow[];
  const medications = ((meds ?? []) as MedicationRow[]).map(toMedication);
  const today = todayInRome();
  return {
    profile,
    role,
    ownerName: owner ? fullName(profile) : (names.get(planRow.owner_id) ?? ""),
    plan: planRow,
    settings: toPlanSettings(planRow),
    medications,
    runRows,
    recipients: (recipients ?? []) as RecipientRow[],
    members: (members ?? []) as unknown as MemberRow[],
    invites: (invites ?? []) as InviteRow[],
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
  const events = (data ?? []) as StockEventRow[];
  // chi ha fatto ogni movimento (nei piani condivisi)
  const authors = await profileNames(events.map((e) => e.created_by ?? ""));
  return { events, authors };
}
