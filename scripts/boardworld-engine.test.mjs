import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame,
  getActions,
  getClock,
  getGoals,
  getNpcLocation,
  resolveAction,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import {
  DISTRICTS,
  SCENARIOS,
  JOBS,
  NPCS,
  COURSES,
  HOMES,
  EVENTS,
  ITEMS,
  SKILLS,
} from "../public/games/tc-sim-boardworld/content.mjs";

function assertFinite(value, path = "state") {
  if (typeof value === "number") assert.ok(Number.isFinite(value), `${path} is finite`);
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) assertFinite(child, `${path}.${key}`);
  }
}

function assertSound(state) {
  assert.equal(validateState(state), true, "engine accepts its own resulting state");
  assertFinite(state);
  for (const key of ["cash", "bank", "debt"]) {
    assert.ok(
      Number.isSafeInteger(state[key]) && state[key] >= 0,
      `${key} is nonnegative integer lira`,
    );
  }
  assert.ok(Number.isSafeInteger(state.time) && state.time >= 0);
  for (const key of ["health", "energy", "hunger", "stress"]) {
    assert.ok(state.player[key] >= 0 && state.player[key] <= 100, `${key} is bounded`);
  }
  assert.equal(
    new Set(state.resolvedEvents).size,
    state.resolvedEvents.length,
    "events resolve once",
  );
  assert.equal(Object.keys(state.npcs).length, NPCS.length);
  assert.ok(DISTRICTS.some((district) => district.id === state.location));
}

function perform(state, id) {
  const before = structuredClone(state);
  const result = resolveAction(state, id);
  assert.deepEqual(state, before, `action ${id} does not mutate its input`);
  assert.equal(result.ok, true, `${id}: ${result.message}`);
  assertSound(result.state);
  assert.ok(result.state.time >= state.time, "time never reverses");
  assert.ok(result.state.revision > state.revision, "accepted actions advance revision");
  return result.state;
}

const available = (state, id) =>
  getActions(state).some((action) => action.id === id && !action.disabled);

// Targeted boundary fixtures start valid and mark events read to isolate the boundary.
// The endurance cases below use untouched starts and resolve actual event chains.
function fixture(options = {}) {
  const state = createGame(options);
  state.pendingEvents = [];
  state.resolvedEvents = EVENTS.map((event) => event.id);
  assertSound(state);
  return state;
}

function advanceToEvening(state) {
  let next = state;
  while (getClock(next).minute < 1080) {
    next = perform(next, "wait:60");
  }
  return next;
}

test("Boardworld ships the required connected content and three distinct starts", () => {
  for (const [name, items, minimum] of [
    ["districts", DISTRICTS, 3],
    ["scenarios", SCENARIOS, 3],
    ["careers", JOBS, 5],
    ["people", NPCS, 10],
    ["conditional events", EVENTS, 20],
    ["courses", COURSES, 3],
    ["homes", HOMES, 3],
  ]) {
    assert.ok(items.length >= minimum, `${name}: ${items.length} >= ${minimum}`);
    assert.equal(
      new Set(items.map((item) => item.id)).size,
      items.length,
      `${name} IDs are unique`,
    );
  }
  const starts = SCENARIOS.map((scenario) => createGame({ scenario: scenario.id, seed: 42 }));
  for (const state of starts) {
    assertSound(state);
    assert.ok(getGoals(state).length >= 3, "long-term goals are available from the first turn");
    assert.ok(
      getActions(state).some((action) => !action.disabled),
      "the first turn has a legal action",
    );
    assert.equal(getClock(state).day, 1);
    assert.equal(getClock(state).time, "08:00");
  }
  assert.equal(
    new Set(
      starts.map((state) =>
        JSON.stringify({
          cash: state.cash,
          debt: state.debt,
          housing: state.housing,
          skills: state.player.skills,
        }),
      ),
    ).size,
    starts.length,
    "origins change resources and circumstances",
  );
});

test("unknown and unavailable actions are rejected atomically", () => {
  for (const scenario of SCENARIOS) {
    const state = createGame({ scenario: scenario.id, seed: 83 });
    const before = structuredClone(state);
    for (const id of [
      "not-a-command",
      "__proto__",
      "",
      ...getActions(state)
        .filter((a) => a.disabled)
        .map((a) => a.id),
    ]) {
      const result = resolveAction(state, id);
      assert.equal(result.ok, false, `${scenario.id}/${id} must be unavailable`);
      assert.ok(typeof result.message === "string" && result.message.length > 0);
      assert.deepEqual(result.state, before, `rejection ${id} preserves the entire state`);
      assert.deepEqual(state, before, `rejection ${id} preserves the input`);
    }
  }
});

test("authored careers, courses, homes and choices reference real bounded resources", () => {
  const districtIds = new Set(DISTRICTS.map((d) => d.id));
  const skillIds = new Set(SKILLS.map((s) => s.id));
  const itemIds = new Set(ITEMS.map((item) => item.id));
  for (const entry of [...JOBS, ...COURSES, ...HOMES]) {
    assert.ok(districtIds.has(entry.district), `${entry.id} district exists`);
  }
  for (const job of JOBS) {
    assert.ok(Number.isSafeInteger(job.wage) && job.wage > 0);
    assert.ok(job.hours > 0 && job.hours <= 12);
    assert.ok(skillIds.has(job.skill));
    if (job.item) assert.ok(itemIds.has(job.item));
  }
  for (const event of EVENTS) {
    assert.ok(event.choices.length >= 2, `${event.id} offers a decision`);
    assert.equal(new Set(event.choices.map((choice) => choice.id)).size, event.choices.length);
    for (const choice of event.choices) {
      assert.ok(
        Number.isSafeInteger(choice.cost) && choice.cost >= 0,
        `${event.id}/${choice.id} cost`,
      );
      assert.ok(
        Number.isSafeInteger(choice.minutes) && choice.minutes >= 0,
        `${event.id}/${choice.id} time`,
      );
      if (choice.effects.npc) assert.ok(NPCS.some((npc) => npc.id === choice.effects.npc.id));
      for (const skill of Object.keys(choice.effects.skills || {})) assert.ok(skillIds.has(skill));
      for (const item of Object.keys(choice.effects.items || {})) assert.ok(itemIds.has(item));
    }
  }
});

test("same seed and legal decisions replay exactly through the public resolver", () => {
  let a = createGame({ name: "Deniz", scenario: "newcomer", seed: 713 });
  let b = createGame({ name: "Deniz", scenario: "newcomer", seed: 713 });
  for (let turn = 0; turn < 60; turn++) {
    const actions = getActions(a).filter((action) => !action.disabled);
    assert.ok(actions.length > 0);
    const id = actions[(turn * 7) % actions.length].id;
    a = perform(a, id);
    b = perform(b, id);
    assert.deepEqual(a, b, `deterministic turn ${turn}`);
  }
});

test("NPC schedules use the same simulation clock and remain deterministic", () => {
  const state = createGame({ seed: 73 });
  for (const npc of NPCS) {
    for (const time of [0, 480, 780, 1080, 1380, 1920, 6 * 1440 + 780]) {
      const atTime = { ...state, time };
      const place = getNpcLocation(atTime, npc.id);
      assert.ok(
        DISTRICTS.some((d) => d.id === place),
        `${npc.id} has a real district`,
      );
      assert.equal(place, getNpcLocation(structuredClone(atTime), npc.id));
    }
  }
});

for (const scenario of SCENARIOS)
  for (const seed of [7, 2026, 91373]) {
    test(`${scenario.id}/${seed}: a legal working life stays solvent and healthy through 46 days`, () => {
      let state = createGame({ scenario: scenario.id, seed });
      const played = new Map();
      for (let turn = 0; getClock(state).day < 46 && turn < 1800; turn++) {
        const actions = getActions(state).filter((action) => !action.disabled);
        const pick = (id) => actions.find((action) => action.id === id);
        let action;
        if (state.pendingEvents.length) {
          action = actions.find((a) => a.cost === 0) || actions[0];
        } else {
          if (state.cash < 400 && state.bank >= 1000) action = pick("withdraw:1000");
          if (!action && state.player.hunger < 48)
            action = pick("cook") || pick("soup") || pick("eat") || pick("snack");
          if (!action && !state.job) action = pick("apply:retail");
          if (!action && state.job) action = pick("promote");
          if (!action && state.job) action = pick("work");
          if (!action && state.player.hunger < 48) action = pick("buy:groceries");
          if (!action && getClock(state).minute >= 1080) action = pick("sleep");
          if (!action && (state.player.stress > 45 || state.player.energy < 50))
            action = pick("rest");
          if (!action)
            action = pick("practice:communication") || pick("exercise") || pick("wait:60");
        }
        assert.ok(
          action,
          `legal survival option at ${getClock(state).date} ${getClock(state).time}`,
        );
        played.set(action.id, (played.get(action.id) || 0) + 1);
        state = perform(state, action.id);
      }
      assert.ok(getClock(state).day >= 46, "45 complete calendar days elapsed");
      assert.ok((played.get("work") || 0) >= 35, "wages came from real completed shifts");
      assert.equal(state.job?.id, "retail", "working policy retains employment");
      assert.equal(
        state.job.level,
        2,
        "actual experience and skills earned both career promotions",
      );
      assert.equal(
        played.get("promote"),
        2,
        "both promotions went through the public action resolver",
      );
      assert.ok(state.cash + state.bank > 8000, "wages support food, rent and bills");
      assert.equal(state.housing.arrears, 0, "rent stayed paid");
      assert.ok(state.player.health >= 60, "basic care sustains health");
      assert.ok(state.flags.billsPaid >= 1, "the monthly rental boundary really ran");
      assert.ok(state.achievements.includes("first-30-days"));
      assert.ok(state.resolvedEvents.length >= 10, "conditional content reached through play");
      assert.ok(state.world.priceIndex > 1, "the world economy advanced");
      if (scenario.id === "restart")
        assert.ok(state.debt > scenario.debt, "unpaid principal accrues monthly interest");
    });
  }

test("cash transfers conserve money, loans conserve net worth, and repayment lowers principal", () => {
  let state = fixture();
  const net = state.cash + state.bank - state.debt;
  const original = { cash: state.cash, bank: state.bank, debt: state.debt, rng: state.rng };
  state = perform(state, "deposit:1000");
  assert.equal(state.cash, original.cash - 1000);
  assert.equal(state.bank, original.bank + 1000);
  state = perform(state, "withdraw:1000");
  assert.equal(state.cash, original.cash);
  assert.equal(state.bank, original.bank);
  state = perform(state, "loan");
  assert.equal(state.debt, 5000);
  assert.equal(state.cash + state.bank - state.debt, net);
  state = perform(state, "repay:1000");
  assert.equal(state.debt, 4000);
  assert.equal(state.cash + state.bank - state.debt, net);
  state = perform(state, "repay:all");
  assert.equal(state.debt, 0);
  assert.equal(state.cash + state.bank - state.debt, net);
  assert.equal(state.rng, original.rng, "ordinary banking never rolls a die");
});

test("payday, rent, deposit interest, debt interest and utilities settle exactly once at midnight", () => {
  let state = perform(fixture({ scenario: "restart" }), "apply:retail");
  state = perform(state, "work");
  state.time = 29 * 1440 + 23 * 60 + 30; // Day 30, 23:30 → day 31.
  state.bank = 10000;
  state.cash = 2000;
  state.job.payDay = 31;
  state.job.lastWorkDay = 30;
  const earned = state.job.earned;
  state = perform(state, "wait:60");
  const afterRent = 10000 + earned - 4200;
  assert.equal(state.bank, afterRent + Math.floor(afterRent * 0.005) - 900);
  assert.equal(state.cash, 2000);
  assert.equal(state.debt, 12360);
  assert.equal(state.housing.dueDay, 61);
  assert.equal(state.job.payDay, 38);
  assert.equal(state.job.earned, 0);
  const bank = state.bank,
    debt = state.debt,
    rentCount = state.transactions.filter((t) => t.label === "Aylık kira").length;
  state = perform(state, "wait:60");
  assert.equal(state.bank, bank);
  assert.equal(state.debt, debt);
  assert.equal(state.transactions.filter((t) => t.label === "Aylık kira").length, rentCount);
});

test("unpaid rent becomes arrears, utilities become debt, and free shelter remains reachable", () => {
  let state = fixture();
  state.cash = 0;
  state.bank = 0;
  state.time = 29 * 1440 + 23 * 60 + 30;
  state = perform(state, "wait:60");
  assert.equal(state.housing.arrears, 4200);
  assert.equal(state.debt, 900);
  assert.equal(state.cash, 0);
  assert.equal(state.bank, 0);
  state = perform(state, "move:shelter");
  assert.equal(state.housing.id, "shelter");
  assert.equal(state.housing.arrears, 0, "real old deposit settles the matching arrears");
  assert.equal(state.bank, 0, "deposit cannot also be refunded after settling arrears");
  assert.equal(state.debt, 900, "housing support does not erase other obligations");
  assert.ok(available(state, "sleep"));
});

test("moving uses first rent, deposit and transport cost while returning the old deposit only once", () => {
  let state = fixture();
  state.cash = 30000;
  state = perform(state, "travel:besiktas");
  const before = state.cash + state.bank;
  const price = getActions(state).find((action) => action.id === "move:studio").cost;
  state = perform(state, "move:studio");
  assert.equal(state.cash + state.bank, before - price + 4200);
  assert.equal(state.housing.deposit, 8200);
  assert.equal(state.housing.rent, 8200);
  assert.equal(state.housing.dueDay, getClock(state).day + 30);
  assert.ok(!available(state, "move:studio"));
});

test("job acceptance, shifts, early promotion refusal and resignation respect earned pay without RNG", () => {
  let state = fixture();
  const rng = state.rng;
  state = perform(state, "apply:retail");
  const initialCash = state.cash,
    initialBank = state.bank;
  state = perform(state, "work");
  assert.equal(state.cash, initialCash);
  assert.equal(state.bank, initialBank);
  assert.equal(state.job.earned, 1000);
  assert.equal(state.job.shifts, 1);
  assert.equal(available(state, "work"), false, "one paid shift per day");
  assert.equal(available(state, "promote"), false, "one shift is not a promotion");
  state = perform(state, "resign");
  assert.equal(state.job, null);
  assert.equal(state.bank, initialBank + 1000, "resignation pays outstanding earned salary");
  assert.equal(state.rng, rng);
});

test("eight actual coding lessons produce a credential and qualify a new career", () => {
  let state = fixture({ education: "highschool", trait: "balanced" });
  state.cash = 20000;
  state.bank = 20000;
  state.location = "sisli";
  assert.equal(available(state, "apply:developer"), false);
  state = perform(state, "buy:laptop");
  state = perform(state, "enroll:coding");
  const rng = state.rng;
  for (let lesson = 0; lesson < 8; lesson++) {
    state = perform(state, "study");
    assert.equal(available(state, "study"), false, "a second lesson the same day is unavailable");
    state = perform(state, "practice:knowledge");
    if (state.player.hunger < 60) state = perform(state, "eat");
    if (lesson < 7) {
      // Home is still Kadıköy: attendance requires an actual round trip each day.
      state = perform(state, "travel:kadikoy");
      state = advanceToEvening(state);
      state = perform(state, "sleep");
      state = perform(state, "travel:sisli");
    }
  }
  assert.equal(state.course, null);
  assert.ok(state.documents.some((d) => d.id === "certificate-coding"));
  assert.equal(state.flags.coursesCompleted, 1);
  assert.ok(state.player.skills.technical >= 40);
  assert.ok(state.player.skills.knowledge >= 25);
  if (getClock(state).minute >= 17 * 60) {
    state = perform(state, "travel:kadikoy");
    state = advanceToEvening(state);
    state = perform(state, "sleep");
    state = perform(state, "travel:sisli");
  }
  state = perform(state, "apply:developer");
  assert.equal(state.job.id, "developer");
  assert.equal(state.rng, rng, "learning and eligibility do not roll dice");
});

test("appointments reserve a real slot and punctual attendance becomes remembered trust", () => {
  let state = fixture();
  state = perform(state, "schedule:leyla");
  const appointment = state.appointments[0];
  assert.equal(appointment.day, 2);
  assert.equal(appointment.minute, 1080);
  assert.equal(available(state, "schedule:leyla"), false, "one pending appointment per person");
  state.npcs.ece.affinity = 25;
  assert.equal(available(state, "schedule:ece"), false, "overlapping calendar slot is unavailable");
  const before = state.npcs.leyla.trust;
  state.time = 1440 + 17 * 60 + 40;
  assert.equal(getNpcLocation(state, "leyla"), appointment.location);
  state = perform(state, `meet:${appointment.id}`);
  assert.equal(state.appointments[0].status, "completed");
  assert.equal(state.npcs.leyla.trust, before + 10);
  assert.ok(state.npcs.leyla.memories.some((memory) => /zamanında/.test(memory.text)));
  const completed = state.npcs.leyla.trust;
  state = perform(state, "wait:60");
  assert.equal(
    state.npcs.leyla.trust,
    completed,
    "completed attendance cannot become a missed date",
  );
});

test("missed appointments lose trust once and apology records responsibility without erasing history", () => {
  let state = fixture();
  state = perform(state, "schedule:leyla");
  state.time = 1440 + 18 * 60 + 45;
  const trust = state.npcs.leyla.trust;
  state = perform(state, "wait:60");
  assert.equal(state.appointments[0].status, "missed");
  assert.equal(state.npcs.leyla.trust, trust - 12);
  assert.ok(state.npcs.leyla.memories.some((memory) => /gelmedin/.test(memory.text)));
  state = perform(state, "apologize:leyla");
  assert.equal(state.npcs.leyla.trust, trust - 7);
  assert.ok(state.npcs.leyla.memories.some((memory) => /sorumluluk/.test(memory.text)));
  assert.ok(state.npcs.leyla.memories.some((memory) => /gelmedin/.test(memory.text)));
  state = perform(state, "wait:60");
  assert.equal(state.npcs.leyla.trust, trust - 7);
});

test("cancelling an appointment frees the slot and does not later incur a no-show penalty", () => {
  let state = perform(fixture(), "schedule:leyla");
  const trust = state.npcs.leyla.trust;
  state = perform(state, `cancel:${state.appointments[0].id}`);
  assert.equal(state.appointments[0].status, "cancelled");
  assert.equal(state.npcs.leyla.trust, trust - 2);
  assert.equal(available(state, "schedule:leyla"), true);
  state.time = 1440 + 19 * 60;
  state = perform(state, "wait:60");
  assert.equal(state.npcs.leyla.trust, trust - 2);
  assert.ok(state.npcs.leyla.memories.some((memory) => /iptal/.test(memory.text)));
});

test("romance needs mutual readiness and a breakup preserves the shared memories", () => {
  let state = fixture();
  state.time = 9 * 60;
  state.location = "besiktas";
  assert.equal(available(state, "date:ece"), false, "a stranger cannot immediately date");
  state.npcs.ece.affinity = 45;
  state.npcs.ece.trust = 32;
  const rng = state.rng;
  state = perform(state, "date:ece");
  assert.equal(
    available(state, "partner:ece"),
    false,
    "one date is not an established partnership",
  );
  state = perform(state, "talk:ece");
  state = perform(state, "travel:kadikoy");
  state = advanceToEvening(state);
  state = perform(state, "sleep");
  state = perform(state, "travel:besiktas");
  state = perform(state, "date:ece");
  state = perform(state, "partner:ece");
  assert.equal(state.flags.partner, "ece");
  assert.ok(state.achievements.includes("partnership"));
  assert.equal(available(state, "date:emre"), false, "the active relationship is respected");
  state = perform(state, "breakup:ece");
  assert.equal(state.flags.partner, undefined);
  assert.equal(state.npcs.ece.romance, 0);
  assert.ok(state.npcs.ece.memories.some((memory) => /adlandırdık/.test(memory.text)));
  assert.ok(state.npcs.ece.memories.some((memory) => /bitirdik/.test(memory.text)));
  assert.equal(state.rng, rng, "mutual readiness does not roll for consent");
});

test("paid events cannot overdraw and lasting choices resolve exactly once", () => {
  let state = fixture();
  state.resolvedEvents = state.resolvedEvents.filter((id) => id !== "repair-home");
  state.pendingEvents = [{ id: "repair-home", day: 1 }];
  state.cash = 0;
  assert.equal(available(state, "event:repair-home:pay"), false);
  const refusal = resolveAction(state, "event:repair-home:pay");
  assert.equal(refusal.ok, false);
  assert.deepEqual(refusal.state, state);
  state = perform(state, "event:repair-home:report");
  assert.equal(state.npcs.leyla.trust, 28);
  assert.equal(state.resolvedEvents.filter((id) => id === "repair-home").length, 1);
  assert.equal(resolveAction(state, "event:repair-home:report").ok, false);
  let other = fixture();
  other.resolvedEvents = other.resolvedEvents.filter((id) => id !== "market");
  other.pendingEvents = [{ id: "market", day: 1 }];
  other = perform(other, "event:market:plan");
  assert.equal(other.flags.shoppingPlan, true);
  assert.ok(
    getActions(other).find((a) => a.id === "buy:groceries").cost <
      ITEMS.find((i) => i.id === "groceries").price,
  );
});

test("uncertain event resolution advances seeded RNG once and records the visible roll", () => {
  let state = fixture();
  state = perform(state, "apply:retail");
  state.resolvedEvents = state.resolvedEvents.filter((id) => id !== "team-conflict");
  state.pendingEvents = [{ id: "team-conflict", day: 1 }];
  const initial = structuredClone(state);
  const result = resolveAction(state, "event:team-conflict:risk");
  assert.equal(result.ok, true);
  assert.notEqual(result.state.rng, initial.rng);
  assert.match(result.message, /Zar \d/);
  assert.match(result.message, /beceri/);
  assert.deepEqual(result, resolveAction(structuredClone(initial), "event:team-conflict:risk"));
  assert.equal(
    resolveAction(result.state, "event:team-conflict:risk").ok,
    false,
    "a resolved card cannot be rerolled",
  );
});

test("every authored event choice has executable, persistent consequences on a valid eligible state", () => {
  for (const event of EVENTS)
    for (const choice of event.choices) {
      let state = fixture({ scenario: "restart" });
      state = perform(state, "apply:retail");
      state.cash = 50000;
      state.bank = 50000;
      for (const id of Object.keys(state.player.skills)) state.player.skills[id] = 80;
      for (const npc of Object.values(state.npcs)) {
        npc.affinity = 80;
        npc.trust = 80;
      }
      state.resolvedEvents = state.resolvedEvents.filter((id) => id !== event.id);
      state.pendingEvents = [{ id: event.id, day: 1 }];
      const originalRng = state.rng,
        originalCash = state.cash;
      state = perform(state, `event:${event.id}:${choice.id}`);
      assert.ok(state.resolvedEvents.includes(event.id));
      assert.equal(state.pendingEvents.length, 0);
      if (choice.effects.document)
        assert.ok(state.documents.some((d) => d.id === choice.effects.document));
      for (const [key, value] of Object.entries(choice.effects.flags || {}))
        assert.equal(state.flags[key], value);
      if (!choice.roll) {
        assert.equal(state.rng, originalRng, `${event.id}/${choice.id}: deterministic consequence`);
        assert.equal(state.cash, originalCash - choice.cost + (choice.effects.cash || 0));
      }
    }
});

test("a no-money start can eat, shelter and rest without taking an involuntary loan", () => {
  let state = fixture();
  state.cash = 0;
  state.bank = 0;
  state.housing.deposit = 0;
  state.player.hunger = 5;
  state.player.energy = 25;
  state = perform(state, "move:shelter");
  state = perform(state, "soup");
  assert.ok(state.player.hunger > 40);
  state = perform(state, "rest");
  assert.ok(state.player.energy > 30);
  assert.equal(state.debt, 0);
});
