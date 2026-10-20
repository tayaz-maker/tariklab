import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
test('all three archives leave active discovery while original Bukucu remains recoverable',()=>{
 const catalog=read('src/lib/games.ts');assert.match(catalog,/slug: "bukucu",[^}]*status: "archived",[^}]*href: "\/oyna\/bukucu"/);
 assert.doesNotMatch(read('public/credits.html'),/data-game="bukucu"|href="\/games\/bukucu/);
 assert.doesNotMatch(read('public/sitemap.xml'),/bukucu|\/ihtilal<|\/esik</);
 const ctx={localStorage:{getItem:()=> 'en'}};vm.runInNewContext(read('public/i18n/tlab-i18n.js'),ctx);
 for(const key of ['CREDITS_EN','CREDITS_PL']){const rows=ctx.tlabI18n[key].sections[0].items;assert.equal(rows.length,16);assert.ok(rows.every(r=>!/bukucu|\/oyna\/(ihtilal|esik)/i.test(r)));}
 const m=JSON.parse(read('archives/MANIFEST.json'));
 for(const f of m.files.filter(f=>f.path.startsWith('public/games/bukucu/')||f.path.startsWith('public/games/ihtilal/')||f.path.startsWith('public/games/esik/')))
  assert.equal(createHash('sha256').update(readFileSync(f.path)).digest('hex'),f.sha256,f.path);
 assert.equal(m.sourceMain,'007ce1e310e6ce8feee49154fae18769d03928b6');assert.ok(!m.path.startsWith('public/'));
});
test('compressed archive restores every original byte with safe complete manifest',()=>{
 const report=JSON.parse(execFileSync('python3',['scripts/verify-game-archive.py'],{encoding:'utf8'}));assert.equal(report.status,'PASS');assert.equal(report.files,77);assert.ok(report.compressedBytes<report.sourceBytes*.14);
});
