import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ATLAS_ROOT, MAX_ATLAS_FILE_BYTES, buildAtlasPackage, emitAtlasPackage, atlasPackagePlugin } from './atlas-package.mjs';
import { offlineSwPlugin } from './offline-sw-plugin.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'atlas-package-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'atlas/yapi');
  await mkdir(join(directory, 'fixtures'), { recursive: true });
  const contents = {
    'index.html': '<!doctype html><link rel="manifest" href="./manifest.webmanifest"><link rel="stylesheet" href="style.css"><script type="module" src="app.js"></script>',
    'app.js': "import { title } from './content.js'; export { body } from './geometry.js'; console.log(title);",
    'content.js': 'export const title = "Anatomi — öğrenme içeriği";',
    'geometry.js': 'export const body = [1,2,3];',
    'style.css': ':root { color: #123; }',
    'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'manifest.webmanifest': JSON.stringify({ start_url: ATLAS_ROOT, icons: [{ src: './icon.svg' }] }),
    'fixtures/smoke.json': JSON.stringify({ educational: true, expertReview: 'pending' }),
  };
  for (const [name, text] of Object.entries(contents)) await writeFile(join(directory, name), text);
  return { root, directory, contents };
}

test('Atlas emitter records every scoped asset exact bytes, SHA and MIME; repeat output is deterministic', async t => {
  const { root, directory, contents } = await fixture(t);
  const sentinel = join(root, 'sw.js');
  await writeFile(sentinel, 'root worker untouched');
  const first = await emitAtlasPackage(root);
  assert.equal(first.schema, 1);
  assert.equal(first.root, ATLAS_ROOT);
  assert.match(first.version, /^atlas-foundation-[a-f0-9]{24}$/);
  assert.deepEqual(first.files.map(file => file.path), Object.keys(contents).sort().map(name => ATLAS_ROOT + name));
  for (const file of first.files) {
    const bytes = Buffer.from(contents[file.path.slice(ATLAS_ROOT.length)]);
    assert.equal(file.bytes, bytes.length);
    assert.equal(file.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.match(file.mime, /^(?:text|application|image)\//);
  }
  assert.equal(first.totalBytes, Object.values(contents).reduce((total, text) => total + Buffer.byteLength(text), 0));
  const compiled = await readFile(join(directory, 'sw.js'), 'utf8');
  assert.ok(compiled.includes(first.version));
  assert.ok(!compiled.includes('/* ATLAS_PACKAGE */ null'));
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'package-manifest.json'), 'utf8')), first);
  assert.deepEqual(await emitAtlasPackage(root), first, 'Emitted SW and manifest are excluded from their own inventory');
  assert.equal(await readFile(sentinel, 'utf8'), 'root worker untouched');
});

test('Any module, source record, geometry or fixture change rotates the whole cohort', async t => {
  const { directory } = await fixture(t);
  let previous = (await buildAtlasPackage(directory)).manifest.version;
  for (const path of ['content.js', 'geometry.js', 'fixtures/smoke.json']) {
    await writeFile(join(directory, path), path.endsWith('.json') ? '{"review":"pending-v2"}' : 'export const changed = true;');
    const next = (await buildAtlasPackage(directory)).manifest.version;
    assert.notEqual(next, previous, path);
    previous = next;
  }
});

test('Atlas refuses dependencies outside its package, including CDN and missing local modules', async t => {
  const { directory } = await fixture(t);
  for (const [source, expected] of [
    ["import 'https://cdn.example/atlas.js'", /escapes/],
    ["import '/games/shared/pixi-adapter.js'", /escapes/],
    ["import './missing.js'", /missing from package/],
    ["const load = () => import('./absent.js')", /missing from package/],
  ]) {
    await writeFile(join(directory, 'app.js'), source);
    await assert.rejects(buildAtlasPackage(directory), expected);
  }
});

test('Atlas rejects external CSS image/font URLs and HTML assets, but allows source links as anchors', async t => {
  const { directory, contents } = await fixture(t);
  await writeFile(join(directory, 'style.css'), '@font-face { src: url(https://cdn.example/font.woff2); }');
  await assert.rejects(buildAtlasPackage(directory), /escapes/);
  await writeFile(join(directory, 'style.css'), contents['style.css']);
  await writeFile(join(directory, 'index.html'), contents['index.html'] + '<img src="https://remote.example/body.png">');
  await assert.rejects(buildAtlasPackage(directory), /escapes/);
  await writeFile(join(directory, 'index.html'), contents['index.html'] + '<a href="https://www.nih.gov/">Factual source</a>');
  await buildAtlasPackage(directory);
});

test('Atlas package file and total budgets are hard gates', async t => {
  const { directory } = await fixture(t);
  await writeFile(join(directory, 'large.svg'), ' '.repeat(MAX_ATLAS_FILE_BYTES + 1));
  await assert.rejects(buildAtlasPackage(directory), /individual asset exceeds/);
  await rm(join(directory, 'large.svg'));
  for (let i = 0; i < 11; i++) await writeFile(join(directory, `chunk-${i}.json`), ' '.repeat(MAX_ATLAS_FILE_BYTES));
  await assert.rejects(buildAtlasPackage(directory), /exceeds 5 MiB/);
});

test('Atlas refuses symlinks, unknown binary assets and a missing offline fixture', async t => {
  const { root, directory } = await fixture(t);
  await writeFile(join(root, 'outside.js'), 'secret example');
  await symlink(join(root, 'outside.js'), join(directory, 'outside.js'));
  await assert.rejects(buildAtlasPackage(directory), /symlinks/);
  await rm(join(directory, 'outside.js'));
  await writeFile(join(directory, 'downloaded.glb'), 'unapproved external model');
  await assert.rejects(buildAtlasPackage(directory), /Unsupported/);
  await rm(join(directory, 'downloaded.glb'));
  await rm(join(directory, 'fixtures/smoke.json'));
  await assert.rejects(buildAtlasPackage(directory), /required package asset missing/);
});

test('Atlas build plugin ignores SSR outputs and never emits root/game assets', async () => {
  const plugin = atlasPackagePlugin(), emitted = [];
  assert.equal(plugin.apply, 'build');
  await plugin.generateBundle.call({ environment: { name: 'ssr' }, emitFile: file => emitted.push(file) }, {}, {});
  await plugin.generateBundle.call({ emitFile: file => emitted.push(file) }, {}, { 'server.mjs': {} });
  assert.deepEqual(emitted, []);
});

test('Real foundation graph fits the package; client plugin emits only the complete scoped cohort', async () => {
  const directory = fileURLToPath(new URL('../public/atlas/yapi/', import.meta.url));
  const { manifest } = await buildAtlasPackage(directory);
  for (const name of ['app.js', 'content.js', 'content-schema.js', 'geometry.js', 'svg-view.js', 'view-model.js', 'fixtures/smoke.json']) {
    assert.ok(manifest.files.some(file => file.path === ATLAS_ROOT + name), name);
  }
  assert.ok(manifest.files.every(file => file.path.startsWith(ATLAS_ROOT)));
  assert.ok(manifest.totalBytes < 500 * 1024, 'Foundation source package must remain under 500 KiB');
  const emitted = [], bundle = { 'assets/portal-hash.js': { type: 'chunk' } };
  await atlasPackagePlugin().generateBundle.call({ environment: { name: 'client' }, emitFile: file => emitted.push(file) }, {}, bundle);
  assert.deepEqual(emitted.map(file => file.fileName), [...manifest.files.map(file => file.path.slice(1)), 'atlas/yapi/package-manifest.json', 'atlas/yapi/sw.js']);
  assert.deepEqual(JSON.parse(emitted.find(file => file.fileName === 'atlas/yapi/package-manifest.json').source), manifest);
  assert.deepEqual(Object.keys(bundle), ['assets/portal-hash.js'], 'Atlas does not inject runtime files into portal chunks');
});

test('Atlas plugin replaces stale incremental output with the exact source snapshot it hashed', async t => {
  const destination = await mkdtemp(join(tmpdir(), 'atlas-stale-output-'));
  t.after(() => rm(destination, { recursive: true, force: true }));
  await mkdir(join(destination, 'atlas/yapi'), { recursive: true });
  await writeFile(join(destination, 'atlas/yapi/geometry.js'), 'old longer geometry from previous build, not current source');
  await writeFile(join(destination, 'sw.js'), 'portal worker sentinel');
  const emitted = [];
  await atlasPackagePlugin().generateBundle.call({ environment: { name: 'client' }, emitFile: file => emitted.push(file) }, {}, {});
  for (const asset of emitted) {
    assert.ok(asset.fileName.startsWith('atlas/yapi/'), asset.fileName);
    const target = join(destination, asset.fileName);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, asset.source);
  }
  const manifest = JSON.parse(await readFile(join(destination, 'atlas/yapi/package-manifest.json'), 'utf8'));
  const geometry = manifest.files.find(file => file.path.endsWith('/geometry.js'));
  const actual = await readFile(join(destination, geometry.path.slice(1)));
  assert.equal(actual.length, geometry.bytes, 'A current manifest cannot accompany stale incremental geometry');
  for (const file of manifest.files) {
    const bytes = await readFile(join(destination, file.path.slice(1)));
    assert.equal(bytes.length, file.bytes, file.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
    const source = await readFile(new URL('../public' + file.path, import.meta.url));
    assert.deepEqual(bytes, source, 'Emission must reflect source, not rehash a stale output: ' + file.path);
  }
  assert.equal(await readFile(join(destination, 'sw.js'), 'utf8'), 'portal worker sentinel');
});

test('Root SW emitted before Atlas never precaches the scoped runtime cohort', async () => {
  const emitted = [], bundle = { 'assets/portal-hash.js': { type: 'chunk' } };
  const context = { environment: { name: 'client' }, emitFile(file) { emitted.push(file); bundle[file.fileName] = file; } };
  offlineSwPlugin().generateBundle.call(context, {}, bundle);
  const rootWorker = emitted.find(asset => asset.fileName === 'sw.js').source;
  assert.ok(rootWorker.includes('/assets/portal-hash.js'));
  await atlasPackagePlugin().generateBundle.call(context, {}, bundle);
  assert.ok(Object.keys(bundle).includes('atlas/yapi/geometry.js'));
  assert.equal(emitted.filter(asset => asset.fileName === 'sw.js').length, 1);
  assert.ok(!rootWorker.includes('/atlas/yapi/'));
});
