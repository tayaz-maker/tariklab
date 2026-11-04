import { waitForQATicks } from "./wait-for-qa-ticks.mjs";
// Actual map and job controls; accelerated fixed ticks shorten the walk, not the assertions.
import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { windowlessRendererOptions } from "./windowless-launch.mjs";
const base = process.env.SE_BASE || "http://127.0.0.1:8230",
  out = "artifacts/social-engine/upgrade/careers";
await mkdir(out, { recursive: true });
const bytes = await readFile("public/games/social-engine/build-manifest.json"),
  actual = await (await fetch(base + "/games/social-engine/build-manifest.json")).text();
assert.equal(actual, bytes.toString());
const report = {
  manifest: createHash("sha256").update(bytes).digest("hex"),
  checks: [],
  status: "RUNNING",
};
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  ...windowlessRendererOptions(),
});
try {
  for (const [job, building, choice] of [
    ["retail", "b-market", "tea"],
    ["mechanic", "b-garage", "batch"],
  ]) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/games/social-engine/index.html?qa=1");
    await page.getByLabel("Karakter adı").fill("Deniz Usta");
    await page.getByRole("button", { name: "Hikâyene başla" }).click();
    await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
    await page.locator('[data-panel="map"]').click();
    await page.locator('[data-go="' + building + '"]').click();
    await waitForQATicks(page, 1800);
    const at = await page.evaluate(
      async () => (await window.__socialEngine.state()).player.location,
    );
    await page.waitForFunction((pos) => {
      const p = window.__socialEngine.projection().player.location;
      return p.scene === pos.scene && Math.hypot(pos.x - p.x, pos.y - p.y) < 0.01;
    }, at);
    await page.keyboard.press("KeyE");
    await page.locator('[data-job="' + job + '"]').click();
    await page.waitForFunction((j) => window.__socialEngine.projection().player.jobId === j, job);
    await page.locator("#shift").click();
    await page.waitForFunction(
      (j) => window.__socialEngine.projection().player.shift?.order === j,
      job,
    );
    await page.locator('[data-work-order="' + choice + '"]').waitFor();
    await page.locator("#close-panel").click();
    await page.getByRole("button", { name: "Mekân", exact: true }).click();
    await page.locator('[data-work-order="' + choice + '"]').waitFor();
    await page.screenshot({ path: out + "/" + job + "-order.png" });
    await page.locator('[data-work-order="' + choice + '"]').click();
    await page.waitForFunction(
      () => window.__socialEngine.projection().player.shift?.order === "done",
    );
    await page.screenshot({ path: out + "/" + job + ".png" });
    assert.deepEqual(errors, []);
    report.checks.push(job);
    await page.close();
  }
  report.status = "PASS";
} catch (e) {
  report.status = "FAIL";
  report.reason = String(e.stack);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
