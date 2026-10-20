import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as engine from "../public/games/amiral-batti/js/engine.js";
import { chooseShot } from "../public/games/amiral-batti/js/ai.js";

const STORE = "tariklab.amiral-batti.match";
const STATS = "tariklab.amiral-batti.stats";
const appSource = readFileSync(new URL("../public/games/amiral-batti/js/app.js", import.meta.url), "utf8")
  .replace(/import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";/g, "")
  .replace(/export\s*\{[^}]*\};?/g, "");

function harness(raw = null, { stats = null, lang = "tr" } = {}) {
  const store = new Map([["tariklab.language", lang]]);
  if (raw !== null) store.set(STORE, raw);
  if (stats !== null) store.set(STATS, stats);
  const elements = new Map();
  const timers = [];
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: id === "diff" ? "orta" : id === "mode" ? "cpu" : "",
      innerHTML: "", textContent: "", hidden: false, disabled: false,
      attributes: {}, setAttribute(k, v) { this.attributes[k] = v; },
      removeAttribute(k) { delete this.attributes[k]; },
      addEventListener() {}, showModal() {}, close() {},
    });
    return elements.get(id);
  }
  const context = vm.createContext({
    ...engine, chooseShot, console,
    document: { getElementById: element, addEventListener() {} },
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) },
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout() {},
  });
  context.window = { addEventListener() {}, tlabI18n: { getLang: () => lang } };
  vm.runInContext(appSource, context);
  return {
    store, element,
    run: (source) => vm.runInContext(source, context),
    flush() { while (timers.length) timers.shift()(); },
    get pending() { return timers.length; },
  };
}

function playing(difficulty = "orta") {
  const s = engine.createMatch({ seed: 42, difficulty });
  s.playerShips = engine.autoPlace(37).ships;
  engine.startMatch(s);
  return s;
}

const malformed = [
  ["missing fleets", { version: 1, phase: "place" }],
  ["null ship", { ...playing(), playerShips: [null] }],
  ["out of bounds", (() => { const s = playing(); s.playerShips[0].cells[0] = [10, 0]; return s; })()],
  ["bad shots", { ...playing(), playerShots: [] }],
  ["bad shot coordinate", { ...playing(), enemyShots: { "22,0": "miss" } }],
  ["bad hit", (() => { const s = playing(); s.playerShips[0].hits = ["9,99"]; return s; })()],
  ["bad log", { ...playing(), log: [null] }],
  ["unsupported version", { ...playing(), version: 2 }],
  ["nonfinite seed", { ...playing(), seed: null }],
  ["bad phase", { ...playing(), phase: "loading" }],
  ["inconsistent winner", { ...playing(), winner: "player" }],
];
for (const [name, saved] of malformed) test(`invalid ${name} cannot crash boot or replace stored bytes`, () => {
  const raw = JSON.stringify(saved);
  const h = harness(raw);
  assert.doesNotThrow(() => h.run("boot()"));
  assert.equal(h.run("state"), null);
  assert.equal(h.store.get(STORE), raw);
  assert.equal(h.element("place-bar").hidden, true);
  assert.ok(h.element("status").textContent.length > 20);
  h.run("cpuTurn()");
  h.run("onBoardClick('own', 0, 0)");
  assert.equal(h.store.get(STORE), raw);
});

test("unparseable primary is retained until an explicit new CPU game", () => {
  const h = harness("{");
  h.run("boot()");
  assert.equal(h.run("state"), null);
  assert.equal(h.store.get(STORE), "{");
  h.element("mode").value = "hotseat";
  h.run("newGame()");
  const saved = JSON.parse(h.store.get(STORE));
  assert.equal(saved.mode, "cpu");
  assert.equal(saved.phase, "place");
});

test("existing hotseat saves are explained and retained, never silently converted", () => {
  const s = playing(); s.mode = "hotseat";
  engine.playerShoot(s, 0, 0);
  const raw = JSON.stringify(s);
  for (const [lang, phrase] of [["tr", "Sırayla"], ["en", "Hotseat"], ["pl", "Hotseat"]]) {
    const h = harness(raw, { lang });
    h.run("boot()");
    assert.equal(h.run("state"), null);
    assert.equal(h.store.get(STORE), raw);
    assert.match(h.element("status").textContent, new RegExp(phrase));
    assert.equal(h.pending, 0);
  }
});

test("hotseat option is disabled and its status has all three languages", () => {
  const html = readFileSync(new URL("../public/games/amiral-batti/index.html", import.meta.url), "utf8");
  assert.match(html, /<option\b[^>]*value="hotseat"[^>]*disabled/);
  for (const lang of ["tr", "en", "pl"]) {
    const h = harness(null, { lang }); h.run("boot()");
    assert.equal(h.element("hotseat-option").disabled, true);
    assert.ok(h.element("hotseat-option").textContent.length > 15);
  }
});

for (const difficulty of engine.DIFFICULTIES) test(`${difficulty}: v1 placement and CPU turn reload preserve progress`, () => {
  const placement = engine.createMatch({ seed: 123, difficulty });
  placement.playerShips = engine.placeShip([], engine.FLEET[0], 0, 0, "h").ships;
  const p = harness(JSON.stringify(placement)); p.run("boot()");
  assert.equal(p.run("JSON.stringify(state)"), JSON.stringify(placement));
  const s = playing(difficulty);
  engine.playerShoot(s, 0, 0);
  const h = harness(JSON.stringify(s)); h.run("boot()");
  assert.equal(h.run("JSON.stringify(state)"), JSON.stringify(s));
  assert.equal(h.pending, 1);
  h.run("onBoardClick('enemy', 0, 1)");
  assert.equal(h.run("JSON.stringify(state)"), JSON.stringify(s));
  assert.equal(h.pending, 1);
  h.flush();
  const after = JSON.parse(h.store.get(STORE));
  assert.equal(after.log.length, 2);
  assert.equal(after.turn, "player");
  const bytes = h.store.get(STORE);
  h.run("cpuTurn()");
  assert.equal(h.store.get(STORE), bytes);
  const resumed = harness(bytes); resumed.run("boot()");
  assert.equal(resumed.pending, 0);
  assert.equal(resumed.run("JSON.stringify(state)"), bytes);
  resumed.run("onBoardClick('enemy', 0, 0)");
  assert.equal(resumed.store.get(STORE), bytes);
  assert.equal(resumed.pending, 0);
  const denied = engine.playerShoot(after, 0, 0);
  assert.equal(denied.ok, false);
});

test("v1 validation accepts every saved turn in complete CPU games without mutation", () => {
  function check(s, label) {
    const before = JSON.stringify(s);
    const saved = JSON.parse(before);
    assert.equal(engine.validateMatch(saved), true, label);
    assert.equal(JSON.stringify(saved), before);
  }
  for (const difficulty of engine.DIFFICULTIES) for (const seed of [1, 42, 0xffffffff]) {
    const s = engine.createMatch({ seed, difficulty });
    s.playerShips = engine.autoPlace(seed ^ 0xa5a5).ships;
    engine.startMatch(s);
    for (let r = 0; r < 10 && !s.winner; r++) for (let c = 0; c < 10 && !s.winner; c++) {
      engine.playerShoot(s, r, c);
      check(s, `${difficulty}/${seed}/player`);
      if (!s.winner) {
        const [rr, cc] = chooseShot(s, engine.lcg(s.seed + s.log.length * 7919 + 17));
        engine.applyEnemyShot(s, rr, cc);
        check(s, `${difficulty}/${seed}/cpu`);
      }
    }
    assert.ok(s.winner);
  }
});

test("valid terminal reload neither resumes CPU nor records the result twice", () => {
  const s = playing("kolay");
  for (let r = 0; r < 10 && !s.winner; r++) for (let c = 0; c < 10 && !s.winner; c++) {
    engine.playerShoot(s, r, c);
    if (!s.winner) {
      const [rr, cc] = chooseShot(s, engine.lcg(s.seed + s.log.length * 7919 + 17));
      engine.applyEnemyShot(s, rr, cc);
    }
  }
  assert.ok(s.winner);
  const stats = JSON.stringify({ win: 4, loss: 3 });
  const h = harness(JSON.stringify(s), { stats }); h.run("boot()"); h.flush();
  assert.equal(h.run("JSON.stringify(state)"), JSON.stringify(s));
  assert.equal(h.store.get(STATS), stats);
  assert.equal(h.pending, 0);
});

for (const stats of ["null", "[]", "7", '{"win":"oops","loss":-4}', '{"win":1e999,"loss":null}']) {
  test(`malformed stats ${stats} cannot pollute the next result`, () => {
    const h = harness(null, { stats });
    const loaded = JSON.parse(h.run("JSON.stringify(loadStats())"));
    assert.deepEqual(loaded, { win: 0, loss: 0 });
    h.run("state = createMatch(); state.winner = 'player'; recordEnd()");
    assert.deepEqual(JSON.parse(h.store.get(STATS)), { win: 1, loss: 0 });
  });
}
