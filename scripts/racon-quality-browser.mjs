import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createStaticGameServer} from './static-game-server.mjs';
import {loadGame} from './racon-harness.mjs';
const out=`${process.env.RUNNER_TEMP||'/tmp'}/screenshots/racon-quality`;
mkdirSync(out,{recursive:true});
const server=createStaticGameServer('.output/public');
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const results=[],errors=[];
const h=loadGame();h.ev('blank("Kalite");enterPlay();S.stage="agabey";S.kasa=50000;cashNormalize(S);S.streets[0].yatirim=2;S.flags.avukatTutuldu=true;S.inbox.unshift({id:"quality-paper",kind:"chain",chainId:"hasan-kuzen",nodeId:"hk-1",week:S.week,title:"Hasanın kuzeni",body:"Aile meselesi. Kararın mahallede karşılık bulacak.",choices:[{id:"zarf",label:"Zarfı kuzenine ver"},{id:"bekle",label:"Bekle"}]});writeSave();');
const fixture=JSON.parse(h.localStorage.getItem('tariklab::racon:1'));
async function layout(page,label){
 const m=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,stage:document.querySelector('#stage').scrollWidth,available:document.querySelector('#stage').clientWidth}));
 assert.ok(m.scroll<=m.width+1,`${label}: document ${JSON.stringify(m)}`);assert.ok(m.stage<=m.available+1,`${label}: stage ${JSON.stringify(m)}`);results.push({label,...m});
}
try {
 for(const width of [320,360,390,430,1440]){
  const context=await browser.newContext({viewport:{width,height:width<500?844:960},isMobile:width<500,hasTouch:width<500});
  await context.addInitScript(f=>{if(!localStorage.getItem('quality-seeded')){localStorage.setItem('tariklab::racon:1',JSON.stringify(f));localStorage.setItem('tariklab::racon:active','1');localStorage.setItem('quality-seeded','1');}},fixture);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(12000);
  await page.goto(origin+'/games/racon/index.html');await page.screenshot({path:`${out}/menu-${width}.png`});await page.locator('#btn-devam').click();
  // Compact navigation exposes its remaining destinations through the existing toggle.
  const nav=async id=>{let b=page.locator(`.navbtn[data-id="${id}"]`);if(!await b.isVisible())await page.locator('[data-act="navdetay"]').click();await b.click();};
  for(const id of ['olaylar','takvim','adamlar','harita','isler','pazar','emlak','hayat','emniyet','husumet','kasa','siralama']){
   await nav(id);await layout(page,`${width}:${id}`);
   if(['adamlar','harita','kasa'].includes(id))await page.screenshot({path:`${out}/${id}-${width}.png`});
   if(id==='kasa')assert.match(await page.locator('.cash-outlook').innerText(),/Yatırım geliri ₺1.200/);
  }
  await nav('olaylar');await page.locator('[data-act="inbox"][data-id="quality-paper"]').click();
  const choice=page.locator('[data-act="chain-choice"][data-cid="zarf"]');assert.match(await choice.innerText(),/2.500/);
  const box=await choice.boundingBox();assert.ok(box.height>=44&&box.width>=44);
  await page.screenshot({path:`${out}/choice-${width}.png`});await choice.click();
  let saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('tariklab::racon:1')));assert.equal(saved.kasa,47500);assert.equal(saved.flags.chainFlags.kuzenZarf,1);
  await page.reload();await page.locator('#btn-devam').click();saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('tariklab::racon:1')));assert.equal(saved.kasa,47500);
  await context.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));console.log(JSON.stringify({viewports:5,screenChecks:results.length,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
