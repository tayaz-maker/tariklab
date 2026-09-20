import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyAction, create, POLICIES_2002 } from "../public/games/next-wave.js";
import { createActionGate } from "../public/games/next-wave/shared/runtime.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const ids = ["apartman", "son-100-gun", "kayip-telefon", "tc-sim-devlet"];

test("each Next Wave game owns its controller and layout; the generic shell is retired", () => {
  const signatures = new Set();
  for (const id of ids) {
    const html = read(`public/games/${id}/index.html`);
    const app = read(`public/games/${id}/app.js`);
    const css = read(`public/games/${id}/style.css`);
    assert.match(html, /next-wave\/shared\/base\.css/);
    assert.match(html, /\.\/style\.css/);
    assert.match(html, /\.\/app\.js/);
    assert.doesNotMatch(html, /next-wave\.css|src="\.\.\/next-wave\.js"/);
    assert.doesNotMatch(app, /Yakında|JSON\.stringify\(state/);
    assert.ok(app.length > 3000, `${id} owns a real experience controller`);
    assert.ok(css.length > 1000, `${id} owns a real visual system`);
    signatures.add(css.match(/--accent:([^;]+)/)?.[1]);
  }
  assert.equal(signatures.size, 4);
  const engine = read("public/games/next-wave.js");
  assert.doesNotMatch(
    engine,
    /document\.body|DOMContentLoaded|function panelHtml|function render\(/,
  );
});

test("every experience exposes its signature loop and binds every primary control", () => {
  const contracts = {
    apartman: [
      "data-issue",
      "data-prepare",
      "data-proposal",
      'id="meeting"',
      'id="advance"',
      "session.act(`proposal:",
    ],
    "son-100-gun": ["data-scenario", "data-action", 'id="finish-day"', "session.act(`act:"],
    "kayip-telefon": [
      "data-app",
      "data-item",
      'id="return"',
      "session.act(`discover:",
      'session.act("return")',
    ],
    "tc-sim-devlet": [
      "data-screen",
      "data-policy",
      'id="advance"',
      "session.act(`policy:",
      'session.act("advance")',
    ],
  };
  for (const [id, needles] of Object.entries(contracts)) {
    const app = read(`public/games/${id}/app.js`);
    for (const needle of needles) assert.ok(app.includes(needle), `${id}: ${needle}`);
  }
});

test("shared action gate rejects a rapid duplicate without blocking the next deliberate action", () => {
  let now = 0;
  const enter = createActionGate(140, () => now);
  assert.equal(enter(), true);
  assert.equal(enter(), false);
  now = 141;
  assert.equal(enter(), true);
});

test("Apartman preparation, meeting, vote and weekly callback cannot be farmed", () => {
  const state = create("apartman");
  const issues = state.issues.slice(0, 3);
  for (const issue of issues) applyAction("apartman", state, `prepare:${issue.id}`);
  assert.equal(state.flags.prepared.length, 2);
  applyAction("apartman", state, "proposal:cheap-patch");
  const meetings = state.history.filter((row) => row.type === "meeting").length;
  const cash = state.finance.cash;
  applyAction("apartman", state, "proposal:durable-maintenance");
  assert.equal(state.history.filter((row) => row.type === "meeting").length, meetings);
  assert.equal(state.finance.cash, cash);
  for (let i = 0; i < 3; i += 1) applyAction("apartman", state, "advance");
  assert.equal(state.history.filter((row) => row.type === "callback").length, 1);
});

test("Son 100 Gün prices actions by focus, expiry and terminal final report", () => {
  const state = create("son-100-gun");
  applyAction("son-100-gun", state, "act:work");
  assert.equal(state.focusRemaining, 4);
  applyAction("son-100-gun", state, "act:rest");
  assert.equal(state.focusRemaining, 2);
  applyAction("son-100-gun", state, "act:pray");
  assert.equal(state.day, 2);
  assert.equal(state.focusRemaining, 8);
  for (let i = 0; i < 100; i += 1) applyAction("son-100-gun", state, "advance");
  const end = JSON.stringify(state.flags.report);
  applyAction("son-100-gun", state, "advance");
  assert.equal(JSON.stringify(state.flags.report), end);
});

test("Kayıp Telefon item discovery is atomic and the return ending is terminal", () => {
  const state = create("kayip-telefon");
  applyAction("kayip-telefon", state, "discover:clue_0");
  const pressure = state.privacyPressure;
  applyAction("kayip-telefon", state, "discover:clue_0");
  assert.equal(state.discoveredItems.length, 1);
  assert.equal(state.privacyPressure, pressure);
  applyAction("kayip-telefon", state, "return");
  const ending = state.flags.ending;
  applyAction("kayip-telefon", state, "discover:bank_sms");
  applyAction("kayip-telefon", state, "return");
  assert.equal(state.discoveredItems.length, 1);
  assert.equal(state.flags.ending, ending);
});

test("DEVLET prices policies against administrative capacity and has no actual-state UI leak", () => {
  const state = create("tc-sim-devlet");
  const [first, second, third] = POLICIES_2002;
  applyAction("tc-sim-devlet", state, `policy:${first.id}`);
  applyAction("tc-sim-devlet", state, `policy:${second.id}`);
  applyAction("tc-sim-devlet", state, `policy:${third.id}`);
  const count = state.history.filter((row) => row.type === "policy").length;
  assert.ok(count >= 2);
  assert.ok(state.flags.governanceUsed > 0);
  assert.ok(state.flags.governanceUsed <= state.flags.governanceCapacity);
  assert.ok(state.flags.bureaucraticFriction > 0);
  applyAction("tc-sim-devlet", state, "advance");
  assert.equal(state.flags.governanceUsed, 0);
  assert.equal(state.archive.length, 1);
  const app = read("public/games/tc-sim-devlet/app.js");
  assert.doesNotMatch(app, /state\.actual\./);
  for (const screen of [
    "home",
    "agenda",
    "economy",
    "policy",
    "institutions",
    "society",
    "foreign",
    "regions",
    "files",
    "history",
    "year",
    "periods",
  ]) {
    assert.ok(app.includes(`"${screen}"`), `DEVLET screen ${screen} is implemented`);
  }
});
