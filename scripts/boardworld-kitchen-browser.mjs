// Fresh character through visible controls only. Read-only inspection and the
// action catalogue verify the household, business and buyer accounts.
import assert from "node:assert/strict";
import {mkdirSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {chromium} from "playwright";
import {createStaticGameServer} from "./static-game-server.mjs";
import {openBoardworldTab} from "./boardworld-browser-navigation.mjs";

const assets = resolve(process.argv[2] || "public");
const engine = await import(pathToFileURL(resolve(assets, "games/tc-sim-boardworld/engine.mjs")).href);
await engine.loadExpansionRuntime();
const output = resolve(process.env.RUNNER_TEMP || "work", "screenshots", "boardworld-kitchen");
mkdirSync(output, {recursive: true});
const server = createStaticGameServer(assets);
await new Promise(done => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1280, height: 900}});
const errors = [], trace = [];
page.on("pageerror", error => errors.push(error.message));
const inspect = () => page.evaluate(() => window.boardworldInspect());
const offer = (s, id) => engine.getActions(s).find(a => a.id === id);
const district = "ankara:altindag";
const household = s => s.cash + s.bank;
const capital = s => s.living.enterprise.capital;
const stock = s => s.living.enterprise.stock;
const book = s => s.deep.business;
const company = s => s.expansion.economy.business;
const buyer = s => s.expansion.districts.foodMarkets?.[district];
const day = s => Math.floor(s.time / 1440) + 1;
let current;

async function findVisible(id, tabs) {
  const controls = page.locator(`[data-action="${id}"]`);
  for (const tab of [null, ...tabs]) {
    if (tab) await openBoardworldTab(page, tab);
    for (const button of await controls.all()) {
      for (const details of (await button.locator("xpath=ancestor::details[not(@open)]").all()).reverse()) {
        const summary = details.locator(":scope > summary");
        if (await summary.isVisible()) await summary.click();
      }
      if (await button.isVisible() && await button.isEnabled()) return button;
    }
  }
}

async function act(id, ...tabs) {
  const before = current;
  const action = offer(before, id);
  assert.ok(action && !action.disabled, `${id}: ${action?.reason || "unavailable"}`);
  const button = await findVisible(id, tabs);
  assert.ok(button, `${id} does not have a visible enabled control`);
  await page.evaluate(expected => {
    window.__kitchenAck = null;
    const done = event => {
      if (event.detail?.id !== expected) return;
      removeEventListener("boardworld:action-complete", done);
      window.__kitchenAck = event.detail;
    };
    addEventListener("boardworld:action-complete", done);
  }, id);
  await button.click();
  await page.waitForFunction(() => window.__kitchenAck !== null, null, {timeout: 20000});
  assert.equal((await page.evaluate(() => window.__kitchenAck)).saved, true, id);
  current = await inspect();
  assert.ok(current.revision > before.revision, id);
  const step = {id, day: day(current), minutes: current.time - before.time, householdDelta: household(current) - household(before),
    companyDelta: capital(current) - capital(before), stock: stock(current), revenue: book(current)?.revenue, costs: book(current)?.costs};
  trace.push(step);
  if (!id.startsWith("wait:")) console.log(JSON.stringify(step));
  return {before, after: current, action};
}

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/games/tc-sim-boardworld/`);
  await page.locator("#character-name").fill("Deniz Mutfak");
  await page.locator("[name=startCity]").selectOption("ankara");
  await page.locator("[name=startingDistrict]").selectOption(district);
  await page.locator('[name=lifePath][value="social-climber"]').check();
  await page.locator("[data-testid=create-game]").click();
  await page.waitForFunction(() => window.boardworldInspect?.()?.expansion);
  current = await inspect();
  assert.equal(current.revision, 0);
  assert.equal(current.player.skills.communication, 25);
  await act(`district:visit:${district}:work`, "expansion-world");
  const opened = await act("business:start:kitchen", "enterprise");
  assert.equal(opened.action.cost, 3200);
  assert.equal(household(opened.before) - household(current), 3200);
  assert.equal(company(current).sector, "kitchen");
  assert.equal(buyer(opened.before), undefined);
  assert.deepEqual(buyer(current), {stock:12, cash:1000, wholesaleSpent:0, lastDay:1});
  const panel = page.locator("section.reference").filter({has:page.getByRole("heading",{name:"Mahalle mutfağı",exact:true})});
  await panel.waitFor();
  for (const label of ["Stok, fiyat ve tedarik", "Sermaye ve aile aktarımı"]) {
    const group = panel.locator("details").filter({has:page.getByText(label,{exact:true})});
    assert.equal(await group.count(), 1, `${label} is grouped`);
    assert.equal(await group.evaluate(element => element.open), false, `${label} starts collapsed`);
  }
  const funded = await act("business:fund:2000", "enterprise");
  assert.equal(household(funded.before) - household(current), 2000);
  assert.equal(capital(current) - capital(funded.before), 2000);
  const stocked = await act("business:stock:6", "enterprise");
  assert.equal(stock(current) - stock(stocked.before), 6);
  const supplies = capital(stocked.before) - capital(current);
  assert.ok(supplies > 0);
  assert.equal(book(current).costs - book(stocked.before).costs, supplies);
  assert.equal(household(current), household(stocked.before));
  await act("economy:price:120", "enterprise");
  assert.equal(company(current).price, 120);
  const expensive = offer(current, "business:serve");
  assert.equal(expensive.disabled, true);
  assert.match(expensive.reason, /ödemesi karşılanabilen sipariş yok/);
  assert.ok(await panel.locator('[data-action="business:serve"]').isDisabled());
  await act("economy:price:85", "enterprise");
  assert.equal(company(current).price, 85);
  const hire = await act("economy:hire", "enterprise");
  assert.equal(company(current).workers, 1);
  assert.equal(capital(current), capital(hire.before));

  const sold = await act("business:serve", "enterprise");
  assert.equal(sold.after.time - sold.before.time, 90);
  const units = stock(sold.before) - stock(current), gross = book(current).revenue - book(sold.before).revenue;
  const materials = book(current).costs - book(sold.before).costs;
  assert.ok(units > 0 && gross > 0 && materials > 0);
  assert.equal(buyer(current).stock - buyer(sold.before).stock, units);
  assert.equal(buyer(sold.before).cash - buyer(current).cash, gross);
  assert.equal(capital(current) - capital(sold.before), gross - materials);
  assert.equal(household(current), household(sold.before));

  await act("family:adopt", "expansion");
  const care = await act("business:family-care", "enterprise");
  assert.equal(current.time - care.before.time, 15);
  assert.equal(capital(care.before) - capital(current), 250);
  assert.equal(current.expansion.family.reserve - care.before.expansion.family.reserve, 250);
  assert.equal(household(current), household(care.before));
  assert.deepEqual([book(current).revenue, book(current).costs], [book(care.before).revenue, book(care.before).costs]);

  const firstDay = day(current);
  let crossing;
  for (let i = 0; i < 24 && day(current) === firstDay; i++) {
    const event = engine.getActions(current).find(a => a.category === "event" && !a.disabled);
    crossing = await act(event?.id || "wait:60", "life", "plan");
  }
  assert.equal(day(current), firstDay + 1);
  const wage = Number(/^(\d+) TL/.exec(hire.action.description)[1]);
  const staffUnits = stock(crossing.before) - stock(current);
  const staffRevenue = book(current).revenue - book(crossing.before).revenue;
  const payrollCosts = book(current).costs - book(crossing.before).costs;
  assert.equal(payrollCosts, wage + staffUnits * (materials / units));
  assert.equal(capital(current) - capital(crossing.before), staffRevenue - payrollCosts);
  assert.equal(company(current).wageDue, 0);
  assert.equal(household(current), household(crossing.before));
  assert.ok(staffUnits > 0 && staffRevenue > 0, "the paid employee fulfills a real order");

  const pause = await act("business:pause", "enterprise");
  const overhead = book(current).costs - book(pause.before).costs;
  assert.ok(overhead > 0);
  assert.equal(capital(pause.before) - capital(current), overhead);
  assert.equal(household(current), household(pause.before));
  assert.equal(book(current).status, "paused");
  assert.equal(book(current).arrears, 0);
  const reopened = await act("business:pause", "enterprise");
  assert.equal(book(current).status, "active");
  assert.equal(capital(current), capital(reopened.before));
  const saved = current;
  await page.reload();
  await page.waitForFunction(() => window.boardworldInspect?.()?.expansion?.economy?.business?.sector === "kitchen");
  assert.deepEqual(await inspect(), saved);
  await openBoardworldTab(page, "expansion");
  await page.getByText(/Hane birikimi 250/).waitFor();
  await openBoardworldTab(page, "enterprise");
  await panel.waitFor();
  assert.match(await panel.innerText(), /Kasa.*Stok.*Çalışan/);
  assert.match(await panel.innerText(), /Gelir.*Gider.*Ücret borcu/);
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({path: resolve(output, "accounts.png")});
  assert.deepEqual(errors, []);
  const result = {ok:true, district, supplies, manualSale:{units,gross,materials},
    staff:{wage,units:staffUnits,revenue:staffRevenue}, overhead, familyCareReserve:250, reopened:true, reloaded:true, errors, trace};
  writeFileSync(resolve(output, "result.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({...result, trace: trace.length}));
} catch (error) {
  await page.screenshot({path:resolve(output,"last-screen.png")}).catch(() => {});
  writeFileSync(resolve(output,"failed.json"), JSON.stringify({error:error.message,errors,trace,
    last:current && {time:current.time,player:current.player,capital:capital(current),buyer:buyer(current),company:company(current)}}, null, 2) + "\n");
  throw error;
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
