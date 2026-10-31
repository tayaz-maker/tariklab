import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createGame,
  getActions,
  getGoals,
  getNpcLocation,
  getDeepView,
  resolveAction,
  previewAction,
  runRoutine,
  migrateState,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { EVENTS } from "../public/games/tc-sim-boardworld/content.mjs";

function fixture(options = {}) {
  const s = createGame(options);
  s.pendingEvents = [];
  s.resolvedEvents = EVENTS.map((e) => e.id);
  return s;
}
const option = (s, id) => getActions(s).find((a) => a.id === id);
function act(s, id) {
  const before = structuredClone(s),
    r = resolveAction(s, id);
  assert.deepEqual(s, before, "resolver input is immutable");
  assert.equal(r.ok, true, `${id}: ${r.message}`);
  assert.equal(validateState(r.state), true);
  return r.state;
}
function tick(s, d = day(s) + 1) {
  s.time = (d - 1) * 1440 - 30;
  return act(s, "wait:60");
}
const day = (s) => Math.floor(s.time / 1440) + 1;

test("legacy rejected actions preserve original identity and migration is pure and idempotent", () => {
  const path = new URL("./fixtures/boardworld/v1-fresh-newcomer.json", import.meta.url),
    envelope = JSON.parse(readFileSync(path, "utf8")),
    s = JSON.parse(envelope.payload),
    before = structuredClone(s);
  const r = resolveAction(s, "not-an-action");
  assert.equal(r.ok, false);
  assert.equal(r.state, s);
  assert.deepEqual(s, before);
  const upgraded = migrateState(s);
  assert.equal(upgraded.version, 2);
  assert.deepEqual(s, before);
  assert.deepEqual(migrateState(upgraded), upgraded);
});

test("selected-action preview matches committed deterministic resources without advancing the source", () => {
  let s = fixture({ scenario: "restart" });
  s = act(s, "apply:retail");
  const before = structuredClone(s),
    preview = previewAction(s, "work");
  assert.deepEqual(s, before);
  assert.equal(preview.ok, true);
  const next = act(s, "work");
  for (const key of ["cash", "bank", "debt"]) assert.equal(preview[key], next[key] - s[key]);
  for (const key of ["health", "energy", "hunger", "stress"])
    assert.equal(preview[key], next.player[key] - s.player[key]);
  assert.equal(preview.minutes, next.time - s.time);
  const invalid = previewAction(s, "business:serve");
  assert.equal(invalid.ok, false);
  assert.deepEqual(s, before);
});

test("NPCs never react to player finances they have not learned; disclosure records source and date", () => {
  let a = fixture(),
    b = structuredClone(a);
  b.debt = 19000;
  b.bank = 40000;
  a = tick(a, 2);
  b = tick(b, 2);
  assert.deepEqual(a.deep.npcs, b.deep.npcs, "hidden finances cannot affect NPC decisions");
  a.time = 10 * 60 + 1440;
  a.location = getNpcLocation(a, "baran");
  a = act(a, "deep:disclose:baran");
  assert.ok(
    a.deep.npcs.baran.knownFacts.some(
      (f) => f.id === "finances" && f.source === "Doğrudan anlattın",
    ),
  );
  assert.equal(
    a.deep.npcs.cem.knownFacts.some((f) => f.id === "finances"),
    false,
    "a stranger does not know the conversation",
  );
  assert.ok(
    getDeepView(a)
      .npcs.find((n) => n.id === "baran")
      .knownFacts.every((f) => !f.text.startsWith("finances:")),
  );
});

test("player promises change NPC resources on fulfillment and are penalized only once when missed", () => {
  let s = fixture();
  s.time = 10 * 60;
  s.location = getNpcLocation(s, "mert");
  s.npcs.mert.affinity = 35;
  s.deep.npcs.mert.request = { kind: "help", sinceDay: 1, deadlineDay: 5 };
  s = act(s, "deep:promise:mert");
  const id = s.deep.promises[0].id,
    before = s.deep.npcs.mert.cash;
  s = act(s, `deep:fulfill:${id}`);
  assert.equal(s.deep.promises[0].status, "kept");
  assert.equal(s.deep.npcs.mert.cash, before + 100);
  const earned = s.npcs.mert.trust;
  s.deep.npcs.mert.request = { kind: "help", sinceDay: 1, deadlineDay: 5 };
  s = act(s, "deep:promise:mert");
  s = tick(s, 4);
  assert.equal(s.deep.promises[1].status, "broken");
  assert.equal(s.npcs.mert.trust, earned - 10);
  s = tick(s, 5);
  assert.equal(s.npcs.mert.trust, earned - 10);
});

test("NPC support arrives on its actual due day or fails for its own financial circumstances", () => {
  let s = fixture();
  s.time = 10 * 60;
  s.location = getNpcLocation(s, "mert");
  s.npcs.mert.trust = 60;
  s = act(s, "deep:support:mert");
  const due = s.deep.promises[0].dueDay;
  const before = s.cash;
  s = tick(s, due);
  assert.equal(s.deep.promises[0].status, "kept");
  assert.equal(s.cash, before + 300);
  let failed = fixture();
  failed.time = 10 * 60;
  failed.location = getNpcLocation(failed, "mert");
  failed.npcs.mert.trust = 60;
  failed = act(failed, "deep:support:mert");
  failed.deep.npcs.mert.employment = "searching";
  failed.deep.npcs.mert.cash = 0;
  failed.deep.npcs.mert.savings = 0;
  failed = tick(failed, failed.deep.promises[0].dueDay);
  assert.equal(failed.deep.promises[0].status, "broken");
});

test("a salary negotiation raises only earned shift pay and planned notice preserves career standing", () => {
  let s = fixture();
  s = act(s, "apply:retail");
  s.job.shifts = 8;
  s.job.performance = 75;
  s.deep.career.reputation = 40;
  s.npcs.okan.trust = 30;
  s = act(s, "career:negotiate");
  const bonus = s.deep.career.negotiatedBonus;
  assert.equal(bonus, 100);
  const earned = s.job.earned;
  s = act(s, "work");
  assert.equal(s.job.earned - earned, 1100);
  s = act(s, "career:notice");
  const notice = s.deep.career.noticeDay;
  s.time = (notice - 1) * 1440 + 9 * 60;
  const reputation = s.deep.career.reputation,
    balance = s.bank,
    owed = s.job.earned;
  s = act(s, "resign");
  assert.equal(s.bank, balance + owed);
  assert.equal(s.deep.career.reputation, reputation + 2);
});

test("employer reports do not invent direct coworker observation after an NPC changed workplace", () => {
  let s = fixture();
  s = act(s, "apply:retail");
  s.deep.career.experience.retail = 4;
  s.deep.npcs.cem.work = "sisli";
  const affinity = s.npcs.cem.affinity;
  s = act(s, "work");
  assert.equal(s.npcs.cem.affinity, affinity);
  assert.ok(
    s.deep.npcs.okan.knownFacts.some((f) => f.id === "attendance" && f.source.includes("raporu")),
  );
});

test("reserve transfers conserve assets and a twice-missed debt plan safely terminates", () => {
  let s = fixture({ scenario: "restart" }),
    net = s.cash + s.bank + s.deep.finance.reserve - s.debt;
  s = act(s, "finance:reserve:2000");
  assert.equal(s.cash + s.bank + s.deep.finance.reserve - s.debt, net);
  s = act(s, "finance:reserve-withdraw");
  assert.equal(s.cash + s.bank - s.debt, net);
  s = act(s, "finance:debt-plan");
  s.cash = 0;
  s.bank = 0;
  s = tick(s, s.deep.finance.debtPlan.nextDay);
  assert.equal(s.deep.finance.debtPlan.missed, 1);
  s = tick(s, s.deep.finance.debtPlan.nextDay);
  assert.equal(s.deep.finance.debtPlan, null);
  assert.equal(validateState(s), true);
});

test("manual bills enter arrears once after grace period without duplicating debt principal", () => {
  let s = fixture();
  s = act(s, "finance:autopay");
  s = tick(s, 31);
  assert.ok(s.deep.finance.bills.some((b) => b.kind === "rent" && b.status === "due"));
  const amount = s.deep.finance.bills.find((b) => b.kind === "rent").amount;
  assert.equal(s.housing.arrears, 0);
  s = tick(s, 39);
  assert.equal(s.housing.arrears, amount);
  const debt = s.debt;
  s = tick(s, 40);
  assert.equal(s.housing.arrears, amount);
  assert.equal(s.debt, debt);
});

test("freelance work pays only on completed delivery and expired work retains its real loss", () => {
  let s = fixture({ scenario: "restart" }),
    before = s.cash + s.bank;
  s = act(s, "freelance:accept:repair");
  assert.equal(s.cash + s.bank, before - 350);
  assert.equal(option(s, "freelance:deliver").disabled, true);
  for (let i = 0; i < 3; i++) {
    s.player.energy = 90;
    s = act(s, "freelance:work");
  }
  s = act(s, "freelance:deliver");
  assert.equal(s.cash + s.bank, before - 350 + 1650);
  assert.equal(s.deep.freelance.completed, 1);
  s.time = 3 * 1440 + 8 * 60;
  s = act(s, "freelance:accept:repair");
  const cash = s.cash + s.bank;
  s = tick(s, s.deep.freelance.active.dueDay + 1);
  assert.equal(s.deep.freelance.active, null);
  assert.equal(s.cash + s.bank, cash);
});

test("microbusiness has paid acquisition, capped active service and unavoidable prorated overhead", () => {
  let s = fixture({ scenario: "restart" });
  s.cash = 10000;
  s.bank = 10000;
  s = act(s, "business:start:repair");
  assert.equal(s.deep.business.clients, 0);
  assert.equal(option(s, "business:serve").disabled, true);
  s = act(s, "business:acquire");
  s = act(s, "business:serve");
  assert.ok(s.deep.business.revenue > 0);
  assert.equal(option(s, "business:serve").disabled, true, "one service per day");
  const due = s.deep.business.nextOverheadDay,
    before = s.cash + s.bank,
    accrued = s.deep.business.accruedOverhead;
  s = act(s, "business:pause");
  assert.equal(s.cash + s.bank, before - Math.ceil(accrued));
  assert.equal(s.deep.business.accruedOverhead, 0);
  s = act(s, "business:pause");
  assert.equal(s.deep.business.nextOverheadDay, due);
  assert.ok(s.deep.business.accruedOverhead > 0, "resumed active time accrues new cost");
  s.deep.business.clients = 8;
  s.deep.business.level = 3;
  assert.equal(option(s, "business:acquire").disabled, true);
  assert.equal(option(s, "business:upgrade").disabled, true);
});

test("routines respect hard time bounds and stop before rent violates the reserved budget floor", () => {
  let s = fixture();
  s = act(s, "apply:retail");
  const start = s.time,
    r = runRoutine(s, 1);
  assert.ok(r.state.time - start <= 1440);
  assert.ok(!r.actions.some((id) => id.startsWith("event:") || id.startsWith("story:")));
  s = fixture();
  s.time = 29 * 1440 + 22 * 60;
  s.cash = 4300;
  s.bank = 0;
  s.player.hunger = 90;
  s.player.energy = 90;
  s.deep.routine.settings.work = false;
  s.deep.routine.settings.study = false;
  s.deep.routine.settings.shopping = false;
  const current = s.time,
    balance = s.cash;
  const planned = runRoutine(s, 1);
  assert.equal(planned.state.time, current);
  assert.equal(planned.state.cash, balance);
  assert.match(planned.message, /bütçe|ödeme/);
});

test("routines stop before an appointment and never consume a pending story decision", () => {
  let s = fixture();
  s.time = 17 * 60;
  s.appointments = [
    {
      id: "test-meet",
      npcId: "leyla",
      day: 1,
      minute: 18 * 60,
      location: "kadikoy",
      status: "scheduled",
    },
  ];
  const r = runRoutine(s, 1);
  assert.equal(r.state.time, s.time);
  assert.match(r.message, /randevu/);
  s = fixture();
  s.time = 3 * 1440 + 8 * 60;
  s = act(s, "wait:60");
  const before = s.time,
    choiceHistory = JSON.stringify(s.stories);
  const stopped = runRoutine(s, 7);
  assert.equal(stopped.state.time, before);
  assert.equal(JSON.stringify(stopped.state.stories), choiceHistory);
  assert.match(stopped.message, /hikâye/);
});

test("financial independence counts held emergency savings without making them spendable", () => {
  let enterprise = fixture({ scenario: "restart" });
  enterprise.cash = 10000;
  enterprise.bank = 10000;
  enterprise.debt = 0;
  enterprise = act(enterprise, "business:start:repair");
  enterprise.housing.id = "studio";
  enterprise.housing.rent = 8200;
  enterprise.housing.deposit = 8200;
  enterprise.cash = 0;
  enterprise.bank = 15100;
  enterprise.deep.business.arrears = 100;
  enterprise.deep.business.status = "paused";
  assert.equal(
    getGoals(enterprise).find((goal) => goal.id === "security").complete,
    false,
    "unpaid business overhead prevents a new debt-free goal",
  );
  enterprise = act(enterprise, "business:pause");
  assert.equal(enterprise.deep.business.arrears, 0);
  assert.equal(enterprise.bank, 15000);
  assert.equal(getGoals(enterprise).find((goal) => goal.id === "security").complete, true);
  assert.ok(enterprise.achievements.includes("security"));
  enterprise.deep.business.arrears = 200;
  assert.equal(
    getGoals(enterprise).find((goal) => goal.id === "security").complete,
    true,
    "a later setback does not revoke historical achievement",
  );
  let state = fixture();
  state.housing.id = "studio";
  state.housing.rent = 8200;
  state.housing.deposit = 8200;
  state.cash = 0;
  state.bank = 14950;
  state.deep.finance.reserve = 50;
  const security = () => getGoals(state).find((goal) => goal.id === "security");
  assert.equal(security().current, 15000);
  assert.equal(security().complete, true);
  state = act(state, "finance:reserve:5000");
  state = act(state, "finance:reserve:5000");
  state = act(state, "finance:reserve:2000");
  state = act(state, "finance:reserve:2000");
  state = act(state, "finance:reserve:500");
  assert.equal(state.bank, 450);
  assert.equal(state.deep.finance.reserve, 14550);
  assert.equal(security().current, 15000);
  assert.equal(security().complete, true);
  assert.ok(state.achievements.includes("security"), "the earned lifetime goal is permanent");
  const blocked = resolveAction(state, "finance:reserve:500");
  assert.equal(blocked.ok, false, "held reserve cannot pay an available-funds cost");
  assert.equal(blocked.state, state);
  const legacy = JSON.parse(
    JSON.parse(
      readFileSync(
        new URL("./fixtures/boardworld/v1-fresh-newcomer.json", import.meta.url),
        "utf8",
      ),
    ).payload,
  );
  assert.equal(
    getGoals(legacy).find((goal) => goal.id === "security").current,
    legacy.cash + legacy.bank,
  );
});
