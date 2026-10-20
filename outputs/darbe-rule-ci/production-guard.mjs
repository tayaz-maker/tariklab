import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const BASE = '9e50404c0573e1cf9e2dd7e623c9c8bd98b95e56';
export const PROTECTED = ['public/games/darbe-h', 'public/games/duel-core',
  'public/games/veto-h', 'public/games/gett-oh', 'package.json', 'package-lock.json'];
// The card-art gate adds only an inactive release pointer. Keep the old
// production snapshot immutable for every other protected file, and pin the
// three deliberate changes by blob so this proof remains fail-closed.
export const CARD_ART_GATE_BLOBS = Object.freeze({
  'package.json': '08ccca6058ea19ab26b81e1a02ac34f317b1c72e',
  'public/games/duel-core/art-release.js': 'a77455d26bec58b9d2fcd0422790a24304879919',
  'public/games/duel-core/theme-meta.js': '3d913cc18ef218f932a77e864643d91bd60f1f3e',
});
// Hosting-only exception, reviewed in PR #214. These exact blobs add pinned
// Wrangler and two release scripts; all 499 existing lock entries are unchanged
// except the root devDependency declaration. See cloudflare-lock-provenance.json.
// No gameplay path or wildcard is exempted, and future dependency edits fail closed.
export const CLOUDFLARE_DEPLOYMENT_BLOBS = Object.freeze({
  'package.json': '35823d9419f9111c2943076a5848d9cddcad5751',
  'package-lock.json': '4d83d0b1ded5e92b162fc7e09d9871c14f22b5b7',
});
export function verifyProductionUnchanged(repo, base = BASE, paths = PROTECTED) {
  const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const entries = git(['ls-tree', '-r', base, '--', ...paths]).trim().split('\n').map(line => {
    const [metadata, path] = line.split('\t');
    return { path, blob: metadata.split(' ')[2] };
  });
  assert.ok(entries.length > 0 && entries.every(row => row.path), 'empty protected inventory');
  const approved = base === BASE && paths === PROTECTED ? { ...CARD_ART_GATE_BLOBS, ...CLOUDFLARE_DEPLOYMENT_BLOBS } : {};
  const current = git(['ls-files', '--cached', '--others', '--exclude-standard', '--', ...paths])
    .trim().split('\n').sort();
  const expected = [...new Set([...entries.map(row => row.path), ...Object.keys(approved)])].sort();
  assert.deepEqual(current, expected, 'protected file inventory changed');
  for (const { path, blob } of entries) {
    const bytes = readFileSync(resolve(repo, path));
    const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(actual, approved[path] ?? blob, `protected blob changed: ${path}`);
  }
  for (const [path, blob] of Object.entries(approved)) {
    if (entries.some(row => row.path === path)) continue;
    const bytes = readFileSync(resolve(repo, path));
    const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(actual, blob, `approved new blob changed: ${path}`);
  }
  return entries.length;
}
