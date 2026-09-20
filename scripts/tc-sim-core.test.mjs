import test from "node:test";
import assert from "node:assert/strict";
import {
  SAVE_VERSION,
  createNewGame,
  transact,
  adjustHealth,
  validateState,
} from "../public/games/tc-sim/js/state.js";
import {
  activateNextEvent,
  getEventDefinition,
  resolveEvent,
} from "../public/games/tc-sim/js/events.js";
import { advanceWeek, applyDecision } from "../public/games/tc-sim/js/time.js";
import {
  BACKUP_KEY,
  SAVE_KEY,
  deserializeState,
  loadGame,
  migrateState,
  saveGame,
} from "../public/games/tc-sim/js/save.js";

class MemoryStorage {
  constructor() {
    this.data = new Map();
  }
  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }
  setItem(key, value) {
    this.data.set(key, String(value));
  }
  removeItem(key) {
    this.data.delete(key);
  }
}

const fresh = () => createNewGame({ name: "Test", seed: 42, now: "2027-01-01T00:00:00.000Z" });
const settleEvent = (state, preferred = null) => {
  if (!state.events.active) return;
  const definition = getEventDefinition(state.events.active.eventId);
  const choice =
    preferred ||
    (state.events.active.eventId === "loan_repayment" ? "collect" : definition.choices[0].id);
  resolveEvent(state, choice);
};

test("1. yeni oyun geçerli state oluşturur", () => assert.equal(validateState(fresh()).ok, true));

test("2. hafta doğru ilerler", () => {
  const state = fresh();
  assert.equal(advanceWeek(state).ok, true);
  assert.equal(state.time.absoluteWeek, 2);
  assert.equal(state.time.weekOfMonth, 2);
});

test("3. ay geçişinde gelir ve gider bir kez uygulanır", () => {
  const state = fresh();
  const start = state.finances.balance;
  for (let i = 0; i < 4; i += 1) {
    settleEvent(state);
    advanceWeek(state);
  }
  assert.equal(state.time.month, 2);
  assert.equal(state.finances.balance, start + 2500);
});

test("4. yıl geçişi yaş ve yıl dosyası üretir", () => {
  const state = fresh();
  for (let i = 0; i < 48; i += 1) {
    settleEvent(state);
    advanceWeek(state);
  }
  assert.equal(state.time.year, 2028);
  assert.equal(state.player.age, 19);
  assert.equal(state.yearlyHistory.length, 1);
  assert.equal(state.yearlyHistory[0].year, 2027);
});

test("5. para NaN olamaz", () => {
  const state = fresh();
  assert.throws(() => transact(state, Number.NaN, "bozuk"));
  assert.equal(Number.isFinite(state.finances.balance), true);
});

test("6. para işlemleri ortak kasayı ve defteri doğru günceller", () => {
  const state = fresh();
  transact(state, -375, "Test gideri", "test");
  assert.equal(state.finances.balance, 4625);
  assert.deepEqual(state.finances.ledger.at(-1), {
    week: 1,
    amount: -375,
    reason: "Test gideri",
    category: "test",
  });
});

test("7. beden değerleri 0-100 arasında kalır", () => {
  const state = fresh();
  adjustHealth(state, { energy: 999, stress: -999, health: 999 });
  assert.deepEqual(state.health, { energy: 100, stress: 0, health: 100 });
});

test("8. haftalık aktivite limiti ve aynı karar tekrarı engellenir", () => {
  const state = fresh();
  assert.equal(applyDecision(state, "rest").ok, true);
  assert.equal(applyDecision(state, "rest").ok, false);
  assert.equal(applyDecision(state, "family").ok, true);
  assert.equal(applyDecision(state, "friend").ok, true);
  state.weekly.used = 6;
  assert.equal(applyDecision(state, "exercise").ok, false);
});

test("9. tek seferlik event ikinci kez uygulanmaz", () => {
  const state = fresh();
  state.finances.balance = 1000;
  activateNextEvent(state);
  assert.equal(state.events.active.eventId, "family_budget_talk");
  assert.equal(resolveEvent(state, "accept").ok, true);
  const after = state.finances.balance;
  activateNextEvent(state);
  assert.notEqual(state.events.active?.eventId, "family_budget_talk");
  assert.equal(state.finances.balance, after);
});

test("10. flag saklanır ve sonraki event koşulunu açar", () => {
  const state = fresh();
  assert.equal(applyDecision(state, "help-friend").ok, true);
  assert.equal(state.flags.helpedFriend, true);
  for (let i = 0; i < 6; i += 1) {
    settleEvent(state);
    advanceWeek(state);
  }
  assert.equal(state.events.active?.eventId, "friend_followup");
});

test("11. NPC hafızası save/load sonrasında korunur", () => {
  const state = fresh();
  applyDecision(state, "help-friend");
  const storage = new MemoryStorage();
  saveGame(storage, state);
  const loaded = loadGame(storage);
  assert.equal(
    loaded.state.people.find((person) => person.id === "mehmet").memories[0].text,
    "İş başvurumda bana yardım etti.",
  );
});

test("12. openCase doğru haftada event üretir ve sonuçlanır", () => {
  const state = fresh();
  applyDecision(state, "lend-friend");
  for (let i = 0; i < 3; i += 1) {
    settleEvent(state);
    advanceWeek(state);
  }
  assert.equal(state.openCases[0].status, "pending");
  settleEvent(state);
  advanceWeek(state);
  assert.equal(state.events.active?.eventId, "loan_repayment");
  assert.equal(resolveEvent(state, "collect").ok, true);
  assert.equal(state.openCases[0].status, "resolved");
});

test("13. save/load round-trip temel state'i korur ve yedek üretir", () => {
  const state = fresh();
  const storage = new MemoryStorage();
  assert.equal(saveGame(storage, state).ok, true);
  applyDecision(state, "rest");
  assert.equal(saveGame(storage, state).ok, true);
  assert.ok(storage.getItem(BACKUP_KEY));
  const loaded = loadGame(storage);
  assert.equal(loaded.state.weekly.used, 1);
  assert.equal(loaded.state.player.name, "Test");
});

test("14. bozuk ana save çökmez ve sağlam yedek kurtarılır", () => {
  const storage = new MemoryStorage();
  const state = fresh();
  storage.setItem(BACKUP_KEY, JSON.stringify(state));
  storage.setItem(SAVE_KEY, "{bozuk-json");
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.source, "backup");
  assert.equal(deserializeState("{bozuk").ok, false);
});

test("15. eski ve eksik save migration ile güvenle tamamlanır", () => {
  const legacy = {
    player: { name: "Eski Kayıt", age: 18 },
    time: { year: 2027, month: 2, weekOfMonth: 1, absoluteWeek: 5 },
    finances: { balance: 3200, monthlyIncome: 9000, monthlyExpenses: 6500 },
  };
  const migrated = migrateState(legacy);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.state.meta.saveVersion, SAVE_VERSION);
  assert.equal(migrated.state.finances.balance, 3200);
});
