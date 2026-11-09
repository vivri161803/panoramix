import { describe, expect, it } from "vitest";
import { PAGE_SIZE, groupBy, runPool, selectAll, timeoutMessage } from "@/lib/batch";

/** Finta tabella che, come Supabase, restituisce al massimo `maxRows` righe per richiesta. */
function fakeTable(total: number, maxRows = PAGE_SIZE) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + maxRows)), error: null };
  };
  return { page, calls };
}

describe("selectAll", () => {
  it("legge oltre le 1000 righe, una pagina alla volta", async () => {
    const t = fakeTable(2345);
    const rows = await selectAll("prova", t.page);
    expect(rows).toHaveLength(2345);
    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 2345 }, (_, i) => i));
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
      [2345, 3344],
    ]);
  });

  it("funziona anche se il server restituisce meno righe di quelle chieste", async () => {
    const t = fakeTable(1250, 300);
    const rows = await selectAll("prova", t.page);
    expect(rows).toHaveLength(1250);
    expect(new Set(rows.map((r) => r.id)).size).toBe(1250);
  });

  it("con una tabella vuota fa una sola richiesta", async () => {
    const t = fakeTable(0);
    expect(await selectAll("prova", t.page)).toEqual([]);
    expect(t.calls).toHaveLength(1);
  });

  it("un errore del database interrompe la lettura con il nome della tabella", async () => {
    await expect(selectAll("medicinali", async () => ({ data: null, error: { message: "timeout" } }))).rejects.toThrow(
      "Lettura medicinali non riuscita: timeout",
    );
  });
});

describe("runPool", () => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("lavora tutti gli elementi senza superare il numero di lavori insieme", async () => {
    let running = 0;
    let peak = 0;
    const done: number[] = [];
    const { skipped } = await runPool(Array.from({ length: 23 }, (_, i) => i), { concurrency: 5 }, async (i) => {
      running++;
      peak = Math.max(peak, running);
      await sleep(2 + (i % 3));
      done.push(i);
      running--;
    });
    expect(skipped).toEqual([]);
    expect(done.sort((a, b) => a - b)).toEqual(Array.from({ length: 23 }, (_, i) => i));
    expect(peak).toBe(5);
  });

  it("dopo la scadenza non inizia altri elementi e li restituisce", async () => {
    const started: number[] = [];
    const deadline = Date.now() + 30;
    const { skipped } = await runPool(Array.from({ length: 50 }, (_, i) => i), { concurrency: 2, deadline }, async (i) => {
      started.push(i);
      await sleep(10);
    });
    expect(started.length).toBeGreaterThan(0);
    expect(started.length).toBeLessThan(50);
    expect(started.length + skipped.length).toBe(50);
    expect(new Set([...started, ...skipped]).size).toBe(50);
  });

  it("con la scadenza già passata non inizia niente", async () => {
    const { skipped } = await runPool([1, 2, 3], { concurrency: 3, deadline: Date.now() - 1 }, async () => {
      throw new Error("non dovrebbe partire");
    });
    expect(skipped).toEqual([1, 2, 3]);
  });

  it("senza elementi finisce subito", async () => {
    expect(await runPool([], { concurrency: 5 }, async () => {})).toEqual({ skipped: [] });
  });
});

describe("groupBy e timeoutMessage", () => {
  it("raggruppa per chiave mantenendo l'ordine", () => {
    const g = groupBy([{ p: "a", n: 1 }, { p: "b", n: 2 }, { p: "a", n: 3 }], (x) => x.p);
    expect(g.get("a")?.map((x) => x.n)).toEqual([1, 3]);
    expect(g.get("b")?.map((x) => x.n)).toEqual([2]);
    expect(g.get("c")).toBeUndefined();
  });

  it("il messaggio dice quanti piani mancano e come rilanciare", () => {
    const m = timeoutMessage("avvisi", 12, 300, "/api/cron/alerts");
    expect(m).toContain("12 piani su 300");
    expect(m).toContain("/api/cron/alerts");
  });
});
