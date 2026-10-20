import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import vm from 'node:vm';
const repo=process.cwd();
const evidence=path.join(process.env.RUNNER_TEMP||'/workspace','screenshots','wave1-bukucu');
fs.mkdirSync(evidence,{recursive:true});
const { chromium }=createRequire(path.join(repo,'package.json'))('playwright');
const args=process.argv.slice(2);
const label=args[0]||'source';
const root=path.resolve(args[1]||'public');
const script=fs.readFileSync('scripts/bukucu-qa.mjs','utf8');
const resume=vm.runInNewContext(`(${script.slice(script.indexOf('async function resume('),script.indexOf('const snap ='))})`);
const blank=vm.runInNewContext(script.slice(script.indexOf('const blank ='),script.indexOf('const tiles ='))+'blank;');
const server=http.createServer((req,res)=>{
 let file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/games/bukucu/`;
let browser;
const results=[];
try {
 if(!args.includes('--smoke-only')){
  const qa=spawn(process.execPath,['scripts/bukucu-qa.mjs','--games','1','--steps','6000'],{stdio:'inherit',env:{...process.env,BUKUCU_URL:url}});
  const code=await new Promise(r=>qa.on('exit',r));assert.equal(code,0,'existing Bükücü scenarios and all four fuzz modes');
 }
 browser=await chromium.launch({args:['--no-sandbox']});
 console.log('Chromium',browser.version(),'fixture smoke',label);
 for(const lang of ['tr','en','pl'])for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844}});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(lang=>localStorage.setItem('tariklab.language',lang),lang);
  await page.goto(url,{waitUntil:'networkidle'});
  await resume(page,blank({cash:[321,987],pos:[1,0],wait:'buy',focus:1,rng:5}));
  assert.equal(await page.evaluate(()=>document.documentElement.lang),lang);
  await page.locator('#acts button[data-act="al"]').click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tariklab::bukucu:1')));
  assert.equal(saved.cash[0],261);assert.equal(saved.own[1],0);
  await page.reload({waitUntil:'networkidle'});
  await page.locator('#menu button[data-act="cont"]').click();
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('tariklab::bukucu:1')));
  assert.deepEqual(restored,saved);
  const ui=await page.evaluate(()=>({lang:document.documentElement.lang,width:innerWidth,scroll:document.documentElement.scrollWidth,visible:document.getElementById('app').style.visibility,active:localStorage.getItem('tariklab::bukucu:active')}));
  assert.equal(ui.lang,lang);assert.equal(ui.visible,'visible');assert.equal(ui.active,'1');assert.ok(ui.scroll<=width,`horizontal overflow ${ui.scroll}>${width}`);assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(evidence,`bukucu-${label}-${lang}-${width}.png`),fullPage:true});
  console.log(`PASS ${label} ${lang} ${width}px fixture -> buy -> reload, cash=261 own[1]=0, no runtime/console errors, no horizontal overflow`);
  results.push({label,lang,viewport:{width,height:844},cash:restored.cash,propertyOwner:restored.own[1],runtimeErrors:errors,horizontalOverflow:ui.scroll>width,screenshot:path.join(evidence,`bukucu-${label}-${lang}-${width}.png`)});
  await context.close();
 }
 fs.writeFileSync(path.join(evidence,`bukucu-${label}-browser.json`),JSON.stringify({status:"PASS",chromium:browser.version(),root,fullSuite:!args.includes("--smoke-only"),cells:results},null,2));
} finally {if(browser)await browser.close();server.closeAllConnections();server.close();}
