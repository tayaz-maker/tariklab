import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame} from './racon-harness.mjs';
const game=()=>{const g=loadGame();g.ev('blank("Bölge");enterPlay();S.seed=4242;');return g;};
function districtFixture(g,{owned=3,loyalty=20,manager=false,city=false,id='kuzey'}={}){
 g.ev(`S.stage="baba";S.streets.forEach(function(s,i){s.sahip=i<${owned}?"sen":"bos";});var district=semtBy(${JSON.stringify(id)});district.acik=true;district.sadakat=${loyalty};S.genisleme.sehir.acik=${city};S.genisleme.crews=${manager?'[{role:"sokak",leadId:S.men[0].id}]':'[]'};S.men[0].durum="hazir";`);
}
test('cash forecast includes only eligible district and city pay, projects manager before pay and city after pay',()=>{
 for(const owned of [2,3])for(const loyalty of [18,19,20])for(const manager of [false,true])for(const city of [false,true])for(const id of ['kuzey','esik']){
  const g=game();districtFixture(g,{owned,loyalty,manager,city,id});
  const before=g.ev('JSON.stringify(S)');
  const pay=owned>=3&&loyalty+(manager?2:0)>=20?(id==='esik'?4000:2500):0;
  const expected=g.ev('weeklyPassive()+S.streets.reduce(function(n,s){return n+(s.sahip==="sen"?num(s.yatirim,0)*window.RaconAg.YATIRIM_GELIR:0);},0)')+pay+(city?1500:0);
  const rendered=g.ev('drawKasa()');
  assert.ok(rendered.includes('Gelir ₺'+expected.toLocaleString('tr-TR')+' ·'),JSON.stringify({owned,loyalty,manager,city,id,expected}));
  assert.equal(g.ev('JSON.stringify(S)'),before,'forecast must not consume RNG or alter state');
  const cash=g.ev('S.kasa');g.ev('genislemeHafta()');assert.equal(g.ev('S.kasa')-cash,pay+(city?1500:0));
 }
});
test('cash manager cleaning is a transfer, not recurring income or another payment',()=>{
 const g=game();districtFixture(g);g.ev('S.genisleme.crews=[{role:"kasa",leadId:S.men[0].id}];S.dirtyKasa=2000;S.cleanKasa=S.kasa-2000;');
 const expected=g.ev('weeklyPassive()+2500');assert.ok(g.ev('drawKasa()').includes('Gelir ₺'+expected.toLocaleString('tr-TR')+' ·'));
 const cash=g.ev('S.kasa'),clean=g.ev('S.cleanKasa'),dirty=g.ev('S.dirtyKasa');
 g.ev('genislemeHafta()');assert.equal(g.ev('S.kasa')-cash,2500);assert.equal(g.ev('S.dirtyKasa'),dirty-800);assert.equal(g.ev('S.cleanKasa')-clean,3300);
});
test('new weekly seal blocks planning and rival relations until next weekly closing and survives save reload',()=>{
 const g=game();g.ev('var st=S.streets[1];st.sahip="rakip";st.heat=100;st.terorMahalle=68;S.rivals[0].husumet=100;UI.planStreet=st.id;UI.planKind="tahsilat";terorSadakatTick();');
 assert.equal(g.ev('S.streets[1].terorMahalle'),72);assert.equal(g.ev('S.streets[1].muhurLeft'),1);
 assert.match(g.ev('actionReason("planla",{})'),/mühürlü/);
 assert.match(g.ev('window.RaconAg.reason(S,S.streets[1].id,"iliski")'),/Mühürlü/);
 assert.equal(g.ev('S.inbox.filter(function(p){return p.title.indexOf("Mühür:")===0;}).length'),1);
 assert.ok(g.ev('S.inbox.some(function(p){return p.body.indexOf("bu hafta kilitli")>=0;})'));
 g.ev('writeSave();S=loadSave();');assert.equal(g.ev('S.streets[1].muhurLeft'),1);
 const before=g.ev('JSON.stringify(S)');g.ev('act("planla",{});');assert.equal(g.ev('JSON.stringify(S)'),before);
 g.ev('terorSadakatTick()');assert.equal(g.ev('S.streets[1].muhurLeft'),0);
 assert.equal(g.ev('S.inbox.filter(function(p){return p.title.indexOf("Mühür:")===0;}).length'),1,'remaining above threshold must not renew the seal');
});
test('seal still permits withdrawal from a controlled non-home street and retains prepared jobs',()=>{
 const g=game();g.ev('S.streets[1].sahip="sen";S.streets[1].muhurLeft=1;');
 assert.equal(g.ev('window.RaconAg.reason(S,S.streets[1].id,"cekil")'),'');
 assert.match(g.ev('window.RaconAg.reason(S,S.streets[1].id,"koru")'),/Mühürlü/);
 assert.match(g.ev('window.RaconAg.reason(S,S.streets[1].id,"yatirim")'),/Mühürlü/);
 g.ev('S.jobs.push({id:"prepared",streetId:S.streets[1].id,phase:"prepared",assigned:[S.men[0].id],prepLeft:0});S.streets[1].heat=100;S.streets[1].terorMahalle=68;terorSadakatTick();');
 assert.equal(g.ev('S.jobs.some(function(j){return j.id==="prepared";})'),true);
});
