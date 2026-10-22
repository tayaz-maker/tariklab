import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, normalizeEducationCareer, setYearlyPriorities } from "../public/games/tc-sim/js/state.js";
import { applyDecision, advanceWeek } from "../public/games/tc-sim/js/time.js";
import { currentGoal, decisionTags, processDecisionNetworkWeek, PAYOFF_COOLDOWN } from "../public/games/tc-sim/js/decision-network.js";
import { deserializeState } from "../public/games/tc-sim/js/save.js";
import { enqueueEvent, activateNextEvent, resolveEvent } from "../public/games/tc-sim/js/events.js";
import { settleHouseholdEvents } from "./tc-sim-longrun.mjs";

const reload = s => { const r = deserializeState(JSON.stringify(s)); assert.equal(r.ok, true, r.error); return r.state; };
function fresh(count = 1) {
  const s = createNewGame({ seed: 41, now: "2027-01-01T00:00:00Z" });
  s.finances.balance = 50000;
  s.parenthood.children = Array.from({ length: count }, (_, i) => ({ id: `kid-${i}`, name: `Çocuk ${i}`, bornWeek: 1, otherParentId: "elif", livesWithPlayer: true,
    relationship: { closeness: 60, trust: 40, tension: 20 } }));
  normalizeEducationCareer(s); setYearlyPriorities(s, ["relationship"]);
  return s;
}
function week(s, decision) {
  settleHouseholdEvents(s);
  assert.equal(applyDecision(s, decision).ok, true);
  settleHouseholdEvents(s);
  assert.equal(advanceWeek(s).ok, true);
}

test("three actual care weeks pay the child once across reload, with the same economy and no mother bonus", () => {
  let s = fresh(), control = structuredClone(s); setYearlyPriorities(control, []);
  const progress = currentGoal(s).progress;
  assert.ok(decisionTags(s, "parent-care").some(t => t.domain === "hedef"));
  assert.ok(!decisionTags(s, "call-anne").some(t => t.domain === "hedef"));
  assert.ok(!decisionTags(s, "parent-plan").some(t => t.domain === "hedef"));
  for (let i = 0; i < 3; i++) { week(s, "parent-care"); week(control, "parent-care"); s = reload(s); }
  assert.equal(s.parenthood.children[0].relationship.trust, control.parenthood.children[0].relationship.trust + 3);
  assert.equal(s.parenthood.children[0].relationship.tension, control.parenthood.children[0].relationship.tension - 2);
  assert.equal(s.people.find(p => p.id === "anne").social.trust, control.people.find(p => p.id === "anne").social.trust);
  assert.ok(currentGoal(s).progress > progress);
  assert.deepEqual(s.finances, control.finances);
  const paidAt = s.time.absoluteWeek - 1;
  assert.equal(s.decisionNetwork.nextPayoff, paidAt + PAYOFF_COOLDOWN);
  const after = structuredClone(s.parenthood.children);
  processDecisionNetworkWeek(s, ["parent-care"]);
  const once = structuredClone(s.parenthood.children);
  processDecisionNetworkWeek(s, ["parent-care"]);
  assert.deepEqual(s.parenthood.children, once);
  assert.deepEqual(once, after, "cooldown forbids another reward even in the next week");
  setYearlyPriorities(s, ["education"]);
  assert.equal(s.decisionNetwork.streak, 0);
  assert.equal(s.decisionNetwork.nextPayoff, paidAt + PAYOFF_COOLDOWN);
  assert.equal(currentGoal(reload(s)).arc, "education");
});

test("mother calls cannot build a child-goal streak and retain their existing relationship effect", () => {
  const s = fresh();
  for (let i = 0; i < 3; i++) { s.time.absoluteWeek++; processDecisionNetworkWeek(s, ["call-anne"]); }
  assert.equal(s.decisionNetwork.streak, 0); assert.equal(s.decisionNetwork.nextPayoff, 0);
  const mother = fresh(0); mother.relationships.anne = 20;
  mother.people.find(p => p.id === "anne").social.trust = 40;
  settleHouseholdEvents(mother);
  const trust = mother.people.find(p => p.id === "anne").social.trust;
  assert.equal(applyDecision(mother, "call-anne").ok, true);
  assert.equal(mother.people.find(p => p.id === "anne").social.trust, trust + 2, "the existing mother-call effect is preserved");
  assert.ok(!decisionTags(s, "family").some(t => t.domain === "hedef"));
});

test("multiple children share a single reward budget; absent, deceased and older children are not care recipients", () => {
  const s = fresh(2), before = s.parenthood.children.reduce((n, c) => n + c.relationship.trust, 0);
  s.time.absoluteWeek = 400;
  for (const child of s.parenthood.children) child.bornWeek = 350;
  s.parenthood.children.push({ ...structuredClone(s.parenthood.children[0]), id: "absent", livesWithPlayer: false, relationship: { closeness: 10, trust: 10, tension: 50 } });
  s.parenthood.children.push({ ...structuredClone(s.parenthood.children[0]), id: "dead", alive: false, relationship: { closeness: 5, trust: 5, tension: 50 } });
  s.parenthood.children.push({ ...structuredClone(s.parenthood.children[0]), id: "older", bornWeek: 1, relationship: { closeness: 5, trust: 5, tension: 50 } });
  for (let i = 0; i < 3; i++) { s.time.absoluteWeek++; processDecisionNetworkWeek(s, ["parent-care"]); }
  assert.equal(s.parenthood.children.slice(0, 2).reduce((n, c) => n + c.relationship.trust, 0) - before, 3);
  assert.equal(s.parenthood.children[2].relationship.trust, 10);
  assert.equal(s.parenthood.children[3].relationship.trust, 5);
  assert.equal(s.parenthood.children[4].relationship.trust, 5);
  const capped = fresh(); capped.parenthood.children[0].relationship = { closeness: 60, trust: 99, tension: 1 };
  for (let i = 0; i < 3; i++) { capped.time.absoluteWeek++; processDecisionNetworkWeek(capped, ["parent-care"]); }
  assert.equal(capped.parenthood.children[0].relationship.trust, 100);
  assert.equal(capped.parenthood.children[0].relationship.tension, 0);
});

test("V5/V6 child commitment reloads keep the existing fields and partial streak", () => {
  for (const version of [5, 6]) {
    let s = fresh(); s.meta.saveVersion = version;
    s = reload(s);
    week(s, "parent-care");
    const before = structuredClone(s.decisionNetwork), loaded = reload(s);
    assert.deepEqual(loaded.decisionNetwork, before);
    assert.deepEqual(loaded.parenthood.children, s.parenthood.children);
    assert.equal(loaded.meta.saveVersion, 6);
  }
});

// Existing child relationship decisions already advance the real bond-based
// annual goal; they do not need a new action or a second synthetic reward.
test("a real child reconciliation advances that child's goal through the existing event pipeline", () => {
  const s = fresh(); s.time.absoluteWeek = 625;
  const before = currentGoal(s).progress;
  s.events.active = null; s.events.queue = [];
  const id = "child-repair-test";
  s.openCases.push({ id, type: "parenting-followup", chainId: "CHN-C03", eventId: "child_conflict_repair", createdWeek: 623, dueWeek: 625, expiresWeek: 637,
    status: "pending", payload: { kind: "conflict", childId: "kid-0", playerKnown: true } });
  enqueueEvent(s, "child_conflict_repair", id); activateNextEvent(s);
  assert.equal(resolveEvent(s, "repair").ok, true);
  assert.equal(s.parenthood.children[0].relationship.trust, 43);
  assert.ok(currentGoal(s).progress > before);
});
