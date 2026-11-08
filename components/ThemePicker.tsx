"use client";

import { useRef, useState } from "react";
import { THEME_COLOR, THEME_COOKIE, THEMES, type Theme } from "@/lib/theme";

const LABELS: Record<Theme, string> = { system: "Automatico", light: "Chiaro", dark: "Scuro" };

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;

  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax${secure}`;

  // barra del browser su telefono: segue il tema scelto
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const media = m.getAttribute("media") ?? "";
    m.content = theme === "system" ? (media.includes("dark") ? THEME_COLOR.dark : THEME_COLOR.light) : THEME_COLOR[theme];
  });
}

export function ThemePicker({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const choose = (t: Theme, focus = false) => {
    setTheme(t);
    apply(t);
    if (focus) refs.current[THEMES.indexOf(t)]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Aspetto"
      className="flex w-[min(100%,420px)] gap-1 rounded-[14px] bg-px-surface-2 p-1"
      onKeyDown={(e) => {
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const i = (THEMES.indexOf(theme) + step + THEMES.length) % THEMES.length;
        choose(THEMES[i], true);
      }}
    >
      {THEMES.map((t, i) => {
        const sel = t === theme;
        return (
          <button
            key={t}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={sel}
            tabIndex={sel ? 0 : -1}
            onClick={() => choose(t)}
            className={`flex h-11 flex-1 items-center justify-center rounded-[10px] text-[15px] font-semibold leading-none ${sel ? "bg-px-surface text-px-ink shadow-[0_1px_2px_rgba(14,22,32,.12)]" : "bg-transparent text-px-ink-2"} hover:text-px-ink`}
          >
            {LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}
