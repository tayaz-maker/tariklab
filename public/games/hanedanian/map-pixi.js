// PixiJS-backed terrain layer for the HANEDANIAN strategy map.
//
// StrategyMap (map.js) already separates the map into a cached terrain
// bitmap (built once per zoom mode by a time-sliced procedural painter --
// see atlasJob/atlasSteps) and a large set of vector overlays drawn fresh
// on every invalidate() (borders, settlements, POIs, armies, labels, the
// minimap...). That bitmap is exactly the "static, spatial" layer the
// PixiJS modernization plan calls out as the one worth GPU-accelerating;
// the overlays are already cheap, already invalidate()-gated (never a
// continuous render loop) and are hand-tuned vector art that a from-scratch
// PixiJS port would risk subtly breaking for no real benefit.
//
// So this file does not reimplement HANEDANIAN's renderer. It subclasses
// StrategyMap and overrides only the two hooks map.js exposes for this
// purpose (clearCanvas, paintTerrainLayer): the terrain bitmap becomes a
// PixiJS Sprite on its own WebGL canvas, stacked under the *same* 2D
// overlay canvas (now transparent) that already draws every vector layer
// exactly as before. Every camera/gesture/selection/keyboard method is
// inherited unchanged.
import { StrategyMap } from './map.js';

const PAPER_BACKGROUND = 0x191f1a; // COLORS.paper in map.js

// pixi-adapter.js is loaded dynamically, never with a static `import`. It is
// a deliberately uncached, optional dependency (see the offline package's
// FILES list in sw.js and its optionalShared entry in
// hanedanian-offline.test.mjs) -- but app.js statically imports
// map-factory.js, which statically imports this file, so a static import of
// pixi-adapter.js here would make its one uncached fetch a hard dependency
// of the whole module graph: fine online, but offline (no network, not in
// the SW cache by design) that fetch fails and ES module semantics block
// the entire chain -- including app.js itself -- from ever instantiating.
// A failed *dynamic* import here is just a rejected promise this file
// already handles, so the rest of the game boots normally and falls back to
// the Canvas 2D map.
let adapterPromise = null;
function loadAdapter() {
  if (!adapterPromise) adapterPromise = import('../shared/pixi-adapter.js').catch(() => null);
  return adapterPromise;
}

export class StrategyMapPixi extends StrategyMap {
  constructor(overlayCanvas, options, pixi) {
    super(overlayCanvas, { ...options, context: overlayCanvas.getContext('2d', { alpha: true }) });
    this._pixi = pixi; // { app, PIXI, sprite, terrainHost, render(), destroy() }
    this._textures = new Map(); // cache canvas -> PIXI.Texture, reused across zoom-mode switches
  }

  clearCanvas(ctx) {
    ctx.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
  }

  paintTerrainLayer(_ctx, cache, ox, oy, scale) {
    const { sprite } = this._pixi;
    if (!cache) {
      sprite.visible = false;
    } else {
      sprite.visible = true;
      // Every property write below dirties Pixi's transform/batch state even
      // when the value is unchanged (the common case: most invalidate()
      // calls during a pan/zoom keep the same texture, just move the
      // sprite). Skipping no-op writes measurably cut drag-frame cost.
      const texture = this.textureFor(cache);
      if (sprite.texture !== texture) sprite.texture = texture;
      if (sprite.x !== ox) sprite.x = ox;
      if (sprite.y !== oy) sprite.y = oy;
      const size = this.state.world.size * scale;
      if (sprite.width !== size) sprite.width = size;
      if (sprite.height !== size) sprite.height = size;
    }
    this._pixi.render();
  }

  // One PIXI.Texture per distinct cache canvas, reused for as long as the
  // canvas itself is reused (StrategyMap keeps one canvas per zoom mode in
  // terrainCaches, so this avoids re-uploading a GPU texture on every pan).
  textureFor(canvas) {
    let texture = this._textures.get(canvas);
    if (!texture || texture.destroyed) {
      const { PIXI } = this._pixi;
      texture = PIXI.Texture.from(canvas);
      texture.source.scaleMode = 'linear'; // matches ctx.imageSmoothingEnabled = true
      this._textures.set(canvas, texture);
    }
    return texture;
  }

  resetTerrainCaches() {
    super.resetTerrainCaches();
    for (const texture of this._textures.values()) {
      if (!texture.destroyed) texture.destroy(true);
    }
    this._textures.clear();
  }

  resize() {
    super.resize();
    // The base StrategyMap constructor calls resize() as its very last step,
    // before this subclass's own constructor body runs (super() executes
    // first, and `this.resize` already dispatches to this override, but
    // `this._pixi` is only assigned once super() returns). That first call
    // is a no-op here; map-factory.js calls resize() again right after
    // construction, once `_pixi` is set, to size the terrain layer.
    if (!this._pixi || this.width < 1 || this.height < 1) return;
    const { app, terrainHost } = this._pixi;
    app.renderer.resize(this.width, this.height);
    terrainHost.style.width = `${this.width}px`;
    terrainHost.style.height = `${this.height}px`;
    this._pixi.render();
  }

  destroy() {
    this.resetTerrainCaches();
    this._pixi.destroy();
    super.destroy();
  }
}

/**
 * Builds the terrain-only PixiJS scene inside `terrainHost` (an empty DOM
 * element the caller owns and positions). Returns `{app, PIXI, sprite,
 * terrainHost, render, destroy}` or null if PixiJS is unavailable/failed --
 * callers must keep using the plain StrategyMap in that case.
 */
export async function mountHanedanianTerrain(terrainHost, width, height) {
  const adapter = await loadAdapter();
  if (!adapter) return null;
  let sprite;
  const scene = await adapter.mountPixiScene({
    container: terrainHost,
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    background: PAPER_BACKGROUND,
    // One opaque Sprite, no Graphics edges to smooth -- MSAA here is pure
    // cost for no visible benefit (the terrain bitmap is already
    // procedurally anti-aliased; the overlay canvas draws every vector edge).
    antialias: false,
    build({ app, PIXI }) {
      sprite = new PIXI.Sprite();
      sprite.visible = false;
      app.stage.addChild(sprite);
    },
  });
  if (!scene) return null;
  return { app: scene.app, PIXI: scene.PIXI, sprite, terrainHost, render: scene.render, destroy: scene.destroy };
}

/** True if this environment can plausibly run the PixiJS terrain layer. */
export async function supportsHanedanianPixi() {
  const adapter = await loadAdapter();
  return adapter ? adapter.supportsPixi() : false;
}
