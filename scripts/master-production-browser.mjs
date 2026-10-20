// Active catalogue release proof. Static response hashes use the accepted build,
// never a stale checkpoint. Each route has an independent, real offline reload.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {chromium} from 'playwright';
import {checkedUrl} from './browser-guard.mjs';
const args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const base=checkedUrl(arg('--base','http://127.0.0.1:8081'));
const origin=new URL(base).origin;
const expectedRoot=resolve(arg('--expected-root','.output/public'));
const label=arg('--label','local');assert.match(label,/^[a-zA-Z0-9_-]+$/);
const out=resolve(process.env.RUNNER_TEMP||'work','screenshots','master-production',label);await mkdir(out,{recursive:true});
const source=await readFile('src/lib/games.ts','utf8');
const catalog=[...source.split('export const GAMES:')[1].matchAll(/slug: "([^"]+)"[^}]*?status: "live",\s*href: "([^"]+)"/g)].map(m=>({id:m[1],href:m[2]}));
const requested=arg('--games','').split(',').filter(Boolean);
const routes=requested.length?catalog.filter(r=>requested.includes(r.id)):catalog;
if(requested.length)assert.equal(routes.length,new Set(requested).size,'unknown targeted game');
assert.ok(routes.length>0,'active catalogue must not be empty');assert.equal(new Set(routes.map(r=>r.id)).size,routes.length);
const sha=process.env.GITHUB_SHA||null;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashes=new Map(),results=[],offline=[];
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
async function visible(page){
 // A cached wrapper can finish loading before React attaches/navigates its
 // iframe. Re-resolve the document on every probe instead of pinning about:blank.
 await page.waitForFunction(()=>{
  const embedded=document.querySelector('iframe');
  if(location.pathname.startsWith('/oyna/')&&!embedded)return false;
  try{return (embedded?embedded.contentDocument?.body:document.body)?.innerText.trim().length>20;}catch{return false;}
 },null,{timeout:25000});
 const frame=page.frames().find(f=>new URL(f.url()||'about:blank').origin===origin&&new URL(f.url()).pathname.startsWith('/games/'));
 const surface=frame||page;
 await surface.waitForFunction(()=>document.body?.innerText.trim().length>20,{},{timeout:20000});
 const view=await surface.evaluate(()=>({text:document.body.innerText.trim().slice(0,200),length:document.body.innerText.trim().length,width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,title:document.title}));
 assert.ok(view.length>20,'game surface must contain visible text');assert.ok(view.scroll<=view.width+1,`horizontal overflow: ${JSON.stringify(view)}`);
 if(frame && frame!==page.mainFrame()){const box=await page.locator('iframe').first().boundingBox();assert.ok(box&&box.width>100&&box.height>100,'game iframe must be visible');}
 return {surface:surface.url(),...view};
}
try{for(const route of routes)for(const lang of ['tr','en','pl'])for(const width of [390,1280]){
 const tag=`${route.id}-${lang}-${width}`,errors=[],assetChecks=[],reads=[],requestFailures=[];
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'allow'});
 await context.addInitScript(l=>{localStorage.setItem('tariklab.language',l);localStorage.setItem('cete-age-ok','1');},lang);
 const page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>errors.push(`JS: ${e.message}`));
 page.on('requestfailed',r=>requestFailures.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`);});
 page.on('response',response=>{const url=new URL(response.url());if(url.origin!==origin)return;
  if(response.status()>=400)errors.push(`HTTP ${response.status()}: ${url.pathname}`);
  if(response.status()!==200)return;
  const pathname=decodeURIComponent(url.pathname);
  if(!/\.(?:js|mjs|css|json|webp|svg|png|ico|woff2?|webmanifest|html)$/.test(pathname))return;
  const path=resolve(expectedRoot,'.'+pathname);if(!path.startsWith(expectedRoot+sep))return;
  reads.push((async()=>{try{const expected=await readFile(path),bytes=await response.body();assert.equal(digest(bytes),digest(expected),`accepted-build bytes mismatch: ${pathname}`);hashes.set(pathname,digest(expected));assetChecks.push(pathname);}catch(error){errors.push(`asset: ${pathname}: ${error.message}`);}})());
 });
 let row={game:route.id,lang,width,href:route.href,ok:false};
 try{
  const response=await page.goto(new URL(route.href,base).href,{waitUntil:'networkidle'});assert.equal(response.status(),200);
  assert.equal(new URL(page.url()).origin,origin,'route must stay on accepted host');
  row.render=await visible(page);
  await page.waitForFunction(expected=>document.documentElement.lang===expected,lang,{timeout:10000});
  row.language=await page.evaluate(()=>({document:document.documentElement.lang,selected:localStorage.getItem('tariklab.language')}));
  assert.equal(row.language.selected,lang,'requested language must remain selected');
  if(route.id==='cete-savaslari'){
   const expected=lang==='tr'?'Dosya aç':lang==='en'?'Open a file':'Otwórz plik';
   const actual=await page.locator('h1,h2,p').allInnerTexts();
   assert.ok(actual.some(text=>text.toLocaleLowerCase().includes(expected.toLocaleLowerCase())),`authored initial character label missing: ${expected}`);
  }
  await Promise.all(reads);assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/${tag}.png`});
  row.ok=true;
  if((lang==='tr'||lang==='pl')&&width===390){
   const proof={game:route.id,lang,ok:false};
   try{
    if(route.id==='hanedanian'){
     const frame=page.frames().find(f=>f.url().includes('/games/hanedanian/'));
     assert.ok(frame,'HANEDANIAN frame');
     await frame.locator('[data-action="new"]').first().click();
     await frame.locator('#new-form input[name="seed"]').fill('MASTER-OFFLINE');
     await frame.locator('#new-form button').click();
     await frame.locator('#welcome').waitFor({state:'hidden'});
     await frame.waitForFunction(()=>{const text=document.querySelector('#settlement-rail')?.textContent||'';return ['Çevrimdışı paket hazır','Offline package ready','Pakiet offline gotowy'].some(label=>text.includes(label));},null,{timeout:30000});
    }
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker?.controller),{},{timeout:15000});
    await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
    await page.reload({waitUntil:'networkidle'});await visible(page);
    await Promise.all(reads);assert.deepEqual(errors,[]);
    await context.setOffline(true);
    const response=await page.reload({waitUntil:'load',timeout:25000});assert.equal(response.status(),200,'offline cached navigation');
    proof.render=await visible(page);assert.equal(new URL(page.url()).origin,origin);
    proof.language=await page.evaluate(()=>({document:document.documentElement.lang,selected:localStorage.getItem('tariklab.language')}));
    assert.equal(proof.language.document,lang,'offline shell retains selected language');
    assert.equal(proof.language.selected,lang);
    await page.screenshot({path:`${out}/${route.id}-offline.png`});proof.ok=true;
   }catch(error){proof.error=error.message;}finally{
    proof.requestFailures=requestFailures;
    proof.frames=await Promise.all(page.frames().map(async frame=>{
     try{return await frame.evaluate(async()=>({url:location.href,text:document.body?.innerText.slice(0,180),controller:navigator.serviceWorker?.controller?.scriptURL||null,registrations:await navigator.serviceWorker?.getRegistrations().then(rs=>rs.map(r=>({scope:r.scope,active:r.active?.scriptURL,installing:r.installing?.state,waiting:r.waiting?.state}))),caches:await caches.keys()}));}
     catch(error){return {url:frame.url(),error:error.message};}
    }));
    await context.setOffline(false);
   }
   offline.push(proof);
  }
 }catch(error){row.error=error.message;}finally{
  await Promise.all(reads);row.assets=[...new Set(assetChecks)];row.errors=errors;if(errors.length)row.ok=false;results.push(row);await context.close();
 }
 console.log(JSON.stringify({tag,ok:row.ok,error:row.error,offline:(lang==='tr'||lang==='pl')&&width===390?offline.find(x=>x.game===route.id&&x.lang===lang):undefined}));
}}finally{
 await browser.close();
 const report={scope:requested.length?'targeted':'full',label,sha,origin,expectedRoot,routes,hashes:Object.fromEntries(hashes),results,offline,summary:{cells:results.length,passed:results.filter(r=>r.ok).length,offlinePassed:offline.filter(r=>r.ok).length,offlineExpected:routes.length*2}};
 await writeFile(`${out}/results.json`,JSON.stringify(report,null,2));
}
assert.equal(results.length,routes.length*6,'all supported language/viewport cells required');assert.ok(results.every(r=>r.ok),'render/asset acceptance failed');assert.equal(offline.length,routes.length*2);assert.ok(offline.every(r=>r.ok),'offline acceptance failed; see per-game evidence');console.log(`${requested.length?'MASTER_TARGETED_PASS':'MASTER_PRODUCTION_PASS'} ${label} ${results.length} cells ${offline.length} real offline reloads`);
