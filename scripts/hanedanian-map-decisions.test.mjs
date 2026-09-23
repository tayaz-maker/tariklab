// The decision map's data agrees with the engine, and its layers never touch the atlas.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../public/games/hanedanian/engine.js';
import { regionOf } from '../public/games/hanedanian/campaign.js';
import { previewOrder } from '../public/games/hanedanian/orders.js';
import { expansionSites, siteVerdict, incomingThreats, regionPresence, expansionRange, scoutRoute } from '../public/games/hanedanian/mapintel.js';

const fresh = (seed) => {
  const state = engine.createGame({ seed, size: 49, aiCount: 8, dynastyName: 'Sedir Hanedanı' });
  engine.dispatch(state, { type: 'setSpeed', speed: 12 });
  engine.advance(state, 600);
  engine.dispatch(state, { type: 'setSpeed', speed: 0 });
  return state;
};
const rich = (state) => {
  // Remove resource and influence limits so only location rules decide.
  const town = engine.getPlayerSettlements(state)[0];
  for (const key of Object.keys(town.resources)) town.resources[key] = 1e6;
  engine.getFaction(state, state.playerId).influence = 1e6;
  return town;
};

test('expansion sites equal the engine: every tile, three seeds, with a caravan already on the road', () => {
  for (const seed of ['TL-MAP-1', 'TL-MAP-2', 'TL-MAP-3']) {
    const state = fresh(seed);
    const town = rich(state);
    // Put one caravan on the road so pending-caravan spacing is exercised too.
    const first = expansionSites(state, town).findIndex(Boolean);
    const size = state.world.size;
    assert.ok(first >= 0, 'a fresh campaign has somewhere to settle');
    assert.equal(engine.dispatch(state, { type: 'expand', settlementId: town.id, x: first % size, y: Math.floor(first / size), name: 'Öncü' }).ok, true);
    const sites = expansionSites(state, town);
    let valid = 0;
    for (let i = 0; i < size * size; i++) {
      const x = i % size, y = Math.floor(i / size);
      const engineOk = previewOrder(state, { type: 'expand', settlementId: town.id, x, y, name: 'Test' }).ok;
      assert.equal(!!sites[i], engineOk, `${seed} ${x},${y}`);
      assert.equal(siteVerdict(state, town, x, y).ok, engineOk, `verdict ${seed} ${x},${y}`);
      valid += sites[i];
    }
    assert.ok(valid > 10, `${seed}: ${valid} valid sites`);
  }
});

test('a higher Konak widens the expansion range exactly as the engine does', () => {
  const state = fresh('TL-MAP-RANGE');
  const town = rich(state);
  const before = expansionRange(town);
  town.buildings.hall += 2;
  assert.equal(expansionRange(town), before + 4);
  const sites = expansionSites(state, town), size = state.world.size;
  for (let i = 0; i < size * size; i++)
    if (sites[i]) assert.ok(Math.hypot(i % size - town.x, Math.floor(i / size) - town.y) <= before + 4);
});

test('incoming threats: visible hostile attacks and claims on your towns and points, soonest first', () => {
  const state = fresh('TL-MAP-THREAT');
  const town = engine.getPlayerSettlements(state)[0];
  const rival = state.settlements.find((s) => s.ownerId !== state.playerId);
  const base = { ownerId: rival.ownerId, fromId: rival.id, troops: { spear: 10 }, cargo: {}, returning: false };
  const near = { x: town.x + 3, y: town.y };
  state.armies.push(
    { ...base, id: 'a1', mission: 'attack', from: near, to: { x: town.x, y: town.y }, departAt: state.time, arriveAt: state.time + 90 },
    { ...base, id: 'a2', mission: 'attack', from: near, to: { x: town.x, y: town.y }, departAt: state.time, arriveAt: state.time + 30 },
    { ...base, id: 'a3', mission: 'attack', from: near, to: { x: town.x, y: town.y }, departAt: state.time, arriveAt: state.time + 20, returning: true },
    { ...base, id: 'a4', mission: 'scout', from: near, to: { x: town.x, y: town.y }, departAt: state.time, arriveAt: state.time + 20 },
    { ...base, id: 'a5', mission: 'attack', from: { x: rival.x, y: rival.y }, to: { x: rival.x + 1, y: rival.y }, departAt: state.time, arriveAt: state.time + 20 },
  );
  const threats = incomingThreats(state);
  assert.deepEqual(threats.map((t) => t.armyId), ['a2', 'a1'], 'only live attacks on you, soonest first');
  assert.equal(threats[0].target.name, town.name);
  assert.equal(threats[0].minutes, 30);
  // Out of sight (no town or watchtower within range) means not shown.
  state.armies = [{ ...base, id: 'far', mission: 'attack', from: { x: town.x + 20, y: town.y + 20 }, to: { x: town.x, y: town.y }, departAt: state.time, arriveAt: state.time + 1000 }];
  const visible = engine.isArmyVisible(state, state.armies[0]);
  assert.equal(incomingThreats(state).length, visible ? 1 : 0);
});

test('region presence counts your towns, developed towns and points per campaign region', () => {
  const state = fresh('TL-MAP-REGION');
  const rows = regionPresence(state);
  assert.equal(rows.length, 9);
  const towns = engine.getPlayerSettlements(state);
  assert.equal(rows.reduce((n, r) => n + r.towns, 0), towns.length);
  for (const town of towns) assert.ok(rows[regionOf(state, town)].towns >= 1);
  assert.equal(rows.reduce((n, r) => n + r.developed, 0), towns.filter((t) => t.buildings.hall >= 2).length);
  const points = state.world.tiles.filter((t) => t.poi?.ownerId === state.playerId).length;
  assert.equal(rows.reduce((n, r) => n + r.points, 0), points);
});

test('scout route matches the engine travel estimate', () => {
  const state = fresh('TL-MAP-ROUTE');
  const town = engine.getPlayerSettlements(state)[0];
  const route = scoutRoute(state, town, town.x + 4, town.y + 2);
  const estimate = engine.getTravelEstimate(state, town, { x: town.x + 4, y: town.y + 2 }, { scout: 1 });
  assert.deepEqual(route, { distance: estimate.distance, minutes: estimate.minutes });
  assert.equal(scoutRoute(state, town, town.x, town.y), null);
});

// ---- Layers draw without ever touching the terrain atlas ----
function stubContext(canvas) {
  const target = { canvas, createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), createLinearGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), measureText: (t) => ({ width: String(t).length * 6 }) };
  return new Proxy(target, { get: (obj, key) => (key in obj ? obj[key] : () => {}), set: (obj, key, value) => { obj[key] = value; return true; } });
}
globalThis.document ??= { hidden: false, createElement() { const c = { width: 0, height: 0 }; c.context = stubContext(c); c.getContext = () => c.context; return c; } };
globalThis.Path2D ??= class { ellipse() {} moveTo() {} lineTo() {} };
const { StrategyMap, MAP_LAYERS } = await import('../public/games/hanedanian/map.js');

test('every layer combination draws at every zoom without resetting or rebuilding the atlas', () => {
  const state = fresh('TL-MAP-LAYERS');
  const town = engine.getPlayerSettlements(state)[0];
  const rival = state.settlements.find((s) => s.ownerId !== state.playerId);
  state.armies.push({ id: 'x', ownerId: rival.ownerId, fromId: rival.id, mission: 'attack', from: { x: town.x + 2, y: town.y }, to: { x: town.x, y: town.y }, departAt: state.time, arriveAt: state.time + 50, troops: { spear: 5 }, cargo: {}, returning: false });
  for (const zoom of [0.12, 0.5, 1.2]) {
    const map = Object.create(StrategyMap.prototype);
    Object.assign(map, { width: 800, height: 600, zoom, center: { x: 24.5, y: 24.5 }, options: {}, dpr: 1, disposed: false, territoryKey: null, territoryGrid: null, selected: null, hover: null });
    map.canvas = { dataset: {} };
    map.ctx = stubContext(map.canvas);
    map.invalidate = () => {};
    map.pumpAtlas = () => {};
    map.updateAccessibleLabel = () => {};
    map.clampView = () => {};
    map.resetTerrainCaches();
    map.setState(state);
    map.ensureTerrainCache();
    while (map.atlasJobs.size) map.runAtlasSlice();
    const caches = map.terrainCaches;
    let resets = 0;
    const reset = map.resetTerrainCaches;
    map.resetTerrainCaches = function () { resets++; return reset.call(this); };
    assert.equal(map.threats.length, engine.isArmyVisible(state, state.armies.at(-1)) ? 1 : 0);
    map.selected = { x: town.x + 3, y: town.y + 1 };
    map.setGuide({ from: { x: town.x, y: town.y }, target: map.selected, range: expansionRange(town), claimRange: 7, sites: expansionSites(state, town), route: { minutes: 12, distance: 3.2, label: '12 dk · 3.2 karo' } });
    for (let mask = 0; mask < 16; mask++) {
      map.setLayers(Object.fromEntries(MAP_LAYERS.map((key, i) => [key, !!(mask & (1 << i))])));
      map.draw();
    }
    map.setOverlay(false);
    assert.equal(map.layers.borders, false, 'the old overlay switch still drives borders');
    map.draw();
    assert.equal(resets, 0, `zoom ${zoom}: no atlas reset`);
    assert.equal(map.terrainCaches, caches);
    assert.equal(map.atlasJobs.size, 0, 'no atlas job queued by any layer');
  }
});
