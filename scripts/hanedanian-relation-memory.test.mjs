import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,dispatch,advance,validateState} from '../public/games/hanedanian/engine.js';
import {encodeSave,decodeSave} from '../public/games/hanedanian/save.js';
function targetFixture(friendly){const s=createGame({seed:'RELATION-TARGET',size:17,aiCount:2});s.time=7000;s.settings.autoPause=false;s.paused=false;const coords=[[8,5],[11,8],[8,11]];s.settlements.forEach((t,i)=>{[t.x,t.y]=coords[i];s.world.tiles[t.y*17+t.x].poi=null;});const ai=s.settlements[1];ai.buildings.farm=12;ai.buildings.barracks=2;ai.troops.archer=120;ai.troops.scout=0;const f=s.factions[1];f.archetype='raider';f.influence=0;f.nextThink=7001;s.factions[2].nextThink=99999;f.intel={};for(const t of [s.settlements[0],s.settlements[2]]){t.buildings.wall=0;for(const k in t.troops)t.troops[k]=0;f.intel[`${t.x},${t.y}`]={time:s.time,ownerId:t.ownerId,resources:{...t.resources},buildings:{...t.buildings},troops:{...t.troops}};f.relations[t.ownerId].score=t.ownerId===friendly?100:-100;}
 return s;}
function firstAttack(s){for(let i=0;i<30;i++){s.factions[1].nextThink=s.time+1;advance(s,1);const a=s.armies.find(a=>a.ownerId==='ai-1'&&a.mission==='attack');if(a)return a;}assert.fail('expected a legal attack opportunity');}
test('same military opportunity changes actual AI target with relationship history, not player identity',()=>{
 const a=targetFixture('player'),b=targetFixture('ai-2');assert.deepEqual(firstAttack(a).to,{x:8,y:11});assert.deepEqual(firstAttack(b).to,{x:8,y:5});
 const c=targetFixture('player');c.factions[1].relations['ai-2'].truceUntil=c.time+2400;assert.deepEqual(firstAttack(c).to,{x:8,y:5});
});
test('only a real external delivery grants bounded aid memory; repeated and self-trade cannot farm it',()=>{
 const s=createGame({seed:'AID',aiCount:1}),home=s.settlements[0],target=s.settlements[1];s.settings.autoPause=false;s.paused=false;s.factions[1].nextThink=99999;s.factions[1].relations.player.vasal=true;home.buildings.market=2;target.buildings.farm=0;target.resources.food=0;
 const send=()=>dispatch(s,{type:'trade',settlementId:home.id,targetId:target.id,cargo:{food:100}});assert.equal(send().ok,true);const eta=s.armies[0].arriveAt;assert.equal(s.factions[0].relations['ai-1'].score,0);advance(s,eta);const rel=s.factions[0].relations['ai-1'];assert.equal(rel.score,3);assert.equal(rel.history.at(-1).kind,'aid');
 assert.equal(send().ok,true);const next=s.armies.find(a=>a.mission==='trade'&&!a.returning).arriveAt;advance(s,next-s.time);assert.equal(rel.score,3);assert.equal(rel.history.length,1);assert.ok(validateState(s).ok);
});
test('real agreements and political bonds persist in a bounded eight-event V1 memory',()=>{
 const s=createGame({aiCount:1});s.factions[0].influence=500;for(let i=0;i<12;i++){s.dynasty.pendingEvent={type:'heir',title:'Görev',text:'Seç'};assert.equal(dispatch(s,{type:'event',choice:'marry'}).ok,true);}const rel=s.factions[0].relations['ai-1'];assert.equal(rel.history.length,8);assert.equal(rel.score,100);const restored=decodeSave(encodeSave(s)).state;assert.deepEqual(restored,s);assert.equal(s.schemaVersion,1);
 rel.history[0].actorId='stranger';assert.equal(validateState(s).ok,false);assert.throws(()=>encodeSave(s));
});
test('legacy relationship fields load unchanged and memory-aware targeting replays after reload',()=>{
 const s=createGame({aiCount:1}),raw=encodeSave(s,1);assert.equal(encodeSave(decodeSave(raw).state,1),raw);const a=targetFixture('player'),b=decodeSave(encodeSave(a)).state;assert.deepEqual(firstAttack(a),firstAttack(b));assert.deepEqual(a,b);
});
test('moving food between own towns never creates external relationship credit',()=>{
 const s=createGame({aiCount:1}),home=s.settlements[0],other=structuredClone(home);other.id='own-side';other.x+=3;other.resources.food=0;s.world.tiles[other.y*s.world.size+other.x].poi=null;s.settlements.push(other);s.factions[1].nextThink=99999;s.settings.autoPause=false;s.paused=false;
 assert.equal(dispatch(s,{type:'trade',settlementId:home.id,targetId:other.id,cargo:{food:100}}).ok,true);advance(s,s.armies[0].arriveAt);assert.equal(s.factions[0].relations['ai-1'].history,undefined);assert.equal(s.factions[0].relations['ai-1'].score,0);
});
