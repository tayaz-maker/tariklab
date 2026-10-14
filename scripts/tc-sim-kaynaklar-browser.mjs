import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { cityFixture } from "./tc-sim-city-fixture.mjs";

const server = createStaticGameServer(new URL("../public", import.meta.url).pathname);
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
    await page.goto(`${origin}/credits.html`, { waitUntil: "networkidle" });
    const credits = await page.locator("main").innerText();
    assert.match(credits, /Kaynaklar/);
    assert.match(credits, /7 karar hakkı/);
    assert.match(credits, /22\.104,67/);
    assert.match(credits, /FP\.CPI\.TOTL/);
    assert.match(credits, /Uzun Gölge/);
    assert.doesNotMatch(credits, /Altı zaman/);
    const creditsOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(creditsOverflow <= 1, `${name} credits overflow ${creditsOverflow}`);
    await context.addInitScript((state) => {
      localStorage.setItem("tariklab::tc-sim:1", JSON.stringify(state));
      localStorage.setItem("tariklab::tc-sim:active", "1");
      localStorage.setItem("tariklab.language", "tr");
    }, cityFixture());
    await page.goto(`${origin}/games/tc-sim/index.html`, { waitUntil: "networkidle" });
    await page.locator("#continue-game").click();
    await page.locator("#help-open").click();
    const help = await page.locator(".help-card").innerText();
    assert.match(help, /Kaynaklar/);
    assert.match(help, /22\.104,67/);
    assert.match(help, /FP\.CPI\.TOTL/);
    assert.doesNotMatch(help, /Altı zaman|6 zaman\/odak/);
    const gameOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(gameOverflow <= 1, `${name} game overflow ${gameOverflow}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
assert.deepEqual(errors, []);
console.log("kaynaklar browser smoke ok");
