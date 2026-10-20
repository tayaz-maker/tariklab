import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { classifyChanges } from "./ci-changes.mjs";

test("docs and Markdown evidence do not select game suites", () => {
  const result = classifyChanges([
    "docs/WEB_APP_SYNC_LEDGER.md",
    "docs/evidence/probes/proof.mjs",
    "outputs/noncard-waves/HANDOFF.md",
  ]);
  for (const key of ["full", "browser", "tc", "devlet", "duel", "campaign", "balance"])
    assert.equal(result[key], "false", key);
  assert.equal(result.docs, "true");
});
test("TC CSS keeps responsive and historical validation without unrelated campaigns", () => {
  const result = classifyChanges(["public/games/tc-sim/styles.css", "docs/WEB_APP_SYNC_LEDGER.md"]);
  assert.equal(result.routes, "tc-sim");
  for (const key of ["browser", "tc"]) assert.equal(result[key], "true");
  for (const key of ["full", "docs", "devlet", "duel", "campaign", "balance"])
    assert.equal(result[key], "false", key);
});
test("shared CSS, workflows, dependencies, scripts, unknown output and empty diffs fail closed", () => {
  for (const files of [
    [],
    ["public/games/shared/compact-navigation.css"],
    [".github/workflows/ci.yml"],
    ["scripts/ci-changes.mjs"],
    ["package-lock.json"],
    ["outputs/app.js"],
    ["README.js"],
    ["unknown/file.css"],
  ]) {
    assert.equal(classifyChanges(files).full, "true", JSON.stringify(files));
  }
});
test("mixed docs and runtime files cannot take docs fast path", () => {
  const result = classifyChanges(["README.md", "public/sw.js"]);
  assert.equal(result.docs, "false");
  assert.equal(result.full, "true");
});
test("shared desk CSS selects both actual consumers and no campaign", () => {
  const result = classifyChanges([
    "public/games/shared/management-desk.css",
    "public/games/tc-sim/styles.css",
  ]);
  assert.equal(result.full, "false");
  assert.equal(result.docs, "false");
  assert.equal(result.routes, "tc-sim,tc-sim-devlet");
  for (const key of ["tc", "devlet", "browser"]) assert.equal(result[key], "true");
  for (const key of ["duel", "campaign", "balance"]) assert.equal(result[key], "false");
  const consumers = execFileSync(
    "git",
    ["grep", "-l", "management-desk.css", "--", "public", "src"],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .sort();
  assert.deepEqual(consumers, [
    "public/games/tc-sim-devlet/index.html",
    "public/games/tc-sim/index.html",
  ]);
});

test("owned TC PR scripts keep both relevant desk consumers without unrelated browsers", () => {
  const files = ["public/games/tc-sim/js/social.js", "scripts/tc-sim-promise-reputation.test.mjs",
    "scripts/management-desk.test.mjs", "scripts/tc-sim-job-start-outcome-browser.mjs", "public/i18n/pl/tc-sim.json"];
  const result = classifyChanges(files, { pullRequest: true });
  assert.equal(result.full, "false");
  assert.equal(result.docs, "false");
  assert.equal(result.routes, "tc-sim,tc-sim-devlet");
  for (const key of ["browser", "tc", "devlet"]) assert.equal(result[key], "true");
  for (const key of ["duel", "campaign", "balance"]) assert.equal(result[key], "false");
  assert.equal(classifyChanges(files).full, "false", "main retains the same affected critical coverage");
});

test("shared translations, production helpers and unknown scripts still fail closed on PR", () => {
  for (const path of ["public/i18n/deep-en.js", "public/i18n/pl-body.js", "scripts/ci-readiness.mjs",
    "scripts/unowned.test.mjs", ".github/workflows/ci.yml"])
    assert.equal(classifyChanges(["scripts/tc-sim-promise-reputation.test.mjs", path], { pullRequest: true }).full, "true", path);
});

test('known multi-game changes select the union, unknown shared changes select all',()=>{
  const result=classifyChanges(['public/games/tc-sim/styles.css','public/games/hanedanian/style.css']);
  assert.equal(result.full,'false');
  assert.equal(result.routes,'tc-sim,hanedanian');
  for(const key of ['browser','tc','campaign','balance'])assert.equal(result[key],'true');
  assert.equal(classifyChanges(['public/games/tc-sim/styles.css','scripts/new-shared.mjs']).full,'true');
});
test('duel routes use actual catalog slugs rather than an internal group id',()=>{
  const result=classifyChanges(['public/games/duel-core/engine.js']);
  assert.equal(result.full,'false');
  assert.equal(result.duel,'true');
  assert.equal(result.routes,'veto-h,gett-oh,darbe-h');
});
test('hosting-only changes retain common unit guards without unrelated game browsers',()=>{
  const result=classifyChanges(['wrangler.json','scripts/cloudflare-deploy.mjs']);
  assert.equal(result.docs,'false');
  assert.equal(result.full,'false');
  assert.equal(result.browser,'false');
});
