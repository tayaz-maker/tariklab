// Cold entry cost of every live route. No user saves, production writes or asset downloads.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {checkedUrl,checkedOutputPath} from './browser-guard.mjs';
import {withDeadline} from './route-performance-deadline.mjs';
import {createResponseByteMeter} from './response-byte-meter.mjs';
import {diagnoseWorkerSizes} from './worker-size-diagnostic.mjs';
import {hasReadableBody} from './route-performance-surface.mjs';

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
const upstream=checkedUrl('http://127.0.0.1:8089');
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','8089'],{cwd,stdio:'inherit',detached:true});
let serverError;server.once('error',error=>{serverError=error;});
const rows=[],errors=[],progress=[];let browser,meter,base,activeContext,activeCase=null,primaryError=null,complete=false,clearCaseTimers=()=>{};
const expectedCases=routes.length*widths.length;
function record(stage,event,details={}) {
 const row={at:new Date().toISOString(),route:activeCase?.route||null,width:activeCase?.width||null,stage,event,...details};
 progress.push(row);console.log(JSON.stringify({label,...row}));
}
function failure(error) {return error?.stack||String(error);}
async function persist() {
 await withDeadline('write partial route artifact',()=>writeFile(resolve(out,label+'.json'),JSON.stringify({label,measurement:'http-response-socket-bytes-v1',coverage:focused?'focused':'full',expectedCases,complete,activeCase,rows,progress,errors},null,2)),10000);
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
    try {ready=(await fetch(upstream,{signal:AbortSignal.any([startupAbort.signal,AbortSignal.timeout(2000)])})).ok;}catch{/* bounded startup */}
    if(ready)return;
    assert.equal(server.exitCode,null,'preview exited before becoming ready');
    await new Promise(resolve=>setTimeout(resolve,250));
   }
   throw new Error('Preview startup interrupted');
  });
 } finally {startupAbort.abort();}
 meter=await stage('HTTP response meter',()=>createResponseByteMeter(upstream));base=checkedUrl(meter.origin);
 browser=await stage('browser launch',()=>chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox'],timeout:20000}));
 for(const width of widths)for(const route of routes){
  activeCase={route:route.id,href:route.href,width};record('case','start');await persist();
  const meterBefore=meter.snapshot();assert.equal(meterBefore.activeRequests,0,'previous case must finish before measuring the next');
  const context=await stage('context create',()=>browser.newContext({viewport:{width,height:width===1440?900:844},reducedMotion:'reduce'}));activeContext=context;
  await stage('context setup',()=>context.addInitScript(()=>localStorage.setItem('tariklab.language','tr')));
  const page=await stage('page create',()=>context.newPage()),requests=[],workerDiagnostics=[],caseErrors=[],responseSources=new WeakMap();let workerDiagnosticStarted=false;page.setDefaultTimeout(20000);
  page.on('pageerror',e=>caseErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')caseErrors.push(m.text());});
  const pending=new Set();let quietTimer,quietDone;
  clearCaseTimers=()=>{clearTimeout(quietTimer);quietDone=null;};
  const settle=()=>{clearTimeout(quietTimer);if(!pending.size&&quietDone)quietTimer=setTimeout(quietDone,500);};
  context.on('request',request=>{
   pending.add(request);clearTimeout(quietTimer);
   const url=new URL(request.url());
   if(/^https?:$/.test(url.protocol)&&url.origin!==base)caseErrors.push(`Unmetered off-origin request: ${url.href}`);
  });
  context.on('requestfailed',request=>{pending.delete(request);caseErrors.push(`${request.url()}: ${request.failure()?.errorText}`);settle();});
  context.on('response',response=>{responseSources.set(response.request(),response.fromServiceWorker());if(response.status()>=400)caseErrors.push(`HTTP ${response.status()}: ${response.url()}`);});
  context.on('requestfinished',request=>{
   const requestInfo={url:request.url(),serviceWorker:!!request.serviceWorker(),fromServiceWorker:responseSources.get(request)??null};
   requests.push(requestInfo);
   if(!workerDiagnosticStarted&&requestInfo.serviceWorker&&new URL(requestInfo.url).pathname==='/games/hanedanian/sw.js'){
    workerDiagnosticStarted=true;
    workerDiagnostics.push(diagnoseWorkerSizes(request).then(result=>{record('Playwright worker metadata',result.state,{...requestInfo,...result});return result;}));
   }
   pending.delete(request);settle();
  });
  try {
   const start=performance.now();await stage('navigation',()=>page.goto(base+route.href,{waitUntil:'domcontentloaded'}));
   let surface=page;
   if(route.href.startsWith('/oyna/'))surface=await stage('iframe',async()=>{const iframe=page.locator('iframe');await iframe.waitFor();return (await iframe.elementHandle()).contentFrame();});
   await stage('readable surface',()=>surface.waitForFunction(hasReadableBody));
   const firstReadableMs=Math.round(performance.now()-start);
   await stage('networkidle',()=>page.waitForLoadState('networkidle'));
   try {await stage('quiet',()=>new Promise(done=>{quietDone=done;settle();}));}finally {clearCaseTimers();}
   // This control diagnoses the broken Playwright metadata promise, not bytes.
   // Every real HTTP response, including worker bootstrap, is measured below.
   const workerMetadata=await stage('worker metadata control',()=>Promise.all(workerDiagnostics),10000);
   if(pending.size)try {await stage('quiet after metadata control',()=>new Promise(done=>{quietDone=done;settle();}));}finally {clearCaseTimers();}
   const meterAfter=meter.snapshot(),network=meterAfter.records.slice(meterBefore.records.length);
   const transferBytes=meterAfter.responseBytes-meterBefore.responseBytes,requestCount=meterAfter.requestCount-meterBefore.requestCount;
   assert.equal(meterAfter.activeRequests,0,'all HTTP responses must finish before the snapshot');
   assert.deepEqual(meterAfter.errors.slice(meterBefore.errors.length),[],'HTTP meter errors');
   assert.equal(network.length,requestCount,'every network request has a meter record');
   assert.ok(network.every(r=>r.finished&&r.status>=200&&r.status<400),'no incomplete or failed HTTP response may be omitted');
   assert.ok(Number.isSafeInteger(transferBytes)&&transferBytes>0,'the route must have measured response bytes');
   if(route.id==='hanedanian')assert.ok(network.some(r=>new URL(r.url).pathname==='/games/hanedanian/sw.js'),'worker bootstrap must be included in the network measurement');
   const geometry=await stage('geometry',()=>surface.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})));
   assert.ok(geometry.scroll<=geometry.width+1,`${route.id}/${width}: overflow ${JSON.stringify(geometry)}`);
   const gameRequests=requests.filter(r=>/\/games\/|\/vendor\/pixi\/|\/assets\/(?:game-shell|store)-/.test(r.url));
   if(route.id==='portal')assert.deepEqual(gameRequests,[],'portal must not fetch game assets, store or Pixi');
   assert.deepEqual(caseErrors,[],`${route.id}/${width}: console or measurement`);
   rows.push({route:route.id,width,firstReadableMs,transferBytes,requestCount,browserRequestCount:requests.length,pixiBodyBytes:network.filter(r=>/\/vendor\/pixi\//.test(r.url)).reduce((n,r)=>n+r.bodyBytes,0),network,workerMetadata,gameRequests:gameRequests.map(r=>r.url),overflow:geometry.scroll-geometry.width,errors:caseErrors});
   await persist();
   await closeContext();record('case','end');await persist();activeCase=null;
  }catch(error){record('case','error',{error:failure(error),pendingRequests:[...pending].map(r=>r.url()),meter:meter.snapshot(),caseErrors});throw error;}
  finally {clearCaseTimers();}
 }
}catch(error){primaryError=error;errors.push({stage:'measurement',error:failure(error)});}
finally {
 clearCaseTimers();
 await cleanup('partial artifact',persist);
 await cleanup('context cleanup',closeContext);
 try {await cleanup('browser cleanup',()=>stage('browser.close',()=>browser?.close(),15000));}
 finally {await cleanup('meter cleanup',()=>stage('HTTP meter close',()=>meter?.close(),15000));await cleanup('preview cleanup',stopPreview);}
 complete=rows.length===expectedCases&&!primaryError;
 await cleanup('final artifact',persist);
}
if(primaryError)throw primaryError;
if(label==='after'&&!focused){
 const before=JSON.parse(await readFile(resolve(out,'before.json'),'utf8'));
 assert.equal(before.measurement,'http-response-socket-bytes-v1','paired measurements must use the same method');assert.equal(before.complete,true);
 const lines=['# Cold built-route measurements','','Fresh browser contexts, no saves. Both versions use the same local HTTP forwarder: response bytes are the monotonic browser-facing socket.bytesWritten delta, including HTTP headers, encoded bodies and HTTP chunk framing; TCP/TLS overhead is excluded. Network requests count actual forwarder requests; logical browser/SW requests are recorded separately. Worker bootstrap traffic is included; cache hits with no network produce no wire bytes. Payload, status and cache/SW headers are passed through unchanged. Pixi reports encoded response-body bytes separately. These results supersede the incomplete Playwright sizes measurements and are not production HTTPS latency. First readable time ends at the game document (including iframe), through the same extra loopback hop for both versions. Map-opening/action costs are measured separately by wave1-outcome.','', '| Route / width | Before → after HTTP response bytes | Before → after network requests | Before → after readable ms | Pixi response-body bytes at entry |','| --- | ---: | ---: | ---: | ---: |'];
 for(const row of rows){const b=before.rows.find(r=>r.route===row.route&&r.width===row.width);assert.ok(b);lines.push(`| ${row.route} / ${row.width} | ${b.transferBytes} → ${row.transferBytes} | ${b.requestCount} → ${row.requestCount} | ${b.firstReadableMs} → ${row.firstReadableMs} | ${row.pixiBodyBytes} |`);}
 await writeFile(resolve(out,'route-comparison.md'),lines.join('\n')+'\n');
}
console.log(JSON.stringify({label,coverage:focused?'focused':'full',scenarios:rows.length,errors}));
