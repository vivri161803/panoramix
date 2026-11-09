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
import { selectAll } from "@/lib/batch";

export interface CronData {
  plans: PlanRow[];
  /** proprietari e membri dei piani */
  profiles: Map<string, ProfileRow>;
  recipients: { plan_id: string; email: string }[];
  members: { plan_id: string; user_id: string; role: MemberRole }[];
  meds: Medication[];
  runs: PrepRunRow[];
}

/**
 * Tutti i dati che servono ai controlli automatici (con la service role, che ignora RLS).
 * Ogni tabella si legge a pagine ordinate per chiave: Supabase restituisce al massimo 1000 righe
 * per richiesta, e un elenco di identificativi nell'indirizzo (`.in(...)`) diventa troppo lungo
 * con qualche centinaio di piani.
 */
export async function loadCronData(admin: SupabaseClient): Promise<CronData> {
  const planRows = await selectAll<PlanRow>("piani", (from, to) => admin.from("plans").select(PLAN_COLUMNS).order("id").range(from, to));
  if (!planRows.length) return { plans: [], profiles: new Map(), recipients: [], members: [], meds: [], runs: [] };

  const [recipients, members, medRows, runs, profiles] = await Promise.all([
    selectAll<CronData["recipients"][number]>("destinatari", (from, to) => admin.from("plan_recipients").select("plan_id, email").order("id").range(from, to)),
    selectAll<CronData["members"][number]>("membri", (from, to) =>
      admin.from("plan_members").select("plan_id, user_id, role").order("plan_id").order("user_id").range(from, to),
    ),
    selectAll<MedicationRow>("medicinali", (from, to) => admin.from("medications").select(MEDICATION_COLUMNS).eq("archived", false).order("id").range(from, to)),
    selectAll<PrepRunRow>("preparazioni", (from, to) =>
      admin.from("prep_runs").select("id, plan_id, week_start, deductions, created_at, undone_at").is("undone_at", null).order("id").range(from, to),
    ),
    selectAll<ProfileRow>("profili", (from, to) => admin.from("profiles").select("id, email, first_name, last_name").order("id").range(from, to)),
  ]);

  return {
    plans: planRows,
    profiles: new Map(profiles.map((p) => [p.id, p])),
    recipients,
    members,
    meds: medRows.map(toMedication),
    runs,
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
