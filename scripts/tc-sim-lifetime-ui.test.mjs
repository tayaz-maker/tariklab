import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, normalizeEducationCareer } from "../public/games/tc-sim/js/state.js";
import { saveGame, loadGame } from "../public/games/tc-sim/js/save.js";
import { advanceWeek, applyDecision } from "../public/games/tc-sim/js/time.js";
import { getMonthlySummary } from "../public/games/tc-sim/js/life.js";
import {
  activateNextEvent,
  getEventDefinition,
  getEventChoiceAvailability,
  resolveEvent,
} from "../public/games/tc-sim/js/events.js";
import { NAVIGATION_ITEMS } from "../public/games/tc-sim/js/navigation.js";
import { createSocialObligation } from "../public/games/tc-sim/js/social.js";
import { settleHouseholdEvents } from "./tc-sim-longrun.mjs";

// Minimal DOM boundary double, not a browser or an alternate UI implementation.
// app.js renders the real markup and installs the real event handlers here.
let serial = 0;
async function mount(state) {
  const storage = { data: new Map(), getItem(k) { return this.data.get(k) ?? null; }, setItem(k, v) { this.data.set(k, v); }, removeItem(k) { this.data.delete(k); } };
  assert.equal(saveGame(storage, state).ok, true);
  const root = { _html: "", elements: [], set innerHTML(html) {
    this._html = html;
    this.elements = [...html.matchAll(/<(button|form)\b([^>]*)>/g)].map(m => {
      const attrs = Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], a[2]]));
      return { tag: m[1], attrs, disabled: /\sdisabled(?:\s|$)/.test(m[2]),
        dataset: Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith("data-")).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v])),
        listeners: {}, addEventListener(event, fn) { this.listeners[event] = fn; } };
    });
  }, get innerHTML() { return this._html; } };
  const matches = (e, selector) => selector.startsWith("#") ? e.attrs.id === selector.slice(1) : selector.startsWith("[") && Object.hasOwn(e.attrs, selector.slice(1, -1));
  const document = { querySelector(selector) { return selector === "#app" ? root : root.elements.find(e => matches(e, selector)) || null; }, querySelectorAll(selector) { return root.elements.filter(e => matches(e, selector)); } };
  globalThis.document = document; globalThis.localStorage = storage; globalThis.window = { confirm: () => true };
  await import(`../public/games/tc-sim/js/app.js?routing-test=${++serial}`);
  const click = element => { assert.ok(element); assert.equal(element.disabled, false); assert.ok(element.listeners.click); element.listeners.click(); };
  click(document.querySelector("#continue-game"));
  return { root, storage, document, click, find: (key, value) => root.elements.find(e => e.dataset[key] === value), saved: () => loadGame(storage).state };
}

test("all twelve real UI screens render with routed controls; moving/saving/week actions persist once", async () => {
  const state = createNewGame({ now: "2027-01-01T00:00:00Z" }); state.finances.balance = 50000;
  const ui = await mount(state);
  const inventory = {};
  for (const nav of NAVIGATION_ITEMS) {
    ui.click(ui.find("view", nav.view));
    assert.equal(ui.find("view", nav.view).attrs["aria-current"], "page", `${nav.label}: click did not activate its real view`);
    const buttons = ui.root.elements.filter(e => e.tag === "button");
    inventory[nav.view] = buttons.length;
    for (const b of buttons) assert.ok(b.disabled || b.listeners.click || b.attrs.type === "submit", `${nav.view}: unrouted ${JSON.stringify(b.attrs)}`);
    for (const f of ui.root.elements.filter(e => e.tag === "form")) assert.ok(f.listeners.submit);
  }
  ui.click(ui.find("view", "home"));
  const move = ui.find("moveHome", "shared");
  ui.click(move);
  const moved = ui.saved();
  assert.equal(moved.household.homeId, "shared"); assert.equal(moved.weekly.used, 2);
  move.listeners.click(); // A stale double-click must not charge again.
  assert.equal(ui.saved().finances.balance, moved.finances.balance);
  ui.click(ui.document.querySelector("#save-game"));
  assert.equal(ui.saved().household.homeId, "shared");
  ui.click(ui.find("view", "dashboard"));
  ui.click(ui.document.querySelector("#advance-week"));
  assert.equal(ui.saved().time.absoluteWeek, state.time.absoluteWeek + 1);
  assert.match(ui.root.innerHTML, /GEÇEN HAFTA/);
  ui.click(ui.document.querySelector("#save-game"));
  assert.match(ui.root.innerHTML, /GEÇEN HAFTA/);
  console.log("UI_CONTROL_INVENTORY", JSON.stringify(inventory));
});

test("actual terminal successor click restores normal UI and writes one new generation", async () => {
  const s = createNewGame({ now: "2027-01-01T00:00:00Z" });
  s.player.age = 98;
  s.time.absoluteWeek = 3841;
  s.time.year = 2107;
  s.parenthood.children = [
    {
      id: "heir",
      name: "Yeni Oyuncu",
      bornWeek: 100,
      otherParentId: "elif",
      livesWithPlayer: false,
    },
  ];
  normalizeEducationCareer(s);
  settleHouseholdEvents(s);
  advanceWeek(s);
  const ui = await mount(s);
  assert.equal(ui.document.querySelector("#advance-week"), null);
  assert.equal(ui.find("view", "career"), undefined);
  const successor = ui.find("successor", "heir");
  ui.click(successor);
  assert.equal(ui.saved().player.name, "Yeni Oyuncu");
  assert.equal(ui.saved().lifetime.generation, 2);
  const money = ui.saved().finances.balance;
  successor.listeners.click();
  assert.equal(ui.saved().lifetime.generation, 2);
  assert.equal(ui.saved().finances.balance, money);
  assert.ok(ui.find("view", "career"));
  ui.click(ui.document.querySelector("#save-game"));
  assert.equal(ui.saved().lifetime.reports.length, 1);
});

test("new-game storage failure leaves the real current UI and save intact", async () => {
  const ui = await mount(createNewGame());
  ui.storage.removeItem = () => {
    throw new Error("storage blocked");
  };
  ui.click(ui.document.querySelector("#new-game"));
  assert.match(ui.root.innerHTML, /Eski kayıt silinemedi/);
  assert.ok(ui.document.querySelector("#advance-week"));
  assert.equal(ui.saved().player.name, "Deniz");
});

test("real employment and education click handlers preserve costs and delayed job start", async () => {
  const state = createNewGame();
  state.finances.balance = 50000;
  state.career.jobId = null;
  const ui = await mount(state);
  ui.click(ui.find("view", "career"));
  ui.click(ui.find("jobOffer", "office"));
  assert.equal(ui.saved().career.jobId, null);
  assert.equal(ui.saved().career.pendingJob.jobId, "office");
  ui.click(ui.document.querySelector("#advance-week"));
  for (let i = 0; i < 80 && ui.saved().events.active; i++) {
    const button = ui.root.elements.find((e) => e.dataset.eventChoice && !e.disabled);
    ui.click(button);
  }
  assert.equal(ui.saved().career.jobId, "office");
  ui.click(ui.find("view", "career"));
  ui.click(ui.document.querySelector("#quit-job"));
  assert.equal(ui.saved().career.jobId, null);
  ui.click(ui.find("view", "education"));
  const enroll = ui.find("enroll", "university");
  const balance = ui.saved().finances.balance;
  ui.click(enroll);
  assert.equal(ui.saved().education.active.pathId, "university");
  assert.equal(ui.saved().finances.balance, balance - 3000);
  enroll.listeners.click();
  assert.equal(ui.saved().finances.balance, balance - 3000);
  ui.click(ui.document.querySelector("#stop-education"));
  assert.equal(ui.saved().education.active, null);
});

test("calendar, relationship and Body controls use real state and persist feedback", async () => {
  const state = createNewGame();
  state.finances.balance = 50000;
  assert.equal(createSocialObligation(state, "mehmet"), true);
  const ui = await mount(state);

  ui.click(ui.find("view", "calendar"));
  assert.match(ui.root.innerHTML, /Verilen yardım sözü/);

  const before = ui.saved().relationships.mehmet;
  ui.click(ui.find("view", "people"));
  ui.click(ui.find("socialAction", "meet"));
  assert.ok(ui.saved().relationships.mehmet > before);
  assert.equal(ui.saved().weekly.used, 1);

  const health = ui.saved().health.health;
  ui.click(ui.find("view", "dashboard"));
  ui.click(ui.find("decision", "exercise"));
  assert.ok(ui.saved().health.health >= health);
  assert.equal(ui.saved().weekly.used, 2);
  ui.click(ui.find("view", "body"));
  assert.match(ui.root.innerHTML, /Fiziksel ve zihinsel durum/);
});

test("real retirement event click disables work actions and persists pension without duplicate retirement", async () => {
  const s = createNewGame();
  s.player.age = 62;
  s.time.absoluteWeek = 2113;
  s.time.year = 2071;
  s.career.jobFamilyExperience = { hizmet: 1200 };
  s.finances.balance = 50000;
  applyDecision(s, "rest");
  activateNextEvent(s);
  for (let i = 0; i < 80 && s.events.active?.eventId !== "retirement_planning"; i++) {
    const d = getEventDefinition(s.events.active?.eventId);
    assert.ok(d);
    const choice = d.choices.find((c) => getEventChoiceAvailability(s, c.id).ok);
    resolveEvent(s, choice.id);
  }
  assert.equal(s.events.active?.eventId, "retirement_planning");
  resolveEvent(s, "plan");
  for (let i = 0; i < 16 && s.events.active?.eventId !== "retirement_transition"; i++) {
    for (
      let j = 0;
      j < 80 && s.events.active && s.events.active.eventId !== "retirement_transition";
      j++
    ) {
      const d = getEventDefinition(s.events.active.eventId);
      resolveEvent(s, d.choices.find((c) => getEventChoiceAvailability(s, c.id).ok).id);
    }
    if (s.events.active?.eventId !== "retirement_transition") advanceWeek(s);
  }
  assert.equal(s.events.active?.eventId, "retirement_transition");
  const ui = await mount(s);
  ui.click(ui.find("eventChoice", "retire"));
  assert.equal(ui.saved().career.retirement.status, "retired");
  assert.equal(ui.saved().career.jobId, null);
  assert.ok(ui.saved().career.retirement.monthlyIncome > 0);
  ui.click(ui.find("view", "career"));
  for (const b of ui.root.elements.filter(
    (e) => e.dataset.jobOffer || e.dataset.decision === "overtime",
  ))
    assert.equal(b.disabled, true);
});

test("wealth controls route through real domain state, persist, and stale clicks cannot duplicate purchases", async () => {
  const s = createNewGame();
  s.finances.balance = 1000000;
  const ui = await mount(s);
  ui.click(ui.find("view", "finance"));
  assert.match(ui.root.innerHTML, /Net servet/);
  assert.match(ui.root.innerHTML, /YATIRIMLAR/);
  const subscription = ui.find("wealthAction", "subscription");
  ui.click(subscription);
  assert.equal(ui.saved().wealth.subscriptions.length, 1);
  const before = ui.saved().finances.balance;
  ui.click(ui.find("view", "market"));
  const durable = ui.find("wealthAction", "durable");
  ui.click(durable);
  assert.equal(ui.saved().wealth.durables.length, 1);
  assert.ok(ui.saved().finances.balance < before);
  const charged = ui.saved().finances.balance;
  durable.listeners.click();
  assert.equal(ui.saved().finances.balance, charged);
  ui.click(ui.find("view", "finance"));
  const owner = ui.root.elements.find(
    (e) => e.dataset.wealthAction === "property-owner" && e.dataset.wealthValue === "cash",
  );
  ui.click(owner);
  assert.equal(ui.saved().wealth.properties[0].occupancy, "owner");
  assert.equal(ui.saved().weekly.used, 2);
  assert.equal(getMonthlySummary(ui.saved()).housingBreakdown.base, 0);
});

test("wealth controls never look enabled when money, time, cooldown or ownership gates reject them", async () => {
  const s=createNewGame(); s.finances.balance=100;
  const ui=await mount(s); ui.click(ui.find("view","finance"));
  const high=ui.root.elements.find(e=>e.dataset.wealthAction==="lifestyle"&&e.dataset.wealthValue==="high");
  const property=ui.root.elements.find(e=>e.dataset.wealthAction==="property-owner"&&e.dataset.wealthValue==="cash");
  assert.equal(high.disabled,true); assert.match(high.attrs.title,/gerekiyor/);
  assert.equal(property.disabled,true); assert.match(property.attrs.title,/gerekiyor/);
  ui.click(ui.find("view","market"));
  const coffee=ui.root.elements.find(e=>e.dataset.wealthAction==="spend"&&e.dataset.wealthValue==="coffee");
  assert.equal(coffee.disabled,true); assert.match(coffee.attrs.title,/gerekiyor/);
});


test("normal creation screen exposes the canonical 2017 option and its real submit saves age/date", async () => {
  const ui = await mount(createNewGame());
  ui.click(ui.document.querySelector("#main-menu"));
  ui.click(ui.document.querySelector("#show-creation-form"));
  const select = ui.root.innerHTML.match(/<select name="eraId">([\s\S]*?)<\/select>/)[1];
  for (const id of ["present_day", "1999-04-18", "2017-04-18", "1980s"]) assert.ok(select.includes(`value="${id}"`), id);
  const OriginalFormData = globalThis.FormData;
  globalThis.FormData = class { get(key) { return ({ name: "2017 QA", eraId: "2017-04-18", profile: "balanced" })[key] || null; } };
  try {
    const form = ui.document.querySelector("#new-game-form");
    form.listeners.submit({ preventDefault() {}, currentTarget: form });
  } finally { globalThis.FormData = OriginalFormData; }
  assert.equal(ui.saved().time.date, "2017-04-18");
  assert.equal(ui.saved().player.birthDate, "1999-04-18");
  assert.equal(ui.saved().player.age, 18);
  assert.ok(ui.root.innerHTML.includes("18 Nisan 2017"));
});
