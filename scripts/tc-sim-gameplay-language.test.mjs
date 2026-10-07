import test from 'node:test';
import assert from 'node:assert/strict';
import {gameplayText,caseTiming,inboxCases,recentNotices,snapshotDecision,decisionFeedback} from '../public/games/tc-sim/js/gameplay-language.js';
import {tradeExchange} from '../public/games/tc-sim/js/exchange.js';
import {moveLocation} from '../public/games/tc-sim/js/life.js';
import {saveGame,loadGame} from '../public/games/tc-sim/js/save.js';
import {cityFixture} from './tc-sim-city-fixture.mjs';
const money=n=>`${n} TL`;
test('legacy terminology is presentation-only and keeps names and unrelated prose',()=>{
 assert.equal(gameplayText('Nominal karşılık'),'O yılın parasıyla');assert.equal(gameplayText('Sistem etkisi'),'Hayatına etkisi');assert.equal(gameplayText('Ayşe ile görüştün.'),'Ayşe ile görüştün.');
});
test('inbox orders actionable dates, excludes active duplicates and hidden followups without writes',()=>{
 const s=cityFixture();s.time.absoluteWeek=10;s.openCases=[{id:'later',dueWeek:12},{id:'old',dueWeek:8},{id:'now',dueWeek:10},{id:'hidden',type:'social-followup'},{id:'health',type:'health-followup',payload:{playerKnown:false}},{id:'active',dueWeek:9},{id:'old',dueWeek:8}];s.events.active={sourceCaseId:'active'};
 const before=structuredClone(s);assert.deepEqual(inboxCases(s).map(x=>x.item.id),['old','now','later']);assert.match(inboxCases(s)[0].label,/2 haftadır/);assert.deepEqual(s,before);assert.equal(caseTiming({},10).label,'Takipte');
});
test('duplicate same-week memories collapse but recurrence in another week survives',()=>{
 const s=cityFixture();s.memories=[{text:'Kirayı ödedin.',week:1,year:2017},{text:'Kirayı ödedin.',week:2,year:2017},{text:'Kirayı ödedin.',week:2,year:2017}];assert.equal(recentNotices(s).length,2);assert.equal(recentNotices(s,['Kirayı ödedin.']).length,1);
});
test('legacy save projection is read-only and does not invent state',()=>{
 const s=cityFixture();delete s.wealth.exchange;const before=structuredClone(s);snapshotDecision(s);assert.deepEqual(s,before);
 const m=new Map(),storage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};assert.ok(saveGame(storage,s).ok);const r=loadGame(storage);assert.ok(r.ok);const loaded=structuredClone(r.state);snapshotDecision(r.state);assert.deepEqual(r.state,loaded);
});
test('actual exchange buy and complete sale report quantity, cash and purpose without extra mutations',()=>{
 const s=cityFixture();for(const side of ['buy','sell']){const before=snapshotDecision(s),r=tradeExchange(s,'USD',side,10);assert.ok(r.ok);const after=structuredClone(s),text=decisionFeedback(before,s,r,money);assert.match(text,/Cüzdanın:/);assert.match(text,/10/);assert.match(text,side==='buy'?/aldın/:/sattın/);assert.deepEqual(s,after);}
});
test('actual relocation reports paid cost and changed housing, failed decision reveals no future',()=>{
 const s=cityFixture(),before=snapshotDecision(s),r=moveLocation(s,'avcilar','shared');assert.ok(r.ok);const after=structuredClone(s),text=decisionFeedback(before,s,r,money);assert.match(text,/Cüzdanın:/);assert.match(text,/Aylık konut giderin/);assert.deepEqual(s,after);assert.equal(decisionFeedback(before,s,{ok:false,reason:'Bu hafta taşındın.'},money),'Bu hafta taşındın.');
});
test('feedback uses only public relationship gauges and no hidden health or event payload',()=>{
 const s=cityFixture(),before=snapshotDecision(s);s.people[0].social.trust+=3;s.body.secret='GİZLİ SAĞLIK';s.openCases.push({id:'secret',type:'social-followup',payload:{text:'GİZLİ GELECEK'}});const after=structuredClone(s),text=decisionFeedback(before,s,{ok:true,message:'Görüştünüz.'},money);assert.match(text,/güven arttı/);assert.doesNotMatch(text,/GİZLİ/);assert.deepEqual(s,after);
});
