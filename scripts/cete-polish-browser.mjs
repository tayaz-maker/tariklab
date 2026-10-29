// PL screen acceptance over a prepared local save. Run against source and built servers.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { hydratePlayer, makeRivals, MARKET_START, SAVE_VERSION, ALL_ITEMS, ALL_MISSIONS, ESTATES } from '../src/game/data.ts';
import { PL_ITEMS, PL_JOBS, PL_ESTATES } from '../src/game/cete-pl.ts';
import { checkedUrl } from './browser-guard.mjs';
const base=checkedUrl(process.env.CETE_BASE||'http://127.0.0.1:8080');
const label=process.env.CETE_LABEL||'source';assert.match(label,/^[\w-]+$/);
const out=resolve(process.env.RUNNER_TEMP||'work','screenshots','cete-polish',label);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']}),rows=[];
const tabs=[['ben','Ja'],['icraat','Drobny handel i rogi ulic'],['tezgah','Broń'],['emlak','Kasa'],['sokak','Kontrola dzielnic'],['hayat','Życie'],['klinik','Podziemna klinika']];
try { for(const width of [390,1280]) {
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 const fixture={version:SAVE_VERSION,state:{version:SAVE_VERSION,player:hydratePlayer({name:'PL QA',neighborhood:'eyup',level:10,cash:100000,jobsDone:5,stamina:32,itibar:40,crew:['gozcu','tetik'],properties:['r105'],tutorialStep:4,streakDay:new Date().toISOString().slice(0,10),eventCooldown:9999}),rivals:makeRivals(),logs:[],hiz:1,market:MARKET_START,savedAt:Date.now()}};
 await context.addInitScript(f=>{if(!sessionStorage.getItem('pl-qa-seed')){localStorage.setItem('cete-savaslari-save-v1',JSON.stringify(f));localStorage.setItem('cete-age-ok','1');localStorage.setItem('tariklab.language','pl');sessionStorage.setItem('pl-qa-seed','1')}},fixture);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [tab,title] of tabs){
  await page.goto(`${base}/cete-savaslari?sekme=${tab}`,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:title,exact:true}).first().waitFor();
  const main=page.locator('.game-shell main');await main.waitFor();
  const text=await main.innerText();
  const items=tab==='tezgah'?ALL_ITEMS:tab==='icraat'?ALL_MISSIONS:tab==='emlak'?ESTATES:[];
  const translations=tab==='tezgah'?PL_ITEMS:tab==='icraat'?PL_JOBS:PL_ESTATES;
  for(const item of items){assert.ok(text.includes(translations[item.id].name),`${tab}: name ${item.id}`);assert.ok(text.includes(translations[item.id].desc),`${tab}: description ${item.id}`)}
  if(tab==='icraat'){assert.match(text,/Szansa \d+%/);assert.ok(!/\d+ ekipa/.test(text));}
  if(tab==='klinik') await page.getByRole('spinbutton',{name:'Kwota funduszu łapówek'}).waitFor();
  const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(geometry.scroll<=width,JSON.stringify(geometry));
  const clipped=await main.locator('button:visible').evaluateAll(buttons=>buttons.filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.innerText));
  assert.deepEqual(clipped,[],`${tab}/${width}: clipped buttons`);
  assert.equal(await page.evaluate(()=>document.documentElement.lang),'pl');assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/pl-${width}-${tab}.png`,fullPage:true});rows.push({width,tab,items:items.length,overflow:false,errors:[]});
 }
 await page.reload({waitUntil:'networkidle'});await page.getByRole('heading',{name:'Podziemna klinika',exact:true}).waitFor();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tariklab::cete:1')));assert.equal(saved.state.player.name,'PL QA');
 await context.close();
 }
 await writeFile(`${out}/results.json`,JSON.stringify(rows,null,2));console.log(`CETE_POLISH_PASS ${label}: ${rows.length} screen/width cases; saved player reloaded`);
}finally{await browser.close()}
