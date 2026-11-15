import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { GOLD_SEEDS, GOLD_STARTS, GOLD_STRATEGIES } from "./boardworld-gold-scenarios.mjs";

const goldFile = "boardworld-gold-acceptance.test.mjs";
const emergentFile = "boardworld-emergent-acceptance.test.mjs";
const goldId = ({ scenario, strategy, seed, days }) => `gold:${scenario}:${strategy}:${seed}:${days}`;
const emergentId = ({ style, seed }) => `emergent:${style}:${seed}:365`;
const goldReport = "boardworld-gold-endurance";
const emergentReport = "boardworld-acceptance";

export const BOARDWORLD_CASE_ENV = "BOARDWORLD_CI_CASE_IDS";
export const EMERGENT_FOCUSED_ID = "emergent:focused";

// This catalog also drives the actual test declarations.
export function goldAcceptanceCases(
  starts = GOLD_STARTS,
  strategies = GOLD_STRATEGIES,
  seeds = GOLD_SEEDS,
) {
  return [
    ...starts.flatMap(scenario => strategies.flatMap(strategy => seeds.map(seed => ({
      scenario, strategy, seed, days: 365,
      name: `Gold6 ${scenario}/${strategy}/${seed}:365 legal days with exact persisted replay`,
      estimatedSeconds: strategy === "social" ? 110 : 75,
    })))),
    {
      scenario: "restart", strategy: "career", seed: 91373, days: 730,
      name: "Gold6 restart/career/91373:730 legal days retain history, bounded population and exact replay",
      estimatedSeconds: 110,
    },
  ].map(entry => ({ ...entry, id: goldId(entry), expectedTests: 1 }));
}

const emergentCases = ["career", "social", "entrepreneur"].flatMap(style =>
  [2026, 91373].map(seed => ({
    id: emergentId({ style, seed }), style, seed, estimatedSeconds: 80, expectedTests: 1,
    name: `${style}/${seed}:365 legal days retain meaningful delayed choices, solvency and exact save replay`,
  })),
);
const catalog = {
  [goldFile]: goldAcceptanceCases(),
  [emergentFile]: [
    ...emergentCases,
    { id: EMERGENT_FOCUSED_ID, estimatedSeconds: 90, expectedTests: 8 },
  ],
};

export function splitBoardworldCases(file) {
  return (Object.hasOwn(catalog, file) ? catalog[file] : []).map(
    ({ id, estimatedSeconds, expectedTests }) => ({
      id, file, caseIds: [id], estimatedSeconds, expectedTests,
    }),
  );
}

function uniqueIds(ids) {
  assert.ok(Array.isArray(ids) && ids.length > 0, "Expected a nonempty Boardworld case list");
  const unique = new Set();
  for (const id of ids) {
    assert.equal(typeof id, "string", "Boardworld case ID must be a string");
    assert.ok(id && id === id.trim(), `Malformed Boardworld case ID: ${JSON.stringify(id)}`);
    assert.ok(!unique.has(id), `Duplicate Boardworld case: ${id}`);
    unique.add(id);
  }
  return unique;
}

export function verifyBoardworldCaseIds(
  actualIds,
  expectedIds = Object.values(catalog).flat().map(({ id }) => id),
) {
  const actual = uniqueIds(actualIds);
  const expected = uniqueIds(expectedIds);
  for (const id of actual) assert.ok(expected.has(id), `Unknown Boardworld case: ${id}`);
  for (const id of expected) assert.ok(actual.has(id), `Missing Boardworld case: ${id}`);
}

export function selectedBoardworldCases(file, selection = process.env[BOARDWORLD_CASE_ENV]) {
  assert.ok(Object.hasOwn(catalog, file), `Unknown Boardworld acceptance file: ${file}`);
  const cases = catalog[file];
  if (selection === undefined) return cases;
  const ids = uniqueIds(selection.split(","));
  for (const id of ids) {
    assert.ok(cases.some(entry => entry.id === id), `Unknown Boardworld case for ${file}: ${id}`);
  }
  // Register in the same order as the original unsharded file.
  return cases.filter(({ id }) => ids.has(id));
}

function orderedLives(reports, expected, caseId) {
  const lives = reports.flatMap(report => {
    assert.ok(Array.isArray(report.lives) && report.lives.length, "Missing Boardworld life records");
    return report.lives;
  });
  verifyBoardworldCaseIds(lives.map(caseId), expected.map(({ id }) => id));
  const byId = new Map(lives.map(life => [caseId(life), life]));
  return expected.map(({ id }) => byId.get(id));
}

function goldMetadata(report) {
  const { startedAt, completedAt, lives: _lives, ...metadata } = report;
  assert.equal(metadata.formatVersion, 1, "Invalid Gold report format");
  assert.equal(metadata.schemaVersion, 6, "Invalid Gold report schema");
  for (const key of ["harnessSha256", "controllerSha256"]) {
    assert.match(metadata[key], /^[0-9a-f]{64}$/, `Invalid Gold report ${key}`);
  }
  const runtime = Object.entries(metadata.runtimeSha256);
  assert.ok(runtime.length, "Missing Gold runtime fingerprints");
  for (const [file, hash] of runtime) {
    assert.match(hash, /^[0-9a-f]{64}$/, `Invalid Gold runtime hash: ${file}`);
  }
  assert.ok(Number.isFinite(Date.parse(startedAt)) && Date.parse(startedAt) <= Date.parse(completedAt),
    "Invalid Gold report time window");
  return metadata;
}

export function mergeBoardworldReports(gold, emergent) {
  const goldLives = orderedLives(gold, catalog[goldFile], goldId);
  const emergentLives = orderedLives(emergent, emergentCases, emergentId);
  const metadata = goldMetadata(gold[0]);
  for (const report of gold.slice(1)) {
    assert.deepEqual(goldMetadata(report), metadata, "Gold report fingerprints differ between shards");
  }
  return {
    gold: {
      ...metadata,
      startedAt: gold.map(report => report.startedAt).sort()[0],
      completedAt: gold.map(report => report.completedAt).sort().at(-1),
      lives: goldLives,
    },
    emergent: { lives: emergentLives },
  };
}

function mergeReportFiles(inputDirectory, outputDirectory) {
  const reports = prefix => readdirSync(inputDirectory, { recursive: true })
    .filter(path => {
      const name = basename(path);
      return name === `${prefix}.json` || (name.startsWith(`${prefix}-`) && name.endsWith(".json"));
    })
    .map(path => JSON.parse(readFileSync(join(inputDirectory, path), "utf8")));
  const { gold, emergent } = mergeBoardworldReports(reports(goldReport), reports(emergentReport));
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(join(outputDirectory, `${goldReport}.json`), JSON.stringify(gold, null, 2) + "\n");
  writeFileSync(join(outputDirectory, `${emergentReport}.json`), JSON.stringify(emergent, null, 2) + "\n");
  console.log(`Boardworld evidence verified: ${gold.lives.length} Gold and ${emergent.lives.length} Emergent lives`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, inputDirectory, outputDirectory, ...extra] = process.argv.slice(2);
  assert.ok(command === "merge-reports" && inputDirectory && outputDirectory && !extra.length,
    "Usage: node scripts/boardworld-ci-cases.mjs merge-reports INPUT_DIRECTORY OUTPUT_DIRECTORY");
  mergeReportFiles(inputDirectory, outputDirectory);
}
