"use client";

import { useTransition } from "react";
import { arrivePacks, recountStock, takeAsNeeded, toggleOrdered, undoStockEvent } from "@/lib/actions/stock";
import type { ActionResult } from "@/lib/actions/common";
import type { DispenserView } from "@/lib/view";
import { Dispenser } from "@/components/Dispenser";
import { useToast } from "@/components/Toast";

export function DispenserGrid({ planId, meds, readOnly = false }: { planId: string; meds: DispenserView[]; readOnly?: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();

  function run<T>(fn: () => Promise<ActionResult<T>>, undo?: (data: T | undefined) => () => Promise<void>) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast(res.error);
      toast(res.message ?? "Fatto", undo ? undo(res.data) : undefined);
    });
  }

  const undoEvent = (medId: string) => (data: { eventId: string } | undefined) => async () => {
    if (!data) return;
    const res = await undoStockEvent(planId, medId, data.eventId);
    toast(res.ok ? (res.message ?? "Azione annullata") : res.error);
  };

  return (
    <div className="grid items-stretch gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))] min-[900px]:[grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
      {meds.map((m) => (
        <Dispenser
          key={m.id}
          med={m}
          historyHref={`/piani/${planId}/medicinali/${m.id}/storico`}
          actions={readOnly ? undefined : {
            busy: pending,
            historyHref: `/piani/${planId}/medicinali/${m.id}/storico`,
            editHref: `/piani/${planId}/medicinali/${m.id}`,
            onArrive: (packs) => run(() => arrivePacks(planId, m.id, packs), undoEvent(m.id)),
            onRecount: (qty) => run(() => recountStock(planId, m.id, qty), undoEvent(m.id)),
            onTake: (qty) => run(() => takeAsNeeded(planId, m.id, qty), undoEvent(m.id)),
            onOrdered: () =>
              run(
                () => toggleOrdered(planId, m.id),
                () => async () => {
                  const res = await toggleOrdered(planId, m.id);
                  toast(res.ok ? "Azione annullata" : res.error);
                },
              ),
          }}
        />
      ))}
    </div>
  );
}
