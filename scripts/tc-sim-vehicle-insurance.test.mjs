import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame,SAVE_VERSION} from '../public/games/tc-sim/js/state.js';
import {buyVehicle,sellVehicle,vehicleOperatingCosts,vehicleExpenseLabel,getWealthMonthlySummary,processWealthMonthEnd,VEHICLES} from '../public/games/tc-sim/js/wealth.js';
import {migrateState,saveGame,loadGame} from '../public/games/tc-sim/js/save.js';
function reload(s){const m=new Map(),storage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};assert.equal(saveGame(storage,s).ok,true);const r=loadGame(storage);assert.equal(r.ok,true);return r.state;}
for(const version of [5,6])for(const tier of Object.keys(VEHICLES))test(`V${version} ${tier}: one premium comes from the fixed reserve, not an extra deduction`,()=>{
 let s=createNewGame({seed:17});s.finances.balance=2000000;s.events.active=null;assert.equal(buyVehicle(s,tier,false).ok,true);s.meta.saveVersion=version;s=migrateState(s).state;s=reload(s);
 const c=vehicleOperatingCosts(s);assert.equal(c.insurance+c.upkeep+4*c.weeklyFuel,VEHICLES[tier].monthly);assert.equal(getWealthMonthlySummary(s).vehicle,VEHICLES[tier].monthly);
 const cash=s.finances.balance;processWealthMonthEnd(s);assert.equal(cash-s.finances.balance,c.fixed);
 const rows=s.finances.ledger.filter(r=>r.category==='vehicle-insurance');assert.equal(rows.length,1);assert.equal(rows[0].amount,-c.insurance);
 s=reload(s);const paid=s.finances.balance;processWealthMonthEnd(s);assert.equal(s.finances.balance,paid);assert.equal(s.finances.ledger.filter(r=>r.category==='vehicle-insurance').length,1);assert.equal(s.meta.saveVersion,6);assert.equal(SAVE_VERSION,6);
});
test('selling a car ends prospective premiums without refunding already posted costs',()=>{const s=createNewGame({seed:17});s.finances.balance=300000;s.events.active=null;buyVehicle(s,'used',false);processWealthMonthEnd(s);sellVehicle(s);const cash=s.finances.balance;s.time.absoluteWeek=5;processWealthMonthEnd(s);assert.equal(s.finances.balance,cash);assert.equal(getWealthMonthlySummary(s).vehicleInsurance,0);assert.equal(s.finances.ledger.filter(r=>r.category==='vehicle-insurance').length,1);});
test('insurance ledger uses actual TR/EN/PL copy',()=>{const old=globalThis.window;try{for(const [lang,label] of Object.entries({tr:'Araç sigorta payı',en:'Vehicle insurance allowance',pl:'Składka ubezpieczenia pojazdu'})){globalThis.window={tlabI18n:{contentLang:()=>lang}};assert.equal(vehicleExpenseLabel('insurance'),label);}}finally{globalThis.window=old;}});
