import test from "node:test";
import assert from "node:assert/strict";
import {
  actionInfo,
  advanceTown,
  applyTownAction,
  createTown,
  normalizeTown,
  validateTown,
} from "../public/games/son-kasaba/sim.js";
import { EVENTS } from "../public/games/son-kasaba/data.js";

const copy = (state) => JSON.parse(JSON.stringify(state));

// Use only decisions currently offered by the game, including newly opened
// events after each decision. This reaches the old 45-event limit through play.
function nextEventCommand(state) {
  return state.events
    .filter((event) => event.status === "open")
    .flatMap((event) =>
      EVENTS.find((definition) => definition.id === event.id).choices.map((choice) => {
        const command = `event:${event.id}:${choice.id}`;
        return { command, ...actionInfo(state, command) };
      }),
    )
    .filter((action) => !action.reason)
    .sort((a, b) => a.cost - b.cost)[0]?.command;
}

function roundtrip(state, label) {
  const saved = copy(state);
  assert.equal(validateTown(saved), true, `${label}: valid gameplay must remain loadable`);
  const restored = normalizeTown("son-kasaba", copy(saved));
  assert.deepEqual(restored, saved, `${label}: reload must preserve the entire save`);
  return restored;
}

function existingLongSave() {
  const state = createTown({ context: "balanced" });
  while (!state.ended && state.events.length <= 45) {
    const command = nextEventCommand(state);
    assert.equal(command ? applyTownAction(state, command) : advanceTown(state), true);
  }
  assert.ok(state.events.length > 45, "fixture must cross the old limit through legal play");
  return copy(state);
}

for (const context of ["balanced", "rural", "industry"]) {
  test(`SON KÖY ${context}: capacity-permitted event decisions reload throughout 24 months`, (t) => {
    let state = roundtrip(createTown({ context }), `${context}/start`);
    let decisions = 0;
    while (!state.ended) {
      let command;
      while ((command = nextEventCommand(state))) {
        assert.equal(applyTownAction(state, command), true, command);
        decisions++;
        state = roundtrip(state, `${context}/month-${state.month}/${command}`);
      }
      assert.equal(advanceTown(state), true);
      state = roundtrip(state, `${context}/completed-${state.completedMonths}`);
    }
    assert.equal(state.completedMonths, 24);
    assert.equal(state.ended, true);
    assert.ok(decisions > 45, "exercise more than 45 real decisions");
    assert.ok(state.events.length > 45, "retain the complete long-campaign event history");
    assert.ok(state.seenEvents.length > 45, "retain seen events so they cannot reopen");
    assert.ok(state.events.length <= EVENTS.length);
    assert.ok(state.seenEvents.length <= EVENTS.length);
    t.diagnostic(`${context}: ${decisions} decisions, ${state.events.length} events, 24 months`);
  });
}

test("SON KÖY an existing save beyond 45 events reloads without resetting or truncating progress", () => {
  const saved = existingLongSave();
  const restored = roundtrip(saved, `existing/month-${saved.month}/${saved.events.length}-events`);
  const beforeReload = copy(saved);
  const command = nextEventCommand(restored);
  assert.equal(command ? applyTownAction(restored, command) : advanceTown(restored), true);
  assert.equal(command ? applyTownAction(beforeReload, command) : advanceTown(beforeReload), true);
  assert.deepEqual(restored, beforeReload, "continuing after reload preserves decision consequences");

  const legacy = copy(saved);
  legacy.meta.version = 1;
  const migrated = normalizeTown("son-kasaba", legacy);
  assert.ok(migrated, "the original version-1 save format remains accepted");
  assert.deepEqual(migrated, saved, "migration preserves all progress in the long save");
});

test("SON KÖY history bounds follow the catalog while corrupt event records remain rejected", () => {
  const full = createTown();
  full.events = EVENTS.map((event) => ({
    id: event.id,
    status: "resolved",
    opened: 1,
    expires: 2,
  }));
  full.seenEvents = EVENTS.map((event) => event.id);
  roundtrip(full, "full-catalog history");

  for (const mutate of [
    (state) => state.events.push(copy(state.events[0])),
    (state) => state.seenEvents.push(state.seenEvents[0]),
    (state) => (state.events[0].id = "not-a-town-event"),
    (state) => (state.events[0].status = "not-an-event-status"),
    (state) => (state.events[0].expires = "2"),
    (state) => (state.events[0].id = state.events[1].id),
  ]) {
    const corrupt = copy(full);
    mutate(corrupt);
    assert.equal(validateTown(corrupt), false);
    assert.equal(normalizeTown("son-kasaba", corrupt), null);
  }
});
