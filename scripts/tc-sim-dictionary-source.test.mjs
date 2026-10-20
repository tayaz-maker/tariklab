import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

test('TC Polish dictionary regeneration preserves the shipped final-quality translations', () => {
  const root = new URL('../', import.meta.url);
  const scratch = mkdtempSync(join(tmpdir(), 'tariklab-tc-dictionary-'));
  try {
    cpSync(new URL('scripts/pl/', root), join(scratch, 'scripts/pl'), { recursive: true });
    const games = JSON.parse(readFileSync(new URL('scripts/pl/games.json', root), 'utf8'));
    writeFileSync(join(scratch, 'scripts/pl/games.json'), JSON.stringify({ 'tc-sim': games['tc-sim'] }));
    mkdirSync(join(scratch, 'public/i18n/pl'), { recursive: true });
    execFileSync(process.execPath, [join(scratch, 'scripts/pl/build.mjs')]);
    assert.equal(readFileSync(join(scratch, 'public/i18n/pl/tc-sim.json'), 'utf8'),
      readFileSync(new URL('public/i18n/pl/tc-sim.json', root), 'utf8'));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
