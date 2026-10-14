import test from "node:test";
import assert from "node:assert/strict";
import { SAVE_VERSION, createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { CITIES, DISTRICTS, locationCommute, socialTravel } from "../public/games/tc-sim/js/locations.js";
import { getMonthlySummary } from "../public/games/tc-sim/js/life.js";
import { getWeeklyActivityLimit } from "../public/games/tc-sim/js/state.js";
import { loadGame, saveGame } from "../public/games/tc-sim/js/save.js";
import { advanceWeek } from "../public/games/tc-sim/js/time.js";
import {
  QUARTERS,
  UNITS,
  SHOPS,
  RENT_SALT,
  buyHolding,
  rentToLive,
  moveIntoHolding,
  sellHolding,
  leaveHoldingEmpty,
  letHolding,
  renovateHolding,
  openShop,
  tendShop,
  closeShop,
  sellShop,
  processSemtWeek,
  semtRoll,
  rentalWeekNet,
  shopWeekNet,
  liveQuarterBill,
  normalizeSemt,
} from "../public/games/tc-sim/js/quarters.js";

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

const fresh = () => {
  const state = createNewGame({ name: "Semt", now: "2027-01-01T00:00:00.000Z", seed: 11 });
  state.finances.balance = 900000;
  return state;
};

const integers = (state) => state.finances.ledger.every((row) => Number.isInteger(row.amount));

test("üç kurgusal mahalle fiyatları tam lira ve sırayla artar; Ankara ile İzmir durur", () => {
  assert.deepEqual(Object.keys(QUARTERS), ["sirt", "kiyi", "ceper"]);
  assert.equal(CITIES.ankara, "Ankara");
  assert.equal(CITIES.izmir, "İzmir");
  assert.ok(DISTRICTS.some((item) => item.city === "ankara" && item.id === "cankaya"));
  assert.ok(DISTRICTS.some((item) => item.city === "izmir" && item.id === "konak"));
  for (const unit of Object.values(UNITS)) {
    assert.ok(unit.sirt.buy > unit.kiyi.buy && unit.kiyi.buy > unit.ceper.buy);
    assert.ok(unit.sirt.rent > unit.kiyi.rent && unit.kiyi.rent > unit.ceper.rent);
    for (const row of Object.values(unit)) {
      assert.ok(Number.isInteger(row.buy) && Number.isInteger(row.rent) && Number.isInteger(row.upkeep));
    }
  }
  for (const shop of Object.values(SHOPS)) {
    assert.ok(Number.isInteger(shop.startup) && Number.isInteger(shop.weeklyIn) && Number.isInteger(shop.weeklyOut));
  }
  assert.equal(SAVE_VERSION, 6);
});

test("alım, içine geçiş ve kiraya çıkış nakit ile bir karar hakkı yer", () => {
  const state = fresh();
  const before = state.finances.balance;
  const bought = buyHolding(state, "ceper", "1+1");
  assert.equal(bought.ok, true);
  assert.equal(state.weekly.used, 1);
  assert.equal(state.finances.balance, before - 150000);
  assert.equal(state.household.semt.holdings[0].occupancy, "empty");
  assert.equal(integers(state), true);
  const anneBefore = socialTravel(state, "anne");
  const moved = moveIntoHolding(state, "ceper:1+1");
  assert.equal(moved.ok, true);
  assert.equal(state.weekly.used, 2);
  assert.equal(state.household.location.districtId, "avcilar");
  assert.equal(state.household.semt.live.quarterId, "ceper");
  assert.ok(locationCommute(state) >= 2);
  const anne = socialTravel(state, "anne");
  assert.ok(anne.cost > anneBefore.cost);
  assert.equal(anne.slots, anneBefore.slots + 1);
  assert.equal(liveQuarterBill(state), 280);
  assert.equal(getMonthlySummary(state).housing, 280);
  assert.equal(moveIntoHolding(state, "ceper:1+1").ok, false);
});

test("kiraya verme dolu haftada gelir, boş haftada keser; tadilat değeri yükseltir", () => {
  const state = fresh();
  assert.equal(buyHolding(state, "kiyi", "2+1").ok, true);
  assert.equal(letHolding(state, "kiyi:2+1").ok, true);
  const holding = state.household.semt.holdings[0];
  let paid = null;
  let vacant = null;
  for (let week = 1; week < 80 && (!paid || !vacant); week += 1) {
    state.time.absoluteWeek = week;
    const roll = semtRoll(state, RENT_SALT + holding.acquiredWeek);
    if (!paid && roll >= 0.22) paid = week;
    if (!vacant && roll < 0.14) vacant = week;
  }
  assert.ok(paid && vacant);
  state.time.absoluteWeek = paid;
  state.household.semt.lastWeek = 0;
  const before = state.finances.balance;
  processSemtWeek(state);
  const gain = state.finances.balance - before;
  const expected = rentalWeekNet(holding, { managed: false, roll: semtRoll(state, RENT_SALT + holding.acquiredWeek) }).net;
  assert.equal(gain, expected);
  assert.ok(gain > 0);
  assert.equal(integers(state), true);
  state.time.absoluteWeek = vacant;
  state.household.semt.lastWeek = 0;
  const mid = state.finances.balance;
  processSemtWeek(state);
  assert.ok(state.finances.balance - mid <= 0);
  state.weekly.used = 0;
  state.weekly.selectedIds = [];
  state.time.absoluteWeek = 3;
  const current = () => state.household.semt.holdings[0];
  const value = current().value;
  assert.equal(renovateHolding(state, "kiyi:2+1").ok, true);
  assert.ok(current().value > value);
  assert.equal(renovateHolding(state, "kiyi:2+1").ok, false);
  state.weekly.used = 0;
  state.weekly.selectedIds = [];
  assert.equal(leaveHoldingEmpty(state, "kiyi:2+1").ok, true);
  assert.equal(current().occupancy, "empty");
  state.weekly.used = 0;
  state.weekly.selectedIds = [];
  assert.equal(sellHolding(state, "kiyi:2+1").ok, true);
  assert.equal(state.household.semt.holdings.length, 0);
});

test("tezgâh açılışı bir karar hakkı yer, uğramamak ciroyu düşürür, kapanış nakit döndürür", () => {
  const tended = shopWeekNet(SHOPS.cafe, { tended: true, roll: 0.5 });
  const ignored = shopWeekNet(SHOPS.cafe, { tended: false, roll: 0.5 });
  assert.ok(tended.net > ignored.net);
  assert.ok(Number.isInteger(tended.net) && Number.isInteger(ignored.net));
  const state = fresh();
  state.time.year = 1990;
  assert.equal(openShop(state, "kiyi", "ps").ok, false);
  state.time.year = 2027;
  assert.equal(openShop(state, "sirt", "bakkal").ok, false);
  const limit = getWeeklyActivityLimit(state);
  state.weekly.used = limit;
  assert.match(openShop(state, "ceper", "bakkal").reason, /karar hakkı/);
  state.weekly.used = 0;
  const before = state.finances.balance;
  assert.equal(openShop(state, "ceper", "bakkal").ok, true);
  assert.equal(state.weekly.used, 1);
  assert.equal(state.finances.balance, before - SHOPS.bakkal.startup);
  assert.equal(state.flags.business, undefined);
  state.household.semt.lastWeek = 0;
  processSemtWeek(state);
  assert.equal(state.finances.ledger.filter((row) => row.reason.includes("Bakkal")).length, 1);
  state.time.absoluteWeek += 1;
  state.household.semt.lastWeek = 0;
  const quiet = state.finances.balance;
  processSemtWeek(state);
  const quietNet = state.finances.balance - quiet;
  state.weekly.used = 0;
  state.weekly.selectedIds = [];
  assert.equal(tendShop(state).ok, true);
  state.household.semt.lastWeek = 0;
  const loud = state.finances.balance;
  processSemtWeek(state);
  assert.ok(state.finances.balance - loud > quietNet);
  state.weekly.used = 0;
  state.weekly.selectedIds = [];
  const closed = closeShop(state);
  assert.equal(closed.ok, true);
  assert.equal(state.household.semt.shop, null);
  state.weekly.used = 0;
  state.weekly.selectedIds = [];
  assert.equal(openShop(state, "kiyi", "lokanta").ok, true);
  state.weekly.used = 0;
  state.weekly.selectedIds = [];
  tendShop(state);
  const sale = sellShop(state);
  assert.equal(sale.ok, true);
  assert.match(sale.message, /baktığın/);
});

test("Ankara'daki iş, İstanbul mahallesine taşınmayı keser", () => {
  const state = fresh();
  state.household.homeId = "studio";
  state.household.livingWithFamily = false;
  state.household.location = { districtId: "cankaya", lastMoveWeek: 0 };
  state.player.city = "Ankara";
  const blocked = rentToLive(state, "sirt", "1+1");
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /şehir/);
  assert.equal(state.household.location.districtId, "cankaya");
});

test("kayıt sürümü 6 kalır; semtsiz eski kayıt açılır", () => {
  const state = fresh();
  assert.equal(buyHolding(state, "sirt", "1+1").ok, true);
  assert.equal(rentToLive(state, "sirt", "1+1").ok, false);
  state.weekly.used = 0;
  state.weekly.selectedIds = [];
  assert.equal(moveIntoHolding(state, "sirt:1+1").ok, true);
  const storage = new MemoryStorage();
  assert.equal(saveGame(storage, state).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.meta.saveVersion, 6);
  assert.equal(loaded.state.household.semt.live.quarterId, "sirt");
  assert.equal(loaded.state.household.semt.holdings.length, 1);
  assert.equal(validateState(loaded.state).ok, true);
  delete loaded.state.household.semt;
  loaded.state.meta.saveVersion = 6;
  const raw = JSON.stringify(loaded.state);
  const storage2 = new MemoryStorage();
  storage2.setItem("tariklab::tc-sim:active", "1");
  storage2.setItem("tariklab::tc-sim:1", raw);
  const migrated = loadGame(storage2);
  assert.equal(migrated.ok, true, migrated.message);
  assert.equal(migrated.state.meta.saveVersion, 6);
  assert.deepEqual(normalizeSemt(migrated.state).holdings, []);
  const again = fresh();
  again.finances.balance = 50000;
  assert.equal(openShop(again, "sirt", "cafe").ok, true);
  const week = advanceWeek(again);
  assert.equal(week.ok, true);
  assert.equal(validateState(again).ok, true);
});
