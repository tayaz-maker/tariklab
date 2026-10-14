import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { cityFixture } from "./tc-sim-city-fixture.mjs";

const root = resolve("public");
const out = resolve("/workspace/screenshots/tc-sim-wave-c");
mkdirSync(out, { recursive: true });
const server = createStaticGameServer(root);
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox"],
});

async function openView(page, view) {
  const target = page.locator(`.side-nav [data-view="${view}"]`);
  if (!(await target.isVisible())) await page.locator(".side-nav .nav-more").click();
  await target.click();
  await page.locator(".workspace-head").waitFor();
}

try {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 800 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.width < 500,
      hasTouch: viewport.width < 500,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.addInitScript((state) => {
      localStorage.setItem("tariklab::tc-sim:1", JSON.stringify(state));
      localStorage.setItem("tariklab::tc-sim:active", "1");
      localStorage.setItem("tariklab.language", "tr");
    }, cityFixture());
    await page.goto(`${origin}/games/tc-sim/index.html`, { waitUntil: "networkidle" });
    await page.locator("#continue-game").click();
    await page.locator(".workspace-head").waitFor();
    const before = await page.evaluate(() => localStorage.getItem("tariklab::tc-sim:1"));
    await openView(page, "market");
    const market = await page.locator("body").innerText();
    assert.match(market, /Ne alacaksın\?/);
    assert.match(market, /Samsung Galaxy A15/);
    assert.match(market, /Salcano Explorer 28/);
    assert.match(market, /Nokia 3310/);
    const marketOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert.ok(marketOverflow <= 1, `${viewport.name} market overflow ${marketOverflow}`);
    await page.screenshot({ path: `${out}/${viewport.name}-market.png`, fullPage: false });
    await openView(page, "finance");
    const finance = await page.locator("body").innerText();
    assert.match(finance, /Paran ve borcun/);
    assert.match(finance, /Renault Symbol 1\.5/);
    assert.match(finance, /Fiat Egea 1\.4 Easy/);
    assert.match(finance, /Volkswagen Passat 1\.6/);
    const financeOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert.ok(financeOverflow <= 1, `${viewport.name} finance overflow ${financeOverflow}`);
    await page.screenshot({ path: `${out}/${viewport.name}-finance.png`, fullPage: false });
    const after = await page.evaluate(() => localStorage.getItem("tariklab::tc-sim:1"));
    assert.equal(after, before, `${viewport.name} viewing mutated the save`);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log("wave-c browser smoke ok");
} finally {
  await browser.close();
  server.close();
}
