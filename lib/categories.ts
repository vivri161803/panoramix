// Dieci categorie di medicinale (design: design/Presidi.dc.html, sezioni 07–10; design/Presidio.dc.html).
// Parole, modo di conteggio e mappatura dalla forma farmaceutica AIFA. Funzioni pure.
//
// Modo di conteggio: un medicinale è «a livello» se ha days_per_pack (giorni di uso per contenitore):
// la scorta è un numero di contenitori (flaconi, tubi, inalatori) che scende di 1 / days_per_pack per
// ogni giorno con una dose. Altrimenti è «a pezzi», come le compresse.

export type CountMode = "pezzi" | "livello";

interface CategoryDef {
  id: string;
  label: string;
  /** contenitore: singolare, plurale, femminile */
  one: string;
  many: string;
  fem: boolean;
  /** parola della dose a livello (singolare, plurale, femminile); null = parola del contenitore */
  dose: [string, string, boolean] | null;
  /** passo del campo dose nel modulo */
  step: number;
  mode: CountMode;
}

export const CATEGORIES = [
  { id: "pillola", label: "Pillola", one: "compressa", many: "compresse", fem: true, dose: null, step: 0.5, mode: "pezzi" },
  { id: "bustina", label: "Bustina", one: "bustina", many: "bustine", fem: true, dose: null, step: 1, mode: "pezzi" },
  { id: "liquido", label: "Liquido", one: "flacone", many: "flaconi", fem: false, dose: ["ml", "ml", false], step: 0.5, mode: "livello" },
  { id: "iniezione", label: "Iniezione", one: "siringa", many: "siringhe", fem: true, dose: ["unità", "unità", true], step: 1, mode: "pezzi" },
  { id: "gocce", label: "Gocce", one: "flacone", many: "flaconi", fem: false, dose: ["goccia", "gocce", true], step: 1, mode: "livello" },
  { id: "inalatore", label: "Inalatore", one: "inalatore", many: "inalatori", fem: false, dose: ["erogazione", "erogazioni", true], step: 1, mode: "livello" },
  { id: "cerotto", label: "Cerotto", one: "cerotto", many: "cerotti", fem: false, dose: null, step: 1, mode: "pezzi" },
  { id: "crema", label: "Crema", one: "tubo", many: "tubi", fem: false, dose: ["applicazione", "applicazioni", true], step: 1, mode: "livello" },
  { id: "supposta", label: "Supposta", one: "supposta", many: "supposte", fem: true, dose: null, step: 1, mode: "pezzi" },
  { id: "altro", label: "Altro", one: "pezzo", many: "pezzi", fem: false, dose: null, step: 1, mode: "pezzi" },
] as const satisfies readonly CategoryDef[];

export type Category = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [Category, ...Category[]];

const BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<Category, CategoryDef>;

export function categoryDef(category: Category): CategoryDef {
  return BY_ID[category] ?? BY_ID.altro;
}

export function categoryLabel(category: Category): string {
  return categoryDef(category).label;
}

/** Quello che serve per scegliere le parole di un medicinale. */
export interface CategoryMed {
  category: Category;
  daysPerPack?: number | null;
  frequencyType?: string;
}

export function isLevel(m: { daysPerPack?: number | null }): boolean {
  return m.daysPerPack != null && m.daysPerPack > 0;
}

export function defaultMode(category: Category): CountMode {
  return categoryDef(category).mode;
}

/** Modo delle parole: al bisogno segue la categoria (si conta sempre a pezzi, ma un flacone resta un flacone). */
export function wordMode(m: CategoryMed): CountMode {
  if (m.frequencyType === "as_needed") return defaultMode(m.category);
  return isLevel(m) ? "livello" : "pezzi";
}

const EPS = 1e-9;
const plural = (n: number) => Math.abs(n - 1) > EPS;

/** Contenitore nel modo dato, con le due eccezioni: gocce a pezzi (monodose) e iniezione a livello (penna). */
function container(category: Category, mode: CountMode): { one: string; many: string; fem: boolean } {
  if (category === "gocce" && mode === "pezzi") return { one: "monodose", many: "monodose", fem: true };
  if (category === "iniezione" && mode === "livello") return { one: "penna", many: "penne", fem: true };
  const d = categoryDef(category);
  return { one: d.one, many: d.many, fem: d.fem };
}

/** «compressa» / «compresse», «flacone» / «flaconi», «monodose», «penna» / «penne», … */
export function containerWord(m: CategoryMed, n: number): string {
  const c = container(m.category, wordMode(m));
  return plural(n) ? c.many : c.one;
}

function doseParts(m: CategoryMed): [string, string, boolean] {
  const mode = wordMode(m);
  const d = categoryDef(m.category).dose;
  if (mode === "livello" && d) return d;
  const c = container(m.category, mode);
  return [c.one, c.many, c.fem];
}

/** Parola della dose: il contenitore a pezzi («2 compresse»), la colonna «dose a livello» a livello («5 ml»). */
export function doseWord(m: CategoryMed, n: number): string {
  const [one, many] = doseParts(m);
  return plural(n) ? many : one;
}

/** «compresse rimaste», «tubo rimasto», «flaconi rimasti» */
export function leftWord(m: CategoryMed, n: number): string {
  const c = container(m.category, wordMode(m));
  const left = plural(n) ? (c.fem ? "rimaste" : "rimasti") : c.fem ? "rimasta" : "rimasto";
  return `${containerWord(m, n)} ${left}`;
}

/** Passo del campo dose: le compresse si spezzano a metà, i ml anche; siringhe, gocce e cerotti no. */
export function doseStep(m: CategoryMed): number {
  return categoryDef(m.category).step;
}

const quant = (fem: boolean) => (fem ? "Quante" : "Quanti");

/** «Quante compresse in una confezione?», «Quanti flaconi in una confezione?» */
export function perPackQuestion(m: CategoryMed): string {
  const c = container(m.category, wordMode(m));
  return `${quant(c.fem)} ${c.many} in una confezione?`;
}

/** «Per quanti giorni di uso dura un tubo?», «… una penna?» (sempre nel modo a livello) */
export function daysQuestion(m: CategoryMed): string {
  const c = container(m.category, "livello");
  return `Per quanti giorni di uso dura ${c.fem ? "una" : "un"} ${c.one}?`;
}

/** «Quanti cerotti hai in tutto?», con «, compresi quelli nel portapillole» se c'è il promemoria. */
export function recountQuestion(m: CategoryMed, prepReminder = false): string {
  const c = container(m.category, wordMode(m));
  const pill = prepReminder ? `, ${c.fem ? "comprese quelle" : "compresi quelli"} nel portapillole` : "";
  return `${quant(c.fem)} ${c.many} hai in tutto${pill}?`;
}

/** Titolo delle dosi nel modulo: «Quante compresse», «Quanti ml», «Quante gocce». */
export function doseQuestion(m: CategoryMed): string {
  const [, many, fem] = doseParts(m);
  return `${quant(fem)} ${many}`;
}

/** «Finito un flacone», «Finita una penna» (al bisogno nelle categorie a livello). */
export function finishedOneLabel(m: CategoryMed): string {
  const c = container(m.category, defaultMode(m.category));
  return c.fem ? `Finita una ${c.one}` : `Finito un ${c.one}`;
}

/**
 * Scorta a livello in parole: «finito», «meno di un flacone», «1 flacone e mezzo», «2 flaconi».
 * Arrotonda solo per mostrarla; nel database la scorta resta com'è.
 */
export function levelQuantity(q: number, m: CategoryMed): string {
  const c = container(m.category, "livello");
  const w = (n: number) => (plural(n) ? c.many : c.one);
  if (q <= EPS) return c.fem ? "finita" : "finito";
  if (q < 1 - EPS) return `meno di ${c.fem ? "una" : "un"} ${c.one}`;
  const whole = Math.floor(q + EPS);
  const r = q - whole;
  if (r >= 0.25 - EPS && r < 0.75 - EPS) return `${whole} ${w(whole)} e ${c.fem ? "mezza" : "mezzo"}`;
  const n = Math.round(q);
  return `${n} ${w(n)}`;
}

/** «circa 18 giorni · 1 flacone e mezzo»; senza copertura (fine terapia coperta) solo la quantità. */
export function levelPhrase(stock: number, coverageDays: number | null, m: CategoryMed): string {
  const q = levelQuantity(stock, m);
  if (coverageDays === null) return q;
  return `circa ${coverageDays} ${coverageDays === 1 ? "giorno" : "giorni"} · ${q}`;
}

// ——— Mappatura dalla forma farmaceutica AIFA (R2.5) ———

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

const has = (s: string, ...keys: string[]) => keys.some((k) => new RegExp(`\\b${k}`).test(s));

/** Riga per riga, vince la prima: prima le eccezioni, poi le parole chiave del progetto grafico. */
const RULES: [(f: string) => boolean, Category][] = [
  // eccezioni
  [(f) => has(f, "POLVERE PER INALAZIONE"), "inalatore"],
  [(f) => has(f, "GRANULATO PER SOSPENSIONE ORALE", "POLVERE PER SOSPENSIONE ORALE"), "bustina"],
  [(f) => has(f, "GELATINOSA"), "pillola"],
  [(f) => has(f, "UNGUENTO OFTALMICO", "GEL OFTALMICO"), "crema"],
  [(f) => has(f, "VAGINAL", "RETTAL") && !has(f, "OVUL", "SUPPOST", "CAPSUL", "COMPRESS"), "crema"],
  [(f) => has(f, "SPRAY NASALE"), "gocce"],
  [(f) => has(f, "GOCCE ORALI"), "gocce"],
  // parole chiave
  [(f) => has(f, "COMPRESS", "CAPSUL", "PASTIGL", "CONFETT"), "pillola"],
  [(f) => has(f, "BUSTIN", "GRANULAT", "POLVERE ORALE"), "bustina"],
  [(f) => has(f, "SCIROPPO", "SOLUZIONE ORALE", "SOSPENSIONE ORALE", "GOCCE ORALI"), "liquido"],
  [(f) => has(f, "INIETT", "INFUS", "SIRINGA", "PENNA", "FIALA"), "iniezione"],
  [(f) => has(f, "COLLIRIO", "OFTALM", "AURICOL", "NASAL"), "gocce"],
  [(f) => has(f, "INALAZ", "NEBULIZZ", "AEROSOL"), "inalatore"],
  [(f) => has(f, "CEROTT", "TRANSDERM"), "cerotto"],
  [(f) => has(f, "CREMA", "POMATA", "UNGUENTO", "GEL", "SCHIUMA"), "crema"],
  [(f) => has(f, "SUPPOST", "OVUL", "RETTAL", "VAGINAL"), "supposta"],
];

/** Categoria dalla forma farmaceutica AIFA («COLLIRIO, SOLUZIONE» → gocce). Senza corrispondenze: altro. */
export function categoryFromForm(forma: string): Category {
  const f = normalize(forma ?? "");
  return RULES.find(([test]) => test(f))?.[1] ?? "altro";
}

/**
 * Categoria, forma della pillola e modo di conteggio dalla forma e dalla descrizione della confezione:
 * PENNA o MULTIDOSE → livello, MONODOSE → pezzi, altrimenti il modo della categoria.
 */
export function categoryFromAifa(forma: string, descrizione: string): { category: Category; shape: string | null; mode: CountMode } {
  const category = categoryFromForm(forma);
  const both = normalize(`${forma ?? ""} ${descrizione ?? ""}`);
  const shape = category === "pillola" && has(normalize(forma ?? ""), "CAPSUL") ? "capsula" : null;
  const mode: CountMode = has(both, "PENN[AE]", "MULTIDOSE") ? "livello" : has(both, "MONODOSE") ? "pezzi" : defaultMode(category);
  return { category, shape, mode };
}
