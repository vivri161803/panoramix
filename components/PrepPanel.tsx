"use client";

import { useTransition } from "react";
import { preparePillbox, undoPillbox } from "@/lib/actions/stock";
import { useToast } from "@/components/Toast";
import { IconCheck, IconCheckCircle } from "@/components/ui/icons";

interface Props {
  planId: string;
  /** settimana che si preparerebbe adesso, es. "8 – 14 novembre 2026" */
  weekLabel: string;
  /** la preparazione è dovuta (oggi, domani o in ritardo) */
  due: boolean;
  lastRun: { id: string; label: string } | null;
}

export function PrepPanel({ planId, weekLabel, due, lastRun }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();

  const undo = (runId: string) => async () => {
    const res = await undoPillbox(planId, runId);
    toast(res.ok ? (res.message ?? "Preparazione annullata") : res.error);
  };

  return (
    <div className="flex flex-col justify-center gap-2.5">
      {lastRun && (
        <span className="flex items-center gap-2 text-[16px] font-semibold leading-[1.35] text-px-ok-fg">
          <IconCheckCircle /> {lastRun.label}
        </span>
      )}
      {(due || !lastRun) && (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await preparePillbox(planId);
                if (!res.ok) return toast(res.error);
                toast(res.message ?? "Portapillole preparato", res.data ? undo(res.data.runId) : undefined);
              })
            }
            className="flex min-h-12 items-center justify-center gap-2 rounded-[12px] border-none bg-px-primary px-5 py-2 text-[16px] font-semibold leading-[1.2] text-px-on-primary"
          >
            <IconCheck /> {pending ? "Registro…" : "Portapillole preparato"}
          </button>
          <span className="text-[15px] text-px-ink-2 [text-wrap:pretty]">Toglie dalle scorte le dosi della settimana {weekLabel}.</span>
        </>
      )}
      {lastRun && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await undo(lastRun.id)();
            })
          }
          className="min-h-11 rounded-[12px] border border-px-line-strong bg-px-surface px-4 py-2 text-[15px] font-semibold leading-[1.2] text-px-ink"
        >
          Annulla preparazione
        </button>
      )}
      {lastRun && !due && (
        <details className="text-[15px] text-px-ink-2">
          <summary className="cursor-pointer py-2 font-semibold text-px-ink">Prepara in anticipo la settimana {weekLabel}</summary>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await preparePillbox(planId);
                if (!res.ok) return toast(res.error);
                toast(res.message ?? "Portapillole preparato", res.data ? undo(res.data.runId) : undefined);
              })
            }
            className="mt-1 min-h-11 rounded-[12px] border border-px-line-strong bg-px-surface px-4 py-2 font-semibold text-px-ink"
          >
            Portapillole preparato
          </button>
        </details>
      )}
    </div>
  );
}
