import type { Metadata } from "next";
import Link from "next/link";
import { getPlanBundle } from "@/lib/data";
import { formatLong, isoWeekday, WEEKDAYS_SHORT } from "@/lib/dates";
import { formatQty, SLOT_LABEL, SLOTS } from "@/lib/forecast";
import { resolveWeek, weekGrid } from "@/lib/week";
import { PlanHeader } from "@/components/PlanHeader";
import { Presidio } from "@/components/ui/Presidio";
import { categoryLabel, doseWord } from "@/lib/categories";
import { IconBack, IconNext, IconPrint } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Calendario" };

export default async function CalendarioPage({ params, searchParams }: PageProps<"/piani/[id]/calendario">) {
  const { id } = await params;
  const sp = await searchParams;
  const b = await getPlanBundle(id);
  const week = resolveWeek(sp.settimana, b.settings, b.today);
  const { days, byId, legend } = weekGrid(b.medications, week.start);
  const base = `/piani/${id}/calendario`;
  const navBtn = "grid h-11 w-11 place-items-center rounded-[12px] border border-px-line-strong bg-px-surface text-px-ink no-underline hover:text-px-ink";
  const asNeeded = b.medications.filter((m) => m.frequencyType === "as_needed");

  return (
    <>
      <PlanHeader plan={b.plan} tab="calendario" role={b.role} ownerName={b.ownerName} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={`${base}?settimana=${week.prev}`} aria-label="Settimana precedente" className={navBtn}>
            <IconBack />
          </Link>
          <h2 aria-live="polite" className="mx-2 my-0 min-w-0 text-[18px] font-[650] leading-[1.2]">
            {week.label}
          </h2>
          <Link href={`${base}?settimana=${week.next}`} aria-label="Settimana successiva" className={navBtn}>
            <IconNext />
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {!week.isCurrent && (
            <Link href={base} className="px-btn px-btn-sm px-btn-secondary">
              Questa settimana
            </Link>
          )}
          <Link href={`/piani/${id}/stampa?settimana=${week.start}`} className="px-btn px-btn-sm px-btn-primary">
            <IconPrint /> Stampa
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-[18px] border border-px-line bg-px-surface p-[clamp(8px,1.4vw,20px)]">
        <div className="grid grid-cols-7 gap-[clamp(3px,.6vw,10px)]">
          {days.map((d) => {
            const today = d.date === b.today;
            return (
              <div
                key={d.date}
                className="rounded-[10px] py-2 text-center"
                style={{ background: today ? "var(--px-primary)" : "transparent", color: today ? "var(--px-on-primary)" : "var(--px-ink)" }}
                aria-label={`${formatLong(d.date)}${today ? ", oggi" : ""}`}
              >
                <div aria-hidden="true" className="text-[13px] font-medium leading-[1.2]">{WEEKDAYS_SHORT[isoWeekday(d.date) - 1]}</div>
                <div aria-hidden="true" className="text-[18px] font-[650] leading-[1.2]">{Number(d.date.slice(8))}</div>
              </div>
            );
          })}
        </div>
        {SLOTS.map((slot) => (
          <div key={slot} className="flex flex-col gap-1.5 pt-2.5">
            <div className="px-0.5 text-[15px] font-[650] leading-none">{SLOT_LABEL[slot]}</div>
            <div className="grid grid-cols-7 gap-[clamp(3px,.6vw,10px)]">
              {days.map((d) => {
                const items = d.slots[slot];
                const aria = `${formatLong(d.date)}, ${SLOT_LABEL[slot].toLowerCase()}: ${items.length ? items.map((it) => `${byId.get(it.medicationId)?.name} ${formatQty(it.qty)} ${doseWord(byId.get(it.medicationId)!, it.qty)}`).join(", ") : "niente"}`;
                return (
                  <div key={d.date} role="group" aria-label={aria} className="flex min-h-16 flex-col items-stretch gap-2 rounded-[10px] bg-px-surface-2 px-1 py-2">
                    {items.map((it) => {
                      const m = byId.get(it.medicationId)!;
                      return (
                        <div key={it.medicationId} aria-hidden="true">
                          <div className="flex flex-col items-center gap-[3px] min-[900px]:hidden">
                            <Presidio category={m.category} pillShape={m.shape} color={m.color} size={22} />
                            <span className="font-mono text-[13px] font-[650] leading-none">×{formatQty(it.qty)}</span>
                          </div>
                          <div className="hidden items-center gap-2 px-1.5 min-[900px]:flex">
                            <Presidio category={m.category} pillShape={m.shape} color={m.color} size={24} />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-medium leading-[1.2]">{m.name}</span>
                              <span className="font-mono text-[14px] font-[650] leading-none">{formatQty(it.qty)} {doseWord(m, it.qty)}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2.5">
        {legend.map((m) => (
          <div key={m.id} className="flex items-center gap-2.5">
            <Presidio category={m.category} pillShape={m.shape} color={m.color} size={26} />
            <span className="text-[15px] font-semibold leading-[1.3]">
              {m.name} <span className="font-normal text-px-ink-2">{[m.strength, categoryLabel(m.category)].filter(Boolean).join(" · ")}</span>
            </span>
          </div>
        ))}
        {legend.length === 0 && <p className="m-0 text-px-ink-2">Nessuna dose prevista in questa settimana.</p>}
      </div>
      {asNeeded.length > 0 && (
        <p className="m-0 text-[15px] text-px-ink-2">Al bisogno, fuori dal calendario: {asNeeded.map((m) => `${m.name}${m.strength ? ` ${m.strength}` : ""}`).join(", ")}.</p>
      )}
    </>
  );
}
