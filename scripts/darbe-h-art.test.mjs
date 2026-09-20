import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { cardArt, themeMeta } from "../public/games/duel-core/theme-meta.js";

test("DARBE-H! ships 300 unique crisis-desk SVGs and cardArt points at them", () => {
  const source = JSON.parse(readFileSync("public/games/darbe-h/source-cards.json", "utf8"));
  const manifest = JSON.parse(readFileSync("public/games/darbe-h/assets/art-manifest.json", "utf8"));
  assert.equal(themeMeta("darbe-h").art.kind, "svg");
  assert.equal(Object.keys(manifest.cards).length, 300);
  assert.equal(source.length, 300);
  const diskFiles = readdirSync("public/games/darbe-h/assets/cards")
    .filter((name) => name.endsWith(".svg"))
    .sort();
  const manifestFiles = Object.values(manifest.cards)
    .map((entry) => entry.path.split("/").at(-1))
    .sort();
  assert.equal(diskFiles.length, 300);
  assert.deepEqual(diskFiles, manifestFiles);
  const hashes = new Set();
  let bytes = 0;
  for (const card of source) {
    const art = manifest.cards[card.id];
    assert.ok(art, card.id);
    assert.equal(art.path, `/games/darbe-h/assets/cards/${card.id}.svg`);
    const data = readFileSync(`public${art.path}`);
    assert.match(data.toString("utf8"), /^<svg /);
    assert.match(data.toString("utf8"), /viewBox="0 0 400 560"/);
    const hash = createHash("sha256").update(data).digest("hex");
    assert.equal(hash, art.sha256);
    assert.ok(!hashes.has(hash), card.id);
    hashes.add(hash);
    bytes += data.length;
    const served = cardArt("darbe-h", card);
    assert.equal(served.src, art.path);
    assert.equal(served.width, 400);
    assert.equal(served.height, 560);
  }
  assert.equal(manifest.summary.coverage, 300);
  assert.equal(manifest.summary.totalBytes, bytes);
  assert.equal(manifest.summary.duplicateHashes, 0);

  const app = readFileSync("public/games/duel-core/app.js", "utf8");
  assert.match(app, /onerror:[\s\S]*replaceWith\(document\.createTextNode\("◈"\)\)/);
});
