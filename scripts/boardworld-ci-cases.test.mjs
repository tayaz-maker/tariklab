import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  BOARDWORLD_CASE_ENV,
  EMERGENT_FOCUSED_ID,
  goldAcceptanceCases,
  mergeBoardworldReports,
  selectedBoardworldCases,
  splitBoardworldCases,
  verifyBoardworldCaseIds,
} from "./boardworld-ci-cases.mjs";
import { GOLD_SEEDS, GOLD_STARTS, GOLD_STRATEGIES } from "./boardworld-gold-scenarios.mjs";

const goldFile = "boardworld-gold-acceptance.test.mjs";
const emergentFile = "boardworld-emergent-acceptance.test.mjs";
const goldTasks = splitBoardworldCases(goldFile);
const emergentTasks = splitBoardworldCases(emergentFile);
const expectedIds = [...goldTasks, ...emergentTasks].map(({ id }) => id);

test("the selected child cases partition all original endurance and focused registrations", () => {
  assert.equal(goldTasks.length, GOLD_STARTS.length * GOLD_STRATEGIES.length * GOLD_SEEDS.length + 1);
  assert.equal(emergentTasks.length, 7);
  assert.deepEqual(splitBoardworldCases("boardworld-gold-batch.test.mjs"), []);
  const selectedIds = [];
  for (const task of [...goldTasks, ...emergentTasks]) {
    assert.ok(task.estimatedSeconds > 0);
    assert.equal(task.expectedTests, task.id === EMERGENT_FOCUSED_ID ? 8 : 1);
    const cases = selectedBoardworldCases(task.file, task.caseIds.join(","));
    assert.deepEqual(cases.map(({ id }) => id), [task.id]);
    selectedIds.push(...cases.map(({ id }) => id));
  }
  assert.equal(verifyBoardworldCaseIds(selectedIds), undefined);
  const longCase = selectedBoardworldCases(goldFile, "gold:restart:career:91373:730")[0];
  assert.deepEqual([longCase.scenario, longCase.strategy, longCase.seed, longCase.days], ["restart", "career", 91373, 730]);
});

test("adding an origin, strategy, or seed expands the annual declaration catalog", () => {
  const cases = goldAcceptanceCases(
    [...GOLD_STARTS, "extra-origin"],
    [...GOLD_STRATEGIES, "extra-strategy"],
    [...GOLD_SEEDS, 12345],
  );
  assert.equal(cases.length,
    (GOLD_STARTS.length + 1) * (GOLD_STRATEGIES.length + 1) * (GOLD_SEEDS.length + 1) + 1);
  assert.ok(cases.some(({ id, name }) => id === "gold:extra-origin:extra-strategy:12345:365" &&
    name === "Gold6 extra-origin/extra-strategy/12345:365 legal days with exact persisted replay"));
  assert.equal(cases.filter(({ days }) => days === 730).length, 1);
});

test("invalid shard selections and missing, repeated, or unexpected receipts fail closed", () => {
  const gold = goldTasks[0].id;
  const emergent = emergentTasks[0].id;
  for (const selection of ["", `${gold},`, ` ${gold}`, `${gold},${gold}`, "unknown", emergent]) {
    assert.throws(() => selectedBoardworldCases(goldFile, selection), /Boardworld case/);
  }
  assert.throws(() => selectedBoardworldCases("unknown", gold), /Unknown Boardworld acceptance file/);
  assert.throws(() => verifyBoardworldCaseIds(expectedIds.slice(1)), /Missing Boardworld case/);
  assert.throws(() => verifyBoardworldCaseIds([...expectedIds, gold]), /Duplicate Boardworld case/);
  assert.throws(() => verifyBoardworldCaseIds([...expectedIds, "new-unplanned-case"]), /Unknown Boardworld case/);
  assert.throws(() => verifyBoardworldCaseIds(expectedIds, [...expectedIds, "new-required-case"]), /Missing Boardworld case/);
});

test("the real acceptance process fails an unknown case before any simulation runs", () => {
  const env = { ...process.env, [BOARDWORLD_CASE_ENV]: "never-matches" };
  delete env.NODE_TEST_CONTEXT;
  for (const file of [goldFile, emergentFile]) {
    const result = spawnSync(process.execPath,
      ["--test", fileURLToPath(new URL(file, import.meta.url))], {
        env,
        encoding: "utf8",
        timeout: 10000,
      });
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /Unknown Boardworld case.*never-matches/);
  }
});

const validHash = "a".repeat(64);
const metadata = {
  formatVersion: 1,
  schemaVersion: 6,
  purpose: "Deterministic endurance",
  runtimeSha256: { "engine.mjs": validHash },
  controllerSha256: validHash,
  harnessSha256: validHash,
};
const goldLives = goldAcceptanceCases().map(({ scenario, strategy, seed, days }) => ({
  scenario, strategy, seed, days, actionTraceSha256: validHash,
  checkpoints: [{ day: days, stateSha256: validHash }],
}));
const emergentLives = emergentTasks.filter(({ id }) => id !== EMERGENT_FOCUSED_ID)
  .flatMap(({ caseIds }) => selectedBoardworldCases(emergentFile, caseIds.join(",")))
  .map(({ style, seed }) => ({ style, seed, checkpoints: [{ day: 365, hash: validHash }] }));
function sampleReport(lives, hour = "00") {
  return {
    ...metadata,
    startedAt: `2026-11-14T${hour}:01:02.000Z`,
    completedAt: `2026-11-14T${hour}:05:15.000Z`,
    lives,
  };
}

test("report aggregation preserves every record, original order, and matching fingerprints", () => {
  const result = mergeBoardworldReports([
    sampleReport([goldLives.at(-1)], "02"),
    sampleReport(goldLives.slice(0, -1).reverse(), "01"),
  ], [{ lives: emergentLives.slice().reverse() }]);
  assert.deepEqual(result, {
    gold: { ...sampleReport(goldLives, "01"), completedAt: "2026-11-14T02:05:15.000Z" },
    emergent: { lives: emergentLives },
  });
});

test("report aggregation rejects incomplete or duplicate lives and inconsistent runtime provenance", () => {
  const gold = sampleReport(goldLives);
  const emergent = { lives: emergentLives };
  assert.throws(() => mergeBoardworldReports([sampleReport(goldLives.slice(1))], [emergent]), /Missing Boardworld case/);
  assert.throws(() => mergeBoardworldReports([gold, sampleReport([goldLives[0]])], [emergent]), /Duplicate Boardworld case/);
  assert.throws(() => mergeBoardworldReports([gold], [{ lives: emergentLives.slice(1) }]), /Missing Boardworld case/);
  assert.throws(() => mergeBoardworldReports([gold], [{ lives: [] }]), /Missing Boardworld life records/);
  assert.throws(() => mergeBoardworldReports([gold], [{ lives: [...emergentLives, { style: "extra", seed: 2026 }] }]), /Unknown Boardworld case/);
  const wrongBuild = { ...sampleReport(goldLives.slice(1)), runtimeSha256: { "engine.mjs": "b".repeat(64) } };
  assert.throws(() => mergeBoardworldReports([sampleReport([goldLives[0]]), wrongBuild], [emergent]), /fingerprints differ/);
});
