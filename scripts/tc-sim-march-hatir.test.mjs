import test from "node:test";
import assert from "node:assert/strict";
import { SAVE_VERSION, createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { getJobById } from "../public/games/tc-sim/js/catalog.js";
import { getMonthlyHousingBreakdown } from "../public/games/tc-sim/js/life.js";
import { getRelationshipContext } from "../public/games/tc-sim/js/depth2-systems.js";
import { socialTravel } from "../public/games/tc-sim/js/locations.js";
import { canUseSocialAction } from "../public/games/tc-sim/js/social.js";
import { loadGame, migrateState, saveGame } from "../public/games/tc-sim/js/save.js";
import { advanceWeek, applyDecision, getAvailableDecisions } from "../public/games/tc-sim/js/time.js";
import { MARCH_STEP, rentToLive, steppedRent } from "../public/games/tc-sim/js/quarters.js";
import { processMarchRent } from "../public/games/tc-sim/js/march-hatir.js";

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

const quiet = (state) => {
  state.events.active = null;
  state.events.queue = [];
  if (state.world?.scenario) state.world.scenario.pendingEvent = null;
};

const fresh = () => {
  const state = createNewGame({ name: "Hatır", now: "2027-01-01T00:00:00.000Z", seed: 11 });
  state.finances.balance = 800000;
  quiet(state);
  return state;
};

const salaryOf = (state) => getJobById(state.career.jobId).salary;

function enterMarch(state) {
  state.time.absoluteWeek = 8;
  state.time.dateOrigin = "2027-02-22";
  state.time.dateOriginWeek = 8;
  quiet(state);
  const salary = salaryOf(state);
  const result = advanceWeek(state);
  assert.equal(result.ok, true, result.messages?.join(" "));
  assert.equal(state.time.month, 3);
  assert.equal(state.time.weekOfMonth, 1);
  assert.equal(salaryOf(state), salary);
  assert.equal(state.flags.pocket?.wagePct || 0, 0);
  quiet(state);
  return result;
}

test("Mart kirası mahalle adımı kadar artar; maaş durur", () => {
  const state = fresh();
  assert.equal(SAVE_VERSION, 6);
  assert.equal(rentToLive(state, "sirt", "1+1").ok, true);
  assert.equal(state.household.semt.holdings.find((item) => item.occupancy === "live").monthly, 6200);
  state.weekly = { used: 0, selectedIds: [] };
  const before = salaryOf(state);
  enterMarch(state);
  const live = state.household.semt.holdings.find((item) => item.occupancy === "live");
  assert.equal(state.household.semt.rentYears, 1);
  assert.equal(MARCH_STEP.sirt, 400);
  assert.equal(live.monthly, 6200 + 400);
  assert.equal(steppedRent(state, "kiyi", "1+1"), 5200 + 280);
  assert.equal(steppedRent(state, "ceper", "1+1"), 3300 + 160);
  assert.equal(salaryOf(state), before);
  assert.match(state.memories.at(-1).text, /Mart/);
  assert.match(state.memories.at(-1).text, /Maaş durdu/);
  assert.equal(state.finances.ledger.every((row) => Number.isInteger(row.amount)), true);
  const again = live.monthly;
  assert.equal(processMarchRent(state), "");
  assert.equal(live.monthly, again);
  assert.equal(state.household.semt.rentYears, 1);
});

test("mesai bir karar hakkı yer ve zammı tam lira karşılar; ucuz mahalle annenin yolunu seyrekleştirir", () => {
  const overtime = fresh();
  assert.equal(rentToLive(overtime, "sirt", "1+1").ok, true);
  overtime.weekly = { used: 0, selectedIds: [] };
  enterMarch(overtime);
  const step = MARCH_STEP.sirt;
  const balance = overtime.finances.balance;
  const monthly = overtime.household.semt.holdings.find((item) => item.occupancy === "live").monthly;
  assert.equal(getAvailableDecisions(overtime).some((item) => item.id === "march-overtime"), true);
  const paid = applyDecision(overtime, "march-overtime");
  assert.equal(paid.ok, true);
  assert.equal(overtime.weekly.used, 1);
  assert.equal(overtime.finances.balance, balance + step);
  assert.equal(overtime.household.semt.holdings.find((item) => item.occupancy === "live").monthly, monthly);
  assert.match(paid.message, /Maaş durdu/);

  const moved = fresh();
  assert.equal(rentToLive(moved, "sirt", "1+1").ok, true);
  moved.weekly = { used: 0, selectedIds: [] };
  const anneBefore = socialTravel(moved, "anne").cost;
  enterMarch(moved);
  assert.equal(getAvailableDecisions(moved).some((item) => item.id === "march-move"), true);
  const result = applyDecision(moved, "march-move");
  assert.equal(result.ok, true);
  assert.equal(moved.weekly.used, 1);
  assert.deepEqual(moved.weekly.selectedIds, ["march-move"]);
  assert.equal(moved.household.semt.live.quarterId, "kiyi");
  assert.equal(moved.household.semt.holdings.find((item) => item.occupancy === "live").monthly, 5200 + MARCH_STEP.kiyi);
  assert.ok(socialTravel(moved, "anne").cost > anneBefore);
  assert.match(result.message, /seyrekleşir/);
  assert.equal(canUseSocialAction(moved, "anne", "meet").ok, false);
  assert.match(canUseSocialAction(moved, "anne", "meet").reason, /seyrekleş/);
  moved.time.absoluteWeek += 2;
  quiet(moved);
  assert.equal(canUseSocialAction(moved, "anne", "meet").ok, true);
});

test("düğün zarfı hatırda kalır; gelmedi ile küçük zarf ayrı kayıttır", () => {
  const small = fresh();
  small.time.absoluteWeek = 13;
  small.time.dateOrigin = "2027-04-01";
  small.time.dateOriginWeek = 13;
  quiet(small);
  assert.equal(advanceWeek(small).ok, true);
  assert.equal(small.time.absoluteWeek, 14);
  quiet(small);
  assert.equal(getAvailableDecisions(small).some((item) => item.id === "hatir-small"), true);
  assert.equal(getAvailableDecisions(small).some((item) => item.id === "hatir-full"), true);
  const balance = small.finances.balance;
  const paid = applyDecision(small, "hatir-small");
  assert.equal(paid.ok, true);
  assert.equal(small.weekly.used, 1);
  assert.equal(small.finances.balance, balance - 500);
  const record = small.flags.calendar.hatir.at(-1);
  assert.equal(record.outcome, "kucuk");
  assert.equal(record.envelope, 500);
  assert.ok(small.memories.some((item) => /küçük/.test(item.text)));
  assert.equal(small.memories.some((item) => /gelmedi/.test(item.text)), false);
  const anneSmall = small.people.find((person) => person.id === "anne").memories.at(-1).text;
  const siblingSmall = small.people.find((person) => person.id === "kardes").memories.at(-1).text;
  assert.match(anneSmall, /küçük/);
  assert.match(siblingSmall, /küçük/);
  assert.match(getRelationshipContext(small, "anne").join(" "), /küçük/);
  assert.doesNotMatch(getRelationshipContext(small, "anne").join(" "), /gelmedi/);

  const skipped = fresh();
  skipped.time.absoluteWeek = 13;
  skipped.time.dateOrigin = "2027-04-01";
  skipped.time.dateOriginWeek = 13;
  quiet(skipped);
  assert.equal(advanceWeek(skipped).ok, true);
  quiet(skipped);
  assert.equal(advanceWeek(skipped).ok, true);
  const missed = skipped.flags.calendar.hatir.at(-1);
  assert.equal(missed.kind, "dugun");
  assert.equal(missed.outcome, "gelmedi");
  assert.equal(missed.envelope, 0);
  assert.equal(missed.untilWeek, 14 + 96);
  const anne = skipped.people.find((person) => person.id === "anne").memories.at(-1).text;
  const sibling = skipped.people.find((person) => person.id === "kardes").memories.at(-1).text;
  assert.match(anne, /gelmedi/);
  assert.match(sibling, /gelmedi/);
  assert.doesNotMatch(anne, /küçük/);
  assert.match(getRelationshipContext(skipped, "anne").join(" "), /gelmedi/);
  assert.match(getRelationshipContext(skipped, "kardes").join(" "), /gelmedi/);
  skipped.time.absoluteWeek = missed.untilWeek;
  assert.match(getRelationshipContext(skipped, "kardes").join(" "), /gelmedi/);
  skipped.time.absoluteWeek = missed.untilWeek + 1;
  assert.equal(getRelationshipContext(skipped, "kardes").some((note) => /gelmedi/.test(note)), false);

  const storage = new MemoryStorage();
  assert.equal(saveGame(storage, small).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.meta.saveVersion, 6);
  assert.equal(loaded.state.flags.calendar.hatir.at(-1).envelope, 500);
  assert.equal(loaded.state.flags.calendar.hatir.at(-1).outcome, "kucuk");
  assert.equal(validateState(loaded.state).ok, true);
  const raw = structuredClone(loaded.state);
  delete raw.flags.calendar;
  const migrated = migrateState(raw);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.state.meta.saveVersion, 6);
  assert.deepEqual(migrated.state.flags.calendar.hatir, []);
});

test("aile evinde Mart maaşı ve katalog kirayı yükseltmez", () => {
  const state = fresh();
  const housing = getMonthlyHousingBreakdown(state).base;
  const salary = salaryOf(state);
  enterMarch(state);
  assert.equal(getMonthlyHousingBreakdown(state).base, housing);
  assert.equal(salaryOf(state), salary);
  assert.equal(state.household.semt.rentYears, 1);
  assert.equal(getAvailableDecisions(state).some((item) => item.id === "march-overtime"), false);
  assert.equal(getAvailableDecisions(state).some((item) => item.id === "march-move"), false);
  assert.equal(SAVE_VERSION, 6);
});
