"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createMedication, deleteMedication, updateMedication } from "@/lib/actions/medications";
import { WEEKDAYS_LETTER, WEEKDAYS_LONG, type ISODate } from "@/lib/dates";
import { daysWord, forecastMedication, formatQty, scheduleSummary, type FrequencyType, type PlanSettings } from "@/lib/forecast";
import { colorName, PILL_COLORS, PILL_SHAPES } from "@/lib/pills";
import type { MedicationInput } from "@/lib/schemas";
import { dispenserView } from "@/lib/view";
import { Dispenser } from "@/components/Dispenser";
import { FieldError } from "@/components/ui/FieldError";
import { Pill } from "@/components/ui/Pill";
import { Switch } from "@/components/ui/Switch";
import { IconBack } from "@/components/ui/icons";

interface Props {
  planId: string;
  planName: string;
  medicationId?: string;
  initial: MedicationInput;
  settings: PlanSettings;
  today: ISODate;
  nextPrep: ISODate | null;
  /** contenuto sotto il modulo (es. cambi di dose programmati) */
  extra?: React.ReactNode;
}

const FREQS: { id: FrequencyType; label: string }[] = [
  { id: "daily", label: "Tutti i giorni" },
  { id: "weekdays", label: "Alcuni giorni della settimana" },
  { id: "every_n_days", label: "Ogni N giorni" },
  { id: "cycle", label: "A cicli: X giorni sì, Y no" },
  { id: "as_needed", label: "Al bisogno" },
];

const SLOTS = [
  { key: "dose_morning", label: "Mattina", w: "al mattino" },
  { key: "dose_noon", label: "Pranzo", w: "a pranzo" },
  { key: "dose_evening", label: "Sera", w: "alla sera" },
] as const;

type NumKey = "pills_per_pack" | "stock_qty" | "interval_days" | "cycle_on" | "cycle_off";

const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return s.trim() === "" || !Number.isFinite(n) ? NaN : n;
};

export function MedicationForm({ planId, planName, medicationId, initial, settings, today, nextPrep, extra }: Props) {
  const isNew = !medicationId;
  const [f, setF] = useState(initial);
  const [txt, setTxt] = useState<Record<NumKey, string>>({
    pills_per_pack: String(initial.pills_per_pack),
    stock_qty: String(initial.stock_qty),
    interval_days: String(initial.interval_days ?? 2),
    cycle_on: String(initial.cycle_on ?? 21),
    cycle_off: String(initial.cycle_off ?? 7),
  });
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: Partial<MedicationInput>) => setF((x) => ({ ...x, ...patch }));
  const setNum = (k: NumKey, v: string) => setTxt((t) => ({ ...t, [k]: v }));
  const weekly = settings.stockMode === "weekly";

  const input: MedicationInput = {
    ...f,
    pills_per_pack: num(txt.pills_per_pack),
    stock_qty: num(txt.stock_qty),
    interval_days: f.frequency_type === "every_n_days" ? num(txt.interval_days) : null,
    cycle_on: f.frequency_type === "cycle" ? num(txt.cycle_on) : null,
    cycle_off: f.frequency_type === "cycle" ? num(txt.cycle_off) : null,
    weekdays: f.frequency_type === "weekdays" ? f.weekdays : [],
  };

  // anteprima: stessa logica di dominio usata dal server
  const preview = (() => {
    const ok = (n: number | null | undefined, min = 0) => (n != null && Number.isFinite(n) && n >= min ? n : null);
    const med = {
      id: medicationId ?? "nuovo",
      planId,
      name: input.name.trim(),
      strength: input.strength.trim(),
      description: input.description,
      requiresPrescription: input.requires_prescription,
      color: input.color,
      shape: input.shape,
      aic: null,
      atcCode: null,
      pillsPerPack: ok(input.pills_per_pack, 1) ?? 1,
      doseMorning: input.dose_morning,
      doseNoon: input.dose_noon,
      doseEvening: input.dose_evening,
      frequencyType: input.frequency_type,
      weekdays: input.weekdays,
      intervalDays: ok(input.interval_days, 2) ?? 2,
      cycleOn: ok(input.cycle_on, 1) ?? 1,
      cycleOff: ok(input.cycle_off, 1) ?? 1,
      startDate: input.start_date || today,
      endDate: input.end_date || null,
      stockQty: ok(input.stock_qty) ?? 0,
      stockAsOf: today,
      orderedAt: null,
    };
    const fc = forecastMedication(med, { plan: settings, today, nextPrep: nextPrep ?? undefined });
    return { med, fc, view: dispenserView(med, fc, settings.stockMode, today) };
  })();

  const sum1 = scheduleSummary(preview.med);
  const cov = preview.fc.coverageDays;
  const qtyText = formatQty(preview.med.stockQty);
  const sum2 =
    input.frequency_type === "as_needed"
      ? `${qtyText} in casa: vale solo l’avviso dell’ultima confezione`
      : cov === null
        ? `${qtyText} in casa → bastano fino alla fine della terapia`
        : `${qtyText} in casa → ${cov} ${daysWord(cov)} di copertura${weekly ? " (compreso il portapillole)" : ""}`;

  function save(another = false) {
    setError(null);
    setFe({});
    start(async () => {
      const res = isNew ? await createMedication(planId, input, another) : await updateMedication(planId, medicationId!, input);
      if (res && !res.ok) {
        setError(res.error);
        setFe(res.fieldErrors ?? {});
      }
    });
  }

  const section = "px-card flex flex-col gap-4 p-5";
  const h2 = "m-0 text-[18px] font-[650] leading-[1.3]";
  const grid2 = "grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]";
  const smallNum = "h-12 rounded-[12px] border border-px-line-strong bg-px-surface px-3 text-center text-[16px] font-semibold text-px-ink";
  const radioCard = (sel: boolean) => ({ border: `1.5px solid ${sel ? "var(--px-ink)" : "var(--px-line)"}`, background: sel ? "var(--px-surface-2)" : "var(--px-surface)" });
  const dayBtn = (sel: boolean) => ({
    border: `1.5px solid ${sel ? "var(--px-primary)" : "var(--px-line-strong)"}`,
    background: sel ? "var(--px-primary)" : "var(--px-surface)",
    color: sel ? "var(--px-on-primary)" : "var(--px-ink)",
  });

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Link href={`/piani/${planId}`} className="px-back">
          <IconBack />
          {planName}
        </Link>
        <h1 className="t-display m-0">{isNew ? "Nuovo medicinale" : "Modifica medicinale"}</h1>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-4">
        <form
          noValidate
          className="flex min-w-0 flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save(false);
          }}
        >
          <section className={section}>
            <h2 className={h2}>Medicinale</h2>
            <div className={grid2}>
              <div className="flex flex-col gap-2">
                <label htmlFor="px-mn" className="px-label">Nome</label>
                <input id="px-mn" value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} required autoComplete="off" aria-invalid={fe.name ? true : undefined} className="px-input" />
                <FieldError message={fe.name} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="px-md" className="px-label">Dosaggio <span className="font-normal text-px-ink-3">facoltativo</span></label>
                <input id="px-md" value={f.strength} onChange={(e) => set({ strength: e.target.value })} maxLength={40} placeholder="Es. 5 mg" autoComplete="off" className="px-input" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="px-mdesc" className="px-label">Descrizione <span className="font-normal text-px-ink-3">facoltativa</span></label>
              <input id="px-mdesc" value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={200} placeholder="Es. a stomaco pieno" autoComplete="off" className="px-input" />
            </div>
          </section>

          <section className={section}>
            <h2 className={h2}>Confezione e scorte</h2>
            <div className={grid2}>
              <div className="flex flex-col gap-2">
                <label htmlFor="px-pp" className="px-label">Compresse per confezione</label>
                <input id="px-pp" type="number" inputMode="numeric" min={1} step={1} value={txt.pills_per_pack} onChange={(e) => setNum("pills_per_pack", e.target.value)} aria-invalid={fe.pills_per_pack ? true : undefined} className="px-input" />
                <FieldError message={fe.pills_per_pack} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="px-qty" className="px-label">{weekly ? "Compresse in casa, fuori dal portapillole" : "Compresse in casa"}</label>
                <input id="px-qty" type="number" inputMode="decimal" min={0} step={0.5} value={txt.stock_qty} onChange={(e) => setNum("stock_qty", e.target.value)} aria-invalid={fe.stock_qty ? true : undefined} aria-describedby="px-qty-help" className="px-input" />
                <span id="px-qty-help" className="text-[14px] leading-[1.35] text-px-ink-2">
                  {isNew ? "Conta le compresse adesso. Le mezze valgono ½." : "Se cambi questo numero diventa un nuovo conteggio."}
                </span>
                <FieldError message={fe.stock_qty} />
              </div>
            </div>
            <Switch checked={f.requires_prescription} onChange={(v) => set({ requires_prescription: v })} label="Serve la ricetta" sub="Negli avvisi trovi il testo pronto per il medico." />
          </section>

          <section className={section}>
            <h2 className={h2}>Aspetto nel dispenser</h2>
            <div className="flex flex-wrap items-center gap-5">
              <div role="img" aria-label={`Anteprima: compressa ${f.shape}, ${colorName(f.color).toLowerCase()}`} className="grid h-28 w-28 flex-none place-items-center rounded-[18px] bg-px-surface-2">
                <Pill color={f.color} shape={f.shape} size={76} rotate={-14} />
              </div>
              <div className="flex flex-[1_1_200px] flex-col gap-2.5">
                <span className="px-label">
                  Colore · <span className="font-normal text-px-ink-2">{colorName(f.color)}</span>
                </span>
                <div role="radiogroup" aria-label="Colore" className="flex flex-wrap gap-2">
                  {PILL_COLORS.map((c) => {
                    const sel = c.hex === f.color;
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        role="radio"
                        aria-checked={sel}
                        aria-label={c.name}
                        onClick={() => set({ color: c.hex })}
                        className="h-11 w-11 rounded-full border-none p-0"
                        style={{
                          background: `radial-gradient(ellipse 60% 50% at 32% 26%, rgba(255,255,255,.8), rgba(255,255,255,0) 62%), linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.22)), ${c.hex}`,
                          boxShadow: sel ? "0 0 0 3px var(--px-surface), 0 0 0 5px var(--px-ink)" : "inset 0 -2px 3px rgba(0,0,0,.15)",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="px-label">Forma</span>
              <div role="radiogroup" aria-label="Forma" className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,110px),1fr))]">
                {PILL_SHAPES.map((s) => {
                  const sel = s.id === f.shape;
                  return (
                    <button key={s.id} type="button" role="radio" aria-checked={sel} onClick={() => set({ shape: s.id })} className="flex flex-col items-center gap-2.5 rounded-[14px] px-2 py-3.5 text-px-ink" style={radioCard(sel)}>
                      <span className="grid h-7 place-items-center">
                        <Pill color={f.color} shape={s.id} size={40} />
                      </span>
                      <span className="text-[15px] font-semibold leading-none">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className={section}>
            <h2 className={h2}>Quante compresse e quando</h2>
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
              {SLOTS.map((s) => (
                <div key={s.key} className="flex flex-col gap-2 rounded-[14px] bg-px-surface-2 p-3">
                  <span id={`px-slot-${s.key}`} className="px-label">{s.label}</span>
                  <div className="flex items-center justify-between gap-1">
                    <button type="button" onClick={() => set({ [s.key]: Math.max(0, f[s.key] - 0.5) })} aria-label={`Mezza compressa in meno ${s.w}`} className="h-11 w-11 rounded-[10px] border border-px-line-strong bg-px-surface text-[20px] font-semibold leading-none">
                      −
                    </button>
                    <output aria-live="polite" aria-labelledby={`px-slot-${s.key}`} className="text-[22px] font-[650] leading-none">
                      {formatQty(f[s.key])}
                    </output>
                    <button type="button" onClick={() => set({ [s.key]: Math.min(20, f[s.key] + 0.5) })} aria-label={`Mezza compressa in più ${s.w}`} className="h-11 w-11 rounded-[10px] border border-px-line-strong bg-px-surface text-[20px] font-semibold leading-none">
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <FieldError message={fe.doses} />

            <span className="px-label">Frequenza</span>
            <div role="radiogroup" aria-label="Frequenza" className="flex flex-col gap-1.5">
              {FREQS.map((q) => {
                const sel = f.frequency_type === q.id;
                return (
                  <button key={q.id} type="button" role="radio" aria-checked={sel} onClick={() => set({ frequency_type: q.id })} className="flex min-h-12 items-center gap-3 rounded-[12px] px-3 py-2 text-left text-px-ink" style={radioCard(sel)}>
                    <span
                      aria-hidden="true"
                      className="h-5 w-5 flex-none rounded-full"
                      style={{ border: `2px solid ${sel ? "var(--px-ink)" : "var(--px-line-strong)"}`, boxShadow: "inset 0 0 0 3px var(--px-surface)", background: sel ? "var(--px-ink)" : "var(--px-surface)" }}
                    />
                    <span className="text-[16px] font-medium leading-[1.3]">{q.label}</span>
                  </button>
                );
              })}
            </div>

            {f.frequency_type === "weekdays" && (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS_LETTER.map((short, i) => {
                    const d = i + 1;
                    const on = f.weekdays.includes(d);
                    return (
                      <button key={d} type="button" aria-pressed={on} aria-label={WEEKDAYS_LONG[i]} onClick={() => set({ weekdays: on ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d] })} className="h-12 rounded-[12px] text-[15px] font-[650] leading-none" style={dayBtn(on)}>
                        {short}
                      </button>
                    );
                  })}
                </div>
                <FieldError message={fe.weekdays} />
              </div>
            )}
            {f.frequency_type === "every_n_days" && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <label htmlFor="px-n">Ogni</label>
                  <input id="px-n" type="number" inputMode="numeric" min={2} value={txt.interval_days} onChange={(e) => setNum("interval_days", e.target.value)} className={`${smallNum} w-[88px]`} />
                  <span>giorni, a partire dalla data di inizio</span>
                </div>
                <FieldError message={fe.interval_days} />
              </div>
            )}
            {f.frequency_type === "cycle" && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <input aria-label="Giorni sì" type="number" inputMode="numeric" min={1} value={txt.cycle_on} onChange={(e) => setNum("cycle_on", e.target.value)} className={`${smallNum} w-20`} />
                  <span>giorni sì, poi</span>
                  <input aria-label="Giorni no" type="number" inputMode="numeric" min={1} value={txt.cycle_off} onChange={(e) => setNum("cycle_off", e.target.value)} className={`${smallNum} w-20`} />
                  <span>giorni no, a partire dalla data di inizio</span>
                </div>
                <FieldError message={fe.cycle_on || fe.cycle_off} />
              </div>
            )}

            <div role="status" aria-live="polite" className="flex flex-col gap-1 rounded-[14px] border border-px-line bg-px-surface-2 px-4 py-3.5">
              <span className="t-mono uppercase tracking-[0.04em] text-px-ink-3">Riepilogo</span>
              <span className="text-[18px] font-[650] leading-[1.35]">{sum1}</span>
              <span className="text-px-ink-2">{sum2}</span>
            </div>
          </section>

          <section className={section}>
            <h2 className={h2}>Periodo</h2>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
              <div className="flex flex-col gap-2">
                <label htmlFor="px-start" className="px-label">Inizio</label>
                <input id="px-start" type="date" value={f.start_date} onChange={(e) => set({ start_date: e.target.value })} aria-invalid={fe.start_date ? true : undefined} className="px-input" />
                <FieldError message={fe.start_date} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="px-end" className="px-label">Fine <span className="font-normal text-px-ink-3">facoltativa</span></label>
                <input id="px-end" type="date" value={f.end_date ?? ""} min={f.start_date} onChange={(e) => set({ end_date: e.target.value || null })} aria-invalid={fe.end_date ? true : undefined} className="px-input" />
                <FieldError message={fe.end_date} />
              </div>
            </div>
            <span className="text-[14px] text-px-ink-2">Dopo la data di fine la medicina esce dal calendario e dalle previsioni.</span>
          </section>

          {error && (
            <div role="alert" className="rounded-[12px] border border-px-out-line bg-px-out-bg p-3.5">
              <FieldError message={error} />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className="px-btn px-btn-primary flex-[1_1_200px]">
              {pending ? "Salvataggio…" : "Salva medicinale"}
            </button>
            {isNew && (
              <button type="button" disabled={pending} onClick={() => save(true)} className="px-btn px-btn-secondary flex-[1_1_200px]">
                Salva e aggiungine un altro
              </button>
            )}
            <Link href={`/piani/${planId}`} className="px-btn px-btn-secondary flex-[1_1_140px]">
              Annulla
            </Link>
          </div>

          {!isNew &&
            (confirmDelete ? (
              <div role="alertdialog" aria-labelledby="px-mdel-t" aria-describedby="px-mdel-d" className="flex flex-col gap-3 rounded-[14px] border-[1.5px] border-px-out-fg bg-px-out-bg p-4">
                <strong id="px-mdel-t" className="text-[16px] font-[650] leading-[1.35]">Togliere {initial.name} dal piano?</strong>
                <span id="px-mdel-d" className="text-px-ink-2">Si perdono anche le scorte registrate e lo storico dei movimenti.</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    autoFocus
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await deleteMedication(planId, medicationId!);
                        if (res && !res.ok) setError(res.error);
                      })
                    }
                    className="px-btn px-btn-sm px-btn-danger"
                  >
                    Elimina
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="px-btn px-btn-sm px-btn-secondary">Annulla</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="px-btn-link-danger self-start">
                Elimina medicinale
              </button>
            ))}
        </form>
        {extra}
        </div>

        <aside aria-label="Anteprima" className="sticky top-6 hidden min-w-[260px] flex-[0_1_300px] flex-col gap-2.5 min-[900px]:flex">
          <span className="t-mono uppercase tracking-[0.04em] text-px-ink-3">Anteprima dal vivo</span>
          <Dispenser med={preview.view} size="l" />
        </aside>
      </div>
    </>
  );
}
