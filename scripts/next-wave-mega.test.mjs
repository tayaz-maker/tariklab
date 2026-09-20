import test from "node:test";
import assert from "node:assert/strict";
import {
  create,
  applyAction,
  implementationRate,
  defs,
  SYSTEMS,
  MEETINGS,
  SCENARIOS,
  DISCOVERABLES,
  PERIODS,
  POLICIES_2002,
  ISSUE_TEMPLATES,
} from "../public/games/next-wave.js";

test("apartman systems meetings residents issues scale", () => {
  const s = create("apartman");
  assert.equal(s.building.parts.length, 8);
  assert.ok(s.residents.length >= 12);
  assert.ok(s.residents.every((r) => r.name && !r.name.startsWith("Kat Sakini")));
  assert.ok(ISSUE_TEMPLATES.length >= 30);
  assert.ok(MEETINGS.length >= 6);
  assert.ok(SYSTEMS.length >= 8);
  applyAction("apartman", s, "meeting");
  assert.equal(s.flags.meeting, true);
  assert.ok(s.history.some((h) => h.type === "meeting"));
  const cash = s.finance.cash;
  applyAction("apartman", s, "advance");
  applyAction("apartman", s, "advance");
  applyAction("apartman", s, "advance");
  assert.ok(s.week >= 4);
  assert.notEqual(s.finance.cash, cash);
});

test("apartman cheap patch delayed callback", () => {
  const s = create("apartman");
  s.finance.cash = 500;
  applyAction("apartman", s, "meeting");
  applyAction("apartman", s, "proposal:cheap-patch");
  for (let i = 0; i < 4; i += 1) applyAction("apartman", s, "advance");
  assert.ok(s.issues.some((i) => String(i.title).includes("yama")) || s.history.some((h) => h.type === "callback"));
});

test("son 100 gun scenarios and focus-priced days", () => {
  assert.ok(SCENARIOS.length >= 16);
  const ids = new Set(SCENARIOS.map((x) => x.id));
  assert.equal(ids.size, SCENARIOS.length);
  const s = create("son-100-gun");
  applyAction("son-100-gun", s, "scenario:family-care");
  assert.equal(s.scenarioId, "family-care");
  assert.equal(s.remainingDays, 100);
  assert.equal(s.actionsRemaining, 2);
  applyAction("son-100-gun", s, "act:rest");
  assert.equal(s.focusRemaining, 6);
  applyAction("son-100-gun", s, "act:family");
  assert.equal(s.focusRemaining, 2);
  applyAction("son-100-gun", s, "act:forgive");
  assert.equal(s.focusRemaining, 8);
  assert.equal(s.day, 2);
});

test("son 100 gun missed obligation worsens and always-work is not free", () => {
  const work = create("son-100-gun");
  for (let i = 0; i < 20; i += 1) applyAction("son-100-gun", work, "advance");
  const rest = create("son-100-gun");
  for (let i = 0; i < 20; i += 1) applyAction("son-100-gun", rest, "act:rest");
  assert.notEqual(work.resources.money, rest.resources.money);
  assert.ok(work.missed.length >= 1 || rest.resources.energy > work.resources.energy);
});


test("kayip telefon apps clues corroboration endings", () => {
  const s = create("kayip-telefon");
  assert.ok(s.contacts.length >= 6);
  assert.ok(DISCOVERABLES.length >= 20);
  applyAction("kayip-telefon", s, "discover:clue_0");
  applyAction("kayip-telefon", s, "discover:call_leyla");
  applyAction("kayip-telefon", s, "discover:file_scan");
  assert.ok(s.unlockedApps.includes("calls"));
  assert.ok(s.corroboration.length >= 1);
  assert.ok(s.privacyPressure > 8);
  const mid = create("kayip-telefon");
  for (let i = 0; i < 4; i += 1) applyAction("kayip-telefon", mid, "discover:" + DISCOVERABLES[i].id);
  applyAction("kayip-telefon", mid, "return");
  const deep = create("kayip-telefon");
  for (const d of DISCOVERABLES) applyAction("kayip-telefon", deep, "discover:" + d.id);
  applyAction("kayip-telefon", deep, "return");
  const none = create("kayip-telefon");
  applyAction("kayip-telefon", none, "return");
  assert.equal(none.flags.ending, "minimal");
  assert.ok(["thorough", "reckless"].includes(mid.flags.ending));
  assert.equal(deep.flags.ending, "reckless");
  assert.notEqual(none.flags.ending, deep.flags.ending);
});

test("devlet 2002 playable packs and actual/reported isolation", () => {
  assert.ok(PERIODS["1923"] && PERIODS["1950"] && PERIODS["1980"] && PERIODS["2002"]);
  assert.ok(PERIODS.gunumuz && PERIODS.alternatif);
  assert.equal(PERIODS["2002"].playable, true);
  assert.equal(PERIODS["1923"].playable, true);
  assert.ok(POLICIES_2002.length >= 6);
  const s = create("tc-sim-devlet");
  s.actual.inflation = 80;
  assert.equal(s.reported.inflation, 35);
  applyAction("tc-sim-devlet", s, "policy:eu-align");
  applyAction("tc-sim-devlet", s, "advance");
  assert.ok(implementationRate(s) >= 0 && implementationRate(s) <= 100);
  applyAction("tc-sim-devlet", s, "era:1923");
  assert.equal(s.eraId, "1923");
  assert.equal(s.time.year, 1923);
  assert.equal(s.scenario.id, "1923");
});

test("identity firewall: games keep distinct signature fields", () => {
  const a = create("apartman");
  const b = create("son-100-gun");
  const d = create("kayip-telefon");
  const e = create("tc-sim-devlet");
  assert.ok(a.residents && a.building);
  assert.ok(b.remainingDays && b.obligations);
  assert.ok(d.unlockedApps && d.privacyPressure === 0);
  assert.ok(e.actual && e.reported && e.known);
  assert.equal(Object.keys(defs).length, 4);
});

test("save namespaces do not collide", () => {
  const keys = Object.keys(defs).map((id) => "tariklab.nextwave." + id + ".slot1");
  assert.equal(new Set(keys).size, 4);
});
