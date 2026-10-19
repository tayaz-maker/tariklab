import assert from "node:assert/strict";
import { createNewGame } from "../public/games/tc-sim/js/state.js";
import { saveGame } from "../public/games/tc-sim/js/save.js";
import { spendLifestyle } from "../public/games/tc-sim/js/wealth.js";

// Production-shaped saves seed costly scenarios; all purchases/advances below
// go through real controls. Fixtures never enter the production application.
async function loadFixture(page, seed=12345, monthEnd=false) {
  const s=createNewGame({name:"Economic QA",seed});s.finances.balance=200000;
  if(monthEnd){s.time.absoluteWeek=4;s.time.weekOfMonth=4;}
  const data={};const storage={getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=v;},removeItem:k=>{delete data[k];}};
  assert.equal(saveGame(storage,s).ok,true);
  await page.evaluate(values=>{for(const [k,v] of Object.entries(values))localStorage.setItem(k,v);},data);
  await page.reload({waitUntil:"networkidle"});
  const frame=await (await page.locator("iframe").elementHandle()).contentFrame();
  await frame.locator("#continue-game").click();return frame;
}
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("tariklab::tc-sim:1")));
export async function revealDesk(frame, target) {
  const record = await target.evaluate(node => node.closest(".desk-record")?.id);
  if (record) await frame.locator(`[aria-controls="${record}"]`).click();
}
async function act(frame, selector) {
  const target = frame.locator(selector);
  await revealDesk(frame, target);
  await target.click();
}
async function scrollNav(page,frame,screen,attribute) {
  await page.setViewportSize({width:1440,height:900});
  await frame.locator(`.compact-nav [${attribute}="${screen}"]`).click();
  const actual=await frame.evaluate(()=>{
    const owner=document.scrollingElement;owner.scrollTop=1100;
    const nav=document.querySelector(".compact-nav"), r=nav.getBoundingClientRect();
    const active=nav.querySelector('[aria-current="page"]')?.getBoundingClientRect();
    return {scroll:owner.scrollTop,top:r.top,bottom:r.bottom,height:innerHeight,active:active?{top:active.top,bottom:active.bottom}:null,width:document.documentElement.scrollWidth-innerWidth};
  });
  assert.ok(actual.scroll>500,`long-content scroll not exercised: ${JSON.stringify(actual)}`);
  assert.ok(actual.top>=-1&&actual.bottom<=actual.height+1,`sticky navigation left viewport: ${JSON.stringify(actual)}`);
  assert.ok(actual.active.top>=0&&actual.active.bottom<=actual.height);
  assert.ok(actual.width<=1);
  await frame.evaluate(()=>{document.scrollingElement.scrollTop=0;});
}
export async function correctionFlows(page,surface,id,lang,out) {
  if(!["tc-sim","tc-sim-devlet"].includes(id))return;
  await page.setViewportSize({width:1440,height:900});
  if(id==="tc-sim"){
    let frame=await loadFixture(page);
    await scrollNav(page,frame,"market","data-view");
    await act(frame, '[data-wealth-action="spend"][data-wealth-value="coffee"]');
    await frame.locator('.compact-nav [data-view="emlak"]').click();
    await act(frame, '[data-wealth-action="spend"][data-wealth-value="laptop"]');
    let state=await saved(page);assert.equal(state.finances.balance,177820);assert.equal(state.wealth.durables[0].id,"computer");
    assert.equal(await frame.locator('[data-wealth-action="spend"][data-wealth-value="laptop"]').isDisabled(),true);
    await page.screenshot({path:`${out}/emlak-${lang}-effects.png`,fullPage:false});
    for(const winning of [false,true]){
      let seed;
      for(let candidate=1;candidate<1000;candidate++){
        const s=createNewGame({seed:candidate*7919});s.finances.balance=200000;
        const r=spendLifestyle(s,"betting");if((r.effects.cash>0)===winning){seed=candidate*7919;break;}
      }
      assert.ok(seed);frame=await loadFixture(page,seed);
      await frame.locator('.compact-nav [data-view="market"]').click();
      await frame.locator('[data-market-shelf="gece"]').click();
      await act(frame, '[data-wealth-action="spend"][data-wealth-value="betting"]');
      state=await saved(page);assert.equal(state.finances.balance>200000,winning);
      const cash=state.finances.balance;
      await page.reload({waitUntil:"networkidle"});frame=await (await page.locator("iframe").elementHandle()).contentFrame();
      await frame.locator("#continue-game").click();await frame.locator('.compact-nav [data-view="market"]').click();
      await frame.locator('[data-market-shelf="gece"]').click();
      assert.equal(await frame.locator('[data-wealth-action="spend"][data-wealth-value="betting"]').isDisabled(),true);
      assert.equal((await saved(page)).finances.balance,cash);
    }
    frame=await loadFixture(page,12345,true);await frame.locator('.compact-nav [data-view="banks"]').click();
    await act(frame, '[data-wealth-action="invest-buy"][data-wealth-value="gold"]');
    assert.equal((await saved(page)).wealth.investments[0].basis,5050);
    await frame.locator("#advance-week").click();
    if(await frame.locator('.event-choice:enabled').count())await frame.locator('.event-choice:enabled').first().click();
    state=await saved(page);assert.notEqual(state.wealth.investments[0].value,5000);
    assert.ok(await frame.locator(".investment-pl").count());
    // The monthly loss can leave less than the standard 5,000 sale ticket.
    // Add another tranche next week through the real buy control, then sell
    // on the following week so proportional basis is exercised in the UI.
    await act(frame, '[data-wealth-action="invest-buy"][data-wealth-value="gold"]');
    await frame.locator("#advance-week").click();
    if(await frame.locator('.event-choice:enabled').count())await frame.locator('.event-choice:enabled').first().click();
    await act(frame, '[data-wealth-action="invest-sell"][data-wealth-value="gold"]');
    state=await saved(page);assert.ok(state.finances.ledger.some(r=>/Gerçekleşmiş|Realized/.test(r.reason)));
    await frame.locator("#advance-week").click();
    if(await frame.locator('.event-choice:enabled').count())await frame.locator('.event-choice:enabled').first().click();
    await act(frame, '[data-wealth-action="invest-sell-all"][data-wealth-value="gold"]');
    assert.equal((await saved(page)).wealth.investments.length,0);
    await page.screenshot({path:`${out}/finance-${lang}-pl.png`,fullPage:false});
    return;
  }
  await scrollNav(page,surface,"policy","data-screen");
  const key="tariklab.nextwave.tc-sim-devlet.slot1";
  const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  const original=await read();
  for(const destination of ["home","foreign","regions","economy","institutions","society","files","history","year","period-file"]){
    await surface.locator(`.compact-nav [data-screen="${destination}"]`).click();
    const text=await surface.locator(".state-center").innerText();assert.doesNotMatch(text,/(?:^|\n)(?:nato|gulf|ir|gr|cy)(?:\n|$)|Isı \d/);
    const info=surface.locator(".metric-help summary");if(await info.count()){await info.first().click();await info.first().click();}
  }
  const after=await read();assert.deepEqual(after,original, "Navigation must not write even the UI save fields");
  await surface.locator('.compact-nav [data-screen="policy"]').click();
  const buttons=surface.locator("[data-policy]");assert.equal(await buttons.count(),48);
  await revealDesk(surface,buttons.nth(0));await buttons.nth(0).click();await page.waitForTimeout(400);await revealDesk(surface,buttons.nth(1));await buttons.nth(1).click();
  assert.equal(await buttons.nth(2).isDisabled(),true);assert.equal((await read()).flags.decisionsRemaining,0);
  await surface.locator('.compact-nav [data-screen="regions"]').click();
  const turn=(await read()).time.turn;await page.waitForTimeout(400);await surface.locator("#advance").click();
  assert.equal((await read()).time.turn,turn+1);
  assert.equal(await surface.locator('.compact-nav [data-screen="home"]').getAttribute("aria-current"), "page");
  await surface.locator('.compact-nav [data-screen="home"]').click();
  assert.ok((await surface.locator(".action-feedback").innerText()).includes(lang==="en"?"Month-end report":"Ay sonu raporu"));
  assert.ok(await surface.locator(".state-head h1").evaluate(n=>parseFloat(getComputedStyle(n).fontSize)<=42));
  await page.screenshot({path:`${out}/devlet-${lang}-report.png`,fullPage:false});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:`${out}/devlet-${lang}-report-mobile.png`,fullPage:false});
}
