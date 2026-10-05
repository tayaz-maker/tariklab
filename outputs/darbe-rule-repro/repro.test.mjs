// Read-only production-rule investigation. Fixtures are valid engine states;
// every special summon, activation and selection goes through real dispatch.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture, place, act, decisions } from '../../scripts/duel-fixture.mjs';
import { legalActions } from '../../public/games/duel-core/actions.js';
import { rejection } from '../../public/games/duel-core/rules.js';
import { validateState, locate } from '../../public/games/duel-core/model.js';
import { serialize, deserialize } from '../../public/games/duel-core/save.js';
import { pools } from '../../scripts/duel-pools.mjs';

const output = fileURLToPath(new URL('./', import.meta.url));
const repo = resolve(output, '../..');
const BASELINE = '562831dba3b16be2a0bc8b2aec2e613eb1b80f45';
const cases = [
  { id: 'DRB-237', materials: ['DRB-005','DRB-006'], cost: 900 },
  { id: 'DRB-238', materials: ['DRB-007','DRB-008'], cost: 1000 },
  { id: 'DRB-239', materials: ['DRB-009','DRB-010'], cost: 1100 },
  { id: 'DRB-240', materials: ['DRB-011','DRB-012'], cost: 1200 },
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const protectedPaths = execFileSync('git', ['ls-files', 'public/games/duel-core', 'public/games/darbe-h/source-cards.json', 'public/games/darbe-h/designs.js', 'public/games/darbe-h/decks.json'], {cwd:repo,encoding:'utf8'}).trim().split('\n');
const hashes = Object.fromEntries(protectedPaths.map(path => [path, hash(readFileSync(resolve(repo,path)))]));
const report = { baseline: BASELINE, startedAt: new Date().toISOString(), scope: 'DRB-237..240 actual engine preconditions, special summon, activated effect, resumable choice and negative controls; no browser/production/AI-frequency conclusion.', protectedSHA256: hashes, cases: [] };
function stateFor(spec, {targetFace = 'up', materialsZone = 'units', points = 8000} = {}) {
  const state = fixture('darbe-h');
  state.players[0].points = points;
  const boss = place(state,spec.id,0,'auxiliary');
  const materials = spec.materials.map((id,i)=>place(state,id,0,materialsZone,i));
  const target = place(state,'DRB-097',1,'support',0);
  state.cards[target].face = targetFace;
  state.cards[target].knownTo = [targetFace === 'up',true];
  assert.equal(validateState(state),true,'constructed fixture satisfies engine state invariants');
  return {state,boss,materials,target};
}
function summon(fixture) {
  const plan = legalActions(fixture.state,0).find(a=>a.type==='special' && a.card===fixture.boss);
  assert.ok(plan,'actual legal special-summon plan must exist');
  const state = decisions(act(fixture.state,plan));
  assert.equal(locate(state,fixture.boss).zone,'units');
  for(const material of fixture.materials) assert.equal(locate(state,material).zone,'grave');
  assert.equal(validateState(state),true);
  return {...fixture,state,plan};
}
function roundTrip(state) {
  const raw=serialize(state),loaded=deserialize(raw,pools['darbe-h'],'darbe-h');
  assert.equal(loaded.ok,true,loaded.error);
  assert.equal(validateState(loaded.state),true);
  return loaded.state;
}
function activation(state,boss) { return {type:'activate',card:boss,player:0,revision:state.revision,targets:[]}; }
function summary(state,boss,target) {
  return {seed:state.seed,turn:state.turn,phase:state.phase,active:state.active,revision:state.revision,
    points:state.players.map(p=>p.points),boss:{uid:boss,id:state.cards[boss].id,location:locate(state,boss),face:state.cards[boss].face,used:state.cards[boss].used},
    target:{uid:target,id:state.cards[target].id,location:locate(state,target),face:state.cards[target].face},choice:state.choice,pending:state.pending,result:state.result};
}

test('all production sources match main baseline before this read-only investigation',()=>{
  for(const path of protectedPaths) assert.equal(hashes[path],hash(execFileSync('git',['show',`${BASELINE}:${path}`],{cwd:repo})),path);
});
for(const spec of cases){
  test(`${spec.id}: legal on-field material summon and paid activated effect work across save/reload`,()=>{
    const setup=stateFor(spec);
    const definition=setup.state.catalog[spec.id];
    const initial=summary(setup.state,setup.boss,setup.target);
    const savedFixture=serialize(setup.state);
    writeFileSync(resolve(output,`${spec.id}-fixture.json`),savedFixture+'\n');
    const summoned=summon({...setup,state:roundTrip(setup.state)});
    let state=roundTrip(summoned.state);
    const action=legalActions(state,0).find(a=>a.type==='activate'&&a.card===setup.boss);
    assert.ok(action,'real legalActions offers activation');
    const beforePoints=state.players[0].points;
    state=act(state,action);
    if(state.pending)state=decisions(state);
    assert.ok(state.choice,'actual effect creates a target choice');
    assert.deepEqual(state.choice.ids,[setup.target]);
    const choiceBefore=structuredClone(state.choice);
    state=roundTrip(state);
    assert.deepEqual(state.choice,choiceBefore,'save restores exact pending target choice');
    const choose=legalActions(state,0).find(a=>a.type==='choose'&&a.targets?.includes(setup.target));
    assert.ok(choose); state=act(state,choose);state=decisions(state);
    assert.equal(beforePoints-state.players[0].points,spec.cost,'exact source-text KP cost');
    assert.deepEqual(locate(state,setup.target),{player:1,zone:'hand',index:0},'opponent support returns to its owner hand');
    assert.equal(state.choice,null);assert.equal(state.pending,null);assert.equal(validateState(state),true);
    report.cases.push({id:spec.id,name:definition.name.tr,sourceText:definition.text.tr,
      definition:{materials:definition.traits.materials,costs:definition.costs,effects:definition.effects,triggers:definition.triggers},
      fixtureFile:`${spec.id}-fixture.json`,fixtureSHA256:hash(savedFixture),initial,
      materialDefinitions:spec.materials,specialAction:summoned.plan,activation:action,choiceBeforeReload:choiceBefore,choose,
      actualCost:beforePoints-state.players[0].points,after:summary(state,setup.boss,setup.target),status:'expected-effect-observed',
      log:state.log});
  });
  test(`${spec.id}: hand-only materials cannot pay the on-field summon condition`,()=>{
    const {state,boss}=stateFor(spec,{materialsZone:'hand'});
    assert.equal(legalActions(state,0).filter(a=>a.type==='special'&&a.card===boss).length,0);
  });
  test(`${spec.id}: closed support is correctly not an activation target`,()=>{
    const {state,boss}=summon(stateFor(spec,{targetFace:'down'}));
    assert.equal(rejection(state,activation(state,boss)),'no-legal-target');
    assert.equal(legalActions(state,0).some(a=>a.type==='activate'&&a.card===boss),false);
  });
  test(`${spec.id}: less than the printed KP cost rejects activation`,()=>{
    const {state,boss}=summon(stateFor(spec,{points:spec.cost-1}));
    assert.equal(rejection(state,activation(state,boss)),'insufficient-points');
  });
  test(`${spec.id}: once-per-turn activation rejects a second activation`,()=>{
    const {state:initial,boss,target}=summon(stateFor(spec));
    let state=act(initial,activation(initial,boss));state=decisions(state);
    assert.equal(locate(state,target).zone,'hand');
    assert.equal(rejection(state,activation(state,boss)),'effect-used');
  });
}
after(()=>{
  for(const path of protectedPaths)assert.equal(hash(readFileSync(resolve(repo,path))),hashes[path],path);
  report.finishedAt=new Date().toISOString();
  report.protectedFilesUnchanged=true;
  report.verdict=report.cases.length===4?'NOT_REPRODUCED_IN_VALID_ENGINE_FIXTURES':'INCOMPLETE';
  writeFileSync(resolve(output,'results.json'),JSON.stringify(report,null,2)+'\n');
});
