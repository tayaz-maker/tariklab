import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createNewGame, transact, SAVE_VERSION } from "../public/games/tc-sim/js/state.js";
import { advanceWeek } from "../public/games/tc-sim/js/time.js";
import { getMonthlySummary } from "../public/games/tc-sim/js/life.js";
import { beginMonthlyCash, closeMonthlyCash, normalizeMonthlyCash, renderMonthlyCashCard } from "../public/games/tc-sim/js/monthly-cash.js";
import { processCashShortfall, buyDurable } from "../public/games/tc-sim/js/wealth.js";
import { tradeExchange } from "../public/games/tc-sim/js/exchange.js";
import { openIcraNotice, planIcra, payIcra } from "../public/games/tc-sim/js/icra.js";
import { migrateState, saveGame, loadGame } from "../public/games/tc-sim/js/save.js";
const game = () => { const s = createNewGame({ seed: 11, now: "2027-01-01T00:00:00.000Z" }); s.finances.balance = 100000; return s; };
const close = s => { s.time.month += 1; return closeMonthlyCash(s); };
class Storage {
  data = new Map();
  getItem(k) { return this.data.get(k) ?? null; }
  setItem(k, v) { this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
}

test("actual accumulator survives display-ledger truncation and never adds forecast values", () => {
  const s = game();
  for (let i = 0; i < 160; i++) transact(s, 10, "actual income", "income");
  transact(s, -300, "actual expense", "expense");
  const before = structuredClone(s.finances.monthCash);
  getMonthlySummary(s); getMonthlySummary(s);
  assert.deepEqual(s.finances.monthCash, before);
  assert.equal(s.finances.ledger.length, 120);
  const r = close(s);
  assert.equal(r.inflow, 1600);
  assert.equal(r.outflow, 300);
  assert.equal(r.closingBalance - r.openingBalance, 1300);
  assert.equal(r.otherChange, 0);
  assert.equal(closeMonthlyCash(s), null, "same calendar boundary cannot close twice");
  assert.equal(s.finances.lastMonthClose, r);
});

test("wealth and exchange cash writers participate without copying old ledger entries", () => {
  const s = game();
  const start = s.finances.balance;
  assert.ok(buyDurable(s, "phone").ok);
  assert.ok(tradeExchange(s, "USD", "buy", 10).ok);
  const r = close(s);
  assert.equal(r.outflow, start - s.finances.balance);
  assert.equal(r.inflow, 0);
  assert.equal(r.otherChange, 0);
});

test("D0 bookkeeping transfer is not income and icra payments are a subset of cash outflows", () => {
  const s = game();
  s.finances.balance = -15000;
  s.finances.monthCash = null;
  processCashShortfall(s);
  assert.equal(s.finances.monthCash.adjustments, 5000);
  assert.equal(s.finances.monthCash.inflow, 0);
  s.finances.balance = 10000; // fixture funding, not an invented transaction
  s.finances.monthCash = null;
  beginMonthlyCash(s);
  openIcraNotice(s, { source: "temerrut", amount: 5000 });
  assert.ok(planIcra(s).ok);
  assert.ok(payIcra(s).ok);
  const r = close(s);
  assert.equal(r.outflow, 5300);
  assert.equal(r.debtPayments, 5300);
  assert.equal(r.creditArrears, 0);
  assert.equal(r.closingBalance - r.openingBalance, -5300);
});

test("cap overflow is an accounting adjustment, never a cash repayment or lost debt", () => {
  const s = game();
  transact(s, -600, "İcra kalan borç tavan aşımı", "debt");
  const r = close(s);
  assert.equal(r.adjustments, -600);
  assert.equal(r.debtPayments, 0);
  assert.equal(r.outflow, 0);
  assert.equal(r.closingBalance - r.openingBalance, -600);
});

test("real week/month boundary persists one actual receipt and starts the next month separately", () => {
  const s = game();
  transact(s, 777, "Weekly receipt", "income");
  for (let i = 0; i < 4; i++) {
    s.events.active = null; s.events.queue = [];
    assert.ok(advanceWeek(s).ok);
  }
  const r = s.finances.lastMonthClose;
  assert.ok(r);
  assert.equal(r.month, 1);
  assert.ok(r.inflow >= 777);
  assert.equal(r.closingBalance - r.openingBalance, r.inflow - r.outflow + r.adjustments + r.otherChange);
  assert.equal(s.finances.monthCash.month, 2);
  assert.equal(s.finances.monthCash.partial, false);
  const frozen = structuredClone(r);
  transact(s, 123, "New month receipt", "income");
  assert.deepEqual(s.finances.lastMonthClose, frozen);
  const storage = new Storage();
  assert.ok(saveGame(storage, s).ok);
  const loaded = loadGame(storage);
  assert.ok(loaded.ok);
  assert.deepEqual(loaded.state.finances.lastMonthClose, frozen);
  assert.deepEqual(loaded.state.finances.monthCash, s.finances.monthCash);
});

test("V5/V6 missing fields do not invent reports or replay ledger history; first observed month is partial", () => {
  for (const version of [5, 6]) {
    const s = game();
    s.meta.saveVersion = version;
    s.time.weekOfMonth = 3;
    delete s.finances.monthCash; delete s.finances.lastMonthClose;
    s.finances.ledger.push({ week: 1, amount: 99999, reason: "old", category: "income" });
    const migrated = migrateState(s);
    assert.ok(migrated.ok);
    assert.equal(SAVE_VERSION, 6);
    assert.equal(migrated.state.finances.lastMonthClose, null);
    assert.equal(migrated.state.finances.monthCash, null);
    transact(migrated.state, 100, "new", "income");
    const r = close(migrated.state);
    assert.equal(r.inflow, 100);
    assert.equal(r.partial, true);
  }
});

test("invalid persisted totals are discarded without changing money; receipts stay bounded", () => {
  const s = game();
  const balance = s.finances.balance;
  s.finances.monthCash = { version: 1, inflow: NaN };
  s.finances.lastMonthClose = { year: '<script>bad</script>' };
  normalizeMonthlyCash(s);
  assert.equal(s.finances.monthCash, null);
  assert.equal(s.finances.lastMonthClose, null);
  assert.equal(s.finances.balance, balance);
  for (let year = 2027; year < 2047; year++) for (let month = 1; month <= 12; month++) {
    s.time.year = year; s.time.month = month;
    s.finances.monthCash = null;
    transact(s, 100, "actual", "income");
    s.time.month = month === 12 ? 1 : month + 1;
    if (month === 12) s.time.year += 1;
    closeMonthlyCash(s);
  }
  assert.ok(JSON.stringify([s.finances.monthCash, s.finances.lastMonthClose]).length < 800);
});

test("TR/EN/PL single card reports cash basis, debt subset and live remaining rights without mutation", () => {
  const s = game();
  transact(s, 4000, "Loan drawdown", "debt");
  transact(s, -500, "Debt payment", "debt");
  const r = close(s);
  for (const [language, title] of [["tr", "Son kapanan ay"], ["en", "Last closed month"], ["pl", "Ostatni zamknięty miesiąc"]]) {
    const before = structuredClone(r);
    const html = renderMonthlyCashCard(r, n => `${n} TL`, 6, language);
    assert.equal((html.match(/<section /g) || []).length, 1);
    assert.ok(html.includes(title));
    assert.ok(html.includes("4000 TL") && html.includes("500 TL") && html.includes("3500 TL"));
    assert.ok(html.includes("<strong>6</strong>"));
    assert.deepEqual(r, before);
  }
  assert.equal(renderMonthlyCashCard(null, String, 8), "");
  const app = readFileSync("public/games/tc-sim/js/app.js", "utf8");
  assert.match(app, /renderMonthlyCashCard\(state.finances.lastMonthClose/);
  assert.match(app, /formatPeriodMoney\(value, receipt.year/);
});
