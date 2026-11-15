import assert from "node:assert/strict";
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { plan, EXTENDED_NAMES } from "./ci-test-plan.mjs";
import { splitBoardworldCases } from "./boardworld-ci-cases.mjs";

const isolatedFile = "social-engine-core.test.mjs";
const costs = {
  "boardworld-living-acceptance.test.mjs": 300,
  "boardworld-deep-acceptance.test.mjs": 180,
  "boardworld-life-journeys.test.mjs": 150,
  "boardworld-routine-finance.test.mjs": 120,
  "boardworld-underworld.test.mjs": 120,
  "boardworld-lw2-simulation.test.mjs": 50,
  "duel-stress.test.mjs": 70,
  "social-engine-life.test.mjs": 90,
  "social-engine-persistence.test.mjs": 60,
};
export function workloads(files, { scope, full = true, routes = [] } = {}) {
  assert.ok(["general", "boardworld", "isolated"].includes(scope), "Unknown test scope");
  const selected = plan(files, { full, routes, shard: 0, shards: 1 });
  return selected
    .filter((file) =>
      scope === "isolated"
        ? file === isolatedFile
        : scope === "boardworld"
          ? file.startsWith("boardworld")
          : file !== isolatedFile,
    )
    .flatMap((file) => {
      const split = splitBoardworldCases(file);
      return split.length
        ? split
        : [{ id: `file:${file}`, file, estimatedSeconds: costs[file] || 5 }];
    });
}
export function distribute(tasks, shards = 4) {
  assert.ok(Number.isSafeInteger(shards) && shards > 0, "Invalid shard count");
  const bins = Array.from({ length: shards }, (_, shard) => ({ shard, seconds: 0, tasks: [] }));
  for (const task of [...tasks].sort(
    (a, b) => b.estimatedSeconds - a.estimatedSeconds || a.id.localeCompare(b.id),
  )) {
    const bin = [...bins].sort((a, b) => a.seconds - b.seconds || a.shard - b.shard)[0];
    bin.tasks.push(task);
    bin.seconds += task.estimatedSeconds;
  }
  return bins;
}
export function verifyCoverage(reports, expected, shards, sha) {
  assert.equal(reports.length, shards, "Missing shard receipt");
  assert.deepEqual(
    reports.map((r) => r.shard).sort((a, b) => a - b),
    Array.from({ length: shards }, (_, i) => i),
    "Duplicate or missing shard",
  );
  const actual = reports.flatMap((r) => {
    assert.equal(r.sha, sha, "Receipt belongs to another commit");
    assert.equal(r.ok, true, "A shard did not pass");
    return r.results.map((result) => {
      assert.equal(result.ok, true, `Task did not pass: ${result.id}`);
      assert.ok(result.tests > 0, `Task did not execute tests: ${result.id}`);
      assert.equal(result.failed, 0, `Task failed: ${result.id}`);
      assert.equal(result.cancelled, 0, `Task cancelled: ${result.id}`);
      return result.id;
    });
  });
  assert.equal(new Set(actual).size, actual.length, "Duplicate executed workload");
  assert.deepEqual(
    actual.sort(),
    expected.map((t) => t.id).sort(),
    "Missing or unexpected workload",
  );
  return {
    tasks: actual.length,
    tests: reports.reduce((sum, r) => sum + r.results.reduce((n, t) => n + t.passed, 0), 0),
  };
}
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function verifyOriginalBoardworldTests(receipts, baseline) {
  const names = receipts.flatMap((receipt) =>
    receipt.results.flatMap((result) => result.passedNames || []),
  );
  assert.equal(baseline.tests.length, 730, "The verified original test inventory changed");
  assert.equal(new Set(baseline.tests).size, 730, "Duplicate original test inventory name");
  for (const name of baseline.tests)
    assert.equal(
      names.filter((actual) => actual === name).length,
      1,
      `Original Boardworld test missing or duplicated: ${name}`,
    );
}
async function execute(task, directory, scope) {
  const key = createHash("sha256").update(task.id).digest("hex").slice(0, 16);
  const env = { ...process.env };
  delete env.BOARDWORLD_CI_CASE_IDS;
  delete env.NODE_TEST_CONTEXT;
  if (task.caseIds) env.BOARDWORLD_CI_CASE_IDS = task.caseIds.join(",");
  env.BOARDWORLD_GOLD_REPORT = join(directory, `boardworld-gold-endurance-${key}.json`);
  env.BOARDWORLD_ACCEPTANCE_REPORT = join(directory, `boardworld-acceptance-${key}.json`);
  const args = ["--test", "--test-reporter=tap", "--test-concurrency=1"];
  if (scope === "general")
    args.push(`--test-skip-pattern=^(?:${EXTENDED_NAMES.map(escape).join("|")})$`);
  args.push(`scripts/${task.file}`);
  const started = performance.now();
  const { code, output } = await new Promise((done, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
    });
    child.stderr.on("data", (data) => {
      output += data;
    });
    child.once("error", reject);
    child.once("close", (code) => done({ code, output }));
  });
  writeFileSync(join(directory, `${key}.tap`), output);
  const count = (name) =>
    Number([...output.matchAll(new RegExp(`^# ${name} (\\d+)$`, "gm"))].at(-1)?.[1] ?? NaN);
  const result = {
    id: task.id,
    file: task.file,
    caseIds: task.caseIds,
    tests: count("tests"),
    passed: count("pass"),
    failed: count("fail"),
    skipped: count("skipped"),
    cancelled: count("cancelled"),
    seconds: (performance.now() - started) / 1000,
    passedNames: [...output.matchAll(/^ok \d+ - (.+)$/gm)]
      .filter((match) => !match[1].includes(" # SKIP"))
      .map((match) => match[1]),
  };
  result.ok =
    code === 0 &&
    result.tests > 0 &&
    result.failed === 0 &&
    result.cancelled === 0 &&
    (scope === "general" || result.skipped === 0) &&
    (!task.expectedTests || result.passed === task.expectedTests);
  console.log(JSON.stringify(result));
  if (!result.ok) console.error(output);
  return result;
}
async function main() {
  const [command, scope, shardText = "0", shardsText = "4", directoryArg] = process.argv.slice(2);
  const directory = resolve(
    directoryArg ||
      process.env.CI_PARALLEL_OUTPUT ||
      join(process.env.RUNNER_TEMP || ".", `ci-${scope}-${shardText}`),
  );
  const full = process.env.CI_FULL !== "false",
    routes = (process.env.CI_ROUTES || "").split(",").filter(Boolean);
  const tasks = workloads(
    readdirSync("scripts").filter((f) => f.endsWith(".test.mjs")),
    { scope, full, routes },
  );
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const shards = Number(shardsText),
    shard = Number(shardText);
  if (command === "verify") {
    const receipts = readdirSync(directory, { recursive: true })
      .filter((f) => String(f).endsWith("receipt.json"))
      .map((f) => JSON.parse(readFileSync(join(directory, String(f)), "utf8")))
      .filter((r) => r.scope === scope);
    console.log(JSON.stringify(verifyCoverage(receipts, tasks, shards, sha)));
    if (scope === "boardworld") {
      const baseline = JSON.parse(
        readFileSync(new URL("./boardworld-ci-baseline.json", import.meta.url), "utf8"),
      );
      verifyOriginalBoardworldTests(receipts, baseline);
      console.log("All 730 original Boardworld tests executed successfully exactly once.");
    }
    return;
  }
  assert.equal(command, "run", "Expected run or verify");
  assert.ok(Number.isSafeInteger(shard) && shard >= 0 && shard < shards, "Invalid shard");
  mkdirSync(directory, { recursive: true });
  const selected = distribute(tasks, shards)[shard].tasks;
  const queue = [...selected],
    results = [];
  const worker = async () => {
    while (queue.length) {
      const task = queue.shift();
      results.push(await execute(task, directory, scope));
    }
  };
  await Promise.all(Array.from({ length: scope === "isolated" ? 1 : 2 }, worker));
  const receipt = { sha, scope, shard, shards, ok: results.every((r) => r.ok), results };
  writeFileSync(join(directory, "receipt.json"), JSON.stringify(receipt, null, 2));
  if (!receipt.ok) process.exitCode = 1;
  if (scope === "general" && shard === 0) {
    const args = [
      "--experimental-strip-types",
      "--import",
      "./scripts/ts-alias.mjs",
      "--test",
      "src/lib/app-data/app-data.test.ts",
      "src/lib/auth/broker-oauth.test.ts",
      "src/lib/auth/gate-identity.test.ts",
      "src/lib/auth/preview-secret.test.ts",
      "src/game/formulas.test.ts",
      "src/game/clock.test.ts",
      "src/game/closure.test.ts",
      "src/game/outcome-moment.test.ts",
      "src/lib/save-slots.test.ts",
    ];
    await new Promise((done, reject) => {
      const child = spawn(process.execPath, args, { stdio: "inherit" });
      child.once("error", reject);
      child.once("close", (code) => {
        if (code !== 0) process.exitCode = 1;
        done();
      });
    });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
