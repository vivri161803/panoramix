// Tipi di medicinale e presidi (design: design/Presidi.dc.html, design/Presidio.dc.html).
// "compressa" usa le forme di lib/pills.ts; gli altri tipi usano le forme qui sotto.

export const FORMS = [
  { id: "compressa", label: "Compressa", shapes: ["tonda", "ovale", "capsula"] },
  { id: "iniezione", label: "Iniezione", shapes: ["siringa", "penna", "fiala"] },
  { id: "cerotto", label: "Cerotto", shapes: ["cerotto", "cerotto-tondo", "bustina"] },
  { id: "collirio", label: "Collirio", shapes: ["flacone", "monodose"] },
] as const;

export type MedForm = (typeof FORMS)[number]["id"];
export const FORM_IDS = FORMS.map((f) => f.id) as [MedForm, ...MedForm[]];

export const PRESIDIO_SHAPES = [
  { id: "siringa", label: "Siringa" },
  { id: "penna", label: "Penna" },
  { id: "fiala", label: "Fiala" },
  { id: "cerotto", label: "Quadrato" },
  { id: "cerotto-tondo", label: "Tondo" },
  { id: "bustina", label: "In bustina" },
  { id: "flacone", label: "Flacone" },
  { id: "monodose", label: "Monodose" },
] as const;

export const ALL_SHAPE_IDS = ["tonda", "ovale", "capsula", ...PRESIDIO_SHAPES.map((s) => s.id)] as [string, ...string[]];

export function isPresidio(shape: string): boolean {
  return PRESIDIO_SHAPES.some((s) => s.id === shape);
}

export function formOf(shape: string): MedForm {
  return FORMS.find((f) => (f.shapes as readonly string[]).includes(shape))?.id ?? "compressa";
}

/** Parole per forma, al posto di «compressa / compresse»: [singolare, plurale, femminile]. */
const WORDS: Record<string, [string, string, boolean]> = {
  siringa: ["siringa", "siringhe", true],
  penna: ["penna", "penne", true],
  fiala: ["fiala", "fiale", true],
  cerotto: ["cerotto", "cerotti", false],
  "cerotto-tondo": ["cerotto", "cerotti", false],
  bustina: ["cerotto", "cerotti", false],
  flacone: ["flacone", "flaconi", false],
  monodose: ["monodose", "monodose", true],
};

/** «compressa» / «compresse», «siringa» / «siringhe», … */
export function unitWord(shape: string, n: number): string {
  const w = WORDS[shape] ?? ["compressa", "compresse", true];
  return n === 1 ? w[0] : w[1];
}

/** «compresse rimaste», «cerotto rimasto», «cerotti rimasti (in bustina)», … */
export function leftWord(shape: string, n: number): string {
  const fem = (WORDS[shape] ?? [, , true])[2];
  const left = n === 1 ? (fem ? "rimasta" : "rimasto") : fem ? "rimaste" : "rimasti";
  return `${unitWord(shape, n)} ${left}${shape === "bustina" ? " (in bustina)" : ""}`;
}

/** Unità della dose: per il flacone di collirio è la goccia, per gli altri il pezzo stesso. */
export function doseWord(shape: string, n: number): string {
  if (shape === "flacone") return n === 1 ? "goccia" : "gocce";
  return unitWord(shape, n);
}

/** «Quante compresse», «Quanti cerotti», «Quante gocce» */
export function howMany(shape: string, pieces = false): string {
  const word = pieces ? unitWord(shape, 2) : doseWord(shape, 2);
  const masc = (pieces || shape !== "flacone") && WORDS[shape] && !WORDS[shape][2];
  return `${masc ? "Quanti" : "Quante"} ${word}`;
}

/** Le compresse si spezzano a metà; siringhe, cerotti e gocce no. */
export function doseStep(shape: string): number {
  return isPresidio(shape) ? 1 : 0.5;
}

/** Il flacone di collirio non si conta a pezzi: promemoria di riordino dopo X giorni. */
export function usesReorderDays(shape: string): boolean {
  return shape === "flacone";
}
