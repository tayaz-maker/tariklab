import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createStaticGameServer } from "./static-game-server.mjs";
import { readyJobStartState } from "./tc-sim-job-start-fixture.mjs";
import { captureDashboardLayout, assertReadableDashboardLayout, summarizeLayoutEntryCost } from "./tc-sim-job-start-layout.mjs";
export const TC_LAYOUT_BASELINE="539df6ee8cd3fe1e56b4a7833bffcc8953765488";
export const TC_LAYOUT_STYLE_SHA256="134497f6c9dde56e192bfdd5fcb7a41f4b34a0c8d6760bce5324ca8f8fe90b39";

// Run only against a disposable loopback server. Keep candidate HTML/JS/data
// identical and swap only the exact prior stylesheet to isolate this CSS fault.
export async function provePreviousDashboardStyles(browser,builtRoot,out) {
  const oldCss=execFileSync("git",["show",`${TC_LAYOUT_BASELINE}:public/games/tc-sim/styles.css`],{stdio:["ignore","pipe","pipe"]});
  const cssSHA256=createHash("sha256").update(oldCss).digest("hex");
  assert.equal(cssSHA256,TC_LAYOUT_STYLE_SHA256,"exact prior stylesheet required");
  const directory=await mkdtemp(join(tmpdir(),"tc-dashboard-css-"));
  let server,context;
  const evidence={baseline:TC_LAYOUT_BASELINE,cssSHA256,scope:"Local CSS-only counterfactual: current built HTML/JS/data with exact previous styles; same Chromium process as candidate. No production writes.",status:"RUNNING"};
  try {
    for(const path of ["games/tc-sim","games/shared","i18n","favicon.ico"])await cp(resolve(builtRoot,path),join(directory,path),{recursive:true});
    await writeFile(join(directory,"games/tc-sim/styles.css"),oldCss);
    server=createStaticGameServer(directory);
    await new Promise((done,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",done);});
    const origin=`http://127.0.0.1:${server.address().port}`;
    context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:"block",reducedMotion:"no-preference"});
    const page=await context.newPage(),errors=[];
    page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
    page.on("requestfailed",r=>errors.push(`${r.failure()?.errorText} ${r.url()}`));
    page.on("response",r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    page.on("request",r=>{if(new URL(r.url()).origin!==origin)errors.push(`external request ${r.url()}`);});
    await context.addInitScript(({origin,state})=>{if(location.origin!==origin)return;localStorage.setItem("tariklab::tc-sim:1",JSON.stringify(state));localStorage.setItem("tariklab::tc-sim:active","1");localStorage.setItem("tariklab.language","tr");},{origin,state:readyJobStartState()});
    await page.goto(origin+"/games/tc-sim/index.html",{waitUntil:"networkidle"});assert.equal(new URL(page.url()).origin,origin);
    evidence.coldEntry=await page.evaluate(()=>({navigation:performance.getEntriesByType("navigation").map(r=>({duration:r.duration,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize})),resources:performance.getEntriesByType("resource").map(r=>({name:r.name,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize}))}));
    evidence.entryCost=summarizeLayoutEntryCost(evidence.coldEntry);
    await page.locator("#continue-game").click();
    await page.locator('[data-event-choice="start"]').click();
    evidence.dom=await captureDashboardLayout(page);
    await page.screenshot({path:join(out,"layout-baseline-1440.png"),fullPage:true});
    assert.deepEqual(errors,[]);
    assert.ok(evidence.dom?.titles.some(t=>t.width<t.fontSize*4&&t.lineCount>3),"old CSS must reproduce actual narrow multi-line text, not just a source-string difference");
    assert.throws(()=>assertReadableDashboardLayout(evidence.dom));
    evidence.status="EXPECTED_READABILITY_FAILURE";
    return evidence;
  } catch(error){evidence.status="FAIL";evidence.error=error.stack||String(error);throw error;}
  finally {await context?.close();if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}await rm(directory,{recursive:true,force:true});await writeFile(join(out,"layout-baseline.json"),JSON.stringify(evidence,null,2)+"\n");}
}
