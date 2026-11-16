/** Native IndexedDB/Web Locks compatibility probe. Prepared saves, not a journey. */
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {chromium} from "playwright";
import {createStaticGameServer} from "./static-game-server.mjs";
const released=process.env.BOARDWORLD_LEGACY_REFERENCE || "2b1ede2be7466348e3933eba26b83a3831241bce";
const world2=released==="d2c1810da439dd831fff07992c1c278788a64a4c";
const foundation=released==="51552c6197cafe744c5084925f13541a1a0aacf2";
assert.ok(foundation || world2 || released==="2b1ede2be7466348e3933eba26b83a3831241bce");
const dir=mkdtempSync(join(tmpdir(),"boardworld-old-v7-browser-"));
const archive=spawnSync("git",["archive",released,"public/games/tc-sim-boardworld"],{maxBuffer:8e6});
assert.equal(archive.status,0,archive.stderr?.toString());
assert.equal(spawnSync("tar",["-x","-C",dir],{input:archive.stdout}).status,0);
const server=createStaticGameServer(process.argv[2]||"public");await new Promise(r=>server.listen(0,"127.0.0.1",r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const context=await browser.newContext(),old=await context.newPage(),current=await context.newPage();
const origin=`http://127.0.0.1:${server.address().port}`;
try{
  await context.route(origin+"/released/**",async route=>{
    const file=new URL(route.request().url()).pathname.slice("/released/".length)||"index.html";
    assert.ok(/^[a-zA-Z0-9_.-]+$/.test(file));
    await route.fulfill({body:readFileSync(join(dir,"public/games/tc-sim-boardworld",file)),contentType:file.endsWith("mjs")?"text/javascript":file.endsWith("css")?"text/css":"text/html"});
  });
  await old.goto(origin+"/released/index.html");
  await old.locator("#character-name").waitFor();
  const initial=await old.evaluate(async(foundation)=>{
    const engine=await import("./engine.mjs"),io=await import("./persistence.mjs");
    await engine.loadExpansionRuntime();
    const setup=foundation?{startingDistrict:"ankara:yenimahalle",lifePath:"businessperson"}:{};
    let state=engine.createGame({seed:49,expansion:true,...setup});
    const journey=foundation?["district:visit:ankara:yenimahalle:work"]:["world:move:ankara","district:visit:ankara:kizilay:work"];
    if(engine.getActions(state).some(({id})=>id==="event:welcome:work")) journey.unshift("event:welcome:work");
    for(const id of journey){const r=engine.resolveAction(state,id);if(!r.ok)throw Error(`${id}: ${r.message}`);state=r.state;}
    const loaded=await io.loadExpansionLocked(),saved=await io.saveExpansionLocked(state,undefined,loaded.token);
    if(!saved.ok)throw Error(saved.message);
    window.oldState=state;window.oldToken=saved.token;
    return {state,bytes:io.exportGame(state)};
  },foundation);
  await current.goto(origin+"/games/tc-sim-boardworld/index.html");
  await current.waitForFunction(()=>window.boardworldInspect?.()?.expansion?.livingWorld===2);
  const migrated=await current.evaluate(()=>window.boardworldInspect());
  assert.equal(migrated.cash,initial.state.cash);assert.equal(migrated.bank,initial.state.bank);
  const canonical=await current.evaluate(async(foundation)=>{
    const engine=await import("./engine.mjs"),io=await import("./persistence.mjs");
    const loaded=await io.loadExpansionLocked();
    const resolved=engine.resolveAction(loaded.state,foundation?"business:start:supplier":"wait:15");
    if(!resolved.ok)throw Error(resolved.message);
    const state=resolved.state;
    const saved=await io.saveExpansionLocked(state,undefined,loaded.token);if(!saved.ok)throw Error(saved.message);
    return {state,bytes:io.exportGame(state),key:saved.token.key};
  },foundation);
  assert.equal(canonical.key,foundation?"tariklab.boardworld.v7.living-depth":"tariklab.boardworld.v7.living-world-3");
  const stale=await old.evaluate(async()=>{const io=await import("./persistence.mjs");return io.saveExpansionLocked(window.oldState,undefined,window.oldToken);});
  assert.equal(stale.conflict,true);
  await old.reload();await old.waitForFunction(()=>window.boardworldInspect?.()?.version===7);
  assert.equal(await old.evaluate(()=>window.boardworldInspect().expansion.livingWorld),world2||foundation?2:undefined);
  const oldWrite=await old.evaluate(async()=>{
    const engine=await import("./engine.mjs"),io=await import("./persistence.mjs"),loaded=await io.loadExpansionLocked();
    const state=engine.resolveAction(loaded.state,"wait:15").state;
    return io.saveExpansionLocked(state,undefined,loaded.token);
  });
  assert.equal(oldWrite.ok,true);assert.equal(oldWrite.token.key,foundation?"tariklab.boardworld.v7.living-world-3":world2?"tariklab.boardworld.v7.living-world-2":"tariklab.boardworld.v7.living");
  await current.reload();await current.waitForFunction(()=>window.boardworldInspect?.()?.expansion?.livingWorld===2);
  assert.deepEqual(await current.evaluate(()=>window.boardworldInspect()),canonical.state);
  const slots=await current.evaluate(async()=>{
    const request=indexedDB.open("tariklab.boardworld.v6.transactions",1);
    const db=await new Promise((r,j)=>{request.onsuccess=()=>r(request.result);request.onerror=()=>j(request.error);});
    const tx=db.transaction("state"),read=tx.objectStore("state").get("head");
    const head=await new Promise((r,j)=>{read.onsuccess=()=>r(read.result);read.onerror=()=>j(read.error);});db.close();return head.slots;
  });
  const stored=new Map(slots);assert.equal(stored.get(canonical.key),canonical.bytes);
  assert.equal(stored.get(`${canonical.key}.backup`),initial.bytes);
  if(foundation) assert.equal(stored.get(oldWrite.token.key),oldWrite.token.primary);
  console.log(JSON.stringify({ok:true,reference:released,nativeIndexedDB:true,nativeWebLocks:true,staleRejected:true,refreshedOldBranchPreservesCanonical:true,exactOriginalBackup:true,method:"prepared save compatibility probe"}));
}finally{await browser.close();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
