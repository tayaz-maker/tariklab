// Wave 1: exercise the real POV event handlers/storage boundary and phone renderer.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as G from "../public/games/son-100-gun/pov.js";
import * as POV from "../public/games/son-100-gun/pov-data.js";
import * as Phone from "../public/games/next-wave.js";
import { THREADS } from "../public/games/next-wave/kayip-data.js";
import { pick, play } from "./son100-pov-policies.mjs";

const copy = (value) => JSON.parse(JSON.stringify(value));
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const withoutImports = (text) => text.replace(/^import[\s\S]*?;\n/gm, "");
const slotKey = (n) => `${G.SAVE_PREFIX}.slot${n}`;
const messages = {
  tr: { error: "Kayıt başarısız.", unsaved: "Bu oyun henüz kaydedilmedi.", retry: "Tekrar kaydet", deleted: "Kayıt silinemedi.", day: (d) => `Son kayıt: gün ${d}.` },
  en: { error: "Save failed.", unsaved: "This game has not been saved yet.", retry: "Retry save", deleted: "Could not delete the save.", day: (d) => `Last saved: day ${d}.` },
  pl: { error: "Zapis nie powiódł się.", unsaved: "Ta gra nie została jeszcze zapisana.", retry: "Ponów zapis", deleted: "Nie udało się usunąć zapisu.", day: (d) => `Ostatni zapis: dzień ${d}.` },
};

function povApp(language = "en", saved = []) {
  const values = new Map(saved);
  const faults = { get: null, set: null, remove: null };
  const writes = [];
  const handlers = {};
  const root = { innerHTML: "", addEventListener: (type, fn) => { handlers[type] = fn; }, querySelector: () => null };
  const fail = (name) => { if (name) throw Object.assign(new Error(name), { name }); };
  const storage = {
    getItem: (key) => { fail(faults.get); return values.get(key) ?? null; },
    setItem: (key, value) => { writes.push({ key, value }); fail(faults.set); values.set(key, value); },
    removeItem: (key) => { fail(faults.remove); values.delete(key); },
  };
  const context = vm.createContext({
    G, ...POV, localStorage: storage,
    document: { querySelector: () => root, documentElement: {}, body: { dataset: {} } },
    window: { tlabI18n: { getLang: () => language, onLang() {} }, addEventListener() {}, scrollTo() {} },
  });
  vm.runInContext(`${withoutImports(source("public/games/son-100-gun/pov-app.js"))}\nglobalThis.state = () => game;`, context);
  const click = (id = "", dataset = {}) => handlers.click({ target: { closest: () => ({ id, dataset, disabled: false }) } });
  const start = (n = 1) => {
    click("menu-new");
    click("", { scenario: POV.SCENARIOS[0].id });
    click("", { slotPick: String(n) });
    click("confirm-start");
  };
  const decide = () => {
    const [card, opt] = pick(context.state(), "first");
    click("", { card, opt });
    click("commit");
  };
  return { values, faults, writes, root, click, start, decide, state: context.state,
    saveHtml: () => root.innerHTML.match(/<details class="save-menu"[\s\S]*?<\/details>/)?.[0] ?? "" };
}

for (const language of ["tr", "en", "pl"]) {
  for (const failure of ["QuotaExceededError", "SecurityError"]) {
    test(`S100: ${language} first-save ${failure} is visibly unsaved and retryable`, () => {
      const app = povApp(language);
      app.faults.set = failure;
      app.start();
      const html = app.saveHtml();
      assert.ok(html.includes(messages[language].error), "failed storage must show a localized error");
      assert.ok(html.includes(messages[language].unsaved));
      assert.ok(html.includes(messages[language].retry));
      assert.match(html, /role="alert"/);
      assert.match(html, /data-save-retry/);
      assert.ok(!html.includes(messages[language].day(app.state().day)), "an unwritten day must not be advertised as saved");
      assert.equal(app.values.has(slotKey(1)), false);
    });
  }

  test(`S100: ${language} failed autosave retains the real saved day and exact old payload`, () => {
    const original = G.serialize(G.createGame(POV.SCENARIOS[0].id, 101));
    const app = povApp(language, [[slotKey(2), original]]);
    app.click("", { load: "2" });
    const savedDay = app.state().day;
    app.faults.set = "QuotaExceededError";
    app.decide();
    assert.ok(app.state().day > savedDay);
    const html = app.saveHtml();
    assert.ok(html.includes(messages[language].day(savedDay)), "show the last actual write, not current gameplay day");
    assert.ok(!html.includes(messages[language].day(app.state().day)));
    assert.ok(html.includes(messages[language].error));
    assert.equal(app.values.get(slotKey(2)), original);
  });

  test(`S100: ${language} failed delete remains actionable and keeps the save`, () => {
    const original = G.serialize(G.createGame(POV.SCENARIOS[0].id, 102));
    const app = povApp(language, [[slotKey(1), original]]);
    app.faults.remove = "SecurityError";
    app.click("", { del: "1" });
    app.click("", { delYes: "1" });
    assert.ok(app.root.innerHTML.includes(messages[language].deleted), "deletion failure must be visible");
    assert.match(app.root.innerHTML, /data-del-yes="1"/);
    assert.equal(app.values.get(slotKey(1)), original);
    app.faults.remove = null;
    app.click("", { delYes: "1" });
    assert.equal(app.values.has(slotKey(1)), false);
    assert.ok(!app.root.innerHTML.includes(messages[language].deleted));
  });
}

test("S100: retry writes the current serialized state without repeating the decision", () => {
  const app = povApp();
  app.start();
  app.faults.set = "QuotaExceededError";
  app.decide();
  const pending = G.serialize(app.state());
  const previous = app.values.get(slotKey(1));
  const attempts = app.writes.length;
  app.click("", { saveRetry: "" });
  assert.equal(app.writes.length, attempts + 1, "retry must attempt storage again");
  assert.equal(app.values.get(slotKey(1)), previous);
  assert.equal(G.serialize(app.state()), pending);
  assert.ok(app.saveHtml().includes(messages.en.error));
  app.faults.set = null;
  app.click("", { saveRetry: "" });
  assert.equal(app.values.get(slotKey(1)), pending);
  assert.equal(G.serialize(app.state()), pending, "retry must not reapply choose()");
  assert.ok(!app.saveHtml().includes(messages.en.error));
  assert.ok(app.saveHtml().includes(messages.en.day(app.state().day)));
  const reloaded = povApp("en", [...app.values]);
  reloaded.click("", { load: "1" });
  assert.equal(G.serialize(reloaded.state()), pending);
});

test("S100: failed new game overwrite does not present the previous run as this run's save", () => {
  const old = play(POV.SCENARIOS[0].id, 301, "warm");
  const original = G.serialize(old);
  const legacyKey = "tariklab.nextwave.son-100-gun.slot1";
  const app = povApp("en", [[slotKey(1), original], [legacyKey, "legacy payload"]]);
  app.click("", { load: "1" });
  app.faults.set = "QuotaExceededError";
  app.start(1);
  assert.ok(app.saveHtml().includes(messages.en.unsaved));
  assert.ok(!app.saveHtml().includes(messages.en.day(old.day)));
  assert.equal(app.values.get(slotKey(1)), original);
  assert.equal(app.values.get(legacyKey), "legacy payload");
});

test("S100: successful writes preserve compact format and independent old slots, including endings", () => {
  const ending = G.serialize(play(POV.SCENARIOS[0].id, 302, "warm"));
  const another = G.serialize(G.createGame(POV.SCENARIOS[1].id, 303));
  const app = povApp("en", [[slotKey(1), ending], [slotKey(2), another]]);
  app.start(3);
  app.decide();
  assert.equal(app.values.get(slotKey(1)), ending);
  assert.equal(app.values.get(slotKey(2)), another);
  assert.equal(app.values.get(slotKey(3)), G.serialize(app.state()));
  const restored = povApp("en", [...app.values]);
  restored.click("", { load: "1" });
  assert.ok(restored.state().ending);
  assert.equal(G.serialize(restored.state()), ending);
  assert.ok(restored.saveHtml().includes(messages.en.day(restored.state().day)));
  restored.click("", { go: "menu" });
  restored.click("", { load: "2" });
  assert.equal(G.serialize(restored.state()), another);
});

// Run the actual phone renderer too: an invalid app previously crashed appCopy[active][0].
function renderPhone(state) {
  const root = { innerHTML: "", querySelectorAll: () => [], querySelector: () => null };
  let draw;
  const context = vm.createContext({
    ...Phone, THREADS, HELP_SECTIONS: [], document: { body: root }, window: {},
    bootGame: (_id, render) => { draw = render; },
    bindFrontMenu() {}, bindSavePanel() {}, frontMenu: () => "", savePanel: () => "", helpPanel: () => "",
    h: (value) => String(value ?? ""), t: (_tr, en) => en,
    loc: (value) => typeof value === "object" ? value?.en ?? value?.tr ?? "" : value,
  });
  vm.runInContext(withoutImports(source("public/games/kayip-telefon/app.js")), context);
  draw({ state, notice: "" });
  return root.innerHTML;
}

function phoneProgress(version = 2) {
  const state = Phone.createPhoneState(76543);
  for (const id of ["photo_ticket", "cal_bus", "photo_cafe", "cal_naz"])
    Phone.applyAction("kayip-telefon", state, `discover:${id}`);
  Phone.applyAction("kayip-telefon", state, "link:photo_ticket:cal_bus");
  Phone.applyAction("kayip-telefon", state, "pin:photo_ticket");
  Phone.applyAction("kayip-telefon", state, "theory:what:planned");
  state.meta.version = version;
  return state;
}

const gameplay = (state) => { const out = copy(state); delete out.ui; return out; };
for (const version of [1, 2]) {
  test(`PHONE: v${version} corrupt UI app recovers real progress and renders`, () => {
    const original = phoneProgress(version);
    const expected = Phone.normalize("kayip-telefon", copy(original));
    for (const app of ["not-a-real-app", "toString", "constructor", {}, [], 42]) {
      const damaged = copy(original);
      damaged.ui = { app, caseTab: "invalid", linkFrom: "nonexistent-evidence" };
      const restored = Phone.normalize("kayip-telefon", damaged);
      assert.ok(restored, "recoverable UI corruption must not discard a playable save");
      assert.doesNotThrow(() => renderPhone(restored), "normalized save must reach the actual renderer");
      assert.equal(restored.ui.app, "messages");
      assert.equal(restored.ui.caseTab, "evidence");
      assert.equal(restored.ui.linkFrom, null);
      assert.deepEqual(gameplay(restored), gameplay(expected));
      assert.deepEqual(Phone.normalize("kayip-telefon", copy(restored)), restored, "repair must be stable on reload");
    }
  });

  test(`PHONE: v${version} known but locked apps and undiscovered links are normalized`, () => {
    const damaged = phoneProgress(version);
    const locked = Phone.APPS.find((id) => !damaged.unlockedApps.includes(id));
    assert.ok(locked);
    damaged.ui.app = locked;
    damaged.ui.caseTab = "bad-tab";
    damaged.ui.linkFrom = "file_scan";
    const expected = gameplay(Phone.normalize("kayip-telefon", copy(damaged)));
    const restored = Phone.normalize("kayip-telefon", damaged);
    assert.equal(restored.ui.app, "messages");
    assert.equal(restored.ui.caseTab, "evidence");
    assert.equal(restored.ui.linkFrom, null);
    assert.deepEqual(gameplay(restored), expected);
    assert.match(renderPhone(restored), /class="phone-screen"/);
  });

  test(`PHONE: v${version} legal UI selections and terminal progress survive reload`, () => {
    const original = phoneProgress(version);
    original.ui = { app: "contacts", screen: "Rehber", caseTab: "theory", linkFrom: "photo_ticket" };
    const restored = Phone.normalize("kayip-telefon", copy(original));
    assert.deepEqual(restored.ui, original.ui);
    assert.match(renderPhone(restored), /class="theory-list"/);
    Phone.applyAction("kayip-telefon", restored, "return");
    const terminal = Phone.normalize("kayip-telefon", copy(restored));
    assert.ok(terminal.flags.ending);
    assert.deepEqual(gameplay(terminal), gameplay(restored));
    assert.match(renderPhone(terminal), /class="case-report"/);
  });
}

test("PHONE: unrecoverable game data is rejected rather than silently treated as recovered", () => {
  for (const corrupt of [
    (s) => { s.discoveredItems.push("unknown-evidence"); },
    (s) => { s.discoveredItems = {}; },
    (s) => { s.history = null; },
    (s) => { s.privacyPressure = "broken"; },
    (s) => { s.meta.id = "apartman"; },
    (s) => { s.meta.version = 99; },
  ]) {
    const damaged = phoneProgress();
    corrupt(damaged);
    assert.equal(Phone.normalize("kayip-telefon", damaged), null);
  }
});
