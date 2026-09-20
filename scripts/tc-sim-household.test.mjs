import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, normalizeEducationCareer, validateState } from "../public/games/tc-sim/js/state.js";
import { becomePartner, setRomanticInterest, getRelationship, applySocialAction, canUseSocialAction } from "../public/games/tc-sim/js/social.js";
import { getHouseholdSummary, getHouseholdFinance, canDiscussHousehold, processHouseholdCases, HOUSEHOLD_HISTORY_LIMIT, neutralUnion, canReconcile } from "../public/games/tc-sim/js/household.js";
import { getEventDefinition, resolveEvent, activateNextEvent, getEventChoiceAvailability } from "../public/games/tc-sim/js/events.js";
import { advanceWeek } from "../public/games/tc-sim/js/time.js";
import { moveHome, getMonthlySummary } from "../public/games/tc-sim/js/life.js";
import { getKnownOpenCases } from "../public/games/tc-sim/js/calendar.js";
import { isSecretKnownTo } from "../public/games/tc-sim/js/depth2-systems.js";
import { saveGame, loadGame } from "../public/games/tc-sim/js/save.js";
import { runHouseholdScenario, settleHouseholdEvents } from "./tc-sim-longrun.mjs";

function couple() {
  const state = createNewGame({ now: "2027-01-01T00:00:00.000Z" });
  state.relationships.elif = 80;
  state.people.find((person) => person.id === "elif").social.trust = 80;
  setRomanticInterest(state, "elif");
  assert.equal(becomePartner(state, "elif"), true);
  state.time.absoluteWeek = 8;
  state.finances.balance = 30000;
  return state;
}
function select(state, eventId, choiceId, sourceCaseId = null) {
  state.events.active = { eventId, occurrenceId: `test-${eventId}-${state.time.absoluteWeek}`, sourceCaseId };
  return resolveEvent(state, choiceId);
}
function load(state) {
  const entries = new Map();
  const storage = { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  assert.equal(saveGame(storage, state).ok, true);
  const result = loadGame(storage);
  assert.equal(result.ok, true);
  return result.state;
}
function establishHome(state) {
  assert.equal(select(state, "cohabitation_discussion", "plan").ok, true);
  const plan = state.openCases.find((item) => item.payload?.kind === "cohabitation");
  assert.ok(plan);
  while (state.time.absoluteWeek < plan.dueWeek) {
    settleHouseholdEvents(state);
    assert.equal(advanceWeek(state).ok, true);
  }
  settleHouseholdEvents(state);
  assert.ok(state.household.union.cohabitingSince);
  return state;
}

test("cohabitation is separate from marriage and has actual eligibility, move, costs and delayed context", () => {
  const single = createNewGame();
  single.social.engaged = true;
  assert.equal(canDiscussHousehold(single, "cohabitation"), false, "socially engaged is not engaged to marry");
  const state = couple();
  const balance = state.finances.balance;
  establishHome(state);
  assert.equal(state.social.currentPartnerNpcId, "elif");
  assert.equal(state.people.filter((person) => person.social.romanceStatus === "partner").length, 1);
  assert.equal(state.household.homeId, "shared");
  assert.equal(state.household.union.marriedSince, null);
  assert.ok(state.finances.ledger.some((entry) => entry.reason === "Paylaşımlı Ev taşınma masrafı" && entry.amount === -2400));
  assert.ok(state.finances.balance < balance);
  assert.ok(getKnownOpenCases(state).some((item) => item.payload?.kind === "adjustment"));
  assert.equal(getHouseholdFinance(state).partnerContribution, 1470);
  assert.equal(getHouseholdFinance(state).householdExtra, 900);
  assert.equal(canDiscussHousehold(state, "cohabitation"), false);
  const summary = getHouseholdSummary(state);
  assert.equal(summary.status, "Sevgili");
  assert.match(summary.space, /ortak alan/);
});

test("calendar conflict cannot bypass activity scarcity; refusal remains available and has a consequence", () => {
  const state = establishHome(couple());
  const plan = state.openCases.find((item) => item.payload?.kind === "adjustment" && item.status !== "resolved");
  state.time.absoluteWeek = plan.dueWeek;
  state.weekly.used = 6;
  state.weekly.selectedIds = ["rest", "exercise"];
  state.events.active = { eventId: plan.eventId, occurrenceId: "conflict", sourceCaseId: plan.id };
  const before = structuredClone(state);
  assert.equal(getEventChoiceAvailability(state, "coordinate").ok, false);
  assert.equal(resolveEvent(state, "coordinate").ok, false);
  assert.deepEqual(state, before);
  const tension = getRelationship(state, "elif").tension;
  assert.equal(resolveEvent(state, "skip").ok, true);
  assert.equal(getRelationship(state, "elif").tension, tension + 4);
  assert.equal(plan.status, "resolved");
});

test("shared costs are pure, prorated and billed once per month without partner salary duplication", () => {
  const state = couple();
  state.household.homeId = "shared";
  state.household.livingWithFamily = false;
  state.time = { absoluteWeek: 12, weekOfMonth: 4, month: 3, year: 2027 };
  state.household.union.cohabitingSince = 12;
  const income = getMonthlySummary(state).income;
  const before = structuredClone(state.finances);
  for (let i = 0; i < 20; i += 1) getMonthlySummary(state);
  assert.deepEqual(state.finances, before);
  assert.equal(advanceWeek(state).ok, true);
  // One shared week: 4200 + 225 - 368.
  assert.equal(state.finances.ledger.filter((item) => item.reason === "Aylık konut gideri").at(-1).amount, -4057);
  assert.equal(state.finances.ledger.filter((item) => item.reason === "Aylık maaş").length, 1);
  assert.equal(getMonthlySummary(state).income, income);
  settleHouseholdEvents(state);
  assert.equal(advanceWeek(state).ok, true);
  assert.equal(state.finances.ledger.filter((item) => item.reason === "Aylık konut gideri").length, 1);
});

test("marriage plan and decision revalidate trust, money and identity before charging", () => {
  const state = establishHome(couple());
  state.time.absoluteWeek += 8;
  state.weekly = { used: 0, selectedIds: [] };
  state.events.active = null;
  assert.equal(select(state, "marriage_discussion", "plan").ok, true);
  const plan = state.openCases.find((item) => item.payload?.kind === "marriage");
  assert.ok(plan);
  state.time.absoluteWeek = plan.dueWeek;
  state.weekly = { used: 0, selectedIds: [] };
  state.finances.balance = 5999;
  state.events.active = { eventId: plan.eventId, occurrenceId: "marriage-budget", sourceCaseId: plan.id };
  const before = structuredClone(state);
  assert.equal(resolveEvent(state, "confirm").ok, false);
  assert.deepEqual(state, before);
  state.finances.balance = 8000;
  state.people.find((person) => person.id === "elif").social.trust = 30;
  assert.equal(resolveEvent(state, "confirm").ok, false);
  assert.equal(state.finances.balance, 8000);
  state.people.find((person) => person.id === "elif").social.trust = 80;
  assert.equal(resolveEvent(state, "confirm").ok, true);
  assert.equal(state.finances.balance, 2000);
  assert.ok(state.household.union.marriedSince);
  const history = structuredClone(state.household.history);
  assert.equal(select(state, "marriage_commitment", "confirm", plan.id).ok, false);
  assert.deepEqual(state.household.history, history);
  assert.equal(state.finances.balance, 2000);
  assert.equal(state.finances.ledger.filter((item) => item.reason === "Ortak evlilik hazırlığı").length, 1);
});

test("family-origin disclosure is target-specific and reads the existing background", () => {
  const results = [];
  for (const family of ["supportive", "demanding"]) {
    const state = couple();
    state.player.background.family = family;
    establishHome(state);
    const plan = state.openCases.find((item) => item.payload?.kind === "family");
    assert.equal(isSecretKnownTo(state, plan.payload.secretId, "anne"), false);
    assert.equal(isSecretKnownTo(state, plan.payload.secretId, "elif"), true);
    state.weekly = { used: 0, selectedIds: [] };
    state.time.absoluteWeek = plan.dueWeek;
    const before = getRelationship(state, "anne").trust;
    assert.equal(select(state, plan.eventId, "tell", plan.id).ok, true);
    results.push(getRelationship(state, "anne").trust - before);
    assert.equal(isSecretKnownTo(state, plan.payload.secretId, "anne"), true);
    assert.equal(isSecretKnownTo(state, plan.payload.secretId, "baba"), false);
    assert.equal(isSecretKnownTo(state, plan.payload.secretId, "burak"), false);
    assert.ok(state.people.find((person) => person.id === "anne").memories.some((entry) => entry.type === "household_disclosed"));
  }
  assert.equal(results[0] - results[1], 2);
});

test("old saves remain unmarried and active household plan survives loading and resolution", () => {
  const old = createNewGame();
  delete old.household.union; delete old.household.history;
  normalizeEducationCareer(old);
  assert.deepEqual(old.household.union, neutralUnion());
  assert.deepEqual(old.household.history, []);
  assert.equal(old.social.currentPartnerNpcId, null);
  let state = couple();
  assert.equal(select(state, "cohabitation_discussion", "plan").ok, true);
  const household = structuredClone(state.household), cases = structuredClone(state.openCases);
  state = load(state);
  assert.deepEqual(state.household, household);
  assert.deepEqual(state.openCases, cases);
  for (let i = 0; i < 3; i += 1) { settleHouseholdEvents(state); advanceWeek(state); settleHouseholdEvents(state); }
  assert.ok(state.household.union.cohabitingSince);
  assert.equal(validateState(state).ok, true);
});

test("plan expiry is bounded and moving cannot silently remove a shared household", () => {
  const state = establishHome(couple());
  state.events.active = null;
  state.weekly = { used: 0, selectedIds: [] };
  assert.equal(moveHome(state, "family").ok, false);
  const caseCount = state.openCases.filter((item) => item.type === "household-followup" && item.status !== "resolved").length;
  for (let i = 0; i < 12; i += 1) processHouseholdCases(state);
  assert.equal(state.openCases.filter((item) => item.type === "household-followup").length, caseCount);
  state.time.absoluteWeek += 30;
  processHouseholdCases(state);
  assert.ok(state.openCases.filter((item) => item.type === "household-followup").length <= 1);
  assert.ok(state.household.history.length <= HOUSEHOLD_HISTORY_LIMIT);
});

test("real 520-week relationship to cohabitation to marriage trajectory is deterministic and persists", () => {
  const result = runHouseholdScenario();
  assert.deepEqual(runHouseholdScenario(), result);
  assert.equal(result.partner, "elif");
  assert.equal(result.partnerCount, 1);
  assert.ok(result.union.cohabitingSince < result.union.marriedSince);
  assert.equal(result.history.filter((item) => item.kind === "cohabitation").length, 1);
  assert.equal(result.history.filter((item) => item.kind === "marriage").length, 1);
  assert.ok(result.years.some((year) => year.household.milestones.some((text) => text.includes("evlendin"))));
  assert.ok(result.maxCases <= 4);
  assert.equal(result.years.length, 10);
  assert.ok(Number.isFinite(result.balance));
});

function married() {
  const state = establishHome(couple());
  for (let week = 0; week < 16; week += 1) {
    settleHouseholdEvents(state);
    advanceWeek(state);
    settleHouseholdEvents(state);
  }
  assert.ok(state.household.union.marriedSince);
  return state;
}
function separate(state) {
  state.people.find((person) => person.id === "elif").social.tension = 60;
  state.weekly = { used: 0, selectedIds: [] };
  settleHouseholdEvents(state, { separation_discussion: "separate", relationship_tension: "avoid" });
  assert.ok(state.household.union.separatedSince);
  return state;
}

test("separation ends contribution before delayed divorce, preserving ex-person, history and private knowledge", () => {
  let state = separate(married());
  const marriageWeek = state.household.union.marriedSince;
  const due = state.openCases.find((item) => item.payload?.kind === "settlement").dueWeek;
  assert.equal(state.social.currentPartnerNpcId, "elif");
  assert.deepEqual(getHouseholdFinance(state), { partnerContribution: 0, householdExtra: 0 });
  assert.match(getHouseholdSummary(state).status, /Ayrı/);
  assert.ok(getKnownOpenCases(state).some((item) => item.payload?.kind === "settlement"));
  const secret = state.secrets.find((item) => item.id.startsWith("separation-"));
  assert.equal(isSecretKnownTo(state, secret.id, "elif"), true);
  assert.equal(isSecretKnownTo(state, secret.id, "anne"), false);
  state = load(state);
  assert.equal(state.household.union.marriedSince, marriageWeek);
  while (state.time.absoluteWeek < due) {
    assert.equal(advanceWeek(state).ok, true);
    settleHouseholdEvents(state, { separation_review: "divorce" });
  }
  assert.equal(state.social.currentPartnerNpcId, null);
  assert.deepEqual(state.household.union, neutralUnion());
  const former = state.people.find((person) => person.id === "elif");
  assert.equal(former.social.romanceStatus, "none");
  assert.ok(former.memories.some((item) => item.type === "divorce"));
  assert.ok(state.household.history.some((item) => item.kind === "marriage"));
  assert.ok(state.household.history.some((item) => item.kind === "divorce"));
  assert.equal(setRomanticInterest(state, "elif"), false, "no immediate divorce/romance loop");
  processHouseholdCases(state);
  assert.equal(state.openCases.filter((item) => item.type === "household-followup").length, 0);
  for (let week = 0; week < 52; week += 1) { settleHouseholdEvents(state); assert.equal(advanceWeek(state).ok, true); }
  assert.equal(validateState(load(state)).ok, true);
  assert.ok(state.yearlyHistory.some((year) => year.household.milestones.some((text) => text.includes("boşandınız"))));
});

test("reconciliation needs actual relationship repair, delay and one chance; elapsed time cannot repair trust", () => {
  let state = separate(married());
  assert.equal(canReconcile(state), false);
  const started = state.household.union.separatedSince;
  for (let i = 0; i < 6; i += 1) {
    assert.equal(advanceWeek(state).ok, true);
    // Keep the due review open for the later explicit decision.
    if (state.events.active?.eventId !== "separation_review") settleHouseholdEvents(state);
  }
  assert.equal(canReconcile(state), false);
  // Direct social actions are real scarce weekly decisions, not time-only repair.
  assert.equal(resolveEvent(state, "private").ok, true);
  for (let i = 0; i < 8 && !canReconcile(state); i += 1) {
    assert.equal(advanceWeek(state).ok, true); settleHouseholdEvents(state);
    const action = canUseSocialAction(state, "elif", "repair").ok ? "repair" : "confide";
    assert.equal(applySocialAction(state, "elif", action).ok, true);
  }
  assert.ok(state.time.absoluteWeek >= started + 6);
  assert.equal(canReconcile(state), true);
  state = load(state);
  const limit = state.time.absoluteWeek + 40;
  while (state.household.union.separatedSince && state.time.absoluteWeek < limit) {
    advanceWeek(state); settleHouseholdEvents(state, { separation_review: "reconcile" });
  }
  assert.equal(state.household.union.separatedSince, null);
  assert.equal(state.household.union.reconciled, true);
  assert.ok(state.household.history.some((entry) => entry.kind === "separation"));
  assert.ok(state.household.history.some((entry) => entry.kind === "reconciliation"));
  while (state.time.absoluteWeek < (state.events.cooldowns.separation_discussion || 0)) { advanceWeek(state); settleHouseholdEvents(state); }
  separate(state);
  assert.equal(canReconcile(state), false, "a second cycle cannot farm reconciliation");
});

test("family intention disagreement stays private and a deferred callback does not grant relationship gain", () => {
  const state = married();
  state.weekly = { used: 0, selectedIds: [] };
  state.finances.balance = 500;
  const before = getRelationship(state, "elif").tension;
  assert.equal(select(state, "family_intent_discussion", "wants").ok, true);
  assert.deepEqual(state.household.union.familyPlan, { intent: "wants", response: "not_now" });
  assert.equal(getRelationship(state, "elif").tension, before + 3);
  const secret = state.secrets.find((item) => item.id.startsWith("family-intent-"));
  assert.equal(isSecretKnownTo(state, secret.id, "elif"), true);
  assert.equal(isSecretKnownTo(state, secret.id, "anne"), false);
  const plan = state.openCases.find((item) => item.payload?.kind === "planning");
  assert.equal(canDiscussHousehold(state, "planning"), false);
  const saved = load(state);
  assert.deepEqual(saved.household.union.familyPlan, state.household.union.familyPlan);
  state.time.absoluteWeek = plan.dueWeek;
  const tension = getRelationship(state, "elif").tension;
  assert.equal(select(state, plan.eventId, "private", plan.id).ok, true);
  assert.equal(getRelationship(state, "elif").tension, tension);
  assert.equal(plan.status, "resolved");
  assert.match(getHouseholdSummary(state).familyPlanning, /Şimdi değil/);
  assert.equal(state.children, undefined);
});

test("family intention follow-up uses a slot and preserves both expressed intentions", () => {
  const state = married();
  state.weekly = { used: 0, selectedIds: [] };
  assert.equal(select(state, "family_intent_discussion", "no").ok, true);
  const intention = structuredClone(state.household.union.familyPlan);
  const due = state.openCases.find((item) => item.payload?.kind === "planning").dueWeek;
  while (state.time.absoluteWeek < due) { advanceWeek(state); settleHouseholdEvents(state, { family_intent_review: "talk" }); }
  assert.deepEqual(state.household.union.familyPlan, intention);
  assert.ok(state.weekly.selectedIds.includes("household:family_intent_review"));
  assert.ok(state.people.find((person) => person.id === "elif").memories.some((entry) => entry.type === "family_intent_review"));
});


test("existing home-search invitation joins the same household plan instead of creating parallel progress", () => {
  const state = couple();
  assert.equal(getEventDefinition("move_in_with_elif").condition(state), true);
  assert.equal(select(state, "move_in_with_elif", "look").ok, true);
  assert.equal(state.weekly.used, 1);
  assert.equal(state.openCases.filter((item) => item.payload?.kind === "cohabitation").length, 1);
  assert.equal(getEventDefinition("cohabitation_discussion").condition(state), false);
  assert.equal(select(state, "cohabitation_discussion", "plan").ok, false);
  for (let i = 0; i < 3; i += 1) { settleHouseholdEvents(state); advanceWeek(state); settleHouseholdEvents(state); }
  assert.ok(state.household.union.cohabitingSince);
});

test("separated partners do not receive ordinary shared-home invitations", () => {
  const state = separate(married());
  assert.equal(getEventDefinition("move_in_with_elif").condition(state), false);
  assert.equal(getEventDefinition("partner_location_ping").condition(state), false);
  assert.equal(getEventDefinition("cohabitation_discussion").condition(state), false);
  assert.equal(getEventDefinition("family_intent_discussion").condition(state), false);
});


test("520 weeks of real neglected household decisions reach separation and divorce without forced state", () => {
  const result = runHouseholdScenario(520, { conflict: true });
  assert.deepEqual(runHouseholdScenario(520, { conflict: true }), result);
  const stages = ["cohabitation", "marriage", "separation", "divorce"].map((kind) => result.history.find((entry) => entry.kind === kind));
  assert.ok(stages.every(Boolean));
  assert.ok(stages.every((entry, index) => index === 0 || entry.week > stages[index - 1].week));
  assert.equal(result.partner, null);
  assert.equal(result.partnerCount, 0);
  assert.equal(result.activeHouseholdCases, 0);
  assert.equal(result.years.length, 10);
  assert.ok(result.balance > 0);
  assert.ok(result.npcMemoryCounts.every((count) => count <= 50));
});

test("household normalization rejects impossible dates and keeps bounded history without inventing a union", () => {
  const state = couple();
  state.household.union = { cohabitingSince: -1, marriedSince: 9999, separatedSince: 9998, reconciled: "yes", familyPlan: { intent: "constructor", response: "wants" } };
  state.household.history = Array.from({ length: 40 }, (_, i) => ({ id: `old-${i}`, week: 1, text: "Geçmiş karar" }));
  assert.equal(validateState(state).ok, false);
  normalizeEducationCareer(state);
  assert.deepEqual(state.household.union, neutralUnion());
  assert.equal(state.household.history.length, 24);
  assert.equal(validateState(state).ok, true);
});
