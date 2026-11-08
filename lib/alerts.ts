import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import {
  MEDICATION_COLUMNS,
  PLAN_COLUMNS,
  toMedication,
  toPlanSettings,
  toPrepRun,
  type Medication,
  type MedicationRow,
  type PlanRow,
  type PrepRunRow,
  type ProfileRow,
} from "@/lib/db-types";
import { dosesPhrase, evaluateAlerts, forecastPlan, type AlertType, type Forecast, type PlanForecast } from "@/lib/forecast";
import { getEmailProvider } from "@/lib/email/provider";
import { renderAlertEmail, type AlertEmailMed } from "@/lib/email/alert-template";
import type { ISODate } from "@/lib/dates";

export function toEmailMed(med: Medication, f: Forecast): AlertEmailMed {
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
    dosesPhrase: dosesPhrase(med),
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
    meds: meds.map((m) => toEmailMed(m, byId.get(m.id)!)),
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
 */
export async function runDailyAlerts(admin: SupabaseClient, today: ISODate, dryRun = false): Promise<DailyRunResult> {
  const result: DailyRunResult = { runDate: today, dryRun, plansChecked: 0, emailsSent: 0, plans: [], errors: [] };

  let cronRunId: string | null = null;
  if (!dryRun) {
    const { data } = await admin.from("cron_runs").insert({ run_date: today }).select("id").single();
    cronRunId = data?.id ?? null;
  }

  // Lettura di tutti i dati (anche la query quotidiana che tiene sveglio il progetto Supabase).
  const { data: plans, error: pErr } = await admin.from("plans").select(PLAN_COLUMNS);
  if (pErr) throw new Error(`Lettura piani non riuscita: ${pErr.message}`);
  const planRows = (plans ?? []) as PlanRow[];
  const planIds = planRows.map((p) => p.id);
  const ownerIds = [...new Set(planRows.map((p) => p.owner_id))];

  const [profilesRes, recRes, medsRes, runsRes] = await Promise.all([
    ownerIds.length ? admin.from("profiles").select("id, email, first_name, last_name").in("id", ownerIds) : Promise.resolve({ data: [] }),
    planIds.length ? admin.from("plan_recipients").select("plan_id, email").in("plan_id", planIds) : Promise.resolve({ data: [] }),
    planIds.length ? admin.from("medications").select(MEDICATION_COLUMNS).in("plan_id", planIds).eq("archived", false) : Promise.resolve({ data: [] }),
    planIds.length
      ? admin.from("prep_runs").select("id, plan_id, week_start, deductions, created_at, undone_at").in("plan_id", planIds).is("undone_at", null)
      : Promise.resolve({ data: [] }),
  ]);
  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const recipients = (recRes.data ?? []) as { plan_id: string; email: string }[];
  const meds = ((medsRes.data ?? []) as MedicationRow[]).map(toMedication);
  const runs = (runsRes.data ?? []) as PrepRunRow[];
  const medIds = meds.map((m) => m.id);
  const { data: openRows } = medIds.length
    ? await admin.from("alert_log").select("id, medication_id, alert_type, sent_at").in("medication_id", medIds).is("closed_at", null)
    : { data: [] };
  const openEpisodes = (openRows ?? []) as OpenEpisodeRow[];

  const provider = dryRun ? null : getEmailProvider();

  for (const plan of planRows) {
    result.plansChecked++;
    try {
      const owner = profiles.find((p) => p.id === plan.owner_id);
      if (!owner?.email) continue;
      const planMeds = meds.filter((m) => m.planId === plan.id);
      const fc = forecastPlan(
        toPlanSettings(plan),
        planMeds,
        runs.filter((r) => r.plan_id === plan.id).map(toPrepRun),
        today,
      );

      const toSend: { med: Medication; episodeIds: string[] }[] = [];
      for (const { med, forecast } of fc.items) {
        const open = openEpisodes.filter((e) => e.medication_id === med.id);
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
        continue;
      }

      const to = [owner.email, ...recipients.filter((r) => r.plan_id === plan.id).map((r) => r.email)];
      const names = toSend.map((s) => s.med.name);
      if (dryRun) {
        result.plans.push({ planId: plan.id, outcome: "would_send", medications: names });
        continue;
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
          continue;
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
        continue;
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

  if (cronRunId) {
    await admin
      .from("cron_runs")
      .update({ finished_at: new Date().toISOString(), plans_checked: result.plansChecked, emails_sent: result.emailsSent, errors: result.errors })
      .eq("id", cronRunId);
  }
  return result;
}
