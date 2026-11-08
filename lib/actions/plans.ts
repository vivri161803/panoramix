"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlanBundle, requireProfile } from "@/lib/data";
import { currentStock } from "@/lib/forecast";
import { planSchema, type PlanInput } from "@/lib/schemas";
import { dbError, fail, flash, zodFail, type ActionResult } from "./common";

function planFields(p: ReturnType<typeof planSchema.parse>) {
  return {
    patient_name: p.patient_name,
    notes: p.notes,
    prep_weekday: p.prep_weekday,
    alert_under_14: p.alert_under_14,
    alert_under_7: p.alert_under_7,
    alert_last_pack: p.alert_last_pack,
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
    .insert({ ...planFields(p), stock_mode: p.stock_mode, owner_id: profile.id })
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

  // cambio di modalità: serve un nuovo conteggio di ogni medicinale
  if (p.stock_mode !== bundle.plan.stock_mode) {
    const counts = p.counts ?? [];
    const missing = bundle.medications.filter((m) => !counts.some((c) => c.medication_id === m.id));
    if (missing.length) {
      return fail("Per cambiare modalità ricontrolla le compresse di ogni medicinale.", { counts: "Inserisci il conteggio di ogni medicinale." });
    }
    const payload = bundle.medications.map((m) => ({
      medication_id: m.id,
      qty: counts.find((c) => c.medication_id === m.id)!.qty,
      previous: currentStock(m, bundle.settings.stockMode, bundle.today),
    }));
    const { error: mErr } = await supabase.rpc("change_stock_mode", {
      p_plan_id: planId,
      p_mode: p.stock_mode,
      p_today: bundle.today,
      p_counts: payload,
    });
    if (mErr) return fail(dbError(mErr, "Non riesco a cambiare modalità. Riprova."));
  }

  revalidatePath(`/piani/${planId}`, "layout");
  await flash("Piano salvato");
  redirect(`/piani/${planId}`);
}

export async function deletePlan(planId: string): Promise<ActionResult> {
  const bundle = await getPlanBundle(planId);
  const supabase = await createClient();
  const { error } = await supabase.from("plans").delete().eq("id", planId);
  if (error) return fail(dbError(error, "Non riesco a eliminare il piano. Riprova."));
  revalidatePath("/piani");
  await flash(`Piano di ${bundle.plan.patient_name} eliminato`);
  redirect("/piani");
}
