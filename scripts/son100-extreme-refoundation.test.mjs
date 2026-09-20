import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { create, applyAction, normalize, SCENARIOS, SON_ACTIONS } from "../public/games/next-wave.js";
import { EVENTS as SON_EVENTS, SON_CALLBACKS, SON_ENDINGS } from "../public/games/next-wave/son100-data.js";
import { sonVerdict, sonSoul, availableSonActions, applySonScenario, finalizeSon } from "../public/games/next-wave/son100-sim.js";

const appSrc = readFileSync(new URL("../public/games/son-100-gun/app.js", import.meta.url), "utf8");
const cssSrc = readFileSync(new URL("../public/games/son-100-gun/style.css", import.meta.url), "utf8");

test("18/18 scenario cards select in place and start the matching life", () => {
  assert.equal(SCENARIOS.length, 18);
  assert.match(appSrc, /function chooseScenario/);
  assert.match(appSrc, /paintScenarioSelection/);
  assert.match(cssSrc, /\.scenario\.is-selected/);
  assert.match(appSrc, /keydown/);
  assert.match(appSrc, /pointerup/);
  assert.doesNotMatch(appSrc, /selectedScenario = button\.dataset\.scenario;\s*session\.render\(\)/);
  for (const sc of SCENARIOS) {
    const s = create("son-100-gun");
    applyAction("son-100-gun", s, `scenario:${sc.id}`);
    assert.equal(s.scenarioId, sc.id, sc.id);
    assert.equal(s.remainingDays, 100);
    assert.equal(s.focusRemaining, 8);
    assert.equal(s.resources.money, sc.resources.money);
    assert.ok(s.flags.soul);
  }
});

test("focus-priced days, early finish becomes recovery, day 0 is terminal", () => {
  const s = create("son-100-gun");
  applyAction("son-100-gun", s, "act:work");
  assert.equal(s.focusRemaining, 4);
  assert.equal(s.day, 1);
  applyAction("son-100-gun", s, "act:rest");
  assert.equal(s.focusRemaining, 2);
  applyAction("son-100-gun", s, "act:pray");
  assert.equal(s.day, 2);
  applyAction("son-100-gun", s, "advance");
  assert.equal(s.day, 3);
  applyAction("son-100-gun", s, "act:work");
  applyAction("son-100-gun", s, "act:work");
  applyAction("son-100-gun", s, "act:work");
  assert.ok(s.focusRemaining <= 8);
  while (s.remainingDays > 0) applyAction("son-100-gun", s, "advance");
  assert.equal(s.remainingDays, 0);
  assert.equal(s.flags.finalReport, true);
  const report = JSON.stringify(s.flags.report);
  applyAction("son-100-gun", s, "act:work");
  applyAction("son-100-gun", s, "advance");
  assert.equal(JSON.stringify(s.flags.report), report);
  assert.equal(s.actionsRemaining, 0);
});

test("suicide actions do not exist and cannot be applied", () => {
  assert.equal(SON_ACTIONS.some((a) => /suicid|intihar|self/i.test(a.id + a.label)), false);
  const s = create("son-100-gun");
  const before = JSON.stringify(s.resources);
  applyAction("son-100-gun", s, "act:suicide");
  applyAction("son-100-gun", s, "act:intihar");
  assert.equal(JSON.stringify(s.resources), before);
  assert.equal(s.focusRemaining, 8);
});

test("farming gates: donate, pray, gamble, crime", () => {
  const s = create("son-100-gun");
  s.resources.money = 8000;
  for (let i = 0; i < 6; i += 1) applyAction("son-100-gun", s, "act:donate");
  assert.ok(s.flags.donateCount <= 3);
  const prayDays = sonSoul(s).faith;
  applyAction("son-100-gun", s, "act:pray");
  applyAction("son-100-gun", s, "act:pray");
  assert.ok(s.flags.prayCount >= 1);
  void prayDays;
  const g = create("son-100-gun");
  g.resources.money = 8000;
  const g1 = g.resources.money;
  applyAction("son-100-gun", g, "act:gamble");
  const g2 = g.resources.money;
  assert.notEqual(g2, g1);
  assert.equal(g.day, 1);
  applyAction("son-100-gun", g, "act:gamble");
  assert.equal(g.resources.money, g2);
  assert.ok(g.focusRemaining < 8);
  for (let i = 0; i < 8; i += 1) applyAction("son-100-gun", s, "act:crime");
  assert.ok(s.flags.crimeCount <= 5);
});

test("legacy save gains soul defaults and does not reroll ending", () => {
  const raw = create("son-100-gun");
  delete raw.flags.soul;
  const loaded = normalize("son-100-gun", JSON.parse(JSON.stringify(raw)));
  assert.ok(loaded.flags.soul);
  assert.equal(loaded.remainingDays, 100);
  while (loaded.remainingDays > 0) applyAction("son-100-gun", loaded, "advance");
  const first = JSON.stringify(loaded.flags.report);
  applyAction("son-100-gun", loaded, "advance");
  assert.equal(JSON.stringify(loaded.flags.report), first);
  assert.ok(loaded.flags.report.endingId);
});

test("content volume and ending catalog", () => {
  assert.ok(SON_EVENTS.length >= 90);
  assert.ok(SON_ACTIONS.length >= 35);
  assert.ok(SON_CALLBACKS.length >= 40);
  assert.ok(SON_ENDINGS.length >= 16);
  assert.ok(SON_ENDINGS.some((e) => e.id === "heaven"));
  assert.ok(SON_ENDINGS.some((e) => e.id === "hell"));
  const units = new Set([...SON_EVENTS.map((e) => e.id), ...SON_ACTIONS.map((a) => a.id)]);
  assert.ok(units.size >= 120);
  const tag = (key) => SON_EVENTS.filter((event) => (event.tags || []).includes(key)).length;
  assert.ok(tag("good") >= 25, "good");
  assert.ok(tag("bad") >= 25, "bad");
  assert.ok(tag("faith") >= 20, "faith");
  assert.ok(tag("family") >= 20, "family");
  assert.ok(tag("crime") >= 15, "crime");
  assert.ok(SON_EVENTS.filter((event) => (event.tags || []).some((item) => item === "adult" || item === "hedonism")).length >= 20);
  assert.equal(SCENARIOS.filter((item) => item.context && item.hook && item.burden).length, 18);
});

test("heaven and hell are possible but not default advance endings", () => {
  const idle = create("son-100-gun");
  while (idle.remainingDays > 0) applyAction("son-100-gun", idle, "advance");
  assert.notEqual(idle.flags.report.endingId, "heaven");
  assert.notEqual(idle.flags.report.endingId, "hell");

  const good = create("son-100-gun");
  applySonScenario(good, "family-care");
  good.flags.soul = { ...sonSoul(good), mercy: 20, harm: 2, betrayal: 1, crime: 1, faith: 18, legacy: 14, repent: 8, forgiveness: 8 };
  good.relationships.find((r) => r.id === "family").value = 70;
  good.remainingDays = 0;
  finalizeSon(good);
  assert.equal(sonVerdict(good).id, "heaven");

  const bad = create("son-100-gun");
  bad.flags.soul = { ...sonSoul(bad), harm: 22, betrayal: 10, crime: 8, violence: 6, mercy: 1, repent: 0 };
  bad.relationships.find((r) => r.id === "family").value = 30;
  bad.remainingDays = 0;
  finalizeSon(bad);
  assert.equal(sonVerdict(bad).id, "hell");
});

test("available actions stay finite and phase-gated", () => {
  const s = create("son-100-gun");
  assert.ok(availableSonActions(s).includes("work"));
  s.remainingDays = 2;
  const last = availableSonActions(s);
  assert.ok(last.includes("family"));
  assert.equal(last.includes("gamble"), false);
  assert.ok(last.length <= 8);
});
