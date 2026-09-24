import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { apply, createCoast, deserialize, faultOf, legal, serialize } from "../public/games/esik/sim.js";

test("a stair on the route breaks access until a ramp is added", () => {
  let state = apply(createCoast(3), "bagla:merdiven");
  assert.equal(faultOf(state).reason, "stair");
  assert.equal(state.access, 0);
  state = apply(state, "rampa:merdiven");
  assert.equal(faultOf(state), null);
  assert.ok(state.pending.some((item) => item.tag === "ramp"));
});

test("waiting and forcing the stair do not end the same way", () => {
  let quiet = createCoast(2);
  while (quiet.phase !== "end") quiet = apply(quiet, "bekle");
  let loud = createCoast(2);
  let guard = 0;
  while (loud.phase !== "end" && guard++ < 30) {
    const move = legal(loud).find((id) => id.startsWith("bagla:merdiven") || id.startsWith("bagla:yokus") || id.startsWith("bagla:")) || "bekle";
    loud = apply(loud, move);
  }
  assert.equal(quiet.ending, "yorgun");
  assert.notEqual(loud.ending, quiet.ending);
});

test("save keeps its own key", () => {
  const state = apply(createCoast(8), "bagla:rihtim");
  assert.equal(deserialize(serialize(state)).resource, state.resource);
  assert.equal(deserialize("{\"gameId\":\"ihtilal\"}"), null);
});

test("the coast file does not borrow a transit-game screen language", () => {
  const src = ["app.js", "sim.js", "style.css", "index.html"].map((name) => readFileSync(new URL(`../public/games/esik/${name}`, import.meta.url), "utf8")).join("\n");
  assert.match(src, /stroke-dasharray/);
  assert.doesNotMatch(src, /metro|istasyon|İstanbul|Istanbul|station/i);
});
