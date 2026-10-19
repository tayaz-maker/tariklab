import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame,validateState,SAVE_VERSION} from '../public/games/tc-sim/js/state.js';
import {applyDecision,advanceWeek,canApplyDecision} from '../public/games/tc-sim/js/time.js';
import {getMonthlyEmploymentIncome,getWeeklyLifeLoad} from '../public/games/tc-sim/js/life.js';
import {isWorkRecovering,workRecoverySummary} from '../public/games/tc-sim/js/body-systems.js';
import {migrateState,saveGame,loadGame} from '../public/games/tc-sim/js/save.js';
import {settleBodyEvents} from './tc-sim-longrun.mjs';
for(const version of [5,6])test(`V${version}: critical care preserves work, pauses two real weeks and resumes once`,()=>{
 let s=createNewGame({seed:17});s.meta.saveVersion=version;s.finances.balance=10000;s.health.health=12;s.health.energy=80;s.health.stress=30;
 const migrated=migrateState(s);assert.equal(migrated.ok,true);s=migrated.state;
 const income=getMonthlyEmploymentIncome(s),job=s.career.jobId,experience=structuredClone(s.career.jobFamilyExperience),performance=s.career.performance;
 assert.equal(applyDecision(s,'body-care').ok,true);
 assert.equal(s.finances.balance,9700);assert.equal(s.health.health,16);assert.equal(s.weekly.used,1);
 assert.equal(isWorkRecovering(s),true);assert.equal(canApplyDecision(s,'overtime').ok,false);
 assert.equal(getWeeklyLifeLoad(s).load,0);assert.equal(getMonthlyEmploymentIncome(s),income);
 for(const lang of ['tr','en','pl'])assert.ok(workRecoverySummary(s,lang).length>30);
 for(let week=0;week<2;week++){
  settleBodyEvents(s);assert.equal(advanceWeek(s).ok,true);settleBodyEvents(s);
  assert.deepEqual(s.career.jobFamilyExperience,experience);assert.equal(s.career.performance,performance);
  assert.equal(s.flags.socialInsurance?.coveredWeeks||0,0);assert.equal(s.career.jobId,job);
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  assert.equal(saveGame(storage,s).ok,true);const loaded=loadGame(storage);assert.equal(loaded.ok,true);s=loaded.state;
 }
 assert.equal(isWorkRecovering(s),false);assert.equal(workRecoverySummary(s),'');
 assert.equal(getMonthlyEmploymentIncome(s),income);assert.ok(getWeeklyLifeLoad(s).load>0);
 assert.equal(advanceWeek(s).ok,true);
 assert.equal(Object.values(s.career.jobFamilyExperience).reduce((a,b)=>a+b,0),Object.values(experience).reduce((a,b)=>a+b,0)+1);
 assert.equal(s.flags.socialInsurance.coveredWeeks,1);assert.equal(validateState(s).ok,true);assert.equal(SAVE_VERSION,6);
});
test('recovery deadline cannot force critical health back to work or fabricate legacy history',()=>{
 const s=createNewGame({seed:17});assert.equal(isWorkRecovering(s),false);
 s.body.workRecovery={version:1,startWeek:1,untilWeek:3};s.time.absoluteWeek=3;s.health.health=15;
 assert.equal(isWorkRecovering(s),true);s.health.health=16;assert.equal(isWorkRecovering(s),false);
 for(const record of [{version:2,startWeek:1,untilWeek:3},{version:1,startWeek:1,untilWeek:999},{version:1,startWeek:9,untilWeek:11}]){
  s.body.workRecovery=record;assert.equal(validateState(s).ok,false);assert.equal(migrateState(s).ok,false);
 }
});
test('recovery month credits the existing net salary once, with observed service only on worked weeks',()=>{
 const s=createNewGame({seed:17});s.finances.balance=10000;s.health.health=12;s.health.energy=80;s.health.stress=30;
 const salary=getMonthlyEmploymentIncome(s);assert.equal(applyDecision(s,'body-care').ok,true);
 for(let week=0;week<4;week++){settleBodyEvents(s);assert.equal(advanceWeek(s).ok,true);settleBodyEvents(s);}
 const receipts=s.finances.ledger.filter(row=>row.reason==='Aylık maaş');
 assert.equal(receipts.length,1);assert.equal(receipts[0].amount,salary);
 assert.equal(s.flags.socialInsurance.coveredWeeks,2);assert.equal(s.flags.socialInsurance.service.days,15);
 assert.equal(s.finances.ledger.some(row=>row.category==='sgk'&&row.amount<0),false);
 assert.equal(isWorkRecovering(s),false);assert.equal(validateState(s).ok,true);
});
test('recovery browser fixture must resolve the legitimate career warning after clinic before navigation',async()=>{
 const {resolveEvent}=await import('../public/games/tc-sim/js/events.js');
 const s=createNewGame({seed:17});s.finances.balance=10000;s.health.health=12;s.health.energy=80;s.health.stress=30;s.events.active=null;s.events.queue=[];
 assert.equal(applyDecision(s,'body-care').ok,true);assert.equal(s.events.active.eventId,'health_warning');
 assert.equal(resolveEvent(s,'clinic').ok,true);assert.equal(s.finances.balance,9450);
 assert.equal(s.events.active.eventId,'job_security_warning','clinic legitimately chains a career warning');
 assert.equal(resolveEvent(s,'recover').ok,true);assert.equal(s.events.active,null);
 assert.equal(s.flags.jobSecurityRecovery,true);assert.equal(s.finances.balance,9450);
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 assert.equal(saveGame(storage,s).ok,true);const loaded=loadGame(storage);assert.equal(loaded.ok,true);
 assert.equal(loaded.state.events.active,null);assert.deepEqual(loaded.state.body.workRecovery,s.body.workRecovery);
});
