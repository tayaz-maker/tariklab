import test from "node:test";
import assert from "node:assert/strict";
import { create, applyAction, normalize, POLICIES } from "../public/games/next-wave.js";
import { hydrateDevlet, tickDevlet, applyPolicy } from "../public/games/next-wave/devlet-sim.js";
import { applyContentChoice, settleDevletContent, eventById } from "../public/games/next-wave/devlet-content.js";
import { contentCard } from "../public/games/tc-sim-devlet/presentation.js";

const copy = (value) => JSON.parse(JSON.stringify(value));
const act = (state, action) => applyAction(state.meta.id, state, action);
const fresh = () => hydrateDevlet("2002", { seed: 11 });

test("DEVLET: zero treasury remains zero-based after save/reload and a month", () => {
  const zero = fresh();
  zero.actual.treasury = 0;
  const loaded = normalize("tc-sim-devlet", copy(zero));
  assert.equal(loaded.actual.treasury, 0);
  const nearZero = copy(loaded);
  nearZero.actual.treasury = .0001;
  tickDevlet(loaded);
  tickDevlet(nearZero);
  assert.ok(loaded.actual.treasury < 3, `zero treasury rebounded to ${loaded.actual.treasury}`);
  assert.ok(Math.abs(loaded.actual.treasury - nearZero.actual.treasury) < .001);
});

test("DEVLET: naturally exhausted treasury cannot regenerate the initial fund", () => {
  let state = fresh();
  let exhausted = false;
  for (let month = 0; month < 12; month += 1) {
    const wasEmpty = state.actual.treasury === 0;
    for (const policy of [...POLICIES[state.eraId]].sort((a, b) => b.cost - a.cost))
      applyPolicy(state, policy.id);
    act(state, "advance");
    if (wasEmpty) assert.ok(state.actual.treasury < 3, `exhausted treasury rebounded to ${state.actual.treasury}`);
    exhausted ||= state.actual.treasury === 0;
    state = normalize("tc-sim-devlet", copy(state));
  }
  assert.ok(exhausted, "normal policy costs reached zero without a synthetic save");
});

test("DEVLET: positive-value monthly economy keeps its established result", () => {
  const state = fresh();
  tickDevlet(state);
  assert.deepEqual({ treasury: state.actual.treasury, unemployment: state.actual.unemployment,
    heat: state.heat, entropy: state.entropy, info: state.infoQuality, rumor: state.rumor }, {
    treasury: 99.36847571076244, unemployment: 9.952749751488481,
    heat: 40.10565407172938, entropy: 40.015, info: 57.861000000000004, rumor: 19.9,
  });
});

function naturalFinal() {
  const state = hydrateDevlet("2002", { seed: 1 });
  while (!state.flags.campaignEnd && state.time.turn < 60) act(state, "advance");
  assert.equal(state.time.turn, 48);
  assert.equal(state.flags.campaignEnd, true);
  assert.ok(state.flags.contentActive?.eventId, "natural final-month dossier is present");
  return state;
}

test("DEVLET: final decisions, month settlement and direct engine calls are no-ops after reload", () => {
  const final = normalize("tc-sim-devlet", copy(naturalFinal()));
  const event = eventById(final.flags.contentActive.eventId);
  const contentAction = `content:${event.id}:${event.choices[0].id}`;
  const actions = [contentAction, "policy", "policy:imf-sba", "advance", "tick:12", "focus:dogu", "diplo:eu:dialogue", "doctrine:institutional"];
  for (const action of actions) {
    const state = copy(final);
    act(state, action);
    assert.deepEqual(state, final, `terminal action ${action} changed the final result`);
  }
  for (const operation of [
    (s) => applyPolicy(s, "imf-sba"),
    (s) => applyContentChoice(s, event.id, event.choices[0].id),
    (s) => settleDevletContent(s),
    (s) => tickDevlet(s),
  ]) {
    const state = copy(final);
    operation(state);
    assert.deepEqual(state, final, "a direct engine entry mutated a terminal save");
  }
});

test("DEVLET: final dossier is visible with disabled choices; an active dossier still works", () => {
  globalThis.window = { tlabI18n: { getLang: () => "tr" } };
  const final = naturalFinal();
  const buttons = contentCard(final).match(/<button\b[^>]*>/g) || [];
  assert.ok(buttons.length > 0);
  assert.ok(buttons.every((tag) => /\bdisabled\b/.test(tag)));
  const active = fresh();
  const event = eventById(final.flags.contentActive.eventId);
  active.flags.contentActive = { eventId: event.id, turn: active.time.turn };
  assert.doesNotMatch(contentCard(active), /\bdisabled\b/);
  const before = copy(active);
  assert.equal(applyContentChoice(active, event.id, event.choices[0].id), true);
  assert.notDeepEqual(active, before);
  assert.equal(active.flags.contentActive, null);
});

test("DEVLET: the closing month still settles its pending policy once", () => {
  const state = hydrateDevlet("2002", { seed: 1 });
  while (state.time.turn < 47) act(state, "advance");
  applyPolicy(state, POLICIES[state.eraId][0].id);
  assert.ok(state.flags.pendingPolicies.length);
  act(state, "advance");
  assert.equal(state.time.turn, 48);
  assert.equal(state.flags.campaignEnd, true);
  assert.equal(state.flags.pendingPolicies.length, 0);
  const final = structuredClone(state);
  act(state, "advance");
  assert.deepEqual(state, final);
});

function supportedMeeting() {
  const state = create("apartman");
  for (const resident of state.residents) resident.trust = resident.satisfaction = 90;
  return state;
}

for (const [issue, system] of [["i5", "su"], ["i4", "cati"]]) {
  for (const [proposal, gain] of [["cheap-patch", 5], ["durable-maintenance", 12]]) {
    test(`KAPI NÖBETİ: ${proposal} consistently targets focused ${system}, including reload callbacks`, () => {
      let state = supportedMeeting();
      const beforeParts = copy(state.building.parts);
      act(state, `focus:${issue}`);
      state = normalize("apartman", copy(state));
      act(state, `proposal:${proposal}`);
      assert.equal(state.lastMeeting.accepted, true);
      for (const part of state.building.parts) {
        const before = beforeParts.find((row) => row.id === part.id).condition;
        assert.equal(part.condition, before + (part.id === system ? gain : 0), part.id);
      }
      assert.equal(state.issues.find((row) => row.id === issue).status, "kapali");
      assert.equal(state.issues.find((row) => row.id === "i1").status, "acik");
      assert.equal(state.openCases.at(-1).system, system);
      const delayed = state.delayedEffects.find((row) => row.cause === proposal);
      assert.equal(delayed.system, system);
      const after = copy(state);
      act(state, `proposal:${proposal}`);
      assert.deepEqual(state, after, "same-week double click does not repeat the repair");
      state = normalize("apartman", copy(state));
      if (proposal === "cheap-patch") {
        assert.equal(state.flags.cheapSystem, system);
        while (state.week < delayed.dueTurn) act(state, "advance");
        assert.ok(state.issues.some((row) => row.id === `callback-${system}-${state.week}` && row.system === system));
      }
    });
  }
}

test("KAPI NÖBETİ: a missing focused issue retains the existing first-open-system fallback", () => {
  const state = supportedMeeting();
  state.flags.focusIssue = "retired-issue";
  act(state, "proposal:cheap-patch");
  assert.equal(state.flags.cheapSystem, "asansor");
  assert.equal(state.issues.find((row) => row.id === "i1").status, "kapali");
});

for (const status of [undefined, "open"]) {
  test(`KAPI NÖBETİ: ${status || "legacy unmarked"} follow-up applies once and survives repeated reloads`, () => {
    let state = supportedMeeting();
    const debtorId = state.residents.find((r) => !r.pays).id;
    state.openCases = [{ id: "test-followup", kind: "inspection", due: 2, system: "su", ...(status ? { status } : {}) }];
    const withoutCase = copy(state);
    withoutCase.openCases = [];
    act(state, "advance");
    act(withoutCase, "advance");
    assert.equal(state.openCases[0].status, "due");
    assert.equal(state.residents.find((r) => r.id === debtorId).satisfaction,
      withoutCase.residents.find((r) => r.id === debtorId).satisfaction - 6);
    let settledControl = copy(state);
    settledControl.openCases = [];
    for (let week = 0; week < 4; week += 1) {
      state = normalize("apartman", copy(state));
      settledControl = normalize("apartman", copy(settledControl));
      act(state, "advance");
      act(settledControl, "advance");
      assert.deepEqual(state.residents, settledControl.residents, "a settled follow-up must not penalize another week");
    }
  });
}

for (const status of ["due", "closed"]) {
  test(`KAPI NÖBETİ: old ${status} follow-up is consumed, not applied again on reload`, () => {
    const state = supportedMeeting();
    state.openCases = [{ id: "legacy-settled", kind: "inspection", due: 0, system: "su", status }];
    const loaded = normalize("apartman", copy(state));
    const control = copy(loaded);
    control.openCases = [];
    act(loaded, "advance");
    act(control, "advance");
    assert.deepEqual(loaded.residents, control.residents);
  });
}
