import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:8081/games/tc-sim/index.html";
const out = `${process.env.RUNNER_TEMP || "/workspace"}/screenshots/tc-sim-historical`;
mkdirSync(out, { recursive: true });
const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "8081"], { stdio: "inherit" });
let browser;
const results = [];
try {
  let ready = false;
  for (let i = 0; i < 150; i += 1) {
    try { ready = (await fetch(origin)).ok; } catch { /* wait for Vite */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "TC SIM server did not start");
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox"] });
  for (const width of [1440, 390, 320]) {
    for (const eraId of ["present_day", "1999-04-18", "1980s"]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error" && message.location().url.startsWith("http://127.0.0.1:8081")) errors.push(message.text()); });
      try {
        await page.goto(origin, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Hayatını Başlat" }).click();
        await page.locator('[name="eraId"]').selectOption(eraId);
        await page.locator('[name="scenarioSeed"]').fill("424242");
        await page.getByRole("button", { name: "Bu slota yeni hayat" }).click();
        await page.waitForTimeout(150);
        async function assertNoOverflow(stage) {
          const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
          assert.ok(dimensions.scroll <= dimensions.width + 1, `${eraId}/${width}px/${stage} overflow ${JSON.stringify(dimensions)}`);
        }
        await assertNoOverflow("start");

        if (eraId !== "present_day") {
          if (eraId === "1980s") assert.ok(await page.locator(".historical-citations a").count(), "1980 event must show its institutional citation");
          if (eraId === "1999-04-18") assert.ok(await page.getByText(/Kurgu yaşam kararı/).count(), "fictional life prompt must be labeled");
          await page.locator('[data-scenario-choice="work"]').click();
          await page.waitForTimeout(80);
          const storageKey = "tariklab::tc-sim:1";
          await page.reload({ waitUntil: "networkidle" });
          const reloaded = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
          assert.equal(reloaded.world.scenario.history.length, 1, `${eraId}/${width}px choice did not survive reload`);
          await assertNoOverflow("save-reload");
          const weeksToFinal = Math.ceil((Date.parse("2026-01-01T00:00:00Z") - Date.parse(`${reloaded.world.scenario.startDate}T00:00:00Z`)) / (365.2425 * 86400000) * 48);
          reloaded.time.absoluteWeek = weeksToFinal;
          await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), { key: storageKey, save: reloaded });
          await page.reload({ waitUntil: "networkidle" });
          await page.locator("#advance-week").click();
          await page.getByRole("heading", { name: /tarihsel yaşam rotası|karar|2026/i }).waitFor({ timeout: 5000 });
          await page.waitForTimeout(120);
          const finished = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
          assert.equal(finished.world.scenario.completed, true, `${eraId}/${width}px final missing`);
          assert.equal(finished.world.scenario.final.date, "2026-01-01");
          assert.equal(finished.world.scenario.history.length, 1);
          assert.ok(await page.getByText(/2026'ya .* dönem kararı/i).count());
          await assertNoOverflow("2026-final");
        } else {
          const decision = page.locator('[data-decision]:not([disabled])').first();
          await decision.click();
          await page.reload({ waitUntil: "networkidle" });
          const presentSave = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), "tariklab::tc-sim:1");
          assert.ok(presentSave.weekly.used >= 1, "present-day decision failed to survive reload");
          assert.equal(presentSave.world.eraId, "present_day", "existing start must remain unchanged");
          await assertNoOverflow("present-save-reload");
        }
        assert.deepEqual(errors, [], `${eraId}/${width}px browser errors`);
        await page.screenshot({ path: `${out}/${eraId}-${width}.png`, fullPage: true });
        results.push({ eraId, width, noOverflow: true, decisionSaveReloadFinal: eraId !== "present_day" });
      } finally { await context.close(); }
    }
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
}
console.log(JSON.stringify({ checks: results.length, results }, null, 2));
