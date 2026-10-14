import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, normalizeSocialState, validateState, SAVE_VERSION } from "../public/games/tc-sim/js/state.js";
import { JOBS } from "../public/games/tc-sim/js/catalog.js";
import { EDUCATION_PATHS } from "../public/games/tc-sim/js/education.js";
import { MARKET, INVESTMENTS, spendLifestyle, tradeInvestment } from "../public/games/tc-sim/js/wealth.js";
import { NETWORK_CAST, introducePeople, canRequestReferral, recordReferral, resolveFamilyType } from "../public/games/tc-sim/js/network.js";
import { EVENT_DEFINITIONS } from "../public/games/tc-sim/js/events.js";
import { NAVIGATION_ITEMS } from "../public/games/tc-sim/js/navigation.js";
import { deserializeState, migrateState, saveGame, loadGame } from "../public/games/tc-sim/js/save.js";
import { POLICIES_2002, EVENTS_2002 } from "../public/games/next-wave/devlet-data.js";
import { hydrateDevlet, applyPolicy, tickDevlet } from "../public/games/next-wave/devlet-sim.js";

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

test("varsayılan hayat çekirdek yedi + kardeş ve ay sonu +2500", async () => {
  const { advanceWeek } = await import("../public/games/tc-sim/js/time.js");
  const { getEventDefinition, resolveEvent } = await import("../public/games/tc-sim/js/events.js");
  const state = createNewGame({ name: "Test", seed: 42, now: "2027-01-01T00:00:00.000Z" });
  // 7 çekirdek kişi + Hayat aktarımıyla modellenen kardeş.
  assert.equal(state.people.length, 8);
  assert.equal(state.flags.familyType, "nuclear");
  assert.equal(state.flags.networkMode, "tight");
  const start = state.finances.balance;
  const settle = (s) => {
    if (!s.events.active) return;
    const def = getEventDefinition(s.events.active.eventId);
    const choice = s.events.active.eventId === "loan_repayment" ? "collect" : def.choices[0].id;
    resolveEvent(s, choice);
  };
  for (let i = 0; i < 4; i += 1) {
    settle(state);
    advanceWeek(state);
  }
  assert.equal(state.finances.balance, start + 2500);
});

test("geniş çevre 30+ özgün NPC ve seyrek kenar taşır", () => {
  const state = createNewGame({ socialBackground: "broad", seed: 9 });
  assert.ok(state.people.length >= 30, state.people.length);
  assert.ok(NETWORK_CAST.length >= 36);
  assert.ok(state.people.every((p) => typeof p.id === "string"));
  const extras = state.people.filter((p) => !["anne", "baba", "mehmet", "elif", "selin", "emre", "burak"].includes(p.id));
  assert.ok(extras.every((p) => (p.age || 99) >= 18));
  assert.ok(extras.some((p) => (p.networkEdges || []).length >= 2));
  assert.equal(validateState(state).ok, true);
});

test("aile türleri farklı hayat üretir, varsayılan nuclear kalır", () => {
  const a = createNewGame({ seed: 1 });
  const b = createNewGame({ seed: 1, familyType: "extended" });
  const c = createNewGame({ seed: 1, familyType: "single" });
  assert.equal(a.flags.familyType, "nuclear");
  assert.equal(b.flags.familyType, "extended");
  assert.ok(b.people.length > a.people.length);
  assert.equal(c.flags.absentParent, "baba");
  assert.ok(["nuclear", "extended", "stem", "single"].includes(resolveFamilyType({ familyType: "random", seed: 2 })));
});

test("normalize extra NPC kaybı yapmaz", () => {
  const state = createNewGame({ socialBackground: "broad", seed: 3 });
  const n = state.people.length;
  normalizeSocialState(state);
  assert.equal(state.people.length, n);
  const raw = JSON.parse(JSON.stringify(state));
  const again = normalizeSocialState(raw);
  assert.equal(again.people.length, n);
});

test("referans çiftliği ve tanıştırma spamı kapanır", () => {
  const state = createNewGame({ socialBackground: "broad", seed: 4 });
  const pinar = state.people.find((p) => p.id === "pinar");
  state.relationships.pinar = 70;
  pinar.social.trust = 70;
  assert.equal(recordReferral(state, "pinar", "office").ok, true);
  assert.equal(recordReferral(state, "pinar", "office").ok, true);
  assert.equal(recordReferral(state, "pinar", "office").ok, false);
  state.relationships.cem = 50;
  state.relationships.mert = 50;
  const first = introducePeople(state, "cem", "mert");
  assert.equal(first.ok, true);
  assert.equal(introducePeople(state, "cem", "mert").ok, false);
});

test("market ücret keser, finans/market çift kesmez", () => {
  const state = createNewGame({ seed: 5 });
  state.finances.balance = 20000;
  const before = state.finances.balance;
  const r = spendLifestyle(state, "grocery");
  assert.equal(r.ok, true);
  assert.equal(state.finances.balance, before - MARKET.grocery.cost);
  const again = spendLifestyle(state, "grocery");
  assert.equal(again.ok, false);
});

test("kumar reload exploit yok; yatırım deterministik kalır", () => {
  const a = createNewGame({ seed: 8 });
  const b = createNewGame({ seed: 8 });
  a.finances.balance = 20000;
  b.finances.balance = 20000;
  spendLifestyle(a, "betting");
  spendLifestyle(b, "betting");
  assert.equal(a.finances.balance, b.finances.balance);
  a.finances.balance = 20000;
  tradeInvestment(a, "crypto", 5000);
  tradeInvestment(a, "crypto", 5000);
  assert.ok(a.wealth.investments.find((x) => x.id === "crypto"));
});

test("katalog ve eğitim genişledi", () => {
  assert.ok(JOBS.length >= 50, JOBS.length);
  assert.ok(EDUCATION_PATHS.length >= 15, EDUCATION_PATHS.length);
  assert.ok(Object.keys(MARKET).length >= 40);
  assert.ok(Object.keys(INVESTMENTS).length >= 10);
  assert.ok(NAVIGATION_ITEMS.some((i) => i.label === "FİNANS"));
  assert.ok(NAVIGATION_ITEMS.some((i) => i.label === "ALIŞVERİŞ" && i.view === "market"));
  assert.ok(NAVIGATION_ITEMS.some((i) => i.label === "EMLAK"));
  assert.ok(EVENT_DEFINITIONS.some((e) => e.id === "net_referral_offer"));
});

test("eski kayıt yüklenir, familyType default nuclear", () => {
  const storage = new MemoryStorage();
  const state = createNewGame({ seed: 6, now: "2027-01-01T00:00:00.000Z" });
  saveGame(storage, state);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.meta.saveVersion, SAVE_VERSION);
  const legacy = deserializeState(
    JSON.stringify({
      ...state,
      meta: { ...state.meta, saveVersion: 5 },
      people: state.people.slice(0, 7),
      player: { ...state.player, familyType: undefined, networkMode: undefined },
    }),
  );
  const migrated = migrateState(legacy.state || legacy);
  const normalized = migrated.state || migrated;
  normalizeSocialState(normalized);
  assert.equal(normalized.flags.familyType, "nuclear");
});

test("DEVLET 2002 kapsama ve 2 karar sınırı", () => {
  assert.ok(POLICIES_2002.length >= 48, POLICIES_2002.length);
  assert.ok(EVENTS_2002.length >= 40, EVENTS_2002.length);
  const s = hydrateDevlet("2002");
  applyPolicy(s, "imf-sba");
  applyPolicy(s, "inflation-target");
  applyPolicy(s, "bank-recap");
  assert.equal(s.flags.decisionsRemaining, 0);
  const ids = new Set(POLICIES_2002.map((p) => p.id));
  assert.equal(ids.size, POLICIES_2002.length);
  tickDevlet(s);
  assert.equal(s.flags.decisionsRemaining, 2);
  assert.ok(!JSON.stringify(s.reported).includes("actual"));
});

test("DEVLET 2002-05 long sim sonlu kalır", () => {
  const s = hydrateDevlet("2002");
  for (let i = 0; i < 48; i += 1) {
    const pool = POLICIES_2002;
    applyPolicy(s, pool[i % pool.length].id);
    applyPolicy(s, pool[(i + 3) % pool.length].id);
    tickDevlet(s);
  }
  assert.ok(s.time.year >= 2005 || s.flags.campaignEnd);
  assert.ok(Number.isFinite(s.actual.treasury));
  assert.ok((s.files || []).length <= 20);
  const policyRepeats = (s.path || []).map((x) => x.policy);
  assert.ok(new Set(policyRepeats).size > 8);
});
