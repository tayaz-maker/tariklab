// Real journal recovery: translated UI only, manual-save receipt stays byte-identical.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const origin=process.env.HANE_RECOVERY_ORIGIN||'http://127.0.0.1:18211';
const out=resolve(process.env.HANE_RECOVERY_OUT||'work/hane-recovery-copy');await mkdir(out,{recursive:true});
const copy={tr:['Kurtarılan kampanyayı aç','Son kapanış kaydın kurtarıldı. Kalıcı kayıt için yeniden kaydet.'],en:['Open recovered campaign','Your last session was recovered. Save again to keep a permanent copy.'],pl:['Otwórz odzyskaną kampanię','Odzyskano zapis z ostatniego zamknięcia gry. Zapisz ponownie, aby zachować go na stałe.']};
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox']});
const rows=[];
async function manual(frame){return frame.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('tariklab-hanedanian',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;const q=db.transaction('saves','readonly').objectStore('saves').get('manual');q.onerror=()=>{db.close();reject(q.error);};q.onsuccess=()=>{db.close();resolve(JSON.stringify(q.result??null));};};}));}
try{for(const lang of['tr','en','pl']){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{
 await context.addInitScript(lang=>localStorage.setItem('tariklab.language',lang),lang);
 const page=await context.newPage(),errors=[],failures=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failures.push(r.url()));
 await page.goto(origin+'/oyna/hanedanian',{waitUntil:'networkidle'});
 let frame=await(await page.locator('iframe').elementHandle()).contentFrame();
 await frame.locator('#welcome [data-action="new"]').click();await frame.locator('#new-form input[name="seed"]').fill('RECOVERY-COPY');await frame.locator('#new-form button').click();await frame.locator('#welcome').waitFor({state:'hidden'});
 await frame.locator('#menu-button').click();await frame.locator('[data-action="manual-save"]').click();await frame.waitForFunction(()=>document.querySelector('[data-action="manual-save"]')?.disabled===false);
 const before=await manual(frame);assert.ok(before&&before!=='null');
 await frame.locator('[data-action="resume"]').click();
 await frame.waitForFunction(()=>['Çevrimdışı paket hazır','Offline package ready','Pakiet offline gotowy'].some(text=>document.querySelector('#settlement-rail')?.textContent.includes(text)),null,{timeout:30000});
 await page.reload({waitUntil:'networkidle'});
 frame=await(await page.locator('iframe').elementHandle()).contentFrame();
 await frame.getByRole('button',{name:copy[lang][0],exact:true}).waitFor();
 await frame.getByText(copy[lang][1],{exact:true}).first().waitFor();
 assert.equal(await manual(frame),before);
 await context.setOffline(true);await page.reload({waitUntil:'load'});frame=await(await page.locator('iframe').elementHandle()).contentFrame();
 await frame.getByRole('button',{name:copy[lang][0],exact:true}).waitFor();await frame.getByText(copy[lang][1],{exact:true}).first().waitFor();assert.equal(await manual(frame),before);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:resolve(out,`${lang}-recovery.png`),fullPage:true});
 await frame.getByRole('button',{name:copy[lang][0],exact:true}).click();await frame.locator('#welcome').waitFor({state:'hidden'});assert.equal(await manual(frame),before);assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 rows.push({lang,button:copy[lang][0],warning:copy[lang][1],manualSha256:createHash('sha256').update(before).digest('hex'),recoveryClick:true,offline:true,saveUnchanged:true,errors,failures,status:'PASS'});
 }finally{await context.close();}
}}finally{await writeFile(resolve(out,'results.json'),JSON.stringify(rows,null,2));await browser.close();}
console.log(JSON.stringify({status:'PASS',cases:rows.length}));
