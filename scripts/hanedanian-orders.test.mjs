// Order preview parity, period summary and the map overlay's atlas contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../public/games/hanedanian/engine.js';
import { previewOrder, orderDelta, snapshot, summarizePeriod, rowTone, orderStep } from '../public/games/hanedanian/orders.js';

const fresh = (seed = 'TL-ORDERS') => {
  const state = engine.createGame({ seed, size: 49, aiCount: 8, dynastyName: 'Sedir Hanedanı' });
  engine.dispatch(state, { type: 'setSpeed', speed: 12 });
  engine.advance(state, 900);
  engine.dispatch(state, { type: 'setSpeed', speed: 0 });
  return state;
};
const json = (value) => JSON.stringify(value);

function ordersFor(state) {
  const town = engine.getPlayerSettlements(state)[0];
  const out = [];
  for (const building of ['farm', 'lumber', 'quarry', 'mine', 'hall', 'barracks', 'market', 'wall'])
    out.push({ type: 'build', settlementId: town.id, building });
  for (const unit of ['scout', 'spear']) for (const count of [1, 5, 400]) out.push({ type: 'train', settlementId: town.id, unit, count });
  out.push({ type: 'demobilize', settlementId: town.id, unit: 'spear', count: 1 });
  const empty = state.world.tiles.filter((t) => !t.poi && state.settlements.every((s) => Math.hypot(s.x - t.x, s.y - t.y) >= 3));
  for (const tile of [empty[0], empty.find((t) => Math.hypot(t.x - town.x, t.y - town.y) <= 8)].filter(Boolean)) {
    out.push({ type: 'expand', settlementId: town.id, x: tile.x, y: tile.y, name: 'Test Yurdu' });
    out.push({ type: 'scout', settlementId: town.id, x: tile.x, y: tile.y, count: 1 });
  }
  const poi = state.world.tiles.find((t) => t.poi && !t.poi.ownerId && Math.hypot(t.x - town.x, t.y - town.y) <= 7);
  if (poi) out.push({ type: 'claim', settlementId: town.id, x: poi.x, y: poi.y, troops: { spear: 3 } });
  const rival = state.settlements.find((s) => s.ownerId !== state.playerId);
  out.push({ type: 'attack', settlementId: town.id, x: rival.x, y: rival.y, troops: { spear: 2 } });
  out.push({ type: 'trade', settlementId: town.id, targetId: rival.id, cargo: { food: 20 } });
  return out;
}

test('order preview equals the committed order for every order type, and never touches live state', () => {
  let checked = 0, ok = 0;
  for (const seed of ['TL-ORDERS', 'TL-ORDERS-2', 'TL-ORDERS-3']) {
    const base = fresh(seed);
    for (const action of ordersFor(base)) {
      const live = structuredClone(base);
      const before = json(live);
      const preview = previewOrder(live, action);
      assert.equal(json(live), before, `preview of ${action.type} must not mutate the live state`);
      const snapshotBefore = structuredClone(live);
      const result = engine.dispatch(live, action);
      assert.equal(preview.ok, result.ok, `${action.type}: preview and commit agree on legality`);
      assert.equal(preview.message, result.message, `${action.type}: same engine message`);
      if (result.ok) {
        ok++;
        assert.deepEqual({ cost: preview.cost, outcome: preview.outcome }, orderDelta(snapshotBefore, live, action), `${action.type}: same cost and result`);
      }
      checked++;
    }
  }
  assert.ok(checked >= 40, `checked ${checked} orders`);
  assert.ok(ok >= 15, `at least 15 legal orders compared (${ok})`);
});

test('preview reports cost and a concrete, timed result', () => {
  const state = fresh();
  const town = engine.getPlayerSettlements(state)[0];
  const p = previewOrder(state, { type: 'build', settlementId: town.id, building: 'farm' });
  assert.equal(p.ok, true);
  assert.ok(Object.values(p.cost).every((n) => n > 0) && Object.keys(p.cost).length >= 2);
  assert.equal(p.outcome.kind, 'queue');
  assert.ok(p.outcome.completeAt > state.time);
  const blocked = previewOrder(state, { type: 'train', settlementId: town.id, unit: 'spear', count: 100000 });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /\S/);
});

test('period summary lists what changed while time ran, and nothing when it did not', () => {
  const state = fresh();
  const start = snapshot(state);
  assert.equal(summarizePeriod(start, snapshot(state), state.reports), null, 'no time passed');
  engine.dispatch(state, { type: 'setSpeed', speed: 12 });
  engine.advance(state, 240);
  const summary = summarizePeriod(start, snapshot(state), state.reports);
  assert.equal(summary.minutes, state.time - start.time);
  assert.ok(summary.rows.some((r) => ['food', 'wood', 'stone', 'iron'].includes(r.key)), 'resources moved');
  for (const row of summary.rows) {
    assert.notEqual(row.from, row.to);
    assert.ok(['good', 'bad', 'neutral'].includes(rowTone(row)));
  }
  assert.ok(summary.news.every((n) => !start.reportIds.includes(n.id)), 'only new reports');
  assert.ok(json(snapshot(state)).length < 2000, 'snapshot stays small; it is never saved');
});

test('step indicator follows target → order → confirm → watch', () => {
  assert.equal(orderStep({ selected: false, dialog: false, paused: true, pending: false }), 'target');
  assert.equal(orderStep({ selected: true, dialog: false, paused: true, pending: false }), 'order');
  assert.equal(orderStep({ selected: true, dialog: true, paused: true, pending: false }), 'confirm');
  assert.equal(orderStep({ selected: true, dialog: false, paused: true, pending: true }), 'watch');
  assert.equal(orderStep({ selected: false, dialog: false, paused: false, pending: false }), 'target');
});

test('save schema is unchanged: previews and summaries add nothing to the campaign', () => {
  const state = fresh();
  const keys = Object.keys(state).sort();
  const town = engine.getPlayerSettlements(state)[0];
  previewOrder(state, { type: 'build', settlementId: town.id, building: 'farm' });
  snapshot(state);
  assert.deepEqual(Object.keys(state).sort(), keys);
  assert.equal(engine.validateState(state).ok, true);
});

// ---- Map overlay: a vector layer over the finished atlas, never a rebuild ----
function stubContext(canvas) {
  const target = { canvas, createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), createLinearGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), measureText: (t) => ({ width: String(t).length * 6 }) };
  return new Proxy(target, { get: (obj, key) => (key in obj ? obj[key] : () => {}), set: (obj, key, value) => { obj[key] = value; return true; } });
}
globalThis.document ??= { hidden: false, createElement() { const c = { width: 0, height: 0 }; c.context = stubContext(c); c.getContext = () => c.context; return c; } };
globalThis.Path2D ??= class { ellipse() {} moveTo() {} lineTo() {} };
const { StrategyMap } = await import('../public/games/hanedanian/map.js');

function mapFor(state, zoom) {
  const map = Object.create(StrategyMap.prototype);
  Object.assign(map, { width: 800, height: 600, zoom, center: { x: 24.5, y: 24.5 }, options: {}, dpr: 1, disposed: false, overlayOn: true, territoryKey: null, territoryGrid: null, selected: null, hover: null });
  map.canvas = { dataset: {} };
  map.ctx = stubContext(map.canvas);
  map.invalidate = () => {};
  map.pumpAtlas = () => {};
  map.updateAccessibleLabel = () => {};
  map.clampView = () => {};
  map.resetTerrainCaches();
  map.setState(state);
  return map;
}

test('overlay draws on every zoom without touching the terrain atlas', () => {
  const state = fresh();
  for (const zoom of [0.12, 0.5, 1.2]) {
    const map = mapFor(state, zoom);
    map.ensureTerrainCache();
    while (map.atlasJobs.size) map.runAtlasSlice();
    const caches = map.terrainCaches, sizeBefore = caches.size;
    let resets = 0;
    const reset = map.resetTerrainCaches;
    map.resetTerrainCaches = function () { resets++; return reset.call(this); };
    map.select(state.settlements[0].x, state.settlements[0].y, { notify: false });
    map.draw();
    map.setOverlay(false); map.draw();
    map.setOverlay(true); map.draw();
    // Settlements change (a new owner): territory recomputes, atlas stays.
    const next = structuredClone({ ...state, world: null }); next.world = state.world;
    next.settlements[1].ownerId = state.playerId;
    map.setState(next); map.draw();
    assert.equal(resets, 0, `zoom ${zoom}: overlay never resets the atlas`);
    assert.equal(map.terrainCaches, caches);
    assert.equal(map.terrainCaches.size, sizeBefore);
    assert.equal(map.atlasJobs.size, 0, 'no atlas job was queued by the overlay');
  }
});

test('territory is cached until settlements change and marks each settlement tile', () => {
  const state = fresh();
  const map = mapFor(state, 1);
  const grid = map.territory();
  assert.equal(map.territory(), grid, 'same settlements → same grid object');
  const size = state.world.size;
  state.settlements.forEach((town, i) => assert.equal(grid[town.y * size + town.x], i));
  const next = structuredClone({ ...state, world: null }); next.world = state.world;
  next.settlements[1].ownerId = state.playerId;
  map.setState(next);
  assert.notEqual(map.territory(), grid, 'owner change → recomputed');
});
