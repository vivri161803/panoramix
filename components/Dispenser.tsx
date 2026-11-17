"use client";

// Porting di UI_mobile_pc/Dispenser.dc.html: scala comune 0–60 giorni, tacche a 7 e 14.
// Il tubo viene da Presidio (view="tube"): pezzi impilati, o una fascia piena a livello.

import Link from "next/link";
import { useState } from "react";
import { defaultMode, finishedOneLabel, recountQuestion } from "@/lib/categories";
import type { MedStatus } from "@/lib/forecast";
import type { DispenserView } from "@/lib/view";
import { CategoryGlyph, Presidio } from "@/components/ui/Presidio";
import { StatusChip, STATUS_LABEL } from "@/components/ui/StatusChip";
import { IconChevronDown, IconPlus } from "@/components/ui/icons";

const META: Record<MedStatus, { bg: string; bc: string; ring: string; fg: string }> = {
  ok: { bg: "var(--px-surface)", bc: "var(--px-line)", ring: "none", fg: "var(--px-ink-2)" },
  order: { bg: "var(--px-surface)", bc: "var(--px-order-line)", ring: "0 0 0 1px var(--px-order-line)", fg: "var(--px-order-fg)" },
  ordered: { bg: "var(--px-surface)", bc: "var(--px-ordered-line)", ring: "0 0 0 1px var(--px-ordered-line)", fg: "var(--px-ordered-fg)" },
  out: { bg: "var(--px-out-bg)", bc: "var(--px-out-fg)", ring: "0 0 0 1px var(--px-out-fg)", fg: "var(--px-out-fg)" },
};

type Size = "s" | "l";

/** Quello aperto, nel riconteggio a livello: pieno, metà, quasi finito o nessuno. */
const OPEN_OPTIONS = [
  { v: 1, label: "Pieno" },
  { v: 0.5, label: "Metà" },
  { v: 0.1, label: "Quasi finito" },
  { v: 0, label: "Nessuno" },
] as const;

/** Scorta a livello divisa in contenitori chiusi e quanto resta in quello aperto. */
function splitLevel(q: number): { closed: number; open: number } {
  if (!(q > 1e-9)) return { closed: 0, open: 0 };
  const closed = Math.max(0, Math.ceil(q - 1e-9) - 1);
  const rem = q - closed;
  return { closed, open: rem > 0.75 ? 1 : rem > 0.3 ? 0.5 : 0.1 };
}

function TubeFor({ med, size, max }: { med: DispenserView; size: Size; max: number }) {
  const days = med.asNeeded ? Math.min(max, Math.round((med.qty / med.perPack) * 30)) : med.days;
  return (
    <Presidio
      view="tube"
      category={med.category}
      pillShape={med.pillShape}
      color={med.color}
      size={size}
      level={med.level}
      days={days}
      scaleMax={max}
      status={med.status}
      asNeeded={med.asNeeded}
      hasStock={med.qty > 0}
    />
  );
}

export interface DispenserActions {
  onArrive: (packs: number) => void;
  onOrdered: () => void;
  onRecount: (qty: number) => void;
  /** solo medicinali al bisogno: registra una presa */
  onTake: (qty: number) => void;
  historyHref: string;
  editHref: string;
  busy?: boolean;
}

type Panel = null | "menu" | "arrive" | "recount" | "take";

const menuBtn =
  "min-h-11 rounded-[8px] border-none bg-transparent px-2.5 py-1.5 text-left text-[15px] font-medium leading-[1.25] text-px-ink no-underline hover:bg-px-surface-2 hover:text-px-ink";
const stepBtn = "h-11 w-11 flex-none rounded-[10px] border border-px-line-strong bg-px-surface text-[20px] font-semibold leading-none";

export function Dispenser({
  med,
  size,
  scaleMax = 60,
  actions,
  historyHref,
  prepReminder = false,
}: {
  med: DispenserView;
  size?: Size;
  scaleMax?: number;
  actions?: DispenserActions;
  /** link allo storico quando non ci sono azioni (sola lettura) */
  historyHref?: string;
  /** il piano ha il promemoria del portapillole: il riconteggio comprende anche il portapillole */
  prepReminder?: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [n, setN] = useState(0);
  const [closed, setClosed] = useState(0);
  const [openPart, setOpenPart] = useState<number>(1);
  const meta = META[med.status];
  const recount = panel === "recount";
  const take = panel === "take";
  const unit = (q: number) => (Math.abs(q - 1) < 1e-9 ? med.unitOne : med.unitMany);
  // al bisogno nelle categorie a livello si toglie un contenitore intero («Finito un flacone»)
  const wholeTake = defaultMode(med.category) === "livello";

  const open = (p: Panel) => {
    setPanel(p);
    if (p === "arrive") setN(1);
    if (p === "recount") {
      setN(med.qty);
      const sp = splitLevel(med.qty);
      setClosed(sp.closed);
      setOpenPart(sp.open);
    }
    if (p === "take") setN(1);
  };

  const step = take && !wholeTake && med.category === "pillola" ? 0.5 : 1;
  const stockText = med.level ? med.levelText : `${med.qtyText} ${unit(med.qty)}`;
  const aria = `${med.name} ${med.strength}, ${med.categoryLabel}, ${stockText}, ${med.daysText ? `${med.daysText} ${med.daysWord}` : med.daysWord}, ${STATUS_LABEL[med.status].toLowerCase()}`;

  return (
    <div
      role="group"
      aria-label={aria}
      className="flex h-full min-w-0 flex-col gap-3.5 rounded-[18px] px-3 pt-3.5 pb-3"
      style={{ background: meta.bg, border: `1px solid ${meta.bc}`, boxShadow: meta.ring }}
    >
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-1.5">
        <StatusChip status={med.status} />
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-px-surface-2 px-2.5 text-[13px] font-semibold leading-none text-px-ink-2">
          <CategoryGlyph category={med.category} size={16} />
          {med.categoryLabel}
        </span>
      </div>
      <div className="flex justify-center py-0.5">
        {size ? (
          <TubeFor med={med} size={size} max={scaleMax} />
        ) : (
          <>
            <div className="min-[900px]:hidden">
              <TubeFor med={med} size="s" max={scaleMax} />
            </div>
            <div className="hidden min-[900px]:block">
              <TubeFor med={med} size="l" max={scaleMax} />
            </div>
          </>
        )}
      </div>
      <div className="flex flex-col gap-[3px]">
        <div className="text-[18px] font-[650] leading-[1.2] tracking-[-0.01em] [overflow-wrap:anywhere]">{med.name || "Nuovo medicinale"}</div>
        <div className="flex flex-wrap items-center gap-2 text-[15px] font-medium leading-[1.3] text-px-ink-2">
          {med.strength && <span>{med.strength}</span>}
          {med.rx && <span className="rounded-[6px] border border-px-line-strong px-1.5 py-1 text-[12px] font-semibold leading-none text-px-ink-2">Serve ricetta</span>}
        </div>
      </div>
      <div className="flex flex-col gap-[3px] text-[16px] leading-[1.35] text-px-ink-2">
        {med.level ? (
          <div className="font-[650] text-px-ink">{med.levelText}</div>
        ) : (
          <>
            <div>
              <span className="font-[650] text-px-ink">{med.qtyText}</span> {med.qtyWord}
            </div>
            <div>
              {med.daysText && <span className="font-[650] text-px-ink">{med.daysText} </span>}
              {med.daysWord}
            </div>
          </>
        )}
        {med.endLabel && <div>{med.endLabel}</div>}
      </div>
      {med.reason && (
        <div className="text-[15px] font-semibold leading-[1.35] [text-wrap:pretty]" style={{ color: meta.fg }}>
          {med.reason}
        </div>
      )}
      {med.nextChange && (
        <div className="rounded-[10px] bg-px-surface-2 px-2.5 py-2 text-[14px] font-semibold leading-[1.35] text-px-ink-2 [text-wrap:pretty]">{med.nextChange}</div>
      )}
      {!actions && historyHref && (
        <Link href={historyHref} className="mt-auto flex min-h-11 items-center justify-center rounded-[12px] border border-px-line-strong bg-px-surface px-2.5 py-2 text-[15px] font-semibold leading-[1.2] text-px-ink no-underline hover:text-px-ink">
          Storico
        </Link>
      )}
      {actions && (
        <div className="mt-auto flex flex-col gap-2">
          {med.asNeeded && (
            <button
              type="button"
              disabled={actions.busy || med.qty <= 0}
              onClick={() => actions.onTake(1)}
              aria-label={wholeTake ? `${finishedOneLabel(med)} di ${med.name}: togli 1 ${med.unitOne} dalle scorte` : `Presa di ${med.name}: togli 1 ${med.unitOne} dalle scorte`}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-[12px] border-[1.5px] border-px-ink bg-px-surface px-2.5 py-2 text-[15px] font-semibold leading-[1.2] text-px-ink"
            >
              {wholeTake ? finishedOneLabel(med) : "− Presa 1"}
            </button>
          )}
          <button
            type="button"
            disabled={actions.busy}
            onClick={() => actions.onArrive(1)}
            aria-label={`Arrivata confezione di ${med.name}: aggiungi ${med.perPack} ${unit(med.perPack)}`}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-[12px] border-none bg-px-primary px-2.5 py-2 text-[15px] font-semibold leading-[1.2] text-px-on-primary"
          >
            <IconPlus /> +1 confezione
          </button>
          <button
            type="button"
            onClick={() => open(panel ? null : "menu")}
            aria-expanded={panel === "menu"}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-[12px] border border-px-line-strong bg-px-surface px-2.5 py-2 text-[15px] font-semibold leading-[1.2] text-px-ink"
          >
            Altre azioni <IconChevronDown />
          </button>
          {panel === "menu" && (
            <div className="flex flex-col rounded-[12px] border border-px-line bg-px-surface p-1">
              {med.asNeeded && (
                <button type="button" className={menuBtn} onClick={() => open("take")}>
                  Registra una presa
                </button>
              )}
              <button type="button" className={menuBtn} onClick={() => open("arrive")}>
                Arrivate più confezioni
              </button>
              <button type="button" className={menuBtn} disabled={actions.busy} onClick={() => { setPanel(null); actions.onOrdered(); }}>
                {med.ordered ? "Annulla ordine" : "Segna ordinata"}
              </button>
              <button type="button" className={menuBtn} onClick={() => open("recount")}>
                Ricontrolla conteggio
              </button>
              <Link href={actions.historyHref} className={menuBtn}>
                Storico
              </Link>
              <Link href={actions.editHref} className={menuBtn}>
                Modifica
              </Link>
            </div>
          )}
          {(panel === "arrive" || panel === "recount" || panel === "take") && (
            <form
              className="flex flex-col gap-2 rounded-[12px] border border-px-line bg-px-surface-2 p-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (recount) actions.onRecount(med.level ? closed + openPart : n);
                else if (take) actions.onTake(n);
                else actions.onArrive(n);
                setPanel(null);
              }}
            >
              {recount && med.level ? (
                <>
                  <label htmlFor={`px-closed-${med.id}`} className="text-[15px] font-semibold leading-[1.3]">
                    {med.unitMany.charAt(0).toUpperCase() + med.unitMany.slice(1)} chiusi
                  </label>
                  <div className="flex gap-1">
                    <button type="button" aria-label={`Un ${med.unitOne} chiuso in meno`} onClick={() => setClosed((x) => Math.max(0, x - 1))} className={stepBtn}>
                      −
                    </button>
                    <input
                      id={`px-closed-${med.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={closed}
                      onChange={(e) => setClosed(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      className="h-11 min-w-0 flex-1 rounded-[10px] border border-px-line-strong bg-px-surface text-center text-[18px] font-[650] leading-none text-px-ink"
                    />
                    <button type="button" aria-label={`Un ${med.unitOne} chiuso in più`} onClick={() => setClosed((x) => x + 1)} className={stepBtn}>
                      +
                    </button>
                  </div>
                  <fieldset className="m-0 flex flex-col gap-1.5 border-none p-0">
                    <legend className="mb-1.5 p-0 text-[15px] font-semibold leading-[1.3]">Quello aperto</legend>
                    <div className="grid grid-cols-2 gap-1">
                      {OPEN_OPTIONS.map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          aria-pressed={openPart === o.v}
                          onClick={() => setOpenPart(o.v)}
                          className="min-h-11 rounded-[10px] text-[14px] font-semibold leading-[1.2]"
                          style={{ border: `1.5px solid ${openPart === o.v ? "var(--px-ink)" : "var(--px-line-strong)"}`, background: openPart === o.v ? "var(--px-ink)" : "var(--px-surface)", color: openPart === o.v ? "var(--px-surface)" : "var(--px-ink)" }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </>
              ) : (
              <>
              <label htmlFor={`px-n-${med.id}`} className="text-[15px] font-semibold leading-[1.3]">
                {recount ? recountQuestion(med, prepReminder) : take ? (wholeTake ? `Quanti ${med.unitMany} sono finiti?` : `Quante prese? (${med.unitMany})`) : "Confezioni arrivate"}
              </label>
              <div className="flex gap-1">
                <button type="button" aria-label={recount ? "Una in meno" : take ? "Una in meno" : "Una confezione in meno"} onClick={() => setN((x) => Math.max(recount ? 0 : take ? step : 1, x - step))} className={stepBtn}>
                  −
                </button>
                <input
                  id={`px-n-${med.id}`}
                  type="number"
                  inputMode="decimal"
                  min={recount ? 0 : take ? step : 1}
                  step={recount ? 0.5 : take ? step : 1}
                  value={Number.isFinite(n) ? n : 0}
                  onChange={(e) => setN(Math.max(0, Number(e.target.value.replace(",", ".")) || 0))}
                  className="h-11 min-w-0 flex-1 rounded-[10px] border border-px-line-strong bg-px-surface text-center text-[18px] font-[650] leading-none text-px-ink"
                />
                <button type="button" aria-label={recount ? "Una in più" : take ? "Una in più" : "Una confezione in più"} onClick={() => setN((x) => x + step)} className={stepBtn}>
                  +
                </button>
              </div>
              </>
              )}
              {!recount && !take && (
                <span className="text-[14px] leading-[1.3] text-px-ink-2">
                  = {n * med.perPack} {unit(n * med.perPack)} ({med.perPack} per confezione)
                </span>
              )}
              {take && <span className="text-[14px] leading-[1.3] text-px-ink-2">Escono dalle scorte di oggi. Ne restano {med.qtyText} prima della presa.</span>}
              <div className="flex flex-wrap gap-1.5">
                <button type="submit" disabled={actions.busy} className="min-h-11 flex-[1_1_90px] rounded-[10px] border-none bg-px-primary text-[15px] font-semibold leading-none text-px-on-primary">
                  {recount ? "Salva" : take ? "Registra" : "Aggiungi"}
                </button>
                <button type="button" onClick={() => setPanel(null)} className="min-h-11 flex-[1_1_90px] rounded-[10px] border border-px-line-strong bg-px-surface text-[15px] font-semibold leading-none">
                  Annulla
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
