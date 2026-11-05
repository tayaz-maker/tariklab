import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  stepWorld,
  canonicalState,
  validateState,
  applyCommand,
} from "../simulation/engine.ts";
import { JUNCTIONS, signalAxis, trafficPose } from "../domain/traffic.ts";
import { mayAdvanceVehicle } from "../simulation/traffic.ts";
import { encodeSave, decodeSave } from "../persistence/codec.ts";
test("directed lane crossings expose deterministic signals with both directions and clearance", () => {
  assert.ok(JUNCTIONS.length >= 4);
  assert.equal(new Set(JUNCTIONS.map((j) => j.id)).size, JUNCTIONS.length);
  for (const j of JUNCTIONS) {
    const phases = new Set(Array.from({ length: 180 }, (_, tick) => signalAxis(tick, j)));
    assert.deepEqual(phases, new Set(["horizontal", "vertical", "clearance"]));
    for (let t = 0; t < 180; t++) assert.equal(signalAxis(t, j), signalAxis(t + 180, j));
  }
});
test("red approach cannot enter, occupied junction stays reserved, admitted car may clear and pedestrians retain right of way", () => {
  const s = createWorld(920),
    j = JUNCTIONS.find((j) => j.x === 17 && j.y === 35)!;
  assert.ok(j);
  const car = s.vehicles[0],
    other = s.vehicles[1];
  for (const v of s.vehicles) v.location = { x: 60, y: 55, scene: "outside" };
  for (const p of [s.player, ...s.npcs]) p.location = { x: 7, y: 7, scene: "b-home" };
  car.location = { x: j.x - 5.1, y: j.y, scene: "outside" };
  s.tick = Array.from({ length: 180 }, (_, i) => i).find((i) => signalAxis(i, j) === "vertical")!;
  assert.equal(mayAdvanceVehicle(s, car, { x: j.x - 4.4, y: j.y }), false);
  s.tick = Array.from({ length: 180 }, (_, i) => i).find((i) => signalAxis(i, j) === "horizontal")!;
  assert.equal(mayAdvanceVehicle(s, car, { x: j.x - 4.4, y: j.y }), true);
  other.location = { x: j.x, y: j.y, scene: "outside" };
  assert.equal(mayAdvanceVehicle(s, car, { x: j.x - 4.4, y: j.y }), false);
  other.location = { x: 60, y: 55, scene: "outside" };
  car.location = { x: j.x, y: j.y, scene: "outside" };
  s.tick = Array.from({ length: 180 }, (_, i) => i).find((i) => signalAxis(i, j) === "clearance")!;
  assert.equal(mayAdvanceVehicle(s, car, { x: j.x + 0.5, y: j.y }), true);
  s.npcs[0].location = { x: j.x + 0.8, y: j.y, scene: "outside" };
  assert.equal(mayAdvanceVehicle(s, car, { x: j.x + 0.5, y: j.y }), false);
});
test("cars on different lane IDs sharing physical roadway keep clearance", () => {
  const s = createWorld(921),
    a = s.vehicles[0],
    b = s.vehicles[1];
  for (const p of [s.player, ...s.npcs]) p.location = { x: 7, y: 7, scene: "b-home" };
  for (const v of s.vehicles) v.location = { x: 60, y: 55, scene: "outside" };
  a.lane = 0;
  b.lane = 2;
  a.location = { x: 42, y: 43, scene: "outside" };
  b.location = { x: 42, y: 44.6, scene: "outside" };
  assert.equal(mayAdvanceVehicle(s, a, { x: 42, y: 43.6 }), false);
  assert.equal(mayAdvanceVehicle(s, b, { x: 42, y: 45.2 }), true);
});
test("integrated fixed-tick traffic stays on lanes and resumes exactly through signal cycles", async () => {
  const a = createWorld(922);
  for (let i = 0; i < 300; i++) stepWorld(a);
  const b = (await decodeSave(await encodeSave("auto", a))).state;
  for (let i = 0; i < 1800; i++) {
    stepWorld(a);
    stepWorld(b);
  }
  assert.equal(canonicalState(a), canonicalState(b));
  for (const v of a.vehicles.filter((v) => v.driverId)) {
    const p = trafficPose(v.lane, v.progress);
    assert.ok(Math.hypot(v.location.x - p.x, v.location.y - p.y) < 0.002);
  }
  assert.deepEqual(validateState(a), []);
});

test("actual driving command changes directed lane at a legal crossing and preserves one driver", () => {
  const s = createWorld(923),
    car = s.vehicles[0];
  s.mobility.parking.find((l) => l.id === "park-starter")!.vehicleIds = [];
  car.lane = 2;
  car.progress = 1.9;
  car.heading = 0;
  car.speed = 2;
  car.location = { x: 18.9, y: 35, scene: "outside" };
  s.player.location = { ...car.location };
  const enter = applyCommand(s, {
    v: 1,
    id: "cross-enter",
    type: "VEHICLE_ENTER",
    args: { vehicleId: car.id },
  });
  assert.equal(enter.ok, true, enter.reason);
  const drive = applyCommand(s, {
    v: 1,
    id: "cross-drive",
    type: "DRIVE",
    args: { throttle: 1, steer: 1 },
  });
  assert.equal(drive.ok, true, drive.reason);
  stepWorld(s);
  assert.equal(car.lane, 1);
  assert.equal(car.driverId, "player");
  assert.deepEqual(s.player.location, car.location);
  assert.deepEqual(validateState(s), []);
});
