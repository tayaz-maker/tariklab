import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame, SAVE_VERSION} from '../public/games/tc-sim/js/state.js';
import {applyDecision, getAvailableDecisions, advanceWeek} from '../public/games/tc-sim/js/time.js';
import {normalizeRisk, processRiskWeek, riskShortcut, beginDetention} from '../public/games/tc-sim/js/risk-layer.js';
import {migrateState,saveGame,loadGame} from '../public/games/tc-sim/js/save.js';
import {settleHouseholdEvents} from './tc-sim-longrun.mjs';
import {resolveScenarioChoice} from '../public/games/tc-sim/js/historical-scenarios.js';
const reload=s=>{const data=new Map();const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};assert.equal(saveGame(storage,s).ok,true);const r=loadGame(storage);assert.equal(r.ok,true);return r.state;};
const fresh=version=>{let s=createNewGame({seed:17});s.meta.saveVersion=version;s=migrateState(s).state;s.events.active=null;s.events.queue=[];if(s.world?.scenario)s.world.scenario.pendingEvent=null;s.time.absoluteWeek=20;normalizeRisk(s).heat=3;return s;};
for(const version of [5,6])test(`V${version} disengagement costs a real weekly action and lowers pressure once after thirteen clean weeks`,()=>{
 let s=fresh(version);const cash=s.finances.balance;const debt=structuredClone(s.wealth.debts);s.openCases.push({id:'old-risk',type:'risk-dosya',createdWeek:1,dueWeek:50,status:'pending',payload:{kind:'polis',playerKnown:true}});const trust=s.people.find(p=>p.id==='anne').social.trust;
 assert.ok(getAvailableDecisions(s).some(d=>d.id==='risk-disengage'));
 assert.equal(applyDecision(s,'risk-disengage').ok,true);assert.equal(s.weekly.used,1);
 assert.equal(applyDecision(s,'risk-disengage').ok,false);s=reload(s);
 for(let i=1;i<=13;i++){s.time.absoluteWeek=20+i;processRiskWeek(s);if(i<13)assert.equal(s.flags.risk.heat,3);s=reload(s);}
 assert.equal(s.flags.risk.heat,2);assert.equal(s.finances.balance,cash);assert.deepEqual(s.wealth.debts,debt);assert.equal(s.openCases.find(c=>c.id==='old-risk').status,'pending');
 assert.equal(s.people.find(p=>p.id==='anne').social.trust,trust+2);assert.equal(s.people.find(p=>p.id==='anne').memories.filter(m=>m.type==='risk-recovery').length,1);
 const before=JSON.stringify(s);processRiskWeek(s);assert.equal(JSON.stringify(s),before);assert.equal(SAVE_VERSION,6);
});
test('new illegal action cancels disengagement; restart cannot award elapsed weeks',()=>{
 const s=fresh(6);s.flags.risk.heat=1;assert.equal(applyDecision(s,'risk-disengage').ok,true);s.time.absoluteWeek++;assert.equal(riskShortcut(s).ok,true);assert.equal(s.flags.risk.disengagement,undefined);const cash=s.finances.balance;
 s.time.absoluteWeek+=30;processRiskWeek(s);assert.equal(s.flags.risk.heat,2);assert.equal(s.finances.balance,cash);
});
test('detention cancels the plan and release never erases the pending case',()=>{
 const s=fresh(6);assert.equal(applyDecision(s,'risk-disengage').ok,true);beginDetention(s,2,'Test detention');assert.equal(s.flags.risk.disengagement,undefined);s.weekly={used:0,selectedIds:[]};assert.equal(applyDecision(s,'risk-disengage').ok,false);s.time.absoluteWeek+=2;processRiskWeek(s);assert.ok(s.openCases.some(c=>c.payload?.kind==='gozalti'));assert.equal(s.flags.risk.heat,4);
});
test('legacy/malformed/future plans cannot grant progress; skipped weeks reset continuity',()=>{
 const s=fresh(6);for(const record of [{startWeek:100,lastWeek:100,cleanWeeks:12},{startWeek:1,lastWeek:1,cleanWeeks:99},{startWeek:1,lastWeek:2,cleanWeeks:-1}]){s.flags.risk.disengagement=record;normalizeRisk(s);assert.equal(s.flags.risk.disengagement,undefined);}
 assert.equal(applyDecision(s,'risk-disengage').ok,true);s.time.absoluteWeek+=13;processRiskWeek(s);assert.equal(s.flags.risk.heat,3);assert.equal(s.flags.risk.disengagement.cleanWeeks,0);
 s.people.find(p=>p.id==='anne').deceased=true;for(let i=0;i<13;i++){s.time.absoluteWeek++;processRiskWeek(s);}assert.equal(s.flags.risk.heat,2);assert.equal(s.people.find(p=>p.id==='anne').memories.some(m=>m.type==='risk-recovery'),false);
});

test('real thirteen-week calendar flow completes the selected plan through save and reload',()=>{
 let s=createNewGame({eraId:'1999-04-18',seed:28});s.finances.balance=50000;normalizeRisk(s).heat=2;
 const settle=()=>{if(s.world?.scenario?.pendingEvent)assert.equal(resolveScenarioChoice(s,'rest').ok,true);settleHouseholdEvents(s);};
 settle();assert.equal(applyDecision(s,'risk-disengage').ok,true);const start=s.time.absoluteWeek;
 for(let i=1;i<=13;i++){settle();assert.equal(advanceWeek(s).ok,true);s=reload(s);assert.equal(s.time.absoluteWeek,start+i);assert.equal(s.flags.risk.heat,i===13?1:2);}
 assert.equal(s.flags.risk.disengagement,undefined);assert.equal(s.meta.saveVersion,6);
});
