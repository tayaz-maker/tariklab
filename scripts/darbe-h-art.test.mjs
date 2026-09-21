import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { cardArt, themeMeta } from "../public/games/duel-core/theme-meta.js";

function seriesKey(raw) {
  if (!raw) return "Dosya";
  if (raw.includes("—")) return raw.split("—").at(-1).trim();
  return raw.trim();
}

function wellPayload(svg) {
  const start = svg.indexOf("data-series=");
  const end = svg.indexOf("<!--well-end-->");
  return start >= 0 && end >= 0 ? svg.slice(start, end) : svg;
}

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
  const wells = new Set();
  let bytes = 0;
  for (const card of source) {
    const art = manifest.cards[card.id];
    assert.ok(art, card.id);
    assert.equal(art.path, `/games/darbe-h/assets/cards/${card.id}.svg`);
    const data = readFileSync(`public${art.path}`);
    const svg = data.toString("utf8");
    assert.match(svg, /^<svg /);
    assert.match(svg, /viewBox="0 0 400 560"/);
    assert.match(svg, new RegExp(`data-series="${seriesKey(card.series)}"`));
    assert.match(svg, new RegExp(`data-kind="${card.kind}"`));
    const hash = createHash("sha256").update(data).digest("hex");
    assert.equal(hash, art.sha256);
    assert.ok(!hashes.has(hash), card.id);
    hashes.add(hash);
    const well = createHash("sha256").update(wellPayload(svg)).digest("hex");
    assert.ok(!wells.has(well), `duplicate art well: ${card.id}`);
    wells.add(well);
    bytes += data.length;
    const served = cardArt("darbe-h", card);
    assert.equal(served.src, art.path);
    assert.equal(served.width, 400);
    assert.equal(served.height, 560);
  }
  assert.equal(manifest.summary.coverage, 300);
  assert.equal(manifest.summary.totalBytes, bytes);
  assert.equal(manifest.summary.duplicateHashes, 0);
  assert.equal(wells.size, 300);

  const app = readFileSync("public/games/duel-core/app.js", "utf8");
  assert.match(app, /onerror:[\s\S]*replaceWith\(document\.createTextNode\("◈"\)\)/);
  assert.match(app, /loading:\s*"lazy"/);
});

test("DARBE-H! series families are authored collages, not one recolored template", () => {
  const source = JSON.parse(readFileSync("public/games/darbe-h/source-cards.json", "utf8"));
  const bySeries = new Map();
  for (const card of source) {
    const key = seriesKey(card.series);
    if (!bySeries.has(key)) bySeries.set(key, card);
  }
  const markers = {
    Dosya: /DOSYA|KAYIT|GİZLİ/,
    Telex: /TELEX|ONAY/,
    Karargah: /KRİZ|KARAR/,
    Heyet: /HEYET|TUTANAK|OY/,
    Kabine: /KABİNE|BAKAN|KARAR/,
    Paraf: /PARAF|ONAY/,
    Brifing: /BRİF|NOT/,
    Arsiv: /ARŞİV|KAYIT/,
    Muhtira: /MUHTIRA/,
    Tebligat: /TEBLİĞ|SEVK/,
    Zeyil: /ZEYİL/,
    Mesruiyet: /MÜHÜR|KANUN|RESMÎ/,
    İhtar: /İHTAR|ACİL/,
  };
  for (const [series, card] of bySeries) {
    const svg = readFileSync(`public/games/darbe-h/assets/cards/${card.id}.svg`, "utf8");
    const token = markers[series] || markers.Dosya;
    assert.match(svg, token, `${series} ${card.id} missing family motif`);
    assert.match(svg, /data-series="/);
  }
  assert.ok(bySeries.size >= 12, `expected 12+ series, got ${bySeries.size}`);

  const generator = readFileSync("scripts/build-darbe-h-art.py", "utf8");
  assert.match(generator, /def paint_dosya/);
  assert.match(generator, /def paint_telex/);
  assert.match(generator, /def paint_karargah/);
  assert.match(generator, /def paint_paraf/);
  assert.match(generator, /def paint_arsiv/);
  assert.doesNotMatch(generator, /motif\(kind, cx=200, cy=250\)/);
});
