import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("interactive-language coverage names all 18 live games", async () => {
  const report = JSON.parse(await read("docs/INTERACTIVE_LANGUAGE_I18N_COVERAGE.json"));
  assert.equal(report.games.length, 18);
  assert.equal(new Set(report.games.map((game) => game.id)).size, 18);
  assert.ok(report.games.every((game) => game.tr === "complete" && game.en === "complete"));
  assert.equal(report.surfaces.portal, "complete");
  assert.equal(report.surfaces.resources, "complete");
});

test("current action-economy copy replaces retired hard caps", async () => {
  const files = await Promise.all([
    read("public/i18n/tlab-i18n.js"),
    read("public/credits.html"),
    read("public/games/apartman/app.js"),
    read("public/games/tc-sim-devlet/presentation.js"),
  ]);
  const copy = files.join("\n");
  for (const stale of ["Two actions a day", "Two decisions a month", "Each week you have 2 decisions", "currently plays in Turkish", "politika kotasını", "Keep one building running"]) {
    assert.equal(copy.includes(stale), false, `stale production copy: ${stale}`);
  }
  for (const current of ["six time-and-focus blocks", "governing capacity", "two, four or ten-block", "18 live games support Turkish and English"]) {
    assert.ok(copy.toLowerCase().includes(current.toLowerCase()), `missing current mechanic copy: ${current}`);
  }
});

test("HANEDANIAN language layer is presentational and preserves hidden information", async () => {
  const [app, i18n] = await Promise.all([
    read("public/games/hanedanian/app.js"),
    read("public/games/hanedanian/i18n.js"),
  ]);
  assert.match(app, /installLanguage\(\)/);
  assert.doesNotMatch(i18n, /localStorage\.setItem|dispatch\(|Math\.random/);
  assert.match(i18n, /"Gizli": "Unknown"/);
  assert.match(i18n, /"Bilinmiyor": "Unknown"/);
});

test("Resources preserves sealed JITEM teaser and personal note in both languages", async () => {
  const [credits, globalI18n] = await Promise.all([
    read("public/credits.html"),
    read("public/i18n/tlab-i18n.js"),
  ]);
  assert.match(credits, /Tarık, annesinin oğludur\./);
  assert.match(globalI18n, /Tarık is his mother's son\./);
  assert.match(credits, /1986–1996\. Dosyalar susmaz\. Ağ büyür\./);
  assert.match(globalI18n, /1986–1996\. Files don't stay buried\. The network grows\./);
  assert.doesNotMatch(credits, /data-game="jitem-derin-ag"[^>]*data-route=/);
});
