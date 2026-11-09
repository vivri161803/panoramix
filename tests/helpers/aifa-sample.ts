// Poche righe AIFA vere (da tests/fixtures/aifa) per i test su database e nel browser.
// Le stesse righe sono in supabase/seed.sql.

import type { SupabaseClient } from "@supabase/supabase-js";

export const SAMPLE_IMPORT_ID = "00000000-0000-4000-8000-00000000a1fa";

export const SAMPLE_PACKS = [
  { aic: "027161064", name: "TRIATEC", pack_description: "<5 MG COMPRESSE> 14 COMPRESSE IN BLISTER PVC/AL", form: "Compressa", atc_code: "C09AA05", dose_units: 14, rx_regime: "Medicinali soggetti a prescrizione medica" },
  { aic: "050238118", name: "RAMIPRIL ALTER", pack_description: "5 MG COMPRESSE-  14 COMPRESSE IN BLISTER OPA/AL/PVC/AL", form: "Compressa", atc_code: "C09AA05", dose_units: 14, rx_regime: "Medicinali soggetti a prescrizione medica" },
  { aic: "024840074", name: "CARDIOASPIRIN", pack_description: "100 MG COMPRESSE GASTRORESISTENTI-30 COMPRESSE", form: "Compressa gastroresistente", atc_code: "B01AC06", dose_units: 30, rx_regime: "Medicinali soggetti a prescrizione medica" },
  { aic: "047612027", name: "ACARBOSIO AUROBINDO", pack_description: "50 MG COMPRESSE- 40 COMPRESSE IN BLISTER PVC/PE/PVDC/AL", form: "Compressa", atc_code: "A10BF01", dose_units: 40, rx_regime: "Medicinali soggetti a prescrizione medica" },
  { aic: "044091039", name: "AMLODIPINA E VALSARTAN DOC", pack_description: "10 MG/160 MG COMPRESSE RIVESTITE CON FILM- 28 COMPRESSE IN BLISTER PVC/PVDC/AL", form: "Compressa rivestita con film", atc_code: "C09DB01", dose_units: 28, rx_regime: "Medicinali soggetti a prescrizione medica" },
  { aic: "026783098", name: "MEPRAL", pack_description: "20 MG CAPSULE RIGIDE GASTRORESISTENTI- 14 CAPSULE", form: "Capsula rigida gastroresistente", atc_code: "A02BC01", dose_units: 14, rx_regime: "Medicinali soggetti a prescrizione medica" },
];

export const SAMPLE_INGREDIENTS = [
  { aic: "027161064", position: 1, ingredient: "RAMIPRIL", qty: 5, unit: "milligrammi" },
  { aic: "050238118", position: 1, ingredient: "RAMIPRIL", qty: 5, unit: "milligrammi" },
  { aic: "024840074", position: 1, ingredient: "ACIDO ACETILSALICILICO", qty: 100, unit: "milligrammi" },
  { aic: "047612027", position: 1, ingredient: "ACARBOSIO", qty: 50, unit: "milligrammi" },
  { aic: "044091039", position: 1, ingredient: "AMLODIPINA", qty: 10, unit: "milligrammi" },
  { aic: "044091039", position: 2, ingredient: "VALSARTAN", qty: 160, unit: "milligrammi" },
  { aic: "026783098", position: 1, ingredient: "OMEPRAZOLO", qty: 20, unit: "milligrammi" },
];

export const SAMPLE_SHORTAGES = [
  {
    aic: "047612027",
    name: "ACARBOSIO AUROBINDO",
    ingredient: "ACARBOSIO",
    form_strength: '"50 MG COMPRESSE" 40 COMPRESSE IN BLISTER PVC/PE/PVDC/AL',
    started_on: "2026-06-30",
    expected_end: "2026-12-31",
    equivalent: "Sì",
    reasons: "Problemi produttivi",
    aifa_suggestions: "Disponibilità di medicinali equivalenti",
    aifa_note: "",
    atc_code: "A10BF01",
  },
];

export const SAMPLE_TRANSPARENCY = [
  { aic: "027161064", ingredient: "Ramipril", reference_pack: "14 UNITA' 5 MG - USO ORALE", atc_code: "C09AA05", name: "TRIATEC", pack_description: '"5 MG COMPRESSE" 14 COMPRESSE', reference_price: 1.8, public_price: 3.4, price_difference: 1.6, note: "", group_code: "DRA", prices_as_of: "2026-10-15" },
  { aic: "050238118", ingredient: "Ramipril", reference_pack: "14 UNITA' 5 MG - USO ORALE", atc_code: "C09AA05", name: "RAMIPRIL ALTER", pack_description: '"5 MG COMPRESSE" 14 COMPRESSE IN BLISTER OPA/AL/PVC/AL', reference_price: 1.8, public_price: 1.8, price_difference: 0, note: "", group_code: "DRA", prices_as_of: "2026-10-15" },
  { aic: "038273025", ingredient: "Ramipril", reference_pack: "14 UNITA' 5 MG - USO ORALE", atc_code: "C09AA05", name: "KRUPIL", pack_description: '"5 MG COMPRESSE" 14 COMPRESSE DIVISIBILI', reference_price: 1.8, public_price: 2.17, price_difference: 0.37, note: "", group_code: "DRA", prices_as_of: "2026-10-15" },
];

/** Scrive le righe di prova (service role) e registra un import riuscito per ogni sorgente. */
export async function loadAifaSample(admin: SupabaseClient) {
  const tag = <T extends object>(rows: T[]) => rows.map((r) => ({ ...r, import_id: SAMPLE_IMPORT_ID }));
  const steps = [
    admin.from("aifa_packs").upsert(tag(SAMPLE_PACKS)),
    admin.from("aifa_pack_ingredients").upsert(tag(SAMPLE_INGREDIENTS)),
    admin.from("aifa_transparency").upsert(tag(SAMPLE_TRANSPARENCY)),
  ];
  for (const s of steps) {
    const { error } = await s;
    if (error) throw new Error(`loadAifaSample: ${error.message}`);
  }
  await admin.from("aifa_shortages").delete().in("aic", SAMPLE_SHORTAGES.map((s) => s.aic));
  const { error } = await admin.from("aifa_shortages").insert(tag(SAMPLE_SHORTAGES));
  if (error) throw new Error(`loadAifaSample: ${error.message}`);
  const now = new Date().toISOString();
  await admin.from("aifa_imports").insert([
    { source: "confezioni", status: "ok", rows: SAMPLE_PACKS.length, finished_at: now },
    { source: "principi_attivi", status: "ok", rows: SAMPLE_INGREDIENTS.length, finished_at: now },
    { source: "atc", status: "ok", rows: 0, finished_at: now },
    { source: "carenze", status: "ok", rows: SAMPLE_SHORTAGES.length, source_date: "2026-11-05", finished_at: now },
    { source: "trasparenza", status: "ok", rows: SAMPLE_TRANSPARENCY.length, source_date: "2026-10-15", finished_at: now },
  ]);
}
