"use client";

import { useState, useTransition } from "react";
import { cancelInvite, changeAccess, inviteMember, removeMember } from "@/lib/actions/sharing";
import { ROLE_LABEL, ROLE_SUB, type MemberRole } from "@/lib/roles";
import { useToast } from "@/components/Toast";
import { FieldError } from "@/components/ui/FieldError";

export interface MemberItem {
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
}

export interface InviteItem {
  id: string;
  email: string;
  role: MemberRole;
}

const ROLES: MemberRole[] = ["viewer", "editor"];

function RoleSelect({ id, value, onChange, disabled, label }: { id: string; value: MemberRole; onChange: (r: MemberRole) => void; disabled?: boolean; label: string }) {
  return (
    <>
      <label htmlFor={id} className="sr-only-px">
        {label}
      </label>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as MemberRole)} className="px-input h-11 w-auto min-w-[170px] py-0">
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
    </>
  );
}

export function MembersPanel({ planId, ownerEmail, members, invites }: { planId: string; ownerEmail: string; members: MemberItem[]; invites: InviteItem[] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("viewer");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const total = members.length + invites.length;

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast(res.error ?? "Qualcosa è andato storto");
      after?.();
      toast(res.message ?? "Fatto");
    });
  }

  function invite() {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return setErr("Controlla l’indirizzo email.");
    if (e === ownerEmail.toLowerCase()) return setErr("Questo è il tuo indirizzo.");
    setErr("");
    start(async () => {
      const res = await inviteMember(planId, { email: e, role });
      if (!res.ok) {
        setErr(res.fieldErrors?.email ?? res.error);
        return;
      }
      setEmail("");
      toast(res.message ?? "Invito inviato");
    });
  }

  return (
    <section className="px-card flex flex-col gap-4 p-5" aria-labelledby="px-members">
      <div className="flex flex-col gap-1">
        <h2 id="px-members" className="m-0 text-[18px] font-[650]">
          Persone con accesso
        </h2>
        <p className="m-0 text-[15px] text-px-ink-2">
          Chi ha un account Panoramix può seguire il piano con te. Ricevono anche le email del piano (avvisi, promemoria, riepiloghi).
        </p>
      </div>

      <ul className="m-0 flex list-none flex-col gap-0 p-0">
        <li className="flex flex-wrap items-center justify-between gap-2 border-t border-px-line py-3">
          <span className="flex min-w-0 flex-col">
            <span className="t-body-strong">Tu</span>
            <span className="text-[15px] text-px-ink-2 [overflow-wrap:anywhere]">{ownerEmail}</span>
          </span>
          <span className="text-[15px] font-semibold text-px-ink-2">{ROLE_LABEL.owner}</span>
        </li>
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 border-t border-px-line py-3">
            <span className="flex min-w-0 flex-col">
              <span className="t-body-strong">{m.name || m.email}</span>
              <span className="text-[15px] text-px-ink-2 [overflow-wrap:anywhere]">{m.email}</span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <RoleSelect id={`px-role-${m.userId}`} label={`Permesso di ${m.name || m.email}`} value={m.role} disabled={pending} onChange={(r) => run(() => changeAccess(planId, { userId: m.userId }, r))} />
              <button type="button" disabled={pending} onClick={() => run(() => removeMember(planId, m.userId))} className="px-btn-link-danger">
                Togli accesso
              </button>
            </span>
          </li>
        ))}
        {invites.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-px-line py-3">
            <span className="flex min-w-0 flex-col">
              <span className="t-body-strong [overflow-wrap:anywhere]">{i.email}</span>
              <span className="text-[15px] text-px-ink-2">Invito in attesa: lo accetta entrando in Panoramix con questo indirizzo</span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <RoleSelect id={`px-irole-${i.id}`} label={`Permesso per ${i.email}`} value={i.role} disabled={pending} onChange={(r) => run(() => changeAccess(planId, { inviteId: i.id }, r))} />
              <button type="button" disabled={pending} onClick={() => run(() => cancelInvite(planId, i.id))} className="px-btn-link-danger">
                Annulla invito
              </button>
            </span>
          </li>
        ))}
      </ul>

      {total < 10 ? (
        <form
          noValidate
          className="flex flex-col gap-3 border-t border-px-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            invite();
          }}
        >
          <label htmlFor="px-invite-email" className="px-label">
            Invita una persona
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="px-invite-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErr("");
              }}
              placeholder="nome@esempio.it"
              aria-invalid={err ? true : undefined}
              aria-describedby="px-invite-help"
              className="px-input min-w-0 flex-[1_1_220px]"
            />
            <RoleSelect id="px-invite-role" label="Cosa può fare" value={role} onChange={setRole} />
          </div>
          <span id="px-invite-help" className="text-[15px] text-px-ink-2">
            {ROLE_SUB[role]}
          </span>
          <FieldError message={err} />
          <button type="submit" disabled={pending} className="px-btn px-btn-sm px-btn-secondary self-start">
            {pending ? "Invio…" : "Manda l’invito"}
          </button>
        </form>
      ) : (
        <p className="m-0 text-[15px] text-px-ink-2">Hai raggiunto il massimo di 10 persone per piano.</p>
      )}
    </section>
  );
}
