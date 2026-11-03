import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolveAction } from "../public/games/tc-sim-boardworld/engine.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
import { playLife } from "./boardworld-scenarios.mjs";
import {
  majorDecision,
  maintenanceAction,
  normalizeAction,
} from "./boardworld-emergent-scenarios.mjs";
import {
  GOLD_STARTS,
  GOLD_STRATEGIES,
  GOLD_SEEDS,
  selectGoldLifeAction,
} from "./boardworld-gold-scenarios.mjs";

const reports = [];
const hash = (text) => createHash("sha256").update(text).digest("hex");
const runtimeRoot = new URL("../public/games/tc-sim-boardworld/", import.meta.url);
const evidence = {
  formatVersion: 1,
  schemaVersion: 6,
  startedAt: new Date().toISOString(),
  purpose:
    "Correctness and deterministic endurance; elapsed times are not a performance benchmark.",
  runtimeSha256: Object.fromEntries(
    readdirSync(runtimeRoot)
      .filter((name) => name.endsWith(".mjs"))
      .sort()
      .map((name) => [name, hash(readFileSync(new URL(name, runtimeRoot)))]),
  ),
  controllerSha256: hash(readFileSync(new URL("./boardworld-gold-scenarios.mjs", import.meta.url))),
  harnessSha256: hash(readFileSync(new URL(import.meta.url))),
};
function runGoldLife(scenario, strategy, seed, days) {
  const checkpoints = [],
    kinds = new Set(),
    births = new Set(),
    finishes = [],
    offers = new Set(),
    received = new Set();
  let maintenance = 0,
    decisions = 0,
    zeroTime = 0,
    consecutiveZeroTime = 0,
    householdBills = 0,
    emptyPractice = 0;
  const result = playLife({
    scenario,
    style: strategy,
    seed,
    days,
    checkpoints: [30, 90, 180, 365, ...(days > 365 ? [540, 730] : [])],
    selector: selectGoldLifeAction,
    replay: true,
    onAction: ({ before, state, action }) => {
      assert.equal(state.version, 6);
      if (state.time === before.time) {
        zeroTime++;
        consecutiveZeroTime++;
      } else consecutiveZeroTime = 0;
      assert.ok(consecutiveZeroTime < 40, "the legal policy cannot spin in a zero-time loop");
      kinds.add(normalizeAction(action.id));
      if (maintenanceAction.test(action.id)) maintenance++;
      if (majorDecision.test(action.id)) decisions++;
      if (
        action.id.startsWith("practice:") &&
        JSON.stringify(before.player.skills) === JSON.stringify(state.player.skills)
      )
        emptyPractice++;
      for (const event of state.emergent.events) births.add(event.id);
      for (const offer of state.society.offers) offers.add(offer.id);
      for (const [actor, facts] of Object.entries(state.society.knowledge))
        for (const fact of facts) if (fact.hops > 0) received.add(`${actor}:${fact.id}`);
      if (/^systemic:.*:finish$/.test(action.id)) {
        const event = before.emergent.events.find((e) => action.id === `systemic:${e.id}:finish`);
        assert.ok(event && event.stage === 1 && before.time >= event.followAt);
        assert.ok(before.time - event.createdAt >= 5 * 1440);
        const again = resolveAction(state, action.id);
        assert.equal(again.ok, false, "a delayed result cannot pay or apply twice");
        assert.strictEqual(again.state, state);
        finishes.push({ day: Math.floor(state.time / 1440) + 1, family: event.family });
      }
      const population = Object.values(state.living.population.districts).reduce(
        (sum, district) => sum + district.employed + district.students + district.jobseekers,
        0,
      );
      assert.equal(population + state.life.secondary.length, 450);
      assert.ok(state.life.secondary.length <= 6);
      assert.equal(
        new Set(state.life.secondary.map((npc) => npc.id)).size,
        state.life.secondary.length,
      );
      assert.ok(state.society.offers.length <= 8 && state.society.feed.length <= 64);
      assert.ok(Object.keys(state.society.knowledge).length <= 18);
      assert.ok(state.emergent.events.length <= 72 && state.emergent.history.length <= 96);
      assert.ok(state.living.enterprise.stock >= 0 && state.living.enterprise.capital >= 0);
      if (before.life.household && before.life.household.id === state.life.household?.id) {
        const old = new Set(before.life.household.billRecords.map((bill) => bill.key));
        householdBills += state.life.household.billRecords.filter(
          (bill) => !old.has(bill.key),
        ).length;
      }
    },
    onCheckpoint: ({ days: completedDays, state, actions, elapsedMs }) => {
      const encoded = exportGame(state),
        previousDay = checkpoints.at(-1)?.completeDays || 0;
      assert.equal(Math.floor(state.time / 1440), completedDays);
      assert.ok(state.player.health >= 50);
      assert.equal(state.housing.arrears, 0);
      assert.ok(state.cash + state.bank > 1000);
      assert.deepEqual(
        importGame(encoded).state,
        state,
        "the full history survives compact saving",
      );
      const interval = finishes.filter((e) => e.day > previousDay && e.day <= completedDays + 1);
      assert.ok(interval.length >= 2, "delayed decisions continue after early authored content");
      checkpoints.push({
        completeDays: completedDays,
        actions,
        elapsedMs,
        maintenance,
        strategicDecisions: decisions,
        zeroTimeActions: zeroTime,
        actionKinds: kinds.size,
        delayedFinishes: finishes.length,
        delayedFinishesThisInterval: interval.length,
        autonomousOffers: offers.size,
        receivedNpcReports: received.size,
        completedMeetings: state.calendar.stats.completed,
        missedMeetings: state.calendar.stats.missed,
        householdBills,
        goals: [...state.achievements],
        health: state.player.health,
        cash: state.cash,
        bank: state.bank,
        debt: state.debt,
        arrears: state.housing.arrears,
        saveBytes: Buffer.byteLength(encoded),
        stateJsonBytes: Buffer.byteLength(JSON.stringify(state)),
        saveSha256: hash(encoded),
      });
    },
  });
  const state = result.state,
    years = days / 365;
  assert.equal(Math.floor(state.time / 1440), days);
  assert.equal(emptyPractice, 0);
  assert.ok(kinds.size >= 30 && births.size >= 35 * years && finishes.length >= 25 * years);
  assert.ok(offers.size > 0 && result.observed.npcContacts > 100 * years);
  assert.ok(result.observed.moved.length && result.observed.careers.length);
  assert.ok(
    Buffer.byteLength(exportGame(state)) < 500000,
    "bounded lossless save remains below 500 KB",
  );
  if (strategy === "career") {
    assert.equal(state.job?.id, "repair");
    assert.ok(result.counts.work >= 220 * years);
    assert.ok(result.counts.promote >= 3);
    assert.ok(state.documents.some((document) => document.id === "certificate-repair"));
  } else if (strategy === "social") {
    assert.ok(state.calendar.stats.completed >= 35 * years);
    assert.equal(state.calendar.stats.missed, 0);
    assert.ok(householdBills >= 16 * years && result.counts["household:chore"] >= 25 * years);
  } else {
    assert.equal(state.job, null, "the training job is explicitly left for the enterprise");
    assert.ok(state.deep.business && state.deep.business.openedDay <= 90);
    assert.ok(result.counts["business:serve"] >= 250 * years);
    assert.ok(result.counts["freelance:deliver"] >= 60 * years);
    assert.ok(state.deep.business.revenue > state.deep.business.costs);
    assert.equal(state.deep.business.arrears, 0);
    assert.ok(result.counts["business:stock:6"] >= 65 * years);
  }
  const record = {
    scenario,
    strategy,
    seed,
    days,
    checkpoints,
    actionCount: result.actions.length,
    actionTraceSha256: hash(JSON.stringify(result.actions)),
    counts: result.counts,
    autonomous: result.observed,
    elapsedMs: result.elapsedMs,
    note: "Every action uses the public resolver. The shadow replay imports/exports every 37 turns and compares the entire state after every action; no clock or resource setup patches.",
  };
  reports.push(record);
  if (process.env.BOARDWORLD_GOLD_REPORT)
    writeFileSync(
      process.env.BOARDWORLD_GOLD_REPORT,
      JSON.stringify(
        { ...evidence, completedAt: new Date().toISOString(), lives: reports },
        null,
        2,
      ) + "\n",
    );
}

for (const scenario of GOLD_STARTS)
  for (const strategy of GOLD_STRATEGIES)
    for (const seed of GOLD_SEEDS)
      test(`Gold6 ${scenario}/${strategy}/${seed}:365 legal days with exact persisted replay`, () => {
        runGoldLife(scenario, strategy, seed, 365);
      });

test("Gold6 restart/career/91373:730 legal days retain history, bounded population and exact replay", () => {
  runGoldLife("restart", "career", 91373, 730);
});
