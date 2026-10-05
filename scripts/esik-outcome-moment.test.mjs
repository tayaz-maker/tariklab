import test from "node:test";
import assert from "node:assert/strict";
import { apply, createCoast } from "../public/games/esik/sim.js";
import { buildCoastOutcome } from "../public/games/esik/outcome-moment.js";

test("link result is derived from committed state rather than forecast", () => {
  const before = createCoast(4);
  const after = apply(before, "bagla:rihtim");
  const model = buildCoastOutcome(before, after, "bagla:rihtim");
  assert.equal(model.nodeName.tr, "Rıhtım");
  assert.equal(model.terrain, "water");
  assert.equal(model.deltas.resource, after.resource - before.resource);
  assert.equal(model.deltas.risk, after.risk - before.risk);
  assert.equal(before.line.length, 0);
});

test("closing a period shows real delayed settlement without replay on load", () => {
  let state = createCoast(3);
  state = apply(state, "bagla:iskele");
  const before = state;
  const after = apply(before, "kapat");
  const model = buildCoastOutcome(before, after, "kapat");
  assert.equal(model.kind, "period");
  assert.equal(model.period, before.period);
  assert.equal(model.deltas.trust, after.trust - before.trust);
  assert.equal(buildCoastOutcome(after, after, "kapat"), null);
});
