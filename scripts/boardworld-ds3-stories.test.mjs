import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../public/games/tc-sim-boardworld/engine.mjs';
import { exportGame, importGame } from '../public/games/tc-sim-boardworld/persistence.mjs';
import { initStories, tickStories, storyActions, afterStoryAction, storyView, validateStories } from '../public/games/tc-sim-boardworld/expansion-stories.mjs';
import { localizeStoryText, renderStories } from '../public/games/tc-sim-boardworld/expansion-stories-ui.mjs';
await engine.loadExpansionRuntime();
function step(s,id) {
  const before = JSON.stringify(s), result = engine.resolveAction(s,id);
  assert.equal(result.ok,true,`${id}: ${result.message}`);
  assert.equal(JSON.stringify(s),before);
  assert.ok(engine.validateState(result.state));
  return result.state;
}
function clear(s) {
  while(s.pendingEvents.length) s=step(s,engine.getActions(s).find(a=>a.category==='event'&&!a.disabled).id);
  return s;
}
function ready(s,id) {
  for(let i=0;i<35;i++) { s=clear(s); const action=engine.getActions(s).find(a=>a.id===id); if(action&&!action.disabled) return s; s=step(s,'wait:60'); }
  assert.fail(`Not available: ${id}`);
}
test('a meeting opens a persistent choice whose cost and trust affect later support', () => {
  let s=clear(engine.createGame({seed:49,expansion:true}));
  s=step(s,'world:move:ankara');
  s=step(ready(s,'district:visit:ankara:kizilay:social'),'district:visit:ankara:kizilay:social');
  const resident='resident:ankara:0';
  s=step(ready(s,`district:meet:${resident}`),`district:meet:${resident}`);
  assert.equal(s.expansion.stories.arcs[0].status,'open');
  const viewBefore=JSON.stringify(s); storyView(s); assert.equal(JSON.stringify(s),viewBefore);
  const help=`story:help:${resident}`;
  s=ready(s,help);
  const funds=s.cash+s.bank, start=s.time;
  const declined=step(s,`story:decline:${resident}`);
  assert.equal(declined.expansion.districts.contacts[resident].score,1);
  assert.equal(declined.expansion.stories.arcs[0].status,'declined');
  const listened=step(s,`story:listen:${resident}`);
  assert.equal(listened.expansion.districts.contacts[resident].score,8);
  assert.equal(listened.expansion.stories.arcs[0].status,'listened');
  const n=step(s,help);
  assert.equal(funds-(n.cash+n.bank),100);
  assert.equal(n.time-start,60);
  const account=state=>state.expansion.economy.residents[resident];
  assert.equal(account(n).cash-account(s).cash,100);
  assert.equal(account(n).savings,account(s).savings);
  assert.equal(account(n).debt,account(s).debt);
  assert.deepEqual(importGame(exportGame(n)).state,n);
  assert.equal(n.expansion.districts.contacts[resident].score,15);
  assert.equal(n.expansion.stories.arcs[0].status,'helped');
  assert.ok(n.expansion.society.connections[resident].memory.some(m=>m.kind==='story.helped'));
  assert.equal(engine.getActions(n).some(a=>a.id===help),false);
  assert.ok(validateStories(n));
  const support=`story:support:${resident}`;
  const later=ready(n,support), supported=step(later,support);
  assert.equal(supported.expansion.stories.arcs[0].supportCount,1);
  assert.ok(supported.expansion.stories.arcs[0].nextSupportAt > supported.time);
  assert.equal(engine.getActions(supported).some(a=>a.id===support),false);
  const bad=structuredClone(n); bad.expansion.stories.arcs[0].supportCount=100; assert.equal(validateStories(bad),false);

  const short=structuredClone(s); short.bank=0; short.cash=99;
  assert.equal(engine.getActions(short).find(a=>a.id===help).reason,'Bu destek için yeterli bakiye yok.');
  assert.strictEqual(engine.resolveAction(short,help).state,short);
  const saturated=structuredClone(s); account(saturated).cash=1e9-1;
  assert.equal(engine.getActions(saturated).find(a=>a.id===help).reason,'Bu destek şu anda kabul edilemiyor.');
  assert.strictEqual(engine.resolveAction(saturated,help).state,saturated);

  // Prepared shortfall. Both branches start at the same hour with a household
  // unable to pay its next meal or receive wages that day.
  const shortfall=structuredClone(s), nextDay=(Math.floor(s.time/1440)+1)*1440;
  Object.assign(account(shortfall),{cash:Math.round(90*s.expansion.world.regions.ankara.price/100)-1,savings:0,employment:'searching'});
  account(shortfall).life.employer='';
  const settle=state=>{
    while(state.time<nextDay) state=step(clear(state),'wait:60');
    return state;
  };
  assert.ok(account(settle(step(shortfall,help))).life.health>account(settle(step(shortfall,'wait:60'))).life.health);
});
test('story copy is localized in all three languages',()=>{
  const view={family:{player:{id:'player:1'}},stories:{arcs:[{owner:'player:1',person:'resident:ankara:0',generation:1,name:'Deniz',status:'open',startedAt:0}]}};
  for(const [language,title] of [['tr','İlişki hikâyeleri'],['en','Relationship stories'],['pl','Historie relacji']]) {
    const html=renderStories({view,actions:[],esc:String,language,actionCard:()=>''});
    assert.ok(html.includes(title));
  }
  assert.equal(localizeStoryText('Komşuya destek ol','en'),'Help your neighbour');
  assert.equal(localizeStoryText('Komşuya destek ol','pl'),'Pomóż sąsiadowi');
  for (const copy of [
    'Komşunun hane kasasına 100 TL aktar. Bağınız güçlenir.',
    'Komşunun hane kasasına 100 TL aktardın. Bağınız güçlendi.',
    'Belediyeye 100 TL eğitim ücreti öde. Komşunun mesleki becerisi gelişir.',
    'Belediye eğitim ücretini aldı. Komşunun mesleki becerisi gelişti.',
    'Destek tamamlanamadı. Ödeme iade edildi.',
  ]) {
    assert.equal(localizeStoryText(copy,'tr'),copy);
    for (const language of ['en','pl']) assert.notEqual(localizeStoryText(copy,language),copy);
  }
});

test('school-age family story tracks the choice made through the family system',()=>{
  const s={time:3000, expansion:{deepSociety:3,playerId:'player:1',family:{people:[{id:'family:2',name:'Ada',born:-200,died:null,parents:['player:1']}]}}};
  initStories(s); tickStories(s);
  assert.equal(s.expansion.stories.family[0].status,'open');
  const before=structuredClone(s);
  afterStoryAction(s,'family:focus:family:2:craft',before,{});
  assert.equal(s.expansion.stories.family[0].status,'study');
  assert.equal(validateStories(s),true);
  tickStories(s); assert.equal(s.expansion.stories.family.length,1);
});
test('business pressure follows the actual funding or pause action',()=>{
  const s={time:3000,deep:{business:{id:'repair',status:'active'}},living:{enterprise:{capital:200}},expansion:{deepSociety:3,playerId:'player:1',family:{people:[]}}};
  initStories(s); tickStories(s);
  assert.equal(s.expansion.stories.business[0].status,'open');
  const before=structuredClone(s);
  afterStoryAction(s,'business:fund:500',before,{});
  assert.equal(s.expansion.stories.business[0].status,'funded');
  assert.ok(validateStories(s));
});

// Controlled state fixtures isolate the three resident branches; the first test
// above exercises the actual engine resolver and fresh-game meeting journey.
test('controlled resident fixtures: training, debt conservation and trusted referral',async()=>{
  const {payResidentDebt}=await import('../public/games/tc-sim-boardworld/expansion-economy.mjs');
  const id='resident:ankara:0', place={regionId:'ankara',districtId:'ankara:cankaya'};
  const setup=(employment,history,debt)=>{
    const s=engine.createGame({seed:49,expansion:true});
    s.expansion.economy.residents[id].debt=debt;
    s.expansion.districts={contacts:{[id]:{generation:1,score:5,name:'Deniz Aydın',lastDay:1}}};
    const resident={id,health:82,generation:1,name:'Deniz Aydın',employment,history,debt,skill:35,presentDistrictId:place.districtId};
    const api={getPlace:()=>place,regionalResidents:()=>[resident],payResidentDebt,receive:(n,v,_label,account)=>{n[account]+=v;},skill:(n,k,v)=>{n.player.skills[k]=Math.min(100,n.player.skills[k]+v);},change:()=>{}};
    const before=structuredClone(s); afterStoryAction(s,`district:meet:${id}`,before,api);
    return {s,api};
  };
  const training=setup('searching',[],0);
  assert.equal(training.s.expansion.stories.arcs[0].kind,'ambition');
  let option=storyActions(training.s,training.api).find(a=>a.id===`story:train:${id}`);
  assert.equal(option.cost,100); const skill=training.s.expansion.economy.residents[id].life.skill;
  let before=structuredClone(training.s); training.s.bank-=option.cost; training.s.time+=option.minutes;
  afterStoryAction(training.s,option.id,before,training.api,option);
  assert.equal(training.s.expansion.economy.residents[id].life.skill,skill+4);
  assert.equal(training.s.expansion.institutions.regions.ankara.treasury-before.expansion.institutions.regions.ankara.treasury,100);
  assert.equal(training.s.expansion.economy.residents[id].cash,before.expansion.economy.residents[id].cash);
  assert.equal(training.s.expansion.economy.activity[id].history.at(-1).kind,'training');
  assert.equal(training.s.expansion.districts.contacts[id].score,15);
  training.s.time+=1440; const knowledge=training.s.player.skills.knowledge;
  option=storyActions(training.s,training.api).find(a=>a.id===`story:referral:${id}`);
  assert.ok(option); before=structuredClone(training.s); training.s.time+=option.minutes;
  afterStoryAction(training.s,option.id,before,training.api,option);
  assert.equal(training.s.player.skills.knowledge,Math.min(100,knowledge+2));
  assert.equal(storyActions(training.s,training.api).some(a=>a.id===option.id),false);
  const migration=setup('employed',[{generation:1,kind:'move',day:1}],80);
  assert.equal(migration.s.expansion.stories.arcs[0].kind,'migration');
  option=storyActions(migration.s,migration.api).find(a=>a.id===`story:relocate:${id}`);
  assert.equal(option.cost,80); const money=migration.s.cash+migration.s.bank;
  before=structuredClone(migration.s); migration.s.cash-=option.cost; migration.s.time+=option.minutes;
  afterStoryAction(migration.s,option.id,before,migration.api,option);
  assert.equal(migration.s.expansion.economy.residents[id].debt,0);
  assert.equal(money-migration.s.cash-migration.s.bank,80);
  const indebted=setup('employed',[],80);
  assert.equal(indebted.s.expansion.stories.arcs[0].kind,'loyalty');
  option=storyActions(indebted.s,indebted.api).find(a=>a.id===`story:repay:${id}`);
  assert.ok(option); assert.equal(option.cost,80);
  const funds=indebted.s.cash+indebted.s.bank; before=structuredClone(indebted.s);
  indebted.s.cash-=option.cost; indebted.s.time+=option.minutes;
  afterStoryAction(indebted.s,option.id,before,indebted.api,option);
  assert.equal(indebted.s.expansion.economy.residents[id].debt,0);
  assert.equal(funds-indebted.s.cash-indebted.s.bank,80);
  assert.equal(indebted.s.expansion.stories.arcs[0].status,'helped');
  assert.ok(indebted.s.expansion.society.connections[id].memory.some(m=>m.kind==='story.helped'));
  const reduced=setup('employed',[{generation:1,kind:'move',day:1}],80);
  option=storyActions(reduced.s,reduced.api).find(a=>a.id===`story:relocate:${id}`);
  const initial=reduced.s.cash+reduced.s.bank; before=structuredClone(reduced.s);
  reduced.s.cash-=option.cost; reduced.s.expansion.economy.residents[id].debt=30; reduced.s.time+=option.minutes;
  afterStoryAction(reduced.s,option.id,before,reduced.api,option);
  assert.equal(initial-reduced.s.cash-reduced.s.bank,30);
  assert.equal(reduced.s.expansion.economy.residents[id].debt,0);
  const interrupted=setup('searching',[],0); option=storyActions(interrupted.s,interrupted.api).find(a=>a.id===`story:train:${id}`);
  const initialFunds=interrupted.s.cash+interrupted.s.bank; before=structuredClone(interrupted.s);
  interrupted.s.bank-=option.cost; interrupted.s.time+=option.minutes-1;
  afterStoryAction(interrupted.s,option.id,before,interrupted.api,option);
  assert.equal(interrupted.s.cash+interrupted.s.bank,initialFunds);
  assert.equal(interrupted.s.expansion.stories.arcs[0].status,'open');
  const replaced=setup('searching',[],0); option=storyActions(replaced.s,replaced.api).find(a=>a.id===`story:train:${id}`);
  const priorFunds=replaced.s.cash+replaced.s.bank, oldSkill=replaced.s.expansion.economy.residents[id].life.skill;
  before=structuredClone(replaced.s); replaced.s.bank-=option.cost; replaced.s.time+=option.minutes;
  replaced.s.expansion.economy.residents[id].life.generation++;
  afterStoryAction(replaced.s,option.id,before,replaced.api,option);
  assert.equal(replaced.s.cash+replaced.s.bank,priorFunds);
  assert.equal(replaced.s.expansion.economy.residents[id].life.skill,oldSkill);
  const deceased=setup('searching',[],0); option=storyActions(deceased.s,deceased.api).find(a=>a.id===`story:train:${id}`);
  const deceasedFunds=deceased.s.cash+deceased.s.bank; before=structuredClone(deceased.s);
  deceased.s.bank-=option.cost; deceased.s.time+=option.minutes;
  deceased.s.expansion.family.people.find(p=>p.id===deceased.s.expansion.playerId).died=1;
  afterStoryAction(deceased.s,option.id,before,deceased.api,option);
  assert.equal(deceased.s.cash+deceased.s.bank,deceasedFunds);
  const capacity=setup('searching',[],0);
  const budget=state=>state.expansion.institutions.regions.ankara;
  const train=`story:train:${id}`;
  budget(capacity.s).treasury=1e9-99;
  assert.equal(storyActions(capacity.s,capacity.api).find(a=>a.id===train).reason,'Bu destek şu anda kabul edilemiyor.');
  budget(capacity.s).treasury=1e9-100;
  capacity.s.bank=60; capacity.s.cash=40;
  option=storyActions(capacity.s,capacity.api).find(a=>a.id===train);
  assert.equal(option.disabled,false);
  before=structuredClone(capacity.s);
  capacity.s.bank=0; capacity.s.cash=0; capacity.s.time+=option.minutes;
  budget(capacity.s).treasury++;
  const cancelled=afterStoryAction(capacity.s,option.id,before,capacity.api,option);
  assert.equal(cancelled,'Destek tamamlanamadı. Ödeme iade edildi.');
  assert.deepEqual([capacity.s.bank,capacity.s.cash],[60,40]);
  assert.equal(budget(capacity.s).treasury,1e9-99);
  assert.equal(capacity.s.expansion.economy.residents[id].life.skill,before.expansion.economy.residents[id].life.skill);
  assert.equal(capacity.s.expansion.districts.contacts[id].score,5);
  assert.equal(capacity.s.expansion.stories.arcs[0].status,'open');

  const away=setup('employed',[],0), help=`story:help:${id}`;
  const late=structuredClone(away.s);
  late.time=late.expansion.stories.arcs[0].until-30;
  assert.equal(storyActions(late,away.api).find(a=>a.id===help).reason,'Bu görüşme bitmeden destek süresi doluyor.');
  option=storyActions(away.s,away.api).find(a=>a.id===help);
  before=structuredClone(away.s);
  away.s.bank-=option.cost; away.s.time+=option.minutes;
  away.api.regionalResidents=()=>[];
  afterStoryAction(away.s,help,before,away.api,option);
  assert.equal(away.s.bank,before.bank);
  assert.equal(away.s.expansion.economy.residents[id].cash,before.expansion.economy.residents[id].cash);
  assert.equal(away.s.expansion.stories.arcs[0].status,'open');
  const stale=setup('searching',[],0); stale.s.expansion.family.people=stale.s.expansion.family.people.filter(p=>p.id!==stale.s.expansion.playerId);
  tickStories(stale.s); assert.equal(stale.s.expansion.stories.arcs.length,0);
});
test('controlled case fixture records only a reported personal case and disclosed evidence',()=>{
  const s=engine.createGame({seed:49,expansion:true});
  const owner=s.expansion.playerId;
  s.expansion.underworld={cases:[{id:1,reportedAt:100,status:'investigation'},{id:2,reportedAt:null,status:'unreported'}],incidents:[{id:1,personId:owner,evidence:[{learnedAt:300},{learnedAt:null}]},{id:2,personId:owner,evidence:[]}]};
  tickStories(s); assert.equal(s.expansion.stories.justice.length,1);
  assert.equal(s.expansion.stories.justice[0].evidence,1);
  s.expansion.underworld.cases[0].status='review'; s.expansion.underworld.incidents[0].evidence[1].learnedAt=400;
  tickStories(s); assert.equal(s.expansion.stories.justice[0].stage,'review'); assert.equal(s.expansion.stories.justice[0].evidence,2);
  s.expansion.playerId='family:2'; s.expansion.underworld.cases[0].status='acquitted';
  tickStories(s); assert.equal(s.expansion.stories.justice[0].stage,'acquitted');
  assert.equal(validateStories(s),true);
});
