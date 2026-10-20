import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {frozenNextWaveBytes} from './scoped-engine-provenance.mjs';
const file='public/games/next-wave.js',source=readFileSync(file);
test('load-only provenance rejects loader and gameplay mutations',()=>{
 assert.ok(frozenNextWaveBytes(source).length>0);
 for(const change of [s=>s.replace('Promise.all','Promise.allSettled'),s=>s.replace('s.meta.seed = 12345','s.meta.seed = 999')])
  assert.throws(()=>frozenNextWaveBytes(Buffer.from(change(source.toString()))));
});
for(const scope of ['', 'unknown','apartman','kayip-telefon','son-100-gun','tc-sim-devlet','son-kasaba'])
 test(`scoped engine keeps ${scope||'Node'} API and own save roundtrip`,()=>{
  const code=`import assert from 'node:assert/strict';
  const scope=${JSON.stringify(scope)};
  if(scope)globalThis.document={body:{dataset:{game:scope}}};
  const m=await import('./public/games/next-wave.js');
  const owners=['apartman','kayip-telefon','son-100-gun','tc-sim-devlet'];
  for(const id of (!scope||scope==='unknown'?owners:scope==='son-kasaba'?[]:[scope])){
   const state=m.create(id);assert.ok(m.validate(state,id));
   const restored=m.normalize(id,JSON.parse(JSON.stringify(state)));assert.ok(m.validate(restored,id));
  }
  for(const [owner,binding] of [['apartman','RESIDENTS'],['kayip-telefon','PHONE_FACTS'],['son-100-gun','SCENARIOS'],['tc-sim-devlet','PERIODS']])
   assert.equal(m[binding]!==undefined,!scope||scope==='unknown'||scope===owner);
  `;
  const result=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
 });
