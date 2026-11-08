import type { MedStatus } from "@/lib/forecast";

const META: Record<MedStatus, { label: string; bg: string; fg: string; bc: string; weight: number }> = {
  ok: { label: "OK", bg: "var(--px-ok-bg)", fg: "var(--px-ok-fg)", bc: "var(--px-ok-line)", weight: 600 },
  order: { label: "Da ordinare", bg: "var(--px-order-bg)", fg: "var(--px-order-fg)", bc: "var(--px-order-line)", weight: 600 },
  ordered: { label: "Ordinata", bg: "var(--px-ordered-bg)", fg: "var(--px-ordered-fg)", bc: "var(--px-ordered-line)", weight: 600 },
  out: { label: "Esaurita", bg: "var(--px-out-fg)", fg: "var(--px-surface)", bc: "var(--px-out-fg)", weight: 650 },
};

export const STATUS_LABEL: Record<MedStatus, string> = { ok: "OK", order: "Da ordinare", ordered: "Ordinata", out: "Esaurita" };

function Glyph({ status }: { status: MedStatus }) {
  // il simbolo interno usa il colore di fondo del chip
  const inner = status === "out" ? "var(--px-out-fg)" : META[status].bg;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none" }}>
      <circle cx="8" cy="8" r="8" fill="currentColor" />
      {status === "ok" && <path d="M4.6 8.3l2.2 2.2 4.6-4.8" stroke={inner} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {status === "order" && (
        <>
          <path d="M8 4.2v4.6" stroke={inner} strokeWidth="1.9" strokeLinecap="round" />
          <circle cx="8" cy="11.5" r="1.1" fill={inner} />
        </>
      )}
      {status === "ordered" && <path d="M4.5 8h6.2M8.4 5.4L11 8l-2.6 2.6" stroke={inner} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {status === "out" && <path d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2" stroke={inner} strokeWidth="1.9" strokeLinecap="round" />}
    </svg>
  );
}

export function StatusChip({ status }: { status: MedStatus }) {
  const m = META[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 28,
        padding: "0 10px 0 6px",
        borderRadius: 999,
        background: m.bg,
        color: m.fg,
        border: `1px solid ${m.bc}`,
        font: `${m.weight} 14px/1 var(--px-font)`,
        whiteSpace: "nowrap",
      }}
    >
      <Glyph status={status} />
      {m.label}
    </span>
  );
}
