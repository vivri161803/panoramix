import { describe, expect, it } from "vitest";
import { ATC_GROUPS, ATC_UNKNOWN, atcColor, atcGroup, atcLabel, groupsPresent } from "@/lib/atc";
import { PILL_COLOR_HEXES, pillLook } from "@/lib/pills";

describe("gruppi ATC", () => {
  it("codice completo", () => {
    expect(atcGroup("C09AA05")?.label).toBe("Cuore e circolazione");
    expect(atcColor("C09AA05")).toBe("#FF5E4D");
  });

  it("sola lettera, anche minuscola", () => {
    expect(atcLabel("N")).toBe("Sistema nervoso");
    expect(atcColor("r")).toBe("#2E78F5");
  });

  it("null: grigio e Non so", () => {
    expect(atcGroup(null)).toBeNull();
    expect(atcColor(null)).toBe(ATC_UNKNOWN.color);
    expect(atcLabel(undefined)).toBe("Non so");
  });

  it("lettera che non è un gruppo ATC", () => {
    expect(atcGroup("X01")).toBeNull();
    expect(atcColor("Z")).toBe(ATC_UNKNOWN.color);
  });

  it("14 gruppi con colori diversi, tutti ammessi dal database", () => {
    expect(ATC_GROUPS).toHaveLength(14);
    const colors = [...ATC_GROUPS.map((g) => g.color), ATC_UNKNOWN.color];
    expect(new Set(colors).size).toBe(15);
    for (const c of colors) expect(PILL_COLOR_HEXES).toContain(c);
  });

  it("legenda dei gruppi presenti, in ordine", () => {
    expect(groupsPresent(["N05", "C09AA05", "C10", null], ["#8D5BF5", "#FF5E4D", "#FF5E4D", ATC_UNKNOWN.color])).toEqual([
      { label: "Cuore e circolazione", color: "#FF5E4D" },
      { label: "Sistema nervoso", color: "#8D5BF5" },
      { label: "Non so", color: ATC_UNKNOWN.color },
    ]);
  });

  it("stampa: gruppo e forma, mai il colore", () => {
    expect(pillLook("C09AA05", "tonda")).toBe("Cuore e circolazione · tonda");
    expect(pillLook(null, "capsula")).toBe("capsula");
  });
});
