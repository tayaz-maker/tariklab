import assert from "node:assert/strict";
import test from "node:test";
import { applyMove, createSolo, deserializeSolo, legalMoves, previewMove, REGIONS, serializeSolo } from "../public/games/ihtilal/solo.js";

test("seven original basins and a one-seat file", () => {
  const state = createSolo(11);
  assert.equal(REGIONS.length, 7);
  assert.equal(new Set(REGIONS.map((r) => r.id)).size, 7);
  assert.equal(state.id, "ihtilal-solo");
  assert.equal(state.phase, "play");
  assert.ok(!("players" in state));
});

test("preview matches the applied immediate deltas", () => {
  const state = createSolo(3);
  const preview = previewMove(state, "ac");
  const next = applyMove(state, "ac");
  assert.equal(preview.trust, next.trust - state.trust);
  assert.equal(preview.intel, next.intel - state.intel);
  assert.equal(preview.tension, next.tension - state.tension);
  assert.equal(preview.delayed, 1);
});

test("a held basin can echo as tension next period", () => {
  let state = createSolo(1);
  const hot = state.regions.reduce((a, b) => (a.strain > b.strain ? a : b));
  state = { ...state, selected: hot.id, regions: state.regions.map((r) => r.id === hot.id ? { ...r, strain: 70 } : r) };
  state = applyMove(state, "tut");
  assert.ok(state.pending.some((p) => p.tag === "tut-echo"));
  const due = state.pending.find((p) => p.tag === "tut-echo").due;
  const before = state.tension;
  let guard = 0;
  while (state.period <= due && state.phase === "play" && guard++ < 10) {
    const moves = legalMoves(state);
    const id = moves.includes("kapat") ? "kapat" : moves[0];
    state = applyMove(state, id);
  }
  assert.ok(state.tension > before);
});

test("two lines do not share one ending", () => {
  const quiet = (seed) => {
    let s = createSolo(seed);
    let guard = 0;
    while (s.phase !== "end" && guard++ < 40) {
      const id = legalMoves(s).find((m) => m === "sustur" || m === "acik" || m === "kapat") || legalMoves(s)[0];
      s = applyMove(s, id);
    }
    return s.ending;
  };
  const loud = (seed) => {
    let s = createSolo(seed);
    let guard = 0;
    while (s.phase !== "end" && guard++ < 40) {
      const id = legalMoves(s).find((m) => m === "ac" || m === "sert") || legalMoves(s)[0];
      s = applyMove(s, id);
    }
    return s.ending;
  };
  assert.notEqual(quiet(5), loud(5));
});

test("save round-trip keeps the solo key and rejects the old card envelope", () => {
  const state = applyMove(createSolo(9), "sustur");
  const back = deserializeSolo(serializeSolo(state));
  assert.equal(back.intel, state.intel);
  assert.equal(deserializeSolo(JSON.stringify({ gameId: "ihtilal", version: 1 })), null);
});
