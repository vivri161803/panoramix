import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { toPlanSettings, toPrepRun, type Medication, type PlanRow, type ProfileRow } from "@/lib/db-types";
import { loadCronData, planAudience } from "@/lib/cron-data";
import { dosesAt, dosesPhrase, evaluateAlerts, forecastPlan, type AlertType, type Forecast, type PlanForecast } from "@/lib/forecast";
import { getEmailProvider } from "@/lib/email/provider";
import { CRON_CONCURRENCY, groupBy, runPool, selectAll, timeoutMessage, type CronRunOptions } from "@/lib/batch";
import { renderAlertEmail, type AlertEmailMed } from "@/lib/email/alert-template";
import type { ISODate } from "@/lib/dates";

export function toEmailMed(med: Medication, f: Forecast, today: ISODate): AlertEmailMed {
  return {
    name: med.name,
    strength: med.strength,
    color: med.color,
    status: f.status,
    qty: f.stock,
    coverageDays: f.coverageDays,
    runOutDate: f.runOutDate,
    requiresPrescription: med.requiresPrescription,
    pillsPerPack: med.pillsPerPack,
    dosesPhrase: dosesPhrase(dosesAt(med, today)),
    asNeeded: f.asNeeded,
  };
}

export function buildPlanEmail(opts: {
  plan: PlanRow;
  owner: ProfileRow;
  forecast: PlanForecast<Medication>;
  meds: Medication[];
  today: ISODate;
  test?: boolean;
}) {
  const { plan, owner, forecast, meds, today } = opts;
  const byId = new Map(forecast.items.map((i) => [i.med.id, i.forecast]));
  return renderAlertEmail({
    patientName: plan.patient_name,
    managerFirstName: owner.first_name,
    managerFullName: `${owner.first_name} ${owner.last_name}`.trim() || owner.email,
    planUrl: `${env.appUrl()}/piani/${plan.id}`,
    settingsUrl: `${env.appUrl()}/piani/${plan.id}/modifica`,
    nextPrep: forecast.nextPrep,
    today,
    test: opts.test,
    meds: meds.map((m) => toEmailMed(m, byId.get(m.id)!, today)),
  });
}

interface OpenEpisodeRow {
  id: string;
  medication_id: string;
  alert_type: AlertType;
  sent_at: string | null;
}

export interface DailyRunResult {
  runDate: ISODate;
  dryRun: boolean;
  plansChecked: number;
  emailsSent: number;
  plans: { planId: string; outcome: "nothing" | "sent" | "already_sent_today" | "failed" | "would_send"; medications?: string[]; error?: string }[];
  errors: string[];
}

/**
 * Controllo giornaliero: valuta le soglie di ogni piano, apre/chiude gli episodi
 * e manda al massimo un'email al giorno per piano. Idempotente sullo stesso giorno.
 * I piani si controllano CRON_CONCURRENCY alla volta, con una sola connessione SMTP condivisa.
 */
export async function runDailyAlerts(admin: SupabaseClient, today: ISODate, dryRun = false, opts: CronRunOptions = {}): Promise<DailyRunResult> {
  const result: DailyRunResult = { runDate: today, dryRun, plansChecked: 0, emailsSent: 0, plans: [], errors: [] };

  let cronRunId: string | null = null;
  if (!dryRun) {
    const { data } = await admin.from("cron_runs").insert({ run_date: today }).select("id").single();
    cronRunId = data?.id ?? null;
  }

  // Lettura di tutti i dati (anche la query quotidiana che tiene sveglio il progetto Supabase).
  const data = await loadCronData(admin);
  const { plans: planRows } = data;
  const openEpisodes = data.meds.length ? await loadOpenEpisodes(admin) : [];
  const medsByPlan = groupBy(data.meds, (m) => m.planId);
  const runsByPlan = groupBy(data.runs, (r) => r.plan_id);
  const episodesByMed = groupBy(openEpisodes, (e) => e.medication_id);

  const provider = dryRun ? null : getEmailProvider({ pooled: true });

  async function checkPlan(plan: PlanRow) {
    result.plansChecked++;
    try {
      const owner = data.profiles.get(plan.owner_id);
      if (!owner?.email) return;
      const fc = forecastPlan(
        toPlanSettings(plan),
        medsByPlan.get(plan.id) ?? [],
        (runsByPlan.get(plan.id) ?? []).map(toPrepRun),
        today,
      );

      const toSend: { med: Medication; episodeIds: string[] }[] = [];
      for (const { med, forecast } of fc.items) {
        const open = episodesByMed.get(med.id) ?? [];
        const d = evaluateAlerts(forecast.triggered, !!med.orderedAt, open.map((e) => ({ alertType: e.alert_type, sentAt: e.sent_at })));
        if (dryRun) {
          if (d.send.length) toSend.push({ med, episodeIds: [] });
          continue;
        }
        if (d.close.length) {
          const ids = open.filter((e) => d.close.includes(e.alert_type)).map((e) => e.id);
          await admin.from("alert_log").update({ closed_at: new Date().toISOString() }).in("id", ids);
        }
        if (d.open.length) {
          await admin
            .from("alert_log")
            .upsert(
              d.open.map((t) => ({ medication_id: med.id, alert_type: t, episode_start: today })),
              { onConflict: "medication_id,alert_type,episode_start", ignoreDuplicates: true },
            );
        }
        if (d.send.length) {
          const { data: eps } = await admin
            .from("alert_log")
            .select("id, alert_type")
            .eq("medication_id", med.id)
            .is("closed_at", null)
            .is("sent_at", null)
            .in("alert_type", d.send);
          if (eps?.length) toSend.push({ med, episodeIds: eps.map((e) => e.id) });
        }
      }

      if (!toSend.length) {
        result.plans.push({ planId: plan.id, outcome: "nothing" });
        return;
      }

      const to = planAudience(data, plan);
      const names = toSend.map((s) => s.med.name);
      if (dryRun) {
        result.plans.push({ planId: plan.id, outcome: "would_send", medications: names });
        return;
      }

      // Un'email al giorno per piano: la riga di alert_runs fa da "prenotazione".
      const claim = await admin
        .from("alert_runs")
        .insert({ plan_id: plan.id, run_date: today, status: "sending", recipients: to, medication_ids: toSend.map((s) => s.med.id) })
        .select("id")
        .maybeSingle();
      let runId = claim.data?.id as string | undefined;
      if (claim.error) {
        if (claim.error.code !== "23505") throw new Error(claim.error.message);
        // già presente oggi: si riprova solo se il primo invio era fallito
        const { data: retry } = await admin
          .from("alert_runs")
          .update({ status: "sending", error: null, recipients: to, medication_ids: toSend.map((s) => s.med.id), updated_at: new Date().toISOString() })
          .eq("plan_id", plan.id)
          .eq("run_date", today)
          .eq("status", "failed")
          .select("id")
          .maybeSingle();
        runId = retry?.id;
        if (!runId) {
          result.plans.push({ planId: plan.id, outcome: "already_sent_today", medications: names });
          return;
        }
      }

      const email = buildPlanEmail({ plan, owner, forecast: fc, meds: toSend.map((s) => s.med), today });
      try {
        await provider!.send({ to, replyTo: owner.email, ...email });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await admin.from("alert_runs").update({ status: "failed", error: msg.slice(0, 1000), updated_at: new Date().toISOString() }).eq("id", runId);
        console.error(`[cron] invio non riuscito per il piano ${plan.id}:`, msg);
        result.errors.push(`Piano ${plan.id}: invio non riuscito (${msg})`);
        result.plans.push({ planId: plan.id, outcome: "failed", medications: names, error: msg });
        return;
      }
      const sentAt = new Date().toISOString();
      await admin.from("alert_runs").update({ status: "sent", updated_at: sentAt }).eq("id", runId);
      await admin.from("alert_log").update({ sent_at: sentAt }).in("id", toSend.flatMap((s) => s.episodeIds));
      result.emailsSent++;
      result.plans.push({ planId: plan.id, outcome: "sent", medications: names });
      console.info(`[cron] avviso inviato per il piano ${plan.id} a ${to.length} destinatari: ${names.join(", ")}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[cron] errore sul piano ${plan.id}:`, msg);
      result.errors.push(`Piano ${plan.id}: ${msg}`);
    }
  }

  try {
    const { skipped } = await runPool(planRows, { concurrency: CRON_CONCURRENCY, deadline: opts.deadline }, checkPlan);
    if (skipped.length) result.errors.push(timeoutMessage("avvisi", skipped.length, planRows.length, "/api/cron/alerts"));
  } finally {
    provider?.close?.();
  }

  if (cronRunId) {
    await admin
      .from("cron_runs")
      .update({ finished_at: new Date().toISOString(), plans_checked: result.plansChecked, emails_sent: result.emailsSent, errors: result.errors })
      .eq("id", cronRunId);
  }
  return result;
}

/** Episodi aperti di tutti i medicinali, a pagine (vedi loadCronData). */
async function loadOpenEpisodes(admin: SupabaseClient): Promise<OpenEpisodeRow[]> {
  return selectAll<OpenEpisodeRow>("episodi aperti", (from, to) =>
    admin.from("alert_log").select("id, medication_id, alert_type, sent_at").is("closed_at", null).order("id").range(from, to),
  );
}
