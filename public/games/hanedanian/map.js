import { isArmyVisible } from './engine.js';
import { TERRAINS, POIS } from './data.js';

// World coordinates are tile edges; a settlement sits at (x + .5, y + .5).
// The map never mutates campaign state. A gesture updates the camera only.
const TILE = 56;
const MAX_ZOOM = 2.6;
const TAU = Math.PI * 2;
const COLORS = {
  paper: '#d8c8a5', ink: '#2b2925', muted: '#6f6658', player: '#244b3a',
  plain: '#b9aa7f', forest: '#405b43', mountain: '#696b68', ore: '#765f50',
  valley: '#6f8570', road: '#b9935c', pass: '#89847a', arid: '#b79a67',
  steppe: '#958e63', water: '#456f70', waterLight: '#91b0a4', stone: '#565a59',
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const sameTile = (a, b) => a?.x === b?.x && a?.y === b?.y;
const pointDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const variation = (x, y) => ((Math.imul(x + 31, 73856093) ^ Math.imul(y + 17, 19349663)) >>> 0) / 4294967295;

export function worldAtScreen(point, view) {
  const scale = TILE * view.zoom;
  return { x: view.center.x + (point.x - view.width / 2) / scale, y: view.center.y + (point.y - view.height / 2) / scale };
}

export function zoomAtPoint(view, zoom, point) {
  const anchor = worldAtScreen(point, view);
  return { zoom, center: { x: anchor.x - (point.x - view.width / 2) / (TILE * zoom), y: anchor.y - (point.y - view.height / 2) / (TILE * zoom) } };
}

export function visibleTileBounds(view, size, buffer = 1) {
  const left = worldAtScreen({ x: 0, y: 0 }, view);
  const right = worldAtScreen({ x: view.width, y: view.height }, view);
  return { minX: clamp(Math.floor(left.x) - buffer, 0, size - 1), minY: clamp(Math.floor(left.y) - buffer, 0, size - 1), maxX: clamp(Math.floor(right.x) + buffer, 0, size - 1), maxY: clamp(Math.floor(right.y) + buffer, 0, size - 1) };
}

function path(ctx, points, close = false) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  if (close) ctx.closePath();
}

export class StrategyMap {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('Bu tarayıcı harita çizimini desteklemiyor.');
    this.options = options;
    this.width = 1;
    this.height = 1;
    this.zoom = 1;
    this.center = { x: 24.5, y: 24.5 };
    this.selected = null;
    this.hover = null;
    this.state = null;
    this.pointers = new Map();
    this.gesture = null;
    this.frame = null;
    this.lastRenderMs = 0;
    this.drawnTiles = 0;
    this.listeners = [];
    this.disposed = false;
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.cursor = 'grab';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-roledescription', 'Etkileşimli strateji haritası');
    this.updateAccessibleLabel();
    this.listen(canvas, 'pointerdown', (e) => this.pointerDown(e));
    this.listen(canvas, 'pointermove', (e) => this.pointerMove(e));
    this.listen(canvas, 'pointerup', (e) => this.pointerEnd(e, false));
    this.listen(canvas, 'pointercancel', (e) => this.pointerEnd(e, true));
    this.listen(canvas, 'lostpointercapture', (e) => this.pointerEnd(e, true));
    this.listen(canvas, 'pointerleave', () => { if (!this.pointers.size) this.setHover(null); });
    this.listen(canvas, 'wheel', (e) => this.wheel(e), { passive: false });
    this.listen(canvas, 'keydown', (e) => this.keyDown(e));
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault());
    this.listen(window, 'blur', () => this.cancelGesture());
    this.listen(document, 'visibilitychange', () => { if (document.hidden) this.cancelGesture(); else this.invalidate(); });
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(canvas);
    }
    this.listen(window, 'resize', () => this.resize());
    this.resize();
  }

  listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this.listeners.push(() => target.removeEventListener(event, handler, options));
  }

  get minZoom() { return Math.min(0.55, Math.max(0.065, Math.min(this.width, this.height) / ((this.state?.world.size || 49) * TILE + 80))); }
  get mode() { return this.zoom <= Math.max(.28, this.minZoom * 1.12) ? 'world' : this.zoom < 0.76 ? 'region' : 'near'; }

  getView() {
    return { width: this.width, height: this.height, zoom: this.zoom, mode: this.mode, center: { ...this.center }, selected: this.selected ? { ...this.selected } : null, drawnTiles: this.drawnTiles, lastRenderMs: this.lastRenderMs };
  }

  setState(state) {
    const first = !this.state;
    const changedWorld = !this.state || this.state.world !== state.world;
    this.state = state;
    this.settlements = new Map((state.settlements || []).map((s) => [`${s.x},${s.y}`, s]));
    this.factions = new Map((state.factions || []).map((f) => [f.id, f]));
    // Visibility is simulation-dependent, so calculate once per state update,
    // never scan all watchtowers for every army on every pan/pinch frame.
    this.visibleArmies = (state.armies || []).filter((army) => isArmyVisible(state, army));
    if (changedWorld) {
      this.minimapTerrain = null;
      // The generator's river valley is several tiles wide. Draw its centerline,
      // not a mesh connecting every fertile tile (which would suggest many rivers).
      this.riverPoints = [];
      for (let y = 0; y < state.world.size; y++) {
        let start = -1, bestStart = -1, bestLength = 1;
        for (let x = 0; x <= state.world.size; x++) {
          if (this.tile(x, y)?.terrain === 'valley') { if (start < 0) start = x; }
          else if (start >= 0) {
            if (x - start > bestLength) { bestStart = start; bestLength = x - start; }
            start = -1;
          }
        }
        if (bestStart >= 0) this.riverPoints.push({ x: bestStart + (bestLength - 1) / 2, y });
      }
    }
    if (first) {
      const home = state.settlements.find((s) => s.ownerId === state.playerId);
      if (home) this.center = { x: home.x + .5, y: home.y + .5 };
    }
    if (this.selected && !this.tile(this.selected.x, this.selected.y)) this.selected = null;
    this.clampView();
    this.updateAccessibleLabel();
    this.invalidate();
  }

  tile(x, y) {
    const world = this.state?.world;
    if (!world || x < 0 || y < 0 || x >= world.size || y >= world.size) return null;
    return world.tiles[y * world.size + x] || null;
  }

  tileToScreen(x, y) {
    return { x: this.width / 2 + (x + .5 - this.center.x) * TILE * this.zoom, y: this.height / 2 + (y + .5 - this.center.y) * TILE * this.zoom };
  }

  screenToTile(x, y) {
    const p = worldAtScreen({ x, y }, this.getView());
    return this.tile(Math.floor(p.x), Math.floor(p.y));
  }

  select(x, y, { notify = true, focus = false } = {}) {
    const tile = x == null || y == null ? null : this.tile(Math.floor(x), Math.floor(y));
    this.selected = tile ? { x: tile.x, y: tile.y } : null;
    if (focus && tile) this.focus(tile.x, tile.y);
    this.updateAccessibleLabel();
    this.invalidate();
    if (notify) this.options.onSelect?.(tile);
    return tile;
  }

  focus(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.center = { x: x + .5, y: y + .5 };
    this.clampView();
    this.invalidate();
  }

  setZoom(level) {
    const levels = { near: 1.22, region: .52, world: this.minZoom };
    const next = typeof level === 'string' ? levels[level] : level;
    if (!Number.isFinite(next)) return;
    this.zoom = clamp(next, this.minZoom, MAX_ZOOM);
    if (level === 'world' && this.state) this.center = { x: this.state.world.size / 2, y: this.state.world.size / 2 };
    this.clampView();
    this.invalidate();
  }

  zoomBy(factor, point = { x: this.width / 2, y: this.height / 2 }) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const next = zoomAtPoint(this.getView(), clamp(this.zoom * factor, this.minZoom, MAX_ZOOM), point);
    this.zoom = next.zoom;
    this.center = next.center;
    this.clampView();
    this.invalidate();
  }

  clampView() {
    const size = this.state?.world.size || 49;
    this.zoom = clamp(this.zoom, this.minZoom, MAX_ZOOM);
    for (const [key, pixels] of [['x', this.width], ['y', this.height]]) {
      const half = pixels / (2 * TILE * this.zoom);
      // At world view center the complete map; at close view allow a modest margin.
      this.center[key] = half >= size / 2 ? size / 2 : clamp(this.center[key], half - .8, size - half + .8);
    }
  }

  resize() {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(this.width * this.dpr);
    const height = Math.round(this.height * this.dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.clampView();
    this.invalidate();
  }

  localPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  inMinimap(p) {
    const r = this.minimapRect;
    return r && p.x >= r.x && p.x <= r.x + r.size && p.y >= r.y && p.y <= r.y + r.size;
  }

  minimapFocus(p) {
    const r = this.minimapRect;
    if (!r || !this.state) return;
    this.center = { x: clamp((p.x - r.x) / r.size, 0, 1) * this.state.world.size, y: clamp((p.y - r.y) / r.size, 0, 1) * this.state.world.size };
    this.clampView();
    this.invalidate();
  }

  pointerDown(event) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    event.preventDefault();
    const p = this.localPoint(event);
    this.canvas.focus({ preventScroll: true });
    try { this.canvas.setPointerCapture(event.pointerId); } catch { /* Detached canvas. */ }
    this.pointers.set(event.pointerId, p);
    this.setHover(null);
    if (this.pointers.size === 1) {
      this.gesture = { start: p, previous: p, center: { ...this.center }, moved: false, blocked: false, minimap: this.inMinimap(p) };
      if (this.gesture.minimap) this.minimapFocus(p);
    } else {
      this.gesture.blocked = true;
      this.gesture.moved = true;
      this.gesture.minimap = false;
      this.beginPinch();
    }
    this.canvas.style.cursor = 'grabbing';
  }

  beginPinch() {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return;
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.pinch = { distance: Math.max(1, pointDistance(a, b)), zoom: this.zoom, anchor: worldAtScreen(middle, this.getView()) };
  }

  pointerMove(event) {
    const p = this.localPoint(event);
    if (!this.pointers.has(event.pointerId)) {
      if (event.pointerType !== 'touch' && !this.pointers.size) this.setHover(this.inMinimap(p) ? null : this.screenToTile(p.x, p.y), p);
      return;
    }
    event.preventDefault();
    this.pointers.set(event.pointerId, p);
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (!this.pinch) this.beginPinch();
      this.zoom = clamp(this.pinch.zoom * pointDistance(a, b) / this.pinch.distance, this.minZoom, MAX_ZOOM);
      this.center = { x: this.pinch.anchor.x - (mid.x - this.width / 2) / (TILE * this.zoom), y: this.pinch.anchor.y - (mid.y - this.height / 2) / (TILE * this.zoom) };
    } else if (this.gesture) {
      if (this.gesture.minimap) { this.minimapFocus(p); return; }
      if (pointDistance(p, this.gesture.start) > 6) this.gesture.moved = true;
      if (!this.gesture.moved) return;
      this.center = { x: this.gesture.center.x - (p.x - this.gesture.start.x) / (TILE * this.zoom), y: this.gesture.center.y - (p.y - this.gesture.start.y) / (TILE * this.zoom) };
    }
    this.clampView();
    this.invalidate();
  }

  pointerEnd(event, cancelled) {
    if (!this.pointers.has(event.pointerId)) return;
    const point = this.localPoint(event);
    const shouldSelect = !cancelled && this.pointers.size === 1 && this.gesture && !this.gesture.moved && !this.gesture.blocked && !this.gesture.minimap && pointDistance(point, this.gesture.start) <= 6;
    this.pointers.delete(event.pointerId);
    try { if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId); } catch { /* Capture already released. */ }
    if (this.pointers.size === 1) {
      const remaining = [...this.pointers.values()][0];
      this.gesture = { start: remaining, previous: remaining, center: { ...this.center }, moved: false, blocked: true, minimap: false };
      this.pinch = null;
    } else if (this.pointers.size >= 2) this.beginPinch();
    else {
      this.gesture = null;
      this.pinch = null;
      this.canvas.style.cursor = 'grab';
    }
    if (shouldSelect) {
      const tile = this.screenToTile(point.x, point.y);
      this.select(tile?.x ?? null, tile?.y ?? null);
    }
  }

  cancelGesture() {
    const ids = [...this.pointers.keys()];
    this.pointers.clear();
    this.gesture = null;
    this.pinch = null;
    for (const id of ids) { try { this.canvas.releasePointerCapture(id); } catch { /* Nothing captured. */ } }
    this.canvas.style.cursor = 'grab';
  }

  wheel(event) {
    event.preventDefault();
    const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1;
    this.zoomBy(Math.exp(-clamp(event.deltaY * multiplier, -200, 200) * .0022), this.localPoint(event));
  }

  keyDown(event) {
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      const [dx, dy] = arrows[event.key];
      const current = this.selected || { x: Math.floor(this.center.x), y: Math.floor(this.center.y) };
      const size = this.state?.world.size || 49;
      const x = clamp(current.x + dx * (event.shiftKey ? 5 : 1), 0, size - 1);
      const y = clamp(current.y + dy * (event.shiftKey ? 5 : 1), 0, size - 1);
      this.select(x, y);
      const p = this.tileToScreen(x, y);
      if (p.x < 44 || p.x > this.width - 44 || p.y < 44 || p.y > this.height - 44) this.focus(x, y);
    } else if (event.key === 'Escape') { event.preventDefault(); this.select(null, null); }
    else if (event.key === '+' || event.key === '=' || event.key === 'PageUp') { event.preventDefault(); this.zoomBy(1.3); }
    else if (event.key === '-' || event.key === '_' || event.key === 'PageDown') { event.preventDefault(); this.zoomBy(1 / 1.3); }
    else if (event.key === 'Home') {
      event.preventDefault();
      const home = this.state?.settlements.find((s) => s.ownerId === this.state.playerId);
      if (home) this.select(home.x, home.y, { focus: true });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.select(this.selected?.x ?? Math.floor(this.center.x), this.selected?.y ?? Math.floor(this.center.y));
    }
  }

  setHover(tile, point) {
    if (sameTile(this.hover, tile)) return;
    this.hover = tile ? { x: tile.x, y: tile.y } : null;
    this.options.onHover?.(tile, point || null);
    this.invalidate();
  }

  updateAccessibleLabel() {
    const tile = this.selected && this.tile(this.selected.x, this.selected.y);
    const settlement = tile && this.settlements?.get(`${tile.x},${tile.y}`);
    const current = tile ? `Seçili: ${settlement?.name || POIS[tile.poi?.type]?.label || TERRAINS[tile.terrain]?.label || 'Arazi'}, ${tile.x}, ${tile.y}. ` : '';
    this.canvas.setAttribute('aria-label', `HANEDANIAN haritası. ${current}Ok tuşlarıyla karo seçin; artı ve eksi ile yakınlaşın; Home ile başkente dönün; Escape ile seçimi kaldırın.`);
  }

  invalidate() {
    if (this.frame !== null || this.disposed || document.hidden) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (!this.disposed) this.draw();
    });
  }

  draw() {
    const started = performance.now();
    const ctx = this.ctx;
    ctx.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, this.width, this.height);
    if (!this.state) return;
    this.drawnTiles = 0;
    const scale = TILE * this.zoom;
    const ox = this.width / 2 - this.center.x * scale;
    const oy = this.height / 2 - this.center.y * scale;
    const bounds = visibleTileBounds(this.getView(), this.state.world.size);
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, this.state.world.size * scale, this.state.world.size * scale);
    ctx.clip();
    for (let y = bounds.minY; y <= bounds.maxY; y++) for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const tile = this.tile(x, y);
      if (!tile) continue;
      this.drawTerrain(tile, ox + x * scale, oy + y * scale, scale);
      this.drawnTiles++;
    }
    this.drawConnections(bounds, ox, oy, scale);
    if (this.mode !== 'near') this.drawInfluence(scale);
    this.drawHighlights(scale);
    for (let y = bounds.minY; y <= bounds.maxY; y++) for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const tile = this.tile(x, y);
      if (tile?.poi && !this.settlements.has(`${x},${y}`)) this.drawPoi(tile, scale);
    }
    this.drawSettlements(scale);
    this.drawArmies(scale);
    this.drawMarkers(scale);
    ctx.restore();
    ctx.strokeStyle = '#a7ad98';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, this.state.world.size * scale, this.state.world.size * scale);
    this.drawCompass();
    this.drawScale(scale);
    this.drawMinimap();
    this.lastRenderMs = Math.round((performance.now() - started) * 100) / 100;
    this.canvas.dataset.drawnTiles = String(this.drawnTiles);
    this.canvas.dataset.renderMs = String(this.lastRenderMs);
    this.canvas.dataset.mapMode = this.mode;
    this.canvas.dataset.zoom = this.zoom.toFixed(3);
    this.canvas.dataset.center = `${this.center.x.toFixed(3)},${this.center.y.toFixed(3)}`;
    this.options.onViewChange?.(this.getView());
  }

  drawTerrain(tile, x, y, size) {
    const ctx = this.ctx;
    const v = variation(tile.x, tile.y);
    ctx.fillStyle = COLORS[tile.terrain] || COLORS.plain;
    ctx.fillRect(x, y, size + .6, size + .6);
    // Low-cost deterministic tint gives each province material depth without assets.
    ctx.fillStyle = v > .5 ? `rgba(238,220,176,${(v - .5) * .18})` : `rgba(31,35,30,${(.5 - v) * .15})`;
    ctx.fillRect(x, y, size + .6, size + .6);
    // At world zoom, deterministic ink washes break generator bands into an
    // atlas-like surface without changing a single terrain tile or hit area.
    if (size >= 4) {
      ctx.save();
      ctx.globalAlpha = .10;
      ctx.fillStyle = v > .5 ? '#efe0b9' : '#1e2923';
      for (let i = 0; i < 3; i++) {
        const px = x + (((tile.x * 17 + tile.y * 31 + i * 23) % 41) / 41) * size;
        const py = y + (((tile.x * 29 + tile.y * 13 + i * 19) % 43) / 43) * size;
        ctx.beginPath();
        ctx.ellipse(px, py, Math.max(1, size * (.18 + i * .035)), Math.max(.7, size * .09), v * Math.PI, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      const edges = [
        [-1, 0, [[0, 0], [.15, .12], [.08, .42], [.18, .71], [0, 1]]],
        [1, 0, [[1, 0], [.86, .16], [.94, .43], [.82, .76], [1, 1]]],
        [0, -1, [[0, 0], [.18, .14], [.48, .07], [.76, .17], [1, 0]]],
        [0, 1, [[0, 1], [.23, .86], [.51, .94], [.79, .83], [1, 1]]],
      ];
      ctx.save(); ctx.globalAlpha = .24;
      for (const [dx, dy, points] of edges) {
        const neighbor = this.tile(tile.x + dx, tile.y + dy);
        if (!neighbor || neighbor.terrain === tile.terrain) continue;
        ctx.fillStyle = COLORS[neighbor.terrain] || COLORS.plain;
        path(ctx, points.map(([px, py]) => [x + px * size, y + py * size]), true);
        ctx.fill();
      }
      ctx.restore();
    }
    if (size < 22) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 56, size / 56);
    ctx.lineWidth = .7;
    ctx.lineCap = 'round';
    if (tile.terrain === 'forest') {
      for (let i = 0; i < 4; i++) {
        const tx = 11 + (i % 2) * 26 + v * 4;
        const ty = 14 + Math.floor(i / 2) * 23 - v * 4;
        ctx.strokeStyle = '#203d30';
        path(ctx, [[tx, ty + 8], [tx, ty - 3]]); ctx.stroke();
        ctx.fillStyle = i % 2 ? '#4c684c' : '#34543d';
        path(ctx, [[tx - 6, ty + 3], [tx, ty - 8], [tx + 6, ty + 3]], true); ctx.fill();
        ctx.strokeStyle = '#233d2e'; path(ctx, [[tx - 4, ty + 6], [tx, ty - 1], [tx + 4, ty + 6]]); ctx.stroke();
      }
    } else if (['mountain', 'ore', 'pass'].includes(tile.terrain)) {
      ctx.strokeStyle = '#444746';
      for (let line = 0; line < 3; line++) {
        ctx.beginPath();
        ctx.moveTo(3, 43 + line * 5);
        ctx.bezierCurveTo(12, 32 + line * 3, 18, 10 + line * 6, 28, 13 + line * 7);
        ctx.bezierCurveTo(41, 13 + line * 7, 38, 36 + line * 3, 53, 38 + line * 5);
        ctx.stroke();
      }
      ctx.fillStyle = tile.terrain === 'ore' ? '#684f43' : '#777974';
      path(ctx, [[15, 38], [28, 14], [42, 40], [29, 33]], true); ctx.fill();
      ctx.fillStyle = '#c9c0aa'; path(ctx, [[23, 23], [28, 14], [33, 23], [29, 21], [26, 25]], true); ctx.fill();
      if (tile.terrain === 'ore') {
        ctx.fillStyle = '#897061';
        path(ctx, [[39, 43], [42, 35], [48, 38], [46, 46]], true); ctx.fill();
      }
    } else if (tile.terrain === 'plain') {
      ctx.strokeStyle = '#766f4e';
      for (let i = 0; i < 4; i++) { path(ctx, [[10, 18 + i * 6], [43, 13 + i * 6]]); ctx.stroke(); }
      ctx.strokeStyle = '#d2bd86';
      path(ctx, [[15, 10], [19, 43]]); ctx.stroke();
    } else if (tile.terrain === 'arid' || tile.terrain === 'steppe') {
      ctx.strokeStyle = tile.terrain === 'arid' ? '#846f4c' : '#66643f';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(6 + i * 4, 14 + i * 13);
        ctx.quadraticCurveTo(25, 7 + i * 13, 47 - i * 4, 17 + i * 13); ctx.stroke();
      }
    } else if (tile.terrain === 'valley') {
      ctx.strokeStyle = '#3f6554';
      for (let i = 0; i < 3; i++) { path(ctx, [[7 + i * 15, 39], [9 + i * 15, 34], [12 + i * 15, 38]]); ctx.stroke(); }
    }
    if (size > 40) {
      // Two contour strokes make close zoom read like a surveyed atlas.
      ctx.strokeStyle = 'rgba(43,35,29,.22)';
      ctx.beginPath(); ctx.moveTo(2, 47 - v * 8); ctx.bezierCurveTo(14, 39, 31, 51, 54, 40 - v * 5); ctx.stroke();
      ctx.strokeStyle = 'rgba(235,214,171,.20)';
      ctx.beginPath(); ctx.moveTo(1, 7 + v * 8); ctx.bezierCurveTo(18, 14, 35, 3, 55, 15 + v * 3); ctx.stroke();
      ctx.strokeStyle = 'rgba(45,37,29,.16)';
      for (let h = 0; h < 3; h++) { const o = 5 + ((tile.x * 11 + tile.y * 7 + h * 13) % 43); path(ctx, [[o - 8, 54], [o + 10, 2]]); ctx.stroke(); }
    }
    ctx.restore();
  }

  drawConnections(bounds, ox, oy, scale) {
    const ctx = this.ctx;
    if (this.riverPoints?.length > 1) {
      ctx.beginPath();
      for (let i = 1; i < this.riverPoints.length; i++) {
        const a = this.riverPoints[i - 1], b = this.riverPoints[i];
        if (b.y - a.y > 3 || b.y < bounds.minY - 1 || a.y > bounds.maxY + 1) continue;
        const ax = ox + (a.x + .5) * scale, ay = oy + (a.y + .5) * scale;
        const bx = ox + (b.x + .5) * scale, by = oy + (b.y + .5) * scale;
        ctx.moveTo(ax, ay);
        ctx.bezierCurveTo(ax, (ay + by) / 2, bx, (ay + by) / 2, bx, by);
      }
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(4, scale * .34); ctx.strokeStyle = 'rgba(31,43,39,.38)'; ctx.stroke();
      ctx.lineWidth = Math.max(3, scale * .27); ctx.strokeStyle = '#294d4d'; ctx.stroke();
      ctx.lineWidth = Math.max(1, scale * .14); ctx.strokeStyle = COLORS.water; ctx.stroke();
      ctx.lineWidth = Math.max(.7, scale * .045); ctx.strokeStyle = COLORS.waterLight; ctx.stroke();
    }
    for (const terrain of ['road']) {
      ctx.strokeStyle = 'rgba(54,37,25,.65)';
      ctx.lineWidth = Math.max(3, scale * .12);
      ctx.lineCap = 'round';
      ctx.setLineDash(terrain === 'road' && scale > 18 ? [scale * .08, scale * .08] : []);
      ctx.beginPath();
      for (let y = bounds.minY; y <= bounds.maxY; y++) for (let x = bounds.minX; x <= bounds.maxX; x++) {
        if (this.tile(x, y)?.terrain !== terrain) continue;
        const px = ox + (x + .5) * scale, py = oy + (y + .5) * scale;
        let connected = false;
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
          if (this.tile(x + dx, y + dy)?.terrain !== terrain) continue;
          ctx.moveTo(px, py); ctx.lineTo(px + dx * scale, py + dy * scale); connected = true;
        }
        if (!connected) { ctx.moveTo(px - .15 * scale, py + .09 * scale); ctx.lineTo(px + .15 * scale, py - .09 * scale); }
      }
      ctx.stroke();
      ctx.strokeStyle = '#c6a56d';
      ctx.lineWidth = Math.max(1, scale * .055);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  factionColor(id) { return this.factions.get(id)?.color || (id === this.state.playerId ? COLORS.player : '#946350'); }

  drawInfluence(scale) {
    const ctx = this.ctx;
    for (const settlement of this.state.settlements) {
      const p = this.tileToScreen(settlement.x, settlement.y);
      const radius = scale * 2.2;
      if (p.x + radius < 0 || p.y + radius < 0 || p.x - radius > this.width || p.y - radius > this.height) continue;
      ctx.save();
      ctx.globalAlpha = .10;
      ctx.fillStyle = this.factionColor(settlement.ownerId);
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.fill();
      ctx.globalAlpha = .36;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = .8;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawHighlights(scale) {
    const ctx = this.ctx;
    for (const [tile, selected] of [[this.hover, false], [this.selected, true]]) {
      if (!tile) continue;
      const p = this.tileToScreen(tile.x, tile.y);
      const size = Math.max(12, scale - 2);
      ctx.fillStyle = selected ? 'rgba(42,87,66,.13)' : 'rgba(255,255,241,.23)';
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      ctx.strokeStyle = selected ? '#2d5945' : '#7c876c';
      ctx.lineWidth = selected ? 2.5 : 1;
      ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
      if (selected) {
        ctx.strokeStyle = '#fff7cf'; ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x - size / 2 - 2, p.y - size / 2 - 2, size + 4, size + 4);
        const c = Math.max(4, Math.min(9, size * .18));
        ctx.strokeStyle = '#9b4b32'; ctx.lineWidth = 2;
        for (const [sx, sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
          const cx = p.x + sx * (size / 2 + 5), cy = p.y + sy * (size / 2 + 5);
          ctx.beginPath(); ctx.moveTo(cx - sx * c, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy - sy * c); ctx.stroke();
        }
      }
    }
  }

  drawPoi(tile, scale) {
    const ctx = this.ctx;
    const poi = tile.poi;
    const p = this.tileToScreen(tile.x, tile.y);
    if (this.mode === 'world' && !poi.ownerId && !['caravanserai', 'watchtower', 'ruins'].includes(poi.type)) return;
    const r = clamp(scale * .20, 3, 12);
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(36,56,43,.16)'; ctx.beginPath(); ctx.arc(0, 1, r + 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ece8d3';
    ctx.strokeStyle = poi.ownerId ? this.factionColor(poi.ownerId) : '#817b62';
    ctx.lineWidth = poi.ownerId ? 2 : 1;
    path(ctx, [[0, -r - 2], [r + 2, 0], [0, r + 2], [-r - 2, 0]], true); ctx.fill(); ctx.stroke();
    if (scale > 27) {
      ctx.strokeStyle = '#696e56'; ctx.lineWidth = 1.5;
      if (poi.type === 'watchtower' || poi.type === 'ruins' || poi.type === 'caravanserai') {
        ctx.strokeRect(-r * .4, -r * .5, r * .8, r * 1.1);
        path(ctx, [[-r * .65, -r * .5], [r * .65, -r * .5], [r * .65, -r * .8]]); ctx.stroke();
      } else if (poi.type === 'forest') {
        path(ctx, [[-r * .55, r * .3], [0, -r * .65], [r * .55, r * .3]], true); ctx.stroke();
        path(ctx, [[0, r * .2], [0, r * .65]]); ctx.stroke();
      } else if (poi.type === 'pasture') {
        for (const px of [-4, 0, 4]) { path(ctx, [[px, 5], [px, -4], [px - 2, -2]]); ctx.stroke(); }
      } else {
        path(ctx, [[-r * .65, r * .45], [0, -r * .65], [r * .65, r * .45]], true); ctx.stroke();
      }
    }
    ctx.restore();
    if (scale >= 48 && (sameTile(this.hover, tile) || sameTile(this.selected, tile))) this.label(POIS[poi.type]?.label || 'Stratejik nokta', p.x, p.y + r + 16, false);
  }

  drawSettlements(scale) {
    const ctx = this.ctx;
    const labels = [];
    const sorted = [...this.state.settlements].sort((a, b) => Number(a.ownerId === this.state.playerId) - Number(b.ownerId === this.state.playerId));
    for (const settlement of sorted) {
      const p = this.tileToScreen(settlement.x, settlement.y);
      if (p.x < -70 || p.y < -70 || p.x > this.width + 70 || p.y > this.height + 70) continue;
      const own = settlement.ownerId === this.state.playerId;
      const color = this.factionColor(settlement.ownerId);
      const r = clamp(scale * .34, 5, 22);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(55,64,47,.14)';
      ctx.beginPath(); ctx.ellipse(1, r * .49, r * 1.1, r * .42, 0, 0, TAU); ctx.fill();
      if (scale < 25) {
        ctx.fillStyle = '#f6f1dc'; ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, TAU); ctx.fill();
        ctx.fillStyle = color; ctx.fillRect(-r * .8, -r * .8, r * 1.6, r * 1.6);
        if (own) { ctx.strokeStyle = '#f8f3db'; ctx.lineWidth = 1; ctx.strokeRect(-r * .43, -r * .43, r * .86, r * .86); }
      } else {
        ctx.scale(r / 20, r / 20);
        // Small original Anatolian stone courtyard silhouette; no external assets.
        ctx.fillStyle = '#e5dfc7'; ctx.strokeStyle = '#737563'; ctx.lineWidth = 1;
        path(ctx, [[-18, 7], [-18, -7], [-10, -11], [10, -11], [18, -7], [18, 7], [0, 16]], true); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#b6b198'; path(ctx, [[0, 4], [18, -7], [18, 7], [0, 16]], true); ctx.fill();
        ctx.fillStyle = '#c6c0a7'; path(ctx, [[-18, -7], [0, 4], [0, 16], [-18, 7]], true); ctx.fill();
        ctx.fillStyle = '#eeead6'; ctx.fillRect(-8, -16, 15, 17);
        ctx.fillStyle = '#a87458'; path(ctx, [[-11, -16], [-1, -23], [11, -16], [4, -12]], true); ctx.fill();
        ctx.fillStyle = '#786f57'; ctx.fillRect(-2, -6, 5, 7);
        for (const tx of [-17, 12]) {
          ctx.fillStyle = '#ddd7bd'; ctx.fillRect(tx, -10, 6, 17);
          ctx.fillStyle = '#bbb399'; ctx.fillRect(tx, -12, 2, 4); ctx.fillRect(tx + 4, -12, 2, 4);
        }
        ctx.strokeStyle = '#5f6451'; ctx.lineWidth = 1.2; path(ctx, [[8, -14], [8, -32]]); ctx.stroke();
        ctx.fillStyle = color; path(ctx, [[8, -32], [23, -29], [8, -24]], true); ctx.fill();
        if (own) { ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, 6, 24, 15, 0, .1, Math.PI - .1); ctx.stroke(); }
      }
      ctx.restore();
      if (scale > 20 || own) {
        const text = settlement.name || 'Yerleşim';
        const labelY = p.y + r * .85 + 15;
        const maxWidth = this.mode === 'near' ? 150 : 112;
        const collision = labels.some((l) => Math.abs(l.x - p.x) < maxWidth && Math.abs(l.y - labelY) < 22);
        if (!collision || own || sameTile(this.selected, settlement)) {
          this.label(text, p.x, labelY, own, maxWidth);
          labels.push({ x: p.x, y: labelY });
        }
      }
    }
  }

  label(text, x, y, own = false, maxWidth = 150) {
    const ctx = this.ctx;
    ctx.font = `${own ? '700' : '600'} 11px ui-sans-serif, system-ui, sans-serif`;
    const width = Math.min(ctx.measureText(text).width, maxWidth) + 12;
    ctx.fillStyle = own ? 'rgba(242,240,221,.95)' : 'rgba(239,235,213,.88)';
    ctx.fillRect(x - width / 2, y - 11, width, 17);
    if (own) { ctx.fillStyle = COLORS.player; ctx.fillRect(x - width / 2, y - 11, 2, 17); }
    ctx.fillStyle = own ? '#244a39' : '#464e3d';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y + 1, maxWidth);
  }

  drawArmies(scale) {
    const ctx = this.ctx;
    for (const army of this.visibleArmies || []) {
      if (!army.from || !army.to) continue;
      const from = this.tileToScreen(army.from.x, army.from.y);
      const to = this.tileToScreen(army.to.x, army.to.y);
      const progress = clamp((this.state.time - army.departAt) / Math.max(1, army.arriveAt - army.departAt), 0, 1);
      const p = { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
      const color = this.factionColor(army.ownerId);
      if (army.ownerId === this.state.playerId) {
        ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = .55; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
        path(ctx, [[from.x, from.y], [to.x, to.y]]); ctx.stroke(); ctx.restore();
      }
      if (p.x < -14 || p.y < -14 || p.x > this.width + 14 || p.y > this.height + 14) continue;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(to.y - from.y, to.x - from.x));
      ctx.fillStyle = color; ctx.strokeStyle = '#fff5dc'; ctx.lineWidth = 1.7;
      path(ctx, [[8, 0], [-5, -5], [-2, 0], [-5, 5]], true); ctx.fill(); ctx.stroke(); ctx.restore();
      if (scale >= 40 && army.ownerId === this.state.playerId) {
        const mission = army.returning ? 'Dönüş' : ({ scout: 'Keşif', expand: 'Yerleşim', settle: 'Yerleşim', attack: 'Sefer', raid: 'Akın', trade: 'Ticaret', claim: 'Bağlama', reinforce: 'Takviye' }[army.mission] || 'Sefer');
        this.label(`${mission} · ${Math.max(0, Math.ceil(army.arriveAt - this.state.time))} dk`, p.x, p.y - 15, false, 110);
      }
    }
  }

  drawMarkers(scale) {
    const markers = this.state.settings?.markers;
    if (!Array.isArray(markers)) return;
    const ctx = this.ctx;
    for (const marker of markers.slice(0, 24)) {
      if (!marker || !Number.isInteger(marker.x) || !Number.isInteger(marker.y) || !this.tile(marker.x, marker.y)) continue;
      const p = this.tileToScreen(marker.x, marker.y);
      if (p.x < -20 || p.y < -20 || p.x > this.width + 20 || p.y > this.height + 20) continue;
      const offset = clamp(scale * .32, 3, 24);
      ctx.save(); ctx.translate(p.x + offset, p.y - offset);
      ctx.fillStyle = '#8b4430'; ctx.strokeStyle = '#fbf3df'; ctx.lineWidth = 1.5;
      path(ctx, [[-4, -7], [5, -7], [5, 6], [.5, 3], [-4, 6]], true);
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  drawCompass() {
    const ctx = this.ctx;
    const x = this.width - 30, y = 76;
    if (this.height < 230) return;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#5d6958'; ctx.strokeStyle = 'rgba(91,103,82,.5)'; ctx.lineWidth = .8;
    path(ctx, [[0, -12], [-4, 4], [0, 1], [4, 4]], true); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.stroke();
    ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('K', 0, -23);
    ctx.restore();
  }

  drawScale(scale) {
    const ctx = this.ctx;
    const tiles = scale > 65 ? 1 : scale > 28 ? 2 : scale > 12 ? 5 : 10;
    const width = scale * tiles;
    const x = 19, y = this.height - 24;
    if (this.height < 120) return;
    ctx.fillStyle = 'rgba(238,235,216,.88)'; ctx.fillRect(x - 7, y - 21, Math.max(width + 14, 76), 38);
    ctx.strokeStyle = '#606d59'; ctx.lineWidth = 1.2;
    path(ctx, [[x, y - 4], [x, y], [x + width, y], [x + width, y - 4]]); ctx.stroke();
    ctx.fillStyle = '#58654f'; ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${tiles} karo`, x, y - 8);
    if (this.width > 480) {
      ctx.fillStyle = '#747b66'; ctx.textAlign = 'left';
      ctx.fillText(`${Math.floor(this.center.x)} : ${Math.floor(this.center.y)}`, x + width + 24, y - 1);
    }
  }

  drawMinimap() {
    this.minimapRect = null;
    if (this.width < 760 || this.height < 400 || this.mode === 'world') return;
    const size = 116, x = this.width - size - 18, y = this.height - size - 18;
    const ctx = this.ctx, worldSize = this.state.world.size;
    if (!this.minimapTerrain) {
      const surface = document.createElement('canvas');
      surface.width = worldSize; surface.height = worldSize;
      const mini = surface.getContext('2d');
      for (const tile of this.state.world.tiles) { mini.fillStyle = COLORS[tile.terrain] || COLORS.plain; mini.fillRect(tile.x, tile.y, 1, 1); }
      this.minimapTerrain = surface;
    }
    ctx.fillStyle = 'rgba(243,239,220,.94)'; ctx.fillRect(x - 6, y - 23, size + 12, size + 29);
    ctx.strokeStyle = '#aeb39b'; ctx.lineWidth = 1; ctx.strokeRect(x - 6, y - 23, size + 12, size + 29);
    ctx.fillStyle = '#626b56'; ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('DÜNYA · GİTMEK İÇİN TIKLA', x, y - 9);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(this.minimapTerrain, x, y, size, size); ctx.imageSmoothingEnabled = true;
    for (const settlement of this.state.settlements) {
      ctx.fillStyle = this.factionColor(settlement.ownerId);
      ctx.fillRect(x + (settlement.x + .5) / worldSize * size - 2, y + (settlement.y + .5) / worldSize * size - 2, 4, 4);
    }
    const a = worldAtScreen({ x: 0, y: 0 }, this.getView()), b = worldAtScreen({ x: this.width, y: this.height }, this.getView());
    ctx.strokeStyle = '#fdf7dd'; ctx.lineWidth = 3;
    const vx = x + clamp(a.x, 0, worldSize) / worldSize * size, vy = y + clamp(a.y, 0, worldSize) / worldSize * size;
    const vw = (clamp(b.x, 0, worldSize) - clamp(a.x, 0, worldSize)) / worldSize * size, vh = (clamp(b.y, 0, worldSize) - clamp(a.y, 0, worldSize)) / worldSize * size;
    ctx.strokeRect(vx, vy, vw, vh); ctx.strokeStyle = '#365743'; ctx.lineWidth = 1; ctx.strokeRect(vx, vy, vw, vh);
    this.minimapRect = { x, y, size };
  }

  destroy() {
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.cancelGesture();
    this.observer?.disconnect();
    this.listeners.forEach((remove) => remove());
    this.listeners.length = 0;
  }
}

export function createMap(canvas, options) { return new StrategyMap(canvas, options); }
