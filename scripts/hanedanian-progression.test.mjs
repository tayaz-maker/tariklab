import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,dispatch,advance,getCampaign,getExpansionCost,validateState} from '../public/games/hanedanian/engine.js';
import {emptyProgression,progressionValid} from '../public/games/hanedanian/campaign.js';
import {encodeSave,decodeSave} from '../public/games/hanedanian/save.js';
test('stockpiles and circular trade never replace regional progression',()=>{
 const s=createGame(); s.campaign.tradeVolume=100000000;s.factions[0].influence=9999;
 for(const t of s.settlements){t.ownerId='player';for(const k of Object.keys(t.resources))t.resources[k]=100000;}
 for(const p of getCampaign(s).paths){assert.equal(p.ready,false);assert.equal(dispatch(s,{type:'victory',path:p.id}).ok,false);}
});
test('legacy v1 progression remains loadable without inventing regional credits',()=>{
 const s=createGame();delete s.campaign.progression;
 const raw=encodeSave(s,1), restored=decodeSave(raw).state;
 assert.equal(restored.campaign.progression,undefined); assert.equal(getCampaign(restored).paths.some(p=>p.ready),false);
 assert.equal(encodeSave(restored,1),raw);
});
test('new campaign metadata is validated and checksummed',()=>{
 const s=createGame();s.campaign.progression.finales.wealth={'4':12001};assert.equal(progressionValid(s),false);assert.throws(()=>encodeSave(s));
 s.campaign.progression=emptyProgression();assert.equal(validateState(s).ok,true);
});
test('invalid regional orders preserve all state; specialization charges and survives reload',()=>{
 const s=createGame(),t=s.settlements[0];
 for(const a of [{type:'project',path:'wealth'},{type:'specialize',specialty:'bad'},{type:'supplyOrder',path:'wealth',targetId:t.id},{type:'contribute',path:'wealth'}]){const before=JSON.stringify(s);assert.equal(dispatch(s,{...a,settlementId:t.id}).ok,false);assert.equal(JSON.stringify(s),before);}
 t.buildings.hall=2;for(const k of Object.keys(t.resources))t.resources[k]=1000;
 assert.equal(dispatch(s,{type:'specialize',settlementId:t.id,specialty:'exchange'}).ok,true);
 assert.equal(t.resources.food,820);assert.equal(decodeSave(encodeSave(s)).state.campaign.progression.specializations[t.id],'exchange');
});
test('final four-unit supply delivery can finish a quota without generating trade wealth',()=>{
 const s=createGame(),a=s.settlements[0], b=structuredClone(a);b.id='qa-town';b.x=16;b.y=24;b.name='Sınır';s.settlements.push(b);
 const p=s.campaign.progression;p.projects['wealth:3']={townId:b.id,active:true,level:0,paid:4000,imported:3999};
 a.buildings.market=2;const before=s.campaign.tradeVolume;
 assert.equal(dispatch(s,{type:'supply',settlementId:a.id,targetId:b.id,path:'wealth',cargo:{food:1,wood:1,stone:1,iron:1}}).ok,true);
 s.settings.autoPause=false;s.paused=false;advance(s,600);
 assert.equal(p.projects['wealth:3'].level,1);assert.equal(p.projects['wealth:3'].imported,4000);assert.equal(s.campaign.tradeVolume,before);
});
test('administration grows faster than empty expansion count and counts pending founders',()=>{
 const s=createGame(),base=getExpansionCost(s);const t=s.settlements[0];
 for(let n=0;n<5;n++)s.settlements.push({...structuredClone(t),id:`q-${n}`,x:n*3,y:0});
 const larger=getExpansionCost(s);assert.ok(larger.influence>base.influence*2);assert.ok(larger.wood>base.wood*2);
});
