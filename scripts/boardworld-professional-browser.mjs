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
const root=process.argv[2]||"public",out=resolve(process.env.RUNNER_TEMP||"../../work","screenshots/boardworld-professional");
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
  trace.push({id,from:before.time,to:after.time,bankChange:after.bank-before.bank});
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

function select(s) {
 const a=getActions(s).filter(x=>!x.disabled), pick=(...ids)=>ids.map(id=>a.find(x=>x.id===id)).find(Boolean);
 if(s.pendingEvents.length) return a.find(x=>x.id.startsWith("event:"));
 if(!Object.hasOwn(s.expansion.lifePath.completed,"professional")) return pick("practice:knowledge");
 const day=Math.floor(s.time/1440)+1, minute=s.time%1440, p=s.player, v=s.expansion.districts?.place?.venueId;
 const local="district:visit:ankara:altindag:";
 if(p.hunger<53) { const meal=pick("world:meal","cook","snack"); if(meal)return meal; if(v!==local+"social") {const visit=pick(local+"social");if(visit)return visit;} }
 if(p.energy<38 || (p.energy<85 && (minute<60||minute>1320))) {const rest=pick("world:rest","rest","sleep");if(rest)return rest;}
 const qualified=s.expansion.institutions.qualifications.some(q=>q.course==="teaching");
 if(!qualified && (!s.expansion.institutions.program || s.expansion.institutions.program.lastStudyDay<day) && minute>=480 && minute<900) {
   const school=pick("institution:study","institution:school:teaching");if(school)return school;
   if(v!=="ankara:altindag:institution") {const visit=pick(local+"institution");if(visit)return visit;}
 }
 if(qualified) {
   if(v!=="ankara:altindag:work" && minute<1020 && p.hunger>=38) {const visit=pick(local+"work");if(visit)return visit;}
   const work=pick("district:apply:training","district:shift");if(work)return work;
 }
 return pick("wait:60","wait:15","world:rest","sleep");
}
try {
 await page.goto(`http://127.0.0.1:${server.address().port}/games/tc-sim-boardworld/`);
 await page.locator("#character-name").fill("Meslek Yolculuğu");
 await page.locator("#create-form details > summary").click();
 await page.locator("select[name=scenario]").selectOption("graduate");
 await page.locator("[name=startCity]").selectOption("ankara");
 await page.locator("[name=startingDistrict]").selectOption("ankara:altindag");
 await page.locator('[name=lifePath][value="professional"]').check();
 await page.locator("[data-testid=create-game]").click();
 await page.waitForFunction(()=>window.boardworldInspect?.()?.expansion);
 let s=await snap();
 for(let i=0;i<500 && (s.expansion.districts?.job?.shifts||0)<6;i++) {
   const a=select(s);assert.ok(a,`no legal action day ${Math.floor(s.time/1440)+1}`);
   s=await choose(a,s);if(i%20===0)console.log(JSON.stringify({i,day:Math.floor(s.time/1440)+1,id:a.id,job:s.expansion.districts?.job}));
 }
 assert.ok(s.expansion.institutions.qualifications.some(q=>q.course==="teaching"));
 assert.equal(s.expansion.districts.job?.role,"training");
 assert.ok(s.expansion.districts.job.shifts>=6);
 const wages=trace.filter(x=>x.id==="district:shift").map(x=>x.bankChange);
 assert.ok(wages.length>=6 && wages.at(-1)>wages[0], `earned progression: ${wages}`);
 const saved=s;await page.reload();await page.waitForFunction(()=>window.boardworldInspect?.()?.expansion);assert.deepEqual(await snap(),saved);
 assert.deepEqual(errors,[]);
 assert.deepEqual(hashes(),runtimeSha256,"runtime unchanged during the journey");
 await page.screenshot({path:resolve(out,"professional.png"),fullPage:true});
 const report={ok:true,method:"fresh character; visible UI actions; read-only action catalogue",runtimeSha256,actions:trace.length,trace,job:s.expansion.districts.job,qualified:true,wages,reload:true};
 writeFileSync(resolve(out,"result.json"),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,trace:undefined,runtimeSha256:undefined}));
} finally {await browser.close();await new Promise(r=>server.close(r));}
