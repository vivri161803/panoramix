// Il WebAssembly dello scanner è servito da public/zxing (nessuna CDN): deve essere lo stesso
// file della versione di zxing-wasm installata. Dopo un aggiornamento di barcode-detector:
// cp node_modules/zxing-wasm/dist/reader/zxing_reader.wasm public/zxing/
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sha = (p: string) => createHash("sha256").update(readFileSync(new URL(p, import.meta.url))).digest("hex");

describe("WebAssembly dello scanner", () => {
  it("public/zxing è allineato a zxing-wasm installato", () => {
    expect(sha("../public/zxing/zxing_reader.wasm")).toBe(sha("../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm"));
  });
});
