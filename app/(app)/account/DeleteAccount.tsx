"use client";

import { startTransition, useActionState, useState } from "react";
import { deleteAccount } from "@/lib/actions/auth";
import { FieldError } from "@/components/ui/FieldError";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteAccount, null);
  const err = state && !state.ok ? state.fieldErrors?.confirm ?? state.error : undefined;
  return (
    <section className="px-card flex flex-col gap-3 p-5" aria-labelledby="acc-del">
      <h2 id="acc-del" className="m-0 text-[18px] font-[650]">Elimina account e dati</h2>
      <p className="m-0 text-px-ink-2">Cancella il tuo account, tutti i piani, le medicine, lo storico e gli avvisi. Non si può annullare.</p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="px-btn-link-danger self-start">
          Elimina account
        </button>
      ) : (
        <form
          role="alertdialog"
          aria-labelledby="acc-del-t"
          className="flex flex-col gap-3 rounded-[14px] border-[1.5px] border-px-out-fg bg-px-out-bg p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => action(fd));
          }}
        >
          <strong id="acc-del-t" className="text-[16px] font-[650]">Eliminare definitivamente account e dati?</strong>
          <label htmlFor="acc-del-confirm" className="px-label">Scrivi ELIMINA per confermare</label>
          <input id="acc-del-confirm" name="confirm" autoComplete="off" autoCapitalize="characters" className="px-input" aria-invalid={err ? true : undefined} />
          <FieldError message={err} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className="px-btn px-btn-sm px-btn-danger">{pending ? "Elimino…" : "Elimina definitivamente"}</button>
            <button type="button" onClick={() => setOpen(false)} className="px-btn px-btn-sm px-btn-secondary">Tienilo</button>
          </div>
        </form>
      )}
    </section>
  );
}
