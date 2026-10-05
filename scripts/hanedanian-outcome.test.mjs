import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,dispatch} from '../public/games/hanedanian/engine.js';
import {captureOrderState,buildOutcomeMoment,settlementWork} from '../public/games/hanedanian/outcome-moment.js';
import {atlasDirectory} from '../public/games/hanedanian/map-dom.js';
const fresh=()=>createGame({seed:'WAVE1-ORDER',dynastyName:'Sedir',size:49,aiCount:8});
test('accepted construction exposes actual cost and due time, never completion',()=>{
 const s=fresh(),town=s.settlements.find(t=>t.ownerId===s.playerId),a={type:'build',settlementId:town.id,building:'farm'};
 const level=town.buildings.farm,before=captureOrderState(s);assert.ok(dispatch(s,a).ok);const raw=JSON.stringify(s),m=buildOutcomeMoment(before,s,a);
 assert.equal(JSON.stringify(s),raw);assert.equal(m.kind,'queue');assert.match(m.summary,/sıraya alındı/);assert.equal(m.minutes,town.queue[0].completeAt-s.time);
 for(const c of m.cost)assert.equal(c.value,Math.round(before.settlements.find(t=>t.id===town.id).resources[c.key]-town.resources[c.key]));
 assert.deepEqual(buildOutcomeMoment(before,s,a),m);assert.equal(town.buildings.farm,level);
});
test('rejected, unchanged, clock-only and unowned actions make no receipt',()=>{
 const s=fresh(),b=captureOrderState(s),id=s.settlements[0].id;
 assert.equal(buildOutcomeMoment(b,s,{type:'build',settlementId:id,building:'farm'}),null);
 assert.equal(buildOutcomeMoment(b,s,{type:'build',settlementId:'missing'}),null);
 const before=captureOrderState(s);s.time++;assert.equal(buildOutcomeMoment(before,s,{type:'build',settlementId:id}),null);
});
test('scout receipt is departure with real arrival time, not a claimed success',()=>{
 const s=fresh(),town=s.settlements[0],a={type:'scout',settlementId:town.id,x:26,y:25,count:1},b=captureOrderState(s);
 assert.ok(dispatch(s,a).ok);const m=buildOutcomeMoment(b,s,a);assert.equal(m.kind,'army');assert.equal(m.minutes,Math.ceil(s.armies.at(-1).arriveAt-s.time));assert.match(m.summary,/Sonuç varışta/);
});
test('map progress and DOM directory project same first job without changing saved data',()=>{
 const s=fresh(),town=s.settlements[0];assert.equal(settlementWork(s,town),null);
 assert.ok(dispatch(s,{type:'build',settlementId:town.id,building:'farm'}).ok);
 const q=town.queue[0];s.time=(q.startAt+q.completeAt)/2;const raw=JSON.stringify(s),work=settlementWork(s,town);
 assert.equal(work.progress,.5);assert.equal(work.count,1);assert.equal(work.minutes,Math.ceil(q.completeAt-s.time));
 assert.deepEqual(atlasDirectory(s,{x:town.x+.5,y:town.y+.5}).find(r=>r.x===town.x&&r.y===town.y).work,work);
 assert.equal(JSON.stringify(s),raw);assert.equal(settlementWork(s,{...town,ownerId:'not-player'}),null);
});
