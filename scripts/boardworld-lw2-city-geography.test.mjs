import test from 'node:test';
import assert from 'node:assert/strict';
import {DISTRICTS, NEIGHBORHOODS, LOCATIONS, cityDistricts, normalizeDistrictId, hubDistrict, routeBetween} from '../public/games/tc-sim-boardworld/expansion-geography.mjs';
import {getPlace, migrateDistricts, validateDistricts} from '../public/games/tc-sim-boardworld/expansion-districts.mjs';
import * as engine from '../public/games/tc-sim-boardworld/engine.mjs';
await engine.loadExpansionRuntime();
const state = {time: 600, cash:10000, bank:0};
test('all 31 districts have a connected transit path and place metadata', () => {
  assert.equal(DISTRICTS.length,31);
  assert.deepEqual(['istanbul','ankara','izmir'].map(c=>cityDistricts(c).length),[15,8,8]);
  assert.equal(new Set(DISTRICTS.map(d=>d.id)).size,31);
  for (const d of DISTRICTS) {
    assert.ok(NEIGHBORHOODS.some(n=>n.districtId===d.id));
    assert.ok(LOCATIONS.some(l=>l.districtId===d.id && l.hours.length===2));
    const route=routeBetween(state,hubDistrict(d.cityId),d.id);
    assert.ok(route?.available, d.id);
    assert.ok(Number.isFinite(route.minutes) && Number.isFinite(route.cost));
    if (d.id!==hubDistrict(d.cityId)) assert.ok(route.legs.length);
  }
});
test('routes enforce modes, hours, funds and valid endpoints for players and NPCs', () => {
  assert.equal(routeBetween(state,'kadikoy','ankara:cankaya',{mode:'walk'}).available,false);
  assert.equal(routeBetween(state,'kadikoy','besiktas',{mode:'walk'}).available,false);
  assert.equal(routeBetween({...state,time:100},'kadikoy','istanbul:pendik').available,false);
  assert.equal(routeBetween({...state,cash:0},'kadikoy','istanbul:pendik').available,false);
  assert.equal(routeBetween({...state,cash:0},'kadikoy','istanbul:pendik',{actor:'npc'}).available,true);
  assert.equal(routeBetween(state,'unknown','kadikoy'),null);
  assert.equal(routeBetween(state,'kadikoy','istanbul:pendik',{at:NaN}),null);
  assert.equal(routeBetween({...state,time:20},'ankara:cankaya','ankara:kizilay:work',{mode:'walk'}).available,false);
});
test('legacy Kızılay state preserves its ledger and becomes Çankaya', () => {
  const s=engine.createGame({seed:49,expansion:true});
  s.expansion.world.region='ankara';
  const m=()=>({stock:10,cash:700,wholesaleSpent:90,lastDay:1});
  s.expansion.districts={place:{districtId:'ankara:kizilay',venueId:'ankara:kizilay:work'},job:null,visits:{},visitDay:1,contacts:{},foodMarkets:{'ankara:kizilay':m(),'ankara:cankaya':m(),'izmir:konak':m(),'izmir:bornova':m()}};
  assert.equal(validateDistricts(s),true);
  assert.equal(getPlace(s).districtId,'ankara:cankaya');
  assert.equal(getPlace(s).neighborhoodId,'ankara:kizilay');
  migrateDistricts(s);
  assert.equal(validateDistricts(s),true);
  assert.deepEqual(s.expansion.districts.foodMarkets['ankara:kizilay'],m());
  assert.equal(normalizeDistrictId('ankara:kizilay'),'ankara:cankaya');
  const bad=structuredClone(s); delete bad.expansion.districts.foodMarkets['izmir:konak'];
  assert.equal(validateDistricts(bad),false);
});
test('expanded Gold travel quotes and resolves with shared route; Gold v6 remains unchanged', () => {
  let s=engine.createGame({seed:49,expansion:true});
  while(s.pendingEvents.length) {
    const a=engine.getActions(s).find(a=>a.category==='event'&&!a.disabled);
    const result=engine.resolveAction(s,a.id); assert.equal(result.ok,true); s=result.state;
  }
  const expected=routeBetween(s,s.city.venue||s.location,'besiktas');
  const a=engine.getActions(s).find(a=>a.id==='travel:besiktas');
  assert.equal(a.minutes,expected.minutes); assert.equal(a.cost,expected.cost);
  const r=engine.resolveAction(s,a.id); assert.equal(r.ok,true,r.message);
  assert.equal(r.state.time-s.time,expected.minutes); assert.equal(r.state.location,'besiktas');
  assert.equal(r.state.city.lastRoute.minutes,expected.minutes);
  assert.equal(engine.validateState(r.state),true);
  assert.equal(engine.getActions(s).find(a=>a.id==='walk:besiktas').disabled,true);
  let gold=engine.createGame({seed:49});
  while(gold.pendingEvents.length){const x=engine.getActions(gold).find(a=>a.category==='event'&&!a.disabled);gold=engine.resolveAction(gold,x.id).state;}
  assert.notEqual(engine.getActions(gold).find(a=>a.id==='travel:besiktas').minutes,expected.minutes);
});
