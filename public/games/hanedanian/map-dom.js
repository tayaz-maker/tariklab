// Canvas-independent command surface. Uses the same world and selection callback;
// no alternate simulation, saved state, network assets or continuous render loop.
import { TERRAINS, POIS } from './data.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function atlasDirectory(state, center, limit = 12) {
  if (!state) return [];
  const towns = new Map(state.settlements.map(t => [`${t.x},${t.y}`, t]));
  return state.world.tiles.filter(t => t.poi || towns.has(`${t.x},${t.y}`)).map(tile => {
    const town = towns.get(`${tile.x},${tile.y}`);
    const ownerId = town?.ownerId || tile.poi?.ownerId;
    return { x: tile.x, y: tile.y, label: town?.name || POIS[tile.poi.type].label,
      kind: town ? (town.buildings.wall > 0 ? 'Surlu yerleşim' : 'Yerleşim') : POIS[tile.poi.type].label,
      owner: state.factions.find(f => f.id === ownerId)?.name || 'Bağımsız',
      distance: Math.hypot(tile.x + .5 - center.x, tile.y + .5 - center.y) };
  }).sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x).slice(0, limit);
}

export class StrategyMapDOM {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = options;
    this.center = { x: 24.5, y: 24.5 };
    this.zoom = 1;
    this.selected = null;
    this.layers = {};
    this.guide = null;
    this.disposed = false;
    this.host = document.createElement('section');
    this.host.className = 'map-directory';
    this.host.setAttribute('aria-label', 'Yeryüzü defteri: erişilebilir harita');
    canvas.hidden = true;
    canvas.parentElement.append(this.host);
    this.click = event => {
      const button = event.target.closest('[data-atlas-tile]');
      if (button) this.select(Number(button.dataset.x), Number(button.dataset.y));
    };
    this.submit = event => {
      if (!event.target.matches('[data-atlas-coordinates]')) return;
      event.preventDefault();
      this.select(Number(event.target.elements.x.value), Number(event.target.elements.y.value), { focus: true });
    };
    this.host.addEventListener('click', this.click);
    this.host.addEventListener('submit', this.submit);
    this.resize();
  }

  get mode() { return 'world'; }
  getView() { return { width: this.width, height: this.height, zoom: this.zoom, mode: this.mode,
    center: { ...this.center }, selected: this.selected ? { ...this.selected } : null,
    drawnTiles: this.state?.world.tiles.length || 0, lastRenderMs: 0, renderer: 'dom' }; }
  setState(state) {
    const first = !this.state;
    this.state = state;
    if (first) {
      const home = state.settlements.find(t => t.ownerId === state.playerId);
      if (home) this.center = { x: home.x + .5, y: home.y + .5 };
    }
    const contentKey = state.settlements.map(t => `${t.id}:${t.name}:${t.ownerId}:${t.buildings.wall}`).join('|') +
      state.world.tiles.filter(t => t.poi).map(t => `${t.poi.id}:${t.poi.ownerId}`).join('|');
    if (this.world !== state.world || contentKey !== this.contentKey) {
      this.world = state.world;
      this.contentKey = contentKey;
      this.draw();
    }
  }
  select(x, y, { notify = true, focus = false } = {}) {
    const size = this.state?.world.size || 0;
    const tile = Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < size && y < size
      ? this.state.world.tiles[Math.floor(y) * size + Math.floor(x)] : null;
    this.selected = tile ? { x: tile.x, y: tile.y } : null;
    if (focus && tile) this.center = { x: tile.x + .5, y: tile.y + .5 };
    this.draw();
    if (notify) this.options.onSelect?.(tile);
    return tile;
  }
  focus(x, y) { this.center = { x: x + .5, y: y + .5 }; this.draw(); }
  setZoom(level) {
    this.zoom = typeof level === 'number' ? clamp(level, .07, 2.6) : ({ near: 1.22, region: .52, world: .1 }[level] || 1);
    this.draw();
  }
  zoomBy(factor) { this.setZoom(this.zoom * factor); }
  setLayers(layers) { this.layers = { ...this.layers, ...layers }; }
  setGuide(guide) {
    const key = guide ? `${guide.target.x},${guide.target.y}:${guide.route?.minutes}:${guide.route?.distance}` : '';
    this.guide = guide;
    if (key === this.guideKey) return;
    this.guideKey = key;
    this.draw();
  }
  resize() { const box = this.host.getBoundingClientRect(); this.width = box.width; this.height = box.height; }

  draw() {
    if (!this.state || this.disposed) return;
    const size = this.state.world.size;
    // At most nine terrain paths, independent of the 2,401 world tiles.
    if (this.terrainWorld !== this.state.world) {
      const paths = new Map();
      for (const tile of this.state.world.tiles) paths.set(tile.terrain,
        (paths.get(tile.terrain) || '') + `M${tile.x},${tile.y}h1v1h-1z`);
      this.terrainHTML = [...paths].map(([type, d]) => `<path d="${d}" fill="${TERRAINS[type].color}"/>`).join('');
      this.terrainWorld = this.state.world;
    }
    const rows = atlasDirectory(this.state, this.center);
    const selected = this.selected;
    const active = selected ? `${selected.x} · ${selected.y}` : 'Bir yer seç';
    const towns = this.state.settlements.map(t => `<rect x="${t.x}" y="${t.y}" width="1" height="1" fill="${t.ownerId === this.state.playerId ? '#f3ead4' : '#34291e'}" stroke="#171d17" stroke-width=".2"/>`).join('');
    const marker = selected ? `<circle cx="${selected.x + .5}" cy="${selected.y + .5}" r="1.1" fill="none" stroke="#fff" stroke-width=".35"/>` : '';
    const selection = this.guide?.route ? `Gözcü ${Math.ceil(this.guide.route.minutes)} dk · ${this.guide.route.distance.toFixed(1)} karo` : '';
    // Keep active form/button focus through simulation refreshes.
    const oldFocus = this.host.contains(document.activeElement) ? document.activeElement : null;
    const focusName = oldFocus?.name;
    const focusTile = oldFocus?.dataset?.atlasTile;
    const focusSubmit = oldFocus?.matches('[data-atlas-submit]');
    const fieldValues = [...this.host.querySelectorAll('input')].map(input => [input.name, input.value]);
    this.host.innerHTML = `<div class="atlas-directory-head"><span class="eyebrow">YERYÜZÜ DEFTERİ</span><h2>Toprak ve bağlantılar</h2><p>Yakın yerler merkezine göre sıralanır. Her karoyu koordinatla seçebilirsin.</p></div>
      <svg class="atlas-overview" viewBox="0 0 ${size} ${size}" role="img" aria-label="${size} çarpı ${size} özgün dünya; açık kareler senin yerleşimlerin">${this.terrainHTML}${towns}${marker}</svg>
      <p class="atlas-selection" role="status"><strong>${esc(active)}</strong> ${esc(selection)}</p>
      <form data-atlas-coordinates class="atlas-coordinate-form"><label>Doğu<input name="x" type="number" min="0" max="${size - 1}" step="1" required value="${selected?.x ?? Math.floor(this.center.x)}"></label><label>Kuzey<input name="y" type="number" min="0" max="${size - 1}" step="1" required value="${selected?.y ?? Math.floor(this.center.y)}"></label><button type="submit" data-atlas-submit>Karoyu seç</button></form>
      <div class="atlas-place-list">${rows.map(row => `<button data-atlas-tile="${row.x},${row.y}" data-x="${row.x}" data-y="${row.y}" aria-pressed="${selected?.x === row.x && selected?.y === row.y}"><strong>${esc(row.label)}</strong><span>${esc(row.owner)} · ${row.x}, ${row.y} · ${row.distance.toFixed(1)} karo</span></button>`).join('')}</div>`;
    if (focusName) {
      for (const [name, value] of fieldValues) this.host.querySelector(`[name="${name}"]`).value = value;
      this.host.querySelector(`[name="${focusName}"]`)?.focus({ preventScroll: true });
    } else if (focusTile) this.host.querySelector(`[data-atlas-tile="${focusTile}"]`)?.focus({ preventScroll: true });
    else if (focusSubmit) this.host.querySelector('[data-atlas-submit]')?.focus({ preventScroll: true });
    this.options.onViewChange?.(this.getView());
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.host.removeEventListener('click', this.click);
    this.host.removeEventListener('submit', this.submit);
    this.host.remove();
    this.canvas.hidden = false;
  }
}
