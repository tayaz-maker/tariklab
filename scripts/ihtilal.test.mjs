import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { CARDS, CARD_BY_ID } from "../public/games/ihtilal/cards.js";
import { ARCHETYPE_IDS, DESKS, buildDeck } from "../public/games/ihtilal/decks.js";
import {
  GAME_ID,
  SAVE_VERSION,
  actingPlayer,
  applyAction,
  canPlay,
  cloneState,
  createMatch,
  legalActions,
  normalize,
  publicView,
} from "../public/games/ihtilal/engine.js";
import { chooseAction, AI_PROFILES } from "../public/games/ihtilal/ai.js";
import { deserialize, loadSlot, saveSlot, slotKey } from "../public/games/ihtilal/save.js";
import { endReport } from "../public/games/ihtilal/report.js";
import { mulberry } from "../public/games/ihtilal/rng.js";
import { COPY, HELP, TUTORIAL, fx } from "../public/games/ihtilal/copy.js";

const NULLISH = /(?<![\p{L}\p{N}_])(null|undefined)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])NaN(?![\p{L}\p{N}_])|\[object Object\]/u;

function memStore() {
  const mem = new Map();
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
    mem,
  };
}

function playOut(seed, a, b, profile = "adaptive", cap = 400) {
  const state = createMatch({ seed, playerArchetype: a, oppArchetype: b });
  let guard = 0;
  while (!state.result && guard++ < cap) {
    const actor = actingPlayer(state);
    const acts = legalActions(state);
    assert.ok(acts.length, `soft-lock t${state.turn} p${state.phase} a${actor}`);
    const rng = mulberry((state.meta.seed + state.turn * 997 + guard * 13 + actor) >>> 0);
    const pick = chooseAction(publicView(state, actor), acts, profile, rng) || acts.at(-1);
    const result = applyAction(state, pick);
    assert.equal(result.ok, true, JSON.stringify({ pick, why: result.why, phase: state.phase }));
    for (const p of state.players) {
      assert.equal(Number.isFinite(p.hukum), true);
      assert.equal(Number.isFinite(p.murekkep), true);
      assert.equal(Number.isFinite(p.muhur), true);
    }
    assert.equal(Number.isFinite(state.heat), true);
  }
  assert.ok(state.result, `did not finish seed ${seed}`);
  return state;
}

test("catalog has 180+ unique authored files with bilingual titles and effects", () => {
  assert.ok(CARDS.length >= 180, CARDS.length);
  assert.equal(new Set(CARDS.map((c) => c.id)).size, CARDS.length);
  assert.equal(new Set(CARDS.map((c) => c.title.tr)).size, CARDS.length);
  assert.equal(new Set(CARDS.map((c) => c.title.en)).size, CARDS.length);
  const delayed = CARDS.filter((c) => c.delay > 0 || c.type === "artci");
  const chains = new Set(CARDS.filter((c) => c.chain).map((c) => c.chain.id));
  const families = new Set(CARDS.filter((c) => c.family).map((c) => c.family));
  assert.ok(delayed.length >= 30, delayed.length);
  assert.ok(chains.size >= 20, chains.size);
  assert.ok(families.size >= 8, families.size);
  for (const card of CARDS) {
    assert.ok(CARD_BY_ID[card.id]);
    assert.ok(card.title.tr.length > 2);
    assert.ok(card.title.en.length > 2);
    assert.ok(Array.isArray(card.effect));
    assert.ok(card.flavor.tr.length > 8);
    assert.ok(card.flavor.en.length > 8);
    assert.doesNotMatch(card.title.tr + card.flavor.tr + card.a11y.tr, NULLISH);
    assert.doesNotMatch(card.title.en + card.flavor.en + card.a11y.en, NULLISH);
    assert.ok(["acik", "artci", "karsi", "heyet", "muhurluk"].includes(card.type), card.id);
    assert.ok([...DESKS, "any"].includes(card.desk), card.id);
  }
});

test("six archetypes build 30-card decks without duplicates or missing ids", () => {
  assert.equal(ARCHETYPE_IDS.length, 6);
  const rng = mulberry(99);
  for (const id of ARCHETYPE_IDS) {
    const deck = buildDeck(id, rng);
    assert.equal(deck.length, 30, id);
    assert.equal(new Set(deck).size, 30, id);
    for (const cardId of deck) assert.ok(CARD_BY_ID[cardId], cardId);
    const exclusive = CARDS.filter((c) => c.exclusive === id);
    assert.equal(exclusive.length, 12, id);
  }
});

test("seeded matches are deterministic and foreign saves fail closed", () => {
  const a = playOut(42, "kalemci", "hesapci");
  const b = playOut(42, "kalemci", "hesapci");
  assert.deepEqual(a.result, b.result);
  assert.equal(a.turn, b.turn);
  assert.deepEqual(a.players.map((p) => p.hukum), b.players.map((p) => p.hukum));
  const c = playOut(43, "kalemci", "hesapci");
  assert.notEqual(JSON.stringify(a.result) + a.turn, JSON.stringify(c.result) + c.turn);
  const store = memStore();
  assert.equal(saveSlot(store, 1, a).ok, true);
  const loaded = loadSlot(store, 1);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.meta.id, GAME_ID);
  assert.equal(loaded.state.meta.version, SAVE_VERSION);
  assert.equal(normalize({ meta: { id: "veto-h", version: 1, seed: 1 } }), null);
  assert.equal(normalize({ meta: { id: GAME_ID, version: 99, seed: 1 } }), null);
  assert.equal(deserialize(JSON.stringify({ gameId: "gett-oh", version: 1, checksum: "0", payload: "{}" })).error, "foreign-save");
  const cloned = cloneState(a);
  assert.equal(cloned.meta.id, GAME_ID);
  assert.ok(JSON.stringify(cloned).length < 20000);
});

test("slots isolate and mid-turn reload does not reroll", () => {
  const store = memStore();
  const s = createMatch({ seed: 5, playerArchetype: "koridorcu", oppArchetype: "nobetci" });
  const act = legalActions(s).find((a) => a.type === "play") || legalActions(s)[0];
  applyAction(s, act);
  saveSlot(store, 2, s);
  const other = createMatch({ seed: 9, playerArchetype: "mansetci", oppArchetype: "heyetci" });
  saveSlot(store, 3, other);
  const a = loadSlot(store, 2).state;
  const b = loadSlot(store, 3).state;
  assert.notEqual(a.meta.seed, b.meta.seed);
  assert.equal(a.players[0].archetype, "koridorcu");
  assert.equal(slotKey(1), "tariklab.ihtilal.v1.slot1");
  const again = loadSlot(store, 2).state;
  assert.deepEqual(again.players[0].hand, a.players[0].hand);
  assert.equal(again.turn, a.turn);
});

test("same file cannot land on the same desk twice; ink gates plays", () => {
  const s = createMatch({ seed: 11, playerArchetype: "kalemci", oppArchetype: "hesapci" });
  const play = legalActions(s).find((a) => a.type === "play");
  assert.ok(play);
  const id = play.cardId;
  const desk = play.desk;
  applyAction(s, play);
  while (s.phase === "karsi") applyAction(s, { type: "skip-karsi" });
  s.players[0].hand.push(id);
  s.players[0].murekkep = 8;
  s.phase = "kalem";
  s.turnPlayer = 0;
  s.playsLeft = 2;
  const gate = canPlay(s, 0, id, desk);
  assert.equal(gate.ok, false);
  assert.equal(gate.why, "repeat-desk");
});

test("AI only considers public legal actions and all six profiles pick", () => {
  const s = createMatch({ seed: 3, playerArchetype: "heyetci", oppArchetype: "mansetci" });
  const view = publicView(s, 0);
  assert.equal(view.opp.hand.length === undefined || typeof view.opp.hand === "number", true);
  assert.equal(typeof view.opp.hand, "number");
  const acts = legalActions(s, 0);
  for (const profile of AI_PROFILES) {
    const pick = chooseAction(view, acts, profile, mulberry(3));
    assert.ok(pick);
    assert.ok(acts.some((a) => a.type === pick.type && a.cardId === pick.cardId && a.desk === pick.desk));
  }
});

test("TR/EN copy, help and tutorial stay paired without leakage", () => {
  assert.deepEqual(Object.keys(COPY.tr).sort(), Object.keys(COPY.en).sort());
  assert.equal(HELP.tr.length, HELP.en.length);
  assert.equal(TUTORIAL.tr.length, TUTORIAL.en.length);
  const blob = JSON.stringify(COPY) + JSON.stringify(HELP) + JSON.stringify(TUTORIAL);
  assert.doesNotMatch(blob, NULLISH);
  const card = CARDS[0];
  assert.match(fx(card, "tr"), /\S/);
  assert.match(fx(card, "en"), /\S/);
});

test("end report is based on play and never leaks raw ids as the headline", () => {
  const s = playOut(21, "nobetci", "kalemci");
  const report = endReport(s, "tr");
  assert.ok(report.headline);
  assert.doesNotMatch(report.headline, /^ITL-/);
  assert.doesNotMatch(report.reason, NULLISH);
  assert.equal(report.locks.length, 5);
  assert.ok(report.meters.turn >= 1);
});

test("ihtilal sources do not call Math.random", () => {
  const files = ["engine.js", "ai.js", "rng.js", "save.js", "decks.js", "app.js", "report.js"];
  for (const file of files) {
    const src = readFileSync(new URL(`../public/games/ihtilal/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /Math\.random/);
  }
});

test("mirrored archetypes receive the same seeded deck independent of seat", () => {
  const ab = createMatch({ seed: 991, playerArchetype: "kalemci", oppArchetype: "mansetci" });
  const ba = createMatch({ seed: 991, playerArchetype: "mansetci", oppArchetype: "kalemci" });
  assert.deepEqual([...ab.players[0].hand, ...ab.players[0].deck], [...ba.players[1].hand, ...ba.players[1].deck]);
  assert.deepEqual([...ab.players[1].hand, ...ab.players[1].deck], [...ba.players[0].hand, ...ba.players[0].deck]);
});

test("once and same-desk guards are scoped to each player's copy", () => {
  const s = createMatch({ seed: 77, playerArchetype: "kalemci", oppArchetype: "kalemci" });
  const shared = [...s.players[0].hand, ...s.players[0].deck].find((id) =>
    [...s.players[1].hand, ...s.players[1].deck].includes(id) &&
      !CARD_BY_ID[id].once && (!CARD_BY_ID[id].chain || CARD_BY_ID[id].chain.step === 1),
  );
  assert.ok(shared);
  s.players[0].hand = [shared];
  s.players[1].hand = [shared];
  s.players[0].murekkep = s.players[1].murekkep = 8;
  s.players[0].muhur = s.players[1].muhur = 20;
  const desk = CARD_BY_ID[shared].desk === "any" ? "sicil" : CARD_BY_ID[shared].desk;
  s.phase = "kalem";
  s.turnPlayer = 0;
  assert.equal(applyAction(s, { type: "play", cardId: shared, desk }).ok, true);
  s.phase = "kalem";
  s.turnPlayer = 1;
  s.playsLeft = 2;
  assert.equal(canPlay(s, 1, shared, desk).ok, true);
});

test("save normalization rejects duplicate cards and bounds hostile growth", () => {
  const base = createMatch({ seed: 404 });
  const duplicate = JSON.parse(JSON.stringify(base));
  duplicate.players[0].deck.push(duplicate.players[0].hand[0]);
  assert.equal(normalize(duplicate), null);

  const hostile = JSON.parse(JSON.stringify(base));
  hostile.playedDesk = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [`junk-${i}`, true]));
  hostile.once = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [`once-${i}`, true]));
  hostile.familyClaim = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [`family-${i}`, { n: 999, family: "x".repeat(500) }]));
  hostile.chains = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [`chain-${i}`, { step: 999, id: "x".repeat(500) }]));
  hostile.log = Array.from({ length: 1000 }, () => ({ t: Infinity, k: "x".repeat(500), nested: "x".repeat(50000) }));
  hostile.memory = Array.from({ length: 1000 }, () => "x".repeat(50000));
  hostile.archive = [
    { id: "same", owner: 0, due: 2, cardId: base.players[0].hand[0], desk: "sicil", ops: [] },
    { id: "same", owner: 0, due: 2, cardId: base.players[0].hand[0], desk: "sicil", ops: [] },
  ];
  const clean = normalize(hostile);
  assert.ok(clean);
  assert.ok(Object.keys(clean.playedDesk).length <= 80);
  assert.ok(Object.keys(clean.once).length <= CARDS.length * 2);
  assert.ok(Object.keys(clean.familyClaim).length <= 64);
  assert.ok(Object.keys(clean.chains).length <= 48);
  assert.equal(clean.archive.length, 1);
  assert.ok(JSON.stringify(clean).length < 50000);
});

test("25 reloads preserve a pending state without reroll or growth", () => {
  const store = memStore();
  let state = createMatch({ seed: 515, playerArchetype: "nobetci", oppArchetype: "mansetci" });
  state.aiProfile = "control";
  for (let i = 0; i < 25; i += 1) {
    assert.equal(saveSlot(store, 1, state).ok, true);
    const loaded = loadSlot(store, 1);
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.state.players.map((p) => p.hand), state.players.map((p) => p.hand));
    assert.equal(loaded.state.aiProfile, "control");
    state = loaded.state;
  }
  assert.ok(JSON.stringify(state).length < 20000);
});

test("rules copy matches lock threshold, tenure and heat tempo bands", () => {
  assert.match(HELP.tr.find((x) => x.title === "Masalar").body, /3 nüfuz/);
  assert.match(HELP.en.find((x) => x.title === "Desks").body, /three presence/i);
  assert.match(JSON.stringify(HELP) + JSON.stringify(TUTORIAL), /50/);
  assert.match(JSON.stringify(HELP) + JSON.stringify(TUTORIAL), /75/);
});
