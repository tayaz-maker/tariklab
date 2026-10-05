import test from "node:test";
import assert from "node:assert/strict";
import {
  TURKEY_CPI, approximateNominal, economyYear, formatPeriodMoney,
  periodCurrency, periodEconomyNote,
} from "../public/games/tc-sim/js/period-economy.js";

test("official annual CPI observations cover every historical year", () => {
  for (let year = 1980; year <= 2025; year++) {
    assert.ok(Number.isFinite(TURKEY_CPI[year]) && TURKEY_CPI[year] > 0, `${year}`);
    if (year > 1980) assert.ok(TURKEY_CPI[year] > TURKEY_CPI[year - 1], `${year}`);
  }
});

test("old TL, YTL and TL use their actual redenomination boundaries", () => {
  assert.equal(periodCurrency(2004), "TL (eski)");
  assert.equal(periodCurrency(2005), "YTL");
  assert.equal(periodCurrency(2008), "YTL");
  assert.equal(periodCurrency(2009), "TL");
  assert.ok(approximateNominal(9000, 1999) > 1_000_000);
  assert.match(formatPeriodMoney(9000, 1999), /TL \(eski\)$/);
});

test("the future is labelled as an unobserved game scenario", () => {
  const state = { world: { scenario: { currentDate: "2028-05-01" } }, time: { year: 2028 } };
  assert.equal(economyYear(state), 2028);
  assert.equal(approximateNominal(9000, 2030), approximateNominal(9000, 2025));
  assert.match(periodEconomyNote(2028), /tahmin edilmedi/);
});
