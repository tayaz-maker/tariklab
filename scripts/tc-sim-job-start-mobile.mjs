// Browser-only responsive audit. Fixtures live in isolated contexts; never touch player saves.
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {createStaticGameServer} from './static-game-server.mjs';
import {cityFixture} from './tc-sim-city-fixture.mjs';
const root=process.argv[2] || '.output/public';
const out=resolve(process.env.RUNNER_TEMP || '/workspace','screenshots/tc-mobile-final');
mkdirSync(out,{recursive:true});
const server=createStaticGameServer(root);
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox']});
const rows=[],errors=[],interactions=[];
let failure=null;
const menus=['dashboard','inbox','character','calendar','finance','market','career','education','people','relationships','home','body','history','yearbook'];
try {
 for(const width of [320,360,390,430,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await context.addInitScript(state=>{
   if(!localStorage.getItem('mobile-fixture')) {
    localStorage.setItem('tariklab::tc-sim:1',JSON.stringify(state));
    localStorage.setItem('tariklab::tc-sim:active','1');
    localStorage.setItem('mobile-fixture','1');
   }
   localStorage.setItem('tariklab.language','tr');
  },cityFixture());
  await page.goto(`${origin}/games/tc-sim/index.html`,{waitUntil:'networkidle'});
  const measure=async screen=>{
   const data=await page.evaluate(()=>{
    const visible=n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
    const describe=n=>({tag:n.tagName,id:n.id,class:n.className,text:n.textContent.trim().slice(0,80)});
    const controls=[...document.querySelectorAll('button,input,select,summary,a[href]')].filter(visible);
    return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
     smallTargets:controls.filter(n=>{const r=n.getBoundingClientRect();return r.height<43||r.width<24;}).map(n=>({...describe(n),height:n.getBoundingClientRect().height})),
     clipped:controls.filter(n=>n.scrollWidth>n.clientWidth+2 && getComputedStyle(n).overflowX!=='visible' && n.tagName!=='SELECT').map(describe),
     smallInputs:controls.filter(n=>/INPUT|SELECT/.test(n.tagName)&&getComputedStyle(n).fontSize.replace('px','')<16).map(describe)};
   });
   rows.push({width,screen,...data});
   await page.screenshot({path:`${out}/${width}-${screen}.png`,fullPage:true});
   if(menus.includes(screen)) {
    await page.locator('.workspace-head').evaluate(n=>{n.scrollIntoView({block:'start'});window.scrollBy(0,-120);});
    await page.mouse.move(0,0);
    await page.screenshot({path:`${out}/${width}-${screen}-viewport.png`});
   }
  };
  await measure('start');
  await page.locator('#show-creation-form').click();
  for(const era of ['1980s','1999-04-18','2017-04-18']) {
   await page.locator('[name=eraId]').selectOption(era);
   await measure(`creation-${era}`);
   if(width<500)assert.equal(await page.locator('#scenario-seed-wrap').isVisible(),era==='1980s');
  }
  await page.locator('#back-to-intro').click();
  await page.locator('#continue-game').click();
  const navigate=async menu=>{
   const target=page.locator(`.side-nav [data-view="${menu}"]`);
   if(!await target.isVisible())await page.locator('.side-nav .nav-more').click();
   await target.click();
  };
  const saved=await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1'));
  for(const menu of menus){
   await navigate(menu);
   await measure(menu);
   if(await page.locator('.desk-row').count()){
    await page.locator('.desk-row').last().click();
    await measure(`${menu}-detail`);
    if(width<901) {
     const close=page.locator('.inspector-close');await close.scrollIntoViewIfNeeded();
     const b=await close.boundingBox();assert.ok(b.y>=0&&b.y+b.height<=901);
     await page.screenshot({path:`${out}/${width}-${menu}-dialog.png`});
    }
    if(width<901)await page.locator('.inspector-close').click();
   }
   if(menu==='home'){
    const pins=await page.locator('[data-location-select]').evaluateAll(ns=>ns.map(n=>n.dataset.locationSelect));
    for(const id of pins){
     await page.locator(`[data-location-select="${id}"]`).click();
     assert.equal(await page.locator(`[data-location-select="${id}"]`).getAttribute('aria-pressed'),'true');
    }
    await page.locator('.location-map').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${out}/${width}-city-map.png`});
   }
   if(menu==='body'){
    for(const id of ['head','chest','abdomen','back','arms','legs']){
     await page.locator(`#body-region-${id}`).click();
     assert.equal(await page.locator(`#body-region-${id}`).getAttribute('aria-pressed'),'true');
    }
    await measure('body-selected');
    await page.locator('.tc-body-map').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${out}/${width}-body-map.png`});
   }
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1')),saved,'navigation/selection never mutates the save');
  await page.locator('#help-open').click();await measure('help');await page.locator('#help-close').click();
  if(await page.locator('[data-scenario-choice=rest]').count())await page.locator('[data-scenario-choice=rest]').click();
  await navigate('finance');
  const readSave=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tariklab::tc-sim:1')));
  for(const asset of ['USD','gram']){
   await page.locator(`[data-exchange="${asset}"][data-side="buy"]`).click();
   const after=await readSave();assert.ok(after.wealth.exchange.positions[asset].quantity>0);
   await page.locator(`[data-exchange="${asset}"][data-side="sell"]`).click();
   assert.equal((await readSave()).wealth.exchange.positions[asset]?.quantity||0,0);
  }
  await page.locator('[data-business="repair"]').click();
  assert.equal((await readSave()).flags.business.id,'repair');
  await measure('business-open');
  await page.locator('[data-business-manage="expand"]').click();
  assert.equal((await readSave()).flags.business.level,2);
  await navigate('body');
  await page.locator('.tc-body-actions [data-decision="rest"]').click();
  for(let i=0;i<4&&(await readSave()).events.active;i++){
   await measure(`event-${i}`);
   await page.locator('[data-event-choice]:not(:disabled)').first().click();
  }
  assert.equal((await readSave()).events.active,null);
  await page.locator('#save-game').click();
  const weekBefore=(await readSave()).time.absoluteWeek;
  await page.locator('#advance-week').click();
  assert.ok((await readSave()).time.absoluteWeek>weekBefore);
  await measure('week-advanced');
  interactions.push({width,fx:true,gold:true,business:true,bodyAction:true,weekAdvanced:true});
  const persisted=await readSave();
  await page.reload({waitUntil:'networkidle'});await page.locator('#continue-game').click();await measure('reloaded');
  assert.equal((await readSave()).time.absoluteWeek,persisted.time.absoluteWeek);
  assert.equal((await readSave()).finances.balance,persisted.finances.balance);
  await context.close();
  const fresh=await browser.newContext({viewport:{width,height:900}}),creation=await fresh.newPage();
  await creation.goto(`${origin}/games/tc-sim/index.html`,{waitUntil:'networkidle'});
  await creation.locator('#show-creation-form').click();
  await creation.locator('[name=eraId]').selectOption('2017-04-18');
  await creation.locator('#new-game-form [type=submit]').click();
  assert.equal(await creation.evaluate(()=>JSON.parse(localStorage.getItem('tariklab::tc-sim:1')).time.date),'2017-04-18');
  await fresh.close();
 }
 assert.deepEqual(errors,[]);
 for(const row of rows){
  assert.ok(row.overflow<=1,`${row.width}/${row.screen}: page overflow`);
  assert.deepEqual(row.clipped,[],`${row.width}/${row.screen}: clipped control`);
  if(row.width<500){
   // Inline source links are prose; all standalone controls must be touch-sized.
   assert.deepEqual(row.smallTargets.filter(n=>n.tag!=='A'),[],`${row.width}/${row.screen}: small control`);
   assert.deepEqual(row.smallInputs,[],`${row.width}/${row.screen}: input zoom risk`);
  }
 }
} catch(error) { failure=error.stack; throw error; } finally {
 writeFileSync(`${out}/results.json`,JSON.stringify({status:failure?'FAIL':'PASS',failure,rows,errors,interactions},null,2));
 console.log(JSON.stringify({rows:rows.length,issues:rows.filter(r=>r.overflow>1||(r.width<500&&r.smallTargets.some(n=>n.tag!=='A'))||r.clipped.length||(r.width<500&&r.smallInputs.length)),errors},null,2));
 await browser.close();server.close();
}
