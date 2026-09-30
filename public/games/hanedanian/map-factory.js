// Picks the HANEDANIAN map renderer: the existing Canvas 2D StrategyMap
// (map.js) is always mounted first -- synchronously, fully interactive from
// frame one, identical to today's behaviour -- and PixiJS's GPU terrain
// layer (map-pixi.js) is swapped in afterwards only if the browser supports
// it. Every visitor keeps a working map; nobody is blocked on PixiJS.
//
// The capability probe (supportsPixi(), which creates a real WebGL context)
// is deferred past two animation frames before it runs, exactly like the
// Kıyı Eşiği adapter: calling it synchronously on the critical render path
// measurably delayed first paint there (see docs/TARIKLAB_PIXIJS_MAP_STATUS.md).
import { StrategyMap, MAP_LAYERS } from './map.js';
import { StrategyMapPixi, mountHanedanianTerrain, hanedanianGraphicsCapability } from './map-pixi.js';
import { StrategyMapDOM } from './map-dom.js';

export { MAP_LAYERS };

function cloneCanvas(source) {
  const next = document.createElement('canvas');
  for (const attr of source.getAttributeNames()) next.setAttribute(attr, source.getAttribute(attr));
  return next;
}

async function trySwapToPixi(options, getActive, setActive, onContextLost) {
  const capability = await hanedanianGraphicsCapability();
  if (!capability.supported) {
    if (!getActive().disposed) getActive().canvas.dataset.rendererFallback = capability.reason;
    return;
  }
  const old = getActive();
  const canvas = old.canvas;
  const workspace = canvas.parentElement;
  if (!workspace || old.disposed || old instanceof StrategyMapDOM) return;
  const rect = canvas.getBoundingClientRect();
  const terrainHost = document.createElement('div');
  terrainHost.className = 'map-terrain-host';
  terrainHost.style.width = `${rect.width}px`;
  terrainHost.style.height = `${rect.height}px`;
  workspace.insertBefore(terrainHost, canvas);
  const terrain = await mountHanedanianTerrain(terrainHost, rect.width, rect.height);
  if (!terrain) {
    terrainHost.remove();
    return; // PixiJS failed to load/init -- keep the Canvas 2D fallback
  }
  const current = getActive();
  if (current !== old || current.disposed) {
    // Torn down (or already swapped) while we awaited PixiJS's module load.
    terrain.destroy();
    terrainHost.remove();
    return;
  }
  const overlayCanvas = cloneCanvas(old.canvas);
  let next;
  try {
    next = new StrategyMapPixi(overlayCanvas, options, terrain);
  } catch {
    terrain.destroy();
    terrainHost.remove();
    return;
  }
  // setState()'s "first call" branch recenters on the home settlement --
  // correct for a brand-new map, wrong here. Run it for its real job (built
  // settlements/factions maps, queued the atlas job for the current mode),
  // then restore the camera/selection/layers the player already had so the
  // swap is invisible rather than a reset back to the capital at zoom 1.
  if (old.state) next.setState(old.state);
  next.center = { ...old.center };
  next.zoom = old.zoom;
  next.selected = old.selected ? { ...old.selected } : null;
  next.hover = old.hover ? { ...old.hover } : null;
  next.layers = { ...old.layers };
  next.guide = old.guide;
  workspace.replaceChild(overlayCanvas, old.canvas);
  workspace.classList.add('has-pixi-terrain');
  next.resize();
  next.clampView();
  next.updateAccessibleLabel();
  old.destroy();
  setActive(next);
  next.listen(terrain.app.canvas, 'webglcontextlost', event => {
    event.preventDefault();
    // Release the failed renderer and preserve the current decision/camera.
    if (getActive() === next && !next.disposed) onContextLost();
  });
  next.invalidate();
}

export function createMap(canvas, options = {}) {
  let active;
  let disposed = false;
  try { active = new StrategyMap(canvas, options); }
  catch { active = new StrategyMapDOM(canvas, options); }
  options.onRendererChange?.(active instanceof StrategyMapDOM ? 'dom' : 'canvas');
  function clearTerrain(workspace) {
    workspace?.querySelectorAll('.map-terrain-host').forEach(host => host.remove());
    workspace?.classList.remove('has-pixi-terrain');
  }
  function switchRenderer(renderer, allowPixi = true) {
    if (disposed) return;
    const old = active;
    const workspace = old.canvas.parentElement;
    const nextCanvas = cloneCanvas(old.canvas);
    nextCanvas.hidden = false;
    old.destroy();
    clearTerrain(workspace);
    workspace.replaceChild(nextCanvas, old.canvas);
    if (renderer === 'dom') active = new StrategyMapDOM(nextCanvas, options);
    else {
      try { active = new StrategyMap(nextCanvas, options); }
      catch { active = new StrategyMapDOM(nextCanvas, options); }
    }
    if (old.state) active.setState(old.state);
    active.center = { ...old.center };
    active.zoom = old.zoom;
    active.selected = old.selected ? { ...old.selected } : null;
    active.layers = { ...old.layers };
    active.setGuide(old.guide);
    active.resize();
    active.invalidate?.();
    if (renderer !== 'dom' && allowPixi) schedulePixi();
    options.onRendererChange?.(active instanceof StrategyMapDOM ? 'dom' : 'canvas');
  }
  function schedulePixi() { requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (disposed || active instanceof StrategyMapDOM) return;
      trySwapToPixi(options, () => active, (next) => { active = next; },
        () => switchRenderer('auto', false)).catch(() => { /* Keep the active fallback. */ });
    }),
  ); }
  schedulePixi();
  return {
    setState: (state) => active.setState(state),
    select: (x, y, opts) => active.select(x, y, opts),
    focus: (x, y) => active.focus(x, y),
    setZoom: (level) => active.setZoom(level),
    zoomBy: (factor, point) => active.zoomBy(factor, point),
    setLayers: (update) => active.setLayers(update),
    setGuide: (guide) => active.setGuide(guide),
    resize: () => active.resize(),
    getView: () => active.getView(),
    setRenderer: renderer => switchRenderer(renderer),
    getRenderer: () => active instanceof StrategyMapDOM ? 'dom' : active instanceof StrategyMapPixi ? 'pixi' : 'canvas',
    destroy: () => {
      if (disposed) return;
      disposed = true;
      const workspace = active.canvas.parentElement;
      active.destroy();
      clearTerrain(workspace);
    },
  };
}
