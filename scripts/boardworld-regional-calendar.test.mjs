import test from "node:test";
import assert from "node:assert/strict";
import * as engine from "../public/games/tc-sim-boardworld/engine.mjs";
import { getAppointmentOptions as goldOptions } from "../public/games/tc-sim-boardworld/calendar.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
import { localizeWorldText } from "../public/games/tc-sim-boardworld/expansion-world.mjs";

await engine.loadExpansionRuntime();

// Every state below comes from character creation and public game actions.
// No balances, calendar entries, needs, clocks or NPC relations are injected.
function step(state, id, payload) {
  const bytes = exportGame(state);
  const result = engine.resolveAction(state, id, payload);
  assert.equal(result.ok, true, `${id}: ${result.message}`);
  assert.equal(exportGame(state), bytes, "input remains immutable");
  assert.equal(engine.validateState(result.state), true);
  return result.state;
}
function clearCards(state) {
  for (let n = 0; state.pendingEvents.length && n < 20; n++) {
    const action = engine.getActions(state).find((a) => a.category === "event" && !a.disabled);
    assert.ok(action);
    state = step(state, action.id);
  }
  assert.equal(state.pendingEvents.length, 0);
  return state;
}
function start(expansion = true) {
  return step(clearCards(engine.createGame({ seed: 49, expansion })), "wait:60");
}
const draft = {
  kind: "personal",
  npcId: "",
  subjectId: "rest",
  day: 2,
  minute: 1080,
  venue: "kadikoy-park",
  duration: 60,
  repeat: "weekly",
};
function booked() {
  const state = step(start(), "calendar:propose", draft);
  const entry = state.calendar.entries.findLast((e) => e.kind === "personal");
  assert.equal(entry.status, "confirmed");
  return { state, entry };
}
function reject(state, id, payload) {
  const bytes = exportGame(state);
  const result = engine.resolveAction(state, id, payload);
  assert.equal(result.ok, false);
  assert.equal(exportGame(result.state), bytes);
  assert.equal(exportGame(state), bytes);
  return result;
}

test("remote options, preview and resolver reject new physical plans; Gold remains unchanged", () => {
  const gold = start(false);
  assert.deepEqual(engine.getAppointmentOptions(gold, draft), goldOptions(gold, draft));
  const { state, entry } = booked();
  const away = step(state, "world:move:ankara");
  const bytes = exportGame(away);
  const options = engine.getAppointmentOptions(away, draft);
  assert.ok(options.slots.length > 0);
  assert.ok(options.slots.every((s) => !s.available));
  for (const id of ["calendar:propose", `calendar:reschedule:${entry.id}`]) {
    const result = reject(away, id, draft);
    const preview = engine.previewAction(away, id, draft);
    assert.equal(preview.ok, false);
    assert.equal(preview.message, result.message);
    assert.ok(options.slots.every((slot) => slot.reason === result.message));
    for (const language of ["en", "pl"])
      assert.notEqual(localizeWorldText(result.message, language), result.message);
  }
  reject(away, `calendar:attend:${entry.id}`);
  assert.equal(exportGame(away), bytes, "queries and rejection award nothing");
  assert.deepEqual(importGame(bytes).state, away);
});

test("remote cancellation and stopping recurrence retain their normal effects and replay", () => {
  const { state, entry } = booked();
  const away = step(state, "world:move:ankara");
  const cancel = `calendar:cancel:${entry.id}`;
  const stop = `calendar:repeat-stop:${entry.recurrenceId}`;
  for (const id of [cancel, stop])
    assert.ok(engine.getActions(away).some((a) => a.id === id && !a.disabled));
  const cancelled = step(away, cancel);
  const replayed = step(importGame(exportGame(away)).state, cancel);
  assert.deepEqual(replayed, cancelled);
  assert.equal(cancelled.time - away.time, 5);
  assert.equal(cancelled.calendar.entries.find((e) => e.id === entry.id).status, "cancelled");
  assert.equal(
    cancelled.calendar.recurrences.some((r) => r.id === entry.recurrenceId && r.enabled),
    false,
  );
  reject(cancelled, cancel);
  const stopped = step(away, stop);
  assert.equal(stopped.time - away.time, 1);
  assert.equal(stopped.calendar.entries.find((e) => e.id === entry.id).status, "confirmed");
  assert.equal(
    stopped.calendar.recurrences.some((r) => r.id === entry.recurrenceId && r.enabled),
    false,
  );
  reject(stopped, stop);
  const returned = step(clearCards(cancelled), "world:move:istanbul");
  const nextDraft = { ...draft, day: Math.floor(returned.time / 1440) + 2, repeat: "none" };
  assert.ok(engine.getAppointmentOptions(returned, nextDraft).slots.some((slot) => slot.available));
  const planned = step(clearCards(returned), "calendar:propose", nextDraft);
  assert.equal(planned.calendar.entries.findLast((e) => e.kind === "personal").status, "confirmed");
  assert.equal(planned.calendar.entries.find((e) => e.id === entry.id).status, "cancelled");
});

test("a real NPC counteroffer can be declined remotely but cannot be accepted while away", () => {
  let state = start();
  const proposal = {
    ...draft,
    kind: "meeting",
    npcId: "leyla",
    subjectId: "",
    venue: "kadikoy-cafe",
    repeat: "none",
  };
  const slot = engine
    .getAppointmentOptions(state, proposal)
    .slots.find((s) => s.available && s.counterExpected && !s.rejectionExpected);
  assert.ok(slot);
  state = step(state, "calendar:propose", { ...proposal, minute: slot.minute });
  const entry = state.calendar.entries.findLast((e) => e.kind === "meeting");
  assert.equal(entry.status, "counter");
  state = step(state, "world:move:ankara");
  reject(state, `calendar:accept:${entry.id}`);
  const trust = state.npcs.leyla.trust;
  const declined = step(state, `calendar:decline:${entry.id}`);
  assert.equal(declined.time - state.time, 2);
  assert.equal(declined.calendar.entries.find((e) => e.id === entry.id).status, "rejected");
  assert.equal(declined.npcs.leyla.trust, trust);
  reject(declined, `calendar:decline:${entry.id}`);
});

test("remote fast-forward does not invent a local departure; standing commitments still expire once", () => {
  const { state: initial, entry } = booked();
  let state = step(initial, "world:move:ankara");
  while (state.time < 2480) state = step(clearCards(state), "wait:60");
  assert.equal(state.time, 2480);
  const next = step(state, "calendar:next");
  assert.equal(next.time, entry.start - 30, "automation preserves the commitment decision stop");
  assert.equal(next.expansion.world.region, "ankara");
  assert.equal(next.calendar.entries.find((e) => e.id === entry.id).status, "confirmed");
  assert.equal(next.calendar.stats.missed, state.calendar.stats.missed);
  const blocked = engine.resolveAction(next, "calendar:next");
  assert.doesNotMatch(blocked.message, /Takvimdeki mekâna gitme zamanı/);
  assert.ok(
    engine.getActions(next).some((a) => a.id === `calendar:cancel:${entry.id}` && !a.disabled),
  );
  let missed = next;
  while (missed.time <= entry.start + 31) missed = step(clearCards(missed), "wait:60");
  assert.equal(missed.calendar.entries.find((e) => e.id === entry.id).status, "missed");
  assert.equal(missed.calendar.stats.missed, state.calendar.stats.missed + 1);
  assert.equal(missed.calendar.recurrences.find((r) => r.id === entry.recurrenceId).enabled, true);
  assert.ok(
    missed.calendar.entries.some(
      (e) => e.recurrenceId === entry.recurrenceId && e.id !== entry.id && e.status === "confirmed",
    ),
  );
  const later = step(clearCards(missed), "wait:60");
  assert.equal(later.calendar.stats.missed, missed.calendar.stats.missed);
  assert.deepEqual(step(importGame(exportGame(state)).state, "calendar:next"), next);
});
