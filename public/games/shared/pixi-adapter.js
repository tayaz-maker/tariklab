// Shared PixiJS render adapter for TarikLab game maps.
//
// This is a thin, testable layer over a single concern: decide whether a
// visitor's browser can run PixiJS well, load it lazily only when a map
// screen actually opens, and manage the render loop so it never spins when
// nothing is changing. It never touches game state — callers pass a plain
// render model (arrays of nodes/links/etc. built from game state) and get
// back a scene handle with `update(model)` and `destroy()`.
//
// PixiJS is vendored at a pinned version, byte-identical to the official
// build (see docs/ip/THIRD_PARTY_NOTICES.md and
// docs/TARIKLAB_PIXIJS_MAP_STATUS.md for the exact version, hash and license).
// No CDN, no remote font, no remote asset: the module URL below is always
// same-origin.
export const PIXI_VERSION = "8.21.0";
const PIXI_URL = "/vendor/pixi/pixi-8.21.0.min.mjs";

let pixiModulePromise = null;

/**
 * True if this environment can plausibly run PixiJS's WebGL renderer.
 * Every check is injectable so this runs under Node's test runner (no DOM)
 * as well as in a real browser. A visitor who fails this check is never
 * blocked from playing — callers must keep an existing non-Pixi renderer
 * (SVG, Canvas 2D or DOM) as the fallback path.
 */
export function supportsPixi({
  win = typeof window === "undefined" ? undefined : window,
  createCanvas = () => (typeof document === "undefined" ? null : document.createElement("canvas")),
} = {}) {
  if (!win) return false;
  if (typeof win.WebGLRenderingContext === "undefined" && typeof win.WebGL2RenderingContext === "undefined")
    return false;
  let canvas;
  try {
    canvas = createCanvas();
  } catch {
    return false;
  }
  if (!canvas || typeof canvas.getContext !== "function") return false;
  try {
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return !!gl;
  } catch {
    return false;
  }
}

/**
 * Lazily imports the vendored PixiJS module. Memoized so a page that opens
 * more than one Pixi scene fetches it once. Resolves to the module
 * namespace; never throws — a failed load resolves to `null` so callers can
 * fall back without a top-level try/catch at every call site.
 */
export async function loadPixi({ importer = (url) => import(/* @vite-ignore */ url) } = {}) {
  if (!pixiModulePromise) {
    pixiModulePromise = importer(PIXI_URL).catch((err) => {
      pixiModulePromise = null; // allow a retry on the next call
      console.error("[pixi-adapter] failed to load PixiJS:", err);
      return null;
    });
  }
  return pixiModulePromise;
}

/** Test-only: clears the memoized load so the next `loadPixi()` re-imports. */
export function __resetPixiCacheForTests() {
  pixiModulePromise = null;
}

/**
 * True while `prefers-reduced-motion: reduce` is in force. Scenes should
 * skip transitions/animation (not necessarily skip Pixi itself) when this
 * is true.
 */
export function prefersReducedMotion({ win = typeof window === "undefined" ? undefined : window } = {}) {
  try {
    return !!win?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Mounts a PixiJS Application into `container` and hands back a small
 * lifecycle handle. The ticker is stopped immediately after init: these are
 * decision-map scenes, not animation loops, so a frame is drawn only when
 * `update()` is called after a real state change. `document.visibilitychange`
 * is still wired up defensively (a future scene with an ongoing effect —
 * inertial pan, a pulsing marker — should call `app.ticker.start()` itself
 * and this handle will pause/resume it around tab visibility automatically).
 *
 * @param {object} opts
 * @param {HTMLElement} opts.container - mount point; adapter empties it first
 * @param {number} opts.width
 * @param {number} opts.height
 * @param {number} [opts.background=0x000000]
 * @param {(scene: {app: import("pixi.js").Application, PIXI: unknown}) => void} opts.build
 *   Called once after init with the live Application and the PIXI namespace;
 *   build the initial scene graph here (Containers, Graphics, Text).
 * @returns {Promise<{app: import("pixi.js").Application, PIXI: unknown, render: () => void, destroy: () => void} | null>}
 *   null if PixiJS failed to load or init (caller falls back to the
 *   existing renderer).
 */
export async function mountPixiScene({ container, width, height, background = 0x000000, build }) {
  const PIXI = await loadPixi();
  if (!PIXI || !container) return null;
  const app = new PIXI.Application();
  try {
    await app.init({
      width,
      height,
      background,
      antialias: true,
      preference: "webgl",
      autoDensity: true,
      resolution: typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
      autoStart: false, // no ticking by default; callers render on demand
    });
  } catch (err) {
    console.error("[pixi-adapter] Application.init failed:", err);
    try {
      app.destroy(true, { children: true });
    } catch {
      /* already torn down */
    }
    return null;
  }
  container.replaceChildren(app.canvas);
  build?.({ app, PIXI });
  app.render();

  const onVisibility = () => {
    if (typeof document === "undefined") return;
    if (document.hidden) app.ticker.stop();
    else if (app.ticker.started === false && app.ticker.autoStart !== false) app.ticker.start();
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);

  let destroyed = false;
  return {
    app,
    PIXI,
    render() {
      if (!destroyed) app.render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
      app.destroy(true, { children: true, texture: true });
    },
  };
}
