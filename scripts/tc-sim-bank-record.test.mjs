import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, SAVE_VERSION, validateState, normalizeEducationCareer } from "../public/games/tc-sim/js/state.js";
import { bankRecord, bankRecordText, recordBankMonth } from "../public/games/tc-sim/js/bank-record.js";
import { takeCredit, repayCredit, creditAvailability } from "../public/games/tc-sim/js/bank-business.js";
import { processWealthMonthEnd, processCashShortfall, netWorth } from "../public/games/tc-sim/js/wealth.js";
import { migrateState, saveGame, loadGame } from "../public/games/tc-sim/js/save.js";

const game = () => {
  const s = createNewGame({ seed: 17 });
  s.finances.balance = 100000;
  s.events.active = null;
  s.events.queue = [];
  return s;
};
class Storage {
  data = new Map();
  getItem(k) { return this.data.get(k) ?? null; }
  setItem(k, v) { this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
}
const resetWeek = s => { s.time.absoluteWeek += 1; s.weekly = { used: 0, selectedIds: [] }; };

test("legacy V5/V6 debt is not evidence of historical payments; score reads are pure", () => {
  for (const version of [5, 6]) {
    const s = game();
    s.meta.saveVersion = version;
    s.finances.arrears = 4000;
    s.wealth.debts.push({ id: "legacy", type: "personal", principal: 14400, monthlyPayment: 1200, startWeek: 1, linkedAssetId: null });
    const migrated = migrateState(s);
    assert.ok(migrated.ok);
    const before = structuredClone(migrated.state);
    assert.equal(bankRecord(migrated.state).score, null);
    assert.match(bankRecordText(migrated.state), /Henüz gözlenen/);
    assert.deepEqual(migrated.state, before);
    assert.equal(migrated.state.flags.bankRecord, undefined);
    assert.equal(netWorth(migrated.state).debt, 18400);
    assert.equal(SAVE_VERSION, 6);
  }
});

test("real origination/early closure keep cash and debt rules; cycling loans farms no score", () => {
  const s = game();
  for (let i = 0; i < 3; i++) {
    const before = netWorth(s).total;
    assert.ok(takeCredit(s, "small").ok);
    assert.equal(bankRecord(s).score, 50);
    assert.equal(netWorth(s).total, before - 2400);
    resetWeek(s);
    assert.ok(repayCredit(s).ok);
    assert.equal(bankRecord(s).score, 50);
    assert.equal(netWorth(s).total, before - 2400);
    assert.equal(repayCredit(s).ok, false);
    resetWeek(s);
  }
  assert.equal(bankRecord(s).originated, 3);
  assert.equal(bankRecord(s).closed, 3);
  assert.equal(bankRecord(s).paid, 0);
  const check = creditAvailability(s, "small");
  recordBankMonth(s, "default");
  assert.deepEqual(creditAvailability(s, "small"), check, "foundation does not change eligibility");
});

test("funded installments reward once; repeated month settlement does not pay or reward twice", () => {
  const s = game();
  assert.ok(takeCredit(s, "small").ok);
  assert.ok(processWealthMonthEnd(s));
  assert.equal(s.wealth.debts[0].principal, 13200);
  assert.equal(bankRecord(s).score, 52);
  assert.equal(bankRecord(s).paid, 1);
  const before = structuredClone(s);
  assert.equal(processWealthMonthEnd(s), false);
  assert.deepEqual(s, before);
});

test("unfunded installments and cap-overflow default do not masquerade as timely payment", () => {
  const s = game();
  assert.ok(takeCredit(s, "small").ok);
  s.finances.balance = 0;
  processWealthMonthEnd(s);
  assert.equal(bankRecord(s).score, 42);
  assert.equal(bankRecord(s).missed, 1);
  assert.equal(bankRecord(s).paid, 0);
  assert.equal(s.wealth.debts[0].principal, 13200, "existing debt settlement remains unchanged");
  s.finances.balance = -10600;
  s.finances.arrears = 300000;
  const before = netWorth(s).total;
  processCashShortfall(s);
  assert.equal(s.finances.balance, -10600);
  assert.equal(s.finances.arrears, 300000);
  assert.equal(netWorth(s).total, before);
  assert.equal(bankRecord(s).score, 38);
  assert.equal(bankRecord(s).missed, 0);
  assert.equal(bankRecord(s).default, 1);
  processCashShortfall(s);
  assert.equal(bankRecord(s).score, 38);
  assert.equal(bankRecord(s).default, 1);
});

test("same-period adverse observations override good ones independent of debt iteration order", () => {
  for (const outcomes of [["paid", "missed", "default"], ["default", "paid", "missed"]]) {
    const s = game();
    for (const outcome of outcomes) recordBankMonth(s, outcome);
    const r = bankRecord(s);
    assert.equal(r.score, 38);
    assert.equal(r.default, 1);
    assert.equal(r.paid + r.missed, 0);
    assert.equal(r.history.length, 1);
  }
});

test("V5/V6 round trips retain only observed history and period deduplication", () => {
  for (const version of [5, 6]) {
    const s = game();
    recordBankMonth(s, "paid");
    s.meta.saveVersion = version;
    const m = migrateState(s);
    assert.ok(m.ok);
    const storage = new Storage();
    assert.ok(saveGame(storage, m.state).ok);
    const loaded = loadGame(storage);
    assert.ok(loaded.ok);
    const before = bankRecord(loaded.state);
    recordBankMonth(loaded.state, "paid");
    assert.deepEqual(bankRecord(loaded.state), before);
    assert.equal(loaded.state.meta.saveVersion, 6);
    assert.ok(validateState(loaded.state).ok);
  }
});

test("720-week observations stay bounded; neutral/no-debt months create no credit history", () => {
  const s = game();
  processWealthMonthEnd(s);
  assert.equal(s.flags.bankRecord, undefined);
  for (let month = 0; month < 180; month++) {
    s.time.absoluteWeek = month * 4 + 1;
    recordBankMonth(s, month % 5 === 0 ? "missed" : "paid");
    recordBankMonth(s, month % 5 === 0 ? "missed" : "paid");
  }
  const r = bankRecord(s);
  assert.equal(r.paid, 144);
  assert.equal(r.missed, 36);
  assert.equal(r.history.length, 24);
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.ok(JSON.stringify(r).length < 1500);
});

test("malformed optional history is neutralized without corrupting game cash or V6 state", () => {
  const s = game(), balance = s.finances.balance;
  s.flags.bankRecord = { version: 1, score: "100", history: Array(1000).fill({ kind: "paid" }) };
  normalizeEducationCareer(s);
  assert.equal(bankRecord(s).score, null);
  assert.equal(bankRecord(s).history.length, 0);
  assert.equal(s.finances.balance, balance);
  assert.equal(SAVE_VERSION, 6);
});

test("TR/EN/PL bank status shows the same observed numbers and fictional-score explanation", () => {
  const s = game();
  recordBankMonth(s, "paid");
  for (const lang of ["tr", "en", "pl"]) {
    const text = bankRecordText(s, lang);
    assert.match(text, /52\/100/);
    assert.match(text, /0–100/);
    if (lang !== "tr") assert.doesNotMatch(text, /Banka sicili|zamanında|gerçek bir/);
  }
});


test("final funded installment records closure once; failed loan actions create no history", () => {
  const s = game();
  s.weekly.used = 99;
  assert.equal(takeCredit(s, "small").ok, false);
  assert.equal(repayCredit(s).ok, false);
  assert.equal(s.flags.bankRecord, undefined);
  s.weekly.used = 0;
  assert.ok(takeCredit(s, "small").ok);
  s.wealth.debts[0].principal = 1200;
  processWealthMonthEnd(s);
  assert.equal(s.wealth.debts.length, 0);
  assert.equal(bankRecord(s).closed, 1);
  assert.equal(bankRecord(s).score, 52);
  processWealthMonthEnd(s);
  assert.equal(bankRecord(s).closed, 1);
});
