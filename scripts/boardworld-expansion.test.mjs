import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  expandGame,
  getActions,
  resolveAction,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import {
  exportGame,
  importGame,
  loadExpansionLocked,
  saveExpansionLocked,
  saveGame,
  SAVE_KEY,
} from "../public/games/tc-sim-boardworld/persistence.mjs";
import {
  initWorld,
  tickRegions,
  validateWorld,
} from "../public/games/tc-sim-boardworld/expansion-world.mjs";
import { familyView } from "../public/games/tc-sim-boardworld/expansion-family.mjs";

function act(state, id) {
  const result = resolveAction(state, id);
  assert.ok(result.ok, result.message);
  return result.state;
}

test("Gold records migrate explicitly and expansion export is lossless", () => {
  const gold = createGame({ seed: 49 });
  const original = exportGame(gold);
  const first = expandGame(importGame(original).state);
  assert.equal(first.version, 7);
  assert.deepEqual(first, createGame({ seed: 49, expansion: true }));
  const { version: _version, expansion: _expansion, ...rest } = first;
  assert.deepEqual(
    rest,
    Object.fromEntries(Object.entries(gold).filter(([key]) => key !== "version")),
  );
  assert.deepEqual(importGame(exportGame(first)).state, first);
  assert.equal(exportGame(gold), original);
  const invalid = structuredClone(first);
  invalid.expansion.world.regions.izmir.population++;
  assert.equal(validateState(invalid), false);
});

test("regional movement conserves the estate and enforces local actions", () => {
  let state = createGame({ seed: 49, expansion: true });
  const opening = getActions(state).find((action) => !action.disabled);
  state = act(state, opening.id);
  const before = state;
  const a = act(before, "world:move:ankara");
  assert.deepEqual(a, act(before, "world:move:ankara"));
  assert.equal(before.expansion.world.region, "istanbul");
  assert.equal(a.expansion.world.region, "ankara");
  assert.equal(a.expansion.playerId, before.expansion.playerId);
  assert.equal(a.cash + a.bank, before.cash + before.bank - 780);
  assert.deepEqual(a.housing, before.housing);
  assert.equal(
    getActions(a).some((action) => action.id.startsWith("travel:")),
    false,
  );
  assert.ok(getActions(a).some((action) => action.id === "world:meal"));
  assert.deepEqual(importGame(exportGame(a)).state, a);
});

test("regional cycles balance migration and have deterministic price and population histories", () => {
  function simulate(seed) {
    const s = { expansion: {}, time: 0, seed };
    initWorld(s);
    const history = [];
    const api = {
      dayOf: (next) => Math.floor(next.time / 1440) + 1,
      expansionEvent: (_state, ...event) => history.push(event),
    };
    for (let i = 1; i <= 180; i++) {
      s.time += 30 * 1440;
      tickRegions(s, api, { istanbul: { workers: 12 }, izmir: { workers: 0 } });
      assert.ok(validateWorld(s));
    }
    assert.ok(history.some(([kind]) => kind === "migration"));
    return { world: s.expansion.world, history };
  }
  assert.deepEqual(simulate(11), simulate(11));
  assert.notDeepEqual(simulate(11), simulate(36));
});

test("the normal action loop stops at death and resumes through the same saved estate", () => {
  let s = createGame({ seed: 3, expansion: true });
  s = act(s, getActions(s).find((action) => !action.disabled).id);
  s = act(s, "family:adopt");
  const people = s.expansion.family.people;
  const founder = people.find((person) => person.id === "player:1");
  const parent = people.find((person) => person.id === founder.parents[0]);
  const heir = people.find((person) => person.parents.includes(founder.id));
  // Fast-forward age, while preserving actual calendar, funds and world progression.
  founder.born = 2 - founder.lifespan * 30;
  parent.born = founder.born - 24 * 30;
  parent.died = 1;
  heir.born = 1 - 18 * 30;
  assert.ok(validateState(s));
  for (let i = 0; i < 85 && familyView(s).player.died === null; i++) {
    const actions = getActions(s);
    const wait = actions.find((action) => action.id === "wait:15" && !action.disabled);
    s = act(s, (wait ?? actions.find((action) => !action.disabled)).id);
  }
  assert.equal(s.time, 1440);
  assert.equal(familyView(s).player.died, 2);
  assert.ok(getActions(s).every((action) => action.id.startsWith("family:successor:")));
  assert.equal(resolveAction(s, "wait:15").ok, false);
  const saved = importGame(exportGame(s)).state;
  const inherited = act(saved, `family:successor:${heir.id}`);
  assert.equal(inherited.expansion.playerId, heir.id);
  assert.equal(inherited.debt, saved.debt);
  assert.deepEqual(inherited.housing, saved.housing);
  assert.equal(familyView(inherited).generations, 2);
  assert.deepEqual(importGame(exportGame(inherited)).state, inherited);
});

test("expansion CAS shares authority and preserves Gold bytes across stale writers", async () => {
  let slots = new Map();
  let generation = 0;
  const storage = {
    getItem: (key) => slots.get(key) ?? null,
    setItem: (key, value) => slots.set(key, value),
  };
  const locks = { request: (_key, fn) => fn() };
  const transact = (_mirror, op) => {
    const staging = new Map(slots);
    const result = op(
      {
        getItem: (key) => staging.get(key) ?? null,
        setItem: (key, value) => staging.set(key, value),
      },
      generation,
    );
    if (result.ok === true) {
      slots = staging;
      generation++;
    }
    if (result.token) result.token.generation = generation;
    return result;
  };
  const gold = createGame();
  assert.ok(saveGame(gold, storage).ok);
  const goldBytes = storage.getItem(SAVE_KEY);
  const { token } = await loadExpansionLocked(undefined, locks, transact);
  const expanded = expandGame(gold);
  assert.ok((await saveExpansionLocked(expanded, undefined, token, locks, transact)).ok);
  const stale = await saveExpansionLocked(expanded, undefined, token, locks, transact);
  assert.equal(stale.conflict, true);
  assert.equal(storage.getItem(SAVE_KEY), goldBytes);
  const saved = await loadExpansionLocked(undefined, locks, transact);
  assert.deepEqual(saved.state, expanded);
  assert.equal((await loadExpansionLocked(undefined, {}, transact)).token, null);
});
