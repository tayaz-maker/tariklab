import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requireBuildIdentity, requireRelease} from './cloudflare-deploy.mjs';

const sha = 'a'.repeat(40);
const runs = ['ci', 'tc-job-start-outcome'].map((name, i) => ({id:i + 1, path:`.github/workflows/${name}.yml`, event:'push', head_branch:'main', head_sha:sha, status:'completed', conclusion:'success'}));
test('hook branch metadata and push SHA both preserve immutable HEAD validation', () => {
  for (const commit of [undefined, '', 'main', sha]) requireBuildIdentity({sha, branch:'main', commit});
  for (const commit of ['b'.repeat(40), 'refs/heads/main', 'feature', 'a'.repeat(7)]) {
    assert.throws(() => requireBuildIdentity({sha, branch:'main', commit}), /does not match Git HEAD/);
  }
  assert.throws(() => requireBuildIdentity({sha, branch:'feature', commit:'main'}), /Only main/);
  assert.throws(() => requireBuildIdentity({sha:'main', branch:'main', commit:'main'}), /full release SHA/);
  requireBuildIdentity({sha, branch:'main', commit:'main'});
  assert.throws(() => requireRelease({sha, main:'b'.repeat(40), runs}), /Main moved/);
  assert.throws(() => requireRelease({sha, main:sha, runs:[]}), /Missing mandatory/);
});
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
