import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const origin=process.env.GAME_E2E_ORIGIN||'http://127.0.0.1:8083';
const out=`${process.env.RUNNER_TEMP||'/workspace'}/screenshots/ihtilal`;
mkdirSync(out,{recursive:true});
const server=process.env.GAME_E2E_ORIGIN?null:spawn('npm',['run','dev','--','--host','127.0.0.1','--port','8083'],{stdio:'inherit'});
const results=[],errors=[];let browser;
try{
 let ready=false;for(let i=0;i<150;i++){try{ready=(await fetch(`${origin}/games/ihtilal/index.html`)).ok;}catch{/* The development server is still starting. */}if(ready)break;await new Promise(r=>setTimeout(r,200));}assert.ok(ready);
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 for(const width of [1280,360]){
  const context=await browser.newContext({viewport:{width,height:width===360?800:720},isMobile:width===360,hasTouch:width===360});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const start=Date.now();await page.goto(`${origin}/games/ihtilal/index.html`);
  assert.ok((await page.locator('.pitch').innerText()).length>30);
  assert.match(await page.locator('.menu-brief').innerText(),/havza|basin/i);
  await page.getByRole('button',{name:'Dosyayı aç',exact:true}).click();
  await page.locator('.basin-map').waitFor();
  assert.ok((await page.locator('.moves').innerText()).length>20);
  assert.ok(Date.now()-start<15000,'map, meters and a decision within 15 seconds');
  await page.screenshot({path:`${out}/first-${width}.png`,fullPage:true});
  await page.locator('.basin-map [role=button]').nth(2).click();
  await page.locator('.act').first().click();
  await page.locator('.inline-outcome').waitFor();
  assert.match(await page.locator('.cost-line').first().innerText(),/\d/);
  assert.ok(Date.now()-start<60000,'first action and visible outcome within one minute');
  await page.screenshot({path:`${out}/outcome-${width}.png`,fullPage:true});
  let actions=1,completed=false;const duration=width===360?120000:60000;
  while(Date.now()-start<duration){
   if(await page.locator('.report-verdict').count()){completed=true;break;}
   const act=page.locator('.solo-play .act').first();
   if(!(await act.count())) break;
   await act.click();actions++;
   await page.waitForTimeout(120);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
  }
  assert.ok(actions>=8,'repeated playable decision loop');assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/loop-${width}.png`,fullPage:true});
  results.push({width,actions,completed,elapsedMs:Date.now()-start});await context.close();
 }
}finally{writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));await browser?.close();server?.kill('SIGTERM');}
console.log(JSON.stringify({results,errors}));
