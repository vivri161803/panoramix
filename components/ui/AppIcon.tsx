// Icona "Vischio di pillole" (variante 1b). Stesso disegno di app/icon.svg e public/email-logo.png.
// Gli id dei gradienti sono fissi: più icone nella stessa pagina hanno definizioni identiche.

export function AppIcon({ size = 32, label = "Panoramix" }: { size?: number; label?: string | null }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      style={{
        display: "block",
        flex: "none",
        borderRadius: "22.5%",
        boxShadow: `0 ${Math.max(1, size * 0.032).toFixed(1)}px ${Math.max(1.5, size * 0.1).toFixed(1)}px rgba(16,22,30,.22)`,
      }}
    >
      <defs>
        <linearGradient id="pxi-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbfaf6" /><stop offset="1" stopColor="#ecebe4" /></linearGradient>
        <linearGradient id="pxi-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff8a7a" /><stop offset="1" stopColor="#e2463a" /></linearGradient>
        <linearGradient id="pxi-wht" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbfaf5" /><stop offset="1" stopColor="#d6d2c6" /></linearGradient>
        <linearGradient id="pxi-teal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4fdcc4" /><stop offset="1" stopColor="#159a86" /></linearGradient>
        <linearGradient id="pxi-grn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8be0a6" /><stop offset="1" stopColor="#2e9a63" /></linearGradient>
      </defs>
      <rect width="100" height="100" rx="22.5" fill="url(#pxi-bg)" />
      <path d="M50 64 L50 84" stroke="#2e9a63" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="36" cy="44" rx="10" ry="23" fill="url(#pxi-grn)" transform="rotate(-40 36 44)" />
      <ellipse cx="64" cy="44" rx="10" ry="23" fill="url(#pxi-grn)" transform="rotate(40 64 44)" />
      <circle cx="35" cy="72" r="8" fill="url(#pxi-teal)" />
      <circle cx="66" cy="73" r="8.5" fill="url(#pxi-red)" />
      <circle cx="50" cy="63" r="10" fill="url(#pxi-wht)" stroke="#cfcabb" strokeWidth="1" />
      <path d="M43.5 63 H56.5" stroke="#b9b4a6" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="46.5" cy="59" r="2.2" fill="#fff" opacity="0.8" />
    </svg>
  );
}
