// Real UI journey: no state setup, engine calls, or fixture imports.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';
import {createStaticGameServer} from './static-game-server.mjs';
import {openBoardworldTab} from './boardworld-browser-navigation.mjs';

const evidence = resolve(process.env.RUNNER_TEMP || 'work', 'screenshots/boardworld-ds3-stories');
mkdirSync(evidence,{recursive:true});
const gold = new Set(['kadikoy','besiktas','sisli']);
const server = createStaticGameServer(process.argv[2] || 'public');
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({headless:true, executablePath:process.env.BOARDWORLD_CHROME || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const context = await browser.newContext({viewport:{width:390,height:844}});
const page = await context.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const inspect=()=>page.evaluate(()=>window.boardworldInspect());
async function action(id) {
  const button=page.locator(`[data-action="${id}"]`).first();
  assert.equal(await button.count(),1,`action is rendered: ${id}`);
  const ancestors=button.locator('xpath=ancestor::details');
  for (let i=await ancestors.count()-1;i>=0;i--) {
    const d=ancestors.nth(i); if (await d.getAttribute('open')===null) await d.locator(':scope > summary').click();
  }
  assert.equal(await button.isEnabled(),true,`${id}: ${await button.locator('xpath=ancestor::article[1]').innerText().catch(()=> '')}`);
  await page.evaluate(expected=>{window.__journeyDone=null; const done=e=>{if(e.detail?.id===expected){removeEventListener('boardworld:action-complete',done);window.__journeyDone=e.detail;}}; addEventListener('boardworld:action-complete',done);},id);
  await button.click();
  await page.waitForFunction(()=>window.__journeyDone!==null);
  assert.equal((await page.evaluate(()=>window.__journeyDone)).saved,true,`saved ${id}`);
}
async function clearEvents() {
  for(let i=0;i<50;i++) {
    const button=page.locator('.event-choices [data-action]:enabled').first();
    if(!await button.count()) return;
    await action(await button.getAttribute('data-action'));
  }
  throw Error('Event queue did not clear');
}
async function world(){await clearEvents(); await openBoardworldTab(page,'expansion-world');}
async function life(){await clearEvents(); await openBoardworldTab(page,'life');}
async function maintain() {
  const s=await inspect();
  const place=s.expansion.districts?.place?.districtId || (s.expansion.world.region==='istanbul'?s.location:null);
  if(s.player.energy<40){
    if(gold.has(place)){await life(); if(await page.locator('[data-action="rest"]:enabled').count()) await action('rest');}
    else {await world(); if(await page.locator('[data-action="world:rest"]:enabled').count()) await action('world:rest');}
  }
  if(s.player.hunger<35 && gold.has(place)){await life(); if(await page.locator('[data-action="soup"]:enabled').count()) await action('soup'); else if(await page.locator('[data-action="eat"]:enabled').count()) await action('eat');}
}
async function selectMapDestination(page, id) {
  const cityHub={istanbul:'kadikoy',ankara:'ankara:cankaya',izmir:'izmir:konak'};
  const target=id.startsWith('world:move:') ? cityHub[id.slice('world:move:'.length)] :
    id.startsWith('district:travel:') ? id.slice('district:travel:'.length) :
    id.startsWith('travel:') ? id.slice('travel:'.length) : null;
  if (target) {
    const node=page.locator(`[data-world-district="${target}"]`).first();
    assert.ok(await node.count(),`map exposes ${target}`);
    await node.click();
  }
}
async function waitUntilEnabled(id) {
  for(let i=0;i<30;i++){
    await maintain(); await world();
    await selectMapDestination(page,id);
    const b=page.locator(`[data-action="${id}"]`).first();
    if(await b.count() && await b.isEnabled()) return;
    await life();
    const wait=page.locator('[data-action="wait:60"]:enabled').first();
    assert.ok(await wait.count(),`cannot wait for ${id}`);
    await action('wait:60');
  }
  const b=page.locator(`[data-action="${id}"]`).first();
  throw Error(`Never available: ${id} / ${await b.locator("xpath=ancestor::article[1]").innerText().catch(()=>"missing")} / ${JSON.stringify(((s)=>({time:s.time,player:s.player,cash:s.cash,bank:s.bank,place:s.expansion.districts?.place}))(await inspect()))}`);
}
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/games/tc-sim-boardworld/index.html`);
  await page.locator('#character-name').fill('Deniz Yolcu');
  await page.locator('#create-form details > summary').click();
  await page.locator('[name=lifePath][value="social-climber"]').check();
  await page.locator('[data-testid="create-game"]').click();
  await page.waitForFunction(() => window.boardworldInspect?.()?.version === 7);
  assert.equal((await inspect()).expansion.lifePath.active,'social-climber');
  await clearEvents(); await openBoardworldTab(page,'expansion');
  await page.waitForFunction(()=>window.boardworldInspect?.()?.version===7);
  await waitUntilEnabled('world:move:ankara'); await action('world:move:ankara');
  await waitUntilEnabled('district:visit:ankara:kizilay:social'); await action('district:visit:ankara:kizilay:social');
  const meet='district:meet:resident:ankara:0'; await waitUntilEnabled(meet); await action(meet);
  await world();
  const story=page.locator('details').filter({has:page.locator('[data-action="story:help:resident:ankara:0"]')}).last();
  assert.ok(await story.count());
  for(const language of ['tr','en','pl']) {
    await page.locator('[data-game-language]').selectOption(language);
    await world();
    const detail=page.locator('details').filter({has:page.locator('[data-action="story:help:resident:ankara:0"]')}).last();
    if(await detail.getAttribute('open')===null) await detail.locator(':scope > summary').click();
    const text=await detail.innerText();
    assert.ok(text.includes({tr:'Komşuya destek ol',en:'Help your neighbour',pl:'Pomóż sąsiadowi'}[language]),text);
    assert.ok(text.includes({tr:'hane kasasına 100 TL',en:'100 TL to your neighbour’s household',pl:'100 TL gospodarstwu domowemu'}[language]),text);
    assert.match(await detail.locator('[data-action="story:help:resident:ankara:0"]').locator('xpath=ancestor::article[1]').innerText(), /100/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:join(evidence,`${language}.png`)});
  }
  const beforeHelp=await inspect(), resident='resident:ankara:0';
  await action('story:help:resident:ankara:0');
  const result=await inspect();
  assert.equal(result.time-beforeHelp.time,60);
  assert.equal(beforeHelp.cash+beforeHelp.bank-result.cash-result.bank,100);
  assert.equal(result.expansion.economy.residents[resident].cash-beforeHelp.expansion.economy.residents[resident].cash,100);
  assert.match(await page.locator('.outcome-strip strong').textContent(), /100 TL trafiło do gospodarstwa/);
  assert.equal(result.expansion.stories.arcs[0].status,'helped');
  assert.equal(result.expansion.districts.contacts['resident:ankara:0'].score,15);
  await page.reload(); await page.waitForFunction(()=>window.boardworldInspect?.()?.expansion?.stories?.arcs?.[0]?.status==='helped');
  assert.deepEqual(await inspect(),result);
  const referral='story:referral:resident:ankara:0';
  await waitUntilEnabled(referral);
  const beforeReferral=await inspect();
  await action(referral);
  const afterReferral=await inspect();
  assert.ok(afterReferral.player.skills.knowledge>beforeReferral.player.skills.knowledge,'trusted contact shares work knowledge');
  assert.equal(afterReferral.expansion.stories.arcs[0].supportCount,1,'referral is remembered');
  await page.reload(); await page.waitForFunction(()=>window.boardworldInspect?.()?.expansion?.stories?.arcs?.[0]?.supportCount===1);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({story:'helped',referral:true,savedAfterReload:true, languages:['tr','en','pl'], mobile:true, screenshots:evidence}));
} finally { await browser.close(); await new Promise(r=>server.close(r)); }
