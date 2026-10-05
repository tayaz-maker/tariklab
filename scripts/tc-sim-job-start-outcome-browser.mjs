// Prepared gate, deliberately NOT RUN in the Chrome SIGSEGV environment.
// Serve the intended build first. Explicit local origin prevents accidental production fixtures.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { readyJobStartState } from "./tc-sim-job-start-fixture.mjs";
const base = process.env.TC_JOB_START_BASE_URL;
if (process.env.RUN_TC_JOB_START_BROWSER !== "1" || !base)
  throw new Error("Prepared but not run: set RUN_TC_JOB_START_BROWSER=1 and TC_JOB_START_BASE_URL to a served local build after Chrome is usable.");
const origin = new URL(base).origin;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "synthetic saves are local-only");
const url = `${origin}/games/tc-sim/index.html`;
const out = process.env.TC_JOB_START_SCREENSHOTS || "/workspace/screenshots/tc-job-start-outcome";
mkdirSync(out, { recursive: true });
const key = "tariklab::tc-sim:1";
const modules = ["job-start-outcome.js", "job-start-outcome-ui.js"].map(name => `${origin}/games/tc-sim/js/${name}?v=1`);
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox"] });
const rows = [];
const saveFacts = state => ({ version: state.meta.saveVersion, jobId: state.career.jobId,
  pendingJob: state.career.pendingJob, cash: state.finances.balance, energy: state.health.energy,
  stress: state.health.stress, week: state.time.absoluteWeek });
try {
  for (const language of ["tr", "en", "pl"]) for (const width of [1440, 390, 320]) for (const reduced of [false, true]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, reducedMotion: reduced ? "reduce" : "no-preference" });
    const page = await context.newPage(), errors = [], external = [];
    const assertLocalOrigin = () => assert.equal(new URL(page.url()).origin, origin, "navigation must remain local");
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    page.on("request", request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) external.push(request.url()); });
    await context.addInitScript(({ state, language, key, origin }) => {
      if (location.origin !== origin) return;
      if (!localStorage.getItem("tc-job-fixture-seeded")) {
        localStorage.setItem(key, JSON.stringify(state));
        localStorage.setItem("tariklab::tc-sim:active", "1");
        localStorage.setItem("tc-job-fixture-seeded", "1");
      }
      localStorage.setItem("tariklab.language", language);
    }, { state: readyJobStartState(), language, key, origin });
    const dimensions = async () => {
      const d = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(d.scroll <= d.viewport, JSON.stringify(d));
    };
    await page.goto(url, { waitUntil: "networkidle" }); assertLocalOrigin();
    // Control + warm, then verify exact new module URLs in a real SW cache.
    await page.evaluate(async () => { await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready; });
    await page.reload({ waitUntil: "networkidle" }); assertLocalOrigin();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    const cached = await page.evaluate(async expected => {
      const urls = new Set();
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) urls.add(request.url);
      return expected.map(url => ({ url, cached: urls.has(url) }));
    }, modules);
    assert.ok(cached.every(item => item.cached), `missing offline modules: ${JSON.stringify(cached)}`);
    await page.locator("#continue-game").click();
    const stem = `${language}-${width}-${reduced ? "reduced" : "motion"}`;
    await page.screenshot({ path: `${out}/${stem}-before.png`, fullPage: true });
    await page.locator('[data-event-choice="start"]').click();
    const moment = page.locator("[data-job-start-moment]");
    assert.equal(await moment.count(), 1);
    assert.equal(await moment.getAttribute("role"), "status");
    await dimensions();
    const close = moment.locator("[data-outcome-close]");
    assert.equal(await close.evaluate(el => document.activeElement === el), false, "moment must not steal focus");
    if (reduced) assert.equal(await moment.locator(".job-start-moment__periods > div").first().evaluate(el => getComputedStyle(el).animationName), "none");
    await page.screenshot({ path: `${out}/${stem}-after.png`, fullPage: true });
    if (!reduced && width === 390) await page.waitForFunction(() => document.querySelector("[data-job-start-moment]").classList.contains("is-settled"), null, { timeout: 4000 });
    await close.focus(); await close.press("Escape");
    assert.equal(await close.getAttribute("aria-pressed"), "true");
    assert.equal(await close.evaluate(el => document.activeElement === el), true, "close preserves keyboard focus");
    assert.equal(await moment.getAttribute("aria-live"), "off");
    await moment.locator("summary").click(); await dimensions();
    await page.setViewportSize({ width: 320, height: 844 }); await dimensions();
    await page.locator("#save-game").click();
    assert.equal(await page.locator("[data-job-start-moment][role=status]").count(), 0, "save does not reannounce");
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    assert.equal(saved.career.jobId, "market"); assert.equal(saved.career.pendingJob, null);
    const resources = await page.evaluate(() => performance.getEntriesByType("resource").map(r => ({ name: r.name, transferSize: r.transferSize, encodedBodySize: r.encodedBodySize })));
    await context.setOffline(true); await page.reload({ waitUntil: "networkidle" }); assertLocalOrigin();
    await page.locator("#continue-game").click();
    assert.equal(await page.locator("[data-job-start-moment]").count(), 0, "offline reload must not replay");
    await page.locator("#save-game").click();
    const offlineSaved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    assert.deepEqual(saveFacts(offlineSaved), saveFacts(saved), "offline loaded game retains actual saved values");
    await dimensions();
    // Synthetic v1 fixture, not an archived historical save: offline migration and no replay.
    await page.evaluate(({ saved, key }) => {
      saved.meta.saveVersion = 1;
      localStorage.removeItem(key); localStorage.removeItem(key + ":bak");
      localStorage.removeItem("tariklab::tc-sim:legacy-migrated");
      localStorage.removeItem("tc-sim-save-backup");
      localStorage.setItem("tc-sim-save", JSON.stringify(saved));
    }, { saved, key });
    await page.reload({ waitUntil: "networkidle" }); assertLocalOrigin(); await page.locator("#continue-game").click();
    await page.locator("#save-game").click();
    const migrated = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    assert.equal(migrated.meta.saveVersion, 6);
    assert.deepEqual(saveFacts(migrated), saveFacts(saved), "synthetic v1 retains job, money and body after explicit save");
    assert.equal(await page.locator("[data-job-start-moment]").count(), 0);
    await dimensions();
    await context.setOffline(false);
    await page.locator('[data-view="career"]').click(); await page.locator('[data-view="dashboard"]').click();
    assert.equal(await page.locator("[data-job-start-moment]").count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    rows.push({ language, width, reduced, status: "PASS", cached, resources, offlineSaveFacts: saveFacts(offlineSaved), syntheticV1SaveFacts: saveFacts(migrated) });
    await context.close();
  }
} finally { await browser.close(); writeFileSync(`${out}/results.json`, JSON.stringify(rows, null, 2) + "\n"); }
