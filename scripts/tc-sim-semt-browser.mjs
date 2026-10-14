import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createNewGame } from "../public/games/tc-sim/js/state.js";
import { createStaticGameServer } from "./static-game-server.mjs";

const out = "/workspace/screenshots/tc-sim-semt";
mkdirSync(out, { recursive: true });
const state = createNewGame({ name: "Semt", now: "2027-01-01T00:00:00.000Z", seed: 11 });
state.finances.balance = 900000;
const save = JSON.stringify(state);
const server = createStaticGameServer("/workspace/tariklab/public");
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
  args: ["--no-sandbox"],
});
const errors = [];
try {
  for (const [name, width, height] of [["desktop", 1280, 800], ["mobile", 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500 });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${name}:${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`${name}:${message.text()}`);
    });
    await context.addInitScript((payload) => {
      localStorage.setItem("tariklab::tc-sim:1", payload);
      localStorage.setItem("tariklab::tc-sim:active", "1");
      localStorage.setItem("tariklab.language", "tr");
    }, save);
    await page.goto(`${origin}/games/tc-sim/index.html`, { waitUntil: "networkidle" });
    await page.locator("#continue-game").click();
    const home = page.locator('.side-nav [data-view="home"]');
    if (!(await home.isVisible())) await page.locator(".side-nav .nav-more").click();
    await home.click();
    await page.locator("#semt-emlak").scrollIntoViewIfNeeded();
    const text = await page.locator("#semt-emlak").innerText();
    for (const needle of ["Sırt", "Kıyı", "Çeper", "1+1", "2+1", "3+1", "Kahve dükkânı", "Küçük lokanta", "Bakkal", "Berber", "Kırtasiye", "PS / internet kafe"]) {
      assert.ok(text.includes(needle), `${name} missing ${needle}`);
    }
    const cities = await page.locator(".location-cities").innerText();
    assert.match(cities, /Ankara/);
    assert.match(cities, /İzmir/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${name} overflow ${overflow}`);
    await page.locator('[data-semt-action="buy"][data-semt-value="ceper:1+1"]').click();
    await page.locator("#semt-emlak").getByText("Çeper 1+1").first().waitFor();
    const saved = await page.evaluate(() => localStorage.getItem("tariklab::tc-sim:1"));
    const loaded = JSON.parse(saved);
    assert.equal(loaded.meta.saveVersion, 6);
    assert.equal(loaded.household.semt.holdings[0].id, "ceper:1+1");
    assert.equal(loaded.household.semt.holdings[0].price, 150000);
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("semt browser smoke ok");
