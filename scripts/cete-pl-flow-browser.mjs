import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { hydratePlayer, makeRivals, MARKET_START, SAVE_VERSION } from '../src/game/data.ts';
import { checkedUrl } from './browser-guard.mjs';
const base=checkedUrl(process.env.CETE_BASE||'http://127.0.0.1:8080');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
try {for(const width of [390,1280]) {
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 const originalLog='İhanet. İtibar düşükken Gözcü Selim defteri emniyete sızdırdı, 1.200 ₺ ile kayboldu.';
 const decimalLog='USDT fırladı. 31.5 → 32.7 ₺.';
 const fixture={version:SAVE_VERSION,state:{version:SAVE_VERSION,player:hydratePlayer({name:'Flow QA',neighborhood:'eyup',level:10,cash:100000,jobsDone:5,stamina:32,itibar:40,tutorialStep:4,streakDay:new Date().toISOString().slice(0,10),eventCooldown:9999}),rivals:makeRivals(),logs:[{id:'historic-qa',at:0,kind:'crew',text:originalLog},{id:'decimal-qa',at:0,kind:'invest',text:decimalLog}],hiz:1,market:MARKET_START,savedAt:Date.now()}};
 await context.addInitScript(f=>{if(!sessionStorage.getItem('flow-seed')){localStorage.setItem('cete-savaslari-save-v1',JSON.stringify(f));localStorage.setItem('cete-age-ok','1');localStorage.setItem('tariklab.language','pl');sessionStorage.setItem('flow-seed','1')}},fixture);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/cete-savaslari?sekme=emlak`,{waitUntil:'networkidle'});await page.getByRole('heading',{name:'Kasa',exact:true}).waitFor();
 await page.getByRole('spinbutton',{name:'Kwota wpłaty lub wypłaty'}).waitFor();
 await page.getByRole('button',{name:'Wpłać',exact:true}).click();
 const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tariklab::cete:1')).state);
 const before=await save();assert.equal(before.player.bank,2000);assert.equal(before.player.cash,98000);assert.ok(before.logs.some(l=>l.text==='Kasaya 2.000 ₺ indi. Sokak bunu gasp etmez.'));
 if(width===390)await page.getByRole('button',{name:'Dziennik',exact:true}).click();
 await page.locator('p:visible').filter({hasText:/Czujka Selim.*1\s*200 ₺/}).first().waitFor();
 await page.locator('p:visible').filter({hasText:'31,5 → 32,7 ₺'}).first().waitFor();
 if(width===390)await page.getByRole('button',{name:'Dziennik',exact:true}).click();
 await page.reload({waitUntil:'networkidle'});await page.getByRole('heading',{name:'Kasa',exact:true}).waitFor();const after=await save();assert.equal(after.player.name,'Flow QA');assert.ok(after.player.bank>=2000);assert.ok(after.logs.some(l=>l.text==='Kasaya 2.000 ₺ indi. Sokak bunu gasp etmez.'));assert.ok(after.logs.some(l=>l.text===originalLog));assert.ok(after.logs.some(l=>l.text===decimalLog));
 const slots=page.getByRole('button',{name:/^Slot 1$/}).first();await slots.click();const dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'Trzy miejsca zapisu'}).waitFor();assert.ok((await dialog.innerText()).includes('Puste miejsce'));await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 for(const [lang,title] of [['TR','Kasa'],['EN','Bank'],['PL','Kasa']]){await page.getByRole('button',{name:lang,exact:true}).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.lang),lang.toLowerCase());}
 await page.getByRole('button',{name:'Szczegóły',exact:true}).click();
 await page.getByRole('button',{name:'Jak grać',exact:true}).click();await page.getByRole('dialog').getByRole('heading',{name:'Cel',exact:true}).waitFor();await page.keyboard.press('Escape');
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=width);assert.deepEqual(errors,[]);await context.close();console.log(JSON.stringify({width,deposit:true,reload:true,slots:true,languageSwitch:true,help:true,errors}));
}}finally{await browser.close()}
