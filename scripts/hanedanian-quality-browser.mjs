import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createStaticGameServer} from './static-game-server.mjs';
import {createGame,validateState} from '../public/games/hanedanian/engine.js';
import {encodeSave} from '../public/games/hanedanian/save.js';
const out=`${process.env.RUNNER_TEMP||'/tmp'}/screenshots/hanedanian-quality`;
mkdirSync(out,{recursive:true});
const server=createStaticGameServer(new URL('../.output/public',import.meta.url).pathname);
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const results=[],errors=[];
async function archive(page){
 await page.locator('#menu-button').click();await page.locator('[data-action="export"]').click();
 const state=JSON.parse(await page.locator('#export-text').inputValue()).state;
 await page.locator('#dialog').press('Escape');return state;
}
async function layout(page,label){
 const m=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,section:document.querySelector('#section-view').scrollWidth,available:document.querySelector('#section-view').clientWidth}));
 assert.ok(m.scroll<=m.width+1,`${label}: document overflow ${JSON.stringify(m)}`);
 assert.ok(m.section<=m.available+1,`${label}: section overflow ${JSON.stringify(m)}`);
 results.push({label,...m});
}
try {
 for(const width of [320,360,390,430,1440]){
  const context=await browser.newContext({viewport:{width,height:width<500?844:900},isMobile:width<500,hasTouch:width<500});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(origin+'/games/hanedanian/index.html');
  const seed=createGame({seed:`HAN-QUALITY-${width}`});
  seed.dynasty.xp=45;seed.dynasty.pendingEvent={type:'heir',title:'Varis divana geliyor',text:'Görev seç'};
  await page.locator('#welcome [data-action="import"]').click();
  await page.locator('#import-text').fill(encodeSave(seed));await page.locator('#import-form button[type="submit"]').click();
  await page.locator('#welcome').waitFor({state:'hidden'});
  await page.locator('#navigation [data-view="dynasty"]').click();
  await layout(page,`${width}:dynasty`);
  assert.match(await page.locator('.dynasty-skills').innerText(),/45 deneyim[\s\S]*Sonraki seviye/);
  assert.ok(await page.locator('.heir-decision').isVisible());
  await page.screenshot({path:`${out}/dynasty-${width}.png`});
  const boxes=await page.locator('[data-event], [data-dynasty]').evaluateAll(els=>els.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
  assert.ok(boxes.every(b=>b.w>=44&&b.h>=44));
  const choice=width===320?'marry':width===360?'mentor':'study';
  await page.locator(`[data-event="${choice}"]`).click();
  await page.locator('.heir-decision').waitFor({state:'detached'});
  await page.locator('[data-dynasty="stewardship"]').click();
  let saved=await archive(page);assert.equal(saved.dynasty.stats.stewardship,2);
  assert.equal(saved.dynasty.pendingEvent,null);assert.equal(saved.dynasty.nextEvent,4800);
  assert.equal(saved.dynasty.xp,choice==='study'?80:choice==='mentor'?30:0);
  assert.equal(validateState(saved).ok,true);
  await page.reload();await page.locator('[data-load="auto"]').first().click();await page.locator('#welcome').waitFor({state:'hidden'});
  assert.equal((await archive(page)).dynasty.stats.stewardship,2);
  for(const view of ['map','settlement','army','council','dynasty']){
   await page.locator(`#navigation [data-view="${view}"]`).click();await layout(page,`${width}:${view}`);
  }
  await page.locator('#navigation [data-view="map"]').click();
  const canvas=page.locator('#world-map');await canvas.focus();await canvas.press('Home');await canvas.press('ArrowRight');
  await page.locator('#inspector.has-selection').waitFor();
  await page.screenshot({path:`${out}/map-${width}.png`});
  await page.locator('#navigation [data-view="settlement"]').click();await page.locator('[data-build="farm"]').click();
  assert.ok((await archive(page)).settlements[0].queue.some(j=>j.building==='farm'));
  await context.close();
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'PASS',viewports:5,checks:results.length,errors}));
} finally {
 writeFileSync(out+'/results.json',JSON.stringify({results,errors},null,2));
 await browser.close();await new Promise(r=>server.close(r));
}
