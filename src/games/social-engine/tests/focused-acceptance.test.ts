import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  stepWorld,
  applyCommand,
  advanceMinutes,
  validateState,
} from "../simulation/engine.ts";
import { encodeSave, decodeSaveText } from "../persistence/codec.ts";
import { packRecords, unpackRecords } from "../persistence/records.ts";
import { JOBS } from "../domain/content.ts";
import type { WorldState, Command } from "../domain/types.ts";
let sequence = 0;
const command = (
  state: WorldState,
  type: string,
  args: Command["args"] = {},
  id = `focused-acceptance:${++sequence}`,
) => applyCommand(state, { v: 1, id, type, args });
function activeBooking(world: WorldState) {
  const shift = world.player.shift;
  assert.ok(shift, "A successful START_SHIFT must provide a current booking");
  return structuredClone(shift);
}
const reload = async (state: WorldState) =>
  (await decodeSaveText(JSON.stringify(await encodeSave("slot-1", state)))).state;

test("SE-017-npc-scene: a naturally moving real NPC enters another scene with one canonical location", async () => {
  const state = createWorld(17021),
    npc = state.npcs.find((p) => p.id === "n93")!;
  const initial = { ...npc.location },
    playerInitial = { ...state.player.location },
    outsideLocation = npc.location;
  const before = packRecords(state),
    personRecord = "world/npcs/@n93",
    locationRecord = personRecord + "/location";
  assert.deepEqual(before.records[personRecord].data.location, { $ref: locationRecord });
  let movedOutside = false;
  for (let tick = 0; tick < 220 && npc.location.scene === initial.scene; tick++) {
    stepWorld(state);
    if (
      npc.location.scene === "outside" &&
      Math.hypot(npc.location.x - initial.x, npc.location.y - initial.y) > 0.01
    )
      movedOutside = true;
    assert.equal(state.npcs.filter((p) => p.id === npc.id).length, 1);
    assert.equal(
      state.npcs.find((p) => p.id === npc.id),
      npc,
    );
  }
  assert.ok(movedOutside, "NPC must actually move before changing scene");
  assert.equal(initial.scene, "outside");
  assert.equal(npc.location.scene, "b-cafe");
  assert.notEqual(
    npc.location,
    outsideLocation,
    "Door crossing must replace the former outside location",
  );
  assert.deepEqual(
    state.player.location,
    playerInitial,
    "This is an NPC transition, without a player transition",
  );
  const after = packRecords(state);
  assert.deepEqual(
    Object.entries(after.records)
      .filter(([, r]) => r.data.id === npc.id)
      .map(([key]) => key),
    [personRecord],
  );
  assert.deepEqual(after.records[personRecord].data.location, { $ref: locationRecord });
  assert.equal(
    Object.values(after.records).filter(
      (r) =>
        typeof r.data.location === "object" &&
        r.data.location !== null &&
        !Array.isArray(r.data.location) &&
        r.data.location.$ref === locationRecord,
    ).length,
    1,
  );
  assert.deepEqual(after.records[locationRecord].data, {
    scene: npc.location.scene,
    x: npc.location.x,
    y: npc.location.y,
  });
  const materialized = unpackRecords(after),
    loaded = await reload(state);
  for (const restored of [materialized, loaded]) {
    assert.equal(restored.npcs.filter((p) => p.id === npc.id).length, 1);
    assert.deepEqual(restored.npcs.find((p) => p.id === npc.id)!.location, npc.location);
    assert.deepEqual(validateState(restored), []);
  }
});

test("SE-028-reputation-effects: earned reputation changes actual faction eligibility and survives save reload", async () => {
  const state = createWorld(28021),
    npc = state.npcs.find((p) => p.id === "n0")!;
  assert.equal(state.player.reputation, 0);
  const initialFaction = state.flags.faction;
  assert.equal(command(state, "JOIN_FACTION", { factionId: "dock" }).ok, false);
  assert.equal(state.flags.faction, initialFaction);
  assert.equal(command(state, "TALK", { npcId: npc.id, topic: "help" }).ok, true);
  assert.equal(state.player.reputation, 3);
  assert.equal(state.player.inventory.simit, 1);
  const belowThreshold = await reload(state);
  assert.equal(belowThreshold.player.reputation, 3);
  assert.equal(command(belowThreshold, "JOIN_FACTION", { factionId: "dock" }).ok, false);
  assert.equal(belowThreshold.flags.faction, initialFaction);
  for (let tick = 0; tick < 20; tick++) stepWorld(state);
  assert.equal(command(state, "TALK", { npcId: npc.id, topic: "help" }).ok, true);
  assert.equal(state.player.reputation, 6);
  assert.equal(state.player.inventory.simit ?? 0, 0);
  assert.equal(Object.hasOwn(state.player.inventory, "simit"), false);
  const eligible = await reload(state),
    influence = eligible.player.influence;
  assert.ok(!eligible.social.factions.some((f) => f.members.some((m) => m.personId === "player")));
  assert.equal(eligible.player.reputation, 6);
  assert.equal(command(eligible, "JOIN_FACTION", { factionId: "dock" }).ok, true);
  assert.equal(eligible.flags.faction, "dock");
  assert.equal(eligible.player.influence, influence + 5);
  const membership = eligible.social.factions
    .find((f) => f.id === "dock")!
    .members.filter((m) => m.personId === "player");
  assert.equal(membership.length, 1);
  assert.equal(membership[0].role, "member");
  assert.equal(membership[0].joinedAt, eligible.minute);
  assert.equal(eligible.social.factionChangedAt.player, eligible.minute);
  const joined = await reload(eligible);
  assert.equal(joined.player.reputation, 6);
  assert.equal(joined.flags.faction, "dock");
  assert.equal(joined.player.influence, influence + 5);
  assert.deepEqual(
    joined.social.factions
      .find((f) => f.id === "dock")!
      .members.filter((m) => m.personId === "player"),
    membership,
  );
  assert.equal(joined.social.factionChangedAt.player, eligible.minute);
  assert.deepEqual(validateState(joined), []);
});

test("SE-021-job-schedule: replacement employment owns the actual future shift clock and pay without stale prior bookings", async () => {
  const state = createWorld(21021),
    retail = JOBS.find((j) => j.id === "retail")!,
    warehouse = JOBS.find((j) => j.id === "warehouse")!;
  assert.equal(command(state, "APPLY_JOB", { jobId: retail.id }).ok, true);
  const firstEmployer = state.businesses.find((b) => b.id === retail.businessId)!;
  // At-work location is the precondition; hiring, booking, elapsed time and pay use real commands/rules.
  state.player.location = { x: 7, y: 7, scene: firstEmployer.buildingId };
  const oldStartId = "focused-acceptance:old-shift";
  assert.equal(command(state, "START_SHIFT", {}, oldStartId).ok, true);
  const oldBooking = activeBooking(state),
    firstStart = state.minute,
    firstCash = state.accounts.player;
  assert.equal(oldBooking.endsAt, firstStart + retail.duration);
  assert.equal(
    command(state, "APPLY_JOB", { jobId: warehouse.id }).ok,
    false,
    "An active former shift must block replacement",
  );
  assert.deepEqual(state.player.shift, oldBooking);
  advanceMinutes(state, retail.duration);
  assert.equal(state.minute, oldBooking.endsAt);
  assert.equal(state.player.shift, null);
  assert.equal(state.accounts.player, firstCash + oldBooking.wage);
  assert.equal(command(state, "APPLY_JOB", { jobId: warehouse.id }).ok, true);
  const employer = state.businesses.find((b) => b.id === warehouse.businessId)!;
  assert.equal(state.player.employerId, employer.id);
  assert.equal(state.player.jobId, warehouse.id);
  assert.ok(!firstEmployer.employees.includes("player"));
  assert.equal(employer.employees.filter((id) => id === "player").length, 1);
  state.player.location = { x: 7, y: 7, scene: employer.buildingId };
  const newStartId = "focused-acceptance:new-shift",
    secondStart = state.minute;
  assert.equal(command(state, "START_SHIFT", {}, newStartId).ok, true);
  const booking = activeBooking(state),
    cash = state.accounts.player;
  assert.notEqual(booking.id, oldBooking.id);
  assert.equal(booking.businessId, employer.id);
  assert.equal(booking.endsAt, secondStart + warehouse.duration);
  assert.ok(booking.endsAt > oldBooking.endsAt);
  assert.notEqual(booking.wage, oldBooking.wage);
  assert.equal(
    command(state, "START_SHIFT", {}, oldStartId).ok,
    false,
    "Replaying the former booking command must not restore its old wage/employer/deadline",
  );
  assert.deepEqual(state.player.shift, booking);
  const loaded = await reload(state);
  assert.deepEqual(loaded.player.shift, booking);
  assert.equal(loaded.player.employerId, employer.id);
  advanceMinutes(loaded, warehouse.duration - 1);
  assert.equal(loaded.minute, booking.endsAt - 1);
  assert.deepEqual(loaded.player.shift, booking);
  assert.equal(loaded.accounts.player, cash, "No wage before the current job deadline");
  advanceMinutes(loaded, 1);
  assert.equal(loaded.minute, booking.endsAt);
  assert.equal(loaded.player.shift, null);
  assert.equal(loaded.accounts.player, cash + booking.wage);
  const paid = loaded.ledger.filter((e) => e.id === `pay:${booking.id}`);
  assert.equal(paid.length, 1);
  assert.equal(paid[0].from, `business:${employer.id}`);
  assert.equal(paid[0].to, "player");
  assert.equal(paid[0].amount, booking.wage);
  assert.equal(command(loaded, "START_SHIFT", {}, oldStartId).ok, false);
  assert.equal(command(loaded, "START_SHIFT", {}, newStartId).ok, false);
  assert.equal(loaded.player.shift, null);
  assert.equal(loaded.accounts.player, cash + booking.wage);
  assert.deepEqual(validateState(loaded), []);
});
