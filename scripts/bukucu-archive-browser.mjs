import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {loadStrategy} from './strategy-harness.mjs';
export async function bukucuArchiveAcceptance(browser,origin,out){
 mkdirSync(out,{recursive:true});const rows=[];const h=loadStrategy('public/games/bukucu/index.html');h.ev('act("hot3")');
 const raw=h.ev('JSON.stringify(S)');const saves={'smb.v1':raw,'tariklab::bukucu:active':'1','tariklab::bukucu:legacy-migrated':'1'};
 for(let i=1;i<=3;i++)saves['tariklab::bukucu:'+i]=raw;
 try{for(const lang of ['tr','en','pl'])for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844}});
  try{
   await context.addInitScript(({lang,saves})=>{localStorage.setItem('tariklab.language',lang);if(!localStorage.getItem('bukucu-archive-seeded')){for(const[k,v]of Object.entries(saves))localStorage.setItem(k,v);localStorage.setItem('bukucu-archive-seeded','1');}},{lang,saves});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   for(const path of ['/','/credits.html']){await page.goto(origin+path,{waitUntil:'networkidle'});assert.equal(await page.locator('a[href*="bukucu"], [data-game="bukucu"]').count(),0);}
   await page.goto(origin+'/oyna/bukucu',{waitUntil:'networkidle'});await page.locator('[data-game-archive="bukucu"]').waitFor();
   assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex, follow');
   const read=()=>page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(saves));assert.deepEqual(await read(),saves);
   const frame=page.frameLocator('iframe');await frame.locator('button[data-act="cont"]').click();await frame.locator('#app').waitFor();
   const before=await read();await page.reload({waitUntil:'networkidle'});await page.frameLocator('iframe').locator('button[data-act="cont"]').click();assert.deepEqual(await read(),before);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await page.frameLocator('iframe').locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
   await page.screenshot({path:`${out}/${lang}-${width}.png`});rows.push({lang,width,status:'PASS',keys:Object.keys(saves).length});
  }finally{await context.close();}
 }}finally{writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2));}return rows;
}
