"use client";

import { useTransition } from "react";
import { acceptInvite, declineInvite } from "@/lib/actions/sharing";
import { ROLE_LABEL, ROLE_SUB } from "@/lib/roles";
import type { MyInviteRow } from "@/lib/db-types";
import { useToast } from "@/components/Toast";

export function InvitesList({ invites }: { invites: MyInviteRow[] }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  if (!invites.length) return null;
  return (
    <section aria-labelledby="px-invites" className="flex flex-col gap-3 rounded-[18px] border-[1.5px] border-px-ordered-line bg-px-ordered-bg p-5">
      <h2 id="px-invites" className="m-0 text-[20px] font-[650] leading-[1.25]">
        {invites.length === 1 ? "Hai un invito" : `Hai ${invites.length} inviti`}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {invites.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-px-surface p-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="t-body-strong [overflow-wrap:anywhere]">
                {i.owner_name || "Qualcuno"} ti invita a seguire il piano di {i.patient_name}
              </span>
              <span className="text-[15px] text-px-ink-2">
                {ROLE_LABEL[i.role]}: {ROLE_SUB[i.role].charAt(0).toLowerCase() + ROLE_SUB[i.role].slice(1)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await acceptInvite(i.id);
                    if (res && !res.ok) toast(res.error);
                  })
                }
                className="px-btn px-btn-sm px-btn-primary"
              >
                Accetta
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await declineInvite(i.id);
                    toast(res.ok ? (res.message ?? "Invito rifiutato") : res.error);
                  })
                }
                className="px-btn px-btn-sm px-btn-secondary"
              >
                Rifiuta
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
