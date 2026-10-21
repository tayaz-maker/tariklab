import test from "node:test";
import assert from "node:assert/strict";
import { readPreferences, writePreference, restoreLastView } from "../public/games/tc-sim/js/ui-shell.js";
import { getNavigationTarget } from "../public/games/tc-sim/js/navigation.js";
import { statusFacts } from "../public/games/tc-sim/js/status-panel.js";
import { createNewGame } from "../public/games/tc-sim/js/state.js";
import { netWorth } from "../public/games/tc-sim/js/wealth.js";

test("UI preferences tolerate blocked/corrupt storage and cannot restore arbitrary views", () => {
  const denied = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  assert.deepEqual(readPreferences(denied), {}); assert.doesNotThrow(() => writePreference(denied, { collapsed: true }));
  let saved = "[1]";
  const storage = { getItem: () => saved, setItem: (_key, value) => { saved = value; } };
  assert.deepEqual(readPreferences(storage), {});
  writePreference(storage, { remember: true, lastView: "banks", panels: { account: false } });
  assert.equal(restoreLastView(storage, getNavigationTarget), "banks");
  writePreference(storage, { collapsed: true });
  assert.equal(readPreferences(storage).panels.account, false);
  writePreference(storage, { lastView: "<script>" });
  assert.equal(restoreLastView(storage, getNavigationTarget), "dashboard");
});

test("status uses canonical wealth, cash, debt and rights without mutating game data", () => {
  const state = createNewGame({ seed: 9 });
  state.wealth.debts.push({ id: "loan", type: "personal", principal: 600, monthlyPayment: 100 });
  state.finances.arrears = 40;
  const worth = netWorth(state), before = structuredClone(state);
  const facts = statusFacts(state, worth, 3);
  assert.equal(facts.cash, state.finances.balance); assert.equal(facts.wealth, worth.total);
  assert.equal(facts.due, 100); assert.equal(facts.arrears, 40); assert.equal(facts.remaining, 3);
  assert.deepEqual(state, before);
});
