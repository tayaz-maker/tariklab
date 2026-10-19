import test from "node:test";
import assert from "node:assert/strict";
import {createNewGame,validateState,SAVE_VERSION} from "../public/games/tc-sim/js/state.js";
import {buyProperty,manageMortgage,sellProperty,processWealthMonthEnd,netWorth} from "../public/games/tc-sim/js/wealth.js";
import {debtBalance,mortgageStatus} from "../public/games/tc-sim/js/mortgage.js";
import {claimOf,openIcraNotice,runHaciz,objectIcra,payIcra,planIcra,workaroundIcra,processIcraWeek} from "../public/games/tc-sim/js/icra.js";
import {getAvailableDecisions} from "../public/games/tc-sim/js/time.js";
import {migrateState,saveGame,loadGame} from "../public/games/tc-sim/js/save.js";
const next=s=>{s.time.absoluteWeek+=4;s.weekly={used:0,selectedIds:[]};};
function fixture(value=100000){const s=createNewGame({seed:17});s.events.active=null;s.events.queue=[];s.finances.balance=1000000;
 assert.ok(buyProperty(s,"owner",true).ok);
 for(let i=0;i<3;i++){s.finances.balance=0;processWealthMonthEnd(s);next(s);}
 s.finances.balance=0;s.wealth.properties[0].currentValue=value;
 assert.equal(mortgageStatus(s.wealth.debts[0]),"default");return s;}
const notice=s=>{const claim=claimOf(s);assert.equal(claim.source,"mortgage");return openIcraNotice(s,claim);};
class Storage {data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
test("default opens one backed claim, review suspends foreclosure, and debt is counted once",()=>{
 const s=fixture();const before=netWorth(s).total;const item=notice(s);
 assert.equal(item.payload.owed,debtBalance(s.wealth.debts[0]));assert.equal(netWorth(s).total,before);
 assert.equal(openIcraNotice(s,claimOf(s)),null);
 const snapshot=JSON.stringify(s);assert.equal(planIcra(s).ok,false);assert.equal(workaroundIcra(s).ok,false);
 assert.equal(JSON.stringify(s),snapshot);
 assert.equal(getAvailableDecisions(s).some(d=>["icra-installment","icra-workaround"].includes(d.id)),false);
 s.finances.balance=300;assert.ok(objectIcra(s).ok);const pending=JSON.stringify(s);
 assert.equal(runHaciz(s,item).ok,false);assert.equal(JSON.stringify(s),pending);
});
test("forced collateral sale preserves shortage, unrelated arrears, cap overflow and exact net worth loss",()=>{
 const s=fixture(),item=notice(s),loan=s.wealth.debts[0];s.finances.arrears=50000;
 const owed=debtBalance(loan),before=netWorth(s).total;
 assert.ok(runHaciz(s,item).ok);
 assert.equal(s.wealth.properties.length,0);assert.equal(s.wealth.debts.length,0);
 assert.equal(s.finances.arrears,300000);assert.equal(s.finances.balance,-(owed-80000+50000-300000));
 const audit=item.payload.settlement;assert.equal(audit.proceeds,80000);assert.equal(audit.remaining,owed-80000);
 assert.equal(audit.originalPrincipal+audit.interestAccrued-audit.principalPaid-audit.interestPaid,audit.remaining);
 assert.equal(netWorth(s).total,before-20000);assert.equal(item.status,"resolved");
 const snapshot=JSON.stringify(s);assert.equal(runHaciz(s,item).ok,false);assert.equal(JSON.stringify(s),snapshot);
 assert.equal(validateState(s).ok,true);
});
test("surplus collateral proceeds belong to player; later repayment cannot collect the old loan twice",()=>{
 const s=fixture(600000),item=notice(s),owed=debtBalance(s.wealth.debts[0]);s.finances.arrears=1000;
 assert.ok(runHaciz(s,item).ok);assert.equal(s.finances.balance,480000-owed);assert.equal(s.finances.arrears,1000);
 assert.equal(item.payload.settlement.remaining,0);assert.equal(s.flags.icra.seized,"property");
 const cash=s.finances.balance;processWealthMonthEnd(s);assert.ok(s.finances.balance>=cash-1000);
 assert.equal(s.wealth.debts.length,0);assert.equal(validateState(s).ok,true);
});
test("curing delinquency or restructuring withdraws the claim while retaining the home and actual loan",()=>{
 for(const action of ["mortgage-extra","mortgage-restructure"]){const s=fixture(),item=notice(s);s.finances.balance=50000;
 const original=debtBalance(s.wealth.debts[0]);
 if(action==="mortgage-extra")for(let i=0;i<3;i++){assert.ok(manageMortgage(s,s.wealth.debts[0].id,action).ok);next(s);}
 else assert.ok(manageMortgage(s,s.wealth.debts[0].id,action).ok);
 assert.equal(item.status,"resolved");assert.equal(s.wealth.properties.length,1);
 assert.equal(debtBalance(s.wealth.debts[0]),original-(action==="mortgage-extra"?15000:0));
 assert.equal(runHaciz(s,item).ok,false);
 }
});
test("full payment or voluntary sale during review resolves the linked case without resurrecting debt",()=>{
 for(const method of ["icra","bank","sale"]){const s=fixture(600000),item=notice(s);s.finances.balance=1000000;assert.ok(objectIcra(s).ok);
 if(method==="icra")assert.ok(payIcra(s).ok);
 if(method==="bank")assert.ok(manageMortgage(s,s.wealth.debts[0].id,"mortgage-close").ok);
 if(method==="sale")assert.ok(sellProperty(s,s.wealth.properties[0].id).ok);
 assert.equal(item.status,"resolved");assert.equal(item.payload.owed,0);assert.equal(item.payload.review.status,"paid");
 next(s);processIcraWeek(s);assert.equal(s.wealth.debts.length,0);assert.equal(s.finances.arrears,0);
 }
});
test("active linked V6 case survives reload; legacy V5/V6 zero-interest mortgages are not accelerated",()=>{
 const s=fixture(),item=notice(s),storage=new Storage();assert.ok(saveGame(storage,s).ok);
 const loaded=loadGame(storage);assert.ok(loaded.ok);const file=loaded.state.openCases.find(c=>c.id===item.id);
 assert.equal(file.payload.loanId,loaded.state.wealth.debts[0].id);assert.ok(runHaciz(loaded.state,file).ok);
 assert.equal(SAVE_VERSION,6);assert.ok(saveGame(storage,loaded.state).ok);
 assert.equal(loadGame(storage).state.wealth.properties.length,0);
 for(const v of [5,6]){const old=fixture();old.meta.saveVersion=v;delete old.wealth.debts[0].mortgage;
 const migrated=migrateState(old);assert.ok(migrated.ok);assert.equal(claimOf(migrated.state),null);}
});
