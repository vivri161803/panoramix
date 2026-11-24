// Pipeline di import AIFA completa sul Postgres locale: scripts/import-aifa.mjs con le fixture vere.
// Svuota le tabelle aifa_* locali. Avvio: npm run test:db

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enabled, admin as adminClient, URL as SUPABASE_URL } from "./setup";
import { loadAifaSample } from "../helpers/aifa-sample";

vi.mock("server-only", () => ({}));
import { findStaleAifa } from "@/lib/ops";

const FIXTURES = new URL("../fixtures/aifa/", import.meta.url).pathname;
const FILES = ["confezioni_fornitura.csv", "PA_confezioni.csv", "atc.csv", "elenco_medicinali_carenti.csv", "Lista_farmaci_equivalenti.csv"];
const SCRIPT = new URL("../../scripts/import-aifa.mjs", import.meta.url).pathname;

/** Lancia lo script come fa il workflow; restituisce codice di uscita e output. */
function runImport(dir: string, ...args: string[]) {
  try {
    const out = execFileSync("node", [SCRIPT, "--dir", dir, ...args], {
      env: { ...process.env, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "aifa-"));
  for (const f of FILES) copyFileSync(join(FIXTURES, f), join(dir, f));
  return dir;
}

describe.skipIf(!enabled)("pipeline di import AIFA", () => {
  let admin: SupabaseClient;
  const dirs: string[] = [];
  const count = async (t: string) => (await admin.from(t).select("*", { count: "exact", head: true })).count;
  const lastStatus = async (source: string) =>
    (await admin.from("aifa_imports").select("status, error, rows").eq("source", source).order("started_at", { ascending: false }).limit(1).single()).data;

  beforeAll(async () => {
    admin = adminClient();
    for (const t of ["aifa_packs", "aifa_pack_ingredients", "aifa_atc", "aifa_shortages", "aifa_transparency"]) {
      await admin.from(t).delete().not("import_id", "is", null);
    }
    await admin.from("aifa_imports").delete().not("id", "is", null);
  });
  afterAll(async () => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    await loadAifaSample(admin);
  });

  it("primo import: tutte le sorgenti, conteggi delle fixture", async () => {
    const dir = freshDir();
    dirs.push(dir);
    const r = runImport(dir);
    expect(r.code, r.out).toBe(0);
    expect(await count("aifa_packs")).toBe(13);
    expect(await count("aifa_pack_ingredients")).toBe(15);
    expect(await count("aifa_atc")).toBe(10);
    expect(await count("aifa_shortages")).toBe(9);
    expect(await count("aifa_transparency")).toBe(20);
    const { data } = await admin.from("aifa_transparency").select("aic, public_price, prices_as_of").eq("aic", "027161064").single();
    expect(data).toEqual({ aic: "027161064", public_price: 3.4, prices_as_of: "2026-10-15" });
    expect(await lastStatus("carenze")).toMatchObject({ status: "ok", rows: 9 });
  });

  it("secondo giro senza cambiamenti: salta tutto", async () => {
    const r = runImport(dirs[0]);
    expect(r.code, r.out).toBe(0);
    expect(r.out.match(/invariato, saltato/g)).toHaveLength(5);
    expect(await lastStatus("confezioni")).toMatchObject({ status: "skipped" });
    expect(await count("aifa_packs")).toBe(13);
  });

  it("file non trovato: errore registrato, tabelle vecchie intatte", async () => {
    const dir = freshDir();
    dirs.push(dir);
    rmSync(join(dir, "elenco_medicinali_carenti.csv"));
    const r = runImport(dir, "carenze");
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/carenze: NON RIUSCITO/);
    expect(await lastStatus("carenze")).toMatchObject({ status: "failed" });
    expect(await count("aifa_shortages")).toBe(9);
  });

  it("colonne cambiate: nessuna scrittura", async () => {
    const dir = freshDir();
    dirs.push(dir);
    const f = join(dir, "Lista_farmaci_equivalenti.csv");
    writeFileSync(f, readFileSync(f, "latin1").replace("Codice gruppo equivalenza", "Gruppo"), "latin1");
    const r = runImport(dir, "trasparenza");
    expect(r.code).toBe(1);
    expect((await lastStatus("trasparenza"))?.error).toMatch(/AIFA ha cambiato le colonne di trasparenza/);
    expect(await count("aifa_transparency")).toBe(20);
  });

  it("file molto più corto: rifiutato, tabelle vecchie intatte", async () => {
    const dir = freshDir();
    dirs.push(dir);
    const f = join(dir, "Lista_farmaci_equivalenti.csv");
    writeFileSync(f, readFileSync(f, "latin1").split("\r\n").slice(0, 6).join("\r\n") + "\r\n", "latin1");
    const r = runImport(dir, "trasparenza");
    expect(r.code).toBe(1);
    expect((await lastStatus("trasparenza"))?.error).toMatch(/sembra incompleto/);
    expect(await count("aifa_transparency")).toBe(20);
  });

  it("confezione tolta dal file: sparisce al giro dopo", async () => {
    const dir = freshDir();
    dirs.push(dir);
    const f = join(dir, "confezioni_fornitura.csv");
    writeFileSync(f, readFileSync(f, "utf8").split("\n").filter((l) => !l.startsWith('"023921048"')).join("\n"));
    const r = runImport(dir, "confezioni");
    expect(r.code, r.out).toBe(0);
    expect(await count("aifa_packs")).toBe(12);
    const { data } = await admin.from("aifa_packs").select("aic").eq("aic", "023921048");
    expect(data).toEqual([]);
  });

  const shortageRows = async () =>
    ((await admin.from("aifa_shortages").select("*").order("aic")).data ?? []).map(({ import_id: _i, id: _id, ...r }) => r);
  const carenzeAsUtf8 = (dir: string, edit: (t: string) => string = (t) => t) => {
    const f = join(dir, "elenco_medicinali_carenti.csv");
    writeFileSync(f, Buffer.from(edit(new TextDecoder("windows-1252").decode(readFileSync(f))), "utf8"));
  };

  it("T1-A1 — carenze in UTF-8: import riuscito, stesse righe del Windows-1252", async () => {
    const before = await shortageRows();
    const dir = freshDir();
    dirs.push(dir);
    carenzeAsUtf8(dir);
    const r = runImport(dir, "carenze");
    expect(r.code, r.out).toBe(0);
    expect(r.out).not.toMatch(/invariato, saltato/);
    expect(await lastStatus("carenze")).toMatchObject({ status: "ok", rows: 9 });
    const after = await shortageRows();
    expect(after).toHaveLength(9);
    expect(after).toEqual(before);
    expect(JSON.stringify(after)).toContain("Sì");
    expect(JSON.stringify(after)).not.toMatch(/Ã|\uFFFD/);
  });

  it("T1-A2 — carenze in Windows-1252: risultato identico a prima", async () => {
    const before = await shortageRows();
    const dir = freshDir();
    dirs.push(dir);
    const r = runImport(dir, "carenze");
    expect(r.code, r.out).toBe(0);
    expect(await lastStatus("carenze")).toMatchObject({ status: "ok", rows: 9 });
    expect(await shortageRows()).toEqual(before);
  });

  it("T1-A3 — carenze in UTF-8 con colonna rinominata: import fermo, tabelle intatte", async () => {
    const before = await shortageRows();
    const dir = freshDir();
    dirs.push(dir);
    carenzeAsUtf8(dir, (t) => t.replace("Classe di rimborsabilità", "Classe rimborso"));
    const r = runImport(dir, "carenze");
    expect(r.code).toBe(1);
    expect((await lastStatus("carenze"))?.error).toMatch(/AIFA ha cambiato le colonne di carenze/);
    expect(await shortageRows()).toEqual(before);
    const ok = runImport(freshDir(), "carenze");
    expect(ok.code, ok.out).toBe(0);
  });

  it("controllo del mattino: avviso dopo 7 giorni senza import riuscito", async () => {
    expect(await findStaleAifa(admin)).toEqual([]);
    const in8days = new Date(Date.now() + 8 * 86_400_000);
    const problems = await findStaleAifa(admin, in8days);
    expect(problems).toHaveLength(5);
    expect(problems.find((p) => p.includes("farmaci carenti"))).toMatch(/restano quelle dell'ultimo import riuscito/);
  });
});
