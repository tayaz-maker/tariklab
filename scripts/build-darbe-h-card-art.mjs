// Builds one original illustration per DARBE-H! card into
// public/games/darbe-h/assets/card-art/, plus a manifest the tests read.
// Deterministic: the same card data always produces the same bytes.
// Usage: node scripts/build-darbe-h-card-art.mjs
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { buildCards } from "../public/games/duel-core/card-data.js";
import { designs } from "../public/games/darbe-h/designs.js";
import { compose, primaryOp, bureauOf, W, H } from "./darbe-h-card-art/compose.mjs";

const OUT = new URL("../public/games/darbe-h/assets/card-art/", import.meta.url);
const source = JSON.parse(
  readFileSync(new URL("../public/games/darbe-h/source-cards.json", import.meta.url), "utf8"),
);
const cards = buildCards(source, designs, "darbe-h");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const entries = {};
const hashes = new Map();
let total = 0;
let max = 0;
for (const card of cards) {
  const svg = compose(card);
  const bytes = Buffer.byteLength(svg);
  const sha256 = createHash("sha256").update(svg).digest("hex");
  if (hashes.has(sha256)) throw new Error(`${card.id} duplicates ${hashes.get(sha256)}`);
  hashes.set(sha256, card.id);
  writeFileSync(new URL(`${card.id}.svg`, OUT), svg);
  entries[card.id] = {
    kind: card.kind,
    subtype: card.subtype,
    bureau: card.kind === "trap" ? "ihtar" : bureauOf(card),
    event: primaryOp(card),
    bytes,
    sha256,
  };
  total += bytes;
  max = Math.max(max, bytes);
}
const manifest = {
  summary: {
    coverage: cards.length,
    width: W,
    height: H,
    totalBytes: total,
    averageBytes: Math.round(total / cards.length),
    maxBytes: max,
    duplicateHashes: 0,
  },
  cards: entries,
};
writeFileSync(new URL("manifest.json", OUT), `${JSON.stringify(manifest, null, 1)}\n`);
console.log(manifest.summary);
