import test from "node:test";
import assert from "node:assert/strict";
import { SAVE_VERSION, createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { loadGame, migrateState, saveGame } from "../public/games/tc-sim/js/save.js";
import { applyDecision, canApplyDecision, getAvailableDecisions } from "../public/games/tc-sim/js/time.js";
import { openIcraNotice, processIcraWeek } from "../public/games/tc-sim/js/icra.js";

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

function base() {
  const state = createNewGame({ name: "Icra", now: "2027-01-01T00:00:00.000Z", seed: 7 });
  state.finances.balance = 20000;
  state.finances.arrears = 0;
  state.time.absoluteWeek = 16;
  state.time.weekOfMonth = 2;
  state.time.year = 2027;
  state.time.month = 4;
  state.career.jobId = "market";
  state.events.active = null;
  state.events.queue = [];
  if (state.world?.scenario) state.world.scenario.pendingEvent = null;
  state.weekly = { used: 0, selectedIds: [] };
  return state;
}

function quiet(state) {
  state.events.active = null;
  state.events.queue = [];
  state.weekly = { used: 0, selectedIds: [] };
}

test("icra yazısı ödenince dosya kapanır ve temerrüt düşer", () => {
  const state = base();
  state.finances.arrears = 3000;
  const item = openIcraNotice(state, { source: "temerrut", amount: 3000 });
  assert.ok(item);
  assert.equal(SAVE_VERSION, 6);
  const ids = getAvailableDecisions(state).map((row) => row.id);
  assert.equal(ids.includes("icra-pay"), true);
  assert.equal(ids.includes("icra-installment"), true);
  const paid = applyDecision(state, "icra-pay");
  assert.equal(paid.ok, true);
  assert.match(paid.message, /kapandı/);
  assert.equal(state.finances.balance, 17000);
  assert.equal(Number.isInteger(state.finances.balance), true);
  assert.equal(state.finances.arrears, 0);
  assert.equal(item.status, "resolved");
  assert.match(state.memories.at(-1).text, /İcra kapandı/);
  const storage = new MemoryStorage();
  assert.equal(saveGame(storage, state).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.meta.saveVersion, 6);
  assert.equal(loaded.state.finances.balance, 17000);
  assert.equal(loaded.state.finances.arrears, 0);
  assert.equal(loaded.state.flags.icra.banner.text.includes("kapandı"), true);
  assert.equal(validateState(loaded.state).ok, true);
  const raw = structuredClone(loaded.state);
  delete raw.flags.icra;
  const migrated = migrateState(raw);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.state.meta.saveVersion, 6);
  assert.equal(migrated.state.flags.icra.seized, "");
  assert.equal(migrated.state.flags.icra.banner, null);
});

test("yazıyı yok saymak nakitten sonra eşyayı iskontolu haciz eder", () => {
  const state = base();
  state.finances.balance = 400;
  state.wealth.durables.push({ id: "phone", price: 9000, acquiredWeek: 1 });
  const anne = state.relationships.anne;
  const item = openIcraNotice(state, { source: "esya", amount: 3000 });
  const ignored = applyDecision(state, "icra-ignore");
  assert.equal(ignored.ok, true);
  assert.match(ignored.message, /Eşya/);
  assert.equal(state.wealth.durables.some((row) => row.id === "phone"), false);
  assert.equal(state.wealth.vehicle, null);
  assert.equal(state.finances.balance, 0);
  assert.equal(state.finances.arrears, 710);
  assert.equal(Number.isInteger(state.finances.balance), true);
  assert.equal(item.status, "resolved");
  assert.equal(state.flags.icra.seized, "goods");
  assert.equal(state.flags.icra.frozenWeek, state.time.absoluteWeek);
  assert.ok(state.relationships.anne < anne);
  assert.match(state.people.find((person) => person.id === "anne").memories.at(-1).text, /İcra/);
  assert.equal(canApplyDecision(state, "overtime").ok, false);
  assert.match(canApplyDecision(state, "overtime").reason, /İcra haftası/);
  quiet(state);
  assert.equal(canApplyDecision(state, "rest").ok, true);
  assert.equal(validateState(state).ok, true);
});

test("taksit peşinat ve masrafı tam TL yazar, sonraki ay taksit düşer", () => {
  const state = base();
  state.finances.balance = 5000;
  state.finances.arrears = 4000;
  state.time.weekOfMonth = 2;
  const item = openIcraNotice(state, { source: "temerrut", amount: 4000 });
  const plan = applyDecision(state, "icra-installment");
  assert.equal(plan.ok, true);
  assert.match(plan.message, /masraf 240 TL/);
  assert.equal(state.finances.balance, 3160);
  assert.equal(Number.isInteger(state.finances.balance), true);
  assert.equal(item.payload.stage, "plan");
  assert.equal(item.payload.fee, 240);
  assert.equal(item.payload.owed, 2400);
  assert.equal(item.payload.installment, 600);
  assert.equal(state.finances.arrears, 2400);
  assert.equal(item.status, "pending");
  state.time.weekOfMonth = 1;
  const note = processIcraWeek(state);
  assert.match(note, /Taksit yattı/);
  assert.equal(state.finances.balance, 2560);
  assert.equal(item.payload.owed, 1800);
  assert.equal(Number.isInteger(state.finances.balance), true);
  assert.equal(Number.isInteger(state.finances.arrears), true);
  assert.equal(validateState(state).ok, true);
});
