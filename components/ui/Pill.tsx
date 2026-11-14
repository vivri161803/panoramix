import { PILL_RATIO, pillStyle } from "@/lib/pills";
import { isPresidio } from "@/lib/presidi";
import { Presidio } from "@/components/ui/Presidio";

export function Pill({ color, shape, size = 28, rotate = 0 }: { color: string; shape: string; size?: number; rotate?: number }) {
  // iniezioni, cerotti, colliri: stesso posto, disegno del presidio
  if (isPresidio(shape)) return <Presidio shape={shape} color={color} size={size} />;
  const [rw, rh] = PILL_RATIO[shape] ?? PILL_RATIO.tonda;
  const style = pillStyle(color, shape, Math.round(size * rw), Math.round(size * rh));
  return (
    <span
      aria-hidden="true"
      style={{ ...style, display: "inline-block", flex: "none", transform: rotate ? `rotate(${rotate}deg)` : undefined }}
    />
  );
}
