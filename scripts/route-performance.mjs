// Cold entry cost of every live route. No user saves, production writes or asset downloads.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {checkedUrl,checkedOutputPath} from './browser-guard.mjs';

const args=process.argv.slice(2),arg=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const label=arg('--label','after'),cwd=resolve(arg('--cwd','.'));
const out=checkedOutputPath(resolve(process.env.RUNNER_TEMP||'/workspace','screenshots','map-performance'),[resolve(process.env.RUNNER_TEMP||'/workspace','screenshots')]);
await mkdir(out,{recursive:true});
const catalog=(await readFile(resolve(cwd,'src/lib/games.ts'),'utf8')).split('export const GAMES:')[1];
const routes=[{id:'portal',href:'/'},...[...catalog.matchAll(/slug: "([^"]+)"[\s\S]*?status: "live",\s*href: "([^"]+)"/g)].map(m=>({id:m[1],href:m[2]}))];
assert.equal(routes.length,21,'20 live games and portal; keep measurements complete');
const base=checkedUrl('http://127.0.0.1:8089');
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','8089'],{cwd,stdio:'inherit',detached:true});
const rows=[],errors=[];let browser;
try{
 let ready=false;for(let i=0;i<120;i++){try{ready=(await fetch(base)).ok;}catch{/* bounded startup */}if(ready)break;await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'built preview startup');
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 for(const width of [1440,390,320])for(const route of routes){
  const context=await browser.newContext({viewport:{width,height:width===1440?900:844},reducedMotion:'reduce'});
  await context.addInitScript(()=>localStorage.setItem('tariklab.language','tr'));
  const page=await context.newPage(),requests=[],reads=[],caseErrors=[];page.setDefaultTimeout(20000);
  page.on('pageerror',e=>caseErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')caseErrors.push(m.text());});
  const pending=new Set();let quietTimer,quietDone;
  const settle=()=>{clearTimeout(quietTimer);if(!pending.size&&quietDone)quietTimer=setTimeout(quietDone,500);};
  context.on('request',request=>{pending.add(request);clearTimeout(quietTimer);});
  context.on('requestfailed',request=>{pending.delete(request);caseErrors.push(`${request.url()}: ${request.failure()?.errorText}`);settle();});
  context.on('response',response=>{if(response.status()>=400)caseErrors.push(`HTTP ${response.status()}: ${response.url()}`);});
  context.on('requestfinished',request=>{reads.push(request.sizes().then(size=>requests.push({url:request.url(),bytes:size.responseBodySize+size.responseHeadersSize,serviceWorker:!!request.serviceWorker()})).catch(e=>caseErrors.push(String(e))));pending.delete(request);settle();});
  const start=performance.now();await page.goto(base+route.href,{waitUntil:'domcontentloaded'});
  let surface=page;
  if(route.href.startsWith('/oyna/')){const iframe=page.locator('iframe');await iframe.waitFor();surface=await (await iframe.elementHandle()).contentFrame();}
  await surface.waitForFunction(()=>document.body.innerText.trim().length>20);
  const firstReadableMs=Math.round(performance.now()-start);
  await page.waitForLoadState('networkidle');
  await new Promise((done,reject)=>{const limit=setTimeout(()=>{clearTimeout(quietTimer);reject(new Error('Network did not settle including service workers'));},20000);quietDone=()=>{clearTimeout(limit);done();};settle();});
  await Promise.all(reads);
  const geometry=await surface.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(geometry.scroll<=geometry.width+1,`${route.id}/${width}: overflow ${JSON.stringify(geometry)}`);
  const gameRequests=requests.filter(r=>/\/games\/|\/vendor\/pixi\/|\/assets\/(?:game-shell|store)-/.test(r.url));
  if(route.id==='portal')assert.deepEqual(gameRequests,[],'portal must not fetch game assets, store or Pixi');
  assert.deepEqual(caseErrors,[],`${route.id}/${width}: console`);
  rows.push({route:route.id,width,firstReadableMs,transferBytes:requests.reduce((n,r)=>n+r.bytes,0),requestCount:requests.length,pixiBytes:requests.filter(r=>/\/vendor\/pixi\//.test(r.url)).reduce((n,r)=>n+r.bytes,0),gameRequests:gameRequests.map(r=>r.url),overflow:geometry.scroll-geometry.width,errors:caseErrors});
  await context.close();
 }
}catch(e){errors.push(e.stack);throw e;}
finally{await writeFile(resolve(out,label+'.json'),JSON.stringify({label,rows,errors},null,2));await browser?.close();try{process.kill(-server.pid,'SIGTERM');}catch{server.kill('SIGTERM');}}
if(label==='after'){
 const before=JSON.parse(await readFile(resolve(out,'before.json'),'utf8'));
 const lines=['# Cold built-route measurements','','Fresh browser contexts, no saves. Response bytes include encoded bodies and response headers reported by Chromium, including service-worker initiated requests; cold contexts prevent prior-session cache reuse. First readable time ends at the game document (including iframe), not just the portal shell. Network and runner timing vary; these are evidence, not universal latency claims. Map-opening/action costs are measured separately by wave1-outcome.','', '| Route / width | Before → after bytes | Before → after requests | Before → after readable ms | Pixi bytes at entry |','| --- | ---: | ---: | ---: | ---: |'];
 for(const row of rows){const b=before.rows.find(r=>r.route===row.route&&r.width===row.width);assert.ok(b);lines.push(`| ${row.route} / ${row.width} | ${b.transferBytes} → ${row.transferBytes} | ${b.requestCount} → ${row.requestCount} | ${b.firstReadableMs} → ${row.firstReadableMs} | ${row.pixiBytes} |`);}
 await writeFile(resolve(out,'route-comparison.md'),lines.join('\n')+'\n');
}
console.log(JSON.stringify({label,scenarios:rows.length,errors}));
