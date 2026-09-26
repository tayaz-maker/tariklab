// Bounded real-browser acceptance. Static source or clean build; no CI polling/soak.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import {applyMove,deserializeSolo,SOLO_KEY} from '../public/games/ihtilal/solo.js';
import {checkedOutputPath} from './browser-guard.mjs';
const args=process.argv.slice(2),arg=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const root=resolve(arg('--serve','public')),label=arg('--label','head'),baseline=args.includes('--baseline'),only=arg('--only','');
const proofRoot=resolve(process.env.RUNNER_TEMP||'/workspace','screenshots');
const out=checkedOutputPath(resolve(proofRoot,'ihtilal',label),[proofRoot],'proof');
await mkdir(out,{recursive:true});const results=[],errors=[];let browser,page;
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,`.${pathname.endsWith('/')?pathname+'index.html':pathname}`);if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const state=async()=>JSON.parse(await page.evaluate(key=>localStorage.getItem(key),SOLO_KEY)).state;
async function layout(scenario,phase){const m=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,text:document.body.innerText.length,canvases:document.querySelectorAll('canvas').length,nodes:document.querySelectorAll('.basin-map [role=button]').length,renderer:document.querySelector('.basin-surface')?.dataset.renderer,renderMs:Number(document.querySelector('.basin-surface')?.dataset.renderMs)||null}));assert.ok(m.text>100);assert.ok(m.scroll<=m.width+1,`${scenario}/${phase}: overflow ${JSON.stringify(m)}`);assert.ok(m.canvases<=1,'no orphaned canvas');results.push({scenario,phase,...m});}
const open=async()=>{await page.getByRole('button',{name:'Dosyayı aç',exact:true}).click();await page.locator('.basin-map').waitFor();};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 for(const width of [1440,390,320])for(const mode of baseline?['svg']:['default','svg']){
  const scenario=`${mode}-${width}`;if(only&&only!==scenario)continue;
  const context=await browser.newContext({viewport:{width,height:width===1440?960:844},deviceScaleFactor:1,isMobile:width<500,hasTouch:width<500});
  if(mode==='svg')await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...a){return /webgl/.test(type)?null:get.call(this,type,...a);};});
  page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push({scenario,error:String(e)}));page.on('console',m=>{if(m.type()==='error')errors.push({scenario,error:m.text()});});
  await page.goto(`${origin}/games/ihtilal/index.html`);const start=performance.now();await open();
  const startup=performance.now()-start;
  if(!baseline)await page.waitForFunction(renderer=>document.querySelector('.basin-surface')?.dataset.renderer===renderer,mode==='default'?'pixi':'svg');
  await layout(scenario,'open');
  if(!baseline)assert.ok(await page.locator('.basin-link').evaluateAll(lines=>lines.length===9&&lines.every(line=>getComputedStyle(line).stroke!=='none')),'all nine route lines are visible');
  assert.equal(await page.locator('.basin-map [role=button]').count(),7);
  const costs=[];
  for(let n=0;n<7;n++){const started=performance.now();await page.locator('.basin-map [role=button]').nth(n).click();costs.push(performance.now()-started);}
  results.push({scenario,phase:'selection-performance',startupMs:startup,medianInteractionMs:[...costs].sort((a,b)=>a-b)[3]});
  if(baseline){await page.locator('.act').first().click();await page.locator('.inline-outcome').waitFor();await page.screenshot({path:`${out}/${scenario}.png`,fullPage:true});await context.close();continue;}
  for(const key of ['intel','trust','tension','capacity','strain'])await page.locator(`[data-layer="${key}"]`).click();
  await page.locator('[data-basin="bati"]').focus();await page.keyboard.press('Enter');assert.equal((await state()).selected,'bati');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-basin')),'bati','focus survives selection');
  await page.locator('.route-fold summary').click();await page.locator('[data-focus-key="route-target"]').selectOption('kuzey');
  // Selection rerenders the fold; reopen only if it is actually closed.
  if(!await page.locator('[data-connection]').isVisible())await page.locator('.route-fold summary').click();
  await page.locator('[data-connection="buffered"]').click();assert.equal((await state()).capacity,2);
  await page.locator('[data-move="ac"]').click();assert.ok((await state()).network.pulses.length>0);
  const before=await state(),expected=applyMove(before,'devret');
  await page.locator('[data-move="devret"]').click();assert.deepEqual(await state(),expected,'real UI and engine agree on aid plus auto-close');
  await layout(scenario,'decision');await page.screenshot({path:`${out}/${scenario}-decision.png`,fullPage:true});
  const saved=await state();await page.reload();await open();assert.deepEqual(await state(),saved,'save/reload includes routes, in-flight waves and phase');
  await page.setViewportSize({width:720,height:390});await layout(scenario,'landscape');await page.setViewportSize({width,height:width===1440?960:844});
  await page.getByRole('button',{name:'Dosya menüsü',exact:true}).click();assert.equal(await page.locator('canvas').count(),0,'menu releases the renderer');await open();assert.deepEqual(await state(),saved,'same session menu does not reset');
  if(mode==='default'){
   await page.waitForFunction(()=>document.querySelector('.basin-surface')?.dataset.renderer==='pixi');
   const loss=await page.evaluate(()=>{const c=document.querySelector('.basin-gpu canvas');const gl=c.getContext('webgl2')||c.getContext('webgl');const ext=gl.getExtension('WEBGL_lose_context');if(!ext)return false;ext.loseContext();return true;});
   assert.equal(loss,true,'actual context-loss API available');await page.waitForFunction(()=>document.querySelector('.basin-surface')?.dataset.renderer==='svg');
   assert.equal(await page.locator('canvas').count(),0);assert.deepEqual(await state(),saved,'context loss preserves the decision');
  }
  await page.getByRole('button',{name:'Hafif harita',exact:true}).click();await page.locator('[data-layer="intel"]').click();await layout(scenario,'fallback');
  let sawBreak=false;
  for(let turn=0;turn<26&&!(await page.locator('.report-verdict').count());turn++){
   const live=await state();if(live.phase==='break'){sawBreak=true;await page.locator('[data-move="acik"]').click();}
   else if(await page.locator('[data-move="kapat"]').count())await page.locator('[data-move="kapat"]').click();
   else await page.locator('[data-move="tut"]').click();
  }
  assert.equal((await state()).phase,'end');assert.ok(sawBreak);await layout(scenario,'ending');
  const terminal=await state();await page.reload();await page.getByRole('button',{name:'Dosyayı aç',exact:true}).click();await page.locator('.report-verdict').waitFor();assert.deepEqual(await state(),terminal,'terminal save is not silently restarted');
  await page.getByRole('button',{name:'Yeni dosya',exact:true}).click();assert.equal((await state()).period,1);await layout(scenario,'reset');await context.close();
 }
 if(!baseline&&!only){
  const fixtures=JSON.parse(await readFile(new URL('./fixtures/ihtilal-solo-v1.json',import.meta.url),'utf8'));
  const context=await browser.newContext({viewport:{width:320,height:844}});page=await context.newPage();
  await page.addInitScript(({key,backup})=>{if(!localStorage.getItem('qa-loaded')){localStorage.setItem(key,'{broken');localStorage.setItem(key+'.backup',JSON.stringify(backup));localStorage.setItem('qa-loaded','yes');}}, {key:SOLO_KEY,backup:fixtures[1]});
  await page.goto(`${origin}/games/ihtilal/index.html`);await open();assert.equal((await state()).seed,fixtures[1].state.seed);assert.match(await page.locator('.save-status').innerText(),/yedek/);assert.ok(deserializeSolo(JSON.stringify({key:SOLO_KEY,version:1,state:await state()})));
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('QuotaExceededError');};});
  await page.locator('[data-move="tut"]').click();assert.match(await page.locator('.save-status').innerText(),/Kalıcı kayıt yapılamadı/);
  await layout('recovery-320','backup-and-storage-failure');await context.close();
 }
 assert.deepEqual(errors,[],'no console/runtime errors');
}catch(error){errors.push({failure:error.stack});if(page&&!page.isClosed())await page.screenshot({path:`${out}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(`${out}/results.json`,JSON.stringify({label,baseline,results,errors},null,2));await browser?.close();await new Promise(r=>server.close(r));}
console.log(JSON.stringify({label,checks:results.length,errors}));
