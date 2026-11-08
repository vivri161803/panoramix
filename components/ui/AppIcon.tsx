const PILL_GLOSS =
  "radial-gradient(ellipse 60% 50% at 32% 26%, rgba(255,255,255,.85), rgba(255,255,255,0) 62%),linear-gradient(180deg, rgba(255,255,255,.1), rgba(0,0,0,0) 45%, rgba(0,0,0,.28))";

export function AppIcon({ size = 32, label = "Panoramix" }: { size?: number; label?: string | null }) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      style={{
        position: "relative",
        display: "inline-block",
        flex: "none",
        width: size,
        height: size,
        borderRadius: "23%",
        background: "linear-gradient(160deg,#1E2A38,#0E1620)",
        overflow: "hidden",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: "13%",
          top: "20%",
          width: "66%",
          height: "27%",
          borderRadius: 999,
          transform: "rotate(-32deg)",
          background:
            "radial-gradient(ellipse 60% 50% at 30% 25%, rgba(255,255,255,.8), rgba(255,255,255,0) 60%),linear-gradient(180deg, rgba(255,255,255,.1), rgba(0,0,0,0) 45%, rgba(0,0,0,.28)),linear-gradient(90deg,#FF5E4D 50%,#F5F4EF 50%)",
          boxShadow: "0 2px 3px rgba(0,0,0,.35)",
        }}
      />
      <span
        style={{ position: "absolute", left: "52%", top: "52%", width: "34%", height: "34%", borderRadius: "50%", background: `${PILL_GLOSS},#FFC020`, boxShadow: "0 2px 3px rgba(0,0,0,.35)" }}
      />
      <span
        style={{ position: "absolute", left: "16%", top: "63%", width: "22%", height: "22%", borderRadius: "50%", background: `${PILL_GLOSS},#12C2B0`, boxShadow: "0 2px 3px rgba(0,0,0,.35)" }}
      />
    </span>
  );
}
