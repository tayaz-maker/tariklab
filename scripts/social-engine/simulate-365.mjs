import { encodeSave, decodeSave } from "../../src/games/social-engine/persistence/codec.ts";
import { observeLocalDay } from "./neighbourhood-liveness.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { cpus, platform, release, totalmem } from "node:os";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import {
  createWorld,
  stepWorld,
  advanceMinutes,
  validateState,
  canonicalState,
} from "../../src/games/social-engine/simulation/engine.ts";

const output = "artifacts/social-engine/simulation-365";
mkdirSync(output, { recursive: true });
const seed = Number(process.env.SE_SEED ?? 20261103),
  started = performance.now();
const primary = createWorld(seed),
  replay = createWorld(seed);
let resumed = null;
const samples = [],
  days = [],
  errors = [];
const hash = (state) => createHash("sha256").update(canonicalState(state)).digest("hex");
const quantile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.floor(values.length * fraction))
  ];
const sourceFiles = [
  "src/games/social-engine/persistence/codec.ts",
  "src/games/social-engine/persistence/compression.ts",
  "src/games/social-engine/persistence/records.ts",
  ...readdirSync("src/games/social-engine/domain")
    .filter((file) => file.endsWith(".ts"))
    .sort()
    .map((file) => `src/games/social-engine/domain/${file}`),
  ...readdirSync("src/games/social-engine/simulation")
    .filter((file) => file.endsWith(".ts"))
    .sort()
    .map((file) => `src/games/social-engine/simulation/${file}`),
];
const sourceDigest = createHash("sha256");
for (const path of sourceFiles) sourceDigest.update(path).update(readFileSync(path));
const sourceSha256 = sourceDigest.digest("hex");
const environment = {
  os: `${platform()} ${release()}`,
  cpu: cpus()[0]?.model,
  logicalCpus: cpus().length,
  memoryBytes: totalmem(),
  node: process.version,
  engine: primary.engineVersion,
  seed,
  build_sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  dirtyTree: Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()),
  sourceSha256,
  sourceFiles,
};

writeFileSync(`${output}/results.json`, JSON.stringify({status:"RUNNING", environment, completedDays:0},null,2));
try {
  for (let day = 1; day <= 365; day++) {
    const dayStart = performance.now();
    const neighbourhood = observeLocalDay(primary);
    // The tested path is the same ten-Hz stepWorld used by the browser worker.
    for (let tick = 0; tick < 14400; tick++) {
      if (tick % 113 === 0) {
        const time = performance.now();
        stepWorld(primary);
        samples.push(performance.now() - time);
      } else stepWorld(primary);
      if ((tick + 1) % 600 === 0) neighbourhood.sample();
    }
    const localActivity = neighbourhood.result();
    if (localActivity.stalled) errors.push({ day, label: "local-activity", localActivity });
    assert.ok(!localActivity.stalled, `day ${day} local pedestrian/meal liveness: ${JSON.stringify(localActivity)}`);
    advanceMinutes(replay, 1440);
    if (resumed) advanceMinutes(resumed, 1440);
    for (const [label, state] of [
      ["primary", primary],
      ["replay", replay],
      ...(resumed ? [["resumed", resumed]] : []),
    ]) {
      const violations = validateState(state);
      if (violations.length) errors.push({ day, label, violations });
      assert.deepEqual(violations, [], `${label} day ${day} invariant violation`);
    }
    const stateHash = hash(primary),
      replayHash = hash(replay),
      resumedHash = resumed ? hash(resumed) : null;
    assert.equal(stateHash, replayHash, `same-seed replay differs day ${day}`);
    if (resumed)
      assert.equal(stateHash, resumedHash, `day180 serialized resume differs day ${day}`);
    if (day === 180) {
      const bytes = canonicalState(primary);
      writeFileSync(`${output}/day180-world.json.gz`, gzipSync(bytes));
      const checkpoint = await encodeSave("auto", primary);
      resumed = (await decodeSave(checkpoint)).state;
      assert.equal(hash(resumed), stateHash, "day180 canonical snapshot roundtrip");
      writeFileSync(
        `${output}/day180-snapshot.sha256`,
        `${createHash("sha256").update(bytes).digest("hex")}\n`,
      );
    }
    days.push({
      day,
      tick: primary.tick,
      minute: primary.minute,
      hash: stateHash,
      localActivity,
      replayHash,
      resumedHash,
      violations: 0,
      accounts: Object.keys(primary.accounts).length,
      moneyTotal: Object.values(primary.accounts).reduce((a, b) => a + b, 0),
      transfers: primary.ledgerCheckpoint.count + primary.ledger.length,
      events: primary.eventCount,
      duration_ms: performance.now() - dayStart,
    });
    if (day % 30 === 0 || day === 365) {
      writeFileSync(`${output}/results.json`, JSON.stringify({status:"RUNNING",environment,completedDays:day,errors,lastHash:stateHash,elapsedMs:performance.now()-started},null,2));
      console.log(
        JSON.stringify({
          day,
          tick: primary.tick,
          elapsedMs: Math.round(performance.now() - started),
          violations: errors.length,
          hash: stateHash,
        }),
      );
    }
  }
  const bytes = canonicalState(primary);
  const stored = await encodeSave("auto", primary);
  const report = {
    status: "PASS",
    storage: {
      schemaVersion: stored.schemaVersion,
      encoding: stored.encoding,
      decodedByteLength: stored.decodedByteLength,
      payloadBytes: stored.byteLength,
      payloadGzipBytes: gzipSync(stored.payload).length,
      sha256: stored.sha256,
      day180Resume: "actual encodeSave/decodeSave",
    },
    ids: ["SE-037", "SE-038", "SE-039", "SE-046", "SE-047", "SE-048"],
    environment,
    simulatedDays: 365,
    actualTicksPerFullRun: 5256000,
    primaryAndReplayTicks: 10512000,
    resumedTicks: 2664000,
    population: primary.npcs.length,
    localPopulation: primary.npcs.filter((person) => person.local).length,
    zeroInvariantViolations: errors.length === 0,
    unexplainedMoneyDifference:
      Object.values(primary.accounts).reduce((a, b) => a + b, 0) - primary.openingTotal,
    finalHash: hash(primary),
    replayHash: hash(replay),
    resumedHash: hash(resumed),
    ledgerTransfers: primary.ledgerCheckpoint.count + primary.ledger.length,
    finalSnapshotBytes: Buffer.byteLength(bytes),
    finalSnapshotGzipBytes: gzipSync(bytes).length,
    simulationTickMs: {
      count: samples.length,
      p50: quantile(samples, 0.5),
      p95: quantile(samples, 0.95),
      p99: quantile(samples, 0.99),
      max: Math.max(...samples),
    },
    elapsedMs: performance.now() - started,
    notes: [
      "Headless Node simulation, not browser FPS or human playtest evidence.",
      "Every authoritative tick executed; no daily shortcut. Separate identical-seed run and day180 serialized resume both match daily hashes.",
      "Measured tree identified by sourceSha256; build_sha alone is not a claim that uncommitted sources existed in that commit.",
    ],
    days,
  };
  writeFileSync(`${output}/results.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, days: undefined }, null, 2));
} catch (error) {
  writeFileSync(
    `${output}/results.json`,
    `${JSON.stringify({ status: "FAIL", environment, errors, completedDays: days, error: error.stack, elapsedMs: performance.now() - started }, null, 2)}\n`,
  );
  throw error;
}
