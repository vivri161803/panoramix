import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MEDICATION_COLUMNS,
  PLAN_COLUMNS,
  toMedication,
  type Medication,
  type MedicationRow,
  type PlanRow,
  type PrepRunRow,
  type ProfileRow,
} from "@/lib/db-types";
import { uniqueEmails, type MemberRole } from "@/lib/roles";

export interface CronData {
  plans: PlanRow[];
  /** proprietari e membri dei piani */
  profiles: Map<string, ProfileRow>;
  recipients: { plan_id: string; email: string }[];
  members: { plan_id: string; user_id: string; role: MemberRole }[];
  meds: Medication[];
  runs: PrepRunRow[];
}

/** Tutti i dati che servono ai controlli automatici (con la service role, che ignora RLS). */
export async function loadCronData(admin: SupabaseClient): Promise<CronData> {
  const { data: plans, error: pErr } = await admin.from("plans").select(PLAN_COLUMNS);
  if (pErr) throw new Error(`Lettura piani non riuscita: ${pErr.message}`);
  const planRows = (plans ?? []) as PlanRow[];
  const planIds = planRows.map((p) => p.id);
  if (!planIds.length) return { plans: [], profiles: new Map(), recipients: [], members: [], meds: [], runs: [] };

  const [recRes, memRes, medsRes, runsRes] = await Promise.all([
    admin.from("plan_recipients").select("plan_id, email").in("plan_id", planIds),
    admin.from("plan_members").select("plan_id, user_id, role").in("plan_id", planIds),
    admin.from("medications").select(MEDICATION_COLUMNS).in("plan_id", planIds).eq("archived", false),
    admin.from("prep_runs").select("id, plan_id, week_start, deductions, created_at, undone_at").in("plan_id", planIds).is("undone_at", null),
  ]);
  for (const [name, res] of [["destinatari", recRes], ["membri", memRes], ["medicinali", medsRes], ["preparazioni", runsRes]] as const) {
    if (res.error) throw new Error(`Lettura ${name} non riuscita: ${res.error.message}`);
  }
  const members = (memRes.data ?? []) as CronData["members"];
  const userIds = [...new Set([...planRows.map((p) => p.owner_id), ...members.map((m) => m.user_id)])];
  const { data: profiles, error: prErr } = await admin.from("profiles").select("id, email, first_name, last_name").in("id", userIds);
  if (prErr) throw new Error(`Lettura profili non riuscita: ${prErr.message}`);

  return {
    plans: planRows,
    profiles: new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p])),
    recipients: (recRes.data ?? []) as CronData["recipients"],
    members,
    meds: ((medsRes.data ?? []) as MedicationRow[]).map(toMedication),
    runs: (runsRes.data ?? []) as PrepRunRow[],
  };
}

/** Chi riceve le email di un piano: proprietario, destinatari aggiuntivi e persone con accesso. */
export function planAudience(data: Pick<CronData, "profiles" | "recipients" | "members">, plan: Pick<PlanRow, "id" | "owner_id">): string[] {
  return uniqueEmails([
    data.profiles.get(plan.owner_id)?.email,
    ...data.recipients.filter((r) => r.plan_id === plan.id).map((r) => r.email),
    ...data.members.filter((m) => m.plan_id === plan.id).map((m) => data.profiles.get(m.user_id)?.email),
  ]);
}
