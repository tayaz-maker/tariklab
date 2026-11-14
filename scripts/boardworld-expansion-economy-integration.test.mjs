import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  getActions,
  loadExpansionRuntime,
  resolveAction,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";

await loadExpansionRuntime();

const e = (s) => s.expansion.economy;
const p = (s, id) => e(s).properties[id];

test("normal engine actions share stock, leases and ownership with the regional economy", () => {
  let s = createGame({ scenario: "restart", seed: 303, expansion: true });
  const apply = (id) => {
    const action = getActions(s).find((option) => option.id === id);
    assert.ok(action, id);
    const result = resolveAction(s, id);
    assert.equal(result.ok, true, result.message);
    assert.equal(validateState(result.state), true);
    s = result.state;
  };
  while (s.pendingEvents.length)
    apply(getActions(s).find((a) => a.id.startsWith("event:") && !a.disabled).id);
  s.bank = 100000;
  apply("business:start:repair");
  apply("business:fund:2000");
  apply("economy:hire");
  apply("economy:supplier:cooperative");
  const district = s.location;
  const stock = s.society.districts[district].materialStock;
  apply("business:stock:6");
  assert.equal(s.society.districts[district].materialStock, stock - 6);
  assert.equal(s.living.enterprise.stock, 6);
  apply("business:acquire");
  apply("business:serve");
  assert.ok(s.deep.business.revenue > 0);
  assert.ok(s.living.enterprise.stock < 6);
  apply("economy:mortgage:istanbul:room");
  apply("economy:occupy:istanbul:room");
  apply("world:move:ankara");
  assert.equal(e(s).home, "istanbul:room");
  const service = getActions(s).find((a) => a.id === "business:serve");
  assert.ok(service?.disabled);
  assert.ok(getActions(s).find((a) => a.id === "economy:rent:ankara:studio").disabled);
  apply("district:travel:ankara:cankaya");
  for (let attempts = 0; attempts < 30; attempts++) {
    while (s.pendingEvents.length)
      apply(getActions(s).find((a) => a.id.startsWith("event:") && !a.disabled).id);
    if (!getActions(s).find((a) => a.id === "district:visit:ankara:cankaya:housing").disabled)
      break;
    apply("wait:60");
  }
  apply("district:visit:ankara:cankaya:housing");
  apply("economy:rent:ankara:studio");
  assert.equal(e(s).home, "ankara:studio");
  assert.equal(p(s, "istanbul:room").owner, "household");
  assert.equal(e(s).business.region, "istanbul");
  assert.equal(s.housing.rent, 0);
});
