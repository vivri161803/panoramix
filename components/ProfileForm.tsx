"use client";

import { startTransition, useActionState } from "react";
import { saveProfile } from "@/lib/actions/auth";
import { FieldError } from "@/components/ui/FieldError";

export function ProfileForm({ firstName, lastName, submitLabel, next }: { firstName: string; lastName: string; submitLabel: string; next: string }) {
  const [state, action, pending] = useActionState(saveProfile, null);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-2">
        <label htmlFor="px-nome" className="px-label">Nome</label>
        <input id="px-nome" name="first_name" autoComplete="given-name" required maxLength={60} defaultValue={firstName} aria-invalid={fe.first_name ? true : undefined} aria-describedby={fe.first_name ? "px-nome-err" : undefined} className="px-input" />
        <FieldError id="px-nome-err" message={fe.first_name} />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="px-cognome" className="px-label">Cognome</label>
        <input id="px-cognome" name="last_name" autoComplete="family-name" required maxLength={60} defaultValue={lastName} aria-invalid={fe.last_name ? true : undefined} aria-describedby={fe.last_name ? "px-cognome-err" : undefined} className="px-input" />
        <FieldError id="px-cognome-err" message={fe.last_name} />
      </div>
      {state && !state.ok && !Object.keys(fe).length && <FieldError message={state.error} />}
      <button type="submit" disabled={pending} className="px-btn px-btn-primary">{pending ? "Salvataggio…" : submitLabel}</button>
    </form>
  );
}
