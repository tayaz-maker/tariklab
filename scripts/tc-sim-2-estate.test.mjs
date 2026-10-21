import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, normalizeEducationCareer, validateState } from "../public/games/tc-sim/js/state.js";
import { applyBankAction } from "../public/games/tc-sim/js/bank-actions.js";
import { bankTotals } from "../public/games/tc-sim/js/bank-accounts.js";
import { startBusiness } from "../public/games/tc-sim/js/bank-business.js";
import { netWorth } from "../public/games/tc-sim/js/wealth.js";
import { estateSnapshot, processLifetimeWeek, continueGeneration } from "../public/games/tc-sim/js/lifetime.js";
import { renderLifeReport } from "../public/games/tc-sim/js/lifetime-ui.js";
import { deserializeState } from "../public/games/tc-sim/js/save.js";

function prepared() {
  const s = createNewGame({ seed: 17, now: "2026-10-21T00:00:00.000Z" });
  s.player.age = 98; s.time.absoluteWeek = 80 * 48 + 1; s.time.year = 2106;
  s.finances.balance = 30000;
  s.parenthood.children = [0, 1].map(i => ({ id: `heir-${i}`, name: `Çocuk ${i}`,
    bornWeek: 1 + i * 48, otherParentId: "elif", livesWithPlayer: true }));
  normalizeEducationCareer(s);
  return s;
}
const aid = (bank = "ziraat", kind = "personal") => `bank-${bank}-${kind}`;
function act(s, action, rest = {}) {
  const result = applyBankAction(s, { revision: s.finances.banking.revision,
    action, accountId: aid(), ...rest });
  assert.equal(result.ok, true, result.reason); return result;
}
function reload(s) {
  const result = deserializeState(JSON.stringify(s));
  assert.equal(result.ok, true, result.error); return result.state;
}

test("depositing personal or commercial money preserves the exact estate and heir shares", () => {
  const s = prepared();
  s.flags.business = { id: "repair", startedWeek: 1, invested: 14000, debt: 0 };
  const before = estateSnapshot(s);
  act(s, "open", { bankId: "ziraat", kind: "personal" });
  act(s, "deposit", { amount: 10000 });
  act(s, "open", { bankId: "isbank", kind: "commercial" });
  act(s, "deposit", { accountId: aid("isbank", "commercial"), amount: 12001 });
  const after = estateSnapshot(s);
  assert.equal(after.bank, 22001);
  assert.equal(after.gross, before.gross);
  assert.equal(after.net, before.net);
  assert.deepEqual(after.shares, before.shares);
});

test("card debt is deducted once from bank-inclusive estate and settled inheritance survives succession", () => {
  const s = prepared();
  act(s, "open", { bankId: "ziraat", kind: "personal" });
  act(s, "deposit", { amount: 10000 });
  act(s, "card-open"); act(s, "card-advance", { amount: 1000 });
  const estate = estateSnapshot(s);
  assert.equal(estate.bank, 11000);
  assert.equal(estate.debt, 1020);
  assert.equal(estate.obligations, 1020);
  assert.equal(estate.net, 29980);
  assert.equal(estate.net, netWorth(s).total);
  processLifetimeWeek(s);
  assert.ok(s.lifetime.death);
  assert.deepEqual(s.lifetime.death.estate, estate);
  const loaded = reload(s), reports = structuredClone(loaded.lifetime.reports);
  assert.match(renderLifeReport(reports.at(-1)), /banka hesapları ₺11\.000/);
  const heir = estate.shares[0];
  assert.equal(continueGeneration(loaded, heir.childId).ok, true);
  assert.equal(loaded.finances.balance, heir.amount);
  assert.deepEqual(bankTotals(loaded), { personal: 0, commercial: 0, total: 0, cardDebt: 0, minimumDue: 0, overdue: 0 });
  assert.equal(netWorth(loaded).total, heir.amount);
  assert.equal(loaded.finances.monthCash.openingBalance, heir.amount);
  assert.equal(loaded.finances.monthCash.openingWorth, heir.amount);
  assert.equal(loaded.finances.monthCash.openingBank, 0);
  assert.equal(loaded.finances.monthCash.year, loaded.time.year);
  assert.equal(loaded.finances.monthCash.month, loaded.time.month);
  assert.deepEqual(loaded.lifetime.reports, reports);
  const before = structuredClone(loaded);
  assert.equal(continueGeneration(loaded, heir.childId).ok, false);
  assert.deepEqual(loaded, before);
  assert.equal(validateState(reload(loaded)).ok, true);
});

test("old V5/V6 settled estates without a bank field remain unchanged across reload and continuation", () => {
  for (const version of [5, 6]) {
    const s = prepared(); processLifetimeWeek(s);
    delete s.lifetime.death.estate.bank;
    delete s.lifetime.reports.at(-1).estate.bank;
    for (const estate of [s.lifetime.death.estate, s.lifetime.reports.at(-1).estate]) {
      delete estate.businessValue; delete estate.businessDebt;
    }
    delete s.finances.banking;
    s.meta.saveVersion = version;
    const reports = structuredClone(s.lifetime.reports), estate = structuredClone(s.lifetime.death.estate);
    const loaded = reload(s);
    assert.deepEqual(loaded.lifetime.death.estate, estate);
    assert.deepEqual(loaded.lifetime.reports, reports);
    assert.doesNotMatch(renderLifeReport(reports.at(-1)), /banka hesapları/);
    assert.equal(continueGeneration(loaded, estate.shares[0].childId).ok, true);
    assert.equal(loaded.finances.balance, estate.shares[0].amount);
    assert.equal(validateState(reload(loaded)).ok, true);
  }
});

test("new estate bank breakdown cannot contradict its settled gross while old reports stay valid", () => {
  const s = prepared(); processLifetimeWeek(s);
  s.lifetime.death.estate.bank = 1;
  s.lifetime.reports.at(-1).estate.bank = 1;
  assert.equal(deserializeState(JSON.stringify(s)).ok, false);
});

test("commercial loan proceeds never increase estate or inherited cash; business assets and debts settle once", () => {
  const s = prepared();
  assert.equal(startBusiness(s, "repair").ok, true);
  s.flags.business.months = 3; s.flags.business.lastResult = { net: 1000 };
  act(s, "open", { bankId: "ziraat", kind: "commercial" });
  const before = estateSnapshot(s), worthBefore = netWorth(s).total;
  assert.equal(before.businessValue, 3500);
  assert.equal(before.businessDebt, 0);
  act(s, "loan", { accountId: aid("ziraat", "commercial"), product: "commercial" });
  const after = estateSnapshot(s);
  assert.equal(after.bank, 1400);
  assert.equal(after.businessDebt, 1400);
  assert.equal(after.businessValue, 3500);
  assert.equal(after.obligations, before.obligations + 1400);
  assert.equal(after.gross, before.gross + 1400);
  assert.equal(after.net, before.net);
  assert.equal(after.net, worthBefore);
  assert.deepEqual(after.shares, before.shares);
  processLifetimeWeek(s);
  const loaded = reload(s), report = loaded.lifetime.reports.at(-1);
  assert.equal(report.estate.businessDebt, 1400);
  assert.match(renderLifeReport(report), /işletme tasfiye değeri ₺3\.500/);
  assert.match(renderLifeReport(report), /ticari borç \(yükümlülüklere dahil\) ₺1\.400/);
  assert.equal(continueGeneration(loaded, after.shares[0].childId).ok, true);
  assert.equal(loaded.finances.balance, before.shares[0].amount);
  assert.equal(loaded.flags.business, undefined);
  assert.equal(bankTotals(loaded).total, 0);
  assert.equal(validateState(reload(loaded)).ok, true);
});

test("insolvent commercial estate distributes no negative debt and rejects contradictory business breakdown", () => {
  const s = prepared(); s.finances.balance = 0;
  s.flags.business = { id: "repair", startedWeek: 1, invested: 14000, debt: 10000 };
  const estate = estateSnapshot(s);
  assert.equal(estate.gross, 3500); assert.equal(estate.obligations, 10000);
  assert.equal(estate.net, 0); assert.ok(estate.shares.every(share => share.amount === 0));
  processLifetimeWeek(s); assert.equal(validateState(reload(s)).ok, true);
  for (const estate of [s.lifetime.death.estate, s.lifetime.reports.at(-1).estate]) estate.businessDebt = 11000;
  assert.equal(deserializeState(JSON.stringify(s)).ok, false);
});
