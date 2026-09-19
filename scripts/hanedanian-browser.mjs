// Dedicated real Chromium acceptance. No request interception, fake storage or SW fixtures.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {createGame,advance} from '../public/games/hanedanian/engine.js';
import {encodeSave} from '../public/games/hanedanian/save.js';
const origin=process.env.GAME_E2E_ORIGIN||'http://127.0.0.1:8082';
const out=`${process.env.RUNNER_TEMP||'/workspace'}/screenshots/hanedanian`;
mkdirSync(out,{recursive:true});
const results=[],errors=[];
const server=process.env.GAME_E2E_ORIGIN?null:spawn('npm',['run','dev','--','--host','127.0.0.1','--port','8082'],{stdio:'inherit'});
let browser,activePage;
async function checkLayout(page,label){
 const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,height:innerHeight,body:document.body.innerText.length}));
 assert.ok(metrics.body>50,label);assert.ok(metrics.scroll<=metrics.width+1,`${label}: overflow ${JSON.stringify(metrics)}`);results.push({label,...metrics});
}
async function archive(page){
 await page.locator('#menu-button').click();await page.locator('[data-action="export"]').click();
 const text=await page.locator('#export-text').inputValue();await page.locator('#dialog').press('Escape');return JSON.parse(text).state;
}
async function save(page){await page.locator('#menu-button').click();await page.locator('[data-action="manual-save"]').click();await page.waitForFunction(()=>document.querySelector('[data-action=manual-save]')?.disabled===false);await page.locator('[data-action="resume"]').click();await page.locator('#dialog').waitFor({state:'hidden'});}
async function select(page,x,y){const c=page.locator('#world-map');await page.locator('#navigation [data-view="map"]').click();await c.focus();await c.press('Home');for(let i=24;i<x;i++)await c.press('ArrowRight');for(let i=24;i>x;i--)await c.press('ArrowLeft');for(let i=24;i<y;i++)await c.press('ArrowDown');for(let i=24;i>y;i--)await c.press('ArrowUp');}
async function touch(page, points, type){const client=page.touchClient||=await page.context().newCDPSession(page);await client.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,id)=>({...p,id,radiusX:4,radiusY:4,force:1}))});}
async function importState(page,state){if(await page.locator('#welcome').isVisible())await page.locator('#welcome [data-action="import"]').click();else{await page.locator('#menu-button').click();await page.locator('[data-action="import"]').click();}await page.locator('#import-text').fill(encodeSave(state));await page.locator('#import-form button[type="submit"]').click();await page.locator('#welcome').waitFor({state:'hidden'});}
try {
 let ready=false;for(let i=0;i<150;i++){try{ready=(await fetch(`${origin}/games/hanedanian/index.html`)).ok;}catch{/* The development server is still starting. */}if(ready)break;await new Promise(r=>setTimeout(r,200));}assert.ok(ready,'server ready');
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 for(const [width,height,mobile] of [[1280,720,false],[1920,1080,false],[360,800,true]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
  const page=await context.newPage();activePage=page;page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${origin}/games/hanedanian/index.html`);await page.locator('[data-action="new"]').first().click();await page.locator('#new-form input[name="seed"]').fill('TL-BROWSER-ACCEPTANCE');await page.locator('#new-form button').click();await page.locator('#welcome').waitFor({state:'hidden'});
  await page.waitForFunction(()=>Number(document.querySelector('#world-map').dataset.drawnTiles)>0);
  await checkLayout(page,`${width}:launch`);
  const canvas=page.locator('#world-map'),box=await canvas.boundingBox(),x=box.x+box.width*.5,y=box.y+box.height*.35;
  const before=Number(await canvas.getAttribute('data-zoom'));
  if(mobile){
   await touch(page,[{x:x-25,y},{x:x+25,y}],'touchStart');await touch(page,[{x:x-65,y},{x:x+65,y}],'touchMove');await touch(page,[],'touchEnd');
  }else{await page.mouse.move(x,y);await page.mouse.wheel(0,-250);}
  await page.waitForFunction(value=>Number(document.querySelector('#world-map').dataset.zoom)!==value,before);
  await page.getByRole('button',{name:'Aktif yerleşime dön',exact:true}).click();await page.locator('[data-action="deselect"]').click();await page.waitForTimeout(100);const centerBefore=await canvas.getAttribute('data-center');
  if(mobile){await touch(page,[{x,y}],'touchStart');await touch(page,[{x:x-85,y:y+20}],'touchMove');await touch(page,[],'touchEnd');}
  else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-100,y+20,{steps:8});await page.mouse.up();}
  await page.waitForFunction(before=>document.querySelector('#world-map').dataset.center!==before,centerBefore);
  assert.equal(await page.locator('#inspector').evaluate(el=>el.classList.contains('has-selection')),false,'drag must not select a tile');
  if(mobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
  await page.locator('#inspector.has-selection').waitFor();await checkLayout(page,`${width}:selection`);
  await page.locator('[data-action="deselect"]').click();
  await select(page,0,24);assert.match(await page.locator('.coordinate').innerText(),/^0 · 24/);await page.locator('[data-action="deselect"]').click();
  await page.locator('#navigation [data-view="settlement"]').click();await page.locator('[data-build="farm"]').click();
  assert.match(await page.locator('#section-view').innerText(),/sırada|kuyruk/i);
  await page.locator('[data-speed="12"]').click();await page.waitForTimeout(7000);await page.locator('[data-speed="0"]').click();
  let state=await archive(page);assert.equal(state.settlements[0].buildings.farm,3,'real queue completion');
  await select(page,26,25);await page.locator('[data-action="scout"]').click();await page.locator('#scout-form button').click();await page.locator('[data-speed="12"]').click();await page.waitForTimeout(5000);await page.locator('[data-speed="0"]').click();
  state=await archive(page);assert.ok(state.intel['26,25'],'actual scout report');
  await select(page,26,25);await page.locator('[data-action="claim"]').click();await page.locator('#army-form input[name="militia"]').fill('10');await page.locator('#army-form button').click();await page.locator('[data-speed="12"]').click();await page.waitForTimeout(8000);await page.locator('[data-speed="0"]').click();
  state=await archive(page);assert.equal(state.world.tiles[25*49+26].poi.ownerId,'player','army arrives and claims point');
  await page.locator('#navigation [data-view="council"]').click();assert.match(await page.locator('#section-view').innerText(),/Sancak dikildi|istihbarat geldi/);
  await page.locator('#navigation [data-view="dynasty"]').click();await checkLayout(page,`${width}:campaign`);
  const site=state.world.tiles.filter(t=>!t.poi&&state.settlements.every(q=>Math.hypot(t.x-q.x,t.y-q.y)>=3)).sort((a,b)=>Math.hypot(a.x-24,a.y-24)-Math.hypot(b.x-24,b.y-24))[0];
  await select(page,site.x,site.y);await page.locator('[data-action="expand"]').click();await page.locator('#expand-form button').click();await page.locator('[data-speed="12"]').click();await page.waitForTimeout(12000);await page.locator('[data-speed="0"]').click();assert.equal((await archive(page)).settlements.filter(t=>t.ownerId==='player').length,2,'real founding expedition');
  await save(page);const checkpoint=await archive(page);await page.reload();await page.locator('[data-load="auto"]').first().click();await page.locator('#welcome').waitFor({state:'hidden'});assert.equal((await archive(page)).world.seed,checkpoint.world.seed);
  await page.locator('#navigation [data-view="map"]').click();await page.screenshot({path:`${out}/map-${width}.png`});
  if(mobile){
   // Native history navigation, then resume from actual local persistence.
   await page.goto(`${origin}/credits.html`);await page.goBack();await page.locator('[data-load="auto"]').first().click();await page.locator('#welcome').waitFor({state:'hidden'});await checkLayout(page,'mobile:back');
  }
  await context.close();
 }
 // Real SW + real IndexedDB; assert an uncached request fails while offline.
 const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true});const page=await context.newPage();activePage=page;page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`${origin}/games/hanedanian/index.html`);
 const seeded=createGame({seed:'TL-OFFLINE-REAL'});seeded.settings.autoPause=false;seeded.paused=false;advance(seeded,600);seeded.paused=true;
 await importState(page,seeded);await page.waitForFunction(()=>document.body.innerText.includes('Çevrimdışı paket hazır'),null,{timeout:30000});await save(page);
 const exported=await archive(page);await context.setOffline(true);await page.reload();await page.locator('[data-load="auto"]').first().click();await page.locator('#welcome').waitFor({state:'hidden'});assert.equal((await archive(page)).world.seed,exported.world.seed);
 assert.equal(await page.evaluate(async()=>{try{await fetch('/__uncached_offline_probe__?t='+Date.now());return false;}catch{return true;}}),true,'network really disabled');
 await page.locator('#navigation [data-view="settlement"]').click();await page.locator('[data-build="lumber"]').click();await save(page);const changed=await archive(page);assert.ok(changed.settlements[0].queue.length>0);
 await page.reload();await page.locator('[data-load="auto"]').first().click();await page.locator('#welcome').waitFor({state:'hidden'});assert.equal((await archive(page)).settlements[0].queue.length,changed.settlements[0].queue.length);
 await page.locator('#menu-button').click();await page.locator('[data-load="manual"]').click();await page.locator('#dialog').waitFor({state:'hidden'});assert.equal((await archive(page)).world.seed,'TL-OFFLINE-REAL');
 // Leave the game first so its pagehide journal cannot overwrite the corruption.
 await context.setOffline(false);await page.goto(`${origin}/credits.html`);
 // Corrupt ONLY this isolated test context's auto and journal; previous must recover.
 await page.evaluate(async()=>{localStorage.removeItem('tariklab::hanedanian:emergency:v1');await new Promise((resolve,reject)=>{const r=indexedDB.open('tariklab-hanedanian',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('saves','readwrite'),store=tx.objectStore('saves'),q=store.get('auto');q.onsuccess=()=>{store.put({...q.result,raw:'broken-json'});};tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};r.onerror=()=>reject(r.error);});});
 await page.goto(`${origin}/games/hanedanian/index.html`);await page.locator('[data-load="auto"]').first().click();await page.locator('#welcome').waitFor({state:'hidden'});assert.equal((await archive(page)).world.seed,'TL-OFFLINE-REAL');
 await context.setOffline(false);await page.reload();await page.locator('[data-load="auto"]').first().click();await page.locator('#welcome').waitFor({state:'hidden'});await checkLayout(page,'offline:reconnect');await page.screenshot({path:`out/offline.png`.replace('out/',out+'/')});
 await importState(page,seeded);assert.equal((await archive(page)).world.seed,'TL-OFFLINE-REAL');
 await page.locator('#menu-button').click();await page.locator('[data-action="import"]').click();await page.locator('#import-text').fill('{"bad":"save"}');await page.locator('#import-form button').click();assert.ok(await page.locator('#dialog-notice').isVisible());await page.locator('#dialog').press('Escape');assert.equal((await archive(page)).world.seed,'TL-OFFLINE-REAL');
 results.push({label:'offline-real-idb-sw',passed:true});await context.close();
 assert.deepEqual(errors,[],'uncaught browser/console errors');
} catch(error){if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:`${out}/failure.png`,fullPage:true}).catch(()=>{});writeFileSync(`${out}/failure.txt`,`${error.stack}\n${await activePage.locator('body').innerText().catch(()=>'')}`);}throw error;} finally {writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));await browser?.close();server?.kill('SIGTERM');}
console.log(JSON.stringify({checks:results.length,errors}));
