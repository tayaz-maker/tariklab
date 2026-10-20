import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {KEY,apply,createCoast,serialize,deserialize} from '../public/games/esik/sim.js';
import {BACKUP_KEY,RECOVERY_PREFIX,RECOVERY_SLOTS} from '../public/games/esik/save-store.js';
export async function coastArchiveAcceptance(browser,origin,out){
 mkdirSync(out,{recursive:true});const rows=[];
 try{for(const lang of ['tr','en','pl'])for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:844}});
  try{
   const raw=serialize(apply(createCoast(71),'bagla:merdiven'));
   const saves={[KEY]:raw,[BACKUP_KEY]:raw};for(let i=0;i<RECOVERY_SLOTS;i++)saves[RECOVERY_PREFIX+i]='preserved historical raw '+i;
   await context.addInitScript(({lang,saves})=>{localStorage.setItem('tariklab.language',lang);if(!localStorage.getItem('coast-archive-seeded')){for(const[k,v]of Object.entries(saves))localStorage.setItem(k,v);localStorage.setItem('coast-archive-seeded','1');}},{lang,saves});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   for(const path of ['/','/credits.html']){await page.goto(origin+path,{waitUntil:'networkidle'});assert.equal(await page.locator('a[href="/oyna/esik"], [data-game="esik"]').count(),0);}
   await page.goto(origin+'/oyna/esik',{waitUntil:'networkidle'});
   await page.locator('[data-game-archive="esik"]').waitFor();assert.equal(await page.locator('[data-game-archive="esik"] a').count(),0);
   assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex, follow');
   const read=keys=>page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),keys);
   assert.deepEqual(await read(Object.keys(saves)),saves);
   const frame=page.frameLocator('iframe');await frame.locator('button.primary').click();await frame.locator('.meters').waitFor();
   assert.deepEqual(deserialize(await page.evaluate(k=>localStorage.getItem(k),KEY)),deserialize(raw));
   await frame.locator('button.act').first().click();
   const progressed=await page.evaluate(k=>localStorage.getItem(k),KEY);assert.notEqual(progressed,raw);assert.ok(deserialize(progressed));
   await page.reload({waitUntil:'networkidle'});await page.frameLocator('iframe').locator('button.primary').click();await page.frameLocator('iframe').locator('.meters').waitFor();
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),progressed);
   const recoveryKeys=Object.keys(saves).filter(k=>k.startsWith(RECOVERY_PREFIX));assert.deepEqual(await read(recoveryKeys),Object.fromEntries(recoveryKeys.map(k=>[k,saves[k]])));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await page.frameLocator('iframe').locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
   await page.screenshot({path:`${out}/coast-${lang}-${width}.png`,fullPage:true});rows.push({lang,width,status:'PASS',origin,recoverySlots:RECOVERY_SLOTS});
  }finally{await context.close();}
 }}finally{writeFileSync(`${out}/coast-results.json`,JSON.stringify(rows,null,2));}return rows;
}
