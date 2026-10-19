import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame,validateState,SAVE_VERSION} from '../public/games/tc-sim/js/state.js';
import {claimOf,openIcraNotice,payIcra,inspectIcraEvidence,hireIcraCounsel,objectIcra,appealIcra,processIcraWeek,recordIcraPayment} from '../public/games/tc-sim/js/icra.js';
import {saveGame,loadGame,migrateState} from '../public/games/tc-sim/js/save.js';
class Storage {data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
const game=()=>{const s=createNewGame({seed:7});s.finances.balance=10000;s.finances.arrears=4000;s.events.active=null;s.events.queue=[];return s;};
test('paid linked fine cannot generate another claim; risk case is retained',()=>{
 const s=game();s.finances.arrears=0;s.openCases=[{id:'fine-proof',type:'risk-dosya',createdWeek:0,dueWeek:0,status:'pending',payload:{kind:'kavga'}}];
 const claim=claimOf(s);assert.equal(claim.sourceCaseId,'fine-proof');const f=openIcraNotice(s,claim);
 assert.equal(f.payload.sourceCaseId,'fine-proof');assert.ok(payIcra(s).ok);assert.equal(s.finances.balance,8500);
 assert.equal(claimOf(s),null);assert.equal(s.openCases[0].status,'pending');assert.equal(s.openCases[0].payload.fineEnforced,true);
 const storage=new Storage();assert.ok(saveGame(storage,s).ok);assert.equal(claimOf(loadGame(storage).state),null);
});
test('source inspection is cash-neutral; counsel charges once and cannot waive valid debt',()=>{
 const s=game(),f=openIcraNotice(s,{source:'temerrut',amount:4000});
 assert.equal(hireIcraCounsel(s).ok,false);assert.ok(inspectIcraEvidence(s).ok);assert.equal(s.finances.balance,10000);
 assert.equal(f.payload.evidence.backing,4000);assert.equal(f.payload.evidence.claimed,4000);
 assert.ok(hireIcraCounsel(s).ok);assert.equal(s.finances.balance,9500);assert.equal(s.finances.arrears,4000);
 const snap=structuredClone(s);assert.equal(hireIcraCounsel(s).ok,false);assert.deepEqual(s,snap);
});
test('counsel enables one bounded extra review; live payment is not resurrected by final decision',()=>{
 const s=game(),f=openIcraNotice(s,{source:'temerrut',amount:4000});inspectIcraEvidence(s);hireIcraCounsel(s);
 assert.equal(appealIcra(s).ok,false);assert.ok(objectIcra(s).ok);s.time.absoluteWeek=f.dueWeek;processIcraWeek(s);
 assert.ok(appealIcra(s).ok);assert.equal(f.payload.stage,'court');recordIcraPayment(s,f,1000);
 s.time.absoluteWeek=f.dueWeek;processIcraWeek(s);assert.equal(f.payload.review.confirmedOwed,3000);assert.equal(f.payload.review.final,true);
 const snap=structuredClone(s);assert.equal(appealIcra(s).ok,false);assert.deepEqual(s,snap);assert.equal(s.finances.arrears,3000);
});
test('unaffordable counsel and late appeal are mutation-free; V5/V6 remain neutral and active support persists',()=>{
 const s=game(),f=openIcraNotice(s,{source:'temerrut',amount:4000});inspectIcraEvidence(s);s.finances.balance=499;
 const snap=structuredClone(s);assert.equal(hireIcraCounsel(s).ok,false);assert.deepEqual(s,snap);
 s.finances.balance=10000;hireIcraCounsel(s);objectIcra(s);const storage=new Storage();assert.ok(saveGame(storage,s).ok);
 const t=loadGame(storage).state;assert.equal(t.openCases[0].payload.counsel.fee,500);assert.equal(t.meta.saveVersion,6);assert.equal(validateState(t).ok,true);
 for(const v of [5,6]){const old=game();openIcraNotice(old,{source:'temerrut',amount:4000});old.meta.saveVersion=v;const m=migrateState(old);assert.ok(m.ok);assert.equal(m.state.openCases[0].payload.counsel,undefined);}
 assert.equal(SAVE_VERSION,6);f.payload.review.status='confirmed';f.payload.stage='notice';s.time.absoluteWeek=f.dueWeek;assert.equal(appealIcra(s).ok,false);
});
