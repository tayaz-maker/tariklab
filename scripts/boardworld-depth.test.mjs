import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  getActions,
  loadExpansionRuntime,
  resolveAction,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import {
  exportGame,
  importGame,
  loadExpansionLocked,
} from "../public/games/tc-sim-boardworld/persistence.mjs";

import { localizeEconomyText } from "../public/games/tc-sim-boardworld/expansion-economy.mjs";
import { localizeWorldText } from "../public/games/tc-sim-boardworld/expansion-world.mjs";

const { getExpansionView } = await loadExpansionRuntime();
const at = (s) => Math.floor(s.time / 1440) + 1;
const economy = (s) => s.expansion.economy;
const resident = (s) => economy(s).residents["resident:ankara:0"];
const firm = (s) => economy(s).firms["ankara:repair"];
const person = (s, id) => s.expansion.family.people.find((entry) => entry.id === id);
const events = (s, type) => s.expansion.events.filter((event) => event.type === type);
const action = (s, id) => getActions(s).find((entry) => entry.id === id);

function act(s, id) {
  const frozen = JSON.stringify(s);
  const result = resolveAction(s, id);
  assert.ok(result.ok, `${id} · ${result.message}`);
  assert.equal(JSON.stringify(s), frozen, `${id} mutated the input`);
  assert.ok(validateState(result.state));
  return result.state;
}

function start(options = {}) {
  let s = createGame({ scenario: "restart", seed: 303, expansion: true, ...options });
  while (s.pendingEvents.length)
    s = act(s, getActions(s).find(({ id, disabled }) => id.startsWith("event:") && !disabled).id);
  return s;
}

function untilDay(s, target) {
  const limit = (target - at(s) + 1) * 40;
  let steps = 0;
  while (at(s) < target && steps++ < limit) {
    const next =
      getActions(s).find(({ id, disabled }) => id.startsWith("event:") && !disabled) ??
      action(s, "wait:60");
    assert.ok(next, `No wait action on day ${at(s)}`);
    s = act(s, next.id);
  }
  assert.equal(at(s), target);
  return s;
}

test("schema 7 legacy resident bytes survive import and backup recovery, then replay into identical profiles", async () => {
  const original = start();
  for (const n of Object.values(economy(original).residents)) delete n.life;
  resident(original).cash = 1234;
  const old = exportGame(original);
  const snapshot = importGame(old).state;
  assert.deepEqual(snapshot, original);
  const view = getExpansionView(snapshot);
  assert.equal(view.economy.regions.ankara.residents[0].cash, 1234);
  assert.equal(view.economy.regions.ankara.residents[0].employer, "ankara:repair");
  assert.equal(exportGame(snapshot), old, "view cannot normalize the saved state");

  const token = new Map([
    ["tariklab.boardworld.v7", "invalid"],
    ["tariklab.boardworld.v7.backup", old],
  ]);
  const locks = { request: (_, fn) => fn() };
  const transact = (_, read) => read({ getItem: (key) => token.get(key) ?? null });
  const recovered = await loadExpansionLocked(undefined, locks, transact);
  assert.deepEqual(recovered.state, original);
  assert.equal(recovered.token.backup, old);
  const one = untilDay(snapshot, 2);
  const two = untilDay(recovered.state, 2);
  assert.deepEqual(one, two);
  assert.notEqual(resident(one).cash, 1234);
  assert.equal(resident(one).life.region, "ankara");
  assert.deepEqual(importGame(exportGame(one)).state, one);

  const invalid = structuredClone(one);
  resident(invalid).life.employer = "izmir:repair";
  assert.equal(validateState(invalid), false);
  const partial = structuredClone(one);
  delete resident(partial).life;
  assert.equal(validateState(partial), false);
});

test("a sick resident misses payroll and an insolvent employer closes, leaving the resident without wages", () => {
  const opening = start();
  const ill = structuredClone(opening);
  resident(ill).life.health = 25;
  const healthy = untilDay(opening, 2);
  const sick = untilDay(ill, 2);
  assert.ok(resident(healthy).cash > resident(sick).cash);
  assert.ok(firm(healthy).costs > firm(sick).costs);

  const distressed = structuredClone(healthy);
  Object.assign(firm(distressed), { cash: 0, stock: 0 });
  Object.assign(resident(distressed), { cash: 0, savings: 0 });
  distressed.expansion.world.regions.ankara.employment = 60;
  const closed = untilDay(distressed, 5);
  assert.equal(firm(closed).status, "closed");
  assert.equal(firm(closed).workers, 0);
  assert.equal(resident(closed).employment, "searching");
  assert.equal(resident(closed).life.employer, "");
  assert.ok(resident(closed).debt > 0);
  assert.ok(
    events(closed, "business.npc-closure").some(({ subject }) => subject === "ankara:repair"),
  );
  assert.ok(
    events(closed, "resident.job-loss").some(({ subject }) => subject === "resident:ankara:0"),
  );
  const firmView = getExpansionView(closed).economy.regions.ankara.firms[0];
  assert.equal(firmView.id, "ankara:repair");
  assert.deepEqual(firmView.employeeIds, []);
});

test("a household weighs actual rent and job openings when moving and receives its deposit once", () => {
  let s = start();
  s.bank = 150000;
  s = act(s, "world:move:ankara");
  s = act(s, "economy:buy:ankara:room");
  s = act(s, "economy:let:ankara:room");
  const lot = (state) => economy(state).properties["ankara:room"];
  assert.equal(lot(s).lease.tenant, "resident:ankara:0");
  const rival = economy(s).firms["izmir:repair"];
  rival.workers = 2;
  for (const id of ["resident:ankara:1", "resident:ankara:2"])
    economy(s).residents[id].life.health = 0;
  s.expansion.world.regions.ankara.employment = 60;
  s.expansion.world.regions.ankara.price = 150;
  s.expansion.world.regions.izmir.employment = 140;
  s.expansion.world.regions.izmir.price = 65;
  const deposit = lot(s).lease.deposit;
  const cheaper = structuredClone(s);
  cheaper.expansion.world.regions.ankara.price = 60;
  cheaper.expansion.world.regions.ankara.employment = 105;
  cheaper.expansion.economy.properties["ankara:room"].lease.rent = 300;
  const moved = untilDay(s, 7);
  const stayed = untilDay(cheaper, 7);
  assert.equal(
    resident(moved).life.region,
    "izmir",
    JSON.stringify(events(moved, "resident.migration")),
  );
  assert.equal(resident(moved).life.employer, "izmir:repair");
  assert.equal(resident(stayed).life.region, "ankara");
  assert.equal(lot(moved).lease, null);
  assert.equal(lot(moved).owner, "household");
  assert.ok(npcTotal(moved) > npcTotal(stayed) - 620, `the ${deposit} TL deposit is returned`);
  assert.equal(moved.expansion.world.regions.ankara.exits, 1);
  assert.equal(moved.expansion.world.regions.izmir.arrivals, 1);
  assert.equal(
    events(moved, "resident.migration").filter(({ subject }) => subject === "resident:ankara:0")
      .length,
    1,
  );
});

const npcTotal = (s) => resident(s).cash + resident(s).savings;

test("an open local employer funds a gig once and the worker earns personal tenure", () => {
  let s = start();
  s = act(s, "world:move:ankara");
  const shift = action(s, "world:shift");
  assert.equal(shift.disabled, false, shift.reason);
  const wage = Number(/(\d+) TL\.$/.exec(shift.description)[1]);
  const before = firm(s).cash;
  const worked = act(s, shift.id);
  assert.equal(worked.bank - s.bank, wage);
  assert.equal(before - firm(worked).cash, wage);
  assert.equal(worked.flags.workDays, s.flags.workDays + 1);
  assert.ok(action(worked, shift.id).disabled);
  assert.equal(resolveAction(worked, shift.id).state, worked);
});

function shortenLife(s, id, deathDay) {
  const active = person(s, id);
  active.born = deathDay - active.lifespan * 30;
  function ageAncestors(child) {
    for (const parentId of child.parents) {
      const parent = person(s, parentId);
      if (parent.born <= child.born - 24 * 30) continue;
      parent.born = child.born - 24 * 30;
      if (parent.id !== id) parent.died ??= at(s);
      ageAncestors(parent);
    }
  }
  ageAncestors(active);
}

function estateAccounts(s) {
  const { properties, home, business } = economy(s);
  const { reserve, arrears } = s.expansion.family;
  return {
    cash: s.cash,
    bank: s.bank,
    debt: s.debt,
    housing: s.housing,
    reserve,
    arrears,
    properties,
    home,
    business,
    enterprise: s.living.enterprise,
    investigation: s.expansion.institutions.case?.amount,
  };
}

test("two actual successor actions preserve title, company, open obligations, kinship and history", () => {
  let s = start();
  s.bank = 120000;
  s.flags.workDays = 120;
  s = act(s, "business:start:repair");
  s = act(s, "business:fund:2000");
  s = act(s, "economy:mortgage:istanbul:room");
  s = act(s, "economy:occupy:istanbul:room");
  s = act(s, "family:reserve");
  s = act(s, "family:adopt");
  const founder = s.expansion.playerId;
  const heir = s.expansion.family.people.find(({ parents }) => parents.includes(founder)).id;
  person(s, heir).born = at(s) - 23 * 30;
  Object.assign(s.expansion.institutions, {
    case: {
      region: "istanbul",
      owner: founder,
      amount: 800,
      penalty: 400,
      openedDay: at(s),
      decided: true,
      overdue: false,
      reviewed: false,
    },
  });
  shortenLife(s, founder, at(s) + 1);
  s = untilDay(s, at(s) + 1);
  assert.equal(person(s, founder).died, at(s));
  assert.equal(resolveAction(s, "wait:60").state, s);
  const pre = importGame(exportGame(s)).state;
  s = act(pre, `family:successor:${heir}`);
  assert.deepEqual(estateAccounts(s), estateAccounts(pre));
  assert.equal(s.expansion.institutions.case.owner, heir);
  assert.equal(s.expansion.family.lastEstate.workDays, 120);
  assert.deepEqual(s.expansion.events.slice(0, pre.expansion.events.length), pre.expansion.events);
  assert.ok(events(s, "family-loss").some(({ subject }) => subject === founder));

  // Cross the ordinary adoption cooldown through the action loop, then retain
  // both prior generations' history in the second inheritance.
  s = untilDay(s, at(s) + 30);
  assert.ok(action(s, "family:adopt") && !action(s, "family:adopt").disabled);
  s = act(s, "family:adopt");
  const grandchild = s.expansion.family.people.find(({ parents }) => parents.includes(heir)).id;
  person(s, grandchild).born = at(s) - 23 * 30;
  shortenLife(s, heir, at(s) + 1);
  s = untilDay(s, at(s) + 1);
  const beforeSecond = importGame(exportGame(s)).state;
  s = act(beforeSecond, `family:successor:${grandchild}`);
  assert.deepEqual(estateAccounts(s), estateAccounts(beforeSecond));
  assert.equal(s.expansion.institutions.case.owner, grandchild);
  assert.equal(s.expansion.family.lastEstate.from, heir);
  assert.equal(s.expansion.family.lastEstate.to, grandchild);
  assert.equal(s.expansion.family.generations, 3);
  assert.equal(person(s, founder).died, 2);
  assert.deepEqual(person(s, heir).parents, [founder]);
  assert.deepEqual(person(s, grandchild).parents, [heir]);
  assert.deepEqual(
    events(s, "family-succession").map(({ subject }) => subject),
    [heir, grandchild],
  );
  assert.deepEqual(importGame(exportGame(s)).state, s);
});

test("a child cannot take over an estate before adulthood and the terminal save remains readable", () => {
  let s = act(start(), "family:adopt");
  const founder = s.expansion.playerId;
  const child = s.expansion.family.people.find(({ parents }) => parents.includes(founder)).id;
  const sibling = person(s, "family:2");
  sibling.died = at(s);
  shortenLife(s, founder, at(s) + 1);
  s = untilDay(s, at(s) + 1);
  assert.equal(person(s, founder).died, at(s));
  assert.deepEqual(getActions(s), []);
  for (const id of ["wait:60", `family:successor:${child}`]) {
    const refused = resolveAction(s, id);
    assert.equal(refused.ok, false);
    assert.equal(refused.state, s);
  }
  assert.deepEqual(importGame(exportGame(s)).state, s);
});

test("weekly overhead and manual pause debit company capital and preserve unpaid costs once", () => {
  let s = act(start(), "business:start:repair");
  s = act(s, "business:fund:2000");
  const personal = s.cash + s.bank;
  const capital = s.living.enterprise.capital;
  const weekly = structuredClone(s);
  weekly.deep.business.nextOverheadDay = at(s) + 1;
  const before = weekly.deep.business.costs;
  const settled = untilDay(weekly, at(weekly) + 1);
  const bill = settled.deep.business.costs - before;
  assert.ok(bill > 0);
  assert.equal(settled.living.enterprise.capital, capital - bill);
  assert.equal(settled.cash + settled.bank, personal);

  s.living.enterprise.capital = 50;
  const costs = s.deep.business.costs;
  s.deep.business.accruedOverhead = 125;
  s = act(s, "business:pause");
  assert.equal(s.deep.business.status, "paused");
  assert.equal(s.deep.business.arrears, 75);
  assert.equal(s.deep.business.costs, costs + 125);
  assert.equal(s.deep.business.accruedOverhead, 0);
  assert.equal(s.living.enterprise.capital, 0);
  assert.equal(s.cash + s.bank, personal);
  assert.equal(resolveAction(s, "business:pause").state, s);
  s = act(s, "business:fund:2000");
  s = act(s, "business:pause");
  assert.equal(s.deep.business.arrears, 0);
  assert.equal(s.deep.business.costs, costs + 125);
  assert.equal(s.living.enterprise.capital, 1925);
  assert.equal(s.cash + s.bank, personal - 2000);
});

test("municipal training costs money, raises a skill and unlocks a real job", () => {
  const opening = start();
  const n = resident(opening);
  n.life.employer = "";
  n.life.skill = 32;
  n.employment = "searching";
  Object.assign(opening.expansion.institutions.regions.ankara, {
    policy: "skills",
    policyUntil: 15,
  });
  const deprived = structuredClone(opening);
  deprived.expansion.institutions.regions.ankara.treasury = 1_000_000_000;
  const trained = untilDay(opening, 7);
  const noClass = untilDay(deprived, 7);
  assert.equal(resident(trained).life.skill, 36);
  assert.equal(resident(trained).life.employer, "ankara:repair");
  assert.equal(resident(noClass).life.skill, 32);
  assert.equal(resident(noClass).life.employer, "");
  assert.equal(npcTotal(noClass) - npcTotal(trained), 90);
  assert.equal(
    events(trained, "resident.training").filter(({ subject }) => subject === "resident:ankara:0")
      .length,
    1,
  );
});

test("regional shift, meal and rest report their real outcomes in Turkish, English and Polish", () => {
  let s = act(start(), "world:move:ankara");
  for (const [id, english, polish] of [
    ["shift", "Local shift completed.", "Ukończono lokalną zmianę."],
    ["meal", "You ate a hot meal nearby.", "Zjedzono ciepły posiłek w okolicy."],
    ["rest", "You rested and regained energy.", "Odpoczęto i odzyskano energię."],
  ]) {
    const outcome = resolveAction(s, `world:${id}`);
    assert.ok(outcome.ok, outcome.message);
    assert.equal(localizeWorldText(outcome.message, "tr"), outcome.message);
    assert.equal(localizeWorldText(outcome.message, "en"), english);
    assert.equal(localizeWorldText(outcome.message, "pl"), polish);
    s = outcome.state;
  }
});

test("finance outcomes translate property names, preserve amounts and describe the completed action", () => {
  let s = start();
  s.bank = 120000;
  s = act(s, "world:move:izmir");
  const purchased = resolveAction(s, "economy:mortgage:izmir:room");
  assert.ok(purchased.ok, purchased.message);
  assert.equal(
    localizeEconomyText(purchased.message, "en"),
    "The household now owns Izmir · Room.",
  );
  assert.equal(localizeEconomyText(purchased.message, "pl"), "Gospodarstwo nabyło İzmir · Pokój.");
  const paid = resolveAction(purchased.state, "economy:repay:izmir:room");
  assert.ok(paid.ok, paid.message);
  const mortgage = economy(paid.state).properties["izmir:room"].mortgage;
  const remaining = mortgage.principal + mortgage.interest;
  assert.equal(
    localizeEconomyText(paid.message, "en"),
    `Payment recorded. Loan balance: ${remaining} TL.`,
  );
  assert.equal(
    localizeEconomyText(paid.message, "pl"),
    `Zaksięgowano spłatę. Saldo kredytu: ${remaining} TL.`,
  );
  const firm = act(paid.state, "business:start:repair");
  const paused = resolveAction(firm, "business:pause");
  assert.ok(paused.ok, paused.message);
  assert.equal(localizeEconomyText(paused.message, "en"), "Business paused.");
  assert.equal(localizeEconomyText(paused.message, "pl"), "Wstrzymano działalność.");
});
