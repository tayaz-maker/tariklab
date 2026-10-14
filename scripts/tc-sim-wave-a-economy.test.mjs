import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { getMonthlySummary, getMonthlyEmploymentIncome } from "../public/games/tc-sim/js/life.js";
import { JOBS } from "../public/games/tc-sim/js/catalog.js";
import { formatPeriodMoney } from "../public/games/tc-sim/js/period-economy.js";
import { getOvertimePay } from "../public/games/tc-sim/js/time.js";
import { MARKET, MARKET_OWNERSHIP, marketShelfId, marketAvailableInYear, SUBSCRIPTIONS, VEHICLES, LIFESTYLE_TIERS } from "../public/games/tc-sim/js/wealth.js";
import { NAVIGATION_ITEMS, getNavigationTarget } from "../public/games/tc-sim/js/navigation.js";
import { migrateState, saveGame, loadGame } from "../public/games/tc-sim/js/save.js";

const whole = (value, label) => assert.equal(Number.isInteger(value), true, `${label}=${value}`);

test("her başlangıç profili ayı artı kapatır ve maaş kuruşsuzdur", () => {
  const profiles = ["balanced", "ambitious", "social"];
  const economics = ["tight", "modest", "stable"];
  const families = ["supportive", "demanding", "strained"];
  const educations = ["general", "vocational", "unfinished"];
  const eras = ["present_day", "1999-04-18", "2017-04-18", "1980s"];
  for (const profile of profiles) for (const economicBackground of economics) for (const familyBackground of families) for (const educationBackground of educations) for (const eraId of eras) {
    const state = createNewGame({ profile, economicBackground, familyBackground, educationBackground, eraId, seed: 11, now: "2026-10-14T00:00:00.000Z" });
    const check = validateState(state);
    assert.equal(check.ok, true, check.errors?.join("; "));
    const month = getMonthlySummary(state);
    whole(state.finances.balance, "nakit");
    whole(month.salary, "maaş");
    whole(month.income, "gelir");
    whole(month.expenses, "gider");
    whole(getMonthlyEmploymentIncome(state), "iş");
    assert.ok(month.income > month.expenses, `${profile}/${economicBackground}`);
    assert.equal(month.salary, 9000);
  }
});

test("katalog maaşı, ek mesai, abonelik ve araç gideri tam liradır", () => {
  for (const job of JOBS) whole(job.salary, job.id);
  for (const streak of [0, 1, 2, 3, 8, 20]) whole(getOvertimePay(streak), `mesai ${streak}`);
  for (const item of Object.values(SUBSCRIPTIONS)) whole(item.monthly, item.label);
  for (const item of Object.values(VEHICLES)) whole(item.monthly, item.label);
  for (const item of Object.values(LIFESTYLE_TIERS)) whole(item.monthly, item.label);
});

test("dönem maaşı ekranda kuruş göstermez; iç kalibrasyon bozulmaz", () => {
  for (const sample of [
    formatPeriodMoney(9000, 1999, "1999-04-18"),
    formatPeriodMoney(9000, 2017, "2017-04-18"),
    formatPeriodMoney(9000, 2025, "2025-01-01"),
    formatPeriodMoney(1, 2025, "2025-01-01"),
  ]) assert.doesNotMatch(sample, /,\d/, sample);
  assert.match(formatPeriodMoney(9000, 1999, "1999-04-18"), /TL \(eski\)$/);
  assert.match(formatPeriodMoney(9000, 2017, "2017-04-18"), /TL$/);
});

test("alışveriş rafları tüketimi böler; ev, araç ve eşya emlakta kalır", () => {
  assert.equal(getNavigationTarget("market"), "market");
  assert.equal(getNavigationTarget("emlak"), "emlak");
  assert.equal(NAVIGATION_ITEMS.find((item) => item.view === "market").label, "ALIŞVERİŞ");
  assert.equal(NAVIGATION_ITEMS.find((item) => item.view === "emlak").label, "EMLAK");
  const state = createNewGame({ seed: 3 });
  const seen = new Map();
  for (const [id, item] of Object.entries(MARKET)) {
    if (!marketAvailableInYear(state, item) || MARKET_OWNERSHIP[id]) continue;
    const shelf = marketShelfId(item.category || "Diğer");
    seen.set(shelf, (seen.get(shelf) || 0) + 1);
  }
  assert.equal(seen.get("gunluk"), 13);
  assert.ok(seen.get("gece") >= 1);
  assert.equal(Object.keys(MARKET_OWNERSHIP).length >= 9, true);
});

test("eski kayıt sürümü ve market görünüm kimliği durur", () => {
  const storage = { data: new Map(), getItem(k) { return this.data.get(k) ?? null; }, setItem(k, v) { this.data.set(k, v); }, removeItem(k) { this.data.delete(k); } };
  const state = createNewGame({ seed: 4, now: "2026-10-14T00:00:00.000Z" });
  assert.equal(saveGame(storage, state).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.meta.saveVersion, state.meta.saveVersion);
  assert.equal(loaded.state.finances.balance, state.finances.balance);
  const legacy = migrateState(JSON.parse(JSON.stringify({ ...state, meta: { ...state.meta, saveVersion: 5 } })));
  assert.equal(legacy.ok, true);
  assert.equal(legacy.state.career.jobId, "market");
});
