import test from "node:test";
import assert from "node:assert/strict";
import {createNewGame,transact,validateState,SAVE_VERSION} from "../public/games/tc-sim/js/state.js";
import {openIcraNotice,startWageCollection,collectWageDebt,payIcra,objectIcra} from "../public/games/tc-sim/js/icra.js";
import {advanceWeek} from "../public/games/tc-sim/js/time.js";
import {getMonthlyEmploymentIncome} from "../public/games/tc-sim/js/life.js";
import {netWorth} from "../public/games/tc-sim/js/wealth.js";
import {saveGame,loadGame,migrateState} from "../public/games/tc-sim/js/save.js";
class Storage {data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
function game(){const s=createNewGame({seed:11,now:"2027-01-01T00:00:00.000Z"});s.career.jobId="market";s.finances.balance=100000;s.finances.arrears=10000;s.events.active=null;s.events.queue=[];return s;}
function order(s){const f=openIcraNotice(s,{source:"temerrut",amount:4000});assert.ok(startWageCollection(s).ok);return f;}

test("wage order costs no cash, waits for notice and rejects unsupported/replayed arrangements",()=>{
 const s=game(),cash=s.finances.balance,f=order(s);assert.equal(s.finances.balance,cash);
 assert.equal(collectWageDebt(s,9000),0);assert.equal(f.payload.owed,4000);
 const snap=structuredClone(s);assert.equal(startWageCollection(s).ok,false);assert.deepEqual(s,snap);
 for(const kind of ["aile","mortgage"]){const t=game();if(kind==="aile")t.career.jobId=null;openIcraNotice(t,{source:kind,amount:4000});assert.equal(startWageCollection(t).ok,false);}
});
test("actual salary collection conserves net worth, unrelated arrears and receipt subtotals; reload cannot replay",()=>{
 let s=game();const f=order(s);f.dueWeek=s.time.absoluteWeek;
 transact(s,9000,"Aylık maaş","income");const worth=netWorth(s).total,cash=s.finances.balance;
 assert.equal(collectWageDebt(s,9000),1800);assert.equal(s.finances.balance,cash-1800);
 assert.equal(s.finances.arrears,8200);assert.equal(f.payload.owed,2200);assert.equal(netWorth(s).total,worth);
 assert.equal(s.finances.monthCash.debtPayments,1800);assert.equal(s.finances.monthCash.outflow,1800);
 const storage=new Storage();assert.ok(saveGame(storage,s).ok);s=loadGame(storage).state;
 assert.equal(collectWageDebt(s,9000),0);assert.equal(s.finances.arrears,8200);
 s.time.month+=1;assert.equal(collectWageDebt(s,9000),1800);s.time.month+=1;
 assert.equal(collectWageDebt(s,9000),400);assert.equal(s.finances.arrears,6000);
 assert.equal(s.openCases[0].status,"resolved");assert.equal(s.openCases[0].payload.wage.paid,4000);
 assert.equal(collectWageDebt(s,9000),0);assert.equal(validateState(s).ok,true);
});
test("no income, no available cash, review and pension-only settlement cannot manufacture repayment",()=>{
 const s=game(),f=order(s);f.dueWeek=s.time.absoluteWeek;s.finances.balance=-500;
 assert.equal(collectWageDebt(s,9000),0);assert.equal(s.finances.balance,-500);assert.equal(f.payload.owed,4000);
 s.time.month+=1;s.finances.balance=100;assert.equal(collectWageDebt(s,0),0);
 assert.equal(collectWageDebt(s,9000),100);assert.equal(s.finances.balance,0);assert.equal(f.payload.owed,3900);
 const t=game();openIcraNotice(t,{source:"temerrut",amount:4000});assert.ok(objectIcra(t).ok);
 const snapshot=structuredClone(t);assert.equal(collectWageDebt(t,9000),0);assert.deepEqual(t,snapshot);
});
test("month-end salary hook posts full net pay once and records collection inside actual expenses",()=>{
 const s=game();s.finances.arrears=4000;const f=order(s);f.dueWeek=s.time.absoluteWeek;
 const salary=getMonthlyEmploymentIncome(s);assert.ok(salary>0);
 for(let i=0;i<4;i++){s.events.active=null;s.events.queue=[];assert.ok(advanceWeek(s).ok);}
 const r=s.finances.lastMonthClose;assert.ok(r);assert.ok(r.inflow>=salary);
 assert.equal(f.payload.wage.paid,Math.min(4000,Math.floor(salary/5)));
 assert.equal(r.debtPayments,f.payload.wage.paid);
 assert.equal(r.closingBalance-r.openingBalance,r.inflow-r.outflow+r.adjustments+r.otherChange);
 assert.equal(validateState(s).ok,true);
});
test("V5/V6 legacy notices do not acquire orders; active V6 order and early payoff survive save/load",()=>{
 for(const version of [5,6]){const s=game();openIcraNotice(s,{source:"temerrut",amount:4000});s.meta.saveVersion=version;
  const m=migrateState(s);assert.ok(m.ok);assert.equal(m.state.openCases[0].payload.wage,undefined);assert.equal(SAVE_VERSION,6);}
 const s=game();order(s);const storage=new Storage();assert.ok(saveGame(storage,s).ok);const t=loadGame(storage).state;
 assert.equal(t.openCases[0].payload.stage,"wage");assert.ok(payIcra(t).ok);
 const snap=structuredClone(t);assert.equal(collectWageDebt(t,9000),0);assert.deepEqual(t,snap);
});
