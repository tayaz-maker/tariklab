import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { archivedGameSlugs, archivedPath } from './legacy-game-inventory.mjs';
import { GAMES, GAME_CATEGORIES } from '../src/lib/games.ts';
const read = file => readFileSync(file, 'utf8');
const manifest = JSON.parse(read('archives/legacy-games-b-2026-10-22/manifest.json'));

test('exact tabletop members plus three named games retire from all active discovery', () => {
  const tabletop = GAME_CATEGORIES.find(category => category.id === 'tabletop').slugs;
  assert.deepEqual(new Set(archivedGameSlugs), new Set([...tabletop, 'tc-sim-devlet', 'kayip-telefon', 'son-100-gun']));
  assert.deepEqual(GAMES.filter(game => game.status === 'live').map(game => game.slug), ['cete-savaslari', 'hanedanian', 'racon', 'tc-sim', 'apartman', 'son-kasaba']);
  const ctx = { localStorage: { getItem: () => 'en' } };
  vm.runInNewContext(read('public/i18n/tlab-i18n.js'), ctx);
  for (const slug of archivedGameSlugs) {
    assert.equal(GAMES.find(game => game.slug === slug).status, 'archived');
    for (const file of ['public/credits.html', 'public/sitemap.xml']) assert.ok(!read(file).includes(`/oyna/${slug}`), `${file}: ${slug}`);
    for (const key of ['CREDITS_EN', 'CREDITS_PL']) assert.ok(ctx.tlabI18n[key].sections[0].items.every(row => !row.includes(`/oyna/${slug}`)));
  }
});

test('lossless durable archive verifies every file and preserved runtime digest', () => {
  const result = JSON.parse(execFileSync('python3', ['scripts/verify-legacy-games-b.py'], { encoding: 'utf8' }));
  assert.equal(result.status, 'PASS');
  assert.equal(result.files, 1450);
  assert.ok(manifest.files.filter(row => /assets\/cards\/.*\.webp$/.test(row.path)).length >= 600);
});

test('retirement matches only owned URLs, including legacy raw entries, with fixed redirect', () => {
  for (const slug of archivedGameSlugs) for (const path of [`/oyna/${slug}`, `/oyna/${slug}/`, `/games/${slug}`, `/games/${slug}/index.html`, `/games/${slug}/app.js`]) assert.ok(archivedPath(path), path);
  for (const path of ['/oyna/tc-sim', '/games/hanedanian/app.js', '/games/shared/outcome-runtime.js', '/api/auth/session', '/oyna/tc-sim-devlet-new']) assert.ok(!archivedPath(path), path);
  assert.match(read('server/middleware/legacy-games-b.ts'), /Location: "\/"/);
});

test('root service worker retires old cached URLs without modifying user data', async () => {
  const listeners = {}, deleted = [];
  const ctx = { URL, Response, caches: { keys: async () => ['cete-offline-v7'], open: async () => ({ keys: async () => archivedGameSlugs.map(slug => ({ url: `https://test.local/games/${slug}/app.js` })).concat([{ url: 'https://test.local/games/tc-sim/app.js' }]), delete: async req => deleted.push(req.url) }) }, self: { location: { origin: 'https://test.local' }, addEventListener: (name, handler) => listeners[name] = handler, clients: { claim: async () => {} } } };
  vm.runInNewContext(read('public/sw.js'), ctx);
  let pending; listeners.activate({ waitUntil: promise => pending = promise }); await pending;
  assert.equal(deleted.length, 9);
  let response; listeners.fetch({ request: { url: 'https://test.local/oyna/tc-sim-devlet?next=https://example.org', method: 'GET', mode: 'navigate' }, respondWith: value => response = value });
  assert.equal((await response).headers.get('location'), 'https://test.local/');
});

test('shipping package excludes every owned asset and retains shared and protected bytes', () => {
  if (!existsSync('.output/public')) return;
  for (const slug of archivedGameSlugs) assert.deepEqual(readdirSync(`.output/public/games/${slug}`), ['index.html']);
  for (const row of manifest.protectedFiles) {
    const built = row.path.replace(/^public\//, '.output/public/');
    // The existing offline plugin deliberately versions only the scoped worker.
    if (row.path === 'public/games/hanedanian/sw.js') continue;
    assert.equal(createHash('sha256').update(readFileSync(built)).digest('hex'), row.sha256, row.path);
  }
  assert.ok(!existsSync('.output/public/archives'));
});
