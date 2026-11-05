import test from "node:test";
import assert from "node:assert/strict";
import { ROADS, isRoad, isWalkable, laneLength, pointOnLane } from "../domain/world.ts";
import {
  trafficPose,
  canonicalHeading,
  worldHeadingToAtlasDirection,
  DIRECTED_LANE_GRAPH,
} from "../domain/traffic.ts";
import {
  advanceTraffic,
  mayAdvanceVehicle,
  migrateLegacyTrafficPoses,
} from "../simulation/traffic.ts";
import { createWorld, canonicalState, validateState, stepWorld } from "../simulation/engine.ts";
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
  s.mobility.parking.find((l) => l.id === "park-starter")!.vehicleIds = [];
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
      migrateLegacyTrafficPoses(s);
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

test("a rental in the adjacent parking bay cannot seal the starter driving lane", () => {
  const s = createWorld(987),
    v = s.vehicles[0];
  s.mobility.parking.find((l) => l.id === "park-starter")!.vehicleIds = [];
  for (const p of [s.player, ...s.npcs]) p.location = { x: 7, y: 9, scene: "b-home" };
  v.driverId = "player";
  v.speed = 2;
  s.player.vehicleId = v.id;
  v.location = { x: 29.9, y: 17, scene: "outside" };
  v.lane = 0;
  v.progress = 12.9;
  assert.equal(mayAdvanceVehicle(s, v, { x: 30.1, y: 17 }), true);
  s.flags.throttle = 1;
  for (let tick = 0; tick < 80; tick++) {
    s.tick++;
    advanceTraffic(s);
  }
  assert.ok(Number(s.flags.drivenDistance) >= 10);
});

test("schema migration canonicalizes legacy curve poses and attached drivers without moving parked bays", () => {
  const s = createWorld(935),
    v = s.vehicles[0],
    parked = s.vehicles.find((v) => v.id === "v-rental-0")!;
  s.mobility.parking.find((l) => l.id === "park-starter")!.vehicleIds = [];
  v.lane = 0;
  v.progress = 25;
  const p = pointOnLane(v.lane, v.progress);
  v.location = { x: p.x, y: p.y, scene: "outside" };
  v.heading = p.heading;
  v.driverId = "player";
  s.player.vehicleId = v.id;
  s.player.location = { ...v.location };
  const bay = { ...parked.location };
  assert.ok(validateState(s).includes("invalid-vehicle:v0"));
  migrateLegacyTrafficPoses(s);
  const pose = trafficPose(v.lane, v.progress);
  assert.deepEqual(v.location, { x: pose.x, y: pose.y, scene: "outside" });
  assert.equal(v.heading, pose.heading);
  assert.deepEqual(s.player.location, v.location);
  assert.deepEqual(parked.location, bay);
  assert.deepEqual(validateState(s), []);
  const stable = canonicalState(s);
  migrateLegacyTrafficPoses(s);
  assert.equal(canonicalState(s), stable);
});

test("invalid lane/progress is reported without a crash or migration repair", () => {
  for (const [lane, progress] of [
    [-1, 0],
    [999, 0],
    [0.5, 0],
    [0, NaN],
    [0, Infinity],
    [0, -1],
    [0, Number.MAX_VALUE],
  ]) {
    const s = createWorld(936),
      v = s.vehicles[1];
    v.lane = lane;
    v.progress = progress;
    assert.doesNotThrow(() => trafficPose(lane, progress));
    assert.doesNotThrow(() => validateState(s));
    assert.ok(validateState(s).includes("invalid-vehicle:v1"));
    const old = { ...v.location };
    assert.doesNotThrow(() => migrateLegacyTrafficPoses(s));
    assert.deepEqual(v.location, old);
    assert.doesNotThrow(() => stepWorld(s));
    assert.deepEqual(v.location, old);
  }
});

test("integrated engine follows canonical curves under strict invariants, including stationary headings", () => {
  const s = createWorld(937);
  for (let tick = 0; tick < 1200; tick++) {
    stepWorld(s);
    if (tick % 100 === 0) assert.deepEqual(validateState(s), []);
  }
  for (const v of s.vehicles.filter((v) => v.driverId)) {
    const p = trafficPose(v.lane, v.progress);
    assert.ok(Math.hypot(v.location.x - p.x, v.location.y - p.y) < 0.002);
  }
  const v = s.vehicles[1];
  v.speed = 0;
  const heading = v.heading;
  advanceTraffic(s);
  assert.equal(v.heading, heading);
});

test("stop lines leave room for admitted perpendicular cars to clear", () => {
  const s = clearRoads(938),
    admitted = s.vehicles[0],
    waiting = s.vehicles[1];
  admitted.location = { x: 19.6, y: 51, scene: "outside" };
  waiting.location = { x: 19, y: 46.3, scene: "outside" };
  waiting.heading = Math.PI / 2;
  // Entry is refused far enough from the crossing that the admitted westbound
  // car is never trapped by the body of the southbound waiting car.
  assert.equal(mayAdvanceVehicle(s, waiting, { x: 19, y: 46.6 }), false);
  for (let tick = 0; tick < 180; tick++) {
    s.tick = tick;
    assert.equal(mayAdvanceVehicle(s, admitted, { x: 19.3, y: 51 }), true);
  }
});

test("a crossing reservation stops the nose outside the pedestrian corridor on the pedestrian turn", () => {
  const s = clearRoads(939),
    v = s.vehicles[1];
  // At this marked crossing, tick 60 gives the approaching walker their turn.
  s.tick = 60;
  v.location = { x: 17, y: 35.7, scene: "outside" };
  v.heading = -1.570796327;
  s.npcs[33].location = { x: 20.4, y: 33, scene: "outside" };
  s.npcs[33].path = [{ x: 15.5, y: 33 }];
  assert.equal(mayAdvanceVehicle(s, v, { x: 17, y: 35.5 }), false);
  // Once the pedestrian has cleared the road and curb, the stop line releases.
  s.npcs[33].location = { x: 21, y: 33, scene: "outside" };
  assert.equal(mayAdvanceVehicle(s, v, { x: 17, y: 35.5 }), true);
});

test("persisted traffic headings ignore final-bit atan2 differences without relaxing equality", () => {
  assert.equal(canonicalHeading(2.5775089325401446), canonicalHeading(2.577508932540144));
  const atan2 = Math.atan2;
  const poses = () =>
    ROADS.flatMap((_, lane) =>
      Array.from({ length: 1000 }, (_, i) => trafficPose(lane, i * 0.073)),
    );
  const oracle = poses();
  try {
    Math.atan2 = (y, x) => atan2(y, x) * (1 + Number.EPSILON);
    assert.deepEqual(poses(), oracle);
  } finally {
    Math.atan2 = atan2;
  }
});
