import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,dispatch,advance,getCampaign,validateState} from '../public/games/hanedanian/engine.js';
import {recordChronicle,victorySummary,regionOf} from '../public/games/hanedanian/campaign.js';
import {encodeSave,decodeSave} from '../public/games/hanedanian/save.js';
import {distance} from '../public/games/hanedanian/world.js';
export function victoryFixture(){const s=createGame({seed:'VICTORY-MEMORY'}),home=s.settlements[0];const xy=[[4,4],[24,4],[44,4],[4,24],[24,24],[44,24],[4,44],[24,44]];const own=xy.map(([x,y],i)=>{const t=structuredClone(home);t.id=i?'v-town-'+i:home.id;t.x=x;t.y=y;t.name='Merkez '+i;t.buildings.hall=6;t.buildings.market=6;t.buildings.warehouse=7;s.world.tiles[y*49+x].poi=null;return t;});s.settlements=[...own,...s.settlements.slice(1)];const p=s.campaign.progression;s.factions[0].influence=400;
 own.forEach((t,i)=>p.specializations[t.id]=i<6?'exchange':i===6?'granary':'workshop');p.finales.wealth={};
 for(let r=0;r<6;r++){const t=own[r];p.projects[`wealth:${r}`]={townId:t.id,level:3,active:false,paid:28000,imported:28000};p.finales.wealth[r]=12000;const tiles=s.world.tiles.filter(z=>regionOf(s,z)===r&&!s.settlements.some(q=>q.x===z.x&&q.y===z.y)).slice(0,2);tiles.forEach((z,i)=>z.poi={id:'win-'+r+'-'+i,type:'pasture',ownerId:'player',settlementId:t.id});}
 for(let i=1;i<=5;i++)p.logistics[own[0].id+':'+own[i].id]={from:own[0].id,to:own[i].id,delivered:1000};return s;}
test('real founding and first settlement survive more than 180 routine scout reports and reload',()=>{
 const s=createGame({aiCount:0}),home=s.settlements[0];s.settings.autoPause=false;s.paused=false;const site=s.world.tiles.find(t=>!t.poi&&distance(t,home)>=3&&distance(t,home)<=8);assert.equal(dispatch(s,{type:'expand',settlementId:home.id,x:site.x,y:site.y}).ok,true);advance(s,400);
 for(let i=0;i<100;i++){assert.equal(dispatch(s,{type:'scout',settlementId:home.id,x:home.x+2,y:home.y+1,count:1}).ok,true);advance(s,100);}
 assert.equal(s.reports.length,180);assert.ok(s.campaign.chronicle.some(e=>e.key==='foundation'));assert.ok(s.campaign.chronicle.some(e=>e.type==='settlement'));assert.ok(s.campaign.chronicle.some(e=>e.key==='first-scout'));assert.deepEqual(decodeSave(encodeSave(s)).state,s);assert.ok(validateState(s).ok);
});
test('bounded chronicle pins founding and first loss/battle and never awards resources or XP',()=>{
 const s=createGame(),before={xp:s.dynasty.xp,influence:s.factions[0].influence,resources:structuredClone(s.settlements[0].resources)};recordChronicle(s,'loss-first','loss','Sınır kaybı','Gerçek test olayı');recordChronicle(s,'battle-first','battle','Meydan','Gerçek test olayı');for(let i=0;i<100;i++)recordChronicle(s,'strategy-'+i,'strategy','Gelişme','Ölçüm');recordChronicle(s,'strategy-99','strategy','Tekrar','Tekrar');
 assert.equal(s.campaign.chronicle.length,64);for(const key of ['foundation','loss-first','battle-first'])assert.ok(s.campaign.chronicle.some(e=>e.key===key));assert.deepEqual({xp:s.dynasty.xp,influence:s.factions[0].influence,resources:s.settlements[0].resources},before);assert.ok(validateState(s).ok);
});
test('a guarded victory freezes actual conditions, survives continuation and explains the route',()=>{
 const s=victoryFixture();assert.ok(validateState(s).ok);assert.equal(getCampaign(s).paths.find(p=>p.id==='wealth').ready,true);assert.equal(dispatch(s,{type:'victory',path:'wealth'}).ok,true);const facts=structuredClone(s.campaign.victoryFacts),summary=victorySummary(s);assert.match(summary,/8 yurt/);assert.match(summary,/8 gelişmiş bölge/);assert.equal(s.campaign.chronicle.at(-1).key,'victory');
 assert.equal(dispatch(s,{type:'continue'}).ok,true);s.campaign.battlesWon+=1;assert.deepEqual(s.campaign.victoryFacts,facts);assert.equal(victorySummary(s),summary);assert.deepEqual(decodeSave(encodeSave(s)).state,s);
 const before=structuredClone(s);assert.equal(dispatch(s,{type:'victory',path:'wealth'}).ok,false);assert.deepEqual(s,before);
});
test('old V1 records retain bytes and missing dates stay unknown; malformed history is rejected',()=>{
 const s=createGame();delete s.campaign.chronicle;const raw=encodeSave(s,1);const restored=decodeSave(raw).state;assert.equal(encodeSave(restored,1),raw);assert.equal(restored.campaign.chronicle,undefined);assert.match(victorySummary(restored),/bulunmuyor/);s.campaign.chronicle=[{key:'bad',time:1,type:'battle',title:'X',text:'X'}];assert.equal(validateState(s).ok,false);assert.throws(()=>encodeSave(s));
});
