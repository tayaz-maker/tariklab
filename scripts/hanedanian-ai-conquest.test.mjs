import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advance,dispatch,validateState} from '../public/games/hanedanian/engine.js';
import {encodeSave,decodeSave} from '../public/games/hanedanian/save.js';
function fixture(){const s=createGame({seed:'AI-CONQUEST',size:17,aiCount:1});s.time=7000;s.settings.autoPause=false;s.paused=false;s.factions[1].archetype='opportunist';s.factions[1].nextThink=7001;s.factions[1].influence=0;const ai=s.settlements[1];ai.buildings.farm=12;ai.buildings.warehouse=8;ai.buildings.barracks=4;ai.troops.archer=100;ai.troops.scout=4;for(const k in ai.resources)ai.resources[k]=4000;
 const side=structuredClone(s.settlements[0]);side.id='qa-side';side.name='Sınır';side.x=10;side.y=5;side.queue=[];side.buildings.wall=0;for(const k in side.troops)side.troops[k]=0;side.troops.spear=2;s.world.tiles[side.y*17+side.x].poi=null;s.settlements.push(side);
 s.factions[1].intel={[`${side.x},${side.y}`]:{time:s.time,ownerId:'player',resources:{...side.resources},buildings:{...side.buildings},troops:{...side.troops}}};return s;}
test('AI buys siege through the real queue, travels and captures only the side settlement',()=>{
 const s=fixture(),capital=s.settlements[0],side=s.settlements[2],ai=s.settlements[1];advance(s,1);assert.ok(ai.queue.some(q=>q.unit==='siege'&&q.count===2));assert.equal(ai.troops.siege,0);assert.ok(ai.resources.wood<4000);const launches=[];const seen=new Set();
 for(let i=0;i<2500&&side.ownerId==='player';i++){advance(s,1);for(const a of s.armies)if(a.mission==='attack'&&!seen.has(a.id)){seen.add(a.id);launches.push(structuredClone(a));}}
 assert.equal(side.ownerId,'ai-1',JSON.stringify({launches,ai:ai.troops,queue:ai.queue,intel:s.factions[1].intel,armies:s.armies,terrain:s.world.tiles[ai.y*17+ai.x].terrain}));assert.equal(capital.ownerId,'player');assert.ok(s.campaign.chronicle.some(e=>e.type==='loss'&&e.title.includes(side.name)));assert.ok(launches.some(a=>a.troops.siege>=4&&a.arriveAt>a.departAt));assert.ok(validateState(s).ok);
});
test('unknown or stale garrisons cannot be used to start an AI attack',()=>{
 for(const mode of ['missing','stale']){const s=fixture(),ai=s.settlements[1];ai.troops.siege=4;if(mode==='missing')delete s.factions[1].intel;else Object.values(s.factions[1].intel)[0].time=0;advance(s,1);assert.equal(s.armies.some(a=>a.mission==='attack'),false);}
});
test('fresh AI scouting and cooldown survive schema-one reload deterministically',()=>{
 const a=fixture();advance(a,1000);const b=decodeSave(encodeSave(a)).state;advance(a,1000);for(let i=0;i<10;i++)advance(b,100);assert.deepEqual(a,b);assert.equal(a.schemaVersion,1);assert.ok(validateState(a).ok);
 const bad=structuredClone(a);bad.factions[1].intel={'100,100':{time:0}};assert.equal(validateState(bad).ok,false);
});
test('a conquered regional centre can be relocated without refund, free quota or locked campaign',()=>{
 const s=fixture(),home=s.settlements[0],lost=s.settlements[2];lost.ownerId='ai-1';home.buildings.hall=6;home.buildings.market=6;home.buildings.warehouse=7;s.factions[0].influence=100;s.intel[`${home.x},${home.y}`]={time:s.time,ownerId:'player',resources:{...home.resources},buildings:{...home.buildings},troops:{...home.troops}};
 const r=Math.min(2,Math.floor(home.y*3/17))*3+Math.min(2,Math.floor(home.x*3/17));lost.x=home.x+3;lost.y=home.y; // same campaign region for this isolated relocation fixture
 s.campaign.progression.specializations[home.id]='exchange';const points=s.world.tiles.filter(t=>Math.floor(t.x*3/17)===1&&Math.floor(t.y*3/17)===1&&!s.settlements.some(q=>q.x===t.x&&q.y===t.y)).slice(0,2);points.forEach((t,i)=>t.poi={id:'relocate-'+i,type:'pasture',ownerId:'player',settlementId:home.id});
 s.campaign.progression.projects[`wealth:${r}`]={townId:lost.id,level:2,active:true,paid:1234,imported:5678,autoContribute:true};
 const before=s.factions[0].influence;assert.equal(dispatch(s,{type:'project',settlementId:home.id,path:'wealth'}).ok,true);const p=s.campaign.progression.projects[`wealth:${r}`];assert.equal(p.townId,home.id);assert.equal(p.paid,1234);assert.equal(p.imported,5678);assert.equal(p.autoContribute,false);assert.equal(s.factions[0].influence,before-15);
});
test('a recent AI raid forbids another launch during the full game-time cooldown',()=>{
 const s=fixture();s.settlements[1].troops.siege=4;s.factions[1].lastAttackAt=s.time;advance(s,719);
 assert.equal(s.armies.some(a=>a.mission==='attack'),false);assert.equal(s.settlements[0].ownerId,'player');assert.ok(validateState(s).ok);
});

test('AI conquest cooldown and seven-town boundary prevent repeated land grabs',()=>{
 for(const mode of ['cooldown','boundary']) {
  const s=fixture();s.settlements[1].troops.siege=4;
  if(mode==='cooldown')s.factions[1].lastConquestAt=s.time;
  else for(let i=0;i<6;i++){const t=structuredClone(s.settlements[1]);t.id='ai-extra-'+i;t.x=i;t.y=0;t.queue=[];for(const k in t.troops)t.troops[k]=0;s.world.tiles[i].poi=null;s.settlements.push(t);}
  advance(s,2000);assert.equal(s.settlements[2].ownerId,'player',mode);assert.ok(validateState(s).ok);
 }
});
