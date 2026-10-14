import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { cityFixture } from "./tc-sim-city-fixture.mjs";
import { createStaticGameServer } from "./static-game-server.mjs";

const out = "/workspace/screenshots/tc-sim-girisim";
mkdirSync(out, { recursive: true });
const state = cityFixture();
const save = JSON.stringify(state);
const server = createStaticGameServer("/workspace/tariklab/public");
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
  args: ["--no-sandbox"],
});
const errors = [];

async function openNav(page, view) {
  const button = page.locator(`.side-nav [data-view="${view}"]`);
  if (!(await button.isVisible())) await page.locator(".side-nav .nav-more").click();
  await button.click();
}

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
    await openNav(page, "home");
    await page.locator("#semt-emlak").scrollIntoViewIfNeeded();
    const text = await page.locator("#semt-emlak").innerText();
    for (const needle of ["Kahve", "Bakkal", "Berber", "GENÇ GİRİŞİMCİ", "İkinci tezgâh"]) {
      assert.ok(text.includes(needle), `${name} missing ${needle}`);
    }
    await page.locator('[data-semt-action="open"][data-semt-value="ceper:bakkal"]').click();
    await page.locator("#semt-emlak").getByText("Bakkal · Çeper").waitFor();
    const after = await page.locator("#semt-emlak").innerText();
    assert.match(after, /İkinci tezgâh için dört hafta/);
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem("tariklab::tc-sim:1")));
    assert.equal(saved.meta.saveVersion, 6);
    assert.equal(saved.household.semt.shops.length, 1);
    assert.equal(saved.household.semt.shop.id, "bakkal");
    await openNav(page, "career");
    const career = await page.locator("body").innerText();
    assert.match(career, /Küçük esnaf/);
    assert.match(career, /Genç girişimci yolu/);
    await openNav(page, "finance");
    const finance = await page.locator("body").innerText();
    assert.match(finance, /Küçük işletme/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${name} overflow ${overflow}`);
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
console.log("girisim browser smoke ok");
