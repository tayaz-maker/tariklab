import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createSolo} from '../public/games/ihtilal/solo.js';
import {REGIONS, ROUTES, spillRisk} from '../public/games/ihtilal/basin-network.js';

// Run the production renderers, replacing only the DOM, GPU adapter and frame
// scheduler. These counters observe work performed by create/update/start; no
// renderer cache keys or invalidation decisions are reproduced in the fixture.
function harness(kind, {width = 480, dpr = 1, memory = 8, deferMount = false} = {}) {
  const stats = {imports: 0, probes: 0, mounts: 0, renders: 0, resizes: [], graphics: [], scenes: []};
  const observers = [], frames = new Map();
  let frameId = 0, clock = 0, resolveMount;
  class Events {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(fn);
    }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    dispatchEvent(event) {
      event.target ??= this;
      for (const fn of [...(this.listeners.get(event.type) || [])]) fn.call(this, event);
      return true;
    }
    listenerCount(type) { return this.listeners.get(type)?.size || 0; }
  }
  class Element extends Events {
    constructor(tag) {
      super();
      this.tagName = tag;
      this.children = [];
      this.attributes = new Map();
      this.dataset = {};
      this.style = {};
      this.parentNode = null;
      this.replacements = 0;
      this.mutations = 0;
      this._text = '';
      this.classList = {
        add: (...names) => this.setAttribute('class', [...new Set([...this.className.split(/\s+/), ...names])].filter(Boolean).join(' ')),
        remove: (...names) => this.setAttribute('class', this.className.split(/\s+/).filter(n => !names.includes(n)).join(' ')),
        contains: name => this.className.split(/\s+/).includes(name),
        toggle: (name, force) => {
          const enabled = force ?? !this.classList.contains(name);
          this.classList[enabled ? 'add' : 'remove'](name);
          return enabled;
        },
      };
    }
    get className() { return this.getAttribute('class') || ''; }
    set className(value) { this.setAttribute('class', value); }
    get textContent() { return this._text + this.children.map(n => n.textContent).join(''); }
    set textContent(value) { this._text = String(value); this.children = []; this.mutations++; }
    get clientWidth() { return width; }
    get clientHeight() { return width; }
    get isConnected() { return Boolean(this.parentNode); }
    get firstChild() { return this.children[0] || null; }
    get childNodes() { return this.children; }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
      this.mutations++;
    }
    getAttribute(name) {
      if (name.startsWith('data-')) return this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] ?? null;
      return this.attributes.get(name) ?? null;
    }
    hasAttribute(name) { return this.getAttribute(name) !== null; }
    removeAttribute(name) {
      this.attributes.delete(name);
      if (name.startsWith('data-')) delete this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
      this.mutations++;
    }
    append(...nodes) {
      for (const n of nodes) { n.remove(); n.parentNode = this; this.children.push(n); }
      this.mutations++;
    }
    appendChild(node) { this.append(node); return node; }
    insertBefore(node, reference) {
      if (reference === null) return this.appendChild(node);
      assert.equal(reference.parentNode, this);
      node.remove();
      node.parentNode = this;
      this.children.splice(this.children.indexOf(reference), 0, node);
      this.mutations++;
      return node;
    }
    replaceChildren(...nodes) {
      for (const n of this.children) n.parentNode = null;
      this.children = [];
      this.replacements++;
      this.append(...nodes);
    }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(n => n !== this);
      this.parentNode = null;
    }
    contains(node) { return node === this || this.children.some(n => n.contains(node)); }
    matches(selector) {
      const attr = selector.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
      if (attr) return attr[2] === undefined ? this.hasAttribute(attr[1]) : this.getAttribute(attr[1]) === attr[2];
      if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
      return this.tagName === selector;
    }
    querySelectorAll(selector) {
      return this.children.flatMap(n => [...(n.matches(selector) ? [n] : []), ...n.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
    focus() { document.activeElement = this; }
    getBoundingClientRect() { return {width, height: width, x: 0, y: 0, top: 0, left: 0, right: width, bottom: width}; }
    getContext() {
      stats.probes++;
      return {getExtension: () => ({loseContext() {}})};
    }
  }
  const document = new Events();
  document.hidden = false;
  document.visibilityState = 'visible';
  document.activeElement = null;
  document.createElement = tag => new Element(tag);
  document.createElementNS = (_, tag) => new Element(tag);
  document.body = new Element('body');
  class Graphics {
    constructor(options = {}) {
      this.label = options.label;
      this.clears = 0;
      this.commands = [];
      stats.graphics.push(this);
    }
    clear() { this.clears++; this.commands = []; return this; }
    destroy() { this.destroyed = true; }
  }
  for (const method of ['poly', 'fill', 'stroke', 'moveTo', 'lineTo', 'rect']) {
    Graphics.prototype[method] = function (...args) { this.commands.push([method, ...args]); return this; };
  }
  const adapter = {
    supportsPixi({createCanvas}) { return Boolean(createCanvas().getContext('webgl2')); },
    async mountPixiScene(options) {
      stats.mounts++;
      const canvas = new Element('canvas');
      const app = {
        canvas,
        stage: {children: [], addChild(...nodes) { this.children.push(...nodes); }, scale: {set(value) { this.value = value; }}},
        renderer: {resize: (w, h) => stats.resizes.push([w, h])},
      };
      options.container.append(canvas);
      const scene = {
        app,
        destroyed: 0,
        render() { stats.renders++; },
        destroy() { this.destroyed++; canvas.remove(); for (const g of app.stage.children) g.destroy(); },
      };
      stats.scenes.push(scene);
      options.build({app, PIXI: {Graphics}});
      if (deferMount) await new Promise(resolve => { resolveMount = resolve; });
      return scene;
    },
  };
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(element) { this.element = element; }
    disconnect() { this.disconnected = true; }
  }
  const window = new Events();
  window.document = document;
  window.devicePixelRatio = dpr;
  window.navigator = {deviceMemory: memory};
  const context = vm.createContext({
    window, document, navigator: window.navigator, devicePixelRatio: dpr,
    ResizeObserver, performance: {now: () => ++clock},
    requestAnimationFrame: fn => { const id = ++frameId; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    CustomEvent: class { constructor(type) { this.type = type; } },
    REGIONS, ROUTES, spillRisk,
    __loadAdapter: async () => { stats.imports++; return adapter; },
  });
  window.requestAnimationFrame = context.requestAnimationFrame;
  window.cancelAnimationFrame = context.cancelAnimationFrame;
  const source = file => readFileSync(new URL(`../public/games/${file}`, import.meta.url), 'utf8');
  if (kind === 'racon') {
    for (const file of ['network.js', 'map-model.js']) vm.runInContext(source(`racon/${file}`), context, {filename: file});
  }
  const filename = kind === 'basin' ? 'ihtilal/basin-map.js' : 'racon/map-view.js';
  const production = source(filename)
    .replace(/^import\s+[^;]+;\s*$/gm, '')
    .replace(/\bexport\s+(?=function\b)/g, '')
    .replace(/import\((['"])\.\.\/shared\/pixi-adapter\.js\1\)/g, '__loadAdapter()');
  vm.runInContext(production + (kind === 'basin' ? '\nglobalThis.rendererAPI={createBasinMap,basinRenderModel};' : ''), context, {filename});
  const api = kind === 'basin' ? context.rendererAPI : window.RaconMapView;
  const view = kind === 'basin' ? api.createBasinMap(() => {}) : api.create();
  document.body.append(view.element);
  const state = kind === 'basin' ? createSolo(8) : raconWorld(window.RaconAg);
  const model = (options = {}, current = state) => kind === 'basin'
    ? api.basinRenderModel(current, {layer: 'trust', lang: 'en', ...options})
    : window.RaconMapModel.model(current, {layer: 'trust', narrow: false, ...options});
  async function settle() {
    for (let i = 0; i < 6; i++) {
      const pending = [...frames.values()];
      frames.clear();
      for (const fn of pending) fn();
      await Promise.resolve();
    }
  }
  return {
    stats, view, state, model, document, observers, settle,
    async start() { if (kind === 'racon') await view.start(); await settle(); },
    beginStart() { if (kind === 'racon') return view.start(); return settle(); },
    releaseMount() { resolveMount?.(); },
    resize(value = width) { width = value; for (const o of observers) if (!o.disconnected) o.callback([]); },
    visibility(hidden) {
      document.hidden = hidden;
      document.visibilityState = hidden ? 'hidden' : 'visible';
      document.dispatchEvent({type: 'visibilitychange'});
    },
    graphic(label) {
      const graphic = stats.graphics.find(g => g.label === label);
      assert.ok(graphic, `production renderer creates ${label}`);
      return graphic;
    },
  };
}

function raconWorld(Ag) {
  const ids = Object.keys(Ag.NAMES);
  return {
    week: 1, kasa: 20000, dosya: 10, streetHome: ids[0],
    men: [{durum: 'hazir'}], people: [], calendar: [], flags: {},
    streets: ids.map((id, i) => ({
      id, ad: Ag.NAMES[id], sahip: i < 2 ? 'sen' : i === 3 ? 'rakip' : 'bos',
      heat: 20, sadakatMahalle: 50, terorMahalle: 20, yatirim: 0,
      komsular: [ids[(i + 5) % 6], ids[(i + 1) % 6]],
    })),
  };
}

function snapshotBase(h) {
  const groups = h.view.element.querySelectorAll('[data-map-base]');
  assert.ok(groups.length, 'production SVG exposes retained base groups');
  return groups.map(node => ({node, children: [...node.children], replacements: node.replacements}));
}
function assertRetained(h, before) {
  const groups = h.view.element.querySelectorAll('[data-map-base]');
  assert.equal(groups.length, before.length);
  for (let i = 0; i < groups.length; i++) {
    assert.equal(groups[i], before[i].node, 'base SVG group identity survives');
    assert.equal(groups[i].replacements, before[i].replacements, 'base children are not rebuilt');
    assert.equal(groups[i].children.length, before[i].children.length);
    groups[i].children.forEach((node, n) => assert.equal(node, before[i].children[n]));
  }
}
function selectedModel(h, kind) {
  if (kind === 'basin') return h.model({}, {...h.state, selected: h.state.regions.find(r => r.id !== h.state.selected).id});
  return h.model({selected: h.state.streets[1].id});
}
function previewModel(h, kind) {
  if (kind === 'basin') return h.model({plan: {regional: [{id: h.state.regions[0].id, delta: {trust: 2}}], waves: [{via: ROUTES[0].id}]}});
  return h.model({selected: h.state.streets[1].id, kind: 'yatirim', target: h.state.streets[2].id});
}
function metricModel(h, kind, value) {
  const changed = structuredClone(h.state);
  if (kind === 'basin') changed.regions[0].trust = value;
  else changed.streets[0].sadakatMahalle = value;
  return h.model({}, changed);
}

for (const kind of ['basin', 'racon']) {
  const baseLabel = kind === 'basin' ? 'basin-base' : 'racon-base';
  const selectionLabel = kind === 'basin' ? 'basin-selection' : 'racon-selection';

  test(`${kind}: real updates retain static SVG/GPU geometry across identical, preview and selection changes`, async () => {
    const h = harness(kind);
    h.view.update(h.model());
    await h.start();
    assert.equal(h.view.element.dataset.renderer, 'pixi');
    const base = h.graphic(baseLabel), selected = h.graphic(selectionLabel);
    const before = snapshotBase(h), clears = base.clears, selectionClears = selected.clears;
    assert.ok(clears > 0);
    const stableLinks = kind === 'racon' ? h.graphic('racon-links') : null;
    const linkClears = stableLinks?.clears;
    h.view.update(h.model());
    h.view.update(previewModel(h, kind));
    assert.ok(h.view.element.querySelector('[data-map-overlay]'));
    h.view.update(selectedModel(h, kind));
    assertRetained(h, before);
    assert.equal(base.clears, clears, 'selection and preview never clear the static GPU base');
    assert.equal(stableLinks?.clears, linkClears, 'preview never clears permanent links');
    assert.ok(selected.clears > selectionClears, 'selection redraws its own GPU layer');

    h.view.update(metricModel(h, kind, 88));
    assert.equal(base.clears, clears + 1, 'a changed metric redraws the state-bearing base once');
    assert.ok(before.some(({node, replacements}) => node.replacements > replacements), 'changed state refreshes SVG geometry');
    h.view.destroy();
  });

  test(`${kind}: unchanged dimensions skip renderer.resize; one actual resize keeps static geometry`, async () => {
    const h = harness(kind);
    h.view.update(h.model());
    await h.start();
    const resizeCount = h.stats.resizes.length, base = h.graphic(baseLabel), clears = base.clears;
    const before = snapshotBase(h);
    h.resize();
    h.resize();
    h.view.update(selectedModel(h, kind));
    assert.equal(h.stats.resizes.length, resizeCount);
    h.resize(500);
    assert.equal(h.stats.resizes.length, resizeCount + 1);
    assert.equal(h.stats.resizes.at(-1)[0], 500);
    assert.equal(base.clears, clears, 'GPU scale changes do not rebuild logical geometry');
    assertRetained(h, before);
    h.view.destroy();
  });

  test(`${kind}: hidden updates defer drawing and visibility flushes exactly the latest model once`, async () => {
    const h = harness(kind);
    h.view.update(h.model());
    await h.start();
    const renders = h.stats.renders, resizes = h.stats.resizes.length;
    const before = snapshotBase(h), base = h.graphic(baseLabel), clears = base.clears;
    h.visibility(true);
    h.view.update(metricModel(h, kind, 65));
    h.resize(500);
    h.view.update(metricModel(h, kind, 88));
    await h.settle();
    assert.equal(h.stats.renders, renders);
    assert.equal(h.stats.resizes.length, resizes);
    assert.equal(base.clears, clears);
    assertRetained(h, before);
    h.visibility(false);
    await h.settle();
    assert.equal(h.stats.renders, renders + 1, 'visibility restoration draws once');
    assert.equal(base.clears, clears + 1);
    assert.equal(h.stats.resizes.length, resizes + 1);
    if (kind === 'basin') {
      const bands = h.view.element.querySelectorAll('.basin-metric-band');
      assert.equal(bands[0].getAttribute('data-metric-value'), '88');
    } else assert.match(h.view.element.querySelector('.rm-buttons').textContent, /Güven 88/);
    h.visibility(false);
    await h.settle();
    assert.equal(h.stats.renders, renders + 1, 'a duplicate visible notification has no pending frame');
    h.view.destroy();
  });

  test(`${kind}: destroy disconnects lifecycle listeners and prevents late updates`, async () => {
    const h = harness(kind);
    h.view.update(h.model());
    await h.start();
    const scene = h.stats.scenes[0], root = h.view.element;
    assert.equal(scene.app.canvas.listenerCount('webglcontextlost'), 1);
    assert.equal(h.document.listenerCount('visibilitychange'), 1);
    h.view.destroy();
    assert.equal(h.document.listenerCount('visibilitychange'), 0);
    assert.equal(scene.app.canvas.listenerCount('webglcontextlost'), 0);
    assert.ok(h.observers.every(o => o.disconnected));
    assert.equal(scene.destroyed, 1);
    assert.equal(root.parentNode, null);
    const renders = h.stats.renders, resizes = h.stats.resizes.length, text = root.textContent;
    h.view.update(metricModel(h, kind, 88));
    h.resize(600);
    h.visibility(false);
    await h.settle();
    h.view.destroy();
    assert.equal(scene.destroyed, 1);
    assert.equal(root.textContent, text);
    assert.equal(h.stats.renders, renders);
    assert.equal(h.stats.resizes.length, resizes);
  });

  test(`${kind}: destroy during asynchronous mount disposes the late scene without drawing`, async () => {
    const h = harness(kind, {deferMount: true});
    h.view.update(h.model());
    const starting = h.beginStart();
    await h.settle();
    assert.equal(h.stats.mounts, 1);
    h.view.destroy();
    h.releaseMount();
    await starting;
    await h.settle();
    assert.equal(h.stats.scenes[0].destroyed, 1);
    assert.equal(h.stats.renders, 0);
    assert.equal(h.stats.resizes.length, 0);
    assert.equal(h.document.listenerCount('visibilitychange'), 0);
    assert.equal(h.stats.scenes[0].app.canvas.listenerCount('webglcontextlost'), 0);
  });

  for (const [reason, options] of [['low memory', {memory: 2}], ['DPR pixel budget', {width: 1000, dpr: 2}]]) {
    test(`${kind}: ${reason} selects usable SVG before importing or probing WebGL`, async () => {
      const h = harness(kind, options);
      h.view.update(h.model());
      await h.start();
      assert.equal(h.view.element.dataset.renderer, 'svg');
      assert.equal(h.stats.imports, 0);
      assert.equal(h.stats.probes, 0);
      assert.equal(h.stats.mounts, 0);
      assert.ok(h.view.element.querySelectorAll('[data-map-base]').some(g => g.children.length));
      if (kind === 'basin') assert.equal(h.view.element.querySelectorAll('[data-basin]').length, 7);
      else assert.equal(h.view.element.querySelector('.rm-buttons').children.length, 6);
      h.view.update(metricModel(h, kind, 88));
      assert.equal(h.view.element.dataset.renderer, 'svg');
      h.view.destroy();
    });
  }
}
