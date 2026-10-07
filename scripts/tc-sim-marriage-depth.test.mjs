import {marriageFixture} from './tc-sim-marriage-fixture.mjs';
import test from 'node:test';
import {resolveScenarioChoice} from '../public/games/tc-sim/js/historical-scenarios.js';
import assert from 'node:assert/strict';
import {validateState} from '../public/games/tc-sim/js/state.js';
import {setRomanticInterest,canBecomePartner} from '../public/games/tc-sim/js/social.js';
import {getEventDefinition,getEventChoiceAvailability,resolveEvent,requestHouseholdConversation} from '../public/games/tc-sim/js/events.js';
import {advanceWeek} from '../public/games/tc-sim/js/time.js';
import {getHouseholdFinance} from '../public/games/tc-sim/js/household.js';
import {weddingQuote,weddingFundingAvailability,familyMeetingContext} from '../public/games/tc-sim/js/wedding-planning.js';
import {exchangePortfolio,tradeExchange} from '../public/games/tc-sim/js/exchange.js';
import {getMonthlySummary} from '../public/games/tc-sim/js/life.js';
import {processWealthMonthEnd} from '../public/games/tc-sim/js/wealth.js';
import {saveGame,loadGame,migrateState} from '../public/games/tc-sim/js/save.js';
import {getKnownOpenCases} from '../public/games/tc-sim/js/calendar.js';
import {intimacyAvailability,chooseIntimacy} from '../public/games/tc-sim/js/intimacy.js';
import {canTryParenthood} from '../public/games/tc-sim/js/parenthood.js';
const memoryStorage=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
function choose(s,id){const r=resolveEvent(s,id);assert.equal(r.ok,true,r.message);return r;}
function open(s,event){if(s.time.absoluteWeek<(s.events.cooldowns[event]||0))awaitEvent(s,event);s.events.active=null;s.events.queue=[];const r=requestHouseholdConversation(s,event);assert.equal(r.ok,true,r.message);assert.equal(s.events.active.eventId,event);}
function settleOther(s,target){if(s.world.scenario?.pendingEvent)resolveScenarioChoice(s,'rest');let guard=0;while(s.events.active&&s.events.active.eventId!==target&&guard++<40){const d=getEventDefinition(s.events.active.eventId);const choices=d.choices.filter(c=>getEventChoiceAvailability(s,c.id).ok);const c=choices.find(c=>['later','cancel','private','wait','skip','decline','ignore','space'].includes(c.id))||choices[0];assert.ok(c,d.id);choose(s,c.id);}}
function awaitEvent(s,event){for(let i=0;i<36;i++){if(s.events.active?.eventId===event)return;s.events.queue=s.events.queue.filter(x=>x.eventId===event||x.sourceCaseId);settleOther(s,event);if(s.events.active?.eventId===event)return;{const result=advanceWeek(s);assert.equal(result.ok,true,JSON.stringify(result));}}assert.fail('event not reached: '+event);}
function nextWeek(s){settleOther(s);{const result=advanceWeek(s);assert.equal(result.ok,true,JSON.stringify(result));}}
function reload(s){const m=memoryStorage();assert.equal(saveGame(m,s).ok,true);const r=loadGame(m);assert.equal(r.ok,true);return r.state;}
function plan(s,style='plan'){open(s,'marriage_discussion');choose(s,style);awaitEvent(s,style==='engage'?'engagement_preparation':'marriage_commitment');}

test('relationship -> families -> engagement -> marriage -> shared budget -> mutual child plan uses real event chain',()=>{
 let s=marriageFixture();open(s,'household_families');choose(s,'isteme');assert.ok(s.household.wedding.familiesMet);
 const before=structuredClone(s);assert.equal(requestHouseholdConversation(s,'marriage_discussion').ok,false);assert.deepEqual(s,before,'cannot stack ceremonies in one week');s.events.active=null;nextWeek(s);
 plan(s,'engage');assert.equal(s.household.union.marriedSince,null);assert.ok(getKnownOpenCases(s).some(c=>c.payload?.kind==='engagement'));
 s=reload(s);choose(s,'modest');awaitEvent(s,'marriage_commitment');const quote=weddingQuote(s,'wedding');const cash=s.finances.balance;choose(s,'wedding');const r=s.household.wedding;
 assert.ok(s.household.union.marriedSince);assert.equal(s.finances.balance,cash-quote.gross+quote.familyContribution+r.cashGift);assert.ok(r.goldGift>0);assert.equal(exchangePortfolio(s).find(p=>p.id==='quarter').quantity,r.goldGift);
 assert.ok(s.people.find(p=>p.id==='elif').memories.some(m=>m.type==='marriage'));
 assert.deepEqual(reload(s).wealth.exchange,s.wealth.exchange);
 nextWeek(s);open(s,'cohabitation_discussion');choose(s,'plan');awaitEvent(s,'cohabitation_move');choose(s,'studio');assert.ok(getHouseholdFinance(s).partnerContribution>0);
 nextWeek(s);open(s,'family_intent_discussion');choose(s,'wants');assert.deepEqual(s.household.union.familyPlan,{intent:'wants',response:'wants'});assert.equal(canTryParenthood(s),true);
 s.events.active=null;s.events.queue=[];s.events.active={eventId:'parent_planning',occurrenceId:'marriage-parent-plan'};choose(s,'try_partner');assert.equal(s.parenthood.pregnancy.phase,'trying');assert.equal(validateState(reload(s)).ok,true);
});

test('simple civil marriage needs no family approval, engagement, wedding or prior cohabitation',()=>{
 const s=marriageFixture();s.player.background.family='demanding';open(s,'household_families');choose(s,'informal');nextWeek(s);plan(s);const q=weddingQuote(s,'confirm');s.finances.balance=q.cashNeeded-1;const before=structuredClone(s);assert.equal(resolveEvent(s,'confirm').ok,false);assert.deepEqual(s,before);
 s.finances.balance=q.cashNeeded;choose(s,'confirm');assert.ok(s.household.union.marriedSince);assert.equal(s.household.union.cohabitingSince,null);assert.equal(s.finances.balance,0);assert.equal(s.household.wedding.goldGift,0);
});

test('family objection is recorded, does not veto marriage or create support money',()=>{
 const s=marriageFixture();s.player.background.family='demanding';for(const p of s.people.filter(p=>p.roleId==='family')){p.social.trust=15;p.social.tension=50;}
 open(s,'household_families');choose(s,'informal');assert.equal(s.household.wedding.familyView,'objection');assert.ok(s.household.history.some(h=>h.text.includes('veto etmez')));assert.ok(s.people.find(p=>p.id==='anne').memories.some(m=>m.type==='marriage_families'));
 nextWeek(s);plan(s);choose(s,'confirm');assert.ok(s.household.union.marriedSince);
});

test('wedding loan uses bank underwriting, two activities and existing monthly debt settlement',()=>{
 const s=marriageFixture();plan(s);const q=weddingQuote(s,'financed');s.finances.balance=q.cashNeeded;
 const before=structuredClone(s);for(let i=0;i<3;i++)assert.equal(weddingFundingAvailability(s,'financed').ok,true);assert.deepEqual(s,before,'quote and underwriting are pure');
 choose(s,'financed');const debt=s.wealth.debts.find(d=>d.id===s.household.wedding.loanId);assert.ok(debt);assert.equal(debt.principal,q.credit.total);assert.ok(s.weekly.selectedIds.includes('bank:credit'));assert.ok(s.weekly.selectedIds.includes('household:marriage_commitment'));
 assert.ok(getMonthlySummary(s).wealth.debt>=debt.monthlyPayment);const principal=debt.principal;s.wealth.lastProcessedMonth=-1;processWealthMonthEnd(s);assert.equal(s.wealth.debts.find(d=>d.id===debt.id).principal,principal-debt.monthlyPayment);const balance=s.finances.balance;assert.equal(processWealthMonthEnd(s),false);assert.equal(s.finances.balance,balance);
 s.events.active=null;s.weekly={used:0,selectedIds:[]};s.people.find(p=>p.id==='elif').social.tension=65;open(s,'separation_discussion');choose(s,'separate');assert.equal(getHouseholdFinance(s).partnerContribution,0);awaitEvent(s,'separation_review');choose(s,'divorce');assert.equal(s.social.currentPartnerNpcId,null);assert.ok(s.wealth.debts.length,'divorce does not erase debt');assert.equal(validateState(reload(s)).ok,true);
});

test('eras use different indexed budgets; gifts cannot fund admission or generate round-trip profit',()=>{
 const totals=[];
 for(const date of ['1985-04-18','1999-04-18','2017-04-18','2025-04-18']){
  const s=marriageFixture();plan(s);s.time.date=date;s.time.year=+date.slice(0,4);const q=weddingQuote(s,'wedding');totals.push(q.gross);const start=s.finances.balance;choose(s,'wedding');
  s.events.active=null;s.events.queue=[];const gold=s.wealth.exchange.positions.quarter;if(gold)assert.equal(tradeExchange(s,'quarter','sell',gold.quantity).ok,true);
  assert.ok(s.finances.balance<start,'wedding gifts plus sale never exceed total outlay');
  const planCase=s.openCases.find(c=>c.payload?.kind==='marriage');s.events.active={eventId:'marriage_commitment',occurrenceId:'replay',sourceCaseId:planCase.id};const before=structuredClone(s);assert.equal(resolveEvent(s,'wedding').ok,false);assert.deepEqual(s,before);
 }
 assert.equal(new Set(totals).size,4);
});

test('engagement breakup invalidates delayed wedding, preserves spent money and save compatibility',()=>{
 const s=marriageFixture();plan(s,'engage');const spent=s.finances.balance;s.events.active=null;open(s,'relationship_breakup');choose(s,'end');assert.equal(s.household.union.marriedSince,null);assert.equal(s.finances.balance,spent);assert.equal(setRomanticInterest(s,'elif'),false);
 const old=marriageFixture();delete old.household.wedding;const loaded=reload(old);assert.equal(loaded.household.wedding,undefined);assert.equal(loaded.household.union.marriedSince,null);
 const normalized=migrateState(structuredClone(loaded));assert.equal(normalized.ok,true);assert.deepEqual(normalized.state.household,loaded.household);
});

test('adult/consent and protection affordability gates reject underage, separated and duplicate follow-ups',()=>{
 const s=marriageFixture();s.finances.balance=0;assert.equal(intimacyAvailability(s,'condom').ok,false);assert.equal(intimacyAvailability(s,'talk').ok,true);
 s.finances.balance=1000;s.household.union.separatedSince=1;assert.equal(intimacyAvailability(s,'without_condom').ok,false);s.household.union.separatedSince=null;
 const p=s.people.find(p=>p.id==='elif');p.age=17;assert.equal(intimacyAvailability(s,'condom').ok,false);assert.equal(canTryParenthood(s),false);p.social.romanceStatus='interest';s.social.currentPartnerNpcId=null;assert.equal(canBecomePartner(s,'elif'),false);
 delete p.age;s.social.currentPartnerNpcId='elif';p.social.romanceStatus='partner';assert.equal(chooseIntimacy(s,'without_condom').ok,true);const followup=structuredClone(s.flags.intimacyFollowup);s.weekly={used:0,selectedIds:[]};assert.equal(chooseIntimacy(s,'without_condom').ok,false);assert.deepEqual(s.flags.intimacyFollowup,followup);
});

 test('family expectations use existing family pressure and era without assigning a province stereotype',()=>{
  const s=marriageFixture();s.player.background.family='demanding';s.flags.familyMods={marriagePressure:1};
  for(const p of s.people.filter(p=>p.roleId==='family')){p.social.trust=71;p.social.tension=0;}
  s.time.date='1985-04-18';assert.equal(familyMeetingContext(s).own,'objection');
  s.time.date='2017-04-18';assert.equal(familyMeetingContext(s).own,'reserved');
  s.flags.familyMods.marriagePressure=3;assert.equal(familyMeetingContext(s).own,'objection');
 });
