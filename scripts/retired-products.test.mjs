import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync, existsSync} from 'node:fs';
import {retiredWorkerPaths, retirementWorker} from './retired-products.mjs';
import {SIBLING_THEMES} from '../public/games/duel-core/theme-meta.js';
import {pools} from './duel-pools.mjs';

test('only two complete card games remain reachable; removed applications are absent',()=>{
  assert.deepEqual(SIBLING_THEMES,['veto-h','gett-oh']);
  assert.deepEqual(Object.keys(pools),SIBLING_THEMES);
  for(const pool of Object.values(pools))assert.equal(pool.length,300);
  for(const path of ['public/atlas','public/games/darbe-h','assets/atlas-3d'])assert.equal(existsSync(path),false,path);
  const catalog=readFileSync('src/lib/games.ts','utf8');
  assert.doesNotMatch(catalog,/darbe-h|\/atlas\//);
  for(const path of ['public/vendor/pixi','public/games/jitem-derin-ag/assets/atlas-pixi-Dilx3yA8.js','scripts/hanedanian-atlas-scheduler.test.mjs'])assert.ok(existsSync(path),path);
});

test('old offline installations retire only their own scope, retaining caches and saves',async()=>{
  assert.deepEqual(retiredWorkerPaths,['atlas/3d/sw.js','atlas/yapi/sw.js']);
  for(const path of retiredWorkerPaths){
    const events={},navigated=[];let unregistered=0,claimed=0;
    const scope='https://www.tariklab.com/'+path.replace('sw.js','');
    const context={URL,Response,Promise,self:{
      addEventListener:(type,fn)=>events[type]=fn,
      skipWaiting:async()=>{},
      registration:{scope,unregister:async()=>{unregistered++;}},
      clients:{claim:async()=>{claimed++;},matchAll:async()=>[
        {url:scope+'index.html',navigate:async u=>navigated.push(u)},
        {url:'https://www.tariklab.com/games/veto-h/',navigate:()=>assert.fail('other game must not move')},
      ]},
    }};
    vm.runInNewContext(retirementWorker,context);
    const waits=[];events.install({waitUntil:p=>waits.push(p)});events.activate({waitUntil:p=>waits.push(p)});
    await Promise.all(waits);assert.equal(unregistered,1);assert.equal(claimed,1);assert.deepEqual(navigated,['/']);
    let response;events.fetch({request:{url:scope+'index.html'},respondWith:p=>response=p});
    assert.equal((await response).status,410);
  }
  assert.doesNotMatch(retirementWorker,/caches\.|localStorage|indexedDB|deleteDatabase/);
  const root=readFileSync('public/sw.js','utf8');
  assert.match(root,/retired|Retired/);
  assert.match(root,/status: 410/);
});
