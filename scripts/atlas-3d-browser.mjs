import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.ATLAS3D_ORIGIN || "http://127.0.0.1:8096";
assert.ok(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin), "Local proof only");
const out = process.env.ATLAS3D_OUT || "../../outputs/atlas-3d-browser";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const rows = [];
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
        viewport: { width, height: width === 1440 ? 1000 : 844 },
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    const errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(origin + "/atlas/3d/");
    await page.waitForSelector("#list button");
    assert.equal(
      requests.filter((u) => /\.bin\.gz|vendor\//.test(u)).length,
      0,
      "No geometry or engine before intent",
    );
    const start = Date.now();
    await page.click("#load");
    await page.waitForFunction(
      () => document.body.dataset.ready === "true",
      {},
      { timeout: 60000 },
    );
    const loadMs = Date.now() - start;
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      "No overflow",
    );
    const initial = await page.evaluate(() => window.atlas3d.stats());
    assert(initial.triangles > 10000);
    assert(initial.drawCalls <= 12);
    assert.equal(initial.visible.length, 9);
    await page.screenshot({ path: out + `/${width}-assembled.png`, fullPage: true });
    const rect = await page.locator("canvas").boundingBox();
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    assert.ok(await page.evaluate(() => window.atlas3d.stats().selected), "Actual mesh picking");
    const beforeDrag = await page.evaluate(() => window.atlas3d.stats());
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width / 2 + 55, rect.y + rect.height / 2 + 15, {
      steps: 8,
    });
    await page.mouse.up();
    const afterDrag = await page.evaluate(() => window.atlas3d.stats());
    assert.notDeepEqual(afterDrag.camera, beforeDrag.camera);
    assert.equal(afterDrag.selected, beforeDrag.selected, "Drag does not change selection");

    await page.fill("#search", "Kalp");
    await page.click('[data-id="FMA7088"]');
    assert.equal(await page.locator("#detail-name").textContent(), "Kalp");
    await page.click("#isolate");
    assert.deepEqual(await page.evaluate(() => window.atlas3d.stats().visible), ["FMA7088"]);
    await page.screenshot({ path: out + `/${width}-isolated.png`, fullPage: true });
    await page.click("#clear");
    await page.fill("#search", "");
    await page.locator('[data-system="iskelet"]').uncheck();
    assert.equal(await page.evaluate(() => window.atlas3d.stats().visible.length), 8);
    await page.locator('[data-system="iskelet"]').check();
    await page.locator("#explode").evaluate((el) => {
      el.value = "100";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    assert.equal(await page.evaluate(() => window.atlas3d.stats().amount), 1);
    await page.screenshot({ path: out + `/${width}-exploded.png`, fullPage: true });
    await page.click('[data-view="side"]');
    const side = await page.evaluate(() => window.atlas3d.stats().camera);
    assert.notDeepEqual(side, initial.camera);
    await page.focus("#stage");
    await page.keyboard.press("ArrowRight");
    assert.notDeepEqual(await page.evaluate(() => window.atlas3d.stats().camera), side);
    await page.click("#reset");
    assert.equal(await page.evaluate(() => window.atlas3d.stats().amount), 0);
    await page.click("#offline");
    await page.waitForFunction(
      () => document.querySelector("#offline-status").textContent.startsWith("Offline paket hazır"),
      {},
      { timeout: 120000 },
    );
    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector("#load");
    await page.click("#load");
    await page.waitForFunction(
      () => document.body.dataset.ready === "true",
      {},
      { timeout: 60000 },
    );
    await page.click('[data-id="FMA7148"]');
    assert.equal(await page.locator("#detail-name").textContent(), "Mide");
    await page.screenshot({ path: out + `/${width}-offline.png`, fullPage: true });
    assert.deepEqual(errors, []);
    rows.push({
      width,
      loadMs,
      initial,
      requests: requests.length,
      errors,
      offline: true,
      status: "PASS",
    });
    await context.close();
  }
  const context = await browser.newContext();
  await context.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = function () {
      return null;
    };
  });
  const page = await context.newPage();
  await page.goto(origin + "/atlas/3d/");
  await page.waitForSelector("#list button");
  await page.click("#load");
  await page.waitForFunction(() => document.body.dataset.ready === "error");
  assert.equal(await page.locator("#stage a").getAttribute("href"), "../yapi/");
  await context.close();
  await writeFile(
    out + "/results.json",
    JSON.stringify(
      {
        status: "PASS",
        renderer: "Chromium software WebGL; not physical GPU",
        rows,
        noWebGLFallback: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "ATLAS_3D_PASS",
    rows.map((r) => ({ width: r.width, loadMs: r.loadMs })),
  );
} finally {
  await browser.close();
}
