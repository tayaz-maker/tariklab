import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advance,getRates,getBuildCost,validateState} from '../public/games/hanedanian/engine.js';
import {UNITS} from '../public/games/hanedanian/data.js';
import {encodeSave,decodeSave} from '../public/games/hanedanian/save.js';
const kinds=['merchant','expansionist','opportunist','ambitious'];
function fixture(kind){const s=createGame({seed:'PERSONALITY',aiCount:1});s.factions[1].archetype=kind;s.settings.autoPause=false;s.paused=false;return s;}
test('four existing identities produce distinct legal development, force and regional decisions',()=>{
 const results=kinds.map(kind=>{const s=fixture(kind);advance(s,7200);assert.ok(validateState(s).ok);s.factions[1].archetype='normalized';return s;});
 for(let i=0;i<results.length;i++)for(let j=i+1;j<results.length;j++)assert.notDeepEqual(results[i],results[j],`${kinds[i]} versus ${kinds[j]}`);
});
test('personality development and recruitment pay the exact common command costs',()=>{
 for(const kind of kinds){const s=fixture(kind),t=s.settlements[1];s.time=1000;s.factions[1].nextThink=1001;s.factions[1].influence=0;t.buildings.warehouse=5;for(const k in t.resources)t.resources[k]=1500;
 const before=structuredClone(t.resources),rates=getRates(s,t);advance(s,1);assert.ok(t.queue.length>0);
 const paid=Object.fromEntries(Object.keys(before).map(k=>[k,0]));
 for(const q of t.queue){if(q.kind==='build'){const old=t.buildings[q.building];t.buildings[q.building]=q.level-1;const copy={...t,queue:[]};const cost=getBuildCost(s,copy,q.building);t.buildings[q.building]=old;for(const k in paid)paid[k]+=cost[k];}else Object.keys(paid).forEach((k,i)=>paid[k]+=UNITS[q.unit].cost[i]*q.count);}
 for(const k in before)assert.ok(Math.abs(t.resources[k]-(before[k]+rates[k]-paid[k]))<1e-7,`${kind}/${k}`);assert.ok(validateState(s).ok);
 }
});
test('all eight rivals and changed priorities remain deterministic across reload and tick chunking',()=>{
 const a=createGame({seed:'PERSONALITY-RELOAD'});a.settings.autoPause=false;a.paused=false;const b=decodeSave(encodeSave(a)).state;
 advance(a,6000);for(let i=0;i<60;i++)advance(b,100);assert.deepEqual(a,b);assert.equal(a.factions.length,9);assert.ok(validateState(a).ok);
});
