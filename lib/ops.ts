import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { addDays, formatDayMonthYear, type ISODate } from "@/lib/dates";
import { getEmailProvider } from "@/lib/email/provider";
import { renderOpsEmail } from "@/lib/email/templates";

export type CronKind = "alerts" | "reminders";

export const CRON_LABEL: Record<CronKind, string> = {
  alerts: "controllo degli avvisi del mattino",
  reminders: "promemoria della sera",
};

/**
 * Il controllo di ieri è partito e finito? Se manca (e nella settimana prima girava)
 * restituisce un messaggio da mandare a chi gestisce l'app.
 */
export async function findMissedRun(admin: SupabaseClient, kind: CronKind, today: ISODate): Promise<string | null> {
  const yesterday = addDays(today, -1);
  const { data: done, error } = await admin
    .from("cron_runs")
    .select("id")
    .eq("kind", kind)
    .eq("run_date", yesterday)
    .not("finished_at", "is", null)
    .limit(1);
  if (error) return `Non riesco a leggere cron_runs: ${error.message}`;
  if (done?.length) return null;
  // allarme solo se il controllo girava nei giorni prima (non il primo giorno, né dopo una lunga pausa)
  const { data: older } = await admin
    .from("cron_runs")
    .select("id")
    .eq("kind", kind)
    .gte("run_date", addDays(today, -8))
    .lt("run_date", yesterday)
    .limit(1);
  if (!older?.length) return null;
  return `Ieri (${formatDayMonthYear(yesterday)}) il ${CRON_LABEL[kind]} non è partito o non è arrivato alla fine.`;
}

/** Segna in cron_runs l'esecuzione di un controllo (per accorgersi il giorno dopo se è saltato). */
export async function startCronRun(admin: SupabaseClient, kind: CronKind, today: ISODate): Promise<string | null> {
  const { data } = await admin.from("cron_runs").insert({ run_date: today, kind }).select("id").single();
  return data?.id ?? null;
}

export async function finishCronRun(admin: SupabaseClient, id: string | null, r: { plansChecked: number; emailsSent: number; errors: string[] }) {
  if (!id) return;
  await admin
    .from("cron_runs")
    .update({ finished_at: new Date().toISOString(), plans_checked: r.plansChecked, emails_sent: r.emailsSent, errors: r.errors })
    .eq("id", id);
}

/** Email tecnica all'indirizzo di OPS_ALERT_EMAIL. Non lancia mai: un errore qui finisce solo nei log. */
export async function notifyOps(kind: CronKind, today: ISODate, problems: string[]): Promise<boolean> {
  if (!problems.length) return false;
  const title = problems.length === 1 ? `Problema nel ${CRON_LABEL[kind]}` : `${problems.length} problemi nel ${CRON_LABEL[kind]}`;
  try {
    const mail = renderOpsEmail({ title, problems: problems.slice(0, 50), appUrl: env.appUrl(), when: formatDayMonthYear(today) });
    await getEmailProvider().send({ to: [env.opsEmail()], ...mail });
    console.info(`[cron] avviso tecnico inviato a ${env.opsEmail()}`);
    return true;
  } catch (e) {
    console.error("[cron] avviso tecnico non inviato:", e instanceof Error ? e.message : e);
    return false;
  }
}
