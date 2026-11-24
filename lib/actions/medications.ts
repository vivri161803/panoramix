"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlanBundle } from "@/lib/data";
import { currentStock, dosesPhrase, totalPerDose } from "@/lib/forecast";
import { formatShort, maxDate } from "@/lib/dates";
import { doseChangeSchema, levelQtySchema, medicationSchema, qtySchema, type DoseChangeInput, type MedicationInput } from "@/lib/schemas";
import { canEdit, READ_ONLY_MESSAGE } from "@/lib/roles";
import { atcColor, ATC_UNKNOWN_VALUE } from "@/lib/atc";
import { isLevel } from "@/lib/categories";
import { dbError, fail, flash, zodFail, type ActionResult } from "./common";

type ParsedMedication = ReturnType<typeof medicationSchema.parse>;

/**
 * Codice ATC da salvare: quello dell'anagrafica AIFA se l'AIC è noto (vale più del modulo),
 * altrimenti quello scelto; "Non so" diventa null.
 */
async function resolveAtc(supabase: Awaited<ReturnType<typeof createClient>>, m: ParsedMedication): Promise<string | null> {
  if (m.aic) {
    const { data } = await supabase.from("aifa_packs").select("atc_code").eq("aic", m.aic).maybeSingle();
    if (data?.atc_code) return data.atc_code;
  }
  return m.atc_code === ATC_UNKNOWN_VALUE ? null : m.atc_code;
}

function medFields(m: ParsedMedication, atcCode: string | null) {
  const f = m.frequency_type;
  return {
    name: m.name,
    strength: m.strength,
    description: m.description,
    pills_per_pack: m.pills_per_pack,
    requires_prescription: m.requires_prescription,
    aic: m.aic,
    atc_code: atcCode,
    // il colore dipende dal gruppo ATC: grigio per "Non so"
    color: atcColor(atcCode),
    category: m.category,
    shape: m.category === "pillola" ? m.shape : null,
    // a livello: giorni di uso per contenitore; al bisogno si conta sempre a pezzi
    days_per_pack: f === "as_needed" ? null : (m.days_per_pack ?? null),
    // al bisogno non ci sono dosi programmate
    dose_morning: f === "as_needed" ? 0 : m.dose_morning,
    dose_noon: f === "as_needed" ? 0 : m.dose_noon,
    dose_evening: f === "as_needed" ? 0 : m.dose_evening,
    frequency_type: f,
    weekdays: f === "weekdays" ? [...new Set(m.weekdays)].sort() : [],
    interval_days: f === "every_n_days" ? m.interval_days : null,
    cycle_on: f === "cycle" ? m.cycle_on : null,
    cycle_off: f === "cycle" ? m.cycle_off : null,
    start_date: m.start_date,
    end_date: m.end_date,
  };
}

const STOCK_MISSING = "Indica quanto c’è in casa.";

/** Scorta indicata nel modulo, nel modo del medicinale: a pezzi multipli di ½, a livello chiusi + aperto. */
function checkStock(qty: number, level: boolean): string | null {
  const r = (level ? levelQtySchema : qtySchema).safeParse(qty);
  return r.success ? null : r.error.issues[0].message;
}

export async function createMedication(planId: string, input: MedicationInput, another = false): Promise<ActionResult> {
  const bundle = await getPlanBundle(planId);
  if (!canEdit(bundle.role)) return fail(READ_ONLY_MESSAGE);
  const parsed = medicationSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const m = parsed.data;
  if (m.stock_qty == null) return fail(STOCK_MISSING, { stock_qty: STOCK_MISSING });
  const stockErr = checkStock(m.stock_qty, m.frequency_type !== "as_needed" && m.days_per_pack != null);
  if (stockErr) return fail(stockErr, { stock_qty: stockErr });
  const supabase = await createClient();
  const atc = await resolveAtc(supabase, m);
  const { data, error } = await supabase
    .from("medications")
    .insert({ ...medFields(m, atc), plan_id: planId, stock_qty: m.stock_qty, stock_as_of: bundle.today })
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
  if (!canEdit(bundle.role)) return fail(READ_ONLY_MESSAGE);
  const med = bundle.medications.find((x) => x.id === medicationId);
  if (!med) return fail("Medicinale non trovato.");
  const parsed = medicationSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const m = parsed.data;

  // Modo di conteggio: la scorta vecchia è in un'altra unità (pezzi o contenitori) e non passa mai da
  // un modo all'altro. Con un cambio di modo serve la scorta nel modo nuovo, registrata come conteggio.
  const newLevel = m.frequency_type !== "as_needed" && m.days_per_pack != null;
  const modeChanged = newLevel !== isLevel(med);
  if (modeChanged && m.stock_qty == null) {
    const msg = "Hai cambiato il modo di conteggio: indica quanto c’è in casa nel nuovo modo.";
    return fail(msg, { stock_qty: msg });
  }
  if (m.stock_qty != null && (modeChanged || !newLevel)) {
    const stockErr = checkStock(m.stock_qty, newLevel);
    if (stockErr) return fail(stockErr, { stock_qty: stockErr });
  }
  const supabase = await createClient();

  // Il consumo fino a ieri segue il vecchio schema: si "ribasa" il riferimento a oggi
  // prima di salvare il nuovo schema. Una scorta scritta nel modulo conta anche il portapillole
  // e vale da oggi; altrimenti, con stock_as_of nel futuro (dosi già nel portapillole), il
  // riferimento resta a quel giorno. A livello, senza cambio di modo, la scorta non arriva dal modulo.
  const now = currentStock(med, bundle.today);
  const recounted = modeChanged || (!newLevel && m.stock_qty != null && Math.abs(m.stock_qty - now) > 1e-9);
  const asOf = recounted ? bundle.today : maxDate(bundle.today, med.stockAsOf);
  const atc = await resolveAtc(supabase, m);
  const { data: updated, error } = await supabase
    .from("medications")
    .update({ ...medFields(m, atc), stock_qty: now, stock_as_of: asOf })
    .eq("id", medicationId)
    .eq("stock_qty", med.stockQty)
    .eq("stock_as_of", med.stockAsOf)
    .select("id");
  if (error) return fail(dbError(error, "Non riesco a salvare il medicinale. Riprova."));
  if (!updated?.length) return fail("Le scorte sono cambiate nel frattempo: ricarica la pagina e riprova.");

  // Il modulo parte dalle dosi in vigore oggi: i cambi già iniziati confluiscono nelle dosi
  // del medicinale (il riferimento è stato appena portato a oggi), restano solo quelli futuri.
  const started = (med.doseChanges ?? []).filter((c) => c.from <= bundle.today && c.id).map((c) => c.id!);
  if (started.length) {
    const { error: dcErr } = await supabase.from("dose_changes").delete().in("id", started);
    if (dcErr) return fail(dbError(dcErr, "Medicinale salvato, ma non riesco ad aggiornare i cambi di dose."));
  }

  // scorta modificata a mano nel modulo, o nel modo nuovo = nuovo conteggio
  if (recounted) {
    const qty = m.stock_qty!;
    const { error: cErr } = await supabase.rpc("record_stock_event", {
      p_medication_id: medicationId,
      p_type: "count",
      // dopo un cambio di modo la scorta di prima è in un'altra unità: il conteggio riparte da zero
      p_delta: modeChanged ? qty : qty - now,
      p_qty_after: qty,
      p_effective_date: bundle.today,
      p_expected_qty: now,
      p_expected_as_of: asOf,
      p_clear_ordered: false,
      p_meta: modeChanged ? { source: "edit", reason: "mode_change", previous: now } : { source: "edit" },
    });
    if (cErr) return fail(dbError(cErr, "Medicinale salvato, ma non riesco a registrare il nuovo conteggio."));
  }

  revalidatePath(`/piani/${planId}`, "layout");
  await flash(`${m.name} salvato`);
  redirect(`/piani/${planId}`);
}

export async function deleteMedication(planId: string, medicationId: string): Promise<ActionResult> {
  const bundle = await getPlanBundle(planId);
  if (!canEdit(bundle.role)) return fail(READ_ONLY_MESSAGE);
  const med = bundle.medications.find((x) => x.id === medicationId);
  if (!med) return fail("Medicinale non trovato.");
  const supabase = await createClient();
  const { error } = await supabase.from("medications").delete().eq("id", medicationId);
  if (error) return fail(dbError(error, "Non riesco a eliminare il medicinale. Riprova."));
  revalidatePath(`/piani/${planId}`, "layout");
  await flash(`${med.name} tolto dal piano`);
  redirect(`/piani/${planId}`);
}

/**
 * Programma un cambio di dose da domani in poi (le dosi di oggi si cambiano dal modulo).
 * Sostituisce un cambio già previsto per lo stesso giorno.
 */
export async function addDoseChange(planId: string, medicationId: string, input: DoseChangeInput): Promise<ActionResult> {
  const bundle = await getPlanBundle(planId);
  if (!canEdit(bundle.role)) return fail(READ_ONLY_MESSAGE);
  const med = bundle.medications.find((x) => x.id === medicationId);
  if (!med) return fail("Medicinale non trovato.");
  if (med.frequencyType === "as_needed") return fail("I medicinali al bisogno non hanno dosi programmate.");
  const parsed = doseChangeSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const c = parsed.data;
  if (c.effective_date <= bundle.today) {
    return fail("Scegli un giorno da domani in poi.", { effective_date: "Da domani in poi: per cambiare le dosi da oggi usa il modulo qui sopra." });
  }
  if (med.endDate && c.effective_date > med.endDate) {
    return fail("Il cambio è dopo la fine della terapia.", { effective_date: `La terapia finisce ${formatShort(med.endDate)}.` });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("dose_changes")
    .upsert({ medication_id: med.id, effective_date: c.effective_date, dose_morning: c.dose_morning, dose_noon: c.dose_noon, dose_evening: c.dose_evening }, { onConflict: "medication_id,effective_date" });
  if (error) return fail(dbError(error, "Non riesco a salvare il cambio di dose. Riprova."));
  revalidatePath(`/piani/${planId}`, "layout");
  const doses = { doseMorning: c.dose_morning, doseNoon: c.dose_noon, doseEvening: c.dose_evening };
  const what = totalPerDose(doses) > 0 ? dosesPhrase(doses) : "sospesa";
  return { ok: true, message: `${med.name} da ${formatShort(c.effective_date)}: ${what}` };
}

export async function deleteDoseChange(planId: string, medicationId: string, changeId: string): Promise<ActionResult> {
  const bundle = await getPlanBundle(planId);
  if (!canEdit(bundle.role)) return fail(READ_ONLY_MESSAGE);
  const med = bundle.medications.find((x) => x.id === medicationId);
  if (!med?.doseChanges?.some((c) => c.id === changeId)) return fail("Cambio di dose non trovato.");
  const supabase = await createClient();
  const { error } = await supabase.from("dose_changes").delete().eq("id", changeId);
  if (error) return fail(dbError(error, "Non riesco a togliere il cambio di dose. Riprova."));
  revalidatePath(`/piani/${planId}`, "layout");
  return { ok: true, message: "Cambio di dose tolto" };
}
