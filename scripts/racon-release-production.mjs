import assert from 'node:assert/strict';
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import {loadGame} from './racon-harness.mjs';
const origin=process.env.RACON_BASE,stage=process.env.RELEASE_STAGE;
assert.ok(['https://www.tariklab.com','https://tariklab.tayaz29.workers.dev'].includes(origin));
assert.ok(['a','b','c'].includes(stage));
const out=`${process.env.RUNNER_TEMP||'/workspace'}/screenshots/racon-production`;await mkdir(out,{recursive:true});
const files=[...(await readdir('public/games/racon')).map(f=>'public/games/racon/'+f),'public/i18n/tlab-i18n.js','public/i18n/pl/racon.json','public/i18n/pl-body.js','public/i18n/boot.js','public/games/shared/depth-framework.js','public/games/shared/pixi-adapter.js','public/vendor/pixi/pixi-8.21.0.min.mjs'];
// Public anonymous endpoint only: no credentials, cookies or user data.
const anonymousResponse=await fetch(origin+'/api/auth/get-session');
assert.equal(anonymousResponse.status,200,'SSR auth middleware is reachable');
assert.equal(await anonymousResponse.json(),null,'anonymous request remains unauthenticated');
const anonymousAuth={path:'/api/auth/get-session',status:200,anonymous:true};
const hashes=[];
for(const file of files){
 const response=await fetch(origin+'/'+file.slice(7));assert.equal(response.status,200,file);
 const served=Buffer.from(await response.arrayBuffer()),source=await readFile(file);
 assert.ok(served.equals(source),'exact deployed bytes: '+file);
 hashes.push({file,bytes:served.length,sha256:createHash('sha256').update(served).digest('hex')});
}
await writeFile(out+'/hashes.json',JSON.stringify({origin,stage,canonicalMain:process.env.RELEASE_MAIN,hashes},null,2));
const scripts=['racon-region-production.mjs',...(stage==='a'?[]:['racon-crew-police-production.mjs']),...(stage==='c'?['racon-language-browser.mjs']:[])];
for(const script of scripts){
 const result=spawnSync(process.execPath,['scripts/'+script,'--source'],{stdio:'inherit',env:process.env});
 assert.equal(result.status,0,script+' must pass on '+origin);
}
const h=loadGame();h.ev('blank("Yayın");enterPlay();S.stage="baba";S.kasa=50000;cashNormalize(S);writeSave();');
const fixture=h.localStorage.getItem('tariklab::racon:1'),portal=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{for(const lang of ['tr','en','pl'])for(const width of [390,1280]){
 const context=await browser.newContext({viewport:{width,height:844}});
 try{
  await context.addInitScript(({lang,fixture})=>{
   localStorage.setItem('tariklab.language',lang);
   if(!localStorage.getItem('racon-release-seeded')){
    localStorage.setItem('tariklab::racon:1',fixture);localStorage.setItem('tariklab::racon:active','1');localStorage.setItem('racon-release-seeded','1');
   }
  },{lang,fixture});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/oyna/racon',{waitUntil:'networkidle'});
  const frame=page.frameLocator('iframe');await frame.locator('#btn-devam').click();
  await frame.locator('#stage').waitFor();assert.ok((await frame.locator('#stage').innerText()).trim().length>30);
  assert.equal(await frame.locator('body').evaluate(()=>window.tlabI18n.getLang()),lang);
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tariklab::racon:1')));
  const before=await read();await page.reload({waitUntil:'networkidle'});await page.frameLocator('iframe').locator('#btn-devam').click();const after=await read();
  assert.ok(after.savedAt>=before.savedAt);delete before.savedAt;delete after.savedAt;assert.deepEqual(after,before,'portal preserves all serialized gameplay');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.ok(await page.frameLocator('iframe').locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);await page.screenshot({path:`${out}/portal-${lang}-${width}.png`,fullPage:true});
  portal.push({lang,width,status:'PASS',saveReload:true});
 }finally{await context.close();}
}}finally{await browser.close();}
assert.equal(portal.length,6);
await writeFile(out+'/receipt.json',JSON.stringify({origin,stage,canonicalMain:process.env.RELEASE_MAIN,anonymousAuth,hashes,portal,regionCases:6,crewCases:stage==='a'?0:18,languageCases:stage==='c'?6:0,status:'PASS'},null,2));
console.log(JSON.stringify({origin,stage,hashes:hashes.length,portal:6,region:6,crew:stage==='a'?0:18,language:stage==='c'?6:0,status:'PASS'}));
