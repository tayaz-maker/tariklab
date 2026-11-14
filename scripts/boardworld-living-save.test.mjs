import test from "node:test";
import assert from "node:assert/strict";
import { saveExpansionLocked } from "../public/games/tc-sim-boardworld/expansion-persistence.mjs";

// Storage protocol tests, not gameplay journeys: stub only the validated codec
// so promotion/CAS can be exercised independently of simulation loading.
const legacy = "tariklab.boardworld.v7";
const living = `${legacy}.living`;
function storageHarness() {
  let slots = new Map([
    [legacy, "old-valid"],
    [`${legacy}.backup`, "older-valid"],
  ]);
  let generation = 7;
  const memory = (map) => ({
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  });
  const probe = (store) => {
    const key =
      store.getItem(living) !== null || store.getItem(`${living}.backup`) !== null
        ? living
        : legacy;
    return { token: { key, primary: store.getItem(key), backup: store.getItem(`${key}.backup`) } };
  };
  const transact = (_, operation) => {
    const pending = new Map(slots);
    const result = operation(memory(pending), generation);
    if (result.ok) {
      slots = pending;
      generation++;
    }
    if (result.token) result.token.generation = generation;
    return result;
  };
  const locks = { request: (_, fn) => fn() };
  const io = [
    probe,
    (bytes) => (bytes.endsWith("valid") ? { sourceVersion: 7 } : {}),
    (state) => state.bytes,
    transact,
    (store, key, bytes) => store.setItem(key, bytes),
    () => ({ ok: false, conflict: true }),
    "existing-gold-lock",
    "unavailable",
    living,
    (state) => Boolean(state.expansion?.districts),
  ];
  return {
    token: () => ({ ...probe(memory(slots)).token, generation }),
    save: (state, token) => saveExpansionLocked(io, state, undefined, token, locks, transact),
    slots: () => new Map(slots),
    oldWriter: () => {
      slots.set(legacy, "old-branch-valid");
      generation++;
    },
    damage: (key, bytes) => {
      slots.set(key, bytes);
      generation++;
    },
  };
}
const state = { version: 7, expansion: { districts: {} }, bytes: "living-valid" };

test("living promotion preserves legacy slots and returns the new canonical CAS token", async () => {
  const h = storageHarness(),
    before = h.slots(),
    token = h.token();
  const result = await h.save(state, token);
  assert.equal(result.ok, true);
  assert.deepEqual(result.token, {
    key: living,
    primary: state.bytes,
    backup: "old-valid",
    generation: 8,
  });
  assert.equal(h.slots().get(legacy), before.get(legacy));
  assert.equal(h.slots().get(`${legacy}.backup`), before.get(`${legacy}.backup`));
  assert.equal(h.slots().get(living), state.bytes);
  assert.equal(h.slots().get(`${living}.backup`), "old-valid");
  assert.equal((await h.save(state, token)).conflict, true);
});

test("an old-branch save invalidates a new-client token without replacing living slots", async () => {
  const h = storageHarness();
  const first = await h.save(state, h.token());
  const canonical = h.slots().get(living);
  h.oldWriter();
  assert.equal(h.token().key, living);
  assert.equal((await h.save({ ...state, bytes: "new-valid" }, first.token)).conflict, true);
  assert.equal(h.slots().get(living), canonical);
  assert.equal((await h.save({ ...state, bytes: "new-valid" }, h.token())).ok, true);
  assert.equal(h.slots().get(`${living}.backup`), canonical);
});

test("explicit older imports stay in the canonical branch after promotion", async () => {
  const h = storageHarness();
  await h.save(state, h.token());
  assert.equal((await h.save({ version: 7, bytes: "import-valid" }, h.token())).ok, true);
  assert.equal(h.token().key, living);
  assert.equal(h.slots().get(living), "import-valid");
  assert.equal(h.slots().get(legacy), "old-valid");
});

test("slot identity is part of CAS, and corrupt or empty living slots retain authority", async () => {
  const h = storageHarness();
  const token = h.token();
  assert.equal((await h.save(state, { ...token, key: living })).conflict, true);
  h.damage(living, "");
  assert.equal(h.token().key, living);
  assert.equal((await h.save(state, token)).conflict, true);
  assert.equal(h.slots().get(legacy), "old-valid");
});

test("new worlds use their declared capability; corrupt living slots never restore a legacy branch", async () => {
  const engine = await import("../public/games/tc-sim-boardworld/engine.mjs");
  const persistence = await import("../public/games/tc-sim-boardworld/persistence.mjs");
  await engine.loadExpansionRuntime();
  let current = engine.createGame({ seed: 49, expansion: true });
  const original = persistence.exportGame(current);
  assert.equal(JSON.parse(original).format, "tc-sim-boardworld-living-world-2-dictionary-1");
  for (let n = 0; !current.expansion.underworld && n < 35; n++) {
    const event = engine.getActions(current).find((a) => a.category === "event" && !a.disabled);
    const result = engine.resolveAction(current, event ? event.id : "wait:60");
    assert.equal(result.ok, true, result.message);
    current = result.state;
  }
  assert.ok(current.expansion.underworld);
  const encoded = persistence.exportGame(current);
  const envelope = JSON.parse(encoded);
  assert.equal(envelope.format, "tc-sim-boardworld-living-world-2-dictionary-1");
  assert.deepEqual(persistence.importGame(encoded).state, current);
  envelope.format = "tc-sim-boardworld-dictionary-1";
  assert.equal(persistence.importGame(JSON.stringify(envelope)).state, null);
  const slots = new Map([
    [legacy, original],
    [living, ""],
    [`${living}.backup`, "corrupt"],
  ]);
  const loaded = await persistence.loadExpansionLocked(
    undefined,
    { request: (_, fn) => fn() },
    (_, operation) => operation({ getItem: (key) => slots.get(key) ?? null }),
  );
  assert.equal(loaded.state, null);
  assert.equal(loaded.saved, true);
  assert.equal(loaded.token.key, living);
  assert.equal(slots.get(legacy), original);
});
