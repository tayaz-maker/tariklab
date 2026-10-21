import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, validateState, SAVE_VERSION } from "../public/games/tc-sim/js/state.js";
import { deserializeState, migrateState, saveGame, loadGame } from "../public/games/tc-sim/js/save.js";
import { bankAccount, bankCard, bankTotals, normalizeBanking, validBanking } from "../public/games/tc-sim/js/bank-accounts.js";
import { applyBankAction, cardLimitAvailable } from "../public/games/tc-sim/js/bank-actions.js";
import { processBankCardsMonth } from "../public/games/tc-sim/js/bank-cards.js";
import { bankCreditPolicy } from "../public/games/tc-sim/js/bank-record.js";
import { transact } from "../public/games/tc-sim/js/state.js";
import { netWorth, normalizeWealth, processWealthMonthEnd, CASH_ARREARS_CAP } from "../public/games/tc-sim/js/wealth.js";
import { startBusiness, closeBusiness, processBusinessMonth } from "../public/games/tc-sim/js/bank-business.js";
import { openIcraNotice, runHaciz } from "../public/games/tc-sim/js/icra.js";
import { renderBankAccounts } from "../public/games/tc-sim/js/bank-ui.js";

const fresh = () => createNewGame({ seed: 17, now: "2026-10-21T00:00:00.000Z" });
const id = (bank = "ziraat", kind = "personal") => `bank-${bank}-${kind}`;
const act = (s, action, rest = {}) => applyBankAction(s, { revision: s.finances.banking.revision, action, accountId: id(), ...rest });
function open(s, bankId = "ziraat", kind = "personal") { assert.equal(act(s, "open", { bankId, kind }).ok, true); return id(bankId, kind); }
function reload(s) { const result = deserializeState(JSON.stringify(s)); assert.equal(result.ok, true, result.error); return result.state; }
function valid(s) { assert.deepEqual(validateState(s), { ok: true, errors: [] }); }
function funded(amount = 100000) { const s = fresh(); s.finances.balance = amount; open(s); return s; }

test("V5/V6 migrate deterministically without inventing cash, investments or a schema bump", () => {
  for (const version of [5, 6]) {
    const s = fresh(); delete s.finances.banking; s.meta.saveVersion = version;
    s.wealth.investments = [{ id: "deposit", value: 5000, basis: 4900, lastMonth: 0 }];
    const prior = { cash: s.finances.balance, investments: structuredClone(s.wealth.investments) };
    const first = migrateState(structuredClone(s)); assert.equal(first.ok, true);
    assert.equal(first.state.finances.balance, prior.cash);
    assert.deepEqual(first.state.wealth.investments, prior.investments);
    assert.equal(bankTotals(first.state).total, 0);
    assert.deepEqual(first.state, migrateState(structuredClone(first.state)).state);
    assert.equal(first.state.meta.saveVersion, 6); assert.equal(SAVE_VERSION, 6);
  }
});

test("explicit separate legacy bank balance migrates once, never duplicated with wallet or deposits", () => {
  const s = fresh(); delete s.finances.banking; s.finances.bankBalance = 12345;
  const cash = s.finances.balance, loaded = reload(s);
  assert.equal(bankTotals(loaded).total, 12345); assert.equal(loaded.finances.balance, cash);
  assert.equal(loaded.finances.bankBalance, undefined);
  assert.deepEqual(reload(loaded), loaded);
});

test("unsupported, malformed, duplicate and impossible banking contracts fail without repairing away funds", () => {
  const base = funded(); act(base, "deposit", { amount: 5000 });
  for (const corrupt of [s => { s.finances.banking.version = 2; }, s => { s.finances.banking.accounts.push(structuredClone(s.finances.banking.accounts[0])); },
    s => { s.finances.banking.accounts[0].balance = -1; }, s => { s.finances.banking.accounts[0].balance = Number.MAX_SAFE_INTEGER + 1; }]) {
    const s = structuredClone(base); corrupt(s);
    assert.equal(migrateState(s).ok, false); assert.equal(validBanking(s), false);
  }
});

test("three bank accounts have distinct balances/history; deposit, transfer and withdrawal conserve wealth", () => {
  const s = funded(); open(s, "isbank"); open(s, "garanti");
  const before = netWorth(s).total;
  assert.equal(act(s, "deposit", { amount: 10000 }).ok, true);
  assert.equal(act(s, "transfer", { amount: 7000, targetId: id("isbank") }).ok, true);
  assert.equal(act(s, "withdraw", { accountId: id("isbank"), amount: 2000 }).ok, true);
  assert.equal(bankAccount(s, id()).balance, 3000); assert.equal(bankAccount(s, id("isbank")).balance, 5000);
  assert.equal(bankAccount(s, id("garanti")).balance, 0); assert.equal(s.finances.balance, 92000);
  assert.equal(bankTotals(s).total, 8000); assert.equal(netWorth(s).total, before);
  assert.equal(s.weekly.used, 0); assert.equal(bankAccount(s, id()).history.length, 2); valid(reload(s));
});

test("a rendered revision cannot repeat a successful transfer after reload", () => {
  const s = funded(); const request = { revision: s.finances.banking.revision, action: "deposit", accountId: id(), amount: 10000 };
  assert.equal(applyBankAction(s, request).ok, true);
  const loaded = reload(s), before = structuredClone(loaded);
  assert.equal(applyBankAction(loaded, request).ok, false); assert.deepEqual(loaded, before);
});

test("bad amounts, insufficient cash, bad target and missing accounts roll back every byte", () => {
  const s = funded(1000); open(s, "isbank");
  for (const request of [{ action: "deposit", amount: 1001 }, { action: "deposit", amount: -1 }, { action: "deposit", amount: .5 },
    { action: "deposit", amount: Infinity }, { action: "withdraw", amount: 1 }, { action: "transfer", amount: 1, targetId: "missing" },
    { action: "withdraw", amount: 1, accountId: "missing" }]) {
    const before = structuredClone(s); assert.equal(act(s, request.action, request).ok, false); assert.deepEqual(s, before);
  }
});

test("account closure requires zero funds and preserves history through reopening", () => {
  const s = funded(); act(s, "deposit", { amount: 1000 });
  assert.equal(act(s, "close").ok, false); act(s, "withdraw", { amount: 1000 });
  assert.equal(act(s, "close").ok, true); assert.equal(bankAccount(s, id()), undefined);
  open(s); assert.equal(bankAccount(s, id()).history.length, 2); assert.equal(bankAccount(s, id()).balance, 0);
});

test("commercial ownership and explicit owner cash transfers keep personal and business accounts separate", () => {
  const s = funded(); assert.equal(act(s, "open", { bankId: "ziraat", kind: "commercial" }).ok, false);
  assert.equal(startBusiness(s, "repair").ok, true); const business = open(s, "ziraat", "commercial");
  assert.equal(act(s, "deposit", { accountId: business, amount: 5000 }).ok, true);
  assert.equal(bankTotals(s).commercial, 5000); assert.equal(bankTotals(s).personal, 0);
  assert.equal(act(s, "transfer", { accountId: business, targetId: id(), amount: 1000 }).ok, false);
  assert.equal(act(s, "withdraw", { accountId: business, amount: 1000 }).ok, true); valid(reload(s));
});

test("closing a business returns its account funds once and closes commercial accounts", () => {
  const s = funded(); startBusiness(s, "repair"); const business = open(s, "ziraat", "commercial");
  act(s, "deposit", { accountId: business, amount: 5000 }); const before = netWorth(s).total;
  s.weekly.used = 0; s.weekly.selectedIds = [];
  assert.equal(closeBusiness(s).ok, true); assert.equal(bankTotals(s).commercial, 0); assert.equal(netWorth(s).total, before);
  const after = structuredClone(s); assert.equal(closeBusiness(s).ok, false); assert.deepEqual(s, after); valid(reload(s));
});

test("personal origination binds lender/account to existing debt, preserves legacy wallet and duplicate guard", () => {
  const s = funded(), before = netWorth(s).total, wallet = s.finances.balance;
  assert.equal(act(s, "loan", { product: "personal", offer: "small" }).ok, true);
  assert.equal(s.finances.balance, wallet); assert.equal(bankAccount(s, id()).balance, 12000);
  assert.equal(s.wealth.debts[0].principal, 14400); assert.equal(s.wealth.debts[0].accountId, id());
  assert.equal(netWorth(s).total, before - 2400); assert.equal(act(s, "close").ok, false);
  assert.equal(act(s, "loan", { product: "personal", offer: "small" }).ok, false);
  assert.equal(reload(s).wealth.debts[0].accountId, id());
});

test("loan proceeds reach account even when the pre-existing wallet is negative", () => {
  const s = funded(-1000); assert.equal(act(s, "loan", { product: "personal", offer: "small" }).ok, true);
  assert.equal(s.finances.balance, -1000); assert.equal(bankAccount(s, id()).balance, 12000);
});

test("monthly installment and early repayment debit the linked account and conserve debt once", () => {
  const s = funded(); open(s, "isbank"); act(s, "loan", { product: "personal", offer: "small" });
  const before = netWorth(s).total; processWealthMonthEnd(s);
  assert.equal(bankAccount(s, id()).balance, 10800); assert.equal(bankAccount(s, id("isbank")).balance, 0);
  assert.equal(s.wealth.debts[0].principal, 13200); assert.equal(netWorth(s).total, before);
  const after = structuredClone(s); assert.equal(processWealthMonthEnd(s), false); assert.deepEqual(s, after);
  assert.equal(act(s, "deposit", { amount: 2400 }).ok, true);
  assert.equal(act(s, "repay", { debtId: s.wealth.debts[0].id, amount: 13200 }).ok, true);
  assert.equal(s.wealth.debts.length, 0); assert.equal(bankAccount(s, id()).balance, 0); assert.equal(netWorth(s).total, before);
});

test("a failed collateral purchase rolls back an already staged down-payment transfer", () => {
  const s = funded(500000); act(s, "deposit", { amount: 200000 });
  s.wealth.vehicle = { tier: "used", purchasePrice: 180000, currentValue: 120000, acquiredWeek: 1, loanId: null };
  const before = structuredClone(s);
  assert.equal(act(s, "loan", { product: "vehicle", vehicle: "used" }).ok, false); assert.deepEqual(s, before);
});

test("vehicle and mortgage applications retain existing collateral and repayment engines", () => {
  for (const product of ["vehicle", "mortgage"]) {
    const s = funded(500000); s.finances.otherMonthlyIncome = 50000; act(s, "deposit", { amount: 200000 });
    assert.equal(act(s, "loan", { product }).ok, true); assert.equal(s.wealth.debts[0].accountId, id());
    assert.equal(s.wealth.debts[0].type, product); valid(reload(s));
  }
});

test("commercial loan stays in the existing business debt field and routes cash into its account", () => {
  const s = funded(); startBusiness(s, "repair"); const aid = open(s, "ziraat", "commercial");
  s.flags.business.months = 3; s.flags.business.lastResult = { net: 1000 };
  const before = netWorth(s).total;
  assert.equal(act(s, "loan", { accountId: aid, product: "commercial" }).ok, true);
  assert.equal(s.flags.business.debt, 1400); assert.equal(bankAccount(s, aid).balance, 1400);
  assert.equal(netWorth(s).total, before);
  assert.equal(act(s, "commercial-repay", { accountId: aid, amount: 1400 }).ok, true);
  assert.equal(s.flags.business.debt, 0); assert.equal(netWorth(s).total, before); valid(reload(s));
});

test("business monthly settlement uses its chosen account and is idempotent", () => {
  const s = funded(); startBusiness(s, "repair"); const aid = open(s, "ziraat", "commercial");
  act(s, "deposit", { accountId: aid, amount: 10000 }); const before = bankAccount(s, aid).balance, wallet = s.finances.balance;
  processBusinessMonth(s); const net = s.flags.business.lastResult.net;
  assert.equal(bankAccount(s, aid).balance, before + net); assert.equal(s.finances.balance, wallet);
  const after = structuredClone(s); assert.equal(processBusinessMonth(s), ""); assert.deepEqual(s, after);
});

test("card limits aggregate across banks; advances create exactly principal plus declared fee", () => {
  const s = funded(); open(s, "isbank"); assert.equal(act(s, "card-open").ok, true);
  assert.ok(cardLimitAvailable(s) < 10000); assert.equal(act(s, "card-open", { accountId: id("isbank") }).ok, true);
  const before = netWorth(s).total;
  assert.equal(act(s, "card-advance", { amount: 1000 }).ok, true);
  assert.equal(bankCard(s, id()).balance, 1020); assert.equal(bankTotals(s).cardDebt, 1020);
  assert.equal(bankAccount(s, id()).balance, 1000); assert.equal(netWorth(s).total, before - 20); valid(reload(s));
});

test("card statement minimum is collected next month only from its own account", () => {
  const s = funded(); open(s, "isbank"); act(s, "card-open"); act(s, "card-advance", { amount: 1000 });
  processBankCardsMonth(s, 1, transact, CASH_ARREARS_CAP);
  const card = bankCard(s, id()), due = card.minimumDue, oldBalance = bankAccount(s, id()).balance;
  assert.ok(due > 0); assert.equal(oldBalance, 1000);
  processBankCardsMonth(s, 2, transact, CASH_ARREARS_CAP);
  assert.equal(bankAccount(s, id()).balance, oldBalance - due); assert.equal(bankAccount(s, id("isbank")).balance, 0);
  const after = structuredClone(s); processBankCardsMonth(s, 2, transact, CASH_ARREARS_CAP); assert.deepEqual(s, after); valid(reload(s));
});

test("three missed card minimums transfer liabilities to existing arrears exactly once", () => {
  const s = funded(); act(s, "card-open"); act(s, "card-advance", { amount: 1000 }); act(s, "withdraw", { amount: 1000 });
  for (let month = 1; month <= 4; month++) { s.time.absoluteWeek = month * 4 + 1; processBankCardsMonth(s, month, transact, CASH_ARREARS_CAP); }
  assert.equal(bankTotals(s).cardDebt, 0); assert.ok(s.finances.arrears > 1020); assert.equal(bankCard(s, id()).blocked, true);
  assert.equal(bankCreditPolicy(s, "small").ok, false);
  const arrears = s.finances.arrears; processBankCardsMonth(s, 5, transact, CASH_ARREARS_CAP); assert.equal(s.finances.arrears, arrears); valid(reload(s));
});

test("manual card repayment removes equal assets/debt without inventing paid credit history", () => {
  const s = funded(); act(s, "card-open"); act(s, "card-advance", { amount: 1000 }); act(s, "deposit", { amount: 20 });
  const before = netWorth(s).total; assert.equal(act(s, "card-pay", { amount: 1020 }).ok, true);
  assert.equal(bankTotals(s).cardDebt, 0); assert.equal(netWorth(s).total, before); valid(reload(s));
});

test("enforcement cannot be evaded with bank deposits and handles a negative wallet without losing funds", () => {
  for (const wallet of [0, -1000]) {
    const s = funded(10000); act(s, "deposit", { amount: 10000 }); s.finances.balance = wallet; s.finances.arrears = 6000;
    const before = netWorth(s).total, item = openIcraNotice(s, { source: "temerrut", amount: 6000 });
    assert.equal(runHaciz(s, item).ok, true); assert.equal(bankAccount(s, id()).balance, 4000);
    assert.equal(s.finances.balance, wallet); assert.equal(s.finances.arrears, 0); assert.equal(netWorth(s).total, before);
    const after = structuredClone(s); assert.equal(runHaciz(s, item).ok, false); assert.deepEqual(s, after); valid(reload(s));
  }
});

test("bounded account history survives hundreds of conserving transfers and actual slot saves", () => {
  let s = funded(); open(s, "isbank"); act(s, "deposit", { amount: 1000 }); const before = netWorth(s).total;
  for (let i = 0; i < 150; i++) {
    const source = i % 2 ? id("isbank") : id(), targetId = i % 2 ? id() : id("isbank");
    assert.equal(act(s, "transfer", { accountId: source, targetId, amount: 1000 }).ok, true);
    if (i % 13 === 0) s = reload(s);
  }
  assert.equal(netWorth(s).total, before); assert.equal(bankAccount(s, id()).history.length, 40);
  const memory = new Map(), storage = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) };
  assert.equal(saveGame(storage, s).ok, true); const loaded = loadGame(storage); assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state.finances.banking, s.finances.banking); valid(loaded.state);
});

test("bank UI is read-only with labeled forms, actual commands and localized headings", () => {
  const s = funded(); const before = structuredClone(s);
  for (const lang of ["tr", "en", "pl"]) {
    const html = renderBankAccounts(s, n => String(n), lang);
    assert.match(html, /data-bank-form/); assert.match(html, /inputmode="numeric"/);
    assert.match(html, /name="revision"/); assert.match(html, /name="action" value="deposit"/);
    assert.equal((html.match(/<label for=/g) || []).length, (html.match(/id="bank[^\"]+"/g) || []).length);
  }
  assert.deepEqual(s, before); assert.equal(bankAccount(s, id()).balance, 0);
});

test("linked-account funding counts as paid even with a pre-existing negative wallet", () => {
  const s = funded(-1000); act(s, "loan", { product: "personal", offer: "small" });
  processWealthMonthEnd(s);
  assert.equal(s.flags.bankRecord.outcome, "paid");
  assert.equal(s.flags.bankRecord.missed, 0);
  assert.equal(s.finances.balance, -1000);
  assert.equal(bankAccount(s, id()).balance, 10800);
});

test("partial card payments do not reset consecutive missed minimums", () => {
  const s = funded(); act(s, "card-open"); act(s, "card-advance", { amount: 1000 }); act(s, "withdraw", { amount: 1000 });
  processBankCardsMonth(s, 1, transact, CASH_ARREARS_CAP);
  for (let month = 2; month <= 4; month++) {
    // Each payment covers the previous overdue amount, but not this minimum.
    const c = bankCard(s, id());
    const partial = Math.max(1, Math.min(c.minimumDue - 1, c.overdue || 1));
    act(s, "deposit", { amount: partial });
    s.time.absoluteWeek = month * 4 + 1;
    processBankCardsMonth(s, month, transact, CASH_ARREARS_CAP);
  }
  assert.equal(bankCard(s, id()).blocked, true);
  assert.equal(bankCard(s, id()).balance, 0);
  assert.ok(s.finances.arrears > 0);
});

test("monthly cash and bank reconciliation separates advances, repayments and internal transfers", async () => {
  const { beginMonthlyCash, closeMonthlyCash, renderMonthlyCashCard } = await import("../public/games/tc-sim/js/monthly-cash.js");
  const s = funded(); open(s, "isbank"); s.finances.monthCash = null;
  beginMonthlyCash(s, false, netWorth(s)); const opening = netWorth(s).total;
  act(s, "deposit", { amount: 2000 });
  act(s, "transfer", { amount: 500, targetId: id("isbank") });
  act(s, "withdraw", { accountId: id("isbank"), amount: 100 });
  act(s, "card-open"); act(s, "card-advance", { amount: 1000 });
  act(s, "card-pay", { amount: 200 });
  s.time.month += 1;
  const r = closeMonthlyCash(s, netWorth(s));
  assert.equal(r.closingBalance - r.openingBalance, r.inflow - r.outflow + r.adjustments);
  assert.equal(r.closingBank - r.openingBank, r.breakdown.bankInflow - (r.breakdown.bankOutflow || 0) + r.breakdown.bankTransfers);
  assert.equal(r.inflow, 0); assert.equal(r.outflow, 200); assert.equal(r.debtPayments, 200);
  assert.equal(r.breakdown.bankInflow, 1000); assert.equal(r.breakdown.interestAccrued, 20);
  assert.equal(r.creditArrears, 820); assert.equal(r.openingWorth, opening);
  assert.equal(r.closingWorth - r.openingWorth, -20); assert.equal(r.otherChange, 0);
  assert.equal(s.finances.monthCash.openingWorth, r.closingWorth);
  assert.equal(s.finances.monthCash.openingBank, r.closingBank);
  assert.match(renderMonthlyCashCard(r, String, 2, "en"), /Net worth change/);
  assert.deepEqual(reload(s).finances.lastMonthClose, r);
});

test("legacy monthly reports start a partial wealth comparison without changing saved balances", async () => {
  const { captureMonthlyWealth } = await import("../public/games/tc-sim/js/monthly-cash.js");
  const s = fresh(); delete s.finances.monthCash.openingWorth; delete s.finances.monthCash.openingBank;
  transact(s, 100, "observed income", "income"); const before = s.finances.balance;
  captureMonthlyWealth(s, netWorth(s));
  assert.equal(s.finances.monthCash.wealthPartial, true);
  assert.equal(s.finances.monthCash.openingWorth, netWorth(s).total);
  assert.equal(s.finances.balance, before);
});

test("personal loan affordability includes the current card minimum without double counting it", async () => {
  const { creditAvailability } = await import("../public/games/tc-sim/js/bank-business.js");
  const s = funded(); act(s, "card-open"); act(s, "card-advance", { amount: 9000 });
  processBankCardsMonth(s, 1, transact, CASH_ARREARS_CAP);
  assert.ok(bankTotals(s).minimumDue > 1800);
  assert.equal(creditAvailability(s, "large").ok, false);
  assert.equal(creditAvailability(s, "small").ok, true);
});

test("business tax, interest and principal disclose existing net settlement without duplicate cash postings", () => {
  const s = funded(); startBusiness(s, "repair"); const aid = open(s, "ziraat", "commercial");
  s.flags.business.months = 3; s.flags.business.lastResult = { net: 1000 };
  act(s, "loan", { accountId: aid, product: "commercial" });
  processBusinessMonth(s);
  const b = s.finances.monthCash.breakdown, r = s.flags.business.lastResult;
  assert.equal(b.taxIncluded, r.tax); assert.equal(b.businessInterest, r.interest); assert.equal(b.businessPrincipal, r.principal);
  const before = structuredClone(s); processBusinessMonth(s); assert.deepEqual(s, before);
});


test("wallet overflow rejects the entire transfer without rounding away bank funds", () => {
  const s = funded(100); act(s, "deposit", { amount: 2 });
  s.finances.balance = Number.MAX_SAFE_INTEGER; const before = structuredClone(s);
  assert.equal(act(s, "withdraw", { amount: 1 }).ok, false);
  assert.deepEqual(s, before);
});
