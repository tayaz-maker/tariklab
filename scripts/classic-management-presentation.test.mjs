import test from 'node:test';
import assert from 'node:assert/strict';
import {resultLabel,scoreCopy} from '../public/games/peg-solitaire/js/presentation.js';
import {managementLabel} from '../public/games/apartman/presentation.js';
import {RESIDENTS} from '../public/games/next-wave/apartman-data.js';
import {createGame,gradeGame} from '../public/games/peg-solitaire/js/solitaire.js';
test('canonical peg results and saves stay unchanged while terminal/record copy follows language',()=>{
 const game=createGame(),before=JSON.stringify(game),result=gradeGame(game);
 for(const lang of ['en','pl']){
  for(const grade of ['Usta','Kusursuz','Çok iyi','İyi','Geçer','Deneme'])assert.notEqual(resultLabel(grade,lang),grade);
  assert.ok(!/En iyin|hamle|taş/.test(scoreCopy('best',{remaining:7,moves:25,center:false},lang)));
  assert.ok(!/Fena değil|kişisel/.test(scoreCopy('note',{note:'Fena değil.',better:true},lang)));
 }
 assert.equal(resultLabel('Geçer','tr'),'Geçer');assert.equal(JSON.stringify(game),before);assert.deepEqual(gradeGame(game),result);
});
test('all authored resident traits and phases have EN/PL display labels without mutating records',()=>{
 const before=JSON.stringify(RESIDENTS);
 for(const lang of ['en','pl'])for(const value of [...new Set(RESIDENTS.flatMap(r=>[r.personality,r.interest])),'apartman yönetimi','site kurulu','profesyonel tesis yönetimi']){
  assert.notEqual(managementLabel(value,lang),value,`${lang}: ${value}`);
  assert.equal(managementLabel(value,'tr'),value);
 }
 assert.equal(JSON.stringify(RESIDENTS),before);assert.equal(managementLabel('old custom phase','en'),'old custom phase');
});

test('observed lift incident is translated only for display',()=>{
 const title='Asansör kat arasında';
 const body="Sevim içeride kalmış, on dakika. Ses hâlâ var. Elif 'periyodik kontrol tarihi geçmiş olabilir' diyor.";
 assert.equal(managementLabel(title,'en'),'Lift stuck between floors');
 assert.ok(managementLabel(body,'en').startsWith('Sevim has been stuck'));
 assert.ok(managementLabel(body,'pl').startsWith('Sevim utknęła'));
 assert.equal(managementLabel(body,'tr'),body);
});

test('observed Polish apartment metrics and priced issue copy do not fall back to English',()=>{
 const expected={'Aidat borcu':'Zaległości',Bina:'Budynek',Güven:'Zaufanie',tahmini:'szacunek','gecikme riski':'ryzyko zwłoki','ortak alan':'część wspólna','2. kat kolon sızıntısı':'Przeciek w pionie na 2. piętrze'};
 for(const [source,polish] of Object.entries(expected)){
  assert.equal(managementLabel(source,'pl'),polish);assert.equal(managementLabel(source,'tr'),source);
 }
 assert.equal(managementLabel('2. kat kolon sızıntısı','en'),'2nd-floor column leak');
});
