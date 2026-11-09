"use client";

import { useState, useTransition } from "react";
import { addDoseChange, deleteDoseChange } from "@/lib/actions/medications";
import { addDays, formatLong, type ISODate } from "@/lib/dates";
import { dosesPhrase, formatQty, totalPerDose } from "@/lib/forecast";
import { useToast } from "@/components/Toast";
import { FieldError } from "@/components/ui/FieldError";

export interface DoseChangeView {
  id: string;
  from: ISODate;
  doseMorning: number;
  doseNoon: number;
  doseEvening: number;
}

const SLOTS = [
  { key: "doseMorning", label: "Mattina", w: "al mattino" },
  { key: "doseNoon", label: "Pranzo", w: "a pranzo" },
  { key: "doseEvening", label: "Sera", w: "alla sera" },
] as const;

type Doses = { doseMorning: number; doseNoon: number; doseEvening: number };

/** Cambi di dose da una data (es. terapie a scalare): le previsioni ne tengono conto da quel giorno. */
export function DoseChangesPanel({
  planId,
  medicationId,
  today,
  endDate,
  current,
  changes,
}: {
  planId: string;
  medicationId: string;
  today: ISODate;
  endDate: ISODate | null;
  /** dosi in vigore oggi, come punto di partenza */
  current: Doses;
  /** solo i cambi futuri */
  changes: DoseChangeView[];
}) {
  const [date, setDate] = useState(addDays(today, 1));
  const [d, setD] = useState<Doses>(current);
  const [err, setErr] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const toast = useToast();

  function add() {
    setErr({});
    start(async () => {
      const res = await addDoseChange(planId, medicationId, { effective_date: date, dose_morning: d.doseMorning, dose_noon: d.doseNoon, dose_evening: d.doseEvening });
      if (!res.ok) {
        setErr({ ...(res.fieldErrors ?? {}), _: res.error });
        return;
      }
      toast(res.message ?? "Cambio di dose salvato");
    });
  }

  return (
    <section className="px-card flex flex-col gap-4 p-5" aria-labelledby="px-dose-changes">
      <div className="flex flex-col gap-1">
        <h2 id="px-dose-changes" className="m-0 text-[18px] font-[650] leading-[1.3]">
          Cambi di dose programmati
        </h2>
        <p className="m-0 text-[15px] text-px-ink-2">
          Per le terapie che cambiano nel tempo (per esempio a scalare): dal giorno scelto valgono le nuove dosi, con la stessa frequenza. Scorte, calendario e avvisi ne tengono conto. Dose zero = sospesa.
        </p>
      </div>

      {changes.length > 0 && (
        <ul className="m-0 flex list-none flex-col p-0">
          {changes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-px-line py-3">
              <span className="flex flex-col">
                <span className="t-body-strong">Da {formatLong(c.from)}</span>
                <span className="text-[15px] text-px-ink-2">{totalPerDose(c) > 0 ? dosesPhrase(c) : "Sospesa"}</span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteDoseChange(planId, medicationId, c.id);
                    toast(res.ok ? (res.message ?? "Tolto") : res.error);
                  })
                }
                className="px-btn-link-danger"
              >
                Togli
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t border-px-line pt-4">
        <label htmlFor="px-dc-date" className="px-label">
          Nuova dose a partire da
        </label>
        <input
          id="px-dc-date"
          type="date"
          value={date}
          min={addDays(today, 1)}
          max={endDate ?? undefined}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={err.effective_date ? true : undefined}
          className="px-input max-w-[240px]"
        />
        <FieldError message={err.effective_date} />
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
          {SLOTS.map((s) => (
            <div key={s.key} className="flex flex-col gap-2 rounded-[14px] bg-px-surface-2 p-3">
              <span id={`px-dc-${s.key}`} className="px-label">
                {s.label}
              </span>
              <div className="flex items-center justify-between gap-1">
                <button type="button" onClick={() => setD((x) => ({ ...x, [s.key]: Math.max(0, x[s.key] - 0.5) }))} aria-label={`Mezza compressa in meno ${s.w}`} className="h-11 w-11 rounded-[10px] border border-px-line-strong bg-px-surface text-[20px] font-semibold leading-none">
                  −
                </button>
                <output aria-live="polite" aria-labelledby={`px-dc-${s.key}`} className="text-[22px] font-[650] leading-none">
                  {formatQty(d[s.key])}
                </output>
                <button type="button" onClick={() => setD((x) => ({ ...x, [s.key]: Math.min(20, x[s.key] + 0.5) }))} aria-label={`Mezza compressa in più ${s.w}`} className="h-11 w-11 rounded-[10px] border border-px-line-strong bg-px-surface text-[20px] font-semibold leading-none">
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        <span className="text-[15px] text-px-ink-2">{totalPerDose(d) > 0 ? `Dal ${formatLong(date || today)}: ${dosesPhrase(d)}` : "Con tutte le dosi a zero la medicina resta sospesa da quel giorno."}</span>
        <FieldError message={err._} />
        <button type="button" disabled={pending} onClick={add} className="px-btn px-btn-sm px-btn-secondary self-start">
          {pending ? "Salvataggio…" : "Programma il cambio"}
        </button>
      </div>
    </section>
  );
}
