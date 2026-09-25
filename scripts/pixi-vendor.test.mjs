// The vendored PixiJS bundle (public/vendor/pixi/) must be the exact,
// unmodified, official build at the version pinned in package.json --
// never hand-edited, never fetched from a CDN at runtime, never silently
// stale after a version bump. This test is the enforcement.
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");

const PINNED_VERSION = JSON.parse(read("package.json")).dependencies["pixi.js"];
const VENDOR_PATH = `public/vendor/pixi/pixi-${PINNED_VERSION}.min.mjs`;
const ADAPTER_SRC = read("public/games/shared/pixi-adapter.js");

test("package.json pins an exact PixiJS version (no ^ or ~ range)", () => {
  assert.match(PINNED_VERSION, /^\d+\.\d+\.\d+$/, `pixi.js version "${PINNED_VERSION}" is not exact-pinned`);
});

test("the shared adapter's vendor URL and version constant match the pinned version", () => {
  assert.match(ADAPTER_SRC, new RegExp(`PIXI_VERSION = "${PINNED_VERSION}"`));
  assert.match(ADAPTER_SRC, new RegExp(`/vendor/pixi/pixi-${PINNED_VERSION}\\.min\\.mjs`));
});

test("the vendored bundle exists at the pinned version's path and is byte-identical to node_modules/pixi.js's own prebuilt file", () => {
  const vendored = read(VENDOR_PATH);
  const upstream = read(`node_modules/pixi.js/dist/pixi.min.mjs`);
  const upstreamPkg = JSON.parse(read("node_modules/pixi.js/package.json"));
  assert.equal(upstreamPkg.version, PINNED_VERSION, "node_modules/pixi.js version drifted from package.json");
  assert.equal(upstreamPkg.license, "MIT");
  const sha = (s) => createHash("sha256").update(s).digest("hex");
  assert.equal(
    sha(vendored),
    sha(upstream),
    "public/vendor/pixi/*.min.mjs is not byte-identical to the official pixi.js build -- never hand-edit the vendored file, re-copy it from node_modules/pixi.js/dist/pixi.min.mjs after a version bump",
  );
});

test("the vendored bundle carries its own MIT license header and no CDN/remote reference", () => {
  const vendored = read(VENDOR_PATH);
  assert.match(vendored, /PixiJS/);
  assert.match(vendored, /MIT License/);
  // The only "http" strings allowed are the license header's plain-text
  // opensource.org mention and PixiJS's own internal string literals (asset
  // loader format checks, error messages) -- none of those are a
  // module import or fetch target baked into the bundle.
  assert.doesNotMatch(vendored, /\bimport\s*\(\s*["']https?:/);
  assert.doesNotMatch(vendored, /\bfrom\s*["']https?:\/\//);
});

test("docs/ip/client-packages.json lists pixi.js, so the notices generator carries its license", () => {
  const { packages } = JSON.parse(read("docs/ip/client-packages.json"));
  assert.ok(packages.includes("pixi.js"));
});

test("THIRD_PARTY_NOTICES.md has an up-to-date pixi.js entry", () => {
  const notices = read("docs/ip/THIRD_PARTY_NOTICES.md");
  const row = notices.match(/^\| pixi\.js \| ([^|]+) \| ([^|]+) \|$/m);
  assert.ok(row, "pixi.js missing from THIRD_PARTY_NOTICES.md");
  assert.equal(row[1].trim(), PINNED_VERSION);
  assert.equal(row[2].trim(), "MIT");
});

test("credits.html and its EN/PL translations report a package count and license breakdown that match THIRD_PARTY_NOTICES.md exactly", () => {
  const notices = read("docs/ip/THIRD_PARTY_NOTICES.md");
  const order0 = ["MIT", "Apache-2.0", "ISC", "0BSD"];
  const rows = [...notices.matchAll(/^\| [^|]+ \| [^|]+ \| ([^|]+) \|$/gm)]
    .map((m) => m[1].trim())
    .filter((license) => order0.includes(license)); // drop the table's own header row
  const counts = {};
  for (const license of rows) counts[license] = (counts[license] || 0) + 1;
  const total = rows.length;
  const order = ["MIT", "Apache-2.0", "ISC", "0BSD"];
  for (const l of order) assert.ok(l in counts, `expected a ${l} package (breakdown text assumes one)`);
  const summary = order.map((l) => `${counts[l]} ${l}`).join(", ");

  const html = read("public/credits.html");
  assert.match(html, new RegExp(`data-licenses="${total}"`));
  assert.match(html, new RegExp(`Tarayıcıya giden ${total} paketin lisansı doğrulandı: ${summary}\\.`));

  const i18n = read("public/i18n/tlab-i18n.js");
  assert.match(i18n, new RegExp(`The ${total} packages shipped to the browser have verified licences: ${summary}\\.`));
  assert.ok(
    i18n.includes(`${total} pakietów wysyłanych do przeglądarki ma potwierdzone licencje: ${summary}.`),
    "Polish package count/breakdown text out of sync with THIRD_PARTY_NOTICES.md",
  );
});

test("credits.html and its translations name PixiJS as the map render infrastructure, with the pinned version", () => {
  const html = read("public/credits.html");
  const i18n = read("public/i18n/tlab-i18n.js");
  for (const src of [html, i18n]) {
    assert.match(src, /PixiJS/);
    assert.match(src, new RegExp(PINNED_VERSION.replace(/\./g, "\\.")));
  }
  assert.match(html, /WebGL/);
});
