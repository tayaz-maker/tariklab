import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame,
  getActions,
  getLivingView,
  getGoals,
  resolveAction,
  validateState,
  previewAction,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import {
  initLiving,
  tickLiving,
  nextLivingAt,
  getNpcPlan,
  validateLiving,
  getHouseholdEffects,
} from "../public/games/tc-sim-boardworld/world-life.mjs";
import { NPCS, EVENTS } from "../public/games/tc-sim-boardworld/content.mjs";
import { PROJECT_TYPES } from "../public/games/tc-sim-boardworld/world-content.mjs";
import { travelMinutes } from "../public/games/tc-sim-boardworld/city.mjs";
import { reveal } from "../public/games/tc-sim-boardworld/deep-life.mjs";
import { societyContact } from "../public/games/tc-sim-boardworld/society-systems.mjs";
const DAY = 1440;
function fixture(options = {}) {
  const s = createGame(options);
  s.pendingEvents = [];
  s.resolvedEvents = EVENTS.map((e) => e.id);
  return s;
}
const action = (s, id) => getActions(s).find((a) => a.id === id);
function act(s, id, payload) {
  const before = structuredClone(s),
    r = resolveAction(s, id, payload);
  assert.equal(r.ok, true, `${id}: ${r.message}`);
  assert.deepEqual(s, before);
  assert.equal(validateState(r.state), true);
  return r.state;
}
const api = {
  travelMinutes,
  playerPresent: () => false,
  npcCommitments: (s, id, a, b) =>
    s.calendar.entries.filter(
      (e) => e.status === "confirmed" && e.npcId === id && e.start < b && a < e.end,
    ),
  memory: (s, id, text) => {
    s.npcs[id].memories.push({ day: Math.floor(s.time / DAY) + 1, text });
    s.npcs[id].memories = s.npcs[id].memories.slice(-12);
  },
  news: () => {},
  log: () => {},
  reveal,
};
function worldUntil(s, target, observed = false) {
  const helpers = observed ? { ...api, playerPresent: () => true } : api;
  while (s.time < target) {
    s.time = Math.min(nextLivingAt(s), target);
    tickLiving(s, helpers);
    assert.equal(validateLiving(s), true, `world state invalid at ${s.time}`);
  }
  return s;
}
function atTime(s, time) {
  s.time = time;
  s.calendar.lastTick = time;
  initLiving(s);
  return s;
}
function sumPopulation(s, key) {
  return Object.values(s.living.population.districts).reduce(
    (sum, c) => sum + (key ? c[key] : c.employed + c.jobseekers + c.students),
    0,
  );
}

test("four project families have bounded real targets and all planning controls are atomic", () => {
  let s = fixture();
  assert.equal(PROJECT_TYPES.length, 4);
  const original = structuredClone(s);
  const r = resolveAction(s, "project:start:qualification:imaginary:45");
  assert.equal(r.ok, false);
  assert.equal(r.state, s);
  assert.deepEqual(s, original);
  s = act(s, "project:start:qualification:craft:45");
  assert.equal(s.living.projects[0].progress.filter(Boolean).length, 0);
  s = act(s, "project:budget:project-1:2000");
  assert.equal(s.living.projects[0].budget, 2000);
  const due = s.living.projects[0].dueDay;
  s = act(s, "project:extend:project-1");
  assert.equal(s.living.projects[0].dueDay, due + 14);
  assert.equal(action(s, "project:extend:project-1").disabled, true);
  s = act(s, "project:abandon:project-1");
  assert.equal(s.living.projects[0].status, "failed");
  assert.equal(s.cash, original.cash);
  assert.equal(s.bank, original.bank);
});

test("qualification needs actual preparation, certificate and skill; completion reward cannot repeat", () => {
  let s = fixture({ scenario: "restart" });
  s.cash = 10000;
  s.bank = 10000;
  s = act(s, "project:start:qualification:craft:45");
  s = act(s, "practice:craft");
  assert.deepEqual(s.living.projects[0].progress, [true, false, false]);
  s.player.skills.craft = 60;
  s.documents.push({
    id: "certificate-repair",
    title: "Uygulamalı tamir",
    text: "Completed course fixture",
    day: 1,
  });
  const reputation = s.deep.career.reputation;
  s = act(s, "wait:15");
  assert.equal(s.living.projects[0].status, "complete");
  assert.equal(s.deep.career.reputation, reputation + 5);
  assert.ok(s.documents.some((d) => d.id === "project-1"));
  s = act(s, "wait:15");
  assert.equal(s.deep.career.reputation, reputation + 5);
  assert.equal(action(s, "project:start:qualification:craft:45"), undefined);
});

test("project budget blocks its costly action before time or money changes", () => {
  let s = fixture({ scenario: "restart" });
  s.cash = 10000;
  s.bank = 10000;
  s = act(s, "project:start:enterprise:repair:90");
  s = act(s, "project:budget:project-1:2000");
  const before = structuredClone(s),
    r = resolveAction(s, "business:start:repair");
  assert.equal(r.ok, false);
  assert.match(r.message, /bütçesi/);
  assert.equal(r.state, s);
  assert.deepEqual(s, before);
  s = act(s, "project:budget:project-1:15000");
  s = act(s, "business:start:repair");
  assert.equal(s.living.projects[0].spent, 3600);
  assert.equal(s.living.projects[0].progress[0], true);
});

test("relocation project conserves actual deposit/money and requires actual move", () => {
  let s = fixture();
  s.cash = 30000;
  s.bank = 30000;
  s = act(s, "project:start:relocation:studio:60");
  s = act(s, "travel:besiktas");
  assert.equal(s.living.projects[0].progress[0], true);
  assert.equal(s.living.projects[0].status, "active");
  const movingCost = action(s, "move:studio").cost,
    oldFunds = s.cash + s.bank,
    oldDeposit = s.housing.deposit;
  s = act(s, "move:studio");
  assert.equal(s.cash + s.bank, oldFunds - movingCost + oldDeposit);
  assert.equal(s.housing.id, "studio");
  assert.equal(s.living.projects[0].status, "complete");
  assert.equal(s.living.projects[0].spent, movingCost);
});

test("relationship project needs a kept promise and meaningful readiness, not only gifts", () => {
  let s = fixture();
  atTime(s, 18 * 60);
  s.location = s.deep.npcs.ece.home;
  s.npcs.ece.affinity = 60;
  s.npcs.ece.trust = 60;
  s.deep.npcs.ece.request = { kind: "help", sinceDay: 1, deadlineDay: 4 };
  s = act(s, "project:start:relationship:ece:30");
  s = act(s, "talk:ece");
  assert.equal(s.living.projects[0].status, "active");
  s = act(s, "deep:promise:ece");
  const promise = s.deep.promises.at(-1);
  s = act(s, `deep:fulfill:${promise.id}`);
  assert.equal(s.living.projects[0].status, "complete");
  assert.equal(s.deep.promises.at(-1).status, "kept");
});

test("project expiry is once-only and preserves earned skill and real assets", () => {
  let s = fixture({ scenario: "restart" });
  s = act(s, "project:start:qualification:craft:45");
  const skills = structuredClone(s.player.skills);
  worldUntil(s, 47 * DAY);
  assert.equal(s.living.projects[0].status, "failed");
  assert.deepEqual(s.player.skills, skills);
  const prior = structuredClone(s);
  tickLiving(s, api);
  assert.deepEqual(s, prior);
});

test("enterprise funding and withdrawals conserve owned money and are not revenue", () => {
  let s = fixture({ scenario: "restart" });
  s.cash = 10000;
  s.bank = 10000;
  s = act(s, "business:start:repair");
  const before = s.cash + s.bank;
  s = act(s, "business:fund:2000");
  assert.equal(s.cash + s.bank + s.living.enterprise.capital, before);
  assert.equal(s.deep.business.revenue, 0);
  assert.equal(s.deep.business.costs, 3600);
  s = act(s, "business:withdraw:2000");
  assert.equal(s.cash + s.bank, before);
  assert.equal(s.living.enterprise.capital, 0);
  assert.equal(s.deep.business.revenue, 0);
  assert.equal(action(s, "business:acquire").disabled, true);
});

test("enterprise uses prepaid stock once, responds to demand and closes with one conserved settlement", () => {
  let s = fixture({ scenario: "restart" });
  s.cash = 10000;
  s.bank = 10000;
  s = act(s, "business:start:repair");
  s = act(s, "business:fund:2000");
  s = act(s, "business:stock:6");
  assert.equal(s.living.enterprise.stock, 6);
  assert.equal(s.living.enterprise.capital, 1040);
  s = act(s, "business:acquire");
  const costs = s.deep.business.costs,
    bank = s.bank,
    cash = s.cash,
    capital = s.living.enterprise.capital;
  s = act(s, "business:serve");
  assert.equal(s.bank, bank);
  assert.equal(s.cash, cash);
  assert.equal(s.living.enterprise.stock, 5);
  assert.equal(s.deep.business.costs - costs, 30);
  assert.equal(s.living.enterprise.capital, capital + s.deep.business.revenue - 30);
  const b = s.deep.business,
    e = s.living.enterprise,
    expected =
      s.cash +
      s.bank +
      e.capital +
      Math.floor(e.stock * 160 * 0.35) +
      900 -
      b.arrears -
      Math.ceil(b.accruedOverhead);
  s = act(s, "business:close");
  assert.equal(s.cash + s.bank, expected);
  assert.equal(s.deep.business, null);
  assert.equal(s.living.enterprise.capital, 0);
  assert.equal(action(s, "business:close"), undefined);
});

test("market contraction changes actual service revenue and limits new customers", () => {
  let s = fixture({ scenario: "restart" });
  s.cash = 10000;
  s.bank = 10000;
  s = act(s, "business:start:repair");
  s = act(s, "business:fund:2000");
  s = act(s, "business:stock:6");
  s.deep.business.clients = 3;
  const high = structuredClone(s),
    low = structuredClone(s);
  high.living.markets.kadikoy.demand = 94;
  low.living.markets.kadikoy.demand = 46;
  const a = act(high, "business:serve"),
    b = act(low, "business:serve");
  assert.ok(a.deep.business.revenue > b.deep.business.revenue);
  assert.ok(a.living.enterprise.stock < b.living.enterprise.stock);
  assert.equal(action(low, "business:acquire").disabled, true);
});

test("household purchases have portable bounded benefits and expired maintenance disables them", () => {
  let s = fixture({ scenario: "restart" });
  s.cash = 10000;
  s.bank = 10000;
  s = act(s, "household:buy:desk");
  s = act(s, "household:buy:kitchen");
  assert.equal(getHouseholdEffects(s).practiceBonus, 1);
  const skill = s.player.skills.craft;
  s = act(s, "practice:craft");
  assert.equal(s.player.skills.craft - skill, 3);
  assert.equal(action(s, "cook").minutes, 30);
  s.location = "besiktas";
  assert.equal(getHouseholdEffects(s).practiceBonus, 0);
  s.location = "kadikoy";
  s.living.household.maintainedUntil = s.time;
  assert.equal(getHouseholdEffects(s).practiceBonus, 0);
  s = act(s, "household:maintain");
  assert.equal(getHouseholdEffects(s).practiceBonus, 1);
  assert.equal(action(s, "household:maintain").disabled, true);
});

test("cash-poor bank-rich social date is rejected without spending from the wrong account", () => {
  const s = fixture();
  atTime(s, 18 * 60);
  s.location = s.deep.npcs.ece.home;
  s.npcs.ece.affinity = 70;
  s.npcs.ece.trust = 70;
  s.cash = 0;
  s.bank = 20000;
  assert.equal(action(s, "date:ece").disabled, true);
  const before = structuredClone(s),
    r = resolveAction(s, "date:ece");
  assert.equal(r.ok, false);
  assert.equal(r.state, s);
  assert.deepEqual(s, before);
});

test("working and commuting NPCs are unavailable for long conversations and calls", () => {
  let s = fixture();
  atTime(s, 10 * 60);
  s.location = s.deep.npcs.mert.work;
  assert.equal(getNpcPlan(s, "mert", s.time, s.time + 1)[0].kind, "work");
  assert.equal(action(s, "talk:mert").disabled, true);
  assert.equal(action(s, "call:mert").disabled, true);
  atTime(s, 18 * 60);
  s.location = s.deep.npcs.mert.home;
  assert.equal(action(s, "call:mert").disabled, false);
});

test("NPC utility decisions reserve both people and change directed edges asymmetrically once", () => {
  const s = fixture();
  atTime(s, DAY + 20 * 60);
  for (const id of ["ece", "mert"]) {
    s.deep.npcs[id].home = "kadikoy";
    s.deep.npcs[id].cash = 1500;
    s.living.npcs[id].energy = 100;
    s.living.npcs[id].social = 0;
    for (const e of Object.values(s.living.graph[id])) {
      e.affinity = 0;
      e.trust = 0;
    }
  }
  const a = s.living.graph.ece.mert,
    b = s.living.graph.mert.ece;
  a.affinity = 90;
  a.trust = 50;
  b.affinity = 70;
  b.trust = 40;
  a.lastContactAt = 0;
  b.lastContactAt = 0;
  worldUntil(s, DAY + 21 * 60);
  const planned = s.living.npcs.ece.plan.find((p) => p.kind === "social" && p.target === "mert");
  assert.ok(planned);
  assert.ok(
    s.living.npcs.mert.plan.some(
      (p) => p.kind === "visit" && p.target === "ece" && p.end === planned.end,
    ),
  );
  const startA = a.trust,
    startB = b.trust;
  worldUntil(s, planned.end);
  assert.equal(a.trust, startA + 3);
  assert.equal(b.trust, startB + 2);
  const before = structuredClone(s);
  tickLiving(s, api);
  assert.deepEqual(s, before);
});

test("unobserved NPC moves stay out of shared memories and learned profile", () => {
  const s = fixture();
  for (const n of NPCS) {
    s.npcs[n.id].affinity = 0;
    s.npcs[n.id].trust = 0;
  }
  const initial = getLivingView(s),
    memories = structuredClone(s.npcs.derya.memories);
  worldUntil(s, 80 * DAY);
  assert.notEqual(s.deep.npcs.derya.home, initial.npcs.find((n) => n.id === "derya").knownHome);
  assert.equal(
    getLivingView(s).npcs.find((n) => n.id === "derya").knownHome,
    initial.npcs.find((n) => n.id === "derya").knownHome,
  );
  assert.deepEqual(s.npcs.derya.memories, memories);
  assert.equal(getLivingView(s).npcs.find((n) => n.id === "derya").observedChanges.length, 0);
});

test("background population conserves residents and households through real weekly labor and migration flows", () => {
  const s = fixture(),
    before = structuredClone(s.living.population);
  worldUntil(s, 90 * DAY);
  assert.equal(sumPopulation(s), 450);
  assert.equal(sumPopulation(s, "households"), 240);
  assert.notDeepEqual(s.living.population.districts, before.districts);
  assert.ok(s.living.population.settledWeek >= 12);
  assert.ok(
    Object.values(s.living.population.districts).every(
      (c) => c.jobseekers >= 0 && c.students >= 0 && c.households <= c.capacity,
    ),
  );
  const once = structuredClone(s);
  tickLiving(s, api);
  assert.deepEqual(s, once);
});

test("90-day autonomous world is exactly replayable with bounded plans, graph, changes and learned feed", () => {
  const a = fixture({ seed: 221 }),
    b = structuredClone(a);
  worldUntil(a, 90 * DAY, true);
  worldUntil(b, 90 * DAY, true);
  assert.deepEqual(a, b);
  assert.ok(Object.values(a.living.npcs).every((n) => n.decisions <= 4 && n.plan.length <= 16));
  assert.ok(a.living.feed.length <= 32);
  assert.ok(Object.values(a.living.known).every((k) => k.changes.length <= 10));
  assert.ok(Object.values(a.deep.npcs).some((n) => n.level > 0));
  assert.ok(Object.values(a.deep.npcs).some((n) => n.lastMoveDay > 0));
});

test("strict living validator rejects unknown fields, nonfinite values and malformed graph/project plans", () => {
  const s = fixture();
  for (const mutate of [
    (x) => (x.living.unknown = 1),
    (x) => (x.living.npcs.ece.energy = NaN),
    (x) => (x.living.graph.ece.ece = {}),
    (x) => (x.living.enterprise.capital = -1),
    (x) => x.living.population.districts.kadikoy.students++,
    (x) => (x.living.npcs.ece.plan[0].kind = "invented"),
  ]) {
    const next = structuredClone(s);
    mutate(next);
    assert.equal(validateState(next), false);
  }
});

test("enterprise capital contributes to financial independence but cannot pay personal purchases", () => {
  let s = fixture({ scenario: "restart" });
  s.cash = 20000;
  s.bank = 20000;
  s.debt = 0;
  s = act(s, "business:start:repair");
  s = act(s, "business:fund:5000");
  s.housing.id = "studio";
  s.housing.rent = 8200;
  s.housing.deposit = 8200;
  s.cash = 0;
  s.bank = 10000;
  assert.equal(getGoals(s).find((g) => g.id === "security").current, 15000);
  assert.equal(getGoals(s).find((g) => g.id === "security").complete, true);
  s.cash = 0;
  s.bank = 0;
  assert.equal(action(s, "business:fund:500").disabled, true);
  assert.equal(s.living.enterprise.capital, 5000);
});

test("capital and stock action previews are pure and match committed balances", () => {
  let s = fixture({ scenario: "restart" });
  s.cash = 10000;
  s.bank = 10000;
  s = act(s, "business:start:repair");
  const before = structuredClone(s),
    p = previewAction(s, "business:fund:2000"),
    next = act(s, "business:fund:2000");
  assert.equal(p.ok, true);
  assert.deepEqual(s, before);
  assert.equal(p.bank, next.bank - s.bank);
  assert.equal(p.cash, next.cash - s.cash);
});

test("ordinary player conversations reserve the NPC across a utility-decision boundary", () => {
  let s = fixture();
  atTime(s, 17 * 60 + 45);
  s.location = s.deep.npcs.ece.home;
  s.living.npcs.ece.energy = 100;
  s.living.npcs.ece.social = 0;
  s = act(s, "talk:ece");
  assert.equal(s.time, 18 * 60 + 30);
  assert.equal(
    s.living.npcs.ece.plan.some(
      (p) => p.start < 18 * 60 + 30 && p.end > s.time && p.kind !== "sleep",
    ),
    false,
  );
  assert.equal(s.npcs.ece.lastTalkDay, 1);
});

test("enterprise project requires service and profit after costs, then rewards only once", () => {
  let s = fixture({ scenario: "restart" });
  s.cash = 10000;
  s.bank = 10000;
  s = act(s, "project:start:enterprise:repair:90");
  s = act(s, "business:start:repair");
  s = act(s, "business:fund:2000");
  s = act(s, "business:stock:6");
  s.deep.business.clients = 3;
  assert.equal(s.living.projects[0].progress[1], false);
  s.deep.business.revenue = s.deep.business.costs + 1900;
  s = act(s, "business:serve");
  assert.equal(s.living.projects[0].status, "complete");
  const reputation = s.deep.business.reputation;
  s = act(s, "wait:15");
  assert.equal(s.deep.business.reputation, reputation);
});

test("NPC support from another NPC moves real cash and creates a reciprocal repayment obligation", () => {
  const s = fixture();
  atTime(s, DAY + 20 * 60);
  for (const id of ["ece", "mert"]) {
    s.deep.npcs[id].home = "kadikoy";
    s.living.npcs[id].energy = 100;
    s.living.npcs[id].social = 100;
    for (const e of Object.values(s.living.graph[id])) {
      e.affinity = 0;
      e.trust = 0;
    }
  }
  s.deep.npcs.ece.cash = 1500;
  s.deep.npcs.mert.cash = 100;
  s.living.npcs.ece.lastFavorAt = 0;
  s.time = 8 * DAY + 20 * 60;
  s.calendar.lastTick = s.time;
  initLiving(s);
  s.deep.npcs.ece.home = "kadikoy";
  s.deep.npcs.mert.home = "kadikoy";
  s.living.npcs.ece.energy = 100;
  s.living.npcs.ece.social = 100;
  const edge = s.living.graph.ece.mert;
  edge.affinity = 90;
  edge.trust = 70;
  // In v5 a private cash balance is not information Ece can act on. Mert must
  // actually disclose his support request during a completed conversation.
  s.deep.npcs.mert.request = { kind: "loan", sinceDay: 9, deadlineDay: 13 };
  assert.equal(s.society.knowledge.ece.length, 0);
  societyContact(
    s,
    "mert",
    "ece",
    { kind: "social", start: s.time - 60, end: s.time, place: "kadikoy" },
    api,
  );
  assert.ok(
    s.society.knowledge.ece.some(
      (f) => f.id === "need:mert:9" && f.privacy === "private" && !f.disclosed,
    ),
  );
  const money = s.deep.npcs.ece.cash + s.deep.npcs.mert.cash,
    debt = s.deep.npcs.mert.debt;
  worldUntil(s, 8 * DAY + 21 * 60);
  const plan = s.living.npcs.ece.plan.find((p) => p.kind === "favor" && p.target === "mert");
  assert.ok(plan);
  worldUntil(s, plan.end);
  assert.equal(s.deep.npcs.ece.cash + s.deep.npcs.mert.cash, money);
  assert.equal(s.deep.npcs.mert.debt, debt + 300);
  assert.equal(s.living.graph.mert.ece.owed, 300);
  assert.ok(s.living.graph.mert.ece.dueAt > s.time);
});

test("lease reductions are paid, spaced and bounded by the authored housing floor", () => {
  let s = fixture();
  s.npcs.leyla.trust = 60;
  s.cash = 2000;
  const old = s.housing.rent;
  s = act(s, "household:lease");
  assert.equal(s.housing.rent, Math.round(old * 0.97));
  assert.equal(action(s, "household:lease").disabled, true);
  s.living.household.lastLeaseAt = 0;
  s.housing.rent = Math.round(4200 * 0.8);
  assert.equal(action(s, "household:lease").disabled, true);
});

test("housing availability affects independent leases while affordable recovery remains available", () => {
  const s = fixture();
  s.cash = 30000;
  s.bank = 30000;
  s.location = "besiktas";
  s.living.markets.besiktas.vacancies = 0;
  assert.equal(action(s, "move:studio").disabled, true);
  assert.match(action(s, "move:studio").reason, /konut/);
  s.location = "kadikoy";
  assert.equal(action(s, "move:shelter").disabled, false);
});

function paidProjectMeeting() {
  let s = fixture();
  s.npcs.ece.affinity = 40;
  s.npcs.ece.trust = 30;
  s = act(s, "wait:60");
  s = act(s, "project:start:relationship:ece:30");
  s = act(s, "calendar:propose", {
    kind: "meeting",
    npcId: "ece",
    subjectId: "",
    day: 1,
    minute: 630,
    venue: "kadikoy-cafe",
    duration: 60,
    repeat: "none",
  });
  const e = s.calendar.entries.at(-1);
  assert.equal(e.status, "confirmed");
  s = act(s, "visit:kadikoy-cafe");
  while (s.time + 60 <= e.start - 30) s = act(s, "wait:60");
  while (s.time + 15 <= e.start - 30) s = act(s, "wait:15");
  return s;
}

test("paid calendar meetings post their exact attendance fee once to relationship project budget", () => {
  let s = paidProjectMeeting();
  const e = s.calendar.entries.at(-1),
    id = `calendar:attend:${e.id}`,
    fee = action(s, id).cost;
  assert.ok(fee > 0);
  const cash = s.cash,
    budget = s.living.projects[0];
  budget.spent = budget.budget - fee;
  s = act(s, id);
  assert.equal(s.cash, cash - fee);
  assert.equal(s.living.projects[0].spent, budget.budget);
  assert.equal(s.living.projects[0].progress[0], true);
  assert.equal(s.living.projects[0].progress[1], true);
  assert.equal(resolveAction(s, id).ok, false);
});

test("over-budget calendar attendance is rejected before money, time, relations or status change", () => {
  const s = paidProjectMeeting(),
    id = `calendar:attend:${s.calendar.entries.at(-1).id}`,
    fee = action(s, id).cost;
  s.living.projects[0].spent = s.living.projects[0].budget - fee + 1;
  const before = structuredClone(s);
  assert.equal(action(s, id).disabled, true);
  assert.match(action(s, id).reason, /bütçesi/);
  const r = resolveAction(s, id);
  assert.equal(r.ok, false);
  assert.equal(r.state, s);
  assert.deepEqual(s, before);
});

test("legacy free meeting honors its original exemption even when relationship budget is exhausted", () => {
  let s = paidProjectMeeting();
  const e = s.calendar.entries.at(-1);
  e.legacy = true;
  s.living.projects[0].spent = s.living.projects[0].budget;
  const id = `calendar:attend:${e.id}`,
    cash = s.cash;
  assert.equal(action(s, id).cost, 0);
  assert.equal(action(s, id).disabled, false);
  s = act(s, id);
  assert.equal(s.cash, cash);
  assert.equal(s.living.projects[0].spent, s.living.projects[0].budget);
  assert.equal(s.calendar.entries.at(-1).status, "completed");
});
