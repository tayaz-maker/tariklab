import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { resolve, join, relative, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ATLAS_ROOT = '/atlas/yapi/';
export const MAX_ATLAS_PACKAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ATLAS_FILE_BYTES = 512 * 1024;
const marker = '/* ATLAS_PACKAGE */ null';
const workerTemplate = new URL('../public/atlas/yapi/sw.js', import.meta.url);
const mimeTypes = new Map([
  ['.html', 'text/html'], ['.js', 'text/javascript'], ['.mjs', 'text/javascript'],
  ['.css', 'text/css'], ['.json', 'application/json'], ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json'],
]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function runtimeFiles(directory, root = directory) {
  const output = [];
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name), stat = await lstat(path);
    const local = relative(root, path).split(sep).join('/');
    if (stat.isSymbolicLink()) throw new Error('Atlas package must not follow symlinks: ' + local);
    if (stat.isDirectory()) output.push(...await runtimeFiles(path, root));
    else if (stat.isFile() && !['sw.js', 'package-manifest.json'].includes(local)) {
      if (!/^[a-zA-Z0-9_./-]+$/.test(local) || !mimeTypes.has(extname(local))) {
        throw new Error('Unsupported Atlas runtime asset: ' + local);
      }
      const bytes = await readFile(path);
      if (bytes.length > MAX_ATLAS_FILE_BYTES) throw new Error('Atlas individual asset exceeds budget: ' + local);
      output.push({ local, bytes, mime: mimeTypes.get(extname(local)) });
    }
  }
  return output;
}

function dependencies(asset) {
  const text = asset.bytes.toString('utf8'), found = [];
  if (asset.mime === 'text/html') {
    for (const match of text.matchAll(/<(?:script|link|img|source)\b[^>]*?\b(?:src|href)=['"]([^'"]+)['"]/gi)) found.push(match[1]);
  }
  if (asset.mime === 'text/javascript') {
    for (const match of text.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?['"]([^'"]+)['"]/g)) found.push(match[1]);
    for (const match of text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push(match[1]);
  }
  if (asset.mime === 'text/css') {
    for (const match of text.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) found.push(match[1]);
    for (const match of text.matchAll(/@import\s+['"]([^'"]+)['"]/g)) found.push(match[1]);
  }
  if (asset.mime === 'application/manifest+json') {
    const manifest = JSON.parse(text);
    found.push(manifest.start_url, ...manifest.icons.map(icon => icon.src));
  }
  return found.filter(Boolean);
}

function verifyDependencyScope(assets) {
  const origin = 'https://atlas.invalid';
  const paths = new Set(assets.map(asset => ATLAS_ROOT + asset.local));
  for (const asset of assets) for (const link of dependencies(asset)) {
    if (link.startsWith('#')) continue;
    const url = new URL(link, origin + ATLAS_ROOT + asset.local);
    if (url.origin !== origin || !url.pathname.startsWith(ATLAS_ROOT)) {
      throw new Error('Atlas dependency escapes its offline scope: ' + link);
    }
    const path = url.pathname === ATLAS_ROOT ? ATLAS_ROOT + 'index.html' : url.pathname;
    if (!paths.has(path)) throw new Error('Atlas dependency missing from package: ' + path);
  }
}

/** Reads each scoped runtime file once. Hashes and emitted bodies must share
 * this byte snapshot: an incremental static copy can otherwise retain an old
 * geometry module while this manifest describes the newly edited source. */
export async function buildAtlasPackage(directory) {
  const [source, assets] = await Promise.all([readFile(workerTemplate, 'utf8'), runtimeFiles(directory)]);
  if (source.split(marker).length !== 2) throw new Error('Atlas worker requires exactly one package marker');
  for (const required of ['index.html', 'manifest.webmanifest', 'icon.svg', 'fixtures/smoke.json']) {
    if (!assets.some(asset => asset.local === required)) throw new Error('Atlas required package asset missing: ' + required);
  }
  verifyDependencyScope(assets);
  const files = assets.map(asset => ({ path: ATLAS_ROOT + asset.local,
    bytes: asset.bytes.byteLength, sha256: hash(asset.bytes), mime: asset.mime }));
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (totalBytes > MAX_ATLAS_PACKAGE_BYTES) throw new Error('Atlas offline package exceeds 5 MiB budget');
  const workerSha256 = hash(source);
  const version = 'atlas-foundation-' + hash(JSON.stringify({ files, workerSha256 })).slice(0, 24);
  const manifest = { schema: 1, root: ATLAS_ROOT, version, workerSha256, totalBytes, files };
  return { manifest, assets, worker: source.replace(marker, () => JSON.stringify(manifest)) };
}

/** Run after the static public directory has been copied to a build destination.
 * Nothing under games/, shared root SW or portal assets is read or modified. */
export async function emitAtlasPackage(outputPublicRoot) {
  const directory = join(resolve(outputPublicRoot), 'atlas/yapi');
  const { manifest, worker } = await buildAtlasPackage(directory);
  await writeFile(join(directory, 'package-manifest.json'), JSON.stringify(manifest) + '\n');
  await writeFile(join(directory, 'sw.js'), worker);
  return manifest;
}

/** Place after offlineSwPlugin: Atlas must not enter the portal's precache. */
export function atlasPackagePlugin() {
  return {
    name: 'tariklab:atlas-scoped-package',
    apply: 'build',
    async generateBundle(_options, bundle) {
      const environment = this.environment?.name;
      if (environment && environment !== 'client') return;
      const names = Object.keys(bundle);
      if (names.some(name => name.includes('_ssr') || name.endsWith('.mjs'))) return;
      const directory = fileURLToPath(new URL('../public/atlas/yapi/', import.meta.url));
      const { manifest, worker, assets } = await buildAtlasPackage(directory);
      // Own every scoped runtime emission, not only its inventory. This avoids
      // depending on Nitro's incremental public-file copy timestamps. It also
      // ensures emitted bytes are exactly those hashed above, without rereads.
      for (const asset of assets) {
        this.emitFile({ type: 'asset', fileName: 'atlas/yapi/' + asset.local, source: asset.bytes });
      }
      this.emitFile({ type: 'asset', fileName: 'atlas/yapi/package-manifest.json', source: JSON.stringify(manifest) + '\n' });
      this.emitFile({ type: 'asset', fileName: 'atlas/yapi/sw.js', source: worker });
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await emitAtlasPackage(process.argv[2] ?? '.output/public');
  console.log(JSON.stringify({ version: manifest.version, files: manifest.files.length, totalBytes: manifest.totalBytes }));
}
