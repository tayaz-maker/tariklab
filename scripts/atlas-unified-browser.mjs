import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const origin = process.env.ATLAS3D_ORIGIN || "http://127.0.0.1:8080";
assert.match(origin, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const out = process.env.ATLAS3D_OUT || "/private/tmp/tariklab-atlas-unified";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(origin + "/atlas/3d/");
    try { await page.waitForSelector("#list button", { timeout: 15000 }); }
    catch (error) {
      console.error("Atlas boot failed", { errors, body: (await page.locator("body").innerText()).slice(0, 1800), url: page.url() });
      await page.screenshot({ path: `${out}/${width}-boot-error.png`, fullPage: true });
      throw error;
    }
    assert.equal(requests.some((url) => url.endsWith(".bin.gz")), false);
    assert.match(await page.locator("#coverage").textContent(), /Erkek/);
    await page.click("#mode-2d");
    await page.waitForSelector(".atlas-view svg");
    assert.equal(await page.locator(".atlas-view").getAttribute("data-variant"), "male");
    await page.click("#sex-female");
    assert.equal(await page.locator(".atlas-view").getAttribute("data-variant"), "female");
    await page.locator('#list button[data-id="heart"]').click();
    assert.equal(await page.locator("#detail-name").textContent(), "Kalp");
    await page.screenshot({ path: `${out}/${width}-2d-female.png`, fullPage: true });
    await page.click("#mode-3d");
    assert.match(await page.locator("#coverage").textContent(), /Kadın/);
    await page.click("#load");
    await page.waitForFunction(() => window.atlas3d.stats()?.visible?.length > 0, null, { timeout: 120000 });
    const female = await page.evaluate(() => window.atlas3d.stats());
    assert(female.visible.includes("HRA2"));
    assert(female.triangles > 10000);
    assert.equal(await page.locator("canvas").count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${out}/${width}-3d-female.png`, fullPage: true });
    if (width === 390) {
      await page.click("#offline");
      await page.waitForFunction(() => document.querySelector("#offline-status")?.textContent.includes("offline hazır"), null, { timeout: 120000 });
      await page.click("#offline-system");
      await page.waitForFunction(() => document.querySelector("#offline-status")?.textContent.includes("offline saklandı"), null, { timeout: 180000 });
      await context.setOffline(true);
      await page.reload();
      await page.waitForSelector("#list button");
      assert.match(await page.locator("#coverage").textContent(), /Kadın/);
      await page.click("#load");
      await page.waitForFunction(() => window.atlas3d.stats()?.visible?.includes("HRA2"), null, { timeout: 120000 });
      await page.click("#mode-2d");
      await page.waitForSelector(".atlas-view svg");
      await context.setOffline(false);
      await page.click("#mode-3d");
    }
    await page.click("#sex-male");
    await page.click("#load");
    await page.waitForFunction(() => window.atlas3d.stats()?.visible?.includes("FMA7163"), null, { timeout: 120000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${out}/${width}-3d-male.png`, fullPage: true });
    assert.deepEqual(errors, []);
    results.push({ width, femaleStructures: female.visible.length, errors, status: "PASS" });
    await context.close();
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
