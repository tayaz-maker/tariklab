/** Player acceptance: every state change is made through the actual browser UI. */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createStaticGameServer } from './static-game-server.mjs';
import { openBoardworldTab } from './boardworld-browser-navigation.mjs';
import { DISTRICTS, LOCATIONS } from '../public/games/tc-sim-boardworld/expansion-geography.mjs';

let server, browser, base;
before(async () => {
  server = createStaticGameServer(process.env.BOARDWORLD_ASSETS || 'public');
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  base = `http://127.0.0.1:${server.address().port}/games/tc-sim-boardworld/`;
  browser = await chromium.launch({headless:true, executablePath:process.env.BOARDWORLD_CHROME || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined});
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });
const inspect = page => page.evaluate(() => window.boardworldInspect());
async function setup({ district='ankara:mamak', path='ordinary', language='tr', width=1280 }={}) {
  const context = await browser.newContext({viewport:{width,height:844}}), page = await context.newPage(), errors=[];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, {waitUntil:'networkidle'});
  if (language !== 'tr') {
    await page.locator('[data-game-language]').selectOption(language);
    await page.waitForFunction(lang => document.documentElement.lang === lang, language);
  }
  const city = DISTRICTS.find(d=>d.id===district).cityId;
  await page.locator('[name=startCity]').selectOption(city);
  await page.locator('[name=startingDistrict]').selectOption(district);
  await page.locator(`[name=lifePath][value="${path}"]`).check();
  await page.locator('[data-testid=create-game]').click();
  await page.locator('.world-map').waitFor({timeout:30000});
  return {context,page,errors};
}
async function action(page,id) {
  const before = await inspect(page);
  const button=page.locator(`[data-action="${id}"]:visible`).first();
  assert.ok(await button.count(), `Action ${id} must be available in the player interface`);
  assert.ok(await button.isEnabled(), `Action ${id} must be enabled`);
  await page.evaluate(() => { window.__journeyCompletion = new Promise(resolve => window.addEventListener('boardworld:action-complete', event => resolve(event.detail), {once:true})); });
  await button.click();
  const result=await page.evaluate(() => window.__journeyCompletion);
  assert.ok(result?.ok && result.saved,`${id}: completed and saved`);
  assert.ok((await inspect(page)).revision>before.revision,`${id}: state advanced`);
  return inspect(page);
}
async function saveAndReload(page) {
  const before=await inspect(page);
  await page.evaluate(() => { window.__journeySave = new Promise(resolve => {
    const notice=document.querySelector('#notice');
    const observer=new MutationObserver(() => { observer.disconnect(); resolve(); });
    observer.observe(notice,{childList:true,characterData:true,subtree:true});
  }); });
  await page.locator('[data-ui=save]').first().click();
  await page.evaluate(() => window.__journeySave);
  await page.reload({waitUntil:'networkidle'});
  await page.locator('.primary-nav').waitFor();
  const after=await inspect(page);
  assert.equal(after.revision,before.revision,'reload restores saved revision');
  assert.deepEqual(after.expansion.districts.place,before.expansion.districts.place,'reload restores exact place');
  return after;
}

test('all 31 districts support fresh starts, housing, work, transport and reload', {timeout:360000}, async () => {
  assert.equal(DISTRICTS.length,31);
  for (const district of DISTRICTS) {
    const {context,page,errors}=await setup({district:district.id});
    try {
      const initial=await inspect(page);
      assert.equal(initial.time,480,district.id);
      assert.equal(initial.expansion.districts.place?.districtId ?? initial.location,district.id,district.id);
      const home=initial.expansion.economy.home;
      assert.ok(home,`${district.id}: housing`);
      assert.ok(initial.expansion.economy.properties[home]?.lease?.rent>0,`${district.id}: valid lease`);
      assert.equal(initial.expansion.lifePath.active,'ordinary');
      assert.ok((await page.locator('.world-map').innerText()).includes(district.name),district.id);
      assert.ok(await page.locator('.world-inspector li').count(),`${district.id}: visible venues`);
      await saveAndReload(page);
      await openBoardworldTab(page,'board');
      const venue=LOCATIONS.find(v=>v.districtId===district.id && v.kind==='work');
      assert.ok(venue,`${district.id}: work venue`);
      const gold=['kadikoy','besiktas','sisli'].includes(district.id);
      await action(page,`${gold?'visit':'district:visit'}:${venue.id}`);
      await action(page,'district:apply');
      const beforeShift=await inspect(page);
      await action(page,'district:shift');
      assert.ok((await inspect(page)).bank>beforeShift.bank,`${district.id}: wages`);
      const destination=DISTRICTS.find(d=>d.cityId===district.cityId && d.id!==district.id);
      await page.locator(`[data-world-district="${destination.id}"]`).first().click();
      const travel=page.locator('.world-inspector [data-action]:visible:enabled').first();
      assert.ok(await travel.count(),`${district.id}: transport to ${destination.id}`);
      const travelId=await travel.getAttribute('data-action');
      const beforeTravel=await inspect(page);
      await action(page,travelId);
      const arrived=await inspect(page);
      assert.equal(arrived.expansion.districts.place?.districtId ?? arrived.location,destination.id,district.id);
      assert.ok(arrived.time>beforeTravel.time,`${district.id}: travel time`);
      assert.ok(arrived.cash+arrived.bank<beforeTravel.cash+beforeTravel.bank,`${district.id}: travel fare`);
      await saveAndReload(page);
      assert.deepEqual(errors,[],district.id);
    } finally {await context.close();}
  }
});

test('world map exposes all districts at desktop and mobile in TR, EN and PL', {timeout:120000}, async () => {
  const objectives=new Map();
  for (const language of ['tr','en','pl']) for (const width of [1280,390]) {
    const {context,page,errors}=await setup({language,width});
    try {
      assert.equal(await page.locator('html').getAttribute('lang'),language);
      const objective=await page.locator('[data-life-path-objective]').innerText();
      assert.ok(objective.trim(),`${language}: objective visible`);
      objectives.set(language,objective);
      for (const city of ['istanbul','ankara','izmir']) {
        const expected=DISTRICTS.filter(d=>d.cityId===city);
        await page.locator(`[data-world-district="${expected[0].id}"]`).first().click();
        const nodes=page.locator('.world-node');
        assert.equal(await nodes.count(),expected.length,`${language}/${width}/${city}`);
        for (const d of expected) assert.ok(await nodes.filter({hasText:d.name}).isVisible(), `${language}/${city}/${d.name}`);
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${language}/${width} overflow`);
      assert.deepEqual(errors,[]);
    } finally {await context.close();}
  }
  assert.equal(new Set(objectives.values()).size,3,'first objective is localized in each language');
});

test('six ambitions lead to real actions and can be changed through the UI', {timeout:180000}, async () => {
  for (const path of ['ordinary','businessperson','gangster','professional','social-climber','freeform']) {
    const {context,page}=await setup({path});
    try {
      const initial=await inspect(page);
      assert.equal(initial.expansion.lifePath.active,path);
      const guide=page.locator('[data-life-path]');
      assert.equal(await guide.getAttribute('data-life-path'),path);
      assert.ok((await guide.locator('[data-life-path-objective]').innerText()).trim(), `${path}: first objective`);
      if(path==='freeform') {
        await action(page,'district:visit:ankara:mamak:work');
      } else {
        for(let i=0;i<25 && !(await inspect(page)).expansion.lifePath.completed[path];i++) {
          const next=guide.locator('[data-action]:visible:enabled').first();
          assert.ok(await next.count(),`${path}: actionable next step`);
          const id=await next.getAttribute('data-action');
          await action(page,id);
        }
        assert.ok((await inspect(page)).expansion.lifePath.completed[path],`${path}: first objective completed by UI actions`);
      }
      await openBoardworldTab(page,'goals');
      const before=await inspect(page), next=path==='professional'?'ordinary':'professional';
      await page.locator('[data-life-path] details > summary').click();
      await action(page,`life-path:choose:${next}`);
      const updated=await inspect(page);
      assert.equal(updated.expansion.lifePath.active,next);
      assert.equal(updated.expansion.lifePath.origin,path);
      assert.equal(updated.time,before.time);
      assert.deepEqual(updated.expansion.economy,before.expansion.economy);
      assert.deepEqual((await saveAndReload(page)).expansion.lifePath,updated.expansion.lifePath);
    } finally {await context.close();}
  }
});

test('a player can find work, inspect housing, travel and socialize', {timeout:60000}, async () => {
  const {context,page}=await setup();
  try {
    await openBoardworldTab(page,'expansion-finance');
    const initial=await inspect(page);
    assert.ok(initial.expansion.economy.home);
    assert.ok((await page.locator('main').innerText()).includes('Mamak'), 'local housing visible');
    await openBoardworldTab(page,'board');
    await action(page,'district:visit:ankara:mamak:work');
    await action(page,'district:apply');
    const before=await inspect(page);
    await action(page,'district:shift');
    const after=await inspect(page);
    assert.ok(after.bank>before.bank,'shift pays wages');
    await action(page,'district:visit:ankara:mamak:social');
    await openBoardworldTab(page,'life');
    while ((await inspect(page)).time % 1440 < 1080) await action(page,'wait:15');
    await openBoardworldTab(page,'board');
    const meet=page.locator('[data-action^="district:meet:"]:visible:enabled').first();
    assert.ok(await meet.count(), 'a local contact is available to meet');
    const contactAction=await meet.getAttribute('data-action');
    const beforeContact=await inspect(page);
    await action(page,contactAction);
    assert.ok((await inspect(page)).time>beforeContact.time, 'meeting is a real interaction');
    await page.locator('[data-world-district="ankara:altindag"]').first().click();
    await action(page,'district:travel:ankara:altindag');
    assert.equal((await inspect(page)).expansion.districts.place.districtId,'ankara:altindag');
    await saveAndReload(page);
  } finally {await context.close();}
});
