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
  readSaveToken,
  importGame,
  exportGame,
  SAVE_KEY,
  BACKUP_KEY,
} from "../public/games/tc-sim-boardworld/persistence.mjs";
const disk = () => {
  const map = new Map();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  };
};
const advance = (state) =>
  getActions(state)
    .map((a) => resolveAction(state, a.id))
    .find((r) => r.ok).state;
test("suspended native writer cannot replace newer progress or rotate its backup before storage event delivery", () => {
  const store = disk();
  saveGame(createGame({ seed: 7 }), store);
  const stale = loadGame(store).state,
    token = readSaveToken(store);
  const newer = advance(advance(advance(stale)));
  assert.equal(saveGame(newer, store, token).ok, true);
  const bytes = new Map(store.map);
  const rejected = saveGame(advance(stale), store, token);
  assert.equal(rejected.conflict, true);
  assert.equal(rejected.ok, false);
  assert.deepEqual(store.map, bytes);
  assert.deepEqual(loadGame(store).state, newer);
  assert.deepEqual(
    importGame(exportGame(stale)).state,
    stale,
    "conflict never prevents offline export",
  );
});
test("equal-revision native forks compare bytes and a fresh token permits intentional import or new life", () => {
  const store = disk();
  const first = createGame({ name: "First", seed: 1 }),
    second = createGame({ name: "Second", seed: 2 });
  saveGame(first, store);
  const old = readSaveToken(store);
  assert.equal(saveGame(second, store, old).ok, true);
  assert.equal(first.revision, second.revision);
  assert.equal(saveGame(first, store, old).conflict, true);
  const imported = importGame(exportGame(first)).state;
  assert.equal(saveGame(imported, store, readSaveToken(store)).ok, true);
  assert.equal(saveGame(createGame({ seed: 3 }), store, readSaveToken(store)).ok, true);
});
test("in-flight import, first-life creation, backup-only changes and deletion cannot bypass expected bytes", () => {
  const store = disk(),
    empty = readSaveToken(store);
  const life = createGame({ seed: 7 });
  saveGame(life, store, empty);
  assert.equal(saveGame(createGame({ seed: 8 }), store, empty).conflict, true);
  let token = readSaveToken(store);
  store.map.set(BACKUP_KEY, exportGame(life));
  assert.equal(saveGame(life, store, token).conflict, true);
  token = readSaveToken(store);
  store.map.delete(SAVE_KEY);
  assert.equal(saveGame(life, store, token).conflict, true);
});
test("successful guarded writes return the exact next token; write failures do not claim success", () => {
  const store = disk();
  let result = saveGame(createGame({ seed: 7 }), store, readSaveToken(store));
  assert.deepEqual(result.token, readSaveToken(store));
  result = saveGame(advance(loadGame(store).state), store, result.token);
  assert.equal(result.ok, true);
  assert.deepEqual(result.token, readSaveToken(store));
  const before = new Map(store.map);
  store.setItem = () => {
    throw Error("quota");
  };
  assert.equal(saveGame(loadGame(store).state, store, result.token).ok, false);
  assert.deepEqual(store.map, before);
});

test("locked transactions serialize simultaneous snapshots and migration; missing locks never write", async () => {
  const { saveGameLocked, loadGameLocked } =
    await import("../public/games/tc-sim-boardworld/persistence.mjs");
  let queue = Promise.resolve();
  const locks = {
    request(_name, fn) {
      const next = queue.then(fn);
      queue = next.catch(() => {});
      return next;
    },
  };
  const store = disk(),
    initial = createGame({ seed: 9 });
  saveGame(initial, store);
  const token = readSaveToken(store);
  const results = await Promise.all([
    saveGameLocked(advance(initial), store, token, locks),
    saveGameLocked(initial, store, token, locks),
  ]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.filter((r) => r.conflict).length, 1);
  const loaded = await loadGameLocked(store, locks);
  assert.deepEqual(loaded.token, readSaveToken(store));
  const before = new Map(store.map);
  assert.equal((await saveGameLocked(initial, store, loaded.token, {})).ok, false);
  assert.deepEqual(store.map, before);
  const readOnly = await loadGameLocked(store, {});
  assert.deepEqual(readOnly.state, loaded.state);
  assert.deepEqual(store.map, before);
});

test("concurrent legacy loads promote once under the lock, while unsupported browsers leave every legacy byte alone", async () => {
  const { readFileSync } = await import("node:fs");
  const { loadGameLocked, LEGACY_V5_SAVE_KEY, ORIGINAL_V5_BACKUP_KEY } =
    await import("../public/games/tc-sim-boardworld/persistence.mjs");
  const original = readFileSync(
    new URL("./fixtures/boardworld/v5-fresh-restart.json", import.meta.url),
    "utf8",
  );
  const store = disk();
  store.map.set(LEGACY_V5_SAVE_KEY, original);
  const before = new Map(store.map),
    readOnly = await loadGameLocked(store, {});
  assert.ok(readOnly.state);
  assert.equal(readOnly.protected, false);
  assert.deepEqual(store.map, before);
  let queue = Promise.resolve();
  const locks = {
    request(_name, fn) {
      const next = queue.then(fn);
      queue = next.catch(() => {});
      return next;
    },
  };
  const loads = await Promise.all([loadGameLocked(store, locks), loadGameLocked(store, locks)]);
  assert.deepEqual(loads[0].state, loads[1].state);
  assert.deepEqual(loads[0].token, loads[1].token);
  assert.equal(store.getItem(ORIGINAL_V5_BACKUP_KEY), original);
  assert.equal(store.getItem(LEGACY_V5_SAVE_KEY), original);
});
