"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPlanBundle, type PlanBundle } from "@/lib/data";
import type { Medication } from "@/lib/db-types";
import { currentStock, forecastMedication, formatQty, pillsWord, recountClearsOrdered, type AlertType } from "@/lib/forecast";
import { doseSchema, packsSchema, qtySchema } from "@/lib/schemas";
import { canEdit, READ_ONLY_MESSAGE } from "@/lib/roles";
import { dbError, fail, type ActionResult } from "./common";

/** Piano e medicinale, solo se l'utente può modificarli (altrimenti `med` è undefined e `denied` spiega perché). */
async function load(planId: string, medicationId: string) {
  const bundle = await getPlanBundle(planId);
  if (!canEdit(bundle.role)) return { bundle, med: undefined, denied: READ_ONLY_MESSAGE };
  const med = bundle.medications.find((m) => m.id === medicationId);
  return { bundle, med, denied: med ? null : "Medicinale non trovato." };
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
  const { bundle, med, denied } = await load(planId, medicationId);
  if (!med) return fail(denied ?? "Medicinale non trovato.");
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
  const { bundle, med, denied } = await load(planId, medicationId);
  if (!med) return fail(denied ?? "Medicinale non trovato.");
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
  const { med, denied } = await load(planId, medicationId);
  if (!med) return fail(denied ?? "Medicinale non trovato.");
  const supabase = await createClient();
  const orderedAt = med.orderedAt ? null : new Date().toISOString();
  const { error } = await supabase.from("medications").update({ ordered_at: orderedAt }).eq("id", med.id);
  if (error) return fail(dbError(error));
  refresh(planId);
  return { ok: true, message: orderedAt ? `${med.name} segnata come ordinata` : `${med.name}: ordine annullato` };
}

/** Annulla l'ultimo movimento (arrivo o conteggio) con un movimento opposto. */
export async function undoStockEvent(planId: string, medicationId: string, eventId: string): Promise<ActionResult> {
  const { bundle, med, denied } = await load(planId, medicationId);
  if (!med) return fail(denied ?? "Medicinale non trovato.");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("stock_events")
    .select("id, type, delta, meta")
    .eq("medication_id", med.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last || last.id !== eventId || !["arrival", "count", "use"].includes(last.type)) {
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

/** Medicinale al bisogno: registra una presa e toglie le compresse dalle scorte. */
export async function takeAsNeeded(planId: string, medicationId: string, qty: number): Promise<ActionResult<{ eventId: string }>> {
  const { bundle, med, denied } = await load(planId, medicationId);
  if (!med) return fail(denied ?? "Medicinale non trovato.");
  if (med.frequencyType !== "as_needed") return fail("Si registrano le prese solo per i medicinali al bisogno.");
  const parsed = doseSchema.safeParse(qty);
  if (!parsed.success || parsed.data <= 0) return fail(parsed.success ? "Indica quante compresse sono state prese." : parsed.error.issues[0].message);
  const now = currentStock(med, bundle.settings.stockMode, bundle.today);
  if (now <= 0) return fail(`${med.name} risulta finita: ricontrolla il conteggio o registra un arrivo.`);
  const taken = Math.min(parsed.data, now);
  const after = now - taken;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_stock_event", {
    p_medication_id: med.id,
    p_type: "use",
    p_delta: -taken,
    p_qty_after: after,
    p_effective_date: bundle.today,
    p_expected_qty: med.stockQty,
    p_expected_as_of: med.stockAsOf,
    p_clear_ordered: false,
    p_meta: { taken },
  });
  if (error) return fail(dbError(error, "Non riesco a registrare la presa. Riprova."));
  refresh(planId);
  return {
    ok: true,
    message: `${med.name}: presa ${formatQty(taken)} ${pillsWord(taken)}, ne restano ${formatQty(after)}`,
    data: { eventId: data as string },
  };
}

/** Segna come ordinati più medicinali insieme (dalla lista per la farmacia). */
export async function markOrdered(planId: string, medicationIds: string[]): Promise<ActionResult> {
  const bundle = await getPlanBundle(planId);
  if (!canEdit(bundle.role)) return fail(READ_ONLY_MESSAGE);
  const ids = bundle.medications.filter((m) => medicationIds.includes(m.id) && !m.orderedAt).map((m) => m.id);
  if (!ids.length) return fail("Questi medicinali risultano già ordinati.");
  const supabase = await createClient();
  const { error } = await supabase.from("medications").update({ ordered_at: new Date().toISOString() }).in("id", ids);
  if (error) return fail(dbError(error));
  refresh(planId);
  return { ok: true, message: ids.length === 1 ? "1 medicinale segnato come ordinato" : `${ids.length} medicinali segnati come ordinati` };
}

export async function preparePillbox(planId: string): Promise<ActionResult<{ runId: string }>> {
  const bundle = await getPlanBundle(planId);
  if (!canEdit(bundle.role)) return fail(READ_ONLY_MESSAGE);
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
  if (!canEdit(bundle.role)) return fail(READ_ONLY_MESSAGE);
  if (!bundle.runRows.some((r) => r.id === runId)) return fail("Preparazione non trovata.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_prep", { p_run_id: runId, p_today: bundle.today });
  if (error) return fail(dbError(error, "Non riesco ad annullare la preparazione. Riprova."));
  refresh(planId);
  return { ok: true, message: "Preparazione annullata: compresse rimesse nelle scorte" };
}
