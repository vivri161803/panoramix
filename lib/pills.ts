import type { CSSProperties } from "react";

import { atcGroup } from "./atc";

// Palette e forme delle compresse (design: Pill.dc.html). La specifica prevede tre forme.
// Il colore non si sceglie più a mano: dipende dal gruppo ATC (lib/atc.ts). Le prime sei tinte
// sono quelle di prima e restano valide per i medicinali non ancora aggiornati.

export const PILL_COLORS = [
  { hex: "#FF5E4D", name: "Corallo" },
  { hex: "#FFC020", name: "Giallo sole" },
  { hex: "#12C2B0", name: "Turchese" },
  { hex: "#8D5BF5", name: "Viola" },
  { hex: "#93D232", name: "Verde lime" },
  { hex: "#2E78F5", name: "Blu" },
  { hex: "#F25CA2", name: "Fucsia" },
  { hex: "#FF8A1F", name: "Arancio" },
  { hex: "#4FC3F7", name: "Azzurro" },
  { hex: "#2E9E5A", name: "Verde bosco" },
  { hex: "#B23A5B", name: "Bordeaux" },
  { hex: "#A8703F", name: "Nocciola" },
  { hex: "#F9A8D4", name: "Rosa" },
  { hex: "#8E8A2C", name: "Oliva" },
  { hex: "#9AA1A9", name: "Grigio" },
] as const;

export const PILL_SHAPES = [
  { id: "tonda", label: "Tonda" },
  { id: "ovale", label: "Ovale" },
  { id: "capsula", label: "Capsula" },
] as const;

export type PillColor = (typeof PILL_COLORS)[number]["hex"];
export type PillShape = (typeof PILL_SHAPES)[number]["id"];

export const PILL_COLOR_HEXES = PILL_COLORS.map((c) => c.hex) as [PillColor, ...PillColor[]];
export const PILL_SHAPE_IDS = PILL_SHAPES.map((s) => s.id) as [PillShape, ...PillShape[]];

export function colorName(hex: string): string {
  return PILL_COLORS.find((c) => c.hex === hex)?.name ?? "Personalizzato";
}

/**
 * Descrizione per la stampa: gruppo e forma, "Cuore e circolazione · tonda".
 * Il colore non descrive la compressa vera (è quello del gruppo), quindi non si scrive.
 * Medicinale senza gruppo (non ancora aggiornato o "Non so"): solo la forma.
 */
export function pillLook(atcCode: string | null, shape: string): string {
  const group = atcGroup(atcCode);
  return group ? `${group.label} · ${shape}` : shape;
}

/** Stile CSS della compressa (riflessi, ombra, solco o metà bianca). */
export function pillStyle(color: string, shape: string, w: number, h: number): CSSProperties {
  const layers = [
    "radial-gradient(ellipse 60% 50% at 32% 26%, rgba(255,255,255,.85), rgba(255,255,255,0) 62%)",
    "linear-gradient(180deg, rgba(255,255,255,.1) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,.26) 100%)",
  ];
  if (shape === "tonda") {
    layers.push("linear-gradient(90deg, rgba(0,0,0,0) 48.5%, rgba(0,0,0,.16) 48.5%, rgba(0,0,0,.16) 51.5%, rgba(0,0,0,0) 51.5%)");
  }
  if (shape === "capsula") {
    layers.push("linear-gradient(90deg, rgba(0,0,0,0) 49%, rgba(0,0,0,.18) 49%, rgba(0,0,0,.18) 51%, rgba(0,0,0,0) 51%)");
    layers.push(`linear-gradient(90deg, ${color} 50%, #F5F4EF 50%)`);
  } else {
    layers.push(color);
  }
  const round = shape === "tonda" || shape === "ovale";
  return {
    width: w,
    height: h,
    borderRadius: round ? "50%" : h / 2,
    background: layers.join(","),
    boxShadow: `inset 0 -${(h * 0.08).toFixed(1)}px ${(h * 0.16).toFixed(1)}px rgba(0,0,0,.16), 0 1px 1.5px rgba(14,22,32,.3)`,
  };
}

/** Proporzioni larghezza/altezza delle forme rispetto alla dimensione. */
export const PILL_RATIO: Record<string, [number, number]> = {
  tonda: [0.8, 0.8],
  ovale: [1, 0.64],
  capsula: [1, 0.42],
};
