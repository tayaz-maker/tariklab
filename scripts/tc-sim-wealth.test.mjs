import test from "node:test";
import assert from "node:assert/strict";
import {
  createNewGame,
  normalizeEducationCareer,
  validateState,
} from "../public/games/tc-sim/js/state.js?v=8";
import { getMonthlySummary } from "../public/games/tc-sim/js/life.js?v=8";
import { advanceWeek } from "../public/games/tc-sim/js/time.js?v=8";
import { estateSnapshot, continueGeneration } from "../public/games/tc-sim/js/lifetime.js?v=8";
import {
  neutralWealth,
  normalizeWealth,
  setLifestyle,
  spendLifestyle,
  toggleSubscription,
  buyDurable,
  tradeInvestment,
  buyVehicle,
  sellVehicle,
  buyProperty,
  sellProperty,
  setPropertyOccupancy,
  processWealthMonthEnd,
  netWorth,
  WEALTH_LIMITS,
} from "../public/games/tc-sim/js/wealth.js?v=8";

const game = (money = 100000) => {
  const s = createNewGame({ name: "Servet Testi", seed: 113 });
  s.finances.balance = money;
  return s;
};
const nextWeek = (s) => {
  s.time.absoluteWeek++;
  s.weekly = { used: 0, selectedIds: [] };
};

test("old v5 saves receive neutral wealth without invented assets or transactions", () => {
  const s = game();
  delete s.wealth;
  const before = s.finances.balance;
  normalizeEducationCareer(s);
  assert.deepEqual(s.wealth, neutralWealth());
  assert.equal(s.finances.balance, before);
  assert.equal(validateState(s).ok, true);
});

test("lifestyle and experiences have real cost, weekly opportunity cost and anti-farming", () => {
  const s = game();
  assert.equal(setLifestyle(s, "comfortable").ok, true);
  assert.equal(setLifestyle(s, "high").ok, false);
  const before = s.finances.balance;
  assert.equal(spendLifestyle(s, "cinema").ok, true);
  assert.equal(s.finances.balance, before - 700);
  assert.equal(s.weekly.used, 1);
  assert.equal(spendLifestyle(s, "cinema").ok, false);
  nextWeek(s);
  assert.equal(spendLifestyle(s, "cinema").ok, false);
  // Lowering living costs remains available even during the upgrade cooldown.
  assert.equal(setLifestyle(s, "modest").ok, true);
});

test("subscriptions bill once per month and cancellation stops the next charge", () => {
  const s = game();
  const original = s.finances.balance;
  toggleSubscription(s, "streaming");
  const before = s.finances.balance;
  assert.equal(before, original - 180);
  assert.equal(processWealthMonthEnd(s), true);
  assert.equal(s.finances.balance, before);
  assert.equal(processWealthMonthEnd(s), false);
  toggleSubscription(s, "streaming");
  s.time.absoluteWeek += 4;
  assert.equal(processWealthMonthEnd(s), true);
  assert.equal(s.finances.balance, before);
});

test("owned durable cannot be repurchased and keeps one item per category", () => {
  const s = game();
  assert.equal(buyDurable(s, "phone").ok, true);
  const afterFirst = s.finances.balance;
  nextWeek(s);
  assert.equal(buyDurable(s, "phone").ok, false);
  assert.equal(s.wealth.durables.filter((x) => x.id === "phone").length, 1);
  assert.equal(s.finances.balance, afterFirst);
  assert.ok(s.wealth.durables.length <= WEALTH_LIMITS.durables);
});

test("investment spread blocks same-week churn and deterministic month valuation survives reload", () => {
  const s = game();
  const before = s.finances.balance;
  assert.equal(tradeInvestment(s, "fund", 5000).ok, true);
  assert.equal(s.finances.balance, before - 5050);
  assert.equal(tradeInvestment(s, "fund", -5000).ok, false);
  processWealthMonthEnd(s);
  const value = s.wealth.investments[0].value;
  const copy = structuredClone(s);
  normalizeWealth(copy);
  assert.equal(processWealthMonthEnd(copy), false);
  assert.equal(copy.wealth.investments[0].value, value);
  nextWeek(copy);
  assert.equal(tradeInvestment(copy, "fund", -5000).ok, value >= 5000);
});

test("vehicle financing, recurring debt and sale settle the linked loan without duplicate cash", () => {
  const s = game(300000);
  assert.equal(buyVehicle(s, "used", true).ok, true);
  const principal = s.wealth.debts[0].principal;
  processWealthMonthEnd(s);
  assert.ok(s.wealth.debts[0].principal < principal);
  nextWeek(s);
  const before = s.finances.balance;
  const expectedNet = Math.max(0, s.wealth.vehicle.currentValue - s.wealth.debts[0].principal);
  assert.equal(sellVehicle(s).ok, true);
  assert.equal(s.wealth.vehicle, null);
  assert.equal(s.wealth.debts.length, 0);
  assert.equal(sellVehicle(s).ok, false);
  assert.equal(s.finances.balance, before + expectedNet);
});

test("owner home stops catalog rent while maintenance and mortgage replace it", () => {
  const s = game(700000);
  const renter = getMonthlySummary(s);
  assert.ok(renter.housingBreakdown.base > 0);
  assert.equal(buyProperty(s, "owner", false).ok, true);
  const owner = getMonthlySummary(s);
  assert.equal(owner.housingBreakdown.base, 0);
  assert.equal(owner.housingBreakdown.ownerOccupied, true);
  assert.equal(owner.wealth.maintenance, 1000);
  const id = s.wealth.properties[0].id;
  nextWeek(s);
  assert.equal(sellProperty(s, id).ok, true);
  assert.ok(getMonthlySummary(s).housingBreakdown.base > 0);
});

test("rental property income, mortgage payment and valuation process exactly once", () => {
  const s = game(200000);
  assert.equal(buyProperty(s, "rental", true).ok, true);
  const before = s.finances.balance,
    principal = s.wealth.debts[0].principal;
  assert.equal(processWealthMonthEnd(s), true);
  const after = s.finances.balance;
  assert.ok(after < before + 4200);
  assert.ok(s.wealth.debts[0].principal < principal);
  assert.equal(processWealthMonthEnd(s), false);
  assert.equal(s.finances.balance, after);
});

test("monthly production path posts wealth once through real week advancement", async () => {
  const s = game();
  toggleSubscription(s, "music");
  s.time.absoluteWeek = 4;
  s.time.weekOfMonth = 4;
  s.weekly.used = 2;
  const before = s.finances.balance;
  let result = advanceWeek(s);
  if (!result.ok && s.events.active) {
    const choice = s.events.active.choices?.[0]?.id;
    if (choice) {
      const { resolveEvent } = await import("../public/games/tc-sim/js/events.js?v=8");
      resolveEvent(s, choice);
      result = advanceWeek(s);
    }
  }
  assert.equal(result.ok, true);
  assert.equal(s.finances.ledger.filter((x) => x.reason === "Abonelikler").length, 1);
  assert.equal(s.finances.ledger.find((x) => x.reason === "Abonelikler").amount, -90);
  assert.notEqual(s.finances.balance, before);
});

test("net worth and estate count real assets once; successor receives only deterministic share", () => {
  const s = game(700000);
  buyProperty(s, "rental", false);
  nextWeek(s);
  tradeInvestment(s, "deposit", 5000);
  normalizeEducationCareer(s);
  s.parenthood.children = [
    {
      id: "adult-a",
      name: "Ada",
      bornWeek: s.time.absoluteWeek - 20 * 48,
      alive: true,
      otherParentId: "elif",
      relationship: { closeness: 60, trust: 60, tension: 0 },
      adult: { path: "working", independent: true, milestones: 1 },
      school: { issues: [] },
    },
  ];
  const worth = netWorth(s),
    estate = estateSnapshot(s);
  assert.equal(
    estate.net,
    Math.max(
      0,
      worth.cash + worth.investments + worth.property + worth.vehicle + worth.durables - worth.debt,
    ),
  );
  s.lifetime.death = {
    week: s.time.absoluteWeek,
    age: s.player.age,
    cause: "test",
    reportId: "r",
    estate,
  };
  s.lifetime.reports = [
    {
      id: "r",
      name: s.player.name,
      age: s.player.age,
      generation: 1,
      memories: [],
      years: [],
      children: [],
      career: { history: [] },
      estate,
    },
  ];
  const expected = estate.shares[0].amount;
  assert.equal(continueGeneration(s, "adult-a").ok, true);
  assert.equal(s.finances.balance, expected);
  assert.deepEqual(s.wealth, neutralWealth());
});

test("twenty-year strategy matrix stays deterministic, finite and bounded", () => {
  const run = (kind) => {
    const s = game(250000);
    if (kind !== "cash") tradeInvestment(s, kind, 50000);
    for (let month = 0; month < 240; month++) {
      s.time.absoluteWeek = month * 4 + 1;
      processWealthMonthEnd(s);
    }
    return { worth: netWorth(s), wealth: s.wealth };
  };
  for (const kind of ["cash", "deposit", "gold", "fund", "equity"]) {
    const a = run(kind),
      b = run(kind);
    assert.deepEqual(a, b);
    assert.ok(Number.isFinite(a.worth.total));
    assert.ok(Math.abs(a.worth.total) < 100000000);
    assert.ok(a.wealth.investments.length <= WEALTH_LIMITS.investments);
  }
});

test("vehicle creates a real bounded commute benefit without erasing work pressure", async () => {
  const { getWeeklyLifeLoad } = await import("../public/games/tc-sim/js/life.js?v=8");
  const s = game(300000);
  s.household.homeId = "outer";
  const before = getWeeklyLifeLoad(s).commute;
  buyVehicle(s, "used", false);
  const after = getWeeklyLifeLoad(s).commute;
  assert.equal(after, Math.max(0, before - 1));
  assert.ok(getWeeklyLifeLoad(s).load >= 0);
});

test("seventy-year asset paths remain finite, bounded and strategy-distinct", () => {
  const run = (kind) => {
    const s = game(900000);
    if (kind === "owner") buyProperty(s, "owner", false);
    if (kind === "rental") buyProperty(s, "rental", false);
    if (kind === "portfolio")
      for (const id of ["deposit", "gold", "fund", "equity"]) {
        tradeInvestment(s, id, 50000);
        nextWeek(s);
      }
    for (let month = 0; month < 840; month++) {
      s.time.absoluteWeek = month * 4 + 1;
      processWealthMonthEnd(s);
    }
    return netWorth(s);
  };
  const first = Object.fromEntries(
    ["cash", "owner", "rental", "portfolio"].map((k) => [k, run(k)]),
  );
  const second = Object.fromEntries(
    ["cash", "owner", "rental", "portfolio"].map((k) => [k, run(k)]),
  );
  assert.deepEqual(first, second);
  assert.equal(new Set(Object.values(first).map((x) => x.total)).size, 4);
  for (const result of Object.values(first)) {
    assert.ok(Number.isSafeInteger(result.total));
    assert.ok(Math.abs(result.total) < 100000000);
  }
});

test("vacancy is exclusive with rental income and changing occupancy uses real weekly time", () => {
  const s = game(600000);
  buyProperty(s, "rental", false);
  nextWeek(s);
  const id = s.wealth.properties[0].id;
  assert.equal(setPropertyOccupancy(s, id, "vacant").ok, true);
  assert.equal(getMonthlySummary(s).wealth.rental, 0);
  assert.equal(setPropertyOccupancy(s, id, "rental").ok, false);
  nextWeek(s);
  assert.equal(setPropertyOccupancy(s, id, "rental").ok, true);
  assert.equal(getMonthlySummary(s).wealth.rental, 4200);
});

test("underwater asset sale cannot erase debt without funding the settlement", () => {
  const s = game(70000);
  buyVehicle(s, "used", true);
  nextWeek(s);
  s.wealth.vehicle.currentValue = 1000;
  s.finances.balance = 0;
  const debt = s.wealth.debts[0].principal;
  assert.equal(sellVehicle(s).ok, false);
  assert.equal(s.wealth.debts[0].principal, debt);
  assert.ok(s.wealth.vehicle);
});

test("subscription, lifestyle, assets and loans round-trip without fabricated or duplicate effects", async () => {
  const { saveGame, loadGame } = await import("../public/games/tc-sim/js/save.js?v=8");
  const storage={data:new Map(),getItem(k){return this.data.get(k)??null},setItem(k,v){this.data.set(k,v)},removeItem(k){this.data.delete(k)}};
  const s=game(1500000); setLifestyle(s,"comfortable"); toggleSubscription(s,"gym"); buyProperty(s,"owner",true); nextWeek(s); buyVehicle(s,"used",true); nextWeek(s); buyDurable(s,"computer"); nextWeek(s); tradeInvestment(s,"gold",5000);
  assert.equal(saveGame(storage,s).ok,true); const loaded=loadGame(storage); assert.equal(loaded.ok,true);
  assert.deepEqual(loaded.state.wealth,s.wealth); assert.deepEqual(netWorth(loaded.state),netWorth(s));
  const balance=loaded.state.finances.balance; assert.equal(processWealthMonthEnd(loaded.state),true); const after=loaded.state.finances.balance;
  assert.equal(saveGame(storage,loaded.state).ok,true); const again=loadGame(storage).state;
  assert.equal(processWealthMonthEnd(again),false); assert.equal(again.finances.balance,after); assert.notEqual(after,balance);
});

test("long travel consumes two focus blocks and cannot become free recovery farming", () => {
  const s=game(100000); const before={money:s.finances.balance,stress:s.health.stress};
  assert.equal(spendLifestyle(s,"vacation").ok,true); assert.equal(s.weekly.used,2); assert.equal(s.finances.balance,before.money-22000); assert.ok(s.health.stress<before.stress);
  assert.equal(spendLifestyle(s,"coffee").ok,true); assert.equal(s.weekly.used,3); nextWeek(s); assert.equal(spendLifestyle(s,"vacation").ok,false);
});
