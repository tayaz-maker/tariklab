import { syncGameDate } from "../public/games/tc-sim/js/game-date.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import {
  getCostOfLivingIndex,
  getLateLifeCostFactor,
  getMonthlySummary,
  getPlayerLifeStage,
  getRetirementEligibility,
  getRetirementIncomePreview,
  acceptJobOffer,
  promoteCareer,
} from "../public/games/tc-sim/js/life.js";
import { advanceWeek, applyDecision, canApplyDecision } from "../public/games/tc-sim/js/time.js";
import { activateNextEvent, getEventChoiceAvailability, getEventDefinition, resolveEvent } from "../public/games/tc-sim/js/events.js";
import { loadGame, migrateState, saveGame } from "../public/games/tc-sim/js/save.js";

const fresh = () => createNewGame({ now: "2027-01-01T00:00:00.000Z" });

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

function roundTrip(state) {
  const storage = new MemoryStorage();
  assert.equal(saveGame(storage, state).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  return loaded.state;
}

function choose(state, preferred = {}) {
  if (!state.events.active) return null;
  const definition = getEventDefinition(state.events.active.eventId);
  const requested = preferred[definition.id];
  const choice = definition.choices.find((item) => item.id === requested && getEventChoiceAvailability(state, item.id).ok)
    || definition.choices.find((item) => getEventChoiceAvailability(state, item.id).ok);
  assert.ok(choice, `${definition.id} için geçerli seçim bulunmalı`);
  assert.equal(resolveEvent(state, choice.id).ok, true);
  return definition.id;
}

function settle(state, preferred = {}, counter = null) {
  let guard = 0;
  while (state.events.active) {
    assert.ok(guard++ < 80, "olay kuyruğu sonlanmalı");
    const id = choose(state, preferred);
    if (counter) counter[id] = (counter[id] || 0) + 1;
  }
}

function activateUntil(state, targetId, keepEligible = () => {}) {
  for (let guard = 0; guard < 100; guard += 1) {
    keepEligible();
    activateNextEvent(state);
    if (state.events.active?.eventId === targetId) return;
    assert.ok(state.events.active, `${targetId} üretim koşulundan ulaşılmalı`);
    choose(state);
  }
  assert.fail(`${targetId} olayına sıra gelmedi`);
}

function prepareLateLife(state, age, { employed = true } = {}) {
  state.player.age = age;
  state.time.absoluteWeek = 1 + (age - 18) * 48;
  state.time.year = 2027 + age - 18;
  state.career.jobId = employed ? "specialist" : null;
  state.career.performance = 70;
  state.career.weeksInRole = 240;
  state.career.jobFamilyExperience = { ofis: 1200 };
  state.household.homeId = "studio";
  state.household.livingWithFamily = false;
  state.finances.balance = 100000;
  state.flags.depth2Enabled = true;
  state.flags.depth3Enabled = true;
  state.military.applicable = false;
  state.events.queue = [];
  state.events.active = null;
  state.events.cooldowns = {};
  return state;
}

test("36–70 yaşam evreleri türetilir ve 18–35 evresi değişmez", () => {
  const state = fresh();
  for (const [age, id] of [[35, "young_adult"], [36, "mid_career"], [45, "midlife"], [55, "late_career"], [65, "retirement_transition"], [70, "retirement_transition"]]) {
    state.player.age = age;
    assert.equal(getPlayerLifeStage(state).id, id);
  }
});

test("36 sonrası maliyet devamı kabul edilmiş 1.5 endeksini bozmadan yavaş ve sınırlıdır", () => {
  const state = fresh();
  state.time.absoluteWeek = 3000;
  syncGameDate(state);
  state.player.age = 35;
  const at35 = getMonthlySummary(state).otherExpenses;
  assert.equal(getCostOfLivingIndex(state), 1.5);
  assert.equal(getLateLifeCostFactor(state), 1);
  state.player.age = 55;
  const at55 = getMonthlySummary(state).otherExpenses;
  state.player.age = 70;
  const at70 = getMonthlySummary(state).otherExpenses;
  assert.ok(at55 > at35);
  assert.ok(at70 > at55);
  assert.equal(getLateLifeCostFactor(state), 1.2);
});

test("orta yaşam ve geç kariyer olayları üretim koşulundan ulaşılır", () => {
  const mid = prepareLateLife(fresh(), 36);
  mid.health.stress = 60;
  activateUntil(mid, "midlife_career_family_pressure", () => { mid.health.stress = Math.max(60, mid.health.stress); });
  assert.equal(mid.events.active?.eventId, "midlife_career_family_pressure");
  assert.equal(resolveEvent(mid, "rebalance").ok, true);
  assert.ok(mid.events.cooldowns.midlife_career_family_pressure > mid.time.absoluteWeek);

  const late = prepareLateLife(fresh(), 56);
  late.relationships.anne = 20;
  activateUntil(late, "late_career_workload");
  assert.equal(late.events.active?.eventId, "late_career_workload");
  assert.equal(resolveEvent(late, "downshift").ok, true);
  assert.ok(late.flags.lateCareerReducedLoadUntil > late.time.absoluteWeek);
});

test("orta yaş aile yükümlülüğü gerçek olaydan gecikmeli dosyaya ve temizliğe gider", () => {
  let state = prepareLateLife(fresh(), 50, { employed: false });
  activateUntil(state, "midlife_family_obligation");
  assert.equal(state.events.active?.eventId, "midlife_family_obligation");
  const trustBefore = state.people.find((person) => person.id === "anne").social.trust;
  assert.equal(resolveEvent(state, "commit").ok, true);
  let followup = state.openCases.find((item) => item.payload?.kind === "midlife_family_obligation" && item.status === "pending");
  assert.ok(followup);
  state = roundTrip(state);
  followup = state.openCases.find((item) => item.payload?.kind === "midlife_family_obligation" && item.status === "pending");
  while (state.time.absoluteWeek < followup.dueWeek) {
    settle(state);
    assert.equal(advanceWeek(state).ok, true);
  }
  settle(state, { midlife_family_obligation_followup: "keep" });
  assert.equal(state.flags.midlifeFamilyObligationOpen, null);
  assert.equal(state.openCases.find((item) => item.id === followup.id).status, "resolved");
  assert.ok(state.people.find((person) => person.id === "anne").social.trust > trustBefore);
});

test("emeklilik planı üretim olayından gecikmeli karara, gelire ve kariyer temizliğine gider", () => {
  let state = prepareLateLife(fresh(), 60);
  state.relationships.anne = 20;
  state.events.cooldowns.late_career_workload = state.time.absoluteWeek + 100;
  assert.equal(getRetirementEligibility(state).eligible, true);
  const preview = getRetirementIncomePreview(state);
  activateUntil(state, "retirement_planning");
  assert.equal(state.events.active?.eventId, "retirement_planning");
  assert.equal(resolveEvent(state, "plan").ok, true);
  const pending = state.openCases.find((item) => item.payload?.kind === "retirement_transition" && item.status === "pending");
  assert.ok(pending);
  state = roundTrip(state);
  while (state.time.absoluteWeek < pending.dueWeek) {
    settle(state);
    assert.equal(advanceWeek(state).ok, true);
  }
  settle(state, { retirement_transition: "retire" });
  assert.equal(state.career.retirement.status, "retired");
  assert.equal(state.career.retirement.monthlyIncome, preview);
  assert.equal(state.career.jobId, null);
  assert.equal(getMonthlySummary(state).salary, 0);
  assert.equal(getMonthlySummary(state).retirementIncome, preview);
  assert.equal(canApplyDecision(state, "overtime").ok, false);
  assert.equal(promoteCareer(state).ok, false);
  assert.equal(validateState(roundTrip(state)).ok, true);
  const retireRows = state.career.history.filter((entry) => entry.type === "retirement");
  assert.equal(retireRows.length, 1);
});

test("emeklilik geliri ay sonunda tek kez işlenir ve yükleme çoğaltmaz", () => {
  let state = prepareLateLife(fresh(), 66);
  state.relationships.anne = 20;
  state.events.cooldowns.late_career_workload = state.time.absoluteWeek + 100;
  activateUntil(state, "retirement_planning");
  resolveEvent(state, "plan");
  const due = state.openCases.find((item) => item.payload?.kind === "retirement_transition").dueWeek;
  while (state.time.absoluteWeek < due) { settle(state); advanceWeek(state); }
  settle(state, { retirement_transition: "retire" });
  const pension = state.career.retirement.monthlyIncome;
  const ledgerStart = state.finances.ledger.length;
  const startingMonth = state.time.month;
  while (state.time.month === startingMonth) {
    settle(state);
    assert.equal(advanceWeek(state).ok, true);
    if (state.time.weekOfMonth === 3) state = roundTrip(state);
  }
  assert.equal(state.finances.ledger.filter((entry) => entry.reason === "Aylık emeklilik geliri").length, 1);
  assert.equal(state.finances.ledger.find((entry) => entry.reason === "Aylık emeklilik geliri").amount, pension);
  assert.equal(state.finances.ledger.slice(ledgerStart).some((entry) => entry.reason === "Aylık maaş"), false);
});

test("emekliliği ertelemek işi korur ve kararı bir yıl çiftlemeden kapatır", () => {
  const state = prepareLateLife(fresh(), 62);
  state.relationships.anne = 20;
  state.events.cooldowns.late_career_workload = state.time.absoluteWeek + 100;
  activateUntil(state, "retirement_planning");
  assert.equal(state.events.active?.eventId, "retirement_planning");
  assert.equal(resolveEvent(state, "continue").ok, true);
  assert.equal(state.career.jobId, "specialist");
  assert.equal(state.career.retirement.status, "working");
  assert.ok(state.career.retirement.deferredUntil > state.time.absoluteWeek);
  activateNextEvent(state);
  assert.notEqual(state.events.active?.eventId, "retirement_planning");
});

export function runFullLife(strategy) {
  const state = fresh();
  state.flags.depth2Enabled = true;
  state.flags.depth3Enabled = true;
  state.military.applicable = false;
  if (strategy === "health") acceptJobOffer(state, "office");
  const counts = {};
  const checkpoints = {};
  if (strategy === "strained") {
    state.finances.balance = 800;
    state.finances.otherMonthlyExpenses = 8000;
    state.career.jobId = "market";
  }
  const choices = strategy === "work"
    ? { midlife_career_family_pressure: "carry", late_career_workload: "steady", midlife_family_obligation: "boundary", retirement_planning: "continue", job_security_warning: "recover", job_security_review: "recover" }
    : strategy === "strained"
      ? { midlife_career_family_pressure: "carry", late_career_workload: "steady", midlife_family_obligation: "boundary", retirement_planning: "plan", retirement_transition: "retire", money_relief_choice: "borrow", money_relief_due: "repay" }
      : { midlife_career_family_pressure: "rebalance", late_career_workload: "downshift", midlife_family_obligation: "boundary", retirement_planning: "plan", retirement_transition: "retire", job_security_warning: "recover", job_security_review: "recover" };
  for (let guard = 0; state.player.age < 70 && guard < 2700; guard += 1) {
    settle(state, choices, counts);
    if (state.career.retirement.status !== "retired" && !state.career.jobId && !state.career.pendingJob) {
      acceptJobOffer(state, "market");
    } else if (state.career.retirement.status !== "retired" && state.career.jobId && ["work", "strained"].includes(strategy) && state.career.performance >= 45 && state.health.energy > 45 && state.health.stress < 70 && state.weekly.used < 2)
      applyDecision(state, "overtime");
    else if (strategy === "health" && canApplyDecision(state, state.health.stress > 25 ? "rest" : "exercise").ok)
      applyDecision(state, state.health.stress > 25 ? "rest" : "exercise");
    else if (state.health.energy < 55 || state.health.stress > 55)
      applyDecision(state, "rest");
    settle(state, choices, counts);
    assert.equal(advanceWeek(state).ok, true);
    settle(state, choices, counts);
    if ([35, 45, 55, 60, 65, 70].includes(state.player.age) && !checkpoints[state.player.age]) {
      const monthly = getMonthlySummary(state);
      checkpoints[state.player.age] = {
        age: state.player.age,
        jobId: state.career.jobId,
        retired: state.career.retirement.status === "retired",
        income: monthly.income,
        expenses: monthly.expenses,
        balance: state.finances.balance,
        health: { ...state.health },
        openCases: state.openCases.filter((item) => item.status !== "resolved").length,
        history: state.memories.length,
        yearFile: state.yearlyHistory.length,
      };
    }
  }
  assert.equal(state.player.age, 70);
  assert.equal(validateState(state).ok, true);
  return { state, checkpoints, counts };
}

test("18→70 gerçek hafta ilerleyişi emeklilik ve çalışmaya-devam yollarını ayırır", () => {
  const retired = runFullLife("retire");
  const working = runFullLife("work");
  assert.equal(retired.state.career.retirement.status, "retired");
  assert.equal(retired.state.career.jobId, null);
  assert.ok(retired.state.career.retirement.monthlyIncome > 0);
  assert.notEqual(working.state.career.retirement.status, "retired");
  assert.ok(working.state.career.jobId);
  assert.ok(retired.counts.retirement_planning >= 1);
  assert.equal(retired.counts.retirement_transition, 1);
  assert.ok(working.counts.retirement_planning >= 1);
  assert.ok(retired.checkpoints[35] && retired.checkpoints[45] && retired.checkpoints[55] && retired.checkpoints[60] && retired.checkpoints[65] && retired.checkpoints[70]);
});

test("18→70 yaşam sonucu aynı stratejiyle belirlenimlidir", () => {
  const first = runFullLife("retire");
  const second = runFullLife("retire");
  assert.deepEqual(first.checkpoints, second.checkpoints);
  assert.deepEqual(first.counts, second.counts);
  assert.deepEqual({ career: first.state.career, health: first.state.health, balance: first.state.finances.balance }, { career: second.state.career, health: second.state.health, balance: second.state.finances.balance });
});

test("dengeli, fazla çalışan, sağlık-öncelikli ve maddi sıkışık yaşamlar 70'te ayrışır", () => {
  const balanced = runFullLife("retire");
  const overwork = runFullLife("work");
  const healthFirst = runFullLife("health");
  const strained = runFullLife("strained");
  for (const result of [balanced, overwork, healthFirst, strained]) {
    assert.equal(result.state.player.age, 70);
    assert.equal(validateState(result.state).ok, true);
  }
  assert.ok(healthFirst.state.health.health >= overwork.state.health.health);
  assert.notEqual(strained.state.finances.balance, balanced.state.finances.balance);
  assert.equal(healthFirst.state.career.retirement.status, "retired");
  assert.notEqual(overwork.state.career.retirement.status, "retired");
});

test("eski kayıt nötr çalışma durumu alır; yaştan emeklilik veya geçmiş uydurulmaz", () => {
  const state = fresh();
  state.player.age = 67;
  delete state.career.retirement;
  const migrated = migrateState(structuredClone(state));
  assert.equal(migrated.ok, true);
  const loaded = migrated.state;
  assert.equal(loaded.career.retirement.status, "working");
  assert.equal(loaded.career.retirement.monthlyIncome, 0);
  assert.equal(loaded.career.history.some((entry) => entry.type === "retirement"), false);
});
