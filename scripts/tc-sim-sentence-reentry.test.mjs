import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame} from '../public/games/tc-sim/js/state.js';
import {openCriminalHearing,resolveCriminalChoice,criminalRecords,isServingCriminalSentence,processCriminalSentenceWeek,criminalJobDelay} from '../public/games/tc-sim/js/criminal-justice.js';
import {isDetained} from '../public/games/tc-sim/js/risk-layer.js';
import {getWeeklyLifeLoad,getMonthlyEmploymentIncome,acceptJobOffer,completePendingJob} from '../public/games/tc-sim/js/life.js';
import {settleHouseholdEvents} from './tc-sim-longrun.mjs';
import {applyDecision,advanceWeek} from '../public/games/tc-sim/js/time.js';
import {migrateState,saveGame,loadGame} from '../public/games/tc-sim/js/save.js';
const reload=s=>{const m=new Map(),storage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};assert.equal(saveGame(storage,s).ok,true);const r=loadGame(storage);assert.equal(r.ok,true);return r.state;};
function verdict(s,id){const source={id,type:'risk-dosya',createdWeek:s.time.absoluteWeek,dueWeek:s.time.absoluteWeek+6,status:'pending',payload:{kind:'kavga',playerKnown:true}};s.openCases.push(source);assert.equal(openCriminalHearing(s,source),true);const hearing=s.openCases.find(c=>c.id==='criminal-hearing-'+id);s.time.absoluteWeek=hearing.dueWeek;assert.equal(resolveCriminalChoice(s,{id:'criminal_hearing'},'accept',hearing),true);hearing.status='resolved';const outcome=s.openCases.find(c=>c.id==='criminal-verdict-'+id);s.time.absoluteWeek=outcome.dueWeek;assert.equal(resolveCriminalChoice(s,{id:'criminal_verdict'},'acknowledge',outcome),true);outcome.status='resolved';return source;}
for(const version of[5,6])test(`V${version} only repeated final verdict creates custody; work gates and release share existing rules`,()=>{
 let s=createNewGame({seed:17});s.meta.saveVersion=version;s=migrateState(s).state;s.events.active=null;s.events.queue=[];verdict(s,'first');assert.equal(isServingCriminalSentence(s),false);verdict(s,'second');s=reload(s);const cash=s.finances.balance,debt=structuredClone(s.wealth.debts),until=s.flags.criminalJustice.custody.untilWeek;
 assert.equal(isServingCriminalSentence(s),true);assert.equal(isDetained(s),true);assert.equal(getWeeklyLifeLoad(s).load,0);assert.equal(getMonthlyEmploymentIncome(s),0);assert.equal(applyDecision(s,'study').ok,false);
 s.time.absoluteWeek=until-1;assert.equal(processCriminalSentenceWeek(s),'');s=reload(s);s.time.absoluteWeek=until;assert.equal(isServingCriminalSentence(s),false);assert.ok(processCriminalSentenceWeek(s));assert.equal(processCriminalSentenceWeek(s),'');assert.ok(getWeeklyLifeLoad(s).load>0);assert.ok(getMonthlyEmploymentIncome(s)>0);assert.equal(criminalRecords(s).length,2);assert.equal(s.finances.balance,cash);assert.deepEqual(s.wealth.debts,debt);assert.equal(s.meta.saveVersion,6);
});
test('a pending accepted job is deferred through custody without losing its source or starting in prison',()=>{
 const s=createNewGame({seed:17});s.events.active=null;s.events.queue=[];verdict(s,'one');const source={id:'two',type:'risk-dosya',createdWeek:s.time.absoluteWeek,dueWeek:s.time.absoluteWeek+6,status:'pending',payload:{kind:'kavga'}};s.openCases.push(source);openCriminalHearing(s,source);const hearing=s.openCases.find(c=>c.id==='criminal-hearing-two');s.time.absoluteWeek=hearing.dueWeek;resolveCriminalChoice(s,{id:'criminal_hearing'},'accept',hearing);s.time.absoluteWeek++;
 s.career.jobId=null;assert.equal(acceptJobOffer(s,'market').ok,true);const id=s.career.pendingJob.caseId;s.career.pendingJob.startWeek=s.time.absoluteWeek;const job=s.openCases.find(c=>c.id===id);job.status='triggered';s.events.queue.push({eventId:'job_start',sourceCaseId:id,occurrenceId:'job-ready'});
 const outcome=s.openCases.find(c=>c.id==='criminal-verdict-two');resolveCriminalChoice(s,{id:'criminal_verdict'},'acknowledge',outcome);assert.equal(s.career.pendingJob.caseId,id);assert.equal(s.career.pendingJob.startWeek,s.flags.criminalJustice.custody.untilWeek);assert.equal(job.status,'pending');assert.equal(s.events.queue.some(e=>e.sourceCaseId===id),false);assert.equal(completePendingJob(s,id),false);
 s.time.absoluteWeek=s.flags.criminalJustice.custody.untilWeek;processCriminalSentenceWeek(s);assert.equal(completePendingJob(s,id),true);assert.equal(criminalJobDelay(s),0);assert.equal(criminalRecords(s).length,2);
});
test('detention and malformed custody cannot masquerade as a final sentence',()=>{const s=createNewGame();s.flags.risk={detainedUntil:s.time.absoluteWeek+2};assert.equal(isServingCriminalSentence(s),false);s.flags.criminalJustice={version:1,records:[],custody:{sourceCaseId:'unproven',startWeek:1,untilWeek:3}};assert.equal(isServingCriminalSentence(s),false);assert.equal(criminalRecords(s).length,0);});

test('real custody weeks pause observed service and release restores the ordinary work path',()=>{
 let s=migrateState(createNewGame({seed:17})).state;s.events.active=null;s.events.queue=[];if(s.world?.scenario)s.world.scenario.pendingEvent=null;s.finances.balance=20000;verdict(s,'one');verdict(s,'two');
 const before=s.flags.socialInsurance?.coveredWeeks||0;
 for(let i=0;i<2;i++){settleHouseholdEvents(s);assert.equal(advanceWeek(s).ok,true);s=reload(s);assert.equal(s.flags.socialInsurance?.coveredWeeks||0,before);}
 assert.equal(isServingCriminalSentence(s),false);assert.equal(criminalRecords(s).length,2);assert.ok(getMonthlyEmploymentIncome(s)>0);
});
