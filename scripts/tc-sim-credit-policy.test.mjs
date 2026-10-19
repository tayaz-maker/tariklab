import test from "node:test";
import assert from "node:assert/strict";
import {createNewGame,SAVE_VERSION} from "../public/games/tc-sim/js/state.js";
import {bankCreditPolicy,bankRecord,recordBankMonth} from "../public/games/tc-sim/js/bank-record.js";
import {creditAvailability,takeCredit,repayCredit} from "../public/games/tc-sim/js/bank-business.js";
import {buyProperty,processWealthMonthEnd,getWealthActionAvailability} from "../public/games/tc-sim/js/wealth.js";
import {migrateState} from "../public/games/tc-sim/js/save.js";
const game=()=>{const s=createNewGame({seed:17});s.events.active=null;s.events.queue=[];s.finances.balance=1000000;return s;};
const next=s=>{s.time.absoluteWeek+=4;s.weekly={used:0,selectedIds:[]};};
test("clean V5/V6 saves retain neutral eligibility without invented credit history",()=>{
 for(const version of [5,6]){const s=game();s.meta.saveVersion=version;const m=migrateState(s);assert.ok(m.ok);const before=structuredClone(m.state);assert.deepEqual(bankCreditPolicy(m.state,"mortgage"),{ok:true});assert.deepEqual(m.state,before);assert.equal(bankRecord(m.state).score,null);assert.equal(SAVE_VERSION,6);}
});
test("actual arrears and open positive icra claims block new loans without changing cash or forgiving claims",()=>{
 for(const kind of ["arrears","icra"]){const s=game();if(kind==="arrears")s.finances.arrears=4000;else s.openCases.push({id:"icra-check",type:"icra",status:"pending",payload:{owed:4000}});
  const before=structuredClone(s);assert.equal(bankCreditPolicy(s,"small").ok,false);assert.deepEqual(s,before);
  assert.equal(takeCredit(s,"small").ok,false);assert.equal(buyProperty(s,"owner",true).ok,false);assert.equal(s.finances.balance,before.finances.balance);assert.equal(s.wealth.debts.length,0);
  if(kind==="arrears")assert.equal(s.finances.arrears,4000);else assert.equal(s.openCases[0].payload.owed,4000);
 }
});
test("zero/closed claims do not create a false credit ban",()=>{
 const s=game();s.openCases=[{type:"icra",status:"pending",payload:{owed:0,amount:4000}},{type:"icra",status:"closed",payload:{owed:4000}}];assert.equal(bankCreditPolicy(s,"mortgage").ok,true);
});
test("low score limits larger borrowing but leaves a funded small-loan rehabilitation path",()=>{
 const s=game();recordBankMonth(s,"default");assert.equal(bankRecord(s).score,38);
 assert.equal(bankCreditPolicy(s,"small").ok,true);assert.equal(bankCreditPolicy(s,"medium").ok,false);
 assert.equal(creditAvailability(s,"medium").ok,false);assert.equal(buyProperty(s,"owner",true).ok,false);
 assert.equal(getWealthActionAvailability(s,"property-owner","mortgage").ok,false);
 assert.equal(getWealthActionAvailability(s,"property-owner","cash").ok,true,"cash purchases are not a loan");
 next(s);assert.ok(takeCredit(s,"small").ok);processWealthMonthEnd(s);assert.equal(bankRecord(s).score,40);
 next(s);assert.ok(repayCredit(s).ok);next(s);assert.equal(bankCreditPolicy(s,"mortgage").ok,true);assert.ok(buyProperty(s,"owner",true).ok);
});
test("mortgage delinquency gates new personal borrowing without interfering with existing repayment/restructuring",()=>{
 const s=game();assert.ok(buyProperty(s,"owner",true).ok);s.finances.balance=0;processWealthMonthEnd(s);next(s);
 assert.equal(s.wealth.debts[0].mortgage.overdue,3731);assert.equal(creditAvailability(s,"small").ok,false);
 assert.equal(getWealthActionAvailability(s,"mortgage-restructure",s.wealth.debts[0].id).ok,true);
});
test("policy explanations are authored TR/EN/PL and expose a fictional game threshold",()=>{
 const s=game();recordBankMonth(s,"default");for(const language of ["tr","en","pl"]){const r=bankCreditPolicy(s,"mortgage",language);assert.equal(r.ok,false);assert.match(r.reason,/40/);if(language!=="tr")assert.doesNotMatch(r.reason,/kredi puanı|Oyun kuralı/);}
});

test("new mortgages use actual regular income and all existing monthly loan commitments",()=>{
 const s=game();s.career.jobId=null;s.finances.otherMonthlyIncome=0;
 assert.equal(getWealthActionAvailability(s,"property-owner","mortgage").ok,false);
 const cash=s.finances.balance;assert.equal(buyProperty(s,"owner",true).ok,false);assert.equal(s.finances.balance,cash);
 const loaded=game();loaded.wealth.debts.push({id:"existing",type:"personal",principal:20000,monthlyPayment:1500,linkedAssetId:null,startWeek:1});
 assert.equal(getWealthActionAvailability(loaded,"property-owner","mortgage").ok,false);
 assert.equal(buyProperty(loaded,"owner",true).ok,false);
 assert.equal(getWealthActionAvailability(loaded,"property-owner","cash").ok,true);
});
