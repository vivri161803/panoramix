import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDailyAlerts } from "@/lib/alerts";
import { isSummaryDay, runWeeklySummaries } from "@/lib/notify";
import { findMissedRun, findStaleAifa, notifyOps } from "@/lib/ops";
import { sendUsageReport, type UsageReportResult } from "@/lib/usage";
import { todayInRome } from "@/lib/dates";
import { CRON_TIME_BUDGET_MS } from "@/lib/batch";
import { authorized } from "../auth";

export const maxDuration = 60;

// Vercel Cron chiama questo indirizzo ogni giorno alle 07:00 UTC (8:00 o 9:00 in Italia).
// Avvisi di scorta bassa; il lunedì anche il riepilogo settimanale.
// Il lunedì manda anche il riepilogo di utilizzo a OPS_ALERT_EMAIL (persone attive, piani, email inviate).
// ?dry=1 calcola senza scrivere né inviare; ?riepilogo=1 manda il riepilogo anche se non è lunedì;
// ?utilizzo=1 manda il riepilogo di utilizzo anche se non è lunedì o se è già partito oggi.
// Se qualcosa va storto parte un'email tecnica a OPS_ALERT_EMAIL, anche quando i dati AIFA
// non si aggiornano da più di 7 giorni.
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  // dopo questo istante non si iniziano altri piani: resta il tempo per salvare l'esito e avvisare
  const deadline = Date.now() + CRON_TIME_BUDGET_MS;
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const forceSummary = req.nextUrl.searchParams.get("riepilogo") === "1";
  const forceUsage = req.nextUrl.searchParams.get("utilizzo") === "1";
  const today = todayInRome();
  const problems: string[] = [];
  try {
    const admin = createAdminClient();
    if (!dry) {
      const missed = await findMissedRun(admin, "alerts", today);
      if (missed) problems.push(missed);
    }
    // dati AIFA fermi da più di 7 giorni (file non trovato o non leggibile): le tabelle restano le vecchie
    problems.push(...(await findStaleAifa(admin)));
    const result = await runDailyAlerts(admin, today, dry, { deadline });
    problems.push(...result.errors);
    const summary = isSummaryDay(today) || forceSummary ? await runWeeklySummaries(admin, today, dry, { deadline }) : null;
    if (summary) problems.push(...summary.errors);
    let usage: UsageReportResult | null = null;
    if (isSummaryDay(today) || forceUsage) {
      try {
        usage = await sendUsageReport(admin, today, { dryRun: dry, force: forceUsage });
      } catch (e) {
        problems.push(`Riepilogo di utilizzo non inviato: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (!dry) await notifyOps("alerts", today, problems);
    console.info("[cron] esito:", JSON.stringify({ ...result, plans: result.plans.length, summary: summary && { sent: summary.emailsSent, errors: summary.errors.length } }));
    return NextResponse.json({ ...result, summary, usage, problems }, { status: problems.length ? 207 : 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron] controllo non riuscito:", msg);
    problems.push(`Il controllo si è interrotto: ${msg}`);
    if (!dry) await notifyOps("alerts", today, problems);
    return NextResponse.json({ error: msg, problems }, { status: 500 });
  }
}
