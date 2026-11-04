import {
  createBenchmarkWorld,
  stepWorld,
  validateState,
  canonicalState,
  projectWorld,
} from "../../src/games/social-engine/simulation/engine.ts";
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { cpus, platform, release } from "node:os";
import assert from "node:assert/strict";
const days = Number(process.env.SE_CAPACITY_DAYS ?? 2);
assert.ok(Number.isInteger(days) && days >= 2 && days <= 30);
const out = "artifacts/social-engine/capacity-10000";
mkdirSync(out, { recursive: true });
const source = createHash("sha256");
for (const dir of ["domain", "simulation"])
  for (const file of readdirSync("src/games/social-engine/" + dir)
    .filter((x) => x.endsWith(".ts"))
    .sort()) {
    const p = "src/games/social-engine/" + dir + "/" + file;
    source.update(p).update(readFileSync(p));
  }
globalThis.gc?.();
const baseline = process.memoryUsage(),
  started = performance.now(),
  state = createBenchmarkWorld(20261103),
  samples = [],
  daily = [];
assert.equal(state.npcs.length, 10000);
assert.equal(state.npcs.filter((n) => n.local).length, 100);
assert.deepEqual(validateState(state, { allowBenchmark: true }), []);
assert.ok(validateState(state).includes("benchmark-world-disabled-in-production"));
for (let day = 1; day <= days; day++) {
  for (let tick = 0; tick < 14400; tick++) {
    if (tick % 29 === 0) {
      const t = performance.now();
      stepWorld(state);
      samples.push(performance.now() - t);
    } else stepWorld(state);
  }
  const errors = validateState(state, { allowBenchmark: true });
  assert.deepEqual(errors, []);
  daily.push({
    day,
    tick: state.tick,
    errors: 0,
    people: state.npcs.length,
    accounts: Object.keys(state.accounts).length,
    households: state.households.length,
  });
  console.log(JSON.stringify(daily.at(-1)));
}
const elapsedMs = performance.now() - started,
  canonical = canonicalState(state),
  hash = createHash("sha256").update(canonical).digest("hex"),
  bytes = Buffer.byteLength(canonical),
  gzipBytes = gzipSync(canonical).length;
globalThis.gc?.();
const finalMemory = process.memoryUsage(),
  ordered = samples.sort((a, b) => a - b),
  q = (n) => ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * n))];
const report = {
  status: "PASS",
  criterion: "C21 synthetic single-world capacity",
  productionClaim: false,
  sourceSha256: source.digest("hex"),
  environment: {
    os: platform() + " " + release(),
    cpu: cpus()[0]?.model,
    node: process.version,
    gcAvailable: typeof globalThis.gc === "function",
  },
  population: state.npcs.length,
  localPopulation: state.npcs.filter((n) => n.local).length,
  backgroundPopulation: state.npcs.filter((n) => !n.local).length,
  projectedLocals: projectWorld(state).npcs.length,
  days,
  actualTicks: state.tick,
  elapsedMs,
  simulationTickMs: {
    samples: samples.length,
    p50: q(0.5),
    p95: q(0.95),
    p99: q(0.99),
    max: ordered.at(-1),
  },
  memory: { baseline, final: finalMemory, heapDelta: finalMemory.heapUsed - baseline.heapUsed },
  snapshot: { bytes, gzipBytes, hash },
  productionValidatorRejected: true,
  notes: [
    "One authoritative world with10000 individual citizens, real households, accounts, schedules, travel and worker-independent fixed steps.",
    "This synthetic CPU/memory benchmark is not a renderer FPS claim or production support for10000 NPCs.",
    "Retained heap includes canonical snapshot text used for measured serialization; OS RSS includes runtime/bundler overhead.",
  ],
  daily,
};
writeFileSync(out + "/results.json", JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    status: report.status,
    elapsedMs,
    tickMs: report.simulationTickMs,
    heapDelta: report.memory.heapDelta,
    bytes,
    gzipBytes,
  }),
);
