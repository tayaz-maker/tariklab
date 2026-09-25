// PixiJS overlay for DEVLET's two SVG strategy maps (the seven-region map
// and the diplomatic compass). Unlike HANEDANIAN/Kıyı Eşiği, app.js rebuilds
// the ENTIRE screen via `root.innerHTML = ...` on every render (see
// `draw(session)` in app.js, called by bootGame on every act/render cycle)
// -- neither `<svg class="geo-map">` nor
// `<svg class="dip-map">` is a stable DOM node across interactions, so a
// PixiJS canvas placed inside that string would have its WebGL context torn
// down and rebuilt on every click (a real perf/battery cost, not just an
// implementation nuisance).
//
// So this module never touches `root`'s markup. It mounts ONE persistent
// canvas outside it (appended to `document.body`), `pointer-events: none`,
// and repositions/repaints it over whichever map svg app.js most recently
// rendered, via `getBoundingClientRect()`. The svg itself is left completely
// unchanged -- same `<path>`/`<g>` elements, same
// tabindex/role/aria-label/aria-pressed, same `data-region`/`data-axis`
// click handlers app.js's own `pick()` wires up -- so every existing
// accessibility and interaction path keeps working exactly as before,
// including for a visitor whose browser can't run Pixi at all (the overlay
// then just never appears, and the svg's own fill is what they see).
import { regionsRenderModel, foreignRenderModel } from "./maps.js";

// pixi-adapter.js is loaded dynamically, never with a static `import`. Like
// HANEDANIAN's map-pixi.js, this avoids making its (optional, only
// opportunistically cached -- see MODULE_GAME_PATHS in public/sw.js) fetch a
// hard dependency of this whole module graph: a failed *dynamic* import here
// is just a rejected promise this file already handles, so app.js and the
// rest of the game boot normally on the unmodified svg map.
let adapterPromise = null;
function loadAdapter() {
  if (!adapterPromise) adapterPromise = import("../shared/pixi-adapter.js").catch(() => null);
  return adapterPromise;
}

/** True if this environment can plausibly run the PixiJS map overlay. */
export async function supportsDevletPixi() {
  const adapter = await loadAdapter();
  return adapter ? adapter.supportsPixi() : false;
}

const REGIONS_VIEW = { w: 1000, h: 460 };
const FOREIGN_VIEW = { w: 1000, h: 440 };

function rgbToHex(css) {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(css || "");
  if (!m) return 0x808080;
  return (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]);
}

function lighten(hex, amt) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const l = (c) => Math.min(255, Math.round(c + (255 - c) * amt));
  return (l(r) << 16) | (l(g) << 8) | l(b);
}

// PixiJS's Graphics stroke has no native dash-pattern option; approximate the
// SVG `stroke-dasharray` by drawing short segments along the line (same
// helper as esik/map-pixi.js).
function dashedLine(g, x1, y1, x2, y2, pattern, style) {
  const [on, off] = pattern;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / (len || 1);
  const uy = (y2 - y1) / (len || 1);
  let pos = 0;
  let draw = true;
  while (pos < len) {
    const step = draw ? on : off;
    const next = Math.min(pos + step, len);
    if (draw) g.moveTo(x1 + ux * pos, y1 + uy * pos).lineTo(x1 + ux * next, y1 + uy * next);
    pos = next;
    draw = !draw;
  }
  g.stroke(style);
}

function paintRegions(PIXI, layer, model, interaction, mobile) {
  layer.removeChildren();
  const sea = new PIXI.Graphics();
  sea.rect(0, 0, REGIONS_VIEW.w, REGIONS_VIEW.h).fill(0x0b171d);
  layer.addChild(sea);
  for (const r of model.regions) {
    const pts = r.shape.flat();
    const hovered = interaction.hoverRegion === r.id;
    const g = new PIXI.Graphics();
    g.poly(pts).fill(hovered ? lighten(rgbToHex(r.color), 0.18) : rgbToHex(r.color));
    const focused = interaction.focusRegion === r.id;
    const strokeColor = r.selected ? 0xf1ead2 : focused ? 0xe8e3cf : 0x0a1013;
    const strokeWidth = r.selected ? 3.4 : focused ? 3 : 2.2;
    g.poly(pts).stroke({ width: strokeWidth, color: strokeColor, join: "round" });
    layer.addChild(g);
  }
  const marmara = new PIXI.Graphics();
  marmara.poly(model.marmaraSea.flat()).fill(0x0b171d).stroke({ width: 1, color: 0x2b3b39 });
  layer.addChild(marmara);
  // .geo-focus-hatch in the svg fallback is a diagonal hatch pattern over
  // this month's priority region; a dashed outline along the same shape
  // conveys the same "this one is different" signal without needing a
  // clip-masked hatch fill for a decorative-only cue.
  for (const r of model.regions) {
    if (!r.focused) continue;
    const g = new PIXI.Graphics();
    for (let i = 0; i < r.shape.length; i++) {
      const [x1, y1] = r.shape[i];
      const [x2, y2] = r.shape[(i + 1) % r.shape.length];
      dashedLine(g, x1, y1, x2, y2, [6, 4], { width: 2, color: 0xe9d38a, alpha: 0.9 });
    }
    layer.addChild(g);
  }
  const strokeStyle = mobile ? { color: 0x0a1013, width: 6 } : { color: 0x0a1013, width: 3 };
  for (const r of model.regions) {
    if (!r.labelAt) continue;
    const [x, y] = r.labelAt;
    const c = new PIXI.Container();
    c.x = x;
    c.y = y;
    const main = new PIXI.Text({
      text: mobile ? r.short : r.name.toLocaleUpperCase("tr-TR"),
      style: { fill: 0xeef0e6, fontSize: mobile ? 34 : 12, fontWeight: "700", fontFamily: "system-ui, sans-serif", letterSpacing: mobile ? 1.5 : 1, stroke: strokeStyle },
    });
    main.anchor.set(0.5, mobile ? 0.5 : 0);
    c.addChild(main);
    const value = new PIXI.Text({
      text: String(Math.round(r.value)),
      style: { fill: 0xf4f0dc, fontSize: mobile ? 34 : 15, fontWeight: "700", fontFamily: "Georgia, serif", stroke: strokeStyle },
    });
    value.anchor.set(0.5, 0);
    value.y = mobile ? 18 : 17;
    c.addChild(value);
    if (r.focused) {
      const focus = new PIXI.Text({
        text: mobile ? "◆" : "◆ ÖNCELİK",
        style: { fill: 0xe9d38a, fontSize: mobile ? 26 : 10, fontWeight: "700", fontFamily: "system-ui, sans-serif", letterSpacing: 1.2, stroke: strokeStyle },
      });
      focus.anchor.set(0.5, 1);
      focus.y = mobile ? -14 : -16;
      c.addChild(focus);
    }
    layer.addChild(c);
  }
}

function paintForeign(PIXI, layer, model, interaction) {
  layer.removeChildren();
  const bg = new PIXI.Graphics();
  bg.rect(0, 0, FOREIGN_VIEW.w, FOREIGN_VIEW.h).fill(0x0b1519);
  layer.addChild(bg);
  const [cx, cy] = model.center;
  const rings = new PIXI.Graphics();
  for (const r of [120, 240, 360]) rings.circle(cx, cy, r).stroke({ width: 1, color: 0x1f2f2f, alpha: 0.6 });
  layer.addChild(rings);
  const links = new PIXI.Graphics();
  for (const a of model.axes) {
    const [x, y] = a.at;
    const width = 1.5 + a.value / 22;
    const color = rgbToHex(a.color);
    const alpha = a.selected ? 1 : 0.8;
    if (a.value < 40) dashedLine(links, cx, cy, x, y, [6, 6], { width, color, alpha });
    else links.moveTo(cx, cy).lineTo(x, y).stroke({ width, color, alpha });
  }
  layer.addChild(links);
  const home = new PIXI.Container();
  home.x = cx - 150;
  home.y = cy - 62;
  home.scale.set(0.3);
  for (const shape of model.homeShape) {
    const g = new PIXI.Graphics();
    g.poly(shape.flat()).fill(0x2c3a33).stroke({ width: 5, color: 0x0b1519 });
    home.addChild(g);
  }
  layer.addChild(home);
  const homeLabel = new PIXI.Text({
    text: "ANKARA",
    style: { fill: 0xcfd6c8, fontSize: 12, fontWeight: "700", fontFamily: "system-ui, sans-serif", letterSpacing: 2.4 },
  });
  homeLabel.anchor.set(0.5, 0);
  homeLabel.x = cx;
  homeLabel.y = cy + 92;
  layer.addChild(homeLabel);
  for (const a of model.axes) {
    const [x, y] = a.at;
    const c = new PIXI.Container();
    c.x = x;
    c.y = y;
    if (a.pending) {
      const ring = new PIXI.Graphics();
      dashedCircle(ring, 0, 0, 34, [4, 4], { width: 2, color: 0xe9d38a });
      c.addChild(ring);
    }
    const focused = interaction.focusAxis === a.id;
    const hovered = interaction.hoverAxis === a.id;
    const disc = new PIXI.Graphics();
    const discColor = hovered ? lighten(rgbToHex(a.color), 0.18) : rgbToHex(a.color);
    disc.circle(0, 0, 27).fill(discColor).stroke({ width: a.selected || focused ? 3 : 3, color: a.selected || focused ? 0xf1ead2 : 0x0b1519 });
    c.addChild(disc);
    const code = new PIXI.Text({ text: a.code, style: { fill: 0x0b1210, fontSize: 13, fontWeight: "700", fontFamily: "system-ui, sans-serif", letterSpacing: 0.8 } });
    code.anchor.set(0.5);
    c.addChild(code);
    const value = new PIXI.Text({
      text: String(Math.round(a.value)),
      style: { fill: 0xe9e6d6, fontSize: 13, fontWeight: "700", fontFamily: "Georgia, serif", stroke: { color: 0x0b1519, width: 3 } },
    });
    value.anchor.set(0.5, 0);
    value.y = 46;
    c.addChild(value);
    layer.addChild(c);
  }
}

function dashedCircle(g, cx, cy, r, pattern, style) {
  const steps = Math.max(16, Math.round(r / 3));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  for (let i = 0; i < pts.length - 1; i++) dashedLine(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pattern, style);
}

// --- Overlay lifecycle: one canvas, reused for whichever map is on screen -
let container = null;
let scene = null; // { app, PIXI, layer, view, render, destroy }
let sceneKind = null; // "regions" | "foreign" | null
let mountingKind = null;
let mountingPromise = null;
let supported = null; // null = not probed yet, else boolean
let wiredRoot = null;
const interaction = { hoverRegion: null, focusRegion: null, hoverAxis: null, focusAxis: null };

// app.js's `root` is `document.body` itself, and `draw()` sets
// `root.innerHTML = ...` on every render -- that wipes ALL of body's
// children, including anything mounted outside app.js's own markup. So this
// container has to be re-attached after every single draw(), not just once:
// `container` (and the live canvas/WebGL context inside it) survives being
// detached -- DOM detachment doesn't destroy a canvas's rendering context --
// this just moves the same node back in once app.js is done rebuilding.
function ensureContainer() {
  if (!container) {
    container = document.createElement("div");
    container.className = "devlet-map-pixi-overlay";
    Object.assign(container.style, { position: "absolute", pointerEvents: "none", zIndex: "1", display: "none" });
  }
  if (!container.isConnected) document.body.appendChild(container);
  return container;
}

async function mountScene(viewEl, view) {
  const adapter = await loadAdapter();
  if (!adapter) return null;
  const rect = viewEl.getBoundingClientRect();
  const el = ensureContainer();
  let layer;
  const handle = await adapter.mountPixiScene({
    container: el,
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
    build({ app, PIXI }) {
      layer = new PIXI.Container();
      app.stage.addChild(layer);
    },
  });
  if (!handle) return null;
  if (rect.width > 0) handle.app.stage.scale.set(rect.width / view.w, rect.height / view.h);
  return { ...handle, layer, view };
}

async function ensureScene(kind, viewEl) {
  if (sceneKind === kind && scene) return scene;
  if (mountingKind === kind) return mountingPromise;
  if (scene) {
    scene.destroy();
    scene = null;
    sceneKind = null;
  }
  mountingKind = kind;
  mountingPromise = (async () => {
    if (supported === null) supported = await supportsDevletPixi();
    if (!supported) return null;
    return mountScene(viewEl, kind === "regions" ? REGIONS_VIEW : FOREIGN_VIEW);
  })();
  const built = await mountingPromise;
  if (mountingKind === kind) {
    scene = built;
    sceneKind = built ? kind : null;
    mountingKind = null;
  }
  return built;
}

function positionOverlay(viewEl) {
  const el = ensureContainer();
  const rect = viewEl.getBoundingClientRect();
  el.style.left = `${rect.left + window.scrollX}px`;
  el.style.top = `${rect.top + window.scrollY}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  if (!scene) return;
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (scene.app.renderer.width !== w || scene.app.renderer.height !== h) {
    scene.app.renderer.resize(w, h);
    scene.app.stage.scale.set(rect.width / scene.view.w, rect.height / scene.view.h);
  }
}

function repaint(s, mapSel) {
  if (!scene) return;
  const mobile = window.matchMedia("(max-width: 520px)").matches;
  if (sceneKind === "regions") paintRegions(scene.PIXI, scene.layer, regionsRenderModel(s, { selected: mapSel.region, metric: mapSel.metric }), interaction, mobile);
  else if (sceneKind === "foreign") paintForeign(scene.PIXI, scene.layer, foreignRenderModel(s, { selected: mapSel.axis }), interaction);
  scene.render();
}

// Delegated on `root` itself (a fixed node app.js never replaces, only its
// children) so hover/focus keep working across every full-string re-render,
// without re-binding listeners on the transient svg elements each redraws.
function wireRootInteraction(root, sync) {
  if (wiredRoot === root) return;
  wiredRoot = root;
  const set = (key, value) => {
    if (interaction[key] === value) return;
    interaction[key] = value;
    repaint(sync.state(), sync.mapSel());
  };
  root.addEventListener("pointerover", (e) => {
    const region = e.target.closest?.("[data-region]");
    if (region) set("hoverRegion", region.dataset.region);
    const axis = e.target.closest?.("[data-axis]");
    if (axis) set("hoverAxis", axis.dataset.axis);
  });
  root.addEventListener("pointerout", (e) => {
    const region = e.target.closest?.("[data-region]");
    if (region && !(e.relatedTarget && region.contains(e.relatedTarget))) set("hoverRegion", null);
    const axis = e.target.closest?.("[data-axis]");
    if (axis && !(e.relatedTarget && axis.contains(e.relatedTarget))) set("hoverAxis", null);
  });
  root.addEventListener("focusin", (e) => {
    const region = e.target.closest?.("[data-region]");
    if (region) set("focusRegion", region.dataset.region);
    const axis = e.target.closest?.("[data-axis]");
    if (axis) set("focusAxis", axis.dataset.axis);
  });
  root.addEventListener("focusout", (e) => {
    const region = e.target.closest?.("[data-region]");
    if (region && interaction.focusRegion === region.dataset.region) set("focusRegion", null);
    const axis = e.target.closest?.("[data-axis]");
    if (axis && interaction.focusAxis === axis.dataset.axis) set("focusAxis", null);
  });
}

async function syncAsync(root, s, mapSel) {
  const viewEl = root.querySelector("svg.geo-map") || root.querySelector("svg.dip-map");
  if (!viewEl) {
    if (container) container.style.display = "none";
    return;
  }
  if (supported === false) return;
  wireRootInteraction(root, { state: () => s, mapSel: () => mapSel });
  const kind = viewEl.classList.contains("geo-map") ? "regions" : "foreign";
  if (kind !== sceneKind || !scene) {
    const built = await ensureScene(kind, viewEl);
    // `root` may have been rebuilt again while the mount was in flight; only
    // adopt the result if the same map kind is still the one on screen.
    const stillCurrent = root.querySelector(kind === "regions" ? "svg.geo-map" : "svg.dip-map");
    if (!built || !stillCurrent) return;
  }
  const freshViewEl = root.querySelector(sceneKind === "regions" ? "svg.geo-map" : "svg.dip-map");
  if (!scene || !freshViewEl) return;
  ensureContainer().style.display = "block";
  positionOverlay(freshViewEl);
  repaint(s, mapSel);
}

/**
 * Called at the end of app.js's `draw(session)`. Fire-and-forget: `draw()`
 * stays synchronous, this just positions/paints the persistent overlay (or
 * hides it, on a screen with no map) to match whatever `root` now shows.
 */
export function syncDevletMapOverlay(root, s, mapSel) {
  syncAsync(root, s, mapSel).catch((err) => console.error("[devlet-map-pixi] sync failed:", err));
}
