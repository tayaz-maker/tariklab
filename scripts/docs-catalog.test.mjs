import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GAMES } from "../src/lib/games.ts";

const root = new URL("../", import.meta.url).pathname;
const read = (relative) => readFileSync(join(root, relative), "utf8");

const games = GAMES.filter((game) => game.status === "live" || game.status === "soon");

test("every catalog entry maps to a docs README", () => {
  assert.ok(games.length > 0, "catalog parse must find at least one game");
  const readme = read("docs/README.md");
  for (const game of games) {
    const lineMatch = readme
      .split("\n")
      .find((line) => line.includes(`\`${game.slug}\``));
    assert.ok(lineMatch, `docs/README.md is missing a row for catalog slug "${game.slug}"`);
    const linkTargets = [...lineMatch.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
    assert.ok(
      linkTargets.length > 0,
      `docs/README.md row for "${game.slug}" has no docs link`,
    );
    const resolvable = linkTargets.some((target) =>
      existsSync(join(root, "docs", target)),
    );
    assert.ok(
      resolvable,
      `docs/README.md row for "${game.slug}" links to a docs path that does not exist: ${linkTargets.join(", ")}`,
    );
  }
});

test("docs/README.md has no broken relative markdown links", () => {
  const readme = read("docs/README.md");
  const links = [...readme.matchAll(/\]\(([^):#]+\.md)\)/g)].map((m) => m[1]);
  assert.ok(links.length > 0, "expected docs/README.md to contain markdown links");
  for (const link of links) {
    const resolved = join(root, "docs", link);
    assert.ok(existsSync(resolved), `broken link in docs/README.md: ${link}`);
  }
});

test("retired games are not listed as live or coming soon", () => {
  const slugs = games.map((g) => g.slug);
  assert.ok(!slugs.includes("hayat"), "hayat must not be a live/coming-soon catalog entry");
  const readme = read("docs/README.md");
  assert.match(readme, /## Retired \/ Archived/);
  assert.match(readme, /Hayat/);
  assert.ok(existsSync(join(root, "docs/archive/HAYAT_RETIREMENT.md")));
});

test("the shared duel engine has exactly one canonical doc location", () => {
  assert.ok(existsSync(join(root, "docs/duel/DUEL_ENGINE.md")));
  assert.ok(!existsSync(join(root, "docs/duel-implementation.md")));
});
