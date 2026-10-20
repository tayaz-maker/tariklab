import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin=process.env.PORTAL_BASE||'http://127.0.0.1:8080';
const games=(process.env.PORTAL_GAMES||'son-koy-manager,son-100-gun,kayip-telefon,amiral-batti').split(',');
const out=`${process.env.RUNNER_TEMP||'/workspace'}/screenshots/portal-wave1`;await mkdir(out,{recursive:true});
assert.ok(['https://www.tariklab.com','https://tariklab.tayaz29.workers.dev'].includes(origin));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const rows=[];
try {for(const lang of ['tr','en','pl'])for(const width of [390,1280])for(const game of games){
 const context=await browser.newContext({viewport:{width,height:844}});
 await context.addInitScript(lang=>{localStorage.setItem('tariklab.language',lang);localStorage.setItem('portal-proof','preserved');},lang);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${origin}/oyna/${game}`,{waitUntil:'networkidle'});
 const iframe=page.locator('iframe');await iframe.waitFor();const frame=page.frameLocator('iframe');
 await frame.locator('body').waitFor();await page.waitForTimeout(350);
 const before=await frame.locator('body').innerText();assert.ok(before.trim().length>30);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.ok(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.equal(await page.evaluate(()=>localStorage.getItem('tariklab.language')),lang);
 const src=await iframe.getAttribute('src');assert.ok(src.includes(`/games/${game==='son-koy-manager'?'son-kasaba':game}/`));
 await page.reload({waitUntil:'networkidle'});await page.frameLocator('iframe').locator('body').waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('portal-proof')),'preserved');assert.deepEqual(errors,[]);
 await page.screenshot({path:`${out}/${game}-${lang}-${width}.png`});
 rows.push({game,lang,width,src,status:'PASS'});console.log('PASS',game,lang,width);await context.close();
}}finally{await writeFile(`${out}/results.json`,JSON.stringify({origin,rows},null,2));await browser.close();}
assert.equal(rows.length,games.length*6);
