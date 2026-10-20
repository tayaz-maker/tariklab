import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const yaml=createRequire(import.meta.url)('js-yaml');
const read=name=>yaml.load(readFileSync(new URL('../.github/'+name,import.meta.url),'utf8'));
const ci=read('workflows/ci.yml');
const production=read('workflows/cloudflare-production.yml');
const runs=job=>job.steps.map(s=>s.run||'').join('\n');
test('one candidate build is reused with same-run and exact-SHA validation',()=>{
  assert.deepEqual(ci.on,{push:{branches:['main']},pull_request:null});
  assert.equal(Object.values(ci.jobs).flatMap(j=>j.steps).filter(s=>s.run==='npm run build').length,1);
  const browser=ci.jobs['browser-regression'];
  assert.ok(browser.needs.includes('build-core'));
  const download=browser.steps.find(s=>s.uses==='actions/download-artifact@v4');
  assert.equal(download.with.name,'ci-build');
  assert.equal(download.with['run-id'],undefined,'candidate artifacts must come from the same run');
  assert.match(runs(browser),/cat \.ci-build-sha/);
  assert.match(runs(browser),/git rev-parse HEAD/);
  assert.ok(ci.jobs['build-core'].steps.some(s=>s.run==='npm run build'&&!s.if),'even docs-only main needs an exact artifact for acceptance');
  assert.deepEqual(browser.strategy.matrix.suite,['wave1-save','wave1-outcome','cete','duel','devlet','responsive','tc']);
});
test('every shard and browser suite remains mandatory with no allowed failures',()=>{
  assert.deepEqual(ci.jobs.unit.strategy.matrix.shard,[0,1,2,3]);
  assert.equal(ci.jobs.unit.strategy['fail-fast'],false);
  assert.deepEqual(new Set(ci.jobs.build.needs),new Set(['changes','build-core','unit','browser-regression','campaign-browser','campaign-balance']));
  assert.equal(ci.jobs.build.if,'${{ always() }}');
  for(const [name,job]of Object.entries(ci.jobs)){
    assert.equal(job['continue-on-error'],undefined,name);
    for(const step of job.steps)assert.equal(step['continue-on-error'],undefined,name);
  }
});
test('dependency reuse requires an exact lock and retains art unpacking on hits',()=>{
  const action=read('actions/ci-node/action.yml');
  const cache=action.runs.steps.find(s=>s.uses==='actions/cache@v4');
  assert.match(cache.with.key,/runner.os.*runner.arch.*ubuntu24-node22.*hashFiles\('package-lock.json'\)/);
  assert.equal(cache.with['restore-keys'],undefined);
  assert.ok(action.runs.steps.some(s=>s.run==='npm ci'&&s.if.includes('cache-hit')));
  assert.ok(action.runs.steps.some(s=>s.run==='node scripts/duel-art-unpack.mjs'&&!s.if));
});
test('production checks move behind exact-main release verification and preserve both hosts',()=>{
  const source=runs(ci.jobs['browser-regression'])+runs(ci.jobs['campaign-browser']);
  for(const script of ['duel-production.mjs','campaign-production.mjs'])assert.ok(!source.includes(script));
  assert.deepEqual(production.jobs.production.strategy.matrix.include.map(s=>s.origin),['https://www.tariklab.com','https://tariklab.tayaz29.workers.dev']);
  for(const job of Object.values(production.jobs)){
    assert.match(runs(job),/requireRelease\(/);
    assert.match(runs(job),/git rev-parse HEAD/);
    const artifact=job.steps.find(s=>s.uses==='actions/download-artifact@v4');
    assert.equal(artifact.with['run-id'],'${{ env.CI_RUN_ID }}');
  }
  assert.equal(production.jobs['post-release'].needs,'production');
  const post=runs(production.jobs['post-release']);
  for(const script of ['duel-production.mjs','campaign-production.mjs','tc-sim-job-start-outcome-browser.mjs','esik-save-browser.mjs'])assert.ok(post.includes(script),script);
});
