/** Lato di un foglio A4 in punti PDF (1 pt = 1/72 di pollice). */
export const A4_PT = { width: 595.28, height: 841.89 } as const;

/**
 * PDF di una sola pagina A4 con un'immagine JPEG a pagina piena.
 * Serve per stampare il foglio dove `window.print()` non funziona
 * (app aggiunta alla schermata Home dell'iPhone).
 */
export function jpegToA4Pdf(jpeg: Uint8Array, width: number, height: number): Uint8Array {
  const enc = new TextEncoder();
  const { width: W, height: H } = A4_PT;
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  const objects: (string | Uint8Array)[][] = [
    ["<< /Type /Catalog /Pages 2 0 R >>"],
    ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
    [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`],
    [
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      jpeg,
      "\nendstream",
    ],
    [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`],
  ];

  const chunks: Uint8Array[] = [];
  let size = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? enc.encode(part) : part;
    chunks.push(bytes);
    size += bytes.length;
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const offsets: number[] = [];
  objects.forEach((parts, i) => {
    offsets.push(size);
    push(`${i + 1} 0 obj\n`);
    parts.forEach(push);
    push("\nendobj\n");
  });
  const xref = size;
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.forEach((o) => push(`${String(o).padStart(10, "0")} 00000 n \n`));
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
