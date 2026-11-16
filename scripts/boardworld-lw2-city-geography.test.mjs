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

test('nearest public centre quote includes venue access, fare and arrival restrictions', async () => {
  const {districtView} = await import('../public/games/tc-sim-boardworld/expansion-districts.mjs');
  const s = engine.createGame({startingDistrict:'kadikoy',lifePath:'ordinary',expansion:true});
  const nearest = districtView(s).nearestInstitution;
  const candidates = LOCATIONS.filter(v => v.kind === 'institution' && v.districtId.startsWith('istanbul:'))
    .map(v => ({v, route:routeBetween(s,'kadikoy',v.id)})).sort((a,b) => a.route.minutes-b.route.minutes);
  assert.equal(nearest.districtId,candidates[0].v.districtId);
  assert.equal(nearest.minutes,candidates[0].route.minutes);
  assert.equal(nearest.cost,candidates[0].route.cost);
  assert.equal(nearest.available,candidates[0].route.available);
});

test('world inspector groups available visits by neighborhood and identifies the current venue', async () => {
  const {renderWorldMap} = await import('../public/games/tc-sim-boardworld/expansion-world-map.mjs');
  const runtime = await engine.loadExpansionRuntime();
  let s = engine.createGame({startingDistrict:'ankara:cankaya',lifePath:'ordinary',expansion:true});
  const action = engine.getActions(s).find(a => a.id === 'district:visit:ankara:kizilay:work');
  assert.ok(action && !action.disabled);
  s = engine.resolveAction(s,action.id).state;
  const view = runtime.getExpansionView(s);
  const html = renderWorldMap({view,actions:engine.getActions(s),actionCard:a => `[${a.id}]`,esc:String,language:'en',selectedDistrict:'ankara:cankaya',localize:x=>x});
  assert.match(html,/Currently: Çankaya · Kızılay · İş merkezi/);
  assert.ok(html.indexOf('Game neighborhood (fictional)') < html.indexOf('Kızılay</h5>'));
  assert.match(html,/\[district:visit:ankara:kizilay:institution\]/);
  assert.doesNotMatch(html,/\[district:visit:ankara:kizilay:work\]/);
});

test('fictional activity areas expose existing workplaces and survive a save round trip', async () => {
  const {exportGame, importGame} = await import('../public/games/tc-sim-boardworld/persistence.mjs');
  for (const {id} of DISTRICTS) {
    const neighborhood = NEIGHBORHOODS.find(n => n.id === `${id}:activity-area`);
    const workplace = LOCATIONS.find(v => v.districtId === id && v.kind === 'work');
    assert.ok(neighborhood?.fictional && neighborhood.en && neighborhood.pl, id);
    assert.equal(workplace.neighborhoodId,neighborhood.id,id);
    const before = engine.createGame({startingDistrict:id,lifePath:'ordinary',expansion:true});
    const actionId = ['kadikoy','besiktas','sisli'].includes(id) ? `visit:${workplace.id}` : `district:visit:${workplace.id}`;
    const action = engine.getActions(before).find(a => a.id === actionId);
    assert.ok(action && !action.disabled,id);
    const visited = engine.resolveAction(before,action.id);
    assert.ok(visited.ok,id);
    assert.equal(getPlace(visited.state).neighborhoodId,neighborhood.id,id);
    assert.ok(engine.getActions(visited.state).some(a => a.id === 'district:apply'),id);
    const loaded = importGame(exportGame(visited.state));
    assert.ok(loaded.state,id);
    assert.equal(getPlace(loaded.state).neighborhoodId,neighborhood.id,id);
  }
});

test('activity areas group different real services without inventing venues', () => {
  const kinds = id => LOCATIONS.filter(v => v.neighborhoodId === `${id}:activity-area`).map(v => v.kind).sort();
  assert.deepEqual(kinds('istanbul:umraniye'), ['work']);
  assert.deepEqual(kinds('istanbul:atasehir'), ['social','work']);
  assert.deepEqual(kinds('ankara:mamak'), ['housing','work']);
  assert.deepEqual(kinds('izmir:bornova'), ['institution','work']);
  assert.deepEqual(kinds('kadikoy'), ['meeting','work']);
  assert.deepEqual(kinds('sisli'), ['class','work']);
});

test('a frozen Depth workplace save keeps its venue and ledger when its neighborhood is grouped', async () => {
  const {mkdtempSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {pathToFileURL}=await import('node:url');
  const {spawnSync}=await import('node:child_process');
  const dir=mkdtempSync(join(tmpdir(),'boardworld-neighborhood-old-'));
  try {
    const archive=spawnSync('git',['archive','c055514627db537c79f4c92481d38109606deaa6','public/games/tc-sim-boardworld'],{maxBuffer:8e6});
    assert.equal(archive.status,0,archive.stderr?.toString());
    assert.equal(spawnSync('tar',['-x','-C',dir],{input:archive.stdout}).status,0);
    const old=async file=>import(pathToFileURL(join(dir,'public/games/tc-sim-boardworld',file)).href);
    const oldEngine=await old('engine.mjs'), oldIO=await old('persistence.mjs');
    await oldEngine.loadExpansionRuntime();
    const {importGame}=await import('../public/games/tc-sim-boardworld/persistence.mjs');
    for(const district of ['istanbul:kartal','ankara:etimesgut','izmir:bayrakli']) {
      let s=oldEngine.createGame({startingDistrict:district,lifePath:'ordinary',expansion:true});
      const visit=oldEngine.resolveAction(s,`district:visit:${district}:work`); assert.ok(visit.ok); s=visit.state;
      const loaded=importGame(oldIO.exportGame(s)); assert.ok(loaded.state,loaded.message);
      assert.equal(getPlace(loaded.state).venueId,`${district}:work`);
      assert.equal(getPlace(loaded.state).neighborhoodId,`${district}:activity-area`);
      assert.equal(loaded.state.cash,s.cash); assert.equal(loaded.state.bank,s.bank);
      assert.deepEqual(loaded.state.expansion.economy,s.expansion.economy);
    }
  } finally {rmSync(dir,{recursive:true,force:true});}
});
