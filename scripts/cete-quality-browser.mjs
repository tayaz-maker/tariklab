import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { hydratePlayer, makeRivals, MARKET_START, SAVE_VERSION } from '../src/game/data.ts';
const base=process.env.CETE_BASE || 'http://127.0.0.1:8087';
const out=`${process.env.RUNNER_TEMP || '/workspace'}/screenshots/cete-quality`;
await mkdir(out,{recursive:true});
const server=process.env.CETE_BASE?null:spawn(process.execPath,['.output/server/index.mjs'],{stdio:'inherit',detached:true,env:{...process.env,PORT:'8087',HOST:'127.0.0.1'}});
let browser; const results=[];
const save=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('tariklab::cete:1')).state.player);
try{
 if(server)for(let i=0;i<120;i++){try{if((await fetch(base)).ok)break;}catch{} await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 for(const lang of ['tr','en'])for(const width of [320,360,390,430,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const fixture={version:SAVE_VERSION,state:{version:SAVE_VERSION,player:hydratePlayer({name:'Quality',neighborhood:'eyup',level:10,cash:100000,jobsDone:5,stamina:32,itibar:40,crew:['gozcu','tetik'],tutorialStep:4,streakDay:new Date().toISOString().slice(0,10),turf:{eyup:50,tarlabasi:40,kadikoy:20,sultangazi:0},eventCooldown:9999}),rivals:makeRivals(),logs:[],hiz:1,market:MARKET_START,savedAt:Date.now()}};
  await context.addInitScript(({fixture,lang})=>{if(!sessionStorage.getItem('quality-seed')){localStorage.setItem('cete-savaslari-save-v1',JSON.stringify(fixture));localStorage.setItem('cete-age-ok','1');localStorage.setItem('tariklab.language',lang);sessionStorage.setItem('quality-seed','1');}},{fixture,lang});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/cete-savaslari?sekme=sokak`,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:lang==='tr'?'Semt hâkimiyeti':'District control',exact:true}).waitFor();
  const before=await save(page);
  const action=page.getByRole('button',{name:lang==='tr'?/Esnafla otur/:/Visit local traders/}).first();
  await action.click();
  const after=await save(page);assert.ok(after.turf.eyup>before.turf.eyup);assert.ok(after.stamina<before.stamina);assert.ok(after.cash<before.cash);
  await page.reload({waitUntil:'networkidle'});assert.ok((await save(page)).turf.eyup>=after.turf.eyup-2);
  await page.screenshot({path:`${out}/${lang}-${width}-street.png`,fullPage:true});
  const tabs=lang==='tr'?['Ben','İş','Tezg','Ev','Sok','Hay','Kln']:['Me','Job','Shop','Prop','St','Life','Cln'];
  const desktop=lang==='tr'?['Ben','İcraat','Tezgâh','Emlak','Sokak','Hayat','Klinik']:['Me','Jobs','Shop','Property','Street','Life','Clinic'];
  for(const label of width<768?tabs:desktop){
   const nav=width<768?page.locator('nav.fixed'):page.locator('.game-shell aside nav');
   await nav.getByRole('button',{name:label,exact:true}).click();
   await page.waitForTimeout(150);
   const geo=await page.evaluate(()=>({width:innerWidth,doc:document.documentElement.scrollWidth,main:document.querySelector('main').getBoundingClientRect().width}));
   assert.ok(geo.doc<=width,`${lang}/${width}/${label}: ${JSON.stringify(geo)}`);assert.ok(geo.main>200);
   await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
   assert.ok(await nav.isVisible());
  }
  await page.getByRole('button',{name:lang==='tr'?'Detay':'Details',exact:true}).click();
  await page.getByRole('button',{name:'Nasıl Oynanır',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  const g=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};});
  assert.ok(g.left>=0&&g.right<=width&&g.height<=900);await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);results.push({lang,width,tabs:7,action:true,reload:true,help:true,errors});await context.close();
 }
 await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser?.close();if(server)try{process.kill(-server.pid,'SIGTERM');}catch{}}
