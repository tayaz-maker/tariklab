import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  createGame,
  getActions,
  resolveAction,
  migrateState,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import * as originalV5 from "./fixtures/boardworld/v5-persistence.mjs";
import {
  SAVE_KEY,
  BACKUP_KEY,
  LEGACY_V5_SAVE_KEY,
  LEGACY_V5_BACKUP_KEY,
  ORIGINAL_V5_BACKUP_KEY,
  exportGame,
  importGame,
  loadGame,
  saveGame,
} from "../public/games/tc-sim-boardworld/persistence.mjs";

const file = (name) =>
  readFileSync(new URL(`./fixtures/boardworld/${name}`, import.meta.url), "utf8");
const provenance = JSON.parse(file("v5-provenance.json"));
const hash = (text) => createHash("sha256").update(text).digest("hex");
const original = (name) => JSON.parse(JSON.parse(file(name)).payload);
const storage = () => {
  const map = new Map([["tariklab::tc-sim:1", "original-TC-untouched"]]);
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  };
};
function envelope(payload, version = 6, format = "tc-sim-boardworld-dictionary-1") {
  const text = JSON.stringify(payload);
  let checksum = 2166136261;
  for (let i = 0; i < text.length; i++)
    checksum = Math.imul(checksum ^ text.charCodeAt(i), 16777619) >>> 0;
  return JSON.stringify({
    format,
    version,
    checksum: checksum.toString(16).padStart(8, "0"),
    payload: text,
  });
}
function next(state) {
  const action =
    getActions(state).find((a) => !a.disabled && a.id === "wait:15") ||
    getActions(state).find((a) => !a.disabled);
  const result = resolveAction(state, action.id);
  assert.equal(result.ok, true);
  assert.equal(validateState(result.state), true);
  return result.state;
}

test("real5 provenance binds every fixture, action trace and the exact released writer", () => {
  assert.equal(provenance.sourceCommit, "78ec4ee339051840037e48e80f4b07518d5a1424");
  assert.equal(provenance.sourceTree, "7c4a44d04fd7bb2109ed25b1f696678b4df06d47");
  const writer = file("v5-persistence.mjs").replace(
    'from "../../../public/games/tc-sim-boardworld/engine.mjs"',
    'from "./engine.mjs"',
  );
  assert.equal(hash(writer), provenance.persistenceFixture.originalSha256);
  for (const fixture of provenance.fixtures) {
    const bytes = file(fixture.file),
      state = JSON.parse(JSON.parse(bytes).payload);
    assert.equal(hash(bytes), fixture.sha256, fixture.file);
    assert.equal(Buffer.byteLength(bytes), fixture.byteLength);
    assert.equal(state.version, 5);
    assert.equal(state.revision, fixture.actionCount);
    assert.equal(Math.floor(state.time / 1440) + 1, fixture.day);
    if (fixture.traceFile) {
      const trace = file(fixture.traceFile);
      assert.equal(hash(trace), fixture.traceSha256);
      assert.equal(fixture.traceSha256, provenance.traces[fixture.traceFile]);
      assert.ok(JSON.parse(trace).actions.length >= fixture.actionCount);
    }
  }
});

test("every authentic5 fixture migrates purely, keeps every old field, and round-trips compact6 losslessly", () => {
  let large = 0;
  for (const fixture of provenance.fixtures) {
    const bytes = file(fixture.file),
      before = JSON.parse(JSON.parse(bytes).payload),
      unchanged = structuredClone(before);
    assert.equal(validateState(before), true, fixture.file);
    const migrated = migrateState(before),
      imported = importGame(bytes);
    assert.equal(migrated.version, 6);
    assert.deepEqual(before, unchanged, "migration never modifies the old state");
    assert.deepEqual(
      { ...migrated, version: 5 },
      before,
      "no old history, balance, memory or RNG disappears",
    );
    assert.deepEqual(migrateState(migrated), migrated);
    assert.deepEqual(imported.state, migrated);
    assert.equal(imported.sourceVersion, 5);
    assert.equal(imported.migrated, true);
    const compact = exportGame(migrated),
      outer = JSON.parse(compact);
    assert.equal(outer.version, 6);
    assert.equal(outer.format, "tc-sim-boardworld-dictionary-1");
    assert.deepEqual(importGame(compact).state, migrated);
    if (fixture.day >= 91) {
      large++;
      assert.ok(
        Buffer.byteLength(compact) < Buffer.byteLength(bytes),
        `${fixture.file} shrinks without deleting state`,
      );
    }
  }
  assert.ok(large >= 9);
});

test("loading5 immediately protects canonical6 and keeps its exact original archive immutable", () => {
  const disk = storage(),
    bytes = " \n" + file("v5-social-2026-day91.json");
  disk.setItem(LEGACY_V5_SAVE_KEY, bytes);
  disk.setItem(LEGACY_V5_BACKUP_KEY, file("v5-fresh-restart.json"));
  const loaded = loadGame(disk);
  assert.equal(loaded.state.version, 6);
  assert.equal(disk.getItem(ORIGINAL_V5_BACKUP_KEY), bytes);
  assert.equal(disk.getItem(LEGACY_V5_SAVE_KEY), bytes);
  assert.ok(disk.getItem(SAVE_KEY));
  let state = loaded.state;
  for (let i = 0; i < 5; i++) {
    state = next(state);
    assert.equal(saveGame(state, disk).ok, true);
  }
  assert.equal(disk.getItem(ORIGINAL_V5_BACKUP_KEY), bytes);
  assert.deepEqual(loadGame(disk).state, state);
  assert.equal(disk.getItem("tariklab::tc-sim:1"), "original-TC-untouched");
});

test("real old5 writer interleavings cannot overwrite6 primary, rolling backup or reload progress", () => {
  const disk = storage(),
    old = original("v5-career-2026-day366.json");
  assert.equal(originalV5.saveGame(old, disk).ok, true);
  let state = next(loadGame(disk).state);
  assert.equal(saveGame(state, disk).ok, true);
  const archive = disk.getItem(ORIGINAL_V5_BACKUP_KEY);
  for (const name of ["v5-social-2026-day366.json", "v5-entrepreneur-91373-day366.json"]) {
    const canonical = disk.getItem(SAVE_KEY),
      backup = disk.getItem(BACKUP_KEY);
    assert.equal(originalV5.saveGame(original(name), disk).ok, true);
    assert.equal(disk.getItem(SAVE_KEY), canonical);
    assert.equal(disk.getItem(BACKUP_KEY), backup);
    assert.deepEqual(loadGame(disk).state, state);
    state = next(state);
    assert.equal(saveGame(state, disk).ok, true);
  }
  assert.equal(disk.getItem(ORIGINAL_V5_BACKUP_KEY), archive);
});

test("healthy6 backup outranks newer5; both damaged6 slots recover original5 through verified promotion", () => {
  const disk = storage(),
    bytes = file("v5-fresh-graduate.json");
  disk.setItem(LEGACY_V5_SAVE_KEY, bytes);
  const first = loadGame(disk).state;
  assert.equal(saveGame(next(first), disk).ok, true);
  disk.setItem(LEGACY_V5_SAVE_KEY, file("v5-social-2026-day366.json"));
  disk.setItem(SAVE_KEY, "corrupt");
  assert.deepEqual(loadGame(disk).state, first);
  disk.setItem(BACKUP_KEY, "also-corrupt");
  const recovered = loadGame(disk).state;
  assert.equal(recovered.version, 6);
  assert.equal(Math.floor(recovered.time / 1440), 365);
  assert.deepEqual(importGame(disk.getItem(SAVE_KEY)).state, recovered);
  assert.equal(disk.getItem(ORIGINAL_V5_BACKUP_KEY), bytes);
});

test("archive and canonical quota failures never modify legacy slots or claim a protected6 save", () => {
  for (const failedKey of [ORIGINAL_V5_BACKUP_KEY, SAVE_KEY])
    for (const silent of [false, true]) {
      const disk = storage(),
        bytes = file("v5-active-household.json");
      disk.setItem(LEGACY_V5_SAVE_KEY, bytes);
      const put = disk.setItem;
      disk.setItem = (key, value) => {
        if (key === failedKey) {
          if (silent) return;
          throw new Error("quota");
        }
        return put(key, value);
      };
      const loaded = loadGame(disk);
      assert.equal(loaded.state.version, 6, "the readable original remains available in memory");
      assert.equal(loaded.protected, false);
      assert.equal(disk.getItem(SAVE_KEY), null);
      assert.equal(disk.getItem(LEGACY_V5_SAVE_KEY), bytes);
      assert.equal(saveGame(loaded.state, disk).ok, false);
    }
});

test("damaged5 checksum and checksum-valid malformed5 schema fail before migration", () => {
  const bytes = file("v5-active-knowledge.json"),
    state = original("v5-active-knowledge.json");
  const bad = JSON.parse(bytes);
  bad.checksum = "00000000";
  assert.equal(importGame(JSON.stringify(bad)).state, null);
  for (const mutate of [
    (s) => {
      s.society.nextId = 0;
    },
    (s) => {
      s.player.health = 101;
    },
    (s) => {
      s.flow.unrecognizedPermission = true;
    },
  ]) {
    const altered = structuredClone(state);
    mutate(altered);
    assert.equal(importGame(envelope(altered, 5, "tc-sim-boardworld")).state, null);
  }
});

test("checksum-valid corrupt compact dictionaries fail without replacing healthy6 progress", () => {
  const state = migrateState(original("v5-active-calendar.json")),
    disk = storage();
  assert.equal(saveGame(state, disk).ok, true);
  const healthy = disk.getItem(SAVE_KEY),
    packed = JSON.parse(JSON.parse(healthy).payload);
  const corrupt = [
    { ...packed, codec: 9 },
    { ...packed, strings: [null] },
    { ...packed, root: ["s", -1] },
    { ...packed, root: ["s", packed.strings.length] },
    { ...packed, root: ["unknown", []] },
    {
      ...packed,
      root: [
        "o",
        [
          [0, null],
          [0, true],
        ],
      ],
    },
    { ...packed, root: ["a", [], "extra"] },
  ];
  for (const value of corrupt) {
    assert.equal(importGame(envelope(value)).state, null);
    assert.equal(disk.getItem(SAVE_KEY), healthy);
    assert.deepEqual(loadGame(disk).state, state);
  }
});

test("explicit5 file import archives its untouched bytes before first compact6 save", () => {
  const bytes = "\n " + file("v5-active-invitation.json"),
    disk = storage();
  const loaded = importGame(bytes);
  assert.equal(saveGame(loaded.state, disk).ok, true);
  assert.equal(disk.getItem(ORIGINAL_V5_BACKUP_KEY), bytes);
  assert.equal(disk.getItem(LEGACY_V5_SAVE_KEY), null);
  assert.deepEqual(loadGame(disk).state, loaded.state);
  const one = loadGame(disk).state,
    two = loadGame(disk).state;
  one.society.districts.kadikoy.foodStock = -1;
  assert.notStrictEqual(one, two);
  assert.deepEqual(two, loaded.state);
  assert.equal(saveGame(one, disk).ok, false);
  assert.deepEqual(loadGame(disk).state, loaded.state);
});

test("new6 starts and compatible plain6 imports retain exact state in the default compact format", () => {
  for (const scenario of ["newcomer", "graduate", "restart"]) {
    const state = createGame({ scenario, seed: 29 });
    assert.equal(state.version, 6);
    assert.deepEqual(importGame(exportGame(state)).state, state);
    assert.deepEqual(importGame(envelope(state, 6, "tc-sim-boardworld")).state, state);
  }
});

test("safe legacy extension history accepted by the original5 writer is preserved rather than silently discarded", () => {
  const state = original("v5-fresh-restart.json");
  state.extensionHistory = {
    source: "legacy extension",
    entries: ["kept verbatim", "özel geçmiş"],
  };
  const bytes = originalV5.exportGame(state);
  const migrated = importGame(bytes).state;
  assert.ok(migrated);
  assert.deepEqual({ ...migrated, version: 5 }, state);
  assert.deepEqual(importGame(exportGame(migrated)).state, migrated);
});
