import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, SAVE_VERSION } from "../public/games/tc-sim/js/state.js";
import { migrateState, saveGame, loadGame } from "../public/games/tc-sim/js/save.js";
import { getEventDefinition } from "../public/games/tc-sim/js/events.js";
import { getNetworkContacts, createFavor, createNetworkOpportunity, processNpcMilestones, markNpcMilestoneKnown } from "../public/games/tc-sim/js/depth3-systems.js";

for (const version of [5,6]) test(`V${version}: deceased contacts retain history but cannot supply new network promises`, () => {
  let state = createNewGame({ seed: 17 }); state.meta.saveVersion = version;
  const migration = migrateState(state); assert.equal(migration.ok,true); state=migration.state;
  state.time.absoluteWeek=48;processNpcMilestones(state);markNpcMilestoneKnown(state,"burak","burak-promotion");
  const event=getEventDefinition("network_referral_offer");
  assert.equal(event.condition(state),true);
  const existing=createFavor(state,{personId:"burak",type:"old-promise"});assert.ok(existing);
  const person=state.people.find(p=>p.id==="burak");person.deceased=true;
  const history=structuredClone(person.lifeMilestones),cash=state.finances.balance,caseCount=state.openCases.length;
  assert.equal(getNetworkContacts(state).some(p=>p.id==="burak"),false);
  assert.equal(event.condition(state),false);
  assert.equal(createFavor(state,{personId:"burak",type:"new-promise"}),null);
  assert.equal(createNetworkOpportunity(state,"burak","network_referral_followup"),false);
  assert.equal(createNetworkOpportunity(state,"missing","network_referral_followup"),false);
  assert.equal(state.openCases.length,caseCount);assert.equal(state.finances.balance,cash);
  assert.ok(state.favors.some(f=>f.id===existing.id));assert.deepEqual(person.lifeMilestones,history);
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  assert.equal(saveGame(storage,state).ok,true);const loaded=loadGame(storage);assert.equal(loaded.ok,true);
  assert.equal(getNetworkContacts(loaded.state).some(p=>p.id==="burak"),false);
  assert.ok(loaded.state.favors.some(f=>f.id===existing.id));assert.equal(loaded.state.meta.saveVersion,6);assert.equal(SAVE_VERSION,6);
});

test("living contact, circle and dormancy behavior remain available",()=>{
 const state=createNewGame({seed:17});
 assert.ok(getNetworkContacts(state).some(p=>p.id==="burak"));
 assert.ok(createFavor(state,{personId:"burak",type:"new-promise"}));
 assert.equal(createNetworkOpportunity(state,"burak","network_referral_followup"),true);
 assert.equal(createNetworkOpportunity(state,"burak","network_referral_followup"),false);
 state.people.find(p=>p.id==="burak").dormant=true;
 assert.equal(getNetworkContacts(state).some(p=>p.id==="burak"),false);
 for(const p of getNetworkContacts(state,"friends"))assert.ok(p.circles.includes("friends"));
});

test("a known housing milestone cannot create a fresh lead from a deceased source",()=>{
 const state=createNewGame({seed:17});state.time.absoluteWeek=72;processNpcMilestones(state);
 markNpcMilestoneKnown(state,"selin","selin-moved");
 const event=getEventDefinition("network_housing_lead");assert.equal(event.condition(state),true);
 state.people.find(p=>p.id==="selin").deceased=true;
 assert.equal(event.condition(state),false);
});
