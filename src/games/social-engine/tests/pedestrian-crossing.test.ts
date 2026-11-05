import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, stepWorld, validateState, canonicalState } from "../simulation/engine.ts";
import { pedestrianCrossingTraffic } from "../simulation/pedestrian-crossing.ts";
import { processDeath } from "../simulation/family.ts";
import { encodeSave, decodeSave } from "../persistence/codec.ts";

const at = (y: number) => ({ x: 27, y, scene: "outside" });
test("a living occupied crossing rejects opposite ingress while existing bodies can exit; route abort and death release its claim", () => {
  const s = createWorld(922),
    occupied = s.npcs[11],
    waiting = s.npcs[12];
  occupied.location = at(18.7);
  occupied.path = [{ x: 27, y: 21.5 }];
  waiting.location = at(21);
  waiting.path = [{ x: 27, y: 15 }];
  const gate = () => pedestrianCrossingTraffic(s, [occupied, waiting], new Set());
  assert.equal(gate().mayWalk(waiting, { x: 27, y: 20.9 }), false);
  assert.equal(gate().mayWalk(occupied, { x: 27, y: 18.8 }), true);
  assert.deepEqual(gate().retreat(waiting), null);
  occupied.path = [];
  assert.equal(gate().mayWalk(waiting, { x: 27, y: 20.9 }), true);
  occupied.path = [{ x: 27, y: 21.5 }];
  assert.equal(processDeath(s, occupied.id, "crossing-death").ok, true);
  assert.equal(gate().mayWalk(waiting, { x: 27, y: 20.9 }), true);
});

test("opposing bounded waiting sets get alternating admission windows without persistent phantom queues", () => {
  const s = createWorld(922),
    north = s.npcs[11],
    south = s.npcs[12];
  north.location = at(15);
  north.path = [{ x: 27, y: 21.5 }];
  south.location = at(21);
  south.path = [{ x: 27, y: 15 }];
  let northWindows = 0,
    southWindows = 0;
  for (let tick = 0; tick < 180; tick++) {
    s.tick = tick;
    const gate = pedestrianCrossingTraffic(s, [north, south], new Set());
    const n = gate.mayWalk(north, { x: 27, y: 15.1 }),
      p = gate.mayWalk(south, { x: 27, y: 20.9 });
    assert.notEqual(n, p);
    if (n) northWindows++;
    if (p) southWindows++;
  }
  assert.equal(northWindows, 90);
  assert.equal(southWindows, 90);
  assert.deepEqual(north.location, at(15));
  assert.deepEqual(south.location, at(21));
});

test("opposing legacy occupants clear physically and still reach the market door after exact save/replay", async () => {
  const s = createWorld(922),
    northbound = s.npcs[11],
    southbound = s.npcs[12];
  for (const n of s.npcs.slice(0, 100)) {
    n.location = { x: 7, y: 7, scene: "b-home" };
    n.lastDecision = 100000;
    n.path = [];
    n.destination = null;
  }
  s.player.location = { x: 7, y: 7, scene: "b-home" };
  // Keep valid road poses and parked records but remove other moving traffic from the fixture.
  for (const v of s.vehicles) {
    v.driverId = null;
    v.speed = 0;
  }
  northbound.location = at(18.9);
  northbound.goal = "walk";
  northbound.destination = { x: 27, y: 14.7 };
  northbound.path = [{ ...northbound.destination }];
  southbound.location = at(16.9);
  southbound.goal = "walk";
  southbound.destination = { x: 27, y: 21.5 };
  southbound.path = [{ ...southbound.destination }];
  const before = (await decodeSave(await encodeSave("auto", s))).state;
  for (let tick = 0; tick < 1200; tick++) {
    stepWorld(s);
    stepWorld(before);
    if (northbound.location.scene === "b-market" && southbound.location.y > 20.8) break;
  }
  assert.equal(northbound.location.scene, "b-market");
  assert.ok(southbound.location.y > 20.8);
  assert.equal(canonicalState(before), canonicalState(s));
  assert.deepEqual(validateState(s), []);
});
