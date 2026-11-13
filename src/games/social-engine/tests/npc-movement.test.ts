import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, stepWorld, canonicalState, validateState } from "../simulation/engine.ts";
import { emit } from "../simulation/events.ts";
import { tickSocial } from "../simulation/social.ts";
import { canonical } from "../simulation/random.ts";
import { economyMinute } from "../simulation/economy.ts";
import { transfer } from "../simulation/ledger.ts";
import { npcMovement, societyMinute } from "../simulation/society.ts";
import { breakEntry, breakRoutePose } from "../domain/driver-breaks.ts";
import { canonicalHeading, trafficPose } from "../domain/traffic.ts";
import {
  crossingVehicleTurn,
  pedestrianCrossingTraffic,
} from "../simulation/pedestrian-crossing.ts";
import { mayAdvanceVehicle } from "../simulation/traffic.ts";
import { personVehicleSeparation } from "../simulation/vehicle-collision.ts";
import { npcMovementTraits } from "../simulation/npc-traits.ts";
import {
  pedestrianPath,
  pedestrianCurbReliefPoint,
  pedestrianSegment,
  pedestrianWalkable,
  pedestrianYieldPoint,
} from "../simulation/pedestrian-navigation.ts";
import { BUILDINGS, isRoad, isWalkable } from "../domain/world.ts";
import { encodeSave, decodeSave } from "../persistence/codec.ts";

test("all 196 door pairs have legal pavement and crossing routes, with no wall cuts", () => {
  for (const a of BUILDINGS)
    for (const b of BUILDINGS) {
      const path = pedestrianPath(a.door, b.door);
      assert.ok(path.length, `${a.id}>${b.id}`);
      let from = a.door;
      for (const p of path) {
        assert.ok(pedestrianSegment(from, p), `${a.id}>${b.id}`);
        from = p;
      }
      assert.deepEqual(path.at(-1), b.door);
    }
});

test("a walkable exact pavement corner escapes an invalid rounded grid cell without crossing the road off the crossing", () => {
  // Natural seed 922, tick 22000: n91 was stuck here and physically held the
  // whole northern junction until the exact point could reach a valid anchor.
  const from = { x: 15.999388, y: 20.12532 },
    to = { x: 27, y: 14.7 };
  const obstacles = [{ x: 17, y: 21.862, heading: -1.570796327 }];
  assert.ok(pedestrianWalkable(from));
  assert.equal(pedestrianWalkable({ x: 16, y: 20 }), false);
  const path = pedestrianPath(from, to, obstacles);
  assert.ok(path.length > 1);
  assert.deepEqual(path.at(-1), to);
  for (let i = 0; i < path.length; i++)
    assert.ok(pedestrianSegment(i ? path[i - 1] : from, path[i], obstacles));
});

test("an actor with no complete destination route can take a legal short step away from a stopped vehicle", () => {
  // Exact n35/v2 blocker from seed 920 at tick 17795. A blocked market
  // destination must not pin the actor to the active carriageway envelope.
  const from = { x: 20.039254, y: 20.005666 },
    v2 = { x: 19, y: 18.284, heading: 1.570796327 };
  const target = pedestrianYieldPoint(from, [v2], [v2], []);
  assert.ok(target);
  assert.ok(target.x > 20);
  assert.ok(target.y > 20);
  assert.ok(pedestrianSegment(from, target, [v2]));
  assert.ok(Math.hypot(target.x - from.x, target.y - from.y) < 1.65);
  assert.equal(pedestrianYieldPoint({ x: 25, y: 22 }, [v2], [v2], []), null);
});
test("a narrow pavement gap lets the blocked market crowd release a real yielding car", () => {
  // Reconstructed local positions from untouched seed 920 at tick 16800.
  const s = createWorld(920),
    n6 = s.npcs.find((p) => p.id === "n6")!;
  const v4 = s.vehicles.find((v) => v.id === "v4")!;
  const crowd = [
    ["n9", 28.5, 15],
    ["n21", 29.202307, 15.352073],
    ["n22", 27.12011, 14.282427],
    ["n46", 29.167579, 14.81647],
    ["n51", 26.5, 15],
    ["n62", 29.113611, 14.318135],
    ["n63", 27.705776, 15.217554],
    ["n79", 28.573533, 14.312547],
    ["n83", 27.994313, 14.723744],
    ["n98", 27.458977, 14.706725],
  ] as const;
  s.vehicles = s.vehicles.filter((v) => v === v4 || !v.driverId);
  for (const p of s.npcs.slice(0, 100)) {
    p.location = { x: 7, y: 7, scene: "b-home" };
    p.destination = null;
    p.path = [];
    p.lastDecision = 100000;
  }
  for (const [id, x, y] of crowd)
    s.npcs.find((p) => p.id === id)!.location = { x, y, scene: "outside" };
  const origin = { x: 29.207461, y: 15.943502 };
  n6.location = { ...origin, scene: "outside" };
  n6.destination = { x: 26.5, y: 31.7 };
  n6.goal = "work";
  const progress = 10.51,
    pose = trafficPose(0, progress);
  Object.assign(v4, {
    lane: 0,
    progress,
    location: { x: pose.x, y: pose.y, scene: "outside" },
    heading: pose.heading,
    speed: 0,
    resumeSpeed: 2.2,
  });
  s.npcs.find((p) => p.id === v4.driverId)!.location = { ...v4.location };
  const body = { ...v4.location, heading: v4.heading };
  assert.ok(personVehicleSeparation(origin, body) < 0.01);
  for (let i = 0; i < 50; i++) {
    const before = { ...n6.location };
    stepWorld(s);
    assert.ok(pedestrianSegment(before, n6.location));
    assert.ok(
      personVehicleSeparation(n6.location, { ...v4.location, heading: v4.heading }) >= -0.00001,
    );
    for (const [id] of crowd) {
      const p = s.npcs.find((p) => p.id === id)!;
      assert.ok(Math.hypot(n6.location.x - p.location.x, n6.location.y - p.location.y) >= 0.5);
    }
    if (v4.progress > progress + 0.5) break;
  }
  assert.ok(v4.progress > progress + 0.5);
  assert.deepEqual(n6.destination, { x: 26.5, y: 31.7 });
});

test("a pedestrian already inside a marked crossing can clear two waiting car bodies in stages", () => {
  // Local reconstruction of natural seed 920 at tick 18000 with two cars.
  const s = createWorld(920),
    actor = s.npcs.find((p) => p.id === "n66")!;
  s.vehicles = s.vehicles.filter((v) => ["v0", "v4", "v5", "v-rental-0"].includes(v.id));
  for (const p of s.npcs.slice(0, 100)) {
    p.location = { x: 7, y: 7, scene: "b-home" };
    p.destination = null;
    p.path = [];
    p.lastDecision = 100000;
  }
  for (const [id, x, y] of [
    ["n20", 27.641607, 17.849045],
    ["n96", 27.496473, 16.136916],
    ["n10", 27.510944, 15.549691],
  ] as const)
    s.npcs.find((p) => p.id === id)!.location = { x, y, scene: "outside" };
  for (const id of ["n20", "n10"]) {
    const p = s.npcs.find((p) => p.id === id)!;
    p.destination = { x: 27, y: 14.7 };
    p.path = [{ ...p.destination }];
    p.goal = "work";
  }
  const n96 = s.npcs.find((p) => p.id === "n96")!;
  n96.destination = { x: 26.5, y: 31.7 };
  n96.goal = "work";
  for (const [id, lane, progress, speed] of [
    ["v4", 0, 7.936, 2.2],
    ["v5", 1, 74.706, 2.6],
  ] as const) {
    const car = s.vehicles.find((v) => v.id === id)!,
      pose = trafficPose(lane, progress);
    Object.assign(car, {
      lane,
      progress,
      location: { x: pose.x, y: pose.y, scene: "outside" },
      heading: pose.heading,
      speed: 0,
      resumeSpeed: speed,
    });
    s.npcs.find((p) => p.id === car.driverId)!.location = { ...car.location };
  }
  actor.location = { x: 26.716892, y: 17.84392, scene: "outside" };
  actor.destination = { x: 26.5, y: 31.7 };
  actor.goal = "work";
  const initial = { ...actor.location };
  const driving = s.vehicles.filter((v) => v.driverId);
  assert.ok(isRoad(actor.location));
  const starting = driving.map((v) => v.progress);
  let leftRoad = false;
  for (let i = 0; i < 180; i++) {
    const before = { ...actor.location };
    stepWorld(s);
    assert.ok(pedestrianSegment(before, actor.location));
    assert.ok(
      Math.hypot(before.x - actor.location.x, before.y - actor.location.y) <=
        0.105 * npcMovementTraits(s.seed, actor.id).speed + 0.00001,
    );
    for (const car of s.vehicles)
      assert.ok(
        personVehicleSeparation(actor.location, { ...car.location, heading: car.heading }) >=
          -0.00001,
      );
    if (!isRoad(actor.location)) leftRoad = true;
    if (leftRoad && driving.some((v, k) => v.progress > starting[k] + 0.5)) break;
  }
  assert.ok(
    leftRoad,
    `actor never cleared the marked crossing: ${JSON.stringify({ initial, current: actor.location, path: actor.path })}`,
  );
  assert.ok(driving.some((v, k) => v.progress > starting[k] + 0.5));
  assert.deepEqual(actor.destination, { x: 26.5, y: 31.7 });
});

test("a blocked curb walker makes physical room for an actor to exit the marked crossing", () => {
  const curb = { x: 27.126921, y: 15.983843 };
  const crossing = { x: 27.618779, y: 16.218332 };
  const neighbours = [
    crossing,
    { x: 27.375766, y: 15.511614 },
    { x: 26.717363, y: 16.583377 },
    { x: 26.142679, y: 15.649108 },
    { x: 28.113935, y: 15.935137 },
    { x: 27.183176, y: 15.0183 },
    { x: 27.955028, y: 15.318924 },
  ];
  const cars = [
    { x: 24.936, y: 17, heading: 0 },
    { x: 28.294, y: 19, heading: Math.PI },
    { x: 31, y: 15.2, heading: 0 },
  ];
  const cleared = pedestrianCurbReliefPoint(curb, cars, neighbours);
  assert.ok(cleared);
  assert.ok(!isRoad(cleared));
  assert.ok(pedestrianSegment(curb, cleared, cars));
  assert.ok(Math.hypot(cleared.x - crossing.x, cleared.y - crossing.y) >= 0.92);
  for (let i = 0; i <= 20; i++) {
    const step = {
      x: curb.x + ((cleared.x - curb.x) * i) / 20,
      y: curb.y + ((cleared.y - curb.y) * i) / 20,
    };
    for (const p of neighbours) assert.ok(Math.hypot(step.x - p.x, step.y - p.y) >= 0.5);
  }
  assert.equal(
    pedestrianCurbReliefPoint(
      curb,
      cars,
      neighbours.filter((p) => !isRoad(p)),
    ),
    null,
  );
});

test("a far walker uses its actual movement slot to clear a disabled car route", async () => {
  // Natural early-request seed 922, tick 18000. The old yield slot (9)
  // and this actor's far movement slot (3) never intersected.
  const s = createWorld(922);
  const car = s.vehicles.find((v) => v.id === "v6")!;
  const actor = s.npcs.find((p) => p.id === "n71")!;
  const driver = s.npcs.find((p) => p.id === "n86")!;
  s.vehicles = s.vehicles.filter((v) => v === car || !v.driverId);
  for (const p of s.npcs.slice(0, 100)) {
    p.location = { x: 7, y: 7, scene: "b-home" };
    p.destination = null;
    p.path = [];
    p.lastDecision = 100000;
  }
  actor.location = { x: 16.541088, y: 32.945799, scene: "outside" };
  actor.destination = { x: 27, y: 14.7 };
  actor.goal = "eat";
  assert.ok(
    Math.hypot(actor.location.x - s.player.location.x, actor.location.y - s.player.location.y) > 16,
  );
  assert.equal(Math.floor(npcMovementTraits(s.seed, actor.id).phase * 10), 3);
  const progress = 4.26,
    pose = breakRoutePose("toBay", 2, progress, "west");
  Object.assign(car, {
    lane: 2,
    progress: breakEntry(2, "west").progress,
    location: { x: pose.x, y: pose.y, scene: "outside" },
    heading: pose.heading,
    speed: 0,
  });
  driver.location = { ...car.location };
  s.mobility.driverBreaks = [
    {
      bayId: "west",
      personId: driver.id,
      vehicleId: car.id,
      phase: "disabled",
      originalLane: 2,
      workRelease: false,
      lastProgressAt: 0,
      lastPosition: { ...driver.location },
      recoveryAttempts: 0,
      recoveryFor: null,
      disabledPhase: "toBay",
      suspendedOutcome: "none",
      cruiseSpeed: 1.8,
      routeProgress: progress,
      requestedAt: 0,
      expiresAt: 12000,
      cooldownUntil: 0,
      lastMealTick: null,
      mealJoinedTick: null,
      outcome: "cancelled",
    },
  ];
  stepWorld(s);
  stepWorld(s);
  const restored = (await decodeSave(await encodeSave("auto", s))).state;
  for (let i = 0; i < 45; i++) {
    const before = { ...actor.location };
    stepWorld(s);
    stepWorld(restored);
    assert.ok(pedestrianSegment(before, actor.location));
    assert.ok(
      personVehicleSeparation(actor.location, { ...car.location, heading: car.heading }) >=
        -0.00001,
    );
  }
  assert.ok(!isRoad(actor.location));
  assert.ok(s.mobility.driverBreaks[0].routeProgress > progress + 0.5);
  assert.deepEqual(actor.destination, { x: 27, y: 14.7 });
  assert.deepEqual(validateState(s), []);
  assert.equal(canonicalState(s), canonicalState(restored));
});

test("marked crossings give a waiting car a turn without blocking pedestrians already crossing", () => {
  const s = createWorld(922),
    car = s.vehicles.find((v) => v.id === "v4")!,
    person = s.npcs.find((p) => p.id === "n10")!;
  s.vehicles = s.vehicles.filter((v) => v === car || !v.driverId);
  for (const p of s.npcs.slice(0, 100)) {
    p.location = { x: 7, y: 7, scene: "b-home" };
    p.lastDecision = 100000;
    p.path = [];
    p.destination = null;
  }
  const setPose = (progress: number) => {
    const pose = trafficPose(0, progress);
    Object.assign(car, {
      location: { x: pose.x, y: pose.y, scene: "outside" },
      heading: pose.heading,
      lane: 0,
      progress,
      speed: 0,
      resumeSpeed: 2.2,
    });
    s.npcs.find((p) => p.id === car.driverId)!.location = { ...car.location };
  };
  setPose(7.4);
  person.location = { x: 27, y: 15.8, scene: "outside" };
  person.destination = { x: 27, y: 21 };
  person.path = [{ ...person.destination }];
  const drivers = new Set(s.vehicles.map((v) => v.driverId)),
    next = { x: 27, y: 16.05 };
  const mayWalk = () =>
    pedestrianCrossingTraffic(s, s.npcs.slice(0, 100), drivers).mayWalk(person, next);
  s.tick = 0;
  assert.equal(crossingVehicleTurn(s.tick, 18, 27), false);
  assert.equal(mayWalk(), true);
  assert.equal(
    mayAdvanceVehicle(s, car, trafficPose(0, 7.422)),
    false,
    "an approaching walker may claim a free crossing",
  );
  s.tick = 20;
  assert.equal(crossingVehicleTurn(s.tick, 18, 27), true);
  assert.equal(mayWalk(), false);
  assert.equal(mayAdvanceVehicle(s, car, trafficPose(0, 7.422)), true);
  person.location = { x: 27, y: 16.5, scene: "outside" };
  assert.equal(mayWalk(), true, "someone physically inside must retain the exit");
  assert.equal(mayAdvanceVehicle(s, car, trafficPose(0, 7.422)), false);
  let pedestrianClear = false;
  for (let i = 0; i < 150; i++) {
    stepWorld(s);
    if (person.location.y > 20) pedestrianClear = true;
    assert.ok(
      personVehicleSeparation(person.location, { ...car.location, heading: car.heading }) >=
        -0.00001,
    );
    if (car.progress > 7.9 && pedestrianClear) break;
  }
  assert.ok(pedestrianClear && car.progress > 7.9);
  setPose(9.334);
  s.tick = 0;
  person.location = { x: 27, y: 15.8, scene: "outside" };
  person.path = [{ x: 27, y: 21 }];
  assert.equal(mayWalk(), false, "a physically committed vehicle can clear after its turn changes");
  setPose(7.4);
  s.tick = 20;
  person.location = { x: 7, y: 7, scene: "b-home" };
  s.player.location = { x: 27, y: 15.8, scene: "outside" };
  s.flags.moveY = 1;
  assert.equal(
    mayAdvanceVehicle(s, car, trafficPose(0, 7.422)),
    false,
    "player curb intent remains protected",
  );
});

test("a stalled walker can replace an existing path that grazes a real stopped bumper", () => {
  const s = createWorld(920),
    walker = s.npcs.find((p) => p.id === "n84")!,
    car = s.vehicles.find((v) => v.id === "v7")!;
  s.vehicles = s.vehicles.filter((v) => v === car || !v.driverId);
  for (const p of s.npcs.slice(0, 100)) {
    p.location = { x: 7, y: 7, scene: "b-home" };
    p.lastDecision = 100000;
    p.path = [];
    p.destination = null;
  }
  const progress = 58.86,
    pose = trafficPose(3, progress);
  Object.assign(car, {
    location: { x: pose.x, y: pose.y, scene: "outside" },
    heading: pose.heading,
    lane: 3,
    progress,
    speed: 0,
    resumeSpeed: 2.2,
  });
  s.npcs.find((p) => p.id === car.driverId)!.location = { ...car.location };
  const before = { x: 26.351344, y: 19.783815 };
  walker.location = { ...before, scene: "outside" };
  walker.destination = { x: 37, y: 56.5 };
  walker.path = [{ x: 26.5, y: 21 }, { x: 30.5, y: 22.5 }, { ...walker.destination }];
  walker.goal = "returnToCar";
  const body = { ...car.location, heading: car.heading };
  assert.ok(
    pedestrianSegment(before, walker.path[0], [body]),
    "coarse planning misses the tiny intersection",
  );
  assert.equal(pedestrianSegment(before, walker.path[0], [body], 0.02), false);
  for (let i = 0; i < 100; i++) {
    const previous = { ...walker.location };
    stepWorld(s);
    assert.ok(pedestrianSegment(previous, walker.location, [], 0.02));
    assert.ok(
      personVehicleSeparation(walker.location, { ...car.location, heading: car.heading }) >=
        -0.00001,
    );
    if (car.progress > progress + 0.5) break;
  }
  assert.ok(walker.location.y > 20);
  assert.ok(car.progress > progress + 0.5);
  assert.deepEqual(walker.destination, { x: 37, y: 56.5 });
  assert.deepEqual(validateState(s), []);
});

test("100 active and 1000 background citizens retain unique IDs and seeded, order-independent traits", () => {
  const s = createWorld(922),
    locals = s.npcs.filter((n) => n.local);
  assert.equal(locals.length, 100);
  assert.equal(s.npcs.length, 1100);
  assert.equal(new Set(s.npcs.map((n) => n.id)).size, 1100);
  assert.equal(new Set(locals.map((n) => `${n.location.x}:${n.location.y}`)).size, 100);
  assert.ok(locals.every((n) => isWalkable(n.location)));
  const traits = locals.map((n) => npcMovementTraits(s.seed, n.id));
  assert.ok(new Set(traits.map((t) => t.speed)).size >= 30);
  assert.ok(new Set(traits.map((t) => t.scheduleOffset)).size >= 50);
  assert.ok(new Set(traits.map((t) => t.phase)).size >= 80);
  assert.equal(new Set(traits.map((t) => t.socialVenue)).size, 4);
  assert.deepEqual(
    locals
      .slice()
      .reverse()
      .map((n) => npcMovementTraits(s.seed, n.id))
      .reverse(),
    traits,
  );
});
test("30-person doorway crowd clears without lockstep admissions or duplicate people", () => {
  const s = createWorld(924),
    door = BUILDINGS.find((b) => b.id === "b-market")!.door;
  for (const v of s.vehicles) {
    v.driverId = null;
    v.location = { x: 60, y: 55, scene: "outside" };
  }
  s.minute = 600;
  s.player.location = { x: 32, y: 15, scene: "outside" };
  for (let i = 0; i < s.npcs.length; i++) {
    const n = s.npcs[i];
    n.alive = i < 30;
    n.goal = "walk";
    n.lastDecision = 100000;
    if (i < 30) {
      n.location = {
        x: 21 + (i % 10) * 0.65,
        y: 14.5 + Math.floor(i / 10) * 0.6,
        scene: "outside",
      };
      // Start on safe crossing or pavement, as in an existing save.
      if (!pedestrianWalkable(n.location))
        n.location = {
          x: 26.5 + Math.floor(i / 10) * 0.5,
          y: 16 + (i % 10) * 0.6,
          scene: "outside",
        };
      n.destination = { ...door };
      n.path = pedestrianPath(n.location, door);
    }
  }
  const admitted = new Map<string, number>();
  for (let tick = 1; tick <= 2400; tick++) {
    s.tick = tick;
    npcMovement(s);
    for (const n of s.npcs.slice(0, 30))
      if (n.location.scene === "b-market" && !admitted.has(n.id)) admitted.set(n.id, tick);
  }
  assert.equal(
    admitted.size,
    30,
    `admitted ${admitted.size}; remaining ${JSON.stringify(
      s.npcs
        .slice(0, 30)
        .filter((n) => !admitted.has(n.id))
        .map((n) => ({ id: n.id, location: n.location, path: n.path })),
    )}`,
  );
  const ticks = [...admitted.values()].sort((a, b) => a - b);
  for (let i = 1; i < ticks.length; i++) assert.ok(ticks[i] - ticks[i - 1] >= 6);
  assert.equal(s.npcs.length, 1100);
});
test("NPC doorway queues and seeded movement resume identically after compressed save", async () => {
  const a = createWorld(925);
  for (let i = 0; i < 400; i++) stepWorld(a);
  const b = (await decodeSave(await encodeSave("auto", a))).state;
  for (let i = 0; i < 600; i++) {
    stepWorld(a);
    stepWorld(b);
  }
  assert.equal(canonicalState(a), canonicalState(b));
  assert.deepEqual(validateState(a), []);
});
test("physical NPC LOD leaves all 1000 background locations untouched", () => {
  const s = createWorld(926),
    initial = structuredClone(s.npcs.slice(100).map((n) => n.location));
  for (let i = 0; i < 100; i++) {
    s.tick++;
    npcMovement(s);
  }
  assert.deepEqual(
    s.npcs.slice(100).map((n) => n.location),
    initial,
  );
});

test("shared-door departures retain one physical person and a persisted six-tick admission gap", () => {
  const s = createWorld(927),
    home = BUILDINGS.find((b) => b.id === "b-home")!;
  s.minute = 600;
  s.player.location = { x: 10, y: 15, scene: "outside" };
  for (const v of s.vehicles) {
    v.driverId = null;
    v.location = { x: 60, y: 55, scene: "outside" };
  }
  for (let i = 0; i < s.npcs.length; i++) {
    const n = s.npcs[i];
    n.alive = i < 20;
    n.goal = "idle";
    n.lastDecision = -100;
    n.location = { x: 7, y: 9, scene: home.id };
    n.path = [];
    n.destination = null;
  }
  const departed = new Map<string, number>();
  for (let tick = 1; tick <= 1800; tick++) {
    s.tick = tick;
    npcMovement(s);
    for (const n of s.npcs.slice(0, 20))
      if (n.location.scene !== home.id && !departed.has(n.id)) departed.set(n.id, tick);
  }
  assert.equal(departed.size, 20);
  const ticks = [...departed.values()].sort((a, b) => a - b);
  for (let i = 1; i < ticks.length; i++) assert.ok(ticks[i] - ticks[i - 1] >= 6);
  assert.ok(Number.isInteger(s.flags[`npcDoorTick:${home.id}`]));
});

test("a stationary car blocking a narrow crosswalk produces a legal alternate crossing", () => {
  const from = { x: 28, y: 16 },
    target = BUILDINGS.find((b) => b.id === "b-cafe")!.door,
    car = { x: 27, y: 17 };
  const path = pedestrianPath(from, target, [car]);
  assert.ok(path.length);
  let a = from;
  for (const b of path) {
    const count = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.1);
    for (let i = 0; i <= count; i++) {
      const p = { x: a.x + ((b.x - a.x) * i) / count, y: a.y + ((b.y - a.y) * i) / count };
      assert.ok(Math.hypot(p.x - car.x, p.y - car.y) >= 0.94);
    }
    a = b;
  }
  assert.deepEqual(path.at(-1), target);
});

test("sequential warm-cache replay matches early movement ticks and one full day of authority", () => {
  const a = createWorld(20261103);
  emit(a, "faction_betrayal", "Önemli geçmiş.", ["n0"], null, "private");
  for (let i = 0; i < 100; i++) emit(a, "routine_note", String(i), ["n0"], null, "private");
  tickSocial(a);
  const b = JSON.parse(canonicalState(a)),
    snapshots: string[] = [];
  const movement = (s: typeof a) =>
    canonical(
      s.npcs.slice(0, 100).map((n) => ({
        location: n.location,
        path: n.path,
        destination: n.destination,
        goal: n.goal,
      })),
    );
  for (let tick = 0; tick < 14400; tick++) {
    stepWorld(a);
    if (tick < 900) snapshots.push(movement(a));
  }
  for (let tick = 0; tick < 14400; tick++) {
    stepWorld(b);
    if (tick < 900)
      assert.equal(movement(b), snapshots[tick], `first movement divergence at tick ${tick + 1}`);
  }
  assert.equal(canonicalState(a), canonicalState(b));
  assert.deepEqual(validateState(a), []);
});

test("head-on walkers escape a reciprocal stop without crossing through one another", () => {
  const s = createWorld(941),
    a = s.npcs[1],
    b = s.npcs[2];
  for (const n of s.npcs) {
    if (n.id !== a.id && n.id !== b.id) {
      n.location = { x: 7, y: 9, scene: "b-home" };
      n.lastDecision = 100000;
      n.path = [];
    }
  }
  s.player.location = { x: 32, y: 15, scene: "outside" };
  a.location = { x: 27, y: 15.1, scene: "outside" };
  b.location = { x: 27.5, y: 15.1, scene: "outside" };
  a.goal = b.goal = "walk";
  a.lastDecision = b.lastDecision = 100000;
  a.destination = b.destination = null;
  a.path = [{ x: 28, y: 15.1 }];
  b.path = [{ x: 26, y: 15.1 }];
  for (let t = 0; t < 600; t++) {
    s.tick++;
    npcMovement(s);
    assert.ok(Math.hypot(a.location.x - b.location.x, a.location.y - b.location.y) >= 0.4999);
  }
  assert.equal(a.path.length, 0);
  assert.equal(b.path.length, 0);
  assert.ok(a.location.x > b.location.x);
});

test("fractional start beside a crossing connects to its rounded grid anchor", () => {
  const from = { x: 15.915168, y: 14.80993 },
    to = { x: 27, y: 14.7 },
    path = pedestrianPath(from, to);
  assert.ok(path.length);
  let a = from;
  for (const p of path) {
    assert.ok(pedestrianSegment(a, p));
    a = p;
  }
  assert.deepEqual(path.at(-1), to);
  assert.deepEqual(pedestrianPath(from, to), path);
});

test("a hungry worker who cannot pay keeps a paid schedule instead of an impossible food errand", () => {
  const s = createWorld(942),
    n = s.npcs[1];
  for (const p of s.npcs) {
    p.lastDecision = 100000;
    p.location = { x: 7, y: 9, scene: "b-home" };
    p.path = [];
  }
  s.player.location = { x: 32, y: 15, scene: "outside" };
  s.minute = 600;
  s.tick = 1200;
  assert.ok(
    transfer(s, "npc-food-test-empty", n.id, "external", s.accounts[n.id], "test-external-trade"),
  );
  n.hunger = 100;
  n.lastDecision = -100;
  n.goal = "idle";
  for (let t = 0; t < 10; t++) {
    s.tick++;
    npcMovement(s);
  }
  assert.equal(n.goal, "work");
  const workplace = s.businesses.find((b) => b.id === n.employerId)!;
  assert.deepEqual(n.destination, BUILDINGS.find((b) => b.id === workplace.buildingId)!.door);
  assert.equal(s.accounts[n.id], 0);
});

test("physical arrivals can buy a real reserved meal between hourly schedule boundaries", () => {
  const s = createWorld(943),
    n = s.npcs[1],
    market = s.businesses.find((b) => b.id === "market")!;
  s.minute = 481;
  s.tick = 10;
  n.goal = "eat";
  n.hunger = 100;
  n.location = { x: 7, y: 9, scene: "b-market" };
  const balance = s.accounts[n.id],
    stock = market.stock.simit,
    price = market.prices.simit;
  societyMinute(s);
  assert.equal(s.economy.services.market.queue[0].personId, n.id);
  economyMinute(s);
  assert.equal(n.hunger, 60);
  assert.equal(s.accounts[n.id], balance - price);
  assert.equal(market.stock.simit, stock - 1);
  stepWorld(s);
  assert.deepEqual(validateState(s), []);
});

test("saved NPC recovery headings ignore final-bit atan2 differences", () => {
  const simulate = () => {
    const s = createWorld(944),
      a = s.npcs[1],
      b = s.npcs[2];
    for (const n of s.npcs) {
      n.lastDecision = 100000;
      n.path = [];
      if (n !== a && n !== b) n.location = { x: 7, y: 9, scene: "b-home" };
    }
    s.player.location = { x: 32, y: 15, scene: "outside" };
    a.location = { x: 27, y: 15.1, scene: "outside" };
    b.location = { x: 27.5, y: 15.1, scene: "outside" };
    a.goal = b.goal = "walk";
    a.destination = b.destination = null;
    a.path = [{ x: 28, y: 15.1 }];
    b.path = [{ x: 26, y: 15.1 }];
    let recoveryCount = 0;
    for (let i = 0; i < 100; i++) {
      s.tick++;
      npcMovement(s);
      for (const [key, value] of Object.entries(s.flags))
        if (key.startsWith("npcAvoidHeading:")) {
          recoveryCount++;
          assert.equal(value, canonicalHeading(Number(value)));
        }
    }
    assert.ok(recoveryCount > 0);
    return canonicalState(s);
  };
  const oracle = simulate(),
    atan2 = Math.atan2;
  try {
    Math.atan2 = (y, x) => atan2(y, x) * (1 + Number.EPSILON);
    assert.equal(simulate(), oracle);
  } finally {
    Math.atan2 = atan2;
  }
});
