import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./racon-harness.mjs";

function game() {
  const g = loadGame();
  g.ev('blank("Erteleme");enterPlay();S.seed=4242;UI.fastJob=true;');
  return g;
}
function html(g) {
  return g.document.getElementById("nav").innerHTML;
}
function stage(g) {
  return g.document.getElementById("stage").innerHTML;
}

test("old save without genisleme keeps racon_v1, six streets, and closed districts", () => {
  const g = game();
  g.ev("var raw=canonical(); delete raw.genisleme; S=migrate(raw);");
  assert.equal(g.ev("S.kind"), "racon_v1");
  assert.equal(g.ev("S.streets.length"), 6);
  assert.equal(g.ev("S.genisleme.version"), 1);
  assert.deepEqual(g.ev("S.genisleme.crews"), []);
  assert.equal(g.ev("S.genisleme.semtler.filter(function(s){return s.acik;}).length"), 1);
  assert.equal(g.ev("S.genisleme.sehir.acik"), false);
  g.ev('var raw=canonical(); raw.genisleme={crews:[{role:"kral",leadId:"x"},{role:"sokak",leadId:"m_hasan"},null],semtler:[{id:"kuzey",acik:true,sadakat:10,visitWeek:3}],sehir:{acik:true,ad:"Sahte",week:4}}; S=migrate(raw);');
  assert.deepEqual(g.ev("S.genisleme.crews"), [{ role: "sokak", leadId: "m_hasan" }]);
  assert.equal(g.ev('semtBy("kuzey").acik'), true);
  assert.equal(g.ev('semtBy("kuzey").sadakat'), 10);
  assert.equal(g.ev("S.genisleme.sehir.ad"), "Uzak Terminal");
  assert.equal(g.ev("S.streets.length"), 6);
});

test("serseri nav has neither the new desks nor a lock class", () => {
  const g = game();
  g.ev("render();");
  const nav = html(g);
  assert.doesNotMatch(nav, /navbtn lock/);
  assert.doesNotMatch(nav, /data-id="(?:mahalleler|ekip|masa|aklama|savci|hanedan)"/);
  g.ev('S.kasa=500000;cashNormalize(S);S.streets.forEach(function(s,i){if(i<3)s.sahip="sen";});');
  const before = g.ev("S.kasa");
  assert.match(g.ev('actionReason("semt-ac",{id:"kuzey"})'), /Ağabey/);
  g.ev('act("semt-ac",{id:"kuzey"});');
  assert.equal(g.ev('semtBy("kuzey").acik'), false);
  assert.equal(g.ev("S.kasa"), before);
});

test("ağabey opens Kuzey only with cash and three streets; Eşik waits for Kuzey", () => {
  const g = game();
  g.ev('S.stage="agabey";S.kasa=200000;cashNormalize(S);');
  assert.match(g.ev('actionReason("semt-ac",{id:"kuzey"})'), /üç sokak/);
  g.ev('S.streets.forEach(function(s,i){if(i<3)s.sahip="sen";});S.kasa=1000;cashNormalize(S);');
  assert.match(g.ev('actionReason("semt-ac",{id:"kuzey"})'), /80\.000/);
  g.ev('act("semt-ac",{id:"kuzey"});');
  assert.equal(g.ev('semtBy("kuzey").acik'), false);
  assert.equal(g.ev("S.kasa"), 1000);
  assert.equal(g.ev("S.streets.length"), 6);
  g.ev("S.kasa=200000;cashNormalize(S);");
  assert.match(g.ev('actionReason("semt-ac",{id:"esik"})'), /Kuzey/);
  g.ev('act("semt-ac",{id:"kuzey"});');
  assert.equal(g.ev('semtBy("kuzey").acik'), true);
  assert.equal(g.ev('semtBy("kuzey").sadakat'), 40);
  assert.equal(g.ev("S.kasa"), 120000);
  assert.equal(g.ev("S.streets.length"), 6);
  g.ev('act("semt-ac",{id:"esik"});');
  assert.equal(g.ev('semtBy("esik").acik'), true);
  assert.equal(g.ev("S.kasa"), 0);
  g.ev('act("nav",{id:"mahalleler"});');
  assert.match(stage(g), /Kuzey Avlu/);
  assert.doesNotMatch(stage(g), /undefined|NaN/);
});

test("organization rejects the dead and jailed, keeps the roster, and gives one seat", () => {
  const g = game();
  g.ev('S.stage="agabey";S.men[0].durum="olu";S.men[1].durum="hapis";');
  assert.match(g.ev('actionReason("org-ata",{id:"sokak",kind:S.men[0].id})'), /oturamaz/);
  assert.match(g.ev('actionReason("org-ata",{id:"kasa",kind:S.men[1].id})'), /oturamaz/);
  g.ev('act("org-ata",{id:"sokak",kind:S.men[0].id});act("org-ata",{id:"kasa",kind:S.men[1].id});');
  assert.equal(g.ev("S.genisleme.crews.length"), 0);
  assert.equal(g.ev("S.men.length"), 3);
  const id = g.ev("S.men[2].id");
  const wage = g.ev("S.men[2].yevmiye");
  g.ev(`act("org-ata",{id:"sokak",kind:${JSON.stringify(id)}});act("org-ata",{id:"kasa",kind:${JSON.stringify(id)}});`);
  assert.equal(g.ev('crewOfRole("sokak")'), null);
  assert.equal(g.ev('crewOfRole("kasa").id'), id);
  assert.equal(g.ev("S.men[2].yevmiye"), wage);
  assert.equal(g.ev("S.men.length"), 3);
  g.ev('act("nav",{id:"ekip"});');
  assert.match(stage(g), /Kasa/);
  assert.doesNotMatch(stage(g), /undefined|NaN/);
  assert.match(html(g), /data-id="ekip"/);
  assert.doesNotMatch(html(g), /navbtn lock|data-id="masa"/);
});

test("weekly crew, district pay, loyalty collapse, and the week hook", () => {
  const g = game();
  g.ev('S.stage="agabey";S.streets.forEach(function(s,i){if(i<3)s.sahip="sen";});S.kasa=200000;cashNormalize(S);act("semt-ac",{id:"kuzey"});');
  g.ev('act("org-ata",{id:"sokak",kind:S.men[2].id});act("org-ata",{id:"kasa",kind:S.men[1].id});');
  g.ev('streetBy(S.streetHome).heat=10;S.dirtyKasa=5000;S.cleanKasa=S.kasa-5000;');
  g.ev("genislemeHafta();");
  assert.equal(g.ev("streetBy(S.streetHome).heat"), 9);
  assert.equal(g.ev("S.cleanKasa"), g.ev("S.kasa-4200"));
  assert.equal(g.ev("S.kasa"), 122500);
  assert.equal(g.ev('semtBy("kuzey").sadakat'), 42);
  assert.ok(g.ev('S.defter.some(function(l){return l.indexOf("800 temizlendi")>=0;})'));
  g.ev('semtBy("kuzey").sadakat=4;S.genisleme.crews=[];S.streets.forEach(function(s,i){if(i)s.sahip="bos";});genislemeHafta();');
  assert.equal(g.ev('semtBy("kuzey").acik'), false);
  assert.equal(g.ev('semtBy("kuzey").sadakat'), 0);
  assert.ok(g.ev('S.inbox.some(function(p){return p.title.indexOf("koptu")>=0;})'));
  g.ev('S.streets.forEach(function(s,i){if(i<3)s.sahip="sen";});S.kasa=200000;cashNormalize(S);act("semt-ac",{id:"kuzey"});S.day=7;S.defter=[];doAdvance();');
  assert.ok(g.ev('S.defter.some(function(l){return l.indexOf("Kuzey Avlu payı")>=0;})'));
  assert.equal(g.ev("S.streets.length"), 6);
});

test("baba is required for the city desk; poor cash is a no-op; save reloads", () => {
  const g = game();
  g.ev('S.stage="agabey";S.streets.forEach(function(s,i){if(i<3)s.sahip="sen";});S.kasa=100000;cashNormalize(S);act("semt-ac",{id:"kuzey"});');
  assert.match(g.ev('actionReason("sehir-ac",{})'), /baba/);
  g.ev('act("sehir-ac",{});');
  assert.equal(g.ev("S.genisleme.sehir.acik"), false);
  assert.equal(g.ev("S.kasa"), 20000);
  g.ev('S.streets.forEach(function(s,i){if(i<4)s.sahip="sen";});S.kasa=200000;cashNormalize(S);S.rep.nam=55;S.rep.racon=60;S.dosya=10;stageGate();');
  assert.equal(g.ev("S.stage"), "baba");
  g.ev("S.kasa=1000;cashNormalize(S);");
  assert.match(g.ev('actionReason("sehir-ac",{})'), /25\.000/);
  g.ev('act("sehir-ac",{});');
  assert.equal(g.ev("S.genisleme.sehir.acik"), false);
  assert.equal(g.ev("S.kasa"), 1000);
  g.ev("S.kasa=100000;cashNormalize(S);act('sehir-ac',{});");
  assert.equal(g.ev("S.genisleme.sehir.acik"), true);
  assert.equal(g.ev("S.genisleme.sehir.ad"), "Uzak Terminal");
  assert.equal(g.ev("S.kasa"), 75000);
  g.ev('act("nav",{id:"masa"});');
  assert.match(stage(g), /Uzak Terminal/);
  assert.doesNotMatch(html(g), /navbtn lock/);
  assert.match(html(g), /data-id="masa"/);
  const snap = g.ev("JSON.stringify({k:S.kind,semt:semtBy('kuzey').acik,sehir:S.genisleme.sehir.acik,n:S.streets.length})");
  g.ev("writeSave();S=loadSave();");
  assert.equal(g.ev("JSON.stringify({k:S.kind,semt:semtBy('kuzey').acik,sehir:S.genisleme.sehir.acik,n:S.streets.length})"), snap);
  g.ev("S.flags.haftaGurultu=0;S.flags.kasaOncesi=S.kasa;genislemeHafta();");
  assert.equal(g.ev("S.flags.haftaGurultu"), 1);
  assert.equal(g.ev("S.kasa"), g.ev("S.flags.kasaOncesi") + 4000);
});

test("göz trims the dossier formula and a failed season drops baba one step", () => {
  const g = game();
  g.ev('S.evidence=[];S.rep.nam=0;S.flags.haftaGurultu=0;S.flags.toz=10;S.flags.gozIndirim=0;recalcDosya();');
  const base = g.ev("S.dosya");
  g.ev('S.stage="agabey";act("org-ata",{id:"goz",kind:S.men[0].id});genislemeHafta();');
  assert.equal(g.ev("S.flags.gozIndirim"), 1);
  assert.equal(g.ev("S.dosya"), base - 1);
  g.ev('S.stage="baba";S.screen="masa";S.genisleme.sehir={acik:true,ad:"Uzak Terminal",week:1};S.lig.sezon=1;S.lig.hedefler=[{tip:"sokak",hedef:99}];S.flags.amcaKotu=1;S.flags.amcaDusur=0;sezonKapat();');
  assert.equal(g.ev("S.stage"), "agabey");
  assert.equal(g.ev("S.genisleme.sehir.acik"), false);
  assert.equal(g.ev("S.screen"), "olaylar");
  assert.equal(g.ev("S.kind"), "racon_v1");
  assert.equal(g.ev("S.streets.length"), 6);
});
