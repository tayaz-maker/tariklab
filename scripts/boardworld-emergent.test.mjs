import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  getActions,
  resolveAction,
  validateState,
  previewAction,
  runRoutine,
  migrateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { initLiving } from "../public/games/tc-sim-boardworld/world-life.mjs";
import { initLife, validateLife } from "../public/games/tc-sim-boardworld/life-systems.mjs";
import {
  initEmergent,
  tickEmergent,
  validateEmergent,
  getEmergentView,
  emergentActions,
} from "../public/games/tc-sim-boardworld/emergent-life.mjs";
import { SYSTEMIC_FAMILIES } from "../public/games/tc-sim-boardworld/emergent-content.mjs";
import { EVENTS, JOBS, COURSES } from "../public/games/tc-sim-boardworld/content.mjs";
import { getRoute } from "../public/games/tc-sim-boardworld/city.mjs";
const DAY = 1440;
function fixture() {
  const s = createGame({ scenario: "graduate" });
  s.pendingEvents = [];
  s.resolvedEvents = EVENTS.map((e) => e.id);
  s.time = 20 * DAY + 540;
  s.calendar.lastTick = s.time;
  s.cash = 30000;
  s.bank = 50000;
  s.debt = 0;
  initLiving(s);
  initLife(s);
  initEmergent(s);
  return s;
}
function hired(s, id = "retail") {
  s.job = {
    id,
    level: 0,
    shifts: 5,
    performance: 80,
    earned: 0,
    payDay: 28,
    lastWorkDay: 20,
    missed: 0,
    hiredDay: 1,
  };
  s.deep.career.employerJobId = id;
  initLife(s);
}
function target(family, variant = 0) {
  let s = fixture();
  switch (family) {
    case "employment":
      hired(s);
      s.job.performance = variant ? 50 : 80;
      break;
    case "housing":
      s.housing.dueDay = 27;
      s.housing.arrears = variant ? 1000 : 0;
      break;
    case "neighborhood":
      if (variant) s.life.districts[s.location].phase = "roadworks";
      break;
    case "transport":
      hired(s, JOBS.find((j) => j.district !== "kadikoy").id);
      s.flags.travels = 5;
      if (variant) s.life.districts[s.location].travelDelay = 15;
      break;
    case "education":
      s.player.skills = { communication: 10, craft: 10, technical: 10, knowledge: 40 };
      if (variant) {
        const c = COURSES.find((c) => c.skill === "knowledge");
        s.documents.push({
          id: `certificate-${c.id}`,
          title: "Test certificate",
          text: "completed",
          day: 20,
        });
      }
      break;
    case "friendship":
      s.npcs.mert.trust = 60;
      s.npcs.mert.lastTalkDay = variant ? 20 : 5;
      break;
    case "romance":
      s.flags.partner = "ece";
      s.npcs.ece.romance = 50;
      s.npcs.ece.lastDateDay = variant ? 20 : 5;
      break;
    case "household":
      break;
    case "health":
      s.player.health = variant ? 94 : 60;
      s.player.stress = variant ? 80 : 20;
      break;
    case "debt":
      s.debt = variant ? 100000 : 5000;
      break;
    case "enterprise":
      s.deep.business = {
        id: "repair",
        location: s.location,
        status: "active",
        level: 1,
        clients: 2,
        reputation: 30,
        revenue: 1000,
        costs: 600,
        lastServiceDay: 20,
        lastAcquireDay: 20,
        nextOverheadDay: 28,
        openedDay: 10,
        arrears: 0,
        accruedOverhead: 0,
      };
      initLiving(s);
      initLife(s);
      s.living.enterprise.stock = variant ? 0 : 10;
      break;
    case "institutions":
      if (variant) s.flags.coursesCompleted = 1;
      else s.flags.volunteers = 3;
      break;
  }
  for (const m of Object.values(s.emergent.families)) m.lastDay = 21;
  s.emergent.families[family].lastDay = 0;
  s.emergent.lastSpawnDay = 20;
  assert.equal(validateState(s), true, `fixture ${family}: life${validateLife(s)}`);
  s = act(s, "wait:15");
  assert.equal(s.emergent.events.at(-1)?.family, family);
  return s;
}
function act(s, id) {
  const before = structuredClone(s),
    r = resolveAction(s, id);
  assert.equal(r.ok, true, `${id}: ${r.message}`);
  assert.deepEqual(s, before);
  assert.equal(validateState(r.state), true);
  return r.state;
}
for (const f of SYSTEMIC_FAMILIES) {
  test(`${f.id}: causal source, alternative routes, atomic preview/replay and once-only decision`, () => {
    const s = target(f.id),
      e = s.emergent.events.at(-1),
      snapshot = structuredClone(s),
      view = getEmergentView(s).events[0];
    assert.ok(e.why.length > 20);
    assert.ok(e.source);
    assert.equal(view.actionIds.length, f.id === "enterprise" ? 4 : 3);
    assert.deepEqual(s, snapshot);
    for (const route of ["commit", "adapt", "decline"]) {
      let at = structuredClone(s);
      at.location = e.location;
      const id = `systemic:${e.id}:${route}`;
      const before = structuredClone(at),
        preview = previewAction(at, id);
      assert.equal(preview.ok, true, preview.message);
      assert.deepEqual(at, before);
      const a = resolveAction(at, id),
        b = resolveAction(at, id);
      assert.equal(a.ok, true, a.message);
      assert.deepEqual(a, b);
      assert.equal(validateState(a.state), true);
      assert.equal(resolveAction(a.state, id).ok, false, "opening cannot be claimed twice");
      assert.equal(a.state.emergent.decisions, 1);
      if (route !== "decline") {
        const next = a.state.emergent.events.find((x) => x.id === e.id);
        assert.equal(next.status, "waiting");
        assert.ok(next.followAt > a.state.time);
        assert.ok(next.deadline > next.followAt);
      }
    }
  });
  if (!["household"].includes(f.id))
    test(`${f.id}: variant follows changed condition, not random wording`, () => {
      assert.notEqual(
        target(f.id, 0).emergent.events.at(-1).variant,
        target(f.id, 1).emergent.events.at(-1).variant,
      );
    });
}
test("debt decision balances real assets and principal; duplicate and insufficient-funds attempts are inert", () => {
  let s = target("debt"),
    e = s.emergent.events[0],
    id = `systemic:${e.id}:commit`,
    wealth = s.cash + s.bank - s.debt;
  s = act(s, id);
  assert.equal(s.cash + s.bank - s.debt, wealth);
  assert.equal(s.debt, 4000);
  const poor = target("debt");
  poor.cash = 1;
  poor.bank = 2;
  const before = structuredClone(poor),
    r = resolveAction(poor, id);
  assert.equal(r.ok, false);
  assert.deepEqual(poor, before);
});
test("same-day rehiring cancels old employer follow-up and cannot pay the new contract", () => {
  let s = target("employment"),
    e = s.emergent.events[0];
  s.location = e.location;
  s = act(s, `systemic:${e.id}:commit`);
  s = act(s, "resign");
  assert.equal(s.emergent.events[0].status, "cancelled");
  assert.equal(resolveAction(s, `systemic:${e.id}:finish`).ok, false);
});
test("NPCs learn a chosen plan only through that direct conversation; unrelated people remain ignorant", () => {
  let s = target("friendship"),
    e = s.emergent.events[0];
  const other = structuredClone(s.deep.npcs.selin.knownFacts);
  assert.equal(
    s.deep.npcs.mert.knownFacts.some((f) => f.id === "systemic"),
    false,
  );
  s.location = e.location;
  s = act(s, `systemic:${e.id}:commit`);
  assert.ok(s.deep.npcs.mert.knownFacts.some((f) => f.id === "systemic"));
  assert.deepEqual(s.deep.npcs.selin.knownFacts, other);
});
test("active causal decisions pause both routine and fast-forward with no time or money loss", () => {
  const s = target("debt"),
    r = runRoutine(s, 7);
  assert.equal(r.state.time, s.time);
  assert.equal(r.state.cash, s.cash);
  assert.equal(r.actions.length, 0);
  assert.match(r.message, /olay/);
  assert.equal(getActions(s).find((a) => a.id === "calendar:next").disabled, true);
  assert.equal(resolveAction(s, "calendar:next").ok, false);
});
test("practice uses daily/weekly diminishing returns and certificate mastery gate without changing legacy progress", () => {
  let s = fixture();
  s.player.skills.communication = 40;
  let before = s.player.skills.communication;
  s = act(s, "practice:communication");
  const first = s.player.skills.communication - before;
  before = s.player.skills.communication;
  s = act(s, "practice:communication");
  assert.ok(s.player.skills.communication - before < first);
  assert.equal(resolveAction(s, "practice:communication").ok, false);
  s.player.skills.knowledge = 85;
  assert.equal(resolveAction(s, "practice:knowledge").ok, false);
  s.player.skills.craft = 100;
  assert.equal(getActions(s).find((a) => a.id === "practice:craft").disabled, true);
  assert.equal(migrateState(s).player.skills.craft, 100);
});
test("explicit policy controls days and food; no unauthorized restaurant spend or investments", () => {
  let s = createGame();
  s.pendingEvents = [];
  s.resolvedEvents = EVENTS.map((e) => e.id);
  s.player.hunger = 20;
  s.inventory.groceries = 0;
  s.deep.routine.settings.shopping = false;
  s = act(s, "policy:day:0");
  const r = runRoutine(s, 1);
  assert.equal(r.actions.length, 0);
  assert.equal(r.state.time, s.time);
  assert.match(r.message, /kapalı/);
  s = act(s, "policy:day:0");
  const home = runRoutine(s, 1);
  assert.equal(home.actions.length, 0);
  assert.match(home.message, /öğün/);
  assert.equal(home.state.cash, s.cash);
  s = act(s, "policy:meal:frugal");
  const frugal = runRoutine(s, 1);
  assert.equal(frugal.actions[0], "soup");
  assert.ok(
    !frugal.actions.some(
      (id) => id.startsWith("business:start") || id === "loan" || id === "resign",
    ),
  );
});
test("district road disruption changes actual travel minutes without changing cash twice", () => {
  const s = fixture(),
    base = getRoute(s, "kadikoy", "sisli");
  s.life.districts.sisli.travelDelay = 15;
  const delayed = getRoute(s, "kadikoy", "sisli");
  assert.equal(delayed.minutes, base.minutes + 15);
  const r = act(s, "travel:sisli");
  assert.equal(r.time - s.time, delayed.minutes);
  assert.equal(s.cash - r.cash, delayed.cost);
});
const api = {
  log: () => {},
  memory: () => {},
  reveal: () => {},
  change: (s, x) => {
    for (const [k, v] of Object.entries(x))
      s.player[k] = Math.max(0, Math.min(100, s.player[k] + v));
  },
  skill: (s, k, n) => (s.player.skills[k] = Math.min(100, s.player.skills[k] + n)),
  record: () => {},
  document: () => {},
};
test("deferred stage opens exactly once, requires real intervening progress, and a bounded recovery route remains", () => {
  let s = target("institutions");
  const e = s.emergent.events[0];
  s.location = e.location;
  s = act(s, `systemic:${e.id}:commit`);
  const x = s.emergent.events[0];
  s.time = x.followAt;
  tickEmergent(s, api);
  assert.equal(x.stage, 1);
  assert.equal(x.status, "active");
  assert.equal(validateEmergent(s), true);
  let a = emergentActions(s, api);
  assert.equal(a.find((a) => a.id.endsWith(":finish")).disabled, true);
  const history = s.emergent.history.length;
  tickEmergent(s, api);
  assert.equal(s.emergent.history.length, history);
  x.progress = 1;
  a = emergentActions(s, api);
  assert.equal(a.find((a) => a.id.endsWith(":finish")).disabled, false);
  a.find((a) => a.id.endsWith(":finish")).run(s);
  assert.equal(x.status, "resolved");
  assert.equal(
    emergentActions(s, api).some((a) => a.id.includes(e.id)),
    false,
  );
});
test("expired unaccepted invitation never penalizes an NPC; accepted promise has one bounded consequence", () => {
  for (const accept of [false, true]) {
    let s = target("friendship"),
      e = s.emergent.events[0];
    if (accept) {
      s.location = e.location;
      s = act(s, `systemic:${e.id}:commit`);
      e = s.emergent.events[0];
      s.time = e.followAt;
      tickEmergent(s, api);
    }
    const trust = s.npcs.mert.trust;
    s.time = e.deadline;
    tickEmergent(s, api);
    assert.equal(e.status, "expired");
    assert.equal(s.npcs.mert.trust, trust - (accept ? 4 : 0));
    const once = s.npcs.mert.trust;
    tickEmergent(s, api);
    assert.equal(s.npcs.mert.trust, once);
  }
});
test("strict namespace validation rejects invalid policy, identity, actor, timestamp and duplicate event imports", () => {
  const s = target("friendship");
  for (const mutate of [
    (x) => (x.emergent.policy.meal = "free-money"),
    (x) => (x.emergent.events[0].actors = ["omniscient"]),
    (x) => (x.emergent.events[0].id = "sys-99999"),
    (x) => x.emergent.events.push(structuredClone(x.emergent.events[0])),
    (x) => (x.emergent.lastTick = x.time + 1),
    (x) => x.emergent.policy.days.push(true),
    (x) => (x.emergent.habits.practiceDay.knowledge = -1),
  ]) {
    const bad = structuredClone(s);
    mutate(bad);
    assert.equal(validateState(bad), false);
  }
});

test("uncertain enterprise sample consumes real stock and cost once; preview never reveals or advances seeded feedback", () => {
  const s = target("enterprise"),
    e = s.emergent.events[0],
    id = `systemic:${e.id}:trial`;
  const before = structuredClone(s),
    preview = previewAction(s, id);
  assert.equal(preview.uncertain, true);
  assert.deepEqual(s, before);
  assert.equal(preview.bank, -250);
  assert.ok(!preview.consequences.some((text) => /zar [1-6]/.test(text)));
  const a = resolveAction(s, id),
    b = resolveAction(s, id);
  assert.equal(a.ok, true);
  assert.deepEqual(a, b);
  assert.equal(a.state.rng, (Math.imul(s.rng, 1664525) + 1013904223) >>> 0);
  assert.equal(a.state.living.enterprise.stock, s.living.enterprise.stock - 1);
  assert.equal(a.state.cash + a.state.bank, s.cash + s.bank - 250);
  assert.equal(a.state.deep.business.revenue, s.deep.business.revenue);
  assert.equal(resolveAction(a.state, id).ok, false);
  const empty = structuredClone(s);
  empty.living.enterprise.stock = 0;
  assert.equal(resolveAction(empty, id).ok, false);
  assert.equal(empty.rng, s.rng);
});

test("malformed semantic event references are rejected before public views can dereference them", () => {
  const s = target("friendship");
  for (const mutate of [
    (e) => (e.contract = "__proto__"),
    (e) => (e.actors = ["__proto__"]),
    (e) => (e.actors = ["selin"]),
    (e) => (e.target = "knowledge"),
    (e) => {
      e.stage = 1;
      e.choice = "";
    },
    (e) => e.startAt++,
  ]) {
    const bad = structuredClone(s);
    mutate(bad.emergent.events[0]);
    assert.equal(validateState(bad), false);
  }
  const education = target("education");
  education.emergent.events[0].target = "";
  assert.equal(validateState(education), false);
});

test("fractional mastery never advertises a legal practice that rounds to zero progress", () => {
  let s = fixture();
  const course = COURSES.find((c) => c.skill === "knowledge");
  s.documents.push({
    id: `certificate-${course.id}`,
    title: "Earned qualification fixture",
    text: "Completed lessons",
    day: 20,
  });
  s.player.skills.knowledge = 99.9;
  s.emergent.habits.practiceDay.knowledge = 1;
  s.emergent.habits.practiceWeek.knowledge = 4;
  s.flags["practice-knowledge"] = 21;
  const next = act(s, "practice:knowledge");
  assert.equal(next.player.skills.knowledge, 100);
  assert.equal(getActions(next).find((a) => a.id === "practice:knowledge").disabled, true);
});
