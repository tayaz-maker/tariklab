import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame,SAVE_VERSION} from '../public/games/tc-sim/js/state.js';
import {buyVehicle,vehicleOperatingCosts,vehicleExpenseLabel,processWealthMonthEnd,getWealthMonthlySummary,VEHICLES} from '../public/games/tc-sim/js/wealth.js';
import {applyWeeklyLifeLoad} from '../public/games/tc-sim/js/life.js';
import {locationCosts} from '../public/games/tc-sim/js/locations.js';
import {migrateState,saveGame,loadGame} from '../public/games/tc-sim/js/save.js';
const reload=s=>{const m=new Map(),storage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};assert.equal(saveGame(storage,s).ok,true);const loaded=loadGame(storage);assert.equal(loaded.ok,true,JSON.stringify(loaded));return loaded.state;};
function fixture(tier='used'){const s=createNewGame({seed:17});s.finances.balance=2000000;s.events.active=null;s.household.homeId='studio';s.household.location={districtId:'avcilar',lastMoveWeek:0};assert.equal(buyVehicle(s,tier,false).ok,true);return s;}
for(const tier of Object.keys(VEHICLES))test(`${tier}: four commute weeks and fixed month total the old budget exactly once`,()=>{
 const s=fixture(tier),cash=s.finances.balance,cap=VEHICLES[tier].monthly;assert.equal(getWealthMonthlySummary(s).vehicle,cap);assert.ok(getWealthMonthlySummary(s).expenses>=cap);
 for(let week=1;week<=4;week++){s.time.absoluteWeek=week;applyWeeklyLifeLoad(s);const once=s.finances.balance;applyWeeklyLifeLoad(s);assert.equal(s.finances.balance,once);}
 s.time.absoluteWeek=5;processWealthMonthEnd(s);assert.equal(cash-s.finances.balance,cap);const once=s.finances.balance;processWealthMonthEnd(s);assert.equal(s.finances.balance,once);
 assert.equal(s.finances.ledger.filter(r=>r.category==='vehicle-fuel').length,4);assert.equal(vehicleOperatingCosts(s).fixed+4*vehicleOperatingCosts(s).weeklyFuel,cap);
});
for(const [name,block] of Object.entries({recovery:s=>s.body.workRecovery={version:1,startWeek:1,untilWeek:3},unemployed:s=>s.career.jobId=null,detained:s=>s.flags.risk={detainedUntil:3},army:s=>s.flags.askerlik={mode:'serving',until:3},retired:s=>s.career.retirement.status='retired'}))test(`${name}: parked vehicle keeps the fixed reserve but no invented fuel use`,()=>{const s=fixture();block(s);const cash=s.finances.balance;applyWeeklyLifeLoad(s);assert.equal(s.finances.balance,cash);assert.equal(vehicleOperatingCosts(s).fixed,1280);});
for(const version of [5,6])test(`V${version}: no historical fuel backfill; real weekly replay remains idempotent after reload`,()=>{let s=fixture();s.meta.saveVersion=version;s=migrateState(s).state;const cash=s.finances.balance;s=reload(s);assert.equal(s.finances.balance,cash);applyWeeklyLifeLoad(s);s=reload(s);const paid=s.finances.balance;applyWeeklyLifeLoad(s);assert.equal(s.finances.balance,paid);assert.equal(SAVE_VERSION,6);assert.equal(s.meta.saveVersion,6);});
test('vehicle fuel replaces the public work fare, while a non-owner keeps existing geography costs',()=>{const s=fixture();s.household.location={districtId:'avcilar',lastMoveWeek:0};assert.equal(locationCosts(s).transport,0);s.wealth.vehicle=null;assert.ok(locationCosts(s).transport>0);});
test('new actual ledger labels have TR/EN/PL copy',()=>{const old=globalThis.window;try{for(const lang of ['tr','en','pl']){globalThis.window={tlabI18n:{contentLang:()=>lang}};assert.ok(vehicleExpenseLabel('fuel'));assert.ok(vehicleExpenseLabel('fixed'));}globalThis.window={tlabI18n:{contentLang:()=> 'pl'}};assert.equal(vehicleExpenseLabel('fuel'),'Paliwo na dojazd do pracy');}finally{globalThis.window=old;}});
