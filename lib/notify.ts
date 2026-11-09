import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { addDays, isoWeekday, type ISODate } from "@/lib/dates";
import { toPlanSettings, toPrepRun, type PlanRow } from "@/lib/db-types";
import { forecastPlan } from "@/lib/forecast";
import { loadCronData, planAudience, type CronData } from "@/lib/cron-data";
import { buildReminderItems, buildSummaryMeds } from "@/lib/digest";
import { getEmailProvider } from "@/lib/email/provider";
import { renderPrepReminderEmail, renderWeeklySummaryEmail, type RenderedEmail } from "@/lib/email/templates";

export type NotificationKind = "prep_reminder" | "weekly_summary";

export interface NotifyResult {
  runDate: ISODate;
  dryRun: boolean;
  plansChecked: number;
  emailsSent: number;
  plans: { planId: string; outcome: "sent" | "would_send" | "already_sent_today" | "failed"; error?: string }[];
  errors: string[];
}

/**
 * Manda un'email al massimo una volta al giorno per piano e tipo.
 * La riga di notification_runs fa da "prenotazione": se esiste già, si riprova solo dopo un errore.
 */
async function sendOnce(admin: SupabaseClient, plan: PlanRow, kind: NotificationKind, today: ISODate, to: string[], replyTo: string | undefined, email: RenderedEmail) {
  const claim = await admin
    .from("notification_runs")
    .insert({ plan_id: plan.id, kind, run_date: today, status: "sending", recipients: to })
    .select("id")
    .maybeSingle();
  let runId = claim.data?.id as string | undefined;
  if (claim.error) {
    if (claim.error.code !== "23505") throw new Error(claim.error.message);
    const { data: retry } = await admin
      .from("notification_runs")
      .update({ status: "sending", error: null, recipients: to, updated_at: new Date().toISOString() })
      .eq("plan_id", plan.id)
      .eq("kind", kind)
      .eq("run_date", today)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    runId = retry?.id;
    if (!runId) return { outcome: "already_sent_today" as const };
  }
  try {
    await getEmailProvider().send({ to, replyTo, ...email });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("notification_runs").update({ status: "failed", error: msg.slice(0, 1000), updated_at: new Date().toISOString() }).eq("id", runId);
    return { outcome: "failed" as const, error: msg };
  }
  await admin.from("notification_runs").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", runId);
  return { outcome: "sent" as const };
}

function planForecast(data: CronData, plan: PlanRow, today: ISODate) {
  return forecastPlan(
    toPlanSettings(plan),
    data.meds.filter((m) => m.planId === plan.id),
    data.runs.filter((r) => r.plan_id === plan.id).map(toPrepRun),
    today,
  );
}

type Builder = (plan: PlanRow, data: CronData) => RenderedEmail | null;

async function runKind(admin: SupabaseClient, kind: NotificationKind, today: ISODate, dryRun: boolean, wanted: (p: PlanRow) => boolean, build: Builder, data?: CronData): Promise<NotifyResult> {
  const result: NotifyResult = { runDate: today, dryRun, plansChecked: 0, emailsSent: 0, plans: [], errors: [] };
  const d = data ?? (await loadCronData(admin));
  for (const plan of d.plans.filter(wanted)) {
    result.plansChecked++;
    try {
      const email = build(plan, d);
      if (!email) continue;
      const to = planAudience(d, plan);
      if (!to.length) continue;
      if (dryRun) {
        result.plans.push({ planId: plan.id, outcome: "would_send" });
        continue;
      }
      const res = await sendOnce(admin, plan, kind, today, to, d.profiles.get(plan.owner_id)?.email, email);
      result.plans.push({ planId: plan.id, ...res });
      if (res.outcome === "sent") {
        result.emailsSent++;
        console.info(`[cron] ${kind} inviato per il piano ${plan.id} a ${to.length} destinatari`);
      }
      if (res.outcome === "failed") result.errors.push(`Piano ${plan.id}: ${kind} non inviato (${res.error})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[cron] ${kind}: errore sul piano ${plan.id}:`, msg);
      result.errors.push(`Piano ${plan.id} (${kind}): ${msg}`);
    }
  }
  return result;
}

/** Promemoria della sera: domani è il giorno di preparazione del portapillole. */
export async function runPrepReminders(admin: SupabaseClient, today: ISODate, dryRun = false, data?: CronData): Promise<NotifyResult> {
  const tomorrow = addDays(today, 1);
  return runKind(
    admin,
    "prep_reminder",
    today,
    dryRun,
    (p) => p.stock_mode === "weekly" && p.prep_reminder,
    (plan, d) => {
      const fc = planForecast(d, plan, today);
      if (fc.nextPrep !== tomorrow || fc.prepWeek !== tomorrow) return null;
      const items = buildReminderItems(fc.items.map((i) => i.med), fc.prepPreview, tomorrow);
      if (!items.length) return null;
      const owner = d.profiles.get(plan.owner_id);
      return renderPrepReminderEmail({
        patientName: plan.patient_name,
        managerName: `${owner?.first_name ?? ""} ${owner?.last_name ?? ""}`.trim(),
        prepDate: tomorrow,
        today,
        items,
        planUrl: `${env.appUrl()}/piani/${plan.id}`,
        settingsUrl: `${env.appUrl()}/piani/${plan.id}/modifica`,
        appUrl: env.appUrl(),
      });
    },
    data,
  );
}

/** Il riepilogo settimanale parte il lunedì. */
export function isSummaryDay(today: ISODate): boolean {
  return isoWeekday(today) === 1;
}

/** Riepilogo del lunedì: stato delle scorte anche quando va tutto bene. */
export async function runWeeklySummaries(admin: SupabaseClient, today: ISODate, dryRun = false, data?: CronData): Promise<NotifyResult> {
  return runKind(
    admin,
    "weekly_summary",
    today,
    dryRun,
    (p) => p.weekly_summary,
    (plan, d) => {
      const fc = planForecast(d, plan, today);
      const meds = buildSummaryMeds(fc);
      if (!meds.length) return null;
      return renderWeeklySummaryEmail({
        patientName: plan.patient_name,
        today,
        nextPrep: fc.nextPrep,
        meds,
        planUrl: `${env.appUrl()}/piani/${plan.id}`,
        settingsUrl: `${env.appUrl()}/piani/${plan.id}/modifica`,
        appUrl: env.appUrl(),
      });
    },
    data,
  );
}
