import type { Metadata } from "next";
import Link from "next/link";
import { getPlanBundle } from "@/lib/data";
import { addDays, dateOfTimestampRome, diffDays, formatRange, formatRelative, formatShort, formatTimeRome } from "@/lib/dates";
import { daysWord, formatQty } from "@/lib/forecast";
import { dispenserView } from "@/lib/view";
import { canEdit } from "@/lib/roles";
import { PlanHeader } from "@/components/PlanHeader";
import { DispenserGrid } from "@/components/DispenserGrid";
import { PrepPanel } from "@/components/PrepPanel";
import { IconAlertCircle, IconCheckCircle, IconXCircle } from "@/components/ui/icons";
import { Pill } from "@/components/ui/Pill";
import { groupsPresent } from "@/lib/atc";

export async function generateMetadata({ params }: PageProps<"/piani/[id]">): Promise<Metadata> {
  const { id } = await params;
  const b = await getPlanBundle(id);
  return { title: b.plan.patient_name };
}

export default async function PianoPage({ params }: PageProps<"/piani/[id]">) {
  const { id } = await params;
  const b = await getPlanBundle(id);
  const { plan, forecast: fc, today } = b;
  const weekly = plan.stock_mode === "weekly";
  const views = fc.items.map((i) => dispenserView(i.med, i.forecast, b.settings.stockMode, today));
  const editable = canEdit(b.role);
  const nameOf = (medId: string) => b.medications.find((m) => m.id === medId)?.name ?? "";

  if (fc.items.length === 0) {
    return (
      <>
        <PlanHeader plan={plan} tab="dispenser" role={b.role} ownerName={b.ownerName} />
        <div className="flex flex-col items-center gap-4 rounded-[18px] border-[1.5px] border-dashed border-px-line-strong bg-px-surface px-5 py-12 text-center">
          <h2 className="m-0 text-[22px] font-[650] leading-[1.25]">Ancora nessun medicinale</h2>
          <p className="m-0 max-w-[460px] text-px-ink-2 [text-wrap:pretty]">
            {editable
              ? `Aggiungi le medicine di ${plan.patient_name} una alla volta: dose, orari e quante compresse ci sono in casa. Panoramix calcola per quanti giorni bastano.`
              : `Chi gestisce il piano non ha ancora aggiunto le medicine di ${plan.patient_name}.`}
          </p>
          {editable && (
            <Link href={`/piani/${plan.id}/medicinali/nuovo`} className="px-btn px-btn-primary">
              Aggiungi il primo medicinale
            </Link>
          )}
        </div>
      </>
    );
  }

  const toOrder = fc.toOrder;
  const missing = fc.prepPreview.filter((i) => i.missing > 0);

  // prima cella del riepilogo
  let first: React.ReactNode;
  if (weekly && fc.nextPrep) {
    const due = diffDays(today, fc.nextPrep) <= 1;
    first = (
      <>
        <span className="t-label text-px-ink-3">Prossima preparazione</span>
        <span className="t-heading">{formatRelative(fc.nextPrep, today)}{diffDays(today, fc.nextPrep) === 0 || diffDays(today, fc.nextPrep) === 1 ? `, ${formatShort(fc.nextPrep)}` : ""}</span>
        {fc.prepOverdue && (
          <span role="alert" className="flex items-start gap-2 text-[15px] font-semibold leading-[1.35] text-px-order-fg">
            <IconAlertCircle /> Il giorno di preparazione è passato senza conferma: le scorte non sono state scalate.
          </span>
        )}
        {missing.length === 0 ? (
          <span className="flex items-center gap-2 text-[15px] font-semibold leading-[1.35] text-px-ok-fg">
            <IconCheckCircle /> {due || fc.prepOverdue ? "C’è tutto per la settimana" : "Per ora c’è tutto per la prossima settimana"}
          </span>
        ) : (
          <span className="flex items-start gap-2 text-[15px] font-semibold leading-[1.35] text-px-out-fg">
            <IconXCircle /> Non c’è tutto: {missing.map((i) => `mancano ${formatQty(i.missing)} ${nameOf(i.medicationId)}`).join(", ")}
          </span>
        )}
      </>
    );
  } else {
    const soonest = fc.items
      .filter((i) => i.forecast.coverageDays !== null && !i.forecast.asNeeded && !i.forecast.ended)
      .sort((a, b2) => a.forecast.coverageDays! - b2.forecast.coverageDays!)[0];
    first = (
      <>
        <span className="t-label text-px-ink-3">Prima a finire</span>
        {soonest ? (
          <>
            <span className="t-heading">{soonest.med.name}</span>
            <span className="text-[15px] text-px-ink-2">
              {soonest.forecast.coverageDays} {daysWord(soonest.forecast.coverageDays!)} di copertura · finisce {formatShort(soonest.forecast.runOutDate!)}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-2 text-[15px] font-semibold leading-[1.35] text-px-ok-fg">
            <IconCheckCircle /> Nessuna medicina in esaurimento
          </span>
        )}
      </>
    );
  }

  const lastRun = fc.latestRun ? b.runRows.find((r) => r.id === fc.latestRun!.id) : null;
  const lastRunLabel = lastRun
    ? `Preparato ${dateOfTimestampRome(lastRun.created_at) === today ? "oggi" : formatShort(dateOfTimestampRome(lastRun.created_at))} alle ${formatTimeRome(lastRun.created_at)} · ${formatRange(lastRun.week_start, addDays(lastRun.week_start, 6))}`
    : "";

  return (
    <>
      <PlanHeader plan={plan} tab="dispenser" role={b.role} ownerName={b.ownerName} />
      <section aria-label="Riepilogo del piano" className="grid gap-px overflow-hidden rounded-[18px] border border-px-line bg-px-line [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div className="flex flex-col gap-1.5 bg-px-surface px-5 py-[18px]">{first}</div>
        <div className="flex flex-col gap-1.5 bg-px-surface px-5 py-[18px]">
          <span className="t-label text-px-ink-3">Da ordinare</span>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[32px] font-[650] leading-none tracking-[-0.02em]">{toOrder.length}</span>
            <span className="t-body-strong">{toOrder.length === 1 ? "medicina" : "medicine"}</span>
          </div>
          <span className="text-[15px] text-px-ink-2">{toOrder.map((m) => m.name).join(", ") || "Niente da ordinare"}</span>
          <Link href={`/piani/${plan.id}/farmacia`} className="self-start text-[15px] font-semibold">
            Lista per la farmacia →
          </Link>
        </div>
        {weekly && fc.prepWeek && editable && (
          <div className="flex flex-col justify-center gap-2.5 bg-px-surface px-5 py-[18px]">
            <PrepPanel
              planId={plan.id}
              weekLabel={formatRange(fc.prepWeek, addDays(fc.prepWeek, 6))}
              due={!!fc.nextPrep && diffDays(today, fc.nextPrep) <= 1}
              lastRun={lastRun ? { id: lastRun.id, label: lastRunLabel } : null}
            />
          </div>
        )}
      </section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="t-heading m-0">Scorte in casa</h2>
        <p className="m-0 text-[15px] text-px-ink-2">Livello = giorni di copertura, stessa scala per tutti: 0–60 giorni. Tacche a 7 e 14.</p>
      </div>
      <DispenserGrid planId={plan.id} meds={views} readOnly={!editable} />
      <Legend codes={b.medications.map((m) => m.atcCode)} colors={b.medications.map((m) => m.color)} />
    </>
  );
}

/** Legenda dei colori: i gruppi ATC presenti nel piano (il colore dice a cosa serve la medicina). */
function Legend({ codes, colors }: { codes: (string | null)[]; colors: string[] }) {
  const groups = groupsPresent(codes, colors);
  if (!groups.length) return null;
  return (
    <section aria-labelledby="px-legend" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h2 id="px-legend" className="t-label m-0 text-px-ink-3">
        Colori
      </h2>
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0">
        {groups.map((g) => (
          <li key={g.label} className="flex items-center gap-2 text-[15px] text-px-ink-2">
            <Pill color={g.color} shape="tonda" size={18} />
            {g.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
