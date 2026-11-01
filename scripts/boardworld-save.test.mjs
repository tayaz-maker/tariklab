import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as originalV1Persistence from "./fixtures/boardworld/v1-persistence.mjs";
import * as originalV2Persistence from "./fixtures/boardworld/v2-persistence.mjs";
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
  LEGACY_SAVE_KEY,
  LEGACY_BACKUP_KEY,
  LEGACY_V2_SAVE_KEY,
  LEGACY_V2_BACKUP_KEY,
  ORIGINAL_V2_BACKUP_KEY,
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
    encoded.replace('"version":3', '"version":8'),
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
  delete result.calendar;
  delete result.city;
  delete result.living;
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
    assert.equal(result.state.version, 3);
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

test("new exports and canonical slots use version 3 while old compatibility keys remain readable", () => {
  assert.equal(SAVE_KEY, "tariklab.boardworld.v3");
  assert.equal(BACKUP_KEY, "tariklab.boardworld.v3.backup");
  assert.equal(LEGACY_V2_SAVE_KEY, "tariklab.boardworld.v2");
  assert.equal(LEGACY_V2_BACKUP_KEY, "tariklab.boardworld.v2.backup");
  assert.equal(ORIGINAL_V2_BACKUP_KEY, "tariklab.boardworld.v2.original-v2");
  assert.equal(LEGACY_SAVE_KEY, "tariklab.boardworld.v1");
  assert.equal(LEGACY_BACKUP_KEY, "tariklab.boardworld.v1.backup");
  assert.equal(ORIGINAL_V1_BACKUP_KEY, "tariklab.boardworld.v1.original-v1");
  const state = createGame({ seed: 761 });
  const bytes = exportGame(state);
  assert.equal(JSON.parse(bytes).version, 3);
  assert.equal(importGame(bytes).sourceVersion, 3);
  assert.equal(importGame(bytes).migrated, false);
  assert.deepEqual(importGame(bytes).state, state);
});

test("frozen 1.0 persistence keeps its original writer, parser and checksum bytes", () => {
  const provenance = JSON.parse(
    readFileSync(new URL("./fixtures/boardworld/v1-provenance.json", import.meta.url), "utf8"),
  );
  const source = readFileSync(
    new URL("./fixtures/boardworld/v1-persistence.mjs", import.meta.url),
    "utf8",
  );
  const normalized = source.replace(
    'from "../../../public/games/tc-sim-boardworld/engine.mjs";',
    'from "./engine.mjs";',
  );
  const hash = createHash("sha256").update(normalized).digest("hex");
  assert.equal(hash, "cdfb22cdf5b9b78faddae52a58196fe5a326f2986e032c7c60ff1b67074ac8f1");
  assert.equal(hash, provenance.persistenceFixture.originalSha256);
  assert.equal(provenance.commit, "977cd576dc535f1e65d2e5589e8d4168a65a8e17");
  assert.equal(originalV1Persistence.SAVE_KEY, LEGACY_SAVE_KEY);
  assert.equal(originalV1Persistence.BACKUP_KEY, LEGACY_BACKUP_KEY);
  assert.equal(
    originalV1Persistence.importGame(exportGame(createGame())).state,
    null,
    "real old reader cannot understand the new envelope",
  );
});

function resolveChecked(state, id) {
  const result = resolveAction(state, id);
  assert.equal(result.ok, true, result.message);
  return result.state;
}

test("real frozen 1.0 writer cannot destroy canonical 3.0 progress or its backup", () => {
  const disk = storage();
  const oldCached = originalState(legacyFile());
  assert.equal(originalV1Persistence.saveGame(oldCached, disk).ok, true);
  let modern = loadGame(disk).state;
  assert.deepEqual(
    importGame(disk.getItem(SAVE_KEY)).state,
    modern,
    "first load protects before any user action",
  );
  modern = resolveChecked(modern, "finance:reserve:500");
  assert.equal(saveGame(modern, disk).ok, true);
  modern = resolveChecked(modern, "finance:reserve:2000");
  assert.equal(saveGame(modern, disk).ok, true);
  const primary = disk.getItem(SAVE_KEY);
  const backup = disk.getItem(BACKUP_KEY);
  const original = disk.getItem(ORIGINAL_V1_BACKUP_KEY);
  assert.equal(modern.deep.finance.reserve, 2500);
  for (let i = 0; i < 4; i++) {
    // Model a still-open 1.0 tab with a later valid local revision. Its actual
    // production writer decides which legacy slot to rotate and overwrite.
    oldCached.revision = modern.revision + 50 + i;
    oldCached.time += 60;
    assert.equal(validateState(oldCached), true);
    assert.equal(originalV1Persistence.saveGame(oldCached, disk).ok, true);
    assert.equal(disk.getItem(SAVE_KEY), primary);
    assert.equal(disk.getItem(BACKUP_KEY), backup);
    assert.equal(disk.getItem(ORIGINAL_V1_BACKUP_KEY), original);
    assert.deepEqual(
      loadGame(disk).state,
      modern,
      "higher legacy revision cannot roll the new tab back",
    );
  }
  assert.equal(JSON.parse(disk.getItem(LEGACY_SAVE_KEY)).version, 1);
  assert.equal(JSON.parse(disk.getItem(LEGACY_BACKUP_KEY)).version, 1);
  assert.equal(disk.map.get("tariklab::tc-sim:1"), "legacy-do-not-touch");
});

test("an early 2.0 envelope at the old key is protected immediately before a stale tab can overwrite it", () => {
  const disk = storage();
  const earlyBytes = legacyFile("v2-progressed-restart-day46.json");
  const current = migrateState(originalState(earlyBytes));
  const legacyBackup = legacyFile();
  disk.setItem(LEGACY_SAVE_KEY, earlyBytes);
  disk.setItem(LEGACY_BACKUP_KEY, legacyBackup);
  const loaded = loadGame(disk);
  assert.equal(loaded.protected, true);
  assert.equal(loaded.sourceVersion, 2);
  assert.equal(loaded.sourceKey, LEGACY_SAVE_KEY);
  assert.deepEqual(loaded.state, current);
  assert.deepEqual(importGame(disk.getItem(SAVE_KEY)).state, current);
  assert.equal(disk.getItem(ORIGINAL_V2_BACKUP_KEY), earlyBytes);
  assert.equal(disk.getItem(LEGACY_SAVE_KEY), earlyBytes);
  assert.equal(disk.getItem(LEGACY_BACKUP_KEY), legacyBackup);
  assert.equal(disk.getItem(ORIGINAL_V1_BACKUP_KEY), legacyBackup);
  assert.equal(originalV1Persistence.saveGame(originalState(legacyBackup), disk).ok, true);
  assert.deepEqual(loadGame(disk).state, current);
});

test("healthy canonical backup wins over higher-revision legacy data when the primary is corrupt or mislabeled", () => {
  const disk = storage();
  let original = resolveChecked(createGame({ seed: 81 }), "event:welcome:work");
  original = resolveChecked(original, "finance:reserve:500");
  saveGame(original, disk);
  const latest = resolveChecked(original, "finance:reserve:2000");
  saveGame(latest, disk);
  const stale = originalState(legacyFile());
  stale.revision = 9999;
  originalV1Persistence.saveGame(stale, disk);
  for (const badPrimary of ["truncated", originalV1Persistence.exportGame(stale)]) {
    disk.setItem(SAVE_KEY, badPrimary);
    const before = new Map(disk.map);
    const loaded = loadGame(disk);
    assert.equal(loaded.sourceKey, BACKUP_KEY);
    assert.deepEqual(loaded.state, original);
    assert.deepEqual(
      disk.map,
      before,
      "healthy canonical recovery never touches legacy or rotates slots on read",
    );
  }
});

test("two corrupt canonical slots explicitly recover an older legacy copy and protect it separately", () => {
  const disk = storage();
  const bytes = legacyFile();
  disk.setItem(SAVE_KEY, "broken primary");
  disk.setItem(BACKUP_KEY, "broken backup");
  disk.setItem(LEGACY_SAVE_KEY, bytes);
  const loaded = loadGame(disk);
  assert.equal(loaded.protected, true);
  assert.equal(loaded.sourceKey, LEGACY_SAVE_KEY);
  assert.match(loaded.message, /son 3\.0 adımların bu kopyada bulunmayabilir/);
  assert.deepEqual(loaded.state, migrateState(originalState(bytes)));
  assert.deepEqual(importGame(disk.getItem(SAVE_KEY)).state, loaded.state);
  assert.equal(disk.getItem(LEGACY_SAVE_KEY), bytes);
});

test("quota during canonical promotion preserves old slots and clearly reports that protection failed", () => {
  const disk = storage();
  const primary = legacyFile();
  const backup = legacyFile(fixtureFiles[0]);
  disk.setItem(LEGACY_SAVE_KEY, primary);
  disk.setItem(LEGACY_BACKUP_KEY, backup);
  const setItem = disk.setItem;
  disk.setItem = (key, value) => {
    if (key === SAVE_KEY) throw new Error("QuotaExceededError");
    setItem(key, value);
  };
  const loaded = loadGame(disk);
  assert.ok(loaded.state);
  assert.equal(loaded.protected, false);
  assert.match(loaded.message, /ayrı 3\.0 kaydı yazılamadı/);
  assert.equal(disk.getItem(SAVE_KEY), null);
  assert.equal(disk.getItem(LEGACY_SAVE_KEY), primary);
  assert.equal(disk.getItem(LEGACY_BACKUP_KEY), backup);
  assert.equal(disk.getItem(ORIGINAL_V1_BACKUP_KEY), primary);
});

test("healthy canonical loads and later saves ignore unrelated corrupt legacy and original slots", () => {
  const disk = storage();
  let current = createGame({ seed: 101 });
  saveGame(current, disk);
  disk.setItem(LEGACY_SAVE_KEY, "broken old primary");
  disk.setItem(LEGACY_BACKUP_KEY, "broken old backup");
  disk.setItem(ORIGINAL_V1_BACKUP_KEY, "broken old archive");
  disk.setItem(LEGACY_V2_SAVE_KEY, "broken second primary");
  disk.setItem(LEGACY_V2_BACKUP_KEY, "broken second backup");
  disk.setItem(ORIGINAL_V2_BACKUP_KEY, "broken second archive");
  const setItem = disk.setItem;
  disk.setItem = () => {
    throw new Error("healthy read must not write");
  };
  assert.deepEqual(loadGame(disk).state, current);
  disk.setItem = setItem;
  current = resolveChecked(current, "event:welcome:work");
  assert.equal(saveGame(current, disk).ok, true);
  assert.deepEqual(loadGame(disk).state, current);
  assert.equal(disk.getItem(LEGACY_SAVE_KEY), "broken old primary");
  assert.equal(disk.getItem(LEGACY_BACKUP_KEY), "broken old backup");
  assert.equal(disk.getItem(ORIGINAL_V1_BACKUP_KEY), "broken old archive");
  assert.equal(disk.getItem(LEGACY_V2_SAVE_KEY), "broken second primary");
  assert.equal(disk.getItem(LEGACY_V2_BACKUP_KEY), "broken second backup");
  assert.equal(disk.getItem(ORIGINAL_V2_BACKUP_KEY), "broken second archive");
});

test("explicit v1 file import into an existing v3 life still preserves the imported original bytes", () => {
  const disk = storage();
  saveGame(createGame(), disk);
  const bytes = legacyFile();
  const imported = importGame(bytes);
  assert.equal(saveGame(imported.state, disk).ok, true);
  assert.equal(disk.getItem(ORIGINAL_V1_BACKUP_KEY), bytes);
  assert.deepEqual(loadGame(disk).state, imported.state);
});

test("first 1.0 load verifies immutable original bytes and promotes without writing legacy slots", () => {
  const bytes = legacyFile();
  const disk = storage();
  disk.setItem(LEGACY_SAVE_KEY, bytes);
  const writes = [];
  const setItem = disk.setItem;
  disk.setItem = (key, value) => {
    writes.push(key);
    setItem(key, value);
  };
  const loaded = loadGame(disk);
  assert.equal(disk.getItem(LEGACY_SAVE_KEY), bytes, "promotion never overwrites legacy primary");
  assert.deepEqual(writes, [ORIGINAL_V1_BACKUP_KEY, SAVE_KEY]);
  assert.equal(loaded.protected, true);
  assert.equal(disk.getItem(BACKUP_KEY), null);
  assert.equal(saveGame(loaded.state, disk).ok, true);
  assert.deepEqual(writes, [ORIGINAL_V1_BACKUP_KEY, SAVE_KEY, BACKUP_KEY, SAVE_KEY]);
  assert.equal(disk.getItem(ORIGINAL_V1_BACKUP_KEY), bytes);
  assert.deepEqual(importGame(disk.getItem(BACKUP_KEY)).state, loaded.state);
  assert.equal(JSON.parse(disk.getItem(SAVE_KEY)).version, 3);
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

test("legacy state export and direct save both produce validated 3.0 envelopes", () => {
  const state = originalState(legacyFile());
  const before = structuredClone(state);
  const exported = exportGame(state);
  assert.equal(JSON.parse(exported).version, 3);
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
    disk.setItem(LEGACY_SAVE_KEY, bytes);
    disk.setItem(LEGACY_BACKUP_KEY, legacyFile(fixtureFiles[0]));
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
  disk.setItem(LEGACY_SAVE_KEY, legacyFile());
  disk.setItem(ORIGINAL_V1_BACKUP_KEY, "broken original");
  const before = new Map(disk.map);
  assert.equal(saveGame(loadGame(disk).state, disk).ok, false);
  assert.deepEqual(disk.map, before);
});

test("corrupt primary and rotating backup recover immutable original through migration", () => {
  const bytes = legacyFile();
  const disk = storage();
  disk.setItem(LEGACY_SAVE_KEY, bytes);
  assert.equal(saveGame(loadGame(disk).state, disk).ok, true);
  assert.equal(saveGame(createGame({ seed: 3 }), disk).ok, true);
  disk.setItem(SAVE_KEY, "truncated primary");
  disk.setItem(BACKUP_KEY, "truncated rotating backup");
  disk.setItem(LEGACY_SAVE_KEY, "truncated legacy primary");
  disk.setItem(LEGACY_BACKUP_KEY, "truncated legacy backup");
  const loaded = loadGame(disk);
  assert.equal(loaded.sourceVersion, 1);
  assert.match(loaded.message, /özgün 1.0/);
  assert.deepEqual(loaded.state, migrateState(originalState(bytes)));
  assert.equal(saveGame(loaded.state, disk).ok, true);
  assert.equal(disk.getItem(ORIGINAL_V1_BACKUP_KEY), bytes);
  assert.deepEqual(loadGame(disk).state, loaded.state);
});

test("legacy rotating recovery is archived before the first 3.0 write", () => {
  const bytes = legacyFile();
  const disk = storage();
  disk.setItem(LEGACY_SAVE_KEY, "corrupt");
  disk.setItem(LEGACY_BACKUP_KEY, bytes);
  const loaded = loadGame(disk);
  assert.equal(loaded.migrated, true);
  assert.equal(saveGame(loaded.state, disk).ok, true);
  assert.equal(disk.getItem(LEGACY_SAVE_KEY), "corrupt");
  assert.equal(disk.getItem(LEGACY_BACKUP_KEY), bytes);
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
  for (const version of [1, 2, 3]) {
    const state =
      version === 1
        ? originalState(legacyFile())
        : version === 2
          ? originalState(legacyFile("v2-fresh-restart.json"))
          : createGame();
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
    const state = originalState(legacyFile("v2-fresh-restart.json"));
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

const v2Provenance = JSON.parse(legacyFile("v2-provenance.json"));
function v2Fields(state) {
  const result = structuredClone(state);
  for (const field of ["version", "calendar", "city", "living"]) delete result[field];
  return result;
}
for (const fixture of v2Provenance.fixtures)
  test(`real 2.0 ${fixture.file} migrates purely without losing earned history or replaying money`, () => {
    const bytes = legacyFile(fixture.file);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), fixture.sha256);
    const original = originalState(bytes),
      before = structuredClone(original);
    assert.equal(original.version, 2);
    assert.equal(validateState(original), true);
    const loaded = importGame(bytes);
    assert.equal(loaded.sourceVersion, 2);
    assert.equal(loaded.migrated, true);
    assert.equal(loaded.state.version, 3);
    assert.equal(validateState(loaded.state), true);
    assert.deepEqual(v2Fields(loaded.state), v2Fields(original));
    for (const old of original.appointments) {
      const matches = loaded.state.calendar.entries.filter(
        (entry) => entry.npcId === old.npcId && entry.start === (old.day - 1) * 1440 + old.minute,
      );
      assert.equal(matches.length, 1);
      assert.equal(matches[0].status, old.status === "scheduled" ? "confirmed" : old.status);
      assert.equal(matches[0].end - matches[0].start, 60);
      assert.equal(matches[0].district, old.location);
    }
    assert.deepEqual(original, before);
    assert.deepEqual(migrateState(original), loaded.state);
    assert.deepEqual(migrateState(loaded.state), loaded.state);
    assert.deepEqual(importGame(bytes).state, loaded.state);
    assert.deepEqual(importGame(exportGame(loaded.state)).state, loaded.state);
    assert.equal(getClock(loaded.state).day, fixture.day);
    if (fixture.file.includes("progressed")) {
      assert.ok(original.job.shifts >= 30, "progress was earned through real work");
      assert.ok(original.transactions.length > 20);
      assert.ok(Object.values(original.stories).some((chain) => chain.history.length));
    }
    const disk = storage();
    disk.setItem(LEGACY_V2_SAVE_KEY, bytes);
    const protectedLoad = loadGame(disk);
    assert.equal(protectedLoad.protected, true);
    assert.equal(disk.getItem(ORIGINAL_V2_BACKUP_KEY), bytes);
    assert.equal(disk.getItem(LEGACY_V2_SAVE_KEY), bytes);
    assert.deepEqual(loadGame(disk).state, loaded.state);
  });

test("v2 writer is exact production code apart from its documented engine import path", () => {
  const source = legacyFile("v2-persistence.mjs").replace(
    'from "../../../public/games/tc-sim-boardworld/engine.mjs";',
    'from "./engine.mjs";',
  );
  const hash = createHash("sha256").update(source).digest("hex");
  assert.equal(hash, "102f47418039047994a86639fa6d9376dd1bf689729775530f331880b1f59c7e");
  assert.equal(hash, v2Provenance.persistenceFixture.originalSha256);
  assert.equal(v2Provenance.commit, "467ef16e9f06ea3089f001592aa13aebd9cc069d");
  assert.equal(originalV2Persistence.SAVE_KEY, LEGACY_V2_SAVE_KEY);
  assert.equal(originalV2Persistence.BACKUP_KEY, LEGACY_V2_BACKUP_KEY);
  const original = originalState(legacyFile("v2-active-appointment-day1.json"));
  assert.deepEqual(
    originalV2Persistence.importGame(originalV2Persistence.exportGame(original)).state,
    original,
  );
  assert.equal(originalV2Persistence.importGame(exportGame(createGame())).state, null);
});

test("first v2 load is protected before any player action or still-open old tab write", () => {
  const disk = storage(),
    bytes = legacyFile("v2-progressed-restart-day46.json");
  disk.setItem(LEGACY_V2_SAVE_KEY, bytes);
  const loaded = loadGame(disk);
  assert.equal(loaded.protected, true);
  const canonical = disk.getItem(SAVE_KEY);
  assert.ok(canonical);
  const stale = originalState(legacyFile("v2-progressed-restart-day91.json"));
  assert.equal(originalV2Persistence.saveGame(stale, disk).ok, true);
  assert.equal(disk.getItem(SAVE_KEY), canonical);
  assert.equal(disk.getItem(ORIGINAL_V2_BACKUP_KEY), bytes);
  assert.deepEqual(loadGame(disk).state, loaded.state);
});

test("real still-open 1.0 and 2.0 writers cannot overwrite v3 progress, backups or UI storage key", () => {
  const disk = storage();
  const v1 = originalState(legacyFile());
  const v2 = originalState(legacyFile("v2-progressed-restart-day46.json"));
  assert.equal(originalV1Persistence.saveGame(v1, disk).ok, true);
  assert.equal(originalV2Persistence.saveGame(v2, disk).ok, true);
  const v2Bytes = disk.getItem(LEGACY_V2_SAVE_KEY);
  let current = loadGame(disk).state;
  current = resolveChecked(current, "finance:reserve:500");
  assert.equal(saveGame(current, disk).ok, true);
  current = resolveChecked(current, "finance:reserve:2000");
  assert.equal(saveGame(current, disk).ok, true);
  const protectedKeys = [SAVE_KEY, BACKUP_KEY, ORIGINAL_V1_BACKUP_KEY, ORIGINAL_V2_BACKUP_KEY];
  const protectedBytes = protectedKeys.map((key) => disk.getItem(key));
  assert.equal(disk.getItem(ORIGINAL_V2_BACKUP_KEY), v2Bytes);
  assert.ok(protectedBytes.every(Boolean));
  for (let i = 0; i < 4; i++) {
    for (const [writer, cache] of [
      [originalV1Persistence, v1],
      [originalV2Persistence, v2],
    ]) {
      cache.revision = current.revision + 100 + i;
      assert.equal(validateState(cache), true);
      assert.equal(writer.saveGame(cache, disk).ok, true);
      assert.deepEqual(
        protectedKeys.map((key) => disk.getItem(key)),
        protectedBytes,
      );
      assert.deepEqual(loadGame(disk).state, current);
    }
  }
  assert.equal(current.deep.finance.reserve, 2500);
  assert.equal(disk.getItem("tariklab::tc-sim:1"), "legacy-do-not-touch");
});

test("a canonical v3 backup has priority over any valid v2 primary or v2 immutable archive", () => {
  const disk = storage();
  const first = createGame({ seed: 174 }),
    next = resolveChecked(first, "event:welcome:work");
  saveGame(first, disk);
  saveGame(next, disk);
  const bytes = legacyFile("v2-progressed-restart-day91.json");
  disk.setItem(LEGACY_V2_SAVE_KEY, bytes);
  disk.setItem(ORIGINAL_V2_BACKUP_KEY, bytes);
  for (const corrupt of ["damaged", bytes]) {
    disk.setItem(SAVE_KEY, corrupt);
    const before = new Map(disk.map),
      loaded = loadGame(disk);
    assert.equal(loaded.sourceKey, BACKUP_KEY);
    assert.deepEqual(loaded.state, first);
    assert.deepEqual(disk.map, before);
  }
});

test("both corrupt v3 slots recover v2 backup then immutable original, never changing old storage", () => {
  for (const source of [LEGACY_V2_BACKUP_KEY, ORIGINAL_V2_BACKUP_KEY]) {
    const disk = storage(),
      bytes = legacyFile("v2-active-appointment-day1.json");
    disk.setItem(SAVE_KEY, "broken");
    disk.setItem(BACKUP_KEY, "broken");
    disk.setItem(LEGACY_V2_SAVE_KEY, "broken");
    disk.setItem(source, bytes);
    const loaded = loadGame(disk);
    assert.equal(loaded.protected, true);
    assert.equal(loaded.sourceKey, source);
    assert.equal(loaded.sourceVersion, 2);
    assert.deepEqual(loaded.state, migrateState(originalState(bytes)));
    assert.equal(disk.getItem(source), bytes);
    assert.equal(disk.getItem(LEGACY_V2_SAVE_KEY), "broken");
    assert.equal(disk.getItem(ORIGINAL_V2_BACKUP_KEY), bytes);
    assert.match(
      loaded.message,
      source === ORIGINAL_V2_BACKUP_KEY ? /özgün 2\.0/ : /son 3\.0 adımların/,
    );
  }
});

test("v2 migration is never reported protected when archive or canonical writes fail", () => {
  for (const failKey of [ORIGINAL_V2_BACKUP_KEY, SAVE_KEY])
    for (const silent of [false, true]) {
      const disk = storage(),
        bytes = legacyFile("v2-progressed-restart-day91.json");
      disk.setItem(LEGACY_V2_SAVE_KEY, bytes);
      const set = disk.setItem;
      disk.setItem = (key, value) => {
        if (key === failKey) {
          if (silent) return;
          throw new Error("QuotaExceededError");
        }
        set(key, value);
      };
      const loaded = loadGame(disk);
      assert.ok(loaded.state);
      assert.equal(loaded.protected, false);
      assert.match(loaded.message, /ayrı 3\.0 kaydı yazılamadı/);
      assert.equal(disk.getItem(SAVE_KEY), null);
      assert.equal(disk.getItem(LEGACY_V2_SAVE_KEY), bytes);
    }
});

test("v2 file import archives exact bytes and cannot silently repair a corrupt immutable archive", () => {
  const bytes = " \n" + legacyFile("v2-fresh-graduate.json");
  const disk = storage();
  saveGame(createGame(), disk);
  const imported = importGame(bytes);
  assert.equal(saveGame(imported.state, disk).ok, true);
  assert.equal(disk.getItem(ORIGINAL_V2_BACKUP_KEY), bytes);
  const current = loadGame(disk).state;
  disk.setItem(ORIGINAL_V2_BACKUP_KEY, "corrupt archive");
  assert.equal(
    saveGame(current, disk).ok,
    true,
    "ordinary canonical saves ignore unrelated old archive corruption",
  );
  const before = new Map(disk.map);
  assert.equal(saveGame(importGame(bytes).state, disk).ok, false);
  assert.deepEqual(disk.map, before, "explicit reimport cannot claim durable original protection");
});

test("legacy 2.0 appointment keeps its original timing, identity and status during calendar migration", () => {
  const bytes = legacyFile("v2-active-appointment-day1.json");
  const original = originalState(bytes),
    migrated = importGame(bytes).state;
  assert.deepEqual(migrated.appointments, original.appointments, "legacy evidence remains intact");
  const old = original.appointments.find((entry) => entry.status === "scheduled");
  assert.ok(old);
  const entries = migrated.calendar.entries.filter(
    (entry) => entry.npcId === old.npcId && entry.start === (old.day - 1) * 1440 + old.minute,
  );
  assert.equal(entries.length, 1, "one legacy booking produces one commitment");
  assert.equal(entries[0].status, "confirmed");
  assert.equal(entries[0].end - entries[0].start, 60);
  assert.equal(entries[0].district, old.location);
  assert.ok(entries[0].legacy);
  assert.deepEqual(
    migrateState(migrated),
    migrated,
    "second migration cannot duplicate the booking",
  );
});

test("tampered real v2 envelopes and malformed v3 namespaces are rejected before migration defaults", () => {
  const bytes = legacyFile("v2-active-appointment-day1.json"),
    envelope = JSON.parse(bytes);
  for (const invalid of [
    { ...envelope, checksum: "00000000" },
    { ...envelope, version: 3 },
    { ...envelope, unexpected: true },
  ])
    assert.equal(importGame(JSON.stringify(invalid)).state, null);
  for (const key of ["calendar", "city", "living"])
    for (const bad of [null, {}, { invented: true }]) {
      const state = createGame();
      state[key] = bad;
      const before = structuredClone(state);
      assert.equal(validateState(state), false);
      assert.throws(() => migrateState(state));
      assert.equal(importGame(envelopeFor(state)).state, null);
      assert.deepEqual(state, before);
    }
  for (const key of ["calendar", "city", "living"]) {
    const legacy = originalState(bytes);
    legacy[key] = {};
    assert.equal(validateState(legacy), false, "v2 input cannot smuggle unvalidated v3 fields");
    assert.throws(() => migrateState(legacy));
  }
});
