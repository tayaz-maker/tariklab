import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { createServer } from 'node:http';

// Tests the actual SW listeners. Browser install/controller/offline reload is a
// separate release gate; this deterministic harness does not claim browser QA.
const template = await readFile(new URL('../public/atlas/yapi/sw.js', import.meta.url), 'utf8');
const root = '/atlas/yapi/';
const defaultOrigin = 'https://atlas.example';
const bodies = new Map([
  [root + 'index.html', Buffer.from('<!doctype html><h1>Yapı — Eğitim</h1>\r\n')],
  [root + 'app.js', Buffer.from('export const current = "learning-draft";')],
  [root + 'content.js', Buffer.from('export const expertReview = "required";')],
  [root + 'style.css', Buffer.from('body { color: #123; }')],
  [root + 'icon.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')],
  [root + 'manifest.webmanifest', Buffer.from('{"scope":"/atlas/yapi/"}')],
  [root + 'fixtures/smoke.json', Buffer.from('{"educational":true}')],
]);
const mime = path => path.endsWith('.html') || path === root ? 'text/html'
  : path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css'
    : path.endsWith('.svg') ? 'image/svg+xml' : path.endsWith('.webmanifest') ? 'application/manifest+json' : 'application/json';
function packet(version = 'test-a', content = bodies) {
  const files = [...content].map(([path, body]) => ({ path, bytes: body.length,
    sha256: createHash('sha256').update(body).digest('hex'), mime: mime(path) }));
  return { schema: 1, root, version: 'atlas-foundation-' + version, files,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0) };
}

function harness({ manifest = packet(), stores = new Map(), content = bodies, networkResponse, onPut, origin = defaultOrigin } = {}) {
  const listeners = new Map(), network = [];
  let offline = false, claimed = 0, skipped = 0;
  const key = input => new URL(typeof input === 'string' ? input : input.url, origin).href;
  const caches = {
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async put(path, response) { await onPut?.(name, path); entries.set(key(path), response.clone()); },
        async match(path) { return entries.get(key(path))?.clone(); },
        async delete(path) { return entries.delete(key(path)); },
      };
    },
  };
  class RelativeRequest extends Request {
    constructor(input, options) { super(typeof input === 'string' ? new URL(input, origin) : input, options); }
  }
  const context = vm.createContext({ URL, Request: RelativeRequest, Response, Uint8Array, crypto: webcrypto, caches,
    fetch: async request => {
      const path = new URL(request.url).pathname;
      network.push({ path, method: request.method, cache: request.cache });
      if (offline) throw new TypeError('offline fixture');
      if (networkResponse) return networkResponse(path, request);
      return new Response(content.get(path), { headers: { 'content-type': mime(path) + '; charset=utf-8' } });
    },
    self: { location: { origin }, addEventListener: (name, callback) => listeners.set(name, callback),
      clients: { async claim() { claimed++; } }, async skipWaiting() { skipped++; } },
  });
  vm.runInContext(template.replace('/* ATLAS_PACKAGE */ null', JSON.stringify(manifest)), context, { filename: 'atlas/sw.js' });
  async function lifecycle(type) {
    const pending = [];
    listeners.get(type)({ waitUntil(promise) { pending.push(promise); } });
    await Promise.all(pending);
  }
  async function fetchPath(path, options = {}) {
    let result;
    const request = new Request(new URL(path, origin), options);
    listeners.get('fetch')({ request, respondWith(value) { result = Promise.resolve(value); } });
    return result ? { intercepted: true, response: await result } : { intercepted: false };
  }
  async function message(type = 'GET_ATLAS_STATUS', withPort = true) {
    const pending = [], messages = [];
    listeners.get('message')({ data: { type }, ports: withPort ? [{ postMessage(value) { messages.push(JSON.parse(JSON.stringify(value))); } }] : [],
      waitUntil(value) { pending.push(value); } });
    await Promise.all(pending);
    return messages;
  }
  return { stores, caches, network, manifest, lifecycle, fetchPath, message, offline(value = true) { offline = value; },
    get claimed() { return claimed; }, get skipped() { return skipped; } };
}

test('Atlas installs the entire verified cohort and responds with ready only after all bytes exist', async () => {
  const worker = harness();
  assert.equal((await worker.message())[0].ready, false);
  await worker.lifecycle('install');
  const status = (await worker.message())[0];
  assert.equal(status.type, 'ATLAS_OFFLINE_STATUS');
  assert.equal(status.ready, true);
  assert.equal(status.totalBytes, worker.manifest.totalBytes);
  assert.deepEqual(status.files, [...bodies.keys()]);
  assert.equal(worker.skipped, 0);
  assert.equal(worker.claimed, 0);
  assert.ok(worker.network.every(request => request.cache === 'reload' && request.method === 'GET'));
  await worker.lifecycle('activate');
  assert.equal(worker.claimed, 1);
  worker.offline();
  const fetchCount = worker.network.length;
  for (const [path, bytes] of bodies) assert.deepEqual(Buffer.from(await (await worker.fetchPath(path)).response.arrayBuffer()), bytes);
  assert.equal(worker.network.length, fetchCount);
  assert.deepEqual(JSON.parse(await (await worker.fetchPath(root + 'package-manifest.json')).response.text()), worker.manifest);
});

test('Atlas canonical directory, index and query URLs replay the same offline HTML', async () => {
  const worker = harness();
  await worker.lifecycle('install'); worker.offline();
  for (const path of [root, root + '?lang=pl', root + 'index.html', root + 'index.html?draft=1']) {
    const { response } = await worker.fetchPath(path);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bodies.get(root + 'index.html'));
    assert.equal(response.redirected, false);
  }
  assert.equal(await (await worker.fetchPath(root + 'app.js?cohort=old')).response.text(), bodies.get(root + 'app.js').toString());
});

test('Atlas does not intercept portal, games, its own worker, unknown assets, remote requests or non-GET', async () => {
  const worker = harness();
  for (const path of ['/', '/sw.js', '/games/hanedanian/', '/games/shared/duel-core/theme-meta.js',
    root + 'sw.js', root + 'unknown.js', root + '../secret.json', 'https://elsewhere.example' + root + 'app.js']) {
    assert.equal((await worker.fetchPath(path)).intercepted, false, path);
  }
  assert.equal((await worker.fetchPath(root + 'app.js', { method: 'POST', body: 'no write' })).intercepted, false);
  assert.deepEqual(await worker.message('CACHE_GAME'), []);
  assert.deepEqual(await worker.message('GET_ATLAS_STATUS', false), []);
});

test('Failed new cohort never changes a complete old package: status, MIME, truncated body and same-length corruption', async () => {
  const old = harness(); await old.lifecycle('install'); await old.lifecycle('activate');
  const failures = [
    () => new Response('missing', { status: 404, headers: { 'content-type': 'text/javascript' } }),
    () => new Response(bodies.get(root + 'app.js'), { headers: { 'content-type': 'text/html' } }),
    () => new Response('short', { headers: { 'content-type': 'text/javascript' } }),
    () => new Response(Buffer.alloc(bodies.get(root + 'app.js').length, 65), { headers: { 'content-type': 'text/javascript' } }),
  ];
  for (let i = 0; i < failures.length; i++) {
    const next = harness({ manifest: packet('failed-' + i), stores: old.stores,
      networkResponse: path => path === root + 'app.js' ? failures[i]() : new Response(bodies.get(path), { headers: { 'content-type': mime(path) } }) });
    await assert.rejects(next.lifecycle('install'), /rejected|mismatch/);
    assert.equal(old.stores.has(next.manifest.version), false);
    assert.equal((await old.message())[0].ready, true);
  }
  old.offline();
  assert.equal((await old.fetchPath(root)).response.status, 200);
});

test('Quota failure deletes only the partially written candidate; activation never erases unrelated caches', async () => {
  const old = harness(); await old.lifecycle('install');
  for (const name of ['cete-offline-v5', 'hanedanian-package-active', 'duel-cards-keep']) await old.caches.open(name);
  let writes = 0;
  const broken = harness({ stores: old.stores, manifest: packet('quota'), onPut: () => { if (++writes === 3) throw new Error('quota'); } });
  await assert.rejects(broken.lifecycle('install'), /quota/);
  assert.equal(old.stores.has(broken.manifest.version), false);
  assert.equal((await old.message())[0].ready, true);
  const next = harness({ stores: old.stores, manifest: packet('new') });
  await next.lifecycle('install');
  assert.ok(old.stores.has(old.manifest.version), 'Install does not delete old active cohort');
  assert.equal(next.skipped, 0);
  await next.lifecycle('activate');
  assert.equal(old.stores.has(old.manifest.version), false);
  for (const name of ['cete-offline-v5', 'hanedanian-package-active', 'duel-cards-keep']) assert.ok(old.stores.has(name));
  assert.ok(old.stores.has(next.manifest.version));
});

test('Missing or corrupted cached bytes do not produce a false ready response', async () => {
  const worker = harness(); await worker.lifecycle('install');
  const cache = await worker.caches.open(worker.manifest.version);
  await cache.put(root + 'app.js', new Response('corrupt', { headers: { 'content-type': 'text/javascript' } }));
  assert.equal((await worker.message())[0].ready, false);
  await assert.rejects(worker.lifecycle('activate'), /requires a complete/);
  await cache.delete(root + 'app.js'); worker.offline();
  assert.equal((await worker.fetchPath(root + 'app.js')).response.status, 503);
  assert.equal((await worker.message())[0].ready, false);
});

test('Evicted file repairs only expected bytes; a changed network file cannot mix into an old cohort', async () => {
  const worker = harness(); await worker.lifecycle('install');
  const cache = await worker.caches.open(worker.manifest.version);
  await cache.delete(root + 'app.js');
  assert.equal((await worker.fetchPath(root + 'app.js')).response.status, 200);
  assert.equal((await worker.message())[0].ready, true);
  await cache.delete(root + 'app.js');
  const changed = new Map(bodies); changed.set(root + 'app.js', Buffer.from('export const current = "newer-version!";'));
  const nextNetwork = harness({ stores: worker.stores, content: changed });
  assert.equal((await nextNetwork.fetchPath(root + 'app.js')).response.status, 503);
  assert.equal(await cache.match(root + 'app.js'), undefined);
});

test('A real followed Workers-style HTML redirect is normalized without changing bytes or headers', async t => {
  const html = Buffer.concat([bodies.get(root + 'index.html'), Buffer.from([0, 0xff])]);
  const content = new Map(bodies); content.set(root + 'index.html', html);
  const server = createServer((request, response) => {
    const path = new URL(request.url, defaultOrigin).pathname;
    if (path === root + 'index.html') { response.writeHead(302, { location: root }); response.end(); return; }
    response.writeHead(200, { 'content-type': mime(path) + '; charset=utf-8', 'x-atlas-fixture': 'exact-bytes' });
    response.end(path === root ? html : content.get(path));
  });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let sawRedirect = false;
  const worker = harness({ origin, manifest: packet('redirect', content), networkResponse: async path => {
    const result = await fetch(origin + path);
    if (path === root + 'index.html') sawRedirect = result.redirected;
    return result;
  } });
  await worker.lifecycle('install'); worker.offline();
  assert.equal(sawRedirect, true, 'Server produced a native redirected Response');
  for (const path of [root, root + 'index.html']) {
    const response = (await worker.fetchPath(path)).response;
    assert.equal(response.redirected, false);
    assert.equal(response.headers.get('x-atlas-fixture'), 'exact-bytes');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), html);
  }
});

test('Redirected JS and cross-origin or noncanonical HTML are rejected even when bytes match', async () => {
  for (const [path, destination] of [
    [root + 'app.js', defaultOrigin + root + 'other.js'],
    [root + 'index.html', 'https://elsewhere.example' + root],
    [root + 'index.html', defaultOrigin + '/'],
  ]) {
    const worker = harness({ networkResponse: requested => {
      const response = new Response(bodies.get(requested), { headers: { 'content-type': mime(requested) } });
      if (requested === path) Object.defineProperties(response, { redirected: { value: true }, url: { value: destination } });
      return response;
    } });
    await assert.rejects(worker.lifecycle('install'), /redirect rejected/);
  }
});

test('Unbuilt development template cannot report or activate a fabricated offline package', async () => {
  const worker = harness({ manifest: null });
  assert.equal((await worker.message())[0].ready, false);
  await assert.rejects(worker.lifecycle('install'), /has not been built/);
  await assert.rejects(worker.lifecycle('activate'), /requires a complete/);
  assert.equal((await worker.fetchPath(root)).intercepted, false);
});
