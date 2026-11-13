import assert from "node:assert/strict";
import test from "node:test";
import { createGame } from "../public/games/tc-sim-boardworld/engine.mjs";
import {
  afterFamilyAction,
  familyActions,
  familyCanAct,
  familyIsRetired,
  familyView,
  initFamily,
  tickFamily,
  translateFamilyAction,
  validateFamily,
} from "../public/games/tc-sim-boardworld/expansion-family.mjs";

const DAY = 1440;
const DAY_OF = (s) => Math.floor(s.time / DAY) + 1;
const hooks = {
  change(s, changes) {
    for (const [name, delta] of Object.entries(changes))
      s.player[name] = Math.min(100, Math.max(0, s.player[name] + delta));
  },
  log(s, text) {
    s.history.push({ text });
  },
  record(s, label, amount, account) {
    s.transactions.push({ label, amount, account });
  },
  spend(s, amount, label) {
    assert.ok(amount >= 0 && s.cash + s.bank >= amount);
    const bank = Math.min(s.bank, amount);
    s.bank -= bank;
    s.cash -= amount - bank;
    this.record(s, label, -amount, "total");
  },
  receive(s, amount, label, account) {
    s[account] += amount;
    this.record(s, label, amount, account);
  },
  settleCareer(s) {
    if (s.job?.earned) this.receive(s, s.job.earned, "Earned wages", "bank");
    s.job = null;
  },
  closeHousehold(s) {
    assert.ok(s.life.household);
    s.life.household = null;
  },
  transferEstate(s, oldId, newId) {
    assert.equal(s.expansion.playerId, oldId);
    s.expansion.world.estateOwner = newId;
  },
  expansionEvent(s, type, subject, detail) {
    assert.ok(detail.length <= 180 && subject.length <= 180);
    s.expansion.world.events.push({ type, subject, detail });
  },
};
const make = (options) => {
  const s = createGame(options);
  s.expansion = { world: { region: "istanbul", events: [] } };
  initFamily(s);
  assert.ok(validateFamily(s));
  return s;
};
function list(s) {
  return familyActions(s, hooks);
}
function apply(s, id) {
  const action = list(s).find((entry) => entry.id === id);
  assert.ok(action, id);
  assert.ok(!action.disabled, action.reason);
  s.revision++;
  if (action.cost) hooks.spend(s, action.cost, id);
  assert.equal(typeof action.run(s), "string");
  assert.ok(validateFamily(s), id);
}
function moveToDay(s, day) {
  s.time = (day - 1) * DAY;
  tickFamily(s, hooks);
  assert.ok(validateFamily(s), String(day));
}
const partner = (s) => {
  s.flags.partner = "mert";
  Object.assign(s.npcs.mert, { affinity: 75, trust: 74, romance: 38 });
};

test("family actions use existing partner and household and preserve an honest divorce record", () => {
  const s = make({ seed: 27 });
  partner(s);
  s.life.household = { memberId: "aylin" };
  const marry = list(s).find((entry) => entry.id === "family:marry");
  assert.equal(marry.disabled, true);
  assert.match(translateFamilyAction(marry, "en").reason, /housing/);
  assert.match(translateFamilyAction(marry, "pl").label, /małżeństwo/);

  s.life.household = { memberId: "mert" };
  apply(s, "family:marry");
  assert.equal(familyView(s).household.roommate, "Mert Aksoy");
  assert.equal(familyView(s).household.partner, "Mert Aksoy");
  apply(s, "family:plan");
  assert.equal(familyView(s).household.expectedDay, 25);
  moveToDay(s, 25);
  const [child] = familyView(s).household.children;
  assert.deepEqual(child.parents, ["player:1", "npc:mert"]);
  delete s.flags.partner;
  afterFamilyAction(s, "breakup:mert", hooks);
  assert.equal(s.life.household, null);
  assert.equal(familyView(s).unions[0].status, "separated");
  assert.equal(list(s).find((entry) => entry.id === "family:divorce").disabled, true);
  moveToDay(s, 32);
  apply(s, "family:reconcile");
  assert.equal(s.flags.partner, "mert");
  assert.equal(familyView(s).unions[0].status, "married");
  apply(s, "family:separate");
  moveToDay(s, 39);
  apply(s, "family:divorce");
  assert.equal(familyView(s).unions[0].status, "divorced");
  assert.deepEqual(familyView(s).household.children[0].parents, child.parents);
  assert.equal(s.expansion.world.events.filter((event) => event.type === "family-birth").length, 1);
});

test("care and education change a child; reserve and arrears settle exactly once", () => {
  const s = make({ seed: 99 });
  apply(s, "family:adopt");
  const [child] = familyView(s).household.children;
  assert.equal(child.age, 3);
  assert.equal(s.cash + s.bank, 7600);
  apply(s, "family:reserve");
  apply(s, `family:care:${child.id}`);
  assert.equal(familyView(s).household.children[0].care, 63);
  assert.equal(list(s).find((a) => a.id === `family:care:${child.id}`).disabled, true);
  s.cash = 0;
  s.bank = 0;
  moveToDay(s, 31);
  assert.equal(familyView(s).household.reserve, 42);
  moveToDay(s, 61);
  assert.equal(familyView(s).household.reserve, 0);
  assert.equal(familyView(s).household.arrears, 178);
  const copy = structuredClone(s);
  tickFamily(s, hooks);
  afterFamilyAction(s, "wait:15", hooks);
  assert.deepEqual(s, copy);
  s.bank = 1000;
  apply(s, "family:arrears");
  moveToDay(s, 91);
  assert.equal(familyView(s).household.children[0].age, 6);
  const before = familyView(s).household.children[0].learning;
  apply(s, `family:focus:${child.id}:technical`);
  assert.equal(familyView(s).household.children[0].learning, before + 3);
  assert.equal(familyView(s).household.children[0].focus, "technical");
});

test("retirement pays only on the month boundary and succession keeps debt and the same estate", () => {
  const s = make({ seed: 3 });
  apply(s, "family:adopt");
  const childId = familyView(s).household.children[0].id;
  const founder = s.expansion.family.people.find((person) => person.id === "player:1");
  moveToDay(s, founder.born + 62 * 30);
  s.job = { earned: 250 };
  s.debt = 900;
  let bank = s.bank;
  apply(s, "family:retire");
  assert.ok(familyIsRetired(s));
  assert.equal(s.job, null);
  assert.equal(s.bank, bank + 250);
  bank = s.bank;
  moveToDay(s, DAY_OF(s) + 30);
  assert.ok(s.bank > bank);
  const death = founder.born + founder.lifespan * 30;
  moveToDay(s, death);
  assert.equal(familyCanAct(s), false);
  assert.ok(list(s).every((action) => action.id.startsWith("family:successor:")));
  const debt = s.debt,
    property = s.housing,
    all = s.cash + s.bank;
  apply(s, `family:successor:${childId}`);
  assert.equal(s.expansion.playerId, childId);
  assert.equal(s.expansion.world.estateOwner, childId);
  assert.equal(familyView(s).generations, 2);
  assert.equal(s.debt, debt);
  assert.equal(s.housing, property);
  assert.equal(s.cash + s.bank, all);
  assert.ok(familyCanAct(s));
  assert.equal(familyIsRetired(s), false);
  assert.equal(familyView(s).lastEstate.from, "player:1");
});

test("bounded background households autonomously reproduce, age and replay", () => {
  const left = make({ seed: 76 });
  const right = make({ seed: 76 });
  for (let day = 2; day < 1900; day++) {
    moveToDay(left, day);
    moveToDay(right, day);
  }
  assert.deepEqual(left.expansion, right.expansion);
  assert.ok(left.expansion.family.background.some((household) => household.births > 0));
  assert.ok(left.expansion.family.background.some((household) => household.deaths > 0));
  for (const household of left.expansion.family.background)
    assert.equal(
      household.cash,
      2100 + (Number(household.id.slice(-1)) - 1) * 370 + household.earnings - household.expenses,
    );
});

test("family validation rejects impossible genealogy and duplicate or future records", () => {
  const s = make();
  const parent = s.expansion.family.people[0];
  parent.parents.push("player:1");
  assert.equal(validateFamily(s), false);
  parent.parents = [];
  s.expansion.family.background[0].residents[1].id =
    s.expansion.family.background[0].residents[0].id;
  assert.equal(validateFamily(s), false);
});
