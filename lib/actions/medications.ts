"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlanBundle } from "@/lib/data";
import { currentStock } from "@/lib/forecast";
import { medicationSchema, type MedicationInput } from "@/lib/schemas";
import { dbError, fail, flash, zodFail, type ActionResult } from "./common";

function medFields(m: ReturnType<typeof medicationSchema.parse>) {
  const f = m.frequency_type;
  return {
    name: m.name,
    strength: m.strength,
    description: m.description,
    pills_per_pack: m.pills_per_pack,
    requires_prescription: m.requires_prescription,
    color: m.color,
    shape: m.shape,
    dose_morning: m.dose_morning,
    dose_noon: m.dose_noon,
    dose_evening: m.dose_evening,
    frequency_type: f,
    weekdays: f === "weekdays" ? [...new Set(m.weekdays)].sort() : [],
    interval_days: f === "every_n_days" ? m.interval_days : null,
    cycle_on: f === "cycle" ? m.cycle_on : null,
    cycle_off: f === "cycle" ? m.cycle_off : null,
    start_date: m.start_date,
    end_date: m.end_date,
  };
}

export async function createMedication(planId: string, input: MedicationInput, another = false): Promise<ActionResult> {
  const bundle = await getPlanBundle(planId);
  const parsed = medicationSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const m = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medications")
    .insert({ ...medFields(m), plan_id: planId, stock_qty: m.stock_qty, stock_as_of: bundle.today })
    .select("id")
    .single();
  if (error || !data) return fail(dbError(error, "Non riesco a salvare il medicinale. Riprova."));
  await supabase.from("stock_events").insert({
    medication_id: data.id,
    type: "count",
    delta: m.stock_qty,
    qty_after: m.stock_qty,
    effective_date: bundle.today,
    meta: { initial: true },
  });
  revalidatePath(`/piani/${planId}`, "layout");
  await flash(`${m.name} aggiunto`);
  redirect(another ? `/piani/${planId}/medicinali/nuovo` : `/piani/${planId}`);
}

export async function updateMedication(planId: string, medicationId: string, input: MedicationInput): Promise<ActionResult> {
  const bundle = await getPlanBundle(planId);
  const med = bundle.medications.find((x) => x.id === medicationId);
  if (!med) return fail("Medicinale non trovato.");
  const parsed = medicationSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const m = parsed.data;
  const supabase = await createClient();

  // Il consumo fino a ieri segue il vecchio schema: si "ribasa" il riferimento a oggi
  // prima di salvare il nuovo schema.
  const now = currentStock(med, bundle.settings.stockMode, bundle.today);
  const { data: updated, error } = await supabase
    .from("medications")
    .update({ ...medFields(m), stock_qty: now, stock_as_of: bundle.today })
    .eq("id", medicationId)
    .eq("stock_qty", med.stockQty)
    .eq("stock_as_of", med.stockAsOf)
    .select("id");
  if (error) return fail(dbError(error, "Non riesco a salvare il medicinale. Riprova."));
  if (!updated?.length) return fail("Le scorte sono cambiate nel frattempo: ricarica la pagina e riprova.");

  // scorta modificata a mano nel modulo = nuovo conteggio
  if (Math.abs(m.stock_qty - now) > 1e-9) {
    const { error: cErr } = await supabase.rpc("record_stock_event", {
      p_medication_id: medicationId,
      p_type: "count",
      p_delta: m.stock_qty - now,
      p_qty_after: m.stock_qty,
      p_effective_date: bundle.today,
      p_expected_qty: now,
      p_expected_as_of: bundle.today,
      p_clear_ordered: false,
      p_meta: { source: "edit" },
    });
    if (cErr) return fail(dbError(cErr, "Medicinale salvato, ma non riesco a registrare il nuovo conteggio."));
  }

  revalidatePath(`/piani/${planId}`, "layout");
  await flash(`${m.name} salvato`);
  redirect(`/piani/${planId}`);
}

export async function deleteMedication(planId: string, medicationId: string): Promise<ActionResult> {
  const bundle = await getPlanBundle(planId);
  const med = bundle.medications.find((x) => x.id === medicationId);
  if (!med) return fail("Medicinale non trovato.");
  const supabase = await createClient();
  const { error } = await supabase.from("medications").delete().eq("id", medicationId);
  if (error) return fail(dbError(error, "Non riesco a eliminare il medicinale. Riprova."));
  revalidatePath(`/piani/${planId}`, "layout");
  await flash(`${med.name} tolto dal piano`);
  redirect(`/piani/${planId}`);
}
