import test from 'node:test';
import assert from 'node:assert/strict';

// The terrain atlas used to be painted synchronously inside draw(); on a mode
// change that blocked the main thread for 0.3-1.3s. These tests drive the
// real StrategyMap scheduler against a recording canvas stub (no raster), so
// they check the contract, not pixels: browser QA separately verifies that the
// sliced atlas is pixel-identical to the old synchronous one.

function stubContext(canvas) {
  const ops = [];
  const target = {
    canvas,
    ops,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  return new Proxy(target, {
    get(obj, key) {
      if (key in obj) return obj[key];
      return () => { ops.push(key); };
    },
    set(obj, key, value) { obj[key] = value; return true; },
  });
}

const created = [];
globalThis.document = {
  hidden: false,
  createElement() {
    const canvas = { width: 0, height: 0 };
    canvas.context = stubContext(canvas);
    canvas.getContext = () => canvas.context;
    created.push(canvas);
    return canvas;
  },
};
globalThis.Path2D ??= class { ellipse() {} moveTo() {} lineTo() {} };

const { StrategyMap } = await import('../public/games/hanedanian/map.js');

function fixture(zoom) {
  const map = Object.create(StrategyMap.prototype);
  map.width = 800;
  map.height = 600;
  map.zoom = zoom;
  map.center = { x: 24.5, y: 24.5 };
  const terrains = ['plain', 'forest', 'mountain', 'valley', 'steppe', 'arid', 'ore', 'pass'];
  map.state = { world: { size: 49, tiles: Array.from({ length: 2401 }, (_, i) => ({ x: i % 49, y: Math.floor(i / 49), terrain: terrains[(i * 7 + Math.floor(i / 49)) % terrains.length] })) } };
  map.resetTerrainCaches();
  map.atlasPending = false;
  map.disposed = false;
  map.invalidations = 0;
  map.invalidate = () => { map.invalidations++; };
  return map;
}

// Run slices synchronously instead of through the MessageChannel hop.
function drain(map, limit = 100000) {
  map.pumpAtlas = () => {};
  let slices = 0;
  while (map.atlasJobs.size && slices < limit) { map.runAtlasSlice(); slices++; }
  return slices;
}

test('ensureTerrainCache returns a preview immediately and never paints the atlas inline', () => {
  const map = fixture(0.25);
  map.pumpAtlas = () => {};
  const before = created.length;
  const bitmap = map.ensureTerrainCache();
  assert.equal(bitmap.width, 49, 'first draw uses the per-tile preview');
  assert.equal(created.length - before, 1, 'only the preview canvas is created synchronously');
  assert.ok(map.atlasJobs.has(map.mode), 'the current mode atlas is queued as a background job');
  assert.equal(map.terrainCaches.size, 0);
});

test('background slices complete the atlas, then reuse it without rebuilding', () => {
  const map = fixture(0.25);
  map.ensureTerrainCache();
  const slices = drain(map);
  assert.ok(slices > 1, 'the atlas is built over several slices');
  assert.ok(map.terrainCaches.has(map.mode));
  assert.equal(map.terrainCaches.size, 3, 'remaining zoom levels are prepared in the background');
  const cached = map.ensureTerrainCache();
  assert.equal(cached, map.terrainCaches.get(map.mode));
  map.zoom = 1.2;
  assert.equal(map.ensureTerrainCache(), map.terrainCaches.get('near'), 'returning to near reuses its atlas');
  map.zoom = 0.25;
  assert.equal(map.ensureTerrainCache(), cached, 'returning to world reuses its atlas');
  assert.equal(map.atlasJobs.size, 0, 'no rebuild is queued for finished modes');
  assert.ok(map.invalidations > 0, 'a finished atlas requests a redraw');
});

test('raster-heavy steps end a slice even when the time budget is not exhausted', () => {
  const map = fixture(0.25);
  const realNow = performance.now;
  performance.now = () => 0;
  try {
    map.ensureTerrainCache();
    map.pumpAtlas = () => {};
    let slices = 0;
    while (map.atlasJobs.has('world') && slices < 100000) { map.runAtlasSlice(); slices++; }
    assert.ok(slices >= 8, `flush points split the job into many tasks (got ${slices})`);
  } finally {
    performance.now = realNow;
  }
});

test('a new world discards jobs and caches from the previous world', () => {
  const map = fixture(0.25);
  map.ensureTerrainCache();
  drain(map);
  const oldCache = map.terrainCaches.get('world');
  map.state = { world: { size: 49, tiles: map.state.world.tiles.map((t) => ({ ...t })) } };
  const bitmap = map.ensureTerrainCache();
  assert.notEqual(bitmap, oldCache);
  assert.equal(bitmap.width, 49, 'new world starts from its own preview');
  assert.equal(map.terrainCaches.size, 0);
});
