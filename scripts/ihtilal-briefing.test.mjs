import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, cardOf, cloneState, createMatch, legalActions } from "../public/games/ihtilal/engine.js";
import { ARCHETYPE_IDS } from "../public/games/ihtilal/decks.js";
import { changes, deskProgress, previewAction, snapshot, suggestedAction } from "../public/games/ihtilal/briefing.js";
import { endReport } from "../public/games/ihtilal/report.js";

for (const archetype of ARCHETYPE_IDS) {
  test(`briefing suggests a legal first action and previews actual resolution for ${archetype}`, () => {
    for (const seed of [1, 1923, 831, 42]) {
      const state = createMatch({ seed, playerArchetype: archetype });
      const initial = JSON.stringify(state);
      const suggestion = suggestedAction(state);
      assert.ok(suggestion);
      assert.ok(legalActions(state, 0).some(action => JSON.stringify(action) === JSON.stringify(suggestion)));
      const preview = previewAction(state, suggestion);
      assert.equal(JSON.stringify(state), initial, "preview and suggestion cannot alter the live run");
      const resolved = cloneState(state);
      assert.equal(applyAction(resolved, suggestion).ok, true);
      assert.deepEqual(preview.changes, changes(snapshot(state), snapshot(resolved)));
      assert.equal(JSON.stringify(preview).includes('"hand"'), false, "no opponent hand in preview payload");
    }
  });
}

test("briefing never suggests a human move during the AI's action window", () => {
  assert.equal(suggestedAction(createMatch({ first: 1 })), null);
});

test("an invalid preview fails without consuming a file, resource or turn", () => {
  const state = createMatch();
  const before = JSON.stringify(state);
  assert.equal(previewAction(state, { type: "play", cardId: "invalid", desk: "sicil" }), null);
  assert.equal(JSON.stringify(state), before);
});

test("a delayed file preview reports due turn and does not claim immediate influence", () => {
  let state, action;
  for (let seed = 1; seed < 100 && !action; seed++) {
    state = createMatch({ seed });
    action = legalActions(state).find(a => a.cardId && (cardOf(a.cardId).type === "artci" || cardOf(a.cardId).delay > 0));
  }
  assert.ok(action);
  const card = cardOf(action.cardId);
  const preview = previewAction(state, action);
  assert.equal(preview.queued.length, 1);
  assert.equal(preview.queued[0].due, state.turn + Math.max(1, card.delay || 1));
  assert.equal(preview.changes.some(change => change.key === "presence"), false);
});

test("desk guidance exposes the 3-presence threshold, rival lead and turn-end lock distinction", () => {
  assert.deepEqual(deskProgress({ presence: [0, 0], lock: null }), { own: 0, rival: 0, needed: 3, ready: false, held: false });
  assert.equal(deskProgress({ presence: [3, 3], lock: null }).needed, 1);
  assert.equal(deskProgress({ presence: [3, 2], lock: null }).ready, true);
  assert.equal(deskProgress({ presence: [3, 2], lock: null }).held, false);
  const state = createMatch();
  state.desks.sicil.presence = [3, 2];
  const preview = previewAction(state, { type: "end-kalem" });
  assert.ok(preview.changes.some(row => row.key === "lock" && row.desk === "sicil" && row.owner === 0));
  assert.ok(preview.changes.some(row => row.key === "hukum" && row.owner === 0 && row.delta === 2));
});

test("report names the real score comparison for victory, defeat and heat draw", () => {
  for (const lang of ["tr", "en"]) {
    const state = createMatch();
    state.result = { winner: 1, reason: "dagilma" };
    state.players[0].muhur = 2;
    state.players[1].muhur = 9;
    let report = endReport(state, lang);
    assert.match(report.comparison, /2/);
    assert.match(report.comparison, /9/);
    assert.match(report.headline, lang === "tr" ? /Kaybettin/ : /lost/);
    state.result = { winner: 0, reason: "hukum" };
    state.players[0].hukum = 10;
    report = endReport(state, lang);
    assert.match(report.headline, lang === "tr" ? /Kazandın/ : /won/);
    assert.match(report.comparison, /10/);
    state.result = { winner: "draw", reason: "dagilma" };
    state.players[1].muhur = 2;
    report = endReport(state, lang);
    assert.match(report.headline, lang === "tr" ? /Berabere/ : /Draw/);
  }
});

function counterFixture() {
  const state = createMatch({ seed: 1923 });
  const install = (owner, id) => {
    for (const zone of ["hand", "deck", "discard", "exile"]) state.players[owner][zone] = state.players[owner][zone].filter(item => item !== id);
    state.players[owner].hand = [id];
  };
  install(0, "ITL-007"); // +3 Registry, +1 Ruling
  install(1, "ITL-012"); // Registry counter, cost 1
  return state;
}

test("counter windows only interrupt play when at least one response is legal", () => {
  for (const blocked of ["ink", "repeat", "wrong-desk"]) {
    const state = counterFixture();
    if (blocked === "ink") state.players[1].murekkep = 0;
    if (blocked === "repeat") state.playedDesk["1:ITL-012:sicil"] = true;
    if (blocked === "wrong-desk") state.players[1].hand = ["ITL-022"];
    assert.equal(applyAction(state, { type: "play", cardId: "ITL-007", desk: "sicil" }).ok, true);
    assert.equal(state.phase, "kalem", blocked);
    assert.equal(state.pendingCounter, false, blocked);
    assert.equal(state.playsLeft, 1, "player keeps their second meaningful move");
  }
  const state = counterFixture();
  applyAction(state, { type: "play", cardId: "ITL-007", desk: "sicil" });
  assert.equal(state.phase, "karsi");
  assert.ok(legalActions(state).some(action => action.type === "counter"));
});

test("passing a real counter window resolves a winning first file immediately", () => {
  const state = counterFixture();
  state.players[0].hukum = 9;
  applyAction(state, { type: "play", cardId: "ITL-007", desk: "sicil" });
  assert.equal(state.phase, "karsi");
  assert.equal(state.playsLeft, 1);
  assert.equal(state.result, null, "a real response is still allowed");
  applyAction(state, { type: "skip-karsi" });
  assert.deepEqual(state.result, { winner: 0, reason: "hukum" });
  assert.equal(state.phase, "end");
  assert.equal(applyAction(state, { type: "end-kalem" }).ok, false);
});
