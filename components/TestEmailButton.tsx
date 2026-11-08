"use client";

import { useState, useTransition } from "react";
import { sendTestEmail } from "@/lib/actions/email";

export function TestEmailButton({ planId, email }: { planId: string; email: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <section className="px-card flex flex-col gap-3 p-5" aria-labelledby="px-test-email">
      <h2 id="px-test-email" className="m-0 text-[18px] font-[650]">Prova l’avviso</h2>
      <p className="m-0 text-[15px] text-px-ink-2">Ricevi subito a {email} un’email come quella degli avvisi, con le scorte di oggi. Gli altri destinatari non la ricevono.</p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await sendTestEmail(planId);
            setMsg(res.ok ? { ok: true, text: res.message ?? "Inviata" } : { ok: false, text: res.error });
          })
        }
        className="px-btn px-btn-sm px-btn-secondary self-start"
      >
        {pending ? "Invio…" : "Mandami un’email di prova"}
      </button>
      <span aria-live="polite" className="text-[15px] font-medium" style={{ color: msg?.ok === false ? "var(--px-out-fg)" : "var(--px-ok-fg)" }}>
        {msg?.text}
      </span>
    </section>
  );
}
