import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const BASE = '9e50404c0573e1cf9e2dd7e623c9c8bd98b95e56';
export const PROTECTED = ['public/games/darbe-h', 'public/games/duel-core',
  'public/games/veto-h', 'public/games/gett-oh', 'package.json', 'package-lock.json'];
export function verifyProductionUnchanged(repo, base = BASE, paths = PROTECTED) {
  const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const entries = git(['ls-tree', '-r', base, '--', ...paths]).trim().split('\n').map(line => {
    const [metadata, path] = line.split('\t');
    return { path, blob: metadata.split(' ')[2] };
  });
  assert.ok(entries.length > 0 && entries.every(row => row.path), 'empty protected inventory');
  const current = git(['ls-files', '--cached', '--others', '--exclude-standard', '--', ...paths])
    .trim().split('\n').sort();
  assert.deepEqual(current, entries.map(row => row.path).sort(), 'protected file inventory changed');
  for (const { path, blob } of entries) {
    const bytes = readFileSync(resolve(repo, path));
    const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(actual, blob, `protected blob changed: ${path}`);
  }
  return entries.length;
}
