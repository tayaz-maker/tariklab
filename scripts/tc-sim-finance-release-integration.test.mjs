import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame,validateState,SAVE_VERSION} from '../public/games/tc-sim/js/state.js';
import {openIcraNotice} from '../public/games/tc-sim/js/icra.js';
import {advanceWeek,applyDecision} from '../public/games/tc-sim/js/time.js';
import {settleHouseholdEvents} from './tc-sim-longrun.mjs';
import {saveGame,loadGame} from '../public/games/tc-sim/js/save.js';
class Storage {data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
test('actual court/counsel/extra-review to compulsory salary collection shares service-day and cash accounting',()=>{
 let s=createNewGame({seed:11,now:'2027-01-01T00:00:00Z'});s.finances.balance=100000;s.finances.arrears=4000;s.events.active=null;s.events.queue=[];
 const file=openIcraNotice(s,{source:'temerrut',amount:4000}),id=file.id,storage=new Storage();
 for(const decision of ['icra-evidence','icra-counsel','icra-object']){settleHouseholdEvents(s);assert.ok(applyDecision(s,decision).ok,decision);}
 let appealed=false,receipts=0,lastMonth=null;
 for(let week=0;week<16;week++){
  settleHouseholdEvents(s);const f=s.openCases.find(c=>c.id===id);
  if(!appealed&&f.payload.review?.status==='confirmed'&&f.payload.stage==='notice'){
   assert.ok(applyDecision(s,'icra-appeal').ok);appealed=true;settleHouseholdEvents(s);
  }
  assert.ok(advanceWeek(s).ok);assert.equal(validateState(s).ok,true);
  const r=s.finances.lastMonthClose,key=r&&`${r.year}-${r.month}`;
  if(r&&key!==lastMonth){assert.equal(r.closingBalance-r.openingBalance,r.inflow-r.outflow+r.adjustments+r.otherChange);assert.ok(r.debtPayments<=r.outflow);lastMonth=key;receipts++;}
  if(week%4===3){assert.ok(saveGame(storage,s).ok);const loaded=loadGame(storage);assert.ok(loaded.ok);assert.deepEqual(loaded.state.flags.socialInsurance.service,s.flags.socialInsurance.service);s=loaded.state;}
 }
 const result=s.openCases.find(c=>c.id===id);
 assert.ok(appealed);assert.equal(result.payload.counsel.fee,500);assert.equal(result.payload.review.cost,300);
 assert.equal(result.payload.review.final,true);assert.equal(result.payload.wage.compulsory,true);assert.ok(result.payload.wage.paid>0);
 assert.equal(result.payload.wage.paid+result.payload.owed,4000);assert.equal(s.finances.arrears,result.payload.owed);
 assert.ok(s.flags.socialInsurance.service.days>0);assert.ok(receipts>=3);
 assert.equal(s.finances.ledger.some(r=>r.amount<0&&/SGK|sigorta primi/u.test(r.reason)),false);
 assert.equal(s.meta.saveVersion,SAVE_VERSION);assert.equal(SAVE_VERSION,6);
});
