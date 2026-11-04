import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  applyCommand,
  stepWorld,
  projectWorld,
  transfer,
  validateState,
} from "../simulation/engine.ts";
import { emit } from "../simulation/events.ts";
import { BUILDINGS } from "../domain/world.ts";
import type { WorldState } from "../domain/types.ts";
const command = (s: WorldState, id: string, type: string, args: Record<string, unknown> = {}) =>
  applyCommand(s, { v: 1, id, type, args });
const parts = (s: WorldState) =>
  s.businesses.reduce((sum, b) => sum + (b.stock.parts ?? 0), 0) +
  (s.player.inventory.parts ?? 0) +
  Object.entries(s.player.inventory)
    .filter(([id]) => id.startsWith("parcel:"))
    .reduce((sum, [, count]) => sum + count, 0);

test("compacted monetary transaction IDs remain exactly-once after save/load", () => {
  const s = createWorld(803);
  for (let i = 0; i < 2050; i++)
    assert.equal(
      transfer(s, `adversarial:${i}`, "external", "bank", 1, "test-external-trade"),
      true,
    );
  const reloaded = structuredClone(s),
    before = reloaded.accounts.bank;
  assert.equal(
    transfer(reloaded, "adversarial:0", "external", "bank", 1, "test-external-trade"),
    false,
    "a compacted transfer must not execute again",
  );
  assert.equal(reloaded.accounts.bank, before);
});
test("repair delivery cannot create seven unproduced parts", () => {
  const s = createWorld(804),
    q = s.quests.find((q) => q.kind === "shortage")!;
  assert.ok(q);
  assert.equal(command(s, "buy-parts", "BUY", { businessId: "market", item: "parts" }).ok, true);
  assert.equal(command(s, "accept-parts", "ACCEPT_QUEST", { questId: q.id }).ok, true);
  s.player.location = { ...BUILDINGS.find((b) => b.id === q.buildingId)!.door, scene: "outside" };
  const before = parts(s);
  assert.equal(command(s, "deliver-part", "COMPLETE_QUEST", { questId: q.id }).ok, true);
  assert.equal(parts(s), before, "delivered stock must equal removed inventory");
});
test("abandoning an undelivered parcel restores its reserved inventory", () => {
  const s = createWorld(805),
    q = s.quests.find((q) => q.kind === "delivery")!;
  assert.ok(q);
  const before = parts(s);
  assert.equal(command(s, "accept-parcel", "ACCEPT_QUEST", { questId: q.id }).ok, true);
  assert.equal(parts(s), before);
  assert.equal(command(s, "decline-parcel", "DECLINE_QUEST", { questId: q.id }).ok, true);
  assert.equal(parts(s), before, "cancellation must preserve physical goods");
});
test("joining the same faction repeatedly does not generate influence", () => {
  const s = createWorld(806);
  s.player.reputation = 5;
  assert.equal(command(s, "join-once", "JOIN_FACTION", { factionId: "dock" }).ok, true);
  const influence = s.player.influence,
    territory = s.flags["faction:dock"];
  command(s, "join-again", "JOIN_FACTION", { factionId: "dock" });
  assert.equal(s.player.influence, influence);
  assert.equal(s.flags["faction:dock"], territory);
});
test("successful pursuit escape survives the next fixed tick", () => {
  const s = createWorld(807);
  s.tick = 100;
  s.minute = 490;
  s.player.location = { x: 7, y: 9, scene: "b-home" };
  s.player.wanted = 1;
  s.flags.pursuitUntil = 490;
  s.crimes.push({
    id: "crime:escape-fixture",
    offender: "player",
    victim: "n1",
    witnesses: ["n2"],
    evidence: ["saw:n2"],
    reported: true,
    status: "pursuit",
    tick: 0,
    fine: 15000,
  });
  stepWorld(s);
  assert.equal(s.player.wanted, 0);
  stepWorld(s);
  assert.equal(s.player.wanted, 0, "old evidence must not instantly restart an escaped pursuit");
});
test("unobserved private events remain absent from player projection and unrelated memory", () => {
  const s = createWorld(808),
    before = [...s.npcs[2].memories];
  const e = emit(s, "private_fixture", "A private conversation", ["n0", "n1"], "n1", "private");
  assert.equal(
    projectWorld(s).events.some((item) => item.id === e.id),
    false,
  );
  assert.deepEqual(s.npcs[2].memories, before);
  assert.ok(s.npcs[0].memories.includes(e.id));
});

test("prototype property names are not trainable skills", () => {
  const s = createWorld(809);
  s.player.location = { x: 7, y: 9, scene: "b-school" };
  const before = s.accounts.player;
  assert.equal(command(s, "prototype-skill", "TRAIN", { skill: "toString" }).ok, false);
  assert.equal(s.accounts.player, before);
  assert.equal(Object.hasOwn(s.player.skills, "toString"), false);
});

test("a negative steering request at a connected junction turns left on screen", async () => {
  const { pointOnLane, project } = await import("../domain/world.ts");
  const s = createWorld(810),
    v = s.vehicles[0];
  v.lane = 1;
  v.progress = 100;
  v.speed = 1;
  const position = pointOnLane(v.lane, v.progress);
  v.location = { x: position.x, y: position.y, scene: "outside" };
  v.heading = position.heading;
  v.driverId = "player";
  s.player.vehicleId = v.id;
  s.player.location = { ...v.location };
  const before = project({ x: Math.cos(v.heading), y: Math.sin(v.heading) });
  assert.equal(command(s, "turn-left", "DRIVE", { throttle: 1, steer: -1 }).ok, true);
  stepWorld(s);
  const after = project({ x: Math.cos(v.heading), y: Math.sin(v.heading) });
  assert.ok(
    before.x * after.y - before.y * after.x < 0,
    "negative screen-space cross product is a counterclockwise/left turn",
  );
  assert.equal(v.lane, 2);
});

test("save validator rejects dangling player vehicle ownership", () => {
  const s = createWorld(811);
  s.player.vehicleId = "missing-vehicle";
  assert.ok(validateState(s).some((error) => error.includes("vehicle")));
});
test("save validator rejects malformed persistent transaction tombstones", () => {
  const s = createWorld(812);
  s.flags["txexact:evil"] = "not-hex";
  assert.ok(validateState(s).some((error) => error.includes("tx") || error.includes("dedup")));
});
