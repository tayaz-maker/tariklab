import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  resolveAction,
  runRoutine,
  runCare,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { selectGoldLifeAction } from "./boardworld-gold-scenarios.mjs";

function act(state, id, payload) {
  const before = structuredClone(state);
  const result = resolveAction(state, id, payload);
  assert.equal(result.ok, true, `${id}: ${result.message}`);
  assert.deepEqual(state, before, "manual actions keep the input unchanged");
  assert.ok(validateState(result.state));
  return result.state;
}

function employedStart() {
  let state = createGame({ scenario: "restart", seed: 2026 });
  const memory = {};
  for (let step = 0; step < 10 && !state.job; step++) {
    const action = selectGoldLifeAction(state, "career", memory);
    state = act(state, action.id, action.payload);
  }
  assert.equal(state.job?.id, "retail");
  return state;
}

function assertExactManualEffects(original, result, kind) {
  assert.ok(result.ok, result.message);
  assert.ok(result.actions.length > 0);
  assert.ok(validateState(result.state));
  let manual = original;
  for (const id of result.actions) manual = act(manual, id);

  // A batch adds precisely one summary revision/log and its visible stop/trace
  // diagnostics. Everything else, including every wallet, transaction, contract,
  // NPC plan/knowledge entry, deferred effect and PRNG state, must be identical.
  assert.equal(result.state.revision, manual.revision + 1);
  assert.deepEqual(result.state.history.slice(0, -1), manual.history);
  assert.match(
    result.state.history.at(-1).text,
    kind === "routine" ? /^Rutin:/ : /^İhtiyaç bakımı:/,
  );
  assert.equal(result.state.flow.stop.performedCount, result.actions.length);
  assert.equal(result.state.flow.stop.at, manual.time);
  if (kind === "routine") {
    assert.deepEqual(result.state.deep.routine.lastActions, result.actions);
    assert.deepEqual(result.state.emergent.routine.lastActions, result.actions);
    assert.equal(result.state.deep.routine.lastRun, Math.floor(original.time / 1440) + 1);
  } else {
    assert.deepEqual(result.state.deep.routine, manual.deep.routine);
    assert.deepEqual(result.state.emergent.routine, manual.emergent.routine);
  }
  const authoritative = (state) => {
    const copy = structuredClone(state);
    delete copy.revision;
    delete copy.history;
    delete copy.flow.stop;
    if (kind === "routine") {
      delete copy.deep.routine.lastActions;
      delete copy.deep.routine.lastRun;
      delete copy.deep.routine.stopReason;
      delete copy.emergent.routine;
    }
    return copy;
  };
  assert.deepEqual(authoritative(result.state), authoritative(manual));
  return manual;
}

test("Gold6 real shift/day routine equals the same individual actions across all authoritative state", () => {
  const original = employedStart(),
    before = structuredClone(original),
    result = runRoutine(original);
  assert.deepEqual(original, before);
  assert.ok(result.actions.includes("work"));
  assert.ok(result.actions.includes("sleep"));
  assert.ok(result.state.time >= 1440, "the comparison includes a real daily scheduler boundary");
  const manual = assertExactManualEffects(original, result, "routine");
  assert.ok(manual.job.earned > original.job.earned, "the worked shift earns its real wage");
});

test("Gold6 post-shift care equals real cooking/rest with exact stocks, NPC time and ledger", () => {
  const original = act(employedStart(), "work"),
    before = structuredClone(original),
    result = runCare(original);
  assert.deepEqual(original, before);
  assert.ok(result.actions.includes("cook") && result.actions.includes("rest"));
  const manual = assertExactManualEffects(original, result, "care");
  assert.equal(manual.inventory.groceries, original.inventory.groceries - 1);
  assert.ok(manual.player.energy > original.player.energy);
  assert.ok(manual.player.hunger > original.player.hunger);
});
