import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, SAVE_VERSION, validateState, transact } from "../public/games/tc-sim/js/state.js";
import { buyProperty, sellProperty, netWorth, processWealthMonthEnd, manageMortgage, getWealthMonthlySummary, normalizeWealth } from "../public/games/tc-sim/js/wealth.js";
import { amortizedPayment, newMortgage, debtBalance, mortgageDue, mortgageStatus, settleMortgageMonth, validMortgage, mortgageText } from "../public/games/tc-sim/js/mortgage.js";
import { bankRecord } from "../public/games/tc-sim/js/bank-record.js";
import { migrateState, saveGame, loadGame } from "../public/games/tc-sim/js/save.js";
import { closeMonthlyCash } from "../public/games/tc-sim/js/monthly-cash.js";
const game = () => { const s = createNewGame({seed:17}); s.finances.balance=1000000; s.events.active=null; s.events.queue=[]; return s; };
const loan = () => ({id:"test",type:"mortgage",principal:336000,monthlyPayment:3731,mortgage:newMortgage(336000)});
const nextMonth = s => { s.time.absoluteWeek += 4; s.weekly = {used:0,selectedIds:[]}; };
class Storage { data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);} }

test("known annuity quote and 120 integer installments conserve principal, interest and cash",()=>{
 assert.equal(amortizedPayment(336000,50,120),3731);
 assert.equal(amortizedPayment(1200,0,12),100);
 const d=loan();let paid=0;
 for(let i=0;i<120;i++){
  const before=debtBalance(d),r=settleMortgageMonth(d,1000000,i);paid+=r.payment;
  assert.equal(debtBalance(d),before+r.interest-r.payment);
  assert.ok(validMortgage(d));
  assert.equal(settleMortgageMonth(d,1000000,i),null);
 }
 assert.equal(d.principal,0);assert.equal(d.mortgage.interestDue,0);
 assert.equal(d.mortgage.principalPaid,336000);assert.equal(d.mortgage.interestPaid,111610);
 assert.equal(paid,447610);
});
test("30% down creates one asset and one principal liability; future interest is not charged upfront",()=>{
 const s=game(),before=netWorth(s).total;assert.ok(buyProperty(s,"owner",true).ok);
 assert.equal(s.finances.balance,856000);assert.equal(s.wealth.debts[0].principal,336000);
 assert.equal(s.wealth.debts[0].monthlyPayment,3731);assert.equal(netWorth(s).total,before);
 assert.equal(getWealthMonthlySummary(s).debt,3731);
 const cash=s.finances.balance;processWealthMonthEnd(s);
 const d=s.wealth.debts[0];assert.equal(d.principal,333949);assert.equal(d.mortgage.interestPaid,1680);
 assert.equal(s.finances.balance,cash-1000-3731);
 const settled=structuredClone(s);assert.equal(processWealthMonthEnd(s),false);assert.deepEqual(s,settled);
});
test("unfunded installments never reduce principal and three consecutive misses become default",()=>{
 const s=game();assert.ok(buyProperty(s,"owner",true).ok);
 for(let i=0;i<3;i++){s.finances.balance=0;processWealthMonthEnd(s);if(i<2)nextMonth(s);}
 const d=s.wealth.debts[0];assert.equal(d.principal,336000);
 assert.equal(d.mortgage.interestDue,5040);assert.equal(d.mortgage.overdue,11193);
 assert.equal(mortgageStatus(d),"default");assert.equal(bankRecord(s).default,1);
 assert.equal(netWorth(s).debt,341040);assert.ok(validMortgage(d));
});
test("rolling underfunded payments cannot reset the consecutive-miss counter",()=>{
 const d=loan();settleMortgageMonth(d,0,0);settleMortgageMonth(d,4000,1);settleMortgageMonth(d,4000,2);
 assert.equal(d.mortgage.missedMonths,3);assert.equal(mortgageStatus(d),"default");assert.ok(validMortgage(d));
});
test("extra payment and full early payoff preserve net worth and never charge unearned future interest",()=>{
 const s=game();buyProperty(s,"owner",true);const id=s.wealth.debts[0].id;nextMonth(s);
 let worth=netWorth(s).total,balance=s.finances.balance;
 assert.ok(manageMortgage(s,id,"mortgage-extra").ok);
 assert.equal(s.finances.balance,balance-5000);assert.equal(s.wealth.debts[0].principal,331000);
 assert.equal(netWorth(s).total,worth);assert.equal(manageMortgage(s,id,"mortgage-extra").ok,false);
 nextMonth(s);worth=netWorth(s).total;balance=s.finances.balance;
 assert.ok(manageMortgage(s,id,"mortgage-close").ok);assert.equal(s.finances.balance,balance-331000);
 assert.equal(netWorth(s).total,worth);assert.equal(s.wealth.debts.length,0);
 assert.equal(manageMortgage(s,id,"mortgage-close").ok,false);
});
test("restructuring reschedules once without forgiving accrued interest or capitalizing it",()=>{
 const s=game();buyProperty(s,"owner",true);s.finances.balance=0;processWealthMonthEnd(s);nextMonth(s);
 const id=s.wealth.debts[0].id,owed=debtBalance(s.wealth.debts[0]),cash=s.finances.balance;
 assert.ok(manageMortgage(s,id,"mortgage-restructure").ok);
 let d=s.wealth.debts[0];assert.equal(debtBalance(d),owed);assert.equal(s.finances.balance,cash);
 assert.equal(d.principal,336000);assert.equal(d.mortgage.interestDue,1680);assert.equal(d.mortgage.monthsLeft,179);
 assert.equal(d.mortgage.overdue,0);assert.equal(mortgageStatus(d),"restructured");assert.ok(validMortgage(d));
 nextMonth(s);assert.equal(manageMortgage(s,id,"mortgage-restructure").ok,false);
 s.finances.balance=100000;processWealthMonthEnd(s);d=s.wealth.debts[0];
 assert.equal(d.mortgage.interestAccrued,3360,"past unpaid interest never earns interest");assert.ok(validMortgage(d));
});
test("property sale settles remaining principal AND accrued interest exactly once",()=>{
 const s=game();buyProperty(s,"owner",true);s.finances.balance=0;processWealthMonthEnd(s);
 const p=s.wealth.properties[0],owed=debtBalance(s.wealth.debts[0]),cash=s.finances.balance,worth=netWorth(s).total;
 assert.ok(sellProperty(s,p.id).ok);assert.equal(s.finances.balance,cash+p.currentValue-owed);
 assert.equal(netWorth(s).total,worth);assert.equal(s.wealth.debts.length,0);
 assert.equal(sellProperty(s,p.id).ok,false);
});
test("V5/V6 legacy zero-interest mortgages retain their original payment and never gain invented interest",()=>{
 for(const version of [5,6]){
  const s=game();s.meta.saveVersion=version;s.wealth.debts=[{id:"legacy",type:"mortgage",principal:336000,monthlyPayment:2800,linkedAssetId:null,startWeek:1}];
  const m=migrateState(s);assert.ok(m.ok);assert.equal(m.state.wealth.debts[0].mortgage,undefined);
  processWealthMonthEnd(m.state);assert.equal(m.state.wealth.debts[0].principal,333200);
  assert.equal(m.state.wealth.debts[0].monthlyPayment,2800);assert.equal(SAVE_VERSION,6);
 }
});
test("new optional V6 contracts round-trip without replaying interest or payment; unknown versions fail closed",()=>{
 const s=game();buyProperty(s,"owner",true);s.finances.balance=0;processWealthMonthEnd(s);
 const store=new Storage();assert.ok(saveGame(store,s).ok);const loaded=loadGame(store);assert.ok(loaded.ok);
 const before=structuredClone(loaded.state);assert.equal(processWealthMonthEnd(loaded.state),false);
 assert.deepEqual(loaded.state,before);assert.ok(validateState(loaded.state).ok);
 const bad=structuredClone(before);bad.wealth.debts[0].mortgage.version=2;
 assert.equal(migrateState(bad).ok,false);
 normalizeWealth(bad);assert.equal(debtBalance(bad.wealth.debts[0]),337680,"unsupported contract cannot lose accrued interest");
});
test("month-close debt report includes accrued interest, while debt cash payments include only actual paid cash",()=>{
 const s=game();buyProperty(s,"owner",true);s.finances.balance=0;processWealthMonthEnd(s);
 s.time.month=s.time.month===12?1:s.time.month+1;if(s.time.month===1)s.time.year++;
 const close=closeMonthlyCash(s);assert.equal(close.creditArrears,337680);
 assert.equal(close.debtPayments,0);assert.equal(mortgageDue(s.wealth.debts[0]),7462);
});
test("720 weekly wealth settlements across income profiles retain every actual interest/principal liability",()=>{
 for(const income of [0,2000,5000,12000,20000]){
  const s=game();buyProperty(s,"owner",true);s.finances.balance=0;
  for(let week=1;week<=720;week++){
   s.time.absoluteWeek=week;
   if((week-1)%4===0)transact(s,income,"Test profile income","income");
   const before=s.wealth.debts.reduce((n,d)=>n+debtBalance(d),0);
   const priorInterest=s.wealth.debts[0]?.mortgage.interestAccrued||0;
   const balance=s.finances.balance;
   if(processWealthMonthEnd(s)){
    const d=s.wealth.debts[0];if(d){assert.ok(validMortgage(d));assert.equal(debtBalance(d),before+d.mortgage.interestAccrued-priorInterest-(balance-s.finances.balance-1000));}
   }
  }
  assert.ok(validateState(s).ok);
 }
});
test("TR/EN/PL mortgage terms explicitly distinguish modeled rates from actual bank offers",()=>{
 for(const lang of ["tr","en","pl"]){assert.match(mortgageText("note",lang),/120/);assert.match(mortgageText("note",lang),/0[,.]50/);assert.ok(mortgageText("default",lang));}
});

test("restructured integer schedule fully amortizes without a hidden final balloon or interest on interest", async()=>{
 const {restructureMortgage}=await import("../public/games/tc-sim/js/mortgage.js");
 const d=loan();for(let i=0;i<3;i++)settleMortgageMonth(d,0,i);
 const owed=debtBalance(d),interestBefore=d.mortgage.interestAccrued;
 assert.ok(restructureMortgage(d));const term=d.mortgage.monthsLeft,payment=d.monthlyPayment;
 let paid=0;
 for(let i=0;i<term;i++){
  const r=settleMortgageMonth(d,payment,3+i);paid+=r.payment;
  assert.ok(r.required<=payment,"fully funded plan has no balloon above the agreed installment");
  assert.ok(validMortgage(d));
 }
 assert.equal(debtBalance(d),0);
 assert.equal(paid,owed+d.mortgage.interestAccrued-interestBefore);
});
