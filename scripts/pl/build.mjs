// Builds public/i18n/pl/<game>.json from the extracted English strings
// (scripts/pl/source/en-strings.json) and the Polish translations
// (scripts/pl/translations/*.json, id -> Polish). A translation is used only
// while its English source is unchanged (ids are hashes of the English text).
// scripts/pl/screen/*.json add text seen on screen that the extractor cannot
// reach (Turkish source shown to every non-Turkish reader, strings assembled
// at runtime): { "<game>" | "*": { "<text or pattern with {0}>": "Polish" } }.
// Usage: node scripts/pl/build.mjs
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const rows = JSON.parse(readFileSync(new URL("scripts/pl/source/en-strings.json", ROOT), "utf8"));
const games = JSON.parse(readFileSync(new URL("scripts/pl/games.json", ROOT), "utf8"));
const dir = new URL("scripts/pl/translations/", ROOT);
const pl = {};
for (const name of readdirSync(dir)
  .filter((n) => n.endsWith(".json"))
  .sort())
  Object.assign(pl, JSON.parse(readFileSync(new URL(name, dir), "utf8")));

const screenDir = new URL("scripts/pl/screen/", ROOT);
const screen = {};
for (const name of readdirSync(screenDir)
  .filter((n) => n.endsWith(".json"))
  .sort())
  for (const [scope, map] of Object.entries(
    JSON.parse(readFileSync(new URL(name, screenDir), "utf8")),
  ))
    Object.assign((screen[scope] ??= {}), map);

mkdirSync(new URL("public/i18n/pl/", ROOT), { recursive: true });
const report = {};
for (const slug of Object.keys(games)) {
  const exact = {};
  const patterns = [];
  let total = 0;
  let done = 0;
  for (const row of rows) {
    if (!row.games.includes(slug)) continue;
    total++;
    const to = pl[row.id];
    if (typeof to !== "string") continue;
    done++;
    if (to === row.en) continue; // names and terms kept as written
    // regex replacement strings ("Day $1") display like patterns ("Day {0}")
    const dollar = /\$(\d)/.test(row.en);
    const slot = (s) => s.replace(/\$(\d)/g, (_, n) => `{${n - 1}}`);
    if (row.pattern || dollar) patterns.push(dollar ? [slot(row.en), slot(to)] : [row.en, to]);
    else exact[row.en] = to;
  }
  let seen = 0;
  for (const [from, to] of Object.entries({ ...screen["*"], ...screen[slug] })) {
    seen++;
    if (/\{\d+#?\}/.test(from)) patterns.push([from, to]);
    else exact[from] = to;
  }
  // longer patterns first so specific sentences win over generic ones
  patterns.sort((a, b) => b[0].length - a[0].length);
  writeFileSync(
    new URL(`public/i18n/pl/${slug}.json`, ROOT),
    JSON.stringify({ exact, patterns }) + "\n",
  );
  report[slug] = { strings: total, translated: done, screen: seen };
}
writeFileSync(new URL("scripts/pl/coverage.json", ROOT), JSON.stringify(report, null, 1) + "\n");
for (const [slug, r] of Object.entries(report))
  console.log(`${slug.padEnd(16)} ${r.translated}/${r.strings}`);
