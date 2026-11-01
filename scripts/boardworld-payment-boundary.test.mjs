import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  runRoutine,
  runCare,
  runUntilNext,
  validateState,
  resolveAction,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { EVENTS } from "../public/games/tc-sim-boardworld/content.mjs";
import { initCalendar } from "../public/games/tc-sim-boardworld/calendar.mjs";
import { initLiving } from "../public/games/tc-sim-boardworld/world-life.mjs";
import { initLife } from "../public/games/tc-sim-boardworld/life-systems.mjs";
import { initEmergent } from "../public/games/tc-sim-boardworld/emergent-life.mjs";
import { initSociety } from "../public/games/tc-sim-boardworld/society-systems.mjs";
import { initFlow, flowActions } from "../public/games/tc-sim-boardworld/daily-flow.mjs";
const DAY = 1440;
const boundary = 30 * DAY;
const utilities = (s) => s.transactions.filter((t) => t.label === "Elektrik, su ve telefon");
function fixture(care = false, at = boundary - 15) {
  const s = createGame({ scenario: "restart", seed: 2026 });
  s.pendingEvents = [];
  s.resolvedEvents = EVENTS.map((e) => e.id);
  s.time = at;
  s.cash = 20000;
  s.bank = 40000;
  s.debt = 0;
  s.player.hunger = 90;
  s.player.energy = care ? 20 : 90;
  initCalendar(s);
  initLiving(s);
  initLife(s);
  initEmergent(s);
  initSociety(s);
  initFlow(s);
  // A recent move can separate monthly utilities from the rent's due day.
  s.housing.dueDay = Math.floor(s.time / DAY) + 11;
  s.life.lease.stabilityUntil = Math.floor(s.time / DAY) + 61;
  s.deep.finance.autoPay = true;
  s.deep.routine.settings = { work: false, study: false, shopping: false };
  s.emergent.policy.bedtime = 1320;
  assert.ok(validateState(s));
  return s;
}

function weekly(care = false) {
  const s = fixture(care, 8 * DAY - 15);
  s.debt = 5000;
  s.deep.finance.debtPlan = { weeklyPayment: 1000, nextDay: 9, missed: 0 };
  assert.ok(validateState(s));
  return s;
}
for (const [name, run] of [
  ["routine", runRoutine],
  ["care", runCare],
  ["next important moment", runUntilNext],
]) {
  test(`${name}: review blocks an isolated utility payment before midnight without premature debit`, () => {
    const s = fixture(name === "care"),
      before = structuredClone(s),
      result = run(s);
    assert.ok(result.ok, result.message);
    assert.deepEqual(s, before);
    assert.ok(result.state.time < boundary, "the payment boundary must not be crossed");
    assert.equal(result.state.bank, s.bank);
    assert.equal(result.state.cash, s.cash);
    assert.equal(result.state.debt, 0);
    assert.equal(result.state.housing.dueDay, 40);
    assert.equal(utilities(result.state).length, 0);
    assert.equal(result.state.flow.stop.code, "payment");
    assert.ok(validateState(result.state));
  });
  test(`${name}: explicit existing-contract permission allows one actual utility charge`, () => {
    const s = fixture(name === "care");
    // Execute the real zero-time consent handler while isolating the boundary
    // from unrelated story-unlock effects (covered by full legal journeys).
    flowActions(s)
      .find((a) => a.id === "flow:payments:authorized")
      .run(s);
    const before = structuredClone(s),
      result = run(s);
    assert.ok(result.ok, result.message);
    assert.deepEqual(s, before);
    assert.ok(result.state.time >= boundary);
    assert.deepEqual(
      utilities(result.state).map((t) => [t.day, t.amount, t.account]),
      [[31, -900, "bank"]],
    );
    assert.equal(result.state.debt, 0);
    assert.equal(result.state.housing.dueDay, 40);
    assert.ok(validateState(result.state));
    const again = resolveAction(result.state, "wait:15");
    assert.ok(again.ok, again.message);
    assert.equal(utilities(again.state).length, 1, "the same monthly bill is not charged again");
  });
  test(`${name}: review blocks a weekly principal installment even though debt would decrease`, () => {
    const s = weekly(name === "care"),
      before = structuredClone(s),
      result = run(s);
    assert.ok(result.ok, result.message);
    assert.deepEqual(s, before);
    assert.ok(result.state.time < 8 * DAY);
    assert.equal(result.state.debt, 5000);
    assert.equal(result.state.bank, s.bank);
    assert.deepEqual(result.state.deep.finance.debtPlan, s.deep.finance.debtPlan);
    assert.equal(result.state.flow.stop.code, "payment");
    assert.ok(validateState(result.state));
  });
  test(`${name}: authorized weekly principal is paid exactly once from actual funds`, () => {
    const s = weekly(name === "care");
    flowActions(s)
      .find((a) => a.id === "flow:payments:authorized")
      .run(s);
    const result = run(s);
    assert.ok(result.ok, result.message);
    assert.ok(result.state.time >= 8 * DAY);
    assert.equal(result.state.debt, 4000);
    assert.deepEqual(result.state.deep.finance.debtPlan, {
      weeklyPayment: 1000,
      nextDay: 16,
      missed: 0,
    });
    assert.deepEqual(
      result.state.transactions
        .filter((t) => t.label === "Planlı anapara ödemesi")
        .map((t) => t.amount),
      [-1000],
    );
    const again = resolveAction(result.state, "wait:15");
    assert.ok(again.ok, again.message);
    assert.equal(again.state.debt, 4000);
    assert.equal(
      again.state.transactions.filter((t) => t.label === "Planlı anapara ödemesi").length,
      1,
    );
  });
  for (const missed of [0, 1])
    test(`${name}: authorization cannot silently incur ${missed ? "a second" : "an"} unaffordable installment miss`, () => {
      const s = weekly(name === "care");
      s.deep.finance.debtPlan.missed = missed;
      s.cash = 0;
      s.bank = 0;
      s.deep.routine.budgetFloor = 0;
      flowActions(s)
        .find((a) => a.id === "flow:payments:authorized")
        .run(s);
      const before = structuredClone(s),
        result = run(s);
      assert.ok(result.ok, result.message);
      assert.deepEqual(s, before);
      assert.ok(
        result.state.time < 8 * DAY,
        "stop before the unaffordable installment becomes a missed obligation",
      );
      assert.deepEqual(result.state.deep.finance.debtPlan, s.deep.finance.debtPlan);
      assert.equal(result.state.debt, 5000);
      assert.equal(result.state.flow.stop.code, "payment");
      assert.ok(validateState(result.state));
    });
}

function rentPlan(care = false) {
  const s = fixture(care, 8 * DAY - 15);
  s.housing.arrears = 4000;
  s.life.lease.stage = "plan";
  s.life.lease.plan = { installment: 1000, nextDay: 9, missed: 0 };
  s.life.lease.dueDay = 9;
  s.life.lease.lastArrears = 4000;
  assert.ok(validateState(s));
  return s;
}
for (const [name, run] of [
  ["routine", runRoutine],
  ["care", runCare],
  ["next important moment", runUntilNext],
]) {
  test(`${name}: review also protects a negotiated rent-arrears installment`, () => {
    const s = rentPlan(name === "care"),
      result = run(s);
    assert.ok(result.ok, result.message);
    assert.ok(result.state.time < 8 * DAY);
    assert.equal(result.state.bank, s.bank);
    assert.equal(result.state.housing.arrears, 4000);
    assert.deepEqual(result.state.life.lease.plan, s.life.lease.plan);
    assert.equal(result.state.flow.stop.code, "payment");
  });
  test(`${name}: existing rent-arrears permission allows one real installment`, () => {
    const s = rentPlan(name === "care");
    flowActions(s)
      .find((a) => a.id === "flow:payments:authorized")
      .run(s);
    const result = run(s);
    assert.ok(result.ok, result.message);
    assert.ok(result.state.time >= 8 * DAY);
    assert.equal(result.state.housing.arrears, 3000);
    assert.deepEqual(result.state.life.lease.plan, { installment: 1000, nextDay: 16, missed: 0 });
    assert.deepEqual(
      result.state.transactions
        .filter((t) => t.label === "Görüşülmüş kira birikimi taksiti")
        .map((t) => [t.amount, t.account]),
      [[-1000, "bank"]],
    );
    const again = resolveAction(result.state, "wait:15");
    assert.ok(again.ok, again.message);
    assert.equal(again.state.housing.arrears, 3000);
  });
  for (const missed of [0, 1])
    test(`${name}: consent cannot silently miss rent-plan installment ${missed + 1}`, () => {
      const s = rentPlan(name === "care");
      s.cash = 0;
      s.bank = 0;
      s.deep.routine.budgetFloor = 0;
      s.life.lease.plan.missed = missed;
      flowActions(s)
        .find((a) => a.id === "flow:payments:authorized")
        .run(s);
      const result = run(s);
      assert.ok(result.ok, result.message);
      assert.ok(result.state.time < 8 * DAY);
      assert.deepEqual(result.state.life.lease.plan, s.life.lease.plan);
      assert.equal(result.state.housing.arrears, 4000);
      assert.equal(result.state.life.lease.stage, "plan");
      assert.equal(result.state.flow.stop.code, "payment");
    });
}

function business(care = false, status = "active", funded = false) {
  let s = fixture(care, 480);
  const opened = resolveAction(s, "business:start:repair");
  assert.ok(opened.ok, opened.message);
  s = opened.state;
  // Isolate the contractual weekly charge from six days of unrelated events.
  s.time = 7 * DAY - 15;
  s.cash = funded ? 20000 : 0;
  s.bank = funded ? 40000 : 0;
  s.debt = 0;
  s.player.hunger = 90;
  s.player.energy = care ? 20 : 90;
  s.deep.business.status = status;
  s.deep.business.accruedOverhead = 400;
  initCalendar(s);
  initLiving(s);
  initLife(s);
  initEmergent(s);
  initSociety(s);
  initFlow(s);
  s.housing.dueDay = 20;
  s.life.lease.stabilityUntil = 60;
  s.deep.routine.budgetFloor = 0;
  assert.ok(validateState(s));
  return s;
}
for (const [name, run] of [
  ["routine", runRoutine],
  ["care", runCare],
  ["next important moment", runUntilNext],
]) {
  for (const status of ["active", "paused"])
    test(`${name}: an unpaid accrued business fee cannot silently create arrears (${status})`, () => {
      const s = business(name === "care", status);
      flowActions(s)
        .find((a) => a.id === "flow:payments:authorized")
        .run(s);
      const result = run(s);
      assert.ok(result.ok, result.message);
      assert.ok(result.state.time < 7 * DAY);
      assert.equal(result.state.deep.business.arrears, s.deep.business.arrears);
      assert.equal(result.state.deep.business.status, status);
      assert.equal(result.state.flow.stop.code, "payment");
      assert.ok(validateState(result.state));
    });
  test(`${name}: review blocks a funded weekly business overhead charge`, () => {
    const s = business(name === "care", "active", true),
      result = run(s);
    assert.ok(result.ok, result.message);
    assert.ok(result.state.time < 7 * DAY);
    assert.equal(result.state.bank, s.bank);
    assert.equal(result.state.deep.business.nextOverheadDay, s.deep.business.nextOverheadDay);
    assert.equal(result.state.deep.business.costs, s.deep.business.costs);
    assert.equal(result.state.flow.stop.code, "payment");
  });
  test(`${name}: explicit business overhead consent settles one real charge`, () => {
    const s = business(name === "care", "active", true);
    flowActions(s)
      .find((a) => a.id === "flow:payments:authorized")
      .run(s);
    const before = structuredClone(s),
      result = run(s);
    assert.ok(result.ok, result.message);
    assert.deepEqual(s, before);
    assert.ok(result.state.time >= 7 * DAY);
    const fees = result.state.transactions.filter(
      (t) => t.label === "Mikro işletme · haftalık sabit gider",
    );
    assert.equal(fees.length, 1);
    assert.ok(fees[0].amount <= -400);
    assert.equal(fees[0].account, "bank");
    assert.equal(result.state.deep.business.costs - s.deep.business.costs, -fees[0].amount);
    assert.equal(result.state.deep.business.nextOverheadDay, s.deep.business.nextOverheadDay + 7);
    assert.equal(result.state.deep.business.arrears, 0);
    const again = resolveAction(result.state, "wait:15");
    assert.ok(again.ok, again.message);
    assert.equal(
      again.state.transactions.filter((t) => t.label === "Mikro işletme · haftalık sabit gider")
        .length,
      1,
    );
  });
}
