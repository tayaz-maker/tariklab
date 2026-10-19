import test from "node:test";
import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";
import {createNewGame,validateState} from "../public/games/tc-sim/js/state.js";
import {advanceWeek,applyDecision,canApplyDecision} from "../public/games/tc-sim/js/time.js";
import {resolveScenarioChoice} from "../public/games/tc-sim/js/historical-scenarios.js";
import {takeCredit,startBusiness} from "../public/games/tc-sim/js/bank-business.js";
import {saveGame,loadGame} from "../public/games/tc-sim/js/save.js";
import {setRomanticInterest,becomePartner} from "../public/games/tc-sim/js/social.js";
import {endEmployment} from "../public/games/tc-sim/js/life.js";
import {buyProperty,netWorth} from "../public/games/tc-sim/js/wealth.js";
import {settleHouseholdEvents} from "./tc-sim-longrun.mjs";
class Storage {data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
const reports=[];
function run(profile,seed,target){
 let s=createNewGame({eraId:"1999-04-18",seed});s.finances.balance=50000;
 // Starting profiles only. During play no cash, health, event or clock resets.
 if(profile==="low")s.career.jobId=null;
 if(profile==="family"){
  s.relationships.elif=90;const p=s.people.find(p=>p.id==="elif");p.social.trust=90;p.social.tension=0;
  assert.ok(setRomanticInterest(s,"elif"));assert.ok(becomePartner(s,"elif"));
  s.household.homeId="shared";s.household.livingWithFamily=false;
  s.household.union.marriedSince=s.time.absoluteWeek;s.household.union.cohabitingSince=s.time.absoluteWeek;
 }
 function settle(){
  if(s.world?.scenario?.pendingEvent)assert.ok(resolveScenarioChoice(s,"rest").ok);
  settleHouseholdEvents(s);
 }
 settle();
 if(profile==="entrepreneur")assert.ok(startBusiness(s,"repair").ok);
 if(profile==="indebted")assert.ok(takeCredit(s,"small").ok);
 assert.equal(validateState(s).ok,true,"initial profile must be valid");
 const storage=new Storage();let weeks=0,receipts=0,events=0;
 while(weeks<target&&!s.lifetime?.death&&!s.world?.scenario?.completed){
  settle();
  if(canApplyDecision(s,"rest").ok)assert.ok(applyDecision(s,"rest").ok);
  settle();const previous=s.finances.lastMonthClose;
  const step=advanceWeek(s);assert.ok(step.ok,JSON.stringify(step));weeks++;
  assert.equal(validateState(s).ok,true,`${profile}/${seed}/${weeks}`);
  assert.ok(Number.isSafeInteger(netWorth(s).total));
  const r=s.finances.lastMonthClose;
  if(r&&r!==previous){assert.equal(r.closingBalance-r.openingBalance,r.inflow-r.outflow+r.adjustments+r.otherChange);assert.ok(r.debtPayments<=r.outflow);receipts++;}
  assert.ok(s.flags.socialInsurance.coveredWeeks<=weeks);
  if(weeks%13===0){const before=JSON.stringify(s);assert.ok(saveGame(storage,s).ok);const loaded=loadGame(storage);assert.ok(loaded.ok);assert.equal(loaded.state.finances.balance,s.finances.balance);assert.deepEqual(loaded.state.wealth.debts,s.wealth.debts);assert.deepEqual(loaded.state.flags.socialInsurance,s.flags.socialInsurance);assert.equal(JSON.stringify(s),before);s=loaded.state;}
  events=s.events.history.length;
 }
 const r={profile,seed,weeks,target,date:s.time.date,requestedDuration:weeks===target?"COMPLETE":"TERMINAL_REVIEW_REQUIRED",reason:s.lifetime?.death?"death":s.world?.scenario?.completed?"historical-end":null,cash:s.finances.balance,netWorth:netWorth(s).total,arrears:s.finances.arrears,debt:s.wealth.debts.reduce((n,d)=>n+d.principal+(d.mortgage?.interestDue||0),0),observedWeeks:s.flags.socialInsurance.coveredWeeks,receipts,retainedEventHistory:events,saveVersion:s.meta.saveVersion};reports.push(r);return r;
}
for(const profile of ["low","middle","entrepreneur","indebted","family"])for(const seed of [7,17,28])test(`actual finance timeline 720 weeks: ${profile}, seed ${seed}`,()=>{assert.equal(run(profile,seed,720).requestedDuration,"COMPLETE");});
test("25 game years is 1200 decision weeks with the canonical four-week month",()=>{
 const r=run("middle",28,1200);
 // A terminal outcome is reported explicitly, not passed off as 25 years.
 assert.equal(r.requestedDuration,"COMPLETE");assert.ok(r.date.startsWith("2024-"));
});
test("real job-loss timeline reaches mortgage enforcement without deleting living-cost arrears",()=>{
 const s=createNewGame({eraId:"1999-04-18",seed:17});s.finances.balance=150000;
 const settle=()=>{if(s.world?.scenario?.pendingEvent)assert.ok(resolveScenarioChoice(s,"rest").ok);settleHouseholdEvents(s);};
 settle();assert.ok(buyProperty(s,"owner",true).ok);assert.ok(endEmployment(s).ok);
 let weeks=0;
 while(s.wealth.properties.length&&weeks<96){settle();if(canApplyDecision(s,"rest").ok)assert.ok(applyDecision(s,"rest").ok);settle();assert.ok(advanceWeek(s).ok);weeks++;assert.equal(validateState(s).ok,true);}
 assert.equal(s.wealth.properties.length,0,"defaulted collateral must not be starved by recurring living-cost arrears");
 const file=s.openCases.find(c=>c.payload?.source==="mortgage"&&c.payload.stage==="foreclosed");
 assert.ok(file);assert.equal(s.wealth.debts.length,0);assert.ok(file.payload.settlement.interestAccrued>0);
 reports.push({profile:"job-loss-mortgage",seed:17,weeks,date:s.time.date,requestedDuration:"COMPLETE",settlement:file.payload.settlement,cash:s.finances.balance,arrears:s.finances.arrears,saveVersion:s.meta.saveVersion});
});
test.after(()=>{if(process.env.TC_FINANCE_ACCEPTANCE_REPORT)writeFileSync(process.env.TC_FINANCE_ACCEPTANCE_REPORT,JSON.stringify({scope:"Real advanceWeek + real event choices; initial profile fixtures only. Terminal runs are not full-duration acceptance.",reports},null,2)+"\n");});
