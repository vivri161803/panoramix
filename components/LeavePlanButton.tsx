"use client";

import { useState, useTransition } from "react";
import { leavePlan } from "@/lib/actions/sharing";
import { useToast } from "@/components/Toast";

export function LeavePlanButton({ planId, patientName }: { planId: string; patientName: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="px-btn-link-danger">
        Lascia il piano
      </button>
    );
  }
  return (
    <span role="group" aria-label={`Lasciare il piano di ${patientName}?`} className="flex flex-wrap items-center gap-2">
      <span className="text-[15px] font-semibold">Non vedrai più il piano. Confermi?</span>
      <button
        type="button"
        disabled={pending}
        autoFocus
        onClick={() =>
          start(async () => {
            const res = await leavePlan(planId);
            if (res && !res.ok) toast(res.error);
          })
        }
        className="px-btn px-btn-sm px-btn-danger"
      >
        Lascia
      </button>
      <button type="button" onClick={() => setConfirm(false)} className="px-btn px-btn-sm px-btn-secondary">
        Resta
      </button>
    </span>
  );
}
