// Final catalogue proof. Run from the checkout being accepted. Source mode and
// targeted/critical captures never print a full production PASS marker.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {checkedUrl} from './browser-guard.mjs';
import {CANONICAL_WIDTHS,widthsFrom,languagesFrom,acceptedAssetPath,gamePathMatches,exactEntryPath,readSaveEvidence,assertPreparedSave,assertSavedProgress} from './master-acceptance-contract.mjs';

const args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const base=checkedUrl(arg('--base','http://127.0.0.1:8081')),origin=new URL(base).origin;
const mode=arg('--mode','built');assert.ok(['source','built'].includes(mode),'mode must be source or built');
const critical=args.includes('--critical'),widths=widthsFrom(arg('--viewports'),critical),languages=languagesFrom(arg('--languages'));
const offlineLanguages=languages.filter(lang=>lang==='tr'||lang==='pl');
const expectedRoot=resolve(arg('--expected-root',mode==='source'?'public':'.output/public'));
const label=arg('--label','local');assert.match(label,/^[a-zA-Z0-9_-]+$/);
const out=resolve(process.env.RUNNER_TEMP||'work','screenshots','master-production',label);await mkdir(out,{recursive:true});
const source=await readFile('src/lib/games.ts','utf8');
const catalog=[...source.split('export const GAMES:')[1].matchAll(/slug: "([^"]+)"[^}]*?status: "live",\s*href: "([^"]+)"/g)].map(m=>({id:m[1],href:m[2]}));
const requested=arg('--games','').split(',').filter(Boolean),routes=requested.length?catalog.filter(r=>requested.includes(r.id)):catalog;
if(requested.length)assert.equal(routes.length,new Set(requested).size,'unknown targeted game');
assert.ok(routes.length>0,'active catalogue must not be empty');assert.equal(new Set(routes.map(r=>r.id)).size,routes.length);
const sha=process.env.GITHUB_SHA||null,digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashes=new Map(),results=[],offline=[],runOffline=mode==='built'&&!critical&&widths.includes(390);
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});

async function finishAssetReads(reads){
 let previous=-1;
 while(previous!==reads.length){previous=reads.length;await Promise.all(reads);}
}
async function gameSurface(page,game){
 if(!new URL(page.url()).pathname.startsWith('/oyna/'))return page.mainFrame();
 // The wrapper may load before React attaches/navigates its iframe. Never pin
 // an about:blank frame or mistake unrelated outer chrome for the game.
 await page.waitForFunction(expected=>{
  const frame=document.querySelector('iframe');
  try{return frame?.contentWindow?.location.pathname.startsWith(`/games/${expected}/`)&&frame.contentDocument?.body?.innerText.trim().length>20;}catch{return false;}
 },game,{timeout:25000});
 const frame=page.frames().find(f=>gamePathMatches(f.url(),origin,game));assert.ok(frame,`missing ${game} frame`);return frame;
}
async function visible(page,game){
 const surface=await gameSurface(page,game);
 if(game==='cete-savaslari')await page.locator('.game-shell .hud-header, #cete-player-name').first().waitFor({state:'visible'});
 await surface.waitForFunction(()=>document.body?.innerText.trim().length>20,null,{timeout:20000});
 if(game!=='cete-savaslari')assert.ok(gamePathMatches(surface.url(),origin,game),`wrong game surface: ${surface.url()}`);
 const view=await surface.evaluate(()=>({text:document.body.innerText.trim().slice(0,220),length:document.body.innerText.trim().length,width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,title:document.title,documentLanguage:document.documentElement.lang}));
 assert.ok(view.scroll<=view.width+1,`horizontal overflow: ${JSON.stringify(view)}`);
 if(surface!==page.mainFrame()){const box=await page.locator('iframe').first().boundingBox();assert.ok(box&&box.width>100&&box.height>100,'game iframe must be visible');}
 return {surface:surface.url(),...view};
}
async function languageProof(page,game,lang){
 await page.waitForFunction(expected=>document.documentElement.lang===expected,lang,{timeout:10000});
 const selected=await page.evaluate(()=>localStorage.getItem('tariklab.language'));assert.equal(selected,lang);
 const surface=await gameSurface(page,game);
 // Authored labels cover the initial action, not every narrative sentence.
 const button={racon:'#menu-home [data-go="nick"]',apartman:'#menu-new','tc-sim-devlet':'#menu-new','son-100-gun':'#menu-new','kayip-telefon':'#menu-new','son-kasaba':'#menu-new'}[game];
 let label,expected;
 if(button){
  expected=game==='son-100-gun'?{tr:'Yeni yüz gün',en:'New hundred days',pl:'Nowe sto dni'}[lang]:{tr:'Yeni oyun',en:game==='racon'?'New Game':'NEW GAME',pl:game==='racon'?'Nowa gra':'NOWA GRA'}[lang];
  await surface.locator(button).waitFor();
  await surface.waitForFunction(({selector,expected,lang})=>document.querySelector(selector)?.textContent.trim().toLocaleLowerCase(lang)===expected.toLocaleLowerCase(lang),{selector:button,expected,lang},{timeout:10000});
  label=await surface.locator(button).innerText();
 }else if(game==='cete-savaslari'){
  expected={tr:'Dosya aç',en:'Open a file',pl:'Otwórz plik'}[lang];
  await page.getByText(expected,{exact:true}).waitFor();label=expected;
 }
 return {selected,document:await page.locator('html').getAttribute('lang'),surface:await surface.locator('html').getAttribute('lang'),authoredLabel:label||null,expected:expected||null,narrativeCoverage:'not certified by this generic gate'};
}
async function gameplayLanguageProof(page,game,lang){
 if(game!=='cete-savaslari')return null;
 const labels={tr:['Enerji','Racon','Can','Emniyet','GÜN'],en:['Energy','Stamina','Health','Heat','DAY'],pl:['Energia','Wytrzymałość','Zdrowie','Presja policji','DZIEŃ']}[lang];
 const hud=page.locator('.hud-header');await hud.waitFor();
 // The clock is always shown on mobile and lives in the existing Details panel
 // on desktop. Exercise that real disclosure instead of treating hidden copy
 // as missing localization.
 if(!(await hud.innerText()).includes(labels[4])){
  const details={tr:'Detay',en:'Details',pl:'Szczegóły'}[lang];
  await hud.getByRole('button',{name:details,exact:true}).click();
 }
 for(const label of labels)assert.ok((await hud.innerText()).includes(label),`authored gameplay HUD label missing: ${label}`);
 const action={tr:'İcraata çık',en:'Take job',pl:'Podejmij zlecenie'}[lang];
 await page.getByRole('button',{name:action,exact:true}).first().waitFor();
 return {hud:labels,primaryAction:action};
}
async function preparePlayable(page,game){
 const frame=await gameSurface(page,game);
 if(game==='cete-savaslari'){
  await page.locator('#cete-player-name').fill('Master QA');
  const name={tr:'Sokağa in',en:'Hit the street',pl:'Wyjdź na ulicę'}[await page.evaluate(()=>localStorage.getItem('tariklab.language'))];
  await page.getByRole('button',{name,exact:true}).click();await page.locator('.game-shell').waitFor();
 }else if(game==='racon'){
  await frame.locator('#menu-home [data-go="nick"]').click();await frame.locator('#lakap').fill('Master QA');
  await frame.locator('[data-go="origin"]').click();await frame.locator('[data-act="origin"][data-id="koy"]').click();
  await frame.locator('#night-acts [data-act="night"]').first().click();await frame.locator('[data-act="save"]').first().click();
 }else if(['apartman','tc-sim-devlet','son-100-gun','kayip-telefon','son-kasaba'].includes(game)){
  await frame.locator('#menu-new').click();
  if(game==='son-100-gun')await frame.locator('[data-scenario]').first().click();
  if(game==='tc-sim-devlet'){
   await frame.locator('[data-setup-field="era"][data-setup-value="2002"]').click();
   await frame.locator('[data-setup-field="doctrine"][data-setup-value="none"]').click();
  }
  await frame.locator('#confirm-start').click();
 }else if(game==='hanedanian'){
  await frame.locator('[data-action="new"]').first().click();await frame.locator('#new-form input[name="seed"]').fill('MASTER-OFFLINE');
  await frame.locator('#new-form button').click();await frame.locator('#welcome').waitFor({state:'hidden'});
  await frame.locator('[data-speed="0"]').click();
  if(await frame.locator('[data-guide="dismiss"]').isVisible())await frame.locator('[data-guide="dismiss"]').click();
  await frame.locator('#menu-button').click();await frame.locator('[data-action="manual-save"]').click();
  if(await frame.locator('[data-action="resume"]').isVisible())await frame.locator('[data-action="resume"]').click();
 }else if(['veto-h','gett-oh'].includes(game)){
  const lang=await page.evaluate(()=>localStorage.getItem('tariklab.language'));
  await frame.getByRole('button',{name:{tr:'Devam Et',en:'Continue',pl:'Kontynuuj'}[lang],exact:true}).click();await frame.locator('.duel-table').waitFor();
 }else if(game==='tc-sim'){
  await frame.locator('#show-creation-form').click();await frame.locator('#new-game-form input[name="name"]').fill('Master QA');
  await frame.locator('#new-game-form button[type="submit"]').click();await frame.locator('#advance-week').waitFor();
 }else if(game==='jitem-derin-ag'){
  // Re-resolve the authored iframe if the wrapper reconciles its language fallback.
  const liveFrame=page.frameLocator('iframe');
  await liveFrame.locator('.start-screen-shell button').filter({hasText:/Field line|Saha hattı/}).click();
  await liveFrame.locator('article:visible button').first().click();
 }else if(game==='satranc'){
  await frame.locator('#mode').selectOption('two');await frame.locator('#setup-form button[type="submit"]').click();
 }else if(game==='amiral-batti'){
  await frame.locator('#auto').click();await frame.locator('#start').click();
 }
 return frame;
}
async function saves(page,game){
 const surface=await gameSurface(page,game);
 const entries=await surface.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])));
 if(game==='hanedanian'){
  entries['idb:hanedanian:manual']=await surface.evaluate(()=>new Promise((resolve,reject)=>{
   const request=indexedDB.open('tariklab-hanedanian');request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('saves')){db.close();resolve(null);return;}
    const get=db.transaction('saves','readonly').objectStore('saves').get('manual');get.onerror=()=>{db.close();reject(get.error);};get.onsuccess=()=>{db.close();resolve(JSON.stringify(get.result??null));};};
  }));
 }
 return readSaveEvidence(game,entries);
}
async function readability(page,game){
 const surface=await gameSurface(page,game);
 return surface.evaluate(()=>[...document.querySelectorAll('button,input,select,summary')].filter(el=>{
  const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';
 }).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,100),width:Math.round(r.width),height:Math.round(r.height),fontSize:s.fontSize,clipped:el.scrollWidth>el.clientWidth+2,viewportClipped:r.left< -1||r.right>innerWidth+1};}));
}
async function diagnostics(page){
 return Promise.all(page.frames().map(async frame=>{
  try{return await frame.evaluate(async()=>({url:location.href,text:document.body?.innerText.slice(0,180),controller:navigator.serviceWorker?.controller?.scriptURL||null,registrations:await navigator.serviceWorker?.getRegistrations().then(rs=>rs.map(r=>({scope:r.scope,active:r.active?.scriptURL,installing:r.installing?.state,waiting:r.waiting?.state}))),caches:await caches.keys()}));}
  catch(error){return {url:frame.url(),error:error.message};}
 }));
}
async function entryProof(context,page,game){
 if(game==='cete-savaslari')return null;
 const frame=await gameSurface(page,game),path=exactEntryPath(frame.url(),origin,game);
 const expected=await readFile(acceptedAssetPath(expectedRoot,path));
 const response=await context.request.get(new URL(path,origin).href);
 assert.equal(new URL(response.url()).origin,origin,'game entry redirect must stay on accepted host');assert.equal(response.status(),200);
 assert.equal(digest(await response.body()),digest(expected),`accepted entry bytes mismatch: ${path}`);hashes.set(path,digest(expected));return path;
}
try{
 for(const route of routes)for(const lang of languages)for(const width of widths){
  const tag=`${route.id}-${lang}-${width}`,errors=[],assetChecks=[],reads=[],requestFailures=[];
  let phase='online';const verificationFetches=new Set(),browserBodyReads=[];
  const duelSave=['veto-h','gett-oh'].includes(route.id)?await readFile(`scripts/fixtures/duel/${route.id}-old-save.json`,'utf8'):null;
  const context=await browser.newContext({viewport:{width,height:width===1440?900:844},serviceWorkers:mode==='source'?'block':'allow'});
  await context.addInitScript(({lang,duelSave,game})=>{localStorage.setItem('tariklab.language',lang);localStorage.setItem('cete-age-ok','1');if(duelSave&&!localStorage.getItem(`tariklab.${game}.duel`))localStorage.setItem(`tariklab.${game}.duel`,duelSave);},{lang,duelSave,game:route.id});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push({phase,type:'JS',message:e.message}));
  page.on('requestfailed',request=>{if(new URL(request.url()).origin===origin)requestFailures.push({phase,url:request.url(),error:request.failure()?.errorText});});
  page.on('console',m=>{if(m.type()==='error')errors.push({phase,type:'console',message:m.text()});});
  page.on('response',response=>{const url=new URL(response.url());if(url.origin!==origin)return;
   if(verificationFetches.has(url.href))return; // The initiating response is verified with these fetched bytes below.
   if(response.status()>=400)errors.push({phase,type:'HTTP',message:`${response.status()}: ${url.pathname}`});
   if(response.status()!==200||! /\.(?:js|mjs|css|json|webp|svg|png|ico|woff2?|webmanifest|html)$/.test(url.pathname))return;
   if(mode==='source'&&!/^\/(?:games|i18n|brand|__grok)\//.test(url.pathname))return;
   const currentPhase=phase;
   reads.push((async()=>{try{const expectedRead=readFile(acceptedAssetPath(expectedRoot,url.pathname));
    let bytes;
    try{let timer;try{bytes=await Promise.race([response.body(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`response body read timed out: ${url.pathname}`)),20000);})]);}finally{clearTimeout(timer);}}catch(error){
     if(!/No resource with given identifier|navigated away/.test(error.message))throw error;
     // Chromium may discard the CDP body handle for SW-cached images. Read the
     // same URL through the real browser/SW and retain the identical hash gate.
     await page.waitForLoadState('networkidle');verificationFetches.add(url.href);
     try{bytes=Buffer.from(await page.evaluate(async({href,type})=>{if(new URL(href).origin!==location.origin)throw new Error('asset fetch origin mismatch');const response=await fetch(href,{signal:AbortSignal.timeout(20000)});if(response.status!==200||response.url!==href)throw new Error(`asset fetch identity/status mismatch: ${response.status} ${response.url}`);if(!type||response.headers.get('content-type')!==type)throw new Error(`asset fetch content-type mismatch: ${href}`);return [...new Uint8Array(await response.arrayBuffer())];},{href:url.href,type:response.headers()['content-type']}));browserBodyReads.push({path:url.pathname,reason:error.message});}
     finally{verificationFetches.delete(url.href);}
    }
    const expected=await expectedRead;assert.equal(digest(bytes),digest(expected),`accepted bytes mismatch: ${url.pathname}`);hashes.set(url.pathname,digest(expected));assetChecks.push(url.pathname);}catch(error){errors.push({phase:currentPhase,type:'asset',message:`${url.pathname}: ${error.message}`});}})());
  });
  const row={game:route.id,lang,width,href:route.href,ok:false};
  try{
   const response=await page.goto(new URL(route.href,base).href,{waitUntil:'networkidle'});assert.equal(response.status(),200);assert.equal(new URL(page.url()).origin,origin);
   row.render=await visible(page,route.id);row.language=await languageProof(page,route.id,lang);row.entry=await entryProof(context,page,route.id);
   await finishAssetReads(reads);assert.deepEqual(errors,[]);assert.deepEqual(requestFailures,[]);
   await page.screenshot({path:`${out}/${tag}-initial.png`});
   if(critical){await preparePlayable(page,route.id);row.savePolicy=assertPreparedSave(route.id,await saves(page,route.id));row.playable=await visible(page,route.id);row.gameplayLanguage=await gameplayLanguageProof(page,route.id,lang);row.controls=await readability(page,route.id);await page.screenshot({path:`${out}/${tag}-gameplay.png`});}
   row.ok=true;
   if(runOffline&&(lang==='tr'||lang==='pl')&&width===390){
    const proof={game:route.id,lang,ok:false};
    try{
     await preparePlayable(page,route.id);proof.gameplayLanguage=await gameplayLanguageProof(page,route.id,lang);
     if(route.id==='hanedanian'){
      const frame=await gameSurface(page,route.id);
      await frame.waitForFunction(()=>{const text=document.querySelector('#settlement-rail')?.textContent||'';return ['Çevrimdışı paket hazır','Offline package ready','Pakiet offline gotowy'].some(label=>text.includes(label));},null,{timeout:30000});
     }
     await page.waitForFunction(()=>Boolean(navigator.serviceWorker?.controller),null,{timeout:15000});
     await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
     // Starting/resuming a game requests additional card images. Their response
     // bodies must be hashed while the owning document still exists.
     await page.waitForLoadState('networkidle');await finishAssetReads(reads);
     assert.deepEqual(errors,[]);assert.deepEqual(requestFailures,[]);
     await page.reload({waitUntil:'networkidle'});await visible(page,route.id);
     if(route.id==='cete-savaslari'){await page.locator('.game-shell .hud-header').getByText('Master QA',{exact:false}).waitFor();proof.warmGameplayLanguage=await gameplayLanguageProof(page,route.id,lang);}
     proof.before=await saves(page,route.id);proof.nonemptySave=Object.keys(proof.before).length>0;
     proof.savePolicy=assertPreparedSave(route.id,proof.before);
     proof.savePolicy=['satranc','peg-solitaire','labirent'].includes(route.id)?'no resumable match; existing best-score state only':'existing persisted progress';
     await finishAssetReads(reads);assert.deepEqual(errors,[]);assert.deepEqual(requestFailures,[]);
     phase='offline';await context.setOffline(true);
     const response=await page.reload({waitUntil:'load',timeout:25000});assert.equal(response.status(),200);
     proof.render=await visible(page,route.id);
     if(route.id==='cete-savaslari'){await page.locator('.game-shell .hud-header').getByText('Master QA',{exact:false}).waitFor();proof.offlineGameplayLanguage=await gameplayLanguageProof(page,route.id,lang);}
     assert.equal(new URL(page.url()).origin,origin);
     proof.language=await page.evaluate(()=>({document:document.documentElement.lang,selected:localStorage.getItem('tariklab.language')}));assert.equal(proof.language.document,lang);assert.equal(proof.language.selected,lang);
     proof.after=await saves(page,route.id);assertSavedProgress(proof.before,proof.after);
     await finishAssetReads(reads);assert.deepEqual(errors,[]);assert.deepEqual(requestFailures,[]);
     await page.screenshot({path:`${out}/${route.id}-${lang}-offline.png`});proof.ok=true;
    }catch(error){proof.error=error.message;}finally{
     proof.errors=errors.filter(e=>e.phase==='offline');proof.requestFailures=requestFailures;proof.frames=await diagnostics(page);await context.setOffline(false);
     // Store only hashes of QA save data, never a full player record in evidence.
     proof.saveHashes=Object.fromEntries(['before','after'].map(stage=>[stage,Object.fromEntries(Object.entries(proof[stage]||{}).map(([key,value])=>[key,digest(JSON.stringify(value))]))]));delete proof.before;delete proof.after;
    }
    offline.push(proof);
   }
  }catch(error){row.error=error.message;}finally{
   await finishAssetReads(reads);row.assets=[...new Set(assetChecks)];row.browserBodyReads=browserBodyReads;row.browserBodyReadCount=browserBodyReads.length;row.errors=errors;row.requestFailures=requestFailures;
   if(errors.some(error=>error.phase==='online')||requestFailures.some(error=>error.phase==='online'))row.ok=false;
   results.push(row);await context.close();
   await writeFile(`${out}/progress.json`,JSON.stringify({mode,label,sha,origin,results,offline},null,2));
  }
  console.log(JSON.stringify({tag,ok:row.ok,error:row.error,offline:offline.find(x=>x.game===route.id&&x.lang===lang&&width===390)}));
 }
}finally{
 await browser.close();
 await writeFile(`${out}/results.json`,JSON.stringify({scope:requested.length||languages.length<3?'targeted':critical?'critical':'full',mode,label,sha,origin,expectedRoot,widths,languages,routes,hashes:Object.fromEntries(hashes),results,offline,summary:{cells:results.length,passed:results.filter(r=>r.ok).length,offlinePassed:offline.filter(r=>r.ok).length,offlineExpected:runOffline?routes.length*offlineLanguages.length:0,offlineStatus:runOffline?'required':mode==='source'?'built proof required':'separate critical capture; canonical offline gate required'}},null,2));
}
assert.equal(results.length,routes.length*languages.length*widths.length);assert.ok(results.every(row=>row.ok),'render/language/asset acceptance failed');
if(runOffline){assert.equal(offline.length,routes.length*offlineLanguages.length);assert.ok(offline.every(row=>row.ok),'offline/save acceptance failed');}
const canonical=CANONICAL_WIDTHS.every(width=>widths.includes(width))&&languages.length===3;
const marker=requested.length?'MASTER_TARGETED_PASS':mode==='source'?'MASTER_SOURCE_PASS':critical?'MASTER_CRITICAL_PASS':canonical&&runOffline?'MASTER_PRODUCTION_PASS':'MASTER_RENDER_PASS';
console.log(`${marker} ${label} ${results.length} cells ${offline.length} offline reloads`);
