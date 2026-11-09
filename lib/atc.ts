// Gruppi anatomici ATC (prima lettera del codice) in parole semplici, con il colore della compressa.
// Il colore dice a cosa serve il farmaco: lo calcola il server (lib/actions/medications.ts) e resta
// salvato in medications.color. Le prime sei tinte sono quelle di prima, per i gruppi più comuni
// negli anziani; le altre otto sono state scelte distinguibili tra loro e su sfondo chiaro e scuro.

export interface AtcGroup {
  letter: string;
  label: string;
  color: string;
}

export const ATC_GROUPS: readonly AtcGroup[] = [
  { letter: "A", label: "Stomaco, intestino e metabolismo", color: "#FFC020" },
  { letter: "B", label: "Sangue", color: "#12C2B0" },
  { letter: "C", label: "Cuore e circolazione", color: "#FF5E4D" },
  { letter: "D", label: "Pelle", color: "#F25CA2" },
  { letter: "G", label: "Apparato urinario e ormoni sessuali", color: "#FF8A1F" },
  { letter: "H", label: "Ormoni", color: "#4FC3F7" },
  { letter: "J", label: "Antibiotici e antivirali", color: "#2E9E5A" },
  { letter: "L", label: "Tumori e sistema immunitario", color: "#B23A5B" },
  { letter: "M", label: "Muscoli e ossa", color: "#93D232" },
  { letter: "N", label: "Sistema nervoso", color: "#8D5BF5" },
  { letter: "P", label: "Antiparassitari", color: "#A8703F" },
  { letter: "R", label: "Respiro", color: "#2E78F5" },
  { letter: "S", label: "Occhi e orecchie", color: "#F9A8D4" },
  { letter: "V", label: "Altro", color: "#8E8A2C" },
];

/** "Non so": grigio neutro, atc_code resta null. */
export const ATC_UNKNOWN = { letter: "?", label: "Non so", color: "#9AA1A9" } as const;

/** Valore del modulo per "Non so" (nel database diventa atc_code null). */
export const ATC_UNKNOWN_VALUE = "?";

/** Codice ATC completo (C09AA05) o solo la lettera del gruppo. */
export const ATC_CODE_RE = /^[A-Z]([0-9]{2}([A-Z]([A-Z]([0-9]{2})?)?)?)?$/;

const BY_LETTER = new Map(ATC_GROUPS.map((g) => [g.letter, g]));

/** Gruppo dal codice (completo o sola lettera); null se manca o la lettera non è un gruppo ATC. */
export function atcGroup(code: string | null | undefined): AtcGroup | null {
  const letter = code?.trim().charAt(0).toUpperCase();
  return (letter && BY_LETTER.get(letter)) || null;
}

/** Colore della compressa per il codice: grigio "Non so" se il gruppo non si conosce. */
export function atcColor(code: string | null | undefined): string {
  return atcGroup(code)?.color ?? ATC_UNKNOWN.color;
}

/** Etichetta in parole del gruppo: "Cuore e circolazione"; "Non so" se manca. */
export function atcLabel(code: string | null | undefined): string {
  return atcGroup(code)?.label ?? ATC_UNKNOWN.label;
}

/** Gruppi presenti in un elenco di medicinali, nell'ordine delle lettere (per la legenda). */
export function groupsPresent(codes: (string | null)[], colors: string[] = []): { label: string; color: string }[] {
  const out = ATC_GROUPS.filter((g) => codes.some((c) => atcGroup(c)?.letter === g.letter)).map((g) => ({ label: g.label, color: g.color }));
  if (colors.includes(ATC_UNKNOWN.color)) out.push({ label: ATC_UNKNOWN.label, color: ATC_UNKNOWN.color });
  return out;
}
