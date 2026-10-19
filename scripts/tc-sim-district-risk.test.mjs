import {settleHouseholdEvents} from './tc-sim-longrun.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame,SAVE_VERSION} from '../public/games/tc-sim/js/state.js';
import {DISTRICTS,locationRiskProfile,locationRiskCopy} from '../public/games/tc-sim/js/locations.js';
import {riskShortcut} from '../public/games/tc-sim/js/risk-layer.js';
import {applyDecision} from '../public/games/tc-sim/js/time.js';
import {syncGameDate} from '../public/games/tc-sim/js/game-date.js';
import {migrateState,saveGame,loadGame} from '../public/games/tc-sim/js/save.js';
function fixture(id){const s=createNewGame({seed:17});s.time.absoluteWeek=9;syncGameDate(s);s.events.active=null;s.events.queue=[];if(s.world?.scenario)s.world.scenario.pendingEvent=null;s.household.homeId='studio';if(id)s.household.location={districtId:id,lastMoveWeek:0};return s;}
function reload(s){const m=new Map(),storage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};assert.equal(saveGame(storage,s).ok,true);const r=loadGame(storage);assert.equal(r.ok,true);return r.state;}
test('district visibility is bounded and does not mutate ordinary residents or invent criminal history',()=>{for(const d of DISTRICTS){const s=fixture(d.id),before=JSON.stringify(s);const p=locationRiskProfile(s);assert.ok([1,2].includes(p.heatGain));assert.equal(JSON.stringify(s),before);assert.equal(s.flags.criminalJustice,undefined);}assert.equal(locationRiskProfile(fixture()).heatGain,1);});
for(const version of [5,6])test(`V${version}: busy district accelerates attention only after an actual illicit decision, never duplicates cash on replay`,()=>{
 let s=fixture('kadikoy');s.meta.saveVersion=version;s=migrateState(s).state;const cash=s.finances.balance,debt=structuredClone(s.wealth.debts);assert.equal(applyDecision(s,'risk-shortcut').ok,true);assert.equal(s.flags.risk.heat,2);assert.equal(s.finances.balance,cash+1800);s=reload(s);settleHouseholdEvents(s);const once=s.finances.balance;assert.equal(applyDecision(s,'risk-shortcut').ok,false);assert.equal(s.finances.balance,once);assert.deepEqual(s.wealth.debts,debt);assert.equal(s.flags.criminalJustice,undefined);assert.equal(s.meta.saveVersion,6);assert.equal(SAVE_VERSION,6);
 s.time.absoluteWeek+=4;syncGameDate(s);s.weekly={used:0,selectedIds:[]};settleHouseholdEvents(s);const beforeSecond=s.finances.balance;const result=applyDecision(s,'risk-shortcut');assert.equal(result.ok,true,JSON.stringify(result));assert.equal(s.finances.balance,beforeSecond-1500);assert.ok(s.flags.risk.detainedUntil>s.time.absoluteWeek);assert.equal(s.flags.criminalJustice,undefined);
});
test('quieter district and legacy location keep two earnings before the existing attention threshold',()=>{for(const id of ['avcilar',null]){const s=fixture(id),cash=s.finances.balance;assert.equal(riskShortcut(s).ok,true);assert.equal(s.flags.risk.heat,1);assert.equal(riskShortcut(s).ok,true);assert.equal(s.flags.risk.heat,2);assert.equal(s.finances.balance,cash+3600);assert.equal(riskShortcut(s).ok,true);assert.equal(s.finances.balance,cash+3600-1500);}});
test('moving cannot erase prior attention; profile explanation has TR/EN/PL and selected district override',()=>{const s=fixture('avcilar');s.flags.risk={heat:2};const before=JSON.stringify(s);for(const lang of ['tr','en','pl']){assert.ok(locationRiskCopy(s,lang,'kadikoy').includes('+2'));assert.ok(locationRiskCopy(s,lang,'avcilar').includes('+1'));}assert.equal(JSON.stringify(s),before);assert.match(locationRiskCopy(s,'en'),/not a real crime rate/);});
