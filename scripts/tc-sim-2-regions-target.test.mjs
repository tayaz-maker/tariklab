import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname,join} from 'node:path';
import {productionOrigins,fingerprintPaths} from './tc-sim-job-start-target.mjs';
import {REGION_FINGERPRINT_PATHS,checkedRegionTarget,requireRegionCurrentMain,verifyRegionBuild} from './tc-sim-2-regions-target.mjs';
const root=resolve('public'),sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const read=async(url,options)=>{assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');const path=new URL(url).pathname;return new Response(await readFile(resolve(root,'.'+(path.endsWith('/')?path+'index.html':path))));};
test('regional hosted fixture accepts only both authorized plain origins and requires build plus exact SHA',()=>{
 assert.equal(checkedRegionTarget({}).serve,'public');
 for(const origin of productionOrigins)assert.equal(checkedRegionTarget({'base-url':origin,'expected-root':root,'expected-sha':sha}).origin,origin);
 for(const origin of ['https://www.tariklab.com.evil.test','https://tariklab.com','https://www.tariklab.com:444','https://u:p@www.tariklab.com','https://www.tariklab.com/games','https://www.tariklab.com?test=1','http://127.0.0.1:8080'])assert.throws(()=>checkedRegionTarget({'base-url':origin,'expected-root':root,'expected-sha':sha}));
 assert.throws(()=>checkedRegionTarget({'base-url':productionOrigins[0],'expected-sha':sha}),/expected-root/);
 assert.throws(()=>checkedRegionTarget({'base-url':productionOrigins[0],'expected-root':root}),/expected-sha/);
 assert.throws(()=>checkedRegionTarget({'base-url':productionOrigins[0],'expected-root':root,'expected-sha':sha,serve:root}),/choose/);
});
test('regional fingerprint covers immutable SHA, all new modules and all three artwork files',async()=>{
 const rows=await verifyRegionBuild(productionOrigins[0],root,{expectedSha:sha,request:read});
 assert.equal(rows.length,fingerprintPaths.length+REGION_FINGERPRINT_PATHS.length);
 assert.equal(rows.find(row=>row.path==='/games/tc-sim/index.html').requestPath,'/games/tc-sim/');
 await assert.rejects(verifyRegionBuild(productionOrigins[0],root,{request:async(url,options)=>new URL(url).pathname==='/games/tc-sim/'?new Response('stale HTML'):read(url,options)}),/exact candidate/);
 for(const city of ['istanbul','ankara','izmir'])assert.ok(rows.some(row=>row.path.endsWith(`tc-sim-2-${city}.webp`)));
 await assert.rejects(verifyRegionBuild(productionOrigins[0],root,{request:async(url,options)=>url.includes('region-map-data.js')?new Response('stale coordinate data'):read(url,options)}),/exact candidate/);
 await assert.rejects(verifyRegionBuild(productionOrigins[0],root,{request:async(url,options)=>url.includes('tc-sim-2-izmir.webp')?new Response('missing',{status:404}):read(url,options)}),/region asset status/);
 await assert.rejects(verifyRegionBuild(productionOrigins[0],root,{request:async()=>{throw new Error('redirect denied')}}),/redirect denied/);
});
test('expected-root cannot pair stale files with a newer expected SHA',async t=>{
 const temporary=await mkdtemp(join(tmpdir(),'tc-region-sha-'));t.after(()=>rm(temporary,{recursive:true,force:true}));
 for(const path of [...fingerprintPaths,...REGION_FINGERPRINT_PATHS]){const file=resolve(temporary,'.'+path.split('?')[0]);await mkdir(dirname(file),{recursive:true});await writeFile(file,await readFile(resolve(root,'.'+path.split('?')[0])));}
 await writeFile(resolve(temporary,'games/tc-sim/js/region-data.js'),'stale');
 await assert.rejects(verifyRegionBuild(productionOrigins[0],temporary,{expectedSha:sha,request:read}),/expected build is not exact SHA/);
});
test('production main check fails closed on changed main or unavailable GitHub',async()=>{
 assert.equal(await requireRegionCurrentMain(sha,async()=>Response.json({commit:{sha}})),sha);
 await assert.rejects(requireRegionCurrentMain(sha,async()=>Response.json({commit:{sha:'a'.repeat(40)}})),/main moved/);
 await assert.rejects(requireRegionCurrentMain(sha,async()=>new Response('unavailable',{status:503})),/verification unavailable/);
});
