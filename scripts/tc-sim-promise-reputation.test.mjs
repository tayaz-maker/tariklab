import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, SAVE_VERSION } from "../public/games/tc-sim/js/state.js";
import { migrateState, saveGame, loadGame } from "../public/games/tc-sim/js/save.js";
import { createSocialObligation, resolveSocialObligation, applySocialAction, hasNpcMemory } from "../public/games/tc-sim/js/social.js";
import { processDueOpenCases, activateNextEvent, resolveEvent } from "../public/games/tc-sim/js/events.js";
import { getReputationContext } from "../public/games/tc-sim/js/depth3-systems.js";

const roundtrip = state => {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) };
  assert.equal(saveGame(storage, state).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  return loaded.state;
};

for (const version of [5, 6]) for (const kept of [true, false]) {
  test(`V${version} ${kept ? "kept" : "broken"} promise reaches NPC memory and its own circle once`, () => {
    let state = createNewGame({ seed: 17 });
    state.meta.saveVersion = version;
    const migrated = migrateState(state);
    assert.equal(migrated.ok, true);
    state = migrated.state;
    state.events.active = null; state.events.queue = [];
    const cash = state.finances.balance;
    const trust = state.people.find(p => p.id === "mehmet").social.trust;
    assert.equal(createSocialObligation(state, "mehmet"), true);
    const source = state.openCases.find(c => c.type === "social-obligation").id;
    state = roundtrip(state);
    if (kept) assert.equal(applySocialAction(state, "mehmet", "fulfill_promise").ok, true);
    else {
      state.time.absoluteWeek += 3;
      processDueOpenCases(state);
      activateNextEvent(state);
      assert.equal(state.events.active.eventId, "social_promise_due");
      assert.equal(resolveEvent(state, "acknowledge").ok, true);
    }
    assert.equal(state.finances.balance, cash - (kept ? 300 : 0));
    assert.equal(state.people.find(p => p.id === "mehmet").social.trust, trust + (kept ? 10 : -12));
    assert.equal(hasNpcMemory(state, "mehmet", kept ? "promise_kept" : "promise_broken"), true);
    const evidence = state.reputation.evidence.filter(e => e.source === source);
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].circle, "friends");
    assert.equal(evidence[0].signal, kept ? "reliable" : "unreliable");
    assert.equal(getReputationContext(state, "friends").signal, evidence[0].signal);
    state = roundtrip(state);
    const before = JSON.stringify(state);
    assert.equal(resolveSocialObligation(state, "mehmet", kept), false);
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.meta.saveVersion, SAVE_VERSION);
    assert.equal(SAVE_VERSION, 6);
  });
}
