import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('coast archive excludes both retired games from all live Resources and retains both routes',()=>{
 const credits=read('public/credits.html');assert.doesNotMatch(credits,/data-game="(?:esik|ihtilal)"|href="\/oyna\/(?:esik|ihtilal)"/);assert.match(credits,/data-live-count="6"/);
 const ctx={localStorage:{getItem:()=> 'en'}};vm.runInNewContext(read('public/i18n/tlab-i18n.js'),ctx);
 for(const key of ['CREDITS_EN','CREDITS_PL']){const rows=ctx.tlabI18n[key].sections[0].items;assert.equal(rows.length,6);assert.ok(rows.every(r=>!/\/oyna\/(esik|ihtilal)/.test(r)));}
 assert.match(read('src/lib/games.ts'),/slug: "esik",[^}]*status: "archived",[^}]*href: "\/oyna\/esik"/);
 assert.match(read('src/routes/oyna.$slug.tsx'),/canonical === "ihtilal" \? <Link/);
 assert.match(read('scripts/sitewide-responsive.mjs'),/await coastArchiveAcceptance\(browser/);
});
test('coast source, recovery implementation, localization and shared Pixi are byte-preserved',()=>{
 const m=JSON.parse(read('docs/esik/ARCHIVE_MANIFEST_2026-10-20.json'));
 for(const file of ['sim.js','save-store.js','app.js','map-model.js','map-pixi.js','style.css','index.html'])assert.ok(m.retainedFiles.some(f=>f.path==='public/games/esik/'+file));
 for(const f of m.retainedFiles)assert.equal(createHash('sha256').update(readFileSync(new URL('../'+f.path,import.meta.url))).digest('hex'),f.sha256,f.path);
 assert.equal(m.saveContract.primary,'tariklab.kiyi-esigi.v1');assert.equal(m.saveContract.recoverySlots,8);
});
