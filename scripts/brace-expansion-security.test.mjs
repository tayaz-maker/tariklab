import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Point this at an unchanged checkout to reproduce the old installed dependency
// graph without replacing packages in the working tree under test.
const moduleRoot = resolve(process.env.BRACE_EXPANSION_TEST_ROOT || dirname(fileURLToPath(new URL('../package.json', import.meta.url))));
const subprocessLimitMs = 3000;

// Untrusted-pattern regressions run outside the test runner: a stack overflow,
// runaway allocation or CPU loop must fail one bounded child, not hang npm test.
const childSource = String.raw`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { root, family, api, scenario } = JSON.parse(readFileSync(0, 'utf8'));
const parentAnchor = family === 'legacy'
  ? resolve(root, 'package.json')
  : resolve(root, 'node_modules/@typescript-eslint/typescript-estree/package.json');
const parentRequire = createRequire(parentAnchor);
const minimatchEntry = parentRequire.resolve('minimatch');
// Resolve from the real consumer, so a stale nested dependency cannot be hidden
// by a patched but unused top-level brace-expansion installation.
const braceEntry = createRequire(minimatchEntry).resolve('brace-expansion');
const braceModule = await import(pathToFileURL(braceEntry).href);
const minimatchModule = await import(pathToFileURL(minimatchEntry).href);
const expand = braceModule.expand || braceModule.default;
const minimatch = minimatchModule.minimatch || minimatchModule.default;
const braceExpand = minimatchModule.braceExpand || minimatch.braceExpand;
assert.equal(typeof expand, 'function');
assert.equal(typeof minimatch, 'function');
assert.equal(typeof braceExpand, 'function');

if (scenario === 'ordinary') {
  const examples = [
    ['file{a,b}.js', ['filea.js', 'fileb.js']],
    ['tile{01..03}.png', ['tile01.png', 'tile02.png', 'tile03.png']],
    ['{3..1}', ['3', '2', '1']],
    ['x{a,{b,c}}y', ['xay', 'xby', 'xcy']],
    ['literal\\{a,b\\}', ['literal{a,b}']],
    ['{a},b}', ['a}', 'b']],
  ];
  for (const [pattern, expected] of examples) assert.deepEqual(expand(pattern), expected, pattern);
  assert.deepEqual(braceExpand('src/{game,map}.{js,ts}'), ['src/game.js', 'src/game.ts', 'src/map.js', 'src/map.ts']);
  assert.equal(minimatch('src/game.ts', 'src/{game,map}.{js,ts}'), true);
  assert.equal(minimatch('src/other.ts', 'src/{game,map}.{js,ts}'), false);
  assert.equal(minimatch('tile02.png', 'tile{01..03}.png'), true);
  assert.equal(minimatch('tile04.png', 'tile{01..03}.png'), false);
  assert.equal(minimatch('literal{a,b}.txt', 'literal\\{a,b\\}.txt'), true);
  assert.equal(minimatch('src/.hidden.js', 'src/*.{js,ts}'), false);
} else {
  const payload = scenario === 'GHSA-6j4f-fj2g-mc7p'
    ? '{' + '{a},'.repeat(10000) + 'b}'
    : scenario === 'GHSA-qhr7-859c-m2p7'
      ? '{'.repeat(4000) + 'a,b' + '}'.repeat(4000)
      : scenario === 'GHSA-q2hr-2g5m-vwhr'
        ? '{a}' + '}'.repeat(64000) + ',z}'
        : assert.fail('Unknown advisory');
  assert.ok(payload.length < 65536, 'Payload must reach brace parsing below minimatch\'s input-length guard');
  const result = api === 'brace-expansion' ? expand(payload) : braceExpand(payload);
  // Patched versions may retain over-budget groups literally. Require a valid,
  // bounded result without coupling the regression to an internal cap value.
  assert.ok(Array.isArray(result) && result.length > 0 && result.length <= payload.length);
  assert.ok(result.every(value => typeof value === 'string'));
  assert.ok(result.reduce((total, value) => total + value.length, 0) <= payload.length * 4);
  if (api === 'minimatch') assert.equal(typeof minimatch('sentinel', payload), 'boolean');
}
process.stdout.write(JSON.stringify({ ok: true, family, api, scenario, braceEntry, minimatchEntry }));
`;

function runBounded(family, scenario, api = 'both') {
  const childEnv = { ...process.env };
  delete childEnv.NODE_OPTIONS;
  const result = spawnSync(process.execPath, ['--max-old-space-size=128', '--input-type=module', '-e', childSource], {
    input: JSON.stringify({ root: moduleRoot, family, api, scenario }),
    encoding: 'utf8', timeout: subprocessLimitMs, killSignal: 'SIGKILL',
    maxBuffer: 64 * 1024, env: childEnv,
  });
  const failure = `${family} ${api} ${scenario}: ${result.error?.message || result.signal || ''}\n${result.stderr || ''}`;
  assert.ok(!result.error, failure);
  assert.equal(result.signal, null, failure);
  assert.equal(result.status, 0, failure);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
}

for (const family of ['legacy', 'modern']) {
  test(`${family} brace expansion and its actual minimatch consumer preserve ordinary glob semantics`, () => {
    runBounded(family, 'ordinary');
  });
  for (const advisory of ['GHSA-6j4f-fj2g-mc7p', 'GHSA-qhr7-859c-m2p7', 'GHSA-q2hr-2g5m-vwhr']) {
    // Primary reports: https://github.com/advisories/<advisory>
    for (const api of ['brace-expansion', 'minimatch']) {
      test(`${family} ${api} handles ${advisory} within ${subprocessLimitMs} ms and 128 MiB V8 heap`, () => {
        runBounded(family, advisory, api);
      });
    }
  }
}
