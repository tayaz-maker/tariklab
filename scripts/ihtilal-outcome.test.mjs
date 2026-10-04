import test from 'node:test';
import assert from 'node:assert/strict';
import {createSolo,applyMove,setConnection,selectRegion,serializeSolo,deserializeSolo} from '../public/games/ihtilal/solo.js';
import {FIELDS} from '../public/games/ihtilal/basin-network.js';
import {buildOutcomeMoment} from '../public/games/ihtilal/outcome-moment.js';
import {basinRenderModel,basinMetricBand} from '../public/games/ihtilal/basin-map.js';
const here=(s,id=s.selected)=>s.regions.find(r=>r.id===id);
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

test('first committed decisions show measured local/global changes, cost and real queue timing',()=>{
  for(const id of ['tut','ac','sustur','devret']){
    const before=createSolo(8),after=applyMove(before,id),model=buildOutcomeMoment(before,after,id,'en');
    assert.equal(model.first,true);assert.equal(model.closed,false);assert.equal(model.cost.used,1);
    assert.equal(model.cost.before,3);assert.equal(model.cost.after,2);
    for(const row of model.local){assert.equal(row.before,here(before)[row.key]);assert.equal(row.after,here(after)[row.key]);assert.equal(row.delta,row.after-row.before);}
    for(const row of model.global)assert.equal(row.delta,after[row.key]-before[row.key]);
    assert.deepEqual(model.queued.map(p=>p.id),after.network.pulses.map(p=>`wave-${p.id}`));
    assert.deepEqual(model.queued.map(p=>p.due),after.network.pulses.map(p=>p.due));
    assert.equal(model.pending[0].due,after.pending[0].due);
    assert.equal(model.pending[0].timing,'closing');assert.ok(model.queued.every(p=>p.timing==='entry'));
    assert.ok(model.announcement.includes('→'));assert.equal(model.arrived.length,0);
  }
});

test('ordinary decisions, selection, hydration and illegal moves do not trigger a moment',()=>{
  const before=applyMove(createSolo(7),'ac');
  assert.equal(buildOutcomeMoment(before,applyMove(before,'tut'),'tut'),null);
  assert.equal(buildOutcomeMoment(before,selectRegion(before,'kuzey'),'select'),null);
  assert.equal(buildOutcomeMoment(before,deserializeSolo(serializeSolo(before)),'load'),null);
  assert.equal(buildOutcomeMoment(before,applyMove(before,'invalid'),'invalid'),null);
});

test('automatic closing reports a paid decision separately from the reset capacity and actual net delta',()=>{
  const before=applyMove(applyMove(createSolo(8),'ac'),'tut'),after=applyMove(before,'sustur');
  const model=buildOutcomeMoment(before,after,'sustur','en');
  assert.equal(model.closed,true);assert.deepEqual(model.cost,{before:1,after:3,used:1,forfeited:0,refilled:true});
  for(const row of model.local)assert.equal(row.delta,here(after)[row.key]-here(before)[row.key]);
  assert.deepEqual(model.arrived.map(p=>p.id),after.network.last.map(p=>`wave-${p.id}`));
  for(const wave of model.arrived){const real=after.network.last.find(p=>`wave-${p.id}`===wave.id);assert.deepEqual(wave.delta,real.delivered);assert.equal(wave.due,real.arrived);}
  assert.ok(model.queued.every(p=>!before.network.pulses.some(old=>`wave-${old.id}`===p.id)));
});

test('manual closing distinguishes forfeited decisions and actual resolved echoes from future ones',()=>{
  let before=applyMove(createSolo(8),'ac');before=applyMove(before,'kapat');
  const after=applyMove(before,'kapat'),model=buildOutcomeMoment(before,after,'kapat','tr');
  assert.equal(model.cost.forfeited,3);assert.equal(model.cost.used,0);
  assert.equal(model.resolved.length,1);assert.equal(model.resolved[0].due,2);
  assert.equal(model.resolved[0].timing,'closing');assert.equal(model.pending.length,0);
  assert.ok(model.announcement.includes('kapanışı'));
});

test('route setting is a first meaningful decision; period-four shared choice is meaningful later',()=>{
  const before=createSolo(5),after=setConnection(before,'buffered');
  assert.equal(buildOutcomeMoment(before,after,'buffered','en').cost.used,1);
  let threshold=applyMove(before,'ac');for(let i=0;i<3;i++)threshold=applyMove(threshold,'kapat');
  assert.equal(threshold.phase,'break');
  const choice=buildOutcomeMoment(threshold,applyMove(threshold,'sert'),'sert','en');
  assert.ok(choice);assert.equal(choice.cost.used,0);assert.equal(choice.global.find(r=>r.key==='trust').delta,-8);
});

test('model construction is deterministic, immutable and adds no saved state',()=>{
  const before=freeze(createSolo(4)),after=freeze(applyMove(before,'ac'));
  const snapshot=serializeSolo(after),one=buildOutcomeMoment(before,after,'ac','en'),two=buildOutcomeMoment(before,after,'ac','en');
  assert.deepEqual(one,two);assert.equal(serializeSolo(after),snapshot);
  one.queued[0].delta.intel=999;assert.notEqual(after.network.pulses[0].delta.intel,999);
  assert.equal(buildOutcomeMoment(before,after,'ac','pl').title,two.title);
});

test('permanent basin bands track the selected true 0–100 metric in shared render geometry',()=>{
  const state=freeze(createSolo(10));
  for(const layer of FIELDS){
    const model=basinRenderModel(state,{layer});
    for(const region of model.regions){
      assert.equal(region.band.value,here(state,region.id)[layer]);
      assert.deepEqual(region.band,basinMetricBand(region.shape,region.value));
      const minY=Math.min(...region.shape.map(p=>p[1])),maxY=Math.max(...region.shape.map(p=>p[1]));
      assert.equal(region.band.level,maxY-(maxY-minY)*region.value/100);
      assert.ok(region.band.shape.every(p=>p[1]>=region.band.level));
    }
  }
  const shape=[[0,0],[100,0],[100,100],[0,100]];
  assert.deepEqual(basinMetricBand(shape,0).shape,[]);
  assert.deepEqual(basinMetricBand(shape,100).shape,shape);
  assert.equal(basinMetricBand(shape,25).level,75);
  assert.equal(basinMetricBand(shape,75).level,25);
  assert.equal(basinMetricBand(shape,-9).value,0);assert.equal(basinMetricBand(shape,120).value,100);
});
