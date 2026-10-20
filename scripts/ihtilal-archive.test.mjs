import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import vm from "node:vm";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("archive removes the live listings in all three resource languages, preserving both archived games", () => {
  const credits = read("public/credits.html");
  assert.doesNotMatch(credits, /data-game="ihtilal"|href="\/oyna\/ihtilal"/);
  assert.doesNotMatch(credits, /data-game="esik"|href="\/oyna\/esik"/);
  assert.match(credits, /data-live-count="16" data-soon-count="0"/);
  const sandbox = { localStorage: { getItem: () => "en" } };
  vm.runInNewContext(read("public/i18n/tlab-i18n.js"), sandbox);
  for (const key of ["CREDITS_EN", "CREDITS_PL"]) {
    const items = sandbox.tlabI18n[key].sections[0].items;
    assert.equal(items.length, 16);
    assert.ok(items.every(item => !item.includes("/oyna/ihtilal")));
    assert.ok(items.every(item => !item.includes("/oyna/esik")));
  }
});

test("the archived shell remains routable but is absent from active and soon navigation", () => {
  const games = read("src/lib/games.ts");
  assert.match(games, /slug: "ihtilal",[^}]*status: "archived",[^}]*href: "\/oyna\/ihtilal"/);
  const portal = read("src/components/portal/portal-home.tsx");
  assert.match(portal, /const active = GAMES.filter\(\(g\) => g.status === "live"\)/);
  assert.match(portal, /const soon = GAMES.filter\(\(g\) => g.status === "soon"\)/);
  assert.doesNotMatch(read("public/sitemap.xml"), /\/ihtilal</);
  const shell = read("src/routes/oyna.$slug.tsx");
  assert.match(shell, /data-game-archive/);
  assert.match(shell, /noindex, follow/);
  for (const text of ["Arşiv sürümü.", "Archived version.", "Wersja archiwalna."]) assert.ok(shell.includes(text));
});

test("archive retains original game, card engine, shared assets, localizations and unrelated game bytes", () => {
  const manifest = JSON.parse(read("docs/ihtilal/ARCHIVE_MANIFEST_2026-10-20.json"));
  assert.match(manifest.preRetirementSha, /^[a-f0-9]{40}$/);
  assert.equal(manifest.archiveRef, "archive/ihtilal-pre-retirement-20261020");
  assert.equal(manifest.status, "ARCHIVE_REFERENCE_VERIFIED");
  assert.equal(manifest.archiveReference.verifiedSha, manifest.preRetirementSha);
  assert.equal(manifest.productAcceptance.status, "PASS");
  assert.equal(manifest.productAcceptance.source, manifest.jitem.standaloneSha);
  assert.equal(manifest.productAcceptance.runtimeSha256, manifest.jitem.runtimeSha256);
  for (const origin of ["https://www.tariklab.com", "https://tariklab.tayaz29.workers.dev"]) {
    assert.equal(manifest.productAcceptance.origins[origin].chromiumCases, 72);
    assert.equal(manifest.productAcceptance.origins[origin].manifestFiles, 31);
    assert.ok(Number.isInteger(manifest.productAcceptance.origins[origin].artifact));
  }
  assert.ok(manifest.retainedFiles.some(file => file.path === "public/games/ihtilal/engine.js"));
  assert.ok(manifest.retainedFiles.some(file => file.path === "public/games/ihtilal/solo.js"));
  for (const { path, sha256 } of manifest.retainedFiles) {
    const actual = createHash("sha256").update(readFileSync(new URL(`../${path}`, import.meta.url))).digest("hex");
    let expected = sha256;
    if (path === "public/games/racon/index.html") {
      // The unrelated Racon baseline remains in the named archive. Its separately
      // reviewed evolution keeps a strict current hash without rewriting that snapshot.
      const continuity = JSON.parse(read("docs/racon/IHTILAL_ARCHIVE_CONTINUITY_2026-10-20.json"));
      assert.equal(continuity.sourceArchiveRef, manifest.archiveRef);
      assert.equal(continuity.sourceArchiveSha, manifest.preRetirementSha);
      assert.equal(continuity.path, path);
      assert.equal(continuity.originalSha256, sha256);
      assert.match(continuity.currentSha256, /^[a-f0-9]{64}$/);
      expected = continuity.currentSha256;
    }
    assert.equal(actual, expected, path);
  }
});
