import assert from "node:assert/strict";
import test from "node:test";
import { createGame } from "../public/games/tc-sim-boardworld/engine.mjs";
import {
  adaptInstitutionActions,
  afterInstitutionAction,
  creditMunicipalTax,
  initInstitutions,
  institutionActions,
  institutionsView,
  localizeInstitutionText,
  onInstitutionSuccession,
  tickInstitutions,
  validateInstitutions,
} from "../public/games/tc-sim-boardworld/expansion-institutions.mjs";

const DAY = 1440;
const api = {
  skill(s, key, amount) {
    s.player.skills[key] = Math.min(100, s.player.skills[key] + amount);
  },
  change(s, changes) {
    for (const [key, amount] of Object.entries(changes))
      s.player[key] = Math.max(0, Math.min(100, s.player[key] + amount));
  },
  document(s, id, title, text) {
    s.documents.push({ id, title, text, day: day(s) });
  },
  expansionEvent(s, type, subject, detail) {
    s.expansion.events.push({ type, subject, detail });
  },
  record(s, label, amount, account) {
    s.transactions.push({ day: day(s), label, amount, account });
  },
  receive(s, amount, label, account) {
    s[account] += amount;
    api.record(s, label, amount, account);
  },
};
const day = (s) => Math.floor(s.time / DAY) + 1;
const atDay = (s, date) => {
  s.time = (date - 1) * DAY + 540;
};
function state(seed = 2026) {
  const s = createGame({ seed });
  s.expansion = {
    playerId: "player:1",
    events: [],
    world: {
      region: "istanbul",
      regions: {
        istanbul: { price: 100, employment: 100, population: 1800 },
        ankara: { price: 94, employment: 97, population: 840 },
        izmir: { price: 107, employment: 89, population: 650 },
      },
    },
  };
  initInstitutions(s);
  return s;
}
const data = (s) => s.expansion.institutions;
const local = (s) => data(s).regions[s.expansion.world.region];
const action = (s, id) => institutionActions(s, api).find((a) => a.id === "institution:" + id);
function resolve(s, id) {
  const choice = action(s, id);
  assert.ok(choice, id);
  assert.equal(choice.disabled, false, choice.reason);
  const next = structuredClone(s);
  const bank = Math.min(next.bank, choice.cost);
  next.bank -= bank;
  next.cash -= choice.cost - bank;
  choice.run(next);
  next.time += choice.minutes;
  assert.equal(validateInstitutions(next), true);
  return next;
}
function settleThrough(s, date) {
  for (let d = day(s) + 1; d <= date; d++) {
    atDay(s, d);
    tickInstitutions(s, api);
    assert.equal(validateInstitutions(s), true);
  }
  return s;
}

test("school charges actual regional tuition, funds a scholarship and awards an existing career credential once", () => {
  let s = state();
  s.debt = 1000;
  const balance = s.cash + s.bank;
  const treasury = local(s).treasury;
  const option = action(s, "school:finance");
  assert.equal(option.cost + option.institutionGrant, 500);
  assert.ok(option.institutionGrant > 0);
  s = resolve(s, "school:finance");
  assert.equal(s.cash + s.bank, balance - option.cost);
  assert.equal(local(s).treasury, treasury - option.institutionGrant);
  const skills = s.player.skills.knowledge;
  s = resolve(s, "study");
  assert.equal(action(s, "study").disabled, true);
  s.expansion.world.region = "ankara";
  atDay(s, 2);
  assert.match(action(s, "study").reason, /şehirde/);
  s.expansion.world.region = "istanbul";
  for (const d of [2, 3, 4]) {
    atDay(s, d);
    s = resolve(s, "study");
  }
  assert.equal(data(s).program, null);
  assert.equal(data(s).qualifications.length, 1);
  assert.equal(s.documents.filter(({ id }) => id === "certificate-finance").length, 1);
  assert.ok(s.player.skills.knowledge > skills);
  assert.equal(action(s, "school:finance").disabled, true);
  assert.equal(adaptInstitutionActions(s, [{ id: "enroll:finance" }])[0].disabled, true);
});

test("care and work use the same illness state, funds and local health budget", () => {
  let s = state();
  const healthBudget = local(s);
  healthBudget.policy = "health";
  healthBudget.policyUntil = 20;
  data(s).illness = { since: 1, severity: 85 };
  assert.equal(
    adaptInstitutionActions(s, [{ id: "work" }, { id: "world:shift" }]).every(
      ({ disabled }) => disabled,
    ),
    true,
  );
  const care = action(s, "clinic");
  const total = s.bank + s.cash;
  s = resolve(s, "clinic");
  assert.equal(s.bank + s.cash, total - care.cost);
  assert.equal(local(s).treasury, healthBudget.treasury - care.institutionGrant);
  assert.equal(data(s).illness.severity, 23);
  assert.equal(adaptInstitutionActions(s, [{ id: "work", disabled: false }])[0].disabled, false);
  const working = structuredClone(s);
  afterInstitutionAction(working, "work", s, api);
  assert.equal(data(working).illness.severity, 27);
  assert.ok(working.player.health < s.player.health);
  afterInstitutionAction(working, "clinic", s, api);
  assert.equal(data(working).illness, null);
});

test("petition decisions use known contacts, reach media once and fund only real rent arrears", () => {
  let s = state();
  for (const id of ["mert", "ece", "aylin"]) {
    s.npcs[id].trust = 42;
    afterInstitutionAction(s, "talk:" + id, structuredClone(s), api);
  }
  afterInstitutionAction(s, "volunteer", structuredClone(s), api);
  afterInstitutionAction(s, "volunteer", structuredClone(s), api);
  assert.equal(action(s, "petition:housing").disabled, false);
  s = resolve(s, "petition:housing");
  assert.equal(action(s, "petition:skills").disabled, true);
  settleThrough(s, 4);
  assert.equal(local(s).policy, "housing");
  assert.equal(local(s).result.approved, true);
  const opinion = local(s).opinion;
  s = resolve(s, "publish");
  assert.ok(local(s).opinion > opinion);
  assert.equal(action(s, "publish").disabled, true);
  s.housing.arrears = 1900;
  s.cash = 1400;
  s.bank = 800;
  const grant = action(s, "rent-aid").institutionGrant;
  const treasury = local(s).treasury;
  s = resolve(s, "rent-aid");
  assert.equal(s.housing.arrears, 1900 - grant);
  assert.equal(local(s).treasury, treasury - grant);
  assert.equal(s.cash + s.bank, 2200);
  assert.equal(action(s, "rent-aid").disabled, true);
});

test("an improper contract is funded once, limits credit and carries restitution across succession", () => {
  let s = state();
  local(s).offerUntil = 7;
  const initial = local(s).treasury;
  s = resolve(s, "accept");
  const payment = data(s).case.amount;
  assert.equal(local(s).treasury, initial - payment);
  assert.equal(action(s, "accept"), undefined);
  assert.equal(action(s, "fine").disabled, true);
  assert.equal(adaptInstitutionActions(s, [{ id: "loan" }])[0].disabled, true);
  const pensionState = structuredClone(s);
  pensionState.expansion.playerId = "family:4";
  onInstitutionSuccession(pensionState, api);
  assert.equal(validateInstitutions(pensionState), true);
  assert.equal(data(pensionState).case.owner, "family:4");
  assert.equal(data(pensionState).case.amount, payment);
  assert.equal(data(pensionState).case.penalty, data(s).case.penalty);
  settleThrough(s, 5);
  const fine = data(s).case.penalty;
  s = resolve(s, "appeal");
  assert.ok(data(s).case.penalty < fine);
  assert.equal(action(s, "appeal").disabled, true);
  const beforePayment = s.cash + s.bank;
  const treasury = local(s).treasury;
  const amount = action(s, "fine").cost;
  s = resolve(s, "fine");
  assert.equal(s.cash + s.bank, beforePayment - amount);
  assert.equal(local(s).treasury, treasury + amount);
  assert.equal(data(s).case, null);
});

test("daily regional and NPC processing replays deterministically and rejects malformed records", () => {
  const original = state();
  const a = settleThrough(structuredClone(original), 95);
  const b = settleThrough(structuredClone(original), 95);
  assert.deepEqual(a, b);
  const snapshot = structuredClone(a);
  tickInstitutions(a, api);
  assert.deepEqual(a, snapshot);
  const fees = original.deep.npcs.mert.cash - a.deep.npcs.mert.cash;
  assert.ok(fees >= 0);
  assert.ok(Object.values(data(a).npcTraining).some((count) => count > 0));
  assert.ok(Object.keys(data(a).regions).every((id) => data(a).regions[id].treasury >= 0));
  assert.equal(creditMunicipalTax(a, "invalid", 100), 0);
  assert.equal(creditMunicipalTax(a, "istanbul", -100), 0);
  assert.equal(
    creditMunicipalTax(a, "istanbul", 1e9),
    1e9 - snapshot.expansion.institutions.regions.istanbul.treasury,
  );
  assert.equal(creditMunicipalTax(a, "istanbul", 500), 0);
  const view = institutionsView(a);
  view.regions[0].treasury = -1;
  assert.equal(data(a).regions.istanbul.treasury, 1e9);
  data(a).qualifications.push({ course: "finance", day: 10 }, { course: "finance", day: 11 });
  assert.equal(validateInstitutions(a), false);
  assert.equal(
    localizeInstitutionText("Belediyeye başvur · Sağlık", "en"),
    "Petition the council · Health",
  );
  assert.equal(
    localizeInstitutionText("Belediyeye başvur · Sağlık", "pl"),
    "Złóż wniosek do rady miejskiej · Zdrowie",
  );
  assert.equal(localizeInstitutionText("constructor", "en"), "constructor");
});
