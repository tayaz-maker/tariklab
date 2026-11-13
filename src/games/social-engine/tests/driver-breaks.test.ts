import { processDeath } from "../simulation/family.ts";
import { createWorld as createPredecessor } from "../persistence/historical/candidate7/simulation/engine.ts";
import { pedestrianPath, pedestrianSegment } from "../simulation/pedestrian-navigation.ts";
import { mayAdvanceVehicle, trafficContext } from "../simulation/traffic.ts";
import {
  personVehicleSeparation,
  vehicleSeparation,
  vehicleSweepClear,
} from "../simulation/vehicle-collision.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  stepWorld,
  validateState,
  canonicalState,
  applyCommand,
} from "../simulation/engine.ts";
import { trafficPose } from "../domain/traffic.ts";
import {
  BREAK_ENTRIES,
  DRIVER_BAYS,
  STARTER_BAY,
  breakEntry,
  breakReturn,
  type BreakBayId,
  BREAK_BAY,
  BREAK_DOOR,
  BREAK_PARKING_ID,
  breakRoute,
  breakRoutePose,
} from "../domain/driver-breaks.ts";
import { encodeSave, decodeSave, migrateState } from "../persistence/codec.ts";
import { validateDriverBreaks } from "../simulation/driver-breaks.ts";
import { mobilityView } from "../simulation/mobility.ts";
import { transfer, readTransactionBits, hasSettledTransaction } from "../simulation/ledger.ts";
import { BUILDINGS, isWalkable } from "../domain/world.ts";

function fixture(lane = 1, personId = "n81", bayId: BreakBayId = "coast") {
  const s = createWorld(922),
    v = s.vehicles.find((v) => v.driverId === personId)!,
    p = s.npcs.find((n) => n.id === personId)!;
  // Keep the real economy and all citizen identities. This fixture isolates one
  // physical car and its driver so geometry failures cannot hide behind traffic.
  s.vehicles = s.vehicles.filter((x) => x === v || x.id === "v-rental-0");
  for (const lot of s.mobility.parking)
    lot.vehicleIds = lot.vehicleIds.filter((id) => s.vehicles.some((v) => v.id === id));
  for (const n of s.npcs.slice(0, 100)) {
    n.location = { x: 7, y: 7, scene: "b-home" };
    n.lastDecision = 100000;
  }
  v.lane = lane;
  v.progress = breakEntry(lane, bayId).progress;
  const pose = trafficPose(lane, v.progress);
  v.location = { x: pose.x, y: pose.y, scene: "outside" };
  v.heading = pose.heading;
  v.speed = 2.2;
  p.location = { ...v.location };
  p.hunger = 90;
  if (bayId === "westSouth") {
    p.hunger = 100;
    const normalWest = DRIVER_BAYS.find((b) => b.id === "west")!;
    const parked = {
      ...v,
      id: "test-ordinary-west-car",
      driverId: null,
      speed: 0,
      heading: -1.570796327,
      location: { ...normalWest.point, scene: "outside" },
    };
    s.vehicles.push(parked);
    s.mobility.parking.find((lot) => lot.id === normalWest.parkingId)!.vehicleIds = [parked.id];
  }
  return { s, v, p };
}
function until(f: ReturnType<typeof fixture>, phase: string, limit = 4000) {
  for (let i = 0; i < limit; i++) {
    stepWorld(f.s);
    if (f.s.mobility.driverBreaks?.[0]?.phase === phase) return;
  }
  assert.fail(`did not reach ${phase}: ${JSON.stringify(f.s.mobility.driverBreaks)}`);
}

test("authored bay curves fit a complete oriented car inside the world", () => {
  for (const bay of DRIVER_BAYS)
    for (const lane of bay.lanes)
      for (const phase of ["toBay", "fromBay"] as const) {
        const length = breakRoute(phase, lane, bay.id).length;
        for (let d = 0; d <= length; d += 0.05) {
          const pose = breakRoutePose(phase, lane, d, bay.id);
          for (const l of [-1.5, 0, 1.5])
            for (const w of [-0.85, 0, 0.85])
              assert.ok(
                isWalkable({
                  x: pose.x + l * Math.cos(pose.heading) - w * Math.sin(pose.heading),
                  y: pose.y + l * Math.sin(pose.heading) + w * Math.cos(pose.heading),
                }),
                `${lane}:${phase}:${d}`,
              );
        }
      }
});

test("the default parked starter cannot obstruct the full west-to-loop2 turn", () => {
  const pose = { ...STARTER_BAY.point, heading: 0 },
    route = breakRoute("fromBay", 2, "west");
  for (let d = 0; d <= route.length; d += 0.01)
    assert.ok(vehicleSeparation(pose, breakRoutePose("fromBay", 2, d, "west")) > 0.1);
});

test("the starter's real footprint leaves the market pocket a legal western escape", () => {
  // The two other real bodies are stationary in the natural 922 tick 19725
  // reproduction. The original starter position sealed all three exits.
  const held = { x: 26.334, y: 17, heading: 0 },
    rental = { x: 31, y: 15.2, heading: 0 };
  const old = [{ x: 21.6, y: 15.2, heading: 0 }, held, rental];
  const current = [{ ...STARTER_BAY.point, heading: 0 }, held, rental];
  for (const [origin, target] of [
    [
      { x: 28.40491, y: 14.808902 },
      { x: 37, y: 56.5 },
    ],
    [
      { x: 23.390353, y: 14.911393 },
      { x: 47.85, y: 20.5 },
    ],
    [
      { x: 27.401824, y: 14.668028 },
      { x: 13.95, y: 21 },
    ],
  ] as const) {
    assert.deepEqual(pedestrianPath(origin, target, old), []);
    const path = pedestrianPath(origin, target, current);
    assert.ok(path.length);
    for (let i = 0; i < path.length; i++)
      assert.ok(pedestrianSegment(i ? path[i - 1] : origin, path[i], current));
  }
  const ingress = breakRoute("fromBay", 0, "starter");
  for (let d = 0; d <= ingress.length; d += 0.01) {
    const pose = breakRoutePose("fromBay", 0, d, "starter");
    for (const l of [-1.5, 0, 1.5])
      for (const w of [-0.85, 0, 0.85])
        assert.ok(
          isWalkable({
            x: pose.x + l * Math.cos(pose.heading) - w * Math.sin(pose.heading),
            y: pose.y + l * Math.sin(pose.heading) + w * Math.cos(pose.heading),
          }),
        );
  }
});

test("fresh and predecessor start poses allow physical starter boarding and exact mid-curve replay", async () => {
  const old = createPredecessor(922),
    before = canonicalState(old),
    upgraded = migrateState(old);
  assert.equal(canonicalState(old), before);
  assert.deepEqual(upgraded.accounts, old.accounts);
  for (const s of [createWorld(922), upgraded]) {
    const v = s.vehicles.find((v) => v.id === "v0")!,
      start = { ...v.location };
    assert.ok(
      personVehicleSeparation(s.player.location, { ...v.location, heading: v.heading }) > 0.1,
    );
    assert.equal(
      applyCommand(s, {
        v: 1,
        id: "take-starter-physical",
        type: "VEHICLE_ENTER",
        args: { vehicleId: v.id },
      }).ok,
      true,
    );
    assert.deepEqual(v.location, start);
    let restored: typeof s | undefined;
    for (let tick = 0; tick < 600; tick++) {
      const last = { ...v.location };
      stepWorld(s);
      if (restored) stepWorld(restored);
      const b = s.mobility.driverBreaks!.find((b) => b.vehicleId === v.id)!;
      assert.ok(Math.hypot(v.location.x - last.x, v.location.y - last.y) < 0.125);
      if (!restored && b.phase === "fromBay" && b.routeProgress > 0.5)
        restored = (await decodeSave(await encodeSave("auto", s))).state;
      if (b.phase === "cancelled") break;
    }
    assert.ok(restored);
    assert.equal(s.mobility.driverBreaks!.find((b) => b.vehicleId === v.id)!.phase, "cancelled");
    assert.deepEqual(v.location, { ...STARTER_BAY.egress, scene: "outside" });
    assert.equal(s.player.vehicleId, v.id);
    assert.equal(canonicalState(restored), canonicalState(s));
    assert.deepEqual(validateState(s), []);
  }
});

for (const bay of DRIVER_BAYS.filter((b) => b.id !== "coast"))
  for (const lane of bay.lanes)
    test(`${bay.id} bay loop ${lane} uses exact physical endpoints and resumes after an interrupted exit`, async () => {
      const f = fixture(lane, "n81", bay.id);
      let complete = false,
        saved = false;
      for (let i = 0; i < 3500; i++) {
        const before = { ...f.v.location };
        stepWorld(f.s);
        const b = f.s.mobility.driverBreaks![0];
        assert.equal(b.bayId, bay.id);
        assert.ok(Math.hypot(f.v.location.x - before.x, f.v.location.y - before.y) <= 0.225);
        assert.deepEqual(validateDriverBreaks(f.s), []);
        if (i % 100 === 0) assert.deepEqual(validateState(f.s), []);
        if (b.phase === "fromBay" && !saved) {
          saved = true;
          const loaded = (await decodeSave(await encodeSave("auto", f.s))).state;
          for (let t = 0; t < 15; t++) {
            stepWorld(f.s);
            stepWorld(loaded);
          }
          assert.equal(canonicalState(f.s), canonicalState(loaded));
        }
        if (b.phase === "driving") {
          complete = true;
          break;
        }
      }
      assert.ok(complete);
      assert.ok(saved);
      assert.equal(f.v.lane, lane);
      assert.deepEqual(validateState(f.s), []);
      const end = breakReturn(lane, bay.id),
        pose = trafficPose(end.lane, end.progress);
      assert.ok(Math.hypot(f.v.location.x - pose.x, f.v.location.y - pose.y) < 0.002);
    });

for (let lane = 0; lane < 4; lane++)
  test(`loop ${lane} parks, walks, pays at the market, returns to the same car and merges continuously`, () => {
    const f = fixture(lane),
      { s, v, p } = f,
      phases = new Set<string>();
    const balance = s.accounts[p.id];
    let complete = false;
    for (let i = 0; i < 4000; i++) {
      const before = { ...v.location };
      stepWorld(s);
      const b = s.mobility.driverBreaks![0];
      phases.add(b.phase);
      assert.ok(
        Math.hypot(v.location.x - before.x, v.location.y - before.y) <= 0.225,
        `vehicle teleported at ${i}`,
      );
      assert.deepEqual(validateState(s), []);
      if (b.phase === "driving" && b.outcome === "fed") {
        complete = true;
        break;
      }
    }
    assert.ok(complete);
    assert.deepEqual(
      phases,
      new Set(["toBay", "walkToMarket", "queue", "walkBack", "fromBay", "driving"]),
    );
    const receipt = s.ledger.find((e) => e.reason === "food" && e.from === p.id)!;
    assert.ok(receipt);
    assert.equal(receipt.to, "business:market");
    assert.equal(s.accounts[p.id], balance - receipt.amount);
    assert.equal(v.driverId, p.id);
    assert.deepEqual(p.location, v.location);
    assert.equal(v.lane, lane);
    assert.ok(p.hunger < 90);
    assert.deepEqual(s.mobility.parking.find((l) => l.id === BREAK_PARKING_ID)!.vehicleIds, []);
  });

test("compressed save/load in each lifecycle phase resumes exact canonical state", async () => {
  const f = fixture(2),
    seen = new Set<string>();
  for (let i = 0; i < 4000; i++) {
    stepWorld(f.s);
    const b = f.s.mobility.driverBreaks![0];
    if (!seen.has(b.phase)) {
      seen.add(b.phase);
      const restored = (await decodeSave(await encodeSave("auto", f.s))).state;
      assert.equal(canonicalState(restored), canonicalState(f.s));
      for (let tick = 0; tick < 40; tick++) {
        stepWorld(f.s);
        stepWorld(restored);
      }
      assert.equal(canonicalState(restored), canonicalState(f.s));
      assert.deepEqual(validateState(restored), []);
    }
    if (b.phase === "driving" && b.outcome === "fed") break;
  }
  assert.deepEqual(
    seen,
    new Set(["toBay", "walkToMarket", "queue", "walkBack", "fromBay", "driving"]),
  );
});

test("closed or emptied market after departure returns the driver unfed without a fabricated settlement", () => {
  for (const failure of ["closed", "empty"] as const) {
    const f = fixture();
    until(f, "walkToMarket");
    const balance = f.s.accounts[f.p.id],
      hunger = f.p.hunger;
    const market = f.s.businesses.find((b) => b.id === "market")!;
    if (failure === "closed") market.status = "closed";
    else market.stock.simit = 0;
    until(f, "driving");
    assert.equal(f.s.mobility.driverBreaks![0].lastMealTick, null);
    assert.equal(f.s.accounts[f.p.id], balance);
    assert.ok(f.p.hunger >= hunger);
    assert.equal(
      f.s.ledger.some((e) => e.reason === "food" && e.from === f.p.id),
      false,
    );
    assert.deepEqual(validateState(f.s), []);
  }
});

test("zero-wallet n84 physically returns to the existing job, earns an attendance-backed wage and buys a real meal after save/load", async () => {
  const f = fixture(0, "n84");
  assert.equal(f.p.employerId, "garage");
  assert.equal(
    transfer(f.s, "test-wallet-loss", f.p.id, "external", f.s.accounts[f.p.id], "fixture"),
    true,
  );
  until(f, "routine");
  assert.equal(f.s.accounts[f.p.id], 0);
  assert.equal(f.s.mobility.driverBreaks![0].lastMealTick, null);
  for (let i = 0; i < 2000; i++) stepWorld(f.s);
  const restored = (await decodeSave(await encodeSave("auto", f.s))).state;
  let sawRealWork = false,
    sawFundedPreopenWalk = false,
    complete = false;
  for (let i = 0; i < 30000; i++) {
    stepWorld(f.s);
    stepWorld(restored);
    if (f.p.goal === "work" && f.p.location.scene === "b-garage") sawRealWork = true;
    if (i % 1000 === 0) assert.deepEqual(validateState(f.s), []);
    const b = f.s.mobility.driverBreaks![0];
    if (b.phase === "walkToMarket" && f.s.minute % 1440 < 360) {
      assert.ok(
        f.s.accounts[f.p.id] >= f.s.businesses.find((x) => x.id === "market")!.prices.simit,
      );
      assert.equal(b.lastMealTick, null);
      assert.ok(!f.s.economy.services.market.queue.some((q) => q.personId === f.p.id));
      sawFundedPreopenWalk = true;
    }
    if (b.phase === "driving" && b.outcome === "fed") {
      complete = true;
      break;
    }
  }
  assert.ok(sawRealWork);
  assert.ok(sawFundedPreopenWalk);
  assert.ok(complete);
  const wage = f.s.ledger.find((e) => e.reason === "npc-payroll" && e.to === f.p.id)!;
  const meals = f.s.ledger.filter((e) => e.reason === "food" && e.from === f.p.id);
  assert.ok(meals.length >= 1 && meals.length <= 2);
  const mealCost = meals.reduce((total, meal) => total + meal.amount, 0);
  assert.ok(
    meals.every((meal) => (480 + Math.floor(meal.tick / 10)) % 1440 >= 360),
    "meals were settled after opening",
  );
  // The real ledger may compact the retained receipt; its collision-free
  // persistent transaction membership and payroll audit remain authoritative.
  assert.ok(
    (readTransactionBits(String(f.s.flags['txset:["salary:1:n","",0]'])) & (1n << 84n)) !== 0n,
  );
  if (wage) assert.equal(wage.from, "business:garage");
  const attendance = f.s.economy.lastPayroll.find((a) => a.personId === f.p.id)!;
  assert.ok(attendance.minutes > 0);
  assert.ok(attendance.amount >= mealCost);
  assert.equal(f.p.income, attendance.amount);
  assert.equal(f.s.accounts[f.p.id], attendance.amount - mealCost);
  if (wage) assert.equal(attendance.amount, wage.amount);
  assert.equal(canonicalState(restored), canonicalState(f.s));
  assert.deepEqual(validateState(f.s), []);
});

test("serious remaining hunger can buy only one extra serving through a new FIFO entry", async () => {
  for (const closedAfterFirst of [false, true]) {
    const f = fixture();
    f.p.hunger = 100;
    const balance = f.s.accounts[f.p.id];
    const startingStock = f.s.businesses.find((x) => x.id === "market")!.stock.simit;
    for (let i = 0; i < 4000; i++) {
      stepWorld(f.s);
      const b = f.s.mobility.driverBreaks![0];
      if (b.outcome === "fed" && b.phase === "queue") break;
    }
    const b = f.s.mobility.driverBreaks![0];
    assert.equal(b.outcome, "fed");
    assert.equal(b.phase, "queue");
    assert.equal(f.p.hunger, 60);
    const receipts = (s: typeof f.s) =>
      s.ledger.filter((e) => e.reason === "food" && e.from === f.p.id);
    const first = receipts(f.s)[0];
    const second = f.s.economy.services.market.queue.find((q) => q.personId === f.p.id)!;
    assert.ok(second);
    assert.notEqual(first.id, `meal:v5:market:${second.id.split(":").at(-1)}:${f.p.id}`);
    const restored = (await decodeSave(await encodeSave("auto", f.s))).state;
    for (const s of [f.s, restored]) {
      if (closedAfterFirst) s.businesses.find((x) => x.id === "market")!.status = "closed";
      for (let i = 0; i < 4000; i++) {
        stepWorld(s);
        if (s.mobility.driverBreaks![0].phase === "driving") break;
      }
      const result = s.mobility.driverBreaks![0],
        paid = receipts(s);
      assert.equal(result.phase, "driving");
      assert.equal(result.outcome, "fed");
      assert.equal(paid.length, closedAfterFirst ? 1 : 2);
      assert.equal(new Set(paid.map((e) => e.id)).size, paid.length);
      assert.ok(paid.every((e) => e.amount > 0 && e.to === "business:market"));
      const marketUnits = s.ledger.filter(
        (e) => e.reason === "food" && e.to === "business:market",
      ).length;
      assert.equal(
        s.businesses.find((x) => x.id === "market")!.stock.simit,
        startingStock - marketUnits,
      );
      assert.equal(s.accounts[f.p.id], balance - paid.reduce((sum, e) => sum + e.amount, 0));
      assert.equal(s.vehicles.find((v) => v.id === f.v.id)!.driverId, f.p.id);
      assert.deepEqual(validateState(s), []);
    }
    assert.equal(canonicalState(f.s), canonicalState(restored));
  }
});

test("player theft uses the physical bay exit and cancels the old driver's claim", () => {
  const f = fixture();
  until(f, "walkToMarket");
  f.s.player.location = { ...BREAK_DOOR, scene: "outside" };
  const before = { ...f.v.location };
  const result = applyCommand(f.s, {
    v: 1,
    id: "take-break-car",
    type: "VEHICLE_ENTER",
    args: { vehicleId: f.v.id },
  });
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(f.v.location, before);
  for (let i = 0; i < 100; i++) {
    const old = { ...f.v.location };
    stepWorld(f.s);
    assert.ok(Math.hypot(f.v.location.x - old.x, f.v.location.y - old.y) <= 0.125);
    assert.deepEqual(validateState(f.s), []);
    if (String(f.s.mobility.driverBreaks![0].phase) === "cancelled") break;
  }
  assert.equal(f.s.mobility.driverBreaks![0].phase, "cancelled");
  assert.equal(f.v.driverId, "player");
  assert.equal(f.s.player.vehicleId, f.v.id);
  assert.notEqual(f.p.goal, "drive");
  assert.ok(Math.hypot(f.v.location.x - BREAK_BAY.x, f.v.location.y - BREAK_BAY.y) > 2);
});

test("forged route cursor, bay ownership and duplicate person reservations fail validation", () => {
  const f = fixture();
  stepWorld(f.s);
  const b = f.s.mobility.driverBreaks![0];
  b.routeProgress = 3;
  assert.ok(validateDriverBreaks(f.s).some((e) => e.startsWith("invalid-driver-break-route")));
  b.routeProgress = 0;
  f.s.mobility.driverBreaks!.push({ ...b });
  assert.ok(validateDriverBreaks(f.s).some((e) => e.startsWith("invalid-driver-break:")));
});

test("malformed phase, bay, retry count and resume cursor fail closed before save", async () => {
  const f = fixture();
  stepWorld(f.s);
  assert.deepEqual(validateDriverBreaks(f.s), []);
  for (const patch of [
    { phase: "invalid-phase" },
    { bayId: "bad-bay" },
    { recoveryAttempts: 99 },
    { resumeMark: -4 },
    { vehicleId: "unknown" },
    { originalLane: 99 },
  ]) {
    const corrupt = structuredClone(f.s);
    Object.assign(corrupt.mobility.driverBreaks![0], patch);
    assert.ok(validateDriverBreaks(corrupt).length, JSON.stringify(patch));
    assert.ok(validateState(corrupt).length, JSON.stringify(patch));
    await assert.rejects(encodeSave("auto", corrupt));
  }
});

test("occupied bay and expiry preserve the other car and continue lawful cruising", () => {
  const f = fixture();
  for (const bay of DRIVER_BAYS) {
    const blocker = {
      ...f.v,
      id: "blocker:" + bay.id,
      heading: bay.vertical ? -1.570796327 : 0,
      driverId: null,
      speed: 0,
      location: { ...bay.point, scene: "outside" },
    };
    f.s.vehicles.push(blocker);
    f.s.mobility.parking.find((l) => l.id === bay.parkingId)!.vehicleIds = [blocker.id];
  }
  const lot = f.s.mobility.parking.find((l) => l.id === BREAK_PARKING_ID)!,
    blocker = f.s.vehicles.find((v) => v.id === "blocker:coast")!;
  for (let i = 0; i < 200; i++) stepWorld(f.s);
  assert.equal(f.s.mobility.driverBreaks![0].phase, "seeking");
  assert.deepEqual(lot.vehicleIds, [blocker.id]);
  assert.deepEqual(blocker.location, { ...BREAK_BAY, scene: "outside" });
  assert.equal(f.v.driverId, f.p.id);
  assert.ok(Math.hypot(f.v.location.x - BREAK_BAY.x, f.v.location.y - BREAK_BAY.y) > 2);
  f.s.mobility.driverBreaks![0].expiresAt = f.s.tick + 1;
  stepWorld(f.s);
  assert.equal(f.s.mobility.driverBreaks![0].phase, "driving");
  assert.deepEqual(validateState(f.s), []);
});

test("the two west bays share a lane without occupying or blocking the public lot", () => {
  const south = DRIVER_BAYS.find((b) => b.id === "westSouth")!,
    north = DRIVER_BAYS.find((b) => b.id === "west")!;
  for (const [lane, occupied, free] of [
    [0, south, north],
    [0, north, south],
    [2, north, south],
  ] as const) {
    const f = fixture(lane, "n81", "westSouth");
    // Replace the generic geometry fixture occupant with the specific case.
    f.s.vehicles = f.s.vehicles.filter((v) => v.id !== "test-ordinary-west-car");
    f.s.mobility.parking.find((lot) => lot.id === north.parkingId)!.vehicleIds = [];
    const blocker = {
      ...f.v,
      id: "west-blocker",
      driverId: null,
      location: { ...occupied.point, scene: "outside" },
      heading: -1.570796327,
      speed: 0,
    };
    f.s.vehicles.push(blocker);
    const lot = f.s.mobility.parking.find((p) => p.id === occupied.parkingId)!;
    lot.vehicleIds = [blocker.id];
    const publicLot = f.s.mobility.parking.find((l) => l.id === "park-coast")!;
    const publicCar = {
      ...f.v,
      id: "existing-public-car",
      driverId: null,
      speed: 0,
      location: { x: 29, y: 55.2, scene: "outside" },
      heading: 0,
    };
    f.s.vehicles.push(publicCar);
    publicLot.vehicleIds = [publicCar.id];
    let parked = false,
      returned = false;
    for (let i = 0; i < 6500; i++) {
      stepWorld(f.s);
      const b = f.s.mobility.driverBreaks![0];
      assert.ok(
        vehicleSeparation(
          { ...f.v.location, heading: f.v.heading },
          { ...blocker.location, heading: blocker.heading },
        ) >= 0.02,
      );
      assert.deepEqual(lot.vehicleIds, [blocker.id]);
      assert.deepEqual(publicLot.vehicleIds, [publicCar.id]);
      assert.deepEqual(publicCar.location, { x: 29, y: 55.2, scene: "outside" });
      if (b.phase === "walkToMarket") {
        parked = true;
        assert.equal(b.bayId, free.id);
        assert.deepEqual(f.s.mobility.parking.find((l) => l.id === free.parkingId)!.vehicleIds, [
          f.v.id,
        ]);
      }
      if (parked && b.phase === "driving" && b.outcome === "fed") {
        returned = true;
        break;
      }
    }
    assert.ok(parked && returned);
    assert.equal(f.v.driverId, f.p.id);
    assert.deepEqual(validateState(f.s), []);
  }
});

test("the overflow bay stays free for ordinary demand and for the regular bay when it is available", () => {
  for (const [hunger, ordinaryBayOccupied] of [
    [94, true],
    [100, false],
  ] as const) {
    const f = fixture(0, "n81", "westSouth");
    f.p.hunger = hunger;
    if (!ordinaryBayOccupied) {
      f.s.vehicles = f.s.vehicles.filter((v) => v.id !== "test-ordinary-west-car");
      const west = DRIVER_BAYS.find((b) => b.id === "west")!;
      f.s.mobility.parking.find((lot) => lot.id === west.parkingId)!.vehicleIds = [];
    }
    stepWorld(f.s);
    assert.equal(f.s.mobility.driverBreaks![0].phase, "seeking");
    assert.equal(
      f.s.mobility.parking.find((lot) => lot.id === "park-driver-west-south")!.vehicleIds.length,
      0,
    );
    assert.deepEqual(validateState(f.s), []);
  }
});

test("older schema-nine parking checkpoints retain their exact topology without the overflow feature", async () => {
  const f = fixture(0, "n81", "westSouth");
  f.s.mobility.parking = f.s.mobility.parking.filter((lot) => lot.id !== "park-driver-west-south");
  const expected = canonicalState(f.s);
  const loaded = (await decodeSave(await encodeSave("auto", f.s))).state;
  assert.equal(canonicalState(loaded), expected);
  assert.ok(!mobilityView(loaded).parking.some((lot) => lot.id === "park-driver-west-south"));
  for (let i = 0; i < 300; i++) {
    stepWorld(f.s);
    stepWorld(loaded);
    assert.ok(!loaded.mobility.driverBreaks!.some((b) => b.bayId === "westSouth"));
  }
  assert.equal(canonicalState(f.s), canonicalState(loaded));
  assert.deepEqual(validateState(loaded), []);
  loaded.mobility.parking = loaded.mobility.parking.filter((lot) => lot.id !== "park-market");
  assert.ok(validateState(loaded).includes("invalid-parking-count"));
});

test("a driver blocked at the parked endpoint disembarks after the saved door obstruction leaves", async () => {
  const f = fixture();
  f.s.player.location = { x: BREAK_DOOR.x - 0.25, y: BREAK_DOOR.y + 0.2, scene: "outside" };
  const ingress = breakRoute("toBay", 1, "coast");
  for (let d = 0; d <= ingress.length; d += 0.01)
    assert.ok(
      personVehicleSeparation(f.s.player.location, breakRoutePose("toBay", 1, d, "coast")) > 0.1,
    );
  until(f, "disabled");
  const b = f.s.mobility.driverBreaks![0];
  assert.equal(b.disabledPhase, "toBay");
  assert.equal(b.routeProgress, ingress.length);
  assert.equal(f.v.driverId, f.p.id);
  assert.deepEqual(f.s.mobility.parking.find((l) => l.id === BREAK_PARKING_ID)!.vehicleIds, []);
  const loaded = (await decodeSave(await encodeSave("auto", f.s))).state;
  for (const s of [f.s, loaded]) {
    s.player.location = { x: 25, y: 15, scene: "outside" };
    for (let i = 0; i < 80; i++) stepWorld(s);
    assert.deepEqual(validateState(s), []);
    assert.equal(s.mobility.driverBreaks![0].phase, "walkToMarket");
    assert.equal(s.vehicles.find((v) => v.id === f.v.id)!.driverId, null);
    assert.deepEqual(s.mobility.parking.find((l) => l.id === BREAK_PARKING_ID)!.vehicleIds, [
      f.v.id,
    ]);
  }
  assert.equal(canonicalState(f.s), canonicalState(loaded));
});

test("death while waiting at the physical endpoint registers a parked body without moving it", async () => {
  const f = fixture();
  f.s.player.location = { x: BREAK_DOOR.x - 0.25, y: BREAK_DOOR.y + 0.2, scene: "outside" };
  until(f, "disabled");
  const old = { ...f.v.location };
  assert.deepEqual(f.s.mobility.parking.find((l) => l.id === BREAK_PARKING_ID)!.vehicleIds, []);
  assert.equal(processDeath(f.s, f.p.id, "test-endpoint-driver-death").ok, true);
  stepWorld(f.s);
  assert.equal(f.s.mobility.driverBreaks![0].phase, "cancelled");
  assert.deepEqual(f.v.location, old);
  assert.equal(f.v.driverId, null);
  assert.deepEqual(f.s.mobility.parking.find((l) => l.id === BREAK_PARKING_ID)!.vehicleIds, [
    f.v.id,
  ]);
  const restored = (await decodeSave(await encodeSave("auto", f.s))).state;
  for (const s of [f.s, restored]) {
    s.player.location = { x: 25, y: 15, scene: "outside" };
    for (let i = 0; i < 4000; i++) {
      stepWorld(s);
      if (s.mobility.driverBreaks![0].phase === "driving") break;
    }
    assert.equal(s.mobility.driverBreaks![0].phase, "driving");
    const recovery = s.vehicles.find((v) => v.id === f.v.id)!.driverId;
    assert.ok(recovery && recovery !== f.p.id);
    assert.deepEqual(s.mobility.parking.find((l) => l.id === BREAK_PARKING_ID)!.vehicleIds, []);
    assert.deepEqual(validateState(s), []);
  }
  assert.equal(canonicalState(restored), canonicalState(f.s));
});

test("a pedestrian occupying the authored manoeuvre stops the car before contact", () => {
  const f = fixture();
  stepWorld(f.s);
  const pedestrian = f.s.npcs[10];
  pedestrian.location = { x: 31.7, y: 53.03, scene: "outside" };
  pedestrian.path = [];
  const previous = { ...f.v.location };
  stepWorld(f.s);
  assert.deepEqual(f.v.location, previous);
  assert.equal(f.v.speed, 0);
  assert.equal(f.s.mobility.driverBreaks![0].routeProgress, 0);
  pedestrian.location = { x: 7, y: 7, scene: "b-home" };
  stepWorld(f.s);
  assert.ok(f.s.mobility.driverBreaks![0].routeProgress > 0);
  assert.deepEqual(validateState(f.s), []);
});

test("a dead driver leaves an explicit disabled connector pose which can be recovered physically", async () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) stepWorld(f.s);
  const before = { ...f.v.location };
  assert.equal(processDeath(f.s, f.p.id, "test-break-death").ok, true);
  stepWorld(f.s);
  assert.equal(f.s.mobility.driverBreaks![0].phase, "disabled");
  assert.equal(f.v.driverId, null);
  assert.equal(f.v.speed, 0);
  assert.deepEqual(f.v.location, before);
  assert.deepEqual(validateState(f.s), []);
  const loaded = (await decodeSave(await encodeSave("auto", f.s))).state;
  assert.equal(canonicalState(loaded), canonicalState(f.s));
  f.s.player.location = { x: f.v.location.x, y: f.v.location.y + 1, scene: "outside" };
  const command = applyCommand(f.s, {
    v: 1,
    id: "recover-disabled-break",
    type: "VEHICLE_ENTER",
    args: { vehicleId: f.v.id },
  });
  assert.equal(command.ok, true, command.reason);
  // Recovery finishes the inbound manoeuvre, then exits to the lane; it cannot
  // teleport or silently give the car to another NPC.
  for (let i = 0; i < 300; i++) {
    stepWorld(f.s);
    assert.deepEqual(validateState(f.s), []);
    if (String(f.s.mobility.driverBreaks![0].phase) === "cancelled") break;
  }
  assert.equal(f.v.driverId, "player");
  assert.equal(f.s.mobility.driverBreaks![0].phase, "cancelled");
});

test("seven hungry drivers, including zero-wallet n84, share four bays and finish within one game day", (t) => {
  const s = createWorld(922),
    startMinute = s.minute;
  const original = new Map(
    s.vehicles.flatMap((v) => (v.driverId ? [[v.driverId, v] as const] : [])),
  );
  assert.equal(original.size, 7);
  for (const [id, v] of original) {
    v.speed = 2.2;
    s.npcs.find((n) => n.id === id)!.hunger = 90;
  }
  assert.equal(
    transfer(s, "test-n84-wallet-loss", "n84", "external", s.accounts.n84, "fixture"),
    true,
  );
  const fed = new Map<string, number>();
  const receipts = new Map<string, (typeof s.ledger)[number]>();
  const walkBack = new Set<string>(),
    boarded = new Set<string>();
  const returned = new Map<string, number>();
  let payroll: { minutes: number; amount: number } | undefined;
  for (let i = 0; i < 45000; i++) {
    const previous = [...original.values()].map((v) => ({ v, x: v.location.x, y: v.location.y }));
    stepWorld(s);
    for (const { v, x, y } of previous)
      assert.ok(
        Math.hypot(v.location.x - x, v.location.y - y) <= 0.225,
        `vehicle ${v.id} jumped at ${s.tick}`,
      );
    if (s.tick % 10 === 0)
      for (const receipt of s.ledger.slice(-128)) {
        if (
          receipt.tick !== s.tick ||
          receipt.reason !== "food" ||
          receipt.to !== "business:market" ||
          !original.has(receipt.from)
        )
          continue;
        const hour = (startMinute + Math.floor(receipt.tick / 10)) % 1440;
        assert.ok(hour >= 360 && hour < 1380 && receipt.amount > 0);
        assert.ok(!receipts.has(receipt.id));
        receipts.set(receipt.id, receipt);
        if (!fed.has(receipt.from)) fed.set(receipt.from, receipt.tick);
      }
    for (const b of s.mobility.driverBreaks!) {
      const v = original.get(b.personId);
      if (v?.id !== b.vehicleId || b.outcome !== "fed" || !fed.has(b.personId)) continue;
      if (b.phase === "walkBack") walkBack.add(b.personId);
      if (b.phase === "fromBay" && walkBack.has(b.personId) && v.driverId === b.personId)
        boarded.add(b.personId);
      if (
        b.phase === "driving" &&
        boarded.has(b.personId) &&
        v.driverId === b.personId &&
        !returned.has(b.personId)
      ) {
        assert.ok(
          [...receipts.values()].some(
            (r) => r.from === b.personId && r.tick === b.lastMealTick && r.tick <= s.tick,
          ),
        );
        returned.set(b.personId, s.tick);
      }
    }
    const actual = s.economy.lastPayroll.find((p) => p.personId === "n84");
    if (
      actual &&
      actual.amount > 0 &&
      hasSettledTransaction(s, `salary:${Math.floor(s.minute / 1440)}:n84`)
    )
      payroll = { minutes: actual.minutes, amount: actual.amount };
    assert.deepEqual(validateDriverBreaks(s), []);
    for (const bay of DRIVER_BAYS)
      assert.ok(s.mobility.parking.find((l) => l.id === bay.parkingId)!.vehicleIds.length <= 1);
    if (i % 1000 === 0) assert.deepEqual(validateState(s), []);
    if (returned.size === original.size) break;
  }
  const times = `paid ${JSON.stringify(Object.fromEntries(fed))}; returned ${JSON.stringify(Object.fromEntries(returned))}`;
  t.diagnostic(times);
  assert.deepEqual([...fed.keys()].sort(), [...original.keys()].sort(), times);
  assert.deepEqual([...returned.keys()].sort(), [...original.keys()].sort(), times);
  assert.ok(Math.max(...returned.values()) <= 14400, `${times}; deadline 14400`);
  assert.ok(payroll && payroll.minutes > 0 && payroll.amount > 0);
  assert.deepEqual(validateState(s), []);
});

test("a player can safely leave a blocked bay manoeuvre and resume its persisted connector later", async () => {
  const f = fixture();
  until(f, "walkToMarket");
  f.s.player.location = { ...BREAK_DOOR, scene: "outside" };
  assert.equal(
    applyCommand(f.s, {
      v: 1,
      id: "blocked-take",
      type: "VEHICLE_ENTER",
      args: { vehicleId: f.v.id },
    }).ok,
    true,
  );
  const blocker = f.s.npcs[10];
  blocker.location = { x: 37.7, y: 55.16, scene: "outside" };
  blocker.path = [];
  stepWorld(f.s);
  assert.equal(f.v.speed, 0);
  const before = { ...f.v.location };
  assert.equal(
    applyCommand(f.s, { v: 1, id: "blocked-leave", type: "VEHICLE_EXIT", args: {} }).ok,
    true,
  );
  assert.equal(f.s.player.vehicleId, null);
  assert.deepEqual(f.v.location, before);
  assert.equal(f.s.mobility.driverBreaks![0].phase, "disabled");
  assert.deepEqual(validateState(f.s), []);
  const restored = (await decodeSave(await encodeSave("auto", f.s))).state;
  assert.equal(canonicalState(restored), canonicalState(f.s));
  blocker.location = { x: 7, y: 7, scene: "b-home" };
  assert.equal(
    applyCommand(f.s, {
      v: 1,
      id: "blocked-recover",
      type: "VEHICLE_ENTER",
      args: { vehicleId: f.v.id },
    }).ok,
    true,
  );
  for (let i = 0; i < 100; i++) {
    stepWorld(f.s);
    if (String(f.s.mobility.driverBreaks![0].phase) === "cancelled") break;
  }
  assert.equal(f.v.driverId, "player");
  assert.equal(f.s.mobility.driverBreaks![0].phase, "cancelled");
  assert.deepEqual(validateState(f.s), []);
});

test("a living driver keeps the parked car across a blocked walk-back timeout and replay", async () => {
  const f = fixture();
  until(f, "walkBack");
  const b = f.s.mobility.driverBreaks![0],
    blocker = f.s.npcs.find((n) => n.id === "n3")!;
  f.p.location = { x: 5, y: 7, scene: "b-market" };
  f.p.path = [];
  f.p.lastDecision = f.s.minute - 60;
  const marketDoor = BUILDINGS.find((x) => x.id === "b-market")!.door;
  blocker.location = { ...marketDoor, scene: "outside" };
  b.lastPosition = { ...f.p.location };
  b.lastProgressAt = f.s.tick;
  for (let i = 0; i < 1810; i++) stepWorld(f.s);
  assert.equal(b.phase, "walkBack");
  assert.equal(b.recoveryAttempts, 1);
  assert.equal(b.personId, f.p.id);
  assert.equal(b.outcome, "fed");
  assert.equal(f.v.driverId, null);
  assert.deepEqual(f.s.mobility.parking.find((p) => p.id === BREAK_PARKING_ID)!.vehicleIds, [
    f.v.id,
  ]);
  const restored = (await decodeSave(await encodeSave("auto", f.s))).state;
  for (const s of [f.s, restored]) {
    s.npcs.find((n) => n.id === blocker.id)!.location = { x: 7, y: 7, scene: "b-home" };
    for (let i = 0; i < 3500; i++) {
      stepWorld(s);
      if (s.mobility.driverBreaks![0].phase === "driving") break;
    }
    assert.equal(s.mobility.driverBreaks![0].phase, "driving");
    assert.equal(s.vehicles.find((v) => v.id === f.v.id)!.driverId, f.p.id);
    assert.deepEqual(validateState(s), []);
  }
  assert.equal(canonicalState(restored), canonicalState(f.s));
});

test("exhausted walking retries release a living driver to their routine and later recover their own car", async () => {
  const f = fixture();
  until(f, "walkBack");
  const b = f.s.mobility.driverBreaks![0],
    blocker = f.s.npcs.find((n) => n.id === "n3")!;
  const paidTick = b.lastMealTick,
    old = { ...f.v.location };
  f.p.location = { x: 5, y: 7, scene: "b-market" };
  f.p.path = [];
  f.p.lastDecision = f.s.minute - 60;
  blocker.location = { ...BUILDINGS.find((x) => x.id === "b-market")!.door, scene: "outside" };
  until(f, "awaitReturn", 5700);
  assert.equal(b.personId, f.p.id);
  assert.equal(b.lastMealTick, paidTick);
  assert.notEqual(f.p.goal, "returnToCar");
  assert.deepEqual(f.v.location, old);
  const restored = (await decodeSave(await encodeSave("auto", f.s))).state;
  for (const s of [f.s, restored]) {
    for (let i = 0; i < 1000; i++) stepWorld(s);
    const waiting = s.mobility.driverBreaks![0];
    assert.equal(waiting.phase, "awaitReturn");
    assert.equal(waiting.personId, f.p.id);
    assert.equal(waiting.lastMealTick, paidTick);
    assert.deepEqual(s.mobility.parking.find((l) => l.id === BREAK_PARKING_ID)!.vehicleIds, [
      f.v.id,
    ]);
    s.npcs.find((p) => p.id === blocker.id)!.location = { x: 7, y: 7, scene: "b-home" };
    for (let i = 0; i < 4500; i++) {
      stepWorld(s);
      if (s.mobility.driverBreaks![0].phase === "driving") break;
    }
    const completed = s.mobility.driverBreaks![0];
    assert.equal(completed.phase, "driving");
    assert.equal(completed.outcome, "fed");
    assert.equal(completed.lastMealTick, paidTick);
    assert.equal(s.vehicles.find((v) => v.id === f.v.id)!.driverId, f.p.id);
    assert.deepEqual(validateState(s), []);
  }
  assert.equal(canonicalState(restored), canonicalState(f.s));
});

test("death during the meal walk dispatches a real local adult who walks to and clears the same parked car", () => {
  const f = fixture();
  until(f, "walkToMarket");
  const before = { ...f.v.location };
  assert.equal(processDeath(f.s, f.p.id, "test-parked-driver-death").ok, true);
  stepWorld(f.s);
  assert.deepEqual(f.v.location, before);
  assert.equal(f.v.driverId, null);
  for (let i = 0; i < 25 && f.s.mobility.driverBreaks![0].personId === f.p.id; i++) stepWorld(f.s);
  const replacement = f.s.mobility.driverBreaks![0].personId;
  assert.notEqual(replacement, f.p.id);
  assert.equal(f.v.driverId, null);
  assert.deepEqual(f.v.location, before);
  for (let i = 0; i < 4000; i++) {
    stepWorld(f.s);
    if (f.s.mobility.driverBreaks![0].phase === "driving") break;
  }
  assert.equal(f.v.driverId, replacement);
  assert.equal(f.s.mobility.driverBreaks![0].phase, "driving");
  assert.equal(f.s.mobility.driverBreaks![0].lastMealTick, null);
  assert.deepEqual(f.s.mobility.parking.find((p) => p.id === BREAK_PARKING_ID)!.vehicleIds, []);
  assert.deepEqual(validateState(f.s), []);
});

test("a permanently closed economy bounds the work release and returns unfed without an invented wage", () => {
  const f = fixture(0, "n84");
  transfer(f.s, "test-no-economy", f.p.id, "external", f.s.accounts[f.p.id], "fixture");
  until(f, "routine");
  for (const business of f.s.businesses) business.status = "closed";
  let finished = false;
  for (let i = 0; i < 19000; i++) {
    stepWorld(f.s);
    const b = f.s.mobility.driverBreaks![0];
    if (b.phase === "driving") {
      finished = true;
      break;
    }
  }
  assert.ok(finished);
  assert.equal(f.p.income, 0);
  assert.equal(f.s.mobility.driverBreaks![0].lastMealTick, null);
  assert.equal(f.s.mobility.driverBreaks![0].outcome, "unaffordable");
  assert.deepEqual(validateState(f.s), []);
});

test("east ingress reserves its real curved corridor before an opposing lane can trap it", async () => {
  const scenario = () => {
    const f = fixture(3, "n83", "east");
    const n = f.s.npcs.find((p) => p.id === "n84")!;
    const makeOpposing = (progress = 30.64) => {
      const pose = trafficPose(0, progress);
      const opponent = {
        ...f.v,
        id: "opposing-v4",
        driverId: n.id,
        lane: 0,
        progress,
        speed: 2.2,
        heading: pose.heading,
        location: { x: pose.x, y: pose.y, scene: "outside" },
      };
      n.goal = "drive";
      n.location = { ...opponent.location };
      f.s.vehicles.push(opponent);
      return opponent;
    };
    return { f, makeOpposing };
  };
  {
    const { f, makeOpposing } = scenario(),
      opponent = makeOpposing();
    const route = breakRoute("toBay", 3, "east");
    assert.ok(
      vehicleSeparation(
        { ...f.v.location, heading: f.v.heading },
        { ...opponent.location, heading: opponent.heading },
      ) > 0,
    );
    assert.ok(
      route.connectorPoses.some(
        (p) => vehicleSeparation(p, { ...opponent.location, heading: opponent.heading }) < 0.15,
      ),
    );
    stepWorld(f.s);
    assert.equal(f.s.mobility.driverBreaks!.find((b) => b.vehicleId === f.v.id)!.phase, "seeking");
    assert.ok(opponent.progress > 30.64);
    assert.deepEqual(validateState(f.s), []);
  }
  {
    const { f, makeOpposing } = scenario();
    stepWorld(f.s);
    assert.equal(f.s.mobility.driverBreaks![0].phase, "toBay");
    // Spawn on the approaching lane outside both the physical and junction
    // reservations. A real road user cannot appear inside an owned zone.
    const opponent = makeOpposing(20.4);
    assert.ok(trafficContext(f.s).mergeCorridors.some((corridor) => corridor.vehicleId === f.v.id));
    const restored = (await decodeSave(await encodeSave("auto", f.s))).state;
    let reservedYield = false;
    for (let i = 0; i < 220; i++) {
      const next = trafficPose(0, opponent.progress + Math.max(opponent.speed, 0.22) * 0.1);
      const context = trafficContext(f.s);
      if (
        vehicleSweepClear(opponent, next, f.v) &&
        mayAdvanceVehicle(f.s, opponent, next, { ...context, mergeCorridors: [] }) &&
        !mayAdvanceVehicle(f.s, opponent, next, context)
      )
        reservedYield = true;
      stepWorld(f.s);
      stepWorld(restored);
      assert.ok(
        vehicleSeparation(
          { ...f.v.location, heading: f.v.heading },
          { ...opponent.location, heading: opponent.heading },
        ) >= -0.00001,
      );
    }
    assert.ok(reservedYield);
    assert.equal(canonicalState(f.s), canonicalState(restored));
    assert.ok(["walkToMarket", "queue", "walkBack"].includes(f.s.mobility.driverBreaks![0].phase));
    assert.deepEqual(validateState(f.s), []);
  }
});

test("east bay waits fully out of the lane for a real gap before reserving its complete merge corridor", () => {
  const f = fixture(1, "n81", "east");
  until(f, "fromBay");
  const pose = trafficPose(1, 57),
    blocker = {
      ...f.v,
      id: "merge-following-car",
      driverId: "n82",
      location: { x: pose.x, y: pose.y, scene: "outside" },
      lane: 1,
      progress: 57,
      heading: pose.heading,
      speed: 2.2,
    };
  f.s.vehicles.push(blocker);
  const other = f.s.npcs[82];
  other.location = { ...blocker.location };
  other.goal = "drive";
  const parked = { ...f.v.location };
  stepWorld(f.s);
  assert.deepEqual(f.v.location, parked);
  assert.equal(f.s.mobility.driverBreaks![0].routeProgress, 0);
  assert.ok(blocker.location.y < 21);
  for (let i = 0; i < 150; i++) {
    stepWorld(f.s);
    assert.deepEqual(validateState(f.s), []);
    if (f.s.mobility.driverBreaks![0].phase === "driving") break;
  }
  assert.equal(f.s.mobility.driverBreaks![0].phase, "driving");
  assert.equal(f.v.lane, 1);
});

test("an unreachable first-meal request cannot veto another driver's real repeat meal", () => {
  const f = fixture(1);
  until(f, "driving");
  const first = f.s.mobility.driverBreaks![0].lastMealTick!;
  assert.ok(first > 0);
  const p = f.s.npcs[82],
    pose = trafficPose(0, 6.9),
    block = trafficPose(0, 9.901);
  const stalled = {
    ...f.v,
    id: "v2",
    driverId: p.id,
    lane: 0,
    progress: 6.9,
    heading: pose.heading,
    speed: 0,
    resumeSpeed: 2.6,
    location: { x: pose.x, y: pose.y, scene: "outside" },
  };
  f.s.vehicles.push(stalled, {
    ...f.v,
    id: "fixture-blocker",
    driverId: null,
    lane: 0,
    progress: 9.901,
    heading: block.heading,
    speed: 0,
    location: { x: block.x, y: block.y, scene: "outside" },
  });
  p.location = { ...stalled.location };
  p.goal = "drive";
  p.hunger = 90;
  for (let tick = 0; tick < 7000; tick++) {
    stepWorld(f.s);
    if ((f.s.mobility.driverBreaks!.find((b) => b.vehicleId === f.v.id)!.lastMealTick ?? 0) > first)
      break;
  }
  const repeated = f.s.mobility.driverBreaks!.find((b) => b.vehicleId === f.v.id)!;
  assert.ok((repeated.lastMealTick ?? 0) > first);
  assert.equal(
    f.s.mobility.driverBreaks!.find((b) => b.vehicleId === stalled.id)!.lastMealTick,
    null,
  );
  assert.equal(f.s.ledger.filter((e) => e.from === f.p.id && e.reason === "food").length, 2);
  assert.deepEqual(validateState(f.s), []);
});

test("a timed-out roadside manoeuvre retains its actual driver and resumes from the saved pose after the blocker leaves", async () => {
  const f = fixture(1);
  stepWorld(f.s);
  const blocker = f.s.npcs[10];
  for (let cycle = 0; cycle < 4; cycle++) {
    const stopped = { ...f.v.location };
    blocker.location = {
      x: stopped.x + Math.cos(f.v.heading) * 1.79,
      y: stopped.y + Math.sin(f.v.heading) * 1.79,
      scene: "outside",
    };
    blocker.path = [];
    blocker.destination = null;
    until(f, "disabled", 2000);
    assert.deepEqual(f.v.location, stopped);
    assert.equal(f.v.driverId, f.p.id);
    assert.equal(f.v.speed, 0);
    assert.equal(f.s.mobility.driverBreaks![0].recoveryAttempts, cycle);
    if (cycle === 3) break;
    blocker.location = { x: 7, y: 7, scene: "b-home" };
    until(f, "toBay", 200);
    assert.ok(
      Math.hypot(f.v.location.x - stopped.x, f.v.location.y - stopped.y) > 0,
      "resume applies a physical advance atomically",
    );
  }
  const restored = (await decodeSave(await encodeSave("auto", f.s))).state;
  blocker.location = { x: 7, y: 7, scene: "b-home" };
  restored.npcs[10].location = { ...blocker.location };
  let moved = false;
  for (let i = 0; i < 180; i++) {
    const previous = { ...f.v.location };
    stepWorld(f.s);
    stepWorld(restored);
    const d = Math.hypot(f.v.location.x - previous.x, f.v.location.y - previous.y);
    assert.ok(d < 0.125);
    if (d > 0) moved = true;
  }
  assert.ok(moved);
  assert.equal(
    f.s.mobility.driverBreaks![0].recoveryAttempts,
    0,
    "actual half-metre progress renews the obstruction budget",
  );
  assert.equal(canonicalState(restored), canonicalState(f.s));
  assert.deepEqual(validateState(f.s), []);
});
