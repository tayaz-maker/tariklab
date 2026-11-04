import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  createWorld,
  applyCommand,
  advanceMinutes,
  validateState,
  canonicalState,
} from "../simulation/engine.ts";
import { BUILDINGS } from "../domain/world.ts";
import { JOBS } from "../domain/content.ts";
import type { WorldState } from "../domain/types.ts";

let sequence = 0;
const act = (state: WorldState, type: string, args: Record<string, unknown> = {}) => {
  let result = applyCommand(state, { v: 1, id: `career-test:${sequence++}`, type, args });
  // Real finite service capacity can require waiting; all payment and seven-day survival assertions remain.
  for (
    let minute = 0;
    type === "BUY" &&
    !result.ok &&
    /Sıran korunuyor|bekleme alanı/.test(result.reason) &&
    minute < 15;
    minute++
  ) {
    advanceMinutes(state, 1);
    result = applyCommand(state, { v: 1, id: `career-test:${sequence++}`, type, args });
  }
  assert.equal(result.ok, true, `${type}: ${result.reason}`);
  return result;
};
const at = (state: WorldState, scene: string) => {
  state.player.location = { x: 7, y: 9, scene };
};
const reports: unknown[] = [];

for (const strategy of ["retail", "mechanic", "teaching"])
  test(`seven-day legal progression: ${strategy} uses wages, food, training, housing and validated saves`, () => {
    const state = createWorld(20261103, {
      name: "Derya Yel",
      appearance: 2,
      background: strategy === "teaching" ? "graduate" : "local",
      attributes: { body: 3, mind: 3, social: 3, discipline: 3 },
    });
    const initial = state.accounts.player,
      days: unknown[] = [];
    for (let day = 0; day < 7; day++) {
      at(state, "b-home");
      act(state, "REST");
      advanceMinutes(state, 60);
      at(state, "b-market");
      act(state, "BUY", { businessId: "market", item: "meal", quantity: 2 });
      act(state, "USE_ITEM", { item: "meal" });
      act(state, "USE_ITEM", { item: "meal" });
      if (strategy === "teaching" && day === 0) {
        at(state, "b-school");
        act(state, "COURSE_ENROLL", { courseId: "pedagogy" });
        for (let session = 0; session < 3; session++) {
          act(state, "COURSE_ATTEND", { courseId: "pedagogy" });
          advanceMinutes(state, 30);
          if (session < 2) advanceMinutes(state, 10);
        }
        assert.equal(
          state.life.certificates.some((certificate) => certificate.courseId === "pedagogy"),
          true,
        );
      }
      if (strategy === "mechanic") {
        at(state, "b-garage");
        act(state, "TRAIN", { skill: "technical" });
        advanceMinutes(state, 20);
      }
      if (state.player.jobId !== strategy) act(state, "APPLY_JOB", { jobId: strategy });
      const job = JOBS.find((job) => job.id === strategy)!,
        employer = state.businesses.find((business) => business.id === job.businessId)!;
      at(state, employer.buildingId);
      for (let shift = 0; shift < (strategy === "retail" ? 4 : 3); shift++) {
        act(state, "START_SHIFT");
        advanceMinutes(state, 60);
      }
      at(state, "b-home");
      act(state, "REST");
      advanceMinutes(state, 60);
      const remaining = (day + 1) * 1440 - (state.minute - 480);
      assert.ok(remaining >= 0);
      advanceMinutes(state, remaining);
      assert.deepEqual(validateState(state), []);
      const loaded = JSON.parse(canonicalState(state)) as WorldState;
      assert.deepEqual(validateState(loaded), []);
      assert.equal(canonicalState(loaded), canonicalState(state));
      assert.equal(state.player.wanted, 0);
      assert.equal(
        state.crimes.some((crime) => crime.offender === "player"),
        false,
      );
      days.push({
        day: day + 1,
        balance: state.accounts.player,
        cumulativeWages: state.player.income,
        skill: state.player.skills[job.skill],
        health: state.player.health,
        householdArrears: state.households.find(
          (household) => household.id === state.player.householdId,
        )!.arrears,
      });
    }
    assert.ok(
      state.accounts.player > initial,
      "legal wages leave a positive surplus after food, fees and rent",
    );
    assert.ok(state.player.income > 0);
    assert.equal(state.player.jobId, strategy);
    reports.push({
      strategy,
      status: "PASS",
      population: state.npcs.length,
      finalTick: state.tick,
      initialBalance: initial,
      finalBalance: state.accounts.player,
      days,
    });
    mkdirSync("artifacts/social-engine/legal-careers", { recursive: true });
    writeFileSync(
      "artifacts/social-engine/legal-careers/results.json",
      JSON.stringify(
        {
          status: reports.length === 3 ? "PASS" : "IN_PROGRESS",
          note: "Domain integration with explicit location setup; does not replace real browser movement or human playtesting.",
          strategies: reports,
        },
        null,
        2,
      ),
    );
  });

test("SE-034: at least one hundred generated missions across seeded worlds have reachable funded canonical targets", () => {
  let generated = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const state = createWorld(seed);
    for (const quest of state.quests) {
      assert.ok(state.npcs.some((npc) => npc.id === quest.issuerId && npc.alive));
      assert.ok(state.npcs.some((npc) => npc.id === quest.targetId && npc.alive));
      assert.ok(BUILDINGS.some((building) => building.id === quest.buildingId));
      assert.equal(state.accounts[`escrow:${quest.id}`], quest.reward);
      assert.ok(state.events.some((event) => event.id === quest.sourceEvent));
      assert.ok(quest.deadline > state.minute);
      generated++;
    }
    assert.deepEqual(validateState(state), []);
  }
  assert.ok(generated >= 100);
  mkdirSync("artifacts/social-engine/legal-careers", { recursive: true });
  writeFileSync(
    "artifacts/social-engine/legal-careers/mission-generation.json",
    JSON.stringify(
      {
        status: "PASS",
        seeds: 100,
        generated,
        invariants: [
          "living canonical issuer/target",
          "known world building",
          "reserved reward equals escrow",
          "persistent causal event",
          "future deadline",
        ],
      },
      null,
      2,
    ),
  );
});
