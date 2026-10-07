import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame} from '../public/games/tc-sim/js/state.js';
import {migrateState} from '../public/games/tc-sim/js/save.js';
import {normalizeWealth,netWorth} from '../public/games/tc-sim/js/wealth.js';
import {EXCHANGE_ASSETS,exchangeQuote,tradeExchange,exchangePortfolio} from '../public/games/tc-sim/js/exchange.js';
import {startBusiness,manageBusiness,processBusinessMonth,closeBusiness} from '../public/games/tc-sim/js/bank-business.js';
const game=(date='2017-04-18')=>{const s=createNewGame({seed:29,eraId:date==='1999-04-18'?date:'2017-04-18'});s.time.date=date;s.time.year=+date.slice(0,4);s.finances.balance=1e7;s.events.active=null;return s;};
test('all eras reject round-trip profit, overselling and malformed amounts',()=>{
 for(const date of ['1999-04-18','2017-04-18','2025-04-18','2030-04-18'])for(const [id,a] of Object.entries(EXCHANGE_ASSETS)){
  const s=game(date),q=exchangeQuote(s,id);if(!q?.available)continue;
  const before=s.finances.balance;
  assert.equal(tradeExchange(s,id,'buy',a.step).ok,true,id+date);
  assert.equal(tradeExchange(s,id,'sell',a.step).ok,true);
  assert.ok(s.finances.balance<before);
  assert.equal(tradeExchange(s,id,'sell',a.step).ok,false);
  for(const amount of [NaN,Infinity,-1,0,.1,1e20])assert.equal(tradeExchange(s,id,'buy',amount).ok,false);
 }
});
test('EUR is not cash in 1999 and DEM survives euro transition without loss of units',()=>{
 const s=game('1999-04-18');assert.equal(exchangeQuote(s,'EUR').available,false);
 assert.equal(tradeExchange(s,'EUR','buy',10).ok,false);
 assert.equal(tradeExchange(s,'DEM','buy',10).ok,true);
 s.time.date='2002-04-18';s.time.year=2002;
 assert.equal(exchangeQuote(s,'EUR').available,true);
 assert.equal(tradeExchange(s,'DEM','buy',10).ok,false);
 assert.equal(tradeExchange(s,'DEM','sell',10).ok,true);
});
test('positions, basis and history survive repeated save normalization; worth counts once',()=>{
 const s=game();const before=netWorth(s).total;
 tradeExchange(s,'USD','buy',10);
 const original=JSON.stringify(s.wealth.exchange);
 for(let i=0;i<3;i++){normalizeWealth(s);assert.equal(JSON.stringify(s.wealth.exchange),original);}
 const loaded=migrateState(JSON.parse(JSON.stringify(s)));assert.equal(loaded.ok,true);assert.deepEqual(loaded.state.wealth.exchange,s.wealth.exchange);
 assert.ok(netWorth(s).total<before);
 assert.equal(exchangePortfolio(s)[0].quantity,10);
 s.finances.balance=0;assert.equal(tradeExchange(s,'USD','buy',10).ok,false);
});
test('quotes use only past observations and label future scenarios',()=>{
 for(const date of ['1999-04-18','2017-04-18','2025-04-18']){const q=exchangeQuote(game(date),'gram');assert.ok(q.sourceDate<=date);assert.ok(q.goldMonth<date.slice(0,7));assert.equal(q.future,false);}
 assert.equal(exchangeQuote(game('2030-04-18'),'USD').future,true);
});
test('growth spends capital; debt remains payable on sale; settlement is idempotent',()=>{
 const s=game();startBusiness(s,'repair');s.weekly={used:0,selectedIds:[]};
 const before=s.finances.balance;assert.equal(manageBusiness(s,'expand').ok,true);assert.ok(s.finances.balance<before);
 assert.equal(manageBusiness(s,'hire').ok,true);
 processBusinessMonth(s);const settled=s.finances.balance;assert.equal(processBusinessMonth(s),'');assert.equal(s.finances.balance,settled);
 const r=s.flags.business.lastResult;assert.equal(r.expenses,r.supply+r.wages+r.rent+r.operations+r.interest+r.principal+r.tax);
 s.flags.business.debt=200000;s.weekly={used:0,selectedIds:[]};const cash=s.finances.balance;closeBusiness(s);assert.ok(s.finances.balance<cash-100000);
});
test('legacy business initializes safely; long run remains finite and growth is not free',()=>{
 const s=game();s.flags.business={id:'internet',startedWeek:1,lastMonth:-1,months:0};
 let losses=0;
 for(let i=0;i<156;i++){s.time.year=2017+Math.floor(i/12);s.time.month=i%12+1;s.time.date=`${s.time.year}-${String(s.time.month).padStart(2,'0')}-18`;processBusinessMonth(s);if(s.flags.business?.lastResult.net<0)losses++;assert.ok(Number.isFinite(s.finances.balance));}
 assert.ok(losses>0);
});

test('loan restructuring costs principal and cannot repeat; bankruptcy cannot erase proceeds',()=>{
 const s=game();startBusiness(s,'repair');const b=s.flags.business;b.months=4;b.lastResult={net:300};s.weekly={used:0,selectedIds:[]};
 const before=s.finances.balance;assert.equal(manageBusiness(s,'loan').ok,true);assert.ok(b.debt<=b.invested*.1);assert.equal(s.finances.balance-before,b.debt);
 const debt=b.debt;assert.equal(manageBusiness(s,'restructure').ok,true);assert.equal(b.debt,Math.ceil(debt*1.08));assert.equal(manageBusiness(s,'restructure').ok,false);
 s.finances.balance=-20000;b.lossMonths=5;s.health.energy=1;s.finances.arrears=20000;s.time.year=2001;s.time.date='2001-01-18';
 processBusinessMonth(s);assert.equal(s.flags.business,undefined);assert.equal(s.flags.lastBusinessOutcome.outcome,'bankrupt');
});
