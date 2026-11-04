import test from "node:test";
import assert from "node:assert/strict";
import { ROADS, isRoad, isWalkable, laneLength, pointOnLane } from "../domain/world.ts";
import {
  trafficPose,
  worldHeadingToAtlasDirection,
  DIRECTED_LANE_GRAPH,
} from "../domain/traffic.ts";
import { advanceTraffic, mayAdvanceVehicle } from "../simulation/traffic.ts";
import { createWorld, canonicalState } from "../simulation/engine.ts";
import { encodeSave, decodeSave } from "../persistence/codec.ts";

test("directed geometry covers 4 headings, 8 distinct quarter-turns and merged roadway edges", () => {
  const directions = new Set<number>(),
    turns = new Set<string>();
  for (let lane = 0; lane < ROADS.length; lane++) {
    const points = ROADS[lane];
    for (let i = 0; i < points.length; i++) {
      const previous = points[(i + points.length - 1) % points.length],
        a = points[i],
        b = points[(i + 1) % points.length],
        before = worldHeadingToAtlasDirection(Math.atan2(a.y - previous.y, a.x - previous.x)),
        after = worldHeadingToAtlasDirection(Math.atan2(b.y - a.y, b.x - a.x));
      directions.add(after);
      turns.add(`${before}>${after}`);
    }
    for (let d = 0; d < laneLength(lane); d += 0.05) {
      const p = trafficPose(lane, d),
        before = trafficPose(lane, d - 0.001),
        after = trafficPose(lane, d + 0.001),
        tangent = Math.atan2(after.y - before.y, after.x - before.x),
        delta = Math.atan2(Math.sin(tangent - p.heading), Math.cos(tangent - p.heading));
      assert.ok(
        Math.abs(delta) < 0.002,
        `lane ${lane} d ${d} heading ${p.heading} actual ${tangent}`,
      );
      assert.ok(isRoad(p) && isWalkable(p));
      assert.ok(Math.hypot(after.x - p.x, after.y - p.y) <= 0.0011);
    }
  }
  assert.equal(directions.size, 4);
  assert.equal(turns.size, 8);
  assert.ok(DIRECTED_LANE_GRAPH.some((e) => e.lanes.length > 1));
  assert.equal(new Set(DIRECTED_LANE_GRAPH.map((e) => e.id)).size, DIRECTED_LANE_GRAPH.length);
  assert.deepEqual(
    [0, Math.PI / 2, Math.PI, -Math.PI / 2].map(worldHeadingToAtlasDirection),
    [0, 1, 2, 3],
  );
});
function clearRoads(seed: number) {
  const s = createWorld(seed);
  for (const p of [s.player, ...s.npcs]) p.location = { x: 7, y: 9, scene: "b-home" };
  for (const v of s.vehicles) {
    v.driverId = null;
    v.location = { x: 60, y: 55, scene: "outside" };
  }
  return s;
}
test("eight real vehicle turns keep displacement aligned with heading and survive legacy corner saves", () => {
  for (let lane = 0; lane < 2; lane++) {
    let progress = 0;
    for (let corner = 0; corner < 4; corner++) {
      const s = clearRoads(930),
        v = s.vehicles[1];
      v.lane = lane;
      v.progress = (progress - 1.5 + laneLength(lane)) % laneLength(lane);
      v.speed = 2;
      const initial = pointOnLane(lane, v.progress);
      v.location = { x: initial.x, y: initial.y, scene: "outside" };
      v.heading = initial.heading;
      v.driverId = "n81";
      let travelled = 0;
      for (let tick = 0; tick < 180; tick++) {
        s.tick++;
        const old = { ...v.location };
        advanceTraffic(s);
        const d = Math.hypot(v.location.x - old.x, v.location.y - old.y);
        travelled += d;
        assert.ok(d <= 0.2015);
        if (d > 0.005) {
          const motion = Math.atan2(v.location.y - old.y, v.location.x - old.x),
            delta = Math.atan2(Math.sin(v.heading - motion), Math.cos(v.heading - motion));
          assert.ok(Math.abs(delta) < 0.3);
        }
      }
      assert.ok(travelled > 4, `lane ${lane} corner ${corner}: ${travelled}`);
      progress += Math.hypot(
        ROADS[lane][(corner + 1) % 4].x - ROADS[lane][corner].x,
        ROADS[lane][(corner + 1) % 4].y - ROADS[lane][corner].y,
      );
    }
  }
});
test("overlapping junction reservations let admitted traffic clear a changed signal", () => {
  const s = clearRoads(931),
    v = s.vehicles[1];
  v.location = { x: 18.1, y: 35, scene: "outside" };
  for (let tick = 0; tick < 180; tick++) {
    s.tick = tick;
    assert.equal(mayAdvanceVehicle(s, v, { x: 18.3, y: 35 }), true);
  }
});
test("parked physical obstacles and drivers' pedestrian bodies have one authority", () => {
  const s = clearRoads(932),
    v = s.vehicles[1],
    parked = s.vehicles.find((v) => v.id === "v-rental-0")!;
  v.location = { x: 29.5, y: 16, scene: "outside" };
  parked.location = { x: 31, y: 16, scene: "outside" };
  assert.equal(mayAdvanceVehicle(s, v, { x: 30, y: 16 }), false);
  parked.location = { x: 60, y: 55, scene: "outside" };
  v.driverId = "n81";
  s.npcs[81].location = { x: 30, y: 16, scene: "outside" };
  assert.equal(mayAdvanceVehicle(s, v, { x: 30, y: 16 }), true);
});
test("rounded traffic with signals resumes deterministically from compressed legacy save fields", async () => {
  const a = createWorld(933);
  for (let tick = 0; tick < 150; tick++) {
    a.tick = tick;
    advanceTraffic(a);
  }
  // Keep clock invariant for the real decoder.
  a.tick = 0;
  const b = (await decodeSave(await encodeSave("auto", a))).state;
  for (let tick = 1; tick <= 600; tick++) {
    a.tick = b.tick = tick;
    a.minute = b.minute = 480 + Math.floor(tick / 10);
    advanceTraffic(a);
    advanceTraffic(b);
  }
  assert.equal(canonicalState(a), canonicalState(b));
});

test("authoritative player lane steering has the expected projected left/right sign", () => {
  for (const direction of [-1, 1]) {
    const s = clearRoads(934),
      v = s.vehicles[0];
    if (direction < 0) {
      v.lane = 1;
      v.progress = 100;
    } else {
      v.lane = 2;
      v.progress = 2;
    }
    const p = pointOnLane(v.lane, v.progress);
    v.location = { x: p.x, y: p.y, scene: "outside" };
    v.heading = p.heading;
    v.driverId = "player";
    v.speed = 2;
    s.player.vehicleId = v.id;
    s.player.location = { ...v.location };
    s.flags.steer = direction;
    s.flags.throttle = 1;
    const before = {
      x: (Math.cos(v.heading) - Math.sin(v.heading)) * 24,
      y: (Math.cos(v.heading) + Math.sin(v.heading)) * 12,
    };
    advanceTraffic(s);
    const after = {
      x: (Math.cos(v.heading) - Math.sin(v.heading)) * 24,
      y: (Math.cos(v.heading) + Math.sin(v.heading)) * 12,
    };
    assert.equal(Math.sign(before.x * after.y - before.y * after.x), direction);
    assert.equal(v.driverId, "player");
    assert.deepEqual(v.location, s.player.location);
  }
});
