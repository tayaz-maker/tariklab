import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyProductionUnchanged } from './production-guard.mjs';

test('production protection rejects changed, missing and new files but permits proof-only additions', () => {
  const root = mkdtempSync(join(tmpdir(), 'b11-protection-'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  try {
    git(['init', '-q']); mkdirSync(join(root, 'public'));
    writeFileSync(join(root, 'public/game.js'), 'original');
    git(['add', '.']); git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
      'commit', '-qm', 'fixture baseline']);
    const base = git(['rev-parse', 'HEAD']).trim();
    assert.equal(verifyProductionUnchanged(root, base, ['public']), 1);
    writeFileSync(join(root, 'public/game.js'), 'changed');
    assert.throws(() => verifyProductionUnchanged(root, base, ['public']), /protected blob changed/);
    writeFileSync(join(root, 'public/game.js'), 'original');
    writeFileSync(join(root, 'public/new.js'), 'new');
    assert.throws(() => verifyProductionUnchanged(root, base, ['public']), /inventory changed/);
    unlinkSync(join(root, 'public/new.js')); unlinkSync(join(root, 'public/game.js'));
    assert.throws(() => verifyProductionUnchanged(root, base, ['public']), /ENOENT/);
    writeFileSync(join(root, 'public/game.js'), 'original');
    mkdirSync(join(root, 'outputs')); writeFileSync(join(root, 'outputs/test.mjs'), 'proof');
    assert.equal(verifyProductionUnchanged(root, base, ['public']), 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
