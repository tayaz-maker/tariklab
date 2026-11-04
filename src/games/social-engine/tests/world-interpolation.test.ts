import test from "node:test";
import assert from "node:assert/strict";
import { retargetMotion, sampleMotion, type MotionSample } from "../rendering/interpolation.ts";
test("coarse movement interpolates for one second despite unchanged ten-Hz snapshots", () => {
  const s: MotionSample = {
    from: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
    updatedAt: 0,
    duration: 1000,
  };
  assert.equal(retargetMotion(s, { x: 1, y: 0 }, 1000, 0), true);
  for (let t = 100; t < 1000; t += 100) {
    assert.equal(retargetMotion(s, { x: 1, y: 0 }, 1000, t), false);
    assert.equal(sampleMotion(s, t).x, t / 1000);
    assert.equal(sampleMotion(s, t).moving, true);
  }
  assert.equal(sampleMotion(s, 1000).x, 1);
  assert.equal(sampleMotion(s, 1000).moving, false);
});
test("retargeting a changing detail tier starts at currently drawn position without a snap", () => {
  const s: MotionSample = {
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
    updatedAt: 0,
    duration: 1000,
  };
  const before = sampleMotion(s, 350);
  retargetMotion(s, { x: 1.1, y: 0 }, 100, 350);
  assert.equal(sampleMotion(s, 350).x, before.x);
  assert.equal(sampleMotion(s, 450).x, 1.1);
  assert.equal(sampleMotion(s, 500).moving, false);
});
test("player presentation stays at the fixed one-hundred-millisecond interpolation cadence", () => {
  const s: MotionSample = { from: { x: 2, y: 3 }, to: { x: 2, y: 3 }, updatedAt: 0, duration: 100 };
  retargetMotion(s, { x: 2.16, y: 3 }, 100, 100);
  assert.equal(sampleMotion(s, 150).x, 2.08);
  assert.equal(sampleMotion(s, 200).x, 2.16);
  assert.equal(sampleMotion(s, 10000).moving, false);
});
