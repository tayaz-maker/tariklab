import test from "node:test";
import assert from "node:assert/strict";
import { cameraTranslation } from "../rendering/camera.ts";
import { COLLIDER_RADIUS, LAND_HEIGHT, WORLD_SIZE, isWalkable, project } from "../domain/world.ts";

test("all walkable boundary samples remain inside the safe viewport over supported zooms and viewport sizes", () => {
  const r = COLLIDER_RADIUS;
  const points = [];
  for (let t = 0; t <= 1; t += 0.05) {
    const x = 1 + r + (WORLD_SIZE - 2 - 2 * r) * t,
      y = 1 + r + (LAND_HEIGHT - 1 - 2 * r) * t;
    points.push(
      { x, y: 1 + r },
      { x, y: LAND_HEIGHT - r },
      { x: 1 + r, y },
      { x: WORLD_SIZE - 1 - r, y },
    );
  }
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    for (const zoom of [0.75, 1, 1.25, 1.75])
      for (const point of points.filter((p) => isWalkable(p))) {
        const focus = project(point),
          c = cameraTranslation(focus, viewport, zoom);
        const screen = { x: focus.x * zoom + c.x, y: focus.y * zoom + c.y };
        assert.ok(
          screen.x >= Math.min(300, viewport.width * 0.25) - 0.001 &&
            screen.x <= viewport.width - Math.min(300, viewport.width * 0.25) + 0.001,
        );
        assert.ok(
          screen.y >= Math.min(220, viewport.height * 0.3) - 0.001 &&
            screen.y <= viewport.height - Math.min(170, viewport.height * 0.25) + 0.001,
        );
      }
  }
});
test("interior camera preserves reachable edge actor visibility instead of using exterior bounds", () => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ])
    for (const zoom of [0.75, 1.75]) {
      for (const point of [
        { x: 4, y: 1.28 },
        { x: 1.28, y: 10.72 },
        { x: 12.72, y: 10.72 },
      ]) {
        const focus = project(point),
          c = cameraTranslation(focus, viewport, zoom, "b-home");
        assert.ok(focus.x * zoom + c.x >= 0 && focus.x * zoom + c.x <= viewport.width);
        assert.ok(focus.y * zoom + c.y >= 55 && focus.y * zoom + c.y <= viewport.height - 8);
      }
    }
});
