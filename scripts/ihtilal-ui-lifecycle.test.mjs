import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as decks from "../public/games/ihtilal/decks.js";
import * as engine from "../public/games/ihtilal/engine.js";
import * as ai from "../public/games/ihtilal/ai.js";
import * as copy from "../public/games/ihtilal/copy.js";
import * as save from "../public/games/ihtilal/save.js";
import * as report from "../public/games/ihtilal/report.js";
import * as briefing from "../public/games/ihtilal/briefing.js";
import * as rng from "../public/games/ihtilal/rng.js";

const source = readFileSync(new URL("../public/games/ihtilal/app.js", import.meta.url), "utf8");

// Execute the real UI handlers with its real engine/save modules and controlled timers.
// The DOM fixture models only operations used by this vanilla app; it is not browser QA.
function mount(slots = [], lang = "en", initialData = []) {
  let document;
  class Node {
    constructor(tag, text = "") { this.tag = tag; this.text = text; this.children = []; this.attrs = {}; this.events = {}; }
    append(...children) { children.forEach(child => { child.parentElement = this; }); this.children.push(...children); }
    replaceChildren(...children) {
      if (this.contains(document.activeElement)) document.activeElement = document.body;
      this.children.forEach(child => { child.parentElement = null; });
      this.children = []; this.append(...children);
    }
    setAttribute(key, value) { this.attrs[key] = value; }
    getAttribute(key) { return this.attrs[key] ?? null; }
    addEventListener(key, handler) { this.events[key] = handler; }
    get textContent() { return this.text + this.children.map(child => child.textContent).join(""); }
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    matches(selector) {
      if (selector.includes(":not([disabled])") && Object.hasOwn(this.attrs, "disabled")) return false;
      const plain = selector.replace(":not([disabled])", "");
      const tag = plain.match(/^[a-z]+/)?.[0];
      if (tag && this.tag !== tag) return false;
      const className = plain.match(/^\.([\w-]+)/)?.[1];
      if (className && !this.className?.split(" ").includes(className)) return false;
      return [...plain.matchAll(/\[([\w-]+)(?:=['"]([^'"]+)['"])?\]/g)]
        .every(([, key, value]) => value == null ? Object.hasOwn(this.attrs, key) : this.attrs[key] === value);
    }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [child, ...child.querySelectorAll("*")])
        .filter(node => selector.split(",").some(part => node.matches(part.trim())));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    focus() { document.activeElement = this; }
  }
  const data = new Map([["tariklab.language", lang], ...initialData]);
  let quota = false;
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem(key, value) { if (quota) throw new Error("QuotaExceededError"); data.set(key, value); },
    removeItem: key => data.delete(key),
  };
  slots.forEach((state, index) => { assert.equal(save.saveSlot(storage, index + 1, state).ok, true); });
  const root = new Node("root");
  document = { querySelector: () => root, createElement: tag => new Node(tag), createTextNode: text => new Node("#text", text), documentElement: {}, body: new Node("body") };
  document.activeElement = document.body;
  const listeners = new Map();
  const scrolls = [];
  const pending = new Map(), callbacks = new Map();
  let timerId = 0;
  vm.runInNewContext(source.replace(/^import .*;\n/gm, ""), {
    ...decks, ...engine, ...ai, ...copy, ...save, ...report, ...rng, ...briefing, Node, localStorage: storage,
    document,
    window: { addEventListener(key, handler) { const handlers = listeners.get(key) || []; handlers.push(handler); listeners.set(key, handlers); }, matchMedia: () => ({ matches: false }), confirm: () => true, scrollTo: (...args) => scrolls.push(args) },
    setTimeout(callback) { const id = ++timerId; pending.set(id, callback); callbacks.set(id, callback); return id; },
    clearTimeout(id) { pending.delete(id); },
  }, { filename: "ihtilal/app.js" });
  const walk = node => [node, ...node.children.flatMap(walk)];
  const inert = node => !!node && (node.inert || inert(node.parentElement));
  const click = (label, index = 0, force = false) => {
    const node = walk(root).filter(n => n.tag === "button" && n.textContent === label)[index];
    assert.ok(node, `button: ${label} (${index})`);
    assert.ok(!Object.hasOwn(node.attrs, "disabled"), `enabled button: ${label}`);
    if (!force) assert.ok(!inert(node), `interactive button: ${label}`);
    node.focus();
    node.events.click({ target: node });
  };
  return {
    pending,
    click,
    data,
    node: selector => root.querySelector(selector),
    resume: () => save.deserialize(data.get("tariklab.ihtilal.v1.resume")),
    clickNode(selector) {
      const node = root.querySelector(selector);
      assert.ok(node, selector);
      assert.ok(!Object.hasOwn(node.attrs, "disabled"));
      node.focus();
      node.events.click({ target: node });
    },
    forceClick: label => click(label, 0, true),
    key(key, shiftKey = false) {
      let prevented = false;
      const event = { key, shiftKey, preventDefault() { prevented = true; } };
      (listeners.get("keydown") || []).forEach(handler => handler(event));
      if (key === "Tab" && !prevented) {
        const controls = root.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])").filter(node => !inert(node));
        const index = controls.indexOf(document.activeElement);
        controls[(index + (shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
      }
    },
    // Also deliver canceled callbacks deliberately: stale work must remain harmless.
    fire(id = pending.keys().next().value) { assert.ok(callbacks.has(id)); pending.delete(id); callbacks.get(id)(); },
    text: () => root.textContent,
    statuses: () => walk(root).filter(n => n.attrs.role === "status").map(n => n.textContent),
    stored: slot => save.loadSlot(storage, slot).state,
    setQuota: value => { quota = value; },
    focus: () => document.activeElement,
    dialogs: () => root.querySelectorAll('[role="dialog"]'),
    inert,
    listeners,
    scrolls,
    firstCardText: () => root.querySelector(".file-card")?.textContent,
    archText: index => root.querySelectorAll(".arch")[index]?.textContent,
    copy: copy.COPY[lang],
  };
}

test("IHTILAL screen transitions reset scroll while card selection and saving preserve it", () => {
  const app = mount();
  assert.equal(app.scrolls.length, 1);
  app.click(app.copy.newGame);
  assert.equal(app.scrolls.length, 2);
  app.click(app.copy.start);
  assert.equal(app.scrolls.length, 3);
  app.click(app.firstCardText());
  app.click(`${app.copy.save} 1`);
  assert.equal(app.scrolls.length, 3, "same-screen actions must not jump the viewport");
  app.click(app.copy.menu);
  assert.equal(app.scrolls.length, 4);
  app.click(app.copy.load);
  assert.equal(app.scrolls.length, 5);
  for (const position of app.scrolls) assert.deepEqual(position, [0, 0]);
});

test("IHTILAL selecting an archetype or hand card keeps keyboard focus on its replacement", () => {
  const app = mount();
  app.click(app.copy.newGame);
  app.click(app.archText(1));
  assert.equal(app.focus().attrs["aria-pressed"], "true");
  assert.equal(app.focus().attrs["data-focus-key"], `arch-you-${decks.ARCHETYPE_IDS[1]}`);
  app.click(app.archText(7), 1);
  assert.equal(app.focus().attrs["aria-pressed"], "true");
  assert.equal(app.focus().attrs["data-focus-key"], `arch-opp-${decks.ARCHETYPE_IDS[1]}`);
  app.click(app.copy.start);
  app.click(app.firstCardText());
  assert.equal(app.focus().attrs["aria-pressed"], "true");
  assert.match(app.focus().attrs["data-focus-key"], /^card-ITL-/);
});

test("IHTILAL help takes focus, traps Tab, closes with Escape and restores its replaced trigger", () => {
  const app = mount();
  for (let n = 0; n < 3; n++) {
    app.click(app.copy.how);
    assert.equal(app.dialogs().at(-1).attrs["aria-modal"], "true");
    assert.equal(app.focus().textContent, app.copy.helpTitle);
    assert.equal(app.focus().attrs.tabindex, "-1");
    app.key("Tab", n % 2 === 1);
    assert.equal(app.focus().textContent, app.copy.close);
    app.key("Tab", true);
    assert.equal(app.focus().textContent, app.copy.close);
    assert.throws(() => app.click(app.copy.newGame), /interactive button/);
    app.key("Escape");
    assert.equal(app.dialogs().length, 0);
    assert.equal(app.focus().textContent, app.copy.how);
    assert.equal(app.focus().attrs["data-focus-key"], "help");
    assert.ok(!app.inert(app.focus()));
  }
  assert.equal(app.listeners.get("keydown").length, 1, "rerenders do not accumulate listeners");
});

test("IHTILAL first run starts in one click with live guidance and no tutorial wall", () => {
  const app = mount();
  app.click(app.copy.tutorial);
  assert.equal(app.dialogs().length, 0);
  assert.ok(app.text().includes(app.copy.objective));
  assert.ok(app.text().includes(app.copy.firstHint));
  assert.ok(app.text().includes(app.copy.lockRule));
  app.clickNode(".suggested");
  const preview = app.node(".play-target");
  assert.ok(preview, "recommended card always has a legal concrete target");
  app.clickNode(".play-target");
  assert.ok(app.node('[data-feedback="human"]'));
  assert.ok(app.node(".change-chip"), "first action has numeric evidence");
  assert.equal(app.resume().ok, true);
  assert.ok(app.resume().state.log.some(row => row.k === "play" && row.a === 0));
});

test("IHTILAL help returns focus to the current hand during a guided match", () => {
  const app = mount();
  app.click(app.copy.tutorial);
  app.click(app.copy.how);
  assert.equal(app.dialogs().length, 1);
  assert.ok(!app.inert(app.dialogs()[0]));
  app.key("Escape");
  assert.equal(app.dialogs().length, 0);
  assert.equal(app.focus().attrs["data-focus-key"], "help");
  assert.ok(!app.inert(app.focus()));
});

test("IHTILAL a fresh document resumes the autosaved action without rerolling", () => {
  const app = mount();
  app.click(app.copy.tutorial);
  app.clickNode(".suggested");
  app.clickNode(".play-target");
  const expected = app.resume().state;
  const restored = mount([], "en", [...app.data]);
  restored.click(`${restored.copy.continue} · ${restored.copy.turn} ${expected.turn}`);
  restored.click(`${restored.copy.save} 1`);
  assert.deepEqual(restored.stored(1), expected);
  assert.ok(restored.text().includes(restored.copy.objective));
});

test("IHTILAL human feedback stays visible after the AI reply", () => {
  const app = mount();
  app.click(app.copy.tutorial);
  app.clickNode(".suggested");
  app.clickNode(".play-target");
  const humanResult = app.node('[data-feedback="human"]').textContent;
  if (!app.pending.size) app.click(app.copy.endKalem);
  const afterEnd = app.node('[data-feedback="human"]').textContent;
  for (let n = 0; n < 12 && app.pending.size; n++) app.fire();
  assert.equal(app.node('[data-feedback="human"]').textContent, afterEnd || humanResult);
  assert.ok(app.node('[data-feedback="ai"]'));
});

function aiPreterminal() {
  const state = engine.createMatch({ seed: 1, aiProfile: "adaptive" });
  for (let n = 0; n < 200 && !state.result; n++) {
    const actor = engine.actingPlayer(state);
    const actions = engine.legalActions(state, actor);
    const pick = ai.chooseAction(engine.publicView(state, actor), actions, "adaptive",
      rng.mulberry((state.meta.seed + state.turn * 997 + state.log.length * 13 + actor) >>> 0)) || actions.at(-1);
    const before = structuredClone(state);
    assert.equal(engine.applyAction(state, pick).ok, true);
    if (actor === 1 && state.result) return { before, final: state };
  }
  assert.fail("seed must reach a legal AI terminal action");
}

test("IHTILAL returning to menu cancels AI and a queued terminal callback cannot reopen the report", () => {
  const app = mount([aiPreterminal().before]);
  app.click(app.copy.load);
  const oldTimer = [...app.pending.keys()][0];
  assert.ok(oldTimer);
  app.click(app.copy.menu);
  assert.equal(app.pending.size, 0);
  const menu = app.text();
  app.fire(oldTimer);
  app.fire(oldTimer);
  assert.equal(app.text(), menu);
});

test("IHTILAL stale callbacks cannot mutate a new match or take over its AI queue", () => {
  const app = mount([aiPreterminal().before]);
  app.click(app.copy.load);
  const oldTimer = [...app.pending.keys()][0];
  app.click(app.copy.menu);
  app.click(app.copy.newGame);
  app.click(app.copy.start);
  app.click(app.copy.endKalem);
  app.click(`${app.copy.save} 1`);
  const before = app.stored(1);
  const timers = [...app.pending.keys()];
  assert.equal(timers.length, 1);
  app.fire(oldTimer);
  app.click(`${app.copy.save} 1`);
  assert.deepEqual(app.stored(1), before);
  assert.deepEqual([...app.pending.keys()], timers);
  app.fire(timers[0]);
  app.click(`${app.copy.save} 1`);
  assert.notDeepEqual(app.stored(1), before, "the current match's AI still acts");
});

test("IHTILAL stale callbacks cannot mutate a loaded match or clear its pending AI", () => {
  const next = engine.createMatch({ seed: 42, first: 1 });
  const app = mount([aiPreterminal().before, next]);
  app.click(app.copy.load);
  const oldTimer = [...app.pending.keys()][0];
  app.click(app.copy.menu);
  app.click(app.copy.load, 1);
  const timers = [...app.pending.keys()];
  assert.equal(timers.length, 1);
  app.fire(oldTimer);
  app.click(`${app.copy.save} 2`);
  assert.deepEqual(app.stored(2), next);
  assert.deepEqual([...app.pending.keys()], timers);
  app.fire(timers[0]);
  app.click(`${app.copy.save} 2`);
  assert.notDeepEqual(app.stored(2), next);
});

test("IHTILAL uninterrupted AI can still reach and render its terminal report", () => {
  const { before, final } = aiPreterminal();
  const app = mount([before]);
  app.click(app.copy.load);
  app.fire();
  assert.equal(app.pending.size, 0);
  app.click(`${app.copy.save} 1`);
  assert.deepEqual(app.stored(1), engine.normalize(final));
  assert.ok(app.text().includes(app.copy.again));
});

for (const lang of ["tr", "en"]) {
  test(`IHTILAL terminal save reports success and quota failure in ${lang}`, () => {
    const app = mount([aiPreterminal().final], lang);
    app.click(app.copy.load);
    app.click(`${app.copy.save} 1`);
    assert.ok(app.statuses().includes(app.copy.saved));
    const saved = app.stored(1);
    app.setQuota(true);
    app.click(`${app.copy.save} 1`);
    assert.ok(app.statuses().includes(app.copy.saveFail));
    assert.deepEqual(app.stored(1), saved, "failed save preserves the previous record");
  });
}

test("IHTILAL corrupt automatic continuation recovers its last valid backup", () => {
  const app = mount();
  app.click(app.copy.tutorial);
  app.clickNode(".suggested");
  app.clickNode(".play-target");
  const backup = save.deserialize(app.data.get("tariklab.ihtilal.v1.resume.backup"));
  assert.equal(backup.ok, true);
  app.data.set("tariklab.ihtilal.v1.resume", "{broken");
  const restored = mount([], "en", [...app.data]);
  restored.click(`${restored.copy.continue} · ${restored.copy.turn} ${backup.state.turn}`);
  restored.click(`${restored.copy.save} 1`);
  assert.deepEqual(restored.stored(1), backup.state);
});

test("IHTILAL automatic storage failure warns while leaving the match playable", () => {
  const app = mount();
  app.setQuota(true);
  app.click(app.copy.tutorial);
  assert.ok(app.statuses().includes(app.copy.autoSaveFail));
  app.clickNode(".suggested");
  app.clickNode(".play-target");
  assert.ok(app.node('[data-feedback="human"]'));
  assert.ok(app.statuses().includes(app.copy.autoSaveFail));
});
