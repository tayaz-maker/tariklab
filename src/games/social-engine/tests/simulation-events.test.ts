import test from "node:test";
import assert from "node:assert/strict";
import { EVENT_TEMPLATES } from "../domain/content.ts";
import {
  createWorld,
  applyCommand,
  advanceMinutes,
  offerEvent,
  validateState,
} from "../simulation/engine.ts";
import { adjustRelation } from "../simulation/events.ts";
import type { WorldState } from "../domain/types.ts";

let sequence = 0;
const act = (state: WorldState, type: string, args: Record<string, unknown> = {}) =>
  applyCommand(state, { v: 1, id: `event-test:${sequence++}`, type, args });
const at = (state: WorldState, building: string) => {
  state.player.location = { x: 7, y: 9, scene: building };
};
function factFixture(kind: string): WorldState {
  const state = createWorld(987);
  if (kind === "price_shock") advanceMinutes(state, 1440);
  if (kind === "lost_item") advanceMinutes(state, 120);
  for (const quest of state.quests)
    if (quest.status === "offered" || quest.status === "active")
      act(state, "DECLINE_QUEST", { questId: quest.id });
  for (const template of EVENT_TEMPLATES) delete state.flags[`event:${template.kind}`];
  if (kind === "late_wage") state.businesses.find((b) => b.id === "garage")!.status = "distressed";
  if (kind === "layoff") {
    const npc = state.npcs[50],
      business = state.businesses.find((b) => b.id === npc.employerId)!;
    business.employees = business.employees.filter((id) => id !== npc.id);
    npc.jobId = null;
    npc.employerId = null;
  }
  if (kind === "promotion") state.player.skills.technical = 20;
  if (kind === "rent_rise") {
    state.households[0].arrears = 100;
    state.life.leases.find(
      (lease) => lease.householdId === state.households[0].id && lease.status === "active",
    )!.arrears = 100;
  }
  if (kind === "loan_due") {
    at(state, "b-bank");
    assert.equal(act(state, "BORROW", { amount: 10000 }).ok, true);
  }
  if (kind === "vehicle_breakdown") state.flags.vehicleWear = true;
  if (kind === "traffic_jam") state.vehicles[2].speed = 0;
  if (kind === "friend_invite") adjustRelation(state, "n0", "player", 10);
  if (kind === "relationship_dispute") adjustRelation(state, "n0", "player", 0, 0, 0, 15);
  if (kind === "neighborhood_argument") adjustRelation(state, "n0", "player", -5);
  if (kind === "witness_report" || kind === "police_check")
    state.crimes.push({
      id: "fixture-crime",
      offender: "n5",
      victim: "n6",
      witnesses: ["n7"],
      evidence: ["saw:n7"],
      reported: kind === "police_check",
      status: "investigating",
      tick: state.tick,
      fine: 1000,
    });
  if (kind === "faction_truce") state.flags["faction:dock"] = 26;
  return state;
}

for (const template of EVENT_TEMPLATES)
  test(`SE-034 SE-035 SE-036: ${template.kind} real fact prerequisite, accept/complete, decline and timeout branches`, () => {
    const state = factFixture(template.kind),
      quest = offerEvent(state, template.kind);
    assert.ok(quest, `eligible ${template.kind} fixture must generate`);
    assert.ok(state.events.some((event) => event.id === quest.sourceEvent));
    assert.equal(act(state, "ACCEPT_QUEST", { questId: quest.id }).ok, true);
    const early = act(state, "COMPLETE_QUEST", { questId: quest.id });
    assert.equal(early.ok, false, "remote completion must fail");
    if (["shortage", "vehicle_breakdown"].includes(template.kind)) {
      at(state, "b-garage");
      assert.equal(act(state, "BUY", { businessId: "garage", item: "parts" }).ok, true);
    }
    if (template.kind === "friend_invite") {
      at(state, "b-cafe");
      assert.equal(act(state, "BUY", { businessId: "tea", item: "tea" }).ok, true);
    }
    if (template.kind === "job_offer")
      assert.equal(act(state, "APPLY_JOB", { jobId: "retail" }).ok, true);
    if (template.kind === "layoff") {
      at(state, "b-market");
      act(state, "APPLY_JOB", { jobId: "retail" });
      act(state, "START_SHIFT");
      advanceMinutes(state, 60);
    }
    if (template.kind === "loan_due") assert.equal(act(state, "REPAY", { amount: 1000 }).ok, true);
    if (template.kind === "price_shock" || template.kind === "scholarship") {
      at(state, "b-school");
      act(state, "TRAIN", { skill: template.kind === "price_shock" ? "trade" : "academic" });
      advanceMinutes(state, 20);
    }
    if (template.kind === "traffic_jam") {
      state.player.location = { x: 27, y: 16, scene: "outside" };
      assert.ok(act(state, "VEHICLE_ENTER", { vehicleId: "v0" }).ok);
      const start = Number(state.flags.drivenDistance ?? 0);
      assert.ok(act(state, "DRIVE", { throttle: 1, steer: 0 }).ok);
      // Two full signal cycles permit yielding without skipping the ten-metre contract.
      for (
        let minute = 0;
        minute < 36 && Number(state.flags.drivenDistance ?? 0) - start < 10;
        minute++
      )
        advanceMinutes(state, 1);
      assert.ok(
        Number(state.flags.drivenDistance ?? 0) - start >= 10,
        "no forward progress across two signal cycles",
      );
      act(state, "DRIVE", { throttle: -1, steer: 0 });
      advanceMinutes(state, 2);
      act(state, "VEHICLE_EXIT");
    }
    if (template.kind === "witness_report") {
      at(state, "b-police");
      assert.equal(act(state, "REPORT", { crimeId: "fixture-crime" }).ok, true);
    }
    if (template.kind === "police_check") state.crimes[0].status = "resolved";
    if (template.kind === "faction_truce") state.player.reputation = 10;
    adjustRelation(state, "n0", "player", 20);
    at(state, quest.buildingId);
    const before = state.accounts.player;
    const result = act(state, "COMPLETE_QUEST", { questId: quest.id });
    assert.equal(result.ok, true, result.reason);
    assert.equal(state.accounts.player, before + quest.reward);
    assert.equal(state.accounts[`escrow:${quest.id}`], 0);
    assert.equal(quest.status, "complete");
    assert.equal(act(state, "COMPLETE_QUEST", { questId: quest.id }).ok, false);
    assert.deepEqual(validateState(state), []);
    const declined = factFixture(template.kind),
      declinedQuest = offerEvent(declined, template.kind)!;
    assert.equal(act(declined, "ACCEPT_QUEST", { questId: declinedQuest.id }).ok, true);
    assert.equal(act(declined, "DECLINE_QUEST", { questId: declinedQuest.id }).ok, true);
    assert.equal(declined.accounts[`escrow:${declinedQuest.id}`], 0);
    assert.deepEqual(validateState(declined), []);
    const expired = factFixture(template.kind),
      expiredQuest = offerEvent(expired, template.kind)!;
    assert.equal(act(expired, "ACCEPT_QUEST", { questId: expiredQuest.id }).ok, true);
    advanceMinutes(expired, 721);
    assert.equal(expiredQuest.status, "expired");
    assert.equal(expired.accounts[`escrow:${expiredQuest.id}`], 0);
    assert.deepEqual(validateState(expired), []);
  });

test("SE-036 participant and venue reservations are exclusive and release on real decline", async () => {
  const { initializeMissionReservations, validateMissionReservations } =
    await import("../simulation/missions.ts");
  const s = createWorld();
  let sequence = 0;
  const command = (type: string, args: Record<string, unknown>) =>
    applyCommand(s, { v: 1, id: "reserve-test:" + sequence++, type, args });
  for (const q of s.quests) assert.equal(command("DECLINE_QUEST", { questId: q.id }).ok, true);
  s.player.skills.academic = 20;
  const n = s.npcs[99];
  s.businesses.find((b) => b.id === n.employerId)!.employees = s.businesses
    .find((b) => b.id === n.employerId)!
    .employees.filter((id) => id !== n.id);
  n.jobId = null;
  n.employerId = null;
  const promotion = offerEvent(s, "promotion");
  assert.ok(promotion);
  assert.equal(offerEvent(s, "layoff"), null, "different issuer cannot reserve the same office");
  assert.equal(command("DECLINE_QUEST", { questId: promotion.id }).ok, true);
  assert.ok(offerEvent(s, "layoff"));
  assert.deepEqual(validateMissionReservations(s), []);
  assert.deepEqual(validateState(s), []);
  const legacy = createWorld();
  legacy.quests[2].buildingId = legacy.quests[0].buildingId;
  assert.ok(validateMissionReservations(legacy).length);
  initializeMissionReservations(legacy, true);
  assert.deepEqual(validateMissionReservations(legacy), []);
  assert.equal(
    legacy.quests.every((q) => q.status === "offered"),
    true,
  );
  assert.deepEqual(validateState(legacy), []);
});
