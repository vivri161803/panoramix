import { describe, expect, it } from "vitest";
import { AIFA_SOURCES, staleAifaProblems, type AifaImportRow } from "@/lib/aifa-freshness";

const NOW = new Date("2026-11-20T07:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const allOk = (d: number, status: AifaImportRow["status"] = "ok"): AifaImportRow[] =>
  AIFA_SOURCES.map((source) => ({ source, status, finished_at: daysAgo(d), error: null }));

describe("staleAifaProblems", () => {
  it("nessun avviso se ogni sorgente ha un controllo riuscito negli ultimi 7 giorni", () => {
    expect(staleAifaProblems(allOk(1), NOW)).toEqual([]);
    // file invariato (skipped) conta come controllo riuscito: la lista di trasparenza cambia una volta al mese
    expect(staleAifaProblems([...allOk(30), ...allOk(1, "skipped")], NOW)).toEqual([]);
    expect(staleAifaProblems(allOk(7), NOW)).toEqual([]);
  });

  it("file non trovato da più di una settimana: avviso con l'ultimo errore, tabelle vecchie", () => {
    const rows: AifaImportRow[] = [
      ...allOk(1).filter((r) => r.source !== "carenze"),
      { source: "carenze", status: "ok", finished_at: daysAgo(9), error: null },
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((d) => ({ source: "carenze", status: "failed" as const, finished_at: daysAgo(d), error: "Download non riuscito (404 Not Found)" })),
    ];
    const p = staleAifaProblems(rows, NOW);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/farmaci carenti/);
    expect(p[0]).toMatch(/da 9 giorni/);
    expect(p[0]).toMatch(/11 novembre 2026/);
    expect(p[0]).toMatch(/Ultimo errore: Download non riuscito \(404 Not Found\)\. Le tabelle/);
    expect(p[0]).toMatch(/restano quelle dell'ultimo import riuscito/);
  });

  it("workflow fermo: avviso anche senza errori registrati", () => {
    const p = staleAifaProblems(allOk(10), NOW);
    expect(p).toHaveLength(AIFA_SOURCES.length);
    expect(p[0]).toMatch(/non risulta partito/);
  });

  it("mai importato: un solo avviso con le istruzioni", () => {
    expect(staleAifaProblems([], NOW)).toEqual([expect.stringMatching(/Nessun import dei dati AIFA/)]);
  });

  it("sorgente mai riuscita", () => {
    const rows = [...allOk(1).filter((r) => r.source !== "atc"), { source: "atc", status: "failed" as const, finished_at: daysAgo(1), error: "AIFA ha cambiato le colonne di atc" }];
    const p = staleAifaProblems(rows, NOW);
    expect(p).toEqual([expect.stringMatching(/anagrafica ATC.*mai.*cambiato le colonne/)]);
  });
});
