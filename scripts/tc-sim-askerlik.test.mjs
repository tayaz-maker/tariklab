import test from "node:test";
import assert from "node:assert/strict";
import { SAVE_VERSION, createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { getMonthlyEmploymentIncome, updateCareerProgress } from "../public/games/tc-sim/js/life.js";
import { loadGame, migrateState, saveGame } from "../public/games/tc-sim/js/save.js";
import { applyDecision, canApplyDecision, getAvailableDecisions } from "../public/games/tc-sim/js/time.js";
import { isServing, processAskerlikWeek } from "../public/games/tc-sim/js/askerlik.js";

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

function base() {
  const state = createNewGame({ name: "Asker", now: "2027-01-01T00:00:00.000Z", seed: 4 });
  state.finances.balance = 20000;
  state.player.age = 22;
  state.time.weekOfMonth = 1;
  state.time.absoluteWeek = 20;
  state.time.year = 2027;
  state.time.month = 5;
  state.career.jobId = "market";
  state.career.weeksInRole = 12;
  state.events.active = null;
  state.events.queue = [];
  if (state.world?.scenario) state.world.scenario.pendingEvent = null;
  const elif = state.people.find((person) => person.id === "elif");
  elif.social.romanceStatus = "partner";
  state.social.currentPartnerNpcId = "elif";
  state.flags.workplace = {
    manager: "Selma",
    peer: "Kerem",
    notes: [],
    peerShifts: [],
    managerLog: [{ week: 10, year: 2027, kind: null, text: "Selma notu duruyor." }],
  };
  return state;
}

function quiet(state) {
  state.events.active = null;
  state.events.queue = [];
  state.weekly = { used: 0, selectedIds: [] };
}

test("gitme maaşı keser; dönüşte bant ve Selma defteri kapanır", () => {
  const state = base();
  assert.equal(SAVE_VERSION, 6);
  assert.equal(getAvailableDecisions(state).some((item) => item.id === "asker-gitme"), true);
  const role = state.career.weeksInRole;
  const went = applyDecision(state, "asker-gitme");
  assert.equal(went.ok, true);
  assert.match(went.message, /Gittin/);
  assert.match(went.message, /Maaş yok/);
  assert.equal(isServing(state), true);
  assert.equal(getMonthlyEmploymentIncome(state), 0);
  assert.equal(updateCareerProgress(state), false);
  assert.equal(state.career.weeksInRole, role);
  assert.equal(state.career.jobId, "market");
  assert.equal(state.household.homeId, "family");
  assert.match(state.people.find((person) => person.id === "elif").memories.at(-1).text, /Gittin/);
  assert.equal(canApplyDecision(state, "overtime").ok, false);
  assert.match(canApplyDecision(state, "overtime").reason, /Askerdesin/);
  quiet(state);
  assert.equal(canApplyDecision(state, "rest").ok, true);

  state.time.absoluteWeek = state.flags.askerlik.until;
  const back = processAskerlikWeek(state);
  assert.match(back, /beklemedi/);
  assert.match(back, /kapattı/);
  assert.equal(isServing(state), false);
  assert.equal(state.career.jobId, null);
  assert.equal(state.flags.workplace.managerLog.length, 0);
  assert.match(state.flags.workplace.notes.at(-1).text, /kapattı/);
  assert.match(state.people.find((person) => person.id === "anne").memories.at(-1).text, /Döndün/);
  assert.match(state.people.find((person) => person.id === "elif").memories.at(-1).text, /Döndün/);
  assert.equal(Number.isInteger(state.finances.balance), true);

  const storage = new MemoryStorage();
  assert.equal(saveGame(storage, state).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.meta.saveVersion, 6);
  assert.equal(loaded.state.flags.askerlik.mode, "done");
  assert.equal(loaded.state.flags.askerlik.returned, true);
  assert.equal(loaded.state.career.jobId, null);
  assert.equal(validateState(loaded.state).ok, true);
  const raw = structuredClone(loaded.state);
  delete raw.flags.askerlik;
  const migrated = migrateState(raw);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.state.meta.saveVersion, 6);
  assert.equal(migrated.state.flags.askerlik.mode, "");
});

test("tecil bir kez 800 TL yer, pencere sonra yalnız gitme ve kaçırma bırakır", () => {
  const state = base();
  const anne = state.relationships.anne;
  const first = applyDecision(state, "asker-tecil");
  assert.equal(first.ok, true);
  assert.match(first.message, /Tecil/);
  assert.equal(state.finances.balance, 20000 - 800);
  assert.equal(Number.isInteger(state.finances.balance), true);
  assert.equal(state.flags.askerlik.tecilUsed, true);
  assert.equal(isServing(state), false);
  assert.equal(state.relationships.anne, anne);
  quiet(state);
  assert.equal(getAvailableDecisions(state).some((item) => item.id.startsWith("asker-")), false);
  const again = applyDecision(state, "asker-tecil");
  assert.equal(again.ok, false);
  state.time.absoluteWeek = state.flags.askerlik.resumeWeek;
  state.time.weekOfMonth = 1;
  const ids = getAvailableDecisions(state).map((item) => item.id);
  assert.equal(ids.includes("asker-gitme"), true);
  assert.equal(ids.includes("asker-kacirma"), true);
  assert.equal(ids.includes("asker-tecil"), false);
});

test("kaçırma dosya açar; sonra yoklama cezası tam TL düşer", () => {
  const state = base();
  const anne = state.relationships.anne;
  const fled = applyDecision(state, "asker-kacirma");
  assert.equal(fled.ok, true);
  assert.match(fled.message, /Dosya/);
  assert.equal(isServing(state), false);
  assert.equal(state.career.jobId, "market");
  assert.ok(state.relationships.anne < anne);
  assert.match(state.people.find((person) => person.id === "anne").memories.at(-1).text, /Dosyada/);
  const dosya = state.openCases.find((item) => item.type === "risk-dosya" && item.payload?.kind === "askerlik");
  assert.ok(dosya);
  assert.equal(dosya.status, "pending");
  assert.match(dosya.payload.text, /mahkemeye/);
  state.time.absoluteWeek = state.flags.askerlik.troubleDue;
  const fine = processAskerlikWeek(state);
  assert.match(fine, /1800 TL/);
  assert.equal(state.finances.balance, 20000 - 1800);
  assert.equal(Number.isInteger(state.finances.balance), true);
  assert.equal(state.flags.askerlik.troubleDone, true);
  assert.equal(validateState(state).ok, true);
});
