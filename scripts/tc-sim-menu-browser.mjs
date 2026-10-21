// Canonical route/content ownership acceptance. Uses actual clicks and history.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {createStaticGameServer} from './static-game-server.mjs';
import {navigateTc} from './tc-sim-browser-navigation.mjs';
import {cityFixture} from './tc-sim-city-fixture.mjs';
import {NAVIGATION_ITEMS,screenTitle} from '../public/games/tc-sim/js/navigation.js';
import {PLAYABLE_REGIONS} from '../public/games/tc-sim/js/locations.js';
const directory=process.argv[2]||'public',label=process.argv[3]||'source';
const out=resolve(process.env.TC_MENU_OUT||'../../outputs/tc-menu',label);mkdirSync(out,{recursive:true});
const server=createStaticGameServer(directory);await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
import {ownership,assertMenuScreen} from './tc-sim-menu-contract.mjs';
const report={status:'RUNNING',routes:NAVIGATION_ITEMS.map(i=>i.view),cases:[],ownership,inventory:{},zoom:[]};
try{
for(const language of (process.env.TC_MENU_LANGUAGES||'tr,en,pl').split(','))for(const width of (process.env.TC_MENU_WIDTHS||'320,390,768,1280,1440').split(',').map(Number)){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 const fixture=cityFixture();fixture.world.scenario.pendingEvent=null;
 await context.addInitScript(({fixture,language})=>{if(localStorage.getItem('menu-seeded'))return;localStorage.setItem('menu-seeded','1');localStorage.setItem('tariklab::tc-sim:1',JSON.stringify(fixture));localStorage.setItem('tariklab::tc-sim:active','1');localStorage.setItem('tariklab.language',language);},{fixture,language});
 await page.goto(`${origin}/games/tc-sim/index.html`);await page.locator('#continue-game').click();
 const save=await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1'));
 const baseline=await page.locator('.game-topbar').boundingBox();
 const seen=new Set();
 for(const {view} of NAVIGATION_ITEMS){
  await navigateTc(page,view);await assertMenuScreen(page,view,language,seen);
  const g=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,sidebar:document.querySelector('.side-nav').getBoundingClientRect().width,x:document.querySelector('.workspace').getBoundingClientRect().x,controls:[...document.querySelectorAll('.workspace button,.workspace input,.workspace select')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.right>innerWidth+1||r.left< -1)}).map(e=>e.outerHTML.slice(0,100))}));
  assert.ok(g.overflow<=0,`${language}/${width}/${view} overflow`);assert.deepEqual(g.controls,[]);if(width>820){assert.equal(g.sidebar,258);assert.equal(g.x,258);}else assert.equal(g.x,0);
  assert.deepEqual(await page.locator('.game-topbar').boundingBox(),baseline,'stable header across routes');
  assert.equal(await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1')),save,'browsing wrote a save');
  report.inventory[view]=await page.locator('.workspace').evaluate(el=>({heading:el.querySelector('h1').textContent,actions:[...new Set([...el.querySelectorAll('button')].flatMap(b=>[...b.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name)))],forms:el.querySelectorAll('form').length}));
  if(language==='tr'&&(width===390||width===1440))await page.screenshot({path:`${out}/${language}-${width}-${view}.png`});
  await navigateTc(page,view==='dashboard'?'inbox':'dashboard');await page.goBack();await page.locator(`.workspace[data-screen="${view}"]`).waitFor();
  report.cases.push({language,width,view,status:'PASS'});
 }
 assert.equal(seen.size,Object.keys(ownership).length,'every owned feature remains reachable');
 // Form draft, language switch, route round trip and reload/deep link.
 await navigateTc(page,'banks');await page.locator('#bank-open-institution').selectOption('isbank');
 await navigateTc(page,'home');await navigateTc(page,'banks');await page.goBack();await page.locator('.workspace[data-screen="home"]').waitFor();await page.goForward();await page.locator('.workspace[data-screen="banks"]').waitFor();assert.equal(await page.locator('#bank-open-institution').inputValue(),'isbank');
 for(const locale of ['tr','en','pl']){await page.locator(`.life-languages [data-language="${locale}"]`).click();assert.equal(await page.locator('#bank-open-institution').inputValue(),'isbank');assert.equal(await page.locator('.workspace-head h1').innerText(),screenTitle('banks',locale));}
 await page.locator(`.life-languages [data-language="${language}"]`).click();
 await navigateTc(page,'city');
 for(const city of ['istanbul','ankara','izmir']){
  await page.locator(`[data-location-city="${city}"]`).click();await page.locator('.region-map-art img').evaluate(el=>el.decode());
  const regions=PLAYABLE_REGIONS.filter(d=>d.city===city);assert.equal(await page.locator('.region-map-label').count(),regions.length);
  for(const d of regions){await page.locator(`[data-location-select="${d.id}"]`).click();assert.equal(await page.locator(`[data-location-select="${d.id}"]`).getAttribute('aria-pressed'),'true');assert.ok((await page.locator('#region-selection-info').innerText()).includes(d.name));}
  assert.equal(await page.locator('.region-legacy-art,.region-map-dot,.region-map-number,.region-map-legacy').count(),0);
 }
 await page.locator('.workspace [data-view="home"]').click();assert.equal(await page.locator('.region-map').count(),0);assert.equal(await page.locator('[data-location-move="balcova"]').count(),2);await page.goBack();await page.locator('.workspace[data-screen="city"]').waitFor();
 await page.reload();await page.locator('#continue-game').click();await page.locator('.workspace[data-screen="city"]').waitFor();
 // Sidebar categories keep their state across screen/language transitions.
 await navigateTc(page,'settings');await page.locator('[data-remember-screen]').check();
 await navigateTc(page,'home');if(width<=820)await page.locator('.nav-more').click();
 const group=page.locator('[data-ui-panel="navigation:3"]');const was=await group.getAttribute('open')!==null;await group.locator('summary').click();const expected=!was;
 if(width<=820)await page.keyboard.press('Escape');
 await page.locator('.life-languages [data-language="en"]').click();assert.equal(await page.locator('[data-ui-panel="navigation:3"]').getAttribute('open')!==null,expected);
 await page.reload();await page.locator('#continue-game').click();assert.equal(await page.locator('.workspace').getAttribute('data-screen'),'home');
 if(width<=820){await page.locator('.nav-more').click();await page.keyboard.press('Escape');assert.equal(await page.locator('.nav-more').getAttribute('aria-expanded'),'false');}
 else{await page.locator('.nav-more').click();assert.equal((await page.locator('.workspace').boundingBox()).x,64);await page.locator('.nav-more').click();}
 assert.equal(await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1')),save);assert.deepEqual(errors,[]);
 if(language==='en'&&[390,1440].includes(width)){
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%'});
  for(const {view} of NAVIGATION_ITEMS){await navigateTc(page,view);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),`200% text ${width}/${view} overflow`);}
  await page.screenshot({path:`${out}/text-200-${width}.png`});report.zoom.push({width,textScale:2,routes:NAVIGATION_ITEMS.length,status:'PASS'});
 }
 console.log(`${label} ${language}/${width}: ${NAVIGATION_ITEMS.length} routes, history, drafts, languages, 23 labels and unchanged save PASS`);await context.close();
}
report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;throw error;}finally{writeFileSync(`${out}/acceptance.json`,JSON.stringify(report,null,2));await browser.close();server.close();}
