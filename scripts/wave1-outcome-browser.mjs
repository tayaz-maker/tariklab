// Real decisions and paired visual evidence. No engine or save writes in the page.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {checkedUrl,checkedOutputPath} from './browser-guard.mjs';
import {loadGame} from './racon-harness.mjs';
import {createSolo,serializeSolo,SOLO_KEY} from '../public/games/ihtilal/solo.js';
const args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const baseline=args.includes('--baseline'),label=arg('--label','source'),root=resolve(arg('--serve','public'));
const proofRoot=resolve(process.env.RUNNER_TEMP||'/workspace','screenshots');
const out=checkedOutputPath(resolve(proofRoot,'wave1-outcome',label),[proofRoot]);await mkdir(out,{recursive:true});
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=process.env.WAVE1_BASE?null:createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const file=resolve(root,'.'+decodeURIComponent(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(await readFile(file));}catch{res.writeHead(404).end();}});
if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=checkedUrl(process.env.WAVE1_BASE||`http://127.0.0.1:${server.address().port}`);
const harness=loadGame();harness.ev('blank("Avlu");enterPlay();S.seed=4242;S.kasa=50000;S.cleanKasa=50000;S.dirtyKasa=0;S.screen="harita";S.stage="kabadayi";S.day=7;S.streets[1].sahip="sen";writeSave();');
const raconSave=JSON.parse(harness.localStorage.getItem('tariklab::racon:1'));
const results=[],errors=[];let browser,page;
const transfer=p=>p.evaluate(()=>{const rows=[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')];return {transferBytes:rows.reduce((n,r)=>n+(r.transferSize||0),0),requestCount:rows.length,pixiRequests:rows.filter(r=>/pixi/i.test(r.name)).length};});
const readRacon=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('tariklab::racon:1')));
const readBasin=p=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)).state,SOLO_KEY);
async function hanSave(p){await p.locator('#menu-button').click();await p.locator('[data-action="export"]').click();const state=JSON.parse(await p.locator('#export-text').inputValue()).state;await p.locator('#dialog').press('Escape');return state;}
async function layout(tag){const m=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,stage:[...document.querySelectorAll('#stage')].map(e=>({width:e.clientWidth,scroll:e.scrollWidth})),cards:[...document.querySelectorAll('[data-outcome-moment]')].map(e=>({width:e.clientWidth,scroll:e.scrollWidth})),canvases:document.querySelectorAll('canvas').length}));assert.ok(m.scroll<=m.width+1,`${tag}: ${JSON.stringify(m)}`);for(const r of [...m.stage,...m.cards])assert.ok(r.scroll<=r.width+1,`${tag}: ${JSON.stringify(r)}`);results.push({tag,layout:m});}
async function screenshot(tag){await page.screenshot({path:`${out}/${tag}.png`,fullPage:true,scale:'css'});}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 for(const game of ['hanedanian','ihtilal','racon'])for(const option of [{width:1440},{width:390},{width:320},...(!baseline&&game!=='hanedanian'?[{width:390,memory:1},{width:1440,dpr:4}]:[])]){
  const {width,memory,dpr}=option,limited=!!memory||!!dpr;
  const mode=width===320||limited?'svg':'pixi',motion=width===1440?'no-preference':'reduce',tag=`${game}-${width}-${mode}${memory?'-low-memory':dpr?'-pixel-budget':''}`;
  const context=await browser.newContext({viewport:{width,height:width===1440?960:844},deviceScaleFactor:dpr||1,isMobile:width<500,hasTouch:width<500,reducedMotion:motion});
  await context.addInitScript(({game,mode,memory,limited,raconSave,basinSave,key})=>{
   if(memory)Object.defineProperty(navigator,'deviceMemory',{get:()=>memory,configurable:true});
   localStorage.setItem('tariklab.language','tr');
   if(!sessionStorage.getItem('wave1-initialized')){
    if(game==='racon'){localStorage.setItem('tariklab::racon:1',JSON.stringify(raconSave));localStorage.setItem('tariklab::racon:active','1');}
    if(game==='ihtilal')localStorage.setItem(key,basinSave);
    sessionStorage.setItem('wave1-initialized','yes');
   }
   if(mode==='svg'&&!limited){const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};}
  },{game,mode,memory,limited,raconSave,basinSave:serializeSolo(createSolo(4242)),key:SOLO_KEY});
  page=await context.newPage();page.setDefaultTimeout(15000);
  const caseErrors=[];page.on('pageerror',e=>caseErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')caseErrors.push(m.text());});
  const opened=performance.now();await page.goto(`${base}/games/${game}/index.html`);
  await page.waitForFunction(()=>document.body.innerText.trim().length>60);
  const firstRenderMs=Math.round(performance.now()-opened),menuTransfer=await transfer(page),mapStarted=performance.now();
  if(game==='hanedanian'){
   await page.locator('[data-action="new"]').first().click();await page.locator('#new-form input[name="seed"]').fill('WAVE1-PROOF');await page.locator('#new-form button').click();await page.locator('#welcome').waitFor({state:'hidden'});
   if(await page.locator('[data-guide="dismiss"]').isVisible())await page.locator('[data-guide="dismiss"]').click();
   await page.locator('#navigation [data-view="settlement"]').click();
  }else if(game==='ihtilal')await page.getByRole('button',{name:'Dosyayı aç',exact:true}).click();
  else{await page.locator('#btn-devam').click();await page.locator('.rm-node[data-id="st_aksem"]').click();await page.locator('[data-act="ag-sec"][data-kind="cekil"]').click();await page.locator('[data-act="ag-target"][data-id="st_fevzi"]').click();}
  if(game!=='hanedanian')await page.waitForFunction(({selector,mode})=>document.querySelector(selector)?.dataset.renderer===mode,{selector:game==='ihtilal'?'.basin-surface':'.rm-surface',mode});
  const surfaceMs=Math.round(performance.now()-mapStarted),mapTransfer=await transfer(page);
  if(limited)assert.equal(mapTransfer.pixiRequests,0,'memory/pixel guard avoids Pixi download');
  results.push({tag,performance:{firstRenderMs,surfaceMs,...mapTransfer,lazyTransferBytes:mapTransfer.transferBytes-menuTransfer.transferBytes,lazyRequests:mapTransfer.requestCount-menuTransfer.requestCount,pixiAtMenu:menuTransfer.pixiRequests}});
  assert.equal(await page.locator('[data-outcome-moment]').count(),0,'no hydration replay');
  await layout(`${tag}:before`);await screenshot(`${tag}-before`);
  const before=game==='racon'?await readRacon(page):game==='ihtilal'?await readBasin(page):null;
  const action=page.locator(game==='hanedanian'?'[data-build="farm"]':game==='ihtilal'?'[data-move="tut"]':'[data-act="ag"][data-kind="cekil"]');
  await action.click();
  if(!baseline){
   const card=page.locator('[data-outcome-moment]');await card.waitFor();
   const close=card.locator('[data-outcome-close]');await close.focus();
   await card.scrollIntoViewIfNeeded();await layout(`${tag}:outcome`);await screenshot(`${tag}-after`);
   assert.ok(await page.locator('[role="status"]').filter({hasText:game==='hanedanian'?'FERMAN':game==='ihtilal'?'Tut':'kararı kabul'}).count()>0,'polite outcome message');
   assert.equal(await card.locator('canvas,img,audio,video').count(),0,'light original artwork');
   if(motion==='reduce')assert.equal(await card.evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0,'static reduced motion');
   await page.waitForTimeout(2400);assert.equal(await card.count(),1,'focus/reduced does not time out');
   if(game==='racon'){const after=await readRacon(page);assert.equal(after.kasa-before.kasa,-250);assert.match(await card.innerText(),/250/);assert.equal(after.ag.flow.queue[0].left,2);assert.match(await card.innerText(),/2 kapanış/);}
   if(game==='ihtilal'){const after=await readBasin(page);assert.equal(after.capacity,before.capacity-1);assert.match(await card.innerText(),/3 → 2/);}
   if(motion==='no-preference'){
    await page.locator(game==='hanedanian'?'#menu-button':game==='ihtilal'?'[data-focus-key="menu"]':'.top [data-act="menu"]').focus();
    await page.mouse.move(0,0);const start=Date.now();await card.waitFor({state:'detached',timeout:3000});assert.ok(Date.now()-start>=1500&&Date.now()-start<2700,'bounded 2.2s dismissal');
   }else{await close.press('Escape');await card.waitFor({state:'detached'});}
   assert.notEqual(await page.evaluate(()=>document.activeElement?.tagName),'BODY','focus remains in game');
  }else await screenshot(`${tag}-after`);
  if(game==='hanedanian'){
   const saved=await hanSave(page);assert.equal(saved.settlements[0].queue.length,1);
   await page.locator('#navigation [data-view="map"]').click();await page.locator('#world-map').focus();await page.locator('#world-map').press('Home');
   if(!baseline)assert.equal(await page.locator('.han-work-trace progress').count(),1,'map explains current queue mark');
   await screenshot(`${tag}-map`);
   if(!baseline){await page.locator('[data-map="accessible"]').click();await page.locator('.map-directory').waitFor();assert.ok(await page.locator('.atlas-place-list progress').count()>0,'DOM fallback shares queue progress');assert.equal(await page.locator('.has-pixi-terrain').count(),0,'DOM switch releases Pixi');await layout(`${tag}:dom-fallback`);}
   await page.reload();await page.locator('[data-load="auto"]').first().click();await page.locator('#welcome').waitFor({state:'hidden'});const restored=await hanSave(page);assert.deepEqual(restored.settlements[0].queue,saved.settlements[0].queue);
  }else if(game==='ihtilal'){
   const saved=await readBasin(page);await page.locator('[data-layer="trust"]').click();if(!baseline)assert.ok(await page.locator('.basin-metric-band').count()>0);await screenshot(`${tag}-map`);
   await page.reload();await page.getByRole('button',{name:'Dosyayı aç',exact:true}).click();assert.deepEqual(await readBasin(page),saved);
  }else{
   const saved=await readRacon(page);await page.locator('[data-act="rm-layer"][data-id="trust"]').click();if(!baseline)assert.ok(await page.locator('[data-street-mark="trust-light"]').count()>0);await screenshot(`${tag}-map`);
   await page.reload();await page.locator('#btn-devam').click();assert.deepEqual((await readRacon(page)).ag,saved.ag);
  }
  assert.equal(await page.locator('[data-outcome-moment]').count(),0,'save reload does not replay');
  if(game!=='hanedanian'){
   const surfaceSelector=game==='ihtilal'?'.basin-surface':'.rm-surface',markSelector=game==='ihtilal'?'.basin-metric-band':'[data-street-mark]';
   await page.evaluate(({surfaceSelector,markSelector})=>{
    const surface=document.querySelector(surfaceSelector);window.__mapCost={removed:0,samples:[]};
    window.__mapCost.observer=new MutationObserver(records=>{for(const row of records)for(const node of row.removedNodes)if(node.nodeType===1)window.__mapCost.removed+=(node.matches(markSelector)?1:0)+node.querySelectorAll(markSelector).length;});
    window.__mapCost.observer.observe(surface,{childList:true,subtree:true});
   },{surfaceSelector,markSelector});
   for(let i=0;i<12;i++){
    await page.locator(game==='ihtilal'?'[data-basin]':'.rm-node').nth(i%2).click();
    await page.evaluate(selector=>window.__mapCost.samples.push(Number(document.querySelector(selector).dataset.renderMs||0)),surfaceSelector);
   }
   const interaction=await page.evaluate(()=>{const m=window.__mapCost;m.observer.disconnect();m.samples.sort((a,b)=>a-b);const result={selectionUpdates:m.samples.length,removedBaseMarks:m.removed,medianRenderMs:m.samples[Math.floor(m.samples.length/2)]};delete window.__mapCost;return result;});
   if(!baseline)assert.equal(interaction.removedBaseMarks,0,'selection retains static state marks');
   results.push({tag,interaction});
  }
  await page.setViewportSize({width:720,height:390});await layout(`${tag}:resize`);await page.setViewportSize({width,height:width===1440?960:844});
  if(!baseline&&game!=='hanedanian'){
   const surface=page.locator(game==='ihtilal'?'.basin-surface':'.rm-surface');
   await page.waitForFunction(({selector,mode})=>document.querySelector(selector)?.dataset.renderer===mode,{selector:game==='ihtilal'?'.basin-surface':'.rm-surface',mode});
   if(mode==='pixi'){
    assert.equal(await page.evaluate(selector=>{const canvas=document.querySelector(selector+' canvas'),gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');const loss=gl?.getExtension('WEBGL_lose_context');if(!loss)return false;loss.loseContext();return true;},game==='ihtilal'?'.basin-surface':'.rm-surface'),true,'real WebGL loss');
    await page.waitForFunction(selector=>document.querySelector(selector)?.dataset.renderer==='svg',game==='ihtilal'?'.basin-surface':'.rm-surface');
   }
   assert.equal(await surface.locator('canvas').count(),0,'fallback cleans canvas');
   if(game==='ihtilal')await page.getByRole('button',{name:'Dosya menüsü',exact:true}).click();
   else await page.locator('.top [data-act="menu"]').click();
   assert.equal(await page.locator('canvas').count(),0,'screen switch cleanup');
  }
  assert.deepEqual(caseErrors,[],`${tag} console`);
  results.push({tag,ok:true,saveReload:true,noReplay:true,errors:caseErrors});await context.close();
 }
 if(!baseline){
  // Record actual served game presentation bytes on preview and both production hosts.
  const served={};for(const path of ['hanedanian/outcome-moment.js','ihtilal/outcome-moment.js','racon/outcome-moment.js','shared/outcome-runtime.js']){const response=await fetch(`${base}/games/${path}`);assert.equal(response.status,200);const body=Buffer.from(await response.arrayBuffer());assert.deepEqual(body,await readFile(resolve('public/games',path)),`${path}: deployed/source parity`);served[path]=createHash('sha256').update(body).digest('hex');}results.push({served});
 }
}catch(e){errors.push(e.stack);if(page&&!page.isClosed())await page.screenshot({path:`${out}/failure.png`,fullPage:true,scale:'css'}).catch(()=>{});throw e;}
finally{await writeFile(`${out}/results.json`,JSON.stringify({label,baseline,base,results,errors},null,2));await browser?.close();if(server)await new Promise(r=>server.close(r));}
console.log(JSON.stringify({label,scenarios:results.filter(r=>r.ok).length,errors}));

if(label==='built'){
 const snapshots=await Promise.all(['before','source','built'].map(async name=>JSON.parse(await readFile(resolve(out,'..',name,'results.json'),'utf8'))));
 const lines=['# Wave 1 measured performance','', 'Fresh browser contexts; same fixtures and UI actions. Transfer bytes use Navigation/Resource Timing transferSize (encoded payload + response headers). Surface time includes starting the game and selecting its tested decision; lazy transfer is the delta after the initial menu. No claim of universal network latency.','', '| Game / viewport | Before bytes / requests | Built bytes / requests | Before → built first render ms | Before → built decision surface ms | Built lazy bytes / requests |','| --- | ---: | ---: | ---: | ---: | ---: |'];
 for(const row of snapshots[0].results.filter(r=>r.performance)){const next=snapshots[2].results.find(r=>r.tag===row.tag&&r.performance);if(!next)continue;const a=row.performance,b=next.performance;lines.push(`| ${row.tag} | ${a.transferBytes} / ${a.requestCount} | ${b.transferBytes} / ${b.requestCount} | ${a.firstRenderMs} → ${b.firstRenderMs} | ${a.surfaceMs} → ${b.surfaceMs} | ${b.lazyTransferBytes} / ${b.lazyRequests} |`);}
 lines.push('', '| Selection burst / viewport | Removed base marks before → built | Median synchronous renderer ms before → built |', '| --- | ---: | ---: |');
 for(const row of snapshots[0].results.filter(r=>r.interaction)){const next=snapshots[2].results.find(r=>r.tag===row.tag&&r.interaction);if(next)lines.push(`| ${row.tag} | ${row.interaction.removedBaseMarks} → ${next.interaction.removedBaseMarks} | ${row.interaction.medianRenderMs} → ${next.interaction.medianRenderMs} |`);}
 await writeFile(resolve(out,'..','performance-comparison.md'),lines.join('\n')+'\n');
}
