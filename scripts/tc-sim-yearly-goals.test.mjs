import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame,setYearlyPriorities,validateState} from '../public/games/tc-sim/js/state.js';
import {currentGoal,decisionTags,processDecisionNetworkWeek} from '../public/games/tc-sim/js/decision-network.js';
import {refreshLifeArcs} from '../public/games/tc-sim/js/life-depth.js';
import {yearlyGoals} from '../public/games/tc-sim/js/yearly-goals.js';
import {enrollEducation} from '../public/games/tc-sim/js/life.js';
import {deserializeState} from '../public/games/tc-sim/js/save.js';
function fresh(){return createNewGame({seed:41});}
test('annual choices direct the week; changes break streak without deleting memories or cooldown',()=>{
 const s=fresh();s.health.stress=70;setYearlyPriorities(s,['health','relationship']);
 assert.ok(['health','relationship'].includes(currentGoal(s).priority));
 assert.ok(decisionTags(s,'rest').some(t=>t.domain==='hedef'));
 processDecisionNetworkWeek(s,['rest']);const memories=JSON.stringify(s.memories);s.decisionNetwork.nextPayoff=10;
 setYearlyPriorities(s,['education']);assert.equal(currentGoal(s).arc,'education');assert.equal(s.decisionNetwork.streak,0);assert.equal(s.decisionNetwork.nextPayoff,10);assert.equal(JSON.stringify(s.memories),memories);
 setYearlyPriorities(s,[]);assert.equal(currentGoal(s),null);assert.ok(!decisionTags(s,'rest').some(t=>t.domain==='hedef'));
 const loaded=deserializeState(JSON.stringify(s));assert.ok(loaded.ok);assert.equal(currentGoal(loaded.state),null);
});
test('education direction uses canonical points and work direction reflects real job/business state',()=>{
 const s=fresh();setYearlyPriorities(s,['education']);assert.equal(currentGoal(s).progress,0);
 enrollEducation(s,'university','part');s.education.active.progressPoints=156;assert.equal(currentGoal(s).progress,50);
 setYearlyPriorities(s,['career']);s.career.jobId=null;assert.equal(currentGoal(s).progress,0);
 s.flags.business={id:'repair',level:2,months:3};assert.equal(currentGoal(s).progress,50);
 s.flags.business.level=4;assert.equal(yearlyGoals(s)[0].progress,100);assert.equal(currentGoal(s),null);
});
test('independence cannot be completed with cash while living in the family home',()=>{
 const s=fresh();s.player.age=30;s.finances.balance=500000;setYearlyPriorities(s,['independence']);
 assert.equal(currentGoal(s).progress,50);assert.ok(refreshLifeArcs(s).goals.filter(g=>g.arc==='housing').every(g=>g.progress<=50));
 s.household.homeId='shared';s.household.livingWithFamily=false;assert.equal(yearlyGoals(s)[0].progress,75,'cash cannot replace a sustainable monthly budget');s.finances.otherMonthlyIncome=1000;assert.equal(yearlyGoals(s)[0].progress,100);
});
test('relationship direction follows real child/partner bonds with no money prerequisite',()=>{
 const s=fresh();setYearlyPriorities(s,['relationship']);assert.equal(currentGoal(s).arc,'social');
 s.social.currentPartnerNpcId='elif';assert.equal(currentGoal(s).arc,'relationship');
 s.parenthood.children=[{id:'child',alive:true,relationship:{closeness:40,trust:45,tension:20}}];assert.equal(currentGoal(s).arc,'family');const before=currentGoal(s).progress;
 s.parenthood.children[0].relationship={closeness:75,trust:75,tension:0};assert.ok(yearlyGoals(s)[0].progress>before);
});
test('V5/V6 selections remain valid with no invented past choice; explicit free life round-trips',()=>{
 for(const version of [5,6]){const s=fresh();s.meta.saveVersion=version;delete s.yearlyPlan.freeLife;const loaded=deserializeState(JSON.stringify(s));assert.ok(loaded.ok);assert.deepEqual(loaded.state.yearlyPlan.priorities,[]);assert.ok(validateState(loaded.state).ok);setYearlyPriorities(loaded.state,['money','health','career']);assert.equal(yearlyGoals(loaded.state).length,2);}
});
