import test from "node:test";
import assert from "node:assert/strict";
import { SAVE_VERSION, createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { getJobById } from "../public/games/tc-sim/js/catalog.js";
import { promoteCareer } from "../public/games/tc-sim/js/life.js";
import { KNOWN_CASE_TYPES, getPlayerVisibleOpenCases } from "../public/games/tc-sim/js/calendar.js";
import { loadGame, migrateState, saveGame } from "../public/games/tc-sim/js/save.js";
import { applyDecision, getAvailableDecisions } from "../public/games/tc-sim/js/time.js";
import { payToErasePartnerFile, processPartnerMonth } from "../public/games/tc-sim/js/partner-workplace.js";

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

const fresh = () => {
  const state = createNewGame({ name: "Dosya", now: "2027-01-01T00:00:00.000Z", seed: 11 });
  state.events.active = null;
  state.events.queue = [];
  if (state.world?.scenario) state.world.scenario.pendingEvent = null;
  state.finances.balance = 20000;
  return state;
};

function partner(state, month) {
  const elif = state.people.find((person) => person.id === "elif");
  elif.social.romanceStatus = "partner";
  state.social.currentPartnerNpcId = "elif";
  state.time.month = month;
  state.time.weekOfMonth = 1;
  state.time.year = 2027;
  state.time.absoluteWeek = (month - 1) * 4 + 1;
  return state;
}

test("partner dosyası ayda bir açılır, bir karar hakkı yer, parayla silinmez", () => {
  assert.equal(SAVE_VERSION, 6);
  assert.equal(KNOWN_CASE_TYPES.includes("partner-month"), true);
  const state = partner(fresh(), 1);
  const balance = state.finances.balance;
  const note = processPartnerMonth(state);
  assert.match(note, /vardiya/);
  assert.match(note, /Parayla kapanmaz/);
  assert.equal(processPartnerMonth(state), "");
  assert.equal(state.openCases.filter((item) => item.type === "partner-month").length, 1);
  assert.equal(getPlayerVisibleOpenCases(state).some((item) => item.type === "partner-month"), true);
  const blocked = payToErasePartnerFile(state);
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /parayla/i);
  assert.equal(state.finances.balance, balance);
  assert.equal(state.openCases[0].status, "pending");
  assert.equal(getAvailableDecisions(state).some((item) => item.id === "partner-file"), true);
  const read = applyDecision(state, "partner-file");
  assert.equal(read.ok, true);
  assert.equal(state.weekly.used, 1);
  assert.equal(state.finances.balance, balance);
  assert.equal(state.openCases[0].status, "resolved");
  assert.match(read.message, /Para gitmedi/);
  const npc = state.people.find((person) => person.id === "elif").memories.map((item) => item.text).join(" ");
  assert.match(npc, /Vardiyam değişti/);
  assert.match(npc, /Para bunu kapatmaz/);
  assert.equal(Number.isInteger(state.finances.balance), true);

  const parent = partner(fresh(), 2);
  assert.match(processPartnerMonth(parent), /ailesinde/);
  const move = partner(fresh(), 3);
  assert.match(processPartnerMonth(move), /taşınmak/);
  assert.notEqual(parent.people.find((person) => person.id === "elif").memories.at(-1).text, move.people.find((person) => person.id === "elif").memories.at(-1).text);

  const storage = new MemoryStorage();
  assert.equal(saveGame(storage, state).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.meta.saveVersion, 6);
  assert.equal(loaded.state.openCases[0].status, "resolved");
  assert.equal(validateState(loaded.state).ok, true);
  const raw = structuredClone(loaded.state);
  delete raw.flags.partnerMonth;
  delete raw.flags.workplace;
  const migrated = migrateState(raw);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.state.meta.saveVersion, 6);
  assert.equal(migrated.state.flags.partnerMonth.monthKey, "");
});

test("terfi tarihli dosya notudur; Kerem vardiyayı hatırlar", () => {
  const quiet = fresh();
  const salary = getJobById(quiet.career.jobId).salary;
  const promoted = promoteCareer(quiet);
  assert.equal(promoted.ok, true);
  assert.equal(getJobById("market").salary, salary);
  assert.equal(quiet.flags.workplace.notes[0].kind, "sessizlik");
  assert.match(quiet.flags.workplace.notes[0].text, /H\d+/);
  assert.match(quiet.flags.workplace.notes[0].text, /sessizlik/);
  assert.equal(quiet.flags.pocket?.wagePct || 0, 0);

  const shift = fresh();
  shift.time.weekOfMonth = 2;
  const before = shift.finances.balance;
  assert.equal(getAvailableDecisions(shift).some((item) => item.id === "peer-shift"), true);
  const taken = applyDecision(shift, "peer-shift");
  assert.equal(taken.ok, true);
  assert.equal(shift.weekly.used, 1);
  assert.equal(shift.finances.balance, before);
  assert.match(shift.flags.workplace.peerShifts[0].text, /Kerem/);
  shift.weekly = { used: 0, selectedIds: [] };
  shift.events.active = null;
  assert.equal(promoteCareer(shift).ok, true);
  assert.equal(shift.flags.workplace.notes.at(-1).kind, "referans");
  assert.match(shift.memories.map((item) => item.text).join(" "), /Kerem/);
  assert.match(shift.flags.workplace.notes.at(-1).text, /referans/);
});

test("Selma sağlık uyarısından sonraki mesaiyi deftere yazar", () => {
  const warned = fresh();
  warned.body.warningAvailable = true;
  const before = warned.finances.balance;
  assert.equal(applyDecision(warned, "overtime").ok, true);
  assert.equal(warned.flags.workplace.managerLog.length, 1);
  assert.match(warned.flags.workplace.managerLog[0].text, /Selma/);
  assert.match(warned.flags.workplace.managerLog[0].text, /sağlık/);
  assert.equal(Number.isInteger(warned.finances.balance - before), true);
  assert.ok(warned.finances.balance > before);

  const plain = fresh();
  plain.body.warningAvailable = false;
  assert.equal(applyDecision(plain, "overtime").ok, true);
  assert.equal(plain.flags.workplace, undefined);
});
