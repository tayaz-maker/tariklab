import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  loadExpansionRuntime,
  getActions,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { getExpansionView } from "../public/games/tc-sim-boardworld/expansion.mjs";
import { exportGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
import {
  underworldOrder,
  fulfillUnderworldOrder,
  economyView,
} from "../public/games/tc-sim-boardworld/expansion-economy.mjs";
import { districtForLot } from "../public/games/tc-sim-boardworld/expansion-districts.mjs";

await loadExpansionRuntime();
const fresh = () => createGame({ seed: 811, scenario: "graduate", expansion: true });

test("living-world discovery is pure and does not materialize legacy save namespaces", () => {
  const state = fresh();
  const bytes = exportGame(state);
  const original = structuredClone(state);
  for (let pass = 0; pass < 3; pass++) {
    getActions(state);
    getExpansionView(state);
  }
  assert.deepEqual(state, original);
  assert.equal(exportGame(state), bytes);
  assert.equal(Object.hasOwn(state.expansion, "districts"), false);
  assert.equal(Object.hasOwn(state.expansion, "underworld"), false);
});

test("organization supply orders debit the canonical buyer and add exactly the delivered stock", () => {
  const state = fresh();
  for (const region of ["istanbul", "ankara", "izmir"]) {
    const order = underworldOrder(state, region);
    assert.ok(order);
    const account = state.expansion.economy.firms[order.firmId];
    const before = { ...account };
    const units = Math.min(2, order.capacity);
    const paid = fulfillUnderworldOrder(state, order.firmId, units, order.price);
    assert.equal(paid, order.price * units);
    assert.equal(account.cash, before.cash - paid);
    assert.equal(account.stock, before.stock + units);
    assert.equal(account.costs, before.costs + paid);
    assert.equal(account.revenue, before.revenue);
    assert.ok(validateState(state));
  }
});

test("stale, over-capacity and insolvent orders cannot partially transfer funds or stock", () => {
  const original = fresh();
  const order = underworldOrder(original, "ankara");
  assert.ok(order);
  for (const [units, price] of [
    [0, order.price],
    [4, order.price],
    [1, order.price + 1],
  ]) {
    const state = structuredClone(original);
    assert.equal(fulfillUnderworldOrder(state, order.firmId, units, price), 0);
    assert.deepEqual(state, original);
  }
  // Explicit rare-branch controls: a changed buyer cannot honor the old quote.
  for (const mutation of [
    (account) => {
      account.stock = 12;
    },
    (account) => {
      account.cash = 0;
    },
    (account) => {
      account.costs = 1_000_000_000;
    },
  ]) {
    const state = structuredClone(original);
    mutation(state.expansion.economy.firms[order.firmId]);
    const before = structuredClone(state);
    assert.equal(fulfillUnderworldOrder(state, order.firmId, 1, order.price), 0);
    assert.deepEqual(state, before);
  }
});

test("all existing titles map to real districts while fixed leases retain contracted rent", () => {
  const state = fresh();
  const view = getExpansionView(state);
  const ids = new Set(view.districts.districts.map((row) => row.id));
  for (const property of economyView(state).properties)
    assert.ok(ids.has(districtForLot(property.id)), property.id);
  // Prepared contract control, not a claimed earned housing journey.
  const property = state.expansion.economy.properties["ankara:room"];
  property.lease = {
    tenant: "household",
    rent: 791,
    deposit: 791,
    dueDay: 31,
    arrears: 0,
    missed: 0,
  };
  const rent = () => economyView(state).properties.find((row) => row.id === "ankara:room").rent;
  assert.equal(rent(), 791);
  state.expansion.world.regions.ankara.price = 170;
  assert.equal(rent(), 791);
});
