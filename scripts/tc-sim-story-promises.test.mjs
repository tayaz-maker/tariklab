import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame,validateState,SAVE_VERSION} from '../public/games/tc-sim/js/state.js';
import {enqueueEvent,activateNextEvent,resolveEvent,getEventDefinition} from '../public/games/tc-sim/js/events.js';
import {refreshLifeArcs} from '../public/games/tc-sim/js/life-depth.js';
import {netWorth} from '../public/games/tc-sim/js/wealth.js';
import {bankTotals} from '../public/games/tc-sim/js/bank-accounts.js';
import {deserializeState} from '../public/games/tc-sim/js/save.js';
function play(s,id,choice){s.events.active=null;s.events.queue=[];assert.ok(enqueueEvent(s,id));assert.equal(activateNextEvent(s).eventId,id);assert.ok(resolveEvent(s,choice).ok);}
test('deposit note persists through refresh and V5/V6 reload without consuming or inventing funds',()=>{
 for(const version of [5,SAVE_VERSION]) {
  let s=createNewGame({seed:41});s.finances.balance=5000;
  const before={cash:s.finances.balance,banks:bankTotals(s),worth:netWorth(s).total};
  play(s,'lc_goal_housing','save');
  assert.deepEqual({cash:s.finances.balance,banks:bankTotals(s),worth:netWorth(s).total},before);
  for(let i=0;i<4;i++)refreshLifeArcs(s);
  s.meta.saveVersion=version;s=deserializeState(JSON.stringify(s)).state;
  let g=refreshLifeArcs(s).goals.find(g=>g.id==='lc-goal:lc_goal_housing');
  assert.equal(g.arc,'housing');assert.equal(g.progress,50);
  s.finances.balance=10000;g=refreshLifeArcs(s).goals.find(g=>g.id==='lc-goal:lc_goal_housing');assert.equal(g.progress,100);
  s.events.active=null;s.events.queue=[];assert.equal(resolveEvent(s,'save').ok,false);
  assert.equal(s.lifeDepth.contentGoals.length,1);assert.ok(validateState(s).ok);
 }
});
test('legacy surviving deposit note migrates without a retrospective refund or envelope asset',()=>{
 const s=createNewGame({seed:4});delete s.lifeDepth.contentGoals;s.lifeDepth.goals=[{id:'lc-goal:lc_goal_housing',arc:'crisis',label:'Depozito zarfı',progress:20}];
 const before=s.finances.balance;const d=refreshLifeArcs(s);
 assert.equal(d.contentGoals.length,1);assert.equal(d.contentGoals[0].arc,'housing');assert.equal(s.finances.balance,before);
});
test('credit and clinic choices describe intentions in TR and EN, with no fictitious transaction',()=>{
 const s=createNewGame({seed:41});const before=JSON.stringify(s.finances);
 play(s,'lc_credit_limit','refuse');assert.match(s.memories.at(-1).text,/henüz değişmedi/);
 play(s,'lc_late_clinic','take');assert.match(s.memories.at(-1).text,/henüz randevu almadın/);
 assert.equal(JSON.stringify(s.finances),before);
 for(const [id,c] of [['lc_credit_limit','refuse'],['lc_late_clinic','take']])assert.match(getEventDefinition(id).en.choices[c],/Plan/);
});
