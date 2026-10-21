import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,dispatch,advance,validateState} from '../public/games/hanedanian/engine.js';
import {encodeSave,decodeSave} from '../public/games/hanedanian/save.js';
function fixture(){const s=createGame({aiCount:0}),t=s.settlements[0];t.buildings.warehouse=7;for(const k in t.resources)t.resources[k]=4500;s.settings.autoPause=false;s.paused=false;s.campaign.progression.projects['wealth:4']={townId:t.id,level:0,active:true,paid:0,imported:0};return s;}
const order=(s,enabled)=>dispatch(s,{type:'localContributionOrder',settlementId:s.settlements[0].id,path:'wealth',enabled});
test('standing local contribution equals the same paid manual order each game hour',()=>{
 const auto=fixture(),manual=structuredClone(auto);assert.equal(order(auto,true).ok,true);
 assert.equal(auto.campaign.progression.projects['wealth:4'].paid,0);
 for(let hour=0;hour<4;hour++){advance(auto,60);advance(manual,60);dispatch(manual,{type:'contribute',settlementId:manual.settlements[0].id,path:'wealth'});
  const copy=structuredClone(auto);delete copy.campaign.progression.projects['wealth:4'].autoContribute;assert.deepEqual(copy,manual);assert.ok(validateState(auto).ok);}
 assert.equal(auto.campaign.progression.projects['wealth:4'].paid,4000);
});
test('pause, cancellation and unowned project never spend; guarded actions stay atomic',()=>{
 const s=fixture();order(s,true);s.paused=true;advance(s,60);assert.equal(s.time,0);order(s,false);s.paused=false;advance(s,60);assert.equal(s.campaign.progression.projects['wealth:4'].paid,0);
 const before=structuredClone(s);assert.equal(dispatch(s,{type:'localContributionOrder',settlementId:s.settlements[0].id,path:'dominion',enabled:true}).ok,false);assert.deepEqual(s,before);
 s.campaign.progression.projects['wealth:4'].townId='missing';assert.equal(order(s,true).ok,false);
});
test('automatic local spending preserves the 500 stock and exact remaining quota',()=>{
 const s=fixture(),t=s.settlements[0],p=s.campaign.progression.projects['wealth:4'];p.paid=3999;for(const k in t.resources)t.resources[k]=501;order(s,true);advance(s,60);
 assert.equal(p.paid,4000);assert.ok(Object.values(t.resources).every(n=>n>=500));const paid=p.paid;advance(s,60);assert.equal(p.paid,paid);
});
test('standing contribution round-trips in schema one; old and malformed flags are handled',()=>{
 const legacy=fixture(),raw=encodeSave(legacy,1);assert.equal(encodeSave(decodeSave(raw).state,1),raw);assert.equal(legacy.schemaVersion,1);order(legacy,true);const restored=decodeSave(encodeSave(legacy)).state;advance(legacy,120);advance(restored,120);assert.deepEqual(restored,legacy);
 legacy.campaign.progression.projects['wealth:4'].autoContribute='yes';assert.equal(validateState(legacy).ok,false);assert.throws(()=>encodeSave(legacy));
});
test('completed phase stops spending and the next phase requires a new strategic order',()=>{
 const s=fixture(),p=s.campaign.progression.projects['wealth:4'];p.paid=3999;p.imported=4000;order(s,true);advance(s,60);assert.equal(p.level,1);assert.equal(p.active,false);const resources=structuredClone(s.settlements[0].resources);advance(s,60);assert.ok(Object.keys(resources).every(k=>s.settlements[0].resources[k]>=resources[k]));
});
