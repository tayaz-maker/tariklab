// A fresh browser journey. State inspection only verifies the results of UI clicks.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { openBoardworldTab } from "./boardworld-browser-navigation.mjs";

const server = createStaticGameServer(process.argv[2] ?? "public");
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BOARDWORLD_CHROME,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const inspect = () => page.evaluate(() => window.boardworldInspect());
const buttonFor = (id) => page.locator(`[data-action="${id}"]`).first();
const world = () => openBoardworldTab(page, "expansion-world");
const enterprise = () => openBoardworldTab(page, "enterprise");
const districtId = "istanbul:umraniye";

async function click(id) {
  const button = buttonFor(id);
  assert.equal(await button.count(), 1, `missing action ${id}`);
  const ancestors = button.locator("xpath=ancestor::details");
  for (let i = (await ancestors.count()) - 1; i >= 0; i--) {
    const outer = ancestors.nth(i);
    if ((await outer.getAttribute("open")) === null) await outer.locator(":scope > summary").click();
  }
  assert.equal(await button.isEnabled(), true,
    `${id}: ${await button.locator("xpath=ancestor::article[1]").innerText()}`);
  await page.evaluate((id) => {
    window.simulationJourneyStep = null;
    const onComplete = (event) => {
      if (event.detail?.id !== id) return;
      window.simulationJourneyStep = event.detail;
      removeEventListener("boardworld:action-complete", onComplete);
    };
    addEventListener("boardworld:action-complete", onComplete);
  }, id);
  await button.click();
  await page.waitForFunction(() => window.simulationJourneyStep !== null);
  assert.equal(await page.evaluate(() => window.simulationJourneyStep.saved), true, id);
}

async function clearEvents() {
  for (let loops = 0; loops < 20; loops++) {
    const event = page.locator(".event-choices [data-action]:enabled").first();
    if (!(await event.count())) return;
    await click(await event.getAttribute("data-action"));
  }
  throw new Error("Event choices did not settle.");
}

async function worldAction(id) {
  for (let tries = 0; tries < 26; tries++) {
    await clearEvents();
    await world();
    if ((await buttonFor(id).count()) && (await buttonFor(id).isEnabled())) {
      await click(id);
      return;
    }
    if ((await inspect()).player.energy < 33 && (await buttonFor("world:rest").count()) &&
      (await buttonFor("world:rest").isEnabled())) {
      await click("world:rest");
    } else {
      await openBoardworldTab(page, "life");
      await click("wait:60");
    }
  }
  throw new Error(`Regional action remained blocked: ${id}`);
}

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/games/tc-sim-boardworld/index.html`);
  await page.locator("#character-name").fill("Deniz Usta");
  await page.locator('[name="scenario"][value="restart"]').check();
  await page.locator('[data-testid="create-game"]').click();
  await page.locator(".event-choices [data-action]:enabled").first().waitFor();
  await clearEvents();
  await openBoardworldTab(page, "expansion");
  await page.locator('[data-ui="expand"]').click();
  await page.waitForFunction(() => window.boardworldInspect?.()?.version === 7);

  await worldAction(`district:travel:${districtId}`);
  await worldAction(`district:visit:${districtId}:work`);
  await worldAction("district:apply");
  const beforeShift = await inspect();
  await worldAction("district:shift");
  const afterShift = await inspect();
  const firmId = afterShift.expansion.districts.job.firmId;
  assert.equal(firmId, `${districtId}:repair`);
  const wage = afterShift.bank - beforeShift.bank;
  assert.ok(wage > 0);
  assert.equal(beforeShift.expansion.economy.firms[firmId].cash -
    afterShift.expansion.economy.firms[firmId].cash, wage);
  await clearEvents();
  await enterprise();
  await click("business:start:repair");
  assert.equal((await inspect()).expansion.economy.business.districtId, districtId);
  await click("business:fund:2000");
  const beforeStock = await inspect();
  await click("business:stock:3");
  const afterStock = await inspect();
  assert.equal(afterStock.living.enterprise.stock - beforeStock.living.enterprise.stock, 3);
  const vendorBefore = beforeStock.expansion.economy.firms[firmId];
  const vendorAfter = afterStock.expansion.economy.firms[firmId];
  const paid = beforeStock.living.enterprise.capital - afterStock.living.enterprise.capital;
  assert.equal(vendorBefore.stock - vendorAfter.stock, 3);
  assert.equal(vendorAfter.cash - vendorBefore.cash, paid);

  await click("business:acquire");
  if ((await inspect()).player.energy < 35) {
    await worldAction("world:rest");
    await clearEvents();
    await enterprise();
  }
  const beforeSale = await inspect();
  await click("business:serve");
  const afterSale = await inspect();
  const revenue = afterSale.deep.business.revenue - beforeSale.deep.business.revenue;
  assert.ok(revenue > 0);
  assert.ok(afterSale.living.enterprise.stock < beforeSale.living.enterprise.stock);
  await page.reload();
  await page.waitForFunction(() => window.boardworldInspect?.()?.version === 7);
  assert.deepEqual(await inspect(), afterSale);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ districtId, firmId, wage, paid, revenue, reload: true }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
