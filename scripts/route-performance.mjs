// Cold entry cost of every live route. No user saves, production writes or asset downloads.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {checkedUrl,checkedOutputPath} from './browser-guard.mjs';
import {withDeadline} from './route-performance-deadline.mjs';

const args=process.argv.slice(2),arg=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const routeFilter=arg('--route',null),widthFilter=arg('--width',null),focused=routeFilter!==null||widthFilter!==null;
const label=arg('--label',focused?'repro':'after'),cwd=resolve(arg('--cwd','.'));
const out=checkedOutputPath(resolve(process.env.RUNNER_TEMP||'/workspace','screenshots','map-performance'),[resolve(process.env.RUNNER_TEMP||'/workspace','screenshots')]);
await mkdir(out,{recursive:true});
const catalog=(await readFile(resolve(cwd,'src/lib/games.ts'),'utf8')).split('export const GAMES:')[1];
const allRoutes=[{id:'portal',href:'/'},...[...catalog.matchAll(/slug: "([^"]+)"[\s\S]*?status: "live",\s*href: "([^"]+)"/g)].map(m=>({id:m[1],href:m[2]}))];
assert.equal(allRoutes.length,21,'20 live games and portal; keep measurements complete');
const routes=routeFilter===null?allRoutes:allRoutes.filter(r=>r.id===routeFilter||r.href===routeFilter);
const widths=widthFilter===null?[1440,390,320]:[Number(widthFilter)];
assert.ok(routes.length,'--route must be a live game id or route');
assert.ok(widths.every(width=>[1440,390,320].includes(width)),'--width must be 1440, 390 or 320');
const base=checkedUrl('http://127.0.0.1:8089');
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','8089'],{cwd,stdio:'inherit',detached:true});
let serverError;server.once('error',error=>{serverError=error;});
const rows=[],errors=[],progress=[];let browser,activeContext,activeCase=null,primaryError=null,complete=false,clearCaseTimers=()=>{};
const expectedCases=routes.length*widths.length;
function record(stage,event,details={}) {
 const row={at:new Date().toISOString(),route:activeCase?.route||null,width:activeCase?.width||null,stage,event,...details};
 progress.push(row);console.log(JSON.stringify({label,...row}));
}
function failure(error) {return error?.stack||String(error);}
async function persist() {
 await withDeadline('write partial route artifact',()=>writeFile(resolve(out,label+'.json'),JSON.stringify({label,coverage:focused?'focused':'full',expectedCases,complete,activeCase,rows,progress,errors},null,2)),10000);
}
async function stage(name,operation,timeoutMs=20000) {
 const started=performance.now(),description=`${activeCase?`${activeCase.route}/${activeCase.width}: `:''}${name}`;
 record(name,'start',{timeoutMs});
 try {const result=await withDeadline(description,operation,timeoutMs);record(name,'end',{elapsedMs:Math.round(performance.now()-started)});return result;}
 catch(error){record(name,'error',{elapsedMs:Math.round(performance.now()-started),error:failure(error)});throw error;}
}
async function closeContext() {
 const context=activeContext;activeContext=null;
 if(context)await stage('context.close',()=>context.close(),15000);
}
async function cleanup(name,operation) {
 try {await operation();}
 catch(error){errors.push({stage:name,error:failure(error)});if(!primaryError)primaryError=error;}
}
function killPreview(signal) {
 if(!server.pid)return;
 try {process.kill(-server.pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}
}
async function stopPreview() {
 if(!server.pid)return;
 const exited=server.exitCode!==null||server.signalCode!==null?Promise.resolve():new Promise(resolve=>server.once('exit',resolve));
 try {killPreview('SIGTERM');await stage('preview exit',()=>exited,10000);}
 finally {killPreview('SIGKILL');} // Also release any preview descendants left after npm exits.
}
try {
 const startupAbort=new AbortController();
 try {
  await stage('preview startup',async()=>{
   while(!startupAbort.signal.aborted){
    if(serverError)throw serverError;
    let ready=false;
    try {ready=(await fetch(base,{signal:AbortSignal.any([startupAbort.signal,AbortSignal.timeout(2000)])})).ok;}catch{/* bounded startup */}
    if(ready)return;
    assert.equal(server.exitCode,null,'preview exited before becoming ready');
    await new Promise(resolve=>setTimeout(resolve,250));
   }
   throw new Error('Preview startup interrupted');
  });
 } finally {startupAbort.abort();}
 browser=await stage('browser launch',()=>chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox'],timeout:20000}));
 for(const width of widths)for(const route of routes){
  activeCase={route:route.id,href:route.href,width};record('case','start');await persist();
  const context=await stage('context create',()=>browser.newContext({viewport:{width,height:width===1440?900:844},reducedMotion:'reduce'}));activeContext=context;
  await stage('context setup',()=>context.addInitScript(()=>localStorage.setItem('tariklab.language','tr')));
  const page=await stage('page create',()=>context.newPage()),requests=[],reads=[],caseErrors=[],pendingSizes=new Map();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>caseErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')caseErrors.push(m.text());});
  const pending=new Set();let quietTimer,quietDone;
  clearCaseTimers=()=>{clearTimeout(quietTimer);quietDone=null;};
  const settle=()=>{clearTimeout(quietTimer);if(!pending.size&&quietDone)quietTimer=setTimeout(quietDone,500);};
  context.on('request',request=>{pending.add(request);clearTimeout(quietTimer);});
  context.on('requestfailed',request=>{pending.delete(request);caseErrors.push(`${request.url()}: ${request.failure()?.errorText}`);settle();});
  context.on('response',response=>{if(response.status()>=400)caseErrors.push(`HTTP ${response.status()}: ${response.url()}`);});
  context.on('requestfinished',request=>{
   const requestInfo={url:request.url(),serviceWorker:!!request.serviceWorker()};pendingSizes.set(request,requestInfo);
   const read=withDeadline(`${route.id}/${width}: request.sizes ${requestInfo.url} (serviceWorker=${requestInfo.serviceWorker})`,()=>request.sizes(),10000).then(size=>{
    assert.ok(Number.isFinite(size.responseBodySize)&&size.responseBodySize>=0&&Number.isFinite(size.responseHeadersSize)&&size.responseHeadersSize>=0,`Invalid response sizes: ${request.url()}`);
    requests.push({...requestInfo,bytes:size.responseBodySize+size.responseHeadersSize});
   }).catch(error=>caseErrors.push(`request.sizes ${request.url()}: ${failure(error)}`)).finally(()=>pendingSizes.delete(request));
   reads.push(read);pending.delete(request);settle();
  });
  try {
   const start=performance.now();await stage('navigation',()=>page.goto(base+route.href,{waitUntil:'domcontentloaded'}));
   let surface=page;
   if(route.href.startsWith('/oyna/'))surface=await stage('iframe',async()=>{const iframe=page.locator('iframe');await iframe.waitFor();return (await iframe.elementHandle()).contentFrame();});
   await stage('readable surface',()=>surface.waitForFunction(()=>document.body.innerText.trim().length>20));
   const firstReadableMs=Math.round(performance.now()-start);
   await stage('networkidle',()=>page.waitForLoadState('networkidle'));
   try {await stage('quiet',()=>new Promise(done=>{quietDone=done;settle();}));}finally {clearCaseTimers();}
   await stage('sizes',()=>Promise.all(reads),15000);
   const geometry=await stage('geometry',()=>surface.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})));
   assert.ok(geometry.scroll<=geometry.width+1,`${route.id}/${width}: overflow ${JSON.stringify(geometry)}`);
   const gameRequests=requests.filter(r=>/\/games\/|\/vendor\/pixi\/|\/assets\/(?:game-shell|store)-/.test(r.url));
   if(route.id==='portal')assert.deepEqual(gameRequests,[],'portal must not fetch game assets, store or Pixi');
   assert.deepEqual(caseErrors,[],`${route.id}/${width}: console or measurement`);
   rows.push({route:route.id,width,firstReadableMs,transferBytes:requests.reduce((n,r)=>n+r.bytes,0),requestCount:requests.length,pixiBytes:requests.filter(r=>/\/vendor\/pixi\//.test(r.url)).reduce((n,r)=>n+r.bytes,0),gameRequests:gameRequests.map(r=>r.url),overflow:geometry.scroll-geometry.width,errors:caseErrors});
   await persist();
   await closeContext();record('case','end');await persist();activeCase=null;
  }catch(error){record('case','error',{error:failure(error),pendingRequests:[...pending].map(r=>r.url()),pendingSizes:[...pendingSizes.values()],caseErrors});throw error;}
  finally {clearCaseTimers();}
 }
}catch(error){primaryError=error;errors.push({stage:'measurement',error:failure(error)});}
finally {
 clearCaseTimers();
 await cleanup('partial artifact',persist);
 await cleanup('context cleanup',closeContext);
 try {await cleanup('browser cleanup',()=>stage('browser.close',()=>browser?.close(),15000));}
 finally {await cleanup('preview cleanup',stopPreview);}
 complete=rows.length===expectedCases&&!primaryError;
 await cleanup('final artifact',persist);
}
if(primaryError)throw primaryError;
if(label==='after'&&!focused){
 const before=JSON.parse(await readFile(resolve(out,'before.json'),'utf8'));
 const lines=['# Cold built-route measurements','','Fresh browser contexts, no saves. Response bytes include encoded bodies and response headers reported by Chromium, including service-worker initiated requests; cold contexts prevent prior-session cache reuse. First readable time ends at the game document (including iframe), not just the portal shell. Network and runner timing vary; these are evidence, not universal latency claims. Map-opening/action costs are measured separately by wave1-outcome.','', '| Route / width | Before → after bytes | Before → after requests | Before → after readable ms | Pixi bytes at entry |','| --- | ---: | ---: | ---: | ---: |'];
 for(const row of rows){const b=before.rows.find(r=>r.route===row.route&&r.width===row.width);assert.ok(b);lines.push(`| ${row.route} / ${row.width} | ${b.transferBytes} → ${row.transferBytes} | ${b.requestCount} → ${row.requestCount} | ${b.firstReadableMs} → ${row.firstReadableMs} | ${row.pixiBytes} |`);}
 await writeFile(resolve(out,'route-comparison.md'),lines.join('\n')+'\n');
}
console.log(JSON.stringify({label,coverage:focused?'focused':'full',scenarios:rows.length,errors}));
