import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDarbeRuleBrowserProof } from './browser-driver.mjs';
import { validateWidths, recordActualOrigin, verifyCompletedCases } from './proof-guards.mjs';

test('driver rejects empty, partial, duplicate and invalid widths before opening any context', async () => {
  let contexts = 0;
  const browser = { newContext() { contexts++; throw new Error('must not open a context'); } };
  for (const widths of [[], [390], [1440, 390, 390], [1440, 390, 0],
    [1440, 390, -320], [1440, 390, 320.5], [1440, 390, '320'], [1440, 390, NaN],
    [1440, 390, 800], [1440, 390, 320, 320], null, '1440,390,320']) {
    await assert.rejects(runDarbeRuleBrowserProof(browser, 'https://expected.example',
      join(tmpdir(), 'must-not-write-darbe'), widths), /widths|three/);
  }
  assert.equal(contexts, 0);
});

test('exact required widths are accepted in either order and copied', () => {
  const original = [320, 1440, 390];
  const validated = validateWidths(original);
  original[0] = 0;
  assert.deepEqual(validated, [320, 1440, 390]);
});

test('case coverage cannot PASS for zero, incomplete, duplicate or failed cases', () => {
  const cases = ['DRB-237', 'DRB-238', 'DRB-239', 'DRB-240'].flatMap(id =>
    [1440, 390, 320].map(width => ({ id, width, status: 'PASS' })));
  const complete = { expectedCaseCount: 12, completedCaseCount: 12, cases };
  assert.doesNotThrow(() => verifyCompletedCases(complete));
  assert.throws(() => verifyCompletedCases({ expectedCaseCount: 0, completedCaseCount: 0, cases: [] }));
  assert.throws(() => verifyCompletedCases({ ...complete, completedCaseCount: 11 }));
  assert.throws(() => verifyCompletedCases({ ...complete, cases: cases.slice(1) }));
  assert.throws(() => verifyCompletedCases({ ...complete, cases: cases.map(() => cases[0]) }));
  assert.throws(() => verifyCompletedCases({ ...complete, cases: [{ ...cases[0], status: 'FAIL' }, ...cases.slice(1)] }));
});

test('origin guard records actual location before rejecting a host, protocol or port change', () => {
  const expected = 'https://expected.example';
  const row = { origins: [] };
  for (const url of ['https://other.example/games/darbe-h/', 'http://expected.example/',
    'https://expected.example:8443/', 'about:blank']) {
    assert.throws(() => recordActualOrigin({ url: () => url }, expected, row, 'reload:after'),
      /unexpected page origin/);
    assert.equal(row.origins.at(-1).actualURL, url);
  }
  const observation = recordActualOrigin({ url: () => `${expected}/games/darbe-h/index.html` },
    expected, row, 'capture:after');
  assert.equal(observation.actualOrigin, expected);
});

test('driver rejects a redirected initial page before storage mutation and writes FAIL evidence', async () => {
  const output = await mkdtemp(join(tmpdir(), 'darbe-origin-guard-'));
  let closed = 0;
  const navigations = [];
  const page = {
    on() {}, async goto(url) { navigations.push(url); }, url: () => 'https://redirected.example/games/darbe-h/',
    evaluate() { throw new Error('must not seed storage on a different origin'); },
  };
  const browser = { async newContext() { return { async newPage() { return page; }, async close() { closed++; } }; } };
  try {
    await assert.rejects(runDarbeRuleBrowserProof(browser, 'https://expected.example', output),
      /goto:fixture-origin: unexpected page origin/);
    const report = JSON.parse(await readFile(join(output, 'browser-results.json'), 'utf8'));
    assert.equal(report.status, 'FAIL');
    assert.equal(report.expectedCaseCount, 12);
    assert.equal(report.completedCaseCount, 0);
    assert.equal(report.cases[0].origins[0].actualOrigin, 'https://redirected.example');
    assert.equal(report.cases[0].status, 'FAIL');
    assert.equal(closed, 1);
    assert.deepEqual(navigations, ['https://expected.example/games/darbe-h/']);
  } finally { await rm(output, { recursive: true, force: true }); }
});
