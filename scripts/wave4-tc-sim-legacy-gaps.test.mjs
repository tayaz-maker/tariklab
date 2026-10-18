import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { migrateState } from "../public/games/tc-sim/js/save.js";
import { advanceWeek, applyDecision, canApplyDecision } from "../public/games/tc-sim/js/time.js";
import { getEventDefinition, resolveEvent } from "../public/games/tc-sim/js/events.js";
import { applySocialMaintenance, getRelationship } from "../public/games/tc-sim/js/social.js";
import { CASH_ARREARS_CAP, CASH_FLOOR, netWorth, processCashShortfall } from "../public/games/tc-sim/js/wealth.js";
import { economyCausality, buildLifeDossier } from "../public/games/tc-sim/js/life-depth.js";

const copy = (value) => JSON.parse(JSON.stringify(value));
function settle(state, preferred = null) {
  let guard = 0;
  while (state.events.active && guard++ < 50) {
    const event = getEventDefinition(state.events.active.eventId);
    const choice = event.choices.find((item) => item.id === preferred) || event.choices[0];
    assert.equal(resolveEvent(state, choice.id).ok, true, event.id);
  }
  assert.ok(guard < 50, "event queue soft-lock");
}
const average = (state) => {
  const values = Object.values(state.relationships);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

test("monthly shortfall becomes bounded arrears and a later surplus repays it", () => {
  const state = createNewGame({ seed: 71 });
  state.finances.balance = -50000;
  const distressed = processCashShortfall(state);
  assert.equal(state.finances.balance, CASH_FLOOR);
  assert.equal(distressed.amount, 40000);
  assert.equal(state.finances.arrears, 40000);
  assert.equal(economyCausality(state).debt >= 40000, true);
  state.finances.balance = 10000;
  const recovered = processCashShortfall(state);
  assert.equal(recovered.kind, "recovery");
  assert.equal(state.finances.balance, 8000);
  assert.equal(state.finances.arrears, 38000);
  assert.ok(buildLifeDossier(state).economy.debt >= 38000);
});

test("persistent unemployment retains overflow in finite cash after arrears reach the cap", () => {
  const state = createNewGame({ seed: 72 });
  state.career.jobId = null;
  state.finances.otherMonthlyExpenses = 50000;
  for (let month = 0; month < 240; month += 1) {
    state.finances.balance -= 75000;
    const worthBeforeConversion = netWorth(state).total;
    processCashShortfall(state);
    assert.equal(netWorth(state).total, worthBeforeConversion, "converting cash to arrears cannot forgive debt");
    assert.ok(Number.isFinite(state.finances.balance));
    assert.ok(state.finances.arrears <= CASH_ARREARS_CAP);
  }
  assert.ok(state.finances.balance < CASH_FLOOR, "the debt cap does not erase later mandatory losses");
  assert.equal(state.finances.arrears, CASH_ARREARS_CAP);
  assert.equal(state.wealth.lifestyle, "modest");
  assert.equal(state.flags.cashDefaultPressure, true);
  assert.equal(validateState(state).ok, true);
});

test("foreign saves fail closed before normalization while valid V5/V6 stay idempotent", () => {
  for (const foreign of [
    { meta: { saveVersion: 6, gameId: "apartman" }, player: {}, time: {}, finances: {} },
    { meta: { saveVersion: 2 }, state: { town: true } },
    { meta: { saveVersion: 6 }, player: null, time: {}, finances: {} },
  ]) assert.doesNotThrow(() => assert.equal(migrateState(foreign).ok, false));
  for (const version of [5, 6]) {
    const valid = createNewGame({ seed: 73 + version });
    valid.meta.saveVersion = version;
    if (version === 5) delete valid.lifeDepth;
    const first = migrateState(copy(valid));
    assert.equal(first.ok, true);
    const second = migrateState(copy(first.state));
    assert.equal(second.ok, true);
    assert.deepEqual(second.state, first.state);
  }
  const debtHeavy = createNewGame({ seed: 90 });
  debtHeavy.finances.balance = -1457675;
  const worthBeforeConversion = netWorth(debtHeavy).total;
  const recoveredLegacy = migrateState(copy(debtHeavy));
  assert.equal(recoveredLegacy.ok, true);
  assert.deepEqual(migrateState(copy(recoveredLegacy.state)).state, recoveredLegacy.state);
  processCashShortfall(recoveredLegacy.state);
  assert.equal(recoveredLegacy.state.finances.balance, -1157675);
  assert.equal(recoveredLegacy.state.finances.arrears, CASH_ARREARS_CAP);
  assert.equal(netWorth(recoveredLegacy.state).total, worthBeforeConversion);
  assert.deepEqual(migrateState(copy(recoveredLegacy.state)).state, recoveredLegacy.state);
});

test("passive social decay has role floors and active care remains meaningfully stronger", () => {
  const ignored = createNewGame({ seed: 81 });
  const cared = createNewGame({ seed: 81 });
  for (let week = 2; week <= 260; week += 1) {
    ignored.time.absoluteWeek = week;
    cared.time.absoluteWeek = week;
    applySocialMaintenance(ignored);
    applySocialMaintenance(cared);
    if (week % 6 === 0) {
      cared.weekly = { used: 0, selectedIds: [] };
      if (canApplyDecision(cared, "family").ok) applyDecision(cared, "family");
      settle(cared);
      cared.weekly = { used: 0, selectedIds: [] };
      if (canApplyDecision(cared, "friend").ok) applyDecision(cared, "friend");
      settle(cared);
    }
  }
  assert.ok(average(cared) - average(ignored) >= 8, `${average(cared)} vs ${average(ignored)}`);
  assert.ok(ignored.relationships.anne >= 38);
  assert.ok(ignored.relationships.mehmet >= 28);
  assert.ok(getRelationship(cared, "mehmet").trust > getRelationship(ignored, "mehmet").trust);
  assert.ok(cared.health.energy < 100, "relationship care must still consume time/energy");
});

test("40 production lives stay bounded and strategy-sensitive for 720 weeks", { timeout: 180000 }, () => {
  const strategies = ["career", "money", "family", "relationship", "education", "overtime", "debt", "debt-zero", "housing-min", "housing-quality", "social", "low-risk", "high-risk", "balanced", "adaptive", "random"];
  const outcomes = new Set(), relationBands = new Set();
  let educationFires = 0, confrontations = 0, maxSave = 0, minCash = Infinity, maxDebt = 0, completed720 = 0;
  for (let run = 0; run < 40; run += 1) {
    const strategy = strategies[run % strategies.length];
    const state = createNewGame({ seed: 9000 + run });
    if (["debt", "housing-quality"].includes(strategy)) state.finances.otherMonthlyExpenses += 12000;
    if (strategy === "education") { state.education.level = "onlisans"; state.career.performance = 70; }
    if (strategy === "relationship") {
      state.social.currentPartnerNpcId = "elif";
      const elif = state.people.find((person) => person.id === "elif");
      elif.social.romanceStatus = "partner"; elif.social.tension = 75; elif.social.trust = 45;
      state.relationships.elif = 45;
    }
    let weeks = 0;
    for (; weeks < 720 && !state.lifetime?.death; weeks += 1) {
      settle(state, strategy === "high-risk" ? "push-through" : strategy === "relationship" ? "repair" : null);
      const picks = {
        career: ["overtime", "rest"], money: ["overtime", "budget-check"], family: ["family", "rest"],
        relationship: ["friend", "family"], education: ["rest", "family"], overtime: ["overtime", "rest"],
        debt: ["rest", "exercise"], "debt-zero": ["overtime", "rest"], "housing-min": ["overtime", "rest"],
        "housing-quality": ["rest", "exercise"], social: ["friend", "family"], "low-risk": ["rest", "exercise"],
        "high-risk": ["overtime", "friend"], balanced: ["rest", "family"], adaptive: [state.health.stress > 60 ? "rest" : "overtime", "family"], random: [run % 2 ? "friend" : "exercise", "rest"],
      }[strategy];
      for (const id of picks) {
        settle(state);
        if (canApplyDecision(state, id).ok) applyDecision(state, id);
      }
      settle(state);
      assert.equal(advanceWeek(state).ok, true);
      if (state.events.active?.eventId === "life_depth_education_leverage") educationFires += 1;
      if (state.events.active?.eventId === "life_depth_relationship_reckoning") confrontations += 1;
      minCash = Math.min(minCash, state.finances.balance);
      maxDebt = Math.max(maxDebt, economyCausality(state).debt);
      assert.ok(Number.isFinite(state.finances.balance));
      assert.ok(state.finances.arrears >= 0 && state.finances.arrears <= CASH_ARREARS_CAP);
      assert.equal(validateState(state).ok, true);
    }
    if (weeks === 720) completed720 += 1;
    settle(state);
    const dossier = buildLifeDossier(state);
    outcomes.add(dossier.outcome);
    relationBands.add(Math.floor(average(state) / 10));
    maxSave = Math.max(maxSave, Buffer.byteLength(JSON.stringify(state)));
    assert.ok(state.lifeDepth.pendingEffects.length <= 12);
    assert.ok(state.lifeDepth.arcHistory.length <= 80);
    assert.ok(state.lifeDepth.decisionHistory.length <= 80);
  }
  assert.ok(outcomes.size >= 3);
  assert.ok(relationBands.size >= 2);
  assert.ok(educationFires > 0, "education leverage is naturally reachable");
  assert.ok(confrontations > 0, "relationship confrontation is naturally reachable");
  assert.ok(maxSave < 300000, `save ${maxSave}`);
  assert.ok(completed720 >= 2, `only ${completed720} production lives completed 720 weeks`);
  assert.ok(Number.isFinite(minCash));
  assert.ok(maxDebt <= CASH_ARREARS_CAP + 1000000, `debt ${maxDebt}`);
});
