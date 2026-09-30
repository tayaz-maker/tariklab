import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { createNewGame } from "../public/games/tc-sim/js/state.js";
import { chooseEightiesStartYear } from "../public/games/tc-sim/js/historical-scenarios.js";

const origin = "http://127.0.0.1:8084/games/tc-sim/index.html";
const out = `${process.env.RUNNER_TEMP || "/workspace"}/screenshots/tc-sim-historical`;
mkdirSync(out, { recursive: true });
const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "8084"], { stdio: "inherit" });
let browser;
const results = [];
const seeds = new Map();
for (let seed = 1; seeds.size < 3; seed += 1) {
  const year = chooseEightiesStartYear(seed);
  if (!seeds.has(year)) seeds.set(year, seed);
}
const starts = [
  { id: "present_day", expectedDate: null },
  { id: "1999-04-18", expectedDate: "1999-04-18" },
  ...[1980, 1984, 1988].map((year) => ({ id: "1980s", seed: seeds.get(year), expectedDate: `${year}-01-01`, year })),
];
const storageKey = "tariklab::tc-sim:1";

try {
  let ready = false;
  for (let i = 0; i < 150; i += 1) {
    try { ready = (await fetch(origin)).ok; } catch { /* wait for Vite */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "TC SIM server did not start");
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox"] });

  for (const language of ["tr", "en", "pl"]) {
    for (const width of [1440, 390, 320]) {
      for (const start of starts) {
        const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 } });
        await context.addInitScript((lang) => localStorage.setItem("tariklab.language", lang), language);
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        page.on("response", (response) => {
          if (response.url().startsWith("http://127.0.0.1:8084") && response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
        });
        try {
          await page.goto(origin, { waitUntil: "networkidle" });
          assert.equal(await page.evaluate(() => document.documentElement.lang), language, `${language} document language`);
          await page.locator("#show-creation-form").click();
          await page.locator('[name="eraId"]').selectOption(start.id);
          if (start.id === "1980s") {
            await page.locator('[name="scenarioSeed"]').fill(String(start.seed));
            assert.equal(chooseEightiesStartYear(start.seed), start.year, "seed-to-cohort mapping is deterministic");
          }
          await page.locator("#new-game-form button[type=submit]").click();
          await page.locator("#advance-week").waitFor();

          async function assertNoOverflow(stage) {
            const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
            assert.ok(dimensions.scroll <= dimensions.width + 1, `${start.id}/${start.year || ""}/${language}/${width}px/${stage} overflow ${JSON.stringify(dimensions)}`);
          }
          await assertNoOverflow("start");
          let saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
          if (start.id === "present_day") {
            assert.equal(saved.world.eraId, "present_day", "the current-day start remains unchanged");
            assert.equal(saved.world.scenario, undefined);
            await page.locator('[data-decision]:not([disabled])').first().click();
            await page.reload({ waitUntil: "networkidle" });
            saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
            assert.ok(saved.weekly.used >= 1, "current-day decision persists after reload");
            await assertNoOverflow("current-save-reload");

            const legacy = createNewGame({ name: "Eski kayıt", seed: 19, now: "2024-06-01T00:00:00.000Z" });
            legacy.meta.saveVersion = 1;
            delete legacy.meta.startYear;
            delete legacy.world.scenario;
            await page.evaluate(({ legacySave }) => {
              localStorage.clear();
              localStorage.setItem("tariklab.language", document.documentElement.lang);
              localStorage.setItem("tc-sim-save", JSON.stringify(legacySave));
            }, { legacySave: legacy });
            await page.reload({ waitUntil: "networkidle" });
            await page.locator("#continue-game").click();
            const migrated = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
            assert.equal(migrated.player.name, "Eski kayıt");
            assert.equal(migrated.world.eraId, "present_day");
            assert.equal(migrated.world.scenario, undefined, "legacy tc-sim-save opens in the current-day scenario");
            await assertNoOverflow("legacy-save-reload");
          } else {
            assert.equal(saved.world.scenario.startDate, start.expectedDate, `${start.id}/${start.year || ""} start date`);
            assert.equal(saved.world.scenario.endDate, "2026-01-01");
            assert.equal(saved.world.scenario.seed, start.id === "1980s" ? start.seed : saved.world.scenario.seed);
            if (start.id === "1980s") assert.equal(chooseEightiesStartYear(saved.world.scenario.seed), start.year);

            // Reach the next event deterministically; 1988's first event starts in 1989.
            if (!saved.world.scenario.pendingEvent) {
              const [eventYear] = saved.world.scenario.pack.events[saved.world.scenario.eventCursor];
              const eventWeek = Math.max(1, (eventYear - saved.world.scenario.startYear) * 48 + 1);
              saved.time.absoluteWeek = eventWeek - 1;
              await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), { key: storageKey, save: saved });
              await page.reload({ waitUntil: "networkidle" });
              await page.locator("#advance-week").click();
            }
            assert.ok(await page.locator(".historical-event").count(), "an event card is visible");
            if (saved.world.scenario.pendingEvent?.sources?.length) {
              assert.ok(await page.locator(".historical-citations a").count(), "factual event shows its institutional URL");
              assert.ok(await page.locator(".historical-citations").innerText().then((text) => /TCMB|Dünya Bankası/.test(text)), "source institution role is visible");
              assert.ok(await page.locator(".historical-citations").innerText().then((text) => /2026|2009|2020/.test(text)), "source date or access date is visible");
            } else {
              assert.ok(await page.locator(".historical-citations").innerText().then((text) => /Kurgu yaşam kararı/.test(text)), "fictional life prompt is labeled");
            }
            await page.locator('[data-scenario-choice="work"]').click();
            await page.reload({ waitUntil: "networkidle" });
            saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
            assert.equal(saved.world.scenario.history.length, 1, "chosen event survives save/reload");
            await assertNoOverflow("save-reload");

            // Advance to the choice's real delayed-effect week, then verify it is applied.
            const dueWeek = saved.world.scenario.delayedEffects[0].dueWeek;
            saved.time.absoluteWeek = dueWeek - 1;
            saved.world.scenario.pendingEvent = null;
            await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), { key: storageKey, save: saved });
            await page.reload({ waitUntil: "networkidle" });
            await page.locator("#advance-week").click();
            saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
            assert.equal(saved.world.scenario.delayedEffects[0].applied, true, "delayed consequence resolves after 48 weeks");
            await page.reload({ waitUntil: "networkidle" });
            saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
            assert.equal(saved.world.scenario.delayedEffects[0].applied, true, "delayed effect survives reload");

            const totalWeeks = Math.ceil((Date.parse("2026-01-01T00:00:00Z") - Date.parse(`${saved.world.scenario.startDate}T00:00:00Z`)) / (365.2425 * 86400000) * 48);
            saved.time.absoluteWeek = totalWeeks;
            saved.world.scenario.pendingEvent = null;
            await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), { key: storageKey, save: saved });
            await page.reload({ waitUntil: "networkidle" });
            await page.locator("#advance-week").click();
            saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
            assert.equal(saved.world.scenario.completed, true, "1 January 2026 final is saved");
            assert.equal(saved.world.scenario.final.date, "2026-01-01");
            assert.equal(saved.world.scenario.history.length, 1);
            await assertNoOverflow("2026-final");
          }
          assert.deepEqual(errors, [], `${start.id}/${start.year || ""}/${language}/${width}px browser errors`);
          await page.screenshot({ path: `${out}/${start.id}${start.year ? `-${start.year}` : ""}-${language}-${width}.png`, fullPage: true });
          results.push({ start: start.expectedDate || "present_day", seed: start.seed || null, language, width, noOverflow: true, consoleErrors: errors.length, legacy: start.id === "present_day", delayedAndFinal: start.id !== "present_day" });
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
}
console.log(JSON.stringify({ checks: results.length, results }, null, 2));
