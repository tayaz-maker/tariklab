// Canonical product integration proof: Polish shell retains the documented EN game fallback.
import assert from 'node:assert/strict';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const base=process.env.QA_BASE||'http://127.0.0.1:8096';
const root=resolve(process.env.QA_EXPECTED_ROOT||'public');
const out=resolve(process.env.QA_OUT||'work/jitem-canonical');
await mkdir(out,{recursive:true});
const report={base,root,scope:'TR/EN/PL shell; documented EN JITEM fallback for PL; real decision/save/reload and locale switch',hashes:[],cases:[]};
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox']});
const hash=b=>createHash('sha256').update(b).digest('hex');
async function files(dir,prefix=''){const list=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.isDirectory())list.push(...await files(resolve(dir,e.name),prefix+e.name+'/'));else list.push(prefix+e.name);}return list;}
try{
 const request=await browser.newContext();
 const transport=await request.newPage();
 await transport.goto(base+'/games/jitem-derin-ag/SOURCE.json',{waitUntil:'domcontentloaded'});
 for(const file of await files(resolve(root,'games/jitem-derin-ag'))){
  const path='/games/jitem-derin-ag/'+file;
  const actual=await transport.evaluate(async path=>{
   const response=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(60000)});
   const body=await response.arrayBuffer();
   const digest=await crypto.subtle.digest('SHA-256',body);
   return {status:response.status,sha256:Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')};
  },path);
  assert.equal(actual.status,200,path);
  const expected=await readFile(resolve(root,'.'+path));
  assert.equal(actual.sha256,hash(expected),path);report.hashes.push({path,sha256:actual.sha256});
 }
 await request.close();
 for(const lang of ['tr','en','pl'])for(const width of [390,1280]){
  const locale=lang==='pl'?'en':lang,errors=[];
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:width===390,isMobile:width===390});
  await context.addInitScript(lang=>localStorage.setItem('tariklab.language',lang),lang);
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+'/oyna/jitem-derin-ag',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:lang.toUpperCase(),exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:lang.toUpperCase(),exact:true}).getAttribute('aria-pressed'),'true');
  const handle=await page.locator('iframe').elementHandle(),frame=await handle.contentFrame();
  await frame.locator('.start-screen-shell button').filter({hasText:locale==='tr'?'Saha hattı':'Field line'}).click();
  assert.equal(await frame.locator('html').getAttribute('lang'),locale);
  const fit=async(checkFrame=frame)=>{for(const target of[page,checkFrame])assert.ok(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${lang}/${width} overflow`);};
  await fit();
  await frame.locator('article:visible button').first().click();
  await frame.getByRole('button',{name:locale==='tr'?'İşler':'Work',exact:true}).filter({visible:true}).first().click();
  await frame.locator('.plan-record:visible').selectOption('kara_topla');
  const before=await frame.evaluate(()=>localStorage.getItem('jitem-derin-ag-v3'));
  await frame.getByRole('button',{name:locale==='tr'?'Kararı uygula':'Commit decision',exact:true}).filter({visible:true}).click();
  const saved=await frame.evaluate(()=>localStorage.getItem('jitem-derin-ag-v3'));
  assert.ok(JSON.parse(saved).state.stats.kara>JSON.parse(before).state.stats.kara);
  assert.equal(JSON.parse(saved).state.schemaVersion,5);
  if(locale==='en')assert.match(await frame.locator('footer').textContent(),/Covert funds were raised/);
  await page.getByRole('button',{name:lang==='tr'?'EN':'TR',exact:true}).click();
  await frame.waitForFunction(expected=>document.documentElement.lang===expected,lang==='tr'?'en':'tr');
  assert.equal(await frame.evaluate(()=>localStorage.getItem('jitem-derin-ag-v3')),saved,'locale switch cannot rewrite save');
  await page.getByRole('button',{name:lang.toUpperCase(),exact:true}).click();
  await frame.waitForFunction(expected=>document.documentElement.lang===expected,locale);
  assert.equal(await frame.evaluate(()=>localStorage.getItem('jitem-derin-ag-v3')),saved);
  await page.reload({waitUntil:'networkidle'});
  const again=await(await page.locator('iframe').elementHandle()).contentFrame();
  await again.getByRole('button',{name:/Devam|Continue/}).click();
  await again.locator('.start-screen-shell').waitFor({state:'detached'});
  assert.equal(await again.evaluate(()=>localStorage.getItem('jitem-derin-ag-v3')),saved,'wrapper reload preserves exact saved state');
  assert.equal(await again.locator('html').getAttribute('lang'),locale);
  await fit(again);assert.deepEqual(errors,[]);
  await page.screenshot({path:resolve(out,`${lang}-${width}.png`),fullPage:true});
  report.cases.push({lang,width,locale,decision:true,saveReload:true,languageSwitch:true,errors,status:'PASS'});
  await context.close();
 }
 report.status='PASS';console.log(JSON.stringify({status:report.status,hashes:report.hashes.length,cases:report.cases.length}));
}finally{await writeFile(resolve(out,'results.json'),JSON.stringify(report,null,2));await browser.close();}
