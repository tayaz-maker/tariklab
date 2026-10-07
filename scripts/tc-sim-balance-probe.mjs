import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createNewGame,validateState} from '../public/games/tc-sim/js/state.js';
import {advanceWeek,applyDecision,canApplyDecision} from '../public/games/tc-sim/js/time.js';
import {resolveScenarioChoice} from '../public/games/tc-sim/js/historical-scenarios.js';
import {startBusiness,manageBusiness} from '../public/games/tc-sim/js/bank-business.js';
import {netWorth} from '../public/games/tc-sim/js/wealth.js';
import {saveGame,loadGame} from '../public/games/tc-sim/js/save.js';
import {settleHouseholdEvents,runAdultCoreMatrix,runChildScenario} from './tc-sim-longrun.mjs';
export function runEntrepreneur(seed=41,capital=30000,eraId='2017-04-18',weeks=480,employed=false,reservePolicy=true){
 let s=createNewGame({seed,eraId});if(!employed)s.career.jobId=null;s.finances.balance=capital;
 const initial=netWorth(s).total;let lossMonths=0,lastMonth='',peakLevel=1,minCash=capital,successfulGrowth=0;const checkpoints={};
 const settle=()=>{if(s.world.scenario?.pendingEvent)assert.ok(resolveScenarioChoice(s,'rest').ok);settleHouseholdEvents(s,{parent_planning:'no',parent_planning_review:'no',family_intent_discussion:'later'});};
 settle();assert.ok(startBusiness(s,'repair').ok);
 const m=new Map(),storage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
 for(let i=0;i<weeks;i++){
  settle();const b=s.flags.business;
  if(b){const capacity=2**(b.level-1),reserve=Math.max(30000,b.employees*9000*3);
   if(b.employees<capacity-1 && s.finances.balance>reserve+9000)manageBusiness(s,'hire');
   else if(b.level<7&&b.months>=3&&b.lastResult?.net>0&&s.finances.balance>(reservePolicy?120000+(capacity*2-1)*9000*6+14000*capacity:reserve+14000*capacity)){if(manageBusiness(s,'expand').ok)successfulGrowth++;}
   peakLevel=Math.max(peakLevel,b.level);
  }
  for(const id of ['rest','exercise','family']){if(canApplyDecision(s,id).ok)applyDecision(s,id);settle();}
  const r=advanceWeek(s);assert.ok(r.ok,r.messages?.join(' '));settle();
  if(s.flags.business?.lastResult?.date!==lastMonth){lastMonth=s.flags.business?.lastResult?.date;if(s.flags.business?.lastResult?.net<0)lossMonths++;}
  if([144,240,480].includes(i+1))checkpoints[i+1]=netWorth(s).total;
  minCash=Math.min(minCash,s.finances.balance);assert.ok(validateState(s).ok,validateState(s).errors.join(';'));
  if(i%48===47){const worth=netWorth(s).total;assert.ok(saveGame(storage,s).ok);const loaded=loadGame(storage);assert.ok(loaded.ok);s=loaded.state;assert.equal(netWorth(s).total,worth);}
 }
 return {seed,eraId,weeks,employed,reservePolicy,checkpoints,capital,initial,finalWorth:netWorth(s).total,balance:s.finances.balance,arrears:s.finances.arrears,minCash,peakLevel,successfulGrowth,lossMonths,business:s.flags.business?.id||null,health:s.health,employees:s.flags.business?.employees,lastResult:s.flags.business?.lastResult,valid:validateState(s).ok};
}
export function runBalanceMatrix(){
 const adults=Object.fromEntries(Object.entries(runAdultCoreMatrix()).map(([k,v])=>[k,{weeks:v.weeks,final:v.final,valid:v.valid,checkpoints:v.checkpoints}]));
 const family=runChildScenario('stable',{weeks:520,economicPolicy:true});
 const entrepreneurs=[41,73].flatMap(seed=>[30000,500000].map(capital=>runEntrepreneur(seed,capital)));
 const historical=[runEntrepreneur(41,30000,'1999-04-18',480)];
 const funded=[17,73].map(seed=>runEntrepreneur(seed,5000000));
 const workerFounder=runEntrepreneur(41,30000,"2017-04-18",480,true);
 const rushed=runEntrepreneur(73,500000,"2017-04-18",480,false,false);
 return {adults,family,entrepreneurs,historical,funded,workerFounder,rushed};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(runBalanceMatrix(),null,2));
