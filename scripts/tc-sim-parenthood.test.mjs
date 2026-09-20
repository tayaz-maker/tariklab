import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, normalizeEducationCareer, validateState } from "../public/games/tc-sim/js/state.js";
import { setRomanticInterest, becomePartner, getRelationship } from "../public/games/tc-sim/js/social.js";
import { advanceWeek, applyDecision, canApplyDecision } from "../public/games/tc-sim/js/time.js";
import { getEventDefinition, resolveEvent, getEventChoiceAvailability } from "../public/games/tc-sim/js/events.js";
import { canTryParenthood, neutralParenthood, parenthoodSummary, childStage, parenthoodCosts, processParenthoodCases, processParenthoodWeek } from "../public/games/tc-sim/js/parenthood.js";
import { getMonthlySummary, enrollEducation, getWeeklyLifeLoad } from "../public/games/tc-sim/js/life.js";
import { isSecretKnownTo } from "../public/games/tc-sim/js/depth2-systems.js";
import { getKnownOpenCases } from "../public/games/tc-sim/js/calendar.js";
import { saveGame, loadGame } from "../public/games/tc-sim/js/save.js";
import { settleHouseholdEvents, runParenthoodScenario } from "./tc-sim-longrun.mjs";

function family() {
  const s = createNewGame({now:"2027-01-01T00:00:00.000Z"});
  s.relationships.elif = 85; s.people.find(p=>p.id==='elif').social.trust=85;
  setRomanticInterest(s,'elif'); becomePartner(s,'elif');
  s.household.homeId='shared'; s.household.livingWithFamily=false;
  s.household.union.cohabitingSince=1; s.household.union.marriedSince=1;
  s.household.union.familyPlan={intent:'wants',response:'wants'};
  s.finances.balance=50000;
  return s;
}
function choose(s,id,choice,source=null) { s.events.active={eventId:id,occurrenceId:`fixture-${id}-${s.time.absoluteWeek}`,sourceCaseId:source}; return resolveEvent(s,choice); }
function roundtrip(s) {
  const m=new Map(), storage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};
  assert.equal(saveGame(storage,s).ok,true); const r=loadGame(storage); assert.equal(r.ok,true); assert.deepEqual(r.state.parenthood,s.parenthood); assert.deepEqual(r.state.openCases.filter(c=>c.type==='parenting-followup'),s.openCases.filter(c=>c.type==='parenting-followup')); return r.state;
}
function tick(s,n=1,choices={}) { for(let i=0;i<n;i++){settleHouseholdEvents(s,choices);assert.equal(advanceWeek(s).ok,true);settleHouseholdEvents(s,choices);} }
function pregnant() { const s=family(); assert.equal(choose(s,'parent_planning','try_partner').ok,true); tick(s,4); assert.equal(s.parenthood.pregnancy.phase,'known'); return s; }
function born() { const s=pregnant(); tick(s,36); assert.equal(s.parenthood.children.length,1); return s; }

test('explicit reproductive scenario and alignment are required; marriage alone never starts pregnancy',()=>{
 const s=family();tick(s,5);assert.equal(s.parenthood.pregnancy,null);
 s.events.active=null;s.weekly={used:0,selectedIds:[]};s.household.union.familyPlan.response='not_now';
 assert.equal(canTryParenthood(s),false);assert.equal(choose(s,'parent_planning','try_partner').ok,false);
 assert.equal(s.parenthood.pregnancy,null);assert.equal(s.household.union.familyPlan.response,'not_now');
 s.household.union.familyPlan.response='wants'; assert.equal(choose(s,'parent_planning','try_self').ok,true);
 assert.equal(s.parenthood.pregnancy.carrier,'player');assert.equal(s.parenthood.pregnancy.phase,'trying');
});

test('P01 reconsideration survives save and keeps disagreement until an explicit contextual discussion',()=>{
 let s=family();s.household.union.familyPlan.response='not_now';s.finances.balance=100;
 assert.equal(choose(s,'parent_planning','discuss').ok,true);const plan=s.openCases.find(c=>c.type==='parenting-followup');
 s=roundtrip(s);tick(s,4,{parent_planning_review:'discuss'});
 assert.equal(s.household.union.familyPlan.response,'not_now');assert.equal(s.parenthood.pregnancy,null);
 assert.ok(s.openCases.some(c=>c.type==='parenting-followup'&&c.status!=='resolved'));
 assert.equal(plan.chainId,'CHN-P01');
});

test('P02 preparation and P03 birth run through actual delay, finance, calendar and idempotent creation',()=>{
 let s=pregnant();const p=s.parenthood.pregnancy;
 assert.equal(isSecretKnownTo(s,p.id,'anne'),false);
 assert.ok(getKnownOpenCases(s).some(c=>c.payload?.kind==='birth'));
 s=roundtrip(s);tick(s,8,{parent_preparation:'prepare'});
 assert.ok(s.finances.ledger.some(e=>e.reason==='Doğum ve bakım hazırlığı'&&e.amount===-500));
 assert.ok(s.weekly.selectedIds.includes('parent:parent_preparation'));
 const birth=s.openCases.find(c=>c.eventId==='parent_birth');tick(s,28);
 const child=s.parenthood.children[0];assert.equal(child.otherParentId,'elif');assert.equal(child.livesWithPlayer,true);
 assert.equal(s.parenthood.pregnancy,null);assert.equal(s.parenthood.children.length,1);
 assert.equal(choose(s,'parent_birth','birth',birth.id).ok,false);assert.equal(s.parenthood.children.length,1);
 s.events.active=null; s=roundtrip(s); assert.equal(childStage(s,child),'Bebeklik');
 assert.ok(s.people.find(p=>p.id==='elif').memories.some(m=>m.type.startsWith('birth-')));
});

test('hidden conception check is absent from calendar and UI does not reveal internal identities',()=>{
 const s=family();choose(s,'parent_planning','try_partner');
 assert.equal(getKnownOpenCases(s).some(c=>c.eventId==='parent_confirm'),false);
 roundtrip(s);
 const view=JSON.stringify(parenthoodSummary(s));assert.doesNotMatch(view,/pregnancy-|CHN-P|startWeek|otherParentId/);
 assert.match(view,/henüz gebelik bilgisi yok/);
});

test('child costs are derived once, first month prorated, and reload cannot add a second bill',()=>{
 let s=born(); const child=s.parenthood.children[0];
 s.time.weekOfMonth=4; child.bornWeek=s.time.absoluteWeek;
 const salary=getMonthlySummary(s).income; const finance=structuredClone(s.finances);
 for(let i=0;i<10;i++)getMonthlySummary(s); assert.deepEqual(s.finances,finance);
 s=roundtrip(s); tick(s);
 assert.equal(s.finances.ledger.filter(e=>e.reason==='Aylık çocuk ve bakım gideri').at(-1).amount,-350);
 const bills=s.finances.ledger.filter(e=>e.reason==='Aylık çocuk ve bakım gideri').length;
 s=roundtrip(s);tick(s);assert.equal(s.finances.ledger.filter(e=>e.reason==='Aylık çocuk ve bakım gideri').length,bills);
 assert.equal(getMonthlySummary(s).income,salary);assert.equal(parenthoodCosts(s),1400);
});

test('P04 unmet care consumes recovery and gates overtime until actual care; education competes for the same slots',()=>{
 const s=born();s.events.active=null;s.events.queue=[];s.weekly={used:0,selectedIds:[]};
 const energy=s.health.energy;processParenthoodWeek(s);assert.equal(s.health.energy,energy-4);
 processParenthoodWeek(s);assert.equal(s.health.energy,energy-4,'once per week');
 tick(s,3);assert.equal(canApplyDecision(s,'overtime').ok,false);assert.match(canApplyDecision(s,'overtime').reason,/bakım/);
 assert.equal(applyDecision(s,'parent-care').ok,true);settleHouseholdEvents(s);
 assert.equal(s.weekly.used,1);assert.equal(s.parenthood.missedCareWeeks>=2,true);
 // A study program uses the existing shared load; care does not invent a second activity pool.
 const ordinaryLoad=getWeeklyLifeLoad(s);
 assert.equal(enrollEducation(s,'vocational_course','part').ok,true);
 assert.ok(getWeeklyLifeLoad(s).energy<ordinaryLoad.energy);
 assert.doesNotMatch(canApplyDecision(s,'overtime').reason || '',/bakım/);
 assert.equal(applyDecision(s,'rest').ok,true);settleHouseholdEvents(s);
 s.weekly.used=6;
 assert.equal(canApplyDecision(s,'exercise').ok,false);
 tick(s);assert.equal(s.parenthood.missedCareWeeks,0);assert.ok(s.education.active.progressPoints>0);
});

test('P06 grandparent support reads background, transfers only to Anne and cannot be farmed',()=>{
 const durations=[];
 for(const background of ['supportive','demanding']){
  const s=born();s.player.background.family=background;const support=s.openCases.find(c=>c.eventId==='parent_family_support');
  tick(s,4,{parent_family_support:'tell'});
  durations.push(s.parenthood.coveredUntil-s.time.absoluteWeek);
  const child=s.parenthood.children[0];assert.equal(isSecretKnownTo(s,child.id,'anne'),true);assert.equal(isSecretKnownTo(s,child.id,'baba'),false);
  const before=s.parenthood.coveredUntil;assert.equal(choose(s,'parent_family_support','tell',support.id).ok,false);assert.equal(s.parenthood.coveredUntil,before);
 }
 assert.equal(durations[0]-durations[1],3);
});

test('P05 paid care trades real monthly cost for time; P07 relocation uses the existing housing engine',()=>{
 const s=born();tick(s,8,{parent_housing_review:'studio'});assert.equal(s.household.homeId,'studio');
 assert.ok(s.finances.ledger.some(e=>e.reason.includes('taşınma')));
 s.weekly={used:0,selectedIds:[]};assert.equal(applyDecision(s,'parent-budget').ok,true);settleHouseholdEvents(s);
 tick(s,1,{parent_budget_review:'paid'});assert.equal(s.parenthood.carePlan,'paid');assert.equal(parenthoodCosts(s),2900);
 const missed=s.parenthood.missedCareWeeks;tick(s);assert.equal(s.parenthood.missedCareWeeks,0);assert.ok(missed>=0);
});

test('old saves stay neutral, invalid duplicate children are rejected without destructive truncation',()=>{
 const s=family();delete s.parenthood;normalizeEducationCareer(s);assert.deepEqual(s.parenthood,neutralParenthood());
 const b=born();b.parenthood.children.push({...b.parenthood.children[0]});normalizeEducationCareer(b);
 assert.equal(b.parenthood.children.length,2);assert.equal(validateState(b).ok,false);
});

test('520-week parenting path supports sequential children, stage progression, records and deterministic reloads',()=>{
 const a=runParenthoodScenario();assert.deepEqual(runParenthoodScenario(),a);
 assert.equal(a.children.length,2);assert.ok(a.children[1].bornWeek-a.children[0].bornWeek>=96);
 assert.ok(a.stages.includes('Erken çocukluk'));assert.ok(a.years.some(y=>y.household.milestones.some(t=>t.includes('doğdu'))));
 assert.ok(a.maximumCases<=7);assert.ok(a.valid);assert.ok(a.years.length===10);
});

test('520-week disagreement path never forces pregnancy or a child',()=>{
 const a=runParenthoodScenario({noChild:true});assert.deepEqual(runParenthoodScenario({noChild:true}),a);
 assert.equal(a.children.length,0);assert.equal(a.pregnancy,null);assert.ok(a.valid);
});


test('P04 delayed responsibility agreement improves only the co-parent relationship and cleans its case',()=>{
 const s=born(); tick(s,3);
 const care=s.openCases.find(c=>c.eventId==='parent_care_review'&&c.status!=='resolved');
 assert.ok(care); const due=care.dueWeek;
 while(s.time.absoluteWeek<due-1)tick(s);
 assert.equal(advanceWeek(s).ok,true);
 while(s.events.active.eventId!=='parent_care_review') { const d=getEventDefinition(s.events.active.eventId); resolveEvent(s,d.choices.find(c=>getEventChoiceAvailability(s,c.id).ok).id); }
 s.people.find(p=>p.id==='elif').social.trust=70;
 const anne=getRelationship(s,'anne').trust;
 assert.equal(resolveEvent(s,'arrange').ok,true);
 assert.equal(getRelationship(s,'elif').trust,71);
 assert.equal(care.status,'resolved');assert.ok(s.parenthood.coveredUntil>=s.time.absoluteWeek);
 assert.equal(getRelationship(s,'anne').trust,anne);
 assert.ok(s.people.find(p=>p.id==='elif').memories.some(m=>m.type==='care-arrangement'));
 processParenthoodCases(s);assert.equal(s.openCases.some(c=>c.id===care.id),false);
});

test('known pregnancy and the child parent reference survive separation and divorce',()=>{
 const s=pregnant();s.people.find(p=>p.id==='elif').social.tension=70;s.weekly={used:0,selectedIds:[]};
 assert.equal(choose(s,'separation_discussion','separate').ok,true);
 tick(s,6,{separation_review:'divorce'});assert.equal(s.social.currentPartnerNpcId,null);
 assert.equal(s.parenthood.pregnancy.phase,'known');roundtrip(s);
 tick(s,30);assert.equal(s.parenthood.children.length,1);assert.equal(s.parenthood.children[0].otherParentId,'elif');
 assert.equal(validateState(roundtrip(s)).ok,true);
});


test('switching away from paid care cannot erase services already used before month end',()=>{
 const s=born();s.weekly={used:0,selectedIds:[]};
 assert.equal(applyDecision(s,'parent-budget').ok,true);settleHouseholdEvents(s);
 tick(s,1,{parent_budget_review:'paid'});
 assert.equal(applyDecision(s,'parent-budget').ok,true);settleHouseholdEvents(s);
 tick(s,1,{parent_budget_review:'home'});
 assert.equal(s.parenthood.careOwedThisMonth,375);assert.equal(s.parenthood.carePlan,'home');
 roundtrip(s);tick(s,2);
 assert.equal(s.finances.ledger.filter(e=>e.reason==='Aylık çocuk ve bakım gideri').at(-1).amount,-1775);
 assert.equal(s.parenthood.careOwedThisMonth,0);
});


test('fundamental partner refusal is not overwritten by money or repeated planning discussions',()=>{
 const s=family();s.household.union.familyPlan.response='no';
 assert.equal(choose(s,'parent_planning','discuss').ok,true);
 tick(s,4,{parent_planning_review:'discuss'});
 assert.equal(s.household.union.familyPlan.response,'no');assert.equal(canTryParenthood(s),false);
 assert.equal(s.parenthood.pregnancy,null);assert.equal(s.social.currentPartnerNpcId,'elif');
});


test('a previous no-child choice can be reconsidered explicitly without automatically changing partner intent',()=>{
 const s=family();s.household.union.familyPlan.intent='no';s.household.union.familyPlan.response='no';
 assert.equal(applyDecision(s,'parent-plan').ok,true);settleHouseholdEvents(s);
 assert.equal(canApplyDecision(s,'parent-plan').ok,false);
 tick(s,1,{parent_planning_review:'want'});
 assert.equal(s.household.union.familyPlan.intent,'wants');assert.equal(s.household.union.familyPlan.response,'no');
 assert.equal(canTryParenthood(s),false);assert.equal(s.parenthood.pregnancy,null);
});

test('expired preparation is cleaned without losing the known pregnancy or scheduled birth',()=>{
 const s=pregnant();const prep=s.openCases.find(c=>c.eventId==='parent_preparation');
 const birth=s.openCases.find(c=>c.eventId==='parent_birth');
 s.time.absoluteWeek=prep.expiresWeek+1;
 for(let i=0;i<4;i++)processParenthoodCases(s);
 assert.equal(s.openCases.some(c=>c.id===prep.id),false);
 assert.equal(s.openCases.filter(c=>c.id===birth.id).length,1);assert.equal(s.parenthood.pregnancy.phase,'known');
 assert.equal(validateState(roundtrip(s)).ok,true);
});


test('Year File preserves birth from the child entity even when the short shared history has rotated out',()=>{
 const s=born();s.household.history=[];
 tick(s,8);
 assert.deepEqual(s.yearlyHistory.at(-1).parenting.births,['Çocuk 1 bu yıl doğdu.']);
 const summary=JSON.stringify(s.yearlyHistory.at(-1).parenting);
 assert.doesNotMatch(summary,/child-|pregnancy-|CHN-P|otherParentId|dueWeek/);
});
