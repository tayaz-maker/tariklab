import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {createStaticGameServer} from './static-game-server.mjs';
import {createNewGame} from '../public/games/tc-sim/js/state.js';
const directory=process.argv[2]||'public', label=process.argv[3]||'source';
const out=resolve(process.env.RUNNER_TEMP||'../evidence','tc-sim-2-ux',label);mkdirSync(out,{recursive:true});
const server=createStaticGameServer(directory);await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const rows=[];
try {for(const language of ['tr','en','pl']) for(const width of [320,390,1280,1440]) {
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}), page=await context.newPage(), errors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await context.addInitScript(({state,language})=>{if(!localStorage.getItem('seeded')){localStorage.setItem('tariklab::tc-sim:1',JSON.stringify(state));localStorage.setItem('tariklab::tc-sim:active','1');localStorage.setItem('tariklab.language',language);localStorage.setItem('seeded','1')}},{state:createNewGame({seed:37}),language});
 const start=Date.now();await page.goto(`${origin}/games/tc-sim/index.html`);await page.locator('#continue-game').click();await page.locator('.life-status').waitFor();
 const ready=Date.now()-start;const saved=await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1'));
 assert.equal(await page.locator('.life-status dd').count(),7);
 const toggle=page.locator('.side-nav .nav-more');
 if(width===1440){
  await page.setViewportSize({width:390,height:900});
  await page.waitForFunction(()=>document.querySelector('.side-nav .nav-more').getAttribute('aria-expanded')==='false');
  await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
  await toggle.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  await page.setViewportSize({width,height:900});
  await page.waitForFunction(()=>document.querySelector('.side-nav .nav-more').getAttribute('aria-expanded')==='true');
 }
 if(width>820){const before=await page.locator('.workspace').boundingBox();await toggle.click();const after=await page.locator('.workspace').boundingBox();assert.ok(after.width>before.width);await toggle.click()}else await toggle.click();
 const group=page.locator('[data-ui-panel="navigation:0"]');await group.locator('summary').click();assert.equal(await group.getAttribute('open'),null);await group.locator('summary').click();
 await page.locator('.life-nav-search input').fill(language==='pl'?'Banki':language==='en'?'Banks':'Bankalar');
 assert.equal(await page.locator('.nav-secondary [data-view]:visible').count(),1);
 await page.locator('.life-nav-search input').fill('');
 await page.locator('[data-ui-panel="navigation:6"] > summary').click();
 await page.locator('.life-nav-remember input').check();
 await page.locator('.side-nav [data-view="banks"]').click();await page.locator('.workspace-head h1').waitFor();
 assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('.workspace-head h1')),true);
 await page.reload();await page.locator('#continue-game').click();await page.locator('.side-nav [data-view="banks"].is-active').waitFor({state:'attached'});
 if(width<=820)await page.locator('.side-nav .nav-more').click();
 await page.locator('.life-nav-remember input').uncheck();
 await page.locator('.side-nav [data-view="dashboard"]').click();
 const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,bytes:performance.getEntriesByType('resource').reduce((s,r)=>s+r.transferSize,0),requests:performance.getEntriesByType('resource').length}));
 // A reserved classic scrollbar can make scrollWidth smaller than clientWidth.
 assert.ok(metrics.overflow<=0,'no content extends beyond the viewport');assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1')),saved,'UI never rewrites game saves');
 if(language==='tr')await page.screenshot({path:`${out}/${width}.png`,fullPage:true});
 rows.push({language,width,ready,...metrics,status:'PASS'});await context.close();
 }} finally {await browser.close();server.close()}
writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify({status:'PASS',cases:rows.length,rows}));
