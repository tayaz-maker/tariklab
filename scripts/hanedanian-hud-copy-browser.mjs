import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const origin=process.env.HANE_COPY_ORIGIN||'http://127.0.0.1:18212',out=resolve(process.env.HANE_COPY_OUT||'work/hane-hud-copy');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox']});const rows=[];
try{for(const width of[320,1440]){
 const context=await browser.newContext({viewport:{width,height:900},isMobile:width===320,hasTouch:width===320});
 try{
 await context.addInitScript(()=>localStorage.setItem('tariklab.language','pl'));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/oyna/hanedanian',{waitUntil:'networkidle'});
 const frame=await(await page.locator('iframe').elementHandle()).contentFrame();
 await frame.locator('#welcome [data-action="new"]').click();await frame.locator('#new-form input[name="seed"]').fill('HUD-COPY');await frame.locator('#new-form button').click();await frame.locator('#welcome').waitFor({state:'hidden'});
 await frame.waitForFunction(()=>document.querySelector('#resources .resource > span')?.textContent==='ŻYWNOŚĆ');
 const labels=await frame.locator('#resources .resource > span').allTextContents();assert.deepEqual(labels,['ŻYWNOŚĆ','DREWNO','KAMIEŃ','ŻELAZO','WPŁYWY']);
 assert.equal(await frame.locator('#campaign-strip [data-view="dynasty"]').innerText(),'Cele →');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:resolve(out,`pl-${width}-gameplay.png`),fullPage:true});
 await frame.locator('#campaign-strip [data-view="dynasty"]').click();await frame.locator('#section-view').waitFor({state:'visible'});assert.equal(await frame.locator('#navigation [data-view="dynasty"]').getAttribute('aria-current'),'page');
 assert.deepEqual(errors,[]);rows.push({width,locale:'pl',labels,goals:'Cele →',goalsAction:true,status:'PASS'});
 }finally{await context.close();}
}}finally{await writeFile(resolve(out,'results.json'),JSON.stringify(rows,null,2));await browser.close();}
console.log(JSON.stringify({status:'PASS',cases:rows.length}));
