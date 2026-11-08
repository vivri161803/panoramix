"use client";

// Porting di UI_mobile_pc/Dispenser.dc.html: scala comune 0–60 giorni, tacche a 7 e 14.

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { pillStyle } from "@/lib/pills";
import type { MedStatus } from "@/lib/forecast";
import type { DispenserView } from "@/lib/view";
import { StatusChip, STATUS_LABEL } from "@/components/ui/StatusChip";
import { IconChevronDown, IconPlus } from "@/components/ui/icons";

const META: Record<MedStatus, { bg: string; bc: string; ring: string; fg: string }> = {
  ok: { bg: "var(--px-surface)", bc: "var(--px-line)", ring: "none", fg: "var(--px-ink-2)" },
  order: { bg: "var(--px-surface)", bc: "var(--px-order-line)", ring: "0 0 0 1px var(--px-order-line)", fg: "var(--px-order-fg)" },
  ordered: { bg: "var(--px-surface)", bc: "var(--px-ordered-line)", ring: "0 0 0 1px var(--px-ordered-line)", fg: "var(--px-ordered-fg)" },
  out: { bg: "var(--px-out-bg)", bc: "var(--px-out-fg)", ring: "0 0 0 1px var(--px-out-fg)", fg: "var(--px-out-fg)" },
};

const GEO: Record<string, [number, number]> = { tonda: [0.46, 0.46], ovale: [0.58, 0.37], capsula: [0.72, 0.31] };
const DIMS = { s: { W: 48, H: 180 }, l: { W: 70, H: 250 } };
const JX = [-0.7, 0.55, -0.15, 0.8, -0.45, 0.25, -0.85, 0.4, 0, -0.3];
const JR = [-16, 11, -5, 19, -10, 4, -20, 8, 14, -2];

type Size = keyof typeof DIMS;

function geo(shape: string, W: number) {
  const g = GEO[shape] ?? GEO.tonda;
  const pw = W * g[0];
  const ph = W * g[1];
  return { pw, ph, step: ph * 0.8 };
}

function targetCount(med: DispenserView, size: Size, max: number) {
  const { W, H } = DIMS[size];
  const { step } = geo(med.shape, W);
  if (!(med.qty > 0)) return 0;
  const days = med.days === null ? max : med.days;
  const lvl = (Math.min(days, max) / max) * (H - 6);
  return Math.max(1, Math.min(Math.floor((H - 6) / step), Math.round(lvl / step)));
}

interface PillSlot {
  id: number;
  slot: number;
  anim: "in" | "out" | null;
  delay: number;
}

/** Compresse nel tubo: entrano dall'alto quando la scorta sale, escono dal basso quando scende. */
function usePills(target: number) {
  const [state, setState] = useState(() => ({
    target,
    nid: target,
    pills: Array.from({ length: target }, (_, i): PillSlot => ({ id: i, slot: i, anim: null, delay: 0 })),
  }));

  // aggiornamento "derivato" durante il render (pattern consigliato da React)
  if (state.target !== target) {
    const live = state.pills.filter((p) => p.anim !== "out");
    let pills = state.pills.map((p) => ({ ...p }));
    let nid = state.nid;
    if (target > live.length) {
      for (let k = 0; k < target - live.length; k++) pills.push({ id: nid++, slot: live.length + k, anim: "in", delay: k * 45 });
    } else {
      const d = live.length - target;
      pills = pills.map((p) => {
        if (p.anim === "out") return p;
        return p.slot < d ? { ...p, anim: "out" as const, delay: p.slot * 60 } : { ...p, slot: p.slot - d };
      });
    }
    setState({ target, nid, pills });
  }

  const animating = state.pills.some((p) => p.anim);
  useEffect(() => {
    if (!animating) return;
    const longest = Math.max(0, ...state.pills.map((p) => p.delay));
    const t = setTimeout(() => {
      setState((s) => ({ ...s, pills: s.pills.filter((p) => p.anim !== "out").map((p) => ({ ...p, anim: null })) }));
    }, longest + 900);
    return () => clearTimeout(t);
  }, [animating, state.pills]);

  return state.pills;
}

function Tube({ med, size, max }: { med: DispenserView; size: Size; max: number }) {
  const { W, H } = DIMS[size];
  const st = med.status;
  const side = 36;
  const TW = W + 4;
  const B = 12;
  const CAP = 10;
  const days = med.days === null ? max : med.days;
  const over = med.days === null || days >= max;
  const fg = META[st].fg;
  const lvl = (Math.min(days, max) / max) * (H - 6);
  const { pw, ph, step } = geo(med.shape, W);
  const pills = usePills(targetCount(med, size, max));
  const ticks = med.asNeeded ? [] : [7, 14];

  return (
    <div aria-hidden="true" style={{ position: "relative", width: side * 2 + TW, height: H + B + CAP, flex: "none" }}>
      <div style={{ position: "absolute", left: side - 10, width: TW + 20, bottom: 0, height: B, borderRadius: "3px 3px 7px 7px", background: "var(--px-surface-3)", border: "1.5px solid var(--px-line-strong)" }} />
      <div
        style={{
          position: "absolute",
          left: side,
          bottom: B - 1,
          width: TW,
          height: H,
          border: "2px solid var(--px-line-strong)",
          borderTop: "none",
          borderRadius: `0 0 ${W * 0.3}px ${W * 0.3}px`,
          background: "var(--px-tube-bg)",
          overflow: "hidden",
        }}
      >
        {pills.map((p) => {
          const j = p.id % 10;
          const x = (W - pw) / 2 + ((JX[j] * (W - pw)) / 2) * 0.9;
          const r = med.shape === "tonda" ? JR[j] * 0.3 : JR[j];
          const style: CSSProperties & { "--from": string } = {
            position: "absolute",
            left: x,
            bottom: 3 + p.slot * step,
            width: pw,
            height: ph,
            transition: "bottom 520ms cubic-bezier(.45,0,.55,1) 180ms",
            animation:
              p.anim === "in"
                ? `pxDrop 620ms cubic-bezier(.5,0,.9,.6) ${p.delay}ms both`
                : p.anim === "out"
                  ? `pxOut 520ms cubic-bezier(.5,0,1,1) ${p.delay}ms both`
                  : "none",
            "--from": `${-(H - p.slot * step + 30)}px`,
          };
          return (
            <div key={p.id} style={style}>
              <div style={{ ...pillStyle(med.color, med.shape, pw, ph), transform: `rotate(${r}deg)` }} />
            </div>
          );
        })}
        {ticks.map((t) => {
          const passed = days < t && st !== "ok";
          return (
            <div
              key={`l${t}`}
              style={{ position: "absolute", left: 0, right: 0, bottom: (t / max) * (H - 6), borderTop: passed ? `2px solid ${fg}` : "1px dashed var(--px-line-strong)", zIndex: 3 }}
            />
          );
        })}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(255,255,255,0) 0%, var(--px-glass-hi) 13%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 74%, var(--px-glass-hi) 88%, rgba(255,255,255,0) 100%)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
        {over && !med.asNeeded && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 8,
              transform: "translateX(-50%)",
              padding: "3px 6px",
              borderRadius: 6,
              background: "var(--px-ink)",
              color: "var(--px-surface)",
              font: "600 12px/1.2 var(--px-mono)",
              zIndex: 4,
            }}
          >
            {max}+
          </div>
        )}
      </div>
      <div style={{ position: "absolute", left: side - 5, width: TW + 10, bottom: B + H - 3, height: CAP, borderRadius: "5px 5px 2px 2px", background: "var(--px-surface-3)", border: "1.5px solid var(--px-line-strong)" }} />
      {ticks.map((t) => {
        const passed = days < t && st !== "ok";
        const col = passed ? fg : "var(--px-ink-3)";
        const y = B - 1 + (t / max) * (H - 6);
        return (
          <div
            key={`t${t}`}
            style={{ position: "absolute", left: side + TW - 1, bottom: y - 7, display: "flex", alignItems: "center", gap: 3, font: `${passed ? 650 : 500} 11px/14px var(--px-mono)`, color: col, whiteSpace: "nowrap" }}
          >
            <span style={{ width: 6, borderTop: `${passed ? 2 : 1.5}px solid ${col}` }} />
            {t}g
          </div>
        );
      })}
      {!med.asNeeded && (
        <div style={{ position: "absolute", left: side + TW + 8, bottom: B + H - 14, font: "500 11px/14px var(--px-mono)", color: "var(--px-ink-3)" }}>{max}g</div>
      )}
      {!over && days > 0 && !med.asNeeded && (
        <div
          style={{
            position: "absolute",
            right: side + TW + 1,
            bottom: B - 1 + lvl - 7,
            display: "flex",
            alignItems: "center",
            gap: 3,
            font: "650 11px/14px var(--px-mono)",
            color: st === "ok" ? "var(--px-ink-2)" : fg,
            whiteSpace: "nowrap",
          }}
        >
          {days}g
          <span style={{ width: 6, borderTop: `2px solid ${st === "ok" ? "var(--px-ink-2)" : fg}` }} />
        </div>
      )}
    </div>
  );
}

export interface DispenserActions {
  onArrive: (packs: number) => void;
  onOrdered: () => void;
  onRecount: (qty: number) => void;
  historyHref: string;
  editHref: string;
  busy?: boolean;
}

type Panel = null | "menu" | "arrive" | "recount";

const menuBtn =
  "min-h-11 rounded-[8px] border-none bg-transparent px-2.5 py-1.5 text-left text-[15px] font-medium leading-[1.25] text-px-ink no-underline hover:bg-px-surface-2 hover:text-px-ink";
const stepBtn = "h-11 w-11 flex-none rounded-[10px] border border-px-line-strong bg-px-surface text-[20px] font-semibold leading-none";

export function Dispenser({ med, size, scaleMax = 60, actions }: { med: DispenserView; size?: Size; scaleMax?: number; actions?: DispenserActions }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [n, setN] = useState(0);
  const meta = META[med.status];
  const recount = panel === "recount";

  const open = (p: Panel) => {
    setPanel(p);
    if (p === "arrive") setN(1);
    if (p === "recount") setN(med.qty);
  };

  const step = 1;
  const aria = `${med.name} ${med.strength}, ${med.qtyText} ${med.qty === 1 ? "compressa" : "compresse"}, ${med.daysText ? `${med.daysText} ${med.daysWord}` : med.daysWord}, ${STATUS_LABEL[med.status].toLowerCase()}`;

  return (
    <div
      role="group"
      aria-label={aria}
      className="flex h-full min-w-0 flex-col gap-3.5 rounded-[18px] px-3 pt-3.5 pb-3"
      style={{ background: meta.bg, border: `1px solid ${meta.bc}`, boxShadow: meta.ring }}
    >
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-1.5">
        <StatusChip status={med.status} />
      </div>
      <div className="flex justify-center py-0.5">
        {size ? (
          <Tube med={med} size={size} max={scaleMax} />
        ) : (
          <>
            <div className="min-[900px]:hidden">
              <Tube med={med} size="s" max={scaleMax} />
            </div>
            <div className="hidden min-[900px]:block">
              <Tube med={med} size="l" max={scaleMax} />
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
        <div>
          <span className="font-[650] text-px-ink">{med.qtyText}</span> {med.qtyWord}
        </div>
        <div>
          {med.daysText && <span className="font-[650] text-px-ink">{med.daysText} </span>}
          {med.daysWord}
        </div>
        {med.endLabel && <div>{med.endLabel}</div>}
      </div>
      {med.reason && (
        <div className="text-[15px] font-semibold leading-[1.35] [text-wrap:pretty]" style={{ color: meta.fg }}>
          {med.reason}
        </div>
      )}
      {actions && (
        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            disabled={actions.busy}
            onClick={() => actions.onArrive(1)}
            aria-label={`Arrivata confezione di ${med.name}: aggiungi ${med.perPack} compresse`}
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
          {(panel === "arrive" || panel === "recount") && (
            <form
              className="flex flex-col gap-2 rounded-[12px] border border-px-line bg-px-surface-2 p-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (recount) actions.onRecount(n);
                else actions.onArrive(n);
                setPanel(null);
              }}
            >
              <label htmlFor={`px-n-${med.id}`} className="text-[15px] font-semibold leading-[1.3]">
                {recount ? "Quante ne conti adesso?" : "Confezioni arrivate"}
              </label>
              <div className="flex gap-1">
                <button type="button" aria-label={recount ? "Una in meno" : "Una confezione in meno"} onClick={() => setN((x) => Math.max(recount ? 0 : 1, x - step))} className={stepBtn}>
                  −
                </button>
                <input
                  id={`px-n-${med.id}`}
                  type="number"
                  inputMode="decimal"
                  min={recount ? 0 : 1}
                  step={recount ? 0.5 : 1}
                  value={Number.isFinite(n) ? n : 0}
                  onChange={(e) => setN(Math.max(0, Number(e.target.value.replace(",", ".")) || 0))}
                  className="h-11 min-w-0 flex-1 rounded-[10px] border border-px-line-strong bg-px-surface text-center text-[18px] font-[650] leading-none text-px-ink"
                />
                <button type="button" aria-label={recount ? "Una in più" : "Una confezione in più"} onClick={() => setN((x) => x + step)} className={stepBtn}>
                  +
                </button>
              </div>
              {!recount && (
                <span className="text-[14px] leading-[1.3] text-px-ink-2">
                  = {n * med.perPack} compresse ({med.perPack} per confezione)
                </span>
              )}
              <div className="flex flex-wrap gap-1.5">
                <button type="submit" disabled={actions.busy} className="min-h-11 flex-[1_1_90px] rounded-[10px] border-none bg-px-primary text-[15px] font-semibold leading-none text-px-on-primary">
                  {recount ? "Salva" : "Aggiungi"}
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
