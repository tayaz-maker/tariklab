import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  advanceMinutes,
  canonicalState,
  validateState,
} from "../simulation/engine.ts";
import {
  scheduleBackgroundTravel,
  economyMinute,
  closeAttendanceDay,
  attendedWage,
  produceBusiness,
  startShock,
  economyDayEnd,
  recordSale,
  validateEconomy,
  economyView,
} from "../simulation/economy.ts";
import { societyMinute } from "../simulation/society.ts";
import { transfer } from "../simulation/ledger.ts";
import { mobilityMinute } from "../simulation/mobility.ts";
const clock = (s: ReturnType<typeof createWorld>, minute: number) => {
  s.minute = minute;
  s.tick = (minute - 480) * 10;
  mobilityMinute(s);
};
test("SE-011 background workers retain departure location until actual scheduled arrival and cannot earn absent wages", () => {
  const s = createWorld(),
    n = s.npcs[100],
    origin = { ...n.location };
  scheduleBackgroundTravel(s, n, { goal: "work", building: "b-market" }, 100);
  const trip = s.economy.travel[n.id];
  assert.ok(trip.arrivalAt > s.minute);
  assert.deepEqual(n.location, origin);
  assert.equal(n.goal, "travel");
  closeAttendanceDay(s);
  assert.equal(attendedWage(s, n, 9600), 0);
  clock(s, trip.arrivalAt - 1);
  economyMinute(s);
  assert.deepEqual(n.location, origin);
  clock(s, trip.arrivalAt);
  economyMinute(s);
  assert.equal(n.location.scene, "b-market");
  assert.equal(s.economy.travel[n.id], undefined);
  clock(s, s.minute + 60);
  closeAttendanceDay(s);
  assert.equal(attendedWage(s, n, 9600), 1200);
  assert.deepEqual(validateEconomy(s), []);
});
test("SE-019 finite wholesale inputs are paid and conserved through one-to-one real output", () => {
  const s = createWorld(),
    b = s.businesses[0],
    n = s.npcs.find((n) => n.employerId === b.id)!;
  s.economy.attendance[n.id + "|" + b.id] = {
    personId: n.id,
    businessId: b.id,
    minutes: 480,
    since: null,
    day: 0,
  };
  b.employees = [n.id];
  const beforeStock = b.stock.simit,
    beforeRaw = s.economy.wholesaler.grain,
    beforeMoney = s.accounts["business:" + b.id];
  produceBusiness(s, b);
  const output = b.stock.simit - beforeStock;
  assert.ok(output > 0);
  assert.equal(beforeRaw - s.economy.wholesaler.grain, output);
  assert.equal(s.economy.consumedInputs.grain, output);
  assert.ok(s.accounts["business:" + b.id] < beforeMoney);
  assert.ok(s.accounts.wholesaler > 0);
  assert.deepEqual(validateEconomy(s), []);
  const depleted = createWorld(),
    shop = depleted.businesses[0];
  for (const r of Object.keys(depleted.economy.wholesaler)) {
    depleted.economy.consumedInputs[r] = depleted.economy.wholesaler[r];
    depleted.economy.wholesaler[r] = 0;
  }
  depleted.economy.attendance["n0|" + shop.id] = {
    personId: "n0",
    businessId: shop.id,
    minutes: 480,
    since: null,
    day: 0,
  };
  const stocks = { ...shop.stock };
  produceBusiness(depleted, shop);
  assert.deepEqual(shop.stock, stocks);
  assert.deepEqual(validateEconomy(depleted), []);
});
test("SE-019 production cannot create stock without labor or business funds", () => {
  const s = createWorld(),
    b = s.businesses[0],
    before = { ...b.stock };
  produceBusiness(s, b);
  assert.deepEqual(b.stock, before);
  s.economy.attendance["n0|" + b.id] = {
    personId: "n0",
    businessId: b.id,
    minutes: 480,
    since: null,
    day: 0,
  };
  assert.equal(
    transfer(
      s,
      "empty-business",
      "business:" + b.id,
      "external",
      s.accounts["business:" + b.id],
      "fixture",
    ),
    true,
  );
  produceBusiness(s, b);
  assert.deepEqual(b.stock, before);
  assert.deepEqual(validateEconomy(s), []);
});
test("SE-019 taxes use actual sales, double-sided payment and one assessment per daily total", () => {
  const s = createWorld(),
    b = s.businesses[0];
  clock(s, 1440);
  b.sales += 10000;
  recordSale(s, b.id, "simit", 2);
  const before = s.accounts.municipality;
  economyDayEnd(s);
  const tax = s.economy.tax.find((t) => t.businessId === b.id)!;
  assert.equal(tax.paid, 200);
  assert.equal(s.accounts.municipality, before + 200);
  economyDayEnd(s);
  assert.equal(tax.paid, 200);
  assert.equal(s.accounts.municipality, before + 200);
  assert.equal(economyView(s).taxPaid, 200);
});
test("SE-036 strikes require real distress and funded public works measurably constrain production", () => {
  const s = createWorld(),
    b = s.businesses[0];
  assert.equal(startShock(s, "strike", b.id), null);
  b.status = "distressed";
  const before = s.accounts.municipality,
    shock = startShock(s, "strike", b.id);
  assert.ok(shock);
  assert.equal(s.accounts.municipality, before - 5000);
  assert.equal(startShock(s, "strike", b.id), null);
  const clone = JSON.parse(canonicalState(s));
  clone.economy.shocks = [];
  for (const world of [s, clone]) {
    world.economy.attendance["n0|" + b.id] = {
      personId: "n0",
      businessId: b.id,
      minutes: 480,
      since: null,
      day: 0,
    };
    world.businesses[0].employees = ["n0"];
    produceBusiness(world, world.businesses[0]);
  }
  assert.ok(s.businesses[0].stock.simit < clone.businesses[0].stock.simit);
  assert.deepEqual(validateEconomy(s), []);
  const works = createWorld();
  assert.ok(startShock(works, "public-works", works.businesses[0].id));
  assert.equal(works.economy.shocks[0].budget, 5000);
  assert.equal(startShock(works, "migration", null, "missing-event"), null);
});
test("SE-011 shopping only consumes stock when the NPC has arrived at the open market", () => {
  const s = createWorld(),
    n = s.npcs[100];
  n.hunger = 90;
  clock(s, 540);
  const before = s.accounts[n.id];
  societyMinute(s);
  assert.equal(n.goal, "travel");
  assert.equal(s.accounts[n.id], before);
  assert.ok(s.economy.travel[n.id]);
});
test("SE-026 economic travel, attendance, taxes and inputs resume identically through ten days including scheduled public works", () => {
  const s = createWorld(810);
  advanceMinutes(s, 720);
  const resumed = JSON.parse(canonicalState(s));
  advanceMinutes(s, 10 * 1440);
  advanceMinutes(resumed, 10 * 1440);
  assert.equal(canonicalState(s), canonicalState(resumed));
  assert.deepEqual(validateState(s), []);
  assert.ok(s.economy.lastPayroll.some((p) => p.minutes > 0));
  assert.ok(economyView(s).taxPaid > 0);
  assert.ok(s.economy.shocks.length > 0);
});
