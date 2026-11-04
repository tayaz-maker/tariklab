import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { assessSoakCoverage } from "./soak-coverage.mjs";
const regular = (minutes) => ({
  initialTick: 8,
  minuteSamples: Array.from({ length: minutes }, (_, i) => ({
    minute: i + 1,
    elapsedMs: (i + 1) * 60000 + 50,
    projection: { tick: 8 + (i + 1) * 600 },
  })),
});
test("independent fixed-clock observations validate only complete real intervals", () => {
  const report = regular(120);
  assert.equal(assessSoakCoverage(report, 60).status, "VERIFIED");
  assert.equal(assessSoakCoverage(report, 120).status, "VERIFIED");
  assert.equal(assessSoakCoverage(regular(119), 120).status, "UNVERIFIED");
});
test("wall time alone, reversed ticks and accelerated time never satisfy a real soak", () => {
  for (const mode of ["suspended", "reversed", "accelerated"]) {
    const r = regular(60),
      last = r.minuteSamples.at(-1);
    if (mode === "suspended") last.elapsedMs += 120000;
    if (mode === "reversed") last.projection.tick = 0;
    if (mode === "accelerated") last.projection.tick *= 2;
    assert.equal(assessSoakCoverage(r, 60).status, "UNVERIFIED", mode);
  }
});
test("the historical 132-minute wall-clock recording only substantiates its initial 30-minute checkpoint", async () => {
  const report = JSON.parse(
    await readFile("artifacts/social-engine/performance/2026-11-03T21-24-16-089Z/report.json"),
  );
  assert.equal(assessSoakCoverage(report, 30).status, "VERIFIED");
  assert.equal(assessSoakCoverage(report, 60).status, "UNVERIFIED");
  assert.equal(assessSoakCoverage(report, 120).status, "UNVERIFIED");
});
