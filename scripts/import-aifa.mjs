#!/usr/bin/env node
// Import dei dati AIFA nelle tabelle aifa_* (vedi scripts/aifa/README.md).
// Gira ogni notte da .github/workflows/aifa-import.yml; a mano:
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/import-aifa.mjs [sorgente…] [--dir cartella] [--force]
//
// sorgente: confezioni, principi_attivi, atc, carenze, trasparenza (di default tutte)
// --dir     legge i file da una cartella invece di scaricarli (stessi nomi dei file AIFA)
// --force   importa anche se il file è identico all'ultimo import riuscito o molto più corto
//
// Se una sorgente non va (file non trovato, colonne cambiate, file troppo corto) le sue tabelle
// restano quelle dell'ultimo import riuscito. Dopo 7 giorni senza import riuscito il controllo
// del mattino (app/api/cron/alerts) lo segnala nell'email tecnica a OPS_ALERT_EMAIL.
// Esce con codice 1 se almeno una sorgente non è andata: GitHub manda l'email al proprietario.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { checkShrink, decode, parseSource, SOURCES } from "./aifa/parse.mjs";

const BATCH = 1000;
const args = process.argv.slice(2);
const force = args.includes("--force");
const dirIdx = args.indexOf("--dir");
const dir = dirIdx >= 0 ? args[dirIdx + 1] : null;
const wanted = args.filter((a, i) => !a.startsWith("--") && (dirIdx < 0 || i !== dirIdx + 1));
const unknown = wanted.filter((w) => !SOURCES[w]);
if (unknown.length) {
  console.error(`Sorgenti sconosciute: ${unknown.join(", ")}. Valide: ${Object.keys(SOURCES).join(", ")}.`);
  process.exit(2);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Servono SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/** Scarica (o legge) il file e ne calcola lo SHA-256 mentre arriva. */
async function fetchSource(spec) {
  if (dir) {
    const bytes = await readFile(join(dir, basename(new URL(spec.url).pathname)));
    return { bytes, sha: createHash("sha256").update(bytes).digest("hex") };
  }
  // il sito AIFA a volte risponde 502 o chiude la connessione: tre tentativi prima di arrendersi
  for (let attempt = 1; ; attempt++) {
    try {
      return await download(spec.url);
    } catch (e) {
      if (attempt >= 3 || e?.permanent) throw e;
      await new Promise((r) => setTimeout(r, 15_000 * attempt));
    }
  }
}

async function download(url) {
  const hash = createHash("sha256");
  const res = await fetch(url, { headers: { "User-Agent": "Panoramix-import/1.0 (+https://github.com/vivri161803/panoramix)" }, signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok || !res.body) {
    // 404 e simili non passano riprovando; 5xx, 408 e 429 sì
    const permanent = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
    throw Object.assign(new Error(`Download non riuscito (${res.status} ${res.statusText}) da ${url}`), { permanent });
  }
  const chunks = [];
  for await (const chunk of res.body) {
    hash.update(chunk);
    chunks.push(chunk);
  }
  return { bytes: Buffer.concat(chunks), sha: hash.digest("hex") };
}

async function withRetry(what, fn) {
  for (let attempt = 1; ; attempt++) {
    const { error, data } = await fn();
    if (!error) return data;
    if (attempt >= 3) throw new Error(`${what}: ${error.message}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

async function lastOk(source) {
  const { data, error } = await db
    .from("aifa_imports")
    .select("file_sha256, source_date, rows")
    .eq("source", source)
    .eq("status", "ok")
    .order("finished_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Non riesco a leggere aifa_imports: ${error.message}`);
  return data?.[0] ?? null;
}

async function importSource(name) {
  const spec = SOURCES[name];
  const t0 = Date.now();
  const { bytes, sha } = await fetchSource(spec);
  const prev = await lastOk(name);
  if (!force && prev?.file_sha256 === sha) {
    // file identico: si registra il controllo (conta per l'avviso di freschezza) e non si tocca nulla
    await withRetry("registro import", () =>
      db.from("aifa_imports").insert({ source: name, file_sha256: sha, status: "skipped", source_date: prev.source_date, finished_at: new Date().toISOString() }),
    );
    return `${name}: invariato, saltato`;
  }

  // controllo completo del file prima di scrivere qualsiasi cosa
  const parsed = parseSource(name, decode(bytes, spec.encoding));
  // un file molto più corto del solito è quasi sempre un file rotto: restano le tabelle di prima
  if (!force) checkShrink(name, parsed.rows.length, prev?.rows ?? null);

  const imp = await withRetry("registro import", () => db.from("aifa_imports").insert({ source: name, file_sha256: sha }).select("id").single());
  try {
    const rows = parsed.rows.map((r) => ({ ...r, import_id: imp.id }));
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      await withRetry(`scrittura ${spec.table} (righe ${i + 1}–${i + chunk.length})`, () =>
        spec.key ? db.from(spec.table).upsert(chunk, { onConflict: spec.key.join(",") }) : db.from(spec.table).insert(chunk),
      );
    }
    await withRetry("chiusura import", () => db.rpc("aifa_finish_import", { p_import_id: imp.id, p_rows: rows.length, p_source_date: parsed.sourceDate }));
    return `${name}: ${rows.length} righe${parsed.skipped ? ` (${parsed.skipped} scartate)` : ""}${parsed.sourceDate ? `, dati al ${parsed.sourceDate}` : ""}, ${Math.round((Date.now() - t0) / 1000)} s`;
  } catch (e) {
    await db.from("aifa_imports").update({ status: "failed", error: String(e.message ?? e).slice(0, 2000), finished_at: new Date().toISOString() }).eq("id", imp.id);
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { recorded: true });
  }
}

const sources = wanted.length ? wanted : Object.keys(SOURCES);
let failed = 0;
for (const name of sources) {
  try {
    console.log(await importSource(name));
  } catch (e) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`${name}: NON RIUSCITO · ${msg}`);
    // errore prima di aprire l'import (download, intestazioni): si registra comunque
    if (!e?.recorded) await db.from("aifa_imports").insert({ source: name, status: "failed", error: msg.slice(0, 2000), finished_at: new Date().toISOString() });
  }
}
process.exit(failed ? 1 : 0);
