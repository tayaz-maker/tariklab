import assert from "node:assert/strict";
import test from "node:test";
import { alphaMask, masksOverlap } from "../rendering/occlusion.ts";

function onePixel(width: number, height: number, x: number, y: number, alpha = 255, list = false) {
  const data = new Uint8ClampedArray(width * height * 4);
  data[(y * width + x) * 4 + 3] = alpha;
  return alphaMask(data, width, height, list);
}

test("a one-pixel overlap away from the old sample grid is not missed", () => {
  const building = onePixel(30, 30, 17, 13);
  const actor = onePixel(20, 20, 7, 3, 255, true);
  assert.equal(masksOverlap(building, actor, 10, 10, 0, 0, 1, 1, 0), true);
  assert.equal(masksOverlap(building, actor, 0, 0, 0, 0, 1, 1, 0), false);
});

test("transparent shadow pixels do not count and scaled rotated pixels remain covered", () => {
  const shadow = onePixel(20, 20, 10, 10, 80);
  const building = onePixel(20, 20, 10, 10);
  const actor = onePixel(10, 10, 0, 0, 255, true);
  assert.equal(masksOverlap(shadow, actor, 10.25, 10.25, 0, 0, 0.76, 0.76, 0), false);
  assert.equal(masksOverlap(building, actor, 10.25, 10.25, 0, 0, 0.76, 0.76, Math.PI / 4), true);
});
