import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin=process.env.PORTAL_BASE;
assert.ok(['https://www.tariklab.com','https://tariklab.tayaz29.workers.dev'].includes(origin));
const out=`${process.env.RUNNER_TEMP||'/workspace'}/screenshots/portal-wave1-decision`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),rows=[];
try{for(const lang of ['tr','en','pl'])for(const width of [390,1280])for(const game of ['apartman','tc-sim-devlet']){
 const context=await browser.newContext({viewport:{width,height:844}});
 try{
  await context.addInitScript(lang=>{localStorage.setItem('tariklab.language',lang);localStorage.setItem('portal-proof','preserved');},lang);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/oyna/${game}`,{waitUntil:'networkidle'});
  const iframe=page.locator('iframe');await iframe.waitFor();const frame=page.frameLocator('iframe');
  assert.ok((await frame.locator('body').innerText()).trim().length>30);
  assert.ok((await iframe.getAttribute('src')).includes(`/games/${game}/`));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.ok(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.reload({waitUntil:'networkidle'});await page.frameLocator('iframe').locator('body').waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('tariklab.language')),lang);
  assert.equal(await page.evaluate(()=>localStorage.getItem('portal-proof')),'preserved');assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/${game}-${lang}-${width}.png`});rows.push({game,lang,width,status:'PASS'});
 }finally{await context.close();}
}}finally{await writeFile(out+'/results.json',JSON.stringify({origin,rows},null,2));await browser.close();}
assert.equal(rows.length,12);console.log(JSON.stringify({origin,portalCases:rows.length,status:'PASS'}));
