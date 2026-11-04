import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const out = "artifacts/social-engine/asset-faults",
  base = process.env.SE_BASE || "http://127.0.0.1:8097";
await mkdir(out, { recursive: true });
const bytes = await readFile("public/games/social-engine/build-manifest.json"),
  manifest = JSON.parse(bytes);
const report = {
  sourceDigest: manifest.sourceDigest,
  manifestSha256: createHash("sha256").update(bytes).digest("hex"),
  checks: [],
  errors: [],
};
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : chromium.executablePath()),
});
async function run(name, action) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } }),
    page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  try {
    const detail = await action(context, page);
    report.checks.push({ name, status: "PASS", detail });
  } catch (e) {
    report.checks.push({ name, status: "FAIL", reason: e.message });
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}
async function start(page) {
  await page.goto(base + "/games/social-engine/index.html?qa=1");
  await page.getByLabel("Karakter adı").fill("Görsel Test");
  await page.getByRole("button", { name: "Hikâyene başla" }).click();
}
await run(
  "missing optional prop frames render placeholders while a transient atlas download retries once",
  async (context, page) => {
    let attempts = 0;
    await context.route("**/assets/atlas-*.json", async (route) => {
      const response = await route.fetch(),
        atlas = await response.json();
      for (const key of ["tree", "lamp", "bench", "planter"]) delete atlas.actors.frames[key];
      await route.fulfill({ response, json: atlas });
    });
    await context.route("**/assets/people-props-*.png", async (route) => {
      attempts++;
      if (attempts === 1) await route.abort("failed");
      else await route.continue();
    });
    await start(page);
    await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
    await page.waitForTimeout(1000);
    assert.equal(attempts, 2);
    const before = await page.evaluate(() => window.__socialEngine.state());
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(500);
    await page.keyboard.up("KeyD");
    const after = await page.evaluate(() => window.__socialEngine.state());
    assert.notDeepEqual(after.player.location, before.player.location);
    assert.equal(await page.locator("#world canvas").count(), 1);
    await page.screenshot({ path: out + "/optional-placeholders.png" });
    return { attempts, population: after.npcs.length };
  },
);
await run(
  "permanent essential atlas failure stays bounded, cleans canvas, and a user retry creates one valid renderer",
  async (context, page) => {
    let attempts = 0;
    await context.route("**/assets/buildings-*.png", async (route) => {
      attempts++;
      await route.abort("failed");
    });
    await start(page);
    await page.waitForFunction(() => document.querySelector("#form-error").textContent.length > 0);
    assert.equal(attempts, 2);
    assert.equal(await page.locator("#world canvas").count(), 0);
    assert.equal(await page.getByRole("button", { name: "Hikâyene başla" }).isEnabled(), true);
    await context.unroute("**/assets/buildings-*.png");
    await page.getByRole("button", { name: "Hikâyene başla" }).click();
    await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
    assert.equal(await page.locator("#world canvas").count(), 1);
    return { failedAttempts: attempts, recoveredPopulation: 1100 };
  },
);
await browser.close();
report.status =
  report.checks.every((r) => r.status === "PASS") && !report.errors.length ? "PASS" : "FAIL";
await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (report.status !== "PASS") process.exitCode = 1;
