"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPlanBundle, type PlanBundle } from "@/lib/data";
import type { Medication } from "@/lib/db-types";
import { maxDate, type ISODate } from "@/lib/dates";
import { currentStock, forecastMedication, formatQty, recountClearsOrdered, type AlertType } from "@/lib/forecast";
import { containerWord, defaultMode, isLevel, levelQuantity } from "@/lib/categories";
import { doseSchema, levelQtySchema, packsSchema, qtySchema } from "@/lib/schemas";
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
 * Data della scorta salvata dopo un movimento che cambia solo la scorta in casa (arrivo, presa al
 * bisogno e i loro annullamenti): se stock_as_of è nel futuro, le dosi fino a quel giorno sono già
 * nel portapillole e non si toccano. Un riconteggio, invece, conta tutto e si salva a oggi.
 */
/** «12 compresse», «1 flacone e mezzo» (a livello senza arrotondare a mezze unità) */
function qtyText(med: Medication, q: number): string {
  return isLevel(med) ? levelQuantity(q, med) : `${formatQty(q)} ${containerWord(med, q)}`;
}

function homeStockDate(bundle: PlanBundle, med: Medication): ISODate {
  return maxDate(bundle.today, med.stockAsOf);
}

/**
 * Dopo un arrivo o un nuovo conteggio: chiude gli episodi di avviso
 * delle soglie non più superate (la volta successiva l'avviso potrà ripartire).
 * `asOf` è la data della scorta appena salvata.
 */
async function closeEpisodesIfAbove(bundle: PlanBundle, med: Medication, newQty: number, asOf: ISODate, orderedAt: string | null) {
  const f = forecastMedication({ ...med, stockQty: newQty, stockAsOf: asOf, orderedAt }, { plan: bundle.settings, today: bundle.today });
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
  const now = currentStock(med, bundle.today);
  const after = now + added;
  const asOf = homeStockDate(bundle, med);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_stock_event", {
    p_medication_id: med.id,
    p_type: "arrival",
    p_delta: added,
    p_qty_after: after,
    p_effective_date: asOf,
    p_expected_qty: med.stockQty,
    p_expected_as_of: med.stockAsOf,
    p_clear_ordered: true,
    p_meta: { packs: parsed.data, prev_ordered_at: med.orderedAt },
  });
  if (error) return fail(dbError(error, "Non riesco a registrare l’arrivo. Riprova."));
  await closeEpisodesIfAbove(bundle, med, after, asOf, null);
  refresh(planId);
  return { ok: true, message: `${med.name}: aggiunt${added === 1 ? "o" : "i"} ${formatQty(added)} ${containerWord(med, added)}`, data: { eventId: data as string } };
}

export async function recountStock(planId: string, medicationId: string, qty: number): Promise<ActionResult<{ eventId: string }>> {
  const { bundle, med, denied } = await load(planId, medicationId);
  if (!med) return fail(denied ?? "Medicinale non trovato.");
  // a pezzi multipli di ½; a livello contenitori chiusi + quello aperto (pieno, metà, quasi finito, nessuno)
  const parsed = (isLevel(med) ? levelQtySchema : qtySchema).safeParse(qty);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const now = currentStock(med, bundle.today);
  // "Ordinata" resta finché il nuovo conteggio non è sopra tutte le soglie.
  // Il conteggio comprende anche il portapillole: si salva a oggi.
  const fNew = forecastMedication({ ...med, stockQty: parsed.data, stockAsOf: bundle.today, orderedAt: null }, { plan: bundle.settings, today: bundle.today });
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
  await closeEpisodesIfAbove(bundle, med, parsed.data, bundle.today, clearOrdered ? null : med.orderedAt);
  refresh(planId);
  return {
    ok: true,
    message: `Conteggio di ${med.name} aggiornato: ${qtyText(med, parsed.data)}`,
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
  const now = currentStock(med, bundle.today);
  const after = Math.max(0, now - delta);
  // stessa data del movimento annullato: un conteggio vale a oggi, arrivo e presa sulla scorta in casa
  const asOf = last.type === "count" ? bundle.today : homeStockDate(bundle, med);
  const { error } = await supabase.rpc("record_stock_event", {
    p_medication_id: med.id,
    p_type: "adjust",
    p_delta: after - now,
    p_qty_after: after,
    p_effective_date: asOf,
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

/**
 * Medicinale al bisogno: registra una presa e la toglie dalle scorte. Nelle categorie a livello
 * («Finito un flacone») la quantità è 1 contenitore.
 */
export async function takeAsNeeded(planId: string, medicationId: string, qty: number): Promise<ActionResult<{ eventId: string }>> {
  const { bundle, med, denied } = await load(planId, medicationId);
  if (!med) return fail(denied ?? "Medicinale non trovato.");
  if (med.frequencyType !== "as_needed") return fail("Si registrano le prese solo per i medicinali al bisogno.");
  const parsed = doseSchema.safeParse(qty);
  if (!parsed.success || parsed.data <= 0) return fail(parsed.success ? `Indica quante ${containerWord(med, 2)} sono state prese.` : parsed.error.issues[0].message);
  const now = currentStock(med, bundle.today);
  if (now <= 0) return fail(`${med.name} risulta finita: ricontrolla il conteggio o registra un arrivo.`);
  const taken = Math.min(parsed.data, now);
  const after = now - taken;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_stock_event", {
    p_medication_id: med.id,
    p_type: "use",
    p_delta: -taken,
    p_qty_after: after,
    p_effective_date: homeStockDate(bundle, med),
    p_expected_qty: med.stockQty,
    p_expected_as_of: med.stockAsOf,
    p_clear_ordered: false,
    p_meta: { taken },
  });
  if (error) return fail(dbError(error, "Non riesco a registrare la presa. Riprova."));
  refresh(planId);
  return {
    ok: true,
    // nelle categorie a livello si toglie un contenitore finito («1 flacone in meno»), altrimenti una presa
    message:
      defaultMode(med.category) === "livello"
        ? `${med.name}: ${formatQty(taken)} ${containerWord(med, taken)} in meno, ne restano ${formatQty(after)}`
        : `${med.name}: presa ${formatQty(taken)} ${containerWord(med, taken)}, ne restano ${formatQty(after)}`,
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
