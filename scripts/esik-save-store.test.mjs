import assert from "node:assert/strict";
import test from "node:test";
import { KEY, apply, createCoast, deserialize, serialize } from "../public/games/esik/sim.js";
import { BACKUP_KEY, RECOVERY_PREFIX, RECOVERY_SLOTS, loadCoastSave, saveCoastSave } from "../public/games/esik/save-store.js";

function memory(entries = [], fails = () => false) {
  const data = new Map(entries);
  const writes = [];
  return {
    data, writes,
    getItem(key) { if (fails("read", key)) throw new Error("storage unavailable"); return data.get(key) ?? null; },
    setItem(key, value) {
      if (fails("write", key)) throw new Error("quota exceeded");
      writes.push({ key, value }); data.set(key, value);
    },
  };
}
const coast = apply(createCoast(3), "bagla:merdiven");
const valid = serialize(coast);
const incomplete = JSON.parse(valid);
delete incomplete.state.ramps;
const corrupt = JSON.stringify(incomplete);

test("loading corrupt primary restores a valid backup without any storage mutation", () => {
  const store = memory([[KEY, corrupt], [BACKUP_KEY, valid]]);
  assert.deepEqual(loadCoastSave(store), { state: coast, status: "backup" });
  assert.equal(store.getItem(KEY), corrupt);
  assert.deepEqual(store.writes, []);
  const next = apply(coast, "rampa:merdiven");
  assert.deepEqual(saveCoastSave(store, next), { ok: true, status: "preserved" });
  assert.equal(store.getItem(`${RECOVERY_PREFIX}0`), corrupt);
  assert.equal(store.getItem(BACKUP_KEY), valid);
  assert.deepEqual(deserialize(store.getItem(KEY)), next);
  assert.deepEqual(loadCoastSave(store), { state: next, status: "loaded" });
});

test("unreadable primary and backup bytes survive separately before a fresh coast can save", () => {
  const store = memory([[KEY, corrupt], [BACKUP_KEY, "broken backup"]]);
  assert.deepEqual(loadCoastSave(store), { state: null, status: "invalid" });
  const fresh = createCoast(9);
  assert.equal(saveCoastSave(store, fresh).ok, true);
  assert.equal(store.getItem(`${RECOVERY_PREFIX}0`), corrupt);
  assert.equal(store.getItem(`${RECOVERY_PREFIX}1`), "broken backup");
  assert.deepEqual(deserialize(store.getItem(BACKUP_KEY)), fresh);
  assert.deepEqual(deserialize(store.getItem(KEY)), fresh);
});

test("quota failure preserving corrupt bytes blocks replacement and retains a good backup", () => {
  const store = memory([[KEY, corrupt], [BACKUP_KEY, valid]], (op, key) => op === "write" && key.startsWith(RECOVERY_PREFIX));
  assert.equal(loadCoastSave(store).status, "backup");
  assert.deepEqual(saveCoastSave(store, apply(coast, "rampa:merdiven")), { ok: false, status: "blocked" });
  assert.equal(store.getItem(KEY), corrupt);
  assert.equal(store.getItem(BACKUP_KEY), valid);
  assert.deepEqual(store.writes, []);
});

test("quota failures writing backup or primary never replace the previous primary", () => {
  for (const key of [BACKUP_KEY, KEY]) {
    const store = memory([[KEY, valid]], (op, candidate) => op === "write" && candidate === key);
    assert.equal(saveCoastSave(store, apply(coast, "rampa:merdiven")).ok, false);
    assert.equal(store.getItem(KEY), valid);
  }
});

test("a full recovery area blocks writes without deleting or replacing stored records", () => {
  const entries = [[KEY, corrupt], [BACKUP_KEY, valid]];
  for (let i = 0; i < RECOVERY_SLOTS; i++) entries.push([`${RECOVERY_PREFIX}${i}`, `old unreadable ${i}`]);
  const store = memory(entries);
  assert.equal(saveCoastSave(store, createCoast(5)).ok, false);
  assert.deepEqual([...store.data], entries);
  assert.deepEqual(store.writes, []);
});

test("an already retained corrupt record is reused, including when all slots are occupied", () => {
  const entries = [[KEY, corrupt], [BACKUP_KEY, valid]];
  for (let i = 0; i < RECOVERY_SLOTS; i++) entries.push([`${RECOVERY_PREFIX}${i}`, i === 7 ? corrupt : `old ${i}`]);
  const store = memory(entries);
  assert.equal(saveCoastSave(store, coast).ok, true);
  assert.ok(store.writes.every(({ key }) => !key.startsWith(RECOVERY_PREFIX)));
});

test("storage access failures do not escape or report success", () => {
  const store = memory([[KEY, valid]], () => true);
  assert.deepEqual(loadCoastSave(store), { state: null, status: "unavailable" });
  assert.deepEqual(saveCoastSave(store, coast), { ok: false, status: "blocked" });
  assert.deepEqual(loadCoastSave(null), { state: null, status: "unavailable" });
  assert.equal(saveCoastSave(null, coast).ok, false);
});

test("old valid v1 saves keep identical content and establish a previous-move backup", () => {
  const store = memory([[KEY, valid]]);
  assert.deepEqual(loadCoastSave(store), { state: coast, status: "loaded" });
  const next = apply(coast, "rampa:merdiven");
  assert.equal(saveCoastSave(store, next).ok, true);
  assert.equal(store.getItem(BACKUP_KEY), valid);
  assert.equal(store.getItem(KEY), serialize(next));
  assert.equal(store.data.size, 2);
});

test("empty primary restores backup; empty-string corruption is retained byte for byte", () => {
  const backupOnly = memory([[BACKUP_KEY, valid]]);
  assert.deepEqual(loadCoastSave(backupOnly), { state: coast, status: "backup" });
  const store = memory([[KEY, ""]]);
  assert.equal(loadCoastSave(store).status, "invalid");
  assert.equal(saveCoastSave(store, coast).ok, true);
  assert.equal(store.getItem(`${RECOVERY_PREFIX}0`), "");
});

test("malformed pending state cannot be persisted over an existing record", () => {
  const store = memory([[KEY, valid]]);
  assert.equal(saveCoastSave(store, { ...coast, pending: null }).ok, false);
  assert.deepEqual(store.writes, []);
  assert.equal(store.getItem(KEY), valid);
});
