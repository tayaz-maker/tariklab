import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {plan, owner, EXTENDED_NAMES} from './ci-test-plan.mjs';

test('full shards cover every unit file exactly once', () => {
  const files=readdirSync('scripts').filter(f=>f.endsWith('.test.mjs')).sort();
  const all=[0,1,2,3].flatMap(shard=>plan(files,{full:true,shard}));
  assert.deepEqual(all.sort(),files);
  assert.equal(new Set(all).size,files.length);
});
test('a game change keeps common guards and relevant saves, excludes unrelated games',()=>{
  const files=['cloudflare-deploy.test.mjs','ci-required-gate.test.mjs','save-slots.test.mjs','tc-sim-save.test.mjs','duel-save.test.mjs','hanedanian.test.mjs'];
  const selected=[0,1,2,3].flatMap(shard=>plan(files,{full:false,routes:['tc-sim'],shard}));
  assert.deepEqual(selected.sort(),['ci-required-gate.test.mjs','cloudflare-deploy.test.mjs','save-slots.test.mjs','tc-sim-save.test.mjs']);
  assert.equal(owner('unknown-shared-save.test.mjs'),null);
  const duel=[0,1,2,3].flatMap(shard=>plan(files,{full:false,routes:['veto-h'],shard}));
  assert.ok(duel.includes('duel-save.test.mjs'));
});
test('invalid shards fail instead of silently skipping tests',()=>{
  for(const shard of [-1,4,NaN,0.5])assert.throws(()=>plan(['save.test.mjs'],{shard}));
});
test('only two named population studies move; full nightly npm test remains',()=>{
  assert.equal(EXTENDED_NAMES.length,2);
  for(const [file,name] of [
    ['wave4-tc-sim-final-integration.test.mjs',EXTENDED_NAMES[0]],
    ['wave4-tc-sim-late-life-content.test.mjs',EXTENDED_NAMES[1]],
  ])assert.ok(readFileSync('scripts/'+file,'utf8').includes(name));
  const nightly=readFileSync('.github/workflows/ci-full-regression.yml','utf8');
  assert.match(nightly,/npm test/);
  assert.match(nightly,/duel-stress.mjs 500/);
  assert.doesNotMatch(nightly,/test-skip-pattern/);
  for(const name of EXTENDED_NAMES)assert.doesNotMatch(name,/save|migration/i);
});
