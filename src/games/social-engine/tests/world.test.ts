import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILDINGS,
  SPAWN,
  ROADS,
  isWalkable,
  findPath,
  moveWithCollision,
  project,
  unproject,
  hasLineOfSight,
  pointOnLane,
  laneLength,
  isRoad,
} from "../domain/world.ts";
test("isometric projection has exact inverse across world and zoom-independent logical points", () => {
  for (let x = -64; x <= 64; x += 0.5)
    for (let y = -64; y <= 64; y += 7.25) {
      const p = unproject(project({ x, y }));
      assert.ok(Math.abs(p.x - x) < 1e-10);
      assert.ok(Math.abs(p.y - y) < 1e-10);
    }
});
test("all fourteen original locations have walkable and connected portals", () => {
  assert.equal(BUILDINGS.length, 14);
  assert.equal(new Set(BUILDINGS.map((b) => b.id)).size, 14);
  for (const b of BUILDINGS) {
    assert.ok(isWalkable(b.door), b.id);
    const path = findPath(SPAWN, b.door);
    assert.ok(path.length, b.id);
    let from = SPAWN;
    for (const to of path) {
      assert.ok(hasLineOfSight(from, to), b.id);
      from = to;
    }
    assert.ok(isWalkable({ x: 7, y: 9 }, b.id));
  }
});
test("swept collision blocks wall tunneling and world escape", () => {
  const market = BUILDINGS.find((b) => b.id === "b-market")!;
  const start = { x: market.door.x, y: market.door.y };
  const p = moveWithCollision(start, { x: 0, y: -25 });
  assert.ok(isWalkable(p));
  assert.ok(p.y >= market.y + market.h + 0.28);
  for (const v of [
    { x: 1000, y: 0 },
    { x: -1000, y: 0 },
    { x: 0, y: 1000 },
    { x: 0, y: -1000 },
  ])
    assert.ok(isWalkable(moveWithCollision(SPAWN, v)));
});
test("blocked or invalid destinations are rejected and no phantom interior exists", () => {
  assert.deepEqual(findPath(SPAWN, { x: 25, y: 10 }), []);
  assert.deepEqual(findPath(SPAWN, { x: NaN, y: 1 }), []);
  assert.equal(isWalkable({ x: 7, y: 9 }, "missing"), false);
  assert.equal(isWalkable({ x: 2, y: 2 }, "b-home"), false);
});
test("directed traffic loops remain on connected roadway and close continuously", () => {
  for (let lane = 0; lane < ROADS.length; lane++) {
    const length = laneLength(lane);
    assert.ok(length > 0);
    for (let d = 0; d < length; d += 0.1) assert.ok(isRoad(pointOnLane(lane, d)));
    assert.deepEqual(pointOnLane(lane, 0), pointOnLane(lane, length));
  }
});
