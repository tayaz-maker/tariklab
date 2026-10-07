import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, assertValidState } from "../public/games/tc-sim/js/state.js";
import { BUSINESS_TYPES, businessAvailability, closeBusiness, creditAvailability, processBusinessMonth, repayCredit, startBusiness, takeCredit } from "../public/games/tc-sim/js/bank-business.js";
import { getWealthActionAvailability, spendLifestyle } from "../public/games/tc-sim/js/wealth.js";
import { getJobById } from "../public/games/tc-sim/js/catalog.js";
import { isEligibleForJob } from "../public/games/tc-sim/js/education.js";

test("bank credit adds a real repayable debt, not free income", () => {
  const state = createNewGame({ seed: 17 });
  assert.equal(creditAvailability(state, "small").ok, true);
  const before = state.finances.balance;
  assert.equal(takeCredit(state, "small").ok, true);
  assert.equal(state.finances.balance - before, 12000);
  assert.equal(state.wealth.debts.find((debt) => debt.type === "personal").principal, 14400);
  assert.equal(creditAvailability(state, "small").ok, false);
  assert.doesNotThrow(() => assertValidState(state));
});

test("business access follows era and month-end settles only once", () => {
  const state = createNewGame({ seed: 22, eraId: "1999-04-18" });
  state.finances.balance = 100000;
  assert.equal(businessAvailability(state, "digital").ok, false);
  assert.ok(state.time.year >= BUSINESS_TYPES.internet.since);
  assert.equal(startBusiness(state, "internet").ok, true);
  const before = state.finances.balance;
  const result = processBusinessMonth(state);
  assert.ok(result.includes("İnternet kafe"));
  assert.notEqual(state.finances.balance, before);
  assert.equal(processBusinessMonth(state), "");
  assert.doesNotThrow(() => assertValidState(state));
});

test("credit can be repaid early and a business can be closed", () => {
  const state = createNewGame({ seed: 28 });
  state.finances.balance = 100000;
  assert.equal(takeCredit(state, "small").ok, true);
  state.weekly = { used: 0, selectedIds: [] };
  assert.equal(repayCredit(state).ok, true);
  assert.equal(state.wealth.debts.some((debt) => debt.type === "personal"), false);
  assert.equal(startBusiness(state, "repair").ok, true);
  state.weekly = { used: 0, selectedIds: [] };
  assert.equal(closeBusiness(state).ok, true);
  assert.equal(state.flags.business, undefined);
  assert.doesNotThrow(() => assertValidState(state));
});

test("market goods belong to their era and a later phone replaces an earlier phone", () => {
  const state = createNewGame({ seed: 23, eraId: "1999-04-18" });
  state.finances.balance = 50000;
  assert.equal(getWealthActionAvailability(state, "spend", "new_phone").ok, false);
  assert.equal(getWealthActionAvailability(state, "spend", "feature_phone").ok, true);
  assert.equal(spendLifestyle(state, "feature_phone").ok, true);
  assert.equal(state.wealth.durables.filter((item) => item.id === "phone").length, 1);
  state.time.year = 2010;
  state.time.date = "2010-04-18";
  state.weekly = { used: 0, selectedIds: [] };
  assert.equal(getWealthActionAvailability(state, "spend", "new_phone").ok, true);
  assert.equal(spendLifestyle(state, "new_phone").ok, true);
  assert.equal(state.wealth.durables.filter((item) => item.id === "phone").length, 1);
});

test("modern-only occupations cannot be accepted in an 1980s start", () => {
  const state = createNewGame({ seed: 29, eraId: "1980s" });
  state.time.year = 1980;
  assert.equal(isEligibleForJob(state, getJobById("developer")).ok, false);
  assert.equal(isEligibleForJob(state, getJobById("market")).ok, true);
});
