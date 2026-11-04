// Headless source-bound comparison: isolated baseline/candidate servers, real deterministic simulation.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const out = process.env.SE_EVIDENCE_OUT || "artifacts/social-engine/visual-rework";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const reports = [];
const targetTick = Number(process.env.SE_TICK || 100);
for (const [name, port] of [
  ["before", Number(process.env.SE_BASELINE_PORT || 18231)],
  ["after", Number(process.env.SE_CANDIDATE_PORT || 18230)],
]) {
  const context = await browser.newContext({
    viewport: {
      width: Number(process.env.SE_WIDTH || 1366),
      height: Number(process.env.SE_HEIGHT || 768),
    },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/games/social-engine/index.html?qa=1`);
  await page.locator("[name=name]").fill("Deniz Saha");
  await page.getByRole("button", { name: "Hikâyene başla" }).click();
  await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
  await page.evaluate(() => window.__socialEngine.pause(true));
  await page.waitForTimeout(600);
  let tick = await page.evaluate(() => window.__socialEngine.projection().tick);
  if (tick > targetTick) throw Error(`Unexpected initial tick ${tick}`);
  await page.evaluate((n) => window.__socialEngine.step(n), targetTick - tick);
  await page.waitForFunction(
    (target) => window.__socialEngine.projection().tick === target,
    targetTick,
    { timeout: 120000 },
  );
  await page.waitForTimeout(1800);
  const data = await page.evaluate(async () => {
    const state = await window.__socialEngine.state();
    const p = window.__socialEngine.projection();
    return {
      seed: state.seed,
      tick: p.tick,
      minute: p.minute,
      player: p.player.location,
      camera: window.__socialEngine.metrics().renderer.cameraTransform,
      metrics: window.__socialEngine.metrics().renderer,
    };
  });
  await page.screenshot({
    path: `${out}/${name}-${process.env.SE_WIDTH || 1366}${targetTick === 100 ? "" : `-tick${targetTick}`}.png`,
  });
  reports.push({ name, ...data, errors });
  await context.close();
}
for (const key of ["seed", "tick", "minute", "player", "camera"]) {
  assert.deepEqual(reports[0][key], reports[1][key], `Comparison mismatch: ${key}`);
}
for (const report of reports) assert.deepEqual(report.errors, []);
await writeFile(
  `${out}/comparison-${process.env.SE_WIDTH || 1366}${targetTick === 100 ? "" : `-tick${targetTick}`}.json`,
  JSON.stringify(reports, null, 2),
);
console.log(JSON.stringify(reports));
await browser.close();
