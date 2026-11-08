"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createPlan, deletePlan, updatePlan } from "@/lib/actions/plans";
import { WEEKDAYS_LETTER, WEEKDAYS_LONG } from "@/lib/dates";
import type { StockMode } from "@/lib/forecast";
import type { PlanInput } from "@/lib/schemas";
import { FieldError } from "@/components/ui/FieldError";
import { Pill } from "@/components/ui/Pill";
import { IconBack, IconClose } from "@/components/ui/icons";
import { Switch } from "@/components/ui/Switch";

export interface PlanFormMed {
  id: string;
  name: string;
  strength: string;
  color: string;
  shape: string;
  current: number;
}

interface Props {
  planId?: string;
  initial: Omit<PlanInput, "counts">;
  managerEmail: string;
  meds: PlanFormMed[];
  medCount: number;
  extra?: React.ReactNode;
}

const MODES: { id: StockMode; label: string; sub: string }[] = [
  { id: "daily", label: "Giorno per giorno", sub: "Le compresse escono dalle scorte ogni giorno, dose per dose." },
  { id: "weekly", label: "Portapillole settimanale", sub: "Le compresse escono dalle scorte tutte insieme quando prepari il portapillole." },
];

const ALERTS = [
  { key: "alert_under_14", label: "Copertura sotto i 14 giorni", sub: "Il primo promemoria, con calma." },
  { key: "alert_under_7", label: "Copertura sotto i 7 giorni", sub: "Manca una settimana: è ora di ordinare." },
  { key: "alert_last_pack", label: "È rimasta l’ultima confezione", sub: "Quando resta una sola confezione in casa." },
] as const;

export function PlanForm({ planId, initial, managerEmail, meds, medCount, extra }: Props) {
  const isNew = !planId;
  const [f, setF] = useState(initial);
  const [newEmail, setNewEmail] = useState("");
  const [recErr, setRecErr] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>(() => Object.fromEntries(meds.map((m) => [m.id, String(m.current)])));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const modeChanged = !isNew && f.stock_mode !== initial.stock_mode && meds.length > 0;
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const backHref = isNew ? "/piani" : `/piani/${planId}`;

  function addRecipient() {
    const e = newEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return setRecErr("Controlla l’indirizzo email.");
    if (e === managerEmail.toLowerCase()) return setRecErr("Il tuo indirizzo riceve già gli avvisi.");
    if (f.recipients.includes(e)) return setRecErr("Questo indirizzo c’è già.");
    if (f.recipients.length >= 5) return setRecErr("Hai raggiunto il massimo di 5 destinatari aggiuntivi.");
    set({ recipients: [...f.recipients, e] });
    setNewEmail("");
    setRecErr("");
  }

  function save() {
    setError(null);
    setFieldErrors({});
    const payload: PlanInput = { ...f };
    if (modeChanged) {
      const parsed = meds.map((m) => ({ medication_id: m.id, qty: Number(String(counts[m.id] ?? "").replace(",", ".")) }));
      if (parsed.some((c) => !Number.isFinite(c.qty) || c.qty < 0 || counts[c.medication_id] === "")) {
        setFieldErrors({ counts: "Inserisci il conteggio di ogni medicinale." });
        setError("Per cambiare modalità ricontrolla le compresse di ogni medicinale.");
        return;
      }
      payload.counts = parsed;
    }
    start(async () => {
      const res = isNew ? await createPlan(payload) : await updatePlan(planId!, payload);
      if (res && !res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  }

  const card = "px-card m-0 flex flex-col gap-3 p-5";
  const legend = "float-left w-full p-0 text-[18px] font-[650] leading-[1.3]";

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <Link href={backHref} className="px-back">
        <IconBack />
        {isNew ? "I miei piani" : initial.patient_name}
      </Link>
      <h1 className="t-display m-0">{isNew ? "Nuovo piano" : "Impostazioni del piano"}</h1>

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className={card}>
          <label htmlFor="px-pname" className="px-label">
            Nome della persona
          </label>
          <input
            id="px-pname"
            value={f.patient_name}
            onChange={(e) => set({ patient_name: e.target.value })}
            placeholder="Es. Nonna Anna"
            maxLength={80}
            autoComplete="off"
            aria-invalid={fieldErrors.patient_name ? true : undefined}
            aria-describedby="px-pname-help"
            className="px-input"
          />
          <span id="px-pname-help" className="text-[15px] text-px-ink-2">
            Va bene anche un soprannome. Non servono codice fiscale né altri dati sanitari.
          </span>
          <FieldError message={fieldErrors.patient_name} />
          <label htmlFor="px-pnotes" className="px-label mt-2">
            Note <span className="font-normal text-px-ink-3">facoltative</span>
          </label>
          <textarea id="px-pnotes" value={f.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={2000} className="px-input" placeholder="Es. il medico di base è il dott. Ferri" />
          <FieldError message={fieldErrors.notes} />
        </div>

        <fieldset className={card}>
          <legend className={legend}>Modalità delle scorte</legend>
          <div role="radiogroup" aria-label="Modalità delle scorte" className="flex flex-col gap-3">
            {MODES.map((m) => {
              const sel = f.stock_mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => set({ stock_mode: m.id })}
                  className="flex items-start gap-3.5 rounded-[14px] p-4 text-left text-px-ink"
                  style={{ border: `1.5px solid ${sel ? "var(--px-ink)" : "var(--px-line)"}`, background: sel ? "var(--px-surface-2)" : "var(--px-surface)" }}
                >
                  <span
                    aria-hidden="true"
                    className="mt-px h-[22px] w-[22px] flex-none rounded-full"
                    style={{ border: `2px solid ${sel ? "var(--px-ink)" : "var(--px-line-strong)"}`, boxShadow: "inset 0 0 0 4px var(--px-surface)", background: sel ? "var(--px-ink)" : "var(--px-surface)" }}
                  />
                  <span className="flex flex-col gap-1">
                    <span className="t-body-strong">{m.label}</span>
                    <span className="text-[15px] leading-[1.4] text-px-ink-2">{m.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {modeChanged && (
            <div className="mt-1 flex flex-col gap-3 rounded-[14px] border-[1.5px] border-px-order-line bg-px-order-bg p-4">
              <strong className="text-[16px] font-[650]">Ricontrolla le scorte</strong>
              <span className="text-[15px] text-px-ink-2">
                Cambiando modalità i conti ripartono da oggi. Conta le compresse in casa
                {f.stock_mode === "weekly" ? ", fuori dal portapillole," : ""} e scrivi quante sono.
              </span>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {meds.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <Pill color={m.color} shape={m.shape} size={26} />
                    <label htmlFor={`px-count-${m.id}`} className="min-w-0 flex-1 text-[16px] font-semibold">
                      {m.name} <span className="font-normal text-px-ink-2">{m.strength}</span>
                    </label>
                    <input
                      id={`px-count-${m.id}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.5}
                      value={counts[m.id] ?? ""}
                      onChange={(e) => setCounts((c) => ({ ...c, [m.id]: e.target.value }))}
                      className="px-input w-[96px] text-center"
                    />
                  </li>
                ))}
              </ul>
              <FieldError message={fieldErrors.counts} />
            </div>
          )}
        </fieldset>

        {f.stock_mode === "weekly" && (
          <fieldset className={card}>
            <legend className={legend}>Giorno di preparazione</legend>
            <p className="m-0 text-[15px] text-px-ink-2">Il giorno in cui riempi il portapillole. Da quel giorno le dosi dei 7 giorni escono dalle scorte.</p>
            <div role="radiogroup" aria-label="Giorno di preparazione" className="grid grid-cols-7 gap-1">
              {WEEKDAYS_LETTER.map((short, i) => {
                const sel = f.prep_weekday === i + 1;
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    aria-label={WEEKDAYS_LONG[i]}
                    onClick={() => set({ prep_weekday: i + 1 })}
                    className="h-12 rounded-[12px] text-[15px] font-[650] leading-none"
                    style={{ border: `1.5px solid ${sel ? "var(--px-primary)" : "var(--px-line-strong)"}`, background: sel ? "var(--px-primary)" : "var(--px-surface)", color: sel ? "var(--px-on-primary)" : "var(--px-ink)" }}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <fieldset className="px-card m-0 flex flex-col gap-1 p-5">
          <legend className={`${legend} pb-2`}>Avvisi via email</legend>
          {ALERTS.map((a) => (
            <Switch key={a.key} checked={f[a.key]} onChange={(v) => set({ [a.key]: v })} label={a.label} sub={a.sub} />
          ))}
          <p className="m-0 border-t border-px-line pt-3 text-[15px] text-px-ink-2">Un controllo al giorno verso le 8:00. Al massimo un’email al giorno per piano.</p>
        </fieldset>

        <fieldset className={card}>
          <legend className={legend}>Chi riceve gli avvisi</legend>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex min-h-10 items-center rounded-full bg-px-surface-2 px-3.5 text-[15px] font-medium leading-[1.2] [overflow-wrap:anywhere]">Tu · {managerEmail}</span>
            {f.recipients.map((e) => (
              <span key={e} className="inline-flex min-h-10 items-center gap-0.5 rounded-full border border-px-line-strong bg-px-surface py-0 pr-0.5 pl-3.5 text-[15px] font-medium leading-[1.2] [overflow-wrap:anywhere]">
                {e}
                <button
                  type="button"
                  onClick={() => {
                    set({ recipients: f.recipients.filter((x) => x !== e) });
                    setRecErr("");
                  }}
                  aria-label={`Togli ${e}`}
                  className="grid h-10 w-10 place-items-center rounded-full border-none bg-transparent text-px-ink-2"
                >
                  <IconClose />
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <label htmlFor="px-rec" className="sr-only-px">
              Aggiungi un destinatario
            </label>
            <input
              id="px-rec"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                setRecErr("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRecipient();
                }
              }}
              disabled={f.recipients.length >= 5}
              placeholder="Aggiungi un’email"
              aria-describedby="px-rec-help"
              aria-invalid={recErr || fieldErrors.recipients ? true : undefined}
              className="px-input min-w-0 flex-[1_1_220px]"
            />
            <button type="button" onClick={addRecipient} disabled={f.recipients.length >= 5} className="px-btn px-btn-secondary">
              Aggiungi
            </button>
          </div>
          <span id="px-rec-help" aria-live="polite" className="text-[15px] font-medium leading-[1.4]" style={{ color: recErr || fieldErrors.recipients ? "var(--px-out-fg)" : "var(--px-ink-2)" }}>
            {recErr ||
              fieldErrors.recipients ||
              (f.recipients.length >= 5 ? "Hai raggiunto il massimo di 5 destinatari aggiuntivi." : `${f.recipients.length} di 5 destinatari aggiuntivi. Ricevono solo le email, non accedono all’app.`)}
          </span>
        </fieldset>

        {error && (
          <div role="alert" className="rounded-[12px] border border-px-out-line bg-px-out-bg p-3.5">
            <FieldError message={error} />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className="px-btn px-btn-primary flex-[1_1_200px]">
            {pending ? "Salvataggio…" : isNew ? "Crea piano" : "Salva piano"}
          </button>
          <Link href={backHref} className="px-btn px-btn-secondary flex-[1_1_140px]">
            Annulla
          </Link>
        </div>
      </form>

      {extra}

      {!isNew &&
        (confirmDelete ? (
          <div role="alertdialog" aria-labelledby="px-del-title" aria-describedby="px-del-desc" className="flex flex-col gap-3 rounded-[14px] border-[1.5px] border-px-out-fg bg-px-out-bg p-4">
            <strong id="px-del-title" className="text-[16px] font-[650] leading-[1.35]">
              Eliminare il piano di {initial.patient_name}?
            </strong>
            <span id="px-del-desc" className="text-px-ink-2">
              Spariscono {medCount === 1 ? "la medicina" : `le ${medCount} medicine`}, il calendario e lo storico dei movimenti. Non si può annullare.
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deletePlan(planId!);
                    if (res && !res.ok) setError(res.error);
                  })
                }
                className="px-btn px-btn-sm px-btn-danger"
                autoFocus
              >
                Elimina definitivamente
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="px-btn px-btn-sm px-btn-secondary">
                Tienilo
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="px-btn-link-danger self-start">
            Elimina piano
          </button>
        ))}
    </div>
  );
}
