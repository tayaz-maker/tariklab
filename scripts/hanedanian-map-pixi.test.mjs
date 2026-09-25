// Unit tests for the HANEDANIAN PixiJS terrain layer (map-pixi.js) and the
// renderer-picking factory (map-factory.js). Everything here is a fake DOM /
// fake PixiJS fixture -- no real browser or WebGL context is used; that lets
// it run in Node like every other script test. Real render output is
// verified separately by browser QA (screenshot parity vs. the Canvas 2D
// renderer, documented in docs/TARIKLAB_PIXIJS_MAP_STATUS.md).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { StrategyMap } from '../public/games/hanedanian/map.js';
import { StrategyMapPixi } from '../public/games/hanedanian/map-pixi.js';

function fakeSprite() {
  return { visible: true, x: 0, y: 0, width: 0, height: 0, texture: null };
}

function fakePixiNamespace() {
  const textures = [];
  return {
    textures,
    Texture: {
      from(source) {
        const texture = { source: { resource: source, scaleMode: 'nearest' }, destroyed: false, destroy() { this.destroyed = true; } };
        textures.push(texture);
        return texture;
      },
    },
  };
}

function fixture() {
  const renders = [];
  const resizes = [];
  const sprite = fakeSprite();
  const PIXI = fakePixiNamespace();
  const terrainHost = { style: {} };
  const pixi = {
    app: { renderer: { resize: (w, h) => resizes.push([w, h]) } },
    PIXI,
    sprite,
    terrainHost,
    render: () => renders.push(true),
    destroy: () => renders.push('destroyed'),
  };
  const overlayCanvas = {
    style: {},
    _contexts: new Map(),
    getContext(kind, opts) {
      // Mirrors real <canvas>: the first getContext('2d', ...) call locks the
      // options in; later calls return the same object regardless of `opts`.
      if (!this._contexts.has(kind)) this._contexts.set(kind, { kind, opts, cleared: 0, setTransform() {}, clearRect() { this.cleared++; } });
      return this._contexts.get(kind);
    },
    focus() {},
    setPointerCapture() {},
    hasPointerCapture() { return false; },
    releasePointerCapture() {},
    setAttribute() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; },
  };
  const map = Object.create(StrategyMapPixi.prototype);
  // Build the parts of StrategyMap's constructor this test needs without a
  // real DOM (ResizeObserver, addEventListener, requestAnimationFrame).
  map.canvas = overlayCanvas;
  map.ctx = overlayCanvas.getContext('2d', { alpha: true });
  map.options = {};
  map.width = 800;
  map.height = 600;
  map.dpr = 1;
  map.zoom = 1;
  map.center = { x: 24.5, y: 24.5 };
  map.selected = null;
  map.hover = null;
  map.state = { playerId: 'p', world: { size: 49, tiles: [] }, settlements: [] };
  map.terrainCaches = new Map();
  map.disposed = false;
  map.listeners = [];
  map.frame = null;
  map.pointers = new Map();
  map.pinch = null;
  map.gesture = null;
  map.observer = { disconnect() {} };
  map._pixi = pixi;
  map._textures = new Map();
  return { map, sprite, PIXI, pixi, resizes, renders, overlayCanvas };
}

test('paintTerrainLayer positions and sizes the sprite to match the drawImage destination rect it replaces', () => {
  const { map, sprite } = fixture();
  const cache = { id: 'atlas-canvas-near' };
  map.paintTerrainLayer(map.ctx, cache, 12, -34, 76);
  assert.equal(sprite.visible, true);
  assert.equal(sprite.x, 12);
  assert.equal(sprite.y, -34);
  assert.equal(sprite.width, 49 * 76);
  assert.equal(sprite.height, 49 * 76);
});

test('paintTerrainLayer hides the sprite instead of drawing when no cache is ready yet', () => {
  const { map, sprite } = fixture();
  map.paintTerrainLayer(map.ctx, null, 0, 0, 40);
  assert.equal(sprite.visible, false);
});

test('the same cache canvas reuses one uploaded texture across repeated paints (no re-upload per pan frame)', () => {
  const { map, PIXI } = fixture();
  const cache = { id: 'atlas-canvas-region' };
  map.paintTerrainLayer(map.ctx, cache, 0, 0, 32);
  map.paintTerrainLayer(map.ctx, cache, 5, 5, 32);
  map.paintTerrainLayer(map.ctx, cache, 10, 10, 32);
  assert.equal(PIXI.textures.length, 1, 'one texture created for one cache canvas, however many times it is painted');
});

test('a different cache canvas (a new zoom-mode atlas finishing) gets its own texture, and linear filtering matches ctx.imageSmoothingEnabled', () => {
  const { map, PIXI } = fixture();
  map.paintTerrainLayer(map.ctx, { id: 'near' }, 0, 0, 76);
  map.paintTerrainLayer(map.ctx, { id: 'world' }, 0, 0, 16);
  assert.equal(PIXI.textures.length, 2);
  for (const texture of PIXI.textures) assert.equal(texture.source.scaleMode, 'linear');
});

test('clearCanvas leaves the overlay canvas transparent (clearRect) instead of opaque-filling it', () => {
  const { map } = fixture();
  map.clearCanvas(map.ctx);
  assert.equal(map.ctx.cleared, 1);
});

test('resetTerrainCaches destroys every uploaded texture and forgets the cache', () => {
  const { map, PIXI } = fixture();
  map.paintTerrainLayer(map.ctx, { id: 'a' }, 0, 0, 20);
  map.paintTerrainLayer(map.ctx, { id: 'b' }, 0, 0, 20);
  assert.equal(PIXI.textures.length, 2);
  map.resetTerrainCaches();
  assert.equal(map._textures.size, 0);
  assert.ok(PIXI.textures.every((t) => t.destroyed));
});

test('resize() is a safe no-op before _pixi exists (fired once from inside the base constructor) and sizes the terrain layer once it does', () => {
  const { map, resizes, renders, pixi } = fixture();
  // StrategyMap.prototype.resize() itself needs a real window/ResizeObserver
  // (browser QA covers that integration); stub it here so this test isolates
  // just the override's own guard + Pixi-sync logic.
  const realBaseResize = StrategyMap.prototype.resize;
  StrategyMap.prototype.resize = function () { /* base layout sizing: covered by browser QA */ };
  try {
    map._pixi = undefined;
    assert.doesNotThrow(() => map.resize());
    assert.equal(resizes.length, 0, 'must not touch the Pixi renderer before _pixi is assigned');
    map._pixi = pixi;
    map.width = 900;
    map.height = 500;
    map.resize();
    assert.deepEqual(resizes.at(-1), [900, 500]);
    assert.equal(pixi.terrainHost.style.width, '900px');
    assert.ok(renders.includes(true));
  } finally {
    StrategyMap.prototype.resize = realBaseResize;
  }
});

test('destroy() cleans up textures and the PixiJS app', () => {
  const { map, PIXI, renders } = fixture();
  map.paintTerrainLayer(map.ctx, { id: 'a' }, 0, 0, 20);
  map.destroy();
  assert.ok(PIXI.textures.every((t) => t.destroyed));
  assert.ok(renders.includes('destroyed'));
  assert.equal(map.disposed, true);
});

test('map-pixi.js reuses StrategyMap unchanged -- no duplicated atlas-generation or overlay-drawing code', () => {
  const src = readFileSync(new URL('../public/games/hanedanian/map-pixi.js', import.meta.url), 'utf8');
  assert.match(src, /extends StrategyMap/);
  assert.match(src, /import \{ StrategyMap \} from '\.\/map\.js'/);
  // These belong to the terrain-generation and vector-overlay systems this
  // file must never fork a second copy of (a bare mention in a comment,
  // e.g. explaining why this file defers to map.js, is fine -- a method
  // *definition* with the same name is what would mean a duplicated copy).
  for (const marker of ['atlasSteps', 'paintCanopyMasses', 'paintFieldFurrows', 'paintRiverBed', 'drawSettlements', 'drawOverlay', 'drawMinimap', 'drawPoi'])
    assert.doesNotMatch(src, new RegExp(`(^|[^/*\\s])\\b${marker}\\s*\\(`, 'm'), `map-pixi.js must not redefine ${marker} -- it should inherit map.js's`);
});

test('the terrain scene opts out of antialiasing (one opaque sprite, no Graphics edges) while the shared adapter keeps its true default for scenes that do have Graphics', () => {
  const adapterSrc = readFileSync(new URL('../public/games/shared/pixi-adapter.js', import.meta.url), 'utf8');
  assert.match(adapterSrc, /antialias\s*=\s*true/, 'mountPixiScene must default to antialias:true so existing Graphics-based scenes (e.g. Kıyı Eşiği) are unaffected');
  const pixiSrc = readFileSync(new URL('../public/games/hanedanian/map-pixi.js', import.meta.url), 'utf8');
  assert.match(pixiSrc, /antialias:\s*false/, 'HANEDANIAN\'s terrain scene should opt out for its measured render-cost win');
});

test('map-factory.js never touches game state -- only camera/selection/DOM plumbing', () => {
  const src = readFileSync(new URL('../public/games/hanedanian/map-factory.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /localStorage/);
  assert.doesNotMatch(src, /SaveManager|\.save\(|createGame\(/);
  assert.match(src, /export function createMap\(/);
  assert.match(src, /export \{ MAP_LAYERS \}/);
});
