import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, normalizeEducationCareer } from "../public/games/tc-sim/js/state.js";
import { advanceWeek } from "../public/games/tc-sim/js/time.js";
import { enrollEducation } from "../public/games/tc-sim/js/life.js";
import { buildLifeDossier, attachLifeDossier, economyCausality } from "../public/games/tc-sim/js/life-depth.js";
import { applyBankAction } from "../public/games/tc-sim/js/bank-actions.js";
import { normalizeBanking } from "../public/games/tc-sim/js/bank-accounts.js";
import { netWorth } from "../public/games/tc-sim/js/wealth.js";
import { deserializeState } from "../public/games/tc-sim/js/save.js";
import { settleHouseholdEvents } from "./tc-sim-longrun.mjs";

const fresh = () => {
  const s = createNewGame({ seed: 41, now: "2027-01-01T00:00:00Z" });
  s.finances.balance = 30000; s.events.active = null; s.events.queue = [];
  normalizeBanking(s);
  return s;
};
const reload = s => {
  const loaded = deserializeState(JSON.stringify(s));
  assert.equal(loaded.ok, true, loaded.error);
  return loaded.state;
};
const bank = (s, request) => assert.equal(applyBankAction(s, { ...request, revision: s.finances.banking.revision }).ok, true);
const assessment = s => {
  const d = buildLifeDossier(s);
  return { outcome: d.outcome, safety: d.economy.safety, debt: d.economy.debt, achievements: d.achievements, regrets: d.regrets };
};
function terminal() {
  const s = fresh();
  assert.equal(enrollEducation(s, "university", "part").ok, true);
  s.career.jobId = "market"; s.career.performance = 95; s.career.weeksInRole = 120;
  for (const id of Object.keys(s.relationships)) s.relationships[id] = 20;
  s.player.age = 98; s.time.absoluteWeek = 3841; s.time.year = 2107;
  normalizeEducationCareer(s);
  settleHouseholdEvents(s);
  assert.equal(advanceWeek(s).ok, true);
  assert.ok(s.lifetime.death);
  return s;
}

test("new terminal dossier uses the report's career and active education snapshot; cleanup and estate stay intact", () => {
  const s = terminal(), r = s.lifetime.reports.at(-1), d = r.lifeDossier;
  assert.equal(r.career.jobId, "market");
  assert.equal(d.career.jobId, r.career.jobId);
  assert.equal(d.education.active, r.education.active.pathId);
  assert.equal(d.career.stage, "outcome");
  assert.equal(d.outcome, "successful-but-alone");
  assert.equal(s.career.jobId, null); assert.equal(s.education.active, null);
  const estate = structuredClone(s.lifetime.death.estate), archived = JSON.stringify(s.lifetime.reports);
  assert.deepEqual(r.estate, estate);
  assert.equal(advanceWeek(s).ok, false);
  assert.deepEqual(buildLifeDossier(s), d);
  assert.deepEqual(attachLifeDossier(s), d);
  assert.equal(JSON.stringify(reload(s).lifetime.reports), archived);
  assert.deepEqual(s.lifetime.death.estate, estate);
});

test("wallet, individual deposits and own-account transfers give the same dossier assessment without changing the economy", () => {
  for (const debt of [0, 35000]) {
    let s = fresh(); s.finances.arrears = debt;
    const expected = assessment(s), worth = netWorth(s).total;
    bank(s, { action: "open", bankId: "ziraat", kind: "personal" });
    bank(s, { action: "open", bankId: "isbank", kind: "personal" });
    bank(s, { action: "deposit", accountId: "bank-ziraat-personal", amount: 29000 });
    const economy = economyCausality(s), finances = structuredClone(s.finances);
    assert.deepEqual(assessment(s), expected);
    assert.deepEqual(economyCausality(s), economy, "only dossier assessment includes personal savings");
    assert.deepEqual(s.finances, finances, "a dossier cannot move money or post a transaction");
    assert.equal(buildLifeDossier(s).economy.balance, 1000, "balance remains wallet cash, not net worth");
    bank(s, { action: "transfer", accountId: "bank-ziraat-personal", targetId: "bank-isbank-personal", amount: 10000 });
    s = reload(s);
    assert.deepEqual(assessment(s), expected);
    assert.equal(netWorth(s).total, worth);
  }
});

test("commercial funds, property and unused credit never become personal liquid savings", () => {
  const s = fresh(); s.finances.balance = 1000;
  const expected = assessment(s);
  s.finances.banking.accounts.push({ id: "bank-ziraat-commercial", bankId: "ziraat", kind: "commercial", balance: 50000, closed: false });
  s.wealth.properties.push({ id: "house", currentValue: 500000, occupancy: "owner" });
  s.finances.banking.cards.push({ limit: 100000, balance: 0, minimumDue: 0, overdue: 0 });
  assert.deepEqual(assessment(s), expected);
  s.finances.banking.cards[0].balance = 2000;
  assert.equal(buildLifeDossier(s).economy.debt, 2000);
  assert.equal(buildLifeDossier(s).outcome, "debt-burdened");
});

test("V5/V6 frozen or missing old dossiers are never backfilled or rewritten", () => {
  for (const version of [5, 6]) for (const withDossier of [false, true]) {
    const s = terminal(); s.meta.saveVersion = version;
    const r = s.lifetime.reports.at(-1);
    if (withDossier) r.lifeDossier.outcome = "balanced"; else delete r.lifeDossier;
    const archived = JSON.stringify(s.lifetime.reports);
    const loaded = reload(s);
    assert.equal(JSON.stringify(loaded.lifetime.reports), archived);
    buildLifeDossier(loaded); attachLifeDossier(loaded);
    assert.equal(advanceWeek(loaded).ok, false);
    assert.equal(JSON.stringify(loaded.lifetime.reports), archived);
  }
});
