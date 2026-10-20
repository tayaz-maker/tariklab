// HTTP/byte verification only. This is NOT browser or gameplay acceptance.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const origin = new URL(process.argv[2]);
assert.equal(origin.protocol, "https:");
const exact = process.argv.includes("--exact-public");
const source = readFileSync(new URL("../src/lib/games.ts", import.meta.url), "utf8");
const catalog = source.split("export const GAMES:")[1];
const games = [...catalog.matchAll(/slug: "([^"]+)"[\s\S]*?status: "live",\s*href: "([^"]+)"/g)]
  .map((m) => ({ slug: m[1], href: m[2] }));
assert.equal(games.length, 17);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function get(path) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(30000), cache: "no-store", redirect: "manual" });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length > 0, `${path}: empty response`);
  return bytes;
}
const home = (await get("/")).toString();
console.log("HTTP 200 /");
const bundles = [...home.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.js)(?:\?[^" ]*)?"/g)].map((m) => m[1]);
assert.ok(bundles.length > 0, "root has no built JS references");
let catalogOutput = home;
for (const path of new Set(bundles)) {
  const bytes = await get(path);
  assert.doesNotMatch(bytes.toString().slice(0,100), /<!doctype html/i, `JS fallback: ${path}`);
  catalogOutput += bytes.toString();
  if (exact) {
    const local = readFileSync(new URL(`../.output/public${path}`, import.meta.url));
    assert.equal(hash(bytes), hash(local), `built bundle differs: ${path}`);
  }
  console.log(`BUNDLE ${exact ? "EXACT" : "200"} ${path} ${hash(bytes)}`);
}
for (const game of games) {
  assert.ok(catalogOutput.includes(game.href), `catalog missing route ${game.href}`);
  const page = await get(game.href);
  assert.match(page.toString(), /<!doctype html/i, game.href);
  console.log(`HTTP 200 ${game.href}`);
}
const assets = new Set([
  "/sw.js", "/manifest.webmanifest", "/favicon.svg", "/i18n/tlab-i18n.js",
  "/i18n/deep-en-final.js", "/i18n/boot.js", "/games/ihtilal/app.js",
  "/games/ihtilal/copy.js", "/games/ihtilal/save.js", "/games/ihtilal/report.js",
  "/games/ihtilal/style.css", "/games/apartman/app.js", "/games/apartman/presentation.js",
]);
for (const game of games.filter((g) => g.slug !== "cete-savaslari")) assets.add(`/games/${game.slug}/index.html`);
for (const path of assets) {
  const bytes = await get(path);
  if (exact) {
    // sw.js contains the build's hashed precache manifest after Vite emits it.
    const local = readFileSync(new URL(`../${path === "/sw.js" ? ".output/public" : "public"}${path}`, import.meta.url));
    assert.equal(hash(bytes), hash(local), `deployed bytes differ: ${path}`);
  }
  console.log(`${exact ? "EXACT" : "HTTP 200"} ${path} ${hash(bytes)}`);
}
assert.ok(catalogOutput.includes("1923") && catalogOutput.includes("2030"), "catalog missing current DEVLET scope");
assert.doesNotMatch(catalogOutput, /2002[–-]05 (?:core|çekirdeği)/i);
console.log("PASS: root + 18 routes; critical public assets; root bundles; DEVLET catalog scope. Browser acceptance remains separate.");
