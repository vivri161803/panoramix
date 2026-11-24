"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useState, useTransition } from "react";
import { createMedication, deleteMedication, updateMedication } from "@/lib/actions/medications";
import { lookupAic } from "@/lib/actions/aifa";
import type { AicLookup } from "@/lib/aic";
import { ATC_GROUPS, ATC_UNKNOWN, ATC_UNKNOWN_VALUE, atcColor, atcGroup } from "@/lib/atc";
import { WEEKDAYS_LETTER, WEEKDAYS_LONG, type ISODate } from "@/lib/dates";
import { daysWord, forecastMedication, formatQty, scheduleSummary, type FrequencyType, type PlanSettings } from "@/lib/forecast";
import { PILL_SHAPES } from "@/lib/pills";
import {
  CATEGORIES,
  containerWord,
  daysQuestion,
  defaultMode,
  doseQuestion,
  doseStep,
  doseWord,
  levelPhrase,
  perPackQuestion,
  recountQuestion,
  type Category,
  type CategoryMed,
} from "@/lib/categories";
import type { MedicationInput } from "@/lib/schemas";
import { dispenserView } from "@/lib/view";
import { Dispenser } from "@/components/Dispenser";
import { FieldError } from "@/components/ui/FieldError";
import { Pill } from "@/components/ui/Pill";
import { CategoryGlyph, Presidio } from "@/components/ui/Presidio";
import { Switch } from "@/components/ui/Switch";
import { IconBack } from "@/components/ui/icons";

// lo scanner (fotocamera e WebAssembly) si scarica solo quando si apre
const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), { ssr: false });

/** Stato del modulo: la categoria si sceglie (o arriva dalla scansione) prima del resto. */
export type MedicationFormState = Omit<MedicationInput, "category"> & { category: Category | null };

interface Props {
  planId: string;
  planName: string;
  medicationId?: string;
  initial: MedicationFormState;
  /** in modifica, a livello: la scorta di oggi in parole («circa 18 giorni · 1 flacone e mezzo») */
  levelStockText?: string;
  settings: PlanSettings;
  today: ISODate;
  /** contenuto sotto il modulo (es. cambi di dose programmati) */
  extra?: React.ReactNode;
  /** colore salvato: per i medicinali di prima, finché non si sceglie il gruppo */
  currentColor?: string;
}

type Filled = "name" | "strength" | "pills_per_pack" | "requires_prescription" | "shape" | "category";

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

type NumKey = "pills_per_pack" | "stock_qty" | "interval_days" | "cycle_on" | "cycle_off" | "days_per_pack";

/** Quello aperto, per la scorta a livello: pieno, metà, quasi finito o nessuno. */
const OPEN_OPTIONS = [
  { v: 1, label: "Pieno" },
  { v: 0.5, label: "Metà" },
  { v: 0.1, label: "Quasi finito" },
  { v: 0, label: "Nessuno" },
] as const;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return s.trim() === "" || !Number.isFinite(n) ? NaN : n;
};

export function MedicationForm({ planId, planName, medicationId, initial, levelStockText, settings, today, extra, currentColor }: Props) {
  const isNew = !medicationId;
  const [f, setF] = useState<MedicationFormState>(initial);
  // modo di conteggio: a livello se ha days_per_pack; quello salvato serve a riconoscere un cambio di modo
  const savedLevel = !isNew && initial.days_per_pack != null;
  const [levelMode, setLevelMode] = useState(savedLevel);
  const [closed, setClosed] = useState(0);
  const [openPart, setOpenPart] = useState<number>(1);
  const [txt, setTxt] = useState<Record<NumKey, string>>({
    pills_per_pack: String(initial.pills_per_pack),
    stock_qty: initial.stock_qty == null ? "" : String(initial.stock_qty),
    days_per_pack: initial.days_per_pack == null ? "" : String(initial.days_per_pack),
    interval_days: String(initial.interval_days ?? 2),
    cycle_on: String(initial.cycle_on ?? 21),
    cycle_off: String(initial.cycle_off ?? 7),
  });
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [aicText, setAicText] = useState(initial.aic ?? "");
  const [aifa, setAifa] = useState<AicLookup | null>(null);
  const [filled, setFilled] = useState<Set<Filled>>(new Set());
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, startLookup] = useTransition();
  const [pending, start] = useTransition();
  const set = (patch: Partial<MedicationFormState>) => setF((x) => ({ ...x, ...patch }));
  const category: Category = f.category ?? "altro";
  const asNeeded = f.frequency_type === "as_needed";
  // al bisogno si conta sempre a pezzi
  const level = levelMode && !asNeeded;
  const modeChanged = !isNew && level !== savedLevel;
  /** il medicinale per le parole: categoria, modo e frequenza */
  const wm: CategoryMed = { category, daysPerPack: level ? 1 : null, frequencyType: f.frequency_type };
  const step = doseStep(wm);
  const setNum = (k: NumKey, v: string) => setTxt((t) => ({ ...t, [k]: v }));
  /** cambio di modo: a livello una confezione parte da 1 contenitore, i giorni si scrivono a mano */
  const switchMode = (toLevel: boolean) => {
    setLevelMode(toLevel);
    setTxt((t) => ({ ...t, days_per_pack: "", pills_per_pack: toLevel ? "1" : savedLevel || !isNew ? "" : t.pills_per_pack, stock_qty: toLevel ? t.stock_qty : "" }));
    setClosed(0);
    setOpenPart(1);
  };
  // le categorie con passo 1 non si spezzano: le mezze dosi salgono all'intero
  const setCategory = (c: Category, mode = defaultMode(c), shape: string | null = null) => {
    const up = (n: number) => (doseStep({ category: c }) === 1 ? Math.ceil(n) : n);
    setF((x) => ({
      ...x,
      category: c,
      shape: c === "pillola" ? ((shape ?? x.shape ?? "tonda") as MedicationFormState["shape"]) : null,
      dose_morning: up(x.dose_morning),
      dose_noon: up(x.dose_noon),
      dose_evening: up(x.dose_evening),
    }));
    if (isNew) {
      const toLevel = mode === "livello";
      setLevelMode(toLevel);
      setTxt((t) => ({ ...t, days_per_pack: "", pills_per_pack: toLevel ? "1" : t.pills_per_pack === "1" ? "30" : t.pills_per_pack }));
    }
  };
  // il gruppo arriva da AIFA (codice completo con AIC): si mostra e basta
  const groupFromAifa = !!f.aic && (f.atc_code?.length ?? 0) > 1 && !!atcGroup(f.atc_code);
  const pillColor = f.atc_code === ATC_UNKNOWN_VALUE ? ATC_UNKNOWN.color : f.atc_code ? atcColor(f.atc_code) : (currentColor ?? ATC_UNKNOWN.color);
  const hl = (k: Filled) => (filled.has(k) ? { boxShadow: "0 0 0 2px var(--px-primary)" } : undefined);

  const applyLookup = useCallback((d: AicLookup) => {
    const got = new Set<Filled>(["name"]);
    const patch: Partial<MedicationFormState> = { aic: d.aic, name: d.name };
    if (d.atc_code) patch.atc_code = d.atc_code;
    if (d.strength) {
      patch.strength = d.strength;
      got.add("strength");
    }
    got.add("category");
    if (d.shape) got.add("shape");
    if (d.requires_prescription !== null) {
      patch.requires_prescription = d.requires_prescription;
      got.add("requires_prescription");
    }
    setF((x) => {
      // categoria da AIFA; la forma della pillola resta quella scelta se AIFA non la dice
      const up = (n: number) => (doseStep({ category: d.category }) === 1 ? Math.ceil(n) : n);
      const shape = d.category === "pillola" ? ((d.shape ?? x.shape ?? "tonda") as MedicationFormState["shape"]) : null;
      return { ...x, ...patch, category: d.category, shape, dose_morning: up(x.dose_morning), dose_noon: up(x.dose_noon), dose_evening: up(x.dose_evening) };
    });
    // il modo di partenza viene dalla confezione (penna, multidose, monodose), non solo dalla categoria
    const toLevel = d.mode === "livello";
    setLevelMode(toLevel);
    if (toLevel) {
      // a livello la confezione si conta in contenitori: di solito uno
      setTxt((t) => ({ ...t, days_per_pack: "", pills_per_pack: "1" }));
    } else if (d.pills_per_pack) {
      setTxt((t) => ({ ...t, days_per_pack: "", pills_per_pack: String(d.pills_per_pack) }));
      got.add("pills_per_pack");
    }
    setAicText(d.aic);
    setFilled(got);
    setAifa(d);
    setLookupError(null);
  }, []);

  const search = useCallback(
    (raw: string, format = "manual") => {
      setLookupError(null);
      startLookup(async () => {
        const res = await lookupAic(raw, format);
        if (res.ok && res.data) applyLookup(res.data);
        else if (!res.ok) setLookupError(res.error);
      });
    },
    [applyLookup],
  );

  const onScanned = useCallback(
    (raw: string, format: string) => {
      setScanOpen(false);
      search(raw, format);
    },
    [search],
  );
  const closeScanner = useCallback(() => setScanOpen(false), []);
  // scorta: a pezzi il campo; a livello chiusi + aperto alla creazione o con un cambio di modo,
  // altrimenti non arriva dal modulo (si riconta dal Dispenser)
  const askLevelStock = level && (isNew || modeChanged);
  const stockQty = level ? (askLevelStock ? closed + openPart : undefined) : num(txt.stock_qty);
  const input: MedicationInput = {
    ...f,
    category,
    shape: category === "pillola" ? f.shape : null,
    pills_per_pack: num(txt.pills_per_pack),
    stock_qty: stockQty,
    days_per_pack: level ? num(txt.days_per_pack) : null,
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
      color: pillColor,
      category,
      shape: input.shape ?? null,
      aic: input.aic,
      atcCode: input.atc_code && input.atc_code !== ATC_UNKNOWN_VALUE ? input.atc_code : null,
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
      stockQty: ok(input.stock_qty) ?? (level ? 1 : 0),
      stockAsOf: today,
      daysPerPack: level ? (ok(input.days_per_pack, 1) ?? 30) : null,
      orderedAt: null,
    };
    const fc = forecastMedication(med, { plan: settings, today });
    return { med, fc, view: dispenserView(med, fc, today) };
  })();

  const sum1 = scheduleSummary(preview.med);
  const cov = preview.fc.coverageDays;
  const qtyText = level && !askLevelStock && levelStockText ? levelStockText : level ? levelPhrase(preview.med.stockQty, null, wm) : `${formatQty(preview.med.stockQty)} ${containerWord(wm, preview.med.stockQty)}`;
  const sum2 =
    input.frequency_type === "as_needed"
      ? `${qtyText} in casa: vale solo l’avviso dell’ultima confezione`
      : level && !num(txt.days_per_pack)
        ? "Scrivi per quanti giorni di uso dura per vedere la copertura"
        : cov === null
          ? `${qtyText} in casa → basta fino alla fine della terapia`
          : `${qtyText} in casa → ${cov} ${daysWord(cov)} di copertura`;

  function save(another = false) {
    setError(null);
    setFe({});
    if (!f.category) {
      setFe({ category: "Scegli la categoria del medicinale." });
      setError("Scegli la categoria del medicinale.");
      return;
    }
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
            <div className="flex flex-col gap-3 rounded-[14px] bg-px-surface-2 p-4">
              <button type="button" onClick={() => setScanOpen(true)} disabled={looking} className="px-btn px-btn-primary self-start">
                Inquadra il codice sulla scatola
              </button>
              <div className="flex flex-col gap-2">
                <label htmlFor="px-aic" className="px-label">oppure scrivi il codice AIC</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="px-aic"
                    value={aicText}
                    onChange={(e) => setAicText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (aicText.trim()) search(aicText);
                      }
                    }}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="9 cifre, es. 027161064"
                    aria-describedby="px-aic-help"
                    aria-invalid={lookupError ? true : undefined}
                    className="px-input min-w-0 flex-[1_1_180px]"
                  />
                  <button type="button" onClick={() => search(aicText)} disabled={looking || !aicText.trim()} className="px-btn px-btn-secondary flex-[0_0_auto]">
                    {looking ? "Cerco…" : "Cerca"}
                  </button>
                </div>
                <span id="px-aic-help" className="text-[14px] leading-[1.35] text-px-ink-2">
                  Lo trovi sulla scatola, sotto il codice a barre del bollino (dopo la A) o vicino al quadratino.
                </span>
                <FieldError message={lookupError ?? fe.aic} />
              </div>
              {aifa && (
                <div role="status" className="flex flex-col gap-1 rounded-[12px] border border-px-line bg-px-surface px-3.5 py-3">
                  <strong className="text-[15px] font-[650] leading-[1.35]">Dati presi da AIFA: controllali prima di salvare</strong>
                  <span className="text-[14px] leading-[1.4] text-px-ink-2">
                    {aifa.name} · {aifa.pack_description} · AIC {aifa.aic}. I campi compilati sono evidenziati e restano modificabili.
                  </span>
                </div>
              )}
              {f.aic && (
                <button
                  type="button"
                  onClick={() => {
                    set({ aic: null, atc_code: atcGroup(f.atc_code)?.letter ?? "" });
                    setAicText("");
                    setAifa(null);
                    setFilled(new Set());
                  }}
                  className="self-start text-[15px] font-semibold text-px-ink-2 underline"
                >
                  Togli il codice AIC {f.aic}
                </button>
              )}
            </div>
            <div className={grid2}>
              <div className="flex flex-col gap-2">
                <label htmlFor="px-mn" className="px-label">Nome</label>
                <input id="px-mn" value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} required autoComplete="off" aria-invalid={fe.name ? true : undefined} className="px-input" style={hl("name")} />
                <FieldError message={fe.name} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="px-md" className="px-label">Dosaggio <span className="font-normal text-px-ink-3">facoltativo</span></label>
                <input id="px-md" value={f.strength} onChange={(e) => set({ strength: e.target.value })} maxLength={40} placeholder="Es. 5 mg" autoComplete="off" className="px-input" style={hl("strength")} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="px-mdesc" className="px-label">Descrizione <span className="font-normal text-px-ink-3">facoltativa</span></label>
              <input id="px-mdesc" value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={200} placeholder="Es. a stomaco pieno" autoComplete="off" className="px-input" />
            </div>
          </section>

          <section className={section}>
            <h2 id="px-cat-title" className={h2}>Categoria</h2>
            <div role="group" aria-labelledby="px-cat-title" className="grid grid-cols-5 gap-2 max-[520px]:grid-cols-3" style={hl("category")}>
              {CATEGORIES.map((c) => {
                const sel = f.category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={sel}
                    onClick={() => !sel && setCategory(c.id)}
                    className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-[12px] px-1 py-2.5 text-[15px] font-semibold leading-[1.2]"
                    style={{ border: `1px solid ${sel ? "var(--px-primary)" : "var(--px-line-strong)"}`, background: sel ? "var(--px-primary)" : "var(--px-surface)", color: sel ? "var(--px-on-primary)" : "var(--px-ink)" }}
                  >
                    <CategoryGlyph category={c.id} size={24} />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
            {!f.category && <span className="text-[14px] leading-[1.35] text-px-ink-2">Scegli la categoria per continuare: le domande del modulo cambiano con la categoria.</span>}
            <FieldError message={fe.category} />
          </section>

          {f.category && (
          <>
          <section className={section}>
            <h2 className={h2}>Confezione e scorte</h2>
            {level && (
              <div className="flex flex-col gap-2">
                <label htmlFor="px-dpp" className="px-label">{daysQuestion(wm)}</label>
                <div className="flex flex-wrap items-center gap-2.5">
                  <input id="px-dpp" type="number" inputMode="numeric" min={1} max={365} step={1} value={txt.days_per_pack} onChange={(e) => setNum("days_per_pack", e.target.value)} aria-invalid={fe.days_per_pack ? true : undefined} aria-describedby="px-dpp-help" className={`${smallNum} w-[96px]`} />
                  <span>giorni di uso</span>
                </div>
                <span id="px-dpp-help" className="text-[14px] leading-[1.35] text-px-ink-2">
                  Contano solo i giorni in cui si usa. Se la dose cambia, aggiorna questo numero o riconta.
                </span>
                <FieldError message={fe.days_per_pack} />
              </div>
            )}
            <div className={grid2}>
              <div className="flex flex-col gap-2">
                <label htmlFor="px-pp" className="px-label">{perPackQuestion(wm)}</label>
                <input id="px-pp" type="number" inputMode="numeric" min={1} step={1} value={txt.pills_per_pack} onChange={(e) => setNum("pills_per_pack", e.target.value)} aria-invalid={fe.pills_per_pack ? true : undefined} className="px-input" style={hl("pills_per_pack")} />
                <FieldError message={fe.pills_per_pack} />
              </div>
              {!level && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="px-qty" className="px-label">{`${cap(containerWord(wm, 2))} in casa`}</label>
                  <input id="px-qty" type="number" inputMode="decimal" min={0} step={0.5} value={txt.stock_qty} onChange={(e) => setNum("stock_qty", e.target.value)} aria-invalid={fe.stock_qty ? true : undefined} aria-describedby="px-qty-help" className="px-input" />
                  <span id="px-qty-help" className="text-[14px] leading-[1.35] text-px-ink-2">
                    {isNew || modeChanged ? (category === "pillola" ? "Conta le compresse adesso. Le mezze valgono ½." : recountQuestion(wm)) : "Se cambi questo numero diventa un nuovo conteggio."}
                  </span>
                  <FieldError message={fe.stock_qty} />
                </div>
              )}
            </div>
            {level && askLevelStock && (
              <div className="flex flex-col gap-3 rounded-[14px] bg-px-surface-2 p-4">
                <span className="px-label">Quanto c’è in casa{modeChanged ? ", contato nel nuovo modo" : ""}</span>
                <div className="flex flex-wrap items-center gap-2.5">
                  <label htmlFor="px-closed">{cap(containerWord(wm, 2))} chiusi</label>
                  <input id="px-closed" type="number" inputMode="numeric" min={0} step={1} value={closed} onChange={(e) => setClosed(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={`${smallNum} w-[88px]`} />
                </div>
                <fieldset className="m-0 flex flex-col gap-1.5 border-none p-0">
                  <legend className="mb-1.5 p-0 text-[16px] font-medium">Quello aperto</legend>
                  <div className="grid grid-cols-2 gap-2 min-[520px]:grid-cols-4">
                    {OPEN_OPTIONS.map((o) => (
                      <button key={o.v} type="button" aria-pressed={openPart === o.v} onClick={() => setOpenPart(o.v)} className="min-h-11 rounded-[12px] px-2 text-[15px] font-semibold leading-[1.2] text-px-ink" style={radioCard(openPart === o.v)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <FieldError message={fe.stock_qty} />
              </div>
            )}
            {level && !askLevelStock && (
              <div className="flex flex-col gap-1 rounded-[14px] bg-px-surface-2 p-4">
                <span className="px-label">In casa</span>
                <span className="text-[17px] font-[650] leading-[1.3]">{levelStockText || "—"}</span>
                <Link href={`/piani/${planId}`} className="self-start text-[15px] font-semibold">
                  Riconta
                </Link>
              </div>
            )}
            {!asNeeded && (
              <button type="button" onClick={() => switchMode(!level)} className="self-start text-[15px] font-semibold text-px-ink-2 underline">
                {level ? "Conta a pezzi" : "Conta a giorni"}
              </button>
            )}
            {modeChanged && (
              <span role="status" className="text-[14px] leading-[1.35] text-px-order-fg">
                Cambi il modo di conteggio: la scorta di prima non vale più, indica quanto c’è in casa nel nuovo modo.
              </span>
            )}
            <div className="-m-2 rounded-[12px] p-2" style={hl("requires_prescription")}>
              <Switch checked={f.requires_prescription} onChange={(v) => set({ requires_prescription: v })} label="Serve la ricetta" sub="Negli avvisi trovi il testo pronto per il medico." />
            </div>
          </section>

          <section className={section}>
            <h2 className={h2}>Aspetto nel dispenser</h2>
            <div className="flex flex-wrap items-center gap-5">
              <div role="img" aria-label={`Anteprima: ${CATEGORIES.find((c) => c.id === category)!.label}${f.shape ? ` ${f.shape}` : ""}`} className="grid h-28 w-28 flex-none place-items-center rounded-[18px] bg-px-surface-2">
                <Presidio category={category} pillShape={f.shape} color={pillColor} size={76} rotate={category === "pillola" ? -14 : undefined} />
              </div>
              <div className="flex flex-[1_1_220px] flex-col gap-2">
                {groupFromAifa ? (
                  <>
                    <span className="px-label">A cosa serve</span>
                    <span className="text-[17px] font-[650] leading-[1.3]">{atcGroup(f.atc_code)!.label}</span>
                    <span className="text-[14px] leading-[1.35] text-px-ink-2">Dal codice ATC {f.atc_code} dell&apos;anagrafica AIFA. Il colore della compressa dipende da questo.</span>
                  </>
                ) : (
                  <>
                    <label htmlFor="px-atc" className="px-label">A cosa serve</label>
                    <select
                      id="px-atc"
                      value={f.atc_code === ATC_UNKNOWN_VALUE ? ATC_UNKNOWN_VALUE : (atcGroup(f.atc_code)?.letter ?? "")}
                      onChange={(e) => set({ atc_code: e.target.value })}
                      aria-invalid={fe.atc_code ? true : undefined}
                      aria-describedby="px-atc-help"
                      className="px-input"
                    >
                      <option value="" disabled>
                        Scegli…
                      </option>
                      {ATC_GROUPS.map((g) => (
                        <option key={g.letter} value={g.letter}>
                          {g.label}
                        </option>
                      ))}
                      <option value={ATC_UNKNOWN_VALUE}>{ATC_UNKNOWN.label}</option>
                    </select>
                    <span id="px-atc-help" className="text-[14px] leading-[1.35] text-px-ink-2">
                      Il colore della compressa dipende da questo: medicine dello stesso gruppo hanno lo stesso colore.
                    </span>
                    <FieldError message={fe.atc_code} />
                  </>
                )}
              </div>
            </div>
            {category === "pillola" && (
              <div className="flex flex-col gap-2.5">
                <span className="px-label">Forma</span>
                <div role="radiogroup" aria-label="Forma" className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,110px),1fr))]">
                  {PILL_SHAPES.map((sh) => {
                    const sel = sh.id === f.shape;
                    return (
                      <button key={sh.id} type="button" role="radio" aria-checked={sel} onClick={() => set({ shape: sh.id })} className="flex flex-col items-center gap-2.5 rounded-[14px] px-2 py-3.5 text-px-ink" style={{ ...radioCard(sel), ...(sel ? hl("shape") : undefined) }}>
                        <span className="grid h-7 place-items-center">
                          <Pill color={pillColor} shape={sh.id} size={40} />
                        </span>
                        <span className="text-[15px] font-semibold leading-none">{sh.label}</span>
                      </button>
                    );
                  })}
                </div>
                <FieldError message={fe.shape} />
              </div>
            )}
          </section>

          <section className={section}>
            <h2 className={h2}>{asNeeded ? "Quando" : `${doseQuestion(wm)} e quando`}</h2>
            {/* al bisogno non ci sono fasce: la quantità si indica quando si registra la presa */}
            {!asNeeded && (
              <>
              <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
                {SLOTS.map((s) => (
                  <div key={s.key} className="flex flex-col gap-2 rounded-[14px] bg-px-surface-2 p-3">
                    <span id={`px-slot-${s.key}`} className="px-label">{s.label}</span>
                    <div className="flex items-center justify-between gap-1">
                      <button type="button" onClick={() => set({ [s.key]: Math.max(0, f[s.key] - step) })} aria-label={`${step === 1 ? `1 ${doseWord(wm, 1)}` : `Mezza ${doseWord(wm, 1)}`} in meno ${s.w}`} className="h-11 w-11 flex-none rounded-[10px] border border-px-line-strong bg-px-surface text-[20px] font-semibold leading-none">
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={999}
                        step={step}
                        value={f[s.key]}
                        onChange={(e) => {
                          const v = Number(e.target.value.replace(",", "."));
                          set({ [s.key]: Number.isFinite(v) ? Math.min(999, Math.max(0, Math.round(v / step) * step)) : 0 });
                        }}
                        aria-labelledby={`px-slot-${s.key}`}
                        className="h-11 w-0 min-w-[56px] flex-1 rounded-[10px] border border-px-line-strong bg-px-surface text-center text-[20px] font-[650] leading-none text-px-ink"
                      />
                      <button type="button" onClick={() => set({ [s.key]: Math.min(999, f[s.key] + step) })} aria-label={`${step === 1 ? `1 ${doseWord(wm, 1)}` : `Mezza ${doseWord(wm, 1)}`} in più ${s.w}`} className="h-11 w-11 flex-none rounded-[10px] border border-px-line-strong bg-px-surface text-[20px] font-semibold leading-none">
                        +
                      </button>
                    </div>
                    <span className="text-[14px] leading-none text-px-ink-2">{f[s.key] > 0 ? doseWord(wm, f[s.key]) : "nessuna"}</span>
                  </div>
                ))}
              </div>
              <FieldError message={fe.doses} />
              </>
            )}

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

          </>
          )}

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

        {scanOpen && <BarcodeScanner onDetected={onScanned} onClose={closeScanner} />}
        <aside aria-label="Anteprima" className="sticky top-6 hidden min-w-[260px] flex-[0_1_300px] flex-col gap-2.5 min-[900px]:flex">
          <span className="t-mono uppercase tracking-[0.04em] text-px-ink-3">Anteprima dal vivo</span>
          {f.category ? <Dispenser med={preview.view} size="l" /> : <span className="text-[15px] text-px-ink-2">Scegli la categoria per vedere l’anteprima.</span>}
        </aside>
      </div>
    </>
  );
}
