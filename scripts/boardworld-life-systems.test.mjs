import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  createGame,
  getActions,
  resolveAction,
  validateState,
  migrateState,
  getLifeView,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { EVENTS } from "../public/games/tc-sim-boardworld/content.mjs";
import { initLiving } from "../public/games/tc-sim-boardworld/world-life.mjs";
import { initEmergent } from "../public/games/tc-sim-boardworld/emergent-life.mjs";
import {
  initLife,
  validateLife,
  householdBill,
  npcHousingCost,
  canNpcMove,
  closeHousehold,
  tickLife,
  afterLifeAction,
  getLifeWorkTerms,
  lifeSignals,
} from "../public/games/tc-sim-boardworld/life-systems.mjs";
import {
  initSociety,
  afterSocietyAction,
} from "../public/games/tc-sim-boardworld/society-systems.mjs";
const DAY = 1440;
function fixture({ at = 1110, scenario = "restart" } = {}) {
  const s = createGame({ scenario, seed: 7 });
  s.pendingEvents = [];
  s.resolvedEvents = EVENTS.map((e) => e.id);
  s.time = at;
  s.calendar.lastTick = at;
  initLiving(s);
  initLife(s);
  initEmergent(s);
  initSociety(s);
  s.cash = 20000;
  s.bank = 20000;
  return s;
}
const option = (s, id) => getActions(s).find((a) => a.id === id);
function act(s, id, payload) {
  const before = structuredClone(s),
    r = resolveAction(s, id, payload);
  assert.equal(r.ok, true, `${id}: ${r.message}`);
  assert.deepEqual(s, before, "input stays immutable");
  assert.equal(validateState(r.state), true);
  return r.state;
}
const api = {
  record(s, label, amount, account) {
    s.transactions.push({ day: Math.floor(s.time / DAY) + 1, label, amount, account });
    s.transactions = s.transactions.slice(-160);
  },
  receive(s, value, label, account = "cash") {
    s[account] += value;
    this.record(s, label, value, account);
  },
  spend(s, value, label, account) {
    if (account === "total") {
      const bank = Math.min(s.bank, value);
      s.bank -= bank;
      s.cash -= value - bank;
    } else s[account] -= value;
    this.record(s, label, -value, account === "total" ? "bank" : account);
  },
  memory(s, id, text) {
    s.npcs[id].memories.push({ day: Math.floor(s.time / DAY) + 1, text });
    s.npcs[id].memories = s.npcs[id].memories.slice(-12);
  },
  log() {},
  change(s, values) {
    for (const [k, v] of Object.entries(values))
      s.player[k] = Math.max(0, Math.min(100, s.player[k] + v));
  },
};
function shared(plan = "balanced") {
  let s = fixture();
  s.npcs.leyla.trust = 70;
  s.npcs.leyla.affinity = 60;
  s.deep.npcs.leyla.cash = 6000;
  s.deep.npcs.leyla.savings = 3000;
  return act(s, `household:invite:leyla:${plan}`);
}
function promote(s, role = "colleague") {
  const before = structuredClone(s);
  if (role === "colleague") {
    s.flags.workDays = 3;
    afterLifeAction(s, "work", before, api);
  } else if (role === "neighbor") {
    s.city.visits[s.location] = 3;
    afterLifeAction(s, `visit:${s.location}-park`, before, api);
  } else {
    afterLifeAction(s, "business:serve", before, api);
  }
  afterSocietyAction(s, "wait:15", before, api);
  assert.equal(validateState(s), true);
  return s;
}

test("v3 migration adds life without rewriting legacy balances, NPCs, time or histories", () => {
  const envelope = JSON.parse(
      readFileSync(new URL("./fixtures/boardworld/v3-social-day91.json", import.meta.url), "utf8"),
    ),
    old = JSON.parse(envelope.payload),
    before = structuredClone(old),
    next = migrateState(old);
  assert.equal(next.version, 5);
  assert.equal(validateState(next), true);
  for (const [k, v] of Object.entries(old)) if (k !== "version") assert.deepEqual(next[k], v, k);
  assert.deepEqual(old, before);
  assert.deepEqual(migrateState(next), next);
  assert.equal(next.life.household, null);
});

test("household invitation locks real NPC deposit and does not mint player money", () => {
  const s = shared(),
    h = s.life.household;
  assert.equal(h.share, 40);
  assert.equal(h.deposit, 1680);
  assert.equal(s.deep.npcs.leyla.cash, 6000 - 1680);
  assert.equal(s.cash + s.bank, 40000);
  assert.equal(getLifeView(s).household.deposit, 1680);
  assert.equal(npcHousingCost(s, "leyla", 500), 180);
  assert.equal(canNpcMove(s, "leyla"), false);
  assert.equal(option(s, "move:studio").disabled, true);
});

test("three sharing agreements have actual cost and responsibility tradeoffs", () => {
  const balanced = shared("balanced"),
    player = shared("player-care"),
    member = shared("member-care");
  assert.equal(balanced.life.household.share, 40);
  assert.equal(player.life.household.share, 50);
  assert.equal(member.life.household.share, 35);
  assert.ok(player.life.household.playerDue < balanced.life.household.playerDue);
  assert.ok(member.life.household.memberDue < balanced.life.household.memberDue);
  assert.ok(player.life.household.deposit > member.life.household.deposit);
});

test("household bills deduct real NPC share once directly to payee and return remaining player due", () => {
  const s = shared(),
    cash = s.deep.npcs.leyla.cash,
    player = s.cash + s.bank;
  const due = householdBill(s, 4200, "Aylık kira", "rent", api);
  assert.equal(due, 2520);
  assert.equal(s.deep.npcs.leyla.cash, cash - 1680);
  assert.equal(s.cash + s.bank, player);
  const before = structuredClone(s);
  assert.equal(householdBill(s, 4200, "Aylık kira", "rent", api), 2520);
  assert.deepEqual(s, before);
  assert.equal(validateState(s), true);
});

test("underfunded roommate share is explicit debt and escrow offsets it once on exit", () => {
  let s = shared();
  s.deep.npcs.leyla.cash = 100;
  const due = householdBill(s, 4200, "Aylık kira", "rent", api);
  assert.equal(due, 4100);
  assert.equal(s.life.obligations.leyla, 1580);
  const player = s.cash + s.bank,
    npc = s.deep.npcs.leyla.cash,
    escrow = s.life.household.deposit;
  s = act(s, "household:leave");
  assert.equal(s.cash + s.bank, player + 1580);
  assert.equal(s.deep.npcs.leyla.cash, npc + escrow - 1580);
  assert.equal(s.life.obligations.leyla, 0);
  assert.equal(s.life.household, null);
  const before = structuredClone(s);
  closeHousehold(s, "repeat", api);
  assert.deepEqual(s, before);
});

test("debt larger than roommate deposit survives moveout and later actual collection", () => {
  let s = shared();
  s.deep.npcs.leyla.cash = 0;
  householdBill(s, 10000, "Aylık kira", "rent", api);
  s = act(s, "household:leave");
  assert.equal(s.life.obligations.leyla, 4000 - 1680);
  s.deep.npcs.leyla.cash = 1600;
  const player = s.cash + s.bank;
  s = act(s, "household:collect:leyla");
  assert.equal(s.cash + s.bank, player + 1000);
  assert.equal(s.deep.npcs.leyla.cash, 600);
  assert.equal(s.life.obligations.leyla, 1320);
  assert.equal(option(s, "household:collect:leyla").disabled, true);
});

test("paid player chore updates real due date, needs and mutual history without repeat farming", () => {
  let s = shared();
  s.life.household.playerDue = 1;
  s.life.household.tension = 20;
  const trust = s.npcs.leyla.trust,
    bank = s.bank;
  s = act(s, "household:chore");
  assert.equal(s.bank, bank - 80);
  assert.equal(s.life.household.playerDue, 8);
  assert.ok(s.life.household.tension < 20);
  assert.equal(s.npcs.leyla.trust, trust + 2);
  assert.equal(option(s, "household:chore").disabled, true);
});

test("roommate independently reserves and completes an affordable60minute chore", () => {
  let s = shared();
  s.life.household.memberDue = 1;
  const cash = s.deep.npcs.leyla.cash;
  while (s.time < 1200) s = act(s, "wait:15");
  assert.equal(s.life.household.memberTaskEnd, 1260);
  assert.equal(s.deep.npcs.leyla.cash, cash - 80);
  assert.ok(s.living.npcs.leyla.plan.some((p) => p.id.includes("household")));
  s = act(s, "wait:60");
  assert.equal(s.life.household.memberTaskEnd, 0);
  assert.equal(s.life.household.memberDue, 8);
  assert.equal(s.deep.npcs.leyla.cash, cash - 80);
});

test("repeated broken household responsibilities produce a notice and an actual settled exit", () => {
  const s = shared();
  s.life.household.playerMissed = 2;
  s.life.household.playerDue = 1;
  s.time = DAY + 60;
  tickLife(s, api);
  assert.equal(s.life.household.status, "notice");
  assert.equal(s.life.household.noticeDay, 9);
  const deposit = s.life.household.deposit,
    npc = s.deep.npcs.leyla.cash;
  s.time = 9 * DAY + 60;
  tickLife(s, api);
  assert.equal(s.life.household, null);
  assert.ok(s.deep.npcs.leyla.cash >= npc + deposit);
  assert.equal(validateLife(s), true);
});

test("lease disputes advance through warning, negotiation and notice instead of instant eviction", () => {
  const s = fixture();
  s.housing.arrears = 4200;
  s.time = DAY + 1;
  tickLife(s, api);
  assert.equal(s.life.lease.stage, "warning");
  s.time = 9 * DAY + 1;
  tickLife(s, api);
  assert.equal(s.life.lease.stage, "negotiation");
  s.time = 17 * DAY + 1;
  tickLife(s, api);
  assert.equal(s.life.lease.stage, "notice");
  assert.equal(s.life.lease.dueDay, 32);
  assert.equal(s.housing.id, "room");
});

test("lease repayment removes existing arrears without minting new debt and cancels after two misses", () => {
  let s = fixture();
  s.housing.arrears = 4000;
  s = act(s, "lease:plan");
  const personalDebt = s.debt,
    bank = s.bank,
    due = s.life.lease.plan.nextDay;
  s.time = (due - 1) * DAY + 1;
  tickLife(s, api);
  assert.equal(s.housing.arrears, 3000);
  assert.equal(s.bank, bank - 1000);
  assert.equal(s.debt, personalDebt);
  s.cash = 0;
  s.bank = 0;
  for (let i = 0; i < 2; i++) {
    s.time = (s.life.lease.plan.nextDay - 1) * DAY + 1;
    tickLife(s, api);
  }
  assert.equal(s.life.lease.plan, null);
  assert.equal(s.life.lease.stage, "notice");
  assert.equal(s.housing.arrears, 3000);
  assert.equal(s.debt, personalDebt);
});

test("renewal changes the real rent, preserves deposit and creates an explicit60day stability term", () => {
  let s = fixture();
  s.life.lease.status = "renewal";
  s.life.districts.kadikoy.rentPct = 108;
  const deposit = s.housing.deposit,
    bank = s.bank;
  s = act(s, "lease:renew");
  assert.equal(s.housing.rent, 4536);
  assert.equal(s.housing.deposit, deposit);
  assert.equal(s.bank, bank - 600);
  assert.equal(s.life.lease.stabilityUntil, 61);
  assert.equal(option(s, "lease:renew").disabled, true);
});

test("district conditions change actual new lease cost without rewriting already contracted rent", () => {
  let s = fixture();
  s.location = "besiktas";
  s.life.districts.besiktas.rentPct = 115;
  const old = s.housing.rent,
    cost = option(s, "move:studio").cost;
  assert.equal(old, 4200);
  assert.equal(cost, 9430 + 8200 + 300);
  s = act(s, "move:studio");
  assert.equal(s.housing.rent, 9430);
  assert.equal(s.life.lease.homeKey.startsWith("studio:lease-"), true);
});

test("secondary promotion removes one actual aggregate resident and never duplicates identity", () => {
  let s = fixture({ at: 540 });
  s = act(s, "apply:retail");
  const before = s.living.population.districts.kadikoy.employed;
  promote(s);
  assert.equal(s.life.secondary.length, 1);
  assert.equal(s.life.secondary[0].id, "hakan");
  assert.equal(s.living.population.districts.kadikoy.employed, before - 1);
  promote(s);
  assert.equal(s.life.secondary.length, 1);
  const total = Object.values(s.living.population.districts).reduce(
    (n, p) => n + p.employed + p.jobseekers + p.students,
    0,
  );
  assert.equal(total + s.life.secondary.length, 450);
  assert.equal(getLifeView(s).secondary[0].name, "Hakan Erdem");
});

test("secondary own employment and budgets evolve without any player conversation", () => {
  let s = fixture({ at: 540 });
  s = act(s, "apply:retail");
  promote(s);
  const n = s.life.secondary[0],
    cash = n.cash;
  n.cash = 100;
  n.employment = "searching";
  n.lastJobDay = 1;
  s.time = 7 * DAY + 1;
  tickLife(s, api);
  assert.equal(n.employment, "employed");
  s.time = 8 * DAY + 1;
  tickLife(s, api);
  assert.notEqual(n.cash, cash);
  assert.equal(n.known.profession, "Atölye yardımcısı");
  assert.equal(
    n.history.some((h) => h.text.includes("İş arama sürecinden")),
    false,
  );
});

test("secondary private changes do not leak through public cards or disabled descriptor text", () => {
  let s = fixture({ at: 540 });
  s = act(s, "apply:retail");
  promote(s);
  const n = s.life.secondary[0];
  n.home = "sisli";
  n.profession = "Gizli yeni meslek";
  const view = JSON.stringify(getLifeView(s)),
    actions = JSON.stringify(getActions(s));
  assert.equal(view.includes("Gizli yeni meslek"), false);
  assert.equal(actions.includes("Gizli yeni meslek"), false);
  assert.equal(getLifeView(s).secondary[0].home, "kadikoy");
  assert.ok(option(s, "life:call:hakan"));
});

test("secondary direct telephone disclosure updates only shared current profile", () => {
  let s = fixture({ at: 540 });
  s = act(s, "apply:retail");
  promote(s);
  const n = s.life.secondary[0];
  n.home = "sisli";
  n.profession = "Yeni meslek";
  while (s.time < 1080) s = act(s, "wait:60");
  s = act(s, "life:call:hakan");
  assert.equal(getLifeView(s).secondary[0].home, "sisli");
  assert.equal(getLifeView(s).secondary[0].profession, "Yeni meslek");
  assert.equal(getLifeView(s).secondary[0].cash, undefined);
});

test("role actions require actual context and move real support money", () => {
  let s = fixture();
  s.npcs.leyla.trust = 60;
  s.npcs.leyla.affinity = 50;
  const npc = s.deep.npcs.leyla.cash,
    bank = s.bank;
  s = act(s, "life:friend:leyla");
  assert.equal(s.deep.npcs.leyla.cash, npc + 100);
  assert.equal(s.bank, bank - 100);
  assert.equal(s.life.relations.leyla.reciprocity, 8);
  assert.equal(option(s, "life:friend:leyla").disabled, true);
  assert.equal(option(s, "life:romance:leyla"), undefined);
});

test("customer order pays only on actual delivery and conserves NPC→enterprise money", () => {
  let s = fixture({ at: 540 });
  s = act(s, "business:start:repair");
  s = act(s, "business:fund:2000");
  s = act(s, "business:stock:3");
  s.deep.npcs.leyla.cash = 6000;
  s.npcs.leyla.trust = 60;
  s.npcs.leyla.affinity = 50;
  s = act(s, "life:order:leyla");
  const order = s.life.relations.leyla.order;
  assert.equal(s.deep.business.revenue, 0);
  while (s.time % DAY < 1110) s = act(s, "wait:15");
  const cash = s.deep.npcs.leyla.cash,
    capital = s.living.enterprise.capital,
    stock = s.living.enterprise.stock;
  s = act(s, "life:deliver:leyla");
  assert.equal(s.deep.npcs.leyla.cash, cash - order.price);
  assert.equal(s.living.enterprise.capital, capital + order.price - 30);
  assert.equal(s.living.enterprise.stock, stock - 1);
  assert.equal(s.deep.business.revenue, order.price);
  assert.equal(s.life.relations.leyla.order, null);
  assert.equal(option(s, "life:order:leyla").disabled, true);
});

test("customer contracts cannot reward a closed and reopened same-day business", () => {
  let s = fixture({ at: 540 });
  s = act(s, "business:start:repair");
  s.npcs.leyla.trust = 60;
  s.npcs.leyla.affinity = 50;
  s.deep.npcs.leyla.cash = 6000;
  s = act(s, "life:order:leyla");
  const old = s.life.relations.leyla.order.businessKey;
  s = act(s, "business:close");
  s = act(s, "business:start:repair");
  assert.notEqual(
    old,
    s.deep.business.id + ":" + s.deep.business.openedDay + ":business-" + s.revision,
  );
  assert.equal(option(s, "life:deliver:leyla").disabled, true);
  assert.match(option(s, "life:deliver:leyla").reason, /değişti/);
});

test("workload agreement trades real extra time and stress for earned pay only", () => {
  let s = fixture({ at: 540 });
  s = act(s, "apply:retail");
  s.job.performance = 70;
  s.life.employers.retail.workload = "busy";
  const bank = s.bank;
  s = act(s, "career:workload:extended");
  assert.deepEqual(getLifeWorkTerms(s), { extraMinutes: 60, bonus: 150, stress: 5 });
  assert.equal(s.bank, bank);
  assert.equal(option(s, "work").minutes, 480);
  const earned = s.job.earned,
    start = s.time;
  s = act(s, "work");
  assert.equal(s.time - start, 480);
  assert.equal(s.job.earned - earned, 1150);
  s = act(s, "career:workload:standard");
  assert.equal(getLifeWorkTerms(s).bonus, 0);
  assert.equal(s.job.earned, 1150);
});

test("same-day rehire resets workload terms while bounded document rotation does not", () => {
  let s = fixture({ at: 480 });
  s = act(s, "apply:retail");
  s.job.performance = 70;
  s.life.employers.retail.workload = "busy";
  s = act(s, "career:workload:extended");
  const key = s.life.employers.retail.contractKey;
  s.documents = s.documents.filter((d) => !d.id.startsWith("employment-"));
  s = act(s, "wait:15");
  assert.equal(s.life.employers.retail.contractKey, key);
  assert.equal(getLifeWorkTerms(s).bonus, 150);
  s = act(s, "resign");
  s = act(s, "apply:retail");
  assert.equal(getLifeWorkTerms(s).bonus, 0);
  assert.notEqual(s.life.employers.retail.contractKey, key);
});

test("strict life schema rejects malformed promises, balances, roles and unknown nested fields", () => {
  const s = shared();
  for (const mutate of [
    (x) => (x.life.extra = 1),
    (x) => (x.life.household.deposit = -1),
    (x) => (x.life.household.memberId = "ghost"),
    (x) => (x.life.relations.leyla.reciprocity = Infinity),
    (x) => (x.life.districts.kadikoy.travelDelay = 100),
    (x) => (x.life.employers.retail.needSkill = "ghost"),
    (x) => (x.life.lease.plan = { installment: 0, nextDay: 2, missed: 0 }),
  ]) {
    const next = structuredClone(s);
    mutate(next);
    assert.equal(validateState(next), false);
  }
});

test("public causal signals are bounded views and do not reveal private NPC balances", () => {
  const s = shared(),
    v = lifeSignals(s);
  assert.equal(v.household.actorId, "leyla");
  assert.equal(v.household.active, true);
  assert.equal(v.household.homeKey, s.life.lease.homeKey);
  assert.equal(v.household.cash, undefined);
  assert.deepEqual(Object.keys(v.secondary), ["knownIDs"]);
});

test("bounded document rotation preserves shared-home and customer contract identities", () => {
  let s = shared(),
    key = s.life.lease.homeKey,
    member = s.life.household.memberId;
  s.documents = s.documents.filter((d) => !d.id.startsWith("lease-"));
  s = act(s, "wait:15");
  assert.equal(s.life.lease.homeKey, key);
  assert.equal(s.life.household.memberId, member);
  s = fixture({ at: 540 });
  s = act(s, "business:start:repair");
  s.npcs.leyla.trust = 60;
  s.npcs.leyla.affinity = 50;
  s.deep.npcs.leyla.cash = 6000;
  s = act(s, "life:order:leyla");
  const business = s.life.businessKey;
  s.documents = s.documents.filter((d) => !d.id.startsWith("business-"));
  s = act(s, "wait:15");
  assert.equal(s.life.businessKey, business);
  assert.equal(s.life.relations.leyla.order.businessKey, business);
  assert.doesNotMatch(option(s, "life:deliver:leyla").reason, /değişti/);
});

test("new synchronous role contacts reserve the NPC across autonomous decision boundaries", () => {
  let s = fixture({ at: 1065 });
  s.location = s.deep.npcs.ece.home;
  s.npcs.ece.trust = 70;
  s.npcs.ece.affinity = 60;
  const decisions = s.living.npcs.ece.decisions;
  s = act(s, "life:friend:ece");
  assert.equal(s.time, 1155);
  assert.equal(
    s.living.npcs.ece.decisions,
    decisions,
    "18:00 utility decision cannot double-book the ongoing contact",
  );
});

test("secondary contact reserves real time and cannot overlap its household chore", () => {
  let s = promote(fixture(), "neighbor");
  let n = s.life.secondary[0];
  n.relation.trust = 70;
  n.relation.affinity = 60;
  n.cash = 6000;
  s = act(s, `household:invite:${n.id}:balanced`);
  s = act(s, "wait:15");
  s.life.household.memberDue = 1;
  const cash = s.life.secondary[0].cash;
  s = act(s, `life:talk:${n.id}`);
  assert.equal(s.time, 1215);
  assert.equal(
    s.life.secondary[0].cash,
    cash,
    "20:00 chore must not start during the scheduled contact",
  );
  assert.equal(s.life.secondary[0].busyUntil, 0, "completed contact releases the reservation");
  assert.equal(s.life.household.memberTaskEnd, 0);
});

test("strict workload terms reject free bonuses without matching time and stress", () => {
  const s = fixture();
  s.life.employers.retail.bonus = 150;
  assert.equal(validateState(s), false);
});

test("secondary preferences cause different funded development and household boundaries", () => {
  const s = promote(fixture());
  const n = s.life.secondary[0];
  assert.equal(n.preference, "reliable");
  n.cash = 2000;
  const skill = n.skill;
  s.time = 6 * DAY;
  tickLife(s, api);
  assert.equal(n.skill, skill + 2, "reliability preference funds deeper weekly practice");
  const quiet = promote(fixture(), "neighbor");
  const q = quiet.life.secondary[0];
  q.relation.trust = 70;
  q.relation.affinity = 60;
  q.cash = 6000;
  let sharedQuiet = act(quiet, `household:invite:${q.id}:balanced`);
  sharedQuiet.life.household.tension = 56;
  sharedQuiet.time = DAY;
  tickLife(sharedQuiet, api);
  assert.equal(
    sharedQuiet.life.household.status,
    "notice",
    "quiet preference has a stricter shared-home tension limit",
  );
});

test("two real volunteer days promote a neighbor without requiring venue visit counters", () => {
  let s = fixture({ at: 540 });
  s.flags.volunteers = 1;
  s.city.visits.kadikoy = 0;
  s = act(s, "volunteer");
  assert.equal(s.flags.volunteers, 2);
  assert.equal(s.life.secondary.length, 1);
  assert.equal(s.life.secondary[0].role, "neighbor");
  assert.equal(s.city.visits.kadikoy, 0);
});

test("shared secondary receives the explicit systemic promise and actual expiry penalty", () => {
  let s = promote(fixture({ at: 9 * DAY + 1110 }), "neighbor");
  const id = s.life.secondary[0].id;
  s.life.secondary[0].relation.trust = 70;
  s.life.secondary[0].relation.affinity = 60;
  s.life.secondary[0].cash = 6000;
  s = act(s, `household:invite:${id}:balanced`);
  for (const f of Object.values(s.emergent.families)) f.lastDay = 10;
  s.emergent.families.household.lastDay = 0;
  s.emergent.lastSpawnDay = 9;
  s = act(s, "wait:15");
  let event = s.emergent.events.find((e) => e.family === "household");
  assert.equal(event.actors[0], id);
  s = act(s, `systemic:${event.id}:commit`);
  assert.ok(
    s.life.secondary[0].facts.some(
      (f) => f.id === "systemic" && f.source === "Doğrudan gönderdiğin plan",
    ),
  );
  const before = { ...s.life.secondary[0].relation };
  event = s.emergent.events.find((e) => e.id === event.id);
  // Isolate the exact deferred clock boundary, preserving a valid active promise.
  event.followAt = s.time + 15;
  event.deadline = s.time + 30;
  assert.equal(validateState(s), true);
  s = act(s, "wait:60");
  assert.equal(s.emergent.events.find((e) => e.id === event.id).status, "expired");
  assert.equal(s.life.secondary[0].relation.trust, before.trust - 4);
  assert.equal(s.life.secondary[0].relation.affinity, before.affinity - 2);
  assert.match(s.life.secondary[0].history.at(-1).text, /süresinde tamamlamadın/);
});

test("an independently moved customer cannot receive a cross-district delivery without travel", () => {
  let s = fixture({ at: 540 });
  s = act(s, "business:start:repair");
  s.npcs.leyla.trust = 60;
  s.npcs.leyla.affinity = 50;
  s.deep.npcs.leyla.cash = 6000;
  s = act(s, "life:order:leyla");
  s.deep.npcs.leyla.home = "sisli";
  const delivery = option(s, "life:deliver:leyla");
  assert.equal(delivery.disabled, true);
  assert.match(delivery.reason, /teslim semtinde/);
  assert.doesNotMatch(delivery.reason, /Şişli|sisli/);
  const before = structuredClone(s),
    rejected = resolveAction(s, delivery.id);
  assert.equal(rejected.ok, false);
  assert.deepEqual(s, before);
  assert.equal(option(s, "life:order-cancel:leyla").disabled, false);
});

test("private authored workplace changes do not alter public relationship roles", () => {
  const envelope = JSON.parse(
    readFileSync(new URL("./fixtures/boardworld/v3-career-day91.json", import.meta.url), "utf8"),
  );
  const legacy = JSON.parse(envelope.payload),
    s = migrateState(legacy);
  const view = getLifeView(s);
  assert.ok(
    view.relationships.find((n) => n.id === "mert").roles.some((r) => r.id === "colleague"),
  );
  s.deep.npcs.mert.work = "sisli";
  assert.deepEqual(
    getLifeView(s),
    view,
    "unobserved workplace change cannot reveal itself through public role cards or action IDs",
  );
  assert.equal(s.life.relations.mert.knownWork, "kadikoy");
  assert.equal(option(s, "life:colleague:mert").disabled, true);
  assert.doesNotMatch(option(s, "life:colleague:mert").reason, /Şişli|sisli/);
  assert.equal(validateState(s), true);
  const changedLegacy = structuredClone(legacy);
  changedLegacy.deep.npcs.mert.work = "sisli";
  const migrated = migrateState(changedLegacy);
  assert.equal(
    migrated.life.relations.mert.knownWork,
    "kadikoy",
    "migration initializes only the public authored workplace",
  );
  assert.deepEqual(migrated.deep, changedLegacy.deep, "legacy authority is preserved exactly");
});

test("actual workplace disclosure updates known roles and rejects malformed knowledge", () => {
  let s = fixture({ at: 480 });
  s = act(s, "apply:repair");
  while (s.time + 60 <= 1065) s = act(s, "wait:60");
  while (s.time + 15 <= 1065) s = act(s, "wait:15");
  s.deep.npcs.mert.work = "sisli";
  assert.equal(s.life.relations.mert.knownWork, "kadikoy");
  s = act(s, "call:mert");
  assert.equal(s.life.relations.mert.knownWork, "sisli");
  assert.ok(
    !getLifeView(s)
      .relationships.find((n) => n.id === "mert")
      .roles.some((r) => r.id === "colleague"),
  );
  const bad = structuredClone(s);
  bad.life.relations.mert.knownWork = "private-unknown-district";
  assert.equal(validateState(bad), false);
});

test("secondary direct disclosure updates known workplace without leaking unshared changes", () => {
  let s = fixture({ at: 480 });
  s = act(s, "apply:retail");
  s.flags.workDays = 3;
  afterLifeAction(s, "work", structuredClone(s), api);
  afterSocietyAction(s, "wait:15", structuredClone(s), api);
  const id = s.life.secondary[0].id;
  assert.equal(s.life.secondary[0].context.knownWork, "kadikoy");
  while (s.time + 60 <= 1110) s = act(s, "wait:60");
  while (s.time + 15 <= 1110) s = act(s, "wait:15");
  const before = getLifeView(s);
  s.life.secondary[0].work = "sisli";
  assert.deepEqual(getLifeView(s), before);
  s = act(s, `life:call:${id}`);
  assert.equal(s.life.secondary[0].context.knownWork, "sisli");
});
