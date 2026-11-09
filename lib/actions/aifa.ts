"use server";

import { createClient } from "@/lib/supabase/server";
import { packToForm, parseScan, SERIAL_HINT, type AicLookup, type AifaPackRow, type IngredientRow, type ScanFormat } from "@/lib/aic";
import { fail, type ActionResult } from "./common";

/**
 * Cerca una confezione nell'anagrafica AIFA dal codice letto o scritto e restituisce i dati
 * per il modulo del medicinale. Serve aver fatto l'accesso (le tabelle AIFA lo richiedono).
 */
export async function lookupAic(raw: string, format: ScanFormat = "manual"): Promise<ActionResult<AicLookup>> {
  const scan = parseScan(raw, format);
  if (!scan.aic) return fail(scan.message ?? "Codice non riconosciuto.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sessione scaduta: rientra e riprova.");

  const [{ data: pack, error }, { data: ingredients }] = await Promise.all([
    supabase.from("aifa_packs").select("aic, name, pack_description, form, atc_code, dose_units, rx_regime").eq("aic", scan.aic).maybeSingle<AifaPackRow>(),
    supabase.from("aifa_pack_ingredients").select("ingredient, qty, unit, position").eq("aic", scan.aic).order("position").returns<IngredientRow[]>(),
  ]);
  if (error) return fail("Non riesco a cercare il codice adesso. Riprova tra poco.");
  if (!pack) {
    // 9 cifre senza la A, dal bollino: spesso è il numero progressivo, non l'AIC
    if (scan.source === "numero" && format === "code_39") return fail(SERIAL_HINT);
    return fail(`Il codice ${scan.aic} non è nell'anagrafica AIFA. Controlla le cifre o compila i campi a mano.`);
  }
  return { ok: true, data: packToForm(pack, ingredients ?? []) };
}
