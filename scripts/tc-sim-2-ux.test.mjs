import test from "node:test";
import assert from "node:assert/strict";
import { readPreferences, writePreference, restoreLastView } from "../public/games/tc-sim/js/ui-shell.js";
import { getNavigationTarget } from "../public/games/tc-sim/js/navigation.js";
import { statusFacts } from "../public/games/tc-sim/js/status-panel.js";
import { createNewGame, transact } from "../public/games/tc-sim/js/state.js";
import { netWorth, CASH_ARREARS_CAP } from "../public/games/tc-sim/js/wealth.js";

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


// The global status reads the same liabilities as bank statements and mortgage
// settlement. A linked enforcement case never adds a second copy of its loan.
import { applyBankAction } from "../public/games/tc-sim/js/bank-actions.js";
import { bankCard } from "../public/games/tc-sim/js/bank-accounts.js";
import { processBankCardsMonth } from "../public/games/tc-sim/js/bank-cards.js";
import { newMortgage } from "../public/games/tc-sim/js/mortgage.js";
import { claimOf, openIcraNotice } from "../public/games/tc-sim/js/icra.js";
function cardFixture() {
  const state = createNewGame({ seed: 9 });
  const act = (action, extra = {}) => applyBankAction(state, {
    revision: state.finances.banking.revision, action, accountId: "bank-ziraat-personal", ...extra,
  });
  assert.equal(act("open", { bankId: "ziraat", kind: "personal" }).ok, true);
  assert.equal(act("card-open").ok, true);
  assert.equal(act("card-advance", { amount: 1000 }).ok, true);
  assert.equal(act("withdraw", { amount: 1000 }).ok, true);
  return state;
}
test("status includes card minimum and linked mortgage overdue once, without mutating saved data", () => {
  const state = cardFixture();
  Object.assign(bankCard(state, "bank-ziraat-personal"), { minimumDue: 200, overdue: 50 });
  state.finances.arrears = 40;
  state.wealth.debts.push({ id: "mortgage-status", type: "mortgage", principal: 10000, monthlyPayment: 1000,
    mortgage: { ...newMortgage(10000), overdue: 300, missedMonths: 3 } });
  for (const enforced of [false, true]) {
    if (enforced) assert.ok(openIcraNotice(state, claimOf(state)));
    const worth = netWorth(state), before = JSON.stringify(state), facts = statusFacts(state, worth, 3);
    assert.equal(facts.due, 1500); assert.equal(facts.arrears, 390);
    assert.equal(facts.bank, worth.bank); assert.equal(facts.wealth, worth.total);
    assert.equal(JSON.stringify(state), before);
  }
});
test("status follows card default transfer into arrears without retaining a duplicate card minimum", () => {
  const state = cardFixture();
  for (let month = 1; month <= 4; month++) {
    state.time.absoluteWeek = month * 4 + 1;
    processBankCardsMonth(state, month, transact, CASH_ARREARS_CAP);
  }
  assert.equal(bankCard(state, "bank-ziraat-personal").blocked, true);
  assert.ok(state.finances.arrears > 1020);
  const before = JSON.stringify(state), facts = statusFacts(state, netWorth(state), 3);
  assert.equal(facts.due, 0); assert.equal(facts.arrears, state.finances.arrears);
  assert.equal(JSON.stringify(state), before);
});
