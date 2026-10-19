import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame,SAVE_VERSION,validateState} from '../public/games/tc-sim/js/state.js';
import {riskFight,beginDetention} from '../public/games/tc-sim/js/risk-layer.js';
import {criminalRecords,criminalJobDelay,openCriminalHearing,resolveCriminalChoice} from '../public/games/tc-sim/js/criminal-justice.js';
import {processDueOpenCases,activateNextEvent,resolveEvent} from '../public/games/tc-sim/js/events.js';
import {claimOf,openIcraNotice,payIcra} from '../public/games/tc-sim/js/icra.js';
import {acceptJobOffer,completePendingJob,getJobById} from '../public/games/tc-sim/js/life.js';
import {migrateState,saveGame,loadGame} from '../public/games/tc-sim/js/save.js';
import {settleHouseholdEvents} from './tc-sim-longrun.mjs';
const reload=s=>{const m=new Map(),storage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};assert.equal(saveGame(storage,s).ok,true);const r=loadGame(storage);assert.equal(r.ok,true);return r.state;};
const fresh=version=>{let s=createNewGame({seed:17});s.meta.saveVersion=version;s=migrateState(s).state;s.events.active=null;s.events.queue=[];if(s.world?.scenario)s.world.scenario.pendingEvent=null;s.health.stress=60;s.finances.balance=20000;return s;};
function due(s,week){settleHouseholdEvents(s);s.time.absoluteWeek=week;processDueOpenCases(s);activateNextEvent(s);}
for(const version of[5,6])for(const review of[false,true])test(`V${version} ${review?'review':'ordinary'} verdict preserves source-linked fine and applies social/job consequence exactly once`,()=>{
 let s=fresh(version);assert.equal(riskFight(s).ok,true);const source=s.openCases.find(c=>c.payload?.kind==='kavga');const cash=s.finances.balance;const trust=s.people.find(p=>p.id==='anne').social.trust;assert.equal(criminalRecords(s).length,0);
 due(s,source.createdWeek+4);assert.equal(s.events.active.eventId,'criminal_hearing');assert.equal(resolveEvent(s,review?'review':'accept').ok,true);assert.equal(criminalRecords(s).length,0);
 s=reload(s);const child=s.openCases.find(c=>c.eventId==='criminal_verdict');s.time.absoluteWeek=source.dueWeek;assert.equal(claimOf(s),null,'review is not a payable criminal fine');due(s,Math.max(s.time.absoluteWeek,child.dueWeek));assert.equal(s.events.active.eventId,'criminal_verdict');assert.equal(resolveEvent(s,'acknowledge').ok,true);
 assert.equal(criminalRecords(s).length,1);assert.equal(criminalJobDelay(s),1);assert.equal(s.people.find(p=>p.id==='anne').social.trust,trust-4);assert.equal(s.finances.balance,cash);assert.equal(validateState(s).ok,true);
 s=reload(s);assert.equal(resolveCriminalChoice(s,{id:'criminal_verdict'},'acknowledge',child),false);assert.equal(criminalRecords(s).length,1);
 const claim=claimOf(s);assert.equal(claim.sourceCaseId,source.id);assert.equal(claim.amount,1500);openIcraNotice(s,claim);assert.equal(payIcra(s).ok,true);assert.equal(s.finances.balance,cash-1500);assert.equal(claimOf(s),null);assert.equal(s.openCases.find(c=>c.id===source.id).status,"resolved");assert.equal(criminalRecords(reload(s)).length,1);assert.equal(SAVE_VERSION,6);
});
test('detention and old/health/police files never create inferred convictions',()=>{const s=fresh(6);beginDetention(s,2,'Test');assert.equal(criminalRecords(reload(s)).length,0);for(const kind of['gozalti','saglik','polis','madde'])assert.equal(openCriminalHearing(s,{id:kind,type:'risk-dosya',payload:{kind}}),false);assert.equal(criminalJobDelay(s),0);});
test('unverified evidence creates no conviction or new fine',()=>{const s=fresh(6);riskFight(s);const source=s.openCases.find(c=>c.payload?.kind==='kavga');source.payload.justice.evidence.confirmedFight=false;due(s,5);resolveEvent(s,'review');due(s,7);assert.equal(resolveEvent(s,'acknowledge').ok,true);assert.equal(criminalRecords(s).length,0);assert.equal(claimOf(s),null);assert.equal(source.payload.justice.stage,'cleared');});
test('successful new employment restores ordinary opportunities without deleting the record',()=>{
 const s=fresh(6);riskFight(s);due(s,5);resolveEvent(s,'accept');due(s,6);resolveEvent(s,'acknowledge');settleHouseholdEvents(s);s.weekly={used:0,selectedIds:[]};s.career.jobId=null;
 assert.equal(acceptJobOffer(s,'market').ok,true);const pending=structuredClone(s.career.pendingJob);assert.equal(pending.startWeek,s.time.absoluteWeek+2);s.time.absoluteWeek=pending.startWeek;assert.equal(completePendingJob(s,pending.caseId),true);assert.equal(criminalJobDelay(s),0);assert.equal(criminalRecords(s).length,1);assert.equal(criminalRecords(reload(s))[0].reentryWeek,s.time.absoluteWeek);assert.ok(getJobById(s.career.jobId));
});

test('hearing cannot be resolved early or against a different source child',()=>{const s=fresh(6);riskFight(s);const child=s.openCases.find(c=>c.type==='criminal-hearing');assert.equal(resolveCriminalChoice(s,{id:'criminal_hearing'},'accept',child),false);assert.equal(criminalRecords(s).length,0);});
