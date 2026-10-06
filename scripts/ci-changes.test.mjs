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
test("multiple game changes remain conservative", () => {
  assert.equal(
    classifyChanges(["public/games/tc-sim/styles.css", "public/games/hanedanian/style.css"]).full,
    "true",
  );
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
