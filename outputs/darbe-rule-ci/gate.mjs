import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export const HOSTS = Object.freeze({ www: 'https://www.tariklab.com',
  workers: 'https://tariklab.tayaz29.workers.dev' });
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const requestPathFor = sourcePath => `/${sourcePath.replace(/\/index\.html$/, '/')}`;
export function validateTarget(mode, origin, env = process.env) {
  const url = new URL(origin);
  assert.equal(url.href, `${url.origin}/`, 'origin only; no path/query/hash/credentials');
  assert.equal(url.username + url.password, '');
  if (mode === 'built') {
    assert.equal(url.protocol, 'http:');
    assert.equal(url.hostname, '127.0.0.1');
    assert.ok(url.port, 'explicit loopback port required');
  } else {
    assert.equal(mode, 'production');
    assert.ok(Object.values(HOSTS).includes(url.origin), 'production host is not allowlisted');
    assert.equal(env.GITHUB_REF, 'refs/heads/main', 'production proof requires main');
    assert.ok(['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME), 'production event denied');
  }
  return url.origin;
}
export async function expectedManifest(directory) {
  const paths = ['i18n/pl-body.js', 'games/darbe-h/assets/art-manifest.json'];
  for (const folder of ['games/duel-core', 'games/darbe-h']) {
    for (const entry of await readdir(resolve(directory, folder), { withFileTypes: true }))
      if (entry.isFile() && /\.(?:js|css|json|html)$/.test(entry.name)) paths.push(`${folder}/${entry.name}`);
  }
  const entries = [];
  for (const path of paths.sort()) {
    const bytes = await readFile(resolve(directory, path));
    assert.ok(bytes.length, `${path}: empty expected bytes`);
    entries.push({ path, requestPath: requestPathFor(path), bytes: bytes.length, sha256: hash(bytes) });
  }
  assert.ok(entries.length > 20, 'runtime/data manifest unexpectedly incomplete');
  return entries;
}
export async function verifyHost(origin, manifest, evidence, fetcher = fetch) {
  assert.ok(Array.isArray(manifest) && manifest.length > 0, 'empty expected manifest');
  for (const expected of manifest) {
    const requestPath = requestPathFor(expected.path);
    if (expected.requestPath !== undefined) assert.equal(expected.requestPath, requestPath);
    const row = { ...expected, requestPath, expectedSHA256: expected.sha256 };
    evidence.push(row);
    const response = await fetcher(`${origin}${requestPath}`, {
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    row.actualURL = response.url; row.status = response.status;
    assert.equal(new URL(response.url).origin, origin, 'asset origin changed');
    assert.equal(response.status, 200, `${expected.path}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    row.actualSHA256 = hash(bytes); row.actualBytes = bytes.length;
    assert.equal(row.actualSHA256, expected.sha256, `${expected.path}: deployed byte mismatch`);
  }
}
