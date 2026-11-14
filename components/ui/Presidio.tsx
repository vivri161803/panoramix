// Porting di design/Presidio.dc.html: iniezioni, cerotti e colliri con la stessa grammatica delle
// compresse. Vetro e plastica nei toni neutri del tubo (--px-*), il colore solo su liquido e tappi.

import { useId, type CSSProperties, type ReactNode } from "react";
import type { MedForm } from "@/lib/presidi";

/** w,h: disegno · rot: inclinazione dell'icona · len,step: ingombro nel tubo (frazioni) */
export const PRESIDIO_GEO: Record<string, { w: number; h: number; rot: number; len: number; step: number }> = {
  siringa: { w: 72, h: 22, rot: -45, len: 0.94, step: 0.86 },
  penna: { w: 72, h: 18, rot: -45, len: 0.94, step: 0.9 },
  fiala: { w: 30, h: 44, rot: 0, len: 0.8, step: 0.84 },
  cerotto: { w: 40, h: 40, rot: 0, len: 0.6, step: 0.36 },
  "cerotto-tondo": { w: 40, h: 40, rot: 0, len: 0.6, step: 0.36 },
  bustina: { w: 36, h: 44, rot: 0, len: 0.74, step: 0.34 },
  flacone: { w: 28, h: 48, rot: 0, len: 0.88, step: 0.84 },
  monodose: { w: 20, h: 48, rot: 0, len: 0.88, step: 0.8 },
  goccia: { w: 32, h: 40, rot: 0, len: 0.5, step: 0.7 },
};

const LS = "var(--px-line-strong)";
type Box = { x: number; y: number; width: number; height: number; rx: number };
const R = (x: number, y: number, width: number, height: number, rx = 0): Box => ({ x, y, width, height, rx });

function parts(shape: string, c: string, id: string): ReactNode[] {
  let k = 0;
  const el = (Tag: "rect" | "path" | "circle", a: object, style: CSSProperties) => <Tag key={k++} {...a} style={style} />;
  const glass = (t: "rect" | "path", a: object) => el(t, a, { fill: "var(--px-tube-bg)", stroke: LS, strokeWidth: 1.5, strokeLinejoin: "round" });
  const cap = (t: "rect" | "path", a: object) => el(t, a, { fill: "var(--px-surface-3)", stroke: LS, strokeWidth: 1.5, strokeLinejoin: "round" });
  const col = (t: "rect" | "path" | "circle", a: object) => [el(t, a, { fill: c }), el(t, a, { fill: `url(#${id}s)` }), el(t, a, { fill: `url(#${id}h)` })];
  const white = (t: "rect" | "circle", a: object) => [
    el(t, a, { fill: "#F5F4EF", stroke: "rgba(14,22,32,.26)", strokeWidth: 1 }),
    el(t, a, { fill: `url(#${id}s)`, opacity: 0.45 }),
  ];
  const shine = (a: Box) => el("rect", a, { fill: "var(--px-glass-hi)" });
  const mark = (d: string, o = 0.3) => el("path", { d }, { fill: "none", stroke: `rgba(14,22,32,${o})`, strokeWidth: 1, strokeLinecap: "round" });
  switch (shape) {
    case "siringa":
      return [
        cap("rect", R(5, 9.5, 12, 3)), cap("rect", R(1, 4, 4, 14, 2)), cap("rect", R(15, 1.5, 4, 19, 2)),
        glass("rect", R(19, 5, 34, 12, 2.5)),
        el("rect", R(23, 6.2, 4, 9.6, 1), { fill: "var(--px-ink-3)" }),
        ...col("rect", R(27, 6.2, 25, 9.6, 1.5)),
        mark("M32 6.4v3M37 6.4v4.6M42 6.4v3M47 6.4v4.6", 0.34),
        cap("rect", R(53, 8, 5, 6, 1)),
        el("path", { d: "M58 11H70.5" }, { fill: "none", stroke: LS, strokeWidth: 1.6, strokeLinecap: "round" }),
      ];
    case "penna":
      return [
        glass("rect", R(24, 3, 36, 12, 2)),
        ...col("rect", R(31, 6, 13, 6, 3)),
        mark("M48.5 6.5v5M51.5 6.5v5", 0.28),
        cap("rect", R(60, 4, 7, 10, 1.5)), mark("M62.3 6v6M64.7 6v6", 0.26),
        ...col("rect", R(67, 5.5, 4, 7, 2)),
        ...col("rect", R(1, 2, 25, 14, 6)),
        el("rect", R(6, 0.6, 15, 3.2, 1.6), { fill: "rgba(14,22,32,.3)" }),
      ];
    case "fiala":
      return [
        glass("rect", R(10, 10, 10, 7)), glass("rect", R(3, 15, 24, 28, 5)),
        ...col("path", { d: "M4.6 27H25.4V39.4Q25.4 41.4 22.4 41.4H7.6Q4.6 41.4 4.6 39.4Z" }),
        shine(R(6.2, 18, 2.4, 21, 1.2)),
        cap("rect", R(8, 6.5, 14, 5, 1)),
        ...col("rect", R(6.5, 1, 17, 6, 2.5)),
      ];
    case "cerotto":
      return [...white("rect", R(2, 2, 36, 36, 10)), ...col("rect", R(9.5, 9.5, 21, 21, 6))];
    case "cerotto-tondo":
      return [...white("circle", { cx: 20, cy: 20, r: 18 }), ...col("circle", { cx: 20, cy: 20, r: 10.5 })];
    case "bustina":
      return [
        cap("rect", R(2, 2, 32, 40, 3)), mark("M5 7H31M5 37H31", 0.24),
        ...col("rect", R(7, 12, 22, 20, 5)),
        el("rect", R(13, 17, 10, 10, 3), { fill: "none", stroke: "rgba(255,255,255,.9)", strokeWidth: 1.4 }),
      ];
    case "flacone":
      return [
        glass("path", { d: "M9 17H19Q25 19 25 25V42Q25 46.5 21 46.5H7Q3 46.5 3 42V25Q3 19 9 17Z" }),
        ...col("path", { d: "M4.6 30H23.4V42Q23.4 44.9 21 44.9H7Q4.6 44.9 4.6 42Z" }),
        shine(R(6.2, 23, 2.4, 19, 1.2)),
        cap("rect", R(7, 13, 14, 4.5, 1.2)),
        ...col("path", { d: "M9.5 13L11 3Q11.3 1 13 1H15Q16.7 1 17 3L18.5 13Z" }),
      ];
    case "monodose":
      return [
        glass("rect", R(8.2, 10, 3.6, 7)), glass("rect", R(5.5, 1, 9, 10, 2.5)),
        glass("path", { d: "M10 15.5C5 17.5 3 22 3 28V40Q3 46.5 10 46.5Q17 46.5 17 40V28C17 22 15 17.5 10 15.5Z" }),
        ...col("path", { d: "M4.6 29H15.4V40Q15.4 44.9 10 44.9Q4.6 44.9 4.6 40Z" }),
        shine(R(5.9, 23, 2, 15, 1)),
      ];
    default:
      return col("path", { d: "M16 2C16 2 4 16.5 4 26A12 12 0 0 0 28 26C28 16.5 16 2 16 2Z" });
  }
}

/** Il disegno alla scala data (usato anche dentro il tubo del Dispenser). */
export function PresidioSvg({ shape, color, scale, style }: { shape: string; color: string; scale: number; style?: CSSProperties }) {
  const id = "pxp" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = PRESIDIO_GEO[shape] ?? PRESIDIO_GEO.goccia;
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
      {parts(shape, color, id)}
    </svg>
  );
}

/** Icona del presidio in un quadrato di lato `size`, inclinata come da design. */
export function Presidio({ shape, color, size = 48, rotate }: { shape: string; color: string; size?: number; rotate?: number }) {
  const g = PRESIDIO_GEO[shape] ?? PRESIDIO_GEO.goccia;
  const rot = rotate ?? g.rot;
  const a = (Math.abs(rot) * Math.PI) / 180;
  const cs = Math.abs(Math.cos(a));
  const sn = Math.abs(Math.sin(a));
  const scale = (size * 0.94) / Math.max(g.w * cs + g.h * sn, g.w * sn + g.h * cs);
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, flex: "none", verticalAlign: "middle" }}>
      <PresidioSvg shape={shape} color={color} scale={scale} style={rot ? { transform: `rotate(${rot}deg)` } : undefined} />
    </span>
  );
}

/** Glifo al tratto del tipo di medicinale (1,8 px, currentColor) per controlli e testi. */
export function FormGlyph({ form, size = 24 }: { form: MedForm; size?: number }) {
  const T = { transform: "rotate(-45 12 12)" };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", display: "block" }}>
      {form === "compressa" && (
        <>
          <rect x={3} y={8.5} width={18} height={7} rx={3.5} {...T} />
          <path d="M12 8.5v7" {...T} />
        </>
      )}
      {form === "iniezione" && (
        <>
          <rect x={7} y={9} width={10} height={6} rx={1.5} {...T} />
          <path d="M2.5 12H7M2.5 9.5v5M7 7.5v9M17 12h5.5" {...T} />
        </>
      )}
      {form === "cerotto" && (
        <>
          <rect x={3.5} y={3.5} width={17} height={17} rx={5} />
          <rect x={8.5} y={8.5} width={7} height={7} rx={2} />
        </>
      )}
      {form === "collirio" && <path d="M12 3.5c-3 4-5.5 7-5.5 10.5a5.5 5.5 0 0 0 11 0c0-3.5-2.5-6.5-5.5-10.5z" />}
    </svg>
  );
}
