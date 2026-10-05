import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { duelScenarios } from "./duel-browser-scenarios.mjs";
import { duelLegacyArtProof } from "./duel-legacy-art-proof.mjs";
import { assertSameOrigin } from "./duel-origin-proof.mjs";

const hosts = [
  { label: "www", origin: "https://www.tariklab.com" },
  { label: "workers", origin: "https://tariklab.tayaz29.workers.dev" },
];
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
async function verifyAssets(origin) {
  let mismatch = paths;
  // Each deployment must serve this revision's bytes before its browser proof.
  for (let attempt = 0; attempt < 60; attempt++) {
    mismatch = [];
    for (const path of paths) {
      let response;
      try {
        response = await fetch(`${origin}/${path}`, {
          signal: AbortSignal.timeout(10000),
          cache: "no-store",
        });
      } catch {
        mismatch.push(path);
        continue;
      }
      // A different deployment is not a retryable missing asset or valid host proof.
      assertSameOrigin(response.url, origin, `asset ${path}`);
      try {
        if (!response.ok || hash(Buffer.from(await response.arrayBuffer())) !== expected.get(path))
          mismatch.push(path);
      } catch {
        mismatch.push(path);
      }
    }
    if (!mismatch.length) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  assert.deepEqual(mismatch, [], `${origin} must serve accepted game/art manifests before smoke`);
}
const out = `${process.env.RUNNER_TEMP || "/workspace"}/screenshots/duel-production`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox"],
});
const evidence = [];
try {
  for (const { label, origin } of hosts) {
    await verifyAssets(origin);
    const hostOut = `${out}/${label}`;
    mkdirSync(hostOut, { recursive: true });
    const restored = [];
    for (const theme of ["veto-h", "gett-oh"])
      restored.push(await duelLegacyArtProof(browser, origin, theme, hostOut));
    await duelScenarios(browser, origin);
    const result = {
      sha: process.env.GITHUB_SHA,
      label,
      origin,
      assets: Object.fromEntries(expected),
      evidence: restored,
    };
    writeFileSync(`${hostOut}/results.json`, JSON.stringify(result, null, 2));
    evidence.push(result);
    console.log("DUEL_PRODUCTION_HOST_PASS", label, JSON.stringify(restored));
  }
  writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      { sha: process.env.GITHUB_SHA, hosts: evidence },
      null,
      2,
    ),
  );
  console.log("DUEL_PRODUCTION_PASS", JSON.stringify(evidence));
} finally {
  await browser.close();
}
