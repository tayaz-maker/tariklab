import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { getCommuteExplanation } from "../public/games/tc-sim/js/life.js";
import { getAvailableDecisions, applyDecision } from "../public/games/tc-sim/js/time.js";
import { getNavigationTarget, NAVIGATION_ITEMS } from "../public/games/tc-sim/js/navigation.js";
import { PRESENT_DAY_ERA_ID } from "../public/games/tc-sim/js/eras.js";
import { loadGame, migrateState, saveGame } from "../public/games/tc-sim/js/save.js";

class MemoryStorage {
  constructor() {
    this.data = new Map();
  }
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    this.data.set(key, String(value));
  }
  removeItem(key) {
    this.data.delete(key);
  }
}

test("3A.1 navigation yalnız etkin ekranlara güvenilir hedef verir", () => {
  assert.equal(getNavigationTarget("dashboard"), "dashboard");
  assert.equal(getNavigationTarget("career"), "career");
  assert.equal(getNavigationTarget("home"), "home");
  assert.equal(getNavigationTarget("finance"), "finance");
  assert.equal(getNavigationTarget("money"), null);
  assert.equal(NAVIGATION_ITEMS.find((item) => item.label === "FİNANS").view, "finance");
  assert.equal(NAVIGATION_ITEMS.find((item) => item.label === "MARKET").view, "market");
});

test("3A.1 commute açıklaması işsiz ve aktif kombinasyonlarda hesapla uyumludur", () => {
  const unemployed = getCommuteExplanation("family", null);
  assert.equal(unemployed.label, "İşsiz — ulaşım yükü yok");
  assert.equal(unemployed.energy, 0);
  const active = getCommuteExplanation("family", "courier");
  assert.match(active.label, /Orta|Yüksek|Düşük|Çok düşük/);
  assert.equal(active.energy, -4);
  assert.equal(active.stress, 4);
});

test("3A.1 contextual kararlar yalnız doğru durumda görünür ve zaman bütçesi korunur", () => {
  const state = createNewGame({ seed: 11 });
  assert.equal(
    getAvailableDecisions(state).some((item) => item.id === "quiet-evening"),
    false,
  );
  state.health.energy = 40;
  assert.equal(
    getAvailableDecisions(state).some((item) => item.id === "quiet-evening"),
    true,
  );
  assert.equal(applyDecision(state, "quiet-evening").ok, true);
  assert.equal(applyDecision(state, "rest").ok, true);
  assert.equal(applyDecision(state, "overtime").ok, true);
  state.weekly.used = 6;
  assert.equal(applyDecision(state, "exercise").ok, false);
});

test("3A.1 yeni state Günümüz ile başlar; eski ve geçersiz dönemler güvenle migrate olur", () => {
  const state = createNewGame({ seed: 12 });
  assert.equal(state.world.eraId, PRESENT_DAY_ERA_ID);
  assert.equal(validateState(state).ok, true);
  const old = structuredClone(state);
  old.meta.saveVersion = 2;
  delete old.world;
  const migrated = migrateState(old);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.state.world.eraId, PRESENT_DAY_ERA_ID);
  const invalid = structuredClone(state);
  invalid.world.eraId = "unknown-era";
  const normalized = migrateState(invalid);
  assert.equal(normalized.ok, true);
  assert.equal(normalized.state.world.eraId, PRESENT_DAY_ERA_ID);
});

test("3A.1 era save/load sonrasında stable ID ile korunur", () => {
  const storage = new MemoryStorage();
  const state = createNewGame({ seed: 13 });
  assert.equal(saveGame(storage, state).ok, true);
  assert.equal(loadGame(storage).state.world.eraId, PRESENT_DAY_ERA_ID);
});
