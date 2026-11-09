import type { Metadata } from "next";
import Link from "next/link";
import { listMyInvites, listPlans } from "@/lib/data";
import { ROLE_LABEL } from "@/lib/roles";
import { InvitesList } from "@/components/InvitesList";
import { formatRelative } from "@/lib/dates";
import { daysWord } from "@/lib/forecast";
import { Pill } from "@/components/ui/Pill";
import { StatusChip } from "@/components/ui/StatusChip";
import { IconPlus } from "@/components/ui/icons";

export const metadata: Metadata = { title: "I miei piani" };

function summary(entry: Awaited<ReturnType<typeof listPlans>>[number]) {
  const items = entry.forecast.items;
  const out = items.filter((i) => i.forecast.status === "out").length;
  const order = items.filter((i) => i.forecast.status === "order").length;
  const ordered = items.filter((i) => i.forecast.status === "ordered").length;
  const parts = [out ? `${out} esaurit${out > 1 ? "e" : "a"}` : "", order ? `${order} da ordinare` : "", ordered ? `${ordered} ordinat${ordered > 1 ? "e" : "a"}` : ""].filter(Boolean);
  return parts.join(" · ") || (items.length ? "Tutto in ordine" : "Nessuna medicina");
}

export default async function PianiPage() {
  const [plans, invites] = await Promise.all([listPlans(), listMyInvites()]);
  return (
    <>
      <InvitesList invites={invites} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="t-display m-0">I miei piani</h1>
          <p className="m-0 text-px-ink-2">Un piano per ogni persona di cui segui le medicine, anche insieme ad altri.</p>
        </div>
        {plans.length > 0 && (
          <Link href="/piani/nuovo" className="px-btn px-btn-primary">
            <IconPlus /> Nuovo piano
          </Link>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[18px] border-[1.5px] border-dashed border-px-line-strong bg-px-surface px-5 py-12 text-center">
          <div className="flex h-12 items-end gap-2.5" aria-hidden="true">
            <Pill color="#FF5E4D" shape="capsula" size={44} rotate={-24} />
            <Pill color="#FFC020" shape="tonda" size={30} />
            <Pill color="#12C2B0" shape="ovale" size={30} rotate={18} />
          </div>
          <h2 className="m-0 text-[22px] font-[650] leading-[1.25]">Nessun piano, per ora</h2>
          <p className="m-0 max-w-[440px] text-px-ink-2 [text-wrap:pretty]">
            Un piano raccoglie le medicine di una persona: le dosi della giornata, le scorte in casa e gli avvisi per riordinare. Inizia da chi assisti, per esempio la nonna.
          </p>
          <Link href="/piani/nuovo" className="px-btn px-btn-primary">Crea il primo piano</Link>
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))]">
          {plans.map((entry) => {
            const { plan, forecast, role, ownerName } = entry;
            const active = forecast.items.filter((i) => !i.forecast.ended && !i.forecast.asNeeded);
            const minCov = active.reduce<number | null>((min, i) => {
              const c = i.forecast.coverageDays;
              if (c === null) return min;
              return min === null || c < min ? c : min;
            }, null);
            const weekly = plan.stock_mode === "weekly";
            const nextLabel = weekly ? "Prossima preparazione" : "Copertura minima";
            const next = weekly
              ? `${forecast.prepOverdue ? "In ritardo: " : ""}${formatRelative(forecast.nextPrep!, forecast.today)}`
              : minCov === null
                ? "—"
                : `${minCov} ${daysWord(minCov)}`;
            const count = `${forecast.items.length} ${forecast.items.length === 1 ? "medicina" : "medicine"}`;
            const mode = weekly ? "settimanale" : "giorno per giorno";
            const sum = summary(entry);
            return (
              <Link
                key={plan.id}
                href={`/piani/${plan.id}`}
                aria-label={`${plan.patient_name}${role !== "owner" ? `, condiviso, ${ROLE_LABEL[role].toLowerCase()}` : ""}, ${count}, ${sum}. ${nextLabel}: ${next}`}
                className="flex flex-col gap-4 rounded-[18px] border border-px-line bg-px-surface p-5 text-left text-px-ink no-underline shadow-px hover:border-px-line-strong hover:text-px-ink"
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[22px] font-[650] leading-[1.2] tracking-[-0.01em] [overflow-wrap:anywhere]">{plan.patient_name}</span>
                    <span className="text-px-ink-2">
                      {count} · {mode}
                    </span>
                    {role !== "owner" && (
                      <span className="self-start rounded-[8px] border border-px-line-strong px-2 py-1 text-[13px] font-semibold leading-none text-px-ink-2">
                        Condiviso{ownerName ? ` da ${ownerName}` : ""} · {ROLE_LABEL[role]}
                      </span>
                    )}
                  </div>
                  {forecast.items.length > 0 && <StatusChip status={forecast.worst} />}
                </div>
                <div className="flex min-h-[52px] w-full flex-wrap items-center gap-3 rounded-[12px] bg-px-surface-2 px-3.5 py-3">
                  {forecast.items.length === 0 && <span className="text-[15px] text-px-ink-3">Ancora nessun medicinale</span>}
                  {forecast.items.map((i) => (
                    <Pill key={i.med.id} color={i.med.color} shape={i.med.shape} size={28} />
                  ))}
                </div>
                <div className="grid w-full grid-cols-2 gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="t-label text-px-ink-3">{nextLabel}</span>
                    <span className="t-body-strong">{next}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="t-label text-px-ink-3">Scorte</span>
                    <span className="t-body-strong">{sum}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
