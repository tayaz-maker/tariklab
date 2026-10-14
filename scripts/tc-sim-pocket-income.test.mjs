import test from "node:test";
import assert from "node:assert/strict";
import { SAVE_VERSION, createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { getMonthlySummary, promoteCareer, quitJob } from "../public/games/tc-sim/js/life.js";
import { loadGame, saveGame } from "../public/games/tc-sim/js/save.js";
import { advanceWeek, applyDecision } from "../public/games/tc-sim/js/time.js";
import { getEventDefinition, resolveEvent } from "../public/games/tc-sim/js/events.js";
import { buyHolding, letHolding, openShop, renovateHolding } from "../public/games/tc-sim/js/quarters.js";
import {
  POCKET_CATALOG,
  applyPocketMoment,
  askFamilyDebt,
  cashGold,
  doVolunteer,
  processPocketWeek,
  repayFamilyDebt,
} from "../public/games/tc-sim/js/pocket-income.js";

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

const fresh = () => createNewGame({ name: "Cep", now: "2027-01-01T00:00:00.000Z", seed: 11 });
const integers = (state) => state.finances.ledger.every((row) => Number.isInteger(row.amount));
const reason = (state, text) => state.finances.ledger.find((row) => row.reason === text);

const settle = (state) => {
  if (!state.events.active) return;
  const definition = getEventDefinition(state.events.active.eventId);
  const choice = state.events.active.eventId === "loan_repayment" ? "collect" : definition.choices[0].id;
  resolveEvent(state, choice);
};

test("otuz kalem katalogda durur ve kayıt sürümü 6 kalır", () => {
  assert.equal(POCKET_CATALOG.length, 30);
  assert.equal(new Set(POCKET_CATALOG.map(([id]) => id)).size, 30);
  assert.equal(SAVE_VERSION, 6);
});

test("ilk ayın bakiyesi cep gelirinden oynamaz", () => {
  const state = fresh();
  const start = state.finances.balance;
  for (let i = 0; i < 4; i += 1) {
    settle(state);
    assert.equal(advanceWeek(state).ok, true);
  }
  assert.equal(state.finances.balance, start + 2500);
  assert.equal(integers(state), true);
});

test("haziran ikramiyesi tam lira, kısa kıdemde yatmaz", () => {
  const early = fresh();
  early.career.weeksInRole = 20;
  early.time.month = 6;
  early.time.weekOfMonth = 1;
  early.time.absoluteWeek = 21;
  assert.equal(processPocketWeek(early).includes("İkramiye"), false);
  const state = fresh();
  state.career.weeksInRole = 40;
  state.time.month = 6;
  state.time.weekOfMonth = 1;
  state.time.absoluteWeek = 21;
  const before = state.finances.balance;
  const note = processPocketWeek(state);
  assert.match(note, /İkramiye yattı/);
  assert.equal(state.finances.balance - before, 360);
  assert.equal(reason(state, "İkramiye").amount, 360);
  assert.equal(integers(state), true);
});

test("performans primi ve anne zarfı koşullu yatar", () => {
  const bonus = fresh();
  bonus.career.jobId = "office";
  bonus.career.weeksInRole = 12;
  bonus.career.performance = 80;
  bonus.time.month = 3;
  bonus.time.weekOfMonth = 3;
  bonus.time.absoluteWeek = 11;
  const before = bonus.finances.balance;
  assert.match(processPocketWeek(bonus), /Performans primi/);
  assert.equal(bonus.finances.balance - before, 384);
  const envelope = fresh();
  envelope.finances.balance = 800;
  envelope.relationships.anne = 70;
  envelope.career.weeksInRole = 4;
  envelope.time.month = 2;
  envelope.time.weekOfMonth = 3;
  envelope.time.absoluteWeek = 15;
  const anne = envelope.relationships.anne;
  assert.match(processPocketWeek(envelope), /zarf/);
  assert.equal(envelope.finances.balance, 1100);
  assert.equal(envelope.relationships.anne, anne + 2);
  assert.equal(reason(envelope, "Aile desteği").amount, 300);
});

test("asgari gecikme hafif ve tam liradır", () => {
  const state = fresh();
  state.finances.arrears = 2000;
  state.finances.balance = 400;
  state.time.weekOfMonth = 4;
  state.time.month = 1;
  state.time.absoluteWeek = 4;
  state.career.weeksInRole = 3;
  const note = processPocketWeek(state);
  assert.match(note, /asgari/i);
  assert.equal(reason(state, "Kredi kartı asgari gecikme").amount, -50);
  assert.equal(state.finances.balance, 350);
  assert.equal(integers(state), true);
});

test("aile borcu faizsizdir, hatırı düşürür ve kapanınca toparlar", () => {
  const state = fresh();
  const anne = state.relationships.anne;
  const before = state.finances.balance;
  assert.equal(askFamilyDebt(state).ok, true);
  assert.equal(state.finances.balance, before + 3000);
  assert.equal(state.relationships.anne, anne - 4);
  assert.equal(state.flags.pocket.familyDebt.amount, 3000);
  state.flags.pocket.familyDebt.dueWeek = 4;
  state.time.absoluteWeek = 4;
  state.time.month = 1;
  state.time.weekOfMonth = 1;
  state.career.weeksInRole = 3;
  assert.match(processPocketWeek(state), /Hatır azaldı/);
  assert.equal(state.relationships.anne, anne - 6);
  assert.equal(repayFamilyDebt(state).ok, true);
  assert.equal(state.flags.pocket.familyDebt, null);
  assert.equal(state.relationships.anne, anne);
  assert.equal(state.finances.balance, before);
  assert.equal(integers(state), true);
});

test("ek mesai gönüllü primi ve gece primi hafta kapanınca yatar", () => {
  const day = fresh();
  day.events.active = null;
  day.events.queue = [];
  if (day.world.scenario) day.world.scenario.pendingEvent = null;
  assert.equal(applyDecision(day, "overtime").ok, true);
  const before = day.finances.balance;
  assert.equal(advanceWeek(day).ok, true);
  assert.equal(reason(day, "Fazla mesai gönüllü primi").amount, 100);
  assert.equal(day.finances.balance, before + 100);
  const night = fresh();
  night.career.jobId = "security";
  night.events.active = null;
  night.events.queue = [];
  if (night.world.scenario) night.world.scenario.pendingEvent = null;
  assert.equal(applyDecision(night, "overtime").ok, true);
  const nightBefore = night.finances.balance;
  assert.equal(advanceWeek(night).ok, true);
  assert.equal(reason(night, "Gece vardiyası primi").amount, 150);
  assert.equal(night.finances.balance, nightBefore + 250);
});

test("kıdem ayrılışta tam lira yatar; zam sonraki maaşa işler ve kayıtta durur", () => {
  const state = fresh();
  state.career.weeksInRole = 48;
  const salaryBefore = getMonthlySummary(state).salary;
  state.time.month = 1;
  state.time.weekOfMonth = 2;
  state.time.absoluteWeek = 48;
  state.finances.balance = 20000;
  const raised = processPocketWeek(state);
  assert.match(raised, /Maaş zammı/);
  assert.equal(state.flags.pocket.wagePct, 2);
  const raisedPay = Math.round((salaryBefore * 102) / 100);
  assert.equal(getMonthlySummary(state).salary, raisedPay);
  const before = state.finances.balance;
  const left = quitJob(state);
  assert.equal(left.ok, true);
  assert.equal(state.finances.balance - before, raisedPay);
  assert.equal(reason(state, "Kıdem").amount, raisedPay);
  assert.equal(getMonthlySummary(state).salary, 0);
  assert.equal(state.flags.pocket.referralReady, true);
  state.career.jobId = "market";
  state.career.weeksInRole = 1;
  state.time.absoluteWeek = 49;
  state.finances.balance = 20000;
  state.flags.pocket.gold = true;
  state.flags.pocket.familyDebt = { amount: 3000, dueWeek: 20, nagWeek: 0 };
  const refBefore = state.finances.balance;
  assert.match(processPocketWeek(state), /Referans bonusu/);
  assert.equal(state.finances.balance - refBefore, 270);
  const storage = new MemoryStorage();
  assert.equal(saveGame(storage, state).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.meta.saveVersion, 6);
  assert.equal(loaded.state.flags.pocket.gold, true);
  assert.equal(loaded.state.flags.pocket.familyDebt.amount, 3000);
  assert.equal(loaded.state.flags.pocket.wagePct, 0);
  assert.equal(getMonthlySummary(loaded.state).salary, 9000);
  assert.equal(validateState(loaded.state).ok, true);
  assert.equal(cashGold(loaded.state).ok, false);
  const promo = fresh();
  promo.career.weeksInRole = 24;
  promo.career.performance = 80;
  const promoBefore = promo.finances.balance;
  const step = promoteCareer(promo);
  assert.equal(step.ok, true);
  const prim = reason(promo, "Terfi primi");
  assert.equal(prim.amount, 512);
  assert.equal(promo.finances.balance - promoBefore, 512);
  assert.equal(integers(promo), true);
});

test("kiracı erken ödemesi, tezgâhın iyi haftası ve tadilat değeri tam liradır", () => {
  const state = fresh();
  state.finances.balance = 900000;
  assert.equal(buyHolding(state, "ceper", "1+1").ok, true);
  state.weekly.used = 0;
  state.weekly.selectedIds = [];
  assert.equal(letHolding(state, "ceper:1+1").ok, true);
  state.time.absoluteWeek = 20;
  const before = state.finances.balance;
  const rent = applyPocketMoment(state, "erken-kira");
  assert.match(rent, /erken/);
  assert.equal(state.finances.balance - before, 250);
  state.weekly.used = 0;
  state.weekly.selectedIds = [];
  state.time.year = 2027;
  assert.equal(openShop(state, "ceper", "bakkal").ok, true);
  state.time.absoluteWeek = 24;
  const shopBefore = state.finances.balance;
  assert.match(applyPocketMoment(state, "iyi-hafta"), /iyi hafta/);
  assert.equal(state.finances.balance - shopBefore, 150);
  state.weekly.used = 0;
  state.weekly.selectedIds = [];
  const holding = state.household.semt.holdings[0];
  const value = holding.value;
  assert.equal(renovateHolding(state, holding.id).ok, true);
  const noted = applyPocketMoment(state, "tadilat");
  assert.match(noted, /tadilat/);
  assert.ok(state.household.semt.holdings[0].value > value);
  assert.equal(integers(state), true);
  const volunteer = fresh();
  for (let i = 0; i < 3; i += 1) assert.equal(doVolunteer(volunteer).ok, true);
  const cash = volunteer.finances.balance;
  assert.equal(doVolunteer(volunteer).ok, true);
  assert.equal(volunteer.finances.balance - cash, 500);
});
