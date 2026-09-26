// Runtime contract tests of the real app.js + real simulation in a VM.
// The DOM, map renderer and storage are minimal fakes: these are NOT browser,
// layout, touch, IndexedDB, service-worker or offline-reload verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as campaign from '../public/games/hanedanian/campaign.js';
import * as engine from '../public/games/hanedanian/engine.js';
import * as data from '../public/games/hanedanian/data.js';
import * as world from '../public/games/hanedanian/world.js';
import * as orders from '../public/games/hanedanian/orders.js';
import * as mapintel from '../public/games/hanedanian/mapintel.js';
import { MAP_LAYERS } from '../public/games/hanedanian/map.js';
import { encodeSave, decodeSave } from '../public/games/hanedanian/save.js';

const html = readFileSync(new URL('../public/games/hanedanian/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/games/hanedanian/app.js', import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));

function createHarness() {
  const nodes = new Map(), documentListeners = {}, windowListeners = {};
  let sequence = 1000;
  class Node {
    constructor(id = '') {
      this.id = id; this.dataset = {}; this.style = {}; this.attributes = {};
      this.hidden = false; this.open = false; this.disabled = false; this.value = '';
      this.textContent = ''; this.tagName = 'DIV'; this.clientWidth = 1000; this.clientHeight = 700;
      this.listeners = {}; this.classes = new Set(); this._html = '';
      this.classList = {
        add: (...values) => values.forEach(value => this.classes.add(value)),
        remove: (...values) => values.forEach(value => this.classes.delete(value)),
        toggle: (value, force) => { const on = force ?? !this.classes.has(value); if (on) this.classes.add(value); else this.classes.delete(value); return on; },
        contains: value => this.classes.has(value),
      };
    }
    set innerHTML(value) {
      this._html = String(value);
      for (const match of this._html.matchAll(/\bid="([^"]+)"/g)) if (!nodes.has(match[1])) nodes.set(match[1], new Node(match[1]));
    }
    get innerHTML() { return this._html; }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key] ?? null; }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    contains(target) { return target === this; }
    closest(selector) { return selector === 'button' && this.tagName === 'BUTTON' ? this : selector === 'form' ? this.form ?? null : null; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    append() {}
    remove() {}
    click() {}
    insertAdjacentHTML(position, value) { this.innerHTML = position === 'afterbegin' ? value + this.innerHTML : this.innerHTML + value; }
  }
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(match[1], new Node(match[1]));
  const views = [...html.matchAll(/data-view="([^"]+)"/g)].map(match => { const node = new Node(); node.dataset.view = match[1]; return node; });
  const speeds = [...html.matchAll(/data-speed="([^"]+)"/g)].map(match => { const node = new Node(); node.dataset.speed = match[1]; return node; });
  const document = {
    hidden: false, activeElement: null, body: new Node('body'),
    getElementById: id => nodes.get(id) ?? null,
    createElement: () => new Node(),
    querySelectorAll: selector => selector === '[data-view]' ? views : selector === '[data-speed]' ? speeds : [],
    addEventListener(name, callback) { (documentListeners[name] ||= []).push(callback); },
  };
  class FakeSaveManager {
    constructor() { this.slots = {}; this.error = null; this.saveCalls = []; this.loaded = null; this.journal = null; this.lastSavedAt = null; this.available = true; }
    async init() { return { ok: true }; }
    status() { return { available: this.available, lastSavedAt: this.lastSavedAt, error: this.error, unsaved: false }; }
    async save(state, slot = 'auto') {
      this.saveCalls.push(slot);
      if (this.error) return { ok: false, message: this.error, code: 'storage' };
      if (slot === 'auto' && this.slots.auto) this.slots.previous = this.slots.auto;
      this.slots[slot] = { state: clone(state), savedAt: ++sequence };
      this.lastSavedAt = sequence;
      return { ok: true, slot, savedAt: sequence };
    }
    async list() {
      return Object.fromEntries(['auto', 'previous', 'manual'].map(slot => {
        const entry = this.slots[slot];
        return [slot, entry ? { valid: true, savedAt: entry.savedAt, worldSeed: entry.state.world.seed, gameTime: entry.state.time } : null];
      }));
    }
    async load(slot = 'auto') {
      const entry = this.slots[slot];
      return entry ? { ok: true, state: clone(entry.state), slot, savedAt: entry.savedAt } : { ok: false, code: 'empty', message: 'Kayıt yok.' };
    }
    export(state) { return encodeSave(clone(state), ++sequence); }
    async import(raw, slot = 'manual') {
      try { const { state } = decodeSave(raw); const saved = await this.save(state, slot); return saved.ok ? { ...saved, state } : saved; }
      catch (error) { return { ok: false, message: error.message, code: error.code }; }
    }
    checkpoint(state) { this.journal = clone(state); return { ok: true }; }
    legacySaves() { return []; }
    exportLegacy() { return '{}'; }
  }
  let map;
  const createMap = (_canvas, callbacks) => {
    map = {
      state: null, focusPoint: null, zoom: 'near', callbacks,
      setState(state) { this.state = state; },
      focus(x, y) { this.focusPoint = { x, y }; },
      setZoom(zoom) { this.zoom = zoom; callbacks.onViewChange({ mode: zoom }); },
      resize() {}, zoomBy() {},
      getView() { return { mode: this.zoom }; },
      getRenderer() { return this.renderer || 'canvas'; },
      setRenderer(renderer) { this.renderer = renderer; },
      select(x, y) { callbacks.onSelect(x === null || !this.state ? null : world.getTile(this.state.world, x, y)); },
    };
    return map;
  };
  class FakeFormData { constructor(form) { this.values = form.values; } get(key) { return this.values[key] ?? null; } }
  const window = { addEventListener(name, callback) { (windowListeners[name] ||= []).push(callback); } };
  const context = vm.createContext({
    ...engine, ...campaign, ...data, ...world, ...orders, ...mapintel, MAP_LAYERS, SaveManager: FakeSaveManager, createMap,
    getLang: () => 'tr', translate: value => String(value ?? ''), installLanguage: () => {},
    document, window, navigator: {}, console, FormData: FakeFormData,
    requestAnimationFrame: () => 0, setTimeout: (fn, ms) => { if (typeof fn === "function" && !ms) queueMicrotask(fn); return 1; }, clearTimeout: () => {},
    Blob, URL, MessageChannel, structuredClone,
  });
  let source = app.replace(/^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\s*/gm, '');
  const bootCall = source.lastIndexOf('\nboot().catch(');
  assert.ok(bootCall > 0, 'real app must retain its final boot invocation');
  source = source.slice(0, bootCall);
  assert.equal(/^import /m.test(source), false, 'test must inject all module imports');
  assert.equal(/^boot\(\)/m.test(source), false, 'test must not start a browser lifecycle');
  vm.runInContext(source + '\n;globalThis.__ui = { enterGame, render, setView, menu, help, newCampaign, showExport, showImport, expansionDialog, armyDialog, trainDialog, tradeDialog, diplomacyDialog, renderWelcome, continueGame, checkpoint, frame, boot, get state(){return state}, get saves(){return saves}, get view(){return view} };', context, { filename: 'hanedanian/app.js' });
  async function emit(name, target) { for (const callback of documentListeners[name] || []) await callback({ target, preventDefault() {} }); }
  async function click(dataset) { const target = new Node(); target.tagName = 'BUTTON'; target.dataset = dataset; await emit('click', target); }
  async function submit(id, values, dataset = {}) {
    assert.ok(nodes.has(id), `form ${id} must have been rendered by app.js`);
    const target = nodes.get(id); target.values = values; target.dataset = dataset; target.tagName = 'FORM';
    await emit('submit', target);
  }
  const state = engine.createGame({ seed: 'TL-UI-VM', size: 49, aiCount: 8, dynastyName: 'Sedir Hanedanı' });
  return { ui: context.__ui, nodes, document, documentListeners, windowListeners, map, state, click, submit, emit };
}

test('VM UI contract: real campaign enters and renders all five sections without runtime errors', async () => {
  const h = createHarness();
  await h.ui.enterGame(h.state);
  assert.equal(h.nodes.get('welcome').hidden, true);
  assert.match(h.nodes.get('resources').innerHTML, /Erzak|ERZAK/);
  assert.match(h.nodes.get('settlement-rail').innerHTML, /Başkent/);
  for (const section of ['map', 'settlement', 'army', 'council', 'dynasty']) {
    await h.click({ view: section });
    assert.equal(h.ui.view, section);
    if (section !== 'map') {
      assert.ok(h.nodes.get('section-view').innerHTML.length > 100);
      assert.doesNotMatch(h.nodes.get('section-view').innerHTML, /NaN|undefined|\[object Object\]/);
    }
  }
  assert.equal(engine.validateState(h.state).ok, true);
});

test('VM UI contract: cold boot renders the actual new campaign entry without requiring a save', async () => {
  const h = createHarness();
  await h.ui.boot();
  assert.equal(h.ui.state, null);
  assert.match(h.nodes.get('welcome-actions').innerHTML, /Yeni hanedan kur/);
  assert.doesNotMatch(h.nodes.get('welcome-actions').innerHTML, /Kampanyaya devam et/);
  await h.click({ action: 'help' });
  assert.match(h.nodes.get('dialog-body').innerHTML, /Sen bir hanedanın reisisin/);
});

test('VM UI contract: own, enemy, POI and empty map selections offer appropriate actions', async () => {
  const h = createHarness(); await h.ui.enterGame(h.state);
  const own = engine.getPlayerSettlements(h.state)[0], enemy = h.state.settlements.find(t => t.ownerId !== h.state.playerId);
  h.map.select(own.x, own.y); assert.match(h.nodes.get('inspector').innerHTML, /Yerleşimi yönet/);
  h.map.select(enemy.x, enemy.y); assert.match(h.nodes.get('inspector').innerHTML, /Garnizon ve depolar bilinmiyor/);
  assert.match(h.nodes.get('inspector').innerHTML, /Sefer hazırla/);
  const poi = h.state.world.tiles.find(tile => tile.poi && !tile.poi.ownerId);
  h.map.select(poi.x, poi.y); assert.match(h.nodes.get('inspector').innerHTML, /Noktayı bağla/);
  const empty = h.state.world.tiles.find(tile => !tile.poi && !engine.getSettlementAt(h.state, tile.x, tile.y));
  h.map.select(empty.x, empty.y); assert.match(h.nodes.get('inspector').innerHTML, /Buraya yerleş/);
  await h.click({ action: 'mark' }); assert.equal(h.state.settings.markers.length, 1);
  await h.click({ action: 'mark' }); assert.equal(h.state.settings.markers.length, 0);
  await h.click({ action: 'deselect' }); assert.match(h.nodes.get('inspector').innerHTML, /HARİTA REHBERİ/);
});

test('VM UI contract: actual build action pays costs, saves, renders queue and completes after time advances', async () => {
  const h = createHarness(); await h.ui.enterGame(h.state);
  const town = engine.getPlayerSettlements(h.state)[0], initial = town.buildings.farm;
  await h.click({ view: 'settlement' });
  assert.match(h.nodes.get('section-view').innerHTML, /data-build="farm"/);
  await h.click({ build: 'farm' });
  assert.equal(town.queue.length, 1);
  assert.match(h.nodes.get('section-view').innerHTML, /queue-item/);
  assert.ok(h.ui.saves.saveCalls.includes('auto'));
  const until = town.queue[0].completeAt;
  engine.dispatch(h.state, { type: 'setSpeed', speed: 12 });
  engine.advance(h.state, until + 1);
  h.ui.render();
  assert.equal(town.buildings.farm, initial + 1);
  assert.equal(engine.validateState(h.state).ok, true);
});

test('VM UI contract: expansion cost, troop training, diplomacy and trade forms use actual engine data', async () => {
  const h = createHarness(); await h.ui.enterGame(h.state);
  const town = engine.getPlayerSettlements(h.state)[0];
  const tile = h.state.world.tiles.find(t => Math.abs(t.x-town.x) <= 4 && Math.abs(t.y-town.y) <= 4 && !t.poi && !engine.getSettlementAt(h.state,t.x,t.y));
  h.map.select(tile.x, tile.y);
  h.ui.expansionDialog();
  const cost = engine.getExpansionCost(h.state);
  for (const [key, value] of Object.entries(cost)) assert.ok(h.nodes.get('dialog-body').innerHTML.includes(`${value} ${data.RESOURCES[key]?.label || 'Nüfuz'}`), `expansion preview must show ${key} cost ${value}`);
  h.ui.trainDialog('militia');
  await h.submit('train-form', { count: '2' }, { unit: 'militia' });
  assert.equal(town.queue.some(job => job.kind === 'train' && job.unit === 'militia' && job.count === 2), true);
  const enemy = h.state.factions.find(f => f.id !== h.state.playerId);
  h.ui.diplomacyDialog(enemy.id, 'gift');
  assert.match(h.nodes.get('dialog-body').innerHTML, /Hediye gönder/);
  h.ui.tradeDialog(); assert.match(h.nodes.get('dialog-body').innerHTML, /trade-form|uygun hedef yok/);
  h.ui.armyDialog('attack'); assert.match(h.nodes.get('dialog-body').innerHTML, /army-form/);
  assert.equal(engine.validateState(h.state).ok, true);
});

test('VM UI contract: real scout click creates a moving army and renders fresh intelligence after arrival', async () => {
  const h = createHarness(); await h.ui.enterGame(h.state);
  const enemy = h.state.settlements.find(town => town.ownerId !== h.state.playerId);
  h.map.select(enemy.x, enemy.y);
  await h.click({ action: 'scout' });
  await h.submit('scout-form', { count: '1' });
  const army = h.state.armies.find(a => a.ownerId === h.state.playerId && a.mission === 'scout');
  assert.ok(army);
  await h.click({ view: 'army' });
  assert.match(h.nodes.get('section-view').innerHTML, /Keşif/);
  engine.dispatch(h.state, { type: 'setSpeed', speed: 12 });
  engine.advance(h.state, army.arriveAt);
  await h.click({ view: 'map' }); h.map.select(enemy.x, enemy.y);
  assert.match(h.nodes.get('inspector').innerHTML, /Son doğrulama/);
  assert.doesNotMatch(h.nodes.get('inspector').innerHTML, /NaN|undefined/);
  assert.equal(engine.validateState(h.state).ok, true);
});

test('VM UI contract: actual expansion form creates and settles a paid founder caravan', async () => {
  const h = createHarness(); await h.ui.enterGame(h.state);
  const home = engine.getPlayerSettlements(h.state)[0];
  const tile = h.state.world.tiles.find(t => world.distance(home, t) <= 5 && !t.poi && h.state.settlements.every(town => world.distance(town, t) >= 3));
  h.map.select(tile.x, tile.y);
  await h.click({ action: 'expand' });
  await h.submit('expand-form', { name: 'İkinci Ocak' });
  const founders = h.state.armies.find(a => a.ownerId === h.state.playerId && a.mission === 'expand');
  assert.ok(founders);
  engine.dispatch(h.state, { type: 'setSpeed', speed: 12 });
  engine.advance(h.state, founders.arriveAt);
  h.ui.render();
  assert.equal(engine.getPlayerSettlements(h.state).length, 2);
  assert.match(h.nodes.get('settlement-rail').innerHTML, /İkinci Ocak/);
  assert.equal(engine.validateState(h.state).ok, true);
});

test('VM UI contract: menu/manual save/export and import preserve a valid portable campaign', async () => {
  const h = createHarness(); await h.ui.enterGame(h.state);
  await h.ui.menu(); assert.equal(h.nodes.get('dialog').open, true);
  assert.match(h.nodes.get('dialog-body').innerHTML, /Elle kayıt al/);
  await h.click({ action: 'manual-save' });
  assert.equal(h.ui.saves.slots.manual.state.world.seed, h.state.world.seed);
  h.ui.showExport();
  assert.match(h.nodes.get('dialog-body').innerHTML, /export-text/);
  const exported = h.ui.saves.export(h.state);
  assert.equal(decodeSave(exported).state.world.tiles.length, 2401);
  h.ui.showImport();
  await h.submit('import-form', { save: exported });
  assert.equal(h.ui.state.world.seed, 'TL-UI-VM');
  assert.equal(engine.validateState(h.ui.state).ok, true);
  assert.equal(h.nodes.get('dialog').open, false);
  h.ui.showImport();
  const before = h.ui.state;
  await h.submit('import-form', { save: '{corrupt' });
  assert.equal(h.ui.state, before);
  assert.equal(h.nodes.get('dialog').open, true);
});

test('VM UI contract: new campaign, quit, continue and mobile lifecycle hooks retain progress', async () => {
  const h = createHarness();
  h.ui.newCampaign();
  await h.submit('new-form', { name: 'Yeni Sedir', seed: 'TL-NEW-VM' });
  assert.equal(h.ui.state.world.seed, 'TL-NEW-VM');
  assert.equal(h.ui.saves.slots.auto.state.dynasty.name, 'Yeni Sedir');
  await h.click({ speed: '4' });
  assert.equal(h.ui.state.paused, false);
  h.document.hidden = true;
  for (const callback of h.documentListeners.visibilitychange) callback();
  assert.equal(h.ui.state.paused, true);
  assert.ok(h.ui.saves.journal);
  await h.click({ action: 'quit' });
  assert.equal(h.ui.state, null);
  assert.equal(h.nodes.get('welcome').hidden, false);
  assert.match(h.nodes.get('welcome-actions').innerHTML, /Kampanyaya devam et/);
  await h.click({ load: 'auto' });
  assert.equal(h.ui.state.world.seed, 'TL-NEW-VM');
  assert.equal(h.ui.state.paused, true);
  assert.equal(h.nodes.get('welcome').hidden, true);
});

test('VM UI contract: failed save stays visible and quit does not discard an unsaved campaign', async () => {
  const h = createHarness(); await h.ui.enterGame(h.state);
  h.ui.saves.error = 'Kayıt alanı dolu; yedek al.';
  await h.click({ action: 'quit' });
  assert.equal(h.ui.state, h.state);
  assert.match(h.nodes.get('toast').textContent, /Kayıt alanı dolu/);
  assert.match(h.nodes.get('save-status').textContent, /Kayıt alanı dolu/);
});

test('VM UI contract: owned-point transfer previews the old-town loss and submits the selected receiving town', async () => {
  const h = createHarness();
  const state = engine.createGame({ seed: 'TL-UI-TRANSFER', size: 49, aiCount: 0 });
  const home = engine.getPlayerSettlements(state)[0];
  const advanceTo = target => {
    for (let pass = 0; pass < 8 && state.time < target; pass++) {
      engine.dispatch(state, { type: 'setSpeed', speed: 1 });
      engine.advance(state, target - state.time);
    }
    assert.equal(state.time, target, 'fixture reaches the scheduled engine arrival');
    engine.dispatch(state, { type: 'setSpeed', speed: 0 });
  };
  // Build the second town and acquire its future resource point through actual orders.
  assert.equal(engine.dispatch(state, { type: 'expand', settlementId: home.id, x: home.x - 3, y: home.y, name: 'Demir Yurdu' }).ok, true);
  advanceTo(state.armies.at(-1).arriveAt);
  const receiving = engine.getPlayerSettlements(state).find(t => t.id !== home.id);
  const point = world.getTile(state.world, home.x - 2, home.y - 3);
  assert.equal(engine.dispatch(state, { type: 'claim', settlementId: home.id, x: point.x, y: point.y, troops: { spear: 4 } }).ok, true);
  advanceTo(state.armies.at(-1).arriveAt);
  assert.equal(point.poi.ownerId, state.playerId);
  assert.equal(point.poi.settlementId, home.id);
  assert.equal(engine.validateState(state).ok, true);

  await h.ui.enterGame(state);
  await h.click({ town: home.id });
  h.map.select(point.x, point.y);
  assert.match(h.nodes.get('inspector').innerHTML, /data-action="reassign"/);
  assert.match(h.nodes.get('inspector').innerHTML, /Bağlı yurdu değiştir/);
  const beforePreview = JSON.stringify(state);
  await h.click({ action: 'reassign' });
  assert.equal(h.nodes.get('dialog').open, true);
  const dialog = h.nodes.get('dialog-body').innerHTML;
  const brief = mapintel.pointBrief(state, receiving, point.x, point.y);
  assert.match(dialog, /id="reassign-form"/);
  assert.ok(dialog.includes(`<option value="${receiving.id}" selected`));
  assert.ok(dialog.includes(brief.benefit), 'visible brief includes receiver gain and old-town hourly loss');
  assert.match(dialog, /katkıyı kaybeder/);
  assert.match(dialog, /5 Nüfuz/);
  assert.match(dialog, /Bağlantı kuryesi/);
  assert.equal(JSON.stringify(state), beforePreview, 'opening and previewing does not charge or change campaign state');

  const influence = engine.getFaction(state).influence;
  const resources = clone(receiving.resources), troops = clone(receiving.troops);
  await h.submit('reassign-form', { origin: receiving.id });
  const courier = state.armies.find(a => a.rebind === true);
  assert.ok(courier);
  assert.equal(courier.fromId, receiving.id, 'form destination wins over the still-active capital');
  assert.equal(courier.mission, 'claim');
  assert.equal(courier.influenceCost, 5);
  assert.equal(engine.getFaction(state).influence, influence - 5);
  assert.deepEqual(receiving.resources, resources);
  assert.deepEqual(receiving.troops, troops);
  assert.equal(point.poi.settlementId, home.id, 'benefit remains with the old town until arrival');
  assert.equal(h.nodes.get('dialog').open, false);
  assert.match(h.nodes.get('inspector').innerHTML, /Zamanı başlat, sonucu izle/);
  assert.ok(h.ui.saves.slots.auto.state.armies.some(a => a.rebind && a.fromId === receiving.id));
  assert.equal(engine.validateState(state).ok, true);
});

test('VM UI contract: unselected inspector guidance follows the actual world and near zoom modes', async () => {
  const h = createHarness();
  await h.ui.enterGame(h.state);
  await h.click({ action: 'deselect' });
  h.map.setZoom('world');
  assert.equal(h.map.getView().mode, 'world');
  assert.match(h.nodes.get('inspector').innerHTML, /Dünya: bölge seç, tehdit ve yurt dağılımına bak/);
  assert.doesNotMatch(h.nodes.get('inspector').innerHTML, /Yakın: seçili karonun/);
  h.map.setZoom('near');
  assert.equal(h.map.getView().mode, 'near');
  assert.match(h.nodes.get('inspector').innerHTML, /Yakın: seçili karonun arazi, rota ve kuruluş kararı/);
  assert.doesNotMatch(h.nodes.get('inspector').innerHTML, /Dünya: bölge seç/);
});
