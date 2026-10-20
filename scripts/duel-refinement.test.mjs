import test from "node:test";
import assert from "node:assert/strict";
import { chooseAction, scoreActions, AI_PROFILE_IDS } from "../public/games/duel-core/ai.js";
import { relatedCards } from "../public/games/duel-core/relationships.js";
import { analyzeMatch, electionShare, opGraphSvg } from "../public/games/duel-core/analyzer.js";
import { createMatchTelemetry, recordAction, cardValue } from "../public/games/duel-core/telemetry.js";
import { loadSettings, saveSettings, recordMatch, loadHistory, SETTINGS_KEY } from "../public/games/duel-core/prefs.js";
import { rejectionText, REJECTION_COPY } from "../public/games/duel-core/rejections.js";
import { labels } from "../public/games/duel-core/labels.js";
import { pools } from "./duel-pools.mjs";
import { createDuel, dispatch } from "../public/games/duel-core/rules.js";
import { legalActions } from "../public/games/duel-core/actions.js";
import { publicView } from "../public/games/duel-core/projection.js";
import { CAMPAIGN_STYLES, NEIGHBORHOODS } from "../public/games/duel-core/identities.js";

test("label keys stay bilingual", () => {
  assert.deepEqual(Object.keys(labels.tr).sort(), Object.keys(labels.en).sort());
});

test("rejection map covers TR/EN pairs", () => {
  for (const [code, row] of Object.entries(REJECTION_COPY)) {
    assert.equal(row.length, 2, code);
    assert.equal(rejectionText(code, "tr"), row[0]);
    assert.equal(rejectionText(code, "en"), row[1]);
  }
});

test("five AI profiles weight legal lines differently without cheating", () => {
  assert.deepEqual([...AI_PROFILE_IDS].sort(), ["aggressive", "controlled", "gambler", "patient", "trapper"].sort());
  const view = {
    viewer: 1,
    turn: 3,
    phase: "main1",
    players: [
      { points: 8000, units: [null, null, null, null, null] },
      { points: 8000, units: [null, null, null, null, null] },
    ],
    cards: {
      a: { kind: "unit", attack: 1800, defense: 1000, effects: [] },
      t: { kind: "trap", subtype: "normal", effects: [] },
    },
  };
  const actions = [
    { type: "attack", card: "a", target: null },
    { type: "set-support", card: "t", slot: 0 },
    { type: "end-main" },
  ];
  const picks = Object.fromEntries([...AI_PROFILE_IDS].map((p) => [p, chooseAction(view, actions, p).type]));
  assert.equal(picks.aggressive, "attack");
  const scores = Object.fromEntries(
    AI_PROFILE_IDS.map((p) => [p, Object.fromEntries(scoreActions(view, actions, p).map((s) => [s.action.type, s.value]))]),
  );
  assert.ok(scores.aggressive.attack > scores.patient.attack);
  assert.ok(scores.trapper["set-support"] > scores.aggressive["set-support"]);
  const json = JSON.stringify(view);
  chooseAction(view, actions, "gambler");
  assert.equal(JSON.stringify(view), json);
});

test("AI default controlled keeps lethal/pass behaviour", () => {
  const clash = pools["gett-oh"].find((c) => c.id === "RCN-139");
  const view = {
    viewer: 0,
    players: [
      { points: 8000, units: ["own"] },
      { points: 400, units: [null, null, null, null, null] },
    ],
    cards: { clash },
  };
  const pass = { type: "pass", player: 0 },
    respond = { type: "respond", player: 0, card: "clash" };
  assert.deepEqual(chooseAction(view, [pass, respond]), pass);
});

test("analyzer turning point, waste, election shares", () => {
  const tel = {
    events: [
      { turn: 1, type: "summon", card: "SND-001", actor: 0, delta: [0, 0], destroys: 0 },
      { turn: 4, type: "attack", card: "SND-004", actor: 0, delta: [0, -1200], destroys: 2, target: "direct" },
    ],
    cardStats: {
      "SND-001": { plays: 1, damage: 0, draws: 0, destroys: 0, summons: 0 },
      "SND-004": { plays: 1, damage: 1200, draws: 0, destroys: 2, summons: 0 },
    },
    opByTurn: [
      [8000, 8000],
      [8000, 6800],
    ],
    aiProfile: "aggressive",
    winner: 0,
  };
  const catalog = {
    "SND-001": { name: { tr: "Sandık Görevlisi", en: "Ballot Officer" } },
    "SND-004": { name: { tr: "Seçmen Otobüsü", en: "Voter Bus" } },
  };
  const analysis = analyzeMatch(tel, catalog, "tr");
  assert.equal(analysis.starId, "SND-004");
  assert.equal(analysis.turning.card, "SND-004");
  assert.ok(analysis.wasted.includes("SND-001"));
  const share = electionShare({ ...analysis, winner: 0 });
  assert.equal(Math.round((share.you + share.opp) * 10) / 10, 100);
  assert.ok(share.you >= 38 && share.you <= 62);
  assert.match(opGraphSvg(analysis.opByTurn), /<svg/);
  assert.ok(cardValue(tel.cardStats["SND-004"]) > 0);
});

test("relationships return existing ids from the same pool", () => {
  const pool = pools["veto-h"];
  const card = pool.find((c) => c.id === "SND-001");
  const related = relatedCards(card, pool, 5);
  assert.ok(related.length >= 1 && related.length <= 5);
  for (const row of related) {
    assert.ok(pool.some((c) => c.id === row.id));
    assert.notEqual(row.id, card.id);
  }
});

test("settings and history persist on versioned keys", () => {
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
  };
  const saved = saveSettings(storage, { uiScale: 110, cardSize: "large", tableDensity: "compact", aiProfile: "trapper" });
  assert.equal(saved.settings.uiScale, 110);
  const loaded = loadSettings(storage);
  assert.equal(loaded.cardSize, "large");
  assert.equal(loaded.aiProfile, "trapper");
  assert.ok(mem.get(SETTINGS_KEY));
  recordMatch(storage, "veto-h", {
    winner: 0,
    turns: 12,
    aiProfile: "trapper",
    starId: "SND-004",
    starValue: 400,
    cardPlays: { "SND-004": 2 },
    events: [],
  });
  const hist = loadHistory(storage, "veto-h");
  assert.equal(hist.lifetime.wins, 1);
  assert.equal(hist.matches.length, 1);
  assert.ok(mem.get("tariklab.veto-h.campaign-history.v1"));
  recordMatch(storage, "gett-oh", { winner: 1, turns: 8, aiProfile: "gambler" });
  assert.ok(mem.get("tariklab.gett-oh.history.v1"));
});

test("VETO-H! and GETT-OH! settings stay on isolated keys with a shared-key fallback", () => {
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
  };
  saveSettings(storage, { uiScale: 80, aiProfile: "aggressive" }, "veto-h");
  saveSettings(storage, { uiScale: 125, aiProfile: "patient" }, "gett-oh");
  assert.equal(loadSettings(storage, "veto-h").uiScale, 80);
  assert.equal(loadSettings(storage, "gett-oh").uiScale, 125);
  assert.notEqual(mem.get("tariklab.veto-h.settings.v1"), mem.get("tariklab.gett-oh.settings.v1"));
  const legacyMem = new Map([[SETTINGS_KEY, JSON.stringify({ uiScale: 110, aiProfile: "trapper" })]]);
  const fresh = {
    getItem: (k) => (legacyMem.has(k) ? legacyMem.get(k) : null),
    setItem: (k, v) => legacyMem.set(k, v),
  };
  assert.equal(loadSettings(fresh, "veto-h").uiScale, 110, "legacy shared key is a one-time fallback");
  legacyMem.set(SETTINGS_KEY, JSON.stringify({ uiScale: 90, aiProfile: "gambler" }));
  assert.equal(loadSettings(fresh, "veto-h").uiScale, 110, "migrated theme no longer follows shared changes");
  assert.equal(JSON.parse(legacyMem.get("tariklab.veto-h.settings.v1")).uiScale, 110);
});

test("identities exist without stat fields", () => {
  for (const id of Object.keys(CAMPAIGN_STYLES)) {
    assert.ok(CAMPAIGN_STYLES[id].tr.name);
    assert.ok(CAMPAIGN_STYLES[id].en.name);
    assert.equal(CAMPAIGN_STYLES[id].attack, undefined);
  }
  for (const id of Object.keys(NEIGHBORHOODS)) {
    assert.ok(NEIGHBORHOODS[id].accent);
    assert.ok(AI_PROFILE_IDS.includes(NEIGHBORHOODS[id].aiBias));
  }
});

test("card counts and ids stay at 300 per game", () => {
  for (const [, pool] of Object.entries(pools)) {
    assert.equal(pool.length, 300);
    assert.equal(new Set(pool.map((c) => c.id)).size, 300);
    for (const c of pool) {
      assert.ok(c.name.tr && c.name.en && c.text.tr && c.text.en, c.id);
    }
  }
});

test("telemetry records from public dispatch without entering save payload", async () => {
  const pool = pools["veto-h"];
  let s = createDuel(pool, "veto-h", 11);
  const tel = createMatchTelemetry({ theme: "veto-h", aiProfile: "controlled" });
  const prev = s;
  const acts = legalActions(s, s.active);
  const phase = acts.find((a) => a.type === "phase") || acts[0];
  const next = dispatch(s, phase).state;
  recordAction(tel, prev, next, phase);
  assert.ok(tel.events.length >= 1);
  assert.ok(!JSON.stringify(next).includes("cardStats"));
});

test("AI only receives publicView shape in live duel", () => {
  const pool = pools["gett-oh"];
  const s = createDuel(pool, "gett-oh", 19);
  const view = publicView(s, 1);
  assert.equal(view.viewer, 1);
  const hidden = Object.values(view.cards).filter((c) => c.owner === 0 && c.zone === "hand");
  for (const c of hidden) assert.equal(c.name, undefined);
  const who = s.choice?.player ?? s.pending?.responding ?? s.active;
  const approved = legalActions(s, who);
  const action = chooseAction(publicView(s, who), approved, "gambler");
  if (approved.length) assert.ok(action);
});
