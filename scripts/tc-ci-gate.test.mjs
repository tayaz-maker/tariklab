import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { requireTCNeeds } from "./tc-ci-gate.mjs";
const yaml = createRequire(import.meta.url)("js-yaml");
const workflow = () => yaml.load(readFileSync(new URL("../.github/workflows/tc-job-start-outcome.yml", import.meta.url), "utf8"));
const success = () => Object.fromEntries(["prepare", "unit", "browser"].map(id => [id, { result: "success" }]));
test("TC final gate rejects failed, skipped, cancelled, missing and malformed dependencies", () => {
  assert.equal(requireTCNeeds(success()), true);
  for (const id of ["prepare", "unit", "browser"]) {
    for (const result of ["failure", "skipped", "cancelled", "pending", undefined])
      assert.throws(() => requireTCNeeds({ ...success(), [id]: { result } }));
    const missing = success(); delete missing[id]; assert.throws(() => requireTCNeeds(missing));
  }
  for (const invalid of [null, [], {}, "success"]) assert.throws(() => requireTCNeeds(invalid));
  assert.throws(() => requireTCNeeds({ ...success(), unexpected: { result: "failure" } }));
});
// Captured from released a5ac07a1 before changing scheduling. These hashes bind
// every existing test invocation and both immutable baseline fetches, not timing.
const originalChecks = [
  [
    "Fetch the exact TC static baseline",
    "73e58689a69e24ee1dee0d13d091dc74138e50009cc638e2192fa162983bdab5"
  ],
  [
    "Pinned archive, import closure and fail-closed regressions",
    "6493d6898f6ee832e286a2656fdbe664e55085d1a8291f42f2f617d288b5f1ed"
  ],
  [
    "Targeted outcome, origin and safe-server regressions",
    "a7f2ed179d5fef38627e4994462914e9aa26e5a5416c6753226b431b6a4354d0"
  ],
  [
    "TC SIM 2.0 banking — migration, conservation, arrears and estate",
    "1064d428c0912dde4f9cfcdc009b039b6a20500ac443b184b3f1c07658c359be"
  ],
  [
    "Same-browser cold static baseline and candidate comparison",
    "ced191d82768923e460e8a6eb6819b0155301a4624be91c419768819dec3ec44"
  ],
  [
    "Built candidate — 18 matrix cases and 4 mobile hidden-panel regressions",
    "021c6a813d7750153905bc30785e5e9780abd723ce6cddf03bc888cd7d4b7c5f"
  ],
  [
    "TC SIM 2.0 navigation, preferences and status",
    "14ce15c02522ec2b04a1c4413606de148953084cb086294edab9cb4307acb87a"
  ],
  [
    "TC SIM 2 regions — 23 destinations, four viewports and three languages",
    "019d2b2595c1aac7de7722d1978ad65cdf016c9a688786e33b783ce5b40b9539"
  ],
  [
    "Built banking — 12 language and viewport cases with exact assets",
    "4d191fc20d8f5dea3328a3faf681fd44260d7411da8b81496bb14c997e950b81"
  ],
  [
    "Mobile final — five viewports, all menus and gameplay controls",
    "dd7af324c2c31a4152a6838d6d9f676ad1d9b02c742ac344a5be556959272d03"
  ]
];
test("parallel TC groups retain every released test command without changing its assertions or arguments", () => {
  const w = workflow(), steps = Object.values(w.jobs).flatMap(job => job.steps);
  for (const [name, hash] of originalChecks) {
    const matches = steps.filter(step => step.name === name);
    assert.equal(matches.length, name === "Fetch the exact TC static baseline" ? 2 : 1, name);
    for (const step of matches)
      assert.equal(createHash("sha256").update(step.run.trim()).digest("hex"), hash, name);
  }
  assert.deepEqual(w.jobs.browser.strategy.matrix.suite, ["performance", "interface", "banking-mobile"]);
  for (const step of w.jobs.browser.steps.filter(step => originalChecks.some(([name]) => name === step.name)))
    assert.match(step.if, /matrix\.suite == '(performance|interface|banking-mobile)'/);
});
test("protected TC check is an unconditional all-dependency gate and every browser uses the same exact build", () => {
  const w = workflow(), gate = w.jobs["outcome-browser"];
  assert.deepEqual(w.on.push, { branches: ["main"] });
  assert.equal(gate.name, "TC job-start / built");
  assert.equal(gate.if, "always()");
  assert.deepEqual(gate.needs, ["prepare", "unit", "browser"]);
  assert.equal(gate.steps.at(-1).run, "node scripts/tc-ci-gate.mjs");
  assert.equal(w.jobs.browser.strategy["fail-fast"], false);
  const upload = w.jobs.prepare.steps.find(step => step.uses?.startsWith("actions/upload-artifact@"));
  const download = w.jobs.browser.steps.find(step => step.uses?.startsWith("actions/download-artifact@"));
  assert.equal(upload.with.name, download.with.name);
  const restore = w.jobs.browser.steps.find(step => step.name === "Restore and verify exact same-run candidate");
  assert.ok(restore.run.includes('test "$(cat .tc-build-sha)" = "$(git rev-parse HEAD)"'));
  for (const job of Object.values(w.jobs)) {
    assert.ok(!job["continue-on-error"]);
    for (const step of job.steps) assert.ok(!step["continue-on-error"]);
  }
});
