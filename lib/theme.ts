// Tema scelto dall'utente: salvato in un cookie, letto dal layout radice
// così la pagina arriva già col tema giusto (niente lampo bianco).

export const THEME_COOKIE = "px-theme";
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export function parseTheme(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

/** Colore della barra del browser per ogni tema (uguale a --px-surface). */
export const THEME_COLOR = { light: "#FFFFFF", dark: "#141A22" } as const;
