import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { addDays, type ISODate } from "@/lib/dates";
import { selectAll } from "@/lib/batch";
import { getEmailProvider } from "@/lib/email/provider";
import { renderUsageEmail } from "@/lib/email/templates";
import { summarizeUsage, USAGE_DAYS, type UsageRaw, type UsageStats } from "@/lib/usage-stats";

/** Account dell'Auth, a pagine come le tabelle. */
async function listAllUsers(admin: SupabaseClient): Promise<UsageRaw["users"]> {
  const users: UsageRaw["users"] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Lettura account non riuscita: ${error.message}`);
    if (!data.users.length) return users;
    users.push(...data.users.map((u) => ({ id: u.id, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at })));
  }
}

/** Conta le righe senza leggerle (`head: true`). */
async function count(what: string, query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count: n, error } = await query;
  if (error) throw new Error(`Conteggio ${what} non riuscito: ${error.message}`);
  return n ?? 0;
}

/** Legge tutto quello che serve al riepilogo di utilizzo degli ultimi USAGE_DAYS giorni. Solo letture. */
export async function collectUsage(admin: SupabaseClient, now: Date = new Date()): Promise<UsageStats> {
  const since = new Date(now.getTime() - USAGE_DAYS * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();
  const [users, plans, members, pendingInvites, activeMeds, stockEvents, preps, alertRuns, notificationRuns] = await Promise.all([
    listAllUsers(admin),
    selectAll<UsageRaw["plans"][number]>("piani", (from, to) => admin.from("plans").select("id, created_at").order("id").range(from, to)),
    selectAll<UsageRaw["members"][number]>("membri", (from, to) => admin.from("plan_members").select("plan_id").order("plan_id").order("user_id").range(from, to)),
    count("inviti", admin.from("plan_invites").select("id", { count: "exact", head: true })),
    count("medicinali", admin.from("medications").select("id", { count: "exact", head: true }).eq("archived", false)),
    selectAll<UsageRaw["stockEvents"][number]>("movimenti", (from, to) =>
      admin.from("stock_events").select("created_by").gte("created_at", sinceIso).order("id").range(from, to),
    ),
    selectAll<UsageRaw["preps"][number]>("preparazioni", (from, to) =>
      admin.from("prep_runs").select("created_by").gte("created_at", sinceIso).order("id").range(from, to),
    ),
    selectAll<UsageRaw["alertRuns"][number]>("invii degli avvisi", (from, to) =>
      admin.from("alert_runs").select("status, recipients").gte("created_at", sinceIso).order("id").range(from, to),
    ),
    selectAll<UsageRaw["notificationRuns"][number]>("invii di promemoria e riepiloghi", (from, to) =>
      admin.from("notification_runs").select("status, recipients").gte("created_at", sinceIso).order("id").range(from, to),
    ),
  ]);
  return summarizeUsage({ users, plans, members, pendingInvites, activeMeds, stockEvents, preps, alertRuns, notificationRuns }, since);
}

/** È già girato oggi un altro controllo del mattino? Serve a non mandare il riepilogo due volte. */
async function alertsAlreadyRanToday(admin: SupabaseClient, today: ISODate): Promise<boolean> {
  const { count: n } = await admin.from("cron_runs").select("id", { count: "exact", head: true }).eq("kind", "alerts").eq("run_date", today);
  // runDailyAlerts ha appena inserito la riga di questo controllo
  return (n ?? 0) > 1;
}

export interface UsageReportResult {
  stats: UsageStats;
  sent: boolean;
  /** perché non è partito (prova, già mandato oggi) */
  skipped?: string;
}

/**
 * Riepilogo di utilizzo a OPS_ALERT_EMAIL. Parte con il controllo del lunedì, una volta al giorno;
 * `force` lo manda anche se oggi è già partito, `dryRun` lo calcola senza mandarlo.
 */
export async function sendUsageReport(admin: SupabaseClient, today: ISODate, opts: { dryRun?: boolean; force?: boolean } = {}): Promise<UsageReportResult> {
  const stats = await collectUsage(admin);
  if (opts.dryRun) return { stats, sent: false, skipped: "prova" };
  if (!opts.force && (await alertsAlreadyRanToday(admin, today))) return { stats, sent: false, skipped: "già mandato oggi" };
  const mail = renderUsageEmail(stats, { from: addDays(today, -USAGE_DAYS), to: today, appUrl: env.appUrl() });
  await getEmailProvider().send({ to: [env.opsEmail()], ...mail });
  console.info(`[cron] riepilogo di utilizzo inviato a ${env.opsEmail()}`);
  return { stats, sent: true };
}
