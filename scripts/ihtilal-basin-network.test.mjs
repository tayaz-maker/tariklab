import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSolo,applyMove,legalMoves,previewMove,selectRegion,chooseRoute,setConnection,periodForecast,deserializeSolo,serializeSolo} from '../public/games/ihtilal/solo.js';
import {neighbours,arrivalDelta,resolveNetwork,copyNetworkState,launch,FIELDS,spillRisk} from '../public/games/ihtilal/basin-network.js';
import {basinRenderModel} from '../public/games/ihtilal/basin-map.js';
const here=(s,id)=>s.regions.find(r=>r.id===id);
const close=s=>applyMove(s,'kapat');

test('aid targets a real chosen neighbour; a strained remote basin cannot steal it',()=>{
 let s=selectRegion(createSolo(1),'bati');here(s,'dogu').strain=95;here(s,'merkez').strain=65;
 const before=structuredClone(s);s=chooseRoute(s,'merkez');s=applyMove(s,'devret');
 assert.equal(here(s,'dogu').strain,95);assert.equal(here(s,'merkez').strain,65,'not instant teleportation');
 assert.equal(here(s,'bati').capacity,here(before,'bati').capacity-12);
 assert.equal(s.network.pulses.length,1);assert.equal(s.network.pulses[0].to,'merkez');
 const future=periodForecast(s);s=close(s);assert.deepEqual(s.regions,future.regions);
 assert.ok(here(s,'merkez').strain<65);assert.equal(s.network.last[0].delivered.capacity,7,'overloaded receiver loses delivery efficiency');
 assert.deepEqual(before.network.pulses,[]);
});
test('filtering spends a decision, slows new information and damps its tension, never rewrites in-flight work',()=>{
 let s=chooseRoute(selectRegion(createSolo(4),'ic'),'kuzey');s=applyMove(s,'ac');
 const inFlight=structuredClone(s.network.pulses);const nextId=s.network.nextId;
 s=setConnection(s,'buffered');assert.equal(s.capacity,1);assert.deepEqual(s.network.pulses,inFlight);
 s=applyMove(s,'ac');assert.equal(s.period,2);
 const p=s.network.pulses.find(p=>p.id>=nextId&&p.from==='ic'&&p.to==='kuzey');
 assert.equal(p.due,3);assert.equal(p.delta.intel,5);assert.equal(p.delta.tension,2);
 assert.equal(s.network.last.find(p=>p.from==='ic'&&p.to==='kuzey').due,2);
});
test('one-period edges arrive at the next opening, two-period edges remain in transit',()=>{
 let s=applyMove(selectRegion(createSolo(4),'kuzey'),'ac');s=close(s);
 assert.ok(s.network.last.some(p=>p.to==='ic'&&p.due===2));
 assert.ok(s.network.pulses.some(p=>p.to==='bati'&&p.hop===1&&p.due===3));
 assert.ok(s.network.pulses.filter(p=>p.hop===2).every(p=>p.to!=='kuzey'));
});
test('preview is immutable and exact, including automatic period closure and all regional changes',()=>{
 let s=applyMove(applyMove(createSolo(8),'ac'),'tut');const original=structuredClone(s);
 for(const id of legalMoves(s)){
  const p=previewMove(s,id),next=applyMove(s,id);assert.equal(p.autoClose,true);
  for(const k of ['trust','intel','tension'])assert.equal(p[k],next[k]-s[k]);
  for(const row of p.regional)for(const k of FIELDS)assert.equal(row.delta[k],here(next,row.id)[k]-here(s,row.id)[k]);
 }
 assert.deepEqual(s,original);
});
test('simultaneous arrivals are independent of saved queue order',()=>{
 let s=createSolo(3);launch(s,'ic','merkez',{intel:10,tension:8},'ac');launch(s,'bati','merkez',{intel:-5,tension:-4},'sustur');
 const a=copyNetworkState(s),b=copyNetworkState(s);a.period=2;b.period=2;b.network.pulses.reverse();
 assert.deepEqual(resolveNetwork(a),resolveNetwork(b));assert.deepEqual(a,b);
});
test('receiver intelligence and capacity mitigate exposure; relief capacity never replicates',()=>{
 const p={delta:{intel:10,tension:10,capacity:12,trust:4}};
 assert.ok(arrivalDelta({intel:60,capacity:60,strain:20},p).tension<arrivalDelta({intel:20,capacity:20,strain:20},p).tension);
 let s=applyMove(createSolo(7),'devret');s=close(s);
 assert.ok(s.network.pulses.filter(p=>p.hop===2).every(p=>!p.delta.capacity&&!(p.delta.strain<0)));
});
test('spillover requires the visible combined threshold, and sends only to adjacent basins',()=>{
 let s=createSolo(5);const r=here(s,'kuzey');r.strain=60;r.tension=40;r.capacity=20;
 assert.equal(spillRisk(r),true);assert.equal(spillRisk({...r,strain:54}),false);
 s=close(applyMove(selectRegion(s,'guney'),'tut'));
 const neighboursIds=neighbours(s,'kuzey').map(r=>r.other);
 assert.ok(s.network.pulses.some(p=>p.from==='kuzey'&&p.kind==='pressure'));
 assert.ok(s.network.pulses.filter(p=>p.from==='kuzey').every(p=>neighboursIds.includes(p.to)));
});
test('period-four threshold is forecast before its shared approach changes arrivals',()=>{
 let s=createSolo(9);for(let i=0;i<2;i++)s=close(applyMove(s,'tut'));
 const f=periodForecast(s);assert.equal(f.period,4);assert.equal(f.phase,'break');
 s=close(applyMove(s,'tut'));assert.equal(s.phase,'break');
 assert.equal(applyMove(s,'sert').network.doctrine,'buffer');assert.equal(applyMove(s,'acik').network.doctrine,'listen');
});
test('actual pre-upgrade solo-v1 opening, pending, break and terminal saves retain their contract',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/ihtilal-solo-v1.json',import.meta.url)));
 for(const old of fixtures){const restored=deserializeSolo(JSON.stringify(old));assert.ok(restored);
  for(const k of ['seed','period','capacity','spent','trust','intel','tension','selected','pending','log','phase','ending'])assert.deepEqual(restored[k],old.state[k],k);
  assert.deepEqual(deserializeSolo(serializeSolo(restored)),restored);
 }
});
test('malformed fields, duplicate basins, bogus links and impossible packets are rejected atomically',()=>{
 const source=applyMove(createSolo(5),'ac');
 const corrupt=[s=>{s.trust='52';},s=>{s.regions[1].id=s.regions[0].id;},s=>{s.network.links[0].mode='anything';},
 s=>{s.network.pulses[0].to=s.network.pulses[0].from;},s=>{s.network.pulses[0].delta.capacity=9999;},
 s=>{s.network.pulses.push(s.network.pulses[0]);},s=>{s.pending[0].due=500;},s=>{s.log=null;},s=>{s.network.nextId=0;}];
 for(const mutate of corrupt){const s=structuredClone(source);mutate(s);assert.equal(deserializeSolo(serializeSolo(s)),null);}
 assert.ok(deserializeSolo(serializeSolo(source)));
});
test('local capacity locks expensive moves and quiet recovery remains available',()=>{
 const s=createSolo(8);here(s,s.selected).capacity=0;
 assert.deepEqual(legalMoves(s),['sustur','kapat']);const next=applyMove(s,'devret');assert.equal(next,s);
 assert.equal(here(applyMove(s,'sustur'),s.selected).capacity,3);
});
test('render model is pure, layer values and route counts come from the actual simulation',()=>{
 const s=applyMove(createSolo(13),'ac'),original=structuredClone(s);
 for(const layer of FIELDS){const m=basinRenderModel(s,{layer});assert.equal(m.regions.length,7);assert.equal(m.links.length,9);
 for(const r of m.regions){assert.equal(r.value,here(s,r.id)[layer]);assert.ok(r.shape.length>=3);}
 assert.equal(m.links.reduce((n,l)=>n+l.pulses,0),s.network.pulses.length);}
 assert.deepEqual(s,original);
});
test('100 seeded mixed campaigns stay bounded and reload identically after every choice',()=>{
 const endings=new Set();let maximum=0;
 for(let seed=1;seed<=100;seed++){
  let s=createSolo(seed);
  for(let turn=0;turn<30&&s.phase!=='end';turn++){
   const old=structuredClone(s),loaded=deserializeSolo(serializeSolo(s));assert.deepEqual(loaded,s,`seed ${seed} turn ${turn}`);
   const moves=legalMoves(s),id=moves[(seed*7+turn*3)%moves.length];
   const next=applyMove(s,id);assert.deepEqual(applyMove(loaded,id),next);assert.deepEqual(s,old);
   s=next;maximum=Math.max(maximum,s.network.pulses.length);
   assert.ok(s.network.pulses.length<96);assert.ok(s.network.history.length<=48);
   assert.ok(serializeSolo(s).length<180000);
  }
  assert.equal(s.phase,'end');assert.ok(deserializeSolo(serializeSolo(s)));endings.add(s.ending);
 }
 assert.ok(endings.size>=2);assert.ok(maximum>0);
});

test('identical six-period decisions can succeed centrally and fail on a remote route despite healthy global meters',()=>{
 function run(source){let s=selectRegion(createSolo(1),source);for(const move of ['ac','tut','sustur','tut','ac','sustur']){
   if(s.phase==='break')s=applyMove(s,'acik');s=applyMove(s,move);s=close(s);
 }return s;}
 const center=run('merkez'),shore=run('kuzey');assert.equal(center.ending,'tutanak');assert.equal(shore.ending,'yorgun');
 assert.ok(shore.trust>=46&&shore.intel>=25&&shore.tension<48,'global meters alone cannot substitute for a functioning basin network');
});
