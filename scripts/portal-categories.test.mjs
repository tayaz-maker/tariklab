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
  for (const id of ["strategy", "dossier", "duel", "classic"]) {
    assert.match(source, new RegExp(`"portal\\.category\\.${id}":`));
  }
  assert.match(portal, /Yönetim & Strateji/);
  assert.match(source, /Management & Strategy/);
  assert.match(source, /Zarządzanie i strategia/);
});
