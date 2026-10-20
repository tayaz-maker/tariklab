import test from 'node:test';import assert from 'node:assert/strict';import{loadGame}from'./racon-harness.mjs';
const game=()=>{const g=loadGame();g.ev('blank("Ekip");enterPlay();S.seed=4242;');return g;};
const police=g=>g.ev('S.week=6;S.komiser={ad:"Komiser Test",baglilik:50,risk:10,acgoz:40,kilitli:false};S.flags.cavusKapali=0;S.dosya=80;');
const paper=(g,kind='tuyo',week=6)=>g.ev(`S.inbox.unshift({id:"contact-paper",kind:${JSON.stringify(kind)},week:${week},title:"Tüyo",body:"Mevcut kâğıt",ucret:5000,kapali:false,read:false});`);
test('fatigue never overwrites injury, leave or military status; actual fired job keeps recovery after next day',()=>{
 const g=game();for(const status of ['yarali','izinli','asker']){g.ev(`S.men[0].durum=${JSON.stringify(status)};S.men[0].yorgunluk=90;S.men[0].lastWorkDay=today();tickFatigue();`);assert.equal(g.ev('S.men[0].durum'),status);}
 const f=game();f.ev('S.jobs.push({id:"injury",kind:"tahsilat",streetId:S.streetHome,prepLeft:0,assigned:[S.men[0].id],phase:"running",tags:[],tickIndex:0});UI.jobId="injury";UI.jobOrders=["ates"];rng=function(){return .2;};finishJob();');
 assert.equal(f.ev('S.men[0].durum'),'yarali');assert.equal(f.ev('S.men[0].iyilesme'),4);f.ev('UI.sahne=null;UI.jobDone=false;doAdvance();');assert.equal(f.ev('S.men[0].durum'),'yarali');assert.equal(f.ev('S.men[0].iyilesme'),3);
});
test('only ready or tired managers can be assigned and benefit, retained assignments reactivate after return/reload',()=>{
 for(const role of ['sokak','kasa','goz'])for(const status of ['hazir','yorgun','yarali','izinli','asker','hapis','olu']){
  const g=game();g.ev(`S.stage="agabey";S.genisleme.crews=[{role:${JSON.stringify(role)},leadId:S.men[0].id}];S.men[0].durum=${JSON.stringify(status)};`);const active=['hazir','yorgun'].includes(status);
  assert.equal(!!g.ev(`crewOfRole(${JSON.stringify(role)})`),active,role+'/'+status);
  assert.equal(g.ev(`actionReason("org-ata",{id:${JSON.stringify(role)},kind:S.men[0].id})`)==='',active);
  if(!active)assert.match(g.ev('drawEkip()'),/Atama korunuyor; görevde değil/);
  g.ev('writeSave();S=loadSave();');assert.equal(g.ev('S.genisleme.crews.length'),1);
  if(status!=='olu'){g.ev('S.men[0].durum="hazir";');assert.ok(g.ev(`crewOfRole(${JSON.stringify(role)})`));}
 }
 const missing=game();missing.ev('S.genisleme.crews=[{role:"kasa",leadId:"missing"}];');assert.equal(missing.ev('crewOfRole("kasa")'),null);
});
test('inactive managers provide no transfer, loyalty, heat or stale gaze deduction',()=>{
 const g=game();g.ev('S.stage="baba";S.genisleme.crews=[{role:"sokak",leadId:S.men[0].id},{role:"kasa",leadId:S.men[1].id},{role:"goz",leadId:S.men[2].id}];S.men.forEach(function(m){m.durum="asker";});S.flags.gozIndirim=1;S.flags.toz=10;S.rep.nam=0;S.cleanKasa=1000;S.dirtyKasa=S.kasa-1000;recalcDosya();');assert.equal(g.ev('S.dosya'),10);const heat=g.ev('S.streets[0].heat'),clean=g.ev('S.cleanKasa');g.ev('genislemeHafta();');assert.equal(g.ev('S.cleanKasa'),clean);assert.equal(g.ev('S.streets[0].heat'),heat);assert.equal(g.ev('S.flags.gozIndirim'),0);
});
test('closed police contact has no discount, decay, tip or immunity; paid protection still works',()=>{
 const g=game();police(g);paper(g,'komiser');g.ev('S.flags.kepenkHafta=S.week;cavusKapat();');assert.equal(g.ev('baskinRiski()'),11.25);assert.equal(g.ev('S.inbox.find(function(p){return p.id==="contact-paper";}).kapali'),true);
 g.ev('komiserHafta();');assert.equal(g.ev('S.komiser.baglilik'),50);g.ev('rng=function(){return 0;};baskinTick();');assert.ok(g.ev('S.inbox.some(function(p){return p.title==="Baskın boşa gitti.";})'));assert.equal(g.ev('S.flags.tuyoHafta||0'),0);
 const noShield=game();police(noShield);noShield.ev('cavusKapat();rng=function(){return 0;};baskinTick();');assert.equal(noShield.ev('S.flags.baskinSay'),1);
});
test('eligible police tip is at most once each week and available again next week',()=>{
 const g=game();police(g);g.ev('rng=function(){return .1;};baskinTick();');assert.equal(g.ev('S.flags.tuyoHafta'),6);g.ev('baskinTick();');assert.equal(g.ev('S.inbox.filter(function(p){return p.kind==="tuyo";}).length'),1);
 g.ev('S.week=7;S.dosya=80;baskinTick();');assert.equal(g.ev('S.flags.tuyoHafta'),7);assert.equal(g.ev('S.inbox.filter(function(p){return p.kind==="tuyo";}).length'),2);
});
test('shutter refuses missing, wrong-kind, closed, old, inactive-contact and poor papers atomically',()=>{
 for(const scenario of ['missing','wrong','closed','old','contact','poor']){const g=game();police(g);if(scenario!=='missing')paper(g,scenario==='wrong'?'komiser':'tuyo',scenario==='old'?5:6);g.ev('S.kasa=10000;cashNormalize(S);');if(scenario==='closed')g.ev('S.inbox[0].kapali=true;');if(scenario==='contact')g.ev('S.flags.cavusKapali=1;');if(scenario==='poor')g.ev('S.kasa=100;cashNormalize(S);');const before=g.ev('JSON.stringify(S)');assert.ok(g.ev('actionReason("kepenk-indir",{id:"contact-paper"})'),scenario);g.ev('act("kepenk-indir",{id:"contact-paper"});');assert.equal(g.ev('JSON.stringify(S)'),before,scenario);}
});
test('shutter shows full price, charges once, preserves protection and rejects duplicate click after reload',()=>{
 const g=game();police(g);paper(g);g.ev('S.kasa=10000;cashNormalize(S);UI.inboxId="contact-paper";');assert.match(g.ev('drawOlaylar()'),/Kepenk indir · ₺2.200/);g.ev('act("kepenk-indir",{id:"contact-paper"});');assert.equal(g.ev('S.kasa'),7800);assert.equal(g.ev('S.flags.kepenkHafta'),6);g.ev('writeSave();S=loadSave();');const once=g.ev('JSON.stringify(S)');g.ev('act("kepenk-indir",{id:"contact-paper"});');assert.equal(g.ev('JSON.stringify(S)'),once);
});
test('migration expires only obsolete contact papers using loaded state, never previous global state',()=>{
 for(const globalOpen of [true,false]){const g=game();police(g);const migrated=g.ev(`S.flags.cavusKapali=${globalOpen?0:1};var other=canonical();other.week=9;other.seed=12345;other.kasa=10000;other.dirtyKasa=10000;other.cleanKasa=0;other.komiser={ad:"Other",baglilik:50,risk:1,acgoz:1,kilitli:false};other.flags.cavusKapali=${globalOpen?1:0};other.flags.kepenkHafta=9;other.inbox=[{id:"old",kind:"tuyo",week:8,kapali:false},{id:"current",kind:"tuyo",week:9,kapali:false},{id:"officer",kind:"komiser",week:9,kapali:false},{id:"history",kind:"chain",week:8,kapali:false}];migrate(other);`);
  assert.equal(migrated.inbox[0].kapali,true);assert.equal(!!migrated.inbox[1].kapali,globalOpen);assert.equal(!!migrated.inbox[2].kapali,globalOpen);assert.equal(migrated.inbox[3].kapali,false);assert.equal(migrated.seed,12345);assert.equal(migrated.week,9);assert.equal(migrated.kasa,10000);assert.equal(migrated.flags.kepenkHafta,9);
 }
});
test('real week rollover expires previous tip and keeps unrelated history and paid protection marker',()=>{
 const g=game();police(g);paper(g);g.ev('S.day=7;S.flags.kepenkHafta=6;S.inbox.push({id:"history",kind:"chain",week:5,kapali:false});doAdvance();');assert.equal(g.ev('S.week'),7);assert.equal(g.ev('S.inbox.find(function(p){return p.id==="contact-paper";}).kapali'),true);assert.equal(g.ev('S.flags.kepenkHafta'),6);
});
test('officer actions require a real open officer paper and active contact, never a generic inbox record',()=>{
 for(const code of ['kom-zarf','kom-sus','kom-tehdit'])for(const state of ['missing','wrong','closed','contact']){const g=game();police(g);if(state!=='missing')paper(g,state==='wrong'?'chain':'komiser');if(state==='closed')g.ev('S.inbox[0].kapali=true;');if(state==='contact')g.ev('S.flags.cavusKapali=1;');const before=g.ev('JSON.stringify(S)');assert.ok(g.ev(`actionReason(${JSON.stringify(code)},{id:"contact-paper"})`));g.ev(`act(${JSON.stringify(code)},{id:"contact-paper"});`);assert.equal(g.ev('JSON.stringify(S)'),before);}
});
test('indictment retains its 20-week interval with new contact guards',()=>{
 const g=game();g.ev('S.week=20;S.flags.iddianame=1;S.flags.iddianameSay=1;');const before=g.ev('JSON.stringify(S)');g.ev('iddianame();');assert.equal(g.ev('JSON.stringify(S)'),before);g.ev('S.week=21;iddianame();');assert.equal(g.ev('S.flags.iddianameSay'),2);
});
