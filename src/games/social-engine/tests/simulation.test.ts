import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  applyCommand,
  advanceMinutes,
  stepWorld,
  validateState,
  canonicalState,
  offerEvent,
  eventEligible,
  transfer,
} from "../simulation/engine.ts";
import { EVENT_TEMPLATES, JOBS } from "../domain/content.ts";
import { BUILDINGS, isWalkable, ROADS, pointOnLane, laneLength } from "../domain/world.ts";
import { draw } from "../simulation/random.ts";
import type { WorldState } from "../domain/types.ts";

let sequence = 0;
const command = (
  state: WorldState,
  type: string,
  args: Record<string, unknown> = {},
  id = `test:${sequence++}`,
) => applyCommand(state, { v: 1, id, type, args });
const at = (state: WorldState, buildingId: string) => {
  state.player.location = { x: 7, y: 9, scene: buildingId };
};
const valid = (state: WorldState) => assert.deepEqual(validateState(state), []);

test("SE-002 SE-004 SE-005 SE-006: one canonical adult player, validated profile and point budget", () => {
  const state = createWorld(42, {
    name: "İpek Kaya",
    appearance: 3,
    background: "graduate",
    attributes: { body: 2, mind: 6, social: 2, discipline: 2 },
  });
  valid(state);
  assert.equal(state.player.name, "İpek Kaya");
  assert.equal(state.player.profile.appearance, 3);
  assert.equal(state.player.age >= 18, true);
  assert.equal(state.npcs.length, 1100);
  assert.equal(state.npcs.filter((npc) => npc.local).length, 100);
  assert.throws(() => createWorld(42, { ...state.player.profile, name: "<script>" }));
  assert.throws(() =>
    createWorld(42, {
      ...state.player.profile,
      attributes: { body: 6, mind: 6, social: 6, discipline: 6 },
    }),
  );
  assert.throws(() => createWorld(42, { ...state.player.profile, appearance: -1 }));
});
test("SE-010 SE-012: fixed movement swept collision and world limits resist 10000 held inputs", () => {
  const state = createWorld(42);
  command(state, "MOVE", { x: 0, y: -1, sprint: true });
  for (let i = 0; i < 200; i++) stepWorld(state);
  assert.ok(state.player.location.y >= 14.28);
  assert.ok(isWalkable(state.player.location));
  state.player.location = { x: 2, y: 2, scene: "outside" };
  command(state, "MOVE", { x: -1, y: -1, sprint: true });
  for (let i = 0; i < 10000; i++) stepWorld(state);
  assert.ok(state.player.location.x >= 1.28 && state.player.location.y >= 1.28);
  valid(state);
  assert.equal(command(state, "MOVE", { x: Infinity, y: 0 }).ok, false);
});
test("SE-011: obstructed target refuses movement and connected target follows valid path", () => {
  const state = createWorld();
  assert.equal(command(state, "MOVE_TO", { x: 25, y: 10 }).ok, false);
  const target = BUILDINGS.find((building) => building.id === "b-garage")!.door;
  assert.equal(command(state, "MOVE_TO", target).ok, true);
  for (let i = 0; i < 700; i++) {
    stepWorld(state);
    assert.ok(isWalkable(state.player.location));
  }
  assert.ok(
    Math.hypot(state.player.location.x - target.x, state.player.location.y - target.y) < 0.2,
  );
  valid(state);
});
test("SE-014 SE-015 SE-017: 100 repeated interior transitions preserve one player and exact door", () => {
  const state = createWorld();
  for (let i = 0; i < 100; i++) {
    const building = BUILDINGS[i % BUILDINGS.length];
    state.player.location = { ...building.door, scene: "outside" };
    assert.equal(command(state, "ENTER", { buildingId: building.id }).ok, true);
    assert.equal(state.player.location.scene, building.id);
    assert.equal(command(state, "ENTER", { buildingId: building.id }).ok, false);
    assert.equal(command(state, "EXIT").ok, true);
    assert.deepEqual(state.player.location, { ...building.door, scene: "outside" });
    valid(state);
  }
});
test("SE-016 SE-018 SE-025 SE-027: proximity, cooldown, knowledge and social consequences", () => {
  const state = createWorld(),
    npc = state.npcs[0],
    oldTrust =
      state.relations.find((edge) => edge.from === npc.id && edge.to === "player")?.trust ?? 0;
  assert.equal(command(state, "TALK", { npcId: npc.id, topic: "greet" }).ok, true);
  assert.equal(command(state, "TALK", { npcId: npc.id, topic: "greet" }).ok, false);
  assert.equal(
    state.relations.find((edge) => edge.from === npc.id && edge.to === "player")!.trust,
    oldTrust + 5,
  );
  const privateEvent = state.events.at(-1)!;
  assert.equal(privateEvent.visibility, "private");
  assert.ok(npc.memories.includes(privateEvent.id));
  assert.ok(!state.npcs[50].memories.includes(privateEvent.id));
  state.tick += 20;
  state.minute += 2;
  assert.equal(command(state, "TALK", { npcId: npc.id, topic: "insult" }).ok, true);
  assert.equal(state.player.reputation, -3);
  assert.equal(command(state, "TALK", { npcId: "n99", topic: "greet" }).ok, false);
  valid(state);
});
test("SE-020 SE-021: every occupation pays once, changes canonical employment, overlapping shifts rejected", () => {
  const state = createWorld();
  state.player.skills.academic = 25;
  at(state, "b-school");
  for (const courseId of ["office-skills", "pedagogy"]) {
    assert.equal(command(state, "COURSE_ENROLL", { courseId }).ok, true);
    for (let session = 0; session < 3; session++) {
      assert.equal(command(state, "COURSE_ATTEND", { courseId }).ok, true);
      advanceMinutes(state, 30);
      if (session < 2) advanceMinutes(state, 10);
    }
  }
  for (const job of JOBS) {
    assert.equal(command(state, "APPLY_JOB", { jobId: job.id }).ok, true);
    const business = state.businesses.find((item) => item.id === job.businessId)!;
    at(state, business.buildingId);
    state.player.fatigue = 0;
    const startId = `shift-start:${job.id}`,
      before = state.accounts.player;
    assert.equal(command(state, "START_SHIFT", {}, startId).ok, true);
    const wage = state.player.shift!.wage;
    assert.equal(command(state, "START_SHIFT").ok, false);
    assert.equal(command(state, "APPLY_JOB", { jobId: "retail" }).ok, false);
    advanceMinutes(state, 60);
    assert.equal(state.accounts.player, before + wage);
    assert.equal(state.player.shift, null);
    assert.equal(command(state, "START_SHIFT", {}, startId).ok, false);
    assert.equal(state.accounts.player, before + wage);
    valid(state);
  }
});
test("SE-022 SE-023: purchase atomically balances cash, stock and inventory; invalid and duplicate commands fail", () => {
  const state = createWorld();
  at(state, "b-market");
  const shop = state.businesses.find((b) => b.id === "market")!;
  const before = state.accounts.player,
    stock = shop.stock.simit,
    quantity = state.player.inventory.simit;
  assert.equal(
    command(state, "BUY", { businessId: "market", item: "simit", quantity: 2 }, "one-purchase").ok,
    true,
  );
  assert.equal(state.accounts.player, before - shop.prices.simit * 2);
  assert.equal(shop.stock.simit, stock - 2);
  assert.equal(state.player.inventory.simit, quantity + 2);
  assert.equal(
    command(state, "BUY", { businessId: "market", item: "simit", quantity: 2 }, "one-purchase").ok,
    false,
  );
  assert.equal(
    command(state, "BUY", { businessId: "market", item: "simit", quantity: -1 }).ok,
    false,
  );
  assert.equal(
    command(state, "BUY", { businessId: "market", item: "__proto__", quantity: 1 }).ok,
    false,
  );
  transfer(state, "spend-cash", "player", "external", state.accounts.player, "test-spend");
  assert.equal(command(state, "BUY", { businessId: "market", item: "simit" }).ok, false);
  valid(state);
});
test("SE-024: principal, weekly interest and payment reconcile bank assets and player liabilities", () => {
  const state = createWorld();
  at(state, "b-bank");
  assert.equal(command(state, "BORROW", { amount: 100000 }).ok, true);
  assert.equal(state.player.debt, 100000);
  assert.equal(state.flags.loanAsset, 100000);
  advanceMinutes(state, 7 * 1440);
  assert.equal(state.player.debt, 101000);
  assert.equal(state.flags.loanAsset, 101000);
  assert.equal(command(state, "REPAY", { amount: 50000 }, "repay").ok, true);
  assert.equal(state.player.debt, 51000);
  assert.equal(state.flags.loanAsset, 51000);
  assert.equal(command(state, "REPAY", { amount: 50000 }, "repay").ok, false);
  valid(state);
});
test("SE-028 SE-029 SE-030: witnessed assault produces delayed report, evidence, pursuit and exact fine", () => {
  const state = createWorld();
  state.npcs[1].location = { x: 28, y: 16.6, scene: "outside" };
  assert.equal(command(state, "ATTACK", { npcId: "n0" }).ok, true);
  for (let i = 0; i < 90; i++) stepWorld(state);
  assert.ok(state.npcs[0].health < 100);
  assert.equal(state.crimes.length, 1);
  assert.equal(state.crimes[0].reported, true);
  assert.ok(state.crimes[0].witnesses.length > 0);
  assert.equal(state.player.wanted, 1);
  const before = state.accounts.player;
  assert.equal(command(state, "SURRENDER", {}, "surrender").ok, true);
  assert.equal(state.accounts.player, before - 15000);
  assert.equal(state.player.wanted, 0);
  assert.equal(state.crimes[0].status, "resolved");
  assert.equal(command(state, "SURRENDER", {}, "surrender").ok, false);
  valid(state);
});
test("SE-027 SE-029: unseen assault is not automatically known to police", () => {
  const state = createWorld();
  at(state, "b-home");
  state.npcs[0].location = { x: 7.5, y: 9, scene: "b-home" };
  assert.equal(command(state, "ATTACK", { npcId: "n0" }).ok, true);
  for (let i = 0; i < 100; i++) stepWorld(state);
  assert.equal(state.crimes[0].witnesses.length, 0);
  assert.equal(state.crimes[0].reported, false);
  assert.equal(state.player.wanted, 0);
  valid(state);
});
test("SE-031: combat windup/cooldown/stamina and block are deterministic independent of render grouping", () => {
  const a = createWorld(5),
    b = createWorld(5);
  for (const state of [a, b]) {
    command(state, "BLOCK", { active: true }, "block");
    command(state, "ATTACK", { npcId: "n0", heavy: true }, "attack");
  }
  for (let i = 0; i < 30; i++) stepWorld(a);
  for (let frame = 0; frame < 10; frame++) for (let tick = 0; tick < 3; tick++) stepWorld(b);
  assert.equal(canonicalState(a), canonicalState(b));
  assert.equal(a.player.health, 97);
  assert.ok(a.player.stamina < 100);
  a.player.stamina = 1;
  assert.equal(command(a, "ATTACK", { npcId: "n0" }).ok, false);
});
test("SE-032 SE-033: driven car and saved driver remain on directed lanes with collision spacing", () => {
  const state = createWorld();
  assert.equal(command(state, "VEHICLE_ENTER", { vehicleId: "v0" }).ok, true);
  assert.equal(command(state, "DRIVE", { throttle: 1, steer: 0 }).ok, true);
  for (let i = 0; i < 300; i++) stepWorld(state);
  const vehicle = state.vehicles[0],
    expected = pointOnLane(vehicle.lane, vehicle.progress);
  assert.ok(Math.hypot(vehicle.location.x - expected.x, vehicle.location.y - expected.y) < 0.002);
  assert.deepEqual(state.player.location, vehicle.location);
  assert.equal(command(state, "VEHICLE_EXIT").ok, false);
  command(state, "DRIVE", { throttle: -1, steer: 0 });
  for (let i = 0; i < 20; i++) stepWorld(state);
  assert.equal(command(state, "VEHICLE_EXIT").ok, true);
  valid(state);
  valid(JSON.parse(JSON.stringify(state)));
  ROADS.forEach((lane, i) => assert.ok(lane.length >= 4 && laneLength(i) > 0));
});
test("SE-034 SE-035 SE-036: funded causal missions, terminal timeout and exactly once reward survive compaction", () => {
  const state = createWorld(),
    quest = state.quests.find((item) => item.kind === "neighbor_help")!;
  assert.equal(command(state, "ACCEPT_QUEST", { questId: quest.id }).ok, true);
  at(state, quest.buildingId);
  const before = state.accounts.player;
  assert.equal(command(state, "COMPLETE_QUEST", { questId: quest.id }, "mission-once").ok, true);
  assert.equal(state.accounts.player, before + quest.reward);
  assert.equal(state.accounts[`escrow:${quest.id}`], 0);
  advanceMinutes(state, 7 * 1440);
  assert.ok(state.ledgerCheckpoint.count > 0);
  const loaded = JSON.parse(JSON.stringify(state)) as WorldState,
    balance = loaded.accounts.player;
  assert.equal(command(loaded, "COMPLETE_QUEST", { questId: quest.id }, "mission-once").ok, false);
  assert.equal(command(loaded, "COMPLETE_QUEST", { questId: quest.id }).ok, false);
  assert.equal(loaded.accounts.player, balance);
  assert.ok(loaded.quests.some((item) => item.status === "expired"));
  valid(loaded);
});
test("SE-034: all twenty templates expose real preconditions and impossible loan task is rejected", () => {
  const state = createWorld();
  assert.equal(EVENT_TEMPLATES.length, 20);
  assert.equal(new Set(EVENT_TEMPLATES.map((t) => t.kind)).size, 20);
  for (const template of EVENT_TEMPLATES) {
    assert.ok(
      template.trigger &&
        template.preconditions.length &&
        template.effects.length &&
        template.fallback &&
        template.expiryMinutes > 0,
    );
  }
  assert.equal(
    eventEligible(
      state,
      EVENT_TEMPLATES.find((t) => t.kind === "loan_due")!,
    ),
    false,
  );
  assert.equal(offerEvent(state, "loan_due"), null);
});
test("SE-026 SE-038 SE-039 SE-040: canonical snapshot preserves relational/economic state and resumes identical ticks", () => {
  const a = createWorld(77);
  command(a, "TALK", { npcId: "n0", topic: "greet" }, "greeting");
  advanceMinutes(a, 70);
  const b = JSON.parse(canonicalState(a)) as WorldState;
  assert.equal(canonicalState(a), canonicalState(b));
  advanceMinutes(a, 1440);
  for (let i = 0; i < 14400; i++) stepWorld(b);
  assert.equal(canonicalState(a), canonicalState(b));
  valid(a);
  valid(b);
});
test("SE-037 SE-038: 100000 actual ticks retain one location and balanced accounts", () => {
  const state = createWorld(54);
  for (let i = 0; i < 100000; i++) {
    stepWorld(state);
    if (i % 5000 === 0) valid(state);
  }
  assert.equal(state.tick, 100000);
  valid(state);
});
test("SE-012 SE-023 SE-038: 100000 validated malformed/boundary commands never corrupt state", () => {
  const state = createWorld(902),
    kinds = ["MOVE", "MOVE_TO", "BUY", "BORROW", "TALK", "DRIVE", "ATTACK", "ENTER", "BOGUS"];
  for (let i = 0; i < 100000; i++) {
    const n = draw(902, 91, i),
      type = kinds[n % kinds.length];
    command(
      state,
      type,
      {
        x: ((n % 300) - 100) / 10,
        y: ((n % 500) - 200) / 10,
        quantity: (n % 60) - 20,
        amount: (n % 10000000) - 100000,
        npcId: `n${n % 2000}`,
        businessId: `bad${n % 3}`,
        buildingId: "missing",
        item: n % 2 ? "simit" : "__proto__",
        throttle: (n % 5) - 2,
        steer: (n % 5) - 2,
      },
      `fuzz:${i}`,
    );
    if (i % 1000 === 0) {
      stepWorld(state);
      valid(state);
    }
  }
  valid(state);
  assert.equal(state.processedCommands.length, 100000);
});
test("education attendance, subsistence recovery and legal business progression use shared ledger", () => {
  const state = createWorld();
  at(state, "b-school");
  assert.equal(command(state, "TRAIN", { skill: "academic" }).ok, true);
  const before = state.player.skills.academic;
  advanceMinutes(state, 20);
  assert.equal(state.player.skills.academic, before + 5);
  assert.equal(command(state, "TRAIN", { skill: "academic" }).ok, true);
  state.player.location = { x: 27, y: 16, scene: "outside" };
  advanceMinutes(state, 20);
  assert.equal(state.player.skills.academic, before + 5);
  transfer(state, "empty-player", "player", "external", state.accounts.player, "test-spend");
  at(state, "b-security");
  assert.equal(command(state, "SUPPORT").ok, true);
  assert.equal(state.accounts.player, 20000);
  assert.equal(command(state, "SUPPORT").ok, false);
  valid(state);
});
