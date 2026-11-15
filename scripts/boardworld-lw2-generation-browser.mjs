/** Real UI journey: every mutation comes from an existing visible game control.
 * The pure action catalogue helps choose moves; no imported save, clock edit,
 * resolver call, synthetic funds, or fixture is used to advance this life. */
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync,readdirSync,readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {chromium} from "playwright";
import {createStaticGameServer} from "./static-game-server.mjs";
import {openBoardworldTab} from "./boardworld-browser-navigation.mjs";
import {getActions,loadExpansionRuntime} from "../public/games/tc-sim-boardworld/engine.mjs";
await loadExpansionRuntime();
const root=process.argv[2]||"public",out=resolve(process.env.RUNNER_TEMP||"../../work","screenshots/boardworld-lw2-generation");
const runtimeDir=resolve(root,"games/tc-sim-boardworld");
const hashes=()=>Object.fromEntries(readdirSync(runtimeDir).filter(n=>/\.(mjs|css|html|svg)$/.test(n)).sort().map(n=>[n,createHash("sha256").update(readFileSync(resolve(runtimeDir,n))).digest("hex")]));
const runtimeSha256=hashes();
mkdirSync(out,{recursive:true});
const server=createStaticGameServer(root);await new Promise(r=>server.listen(0,"127.0.0.1",r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:"reduce"}),errors=[],trace=[],milestones={};
page.on("pageerror",e=>errors.push(e.message));
const snap=()=>page.evaluate(()=>window.boardworldInspect());
let skipRoutineAt=-1;
async function reveal(control){
  const folds=control.locator('xpath=ancestor::details[not(@open)]');
  for(let i=await folds.count()-1;i>=0;i--)await folds.nth(i).locator(':scope > summary').click();
}
async function choose(action,before){
  const id=action.id,policy=id.startsWith("policy:")&&!id.startsWith("policy:day:"),selector=policy?`[data-policy-field="${id.split(":")[1]}"]`:`[data-action="${id}"]`;
  let button=page.locator(selector).first();
  if(await button.count()) await reveal(button);
  if(!await button.count() || !await button.isVisible()){
    const tab=id.startsWith("family:")?"expansion":
      id.startsWith("systemic:")?"stories":
      /^(world:|district:|underworld:|institution:)/.test(id)?"expansion-world":
      id.startsWith("economy:")?"expansion-finance":
      /^(policy:|flow:|schedule:)/.test(id)?"plan":
      ({travel:"board",life:"life",household:"life",work:"work",education:"study",social:"people",finance:"wallet",business:"enterprise",story:"stories",project:"projects",calendar:"plan",shopping:"bag"})[action.category];
    if(tab){
      const current=page.locator(`.section-nav > [data-tab="${tab}"][aria-current="page"]`);
      if(!await current.count()) await openBoardworldTab(page,tab);
    }
    if(action.category==="social"){
      const contact=id.split(":").find(part=>["mert","ece","selin","cem","derya","emre","aylin","baran","naz","okan","leyla","arda"].includes(part));
      if(contact){const control=page.locator(`.contact[data-npc="${contact}"]`);if(await control.count())await control.click();}
    }
    button=page.locator(selector).first();
  }
  assert.equal(await button.count(),1,`${id} reachable from its real UI panel`);
  await reveal(button);assert.ok(await button.isVisible(),`${id} visible`);assert.ok(await button.isEnabled(),`${id} enabled`);
  // The previous action's saved snapshot is the current state: navigation and
  // opening disclosures only change presentation. Arm before the real click so
  // even a fast IndexedDB commit cannot outrun the completion listener.
  await page.evaluate(expected=>{window.__lw2Ack=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{window.removeEventListener("boardworld:action-complete",done);reject(Error("Action completion timed out"));},30000);
    function done(e){if(e.detail?.id!==expected)return;clearTimeout(timer);window.removeEventListener("boardworld:action-complete",done);resolve(e.detail);}
    window.addEventListener("boardworld:action-complete",done);
  });},id);
  const ack=page.evaluate(()=>window.__lw2Ack).catch(error=>({error:error.message}));
  if(policy)await button.selectOption(id);else await button.click();
  const completion=await ack;assert.equal(completion.saved,true,`${id} durable save: ${completion.error||""}`);
  const after=await snap();assert.ok(after.revision>before.revision,`${id} committed`);
  trace.push({id,from:before.time,to:after.time});
  if(id.startsWith("schedule:run:"))skipRoutineAt=after.time===before.time?after.time:-1;
  if(id==="work"||id==="district:shift")milestones.work??=after.time;
  if(id.startsWith("partner:"))milestones.relationship??=after.time;
  if(id==="family:marry")milestones.marriage??=after.time;
  if(id==="family:adopt")milestones.adoption??=after.time;
  if(/^(lease:renew|rent:|economy:rent:)/.test(id))milestones.housing??=after.time;
  if(id==="family:retire")milestones.retirement??=after.time;
  if(id.startsWith("family:successor:"))milestones.succession=after.time;
  return after;
}
function select(s){
  const available=getActions(s).filter(a=>!a.disabled),pick=id=>available.find(a=>a.id===id);
  const first=(pattern)=>available.find(a=>pattern.test(a.id));
  let a=first(/^family:successor:/)||available.find(a=>a.id.startsWith("event:")&&a.cost===0)||first(/^event:/)||available.find(a=>a.id.startsWith("story:")&&a.cost===0)||first(/^story:/);
  a ||= first(/^systemic:.*:finish$/)||first(/^systemic:.*:adapt$/)||first(/^systemic:.*:decline$/);
  a ||= pick("lease:renew")||pick("policy:meal:frugal")||pick("policy:autoWithdraw:true");
  if(!a&&s.cash<400&&s.bank>0)a=pick("withdraw:1000")||pick("withdraw:all");
  if(!a&&s.player.hunger<45)a=pick("cook")||pick("soup")||pick("eat");
  if(!a&&!milestones.adoption)a=pick("family:adopt");
  if(!a&&!s.job&&!milestones.retirement)a=pick("apply:retail");
  a ||= pick("promote");
  if(!a&&!milestones.marriage){
    a=pick("family:marry")||pick("partner:mert")||pick("date:mert")||pick("talk:mert")||pick("apologize:mert")||pick("call:mert");
  }
  if(!a&&milestones.marriage&&s.expansion.family.arrears&&s.cash+s.bank>2000)a=pick("family:arrears");
  if(!a&&milestones.marriage&&s.expansion.family.reserve<600&&s.cash+s.bank>3000)a=pick("family:reserve");
  if(!a)a=pick("family:retire");
  if(!a&&milestones.marriage&&s.time!==skipRoutineAt)a=pick("schedule:run:7");
  a ||= pick("work")||(s.time%1440>=1080?pick("sleep"):null);
  if(!a&&s.player.health<45)a=pick("doctor")||pick("clinic")||pick("medicine");
  if(!a&&s.time%1440>=1080)a=pick("travel:kadikoy")||pick("walk:kadikoy");
  a ||= pick("rest")||pick("wait:60");
  return a;
}
try{
  await page.goto(`http://127.0.0.1:${server.address().port}/games/tc-sim-boardworld/`);
  await page.locator('#character-name').fill("Yaşam Yolculuğu");
  await page.locator('[name=scenario][value=restart]').check();
  await page.locator('[data-testid=create-game]').click();
  await page.waitForFunction(()=>window.boardworldInspect?.());
  for(let i=0;i<2;i++){const s=await snap(),a=getActions(s).find(a=>!a.disabled&&a.id.startsWith("event:"));if(a)await choose(a,s);}
  await openBoardworldTab(page,"expansion");await page.locator('[data-ui=expand]').click();
  await page.waitForFunction(()=>window.boardworldInspect?.()?.expansion?.livingWorld===2);
  let current=await snap();
  for(let i=0;i<18000&&!milestones.succession;i++){
    const a=select(current);assert.ok(a,`legal next step day${Math.floor(current.time/1440)+1}`);
    current=await choose(a,current);
    if(i%50===0){console.log(JSON.stringify({step:i,day:Math.floor(current.time/1440)+1,last:a.id,milestones}));assert.deepEqual(errors,[]);}
    if(i%250===249){const before=current;await page.reload();await page.waitForFunction(()=>window.boardworldInspect?.()?.expansion);current=await snap();assert.deepEqual(current,before);}
  }
  const state=current;
  assert.ok(milestones.work&&milestones.housing&&milestones.relationship&&milestones.marriage&&milestones.adoption&&milestones.succession,JSON.stringify(milestones));
  assert.ok(state.expansion.family.lastEstate);assert.notEqual(state.expansion.playerId,"player:1");
  // The heir can inherit a pending event. Resolve it through its visible choice
  // before advancing, just as a player must; never assume a free wait is enabled.
  let continued=state;
  for(let i=0;i<20&&continued.time===state.time;i++){
    const legal=getActions(continued).filter(a=>!a.disabled);
    const next=legal.find(a=>a.id.startsWith("event:"))||legal.find(a=>a.id==="wait:60")||select(continued);
    assert.ok(next,"successor has a legal UI continuation");continued=await choose(next,continued);
  }
  assert.ok(continued.time>state.time,"successor continues the shared clock");
  await page.reload();await page.waitForFunction(()=>window.boardworldInspect?.()?.expansion);
  assert.deepEqual(await snap(),continued,"successor continuation reloads exactly");
  await openBoardworldTab(page,"expansion");await page.screenshot({path:resolve(out,"successor.png"),fullPage:true});
  assert.deepEqual(hashes(),runtimeSha256,"runtime unchanged throughout full journey");
  assert.deepEqual(errors,[]);writeFileSync(resolve(out,"result.json"),JSON.stringify({ok:true,method:"fresh character; existing visible UI controls only; read-only state/action inspection",runtimeSha256,milestones,actions:trace.length,trace,playerId:state.expansion.playerId,estate:state.expansion.family.lastEstate},null,2));
  console.log(JSON.stringify({ok:true,milestones,actions:trace.length}));
}catch(error){await page.screenshot({path:resolve(out,"failure.png"),fullPage:true}).catch(()=>{});writeFileSync(resolve(out,"failure.json"),JSON.stringify({error:error.message,errors,milestones,trace,state:await snap().catch(()=>null)},null,2));throw error;}
finally{await browser.close();await new Promise(r=>server.close(r));}
