import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requireRelease} from './cloudflare-deploy.mjs';

const sha = 'a'.repeat(40);
const runs = ['ci', 'tc-job-start-outcome'].map((name, i) => ({id:i + 1, path:`.github/workflows/${name}.yml`, event:'push', head_branch:'main', head_sha:sha, status:'completed', conclusion:'success'}));
test('allows only current main with both mandatory workflows successful', () => {
  requireRelease({sha, main:sha, runs});
  assert.throws(() => requireRelease({sha, main:'b'.repeat(40), runs}), /Main moved/);
  assert.throws(() => requireRelease({sha, main:sha, runs:[]}), /Missing mandatory/);
});
test('pending, failed, superseded and unrelated runs cannot authorize a deploy', () => {
  for (const patch of [{status:'in_progress', conclusion:null}, {conclusion:'failure'}, {head_sha:'b'.repeat(40)}, {head_branch:'other'}, {event:'pull_request'}]) {
    assert.throws(() => requireRelease({sha, main:sha, runs:[{...runs[0], ...patch}, runs[1]]}));
  }
  assert.throws(() => requireRelease({sha, main:sha, runs:[...runs, {...runs[0], id:99, conclusion:'failure'}]}), /must PASS/);
});

test('every main push supplies the exact-SHA TC workflow required by publication', () => {
  const yaml = createRequire(import.meta.url)('js-yaml');
  const workflow = yaml.load(readFileSync(new URL('../.github/workflows/tc-job-start-outcome.yml', import.meta.url), 'utf8'));
  assert.deepEqual(workflow.on.push, {branches: ['main']});
});
