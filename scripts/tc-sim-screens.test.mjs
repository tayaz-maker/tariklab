import test from "node:test";
import assert from "node:assert/strict";
import { SAVE_VERSION, createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { NAVIGATION_ITEMS, getNavigationTarget } from "../public/games/tc-sim/js/navigation.js";
import { KNOWN_CASE_TYPES, getKnownOpenCases } from "../public/games/tc-sim/js/calendar.js";
import {
  createPersonalDebt,
  createSocialObligation,
  scheduleSocialFollowup,
} from "../public/games/tc-sim/js/social.js";
import { loadGame, saveGame } from "../public/games/tc-sim/js/save.js";

class MemoryStorage {
  data = new Map();
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

const fresh = () => createNewGame({ name: "Screens", now: "2027-01-01T00:00:00.000Z", seed: 11 });

test("her ana gezinme öğesinin gerçek, geçerli bir görünümü vardır", () => {
  for (const item of NAVIGATION_ITEMS) {
    assert.notEqual(item.view, null, `${item.label} hâlâ devre dışı`);
    assert.equal(getNavigationTarget(item.view), item.view, `${item.label} hedefi geçersiz`);
  }
  assert.equal(NAVIGATION_ITEMS.length, 14);
});

test("TAKVİM yalnız oyuncunun bildiği yükümlülük türlerini döner", () => {
  const state = fresh();
  assert.equal(createSocialObligation(state, "mehmet"), true);
  const known = getKnownOpenCases(state);
  assert.equal(known.length, 1);
  assert.equal(known[0].type, "social-obligation");
});

test("TAKVİM gecikmeli sosyal sonuçları (social-followup) asla göstermez", () => {
  const state = fresh();
  assert.equal(
    scheduleSocialFollowup(state, {
      eventId: "debt_elif_comment",
      dueWeek: state.time.absoluteWeek + 6,
      personId: "elif",
    }),
    true,
  );
  assert.equal(state.openCases.some((item) => item.type === "social-followup"), true);
  const known = getKnownOpenCases(state);
  assert.equal(known.some((item) => item.type === "social-followup"), false);
  assert.equal(known.length, 0);
});

test("KNOWN_CASE_TYPES gizli/ayrı ele alınan türleri içermez", () => {
  assert.equal(KNOWN_CASE_TYPES.includes("social-followup"), false);
  assert.equal(KNOWN_CASE_TYPES.includes("personal-debt"), false);
  assert.equal(KNOWN_CASE_TYPES.includes("job-start"), false);
  assert.ok(KNOWN_CASE_TYPES.includes("social-obligation"));
  assert.ok(KNOWN_CASE_TYPES.includes("friend-loan"));
});

test("personal-debt case'i TAKVİM'in genel listesinde çıkmaz (PARA/TAKVİM'de ayrı işlenir)", () => {
  const state = fresh();
  assert.equal(createPersonalDebt(state, "mehmet", 2500, 4, "lent_2500"), true);
  const known = getKnownOpenCases(state);
  assert.equal(known.length, 0);
});

test("çözülen bir yükümlülük TAKVİM listesinden düşer", () => {
  const state = fresh();
  createSocialObligation(state, "mehmet");
  state.openCases[0].status = "resolved";
  assert.deepEqual(getKnownOpenCases(state), []);
});

test("yeni state SAVE_VERSION v6 olarak doğrulanır ve save/load bozulmaz", () => {
  const state = fresh();
  assert.equal(SAVE_VERSION, 6);
  assert.equal(state.meta.saveVersion, 6);
  assert.equal(validateState(state).ok, true);
  const storage = new MemoryStorage();
  assert.equal(saveGame(storage, state).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.meta.saveVersion, 6);
  assert.equal(validateState(loaded.state).ok, true);
});
