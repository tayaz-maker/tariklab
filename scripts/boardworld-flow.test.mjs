import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  getActions,
  getDecisionView,
  getGoals,
  resolveAction,
  runRoutine,
  runCare,
  validateState,
  migrateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { initCalendar } from "../public/games/tc-sim-boardworld/calendar.mjs";
import { initLiving } from "../public/games/tc-sim-boardworld/world-life.mjs";
import { initLife } from "../public/games/tc-sim-boardworld/life-systems.mjs";
import { initEmergent } from "../public/games/tc-sim-boardworld/emergent-life.mjs";
import { initSociety } from "../public/games/tc-sim-boardworld/society-systems.mjs";
import {
  initFlow,
  flowActions,
  routineFingerprint,
  authorizedSettlement,
  validateFlow,
} from "../public/games/tc-sim-boardworld/daily-flow.mjs";
import { EVENTS } from "../public/games/tc-sim-boardworld/content.mjs";
const DAY = 1440;
function fixture(time = 600) {
  const s = createGame({ scenario: "restart", seed: 2026 });
  s.pendingEvents = [];
  s.resolvedEvents = EVENTS.map((e) => e.id);
  s.time = time;
  s.cash = 20000;
  s.bank = 40000;
  s.debt = 5000;
  s.player.hunger = 90;
  s.player.energy = 90;
  initCalendar(s);
  initLiving(s);
  initLife(s);
  initEmergent(s);
  initSociety(s);
  initFlow(s);
  assert.equal(validateState(s), true);
  return s;
}
function act(s, id) {
  const r = resolveAction(s, id);
  assert.equal(r.ok, true, id + ": " + r.message);
  assert.equal(validateState(r.state), true, id);
  return r.state;
}
function policy(s) {
  s.deep.routine.settings = { work: false, study: false, shopping: false };
  s.emergent.policy.bedtime = 1320;
}
test("disabled weekday exposes direct recovery and cannot create revision-only retries", () => {
  let s = fixture();
  s.emergent.policy.days[0] = false;
  const before = structuredClone(s),
    view = getDecisionView(s);
  assert.equal(view.routine.code, "weekday");
  assert.ok(view.routine.actionIds.includes("policy:day:0"));
  for (let i = 0; i < 20; i++) {
    const r = runRoutine(s);
    assert.equal(r.ok, false);
    assert.equal(r.state, s);
  }
  assert.deepEqual(s, before);
  s = act(s, "policy:day:0");
  assert.equal(getDecisionView(s).routine.retryAllowed, true);
});
test("real meal stop stores one diagnostic; identical repeat is atomic; policy fixes unlock it", () => {
  let s = fixture();
  policy(s);
  s.player.hunger = 30;
  s.cash = 0;
  s.inventory.groceries = 0;
  const first = runRoutine(s);
  assert.equal(first.ok, true);
  assert.equal(first.state.time, s.time);
  assert.equal(first.state.flow.stop.code, "meal");
  s = first.state;
  assert.equal(getActions(s).find((a) => a.id === "schedule:run:1").disabled, true);
  const again = runRoutine(s);
  assert.equal(again.ok, false);
  assert.equal(again.state, s);
  assert.ok(getDecisionView(s).routine.actionIds.includes("withdraw:1000"));
  s = act(s, "withdraw:1000");
  assert.equal(getActions(s).find((a) => a.id === "schedule:run:1").disabled, false);
});
test("fingerprint ignores logs/revision but follows actual policy, stock and budget recovery", () => {
  const s = fixture(),
    k = routineFingerprint(s),
    n = structuredClone(s);
  n.revision++;
  n.history.push({ day: 1, time: 600, text: "attempt" });
  assert.equal(routineFingerprint(n), k);
  n.society.districts[s.location].foodStock--;
  assert.notEqual(routineFingerprint(n), k);
});
test("monthly contractual settlement requires consent and preserves independent debt choice", () => {
  let s = fixture(29 * DAY + 1320);
  policy(s);
  s.housing.dueDay = 31;
  s.life.lease.stabilityUntil = 90;
  const before = structuredClone(s),
    r = runRoutine(s);
  assert.equal(r.state.time, s.time);
  assert.equal(r.state.debt, s.debt);
  assert.equal(r.state.bank, s.bank);
  assert.equal(r.state.flow.stop.code, "payment");
  assert.ok(getDecisionView(r.state).routine.actionIds.includes("flow:payments:authorized"));
  // Isolate the midnight batch; real zero-time authorization is tested separately.
  s = before;
  flowActions(s)
    .find((a) => a.id === "flow:payments:authorized")
    .run(s);
  const next = runRoutine(s);
  assert.ok(next.state.time > s.time, next.message);
  assert.ok(next.actions.includes("sleep"));
  assert.equal(next.state.debt, 5150);
  assert.equal(s.debt, 5000);
  assert.equal(next.state.housing.arrears, 0);
});
test("consent cannot override budget floor, changed lease or new debt; revoke remains zero-time", () => {
  let s = act(fixture(), "flow:payments:authorized");
  const n = structuredClone(s);
  n.debt += 5000;
  n.transactions.push({ day: 1, label: "Yeni kredi", amount: 5000, account: "debt" });
  assert.equal(authorizedSettlement(s, n), false);
  n.debt = s.debt;
  n.transactions = s.transactions;
  n.housing.rent++;
  assert.equal(authorizedSettlement(s, n), false);
  const low = structuredClone(s);
  low.cash = 0;
  low.bank = 0;
  assert.equal(authorizedSettlement(s, low), false);
  const time = s.time,
    cash = s.cash,
    bank = s.bank;
  s = act(s, "flow:payments:review");
  assert.equal(s.time, time);
  assert.equal(s.cash, cash);
  assert.equal(s.bank, bank);
  assert.equal(s.flow.consent, null);
});
test("taking a loan or changing automatic billing revokes existing routine consent", () => {
  for (const id of ["loan", "finance:autopay", "finance:debt-plan"]) {
    let s = act(fixture(), "flow:payments:authorized");
    s = act(s, id);
    assert.equal(s.flow.settlements, "review", id);
    assert.equal(s.flow.consent, null, id);
  }
});
test("explicit care batches real actions, preserves closed day choice and stops at bounded horizon", () => {
  let s = fixture();
  s.emergent.policy.days[0] = false;
  s.player.hunger = 30;
  s.player.energy = 40;
  s.inventory.groceries = 4;
  const original = structuredClone(s),
    r = runCare(s);
  assert.equal(r.ok, true);
  assert.ok(r.actions.length > 0 && r.actions.length <= 8);
  assert.ok(r.state.time > s.time && r.state.time <= s.time + 480);
  assert.equal(r.state.emergent.policy.days[0], false);
  assert.deepEqual(s, original);
  assert.ok(
    r.actions.every(
      (id) =>
        ["cook", "rest", "buy:groceries", "withdraw:1000", "eat", "soup", "snack"].includes(id) ||
        /^(travel|walk):/.test(id),
    ),
  );
  let replay = s;
  for (const id of r.actions) replay = act(replay, id);
  for (const key of ["time", "cash", "bank", "debt", "rng", "player", "npcs", "society"])
    assert.deepEqual(r.state[key], replay[key], key);
});
test("care refuses event/story and insufficient funds without silently choosing new payments", () => {
  const fresh = createGame();
  assert.equal(runCare(fresh).ok, false);
  let s = fixture(29 * DAY + 1380);
  s.player.energy = 20;
  s.player.hunger = 90;
  s.cash = 0;
  s.bank = 100;
  s.deep.routine.budgetFloor = 300;
  const r = runCare(s);
  assert.equal(r.state.time, s.time);
  assert.equal(r.state.bank, s.bank);
  assert.equal(r.state.flow.stop.blocked, true);
});
test("daily obligation actions refer to real unpaid bills and actual promises", () => {
  const s = fixture();
  s.deep.finance.bills.push({
    id: "flow-bill",
    kind: "utility",
    label: "Fatura",
    amount: 100,
    dueDay: 1,
    status: "due",
  });
  const actions = getActions(s),
    view = getDecisionView(s, { actions });
  assert.equal(view.routine.code, "bill");
  assert.ok(view.routine.actionIds.includes("finance:bill:flow-bill"));
  assert.ok(view.routine.actionIds.every((id) => actions.some((a) => a.id === id && !a.disabled)));
});
test("schema5 flow migration is neutral and malformed diagnostics are rejected", () => {
  const s = fixture();
  delete s.society;
  delete s.flow;
  s.version = 4;
  const old = structuredClone(s),
    v = migrateState(s);
  assert.equal(v.version, 5);
  assert.deepEqual(s, old);
  for (const key of ["time", "rng", "cash", "bank", "debt", "living", "life", "npcs"])
    assert.deepEqual(v[key], old[key], key);
  assert.equal(v.flow.settlements, "review");
  assert.equal(v.flow.consent, null);
  v.flow.stop = { code: "x" };
  assert.equal(validateFlow(v), false);
  assert.equal(validateState(v), false);
});
test("sustainable entrepreneur goal has no employment requirement and excludes debt or unprofitable stock churn", () => {
  const s = fixture(90 * DAY);
  s.deep.business = {
    id: "repair",
    location: "kadikoy",
    status: "active",
    revenue: 12000,
    costs: 8000,
    accruedOverhead: 500,
    reputation: 65,
    arrears: 0,
  };
  s.living.enterprise.capital = 3000;
  s.deep.finance.reserve = 3000;
  s.debt = 0;
  const goal = () => getGoals(s).find((g) => g.id === "sustainable-business");
  assert.equal(goal().complete, true);
  s.deep.business.costs = 13000;
  assert.equal(goal().complete, false);
  s.deep.business.costs = 8000;
  s.debt = 1;
  assert.equal(goal().complete, false);
});
test("wait records a payment boundary once and cannot keep issuing zero-time retries", () => {
  const s = fixture(29 * DAY + 1425);
  s.housing.dueDay = 31;
  const first = resolveAction(s, "calendar:next");
  assert.equal(first.ok, true);
  assert.equal(first.state.time, s.time);
  assert.equal(first.state.flow.stop.scope, "wait");
  assert.equal(first.state.flow.stop.code, "payment");
  const a = getActions(first.state).find((x) => x.id === "calendar:next");
  assert.equal(a.disabled, true);
  const r = resolveAction(first.state, "calendar:next");
  assert.equal(r.ok, false);
  assert.equal(r.state, first.state);
  assert.ok(
    getDecisionView(first.state).urgent.some((x) => x.id === "batch-blocker" && x.actionIds.length),
  );
});
test("new rent terms stop a consented routine; monthly interest alone cannot hide a lease increase", () => {
  const s = fixture(29 * DAY + 1320);
  policy(s);
  s.housing.dueDay = 31;
  flowActions(s)
    .find((a) => a.id === "flow:payments:authorized")
    .run(s);
  const r = runRoutine(s);
  assert.equal(r.state.time, s.time);
  assert.equal(r.state.housing.rent, s.housing.rent);
  assert.equal(r.state.debt, s.debt);
  assert.equal(r.state.flow.stop.code, "payment");
});
