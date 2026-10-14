import test from "node:test";
import assert from "node:assert/strict";
import { SAVE_VERSION, createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { getMonthlyEmploymentIncome, updateCareerProgress } from "../public/games/tc-sim/js/life.js";
import { KNOWN_CASE_TYPES } from "../public/games/tc-sim/js/calendar.js";
import { loadGame, migrateState, saveGame } from "../public/games/tc-sim/js/save.js";
import { applyDecision, canApplyDecision, getAvailableDecisions } from "../public/games/tc-sim/js/time.js";
import { isDetained } from "../public/games/tc-sim/js/risk-layer.js";

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

const fresh = () => {
  const state = createNewGame({ name: "Risk", now: "2027-01-01T00:00:00.000Z", seed: 11 });
  state.events.active = null;
  state.events.queue = [];
  if (state.world?.scenario) state.world.scenario.pendingEvent = null;
  state.finances.balance = 20000;
  state.player.age = 27;
  return state;
};

const quiet = (state) => {
  state.events.active = null;
  state.events.queue = [];
  state.weekly = { used: 0, selectedIds: [] };
};

test("riskli gece nakit, sağlık dosyası ve partner cümlesi bırakır", () => {
  assert.equal(SAVE_VERSION, 6);
  assert.equal(KNOWN_CASE_TYPES.includes("risk-dosya"), true);
  const state = fresh();
  const elif = state.people.find((person) => person.id === "elif");
  elif.social.romanceStatus = "partner";
  state.social.currentPartnerNpcId = "elif";
  state.time.weekOfMonth = 3;
  const before = state.finances.balance;
  assert.equal(getAvailableDecisions(state).some((item) => item.id === "risk-night"), true);
  const result = applyDecision(state, "risk-night");
  assert.equal(result.ok, true);
  assert.match(result.message, /450/);
  assert.match(result.message, /dosya/i);
  assert.equal(state.weekly.used, 1);
  assert.equal(state.finances.balance, before - 450);
  assert.equal(Number.isInteger(state.finances.balance), true);
  assert.ok(state.health.stress > 0);
  assert.equal(state.openCases.some((item) => item.type === "risk-dosya" && item.payload.kind === "saglik"), true);
  const npc = elif.memories.map((item) => item.text).join(" ");
  assert.match(npc, /dosya/);
  assert.ok(elif.social.tension > 0);
});

test("ikinci doz madde dosyası açar, ilki açmaz", () => {
  const state = fresh();
  state.time.weekOfMonth = 4;
  const first = applyDecision(state, "risk-dose");
  assert.equal(first.ok, true);
  assert.match(first.message, /Henüz dosya yok/);
  assert.equal(state.flags.risk.uses, 1);
  assert.equal(state.openCases.some((item) => item.payload?.kind === "madde"), false);
  assert.equal(state.finances.balance, 20000 - 500);
  quiet(state);
  const second = applyDecision(state, "risk-dose");
  assert.equal(second.ok, true);
  assert.match(second.message, /Madde dosyası/);
  assert.equal(state.flags.risk.uses, 2);
  assert.equal(state.finances.balance, 20000 - 500 - 750);
  assert.equal(Number.isInteger(state.finances.balance), true);
  assert.equal(state.openCases.some((item) => item.type === "risk-dosya" && item.payload.kind === "madde"), true);
});

test("kavga polis dosyası açar ve anne cümlesini değiştirir", () => {
  const state = fresh();
  state.time.weekOfMonth = 2;
  state.health.stress = 55;
  const anneBefore = state.relationships.anne;
  const result = applyDecision(state, "risk-fight");
  assert.equal(result.ok, true);
  assert.match(result.message, /dosya/i);
  assert.equal(state.finances.balance, 20000 - 900);
  assert.ok(state.relationships.anne < anneBefore);
  const dosya = state.openCases.find((item) => item.payload?.kind === "kavga");
  assert.ok(dosya);
  assert.match(dosya.payload.text, /mahkemeye/);
  const anne = state.people.find((person) => person.id === "anne");
  assert.match(anne.memories.at(-1).text, /Dosyada/);
  assert.equal(isDetained(state), false);
});

test("ikinci kavga kısa tutuklamadır; maaş durur, kayıt sürüm 6 kalır", () => {
  const state = fresh();
  state.time.weekOfMonth = 2;
  state.health.stress = 70;
  assert.equal(applyDecision(state, "risk-fight").ok, true);
  quiet(state);
  state.health.stress = 70;
  const salary = getMonthlyEmploymentIncome(state);
  assert.ok(salary > 0);
  const role = state.career.weeksInRole;
  const held = applyDecision(state, "risk-fight");
  assert.equal(held.ok, true);
  assert.match(held.message, /tutuklama/);
  assert.equal(isDetained(state), true);
  assert.equal(getMonthlyEmploymentIncome(state), 0);
  assert.equal(updateCareerProgress(state), false);
  assert.equal(state.career.weeksInRole, role);
  quiet(state);
  assert.equal(canApplyDecision(state, "overtime").ok, false);
  assert.match(canApplyDecision(state, "overtime").reason, /İçeridesin/);
  assert.equal(canApplyDecision(state, "rest").ok, true);
  assert.equal(Number.isInteger(state.finances.balance), true);
  assert.ok(state.finances.balance < 20000 - 900);

  const storage = new MemoryStorage();
  assert.equal(saveGame(storage, state).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.meta.saveVersion, 6);
  assert.equal(loaded.state.flags.risk.detainedUntil, state.flags.risk.detainedUntil);
  assert.equal(loaded.state.openCases.some((item) => item.type === "risk-dosya" && item.status === "pending"), true);
  assert.equal(validateState(loaded.state).ok, true);
  const raw = structuredClone(loaded.state);
  delete raw.flags.risk;
  const migrated = migrateState(raw);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.state.meta.saveVersion, 6);
  assert.equal(migrated.state.flags.risk.uses, 0);
});
