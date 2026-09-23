import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GAME_CATEGORIES, GAMES } from "../src/lib/games.ts";

test("portal categories partition every live game once and preserve the 19-card catalogue", () => {
  const live = GAMES.filter((game) => game.status === "live");
  const listed = GAME_CATEGORIES.flatMap((category) => category.slugs);

  assert.equal(live.length, 19);
  assert.equal(GAME_CATEGORIES.length, 4);
  assert.equal(new Set(listed).size, 19);
  assert.deepEqual(new Set(listed), new Set(live.map((game) => game.slug)));
});

test("portal category headings have TR fallbacks and EN/PL catalogue translations", () => {
  const source = readFileSync(new URL("../src/lib/i18n.ts", import.meta.url), "utf8");
  const portal = readFileSync(new URL("../src/components/portal/portal-home.tsx", import.meta.url), "utf8");
  for (const id of GAME_CATEGORIES.map((category) => category.id)) {
    assert.equal(source.match(new RegExp(`"portal\\.category\\.${id}":`, "g"))?.length, 2, `${id}: EN and PL`);
    assert.match(portal, new RegExp(`\\b${id}: "`), `${id}: TR fallback`);
  }
  assert.match(portal, /Strateji & Güç/);
  assert.match(source, /Strategy & Power/);
  assert.match(source, /Strategia i władza/);
});

test("portal categories stay balanced: at most 4, none a catch-all", () => {
  const sizes = GAME_CATEGORIES.map((category) => category.slugs.length);
  assert.ok(GAME_CATEGORIES.length <= 4);
  assert.ok(Math.min(...sizes) >= 3, `every shelf has at least 3 games (${sizes})`);
  assert.ok(Math.max(...sizes) <= 7, `no shelf holds more than 7 games (${sizes})`);
  assert.ok(Math.max(...sizes) < 9, "the old 9-game strategy pile-up is gone");
});

test("site theme colour, manifest colours and small icons agree", () => {
  const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  const bg = css.match(/--color-bg:\s*(#[0-9a-f]{6})/i)[1].toLowerCase();
  assert.equal(root.match(/name: "theme-color", content: "(#[0-9a-f]{6})"/i)[1].toLowerCase(), bg);
  assert.equal(manifest.theme_color.toLowerCase(), bg);
  assert.equal(manifest.background_color.toLowerCase(), bg);
  assert.match(root, /href: "\/favicon\.ico"/);
  const ico = readFileSync(new URL("../public/favicon.ico", import.meta.url));
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0], "favicon.ico is an ICO file");
  assert.ok(ico.readUInt16LE(4) >= 2, "favicon.ico carries at least two sizes");
});
