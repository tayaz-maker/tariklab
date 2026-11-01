import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  createGame,
  getActions,
  getAppointmentOptions,
  getDecisionView,
  getGoals,
  getNpcLocation,
  getSocietyView,
  previewAction,
  resolveAction,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { EVENTS } from "../public/games/tc-sim-boardworld/content.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";

// Focused adverse setups are explicit fixtures. The separate six365-day
// acceptance lives start fresh and progress exclusively through legal actions.
function fixture() {
  const s = createGame({ scenario: "restart", seed: 7 });
  s.pendingEvents = [];
  s.resolvedEvents = EVENTS.map((e) => e.id);
  s.cash = 20000;
  s.bank = 20000;
  assert.ok(validateState(s));
  return s;
}
const descriptor = (s, id) => getActions(s).find((a) => a.id === id);
const available = (s, id) => descriptor(s, id)?.disabled === false;
function act(s, id, payload) {
  const original = structuredClone(s),
    result = resolveAction(s, id, payload);
  assert.deepEqual(s, original, `${id} never mutates the caller`);
  assert.equal(result.ok, true, `${id}: ${result.message}`);
  assert.ok(validateState(result.state), `${id} yields a strict valid state`);
  assert.deepEqual(importGame(exportGame(result.state)).state, result.state);
  return result.state;
}
function refused(s, id, payload) {
  const original = structuredClone(s),
    result = resolveAction(s, id, payload);
  assert.equal(result.ok, false, `${id} must be refused`);
  assert.strictEqual(result.state, s);
  assert.deepEqual(s, original);
}
function waitUntil(s, target) {
  while (s.time < target) s = act(s, target - s.time >= 60 ? "wait:60" : "wait:15");
  return s;
}
let offerState;
function offered() {
  if (!offerState) {
    let s = fixture();
    for (let i = 0; !s.society.offers.some((o) => o.status === "open") && i < 90; i++)
      s = act(s, "wait:60");
    assert.ok(s.society.offers.some((o) => o.status === "open"));
    offerState = s;
  }
  return structuredClone(offerState);
}
function archived(name) {
  return importGame(
    readFileSync(new URL(`./fixtures/boardworld/${name}.json`, import.meta.url), "utf8"),
  ).state;
}

test("an unsolicited real invitation is optional; only explicit acceptance can create a missed commitment", () => {
  const start = offered(),
    offer = start.society.offers.find((o) => o.status === "open");
  const counter = start.calendar.entries.find((e) => e.id === offer.calendarId);
  assert.equal(counter.status, "counter");
  const before = structuredClone(start);
  const decision = getDecisionView(start);
  getSocietyView(start);
  assert.deepEqual(start, before);
  assert.equal(
    decision.urgent.some((row) => row.id.includes(counter.id)),
    false,
  );
  let ignored = waitUntil(start, counter.end + 75);
  assert.equal(ignored.calendar.stats.missed, start.calendar.stats.missed);
  assert.equal(ignored.calendar.entries.find((e) => e.id === counter.id).status, "rejected");
  assert.equal(ignored.society.offers.find((o) => o.id === offer.id).status, "expired");
  let accepted = act(start, `calendar:accept:${counter.id}`);
  accepted = waitUntil(accepted, counter.end + 75);
  assert.equal(accepted.calendar.entries.find((e) => e.id === counter.id).status, "missed");
  assert.equal(accepted.calendar.stats.missed, start.calendar.stats.missed + 1);
  const once = accepted.calendar.stats.missed;
  accepted = act(importGame(exportGame(accepted)).state, "wait:60");
  assert.equal(accepted.calendar.stats.missed, once, "save/reload cannot repeat the consequence");
  ignored = act(ignored, "wait:15");
  assert.equal(ignored.calendar.stats.missed, start.calendar.stats.missed);
});

test("an accepted invitation rechecks participant solvency and cannot charge either party on a failed attendance", () => {
  let s = offered();
  const offer = s.society.offers.find((o) => o.status === "open");
  s = act(s, `calendar:accept:${offer.calendarId}`);
  const entry = s.calendar.entries.find((e) => e.id === offer.calendarId);
  if (s.location !== entry.district) s = act(s, `travel:${entry.district}`);
  s = act(s, `visit:${entry.venue}`);
  s = waitUntil(s, entry.start - 30);
  const fee = descriptor(s, `calendar:attend:${entry.id}`).cost;
  assert.ok(fee > 0, "the actual invitation uses a paid venue");
  // An adverse but valid pre-attendance change, not fabricated player progress.
  s.deep.npcs[offer.npcId].cash = 0;
  assert.ok(validateState(s));
  const action = descriptor(s, `calendar:attend:${entry.id}`);
  assert.ok(action.disabled);
  assert.doesNotMatch(action.reason, /0 TL|bakiye.*0/);
  refused(s, action.id);
  assert.equal(s.calendar.entries.find((e) => e.id === entry.id).status, "confirmed");
});

test("a real broken commitment can be repaired by subsequent kept plans, without erasing history or farming trust", () => {
  let s = offered();
  const offer = s.society.offers.find((o) => o.status === "open");
  const first = s.calendar.entries.find((e) => e.id === offer.calendarId);
  s = act(s, `calendar:accept:${first.id}`);
  s = waitUntil(s, first.end + 75);
  const clarification = `society:clarify:${offer.npcId}:calendar:${first.id}`;
  refused(s, clarification);
  for (
    let turn = 0;
    (s.npcs[offer.npcId].affinity < 20 || s.npcs[offer.npcId].trust < 15) && turn < 200;
    turn++
  ) {
    const legal = getActions(s).filter((a) => !a.disabled),
      pick = (id) => legal.find((a) => a.id === id);
    let action = s.player.hunger < 40 && (pick("cook") || pick("soup") || pick("eat"));
    action ||=
      pick(`talk:${offer.npcId}`) ||
      pick(`apologize:${offer.npcId}`) ||
      pick(`call:${offer.npcId}`);
    if (!action && s.time % 1440 >= 1080) action = pick("sleep");
    if (!action && s.player.energy < 40) action = pick("rest");
    if (!action && s.location !== getNpcLocation(s, offer.npcId))
      action = pick(`travel:${getNpcLocation(s, offer.npcId)}`);
    action ||= pick("wait:60");
    s = act(s, action.id);
  }
  let proposal;
  for (let offset = 1; !proposal && offset < 7; offset++) {
    const draft = {
      kind: "meeting",
      npcId: offer.npcId,
      subjectId: "",
      day: Math.floor(s.time / 1440) + 1 + offset,
      venue: "kadikoy-cafe",
      duration: 60,
      repeat: "none",
    };
    const slot = getAppointmentOptions(s, draft).slots.find(
      (p) => p.available && !p.rejectionExpected && !p.counterExpected,
    );
    if (slot) proposal = { ...draft, minute: slot.minute };
  }
  assert.ok(proposal);
  s = act(s, "calendar:propose", proposal);
  const kept = s.calendar.entries.at(-1);
  if (kept.status === "counter") s = act(s, `calendar:accept:${kept.id}`);
  if (s.location !== kept.district) s = act(s, `travel:${kept.district}`);
  s = act(s, `visit:${kept.venue}`);
  s = waitUntil(s, kept.start - 30);
  s = act(s, `calendar:attend:${kept.id}`);
  for (let turn = 0; !available(s, clarification) && turn < 48; turn++) s = act(s, "wait:60");
  const trust = s.npcs[offer.npcId].trust;
  s = act(s, clarification);
  const repaired = s.society.knowledge[offer.npcId].find((f) => f.id === `calendar:${first.id}`);
  assert.equal(repaired.corrected, true);
  assert.equal(repaired.appliedTrust, 0);
  assert.equal(
    s.npcs[offer.npcId].trust,
    trust,
    "the original participant's direct no-show penalty is not a gossip refund",
  );
  assert.equal(s.calendar.entries.find((e) => e.id === first.id).status, "missed");
  assert.equal(s.calendar.entries.find((e) => e.id === kept.id).status, "completed");
  refused(importGame(exportGame(s)).state, clarification);
});

test("calendar collisions cannot turn an optional society offer into overlapping accepted time", () => {
  let s = offered();
  const offer = s.society.offers.find((o) => o.status === "open");
  const entry = s.calendar.entries.find((e) => e.id === offer.calendarId);
  const proposal = {
    kind: "personal",
    subjectId: "rest",
    npcId: "",
    day: Math.floor(entry.start / 1440) + 1,
    minute: entry.start % 1440,
    venue: `${entry.district}-park`,
    duration: entry.end - entry.start,
    repeat: "none",
  };
  assert.ok(
    getAppointmentOptions(s, proposal).slots.some(
      (slot) => slot.minute === proposal.minute && slot.available,
    ),
  );
  s = act(s, "calendar:propose", proposal);
  refused(s, `calendar:accept:${entry.id}`);
  assert.equal(s.society.offers.find((o) => o.id === offer.id).status, "open");
  assert.equal(s.calendar.entries.filter((e) => e.status === "confirmed").length, 1);
});

test("ordinary calendar rescheduling preserves an NPC invitation and charges the new venue once", () => {
  let s = offered();
  const offer = s.society.offers.find((o) => o.status === "open");
  s = act(s, `calendar:accept:${offer.calendarId}`);
  const original = s.calendar.entries.find((e) => e.id === offer.calendarId);
  if (s.time % 1440 >= 1260) s = waitUntil(s, (Math.floor(s.time / 1440) + 1) * 1440 + 540);
  let proposal;
  for (let offset = 2; !proposal && offset <= 5; offset++) {
    const draft = {
      kind: "meeting",
      npcId: offer.npcId,
      subjectId: "",
      day: Math.floor(s.time / 1440) + 1 + offset,
      venue: "besiktas-cafe",
      duration: 60,
      repeat: "none",
      ignoreId: original.id,
    };
    const slot = getAppointmentOptions(s, draft).slots.find(
      (p) => p.available && !p.rejectionExpected,
    );
    if (slot) {
      proposal = { ...draft, minute: slot.minute };
      delete proposal.ignoreId;
    }
  }
  assert.ok(proposal);
  s = act(s, `calendar:reschedule:${original.id}`, proposal);
  let replacement = s.calendar.entries.find((e) => e.replacesId === original.id);
  assert.ok(replacement);
  if (replacement.status === "counter") s = act(s, `calendar:accept:${replacement.id}`);
  replacement = s.calendar.entries.find((e) => e.id === replacement.id);
  assert.equal(replacement.status, "confirmed");
  assert.equal(s.society.offers.find((o) => o.id === offer.id).calendarId, replacement.id);
  assert.equal(s.calendar.entries.find((e) => e.id === original.id).status, "cancelled");
  if (s.location !== replacement.district) s = act(s, `travel:${replacement.district}`);
  s = act(s, `visit:${replacement.venue}`);
  s = waitUntil(s, replacement.start - 15);
  const actionId = `calendar:attend:${replacement.id}`,
    fee = descriptor(s, actionId).cost;
  const npcCash = s.deep.npcs[offer.npcId].cash,
    playerCash = s.cash;
  assert.equal(fee, 90, "the new Beşiktaş venue has its actual published fee");
  s = act(s, actionId);
  assert.equal(s.deep.npcs[offer.npcId].cash, npcCash - fee);
  assert.equal(s.cash, playerCash - fee);
  refused(importGame(exportGame(s)).state, actionId);
});

test("a routine's actual paid shift creates the same sourced work observation as a manual shift", () => {
  let s = act(fixture(), "apply:retail");
  s = act(s, "policy:meal:frugal");
  s = act(s, "policy:autoWithdraw:true");
  const manual = act(s, "work");
  const routine = act(s, "schedule:run:1");
  assert.ok(routine.deep.routine.lastActions.includes("work"));
  for (const state of [manual, routine]) {
    const report = state.society.knowledge.okan.find((f) => f.topic === "work");
    assert.ok(report, "the manager observes actual labor regardless of entry point");
    assert.equal(report.originActorId, "okan");
    assert.equal(report.sourceActorId, "okan");
    assert.equal(report.privacy, "shareable");
    assert.equal(report.credibility, 100);
  }
});

test("a saved zero-time stop cannot be retried through revision changes and direct recovery is real", () => {
  let s = fixture();
  s.player.hunger = 25;
  s.cash = 0;
  s.inventory.groceries = 0;
  s = act(s, "schedule:run:1");
  assert.equal(s.flow.stop.code, "meal");
  const diagnostic = getDecisionView(s).routine;
  assert.equal(diagnostic.retryAllowed, false);
  assert.ok(diagnostic.actionIds.includes("withdraw:1000"));
  s = importGame(exportGame(s)).state;
  s.revision += 10; // Harmless cross-tab revision noise cannot reset a known blocker.
  assert.ok(validateState(s));
  for (let i = 0; i < 20; i++) refused(s, "schedule:run:1");
  const total = s.cash + s.bank,
    clock = s.time;
  s = act(s, "withdraw:1000");
  assert.equal(s.cash + s.bank, total);
  assert.ok(s.time >= clock);
  assert.equal(available(s, "schedule:run:1"), true);
});

test("a real mature enterprise earns the new goal through explicit debt, reserve and capital choices", () => {
  let s = archived("v4-entrepreneur-day366");
  const goal = (state) => getGoals(state).find((g) => g.id === "sustainable-business");
  assert.equal(s.job, null);
  assert.equal(goal(s).complete, false);
  const original = structuredClone(s),
    finance = getDecisionView(s).finance;
  assert.ok(finance.available > finance.debt && finance.monthlyInterest > 0);
  assert.ok(finance.repaymentActionIds.includes("repay:all"));
  assert.deepEqual(s, original, "displaying high debt never silently repays it");
  const assets = s.cash + s.bank + s.deep.finance.reserve + s.living.enterprise.capital;
  const debt = s.debt;
  s = act(s, "repay:all");
  s = act(s, "finance:reserve:5000");
  s = act(s, "business:fund:2000");
  assert.equal(s.debt, 0);
  assert.equal(s.job, null);
  assert.equal(
    s.cash + s.bank + s.deep.finance.reserve + s.living.enterprise.capital,
    assets - debt,
  );
  assert.equal(goal(s).complete, true);
  assert.ok(s.achievements.includes("sustainable-business"));
  assert.equal(goal(importGame(exportGame(s)).state).complete, true);
});

test("scarce supply keeps bankruptcy recovery reachable and cannot sell inventory below zero", () => {
  let s = fixture();
  s.cash = 0;
  s.bank = 0;
  s.inventory.groceries = 0;
  s.player.hunger = 20;
  s.society.districts[s.location].foodStock = 0;
  assert.ok(validateState(s));
  refused(s, "buy:groceries");
  for (let i = 0; !available(s, "soup") && i < 10; i++) s = act(s, "wait:60");
  const hunger = s.player.hunger,
    cash = s.cash;
  s = act(s, "soup");
  assert.ok(s.player.hunger > hunger);
  assert.equal(s.cash, cash);
  assert.equal(s.society.districts[s.location].foodStock, 0);
  refused(s, "soup");
});

test("district material pricing rejects marginal capital before any inventory, money or time changes", () => {
  let s = act(fixture(), "business:start:repair");
  s = act(s, "business:fund:2000");
  const original = descriptor(s, "business:stock:3").societyCost.amount;
  s.society.districts[s.location].weeklyDelta.stockPricePct = 110;
  const updated = descriptor(s, "business:stock:3").societyCost.amount;
  assert.ok(updated > original);
  s.living.enterprise.capital = updated - 1;
  assert.ok(validateState(s));
  const before = structuredClone(s);
  const preview = previewAction(s, "business:stock:3");
  assert.ok(preview);
  assert.deepEqual(s, before);
  refused(s, "business:stock:3");
});

test("checksum-valid malformed society imports cannot duplicate invitations or forge knowledge chronology", () => {
  const invitation = offered();
  const witnessed = act(act(fixture(), "apply:retail"), "work");
  const cases = [
    [
      invitation,
      (s) => {
        s.society.nextId = 1;
      },
    ],
    [
      invitation,
      (s) => {
        s.society.offers.push({ ...s.society.offers[0], id: `offer-${s.society.nextId++}` });
      },
    ],
    [
      invitation,
      (s) => {
        s.society.offers[0].calendarId = "cal-99999";
      },
    ],
    [
      witnessed,
      (s) => {
        s.society.knowledge.okan[0].sourceActorId = "unknown-person";
      },
    ],
    [
      witnessed,
      (s) => {
        s.society.knowledge.okan[0].disclosedAt = s.time + 1;
      },
    ],
    [
      witnessed,
      (s) => {
        s.society.knowledge.okan[0].disclosed = false;
      },
    ],
    [
      witnessed,
      (s) => {
        s.society.knowledge.okan[0].hops = 3;
      },
    ],
    [
      witnessed,
      (s) => {
        s.flow.stop = { code: "invented", fingerprint: "trust-me" };
      },
    ],
  ];
  for (const [source, corrupt] of cases) {
    const original = exportGame(source),
      changed = structuredClone(source);
    corrupt(changed);
    assert.equal(validateState(changed), false);
    const envelope = JSON.parse(original);
    envelope.payload = JSON.stringify(changed);
    // Recompute the documented corruption checksum so this tests schema
    // rejection rather than merely rejecting an accidentally damaged envelope.
    let hash = 2166136261;
    for (let i = 0; i < envelope.payload.length; i++)
      hash = Math.imul(hash ^ envelope.payload.charCodeAt(i), 16777619) >>> 0;
    envelope.checksum = hash.toString(16).padStart(8, "0");
    assert.equal(importGame(JSON.stringify(envelope)).state, null);
    assert.equal(exportGame(source), original);
  }
});
