// Real UI journey: no state setup, engine calls, or fixture imports.
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';
import {createStaticGameServer} from './static-game-server.mjs';
import {openBoardworldTab} from './boardworld-browser-navigation.mjs';

const evidence = resolve(process.env.RUNNER_TEMP || 'work', 'screenshots/boardworld-lw2-city');
mkdirSync(evidence,{recursive:true});
const cities = {
  istanbul:['kadikoy','besiktas','sisli','istanbul:uskudar','istanbul:umraniye','istanbul:fatih','istanbul:beyoglu','istanbul:bakirkoy','istanbul:atasehir','istanbul:maltepe','istanbul:kartal','istanbul:pendik','istanbul:sariyer','istanbul:eyupsultan','istanbul:beylikduzu'],
  ankara:['ankara:cankaya','ankara:altindag','ankara:kecioren','ankara:yenimahalle','ankara:mamak','ankara:etimesgut','ankara:sincan','ankara:golbasi'],
  izmir:['izmir:konak','izmir:karsiyaka','izmir:bornova','izmir:buca','izmir:bayrakli','izmir:balcova','izmir:karabaglar','izmir:gaziemir'],
};
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
async function waitUntilEnabled(id) {
  for(let i=0;i<30;i++){
    await maintain(); await world();
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
  await page.locator('[data-testid="create-game"]').click();
  await page.locator('.event-choices [data-action]:enabled').first().waitFor();
  await clearEvents(); await openBoardworldTab(page,'expansion');
  await page.locator('[data-ui="expand"]').click();
  await page.waitForFunction(()=>window.boardworldInspect?.()?.version===7);
  if(process.env.BOARDWORLD_LIFE_ONLY) {
    await waitUntilEnabled('district:travel:istanbul:uskudar'); await action('district:travel:istanbul:uskudar');
    await waitUntilEnabled('district:visit:istanbul:uskudar:work'); await action('district:visit:istanbul:uskudar:work');
    await waitUntilEnabled('district:apply'); await action('district:apply');
    const firmId=(await inspect()).expansion.districts.job.firmId;
    await waitUntilEnabled('district:visit:istanbul:uskudar:housing'); await action('district:visit:istanbul:uskudar:housing');
    await openBoardworldTab(page,'expansion-finance');
    await action('economy:rent:istanbul:uskudar:room');
    assert.equal((await inspect()).expansion.economy.home,'istanbul:uskudar:room');
    await openBoardworldTab(page,'life');
    assert.equal(await page.locator('[data-life="lease"]').count(),0,'old core lease panel hidden for expansion home');
    assert.ok((await page.locator('.status-sheet').first().innerText()).includes('Üsküdar'),'Life names the actual home');
    assert.ok(await page.locator('[data-tab="expansion-finance"]').count(),'Life links to property options');
    await waitUntilEnabled('district:travel:besiktas'); await action('district:travel:besiktas');
    await openBoardworldTab(page,'life');
    const sleepAway=page.locator('[data-action="sleep"]').first();
    assert.equal(await sleepAway.isDisabled(),true,'sleep is blocked away from the rented home');
    const sleepCard=sleepAway.locator('xpath=ancestor::article[1]');
    const whyDetail=sleepCard.locator('details > summary'); if(await whyDetail.count()) await whyDetail.click();
    const why=await sleepCard.innerText();
    assert.ok(why.includes('Üsküdar'),`sleep gives the real home destination: ${why}`);
    await waitUntilEnabled('district:travel:istanbul:uskudar'); await action('district:travel:istanbul:uskudar');
    await openBoardworldTab(page,'life');
    const beforeSleep=await inspect(); await action('sleep'); const afterSleep=await inspect();
    assert.ok(afterSleep.time>beforeSleep.time && afterSleep.player.energy>beforeSleep.player.energy,'sleep at home advances time and restores energy');
    assert.equal(afterSleep.expansion.districts.job.firmId,firmId,'local job remains intact');
    console.log(JSON.stringify({freshLife:true,lease:'istanbul:uskudar:room',oldLeasePanel:false,sleepAwayBlocked:true,sleepAtHome:true,localJobPreserved:true}));
  } else {
  const visited=[]; let jobDone=false;
  for(const [city,districts] of Object.entries(cities)) {
    if(city!=='istanbul'){const id=`world:move:${city}`;await waitUntilEnabled(id);await action(id);}
    for(const id of districts){
      await world(); const s=await inspect();
      const current=s.expansion.districts?.place?.districtId || (city==='istanbul'?s.location:city==='ankara'?'ankara:cankaya':'izmir:konak');
      if(current!==id){const move=gold.has(current)&&gold.has(id)?`travel:${id}`:`district:travel:${id}`; await waitUntilEnabled(move);await action(move);}
      await world();
      const funds=await inspect();
      if (!gold.has(id) && (!jobDone || funds.cash + funds.bank < 1600)) {
        const work=`district:visit:${id}:work`;
        await waitUntilEnabled(work); await action(work);
        await waitUntilEnabled('district:apply');
        const applyCard=page.locator('[data-action="district:apply"]').first().locator('xpath=ancestor::article[1]');
        const employer=(await applyCard.locator('p').first().innerText()).split(' · ücret ')[0];
        await action('district:apply');
        const jobState=await inspect(); assert.ok(jobState.expansion.districts.job?.firmId,'local job recorded');
        await openBoardworldTab(page,'dashboard');
        const daybook=await page.locator('.daybook').innerText();
        assert.ok(daybook.includes(employer),`daybook names ${employer}`);
        assert.ok(!daybook.includes('İlk fırsatını bul'),'daybook does not prompt for a first job');
        await openBoardworldTab(page,'work');
        assert.ok((await page.locator('.status-sheet').first().innerText()).includes(employer),'career displays current employer');
        await waitUntilEnabled('district:shift'); const beforeShift=await inspect(); await action('district:shift');
        const afterShift=await inspect(); assert.ok(afterShift.bank>beforeShift.bank, 'local employer paid the shift'); jobDone=true;
        await waitUntilEnabled('district:quit'); await action('district:quit');
      }
      await world();
      const venue=gold.has(id)?`visit:${id}-cafe`:`district:visit:${id}:social`;
      await waitUntilEnabled(venue); await action(venue);
      // A venue visit proves physical access only; the next action must be a real meal.
      if (gold.has(id)) {
        await life();
        const mealId=await page.locator('[data-action="soup"]:enabled').count() ? 'soup' : 'eat';
        assert.ok(await page.locator(`[data-action="${mealId}"]:enabled`).count(), `Gold meal available in ${id}`);
        await action(mealId);
      } else {
        await waitUntilEnabled('world:meal'); await action('world:meal');
      }
      visited.push(id);
    }
  }
  assert.equal(new Set(visited).size,31); assert.equal(jobDone,true);
  // Earn the deposit through the local employer, then sign a real lease.
  const work='district:visit:izmir:gaziemir:work';
  await waitUntilEnabled(work); await action(work);
  await waitUntilEnabled('district:apply'); await action('district:apply');
  for(let i=0;(await inspect()).cash+(await inspect()).bank < 8000 && i<20;i++) {
    if ((await inspect()).player.hunger < 45) {
      const social='district:visit:izmir:gaziemir:social';
      await waitUntilEnabled(social); await action(social);
      await waitUntilEnabled('world:meal'); await action('world:meal');
      await waitUntilEnabled(work); await action(work);
    }
    await waitUntilEnabled('district:shift'); await action('district:shift');
  }
  await waitUntilEnabled('district:quit'); await action('district:quit');
  await waitUntilEnabled('district:visit:izmir:gaziemir:housing'); await action('district:visit:izmir:gaziemir:housing');
  const rent='economy:rent:izmir:gaziemir:room';
  for(let i=0;i<24;i++) {
    await openBoardworldTab(page,'expansion-finance');
    if(await page.locator(`[data-action="${rent}"]:enabled`).count()) break;
    await life(); await action('wait:60');
  }
  await action(rent);
  const leased=await inspect();
  assert.equal(leased.expansion.economy.home,'izmir:gaziemir:room','local lease signed');
  const contract=leased.expansion.economy.properties['izmir:gaziemir:room'].lease;
  const rentText=new Intl.NumberFormat('tr-TR').format(contract.rent), dueText=String(contract.dueDay);
  const assertRent = async (selector, includesHome=false) => {
    const body=await page.locator(selector).first().innerText();
    assert.ok(body.includes(rentText),`${selector} displays contractual rent ${rentText}`);
    assert.ok(body.includes(dueText),`${selector} displays due day ${dueText}`);
    if(includesHome) assert.ok(body.includes('Gaziemir'),`${selector} identifies the property`);
  };
  await openBoardworldTab(page,'dashboard'); await assertRent('.obligation-rail'); await assertRent('.daybook');
  await assertRent('.life-overview',true);
  await openBoardworldTab(page,'life'); await assertRent('.status-sheet',true);
  assert.equal(await page.locator('[data-life="lease"]').count(),0,'old core lease panel hidden for expansion home');
  await openBoardworldTab(page,'wallet'); await assertRent('.finance-forecast',true);
  // Visit a district public centre and register for a real course.
  await waitUntilEnabled('district:travel:izmir:balcova'); await action('district:travel:izmir:balcova');
  await waitUntilEnabled('district:visit:izmir:balcova:institution'); await action('district:visit:izmir:balcova:institution');
  await waitUntilEnabled('institution:school:finance'); await action('institution:school:finance');
  assert.equal((await inspect()).expansion.institutions.program.course,'finance','public course registration');
  const before=await inspect(); await page.reload(); await page.waitForFunction(()=>window.boardworldInspect?.()?.version===7);
  assert.deepEqual(await inspect(),before,'journey survives reload');
  for(const language of ['tr','en','pl']){
    await page.locator('[data-game-language]').selectOption(language);
    await world(); assert.equal(await page.locator('.primary-nav [data-tab]').count(),4);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${language}: no mobile overflow`);
    await page.screenshot({path:join(evidence,`${language}.png`)});
  }
  const dashboard=page.locator('.primary-nav [data-tab="dashboard"]');
  await dashboard.focus(); await page.keyboard.press('Enter');
  assert.equal(await dashboard.getAttribute('aria-current'),'page','keyboard activates primary navigation');
  const board=page.locator('.primary-nav [data-tab="board"]');
  await board.focus(); await page.keyboard.press('Enter');
  assert.equal(await board.getAttribute('aria-current'),'page');
  const detail=page.locator('details').filter({has:page.locator('[data-action^="district:travel:"]')}).first();
  if(await detail.getAttribute('open')!==null) await detail.locator(':scope > summary').click();
  const summary=detail.locator(':scope > summary'); await summary.focus(); await page.keyboard.press('Enter');
  assert.notEqual(await detail.getAttribute('open'),null,'keyboard opens district choices');
  await life();
  const waitButton=page.locator('[data-action="wait:60"]:enabled').first();
  const beforeKey=await inspect();
  await page.evaluate(()=>{window.__keyboardDone=null;const done=e=>{if(e.detail?.id==='wait:60'){removeEventListener('boardworld:action-complete',done);window.__keyboardDone=e.detail;}};addEventListener('boardworld:action-complete',done);});
  await waitButton.focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__keyboardDone!==null);
  assert.equal((await page.evaluate(()=>window.__keyboardDone)).saved,true,'keyboard action saved');
  const afterKey=await inspect(); assert.ok(afterKey.revision>beforeKey.revision && afterKey.time>beforeKey.time,'keyboard action changes revision and time');
  assert.deepEqual(errors,[]);
  const report={visited, languages:['tr','en','pl'], reload:true, mobile:true, keyboard:['navigation','disclosure','saved action'], paidShift:jobDone, lease:true, course:true, contractDisplay:["employer/daybook", "employer/career", "rent/dashboard", "rent/daybook", "rent/obligations", "rent/life", "rent/finance"], screenshots:evidence};
  writeFileSync(join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
  }
} finally {await context.close();await browser.close();await new Promise(r=>server.close(r));}
