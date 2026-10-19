import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, validateState, SAVE_VERSION } from "../public/games/tc-sim/js/state.js";
import { applyWeeklyLifeLoad, getRetirementEligibility, getMonthlySummary } from "../public/games/tc-sim/js/life.js";
import { migrateState, saveGame, loadGame } from "../public/games/tc-sim/js/save.js";
import { startBusiness, processBusinessMonth, creditAvailability } from "../public/games/tc-sim/js/bank-business.js";
import { fiscalSocialSummary, renderFiscalSocialSummary } from "../public/games/tc-sim/js/social-insurance.js";
const game=()=>{const s=createNewGame({seed:17});s.finances.balance=100000;s.events.active=null;s.events.queue=[];return s;};
class Storage {data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
test("only completed eligible wage-job weeks gain prospective coverage, once across reload",()=>{
 let s=game();const money=s.finances.balance;applyWeeklyLifeLoad(s);
 assert.equal(s.flags.socialInsurance.coveredWeeks,1);applyWeeklyLifeLoad(s);
 assert.equal(s.flags.socialInsurance.coveredWeeks,1);
 const storage=new Storage();assert.ok(saveGame(storage,s).ok);s=loadGame(storage).state;
 applyWeeklyLifeLoad(s);assert.equal(s.flags.socialInsurance.coveredWeeks,1);
 s.time.absoluteWeek++;s.career.jobId="office";applyWeeklyLifeLoad(s);
 assert.equal(s.flags.socialInsurance.coveredWeeks,2);assert.equal(s.finances.balance,money);
 assert.equal(validateState(s).ok,true);assert.equal(SAVE_VERSION,6);
});
test("unemployment, detention, army, retirement and death do not fabricate covered weeks",()=>{
 for(const mode of ["unemployed","detained","army","retired","dead"]){
  const s=game();applyWeeklyLifeLoad(s);s.time.absoluteWeek++;
  if(mode==="unemployed")s.career.jobId=null;
  if(mode==="detained")s.flags.risk={detainedUntil:s.time.absoluteWeek+3};
  if(mode==="army")s.flags.askerlik={mode:"serving",until:s.time.absoluteWeek+3};
  if(mode==="retired"){s.career.jobId=null;s.career.retirement.status="retired";s.career.retirement.monthlyIncome=6000;}
  if(mode==="dead")s.lifetime={...(s.lifetime||{}),death:{week:s.time.absoluteWeek}};
  applyWeeklyLifeLoad(s);assert.equal(s.flags.socialInsurance.coveredWeeks,1,mode);
 }
});
test("720 completed weeks track actual catalog employment without payroll deductions or duplicate credit",()=>{
 const s=game();let expected=0;
 for(let i=0;i<720;i++){
  s.time.absoluteWeek=i+1;s.career.jobId=i%12<8?"market":null;
  if(s.career.jobId)expected++;
  applyWeeklyLifeLoad(s);applyWeeklyLifeLoad(s);
  assert.equal(s.flags.socialInsurance.coveredWeeks,expected);
 }
 assert.equal(s.finances.balance,100000);assert.equal(s.flags.socialInsurance.coveredWeeks,480);
});
test("V5/V6 migration does not infer contributions from experience or change pension entitlement",()=>{
 for(const v of [5,6]){
  const s=game();s.meta.saveVersion=v;s.player.age=65;s.player.birthDate=`${s.time.year-65}${s.time.date.slice(4)}`;s.career.jobFamilyExperience={hizmet:1000};
  delete s.flags.socialInsurance;const before=getRetirementEligibility(s).eligible;
  const result=migrateState(s);assert.ok(result.ok);const loaded=result.state;
  assert.equal(loaded.flags.socialInsurance.firstWeek,null);assert.equal(loaded.flags.socialInsurance.coveredWeeks,0);
  assert.equal(getRetirementEligibility(loaded).eligible,before);
  const storage=new Storage();assert.ok(saveGame(storage,loaded).ok);
  assert.deepEqual(loadGame(storage).state.flags.socialInsurance,loaded.flags.socialInsurance);
 }
 const bad=game();bad.flags.socialInsurance={version:2,coveredWeeks:500};
 assert.equal(migrateState(bad).ok,false,"unsupported record must not silently become a zero-history record");
});
test("actual business tax is reported once inside net cash flow; summaries never post a second tax",()=>{
 const s=game();assert.ok(startBusiness(s,"repair").ok);const before=s.finances.balance;
 processBusinessMonth(s);const result=s.flags.business.lastResult;
 assert.equal(result.tax,Math.round(Math.max(0,result.revenue-result.supply-result.wages-result.rent-result.operations-result.interest)*.2));
 assert.equal(result.net,result.revenue-result.expenses);assert.equal(s.finances.balance-before,result.net);
 assert.ok(result.tax>0);const snapshot=JSON.stringify(s);
 assert.equal(fiscalSocialSummary(s).businessTax,result.tax);getMonthlySummary(s);fiscalSocialSummary(s);
 assert.equal(JSON.stringify(s),snapshot);assert.equal(processBusinessMonth(s),"");assert.equal(s.finances.balance-before,result.net);
});
test("existing pension remains available to household and credit capacity without tax or SGK deductions",()=>{
 const s=game();s.career.jobId=null;s.career.retirement.status="retired";s.career.retirement.monthlyIncome=6000;
 assert.equal(getMonthlySummary(s).salary,0);assert.equal(getMonthlySummary(s).retirementIncome,6000);
 assert.equal(fiscalSocialSummary(s).pension,6000);assert.equal(creditAvailability(s,"small").ok,true);
 const before=s.finances.balance;applyWeeklyLifeLoad(s);assert.equal(s.finances.balance,before);
 assert.equal(s.flags.socialInsurance.coveredWeeks,0);
 for(const lang of ["tr","en","pl"]){const snapshot=JSON.stringify(s);const html=renderFiscalSocialSummary(s,String,lang);assert.match(html,/6000/);assert.match(html,/data-social-insurance/);assert.equal(JSON.stringify(s),snapshot);}
});


test("modeled service: four observed weeks give 30 days, linked contracts and no new cash deduction",()=>{
 let s=game();s.time.year=2027;const cash=s.finances.balance;
 for(let i=0;i<4;i++){s.time.weekOfMonth=i+1;s.time.absoluteWeek=i;applyWeeklyLifeLoad(s);}
 assert.equal(s.flags.socialInsurance.service.days,30);assert.equal(s.flags.socialInsurance.service.employers[0].id,"market");
 assert.equal(s.finances.balance,cash);applyWeeklyLifeLoad(s);assert.equal(s.flags.socialInsurance.service.days,30);
 const storage=new Storage();assert.ok(saveGame(storage,s).ok);s=loadGame(storage).state;
 applyWeeklyLifeLoad(s);assert.equal(s.flags.socialInsurance.service.days,30);
 s.time.absoluteWeek++;s.time.weekOfMonth=1;s.career.jobId="office";applyWeeklyLifeLoad(s);
 assert.equal(s.flags.socialInsurance.service.days,38);assert.equal(s.flags.socialInsurance.service.employers.length,2);
 s.time.absoluteWeek++;s.career.jobId=null;applyWeeklyLifeLoad(s);assert.equal(s.flags.socialInsurance.service.days,38);
 assert.equal(s.flags.socialInsurance.service.lastEmployer,null);assert.equal(validateState(s).ok,true);
});
test("service-day pension connection uses max not sum and keeps legacy earned eligibility",()=>{
 const s=game();s.player.age=60;s.career.jobFamilyExperience={hizmet:0};
 s.flags.socialInsurance.service={version:1,days:3600,lastEmployer:"market",employers:[{id:"market",days:3600}]};
 assert.equal(getRetirementEligibility(s).eligible,true);assert.equal(getRetirementEligibility(s).observedServiceDays,3600);
 s.flags.socialInsurance.service.days=1800;s.flags.socialInsurance.service.employers[0].days=1800;s.career.jobFamilyExperience.hizmet=240;
 assert.equal(getRetirementEligibility(s).eligible,false,"two overlapping histories are not added");
 s.career.jobFamilyExperience.hizmet=480;assert.equal(getRetirementEligibility(s).eligible,true);
 s.flags.socialInsurance.service=undefined;assert.equal(getRetirementEligibility(s).eligible,true);
});
test("unknown V5/V6 service stays zero; unsupported year/jobs do not invent days; future service rejected",()=>{
 for(const version of [5,6]){const s=game();s.meta.saveVersion=version;delete s.flags.socialInsurance.service;
  const m=migrateState(s);assert.ok(m.ok);assert.equal(m.state.flags.socialInsurance.service.days,0);}
 const s=game();s.time.year=1999;applyWeeklyLifeLoad(s);assert.equal(s.flags.socialInsurance.service.days,0);
 s.time.year=2027;s.time.absoluteWeek++;s.career.jobId="clerk_public";applyWeeklyLifeLoad(s);assert.equal(s.flags.socialInsurance.service.days,0);
 s.flags.socialInsurance.service={version:99};assert.equal(validateState(s).ok,false);
 s.flags.socialInsurance.service={version:1,days:0,lastEmployer:null,employers:[null]};assert.equal(validateState(s).ok,false);
 for(const lang of ["tr","en","pl"]){const t=game();assert.match(renderFiscalSocialSummary(t,String,lang),/data-insurance-service/);}
});
