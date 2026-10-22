import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(path, 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('JITEM is absent from all catalogue languages and the legacy play route redirects before lookup', () => {
  for (const path of ['src/lib/games.ts', 'src/lib/i18n.ts', 'public/i18n/tlab-i18n.js', 'public/credits.html', 'public/sitemap.xml']) {
    assert.doesNotMatch(read(path), /jitem-derin-ag|JITEM: Derin Ağ/, path);
  }
  const shell = read('src/routes/oyna.$slug.tsx');
  assert.ok(shell.indexOf('canonical === "jitem-derin-ag"') < shell.indexOf('throw notFound()'));
  assert.match(shell, /canonical === "jitem-derin-ag"\) throw redirect\(\{ to: "\/", replace: true \}\)/);
  assert.doesNotMatch(shell, /derin-ag-locale|embed=1|localStorage|indexedDB/);
  const tombstone = read('public/games/jitem-derin-ag/index.html');
  assert.match(tombstone, /http-equiv="refresh" content="0;url=\/"/);
  assert.match(tombstone, /href="\/"/);
  assert.doesNotMatch(tombstone, /<script|iframe|runtime\.js/);
  assert.deepEqual(readdirSync('public/games/jitem-derin-ag'), ['index.html']);
});

test('retirement evicts only same-origin JITEM cache entries and never touches saves or other game caches', async () => {
  const origin = 'https://www.tariklab.com';
  const paths = ['/games/jitem-derin-ag/assets/runtime.js', '/oyna/jitem-derin-ag?lang=pl', '/games/tc-sim/index.html', '/games/hanedanian/index.html', '/assets/portal.js'];
  const stores = new Map(['cete-offline-v6', 'cete-offline-v7', 'hanedanian-package-keep', 'unrelated-cache'].map(name => [name, new Map(paths.map(p => [origin + p, 'cached']))]));
  const events = {}, deleted = [];
  const context = {
    URL, Response, Promise,
    self: {location: {origin}, addEventListener: (name, fn) => {events[name] = fn;}, clients: {claim: async () => {} }},
    caches: {
      keys: async () => [...stores.keys()],
      delete: () => assert.fail('never delete an entire cache during retirement'),
      open: async name => ({
        keys: async () => [...stores.get(name).keys()].map(url => ({url})),
        delete: async req => {deleted.push([name, req.url]); return stores.get(name).delete(req.url);},
      }),
    },
    fetch: () => assert.fail('retired URLs must never fall back to network or cached runtime'),
  };
  for (const name of ['localStorage', 'indexedDB']) Object.defineProperty(context, name, {get: () => assert.fail('save storage must not be accessed')});
  vm.runInNewContext(read('public/sw.js'), context);
  let activated;
  events.activate({waitUntil: promise => {activated = promise;}}); await activated;
  assert.equal(deleted.length, 4);
  for (const name of ['cete-offline-v6', 'cete-offline-v7']) {
    assert.equal(stores.get(name).size, 3);
    for (const p of paths.slice(2)) assert.ok(stores.get(name).has(origin + p));
  }
  for (const name of ['hanedanian-package-keep', 'unrelated-cache']) assert.equal(stores.get(name).size, 5);
  for (const [path, mode, status] of [['/oyna/jitem-derin-ag', 'navigate', 302], ['/games/jitem-derin-ag/index.html', 'navigate', 302], ['/games/jitem-derin-ag/assets/runtime.js', 'cors', 410]]) {
    let response;
    events.fetch({request: {url: origin + path, method: 'GET', mode}, respondWith: value => {response = Promise.resolve(value);}});
    const result = await response; assert.equal(result.status, status);
    if (status === 302) assert.equal(result.headers.get('location'), origin + '/');
  }
});

test('retained HANEDANIAN and TC SIM import their existing shared modules, never the JITEM atlas chunk', () => {
  const han = read('public/games/hanedanian/map-pixi.js');
  assert.match(han, /import\('\.\.\/shared\/pixi-adapter.js'\)/);
  assert.match(read('public/games/shared/pixi-adapter.js'), /\/vendor\/pixi\/pixi-8\.21\.0\.min\.mjs/);
  assert.match(read('public/games/tc-sim/js/desk.js'), /\.\.\/\.\.\/shared\/management-desk.js/);
  for (const path of ['public/games/hanedanian/map.js', 'public/games/hanedanian/map-pixi.js', 'public/games/shared/pixi-adapter.js', 'public/vendor/pixi/pixi-8.21.0.min.mjs', 'public/games/tc-sim/js/state.js', 'public/games/shared/management-desk.js']) {
    assert.ok(existsSync(path), path); assert.doesNotMatch(read(path), /jitem-derin-ag|atlas-pixi-Dilx3yA8/);
  }
});

test('durable recovery package extracts, verifies every SHA-256 and retains schema-5 source and original runtime', () => {
  const root = 'docs/archives/jitem', metrics = JSON.parse(read(root + '/archive-metrics.json'));
  const archive = join(root, 'jitem-recovery-2026-10-22.tar.xz');
  assert.equal(sha(readFileSync(archive)), metrics.archiveSha256);
  assert.equal(readFileSync(archive).length, metrics.archiveBytes);
  const dest = mkdtempSync(join(tmpdir(), 'jitem-recovery-'));
  try {
    execFileSync('tar', ['-xJf', archive, '-C', dest]);
    const rows = read(join(dest, 'SHA256SUMS')).trim().split('\n');
    assert.equal(rows.length, metrics.manifestEntries);
    for (const row of rows) {
      const [expected, path] = row.split('  ');
      assert.equal(sha(readFileSync(join(dest, path))), expected, path);
      assert.doesNotMatch(path, /(?:^|\/)(?:node_modules|\.output|\.jitem-embed|\.cache)(?:\/|$)|\.log$/);
    }
    assert.equal(rows.filter(row => row.split('  ')[1].startsWith('upstream/')).length, 187);
    const source = JSON.parse(read(join(dest, 'SOURCE.json')));
    assert.equal(source.upstreamSha, 'c09fd1a0c4c1ba586e0383d569a959c623162ca7');
    assert.equal(source.sourceReceipt.schemaVersion, 5);
    assert.equal(source.sourceReceipt.saveKey, 'jitem-derin-ag-v3');
    assert.equal(sha(readFileSync(join(dest, 'portal/public/games/jitem-derin-ag/assets/runtime.js'))), source.sourceReceipt.runtimeSha256);
    const types = read(join(dest, 'upstream/src/game/types.ts'));
    assert.match(types, /SAVE_VERSION = 5/); assert.match(types, /SCHEMA_VERSION = 5/);
    assert.match(types, /LEGACY_SAVE_KEY = "derin-ag-save-v1"/);
    for (const path of ['upstream/docs/SOURCES.md', 'upstream/src/game/db/sources.ts', 'upstream/src/game/sim/save.ts', 'upstream/scripts/save-recovery.test.ts', 'portal/scripts/build-jitem-embed.mjs', 'RESTORE.md']) assert.ok(existsSync(join(dest, path)), path);
  } finally {rmSync(dest, {recursive: true, force: true});}
});
