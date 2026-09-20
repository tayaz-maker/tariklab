import test from "node:test";
import assert from "node:assert/strict";
import {
  create,
  applyAction,
  implementationRate,
  normalize,
  ISSUE_TEMPLATES,
  SCENARIOS,
  DISCOVERABLES,
  ENDINGS,
  POLICIES_2002,
  SON_EVENTS,
  PROPOSALS,
} from "../public/games/next-wave.js";

test("apartman delayed cheap patch and finance-once per week", () => {
  const s = create("apartman");
  s.finance.cash = 500;
  applyAction("apartman", s, "meeting");
  const cashAfter = s.finance.cash;
  applyAction("apartman", s, "proposal:cheap-patch");
  assert.equal(s.finance.cash, cashAfter);
  for (let i = 0; i < 4; i += 1) applyAction("apartman", s, "advance");
  assert.ok(
    s.issues.some((i) => String(i.title).includes("yama")) ||
      s.history.some((h) => h.type === "callback"),
  );
});

test("apartman raise-dues backlash after two hikes", () => {
  assert.ok(PROPOSALS.some((p) => p.id === "raise-dues"));
  const s = create("apartman");
  applyAction("apartman", s, "proposal:raise-dues");
  applyAction("apartman", s, "advance");
  applyAction("apartman", s, "proposal:raise-dues");
  applyAction("apartman", s, "advance");
  assert.ok((s.flags.duesHikes || 0) >= 1);
  assert.ok(s.finance.dues >= 2400);
});

test("apartman issue templates and systems stay in signature loop", () => {
  assert.ok(ISSUE_TEMPLATES.length >= 40);
  const s = create("apartman");
  assert.ok(s.building.parts.length === 8);
  assert.ok(s.residents.every((r) => Array.isArray(r.memory)));
});

test("son100 focus economy, opportunity expiry, final report", () => {
  assert.ok(SON_EVENTS.length >= 60);
  assert.ok(SCENARIOS.length >= 16);
  const s = create("son-100-gun");
  assert.equal(s.focusRemaining, 8);
  assert.ok((s.opportunities || []).length >= 1);
  applyAction("son-100-gun", s, "act:work");
  assert.equal(s.focusRemaining, 4);
  applyAction("son-100-gun", s, "act:work");
  assert.equal(s.day, 2);
  const wait = create("son-100-gun");
  for (let i = 0; i < 8; i += 1) applyAction("son-100-gun", wait, "advance");
  assert.ok(wait.opportunities.some((o) => o.status === "expired") || wait.missed.length >= 1);
  const fin = create("son-100-gun");
  for (let i = 0; i < 100; i += 1) applyAction("son-100-gun", fin, "advance");
  assert.equal(fin.flags.finalReport, true);
  assert.ok(fin.flags.report);
  assert.ok(Number.isFinite(fin.resources.money));
  applyAction("son-100-gun", fin, "act:work");
  assert.equal(fin.remainingDays, 0);
});

test("son100 always-work is not free and save keeps action state", () => {
  const work = create("son-100-gun");
  for (let i = 0; i < 10; i += 1) applyAction("son-100-gun", work, "act:work");
  const rest = create("son-100-gun");
  for (let i = 0; i < 10; i += 1) applyAction("son-100-gun", rest, "act:rest");
  assert.ok(work.resources.money > rest.resources.money);
  assert.ok(rest.resources.energy > work.resources.energy);
  const raw = JSON.parse(JSON.stringify(work));
  const back = normalize("son-100-gun", raw);
  assert.equal(back.actionsRemaining, work.actionsRemaining);
  assert.equal(back.day, work.day);
});


test("kayip clue dependency privacy cost ending eligibility", () => {
  assert.ok(DISCOVERABLES.length >= 26);
  assert.ok(ENDINGS.family);
  const locked = create("kayip-telefon");
  applyAction("kayip-telefon", locked, "discover:lock_note");
  assert.equal(locked.discoveredItems.includes("lock_note"), false);
  applyAction("kayip-telefon", locked, "discover:note_pin");
  applyAction("kayip-telefon", locked, "discover:lock_note");
  assert.ok(locked.discoveredItems.includes("lock_note"));
  assert.ok(locked.privacyPressure >= 16);
  const early = create("kayip-telefon");
  applyAction("kayip-telefon", early, "return");
  assert.equal(early.flags.ending, "minimal");
  applyAction("kayip-telefon", early, "discover:file_scan");
  assert.equal(early.discoveredItems.length, 0);
  const deep = create("kayip-telefon");
  for (const d of DISCOVERABLES) applyAction("kayip-telefon", deep, "discover:" + d.id);
  applyAction("kayip-telefon", deep, "return");
  assert.equal(deep.flags.ending, "reckless");
});

test("devlet accepts exactly two monthly decisions, actual/reported/known stay split", () => {
  assert.ok(POLICIES_2002.length >= 10);
  const s = create("tc-sim-devlet");
  s.actual.inflation = 88;
  assert.equal(s.reported.inflation, 35);
  applyAction("tc-sim-devlet", s, "policy:eu-align");
  const hist = s.history.filter((h) => h.type === "policy").length;
  applyAction("tc-sim-devlet", s, "policy:tax-admin");
  assert.equal(s.history.filter((h) => h.type === "policy").length, hist + 1);
  applyAction("tc-sim-devlet", s, "policy:social-relief");
  assert.equal(s.history.filter((h) => h.type === "policy").length, hist + 1);
  assert.equal(s.flags.decisionsRemaining, 0);
  applyAction("tc-sim-devlet", s, "advance");
  applyAction("tc-sim-devlet", s, "policy:tax-admin");
  assert.ok(s.history.filter((h) => h.type === "policy").length >= hist + 2);
  assert.notEqual(s.actual.inflation, s.reported.inflation);
  assert.ok(s.known.inflation.confidence >= 0);
  assert.ok(implementationRate(s) >= 0 && implementationRate(s) <= 100);
  const raw = JSON.parse(JSON.stringify(s));
  assert.equal(normalize("tc-sim-devlet", raw).eraId, "2002");
});

test("finite numbers after mixed loops", () => {
  for (const id of ["apartman", "son-100-gun", "kayip-telefon", "tc-sim-devlet"]) {
    const s = create(id);
    applyAction(id, s, "advance");
    const walk = (v) => {
      if (typeof v === "number") return Number.isFinite(v);
      if (!v || typeof v !== "object") return true;
      return Array.isArray(v) ? v.every(walk) : Object.values(v).every(walk);
    };
    assert.ok(walk(s), id);
  }
});
