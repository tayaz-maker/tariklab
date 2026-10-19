import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, SAVE_VERSION, validateState } from "../public/games/tc-sim/js/state.js";
import { buyHolding, sellHolding, rentToLive, moveIntoHolding, letHolding } from "../public/games/tc-sim/js/quarters.js";
import { buyProperty, netWorth } from "../public/games/tc-sim/js/wealth.js";
import { migrateState, saveGame, loadGame } from "../public/games/tc-sim/js/save.js";

function game() {
  const s = createNewGame({ seed: 11, now: "2027-01-01T00:00:00.000Z" });
  s.finances.balance = 600000;
  s.events.active = null;
  s.events.queue = [];
  return s;
}
function nextWeek(s) {
  s.time.absoluteWeek += 1;
  s.weekly = { used: 0, selectedIds: [] };
}
class Storage {
  data = new Map();
  getItem(k) { return this.data.get(k) ?? null; }
  setItem(k, v) { this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
}

test("285000 TL semt purchase converts cash to property without destroying net worth", () => {
  const s = game();
  const before = netWorth(s).total;
  assert.ok(buyHolding(s, "sirt", "1+1").ok);
  const household = structuredClone(s.household);
  const ledger = structuredClone(s.finances.ledger);
  assert.equal(s.finances.balance, 315000);
  assert.equal(netWorth(s).property, 285000);
  assert.equal(netWorth(s).total, before);
  assert.deepEqual(s.household, household, "valuation must not normalize the live household in place");
  assert.deepEqual(s.finances.ledger, ledger, "valuation never posts cash");
  nextWeek(s);
  assert.ok(sellHolding(s, "sirt:1+1").ok);
  assert.equal(netWorth(s).property, 0);
  assert.equal(netWorth(s).total, before);
  assert.equal(sellHolding(s, "sirt:1+1").ok, false);
  assert.equal(s.finances.balance, 600000);
});

test("owned vacant, occupied and let homes count; rented homes do not", () => {
  const s = game();
  assert.ok(buyHolding(s, "sirt", "1+1").ok);
  nextWeek(s);
  assert.ok(moveIntoHolding(s, "sirt:1+1").ok);
  assert.equal(netWorth(s).property, 285000);
  const rental = game();
  assert.ok(rentToLive(rental, "ceper", "1+1").ok);
  assert.equal(netWorth(rental).property, 0);
  const letHome = game();
  assert.ok(buyHolding(letHome, "sirt", "1+1").ok);
  nextWeek(letHome);
  assert.ok(letHolding(letHome, "sirt:1+1").ok);
  assert.equal(netWorth(letHome).property, 285000);
});

test("both property registries count distinct homes; mortgage and arrears are deducted once", () => {
  const s = game();
  assert.ok(buyHolding(s, "sirt", "1+1").ok);
  nextWeek(s);
  const before = netWorth(s).total;
  assert.ok(buyProperty(s, "owner", true).ok);
  const mortgage = s.wealth.debts[0];
  assert.equal(mortgage.type, "mortgage");
  s.finances.arrears = 4000;
  const worth = netWorth(s);
  assert.equal(worth.property, 285000 + s.wealth.properties[0].currentValue);
  assert.equal(worth.debt, mortgage.principal + 4000);
  assert.equal(worth.total, before - 4000);
});

test("duplicate semt records and shared registry ids cannot inflate valuation", () => {
  const s = game();
  assert.ok(buyHolding(s, "sirt", "1+1").ok);
  const holding = s.household.semt.holdings[0];
  s.household.semt.holdings.push(structuredClone(holding));
  assert.equal(netWorth(s).property, 285000);
  s.wealth.properties.push({ id: holding.id, occupancy: "vacant", purchasePrice: 285000, currentValue: 285000 });
  assert.equal(netWorth(s).property, 285000);
});

test("V5/V6 saves preserve existing homes, balances and debt without invented assets", () => {
  for (const version of [5, 6]) {
    const s = game();
    assert.ok(buyHolding(s, "sirt", "1+1").ok);
    s.finances.arrears = 1234;
    s.meta.saveVersion = version;
    const raw = structuredClone(s);
    const migrated = migrateState(raw);
    assert.ok(migrated.ok);
    assert.equal(SAVE_VERSION, 6);
    assert.equal(migrated.state.meta.saveVersion, 6);
    assert.equal(netWorth(migrated.state).total, 600000 - 1234);
    assert.equal(migrated.state.finances.balance, 315000);
    const storage = new Storage();
    assert.ok(saveGame(storage, migrated.state).ok);
    const loaded = loadGame(storage);
    assert.ok(loaded.ok);
    assert.deepEqual(netWorth(loaded.state), netWorth(migrated.state));
    assert.equal(validateState(loaded.state).ok, true);
    const noSemt = game();
    noSemt.meta.saveVersion = version;
    delete noSemt.household.semt;
    const neutral = migrateState(noSemt);
    assert.ok(neutral.ok);
    assert.equal(netWorth(neutral.state).property, 0);
    assert.equal(netWorth(neutral.state).total, 600000);
  }
});

test("D0 + housing: installments, V5/V6 reload and early payoff conserve both asset and debt", async () => {
  const { openIcraNotice, planIcra, processIcraWeek, payIcra } = await import("../public/games/tc-sim/js/icra.js");
  for (const version of [5, 6]) {
    const s = game();
    s.finances.arrears = 4000;
    const before = netWorth(s).total;
    assert.ok(buyHolding(s, "sirt", "1+1").ok);
    openIcraNotice(s, { source: "temerrut", amount: 4000 });
    assert.ok(planIcra(s).ok);
    s.time.weekOfMonth = 1;
    processIcraWeek(s);
    assert.equal(s.finances.arrears, 1800);
    s.meta.saveVersion = version;
    const migrated = migrateState(structuredClone(s));
    assert.ok(migrated.ok);
    assert.ok(payIcra(migrated.state).ok);
    assert.equal(migrated.state.finances.arrears, 0);
    assert.equal(netWorth(migrated.state).property, 285000);
    assert.equal(netWorth(migrated.state).total, before - 240);
    assert.equal(migrated.state.openCases.find(c => c.type === "icra").status, "resolved");
    assert.equal(validateState(migrated.state).ok, true);
  }
});

test("D0 + housing: enforcement cap overflow preserves the home and the full liability", async () => {
  const { openIcraNotice, workaroundIcra, runHaciz } = await import("../public/games/tc-sim/js/icra.js");
  const s = game();
  assert.ok(buyHolding(s, "sirt", "1+1").ok);
  s.finances.balance = 0;
  s.finances.arrears = 300000;
  const before = netWorth(s).total;
  const file = openIcraNotice(s, { source: "temerrut", amount: 300000 });
  assert.ok(workaroundIcra(s).ok);
  assert.ok(runHaciz(s, file).ok);
  assert.equal(s.finances.arrears - s.finances.balance, 300600);
  assert.equal(netWorth(s).property, 285000);
  assert.equal(netWorth(s).total, before - 600);
  assert.equal(file.status, "resolved");
  assert.equal(validateState(s).ok, true);
});
