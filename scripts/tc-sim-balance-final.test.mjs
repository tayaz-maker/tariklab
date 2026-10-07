import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame,getWeeklyActivityLimit} from '../public/games/tc-sim/js/state.js';
import {netWorth,processCashShortfall} from '../public/games/tc-sim/js/wealth.js';
import {startBusiness,businessAvailability,manageBusiness,closeBusiness,processBusinessMonth} from '../public/games/tc-sim/js/bank-business.js';
import {moveHome,moveLocation,locationMoveAvailability} from '../public/games/tc-sim/js/life.js';
import {applySocialAction} from '../public/games/tc-sim/js/social.js';
import {tradeExchange,exchangeQuote,EXCHANGE_ASSETS} from '../public/games/tc-sim/js/exchange.js';
import {migrateState} from '../public/games/tc-sim/js/save.js';
const game=()=>{const s=createNewGame({seed:41,eraId:'2017-04-18'});s.events.active=null;s.events.queue=[];s.finances.balance=100000;return s;};
test('arrears cap never forgives overflow or creates wealth, including repeated processing and old saves',()=>{
 for(const arrears of [0,299000,300000]){const s=game();s.finances.arrears=arrears;s.finances.balance=-90000;const worth=netWorth(s).total;processCashShortfall(s);assert.equal(netWorth(s).total,worth);processCashShortfall(s);assert.equal(netWorth(s).total,worth);const loaded=migrateState(structuredClone(s));assert.ok(loaded.ok);assert.equal(netWorth(loaded.state).total,worth);}
});
test('small social action costs one, home/local move two, intercity three; partial budgets fail without spending',()=>{
 let s=game();assert.ok(applySocialAction(s,'mehmet','confide').ok);assert.equal(s.weekly.used,1);
 s=game();s.weekly.used=getWeeklyActivityLimit(s)-1;let before=structuredClone(s);assert.equal(moveHome(s,'shared').ok,false);assert.deepEqual(s,before);assert.equal(locationMoveAvailability(s,'avcilar','shared').ok,false);
 s=game();assert.ok(moveHome(s,'shared').ok);assert.equal(s.weekly.used,2);assert.equal(moveHome(s,'studio').ok,false);
 s=game();assert.ok(moveLocation(s,'avcilar','shared').ok);assert.equal(s.weekly.used,2);
 s=game();s.career.jobId=null;assert.ok(moveLocation(s,'batikent','shared').ok);assert.equal(s.weekly.used,3);
});
test('business setup and scale decisions cost two, cannot repeat a scale action in one week, and never exceed capacity',()=>{
 const s=game();s.weekly.used=getWeeklyActivityLimit(s)-1;assert.equal(businessAvailability(s,'repair').ok,false);s.weekly.used=0;assert.ok(startBusiness(s,'repair').ok);assert.equal(s.weekly.used,2);
 assert.ok(manageBusiness(s,'expand').ok);assert.equal(s.weekly.used,4);const before=structuredClone(s);assert.equal(manageBusiness(s,'expand').ok,false);assert.deepEqual(s,before);assert.ok(manageBusiness(s,'hire').ok);assert.equal(s.weekly.used,5);
 s.events.active={eventId:'test'};const active=structuredClone(s);assert.equal(closeBusiness(s).ok,false);assert.deepEqual(s,active);
});
test('same-date FX/gold repeated round trips lose spread; blocked and insufficient-cash orders do not mutate',()=>{
 for(const date of ['1999-04-18','2002-01-18','2005-01-18','2017-04-18','2025-04-18','2030-04-18'])for(const [id,a] of Object.entries(EXCHANGE_ASSETS)){
  const s=game();s.time.date=date;s.time.year=+date.slice(0,4);const q=exchangeQuote(s,id);if(!q?.available)continue;
  assert.ok(q.bid<q.ask&&q.bid>0);s.finances.balance=1e8;const cash=s.finances.balance;
  for(let i=0;i<10;i++){assert.ok(tradeExchange(s,id,'buy',a.step).ok);assert.ok(tradeExchange(s,id,'sell',a.step).ok);}
  assert.ok(s.finances.balance<cash);s.finances.balance=0;const before=structuredClone(s);assert.equal(tradeExchange(s,id,'buy',a.step).ok,false);assert.deepEqual(s,before);
 }
});
test('capital cannot be recycled into profit and monthly business settlement survives save/load without paying twice',()=>{
 const s=game(),cash=s.finances.balance;startBusiness(s,'repair');manageBusiness(s,'expand');manageBusiness(s,'shrink');s.weekly={used:0,selectedIds:[]};closeBusiness(s);assert.ok(s.finances.balance<cash);
 s.weekly={used:0,selectedIds:[]};startBusiness(s,'repair');processBusinessMonth(s);const saved=migrateState(structuredClone(s));assert.ok(saved.ok);const before=saved.state.finances.balance;assert.equal(processBusinessMonth(saved.state),'');assert.equal(saved.state.finances.balance,before);
});

test('long game envelope: work, low income, debt, family and funded business diverge without guaranteed riches',async()=>{
 const {runBalanceMatrix}=await import('./tc-sim-balance-probe.mjs');const r=runBalanceMatrix();
 for(const p of Object.values(r.adults)){assert.ok(p.valid);assert.ok(p.weeks>=520);assert.ok(p.final.savingsMultiple<10);}
 assert.ok(r.adults['financially-strained'].final.balance<r.adults.balanced.final.balance);
 assert.ok(r.adults['education-career'].final.balance>r.adults.balanced.final.balance);
 assert.ok(r.family.valid&&r.family.birthWeek&&r.family.child.otherParentValid);
 for(const p of [...r.entrepreneurs,...r.historical,...r.funded,r.workerFounder,r.rushed]){assert.ok(p.valid);assert.ok(Number.isFinite(p.finalWorth));}
 assert.ok(r.funded.some(p=>p.finalWorth>p.initial));assert.ok(r.rushed.finalWorth<r.rushed.initial);assert.ok(r.rushed.lossMonths>0);
 assert.ok(r.workerFounder.checkpoints[144]<1000000);
 console.log('BALANCE_ENVELOPE',JSON.stringify({adults:Object.fromEntries(Object.entries(r.adults).map(([k,v])=>[k,v.final.savingsMultiple])),founders:[...r.entrepreneurs,...r.funded,r.workerFounder,r.rushed].map(p=>({capital:p.capital,seed:p.seed,employed:p.employed,worth:p.finalWorth,lossMonths:p.lossMonths,level:p.peakLevel}))}));
});
