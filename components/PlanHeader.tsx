import Link from "next/link";
import { WEEKDAYS_LONG } from "@/lib/dates";
import type { PlanRow } from "@/lib/db-types";
import { IconBack, IconPlus } from "@/components/ui/icons";

export function PlanHeader({ plan, tab }: { plan: PlanRow; tab: "dispenser" | "calendario" }) {
  const mode = plan.stock_mode === "weekly" ? `Portapillole settimanale · preparazione ${plan.prep_weekday === 7 ? "la" : "il"} ${WEEKDAYS_LONG[plan.prep_weekday - 1]}` : "Scorte giorno per giorno";
  const tabCls = (sel: boolean) =>
    `flex h-11 flex-1 items-center justify-center rounded-[10px] text-[15px] font-semibold leading-none no-underline ${sel ? "bg-px-surface text-px-ink shadow-[0_1px_2px_rgba(14,22,32,.12)]" : "bg-transparent text-px-ink-2"} hover:text-px-ink`;
  return (
    <div className="flex flex-col gap-3.5">
      <Link href="/piani" className="px-back">
        <IconBack />I miei piani
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="t-display m-0 [overflow-wrap:anywhere]">{plan.patient_name}</h1>
          <p className="m-0 text-px-ink-2">{mode}</p>
          {plan.notes && <p className="m-0 max-w-[640px] whitespace-pre-line text-[15px] text-px-ink-3">{plan.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/piani/${plan.id}/modifica`} className="px-btn px-btn-sm px-btn-secondary">
            Impostazioni piano
          </Link>
          <Link href={`/piani/${plan.id}/medicinali/nuovo`} className="px-btn px-btn-sm px-btn-secondary">
            <IconPlus /> Aggiungi medicinale
          </Link>
        </div>
      </div>
      <nav aria-label="Viste del piano" className="flex w-[min(100%,360px)] gap-1 rounded-[14px] bg-px-surface-2 p-1">
        <Link href={`/piani/${plan.id}`} aria-current={tab === "dispenser" ? "page" : undefined} className={tabCls(tab === "dispenser")}>
          Dispenser
        </Link>
        <Link href={`/piani/${plan.id}/calendario`} aria-current={tab === "calendario" ? "page" : undefined} className={tabCls(tab === "calendario")}>
          Calendario
        </Link>
      </nav>
    </div>
  );
}
