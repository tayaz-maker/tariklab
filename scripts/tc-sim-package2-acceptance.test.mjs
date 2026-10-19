import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame,validateState,SAVE_VERSION} from '../public/games/tc-sim/js/state.js';
import {enrollEducation,getMonthlyEmploymentIncome,getWeeklyLifeLoad} from '../public/games/tc-sim/js/life.js';
import {applyDecision,advanceWeek,canApplyDecision} from '../public/games/tc-sim/js/time.js';
import {isWorkRecovering} from '../public/games/tc-sim/js/body-systems.js';
import {migrateState,saveGame,loadGame} from '../public/games/tc-sim/js/save.js';
import {settleBodyEvents} from './tc-sim-longrun.mjs';

for(const version of [5,6])test(`Package2 V${version}: education persists across overlapping recovery and detention, work resumes only after both`,()=>{
 let s=createNewGame({seed:17,now:'2027-01-01T00:00:00.000Z'});s.meta.saveVersion=version;s.finances.balance=100000;
 const migrated=migrateState(s);assert.equal(migrated.ok,true);s=migrated.state;
 assert.equal(enrollEducation(s,'vocational_course','part').ok,true);
 const tuition=s.education.active.pathId,job=s.career.jobId,salary=getMonthlyEmploymentIncome(s);
 s.health.health=12;s.health.energy=80;s.health.stress=30;
 assert.equal(applyDecision(s,'body-care').ok,true);settleBodyEvents(s);
 const recovery=structuredClone(s.body.workRecovery);
 s.flags.risk={detainedUntil:s.time.absoluteWeek+3};
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 for(let week=0;week<3;week++){
  settleBodyEvents(s);assert.equal(getMonthlyEmploymentIncome(s),0);assert.equal(canApplyDecision(s,'overtime').ok,false);
  const load=getWeeklyLifeLoad(s);assert.equal(load.commute,0);assert.equal(load.load,load.education.load);
  assert.equal(applyDecision(s,'rest').ok,true);settleBodyEvents(s);
  assert.equal(advanceWeek(s).ok,true);settleBodyEvents(s);
  assert.deepEqual(s.career.jobFamilyExperience,{});assert.equal(s.career.jobId,job);
  assert.equal(s.flags.socialInsurance.coveredWeeks,0);
  assert.equal(saveGame(storage,s).ok,true);const loaded=loadGame(storage);assert.equal(loaded.ok,true);s=loaded.state;
  assert.deepEqual(s.body.workRecovery,recovery);assert.equal(validateState(s).ok,true);
 }
 assert.equal(isWorkRecovering(s),false);assert.equal(getMonthlyEmploymentIncome(s),salary);
 assert.equal(s.education.active.pathId,tuition);assert.ok(s.education.active.progressPoints>0,'existing study commitment continues');
 assert.equal(s.career.weeksInRole,0);
 assert.equal(advanceWeek(s).ok,true);settleBodyEvents(s);
 assert.equal(Object.values(s.career.jobFamilyExperience).reduce((a,b)=>a+b,0),1);
 assert.equal(s.career.weeksInRole,1);assert.equal(s.flags.socialInsurance.coveredWeeks,1);
 assert.equal(s.finances.ledger.filter(row=>row.reason==='Aylık maaş').length,1);
 assert.equal(s.finances.ledger.filter(row=>row.reason==='Aylık maaş')[0].amount,salary);
 assert.equal(s.finances.ledger.some(row=>row.category==='sgk'&&row.amount<0),false);
 assert.equal(validateState(s).ok,true);assert.equal(SAVE_VERSION,6);
});
