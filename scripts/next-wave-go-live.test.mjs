import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const games = read("src/lib/games.ts");
const catalogEntries = [
  ...games.matchAll(/\{\s*slug: "([^"]+)",[\s\S]*?status: "(live|soon)",[\s\S]*?\}/g),
].map((match) => ({ slug: match[1], status: match[2] }));

function catalogBlock(slug) {
  const marker = `slug: "${slug}"`;
  const start = games.indexOf(marker);
  assert.notEqual(start, -1, `${slug} must exist in the catalog`);
  const end = games.indexOf("\n  {", start + marker.length);
  return games.slice(start, end === -1 ? games.length : end);
}

test("all five Next Wave games are live and resolve to playable catalog routes", () => {
  for (const slug of ["apartman", "son-100-gun", "kayip-telefon", "tc-sim-devlet"]) {
    const block = catalogBlock(slug);
    assert.match(block, /status: "live"/);
    assert.match(block, new RegExp(`href: "/oyna/${slug}"`));
    assert.ok(existsSync(new URL(`../public/games/${slug}/index.html`, import.meta.url)));
  }

  const html5List = games.slice(
    games.indexOf("export const HTML5_SLUGS"),
    games.indexOf("] as const"),
  );
  for (const slug of ["apartman", "son-100-gun", "kayip-telefon", "tc-sim-devlet"]) {
    assert.match(html5List, new RegExp(`"${slug}"`));
  }
});

test("İhtilâl is live on the HTML5 play route and keeps /ihtilal as a redirect", () => {
  assert.equal((games.match(/status: "soon"/g) ?? []).length, 0);
  assert.match(catalogBlock("jitem-derin-ag"), /status: "live"[\s\S]*?href: "\/oyna\/jitem-derin-ag"/);
  const block = catalogBlock("ihtilal");
  assert.match(block, /status: "live"/);
  assert.match(block, /href: "\/oyna\/ihtilal"/);
  assert.match(
    games.slice(games.indexOf("export const HTML5_SLUGS"), games.indexOf("] as const")),
    /"ihtilal"/,
  );
  assert.ok(existsSync(new URL("../public/games/ihtilal/index.html", import.meta.url)));
  const portal = read("src/components/portal/portal-home.tsx");
  assert.doesNotMatch(portal, /game\.slug === "ihtilal"/);
  assert.match(read("src/routeTree.gen.ts"), /'\/ihtilal'/);
  const route = read("src/routes/ihtilal.tsx");
  assert.match(route, /redirect/);
  assert.match(route, /ihtilal/);
  assert.doesNotMatch(route, /ALTI OK|KIRAT|Kene Yapım|Tunca Zeki Berkkurt/);
});

test("İhtilâl play runtime is original and not a duel-core reskin", () => {
  const app = read("public/games/ihtilal/app.js");
  const engine = read("public/games/ihtilal/engine.js");
  assert.doesNotMatch(app, /startApp\(/);
  assert.doesNotMatch(engine, /startApp\(/);
  assert.doesNotMatch(app + engine, /duel-core/);
  assert.match(engine, /GAME_ID = "ihtilal"/);
  assert.match(read("public/games/ihtilal/index.html"), /app\.js/);
});

test("DARBE-H! is live on the HTML5 play route as a duel-core sibling", () => {
  const block = catalogBlock("darbe-h");
  assert.match(block, /status: "live"/);
  assert.match(block, /href: "\/oyna\/darbe-h"/);
  assert.match(
    games.slice(games.indexOf("export const HTML5_SLUGS"), games.indexOf("] as const")),
    /"darbe-h"/,
  );
  assert.ok(existsSync(new URL("../public/games/darbe-h/index.html", import.meta.url)));
  const app = read("public/games/darbe-h/app.js");
  assert.match(app, /startApp\("darbe-h"/);
  assert.doesNotMatch(app, /startApp\("veto-h"|startApp\("gett-oh"/);
});

test("DEVLET release copy reflects the live multi-period runtime without changing identity", () => {
  const block = catalogBlock("tc-sim-devlet");
  assert.match(block, /title: "TC SIM: DEVLET"/);
  assert.match(block, /status: "live"/);
  assert.match(block, /href: "\/oyna\/tc-sim-devlet"/);
  assert.match(block, /Çok dönemli devlet simülasyonu/);
  assert.match(block, /1923'ten 2030'a/);
  assert.doesNotMatch(block, /2002[–-]05 çekirdeği/);
  assert.doesNotMatch(block, /status: "soon"/);
  assert.doesNotMatch(block, /4000/);

  const i18n = read("src/lib/i18n.ts");
  assert.match(i18n, /"tc-sim-devlet": \{/);
  assert.match(i18n, /A multi-era state simulation/);
  assert.match(i18n, /Institutions, economy and society from 1923 to 2030/);
  assert.doesNotMatch(i18n, /2002[–-]05 core/);
  assert.doesNotMatch(i18n, /Four thousand years of state mind/);

  const staticI18n = read("public/i18n/tlab-i18n.js");
  assert.match(staticI18n, /A multi-era state simulation/);
  assert.doesNotMatch(staticI18n, /2002[–-]05 core/);
  assert.equal(catalogEntries.length, 19);
  assert.equal(catalogEntries.filter((game) => game.status === "live").length, 19);
  assert.deepEqual(catalogEntries.filter((game) => game.status === "soon").map((game) => game.slug), []);
});
