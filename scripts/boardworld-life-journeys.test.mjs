import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import * as e from "../public/games/tc-sim-boardworld/engine.mjs";
import * as p from "../public/games/tc-sim-boardworld/persistence.mjs";

await e.loadExpansionRuntime();
// These journeys start at character creation and use only public game actions.
// No clocks, ages, balances, relationships, homes or inheritance are injected.
// The long journey is one bounded life, also exercising periodic reload/replay.

function ordinaryJourney() {
  let s = e.createGame({ seed: 49, scenario: "restart", trait: "resilient", expansion: true });
  const target = 1700,
    trace = [],
    milestones = { created: { time: s.time, person: s.expansion.playerId } },
    start = performance.now();
  let lastSave = 0,
    property = "",
    idle = 0;
  const day = () => Math.floor(s.time / 1440) + 1;
  const enabled = (a, id) => a.find((x) => x.id === id && !x.disabled);
  function apply(id) {
    const before = s,
      r = e.resolveAction(s, id);
    assert.ok(r.ok, `${id}: ${r.message}`);
    s = r.state;
    trace.push(id);
    if (day() > lastSave + 30) {
      const loaded = p.importGame(p.exportGame(before));
      assert.ok(loaded.state);
      assert.deepEqual(e.resolveAction(loaded.state, id).state, s);
      lastSave = day();
    }
    assert.ok(e.validateState(s), `${id}: invalid state`);
    if (s.time === before.time) idle++;
    else idle = 0;
    assert.ok(idle < 40, "no-progress action cycle");
  }
  while (day() <= target && trace.length < 40000) {
    const a = e.getActions(s),
      can = (id) => enabled(a, id),
      player = s.player,
      minute = s.time % 1440;
    const event = a.find(
      (x) =>
        !x.disabled &&
        (x.category === "event" || x.id.startsWith("story:") || x.id.startsWith("emergent:")),
    );
    const person = s.expansion.family.people.find((x) => x.id === s.expansion.playerId);
    if (person.died !== null) {
      const child = s.expansion.family.people.find(
        (x) => x.parents.includes(person.id) && x.died === null && day() - x.born >= 540,
      );
      const id = `family:successor:${child?.id}`;
      assert.ok(can(id), `No eligible actual-grown descendant: ${a.map((x) => x.id)}`);
      const worldBefore = {
        time: s.time,
        property: structuredClone(s.expansion.economy.properties[property]),
        nextEvent: s.expansion.nextEvent,
      };
      apply(id);
      assert.equal(s.expansion.playerId, child.id);
      assert.equal(s.time, worldBefore.time);
      assert.deepEqual(s.expansion.economy.properties[property], worldBefore.property);
      assert.ok(s.expansion.nextEvent > worldBefore.nextEvent);
      milestones.succession = {
        day: day(),
        person: s.expansion.playerId,
        estate: s.expansion.family.lastEstate,
        property,
      };
      break;
    }
    let id;
    if (event) id = event.id;
    else if (s.flow.settlements !== "authorized" && can("flow:payments:authorized"))
      id = "flow:payments:authorized";
    else if (player.hunger < 50 && ["cook", "buy:groceries", "eat", "soup", "snack"].some(can))
      id = ["cook", "buy:groceries", "eat", "soup", "snack"].find(can);
    else if (player.health < 60 && can("doctor")) id = "doctor";
    else if ((player.energy < 38 || minute >= 1260 || minute < 300) && can("sleep")) id = "sleep";
    else if (player.stress > 65 && can("rest")) id = "rest";
    else if (!s.job && can("apply:repair") && !person.retired) id = "apply:repair";
    else if (can("work")) id = "work";
    else if (can("promote")) id = "promote";
    else if (day() > 31 && !milestones.family && can("family:adopt")) id = "family:adopt";
    else if (!property && milestones.family && s.cash + s.bank > 55000) {
      const purchase = a
        .filter((x) => x.id.startsWith("economy:buy:istanbul:") && !x.disabled)
        .sort((x, y) => x.cost - y.cost)[0];
      if (purchase) id = purchase.id;
    }
    if (
      !id &&
      property &&
      s.expansion.economy.home !== property &&
      can(`economy:occupy:${property}`)
    )
      id = `economy:occupy:${property}`;
    if (!id && milestones.family) {
      const care = a.find((x) => x.id.startsWith("family:care:") && !x.disabled);
      if (care) id = care.id;
    }
    if (!id && s.debt && can("repay:5000") && s.cash + s.bank > 20000) id = "repay:5000";
    if (!id && can("family:arrears")) id = "family:arrears";
    if (!id && can("rent:pay")) id = "rent:pay";
    if (!id) id = can("wait:routine") ? "wait:routine" : "wait:60";
    const before = s;
    apply(id);
    if (id.startsWith("apply:")) milestones.employment ??= { day: day(), job: s.job.id };
    if (
      !milestones.salary &&
      s.bank > before.bank &&
      s.transactions.some((t) => /maaş/i.test(t.label || ""))
    )
      milestones.salary = { day: day(), bank: s.bank };
    if (!milestones.rent && day() >= 31 && s.housing.dueDay > 31)
      milestones.rent = { day: day(), nextDue: s.housing.dueDay, arrears: s.housing.arrears };
    if (id === "family:adopt")
      milestones.family = {
        day: day(),
        child: s.expansion.family.people.find((x) => x.parents.includes(person.id))?.id,
      };
    if (id.startsWith("economy:buy:")) {
      property = id.slice("economy:buy:".length);
      milestones.property = {
        day: day(),
        property,
        owner: s.expansion.economy.properties[property].owner,
      };
    }
  }
  for (const key of ["employment", "salary", "rent", "family", "property", "succession"])
    assert.ok(milestones[key], `Missing real-life milestone: ${key}`);
  assert.ok(s.expansion.underworld, "The independent world materialized during ordinary life");
  assert.ok(
    Object.values(s.expansion.underworld.chapters).every(
      (c) => c.ledger.sales > 0 && c.ledger.payroll > 0,
    ),
  );
  assert.deepEqual(p.importGame(p.exportGame(s)).state, s);
  return {
    state: s,
    report: {
      actualActionsOnly: true,
      days: day(),
      actions: trace.length,
      milestones,
      elapsedMs: Math.round(performance.now() - start),
    },
  };
}

function socialJourney() {
  let s = e.createGame({ seed: 49, scenario: "restart", expansion: true }),
    trace = [],
    promise;
  const step = (state, id) => {
    const r = e.resolveAction(state, id);
    assert.ok(r.ok, `${id}: ${r.message}`);
    assert.ok(e.validateState(r.state));
    return r.state;
  };
  const apply = (id) => {
    s = step(s, id);
    trace.push(id);
  };
  const care = (state, a) => {
    const can = (id) => a.some((x) => x.id === id && !x.disabled);
    const event = a.find((x) => x.category === "event" && !x.disabled);
    if (event) return event.id;
    if (state.player.hunger < 50) {
      const id = ["cook", "buy:groceries", "eat", "soup", "snack"].find(can);
      if (id) return id;
    }
    if (state.player.energy < 40 || state.time % 1440 >= 1260 || state.time % 1440 < 300)
      return "sleep";
    return "wait:60";
  };
  let met = false,
    disclosed = false;
  for (let n = 0; n < 400 && !promise; n++) {
    const a = e.getActions(s),
      can = (id) => a.some((x) => x.id === id && !x.disabled);
    const event = a.find((x) => x.category === "event" && !x.disabled);
    let id;
    if (event) id = event.id;
    else if (!met && can("talk:aylin")) {
      id = "talk:aylin";
      met = true;
    } else if (met && !disclosed && can("deep:disclose:aylin")) {
      id = "deep:disclose:aylin";
      disclosed = true;
    } else if (can("deep:promise:aylin")) id = "deep:promise:aylin";
    else if (can("call:aylin") && s.npcs.aylin.affinity < 25) id = "call:aylin";
    else id = care(s, a);
    apply(id);
    promise = s.deep.promises.find(
      (x) => x.direction === "player" && x.status === "pending" && x.npcId === "aylin",
    );
  }
  assert.ok(met && disclosed && promise, "Real NPC request did not emerge");
  assert.ok(s.deep.npcs.aylin.knownFacts.some((f) => f.id === "finances"));
  const promised = p.exportGame(s),
    pid = promise.id,
    due = promise.dueDay,
    trust = s.npcs.aylin.trust;
  let kept = p.importGame(promised).state,
    broken = p.importGame(promised).state,
    keepActions = [],
    breakActions = [];
  for (
    let n = 0;
    n < 100 && kept.deep.promises.find((x) => x.id === pid).status === "pending";
    n++
  ) {
    const a = e.getActions(kept),
      target = a.find((x) => x.id === `deep:fulfill:${pid}` && !x.disabled);
    let id = target?.id;
    if (!id && kept.time % 1440 >= 540 && kept.time % 1440 < 1100) {
      const district = e.getNpcLocation(kept, "aylin");
      const travel = a.find((x) => x.id === `travel:${district}` && !x.disabled);
      id = travel?.id;
    }
    id ??= care(kept, a);
    kept = step(kept, id);
    keepActions.push(id);
  }
  assert.equal(kept.deep.promises.find((x) => x.id === pid).status, "kept");
  assert.ok(kept.npcs.aylin.trust > trust);
  while (Math.floor(broken.time / 1440) + 1 <= due + 1) {
    const id = care(broken, e.getActions(broken));
    broken = step(broken, id);
    breakActions.push(id);
    assert.ok(breakActions.length < 100);
  }
  const missed = broken.deep.promises.find((x) => x.id === pid);
  assert.equal(missed.status, "broken");
  assert.ok(broken.npcs.aylin.trust < trust);
  assert.deepEqual(p.importGame(p.exportGame(broken)).state, broken);
  let replay = p.importGame(promised).state;
  for (const id of breakActions) replay = step(replay, id);
  assert.deepEqual(replay, broken);
  const report = {
    actualActionsOnly: true,
    metNpc: true,
    sharedPrivateFinances: true,
    promise: { id: pid, dueDay: due, trustBefore: trust },
    kept: { status: "kept", trust: kept.npcs.aylin.trust, actions: keepActions },
    broken: {
      status: "broken",
      trust: broken.npcs.aylin.trust,
      delayedUntilDay: Math.floor(broken.time / 1440) + 1,
      actions: breakActions.length,
    },
    reloadReplayExact: true,
    creationActions: trace,
  };

  return report;
}

function intercityJourney(initial) {
  let s = p.importGame(p.exportGame(initial)).state;
  assert.ok(s);
  const trace = [],
    stages = [];
  const step = (id) => {
    const before = s,
      bytes = p.exportGame(s),
      r = e.resolveAction(s, id);
    assert.ok(r.ok, `${id}: ${r.message}`);
    assert.deepEqual(e.resolveAction(p.importGame(bytes).state, id).state, r.state);
    s = r.state;
    trace.push(id);
    assert.ok(e.validateState(s));
    return before;
  };
  const clear = () => {
    while (s.pendingEvents.length)
      step(e.getActions(s).find((a) => a.category === "event" && !a.disabled).id);
  };
  for (const city of ["ankara", "izmir"]) {
    clear();
    const old = s,
      person = s.expansion.playerId,
      household = JSON.stringify(s.expansion.family.people),
      property = s.expansion.economy.properties["istanbul:room"].owner;
    const move = e.getActions(s).find((a) => a.id === `world:move:${city}`);
    assert.ok(move && !move.disabled, move?.reason);
    step(move.id);
    assert.equal(s.expansion.world.region, city);
    assert.equal(s.time - old.time, move.minutes);
    assert.equal(s.expansion.playerId, person);
    assert.equal(s.expansion.economy.properties["istanbul:room"].owner, property);
    assert.equal(JSON.stringify(s.expansion.family.people), household);
    clear();
    const district = city === "ankara" ? "ankara:cankaya" : "izmir:bornova";
    step(`district:travel:${district}`);
    while (s.time % 1440 < 480 || s.time % 1440 > 1020) {
      clear();
      step("wait:60");
    }
    step(`district:visit:${district}:housing`);
    const rent = e.getActions(s).find((a) => a.id === `economy:rent:${city}:studio` && !a.disabled);
    assert.ok(
      rent,
      JSON.stringify(e.getActions(s).filter((a) => a.id.startsWith("economy:rent:"))),
    );
    step(rent.id);
    assert.equal(s.expansion.economy.home, `${city}:studio`);
    assert.equal(s.expansion.economy.properties["istanbul:room"].owner, "household");
    const reloaded = p.importGame(p.exportGame(s)).state;
    assert.deepEqual(reloaded, s);
    s = reloaded;
    stages.push({
      city,
      district,
      home: s.expansion.economy.home,
      time: s.time,
      retainedProperty: "istanbul:room",
      retainedSuccessor: person,
    });
  }

  return { actualActionsOnly: true, stages, trace, exactReloadAndReplay: true };
}

const receipts = {};
function record(name, result) {
  receipts[name] = result;
  if (process.env.BOARDWORLD_LIVING_JOURNEYS_REPORT)
    writeFileSync(
      process.env.BOARDWORLD_LIVING_JOURNEYS_REPORT,
      JSON.stringify(receipts, null, 2) + "\n",
    );
}
test(
  "ordinary legal life forms a family, buys property, ages into succession and relocates across cities",
  // The fixed action/day bounds limit simulation work. Allow CPU sharing with
  // the existing annual replay suites in required CI.
  { timeout: 600000 },
  () => {
    const journey = ordinaryJourney();
    record("ordinaryLifeAndSuccession", journey.report);
    record("intercityLife", intercityJourney(journey.state));
  },
);
test("a real NPC relationship produces a promise with kept and delayed broken outcomes and replay", () => {
  record("socialRelationship", socialJourney());
});
