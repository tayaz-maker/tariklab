import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  resolveAction,
  getActions,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import {
  saveGame,
  loadGame,
  exportGame,
  importGame,
  SAVE_KEY,
  BACKUP_KEY,
} from "../public/games/tc-sim-boardworld/persistence.mjs";
const storage = () => {
  const map = new Map([["tariklab::tc-sim:1", "legacy-do-not-touch"]]);
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
};
test("save/export/import round trip preserves all simulation state and RNG", () => {
  const state = createGame({ name: "Aylin", seed: 7 });
  assert.deepEqual(importGame(exportGame(state)).state, state);
  const disk = storage();
  assert.equal(saveGame(state, disk).ok, true);
  assert.deepEqual(loadGame(disk).state, state);
  assert.equal(disk.map.get("tariklab::tc-sim:1"), "legacy-do-not-touch");
});
test("corrupt primary recovers last healthy turn and preserves old TC save", () => {
  const state = createGame({ seed: 9 });
  const action = getActions(state).find((a) => !a.disabled);
  const next = resolveAction(state, action.id).state;
  const disk = storage();
  saveGame(state, disk);
  saveGame(next, disk);
  assert.deepEqual(importGame(disk.getItem(BACKUP_KEY)).state, state);
  disk.setItem(SAVE_KEY, "{broken");
  assert.deepEqual(loadGame(disk).state, state);
  saveGame(next, disk);
  assert.deepEqual(importGame(disk.getItem(BACKUP_KEY)).state, state);
  assert.equal(disk.map.get("tariklab::tc-sim:1"), "legacy-do-not-touch");
});
test("unsupported, truncated and tampered files fail closed", () => {
  const encoded = exportGame(createGame());
  for (const data of [
    "",
    "{}",
    "{",
    encoded.slice(0, -8),
    encoded.replace('"version":1', '"version":8'),
    encoded.replace("Deniz", "Other"),
  ])
    assert.equal(importGame(data).state, null);
  assert.equal(importGame("x".repeat(2_000_001)).state, null);
});
test("invalid nested records and non-finite values cannot be persisted", () => {
  for (const mutate of [
    (s) => (s.player.health = NaN),
    (s) => (s.cash = Infinity),
    (s) => (s.time = -1),
    (s) => (s.player = {}),
    (s) => (s.npcs = {}),
    (s) => (s.pendingEvents = [{ id: "invented", day: 1 }]),
    (s) => (s.location = "invented"),
    (s) => (s.housing = null),
    (s) => (s.inventory = null),
    (s) => (s.player.skills.technical = -2),
    (s) => (s.player.name = "x".repeat(12001)),
  ]) {
    const state = createGame();
    mutate(state);
    assert.throws(() => exportGame(state));
  }
});
test("quota/security failures are reported without deleting valid saves", () => {
  const state = createGame();
  const disk = storage();
  saveGame(state, disk);
  const before = disk.getItem(SAVE_KEY);
  disk.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  assert.equal(saveGame(state, disk).ok, false);
  assert.equal(disk.getItem(SAVE_KEY), before);
  assert.equal(
    loadGame({
      getItem() {
        throw new Error("SecurityError");
      },
    }).state,
    null,
  );
});
