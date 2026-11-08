import { PILL_RATIO, pillStyle } from "@/lib/pills";

export function Pill({ color, shape, size = 28, rotate = 0 }: { color: string; shape: string; size?: number; rotate?: number }) {
  const [rw, rh] = PILL_RATIO[shape] ?? PILL_RATIO.tonda;
  const style = pillStyle(color, shape, Math.round(size * rw), Math.round(size * rh));
  return (
    <span
      aria-hidden="true"
      style={{ ...style, display: "inline-block", flex: "none", transform: rotate ? `rotate(${rotate}deg)` : undefined }}
    />
  );
}
