import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { versionGameWorker } from './offline-sw-plugin.mjs';

// This is a deterministic Service Worker unit harness, not browser/offline QA.
// A real install, controller takeover and airplane-mode reload still need a browser.
const origin = 'https://tariklab.example';
const root = '/games/hanedanian/';
const gameDirectory = new URL('../public/games/hanedanian/', import.meta.url);
const workerSource = readFileSync(new URL('sw.js', gameDirectory), 'utf8');
const contentType = path => path.endsWith('.js') ? 'text/javascript; charset=utf-8'
  : path.endsWith('.css') ? 'text/css; charset=utf-8'
  : path.endsWith('.html') || path.endsWith('/') ? 'text/html; charset=utf-8'
  : path.endsWith('.svg') ? 'image/svg+xml'
  : path.endsWith('.webmanifest') ? 'application/manifest+json'
  : 'application/octet-stream';
const pathOf = request => new URL(typeof request === 'string' ? request : request.url, origin).pathname;

function harness({ networkResponse } = {}) {
  const listeners = new Map(), stores = new Map(), networkCalls = [];
  let offline = false, claimed = 0, skippedWaiting = 0;
  const keyOf = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async put(request, response) { entries.set(keyOf(request), response.clone()); },
        async match(request) { return entries.get(keyOf(request))?.clone(); },
        async delete(request) { return entries.delete(keyOf(request)); },
        async keys() { return [...entries.keys()].map(url => new Request(url)); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  class RelativeRequest extends Request {
    constructor(input, options) { super(typeof input === 'string' ? new URL(input, origin) : input, options); }
  }
  const sandbox = vm.createContext({
    URL, Request: RelativeRequest, Response, Headers, caches,
    fetch: async request => {
      const path = pathOf(request);
      networkCalls.push({ path, cache: request.cache, method: request.method });
      if (offline) throw new TypeError('The network is offline');
      if (networkResponse) return networkResponse(path, request);
      return new Response(`package:${path}`, { headers: { 'content-type': contentType(path) } });
    },
    self: {
      location: { origin },
      addEventListener(name, listener) { listeners.set(name, listener); },
      clients: { async claim() { claimed++; } },
      async skipWaiting() { skippedWaiting++; },
    },
  });
  vm.runInContext(workerSource, sandbox, { filename: 'hanedanian/sw.js' });
  const files = Array.from(vm.runInContext('FILES', sandbox));
  const version = vm.runInContext('VERSION', sandbox);
  async function lifecycle(type) {
    const promises = [];
    listeners.get(type)({ waitUntil(promise) { promises.push(promise); } });
    await Promise.all(promises);
  }
  async function fetchRequest(path, { method = 'GET', body } = {}) {
    const request = new Request(new URL(path, origin), { method, ...(body ? { body } : {}) });
    let response;
    listeners.get('fetch')({ request, respondWith(promise) { response = Promise.resolve(promise); } });
    return response ? { intercepted: true, response: await response } : { intercepted: false };
  }
  async function message(type = 'CACHE_HANEDANIAN', withPort = true) {
    const promises = [], messages = [];
    listeners.get('message')({ data: { type }, ports: withPort ? [{ postMessage(value) { messages.push(JSON.parse(JSON.stringify(value))); } }] : [], waitUntil(promise) { promises.push(promise); } });
    await Promise.all(promises);
    return messages;
  }
  return { files, version, caches, stores, networkCalls, lifecycle, fetchRequest, message,
    setOffline(value) { offline = value; },
    get claimed() { return claimed; }, get skippedWaiting() { return skippedWaiting; } };
}

function dependencyGraph() {
  const found = new Set(), pending = [root + 'index.html'];
  while (pending.length) {
    const path = pending.pop();
    if (found.has(path)) continue;
    found.add(path);
    const local = new URL(path.slice(root.length), gameDirectory);
    assert.ok(existsSync(local), `Missing local package dependency: ${path}`);
    const source = readFileSync(local, 'utf8'), links = [];
    if (path.endsWith('.html')) for (const match of source.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/g)) links.push(match[1]);
    if (path.endsWith('.js')) {
      for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g)) links.push(match[1]);
      for (const match of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) links.push(match[1]);
    }
    if (path.endsWith('.css')) for (const match of source.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/g)) links.push(match[1]);
    if (path.endsWith('.webmanifest')) {
      const manifest = JSON.parse(source);
      links.push(manifest.start_url, ...manifest.icons.map(icon => icon.src));
    }
    for (const link of links) {
      if (!link || link.startsWith('data:') || link.startsWith('#')) continue;
      const url = new URL(link, origin + path);
      assert.equal(url.origin, origin, `Offline game unexpectedly depends on a remote asset: ${link}`);
      assert.ok(url.pathname.startsWith(root), `Game dependency falls outside its scoped package: ${link}`);
      pending.push(url.pathname);
    }
  }
  return found;
}

test('standalone package contains the complete real HTML/module/CSS/manifest dependency graph', () => {
  const worker = harness(), graph = dependencyGraph();
  assert.equal(new Set(worker.files).size, worker.files.length, 'Duplicate package entry');
  assert.deepEqual([...worker.files].sort(), [...graph].sort());
  for (const path of worker.files) assert.ok(existsSync(new URL(path.slice(root.length), gameDirectory)), `Cached asset missing on disk: ${path}`);
  assert.ok(!worker.files.includes(root + 'sw.js'), 'Worker must update through its own lifecycle, not cache itself');
});

test('install fetches and caches all assets with reload policy, but never forces an upgrade on an open game', async () => {
  const worker = harness();
  await worker.lifecycle('install');
  assert.deepEqual(worker.networkCalls.map(call => call.path).sort(), [...worker.files].sort());
  assert.ok(worker.networkCalls.every(call => call.cache === 'reload' && call.method === 'GET'));
  const cache = await worker.caches.open(worker.version);
  for (const path of worker.files) assert.equal(await (await cache.match(path)).text(), `package:${path}`);
  assert.equal(worker.skippedWaiting, 0);
  assert.equal(worker.claimed, 0);
});

test('a partial network failure rejects installation before writes and preserves a complete old package', async () => {
  const worker = harness({ networkResponse: path => path.endsWith('engine.js')
    ? new Response('Unavailable', { status: 503 })
    : new Response(`new:${path}`, { headers: { 'content-type': contentType(path) } }) });
  const previousName = 'hanedanian-package-prior-working';
  const previous = await worker.caches.open(previousName);
  for (const path of worker.files) await previous.put(path, new Response(`previous:${path}`));
  await assert.rejects(worker.lifecycle('install'), /Game package incomplete/);
  assert.deepEqual(await worker.caches.keys(), [previousName]);
  for (const path of worker.files) assert.equal(await (await previous.match(path)).text(), `previous:${path}`);
  assert.equal(worker.claimed, 0);
  assert.equal(worker.skippedWaiting, 0);
});

test('a failed refresh does not overwrite an already complete package of the same version', async () => {
  let failNetwork = false;
  const worker = harness({ networkResponse: path => failNetwork && path.endsWith('map.js')
    ? Promise.reject(new TypeError('Disconnected during package download'))
    : new Response(`good:${path}`, { headers: { 'content-type': contentType(path) } }) });
  await worker.lifecycle('install');
  failNetwork = true;
  await assert.rejects(worker.lifecycle('install'), /Disconnected/);
  const cache = await worker.caches.open(worker.version);
  for (const path of worker.files) assert.equal(await (await cache.match(path)).text(), `good:${path}`);
});

test('every package asset rejects a successful 200 response with an incompatible content type', async () => {
  for (const wrongPath of harness().files) {
    const worker = harness({ networkResponse: path => new Response('Wrong content cannot become an offline dependency', {
      headers: { 'content-type': path === wrongPath ? 'application/octet-stream' : contentType(path) },
    }) });
    await assert.rejects(worker.lifecycle('install'), /Invalid game module/, wrongPath);
    assert.deepEqual(await worker.caches.keys(), [], wrongPath);
  }
  const fallback = harness({ networkResponse: path => new Response('<html>SPA fallback</html>', {
    headers: { 'content-type': path.endsWith('map.js') ? 'text/html; charset=utf-8' : contentType(path) },
  }) });
  await assert.rejects(fallback.lifecycle('install'), /Invalid game module/);
});

test('the complete package, query variants, and directory entry are served without network after installation', async () => {
  const worker = harness();
  await worker.lifecycle('install');
  worker.setOffline(true);
  const requestCount = worker.networkCalls.length;
  for (const path of worker.files) {
    const result = await worker.fetchRequest(path);
    assert.equal(result.intercepted, true);
    assert.equal(await result.response.text(), `package:${path}`);
  }
  const directory = await worker.fetchRequest(root);
  assert.equal(await directory.response.text(), `package:${root}index.html`);
  const query = await worker.fetchRequest(root + 'app.js?reopen=1');
  assert.equal(await query.response.text(), `package:${root}app.js`);
  assert.equal(worker.networkCalls.length, requestCount, 'Cached requests must not quietly hit the network');
});

test('worker leaves other games, app routes, API, cross-origin URLs, writes, and its own script alone', async () => {
  const worker = harness();
  for (const path of ['/', '/oyna/hanedanian', '/api/session', '/api/auth/me', '/games/ihtilal/index.html', '/games/hanedanian-unrelated/app.js', 'https://other.example/games/hanedanian/app.js', root + 'sw.js', root + 'api/session', root + 'unknown.js', root + 'private/export.json']) {
    assert.deepEqual(await worker.fetchRequest(path), { intercepted: false }, path);
  }
  assert.deepEqual(await worker.fetchRequest(root + 'index.html', { method: 'POST', body: 'test' }), { intercepted: false });
  assert.equal(worker.networkCalls.length, 0);
});

test('readiness messages inspect every cached file rather than assuming an installed worker means ready', async () => {
  const worker = harness();
  assert.deepEqual(await worker.message(), [{ type: 'HANEDANIAN_OFFLINE_READY', ok: false, version: worker.version }]);
  await worker.lifecycle('install');
  assert.deepEqual(await worker.message(), [{ type: 'HANEDANIAN_OFFLINE_READY', ok: true, version: worker.version }]);
  const cache = await worker.caches.open(worker.version);
  for (const path of worker.files) {
    const saved = await cache.match(path);
    await cache.delete(path);
    assert.equal((await worker.message())[0].ok, false, `Readiness ignored missing ${path}`);
    await cache.put(path, saved);
  }
  assert.equal((await worker.message())[0].ok, true);
  assert.deepEqual(await worker.message('UNRELATED_MESSAGE'), []);
  assert.deepEqual(await worker.message('CACHE_HANEDANIAN', false), []);
});

test('activation claims clients and only retires old versions of its own package', async () => {
  const worker = harness();
  const unrelatedNames = ['tariklab-shell-v8', 'ihtilal-offline-v2', 'user-save-backup'];
  await Promise.all([...unrelatedNames, 'hanedanian-package-old'].map(name => worker.caches.open(name)));
  await worker.lifecycle('install');
  await worker.lifecycle('activate');
  assert.equal(worker.claimed, 1);
  assert.deepEqual((await worker.caches.keys()).sort(), [...unrelatedNames, worker.version].sort());
  assert.equal((await worker.message())[0].ok, true);
});

test('content-version generation is deterministic across dependency insertion order and supports build buffers', () => {
  const files = { 'app.js': Buffer.from('import "./engine.js";'), 'engine.js': Buffer.from('export const turn = 1;'), 'index.html': Buffer.from('<script type="module" src="./app.js"></script>') };
  const a = versionGameWorker(workerSource, files);
  const b = versionGameWorker(workerSource, Object.fromEntries(Object.entries(files).reverse()));
  assert.equal(a, b);
  assert.match(a, /const VERSION = "hanedanian-package-[0-9a-f]{16}";/);
  assert.ok(!a.includes('HANEDANIAN_BUILD_VERSION'));
  assert.ok(!a.includes('hanedanian-package-dev-1'));
  assert.equal(versionGameWorker(workerSource, files), a, 'Repeated builds must not generate spurious updates');
});

test('changing any real offline dependency, its name, or worker source changes the emitted package version', () => {
  const files = Object.fromEntries(harness().files.map(path => [path.slice(root.length), readFileSync(new URL(path.slice(root.length), gameDirectory))]));
  const original = versionGameWorker(workerSource, files);
  for (const name of Object.keys(files)) {
    const changed = { ...files, [name]: Buffer.concat([files[name], Buffer.from('\nchanged-byte')]) };
    assert.notEqual(versionGameWorker(workerSource, changed), original, `Version ignored modified ${name}`);
  }
  const renamed = { ...files, 'renamed-app.js': files['app.js'] };
  delete renamed['app.js'];
  assert.notEqual(versionGameWorker(workerSource, renamed), original, 'Renaming a dependency must change the graph version');
  const removed = { ...files }; delete removed['map.js'];
  assert.notEqual(versionGameWorker(workerSource, removed), original, 'Removing a dependency must change the graph version');
  assert.notEqual(versionGameWorker(workerSource + '\n// Updated caching policy\n', files), original, 'Worker policy changes must get their own package');
});

test('missing, duplicate, or already-replaced game version markers fail the build explicitly', () => {
  const marker = '/* HANEDANIAN_BUILD_VERSION */ "hanedanian-package-dev-1"';
  assert.throws(() => versionGameWorker(workerSource.replace(marker, '"old"'), {}), /one version marker/);
  assert.throws(() => versionGameWorker(workerSource + `\nconst duplicate = ${marker};`, {}), /one version marker/);
  const built = versionGameWorker(workerSource, {});
  assert.throws(() => versionGameWorker(built, {}), /one version marker/);
});
