// Packages each DARBE-H! card's own code-drawn illustration
// (public/games/darbe-h/assets/card-art/<id>.svg, built by
// scripts/build-darbe-h-card-art.mjs) into the 400x560 card SVG the duel
// serves from assets/cards/. The frame, colours, labels and data-* contract
// are unchanged; only the picture inside the frame changed. No raster plates,
// no remote assets. Run build-darbe-h-card-art.mjs first.
// Usage: node scripts/build-darbe-h-art.mjs
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../public/games/darbe-h/", import.meta.url);
const source = JSON.parse(readFileSync(new URL("source-cards.json", ROOT), "utf8"));
const INK = { unit: "#aa9164", spell: "#6f998d", trap: "#b37870" };
const KIND = { unit: "GÖREVLİ", spell: "EMİRNAME", trap: "İHTAR" };
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const seriesKey = (raw) => (raw ? raw.split("—").at(-1).trim() : "Dosya");

function cardSvg(card) {
  const cid = card.id;
  const art = readFileSync(new URL(`assets/card-art/${cid}.svg`, ROOT));
  const encoded = art.toString("base64");
  const sid = seriesKey(card.series || "");
  const kind = card.kind;
  const level = Number(card.level || 0);
  const aux = card.deckLocation === "auxiliary";
  const tier = aux ? "aux" : level >= 7 ? "high" : level >= 5 ? "mid" : "low";
  const colour = INK[kind];
  // The 240x160 illustration sits whole in the middle of the tall card; a
  // blurred, darkened copy of the same picture fills the space above and below.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="400" height="560">
<title>${esc(card.name)} · ${esc(sid)} · ${cid}</title>
<desc>Code-drawn illustration for this card (card-art/${cid}.svg). Fictional; not historical evidence.</desc>
<defs><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#07100e" stop-opacity=".05"/><stop offset=".72" stop-color="#07100e" stop-opacity="0"/><stop offset="1" stop-color="#07100e" stop-opacity=".92"/></linearGradient><filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="14"/></filter><image id="art" width="400" height="267" preserveAspectRatio="xMidYMid meet" href="data:image/svg+xml;base64,${encoded}"/></defs>
<rect width="400" height="560" fill="#0c1410"/>
<g data-series="${esc(sid)}" data-kind="${kind}" data-subtype="${esc(card.subtype || "normal")}" data-tier="${tier}" data-aux="${aux ? 1 : 0}" data-scene="card-art" data-card="${cid}">
<use href="#art" transform="translate(-220 0) scale(2.1)" filter="url(#soft)" opacity=".55"/>
<rect width="400" height="560" fill="#0c1410" opacity=".35"/>
<use href="#art" y="128"/>
<path d="M0 128H400M0 395H400" stroke="#07100e" stroke-opacity=".7"/>
<rect width="400" height="560" fill="url(#shade)"/>
<path d="M18 18H54M18 18V54M382 18H346M382 18V54" fill="none" stroke="${colour}" stroke-opacity=".62"/>
<path d="M20 511H380" stroke="${colour}" stroke-opacity=".6"/>
<text x="21" y="536" fill="#e5d7b8" font-family="Georgia,serif" font-size="15" letter-spacing="1.3">${esc(sid.toUpperCase())}</text>
<text x="379" y="536" text-anchor="end" fill="${colour}" font-family="monospace" font-size="11">${cid} · ${KIND[kind]}</text>
<!--well-end--></g></svg>
`;
}

mkdirSync(new URL("assets/cards/", ROOT), { recursive: true });
const cards = {};
const hashes = new Set();
const sizes = [];
for (const card of source) {
  const data = Buffer.from(cardSvg(card));
  writeFileSync(new URL(`assets/cards/${card.id}.svg`, ROOT), data);
  const sha256 = createHash("sha256").update(data).digest("hex");
  if (hashes.has(sha256)) throw new Error(`duplicate card SVG: ${card.id}`);
  hashes.add(sha256);
  sizes.push(data.length);
  cards[card.id] = {
    path: `/games/darbe-h/assets/cards/${card.id}.svg`,
    width: 400,
    height: 560,
    bytes: data.length,
    sha256,
  };
}
const ordered = [...sizes].sort((a, b) => a - b);
const total = sizes.reduce((a, b) => a + b, 0);
const summary = {
  coverage: source.length,
  totalBytes: total,
  averageBytes: Math.round(total / sizes.length),
  p95Bytes: ordered[Math.floor(ordered.length * 0.95) - 1],
  maxBytes: ordered.at(-1),
  duplicateHashes: 0,
  duplicateWells: 0,
  dimensions: [400, 560],
  kind: "svg",
  source: "assets/card-art/<id>.svg (scripts/build-darbe-h-card-art.mjs)",
};
writeFileSync(
  new URL("assets/art-manifest.json", ROOT),
  JSON.stringify({ summary, cards }, null, 2) + "\n",
);
console.log(`Packaged ${source.length} DARBE-H! cards / ${total.toLocaleString()} bytes`);
