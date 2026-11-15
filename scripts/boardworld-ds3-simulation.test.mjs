import assert from "node:assert/strict";
import test from "node:test";
import { createGame, getActions, loadExpansionRuntime, resolveAction, validateState } from
  "../public/games/tc-sim-boardworld/engine.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
import { getDistrictSimulation } from "../public/games/tc-sim-boardworld/expansion-districts.mjs";
import { payResidentDebt } from "../public/games/tc-sim-boardworld/expansion-economy.mjs";

const runtime = await loadExpansionRuntime();
const DAY = 1440;
const day = (s) => Math.floor(s.time / DAY) + 1;
const create = () => createGame({ expansion: true, seed: 49 });
const organization = (s, id) => s.expansion.underworld.chapters[id];
const enabled = (s) => getActions(s).filter((action) => !action.disabled);

function act(s, id) {
  const result = resolveAction(s, id);
  assert.ok(result.ok, `${id} at ${s.time}: ${result.message}`);
  return result.state;
}

function play(s, id) {
  for (let tries = 0; tries < 32; tries++) {
    const actions = enabled(s);
    if (actions.some((action) => action.id === id)) return act(s, id);
    const event = actions.find((action) => action.id.startsWith("event:"));
    s = act(s, event?.id ?? "wait:60");
  }
  return assert.fail(`Unavailable action: ${id}`);
}

test("autonomous personalities and organization decisions change the shared economy", () => {
  let s = create();
  const people = (state) => new Map(runtime.getExpansionView(state).society.characters.map((row) => [row.id, row]));
  const starting = people(s);
  const driven = "resident:istanbul:beyoglu";
  const cautious = "resident:istanbul:fatih";
  assert.equal(starting.get(driven).skill, starting.get(cautious).skill);
  assert.equal(starting.get(driven).goal, "advancement");
  assert.equal(starting.get(cautious).goal, "stability");
  const seen = new Set();
  while (day(s) < 49) {
    const previous = s;
    const actions = enabled(s);
    const event = actions.find(({ id }) => id.startsWith("event:"));
    const sleep = actions.find(({ id }) => id === "sleep");
    s = act(s, event?.id ?? sleep?.id ?? "wait:60");
    const today = day(s);
    if (today === day(previous)) continue;
    for (const [org, politics] of Object.entries(s.expansion.society.organizations)) {
      const rows = politics.history.filter((row) => row.day === today);
      for (const { kind, districtId, cost, actorId } of rows) {
        const current = organization(s, org);
        if (kind === "outreach" && !seen.has(kind)) {
          assert.equal(previous.expansion.underworld.territory[org][districtId], undefined);
          assert.ok(s.expansion.underworld.territory[org][districtId] > 0);
          assert.ok(cost > 0 && current.ledger.outreach - organization(previous, org).ledger.outreach >= cost);
        }
        if (kind === "reinforcement" && !seen.has(kind)) {
          assert.ok(current.ledger.outreach - organization(previous, org).ledger.outreach > cost,
            "reinforcement and network maintenance both count against the same treasury");
        }
        if (kind === "contested" && !seen.has(kind)) {
          const district = getDistrictSimulation(s, districtId);
          const before = getDistrictSimulation(previous, districtId);
          const local = runtime.getExpansionView(s).society.organizations.find(({ id }) => id === org);
          assert.ok(local.territories.find((row) => row.districtId === districtId).rivalry > 0);
          assert.ok(district.security < before.security && district.serviceDelay > before.serviceDelay);
        }
        if (org === "perpa" && (kind === "betrayal" || kind === "reorganization")) {
          const staffIndex = Number(actorId.split(":")[2]);
          const priorStaff = organization(previous, org).roster[staffIndex];
          if (kind === "betrayal") {
            assert.equal(priorStaff.leftDay, null);
            assert.equal(current.roster[staffIndex].leftDay, today);
            assert.ok(current.readiness < organization(previous, org).readiness);
          } else {
            assert.ok(priorStaff.leftDay > 0);
            assert.equal(current.roster[staffIndex].leftDay, null);
            assert.equal(current.roster[staffIndex].generation, priorStaff.generation);
          }
          seen.add(`perpa:${kind}`);
        }
        seen.add(kind);
      }
    }
  }
  assert.ok(validateState(s));
  const latest = people(s);
  assert.ok(latest.get(driven).skill >= starting.get(driven).skill + 6);
  assert.ok(latest.get(driven).memory.some(({ kind }) => kind === "training"));
  assert.equal(latest.get(driven).employer, starting.get(driven).employer);
  assert.equal(latest.get(cautious).skill, starting.get(cautious).skill);
  assert.ok(s.deep.npcs.ece.salary > create().deep.npcs.ece.salary, "the Gold career goal leads to wage growth");
  for (const kind of ["outreach", "reinforcement", "contested", "perpa:betrayal", "perpa:reorganization"])
    assert.ok(seen.has(kind), kind);
  assert.equal(s.expansion.underworld.memberships.length, 0, "the player never joined an organization");
});

test("real organization work earns leadership and controls strategy across save and replay", () => {
  let s = create();
  const doAction = (id) => { s = play(s, id); };
  for (const id of [
    "event:welcome:work", "visit:kadikoy-cafe", "underworld:recruit:moda", "underworld:join:moda", "visit:kadikoy-work",
  ]) doAction(id);
  for (let task = 1; task <= 8; task++) {
    doAction("underworld:accept:sorting");
    doAction(`underworld:complete:${task}`);
    if (task === 3 || task === 5)
      for (const id of ["visit:kadikoy-cafe", "underworld:promote", "visit:kadikoy-work"]) doAction(id);
  }
  doAction("visit:kadikoy-cafe");
  const before = s;
  doAction("underworld:lead");
  const leader = s.expansion.playerId;
  assert.deepEqual(organization(s, "moda"), { ...organization(before, "moda"), leader });
  const [member] = s.expansion.underworld.memberships;
  assert.deepEqual(member, { ...before.expansion.underworld.memberships[0], rank: 3 });
  assert.deepEqual(s.expansion.society.organizations.moda.history.at(-1), {
    kind: "succession", day: day(s), actorId: leader,
  });
  const restored = importGame(exportGame(s)).state;
  assert.ok(restored && validateState(restored));
  s = play(s, "underworld:policy:expansion");
  assert.deepEqual(s, play(restored, "underworld:policy:expansion"));
  assert.equal(s.expansion.society.organizations.moda.strategy, "expansion");
  assert.ok(getActions(s).find(({ id }) => id === "underworld:policy:trade").disabled);
  assert.ok(validateState(s));
});

test("resident debt settlement reduces the existing liability up to its balance", () => {
  const s = create();
  const citizen = s.deep.npcs.mert;
  const balance = citizen.debt;
  const before = structuredClone(s);
  assert.ok(balance > 1);
  assert.equal(payResidentDebt(s, "unknown", 1), 0);
  for (const invalid of [0, -1, 0.5, Infinity, 1_000_000_001])
    assert.equal(payResidentDebt(s, "mert", invalid), 0);
  assert.deepEqual(s, before);
  assert.equal(payResidentDebt(s, "mert", balance - 1), balance - 1);
  assert.equal(payResidentDebt(s, "mert", balance), 1);
  assert.equal(payResidentDebt(s, "mert", balance), 0);
  before.deep.npcs.mert.debt = 0;
  assert.deepEqual(s, before, "debtor and household funds were not changed");
  assert.ok(validateState(s));
});

test("an insolvency boundary closes operations and a real household transfer reopens them", () => {
  let s = create();
  for (const id of [
    "event:welcome:work", "visit:kadikoy-cafe", "underworld:recruit:moda", "underworld:join:moda",
  ]) s = play(s, id);
  // Prepare a valid insolvency boundary; dissolution and recovery use the resolver.
  const chapter = organization(s, "moda");
  chapter.ledger.payroll += chapter.treasury - 60;
  Object.assign(chapter, { treasury: 60, readiness: 20 });
  chapter.roster[1].leftDay = day(s);
  s.expansion.underworld.territory.moda.besiktas = 12;
  assert.ok(validateState(s));
  const nextDay = day(s) + 1;
  while (day(s) < nextDay) {
    const actions = enabled(s);
    const event = actions.find(({ id }) => id.startsWith("event:"));
    const sleep = actions.find(({ id }) => id === "sleep");
    s = act(s, event?.id ?? sleep?.id ?? "wait:60");
  }
  const politics = (state) => state.expansion.society.organizations.moda;
  const operation = (state) => runtime.getExpansionView(state).society.organizations.find(({ id }) => id === "moda");
  const recovery = "underworld:reorganize:moda";
  assert.equal(politics(s).closedDay, nextDay);
  assert.deepEqual(s.expansion.underworld.territory.moda, {});
  assert.ok(operation(s).dissolved);
  assert.ok(!getActions(s).some(({ id }) => /underworld:(?:promote|accept:|recruit:moda)/.test(id)));
  assert.equal(politics(s).history.at(-1).kind, "dissolution");
  s = play(s, "visit:kadikoy-work");
  const request = getActions(s).find(({ id }) => id === recovery);
  assert.ok(request && !request.disabled);
  const before = s;
  s = act(s, recovery);
  const amount = request.cost;
  assert.ok(amount > 0);
  assert.equal(before.cash + before.bank - (s.cash + s.bank), amount);
  assert.equal(organization(s, "moda").treasury - organization(before, "moda").treasury, amount);
  assert.equal(politics(s).capital, amount);
  assert.equal(politics(s).closedDay, null);
  assert.equal(politics(s).history.at(-1).kind, "reorganization");
  assert.equal(organization(s, "moda").roster[1].leftDay, null);
  assert.deepEqual(s.expansion.underworld.memberships, before.expansion.underworld.memberships);
  assert.ok(!operation(s).dissolved && validateState(s));
  assert.deepEqual(importGame(exportGame(s)).state, s);
});
