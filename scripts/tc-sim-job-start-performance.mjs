// Local static HTTP comparison only: no TLS, production CDN or offline claims.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { archiveTcBaseline, verifyTcStaticBuild } from "./tc-sim-job-start-baseline.mjs";
import { createStaticGameServer } from "./static-game-server.mjs";
import { pendingJobStartState } from "./tc-sim-job-start-fixture.mjs";
const out=resolve(process.env.RUNNER_TEMP||"/workspace","screenshots/tc-job-start-outcome/performance");
mkdirSync(out,{recursive:true});
const temporary=mkdtempSync(join(tmpdir(),"tc-outcome-perf-"));
const report={scope:"Local uncompressed static HTTP baseline/candidate, same Chromium process and viewport, separate identically configured clean contexts, HTTP cache disabled, service workers blocked. Not production TLS or offline performance.",metricDefinition:"Continue capture-phase click to visible dashboard content plus two requestAnimationFrame callbacks; not a standardized FMP metric.",status:"RUNNING",cases:[]};
let browser, server;
try {
  report.baseline=archiveTcBaseline(join(temporary,"baseline"));
  report.candidateStaticBytes=verifyTcStaticBuild(resolve(".output/public"));
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:["--no-sandbox"]});
  report.browserVersion=browser.version();
  for(const width of [1440,390,320]) for(const label of ["before","after"]) {
    const root=label==="before"?join(temporary,"baseline/public"):resolve(".output/public");
    server=createStaticGameServer(root);
    await new Promise((done,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",done);});
    const origin=`http://127.0.0.1:${server.address().port}`;
    const context=await browser.newContext({viewport:{width,height:width===1440?900:844},serviceWorkers:"block",reducedMotion:"reduce"});
    try {
      const page=await context.newPage(),errors=[],requests=[];
      const cdp=await context.newCDPSession(page);await cdp.send("Network.enable");await cdp.send("Network.setCacheDisabled",{cacheDisabled:true});
      page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
      page.on("response",r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
      page.on("requestfailed",r=>errors.push(`${r.failure()?.errorText} ${r.url()}`));
      page.on("request",r=>{requests.push(r.url());if(new URL(r.url()).origin!==origin)errors.push(`external request ${r.url()}`);});
      await context.addInitScript(({origin,state})=>{if(location.origin!==origin)return;localStorage.setItem("tariklab::tc-sim:1",JSON.stringify(state));localStorage.setItem("tariklab::tc-sim:active","1");localStorage.setItem("tariklab.language","tr");},{origin,state:pendingJobStartState()});
      await page.goto(origin+"/games/tc-sim/index.html",{waitUntil:"networkidle"});assert.equal(new URL(page.url()).origin,origin);
      await page.locator("#continue-game").waitFor({state:"visible"});
      await page.screenshot({path:join(out,`${label}-${width}-entry.png`)});
      await page.evaluate(()=>{
        document.querySelector("#continue-game").addEventListener("click",()=>{
          const start=performance.now();
          const observer=new MutationObserver(check);
          function check(){const el=document.querySelector(".workspace .workspace-head");if(!el||!el.getClientRects().length)return;const r=el.getBoundingClientRect();if(r.bottom<=0||r.top>=innerHeight)return;observer.disconnect();requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__tcContinueMetric={clickedAt:start,visibleAt:performance.now(),elapsed:performance.now()-start};}));}
          observer.observe(document.querySelector("#app"),{childList:true,subtree:true});check();
        },{once:true,capture:true});
      });
      await page.locator("#continue-game").click();await page.waitForFunction(()=>Boolean(window.__tcContinueMetric));
      await page.screenshot({path:join(out,`${label}-${width}-continued.png`)});
      const metrics=await page.evaluate(()=>({continueRender:window.__tcContinueMetric,paint:performance.getEntriesByType("paint").map(e=>({name:e.name,startTime:e.startTime})),navigation:performance.getEntriesByType("navigation").map(e=>({transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,duration:e.duration})),resources:performance.getEntriesByType("resource").map(e=>({name:e.name,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize})),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,controller:Boolean(navigator.serviceWorker.controller)}));
      assert.ok(metrics.overflow<=0,"No horizontal overflow (reserved native scrollbar space may make the delta negative)");assert.equal(metrics.controller,false);assert.deepEqual(errors,[]);
      const fcp=metrics.paint.find(e=>e.name==="first-contentful-paint")?.startTime;assert.ok(fcp>0,"actual FCP entry required");
      report.cases.push({label,width,status:"PASS",requestCount:requests.length,transferBytes:[...metrics.navigation,...metrics.resources].reduce((n,e)=>n+e.transferSize,0),fcpMs:fcp,continueToVisiblePlusTwoRafMs:metrics.continueRender.elapsed,metrics,requests});
    } finally {await context.close();server.closeAllConnections();await new Promise(done=>server.close(done));server=null;}
  }
  report.comparison=[1440,390,320].map(width=>{const before=report.cases.find(c=>c.width===width&&c.label==="before"),after=report.cases.find(c=>c.width===width&&c.label==="after");return {width,before:{requests:before.requestCount,transferBytes:before.transferBytes,fcpMs:before.fcpMs,continueToVisiblePlusTwoRafMs:before.continueToVisiblePlusTwoRafMs},after:{requests:after.requestCount,transferBytes:after.transferBytes,fcpMs:after.fcpMs,continueToVisiblePlusTwoRafMs:after.continueToVisiblePlusTwoRafMs},delta:{requests:after.requestCount-before.requestCount,transferBytes:after.transferBytes-before.transferBytes,fcpMs:after.fcpMs-before.fcpMs,continueToVisiblePlusTwoRafMs:after.continueToVisiblePlusTwoRafMs-before.continueToVisiblePlusTwoRafMs}};});
  report.status="PASS";
} catch(error){report.status="FAIL";report.error=error.stack||String(error);throw error;}
finally {await browser?.close();if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}rmSync(temporary,{recursive:true,force:true});writeFileSync(join(out,"results.json"),JSON.stringify(report,null,2)+"\n");}
