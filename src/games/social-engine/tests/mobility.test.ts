import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  applyCommand,
  stepWorld,
  advanceMinutes,
  validateState,
  canonicalState,
} from "../simulation/engine.ts";
import {
  PARKING_LOTS,
  TRANSIT_STOPS,
  RENTAL_VEHICLE_ID,
  RENTAL_DEPOSIT,
  RENTAL_DAILY_FEE,
  weatherAt,
  mobilityView,
} from "../simulation/mobility.ts";
import { pointOnLane } from "../domain/world.ts";
import type { WorldState } from "../domain/types.ts";
let id = 0;
const act = (s: WorldState, type: string, args: Record<string, unknown> = {}) =>
  applyCommand(s, { v: 1, id: "mobility:" + id++, type, args });
const at = (s: WorldState, p: { x: number; y: number }) => {
  s.player.location = { ...p, scene: "outside" };
  s.player.path = [];
  s.player.destination = null;
  s.flags.moveX = 0;
  s.flags.moveY = 0;
};
test("GD06 paid transit has real elapsed journey, one fare, valid arrival and exact resumed replay", () => {
  const s = createWorld(15);
  at(s, TRANSIT_STOPS[0].point);
  const balance = s.accounts.player;
  assert.equal(act(s, "TRANSIT_RIDE", { stopId: "missing" }).ok, false);
  assert.equal(act(s, "TRANSIT_RIDE", { stopId: TRANSIT_STOPS[0].id }).ok, false);
  const command = {
    v: 1 as const,
    id: "bus-once",
    type: "TRANSIT_RIDE",
    args: { stopId: TRANSIT_STOPS[2].id },
  };
  assert.equal(applyCommand(s, command).ok, true);
  assert.equal(s.accounts.player, balance - 2500);
  assert.equal(applyCommand(s, command).ok, false);
  assert.equal(act(s, "MOVE", { x: 1, y: 0 }).ok, false);
  assert.equal(act(s, "ENTER", { buildingId: "b-market" }).ok, false);
  const arrival = s.mobility.trip!.arrivalTick;
  for (let i = 0; i < arrival - 1; i++) stepWorld(s);
  assert.equal(s.mobility.trip !== null, true);
  assert.deepEqual(s.player.location, { ...TRANSIT_STOPS[0].point, scene: "outside" });
  const resume = JSON.parse(canonicalState(s)) as WorldState;
  stepWorld(s);
  stepWorld(resume);
  assert.equal(canonicalState(s), canonicalState(resume));
  assert.equal(s.mobility.trip, null);
  assert.deepEqual(s.player.location, { ...TRANSIT_STOPS[2].point, scene: "outside" });
  assert.equal(s.accounts.player, balance - 2500);
  assert.deepEqual(validateState(s), []);
});
test("GD06 rental requires contract, finite fees, parked return and exact-once deposit", () => {
  const s = createWorld(15),
    v = s.vehicles.find((x) => x.id === RENTAL_VEHICLE_ID)!;
  at(s, v.location);
  assert.equal(act(s, "VEHICLE_ENTER", { vehicleId: v.id }).ok, false);
  assert.equal(act(s, "RENT_VEHICLE", { vehicleId: v.id, days: 0 }).ok, false);
  const before = s.accounts.player;
  assert.equal(act(s, "RENT_VEHICLE", { vehicleId: v.id, days: 1 }).ok, true);
  assert.equal(s.accounts.player, before - RENTAL_DEPOSIT - RENTAL_DAILY_FEE);
  assert.equal(s.accounts["rental:" + v.id], RENTAL_DEPOSIT);
  assert.equal(act(s, "RENT_VEHICLE", { vehicleId: v.id, days: 1 }).ok, false);
  assert.equal(act(s, "VEHICLE_ENTER", { vehicleId: v.id }).ok, true);
  assert.equal(s.mobility.parking[0].vehicleIds.length, 0);
  assert.equal(act(s, "RETURN_RENTAL", { vehicleId: v.id }).ok, false);
  assert.equal(act(s, "PARK_VEHICLE", { parkingId: PARKING_LOTS[0].id }).ok, true);
  const c = {
    v: 1 as const,
    id: "rental-return",
    type: "RETURN_RENTAL",
    args: { vehicleId: v.id },
  };
  assert.equal(applyCommand(s, c).ok, true);
  assert.equal(s.accounts.player, before - RENTAL_DAILY_FEE);
  assert.equal(applyCommand(s, c).ok, false);
  assert.equal(s.accounts["rental:" + v.id], 0);
  assert.deepEqual(validateState(s), []);
});
test("GD06 parking authority rejects full lot and moving car without altering occupancy", () => {
  const s = createWorld(15),
    v = s.vehicles[0],
    lot = PARKING_LOTS[0],
    lane = pointOnLane(lot.lane, lot.progress);
  v.lane = lot.lane;
  v.progress = lot.progress;
  v.location = { x: lane.x, y: lane.y, scene: "outside" };
  at(s, v.location);
  assert.equal(act(s, "VEHICLE_ENTER", { vehicleId: v.id }).ok, true);
  v.speed = 1;
  assert.equal(act(s, "PARK_VEHICLE", { parkingId: lot.id }).ok, false);
  v.speed = 0;
  assert.equal(act(s, "PARK_VEHICLE", { parkingId: lot.id }).ok, true);
  assert.equal(s.mobility.parking[0].vehicleIds.length, 2);
  assert.equal(mobilityView(s).parking[0].available, 0);
  const extra = {
    ...v,
    id: "extra-test",
    location: { x: lane.x, y: lane.y, scene: "outside" },
    driverId: "player",
  };
  s.vehicles.push(extra);
  s.player.vehicleId = extra.id;
  s.player.location = { ...extra.location };
  assert.equal(act(s, "PARK_VEHICLE", { parkingId: lot.id }).ok, false);
  assert.equal(s.mobility.parking[0].vehicleIds.length, 2);
  assert.deepEqual(validateState(s), []);
});
test("GD06 overdue rental fee is bounded by escrow and cannot double-charge after reload", () => {
  const s = createWorld(15),
    v = s.vehicles.find((x) => x.id === RENTAL_VEHICLE_ID)!;
  at(s, v.location);
  assert.equal(act(s, "RENT_VEHICLE", { vehicleId: v.id, days: 1 }).ok, true);
  advanceMinutes(s, 1441);
  assert.equal(s.mobility.rentals[0].status, "overdue");
  at(s, v.location);
  const before = s.accounts.player;
  assert.equal(act(s, "RETURN_RENTAL", { vehicleId: v.id }).ok, true);
  assert.equal(s.accounts.player, before + RENTAL_DEPOSIT - 5000);
  const reload = JSON.parse(canonicalState(s));
  assert.equal(act(reload, "RETURN_RENTAL", { vehicleId: v.id }).ok, false);
  assert.deepEqual(validateState(reload), []);
});
test("GD16 seeded four weather states affect road caps and outdoor fatigue; all remain replayable", () => {
  const kinds = new Set<string>();
  for (let seed = 0; seed < 100; seed++) kinds.add(weatherAt(seed, 0));
  assert.deepEqual([...kinds].sort(), ["clear", "cloudy", "rain", "wind"]);
  const states = ["clear", "rain"].map((kind) => {
    let seed = 0;
    while (weatherAt(seed, 0) !== kind) seed++;
    return createWorld(seed);
  });
  for (const s of states) {
    const v = s.vehicles[0];
    at(s, v.location);
    assert.equal(act(s, "VEHICLE_ENTER", { vehicleId: v.id }).ok, true);
    assert.equal(act(s, "DRIVE", { throttle: 1, steer: 0 }).ok, true);
    for (let t = 0; t < 30; t++) stepWorld(s);
    assert.deepEqual(validateState(s), []);
  }
  // Measure the clear initial road stretch before later junction/collision stops.
  assert.ok(states[1].vehicles[0].speed < states[0].vehicles[0].speed);
  assert.equal(states[1].vehicles[0].speed, 4.2);
  const fatigue = states.map((s) => s.player.fatigue);
  for (const s of states) advanceMinutes(s, 15);
  assert.equal(states[1].player.fatigue - fatigue[1], states[0].player.fatigue - fatigue[0] + 1);
  const rain = states[1];
  assert.equal(act(rain, "SET_TIME_SPEED", { speed: 3 }).ok, false);
  for (const speed of [0.5, 1, 2]) {
    assert.equal(act(rain, "SET_TIME_SPEED", { speed }).ok, true);
    const clone = JSON.parse(canonicalState(rain));
    for (let i = 0; i < 10; i++) {
      stepWorld(rain);
      stepWorld(clone);
    }
    assert.equal(canonicalState(rain), canonicalState(clone));
  }
  assert.deepEqual(validateState(rain), []);
});
test("GD06 malformed mobility saves are rejected instead of enabling free rides or duplicate parking", () => {
  const s = createWorld();
  s.mobility.speed = 7 as never;
  assert.ok(validateState(s).includes("invalid-time-speed"));
  s.mobility.speed = 1;
  s.mobility.parking[1].vehicleIds.push(RENTAL_VEHICLE_ID);
  assert.ok(validateState(s).some((x) => x.startsWith("invalid-parked-vehicle")));
});
