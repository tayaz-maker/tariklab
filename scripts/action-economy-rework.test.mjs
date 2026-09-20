import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createNewGame } from "../public/games/tc-sim/js/state.js";
import { applyDecision } from "../public/games/tc-sim/js/time.js";
import { hydrateDevlet, applyPolicy } from "../public/games/next-wave/devlet-sim.js";
import { createTown, applyTownAction, actionInfo } from "../public/games/son-kasaba/sim.js";
import { ensureSonState, applySonAction, sonActionCost } from "../public/games/next-wave/son100-sim.js";

test("TC SIM uses a six-block week while preserving anti-repeat", () => {
  const state = createNewGame({ seed: 42 });
  for (const id of ["rest", "family", "friend", "exercise"]) {
    assert.equal(applyDecision(state, id).ok, true, id);
  }
  assert.equal(state.weekly.used, 4);
  assert.equal(applyDecision(state, "rest").ok, false);
});

test("DEVLET policy load consumes variable administrative capacity and creates friction", () => {
  const state = hydrateDevlet("2002");
  const policy = state.eraId === "2002" ? "imf-sba" : null;
  applyPolicy(state, policy);
  assert.ok(state.flags.governanceUsed >= 1);
  assert.ok(state.flags.governanceUsed <= state.flags.governanceCapacity);
  assert.ok(state.flags.bureaucraticFriction > 0);
});

test("SON KÖY actions have different field effort and more than three light files fit", () => {
  const state = createTown();
  const talk = actionInfo(state, "talk:muhtar");
  const repair = actionInfo(state, "repair:school");
  assert.ok(talk.effort < repair.effort);
  const light = state.npcs.filter((npc) => npc.present).slice(0, 4);
  for (const npc of light) assert.equal(applyTownAction(state, `talk:${npc.id}`), true);
  assert.equal(state.used.length, 4);
  assert.equal(state.capacityUsed, 4);
});

test("SON 100 GÜN uses focus costs instead of an exact two-action day", () => {
  const state = ensureSonState({
    meta: { id: "son-100-gun", version: 2, seed: 7 }, day: 1, remainingDays: 100,
    actionsRemaining: 2, focusMax: 8, focusRemaining: 8,
    resources: { money: 1000, energy: 70, hope: 50 }, relationships: [], obligations: [],
    opportunities: [], openCases: [], missed: [], history: [], flags: {}, ui: { screen: "Durum" },
  });
  assert.equal(sonActionCost({ id: "rest" }), 2);
  applySonAction(state, "rest");
  applySonAction(state, "pray");
  applySonAction(state, "forgive");
  assert.equal(state.day, 1);
  assert.equal(state.focusRemaining, 2);
});

test("embedded shell stays compact and standalone controls remain available", async () => {
  const css = await readFile(new URL("../public/games/next-wave/shared/base.css", import.meta.url), "utf8");
  assert.match(css, /\.tlab-embedded \.game-root/);
  assert.match(css, /min-height:\s*40px/);
  assert.match(css, /position:\s*sticky/);
});
