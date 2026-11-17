"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlanBundle, requireProfile } from "@/lib/data";
import { planSchema, type PlanInput } from "@/lib/schemas";
import { isOwner, OWNER_ONLY_MESSAGE } from "@/lib/roles";
import { dbError, fail, flash, zodFail, type ActionResult } from "./common";

function planFields(p: ReturnType<typeof planSchema.parse>) {
  return {
    patient_name: p.patient_name,
    notes: p.notes,
    prep_weekday: p.prep_weekday,
    alert_under_14: p.alert_under_14,
    alert_under_7: p.alert_under_7,
    alert_last_pack: p.alert_last_pack,
    prep_reminder: p.prep_reminder,
    weekly_summary: p.weekly_summary,
  };
}

export async function createPlan(input: PlanInput): Promise<ActionResult> {
  const profile = await requireProfile();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const p = parsed.data;
  if (p.recipients.includes(profile.email.toLowerCase())) {
    return fail("Il tuo indirizzo riceve già gli avvisi.", { recipients: "Il tuo indirizzo riceve già gli avvisi." });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .insert({ ...planFields(p), owner_id: profile.id })
    .select("id")
    .single();
  if (error || !data) return fail(dbError(error, "Non riesco a creare il piano. Riprova."));
  if (p.recipients.length) {
    const { error: rErr } = await supabase.from("plan_recipients").insert(p.recipients.map((email) => ({ plan_id: data.id, email })));
    if (rErr) return fail(dbError(rErr, "Piano creato, ma non riesco a salvare i destinatari. Riprova dalle impostazioni."));
  }
  await flash(`Piano di ${p.patient_name} creato`);
  redirect(`/piani/${data.id}`);
}

export async function updatePlan(planId: string, input: PlanInput): Promise<ActionResult> {
  const bundle = await getPlanBundle(planId);
  if (!isOwner(bundle.role)) return fail(OWNER_ONLY_MESSAGE);
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const p = parsed.data;
  if (p.recipients.includes(bundle.profile.email.toLowerCase())) {
    return fail("Il tuo indirizzo riceve già gli avvisi.", { recipients: "Il tuo indirizzo riceve già gli avvisi." });
  }
  const supabase = await createClient();

  const { error } = await supabase.from("plans").update(planFields(p)).eq("id", planId);
  if (error) return fail(dbError(error, "Non riesco a salvare il piano. Riprova."));

  // destinatari: togli quelli rimossi, aggiungi i nuovi
  const current = bundle.recipients.map((r) => r.email);
  const removed = bundle.recipients.filter((r) => !p.recipients.includes(r.email)).map((r) => r.id);
  const added = p.recipients.filter((e) => !current.includes(e));
  if (removed.length) {
    const { error: dErr } = await supabase.from("plan_recipients").delete().in("id", removed);
    if (dErr) return fail(dbError(dErr));
  }
  if (added.length) {
    const { error: iErr } = await supabase.from("plan_recipients").insert(added.map((email) => ({ plan_id: planId, email })));
    if (iErr) return fail(dbError(iErr));
  }

  revalidatePath(`/piani/${planId}`, "layout");
  await flash("Piano salvato");
  redirect(`/piani/${planId}`);
}

export async function deletePlan(planId: string): Promise<ActionResult> {
  const bundle = await getPlanBundle(planId);
  if (!isOwner(bundle.role)) return fail(OWNER_ONLY_MESSAGE);
  const supabase = await createClient();
  const { error } = await supabase.from("plans").delete().eq("id", planId);
  if (error) return fail(dbError(error, "Non riesco a eliminare il piano. Riprova."));
  revalidatePath("/piani");
  await flash(`Piano di ${bundle.plan.patient_name} eliminato`);
  redirect("/piani");
}
