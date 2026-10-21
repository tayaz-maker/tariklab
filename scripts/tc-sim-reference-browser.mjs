// Reference-shell acceptance: real UI navigation in isolated Chromium contexts.
// Each locale/viewport visits every existing view; browsing must never rewrite saves.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import {createStaticGameServer} from './static-game-server.mjs';
import {createNewGame} from '../public/games/tc-sim/js/state.js';
import {NAVIGATION_ITEMS} from '../public/games/tc-sim/js/navigation.js';
import {checkedOutcomeOrigin} from './tc-sim-job-start-target.mjs';
const {values}=parseArgs({options:{serve:{type:'string'},'base-url':{type:'string'},'expected-sha':{type:'string'},out:{type:'string',default:'work/tc-sim-reference'},label:{type:'string',default:'source'},languages:{type:'string',default:'tr,en,pl'},widths:{type:'string',default:'320,390,768,1280,1440,1920'}}});
assert.notEqual(Boolean(values.serve),Boolean(values['base-url']));
const out=resolve(values.out,values.label);mkdirSync(out,{recursive:true});
const languages=values.languages.split(','),widths=values.widths.split(',').map(Number);
assert.ok(languages.every(l=>['tr','en','pl'].includes(l))&&widths.every(w=>[320,390,768,1280,1440,1586,1920].includes(w)));
const report={status:'RUNNING',views:NAVIGATION_ITEMS.length,languages,widths,rows:[],interaction:[],fingerprints:[]};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
let server,browser,origin=values['base-url']?checkedOutcomeOrigin(values['base-url'],true):null;
const seed=createNewGame({name:'T',seed:37,eraId:'2017-04-18'});seed.world.scenario.pendingEvent=null;
async function mainSha(){const r=await fetch('https://api.github.com/repos/tayaz-maker/tariklab/branches/main');assert.equal(r.status,200);const m=await r.json();assert.equal(m.commit.sha,values['expected-sha'],'main moved');return m.commit.sha;}
async function navigate(page,view){
 const target=page.locator(`.side-nav [data-view="${view}"]`);
 const toggle=page.locator('.side-nav .nav-more');
 if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
 const group=target.locator('xpath=ancestor::details[1]');
 if(await group.count()&&await group.getAttribute('open')===null)await group.locator('summary').click();
 await target.click();
 await page.locator(`.side-nav [data-view="${view}"].is-active`).waitFor({state:'attached'});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function geometry(page){return page.evaluate(()=>{
 const rect=sel=>{const el=document.querySelector(sel),r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
 const overflow=[...document.querySelectorAll('.workspace *, .game-topbar *, .game-toolbar *, .life-status *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).position!=='fixed'&&!el.closest('.ledger-scroll,.bank-history,.management-inspector,.region-map-art')&&(r.right>innerWidth+1||r.left< -1);}).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,60)}));
 return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,offscreen:overflow.slice(0,8),header:rect('.game-topbar'),toolbar:rect('.game-toolbar'),status:rect('.life-status'),workspace:rect('.workspace'),sidebar:rect('.side-nav'),title:document.querySelector('.workspace-head h1')?.textContent,font:getComputedStyle(document.querySelector('.workspace')).fontSize,background:getComputedStyle(document.documentElement).getPropertyValue('--bg')};
});}
try{
 if(origin){assert.match(values['expected-sha']||'',/^[a-f0-9]{40}$/);report.mainBefore=await mainSha();}
 else{server=createStaticGameServer(values.serve);await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});origin=`http://127.0.0.1:${server.address().port}`;}
 report.origin=origin;
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 if(values['expected-sha']){
  const files=readdirSync('public/games/tc-sim',{recursive:true}).filter(p=>/\.(js|css|html)$/.test(p));
  for(const file of files){const path=`public/games/tc-sim/${file}`,expected=execFileSync('git',['show',`${values['expected-sha']}:${path}`]);assert.equal(digest(readFileSync(path)),digest(expected),'local source differs from exact main');const response=await fetch(`${origin}/${path.slice(7)}?tc-reference=${values['expected-sha']}`,{cache:'no-store'});assert.equal(response.status,200);assert.equal(digest(Buffer.from(await response.arrayBuffer())),digest(expected),`deployed bytes differ: ${path}`);report.fingerprints.push({path,sha256:digest(expected)});}
 }
 for(const language of languages)for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await context.addInitScript(({seed,language})=>{if(!localStorage.getItem('reference-seeded')){localStorage.setItem('tariklab::tc-sim:1',JSON.stringify(seed));localStorage.setItem('tariklab::tc-sim:active','1');localStorage.setItem('tariklab.language',language);localStorage.setItem('reference-seeded','1');}},{seed,language});
  await page.goto(`${origin}/games/tc-sim/index.html`);await page.locator('#continue-game').click();
  const rawSave=await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1'));
  let baseline;
  for(const {view} of NAVIGATION_ITEMS){
   await navigate(page,view);const g=await geometry(page);assert.ok(g.title,`${language}/${width}/${view}: title missing`);
   assert.ok(g.overflow<=0,`${language}/${width}/${view}: overflow ${g.overflow}`);assert.deepEqual(g.offscreen,[],`${language}/${width}/${view}: offscreen controls`);
   assert.ok(g.header.y===0,'header stays at top');
   if(width>820){assert.equal(g.sidebar.w,258);assert.equal(g.workspace.x,258);assert.equal(g.sidebar.y,g.header.h);}
   else{assert.equal(g.workspace.x,0);assert.equal(await page.locator('.nav-more').getAttribute('aria-expanded'),'false');}
   const common={header:g.header,toolbar:g.toolbar,status:g.status,x:g.workspace.x,w:g.workspace.w,font:g.font,background:g.background};
   baseline ||=common;assert.deepEqual(common,baseline,`${language}/${width}/${view}: shell geometry changed`);
   assert.equal(await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1')),rawSave,'navigation changed saved game');
   await page.screenshot({path:`${out}/${language}-${width}-${view}.png`});
   report.rows.push({language,width,view,...g,status:'PASS'});
  }
  // Keyboard, drawer focus containment, Escape, remembered category state.
  const toggle=page.locator('.nav-more');await toggle.click();
  if(width<=820){assert.equal(await page.locator('.workspace').evaluate(el=>el.inert),true);await toggle.focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.querySelector('.side-nav').contains(document.activeElement)),true);await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);}
  else{assert.equal((await geometry(page)).workspace.x,64);await page.screenshot({path:`${out}/${language}-${width}-collapsed.png`});await page.locator('[data-ui-panel="navigation:0"] > summary').click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tariklab.tc-sim.ui.v2')).panels['navigation:0']),true,'opening a category from icon mode persists its actual open state');}
  if(width<=820)await toggle.click();
  const group=page.locator('[data-ui-panel="navigation:0"]');const wasOpen=await group.getAttribute('open')!==null;await group.locator('summary').click();
  await page.reload();await page.locator('#continue-game').click();assert.equal(await page.locator('[data-ui-panel="navigation:0"]').getAttribute('open')!==null,!wasOpen);
  if(width<=820)await page.locator('.nav-more').click();
  await page.locator('.life-nav-search input').fill({tr:'Bankalar',en:'Banks',pl:'Banki'}[language]);assert.equal(await page.locator('.side-nav [data-view]:visible').count(),1);await page.locator('.life-nav-search input').fill('');
  await page.locator('[data-ui-jump="help"]').click();await page.locator('.help-card').waitFor();assert.equal(await page.locator('.workspace').evaluate(el=>el.inert),true);await page.screenshot({path:`${out}/${language}-${width}-help.png`});await page.keyboard.press('Escape');assert.equal(await page.locator('.help-card').count(),0);
  for(const locale of ['tr','en','pl']){await page.locator(`[data-language="${locale}"]`).click();assert.equal(await page.locator(`[data-language="${locale}"]`).getAttribute('aria-pressed'),'true');assert.ok((await geometry(page)).overflow<=0,'switching language preserves viewport layout');}
  assert.equal(await page.evaluate(()=>localStorage.getItem('tariklab::tc-sim:1')),rawSave);assert.deepEqual(errors,[]);
  report.interaction.push({language,width,keyboard:true,escape:true,drawer:true,categoriesRemembered:true,search:true,saveUnchanged:true,status:'PASS'});
  console.log(`${language}/${width}: ${NAVIGATION_ITEMS.length} views + interactions PASS`);await context.close();
 }
 if(values['expected-sha'])report.mainAfter=await mainSha();report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;throw error;}finally{writeFileSync(`${out}/acceptance.json`,JSON.stringify(report,null,2)+'\n');await browser?.close();server?.close();}
