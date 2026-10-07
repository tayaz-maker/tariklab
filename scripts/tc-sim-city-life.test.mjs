import test from 'node:test';
import assert from 'node:assert/strict';
import {validateState} from '../public/games/tc-sim/js/state.js';
import {getMonthlySummary,moveLocation,locationMoveAvailability,returnToFamilyArea,moveHome,getEffectiveCommuteLoad,acceptJobOffer,completePendingJob,enrollEducation} from '../public/games/tc-sim/js/life.js';
import {districtProfile,currentDistrict,locationMoveQuote,locationCommute,businessLocation} from '../public/games/tc-sim/js/locations.js';
import {applySocialAction,canUseSocialAction} from '../public/games/tc-sim/js/social.js';
import {getEducationWeeklyLoad} from '../public/games/tc-sim/js/education.js';
import {startBusiness,processBusinessMonth} from '../public/games/tc-sim/js/bank-business.js';
import {saveGame,loadGame} from '../public/games/tc-sim/js/save.js';
import {advanceWeek} from '../public/games/tc-sim/js/time.js';
import {cityFixture} from './tc-sim-city-fixture.mjs';
const freshWeek=s=>{s.time.absoluteWeek++;s.weekly={used:0,selectedIds:[]};s.events.active=null;s.events.queue=[];};
const load=s=>{const m=new Map(),storage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};assert.ok(saveGame(storage,s).ok);const r=loadGame(storage);assert.ok(r.ok);return r.state;};
test('legacy save retains budget and commute, location save round-trips without changing wedding or body',()=>{
 const s=cityFixture(),before=getMonthlySummary(s),body=structuredClone(load(s).body);assert.deepEqual(getMonthlySummary(load(s)),before);assert.equal(load(s).household.location,undefined);
 assert.ok(moveLocation(s,'kadikoy','shared').ok);const r=load(s);assert.equal(currentDistrict(r).id,'kadikoy');assert.equal(r.player.city,'İstanbul');assert.deepEqual(r.body,body);assert.deepEqual(r.household.union,s.household.union);assert.ok(validateState(r).ok);
});
test('Istanbul moves charge once, affect rent/commute, preserve job and prevent weekly hopping',()=>{
 const s=cityFixture();const q=locationMoveQuote(s,'sisli','shared'),balance=s.finances.balance;assert.ok(moveLocation(s,'sisli','shared').ok);assert.equal(s.finances.balance,balance-q.cost);assert.equal(s.career.jobId,'market');
 const after=structuredClone(s);assert.equal(moveLocation(s,'avcilar','shared').ok,false);assert.deepEqual(s,after);assert.equal(moveHome(s,'studio').ok,false);
 const expensive=getMonthlySummary(s);freshWeek(s);assert.ok(moveLocation(s,'avcilar','shared').ok);const cheap=getMonthlySummary(s);assert.equal(cheap.salary,expensive.salary);assert.ok(cheap.housing<expensive.housing);assert.ok(cheap.otherExpenses<expensive.otherExpenses);assert.ok(getEffectiveCommuteLoad(s)>0);assert.equal(s.openCases.filter(c=>c.eventId==='housing_move_followup').length,2);
});
test('intercity move requires resolving job/school/business, costs three actions and never deletes obligations',()=>{
 const s=cityFixture();assert.equal(locationMoveAvailability(s,'cankaya','shared').ok,false);s.career.jobId=null;
 assert.ok(enrollEducation(s,'vocational_course','part').ok);assert.equal(locationMoveAvailability(s,'cankaya','shared').ok,false);s.education.active=null;
 assert.ok(startBusiness(s,'repair').ok);assert.equal(locationMoveAvailability(s,'cankaya','shared').ok,false);delete s.flags.business;freshWeek(s);
 const debt={id:'city-debt',type:'personal',principal:5000,monthlyPayment:500,linkedAssetId:null,startWeek:1};s.wealth.debts.push(debt);
 assert.ok(moveLocation(s,'cankaya','shared').ok);assert.equal(s.weekly.used,3);assert.equal(s.player.city,'Ankara');assert.equal(s.career.jobId,null);assert.equal(s.wealth.debts[0].principal,5000);assert.ok(s.people.find(p=>p.id==='anne').memories.some(m=>m.type==='location_move'));assert.ok(s.openCases.some(c=>c.payload?.intercity));
 freshWeek(s);assert.ok(returnToFamilyArea(s).ok);assert.equal(s.household.homeId,'family');assert.equal(s.player.city,'İstanbul');assert.equal(currentDistrict(s),null);assert.equal(moveLocation(s,'bornova','shared').ok,false);
});
test('regional job access changes actual start date, not qualification or free salary',()=>{
 const near=cityFixture(),far=cityFixture();near.career.jobId=far.career.jobId=null;
 moveLocation(near,'sisli','shared');moveLocation(far,'avcilar','shared');freshWeek(near);freshWeek(far);
 assert.ok(acceptJobOffer(near,'office').ok);assert.ok(acceptJobOffer(far,'office').ok);assert.equal(far.career.pendingJob.startWeek,near.career.pendingJob.startWeek+1);assert.equal(getMonthlySummary(far).salary,0);
 const p=near.career.pendingJob;near.time.absoluteWeek=p.startWeek;assert.ok(completePendingJob(near,p.caseId));assert.equal(near.career.jobId,'office');assert.ok(locationCommute(near)<locationCommute({...far,career:{...far.career,jobId:'office'}}));
});
test('historical rail dates and economic periods never grant future infrastructure',()=>{
 const s=cityFixture();s.time.date='2017-04-18';assert.equal(districtProfile(s,'uskudar').rail,false);s.time.date='2017-12-15';assert.equal(districtProfile(s,'uskudar').rail,true);
 for(const [id,date] of [['sisli','2000-09-16'],['kadikoy','2012-08-17'],['cankaya','1996-08-30'],['bornova','2000-05-22']]){s.time.date='1985-01-01';assert.equal(districtProfile(s,id).rail,false);s.time.date=date;assert.equal(districtProfile(s,id).rail,true);}
 const rents=['1985-01-01','1999-01-01','2017-01-01','2025-01-01'].map(date=>{s.time.date=date;return districtProfile(s,'sisli').rent;});assert.equal(new Set(rents).size,4);
});
test('education and social travel use real weekly/cash gates; remote conversation remains possible',()=>{
 const s=cityFixture();s.career.jobId=null;moveLocation(s,'batikent','shared');freshWeek(s);assert.ok(enrollEducation(s,'vocational_course','part').ok);const remote=getEducationWeeklyLoad(s);s.household.location.districtId='cankaya';const central=getEducationWeeklyLoad(s);assert.equal(remote.load,central.load+1);
 const balance=s.finances.balance;assert.ok(applySocialAction(s,'mehmet','meet').ok);assert.equal(s.finances.balance,balance-1450);assert.equal(s.weekly.used,2);freshWeek(s);s.finances.balance=0;assert.equal(canUseSocialAction(s,'mehmet','meet').ok,false);
});
test('business keeps its location when owner moves and regional cost settles once per month',()=>{
 const s=cityFixture();moveLocation(s,'bayrampasa','shared');freshWeek(s);assert.ok(startBusiness(s,'repair').ok);assert.equal(s.flags.business.locationId,'bayrampasa');const profile=businessLocation(s);freshWeek(s);moveLocation(s,'sisli','shared');assert.deepEqual(businessLocation(s),profile);
 const before=s.finances.balance;assert.ok(processBusinessMonth(s));const after=s.finances.balance;assert.notEqual(after,before);assert.equal(processBusinessMonth(s),'');assert.equal(s.finances.balance,after);assert.deepEqual(load(s).flags.business,s.flags.business);
});
test('low budget, owner occupation, active events and invalid destination fail without mutations',()=>{
 const s=cityFixture();s.finances.balance=0;let before=structuredClone(s);assert.equal(moveLocation(s,'konak','shared').ok,false);assert.deepEqual(s,before);
 s.finances.balance=100000;s.wealth.properties=[{occupancy:'owner'}];before=structuredClone(s);assert.equal(moveLocation(s,'kadikoy','shared').ok,false);assert.deepEqual(s,before);s.wealth.properties=[];
 s.events.active={eventId:'unexpected'};before=structuredClone(s);assert.equal(moveLocation(s,'sisli','shared').ok,false);assert.deepEqual(s,before);assert.equal(moveLocation(s,'missing','shared').ok,false);
});
test('month end actually collects the displayed transport expense once',()=>{
 const s=cityFixture();moveLocation(s,'avcilar','shared');s.world.scenario.pendingEvent=null;s.time.absoluteWeek=2;s.events.active=null;s.events.queue=[];
 const transport=getMonthlySummary(s).transport;assert.ok(transport>0);assert.ok(advanceWeek(s).ok);const entries=s.finances.ledger.filter(r=>r.description==='Aylık işe ulaşım gideri'||r.reason==='Aylık işe ulaşım gideri');assert.equal(entries.length,1);assert.equal(entries[0].amount,-transport);
});
