import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
// Son 100 Gün now runs its own single-seat page (pov-app.js), not the shared front menu.
const gameIds = ["apartman", "kayip-telefon", "tc-sim-devlet"];

function storageHarness(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    values,
    writes,
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        writes.push(key);
        values.set(key, value);
      },
      removeItem: (key) => values.delete(key),
    },
  };
}

test("route open reads slot metadata but creates, loads and writes no game state", async () => {
  const saved = JSON.stringify({
    meta: { version: 1, id: "apartman", seed: 12345 },
    week: 7,
    building: {},
    finance: {},
    residents: [],
    issues: [],
    meetings: [],
    lastMeeting: null,
    openCases: [],
    history: [],
    flags: {},
    ui: {},
  });
  const harness = storageHarness({ "tariklab.nextwave.apartman.slot1": saved });
  const listeners = new Set();
  globalThis.localStorage = harness.storage;
  globalThis.document = {
    querySelector: () => null,
    documentElement: { classList: { toggle() {} } },
  };
  globalThis.window = {
    self: {},
    top: {},
    confirm: () => true,
    addEventListener() {},
    tlabI18n: {
      getLang: () => "tr",
      onLang(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    },
  };
  try {
    const { bootGame } =
      await import("../public/games/next-wave/shared/runtime.js?start-flow-boundary");
    const session = bootGame("apartman", () => {});
    assert.equal(session.state, null);
    assert.equal(session.slotSummaries()[0].filled, true);
    assert.deepEqual(harness.writes, []);

    assert.equal(session.continue(), true);
    assert.equal(session.state.week, 7);
    assert.deepEqual(harness.writes, [], "Continue must not rewrite an exact save");
  } finally {
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
  }
});

test("new-game authorization, cancel and final commit enforce the state boundary exactly once", async () => {
  const harness = storageHarness();
  globalThis.localStorage = harness.storage;
  globalThis.document = {
    querySelector: () => null,
    documentElement: { classList: { toggle() {} } },
  };
  globalThis.window = {
    self: {},
    top: {},
    confirm: () => true,
    addEventListener() {},
    tlabI18n: { getLang: () => "tr", onLang: () => () => {} },
  };
  try {
    const { bootGame } =
      await import("../public/games/next-wave/shared/runtime.js?start-flow-commit");
    const session = bootGame("apartman", () => {});
    assert.equal(session.beginNew(), true);
    assert.equal(session.state, null);
    session.cancelNew();
    assert.equal(
      session.commitNew({
        configure: (state) => {
          state.playerName = "Yanlış";
        },
      }),
      false,
    );
    assert.equal(session.state, null);
    assert.equal(harness.writes.length, 0);

    assert.equal(session.beginNew(), true);
    assert.equal(
      session.commitNew({
        configure: (state) => {
          state.playerName = "Tarık";
        },
      }),
      true,
    );
    assert.equal(session.state.playerName, "Tarık");
    assert.equal(harness.writes.filter((key) => key.endsWith(".slot1")).length, 1);
    assert.equal(session.commitNew(), false, "final CTA cannot create the same run twice");
    assert.equal(harness.writes.filter((key) => key.endsWith(".slot1")).length, 1);
  } finally {
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
  }
});

test("all five games expose the universal menu before a game-specific setup", () => {
  const ctas = {
    apartman: "YÖNETİMİ DEVRAL",
    "kayip-telefon": "TELEFONU AÇ",
    "tc-sim-devlet": "DEVLETİ DEVRAL",
  };
  for (const id of gameIds) {
    const app = read(`public/games/${id}/app.js`);
    assert.match(app, /frontMenu\(/, `${id} must render the shared front menu`);
    assert.match(app, /bindFrontMenu\(/, `${id} must bind every front-menu control`);
    assert.match(app, new RegExp(ctas[id]), `${id} must have a final setup CTA`);
    assert.match(app, /global-chrome/, `${id} must mark duplicate iframe chrome for hiding`);
  }
});

test("Son 100 Gün separates scenario selection from final state creation", () => {
  const app = read("public/games/son-100-gun/pov-app.js");
  assert.match(app, /data-scenario="\$\{sc\.id\}"/);
  assert.match(app, /id="confirm-start" class="primary wide" \$\{setup\.scenario \? "" : "disabled"\}/);
  const pickBranch = app.slice(app.indexOf("} else if (d.scenario) {"), app.indexOf("} else if (d.slotPick) {"));
  assert.match(pickBranch, /setup\.scenario = d\.scenario/);
  assert.doesNotMatch(pickBranch, /createGame|persist\(/, "choosing a life must not start or save a game");
  const startBranch = app.slice(app.indexOf('} else if (el.id === "confirm-start") {'), app.indexOf("} else if (d.card && d.opt) {"));
  assert.match(startBranch, /G\.createGame\(setup\.scenario/);
  assert.match(startBranch, /if \(!setup\.scenario\) return;/);
});
