// Scheda Disponibilità: carenze AIFA ed equivalenti della lista di trasparenza per i medicinali
// del piano. buildAvailability è pura (test: tests/availability.test.ts), loadAvailability legge
// le tabelle aifa_* con il client dell'utente (lettura consentita a chi ha fatto l'accesso).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Medication } from "./db-types";

export interface ShortageRow {
  aic: string;
  started_on: string | null;
  expected_end: string | null;
  equivalent: string;
  reasons: string;
  aifa_suggestions: string;
  aifa_note: string;
  form_strength: string;
}

export interface TransparencyRow {
  aic: string;
  name: string;
  pack_description: string;
  reference_pack: string;
  reference_price: number | string | null;
  public_price: number | string | null;
  price_difference: number | string | null;
  group_code: string;
  prices_as_of: string | null;
}

export interface Equivalent {
  aic: string;
  name: string;
  packDescription: string;
  publicPrice: number | null;
  difference: number | null;
  /** la confezione del piano */
  isPlan: boolean;
}

export interface MedAvailability {
  med: Medication;
  /** il medicinale non ha il codice AIC: niente carenze né equivalenti */
  noAic: boolean;
  shortages: ShortageRow[];
  /** null se l'AIC non è nella lista di trasparenza */
  group: {
    code: string;
    referencePack: string;
    referencePrice: number | null;
    pricesAsOf: string | null;
    equivalents: Equivalent[];
  } | null;
}

const toNum = (v: number | string | null): number | null => (v === null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** Mette insieme carenze ed equivalenti per ogni medicinale, nell'ordine del piano. */
export function buildAvailability(meds: Medication[], shortages: ShortageRow[], transparency: TransparencyRow[]): MedAvailability[] {
  return meds.map((med) => {
    if (!med.aic) return { med, noAic: true, shortages: [], group: null };
    const own = transparency.find((t) => t.aic === med.aic);
    let group: MedAvailability["group"] = null;
    if (own) {
      const equivalents = transparency
        .filter((t) => t.group_code === own.group_code)
        .map((t) => ({ aic: t.aic, name: t.name, packDescription: t.pack_description, publicPrice: toNum(t.public_price), difference: toNum(t.price_difference), isPlan: t.aic === med.aic }))
        // per prezzo al pubblico, quelli senza prezzo in fondo; a parità, per nome
        .sort((a, b) => (a.publicPrice ?? Infinity) - (b.publicPrice ?? Infinity) || a.name.localeCompare(b.name, "it"));
      group = { code: own.group_code, referencePack: own.reference_pack, referencePrice: toNum(own.reference_price), pricesAsOf: own.prices_as_of, equivalents };
    }
    return { med, noAic: false, shortages: shortages.filter((s) => s.aic === med.aic), group };
  });
}

export interface AifaStatusRow {
  source: string;
  source_date: string | null;
  checked_at: string | null;
}

/** Legge le tabelle AIFA per i medicinali del piano: poche righe, query con .in(). */
export async function loadAvailability(supabase: SupabaseClient, meds: Medication[]): Promise<{ items: MedAvailability[]; status: AifaStatusRow[]; error: string | null }> {
  const aics = [...new Set(meds.map((m) => m.aic).filter((a): a is string => !!a))];
  const statusQ = supabase.rpc("aifa_status");
  if (!aics.length) {
    const { data } = await statusQ;
    return { items: buildAvailability(meds, [], []), status: (data ?? []) as AifaStatusRow[], error: null };
  }
  const [sh, own, st] = await Promise.all([
    supabase.from("aifa_shortages").select("aic, started_on, expected_end, equivalent, reasons, aifa_suggestions, aifa_note, form_strength").in("aic", aics).order("started_on", { ascending: false }),
    supabase.from("aifa_transparency").select("group_code").in("aic", aics),
    statusQ,
  ]);
  const groups = [...new Set(((own.data ?? []) as { group_code: string }[]).map((g) => g.group_code))];
  const tr = groups.length
    ? await supabase.from("aifa_transparency").select("aic, name, pack_description, reference_pack, reference_price, public_price, price_difference, group_code, prices_as_of").in("group_code", groups)
    : { data: [], error: null };
  const error = sh.error || own.error || tr.error ? "Non riesco a leggere i dati AIFA adesso. Riprova tra poco." : null;
  return {
    items: buildAvailability(meds, (sh.data ?? []) as ShortageRow[], (tr.data ?? []) as TransparencyRow[]),
    status: (st.data ?? []) as AifaStatusRow[],
    error,
  };
}
