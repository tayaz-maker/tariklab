import {navigateTc} from './tc-sim-browser-navigation.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import {createStaticGameServer} from './static-game-server.mjs';
import {cityFixture} from './tc-sim-city-fixture.mjs';
import {PLAYABLE_REGIONS} from '../public/games/tc-sim/js/locations.js';
import {REGION_MAPS} from '../public/games/tc-sim/js/region-map-data.js';
import {quarterMoveQuote,steppedRent} from '../public/games/tc-sim/js/quarters.js';
import {checkedRegionTarget,requireRegionCurrentMain,verifyRegionBuild} from './tc-sim-2-regions-target.mjs';
const {values}=parseArgs({options:{serve:{type:'string'},'base-url':{type:'string'},'expected-root':{type:'string'},'expected-sha':{type:'string'},out:{type:'string',default:'work/tc-sim-2-regions-browser'}}});
const target=checkedRegionTarget(values),out=resolve(values.out);mkdirSync(out,{recursive:true});
let server,browser,origin=target.origin;
const report={status:'RUNNING',expectedSha:target.expectedSha,scope:'Whole TC SIM app, actual region/city clicks and saved game in fresh isolated browser contexts; screenshots visually reviewed separately. Geography claims limited to illustrated relative positions.',fingerprints:[],cases:[],moves:[]};
async function openMap(page){await navigateTc(page,'city');await page.locator('.region-map').waitFor();}
async function layout(page,label){const result=await page.evaluate(()=>{const map=document.querySelector('.region-map-art img').getBoundingClientRect();const bounds=[...document.querySelectorAll('.region-map-label')].map(el=>{const r=el.getBoundingClientRect(),span=el.querySelector('span'),text=span.getBoundingClientRect(),style=getComputedStyle(span);return {text:el.textContent,x:r.x,y:r.y,w:r.width,h:r.height,lines:text.height/parseFloat(style.lineHeight)}});return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,small:bounds.filter(b=>b.w<44||b.h<44),outside:bounds.filter(b=>b.x<map.x-1||b.y<map.y-1||b.x+b.w>map.right+1||b.y+b.h>map.bottom+1),long:bounds.filter(b=>b.lines>2.1),overlap:bounds.flatMap((a,i)=>bounds.slice(i+1).filter(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y).map(b=>[a.text,b.text]))}});assert.ok(result.overflow<=1,`${label} overflow ${result.overflow}`);assert.deepEqual(result.small,[],`${label} tap targets`);assert.deepEqual(result.outside,[],`${label} labels leave the image`);assert.deepEqual(result.long,[],`${label} label exceeds two lines`);assert.deepEqual(result.overlap,[],`${label} labels overlap`);assert.equal(await page.locator('.region-map-dot,.region-map-number,.region-map-legacy').count(),0,'No numbered markers or second selector');return result;}

try {
 if(target.hosted)report.mainBefore=await requireRegionCurrentMain(target.expectedSha);
 else {server=createStaticGameServer(target.serve);await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done)});origin=`http://127.0.0.1:${server.address().port}`;}
 report.origin=origin;report.fingerprints=await verifyRegionBuild(origin,target.expectedRoot,{expectedSha:target.expectedSha});
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 for(const language of ['tr','en','pl'])for(const width of [320,390,768,1280,1440]){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[],assets=[];
 await context.route('**/*',route=>{const url=route.request().url();return /^https?:/.test(url)&&new URL(url).origin!==origin?route.abort('blockedbyclient'):route.continue();});
 page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('request',r=>{if(/\/tc-sim-2-(istanbul|ankara|izmir)\.webp/.test(r.url()))assets.push(r.url().split('/').at(-1))});
 const fixture=cityFixture();fixture.finances.balance=1e6;fixture.career.jobId=null;
 await context.addInitScript(({fixture,language,origin})=>{if(location.origin!==origin)return;if(!localStorage.getItem('tc-regions-fixture-seeded')){localStorage.setItem('tariklab::tc-sim:1',JSON.stringify(fixture));localStorage.setItem('tariklab::tc-sim:active','1');localStorage.setItem('tc-regions-fixture-seeded','1');}localStorage.setItem('tariklab.language',language);},{fixture,language,origin});
 await page.goto(`${origin}/games/tc-sim/index.html`,{waitUntil:'networkidle'});assert.equal(new URL(page.url()).origin,origin,'navigation stays on authorized origin');await page.locator('#continue-game').click();await openMap(page);
 const savedBefore=await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1'));
 assert.ok(!assets.some(a=>a.includes('ankara')||a.includes('izmir')),'unselected city loaded early');
 const cities=[];
 for(const city of ['istanbul','ankara','izmir']){
  await page.locator(`[data-location-city="${city}"]`).click();const image=page.locator('.region-map-art img');await image.scrollIntoViewIfNeeded();await image.evaluate(el=>el.decode());
  assert.equal(await page.locator('.region-map-art img').count(),1);assert.equal(await image.getAttribute('loading'),'lazy');assert.ok((await image.getAttribute('src')).endsWith(REGION_MAPS[city].file));
  const regions=PLAYABLE_REGIONS.filter(d=>d.city===city);assert.equal(await page.locator('.region-map-label').count(),regions.length);
  const caption=await page.locator('.region-map figcaption').innerText();assert.ok(caption.includes({tr:'Ölçeksiz',en:'not to scale',pl:'bez skali'}[language]),'localized map caption');
  for(const d of regions){const button=page.locator(`.region-map-label[data-location-select="${d.id}"]`);if(d===regions[0]){await button.focus();await button.press('Enter');}else await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');assert.ok((await button.innerText()).includes(d.name),`${language}/${city}/${d.id} exact name`);
   await navigateTc(page,'home');
   assert.equal(await page.locator(`[data-semt-action="buy"][data-semt-value="${d.id}:1+1"]`).count(),1);assert.equal(await page.locator(`[data-semt-action="rent"][data-semt-value="${d.id}:2+1"]`).count(),1);
   assert.equal(await page.locator(`[data-location-move="${d.id}"]`).count(),2);assert.ok((await page.locator('#region-selection-info').innerText()).includes(d.name),'selected information panel follows the exact region');await navigateTc(page,'city');await layout(page,`${language}/${width}/${city}/${d.id}`);await page.locator(`[data-location-select="${d.id}"]`).focus();assert.equal(await page.evaluate(()=>document.activeElement?.dataset.locationSelect),d.id,'selected label remains keyboard accessible');
  }
  await layout(page,`${language}/${width}/${city}`);await page.locator('.region-map').screenshot({path:resolve(out,`${language}-${width}-${city}.png`)});cities.push({city,regions:regions.length,asset:REGION_MAPS[city].file});
 }
 assert.equal(await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1')),savedBefore,'browsing modified saved game');
 // Earlier fictional property records remain available, without a second region selector.
 await page.locator('[data-location-city="istanbul"]').click();await navigateTc(page,'home');
 for(const quarter of ['sirt','kiyi','ceper'])assert.equal(await page.locator(`[data-semt-value="${quarter}:1+1"][data-semt-action="buy"]`).count(),1);
 // Actual regional property purchase reaches the existing cash/holding save contract once.
 await navigateTc(page,'city');await page.locator('[data-location-city="istanbul"]').click();await page.locator('[data-location-select="umraniye"]').click();await navigateTc(page,'home');await page.locator('[data-semt-action="buy"][data-semt-value="umraniye:1+1"]').click();
 const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1')));assert.equal(saved.household.semt.holdings.filter(h=>h.id==='umraniye:1+1').length,1);assert.ok(saved.finances.balance<fixture.finances.balance);assert.equal(saved.meta.saveVersion,6);
 assert.deepEqual(errors,[],`${language}/${width} console`);report.cases.push({language,width,cities,saveVersion:saved.meta.saveVersion,requests:assets.length,distinctAssets:[...new Set(assets)],status:'PASS'});console.log(`regions ${language} ${width}: PASS`);await context.close();
 }
 // Each destination gets a fresh storage context: no weekly reset or fixture
 // mutation in an already-running game can hide move costs or replay defects.
 for(const d of PLAYABLE_REGIONS){
  const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  await context.route('**/*',route=>{const url=route.request().url();return /^https?:/.test(url)&&new URL(url).origin!==origin?route.abort('blockedbyclient'):route.continue();});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  const fixture=cityFixture();fixture.finances.balance=1e6;fixture.career.jobId=null;
  const quote=quarterMoveQuote(fixture,d.id,'2+1'),monthly=steppedRent(fixture,d.id,'2+1');
  await context.addInitScript(({fixture,origin})=>{if(location.origin!==origin)return;if(!localStorage.getItem('tc-region-move-seeded')){localStorage.setItem('tariklab::tc-sim:1',JSON.stringify(fixture));localStorage.setItem('tariklab::tc-sim:active','1');localStorage.setItem('tariklab.language','tr');localStorage.setItem('tc-region-move-seeded','1');}},{fixture,origin});
  await page.goto(`${origin}/games/tc-sim/index.html`,{waitUntil:'networkidle'});assert.equal(new URL(page.url()).origin,origin);await page.locator('#continue-game').click();await openMap(page);
  await page.locator(`[data-location-city="${d.city}"]`).click();await page.locator(`.region-map-label[data-location-select="${d.id}"]`).click();await navigateTc(page,'home');
  await page.locator(`[data-semt-action="rent"][data-semt-value="${d.id}:2+1"]`).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tariklab::tc-sim:1')));
  assert.equal(saved.household.location.districtId,d.id);assert.equal(saved.finances.balance,fixture.finances.balance-quote.cost);assert.equal(saved.weekly.used,quote.slots);assert.equal(saved.household.semt.holdings.find(h=>h.id===`${d.id}:2+1`)?.monthly,monthly);
  assert.equal(saved.household.location.lastMoveWeek,fixture.time.absoluteWeek);assert.equal(saved.meta.saveVersion,6);
  const bytes=await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1'));await page.reload({waitUntil:'networkidle'});assert.equal(new URL(page.url()).origin,origin);await page.locator('#continue-game').click();await navigateTc(page,'home');
  assert.equal(await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1')),bytes,'reload cannot replay rent or moving charge');
  assert.equal(await page.locator(`[data-semt-action="rent"][data-semt-value="${d.id}:2+1"]`).isDisabled(),true);assert.deepEqual(errors,[]);
  report.moves.push({region:d.id,city:d.city,cost:quote.cost,decisions:quote.slots,monthly,saveVersion:6,reloadNoReplay:true,status:'PASS'});console.log(`region move ${d.id}: PASS`);await context.close();
 }
 for(const id of ['avcilar','bayrampasa','batikent']){
  const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),page=await context.newPage(),fixture=cityFixture();fixture.household.homeId='shared';fixture.household.location={districtId:id,lastMoveWeek:0};
  await context.addInitScript(({fixture,origin})=>{if(location.origin!==origin||localStorage.getItem('legacy-map-seeded'))return;localStorage.setItem('tariklab::tc-sim:1',JSON.stringify(fixture));localStorage.setItem('tariklab::tc-sim:active','1');localStorage.setItem('tariklab.language','tr');localStorage.setItem('legacy-map-seeded','1');},{fixture,origin});
  await page.goto(`${origin}/games/tc-sim/index.html`);await page.locator('#continue-game').click();await openMap(page);const saved=await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1'));
  assert.ok(await page.locator('.region-map-earlier-home').isVisible());assert.equal(await page.locator(`[data-location-select="${id}"]`).count(),0);await navigateTc(page,'home');assert.equal(await page.locator(`[data-location-move="${id}"]`).count(),2);
  await page.reload();await page.locator('#continue-game').click();await openMap(page);assert.equal(await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1')),saved);assert.equal(JSON.parse(saved).household.location.districtId,id);await context.close();
 }
 assert.equal(report.moves.length,23);if(target.hosted)report.mainAfter=await requireRegionCurrentMain(target.expectedSha);
 report.status='PASS';}catch(error){report.status='FAIL';report.error=error.stack;throw error;}finally{writeFileSync(resolve(out,'acceptance.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();if(server)await new Promise(done=>server.close(done));}
