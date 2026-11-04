import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, stepWorld, canonicalState, validateState } from "../simulation/engine.ts";
import { emit } from "../simulation/events.ts";
import { tickSocial } from "../simulation/social.ts";
import { canonical } from "../simulation/random.ts";
import { npcMovement } from "../simulation/society.ts";
import { npcMovementTraits } from "../simulation/npc-traits.ts";
import {
  pedestrianPath,
  pedestrianSegment,
  pedestrianWalkable,
} from "../simulation/pedestrian-navigation.ts";
import { BUILDINGS, isWalkable } from "../domain/world.ts";
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
      s.npcs
        .slice(0, 100)
        .map((n) => ({
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
