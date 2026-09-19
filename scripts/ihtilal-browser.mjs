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
 let ready=false;for(let i=0;i<150;i++){try{ready=(await fetch(`${origin}/games/ihtilal/index.html`)).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,200));}assert.ok(ready);
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 for(const width of [1280,360]){
  const context=await browser.newContext({viewport:{width,height:width===360?800:720},isMobile:width===360,hasTouch:width===360});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const start=Date.now();await page.goto(`${origin}/games/ihtilal/index.html`);
  assert.match(await page.locator('.menu-brief').innerText(),/10 Hüküm/);assert.ok((await page.locator('.pitch').innerText()).length>30);
  await page.getByRole('button',{name:'Öğrenerek oyna',exact:true}).click();await page.locator('.mission').waitFor();
  assert.match(await page.locator('.mission').innerText(),/10 Hüküm/);assert.ok((await page.locator('.next-hint').innerText()).length>20);assert.ok(Date.now()-start<15000,'role, goal and next action within 15 seconds');
  await page.screenshot({path:`${out}/first-${width}.png`,fullPage:true});
  await page.locator('.suggested').click();assert.match(await page.locator('.cost-line').innerText(),/\d/);assert.ok((await page.locator('.inspector .fx').innerText()).length>10);
  await page.locator('.play-target:not([disabled])').first().click();await page.locator('.inline-outcome').waitFor();assert.ok(Date.now()-start<60000,'first action and visible outcome within one minute');
  await page.screenshot({path:`${out}/outcome-${width}.png`,fullPage:true});
  let actions=1,completed=false;const duration=width===360?300000:60000;
  while(Date.now()-start<duration){
   const workspace=page.locator('.action-workspace');
   if(!await workspace.count()){completed=true;break;}
   const target=page.locator('.play-target:not([disabled])').first(),suggestion=page.locator('.suggested:not([disabled])'),pass=page.locator('.turn-actions button:not([disabled])').first();
   if(await target.count()){await target.click();actions++;}
   else if(await suggestion.count())await suggestion.click();
   else if(await pass.count()){await pass.click();actions++;}
   await page.waitForTimeout(900);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
  }
  assert.ok(actions>=8,'repeated playable decision loop');assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/loop-${width}.png`,fullPage:true});
  results.push({width,actions,completed,elapsedMs:Date.now()-start});await context.close();
 }
}finally{writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));await browser?.close();server?.kill('SIGTERM');}
console.log(JSON.stringify({results,errors}));
