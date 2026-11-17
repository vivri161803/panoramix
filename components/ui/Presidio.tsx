"use client";

// Porting di design/Presidio.dc.html (pagina Presidi, sezioni 07–10): le icone delle 10 categorie, con
// corpo neutro, contorno di 2 unità e una sola zona nel colore del medicinale, e il tubo del Dispenser
// sulla scala comune 0–60 giorni (tacche a 7 e 14). La pillola delega a Pill e a pillStyle.

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { defaultMode, type Category } from "@/lib/categories";
import type { MedStatus } from "@/lib/forecast";
import { pillStyle } from "@/lib/pills";
import { Pill } from "@/components/ui/Pill";

/** w,h: disegno · rot: inclinazione dell'icona · len,step: ingombro dei pezzi nel tubo (frazioni) */
export const PRESIDIO_GEO: Record<Category, { w: number; h: number; rot: number; len: number; step: number }> = {
  pillola: { w: 30, h: 14, rot: -45, len: 0.6, step: 0.8 },
  bustina: { w: 26, h: 34, rot: 0, len: 0.72, step: 0.36 },
  liquido: { w: 24, h: 36, rot: 0, len: 0.8, step: 0.84 },
  iniezione: { w: 38, h: 14, rot: -45, len: 0.92, step: 0.86 },
  gocce: { w: 24, h: 32, rot: 0, len: 0.5, step: 0.7 },
  inalatore: { w: 28, h: 36, rot: 0, len: 0.8, step: 0.84 },
  cerotto: { w: 34, h: 34, rot: 0, len: 0.6, step: 0.36 },
  crema: { w: 24, h: 36, rot: 0, len: 0.8, step: 0.84 },
  supposta: { w: 18, h: 34, rot: 0, len: 0.6, step: 0.8 },
  altro: { w: 32, h: 26, rot: 0, len: 0.6, step: 0.7 },
};

type Box = { x: number; y: number; width: number; height: number; rx: number };
const R = (x: number, y: number, width: number, height: number, rx = 0): Box => ({ x, y, width, height, rx });
type Tag = "rect" | "path" | "circle";

function parts(category: Category, c: string, id: string): ReactNode[] {
  let k = 0;
  const el = (T: Tag, a: object, style: CSSProperties) => <T key={k++} {...a} style={style} />;
  const INK = "var(--px-ink-3)";
  const body = (T: Tag, a: object) => el(T, a, { fill: "var(--px-surface)" });
  const edge = (T: Tag, a: object) => el(T, a, { fill: "none", stroke: INK, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" });
  const col = (T: Tag, a: object) => [el(T, a, { fill: c }), el(T, a, { fill: `url(#${id}s)` }), el(T, a, { fill: `url(#${id}h)` })];
  const P = (d: string) => ({ d });
  switch (category) {
    case "pillola": {
      const r = R(1, 1, 28, 12, 6);
      return [body("rect", r), ...col("path", P("M15 1H7A6 6 0 0 0 7 13H15Z")), edge("rect", r), edge("path", P("M15 1V13"))];
    }
    case "bustina": {
      const r = R(1, 1, 24, 32, 3);
      return [body("rect", r), ...col("circle", { cx: 13, cy: 17, r: 5.5 }), edge("rect", r), edge("path", P("M1 6.5H25M1 27.5H25"))];
    }
    case "liquido": {
      const b = P("M6 9H18A4 4 0 0 1 22 13V32A3 3 0 0 1 19 35H5A3 3 0 0 1 2 32V13A4 4 0 0 1 6 9Z");
      const t = R(7, 1, 10, 6, 1.5);
      return [body("rect", t), edge("rect", t), body("path", b), ...col("path", P("M2 21H22V32A3 3 0 0 1 19 35H5A3 3 0 0 1 2 32Z")), edge("path", b)];
    }
    case "iniezione": {
      const r = R(8, 2, 18, 10, 2);
      return [body("rect", r), ...col("path", P("M13 2H24A2 2 0 0 1 26 4V10A2 2 0 0 1 24 12H13Z")), edge("rect", r), edge("path", P("M2 7H8M2 2V12M26 7H36"))];
    }
    case "gocce":
      return col("path", P("M12 1C12 1 2 13 2 20A10 10 0 0 0 22 20C22 13 12 1 12 1Z"));
    case "inalatore": {
      const b = P("M5 11H14A3 3 0 0 1 17 14V26H24A2 2 0 0 1 26 28V33A2 2 0 0 1 24 35H5A3 3 0 0 1 2 32V14A3 3 0 0 1 5 11Z");
      return [...col("rect", R(5, 1, 9, 14, 2)), body("path", b), edge("path", b)];
    }
    case "cerotto": {
      const r = R(1, 1, 32, 32, 9);
      return [body("rect", r), ...col("rect", R(10, 10, 14, 14, 4)), edge("rect", r)];
    }
    case "crema": {
      const b = P("M2 1H22L19 29H5Z");
      const t = R(8, 29, 8, 6, 1);
      return [body("path", b), ...col("path", P("M3.2 12H20.8L19 29H5Z")), edge("path", b), body("rect", t), edge("rect", t)];
    }
    case "supposta":
      return col("path", P("M9 1C14 5 17 12 17 20V31A2 2 0 0 1 15 33H3A2 2 0 0 1 1 31V20C1 12 4 5 9 1Z"));
    default: {
      const r = R(1, 1, 30, 24, 3);
      return [body("rect", r), ...col("rect", R(1, 9, 30, 8)), edge("rect", r)];
    }
  }
}

/** Il disegno della categoria alla scala data (anche dentro il tubo). */
export function PresidioSvg({ category, color, scale, style }: { category: Category; color: string; scale: number; style?: CSSProperties }) {
  const id = "pxp" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = PRESIDIO_GEO[category] ?? PRESIDIO_GEO.altro;
  return (
    <svg
      width={g.w * scale}
      height={g.h * scale}
      viewBox={`0 0 ${g.w} ${g.h}`}
      aria-hidden="true"
      style={{ display: "block", flex: "none", overflow: "visible", filter: "drop-shadow(0 1px 1.2px rgba(14,22,32,.28))", ...style }}
    >
      <defs>
        <linearGradient id={id + "s"} x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor="#fff" stopOpacity={0.1} />
          <stop offset={0.45} stopColor="#000" stopOpacity={0} />
          <stop offset={1} stopColor="#000" stopOpacity={0.26} />
        </linearGradient>
        <radialGradient id={id + "h"} cx={0.32} cy={0.26} r={0.5}>
          <stop offset={0} stopColor="#fff" stopOpacity={0.85} />
          <stop offset={0.62} stopColor="#fff" stopOpacity={0} />
          <stop offset={1} stopColor="#fff" stopOpacity={0} />
        </radialGradient>
      </defs>
      {parts(category, color, id)}
    </svg>
  );
}

function Icon({ category, pillShape, color, size, rotate }: { category: Category; pillShape?: string | null; color: string; size: number; rotate?: number }) {
  if (category === "pillola") return <Pill color={color} shape={pillShape ?? "tonda"} size={size} rotate={rotate} />;
  const g = PRESIDIO_GEO[category] ?? PRESIDIO_GEO.altro;
  const rot = rotate ?? g.rot;
  const a = (Math.abs(rot) * Math.PI) / 180;
  const cs = Math.abs(Math.cos(a));
  const sn = Math.abs(Math.sin(a));
  const scale = (size * 0.94) / Math.max(g.w * cs + g.h * sn, g.w * sn + g.h * cs);
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, flex: "none", verticalAlign: "middle" }}>
      <PresidioSvg category={category} color={color} scale={scale} style={rot ? { transform: `rotate(${rot}deg)` } : undefined} />
    </span>
  );
}

// ——— Tubo del Dispenser ———

const PILL_GEO: Record<string, [number, number]> = { tonda: [0.46, 0.46], ovale: [0.58, 0.37], capsula: [0.72, 0.31] };
const DIMS = { s: { W: 48, H: 180 }, l: { W: 70, H: 250 } };
const JX = [-0.7, 0.55, -0.15, 0.8, -0.45, 0.25, -0.85, 0.4, 0, -0.3];
const JR = [-16, 11, -5, 19, -10, 4, -20, 8, 14, -2];
type TubeSize = keyof typeof DIMS;

/** Colore delle tacche superate, per stato. */
const STATUS_FG: Record<MedStatus, string> = { ok: "var(--px-ink-2)", order: "var(--px-order-fg)", ordered: "var(--px-ordered-fg)", out: "var(--px-out-fg)" };

function pieceGeo(category: Category, pillShape: string | null | undefined, W: number) {
  if (category === "pillola") {
    const g = PILL_GEO[pillShape ?? "tonda"] ?? PILL_GEO.tonda;
    const ph = W * g[1];
    return { pw: W * g[0], ph, step: ph * 0.8, scale: 0, p: null };
  }
  // i pezzi lunghi si coricano, cerotti e bustine si impilano a scaglie
  const p = PRESIDIO_GEO[category] ?? PRESIDIO_GEO.altro;
  const scale = (W * p.len) / Math.max(p.w, p.h);
  const ph = Math.min(p.w, p.h) * scale;
  return { pw: Math.max(p.w, p.h) * scale, ph, step: ph * p.step, scale, p };
}

interface PieceSlot {
  id: number;
  slot: number;
  anim: "in" | "out" | null;
  delay: number;
}

/** Pezzi nel tubo: entrano dall'alto quando la scorta sale, escono dal basso quando scende. */
function usePieces(target: number) {
  const [state, setState] = useState(() => ({
    target,
    nid: target,
    pieces: Array.from({ length: target }, (_, i): PieceSlot => ({ id: i, slot: i, anim: null, delay: 0 })),
  }));

  // aggiornamento "derivato" durante il render (pattern consigliato da React)
  if (state.target !== target) {
    const live = state.pieces.filter((p) => p.anim !== "out");
    let pieces = state.pieces.map((p) => ({ ...p }));
    let nid = state.nid;
    if (target > live.length) {
      for (let k = 0; k < target - live.length; k++) pieces.push({ id: nid++, slot: live.length + k, anim: "in", delay: k * 45 });
    } else {
      const d = live.length - target;
      pieces = pieces.map((p) => {
        if (p.anim === "out") return p;
        return p.slot < d ? { ...p, anim: "out" as const, delay: p.slot * 60 } : { ...p, slot: p.slot - d };
      });
    }
    setState({ target, nid, pieces });
  }

  const animating = state.pieces.some((p) => p.anim);
  useEffect(() => {
    if (!animating) return;
    const longest = Math.max(0, ...state.pieces.map((p) => p.delay));
    const t = setTimeout(() => {
      setState((s) => ({ ...s, pieces: s.pieces.filter((p) => p.anim !== "out").map((p) => ({ ...p, anim: null })) }));
    }, longest + 900);
    return () => clearTimeout(t);
  }, [animating, state.pieces]);

  return state.pieces;
}

interface TubeProps {
  category: Category;
  pillShape?: string | null;
  color: string;
  size: TubeSize;
  /** giorni di copertura; null = oltre la scala */
  days: number | null;
  level: boolean;
  scaleMax: number;
  status: MedStatus;
  /** al bisogno: niente tacche né giorni */
  asNeeded: boolean;
  /** c'è qualcosa in casa (a scorta zero il tubo è vuoto) */
  hasStock: boolean;
}

function Tube({ category, pillShape, color, size, days: rawDays, level, scaleMax: max, status: st, asNeeded, hasStock }: TubeProps) {
  const { W, H } = DIMS[size];
  const side = 36;
  const TW = W + 4;
  const B = 12;
  const CAP = 10;
  const days = rawDays === null ? max : Math.max(0, rawDays);
  const over = rawDays === null || days >= max;
  const fg = STATUS_FG[st];
  const lvl = (Math.min(days, max) / max) * (H - 6);
  const { pw, ph, step, scale, p: pg } = pieceGeo(category, pillShape, W);
  const target = level || !hasStock ? 0 : Math.max(1, Math.min(Math.floor((H - 6) / step), Math.round(lvl / step)));
  const pieces = usePieces(target);
  const ticks = asNeeded ? [] : [7, 14];

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
        {level && hasStock && days > 0 && (
          // scorte a livello (sciroppo, gocce, crema, inalatore): una fascia piena nel colore del medicinale
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: Math.max(4, lvl),
              background: `linear-gradient(180deg, rgba(255,255,255,.2) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,.18) 100%), ${color}`,
              borderTop: "2px solid rgba(14,22,32,.3)",
              transition: "height 520ms cubic-bezier(.45,0,.55,1)",
            }}
          />
        )}
        {pieces.map((p) => {
          const j = p.id % 10;
          const x = (W - pw) / 2 + ((JX[j] * (W - pw)) / 2) * 0.9;
          const r = pg ? JR[j] * (pg.len > 0.8 ? 0.3 : 0.6) + (pg.h > pg.w ? 90 : 0) : pillShape === "tonda" ? JR[j] * 0.3 : JR[j];
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
              {pg ? (
                <PresidioSvg category={category} color={color} scale={scale} style={{ position: "absolute", left: (pw - pg.w * scale) / 2, top: (ph - pg.h * scale) / 2, transform: `rotate(${r}deg)` }} />
              ) : (
                <div style={{ ...pillStyle(color, pillShape ?? "tonda", pw, ph), transform: `rotate(${r}deg)` }} />
              )}
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
        {over && !asNeeded && (
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
      {!asNeeded && <div style={{ position: "absolute", left: side + TW + 8, bottom: B + H - 14, font: "500 11px/14px var(--px-mono)", color: "var(--px-ink-3)" }}>{max}g</div>}
      {!over && days > 0 && !asNeeded && (
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

/**
 * Icona (`view = "icon"`, inclinata come da design) o tubo del Dispenser (`view = "tube"`): pezzi
 * impilati fino a `days`, o una fascia piena se `level`, e «60+» oltre la scala.
 */
export function Presidio({
  category,
  pillShape,
  color,
  size,
  rotate,
  view = "icon",
  level,
  days = 0,
  scaleMax = 60,
  status = "ok",
  asNeeded = false,
  hasStock = true,
}: {
  category: Category;
  pillShape?: string | null;
  color: string;
  size?: number | "s" | "l";
  rotate?: number;
  view?: "icon" | "tube";
  level?: boolean;
  days?: number | null;
  scaleMax?: number;
  /** solo tubo: colore delle tacche superate */
  status?: MedStatus;
  asNeeded?: boolean;
  hasStock?: boolean;
}) {
  if (view === "tube") {
    return (
      <Tube
        category={category}
        pillShape={pillShape}
        color={color}
        size={size === "s" ? "s" : "l"}
        days={days}
        level={level ?? defaultMode(category) === "livello"}
        scaleMax={scaleMax}
        status={status}
        asNeeded={asNeeded}
        hasStock={hasStock}
      />
    );
  }
  return <Icon category={category} pillShape={pillShape} color={color} size={typeof size === "number" ? size : 48} rotate={rotate} />;
}

/** Glifo al tratto della categoria (viewBox 24, tratto 1,8, currentColor) per controlli e testi. */
export function CategoryGlyph({ category, size = 24 }: { category: Category; size?: number }) {
  const T = { transform: "rotate(-45 12 12)" };
  const kids: Record<Category, ReactNode> = {
    pillola: (
      <>
        <rect x={3} y={8.5} width={18} height={7} rx={3.5} {...T} />
        <path d="M12 8.5v7" {...T} />
      </>
    ),
    bustina: (
      <>
        <rect x={6} y={3} width={12} height={18} rx={2} />
        <path d="M6 7h12M6 17h12" />
      </>
    ),
    liquido: (
      <>
        <rect x={9} y={2.5} width={6} height={3.5} rx={1} />
        <path d="M9 8h6a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8a3 3 0 0 1 3-3z" />
        <path d="M6 14h12" />
      </>
    ),
    iniezione: (
      <>
        <rect x={7} y={9} width={10} height={6} rx={1.5} {...T} />
        <path d="M2.5 12H7M2.5 9.5v5M7 7.5v9M17 12h5.5" {...T} />
      </>
    ),
    gocce: <path d="M12 3.5c-3 4-5.5 7-5.5 10.5a5.5 5.5 0 0 0 11 0c0-3.5-2.5-6.5-5.5-10.5z" />,
    inalatore: (
      <>
        <rect x={8} y={2.5} width={5} height={6} rx={1} />
        <path d="M7 8.5h7v8h5.5v5H7z" />
      </>
    ),
    cerotto: (
      <>
        <rect x={3.5} y={3.5} width={17} height={17} rx={5} />
        <rect x={8.5} y={8.5} width={7} height={7} rx={2} />
      </>
    ),
    crema: (
      <>
        <path d="M6 3h12l-2 15H8z" />
        <rect x={10} y={18} width={4} height={3.5} rx={0.5} />
      </>
    ),
    supposta: <path d="M12 2.5c3 2.5 4.5 6 4.5 10v7a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-7c0-4 1.5-7.5 4.5-10z" />,
    altro: (
      <>
        <rect x={3.5} y={5.5} width={17} height={13} rx={2} />
        <path d="M3.5 10h17M3.5 14h17" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", display: "block" }}>
      {kids[category]}
    </svg>
  );
}
