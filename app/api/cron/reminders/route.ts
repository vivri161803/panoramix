import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPrepReminders } from "@/lib/notify";
import { findMissedRun, finishCronRun, notifyOps, startCronRun } from "@/lib/ops";
import { todayInRome } from "@/lib/dates";
import { CRON_TIME_BUDGET_MS } from "@/lib/batch";
import { authorized } from "../auth";

export const maxDuration = 60;

// Vercel Cron chiama questo indirizzo ogni giorno alle 17:00 UTC (18:00 o 19:00 in Italia):
// promemoria per chi prepara il portapillole il giorno dopo.
// ?dry=1 calcola senza scrivere né inviare.
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const deadline = Date.now() + CRON_TIME_BUDGET_MS;
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const today = todayInRome();
  const problems: string[] = [];
  try {
    const admin = createAdminClient();
    let runId: string | null = null;
    if (!dry) {
      const missed = await findMissedRun(admin, "reminders", today);
      if (missed) problems.push(missed);
      runId = await startCronRun(admin, "reminders", today);
    }
    const result = await runPrepReminders(admin, today, dry, { deadline });
    problems.push(...result.errors);
    await finishCronRun(admin, runId, result);
    if (!dry) await notifyOps("reminders", today, problems);
    console.info("[cron] promemoria:", JSON.stringify({ ...result, plans: result.plans.length }));
    return NextResponse.json({ ...result, problems }, { status: problems.length ? 207 : 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron] promemoria non riusciti:", msg);
    problems.push(`Il controllo si è interrotto: ${msg}`);
    if (!dry) await notifyOps("reminders", today, problems);
    return NextResponse.json({ error: msg, problems }, { status: 500 });
  }
}
