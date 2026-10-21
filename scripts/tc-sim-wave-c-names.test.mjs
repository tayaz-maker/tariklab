import test from "node:test";
import assert from "node:assert/strict";
import { SAVE_VERSION } from "../public/games/tc-sim/js/state.js";
import { NAVIGATION_ITEMS } from "../public/games/tc-sim/js/navigation.js";
import {
  LIFESTYLE_TIERS,
  SUBSCRIPTIONS,
  DURABLES,
  VEHICLES,
  SPENDING,
  MARKET,
  MARKET_OWNERSHIP,
} from "../public/games/tc-sim/js/wealth.js";

const VIEWS = [
  "dashboard",
  "inbox",
  "character",
  "calendar",
  "finance",
  "banks",
  "emlak",
  "market",
  "career",
  "education",
  "people",
  "relationships",
  "home",
  "body",
  "history",
  "yearbook",
];

const BANNED_CATEGORIES = [
  "Eğlence",
  "Ev eğlencesi",
  "Seyahat",
  "Günlük",
  "Günlük yaşam",
  "Kişisel bakım",
  "Teknoloji",
  "Ulaşım",
  "Sağlık / Spor",
  "Yetişkin / Gece",
  "Riskli / Yasadışı",
  "Hediyeler",
  "Dönem kültürü",
  "Giyim / Statü",
  "Bağlantı / Dijital",
];

function moneyFields(item) {
  return ["price", "cost", "monthly"].filter((key) => Object.hasOwn(item, key));
}

test("Wave C keeps save v6, view ids, and integer prices", () => {
  assert.equal(SAVE_VERSION, 6);
  assert.deepEqual(
    NAVIGATION_ITEMS.map((item) => item.view).filter(view => !["city","decisions","goals","saves","settings"].includes(view)),
    VIEWS,
  );
  assert.equal(NAVIGATION_ITEMS.find((item) => item.view === "finance").label, "Para");
  assert.equal(NAVIGATION_ITEMS.find((item) => item.view === "market").label, "Çarşı");
  assert.equal(Object.keys(SPENDING).length, 25);
  assert.equal(Object.keys(MARKET).length, 62);
  assert.equal(Object.keys(MARKET_OWNERSHIP).length, 9);
  for (const item of [
    ...Object.values(LIFESTYLE_TIERS),
    ...Object.values(SUBSCRIPTIONS),
    ...Object.values(DURABLES),
    ...Object.values(VEHICLES),
    ...Object.values(SPENDING),
    ...Object.values(MARKET),
  ]) {
    for (const key of moneyFields(item)) {
      assert.equal(Number.isInteger(item[key]), true, `${item.label} ${key}`);
    }
  }
});

test("Wave C names vehicles and major goods without moving prices or ids", () => {
  assert.deepEqual(Object.keys(VEHICLES), ["used", "standard", "premium"]);
  assert.equal(VEHICLES.used.label, "Renault Symbol 1.5");
  assert.equal(VEHICLES.used.price, 180000);
  assert.equal(VEHICLES.used.monthly, 3200);
  assert.equal(VEHICLES.standard.label, "Fiat Egea 1.4 Easy");
  assert.equal(VEHICLES.standard.price, 360000);
  assert.equal(VEHICLES.premium.label, "Volkswagen Passat 1.6");
  assert.equal(VEHICLES.premium.price, 720000);
  assert.equal(DURABLES.phone.label, "Samsung Galaxy A15");
  assert.equal(DURABLES.phone.price, 9000);
  assert.equal(DURABLES.computer.label, "Lenovo IdeaPad 3");
  assert.equal(DURABLES.computer.price, 18000);
  assert.equal(DURABLES.bike.label, "Salcano Explorer 28");
  assert.equal(DURABLES.bike.price, 6500);
  assert.equal(DURABLES.scooter.label, "Mondial Drift 125");
  assert.equal(DURABLES.scooter.price, 28000);
  assert.equal(MARKET.grocery.id, undefined);
  assert.equal(MARKET.grocery.label, "A101 haftalık poşet");
  assert.equal(MARKET.grocery.cost, 900);
  assert.equal(MARKET.new_phone.label, "Samsung Galaxy A15");
  assert.equal(MARKET.new_phone.cost, 18000);
  assert.equal(MARKET.feature_phone.label, "Nokia 3310");
  assert.equal(MARKET.feature_phone.cost, 8500);
  assert.equal(MARKET.laptop.label, "Lenovo IdeaPad 3");
  assert.equal(MARKET.bike.label, "Salcano Explorer 28");
  assert.equal(MARKET.scooter.label, "Mondial Drift 125");
  assert.equal(MARKET_OWNERSHIP.bike, "bike");
  assert.equal(MARKET_OWNERSHIP.scooter, "scooter");
  assert.equal(MARKET_OWNERSHIP.new_phone, "phone");
  assert.equal(LIFESTYLE_TIERS.modest.label, "İdare eder");
  assert.equal(LIFESTYLE_TIERS.modest.monthly, 0);
  assert.equal(LIFESTYLE_TIERS.high.monthly, 6500);
  assert.equal(SPENDING.coffee.label, "Bir kahve iç");
  assert.equal(SPENDING.coffee.cost, 180);
});

test("Wave C category names replaced the old shelf labels", () => {
  const categories = new Set(
    [...Object.values(SPENDING), ...Object.values(MARKET)].map((item) => item.category),
  );
  for (const banned of BANNED_CATEGORIES) assert.equal(categories.has(banned), false, banned);
  for (const expected of ["Bugün", "Mutfak", "Cihaz", "Yol", "Gece, 18+", "Risk, 18+", "Hat ve ekran"]) {
    assert.equal(categories.has(expected), true, expected);
  }
});
