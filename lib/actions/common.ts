import "server-only";
import { cookies } from "next/headers";
import type { z } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function fail(error: string, fieldErrors?: Record<string, string>): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  return { ok: false, error, fieldErrors };
}

/** Primo errore per ogni campo, in italiano. */
export function zodFail(err: z.ZodError): { ok: false; error: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: "Controlla i campi evidenziati.", fieldErrors };
}

interface PgError {
  code?: string;
  message?: string;
  hint?: string;
}

/** Traduce gli errori del database in messaggi comprensibili. */
export function dbError(e: PgError | null | undefined, fallback = "Qualcosa è andato storto. Riprova tra poco."): string {
  if (!e) return fallback;
  if (e.hint === "stale_stock" || e.code === "40001") return "Le scorte sono cambiate nel frattempo: ricarica la pagina e riprova.";
  if (e.hint === "recipients_limit") return "Hai raggiunto il massimo di 5 destinatari aggiuntivi.";
  if (e.hint === "not_latest") return "Si può annullare solo l’ultima preparazione.";
  if (e.hint === "already_undone") return "Questa preparazione è già stata annullata.";
  if (e.code === "23505") return "Questo dato c’è già.";
  if (e.code === "42501" || e.code === "PGRST301") return "Non hai i permessi per questa operazione. Prova a rientrare.";
  if (e.code === "23514") return "Uno dei valori non è accettato. Controlla i campi e riprova.";
  console.error("Errore database:", e);
  return fallback;
}

/** Messaggio da mostrare come avviso (toast) dopo un reindirizzamento. */
export async function flash(text: string) {
  (await cookies()).set("px_flash", encodeURIComponent(text), { path: "/", maxAge: 30, sameSite: "lax" });
}
