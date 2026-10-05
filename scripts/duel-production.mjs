import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { duelScenarios } from "./duel-browser-scenarios.mjs";
import { duelLegacyArtProof } from "./duel-legacy-art-proof.mjs";

const origin = "https://www.tariklab.com";
const hash = (data) => createHash("sha256").update(data).digest("hex");
const paths = [
  "games/duel-core/app.js",
  "games/duel-core/presentation.js",
  "games/duel-core/table.css",
  ...["veto-h", "gett-oh"].flatMap((theme) => [
    `games/${theme}/source-cards.json`,
    `games/${theme}/expansion.js`,
    `games/${theme}/assets/art-manifest.json`,
    `games/${theme}/assets/atmosphere.webp`,
  ]),
];
const expected = new Map(paths.map((path) => [path, hash(readFileSync(`public/${path}`))]));
let mismatch = paths;
// Deployment runs independently of Actions; wait for this exact revision's bytes.
for (let attempt = 0; attempt < 60; attempt++) {
  mismatch = [];
  for (const path of paths) {
    try {
      const response = await fetch(`${origin}/${path}`, {
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      if (!response.ok || hash(Buffer.from(await response.arrayBuffer())) !== expected.get(path))
        mismatch.push(path);
    } catch {
      mismatch.push(path);
    }
  }
  if (!mismatch.length) break;
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
assert.deepEqual(mismatch, [], "Production must serve accepted game/art manifests before smoke");
const out = `${process.env.RUNNER_TEMP || "/workspace"}/screenshots/duel-production`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox"],
});
const evidence = [];
try {
  for (const theme of ["veto-h", "gett-oh"])
    evidence.push(await duelLegacyArtProof(browser, origin, theme, out));
  await duelScenarios(browser, origin);
  writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      { sha: process.env.GITHUB_SHA, assets: Object.fromEntries(expected), evidence },
      null,
      2,
    ),
  );
  console.log("DUEL_PRODUCTION_PASS", JSON.stringify(evidence));
} finally {
  await browser.close();
}
