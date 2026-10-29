import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { hydratePlayer, makeRivals, MARKET_START, SAVE_VERSION } from '../src/game/data.ts';
import { checkedUrl } from './browser-guard.mjs';
const base=checkedUrl(process.env.CETE_BASE||'http://127.0.0.1:8080');
const cases=[
 {tab:'klinik',extra:{durum:'nezaret',durumTick:5},need:['Jesteś w areszcie','Areszt','Spróbuj wręczyć łapówkę'],reject:['Holding cell','Nezarethane']},
 {tab:'klinik',extra:{durum:'klinik',durumTick:5},need:['Jesteś w klinice','Leczenie'],reject:['Treatment','Müdahale']},
 {tab:'emlak',extra:{senet:{kind:'borc',name:'Nuri',amount:5000,dueGun:3},kose:1,koseGun:1},need:['Weksel','dług','Jeden punkt','tygodniowo'],reject:['Note: debt','Tek köşe']},
 {tab:'hayat',extra:{pendingFamily:{partnerId:'p1',name:'Cansu'},girlfriend:'p1',relations:{p1:80},horse:{name:'Test',speed:5,form:50}},need:['Wiadomość o dziecku','Poślub matkę dziecka','Spędź noc','Trenuj'],reject:['Çocuk haberi','Karısıyla evlen']},
 {tab:'sokak',extra:{crew:['gozcu'],crewBusy:{gozcu:5}},need:['Na zleceniu','Ryzyko zdrady'],reject:['On assignment','Görevde']},
 {tab:'sokak',extra:{},rivalPatch:{bounty:5000,hospitalTicks:5,revengeTicks:5},need:['Nagroda','Klinika','Zemsta za','Odbierz nagrodę'],reject:['Bounty','Revenge in']},
 {tab:'ben',extra:{married:true,spouse:'Cansu',kids:2,saglikIzi:3},need:['Cansu','dzieci: 2','Ślad urazu'],reject:['2 çocuk','Sağlık izi']},
 {tab:'icraat',extra:{pendingSeasonCeremony:{score:90,title:"İstanbul'un babası",bonus:590}},need:['Sezon zakończony','Ojciec Stambułu','Nowy sezon'],reject:['Sezon kapandı']},
];
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
try{for(const width of [390,1280])for(const x of cases){const c=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});const rivals=makeRivals();if(x.rivalPatch)Object.assign(rivals[0],x.rivalPatch);const fixture={version:SAVE_VERSION,state:{version:SAVE_VERSION,player:hydratePlayer({name:'QA',neighborhood:'eyup',level:10,cash:100000,jobsDone:5,stamina:32,itibar:40,tutorialStep:4,streakDay:new Date().toISOString().slice(0,10),eventCooldown:9999,...x.extra}),rivals,logs:[],hiz:1,market:MARKET_START,savedAt:Date.now()}};await c.addInitScript(f=>{localStorage.setItem('cete-savaslari-save-v1',JSON.stringify(f));localStorage.setItem('cete-age-ok','1');localStorage.setItem('tariklab.language','pl')},fixture);const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(`${base}/cete-savaslari?sekme=${x.tab}`,{waitUntil:'networkidle'});await p.locator('.game-shell main').waitFor();for(const text of x.need)await p.getByText(text,{exact:false}).first().waitFor({state:'attached'});const body=await p.locator('body').innerText();for(const text of x.reject)assert.ok(!body.includes(text),`${width}/${x.tab}: ${text}`);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await c.close();console.log(JSON.stringify({width,tab:x.tab,required:x.need.length,errors}));}}finally{await browser.close()}
