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
  const src = ["app.js", "sim.js", "style.css", "index.html", "map-model.js", "map-pixi.js"].map((name) => readFileSync(new URL(`../public/games/esik/${name}`, import.meta.url), "utf8")).join("\n");
  assert.match(src, /stroke-dasharray/);
  assert.doesNotMatch(src, /metro|istasyon|İstanbul|Istanbul|station/i);
});

test("the map render model is a pure function of state -- both renderers see the same data", async () => {
  const { buildMapRenderModel } = await import("../public/games/esik/map-model.js");
  const { NODES, LINKS } = await import("../public/games/esik/sim.js");
  const empty = buildMapRenderModel(createCoast(1));
  assert.equal(empty.nodes.length, NODES.length);
  assert.equal(empty.links.length, LINKS.length);
  assert.ok(empty.nodes.every((n) => n.active === false));
  assert.ok(empty.links.every((l) => l.active === false));
  // Deterministic for the same state -- no hidden randomness or mutation.
  assert.deepEqual(buildMapRenderModel(createCoast(1)), empty);

  const linked = apply(createCoast(1), "bagla:rihtim");
  const withRoute = buildMapRenderModel(linked);
  const rihtim = withRoute.nodes.find((n) => n.id === "rihtim");
  assert.equal(rihtim.active, true);
  assert.ok(withRoute.nodes.find((n) => n.id !== "rihtim" && n.active === false));

  const faulted = apply(linked, "bagla:merdiven");
  const withFault = buildMapRenderModel(faulted);
  assert.equal(withFault.nodes.filter((n) => n.fault).length, faulted.fault ? 1 : 0);
  if (faulted.fault) assert.equal(withFault.nodes.find((n) => n.fault).id, faulted.fault.id);

  // Every node/link id in the model resolves to a real sim node -- no typo,
  // no orphan reference that a renderer would silently drop.
  const byId = new Set(NODES.map((n) => n.id));
  for (const n of withRoute.nodes) assert.ok(byId.has(n.id), n.id);
  for (const l of withRoute.links) {
    assert.ok(byId.has(l.a), l.a);
    assert.ok(byId.has(l.b), l.b);
  }
});

test("a paced full route and a short neighbourhood route do not share an ending", () => {
  function run(script) {
    let state = createCoast(5);
    for (const move of script) {
      if (state.phase === "end") break;
      if (!legal(state).includes(move)) throw new Error(`illegal ${move} at ${state.period} res ${state.resource} line ${state.line}`);
      state = apply(state, move);
    }
    return state.ending;
  }
  assert.equal(run([
    "bagla:rampa", "bagla:merdiven", "rampa:merdiven", "kapat",
    "bagla:iskele", "bagla:rihtim", "kapat",
    "bagla:tunel", "kapat",
    "bagla:yokus", "kapat",
    "rampa:yokus", "kapat",
    "bagla:kopru", "kapat",
  ]), "surekli");
  assert.equal(run([
    "bagla:rampa", "bagla:merdiven", "rampa:merdiven", "kapat",
    "bagla:iskele", "kapat",
    "bagla:yokus", "rampa:yokus", "kapat",
    "bekle", "bekle", "bekle",
  ]), "mahalle");
});
