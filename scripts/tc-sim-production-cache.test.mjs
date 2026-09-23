import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const game = join(root, "public/games/tc-sim");
const token = "?v=10";

test("production TC SIM loads one coherent, current module graph", () => {
  const html = readFileSync(join(game, "index.html"), "utf8");
  assert.ok(html.includes("styles.css?v=10"));
  assert.ok(html.includes("js/app.js?v=10"));

  for (const name of readdirSync(join(game, "js")).filter((file) => file.endsWith(".js"))) {
    const source = readFileSync(join(game, "js", name), "utf8");
    const imports = [...source.matchAll(/["'](\.\/[^"']+\.js)(\?v=\d+)?["']/g)];
    for (const match of imports)
      assert.equal(match[2], token, `${name}: ${match[1]} must use the production asset token`);
    assert.equal(source.includes(".js?v=5"), false, `${name}: stale production token`);
  }
});

test("service worker never serves a stale module-game asset before the network", () => {
  const source = readFileSync(join(root, "public/sw.js"), "utf8");
  assert.ok(source.includes('const CACHE = "cete-offline-v5"'));
  // TC SIM ve TLab Classics oyunlarinin hepsi native ES module grafigidir;
  // dordu de stale-while-revalidate dalindan ONCE network-first islenmeli.
  for (const prefix of [
    "/games/tc-sim/",
    "/games/labirent/",
    "/games/peg-solitaire/",
    "/games/satranc/",
    "/games/amiral-batti/",
  ]) {
    assert.ok(source.includes(`"${prefix}"`), `${prefix} module-game listesinde olmali`);
  }
  const moduleBranch = source.indexOf("if (isModuleGameAsset(url))");
  const staleBranch = source.indexOf("if (isAsset(url))");
  assert.ok(moduleBranch > 0 && moduleBranch < staleBranch);
  assert.ok(source.slice(moduleBranch, staleBranch).includes("networkFirst(req)"));
});

test("mobile TC SIM navigation remains horizontally usable and tappable", () => {
  const source = readFileSync(join(game, "styles.css"), "utf8");
  const mobile = source.slice(source.indexOf("@media (max-width: 820px)"));
  assert.ok(mobile.includes(".side-nav"));
  assert.ok(mobile.includes("display: flex"));
  assert.ok(mobile.includes("overflow: auto"));
  assert.ok(mobile.includes("min-height: 44px"));
});
