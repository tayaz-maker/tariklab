/* Atlas-only atomic package. The build replaces this marker with exact bytes,
 * hashes and MIME expectations. No root/game cache or saved game is touched. */
const PACKAGE = /* ATLAS_PACKAGE */ null;
const ROOT = '/atlas/yapi/';
const PREFIX = 'atlas-foundation-';
const MANIFEST_PATH = ROOT + 'package-manifest.json';
const FILES = new Map((PACKAGE?.files ?? []).map(file => [file.path, file]));

function canonicalPath(url) {
  if (url.origin !== self.location.origin) return null;
  return url.pathname === ROOT ? ROOT + 'index.html' : url.pathname;
}

function validMime(actual, expected) {
  const mime = (actual ?? '').split(';', 1)[0].trim().toLowerCase();
  if (expected === 'text/javascript') return ['text/javascript', 'application/javascript'].includes(mime);
  if (expected === 'application/manifest+json') return ['application/manifest+json', 'application/json'].includes(mime);
  return mime === expected;
}

async function checkedResponse(response, file) {
  if (!response.ok || response.type === 'opaque' || !validMime(response.headers.get('content-type'), file.mime)) {
    throw new Error('Atlas package response rejected: ' + file.path);
  }
  // Workers may redirect /index.html to /. Only that canonical, same-origin
  // redirect is accepted. A fresh Response makes the followed HTML replayable
  // under navigation's redirect mode while retaining its exact body bytes.
  if (response.redirected) {
    const final = new URL(response.url);
    if (file.path !== ROOT + 'index.html' || final.origin !== self.location.origin ||
      ![ROOT, ROOT + 'index.html'].includes(final.pathname) || final.search || final.hash) {
      throw new Error('Atlas package redirect rejected: ' + file.path);
    }
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== file.bytes) throw new Error('Atlas package length mismatch: ' + file.path);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== file.sha256) throw new Error('Atlas package hash mismatch: ' + file.path);
  return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function complete(cache) {
  if (!PACKAGE) return false;
  for (const file of PACKAGE.files) {
    const hit = await cache.match(file.path);
    if (!hit) return false;
    try { await checkedResponse(hit, file); } catch { return false; }
  }
  const manifest = await cache.match(MANIFEST_PATH);
  return Boolean(manifest && await manifest.text() === JSON.stringify(PACKAGE) + '\n');
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    if (!PACKAGE || PACKAGE.schema !== 1 || !PACKAGE.version.startsWith(PREFIX) || !PACKAGE.files.length) {
      throw new Error('Atlas offline package has not been built');
    }
    const existingNames = await caches.keys();
    if (existingNames.includes(PACKAGE.version) && await complete(await caches.open(PACKAGE.version))) return;
    // Fetch and validate the entire cohort before any write. A broken deploy,
    // MIME fallback, partial body or stale asset cannot replace a working pack.
    const verified = await Promise.all(PACKAGE.files.map(async file => {
      const response = await fetch(new Request(file.path, { cache: 'reload', credentials: 'same-origin' }));
      return [file.path, await checkedResponse(response, file)];
    }));
    const cache = await caches.open(PACKAGE.version);
    try {
      // Sequential writes ensure a rejection cannot race with pending puts and
      // recreate the failed candidate after cleanup.
      for (const [path, response] of verified) await cache.put(path, response);
      await cache.put(MANIFEST_PATH, new Response(JSON.stringify(PACKAGE) + '\n', {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }));
    } catch (error) {
      await caches.delete(PACKAGE.version);
      throw error;
    }
    // Deliberately no skipWaiting. An upgrade cannot change an open Atlas's
    // module graph. First install follows the browser's normal activation.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    if (!PACKAGE || !await complete(await caches.open(PACKAGE.version))) {
      throw new Error('Atlas activation requires a complete package');
    }
    await self.clients.claim();
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== PACKAGE.version)
      .map(name => caches.delete(name)));
  })());
});

self.addEventListener('fetch', event => {
  if (!PACKAGE || event.request.method !== 'GET') return;
  const path = canonicalPath(new URL(event.request.url));
  if (!FILES.has(path) && path !== MANIFEST_PATH) return;
  event.respondWith((async () => {
    const cache = await caches.open(PACKAGE.version);
    const hit = await cache.match(path);
    if (hit) return hit;
    // Storage eviction is not a new version: repair only matching bytes. Never
    // silently combine this worker's HTML with a newer network module.
    const file = FILES.get(path);
    if (file) {
      try {
        const response = await checkedResponse(await fetch(new Request(path, {
          cache: 'reload', credentials: 'same-origin',
        })), file);
        await cache.put(path, response.clone());
        return response;
      } catch { /* Keep the coherent cohort; report unavailability below. */ }
    }
    return new Response('Atlas offline package unavailable', {
      status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'GET_ATLAS_STATUS' || !event.ports?.[0]) return;
  event.waitUntil((async () => {
    let ready = false;
    try { ready = Boolean(PACKAGE && await complete(await caches.open(PACKAGE.version))); } catch { /* Storage unavailable. */ }
    event.ports[0].postMessage({
      type: 'ATLAS_OFFLINE_STATUS', ready,
      version: PACKAGE?.version ?? null,
      files: PACKAGE?.files.map(file => file.path) ?? [],
      totalBytes: PACKAGE?.totalBytes ?? 0,
    });
  })());
});
