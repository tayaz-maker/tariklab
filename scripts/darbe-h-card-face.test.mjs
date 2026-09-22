import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { buildCards } from "../public/games/duel-core/card-data.js";
import { designs } from "../public/games/darbe-h/designs.js";
import { compose } from "./darbe-h-card-art/compose.mjs";
import { effectSummary, VERB } from "../public/games/darbe-h/card-face.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const ART = "public/games/darbe-h/assets/card-art/";
const source = JSON.parse(read("public/games/darbe-h/source-cards.json"));
const cards = buildCards(source, designs, "darbe-h");
const manifest = JSON.parse(read(`${ART}manifest.json`));
// The existing DARBE-H! palette (design.css); art and faces may use nothing else.
const PALETTE = new Set([
  "121820",
  "1a2433",
  "243044",
  "e8dcc4",
  "d8dde4",
  "c4a574",
  "7a93a8",
  "c17a72",
  "8a6a3a",
  "b7c0c9",
]);

test("every DARBE-H! card has exactly one original illustration", () => {
  const files = readdirSync(new URL(`../${ART}`, import.meta.url)).filter((f) =>
    f.endsWith(".svg"),
  );
  assert.equal(cards.length, 300);
  assert.equal(files.length, 300);
  for (const card of cards) assert.ok(files.includes(`${card.id}.svg`), card.id);
  assert.equal(manifest.summary.coverage, 300);
  assert.equal(
    new Set(Object.values(manifest.cards).map((c) => c.sha256)).size,
    300,
    "no two plates are identical",
  );
});

test("illustrations are rebuilt deterministically from the card data", () => {
  for (const card of cards) {
    const svg = compose(card);
    assert.equal(
      svg,
      read(`${ART}${card.id}.svg`),
      `${card.id} is stale; run node scripts/build-darbe-h-card-art.mjs`,
    );
    assert.equal(createHash("sha256").update(svg).digest("hex"), manifest.cards[card.id].sha256);
  }
});

test("illustrations are small, well-formed and stay inside the palette", () => {
  let total = 0;
  for (const card of cards) {
    const svg = read(`${ART}${card.id}.svg`);
    total += Buffer.byteLength(svg);
    assert.ok(Buffer.byteLength(svg) < 12_000, `${card.id} is too heavy`);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 240 160"/);
    assert.doesNotMatch(
      svg,
      /<(image|script|foreignObject|filter|text)\b/,
      `${card.id} must stay flat vector art`,
    );
    assert.doesNotMatch(
      svg,
      /https?:\/\/(?!www\.w3\.org\/2000\/svg)/,
      `${card.id} must not load anything`,
    );
    for (const tag of svg.match(/<[a-zA-Z][^>]*>/g)) {
      const names = [...tag.matchAll(/\s([a-zA-Z:-]+)="/g)].map((m) => m[1]);
      assert.equal(
        new Set(names).size,
        names.length,
        `${card.id} has a duplicate attribute in ${tag.slice(0, 60)}`,
      );
    }
    assert.equal(
      (svg.match(/<g\b/g) || []).length,
      (svg.match(/<\/g>/g) || []).length,
      `${card.id} groups are balanced`,
    );
    for (const [hex] of svg.matchAll(/#[0-9a-f]{6}/gi))
      assert.ok(PALETTE.has(hex.slice(1, 7).toLowerCase()), `${card.id} uses ${hex}`);
  }
  assert.ok(total < 2_000_000, `art total ${total} bytes`);
});

test("the card face stylesheet only uses the existing DARBE-H! colours", () => {
  const css = read("public/games/darbe-h/card-face.css");
  for (const [hex] of css.matchAll(/#[0-9a-f]{3,8}\b/gi)) {
    const h = hex.slice(1).toLowerCase();
    if (h.length <= 4) assert.match(h, /^000/, `${hex} may only be a shadow`);
    else assert.ok(PALETTE.has(h.slice(0, 6)), `${hex} is not a DARBE-H! token`);
  }
  assert.doesNotMatch(css, /@keyframes|animation:/, "no looping animation on cards");
  assert.match(css, /prefers-reduced-motion/);
  for (const rule of css.split("}")) {
    const selector = rule.split("{")[0].trim();
    if (!selector || selector.startsWith("/*") || selector.startsWith("@")) continue;
    const parts = [];
    let depth = 0;
    let cur = "";
    for (const ch of selector.replace(/\/\*[\s\S]*?\*\//g, "")) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        parts.push(cur);
        cur = "";
      } else cur += ch;
    }
    parts.push(cur);
    for (const part of parts) {
      const s = part.replace(/\/\*[\s\S]*?\*\//g, "").trim();
      if (s && !s.startsWith("@"))
        assert.match(s, /^body\[data-theme="darbe-h"\]/, `unscoped selector: ${s}`);
    }
  }
});

test("only DARBE-H! swaps the card face; the sibling games keep duel-core's", () => {
  const core = read("public/games/duel-core/app.js");
  assert.match(core, /export async function startApp\(theme, designs, options = \{\}\)/);
  assert.match(core, /options\.cardFace\?\.\(\{ card, down, hidden, lang, t, text \}\) \?\? \[/);
  assert.match(
    read("public/games/darbe-h/app.js"),
    /startApp\("darbe-h", designs, \{ cardFace \}\)/,
  );
  for (const theme of ["veto-h", "gett-oh"])
    assert.doesNotMatch(read(`public/games/${theme}/app.js`), /cardFace/);
});

test("every card with an effect gets a readable effect summary", () => {
  for (const card of cards) {
    const { op } = effectSummary(card);
    const hasEffect =
      (card.effects || []).length ||
      (card.triggers || []).length ||
      Object.keys(card.traits || {}).length;
    if (hasEffect) assert.ok(op && VERB[op], `${card.id} ${card.name.tr} has no summary`);
    if (op) assert.equal(VERB[op].length, 2, `${op} needs TR and EN`);
  }
});
