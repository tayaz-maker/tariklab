import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createGame,
  resolveAction,
  getActions,
  getClock,
  migrateState,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import {
  saveGame,
  loadGame,
  exportGame,
  importGame,
  SAVE_KEY,
  BACKUP_KEY,
  ORIGINAL_V1_BACKUP_KEY,
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
    encoded.replace('"version":2', '"version":8'),
    encoded.replace("Deniz", "Other"),
  ])
    assert.equal(importGame(data).state, null);
  assert.equal(importGame("x".repeat(2_000_001)).state, null);
});

const fixtureFiles = [
  "v1-fresh-newcomer.json",
  "v1-fresh-graduate.json",
  "v1-fresh-restart.json",
  "v1-progressed-restart-day46.json",
];
const legacyFile = (file = fixtureFiles[3]) =>
  readFileSync(new URL(`./fixtures/boardworld/${file}`, import.meta.url), "utf8");
const originalState = (text) => JSON.parse(JSON.parse(text).payload);
const legacyFields = (state) => {
  const result = structuredClone(state);
  delete result.version;
  delete result.deep;
  delete result.stories;
  return result;
};
function envelopeFor(state, version = state.version) {
  const payload = JSON.stringify(state);
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++)
    hash = Math.imul(hash ^ payload.charCodeAt(i), 16777619) >>> 0;
  return JSON.stringify({
    format: "tc-sim-boardworld",
    version,
    checksum: hash.toString(16).padStart(8, "0"),
    payload,
  });
}

for (const file of fixtureFiles)
  test(`original production 1.0 fixture ${file} migrates without replaying or losing progress`, () => {
    const bytes = legacyFile(file);
    const original = originalState(bytes);
    const before = structuredClone(original);
    assert.equal(validateState(original), true, "frozen production fixture remains valid");
    const result = importGame(bytes);
    assert.equal(result.sourceVersion, 1);
    assert.equal(result.migrated, true);
    assert.equal(result.state.version, 2);
    assert.equal(validateState(result.state), true);
    assert.deepEqual(legacyFields(result.state), legacyFields(original));
    assert.deepEqual(migrateState(original), result.state);
    assert.deepEqual(original, before, "migration does not mutate original");
    assert.deepEqual(migrateState(result.state), result.state, "migration is idempotent");
    assert.deepEqual(
      importGame(bytes).state,
      result.state,
      "reloading cannot repeat wages or elapsed days",
    );
    const action = getActions(result.state).find((entry) => !entry.disabled);
    assert.ok(action, "migrated life has a legal next action");
    assert.equal(resolveAction(result.state, action.id).ok, true);
    if (file.includes("day46")) {
      assert.equal(getClock(result.state).day, 46);
      assert.equal(result.state.job.level, 2);
      assert.equal(result.state.job.shifts, 37);
      assert.ok(result.state.transactions.length > 20);
    }
  });

test("new exports use envelope 2 while the existing browser save key stays stable", () => {
  assert.equal(SAVE_KEY, "tariklab.boardworld.v1");
  const state = createGame({ seed: 761 });
  const bytes = exportGame(state);
  assert.equal(JSON.parse(bytes).version, 2);
  assert.equal(importGame(bytes).sourceVersion, 2);
  assert.equal(importGame(bytes).migrated, false);
  assert.deepEqual(importGame(bytes).state, state);
});

test("first 1.0 overwrite verifies immutable original bytes before rotating or replacing slots", () => {
  const bytes = legacyFile();
  const disk = storage();
  disk.setItem(SAVE_KEY, bytes);
  const writes = [];
  const setItem = disk.setItem;
  disk.setItem = (key, value) => {
    writes.push(key);
    setItem(key, value);
  };
  const loaded = loadGame(disk);
  assert.equal(disk.getItem(SAVE_KEY), bytes, "reading does not overwrite legacy primary");
  assert.equal(saveGame(loaded.state, disk).ok, true);
  assert.deepEqual(writes, [ORIGINAL_V1_BACKUP_KEY, BACKUP_KEY, SAVE_KEY]);
  assert.equal(disk.getItem(ORIGINAL_V1_BACKUP_KEY), bytes);
  assert.equal(disk.getItem(BACKUP_KEY), bytes);
  assert.equal(JSON.parse(disk.getItem(SAVE_KEY)).version, 2);
  assert.equal(disk.map.get("tariklab::tc-sim:1"), "legacy-do-not-touch");
  assert.equal(saveGame(createGame({ seed: 1 }), disk).ok, true);
  assert.equal(saveGame(importGame(legacyFile(fixtureFiles[0])).state, disk).ok, true);
  assert.equal(
    disk.getItem(ORIGINAL_V1_BACKUP_KEY),
    bytes,
    "original never rotates, even on another import",
  );
});

test("file import retains exact original 1.0 bytes even without a browser primary", () => {
  const bytes = " \n" + legacyFile(fixtureFiles[1]);
  const imported = importGame(bytes);
  const disk = storage();
  assert.equal(saveGame(imported.state, disk).ok, true);
  assert.equal(disk.getItem(ORIGINAL_V1_BACKUP_KEY), bytes);
  assert.deepEqual(loadGame(disk).state, imported.state);
});

test("legacy state export and direct save both produce validated 2.0 envelopes", () => {
  const state = originalState(legacyFile());
  const before = structuredClone(state);
  const exported = exportGame(state);
  assert.equal(JSON.parse(exported).version, 2);
  assert.deepEqual(importGame(exported).state, migrateState(state));
  const disk = storage();
  assert.equal(saveGame(state, disk).ok, true);
  assert.equal(JSON.parse(disk.getItem(ORIGINAL_V1_BACKUP_KEY)).version, 1);
  assert.deepEqual(originalState(disk.getItem(ORIGINAL_V1_BACKUP_KEY)), state);
  assert.deepEqual(state, before);
});

test("original-backup quota failure prevents any overwrite of existing 1.0 progress", () => {
  for (const silentlyDrop of [false, true]) {
    const disk = storage();
    const bytes = legacyFile();
    disk.setItem(SAVE_KEY, bytes);
    disk.setItem(BACKUP_KEY, legacyFile(fixtureFiles[0]));
    const before = new Map(disk.map);
    const setItem = disk.setItem;
    disk.setItem = (key, value) => {
      if (key === ORIGINAL_V1_BACKUP_KEY) {
        if (silentlyDrop) return;
        throw new Error("QuotaExceededError");
      }
      setItem(key, value);
    };
    assert.equal(saveGame(loadGame(disk).state, disk).ok, false);
    assert.deepEqual(disk.map, before, "backup durability is required before primary can change");
  }
});

test("a damaged immutable original is not overwritten or used to justify destroying old primary", () => {
  const disk = storage();
  disk.setItem(SAVE_KEY, legacyFile());
  disk.setItem(ORIGINAL_V1_BACKUP_KEY, "broken original");
  const before = new Map(disk.map);
  assert.equal(saveGame(loadGame(disk).state, disk).ok, false);
  assert.deepEqual(disk.map, before);
});

test("corrupt primary and rotating backup recover immutable original through migration", () => {
  const bytes = legacyFile();
  const disk = storage();
  disk.setItem(SAVE_KEY, bytes);
  assert.equal(saveGame(loadGame(disk).state, disk).ok, true);
  assert.equal(saveGame(createGame({ seed: 3 }), disk).ok, true);
  disk.setItem(SAVE_KEY, "truncated primary");
  disk.setItem(BACKUP_KEY, "truncated rotating backup");
  const loaded = loadGame(disk);
  assert.equal(loaded.sourceVersion, 1);
  assert.match(loaded.message, /özgün 1.0/);
  assert.deepEqual(loaded.state, migrateState(originalState(bytes)));
  assert.equal(saveGame(loaded.state, disk).ok, true);
  assert.equal(disk.getItem(ORIGINAL_V1_BACKUP_KEY), bytes);
  assert.deepEqual(loadGame(disk).state, loaded.state);
});

test("legacy rotating recovery is archived before the first 2.0 write", () => {
  const bytes = legacyFile();
  const disk = storage();
  disk.setItem(SAVE_KEY, "corrupt");
  disk.setItem(BACKUP_KEY, bytes);
  const loaded = loadGame(disk);
  assert.equal(loaded.migrated, true);
  assert.equal(saveGame(loaded.state, disk).ok, true);
  assert.equal(disk.getItem(BACKUP_KEY), bytes);
  assert.equal(disk.getItem(ORIGINAL_V1_BACKUP_KEY), bytes);
});

test("checksums, envelope schema and payload version must agree before migration", () => {
  const bytes = legacyFile();
  const original = originalState(bytes);
  const envelope = JSON.parse(bytes);
  for (const invalid of [
    { ...envelope, checksum: "00000000" },
    { ...envelope, payload: envelope.payload.replace("Uyumluluk", "Değişmiş") },
    { ...envelope, version: 2 },
    { ...envelope, extra: "must not be accepted" },
    { ...envelope, checksum: null },
    { ...envelope, payload: original },
  ])
    assert.equal(importGame(JSON.stringify(invalid)).state, null);
  assert.equal(importGame(envelopeFor(createGame(), 1)).state, null);
  assert.equal(importGame(envelopeFor(original, 2)).state, null);
  for (const invalid of [null, [], "state", { ...original, version: 3 }]) {
    assert.equal(importGame(envelopeFor(invalid, 1)).state, null);
    assert.throws(() => migrateState(invalid));
  }
});

test("invalid legacy state cannot be repaired into a valid game by migration defaults", () => {
  for (const mutate of [
    (state) => {
      delete state.npcs.ece;
    },
    (state) => {
      state.cash = -1;
    },
    (state) => {
      state.deep = {};
    },
    (state) => {
      state.stories = {};
    },
    (state) => {
      state.version = 2;
    },
    (state) => {
      state.player.skills.technical = "25";
    },
    (state) => {
      state.job.payDay = -10;
    },
  ]) {
    const original = originalState(legacyFile());
    mutate(original);
    const before = structuredClone(original);
    assert.equal(validateState(original), false);
    assert.throws(() => migrateState(original));
    assert.equal(importGame(envelopeFor(original)).state, null);
    assert.deepEqual(original, before);
  }
});

test("failed backup or primary writes retain a usable recovery record", () => {
  for (const failKey of [BACKUP_KEY, SAVE_KEY]) {
    const disk = storage();
    const first = createGame({ seed: 61 });
    assert.equal(saveGame(first, disk).ok, true);
    const before = disk.getItem(SAVE_KEY);
    const setItem = disk.setItem;
    disk.setItem = (key, value) => {
      if (key === failKey) throw new Error("QuotaExceededError");
      setItem(key, value);
    };
    assert.equal(saveGame(createGame({ seed: 62 }), disk).ok, false);
    assert.equal(disk.getItem(SAVE_KEY), before);
    assert.deepEqual(loadGame(disk).state, first);
  }
});

test("prototype-bearing and excessively nested imported data fail closed", () => {
  for (const version of [1, 2]) {
    const state = version === 1 ? originalState(legacyFile()) : createGame();
    state.inventory = JSON.parse('{"phone":1,"__proto__":{"polluted":true}}');
    assert.equal(importGame(envelopeFor(state)).state, null);
  }
  assert.equal({}.polluted, undefined);
  const state = createGame();
  let nested = state;
  for (let i = 0; i < 20; i++) {
    nested.extra = {};
    nested = nested.extra;
  }
  assert.equal(importGame(envelopeFor(state)).state, null);
});

test("2.0 malformed deep fields are rejected rather than replaced with defaults", () => {
  for (const mutate of [
    (state) => {
      delete state.deep;
    },
    (state) => {
      delete state.stories;
    },
    (state) => {
      state.deep.version = 88;
    },
    (state) => {
      state.deep.finance.reserve = -1;
    },
    (state) => {
      state.deep.finance.autoPay = "true";
    },
    (state) => {
      state.deep.finance.debtPlan = { weeklyPayment: -5, nextDay: 8, missed: 0 };
    },
    (state) => {
      delete state.deep.npcs.ece;
    },
    (state) => {
      state.deep.npcs.ece.cash = "1000";
    },
    (state) => {
      state.deep.npcs.ece.employment = "invented";
    },
    (state) => {
      state.deep.npcs.ece.respect = 101;
    },
    (state) => {
      state.deep.npcs.ece.knownFacts = [{ id: "job", value: "retail", day: -1, source: "player" }];
    },
    (state) => {
      state.deep.npcs.ece.ties.ghost = 90;
    },
    (state) => {
      state.deep.career.reputation = -1;
    },
    (state) => {
      state.deep.business = { id: "invented", revenue: 100000 };
    },
    (state) => {
      state.deep.freelance.active = { id: "invented", dueDay: 8, sessions: 2, acceptedDay: 1 };
    },
    (state) => {
      state.deep.promises = [
        { id: "p1", npcId: "ghost", kind: "help", dueDay: 8, status: "pending", amount: 0 },
      ];
    },
    (state) => {
      state.deep.routine.budgetFloor = -100;
    },
    (state) => {
      state.deep.routine.settings.work = "yes";
    },
    (state) => {
      state.deep.unknownField = 100;
    },
  ]) {
    const state = createGame({ seed: 115 });
    mutate(state);
    const before = structuredClone(state);
    assert.equal(validateState(state), false, String(mutate));
    assert.throws(() => migrateState(state));
    assert.throws(() => exportGame(state));
    assert.equal(importGame(envelopeFor(state)).state, null);
    assert.deepEqual(state, before, "rejected records are not repaired in place");
  }
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
