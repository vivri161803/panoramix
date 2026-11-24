import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decode, HeaderMismatchError, parseSource } from "../scripts/aifa/parse.mjs";

const cp1252Bytes = readFileSync(new URL("./fixtures/aifa/elenco_medicinali_carenti.csv", import.meta.url));
const cp1252Text = new TextDecoder("windows-1252").decode(cp1252Bytes);
const utf8Bytes = Buffer.from(cp1252Text, "utf8");

describe("codifica dell'elenco dei carenti", () => {
  it("T1-A1 — UTF-8 si decodifica e produce le stesse righe del file Windows-1252", () => {
    const utf8 = decode(utf8Bytes);
    expect(utf8.encoding).toBe("utf-8");
    expect(utf8.text).toContain("Classe di rimborsabilità");
    expect(utf8.text).toContain("Sì");
    expect(utf8.text).not.toContain("Ã");
    const legacy = decode(cp1252Bytes);
    expect(parseSource("carenze", utf8.text)).toEqual(parseSource("carenze", legacy.text));
  });

  it("T1-A2 — Windows-1252 resta letto come Windows-1252 con lo stesso testo di prima", () => {
    const r = decode(cp1252Bytes);
    expect(r.encoding).toBe("windows-1252");
    expect(r.text).toBe(cp1252Text);
    expect(() => parseSource("carenze", r.text)).not.toThrow();
  });

  it("T1-A3 — UTF-8 con colonna rinominata viene bloccato dal controllo colonne", () => {
    const renamed = Buffer.from(cp1252Text.replace("Classe di rimborsabilità", "Classe rimborso"), "utf8");
    const r = decode(renamed);
    expect(() => parseSource("carenze", r.text)).toThrow(HeaderMismatchError);
  });

  it("T1-A4 — byte accentati Windows-1252 non producono caratteri di sostituzione", () => {
    const r = decode(Buffer.from([0x63, 0x69, 0x74, 0x74, 0xe0, 0x20, 0x53, 0xec]));
    expect(r.text).not.toContain("�");
    expect(r.text).toBe("città Sì");
    expect(r.encoding).toBe("windows-1252");
    const full = decode(cp1252Bytes);
    expect(full.text).not.toContain("�");
  });
});
