// Genera i PNG dell'icona a partire da app/icon.svg (unica fonte del disegno).
// Uso: node scripts/build-icons.mjs
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("../app/icon.svg", import.meta.url), "utf8");
const square = svg.replace('rx="22.5" fill="url(#bg)"', 'fill="url(#bg)"');

// Email: 32px a schermo, 96px per gli schermi ad alta densità
await sharp(Buffer.from(svg), { density: 300 }).resize(96, 96).png({ compressionLevel: 9 }).toFile("public/email-logo.png");
// iPhone/iPad "Aggiungi a Home": quadrata, gli angoli li arrotonda iOS
await sharp(Buffer.from(square), { density: 300 }).resize(180, 180).png({ compressionLevel: 9 }).toFile("app/apple-icon.png");

console.log("Icone generate: public/email-logo.png, app/apple-icon.png");
