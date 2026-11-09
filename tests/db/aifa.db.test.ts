// Tabelle AIFA sul Postgres locale: lettura per chi ha fatto l'accesso, scrittura solo service role.
// Avvio: npm run test:db

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cleanup, enabled, makeUser, admin as adminClient, URL, type TestUser } from "./setup";
import { loadAifaSample } from "../helpers/aifa-sample";

const TABLES = ["aifa_packs", "aifa_pack_ingredients", "aifa_atc", "aifa_shortages", "aifa_transparency"] as const;

describe.skipIf(!enabled)("dati AIFA", () => {
  let admin: SupabaseClient;
  let user: TestUser;
  let anon: SupabaseClient;

  beforeAll(async () => {
    admin = adminClient();
    await loadAifaSample(admin);
    user = await makeUser("Lettore");
    anon = createClient(URL, process.env.TEST_SUPABASE_ANON_KEY ?? "", { auth: { persistSession: false } });
  });
  afterAll(cleanup);

  it("chi ha fatto l'accesso legge le tabelle di riferimento", async () => {
    for (const t of TABLES) {
      const { error } = await user.db.from(t).select("*").limit(1);
      expect(error, t).toBeNull();
    }
    const { data } = await user.db.from("aifa_packs").select("aic, name").eq("aic", "027161064").single();
    expect(data?.name).toBe("TRIATEC");
  });

  it("chi ha fatto l'accesso non scrive", async () => {
    const ins = await user.db.from("aifa_packs").insert({ aic: "099999999", name: "FALSO", import_id: crypto.randomUUID() });
    expect(ins.error).not.toBeNull();
    const upd = await user.db.from("aifa_transparency").update({ public_price: 0 }).eq("aic", "027161064").select("aic");
    expect(upd.error ?? (upd.data?.length === 0 ? "nessuna riga" : null)).not.toBeNull();
    const del = await user.db.from("aifa_shortages").delete().eq("aic", "047612027").select("id");
    expect(del.error ?? (del.data?.length === 0 ? "nessuna riga" : null)).not.toBeNull();
    const { data } = await admin.from("aifa_shortages").select("id").eq("aic", "047612027");
    expect(data?.length).toBe(1);
  });

  it("il registro degli import è solo per la service role, la data dei dati sì", async () => {
    const { data, error } = await user.db.from("aifa_imports").select("id");
    expect(error ?? (data?.length === 0 ? "nessuna riga" : null)).not.toBeNull();
    const fin = await user.db.rpc("aifa_finish_import", { p_import_id: crypto.randomUUID(), p_rows: 0 });
    expect(fin.error).not.toBeNull();
    const status = await user.db.rpc("aifa_status");
    expect(status.error).toBeNull();
    expect((status.data as { source: string }[]).map((s) => s.source)).toContain("trasparenza");
  });

  it("chi non ha fatto l'accesso non vede nulla", async () => {
    for (const t of [...TABLES, "aifa_imports"]) {
      const { data, error } = await anon.from(t).select("*").limit(1);
      expect(error ?? (data?.length === 0 ? "nessuna riga" : null), t).not.toBeNull();
    }
    const status = await anon.rpc("aifa_status");
    expect(status.error).not.toBeNull();
  });

  it("aifa_finish_import cancella le righe dei giri precedenti", async () => {
    const { data: imp } = await admin.from("aifa_imports").insert({ source: "atc" }).select("id").single();
    await admin.from("aifa_atc").upsert([{ code: "Z99", description: "VECCHIO", import_id: crypto.randomUUID() }]);
    await admin.from("aifa_atc").upsert([{ code: "C09AA05", description: "RAMIPRIL", import_id: imp!.id }]);
    const { error } = await admin.rpc("aifa_finish_import", { p_import_id: imp!.id, p_rows: 1 });
    expect(error).toBeNull();
    const { data } = await admin.from("aifa_atc").select("code");
    expect(data?.map((r) => r.code)).toEqual(["C09AA05"]);
    const { data: row } = await admin.from("aifa_imports").select("status, rows").eq("id", imp!.id).single();
    expect(row).toEqual({ status: "ok", rows: 1 });
  });

  it("il medicinale accetta AIC a 9 cifre e ATC completo o solo la lettera", async () => {
    const { data: plan } = await admin.from("plans").insert({ owner_id: user.id, patient_name: "Nonno AIFA" }).select("id").single();
    const base = { plan_id: plan!.id, name: "Triatec", pills_per_pack: 14, shape: "tonda", dose_morning: 1, frequency_type: "daily" };
    const ok1 = await admin.from("medications").insert({ ...base, color: "#FF5E4D", aic: "027161064", atc_code: "C09AA05" });
    expect(ok1.error).toBeNull();
    const ok2 = await admin.from("medications").insert({ ...base, color: "#9AA1A9", atc_code: "C" });
    expect(ok2.error).toBeNull();
    const badAic = await admin.from("medications").insert({ ...base, color: "#FF5E4D", aic: "27161064" });
    expect(badAic.error).not.toBeNull();
    const badAtc = await admin.from("medications").insert({ ...base, color: "#FF5E4D", atc_code: "C9" });
    expect(badAtc.error).not.toBeNull();
    const badColor = await admin.from("medications").insert({ ...base, color: "#000000" });
    expect(badColor.error).not.toBeNull();
  });
});
