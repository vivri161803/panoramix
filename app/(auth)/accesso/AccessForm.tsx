"use client";

import { useActionState, useState } from "react";
import { sendMagicLink } from "@/lib/actions/auth";
import { IconAlertCircle, IconCheckCircle, IconMail, IconXCircle } from "@/components/ui/icons";

export function AccessForm({ expired, deleted }: { expired: boolean; deleted: boolean }) {
  const [state, action, pending] = useActionState(sendMagicLink, null);
  const [email, setEmail] = useState("");
  // stato "link inviato" nascosto con "Usa un’altra email"
  const [dismissed, setDismissed] = useState<typeof state>(null);
  const sentTo = state?.ok && state !== dismissed ? state.data?.email : undefined;
  const error = state && !state.ok ? state.error : undefined;

  if (sentTo) {
    return (
      <>
        <div className="grid h-14 w-14 place-items-center rounded-[16px] border border-px-ok-line bg-px-ok-bg text-px-ok-fg">
          <IconMail />
        </div>
        <div role="status" className="flex flex-col gap-2">
          <h1 className="t-title m-0">Ti abbiamo inviato un link</h1>
          <p className="m-0 text-px-ink-2">
            Apri la posta di <strong className="text-px-ink">{sentTo}</strong> e tocca il link entro 15 minuti. Se non lo trovi, guarda nella cartella spam.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setDismissed(state); setEmail(""); }} className="px-btn px-btn-secondary flex-[1_1_160px]">
            Usa un’altra email
          </button>
          <form action={action} className="flex flex-[1_1_160px]">
            <input type="hidden" name="email" value={sentTo} />
            <button type="submit" disabled={pending} className="px-btn px-btn-secondary w-full">
              {pending ? "Invio…" : "Invia di nuovo"}
            </button>
          </form>
        </div>
      </>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {deleted && (
        <div role="status" className="flex gap-2 rounded-[12px] border border-px-ok-line bg-px-ok-bg p-3.5 text-px-ok-fg font-semibold">
          <IconCheckCircle /> Account e dati eliminati.
        </div>
      )}
      {expired ? (
        <div role="alert" className="flex gap-3 rounded-[12px] border border-px-out-line bg-px-out-bg p-3.5">
          <span className="text-px-out-fg"><IconXCircle size={20} inner="var(--px-out-bg)" /></span>
          <div className="flex flex-col gap-1">
            <strong className="text-px-out-fg font-[650]">Il link è scaduto</strong>
            <span className="text-px-ink-2">I link di accesso valgono 15 minuti e si usano una volta sola. Chiedine uno nuovo.</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <h1 className="t-title m-0">Accedi</h1>
          <p className="m-0 text-px-ink-2">Ti mandiamo un link via email: niente password da ricordare.</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor="px-email" className="px-label">Email</label>
        <input
          id="px-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="nome@esempio.it"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "px-email-err" : undefined}
          className="px-input"
        />
        {error && (
          <div id="px-email-err" role="alert" className="px-error">
            <IconAlertCircle /> {error}
          </div>
        )}
      </div>
      <button type="submit" disabled={pending} className="px-btn px-btn-primary">
        {pending ? "Invio in corso…" : expired ? "Invia un nuovo link" : "Invia il link"}
      </button>
    </form>
  );
}
