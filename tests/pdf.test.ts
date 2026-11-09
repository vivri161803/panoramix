import { describe, expect, it } from "vitest";
import { jpegToA4Pdf } from "@/lib/pdf";

const text = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

describe("jpegToA4Pdf", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
  const pdf = jpegToA4Pdf(jpeg, 1588, 2246);
  const s = text(pdf);

  it("ha una pagina A4 con l'immagine", () => {
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s).toContain("/MediaBox [0 0 595.28 841.89]");
    expect(s).toContain("/Width 1588 /Height 2246");
    expect(s).toContain(`/Filter /DCTDecode /Length ${jpeg.length}`);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("riporta il JPEG intatto", () => {
    const at = s.indexOf("stream\n", s.indexOf("/DCTDecode")) + "stream\n".length;
    expect([...pdf.slice(at, at + jpeg.length)]).toEqual([...jpeg]);
  });

  it("ha la tabella xref con gli scostamenti giusti", () => {
    const startxref = Number(s.match(/startxref\n(\d+)/)![1]);
    expect(s.slice(startxref, startxref + 4)).toBe("xref");
    const offsets = [...s.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(5);
    offsets.forEach((o, i) => expect(s.slice(o, o + 8)).toBe(`${i + 1} 0 obj\n`));
  });
});
