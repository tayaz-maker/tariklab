import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame } from "../public/games/tc-sim/js/state.js";
import { loadGame, migrateState, SAVE_KEY } from "../public/games/tc-sim/js/save.js";
import {
  buildScenarioFinal,
  chooseEightiesStartYear,
  createScenario,
  processScenarioWeek,
  resolveScenarioChoice,
  scenarioChoiceEffect,
  HISTORICAL_SOURCES,
} from "../public/games/tc-sim/js/historical-scenarios.js";

function fixture(eraId, seed = 424242) {
  const scenario = createScenario(eraId, seed);
  return {
    meta: { rngState: seed },
    world: { eraId, scenario },
    time: { absoluteWeek: 1 },
    finances: { balance: 5000 },
    career: { performance: 50 },
    education: { progress: 0 },
    health: { energy: 76, stress: 24, health: 82 },
    relationships: { anne: 70 },
    flags: {},
  };
}

test("1980s start year is reproducible from seed and remains in the supported cohort", () => {
  const year = chooseEightiesStartYear(987654321);
  assert.equal(chooseEightiesStartYear(987654321), year);
  assert.ok([1980, 1984, 1988].includes(year));
  assert.equal(createScenario("1980s", 987654321).startDate, `${year}-01-01`);
});

test("1999 start is fixed and exposes a playable six-choice scenario event", () => {
  const state = fixture("1999-04-18");
  assert.equal(state.world.scenario.startDate, "1999-04-18");
  assert.equal(state.world.scenario.endDate, "2026-01-01");
  assert.equal(state.world.scenario.pendingEvent.choices.length, 6);
  assert.equal(resolveScenarioChoice(state, "study").ok, true);
  assert.equal(state.career.performance, 53);
  assert.equal(state.world.scenario.delayedEffects.length, 1);
});

test("delayed consequences resolve deterministically after one simulation year", () => {
  const left = fixture("1999-04-18");
  const right = fixture("1999-04-18");
  for (const state of [left, right]) resolveScenarioChoice(state, "work");
  left.time.absoluteWeek = right.time.absoluteWeek = 49;
  for (const state of [left, right]) processScenarioWeek(state);
  assert.equal(left.career.performance, right.career.performance);
  assert.equal(left.world.scenario.delayedEffects[0].applied, true);
  assert.equal(left.career.performance, 53);
});

test("same seed and same decision order produce the same event and outcome history", () => {
  const play = () => {
    const state = fixture("1980s", 123);
    const first = state.world.scenario.pendingEvent;
    resolveScenarioChoice(state, "save");
    state.time.absoluteWeek = 49;
    processScenarioWeek(state);
    const second = state.world.scenario.pendingEvent;
    resolveScenarioChoice(state, "family");
    return { first: first?.id, second: second?.id, history: state.world.scenario.history, balance: state.finances.balance };
  };
  assert.deepEqual(play(), play());
});

test("2026 final is available and captures the life-system outcomes", () => {
  const state = fixture("1999-04-18");
  resolveScenarioChoice(state, "rest");
  state.time.absoluteWeek = 1 + Math.ceil((Date.parse("2026-01-01T00:00:00Z") - Date.parse("1999-04-18T00:00:00Z")) / (365.2425 * 86400000) * 48);
  const messages = processScenarioWeek(state);
  assert.ok(messages.some((message) => message.includes("1 Ocak 2026")));
  assert.equal(state.world.scenario.currentDate, "2026-01-01");
  assert.equal(state.world.scenario.completed, true);
  assert.equal(buildScenarioFinal(state).decisions, 1);
});

test("choice effects are game-scale axes rather than historical currency claims", () => {
  assert.deepEqual(scenarioChoiceEffect("save"), { money: 2, stress: 1, access: -1 });
});

test("every factual event has its own institutional source and every source is official", () => {
  for (const eraId of ["1999-04-18", "1980s"]) {
    const scenario = createScenario(eraId, 42);
    for (const [, title, , kind, sourceIds = []] of scenario.pack.events) {
      if (kind === "historical") assert.ok(sourceIds.length > 0, `${eraId}: ${title}`);
      if (kind === "life") assert.equal(sourceIds.length, 0, `${eraId}: ${title}`);
      for (const id of sourceIds) {
        const source = HISTORICAL_SOURCES[id];
        assert.ok(source, `${eraId}: ${title} references ${id}`);
        const host = new URL(source.url).hostname;
        assert.ok(host === "worldbank.org" || host.endsWith(".worldbank.org") || host === "tcmb.gov.tr" || host.endsWith(".tcmb.gov.tr"), host);
      }
    }
  }
});

test("historical state round-trips while the existing save key and legacy present save remain intact", () => {
  assert.equal(SAVE_KEY, "tc-sim-save");
  const historical = createNewGame({ eraId: "1999-04-18", seed: 78 });
  assert.equal(historical.time.year, 1999);
  assert.equal(historical.time.month, 4);
  assert.equal(historical.time.weekOfMonth, 3);
  const restoredHistorical = migrateState(JSON.parse(JSON.stringify(historical)));
  assert.equal(restoredHistorical.ok, true);
  assert.equal(restoredHistorical.state.world.scenario.seed, 78);
  assert.equal(restoredHistorical.state.world.scenario.startDate, "1999-04-18");

  const oldPresent = createNewGame({ seed: 18 });
  delete oldPresent.meta.startYear;
  delete oldPresent.world.scenario;
  const legacyStorage = new Map([[SAVE_KEY, JSON.stringify(oldPresent)]]);
  const storage = {
    getItem: (key) => legacyStorage.get(key) ?? null,
    setItem: (key, value) => legacyStorage.set(key, String(value)),
    removeItem: (key) => legacyStorage.delete(key),
  };
  const restoredOld = loadGame(storage);
  assert.equal(restoredOld.ok, true);
  assert.equal(restoredOld.state.world.eraId, "present_day");
  assert.equal(restoredOld.state.world.scenario, undefined);
  assert.ok(legacyStorage.has(SAVE_KEY), "legacy tc-sim-save remains available after slot migration");
});
