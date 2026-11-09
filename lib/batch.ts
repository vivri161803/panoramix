// Strumenti per i controlli automatici, senza dipendenze da Supabase o Next.js.

/** Righe chieste per ogni pagina. Supabase ne restituisce al massimo 1000 per richiesta (max_rows). */
export const PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Legge tutte le righe di una query, una pagina alla volta.
 * `page(from, to)` deve applicare `.order(...)` su una colonna univoca e `.range(from, to)`.
 * Si ferma alla prima pagina vuota: così funziona anche se il server restituisce meno di PAGE_SIZE righe.
 */
export async function selectAll<T>(what: string, page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw new Error(`Lettura ${what} non riuscita: ${error.message}`);
    if (!data?.length) return rows;
    rows.push(...data);
  }
}

/** Raggruppa le righe per chiave, per non filtrare l'intero elenco a ogni piano. */
export function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/**
 * Piani controllati insieme nei controlli automatici. Gli invii passano comunque
 * da poche connessioni SMTP (SMTP_POOL_CONNECTIONS); il resto del tempo è attesa del database.
 */
export const CRON_CONCURRENCY = 5;

/**
 * Margine lasciato prima di maxDuration (60 s nelle route dei cron): dopo `start + CRON_TIME_BUDGET_MS`
 * non si iniziano altri piani, così si fa in tempo a salvare l'esito e a mandare l'email tecnica.
 */
export const CRON_TIME_BUDGET_MS = 45_000;

export interface PoolOptions {
  /** Quanti elementi lavorare insieme. */
  concurrency: number;
  /** Istante (ms, come Date.now()) dopo il quale non si inizia più nessun elemento. */
  deadline?: number;
}

/**
 * Lavora gli elementi al massimo `concurrency` alla volta.
 * Dopo `deadline` non ne inizia altri e li restituisce in `skipped`; quelli già iniziati finiscono.
 * `work` deve gestire da sé i propri errori: un errore non gestito interrompe tutto.
 */
export async function runPool<T>(items: T[], opts: PoolOptions, work: (item: T) => Promise<void>): Promise<{ skipped: T[] }> {
  let next = 0;
  const skipped: T[] = [];
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      if (opts.deadline !== undefined && Date.now() >= opts.deadline) {
        skipped.push(item);
        continue;
      }
      await work(item);
    }
  };
  const n = Math.max(1, Math.min(opts.concurrency, items.length));
  await Promise.all(Array.from({ length: n }, worker));
  return { skipped };
}

export interface CronRunOptions {
  /** Istante (ms) dopo il quale non si controllano altri piani: chi resta fuori va nel report degli errori. */
  deadline?: number;
}

/** Messaggio per l'email tecnica quando il tempo finisce prima dei piani. */
export function timeoutMessage(what: string, skipped: number, total: number, path: string): string {
  return `Tempo esaurito: ${skipped} piani su ${total} non sono stati controllati (${what}). Si può rilanciare a mano ${path}: chi ha già ricevuto l'email oggi non la riceve due volte.`;
}
