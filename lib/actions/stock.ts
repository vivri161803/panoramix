"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPlanBundle, type PlanBundle } from "@/lib/data";
import type { Medication } from "@/lib/db-types";
import { currentStock, forecastMedication, formatQty, pillsWord, recountClearsOrdered, type AlertType } from "@/lib/forecast";
import { packsSchema, qtySchema } from "@/lib/schemas";
import { dbError, fail, type ActionResult } from "./common";

async function load(planId: string, medicationId: string) {
  const bundle = await getPlanBundle(planId);
  const med = bundle.medications.find((m) => m.id === medicationId);
  return { bundle, med };
}

function refresh(planId: string) {
  revalidatePath(`/piani/${planId}`, "layout");
  revalidatePath("/piani");
}

/**
 * Dopo un arrivo o un nuovo conteggio: chiude gli episodi di avviso
 * delle soglie non più superate (la volta successiva l'avviso potrà ripartire).
 */
async function closeEpisodesIfAbove(bundle: PlanBundle, med: Medication, newQty: number, orderedAt: string | null) {
  const f = forecastMedication(
    { ...med, stockQty: newQty, stockAsOf: bundle.today, orderedAt },
    { plan: bundle.settings, today: bundle.today, nextPrep: bundle.forecast.nextPrep ?? undefined },
  );
  const stillTriggered = new Set<AlertType>(f.triggered);
  const supabase = await createClient();
  const { data: open } = await supabase.from("alert_log").select("id, alert_type").eq("medication_id", med.id).is("closed_at", null);
  const toClose = (open ?? []).filter((e) => !stillTriggered.has(e.alert_type as AlertType)).map((e) => e.id);
  if (toClose.length) {
    await supabase.from("alert_log").update({ closed_at: new Date().toISOString() }).in("id", toClose);
  }
}

export async function arrivePacks(planId: string, medicationId: string, packs: number): Promise<ActionResult<{ eventId: string }>> {
  const { bundle, med } = await load(planId, medicationId);
  if (!med) return fail("Medicinale non trovato.");
  const parsed = packsSchema.safeParse(packs);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const added = parsed.data * med.pillsPerPack;
  const now = currentStock(med, bundle.settings.stockMode, bundle.today);
  const after = now + added;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_stock_event", {
    p_medication_id: med.id,
    p_type: "arrival",
    p_delta: added,
    p_qty_after: after,
    p_effective_date: bundle.today,
    p_expected_qty: med.stockQty,
    p_expected_as_of: med.stockAsOf,
    p_clear_ordered: true,
    p_meta: { packs: parsed.data, prev_ordered_at: med.orderedAt },
  });
  if (error) return fail(dbError(error, "Non riesco a registrare l’arrivo. Riprova."));
  await closeEpisodesIfAbove(bundle, med, after, null);
  refresh(planId);
  return { ok: true, message: `Aggiunte ${formatQty(added)} ${pillsWord(added)} di ${med.name}`, data: { eventId: data as string } };
}

export async function recountStock(planId: string, medicationId: string, qty: number): Promise<ActionResult<{ eventId: string }>> {
  const { bundle, med } = await load(planId, medicationId);
  if (!med) return fail("Medicinale non trovato.");
  const parsed = qtySchema.safeParse(qty);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const now = currentStock(med, bundle.settings.stockMode, bundle.today);
  // "Ordinata" resta finché il nuovo conteggio non è sopra tutte le soglie
  const fNew = forecastMedication(
    { ...med, stockQty: parsed.data, stockAsOf: bundle.today, orderedAt: null },
    { plan: bundle.settings, today: bundle.today, nextPrep: bundle.forecast.nextPrep ?? undefined },
  );
  const clearOrdered = !!med.orderedAt && recountClearsOrdered(fNew);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_stock_event", {
    p_medication_id: med.id,
    p_type: "count",
    p_delta: parsed.data - now,
    p_qty_after: parsed.data,
    p_effective_date: bundle.today,
    p_expected_qty: med.stockQty,
    p_expected_as_of: med.stockAsOf,
    p_clear_ordered: clearOrdered,
    p_meta: { previous: now, prev_ordered_at: clearOrdered ? med.orderedAt : undefined },
  });
  if (error) return fail(dbError(error, "Non riesco a salvare il conteggio. Riprova."));
  await closeEpisodesIfAbove(bundle, med, parsed.data, clearOrdered ? null : med.orderedAt);
  refresh(planId);
  return {
    ok: true,
    message: `Conteggio di ${med.name} aggiornato: ${formatQty(parsed.data)} ${pillsWord(parsed.data)}`,
    data: { eventId: data as string },
  };
}

export async function toggleOrdered(planId: string, medicationId: string): Promise<ActionResult> {
  const { med } = await load(planId, medicationId);
  if (!med) return fail("Medicinale non trovato.");
  const supabase = await createClient();
  const orderedAt = med.orderedAt ? null : new Date().toISOString();
  const { error } = await supabase.from("medications").update({ ordered_at: orderedAt }).eq("id", med.id);
  if (error) return fail(dbError(error));
  refresh(planId);
  return { ok: true, message: orderedAt ? `${med.name} segnata come ordinata` : `${med.name}: ordine annullato` };
}

/** Annulla l'ultimo movimento (arrivo o conteggio) con un movimento opposto. */
export async function undoStockEvent(planId: string, medicationId: string, eventId: string): Promise<ActionResult> {
  const { bundle, med } = await load(planId, medicationId);
  if (!med) return fail("Medicinale non trovato.");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("stock_events")
    .select("id, type, delta, meta")
    .eq("medication_id", med.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last || last.id !== eventId || !["arrival", "count"].includes(last.type)) {
    return fail("Questo movimento non si può più annullare.");
  }
  const delta = Number(last.delta);
  const now = currentStock(med, bundle.settings.stockMode, bundle.today);
  const after = Math.max(0, now - delta);
  const { error } = await supabase.rpc("record_stock_event", {
    p_medication_id: med.id,
    p_type: "adjust",
    p_delta: after - now,
    p_qty_after: after,
    p_effective_date: bundle.today,
    p_expected_qty: med.stockQty,
    p_expected_as_of: med.stockAsOf,
    p_clear_ordered: false,
    p_meta: { undo_of: last.id },
  });
  if (error) return fail(dbError(error, "Non riesco ad annullare. Riprova."));
  const prevOrdered = (last.meta as { prev_ordered_at?: string | null })?.prev_ordered_at;
  if (prevOrdered) await supabase.from("medications").update({ ordered_at: prevOrdered }).eq("id", med.id);
  refresh(planId);
  return { ok: true, message: "Azione annullata" };
}

export async function preparePillbox(planId: string): Promise<ActionResult<{ runId: string }>> {
  const bundle = await getPlanBundle(planId);
  if (bundle.settings.stockMode !== "weekly" || !bundle.forecast.prepWeek) return fail("Il piano non usa il portapillole settimanale.");
  const items = bundle.forecast.prepPreview;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_prep", {
    p_plan_id: planId,
    p_week_start: bundle.forecast.prepWeek,
    p_today: bundle.today,
    p_items: items.map((i) => ({ medication_id: i.medicationId, take: i.take })),
  });
  if (error) {
    if (error.code === "23505") return fail("Il portapillole di questa settimana risulta già preparato.");
    return fail(dbError(error, "Non riesco a registrare la preparazione. Riprova."));
  }
  const total = items.reduce((s, i) => s + i.take, 0);
  refresh(planId);
  return { ok: true, message: `Portapillole preparato: tolte ${formatQty(total)} ${pillsWord(total)} dalle scorte`, data: { runId: data as string } };
}

export async function undoPillbox(planId: string, runId: string): Promise<ActionResult> {
  const bundle = await getPlanBundle(planId);
  if (!bundle.runRows.some((r) => r.id === runId)) return fail("Preparazione non trovata.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_prep", { p_run_id: runId, p_today: bundle.today });
  if (error) return fail(dbError(error, "Non riesco ad annullare la preparazione. Riprova."));
  refresh(planId);
  return { ok: true, message: "Preparazione annullata: compresse rimesse nelle scorte" };
}
