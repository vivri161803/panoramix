import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  categoryFromAifa,
  categoryFromForm,
  containerWord,
  daysQuestion,
  defaultMode,
  doseQuestion,
  doseWord,
  finishedOneLabel,
  leftWord,
  levelPhrase,
  levelQuantity,
  perPackQuestion,
  recountQuestion,
  type Category,
  type CategoryMed,
} from "@/lib/categories";
import { isLevelQty } from "@/lib/schemas";

const pieces = (category: Category): CategoryMed => ({ category, daysPerPack: null, frequencyType: "daily" });
const level = (category: Category): CategoryMed => ({ category, daysPerPack: 30, frequencyType: "daily" });
const asNeeded = (category: Category): CategoryMed => ({ category, daysPerPack: null, frequencyType: "as_needed" });

describe("categoryFromForm", () => {
  it.each([
    // eccezioni
    ["POLVERE PER INALAZIONE, CAPSULA RIGIDA", "inalatore"],
    ["POLVERE PER INALAZIONE IN CAPSULA GELATINOSA", "inalatore"],
    ["GRANULATO PER SOSPENSIONE ORALE", "bustina"],
    ["POLVERE PER SOSPENSIONE ORALE", "bustina"],
    ["CAPSULA MOLLE GELATINOSA", "pillola"],
    ["UNGUENTO OFTALMICO", "crema"],
    ["GEL OFTALMICO", "crema"],
    ["GEL VAGINALE", "crema"],
    ["SCHIUMA RETTALE", "crema"],
    ["SPRAY NASALE, SOLUZIONE", "gocce"],
    ["GOCCE ORALI, SOLUZIONE", "gocce"],
    // parole chiave
    ["COMPRESSA RIVESTITA", "pillola"],
    ["COMPRESSE RIVESTITE CON FILM", "pillola"],
    ["CAPSULA RIGIDA", "pillola"],
    ["PASTIGLIA", "pillola"],
    ["Compressa effervescente", "pillola"],
    ["COMPRESSA VAGINALE", "pillola"],
    ["GRANULATO EFFERVESCENTE", "bustina"],
    ["BUSTINA", "bustina"],
    ["POLVERE ORALE", "bustina"],
    ["SCIROPPO", "liquido"],
    ["SOLUZIONE ORALE", "liquido"],
    ["SOSPENSIONE ORALE", "liquido"],
    ["SOLUZIONE INIETTABILE", "iniezione"],
    ["SOLUZIONE INIETTABILE IN PENNA PRERIEMPITA", "iniezione"],
    ["POLVERE PER SOLUZIONE PER INFUSIONE", "iniezione"],
    ["COLLIRIO, SOLUZIONE", "gocce"],
    ["GOCCE AURICOLARI, SOLUZIONE", "gocce"],
    ["SOSPENSIONE PER NEBULIZZATORE", "inalatore"],
    ["SOSPENSIONE PRESSURIZZATA PER INALAZIONE", "inalatore"],
    ["CEROTTO TRANSDERMICO", "cerotto"],
    ["CREMA", "crema"],
    ["POMATA", "crema"],
    ["GEL", "crema"],
    ["SCHIUMA CUTANEA", "crema"],
    ["SUPPOSTE", "supposta"],
    ["OVULO", "supposta"],
    ["SOLUZIONE CUTANEA", "altro"],
    ["", "altro"],
  ] as const)("%s → %s", (forma, category) => {
    expect(categoryFromForm(forma)).toBe(category);
  });

  it("ignora maiuscole e accenti", () => {
    expect(categoryFromForm("granulato per sospensione orale")).toBe("bustina");
    expect(categoryFromForm("Unguento oftàlmico")).toBe("crema");
  });
});

describe("categoryFromAifa", () => {
  it("PENNA → iniezione a livello", () => {
    expect(categoryFromAifa("SOLUZIONE INIETTABILE", "1 PENNA PRERIEMPITA DA 3 ML")).toEqual({ category: "iniezione", shape: null, mode: "livello" });
  });
  it("MONODOSE → gocce a pezzi", () => {
    expect(categoryFromAifa("COLLIRIO, SOLUZIONE", "30 CONTENITORI MONODOSE DA 0,3 ML")).toEqual({ category: "gocce", shape: null, mode: "pezzi" });
  });
  it("MULTIDOSE → livello", () => {
    expect(categoryFromAifa("SOLUZIONE INIETTABILE", "1 FLACONCINO MULTIDOSE").mode).toBe("livello");
  });
  it("altrimenti il modo di default, e capsula per le pillole in capsule", () => {
    expect(categoryFromAifa("SCIROPPO", "1 FLACONE 150 ML")).toEqual({ category: "liquido", shape: null, mode: "livello" });
    expect(categoryFromAifa("CAPSULA RIGIDA", "28 CAPSULE")).toEqual({ category: "pillola", shape: "capsula", mode: "pezzi" });
    expect(categoryFromAifa("COMPRESSA", "30 COMPRESSE")).toEqual({ category: "pillola", shape: null, mode: "pezzi" });
  });
});

describe("parole per categoria", () => {
  it.each([
    ["pillola", "compressa", "compresse", "compresse rimaste"],
    ["bustina", "bustina", "bustine", "bustine rimaste"],
    ["iniezione", "siringa", "siringhe", "siringhe rimaste"],
    ["cerotto", "cerotto", "cerotti", "cerotti rimasti"],
    ["supposta", "supposta", "supposte", "supposte rimaste"],
    ["altro", "pezzo", "pezzi", "pezzi rimasti"],
  ] as const)("%s a pezzi: %s / %s", (category, one, many, left) => {
    const m = pieces(category);
    expect(containerWord(m, 1)).toBe(one);
    expect(containerWord(m, 2)).toBe(many);
    expect(leftWord(m, 5)).toBe(left);
    expect(doseWord(m, 2)).toBe(many);
  });

  it.each([
    ["liquido", "flacone", "flaconi", "ml", "ml"],
    ["gocce", "flacone", "flaconi", "goccia", "gocce"],
    ["inalatore", "inalatore", "inalatori", "erogazione", "erogazioni"],
    ["crema", "tubo", "tubi", "applicazione", "applicazioni"],
  ] as const)("%s a livello: %s / %s, dose %s / %s", (category, one, many, dose1, dose2) => {
    const m = level(category);
    expect(containerWord(m, 1)).toBe(one);
    expect(containerWord(m, 2)).toBe(many);
    expect(doseWord(m, 1)).toBe(dose1);
    expect(doseWord(m, 3)).toBe(dose2);
    expect(leftWord(m, 1)).toBe(`${one} rimasto`);
  });

  it("genere e domande", () => {
    expect(perPackQuestion(pieces("pillola"))).toBe("Quante compresse in una confezione?");
    expect(perPackQuestion(level("liquido"))).toBe("Quanti flaconi in una confezione?");
    expect(daysQuestion(level("crema"))).toBe("Per quanti giorni di uso dura un tubo?");
    expect(daysQuestion(pieces("iniezione"))).toBe("Per quanti giorni di uso dura una penna?");
    expect(recountQuestion(pieces("cerotto"))).toBe("Quanti cerotti hai in tutto?");
    expect(recountQuestion(pieces("pillola"), true)).toBe("Quante compresse hai in tutto, comprese quelle nel portapillole?");
    expect(recountQuestion(pieces("cerotto"), true)).toBe("Quanti cerotti hai in tutto, compresi quelli nel portapillole?");
    expect(doseQuestion(level("gocce"))).toBe("Quante gocce");
    expect(doseQuestion(level("liquido"))).toBe("Quanti ml");
    expect(doseQuestion(pieces("pillola"))).toBe("Quante compresse");
  });

  it("due eccezioni nel modo non di default: monodose e penna", () => {
    expect(containerWord(pieces("gocce"), 30)).toBe("monodose");
    expect(leftWord(pieces("gocce"), 1)).toBe("monodose rimasta");
    expect(containerWord(level("iniezione"), 1)).toBe("penna");
    expect(containerWord(level("iniezione"), 2)).toBe("penne");
    expect(doseWord(level("iniezione"), 40)).toBe("unità");
  });

  it("al bisogno le parole seguono la categoria: un collirio in flacone resta flacone", () => {
    expect(containerWord(asNeeded("gocce"), 1)).toBe("flacone");
    expect(finishedOneLabel(asNeeded("liquido"))).toBe("Finito un flacone");
    expect(finishedOneLabel(asNeeded("iniezione"))).toBe("Finita una siringa");
  });

  it("modo di default di ogni categoria", () => {
    expect(CATEGORIES.filter((c) => defaultMode(c.id) === "livello").map((c) => c.id)).toEqual(["liquido", "gocce", "inalatore", "crema"]);
  });
});

describe("levelPhrase", () => {
  const syrup = level("liquido");
  const pen = level("iniezione");

  it.each([
    [0, "finito"],
    [0.25, "meno di un flacone"],
    [0.5, "meno di un flacone"],
    [0.967, "meno di un flacone"],
    [1.2, "1 flacone"],
    [1.5, "1 flacone e mezzo"],
    [1.75, "2 flaconi"],
    [2, "2 flaconi"],
    [2.9, "3 flaconi"],
  ])("flacone %s → %s", (q, text) => {
    expect(levelQuantity(q, syrup)).toBe(text);
  });

  it("penna, al femminile", () => {
    expect(levelQuantity(1.5, pen)).toBe("1 penna e mezza");
    expect(levelQuantity(2.5, pen)).toBe("2 penne e mezza");
    expect(levelQuantity(0.4, pen)).toBe("meno di una penna");
    expect(levelQuantity(0, pen)).toBe("finita");
  });

  it("frasi complete", () => {
    expect(levelPhrase(1.5, 18, syrup)).toBe("circa 18 giorni · 1 flacone e mezzo");
    expect(levelPhrase(0, 0, syrup)).toBe("circa 0 giorni · finito");
    expect(levelPhrase(1, 1, syrup)).toBe("circa 1 giorno · 1 flacone");
    expect(levelPhrase(2, null, syrup)).toBe("2 flaconi");
  });
});

describe("isLevelQty", () => {
  it("contenitori chiusi più quello aperto (pieno, metà, quasi finito, nessuno)", () => {
    expect([0, 1, 2, 1.1, 1.5, 0.1, 0.5, 3].every(isLevelQty)).toBe(true);
    expect([1.3, -1, 0.25, NaN].some(isLevelQty)).toBe(false);
  });
});
