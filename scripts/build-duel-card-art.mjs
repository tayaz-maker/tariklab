// Renders the original, code-drawn VETO-H! and GETT-OH! card pictures and
// table backgrounds from scripts/duel-card-art/compose.mjs into the WebP
// files the duel already serves, then rewrites each art-manifest.json.
// Deterministic input (card data + seed); Chromium only rasterises the SVG.
// Usage: node scripts/build-duel-card-art.mjs [veto-h|gett-oh]
//        then node scripts/duel-art-pack.mjs to refresh the transport packs.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { compose, atmosphere } from "./duel-card-art/compose.mjs";

const SIZE = { "veto-h": [576, 384], "gett-oh": [400, 300] };
const QUALITY = 0.9;
const themes = ["veto-h", "gett-oh"].filter((t) => !process.argv[2] || t === process.argv[2]);

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
await page.setContent("<!doctype html><title>render</title>");

async function rasterise(svg, width, height) {
  const url = await page.evaluate(
    async ({ svg, width, height, quality }) => {
      const img = new Image();
      img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL("image/webp", quality);
    },
    { svg, width, height, quality: QUALITY },
  );
  return simpleWebp(Buffer.from(url.split(",")[1], "base64"));
}

// Chromium wraps its lossy frame in a VP8X container with an sRGB ICC chunk.
// Keep only the VP8 frame so every file is a plain, small lossy WebP.
function simpleWebp(bytes) {
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP")
    throw new Error("not a WebP");
  for (let at = 12; at + 8 <= bytes.length;) {
    const tag = bytes.toString("ascii", at, at + 4);
    const size = bytes.readUInt32LE(at + 4);
    if (tag === "VP8 ") {
      const chunk = bytes.subarray(at, at + 8 + size + (size & 1));
      const head = Buffer.alloc(12);
      head.write("RIFF", 0, "ascii");
      head.writeUInt32LE(4 + chunk.length, 4);
      head.write("WEBP", 8, "ascii");
      return Buffer.concat([head, chunk]);
    }
    at += 8 + size + (size & 1);
  }
  throw new Error("expected a lossy VP8 frame");
}

for (const theme of themes) {
  const [width, height] = SIZE[theme];
  const source = JSON.parse(readFileSync(`public/games/${theme}/source-cards.json`, "utf8"));
  mkdirSync(`public/games/${theme}/assets/cards`, { recursive: true });
  const cards = {};
  const seen = new Map();
  const sizes = [];
  for (const card of source) {
    const bytes = await rasterise(compose(theme, card), width, height);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (seen.has(sha256)) throw new Error(`${card.id} duplicates ${seen.get(sha256)}`);
    seen.set(sha256, card.id);
    writeFileSync(`public/games/${theme}/assets/cards/${card.id}.webp`, bytes);
    sizes.push(bytes.length);
    cards[card.id] = {
      path: `/games/${theme}/assets/cards/${card.id}.webp`,
      width,
      height,
      bytes: bytes.length,
      sha256,
      sourceName: card.name,
    };
  }
  const ordered = [...sizes].sort((a, b) => a - b);
  const total = sizes.reduce((a, b) => a + b, 0);
  const summary = {
    coverage: source.length,
    totalBytes: total,
    averageBytes: Math.round(total / sizes.length),
    p95Bytes: ordered[Math.ceil(ordered.length * 0.95) - 1],
    maxBytes: ordered.at(-1),
    duplicateHashes: 0,
    dimensions: [width, height],
    generator: "scripts/duel-card-art/compose.mjs (code-drawn SVG, rasterised to WebP)",
  };
  writeFileSync(
    `public/games/${theme}/assets/art-manifest.json`,
    JSON.stringify({ summary, cards }, null, 2) + "\n",
  );
  const bg = await rasterise(atmosphere(theme), 1600, 900);
  writeFileSync(`public/games/${theme}/assets/atmosphere.webp`, bg);
  console.log(
    `${theme}: ${source.length} cards, ${total.toLocaleString()} bytes; atmosphere ${bg.length} bytes`,
  );
}
await browser.close();
