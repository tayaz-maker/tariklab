import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  workloads,
  distribute,
  verifyCoverage,
  verifyOriginalBoardworldTests,
} from "./ci-parallel.mjs";
import { splitBoardworldCases } from "./boardworld-ci-cases.mjs";
import { requireAllWorkers } from "./boardworld-ci-gate.mjs";
import { validateRequiredNeeds } from "./ci-required-gate.mjs";

const files = readdirSync("scripts").filter((f) => f.endsWith(".test.mjs"));
const yaml = createRequire(import.meta.url)("js-yaml");
const workflow = (name) =>
  yaml.load(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8"));
const sha = "a".repeat(40);

test("parallel unit planning preserves every file and each independent endurance case exactly once", () => {
  const general = workloads(files, { scope: "general" });
  const isolated = workloads(files, { scope: "isolated" });
  assert.deepEqual(
    [...new Set([...general, ...isolated].map((t) => t.file))].sort(),
    [...files].sort(),
  );
  assert.deepEqual(
    isolated.map((t) => t.file),
    ["social-engine-core.test.mjs"],
  );
  for (const scope of ["general", "boardworld"]) {
    const tasks = workloads(files, { scope });
    const bins = distribute(tasks, 4);
    const actual = bins.flatMap((bin) => bin.tasks.map((t) => t.id));
    assert.equal(new Set(actual).size, actual.length);
    assert.deepEqual(actual.sort(), tasks.map((t) => t.id).sort());
    for (const file of [
      "boardworld-gold-acceptance.test.mjs",
      "boardworld-emergent-acceptance.test.mjs",
    ])
      assert.deepEqual(
        tasks.filter((t) => t.file === file),
        splitBoardworldCases(file),
      );
    assert.ok(
      bins.every((b) => b.tasks.some((t) => t.id.startsWith("gold:"))),
      "heavy cases are spread over every worker",
    );
  }
  assert.throws(() => workloads(files, { scope: "typo" }));
  assert.throws(() => distribute([], 0));
});

test("coverage refuses missing, duplicate, stale, failed or zero-test receipts", () => {
  const tasks = [{ id: "a" }, { id: "b" }];
  const receipts = tasks.map((task, shard) => ({
    sha,
    shard,
    ok: true,
    results: [{ id: task.id, ok: true, tests: 1, passed: 1, failed: 0, cancelled: 0 }],
  }));
  assert.deepEqual(verifyCoverage(receipts, tasks, 2, sha), { tasks: 2, tests: 2 });
  for (const mutate of [
    (r) => r.pop(),
    (r) => r.push(r[0]),
    (r) => (r[0].sha = "b".repeat(40)),
    (r) => (r[0].ok = false),
    (r) => (r[0].results[0].id = "unknown"),
    (r) => (r[0].results[0].tests = 0),
    (r) => (r[0].results[0].failed = 1),
    (r) => (r[0].results[0].cancelled = 1),
    (r) => (r[1].results[0].id = "a"),
  ]) {
    const changed = structuredClone(receipts);
    mutate(changed);
    assert.throws(() => verifyCoverage(changed, tasks, 2, sha));
  }
});

test("all 730 originally executed tests are mandatory even when new tests increase the total", () => {
  const baseline = JSON.parse(
    readFileSync(new URL("./boardworld-ci-baseline.json", import.meta.url), "utf8"),
  );
  assert.equal(baseline.source, "a5ac07a1eca1928593e401a160ace830f65bc6a5");
  const receipts = [{ results: [{ passedNames: [...baseline.tests, "new test"] }] }];
  verifyOriginalBoardworldTests(receipts, baseline);
  receipts[0].results[0].passedNames[0] = "different new test";
  assert.throws(() => verifyOriginalBoardworldTests(receipts, baseline), /missing or duplicated/);
  receipts[0].results[0].passedNames = [...baseline.tests, baseline.tests[0]];
  assert.throws(() => verifyOriginalBoardworldTests(receipts, baseline), /missing or duplicated/);
});

test("required Boardworld aggregate rejects every missing or unsuccessful worker", () => {
  const needs = {
    bundle: { result: "success" },
    unit: { result: "success" },
    browser: { result: "success" },
  };
  assert.equal(requireAllWorkers(needs), true);
  for (const name of Object.keys(needs)) {
    for (const result of ["failure", "cancelled", "skipped", "pending", undefined])
      assert.throws(() => requireAllWorkers({ ...needs, [name]: { result } }));
    const missing = { ...needs };
    delete missing[name];
    assert.throws(() => requireAllWorkers(missing));
  }
  assert.throws(() => requireAllWorkers({ ...needs, unknown: { result: "success" } }));
  const general = Object.fromEntries(
    [
      "changes",
      "build-core",
      "browser-regression",
      "campaign-browser",
      "campaign-balance",
      "unit",
      "isolated-unit",
      "unit-coverage",
    ].map((name) => [name, { result: "success" }]),
  );
  assert.equal(validateRequiredNeeds(general, ["isolated-unit", "unit-coverage"]), true);
  for (const name of ["isolated-unit", "unit-coverage"]) {
    const missing = { ...general };
    delete missing[name];
    assert.throws(() => validateRequiredNeeds(missing, ["isolated-unit", "unit-coverage"]));
  }
});

test("same-run sealed assets and every pre-existing browser command remain mandatory", () => {
  const bw = workflow("boardworld-quality");
  assert.deepEqual(bw.on, { pull_request: null, push: { branches: ["main"] } });
  assert.equal(bw.jobs.boardworld.if, "${{ always() }}");
  assert.deepEqual(bw.jobs.boardworld.needs, ["bundle", "unit", "browser"]);
  assert.deepEqual(bw.jobs.unit.strategy.matrix.shard, [0, 1, 2, 3]);
  assert.deepEqual(bw.jobs.browser.strategy.matrix.suite, ["regression", "generation", "foundation"]);
  const foundation = bw.jobs.browser.steps.filter(({ run }) =>
    run === "BOARDWORLD_ASSETS=.output/public node --test scripts/boardworld-foundation-browser.mjs",
  );
  assert.equal(foundation.length, 1);
  assert.equal(foundation[0].if, "matrix.suite == 'foundation'");
  const all = Object.values(bw.jobs)
    .flatMap((j) => j.steps)
    .map((s) => s.run || "")
    .join("\n");
  const original = [
    "node scripts/boardworld-browser.mjs --serve .output/public",
    "node scripts/boardworld-deep-browser.mjs --serve .output/public",
    "node scripts/boardworld-living-browser.mjs --serve .output/public",
    "node scripts/boardworld-emergent-browser.mjs --serve .output/public",
    "node scripts/boardworld-society-browser.mjs --serve .output/public",
    "node scripts/boardworld-expansion-browser.mjs .output/public",
    "node scripts/boardworld-lw2-city-browser.mjs .output/public",
    "node scripts/boardworld-lw2-simulation-browser.mjs .output/public",
    "node scripts/boardworld-lw2-generation-browser.mjs .output/public",
    "node scripts/boardworld-lw2-legacy-browser.mjs .output/public",
    "node scripts/boardworld-stale-browser.mjs --serve .output/public",
    'node scripts/boardworld-concurrent-browser.mjs --serve .output/public --output "$RUNNER_TEMP/screenshots/boardworld-stale/concurrent.json"',
    'node scripts/boardworld-concurrent-browser.mjs --serve .output/public --stale-cache --repeats 20 --output "$RUNNER_TEMP/screenshots/boardworld-stale/frozen-cache.json"',
    'node scripts/boardworld-transaction-browser.mjs --serve .output/public --output "$RUNNER_TEMP/screenshots/boardworld-stale/transactions.json"',
    "node scripts/boardworld-legacy-tab-browser.mjs --serve .output/public",
    "node scripts/boardworld-legacy-slot-browser.mjs --serve .output/public",
    "node scripts/boardworld-legacy-bootstrap-browser.mjs --serve .output/public",
  ];
  for (const command of original)
    assert.equal(all.split("\n").filter((line) => line.trim() === command).length, 1, command);
  assert.match(all, /cat \.ci-boardworld-sha/);
  assert.equal(all.match(/sha256sum --check \.ci-boardworld-assets/g).length, 2);
  assert.equal(all.match(/npm run build/g).length, 1);
  assert.match(all, /ci-parallel.mjs verify boardworld 0 4/);
  assert.match(all, /boardworld-ci-cases.mjs merge-reports/);
  const download = bw.jobs.browser.steps.find((s) => s.uses === "actions/download-artifact@v4");
  assert.equal(download.with.name, "boardworld-build");
  assert.equal(download.with["run-id"], undefined, "artifact must be from this workflow run");
  for (const job of Object.values(bw.jobs)) {
    assert.equal(job["continue-on-error"], undefined);
    assert.ok(job["timeout-minutes"] <= 60);
    for (const step of job.steps) assert.equal(step["continue-on-error"], undefined);
  }
});
