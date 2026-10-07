// Prepared healthy-browser CI gate; local execution has not been claimed.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { captureDashboardLayout, assertReadableDashboardLayout, summarizeLayoutEntryCost } from "./tc-sim-job-start-layout.mjs";
import { readyJobStartState, pendingJobStartState } from "./tc-sim-job-start-fixture.mjs";
import { createStaticGameServer } from "./static-game-server.mjs";
import { checkedOutcomeOrigin, verifyOutcomeBuild } from "./tc-sim-job-start-target.mjs";
const { values } = parseArgs({ options: {
  serve: { type: "string" }, "base-url": { type: "string" }, production: { type: "boolean", default: false },
  "expected-root": { type: "string" }, label: { type: "string", default: "built" },
} });
assert.ok(/^[a-z0-9-]+$/.test(values.label), "safe artifact label required");
assert.ok(Boolean(values.serve) !== Boolean(values["base-url"]), "choose --serve or --base-url");
assert.ok(!values["base-url"] || values["expected-root"], "hosted checks require expected built files");
assert.ok(!values.production || (!values.serve && values["expected-root"]), "production requires expected built files");
const out = resolve(process.env.RUNNER_TEMP || "/workspace", "screenshots/tc-job-start-outcome", values.label);
mkdirSync(out, { recursive: true });
let server, browser, origin, fingerprints = [], layoutBaseline = null, layoutCostComparison = null, failure = null;
const rows = [], layoutMeasurements = [], controlMeasurements = [], shellMeasurements = [];
try {
  if (values.serve) {
    server = createStaticGameServer(values.serve);
    await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
    origin = checkedOutcomeOrigin(`http://127.0.0.1:${server.address().port}`);
  } else origin = checkedOutcomeOrigin(values["base-url"], values.production);
  fingerprints = await verifyOutcomeBuild(origin, values["expected-root"] || values.serve);
  const url = `${origin}/games/tc-sim/index.html`;
  const key = "tariklab::tc-sim:1";
  const modules = ["job-start-outcome.js", "job-start-outcome-ui.js"].map(name => `${origin}/games/tc-sim/js/${name}?v=10`);
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox"] });
  // The original CSS-only counterfactual targeted the retired dashboard DOM.
  // The life-era redesign changes that DOM, so it cannot be compared against
  // the old stylesheet. Keep all current-layout and 22 browser-case gates.
  const saveFacts = state => ({ version: state.meta.saveVersion, jobId: state.career.jobId,
    pendingJob: state.career.pendingJob, cash: state.finances.balance, energy: state.health.energy,
    stress: state.health.stress, week: state.time.absoluteWeek });
  const cases = ["tr", "en", "pl"].flatMap(language => [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ language, width, reduced, view: "dashboard" }))));
  for (const view of ["people", "finance"]) for (const width of [390, 320]) cases.push({ language: "tr", width, reduced: false, view });
  for (const {language, width, reduced, view} of cases) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, reducedMotion: reduced ? "reduce" : "no-preference" });
    const page = await context.newPage(), errors = [], external = [], dashboardLayout = [], localizedControls = [];
    const expectedControls = {
      tr: { button: "Haftayı değerlendir", time: "Zaman / odak", heading: "Zamanını nasıl kullandın?" },
      en: { button: "Review the week", time: "Time / focus", heading: "How did you use your time?" },
      pl: { button: "Podsumuj tydzień", time: "Czas / uwaga", heading: "Jak wykorzystałeś swój czas?" },
    }[language];
    const inspectControls = async phase => {
      const headingRequired = view === "dashboard" || phase.includes("reload");
      const capture = () => {
        const time = document.querySelector(".week-control > span");
        return { language: window.tlabI18n.getLang(), button: document.querySelector("#advance-week")?.textContent.trim(),
          time: time && Array.from(time.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join("").trim(),
          counter: time?.querySelector("b")?.textContent.trim(), heading: document.querySelector(".week-panel .panel-head h2")?.textContent.trim() ?? null };
      };
      try {
        await page.waitForFunction(({ expected, language, headingRequired }) => {
          const time = document.querySelector(".week-control > span");
          const label = time && Array.from(time.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join("").trim();
          return window.tlabI18n.getLang() === language && document.querySelector("#advance-week")?.textContent.trim() === expected.button && label === expected.time
            && (!headingRequired || document.querySelector(".week-panel .panel-head h2")?.textContent.trim() === expected.heading);
        }, { expected: expectedControls, language, headingRequired }, { timeout: 5000 });
      } finally {
        const actual = await page.evaluate(capture);
        localizedControls.push({ phase, ...actual });
        controlMeasurements.push({ expectedLanguage: language, width, reduced, view, phase, ...actual });
      }
      assert.equal(await page.locator("#advance-week").isVisible(), true, "translated primary control is visible");
      assert.equal(await page.locator(".week-control > span").isVisible(), true, "translated time/focus HUD is visible");
      if (headingRequired) assert.equal(await page.locator(".week-panel .panel-head h2").isVisible(), true, "translated week heading is visible");
      assert.match(localizedControls.at(-1).counter, /^\d+ \/ \d+$/, "localized HUD retains its actual usage counter");
    };
    const cacheAssets = [...modules, `${origin}/i18n/expansion-en.js`, ...(language === "pl" ? [`${origin}/i18n/pl/tc-sim.json`] : [])];
    const inspectDashboard = async phase => {
      const dom = await captureDashboardLayout(page);
      layoutMeasurements.push({ language, width, reduced, view, phase, dom });
      if (dom) dashboardLayout.push({ phase, ...assertReadableDashboardLayout(dom) });
      else assert.ok(view !== "dashboard" && !phase.includes("reload"), `dashboard missing during ${phase}`);
    };
    const assertTargetOrigin = () => assert.equal(new URL(page.url()).origin, origin, "navigation must remain at the authorized origin");
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
    }, { state: view === "dashboard" ? readyJobStartState() : pendingJobStartState(), language, key, origin });
    const dimensions = async () => {
      const d = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(d.scroll <= d.viewport, JSON.stringify(d));
    };
    await page.goto(url, { waitUntil: "networkidle" }); assertTargetOrigin();
    const coldEntry = await page.evaluate(() => ({ navigation: performance.getEntriesByType("navigation").map(r => ({ duration:r.duration,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize })), paint: performance.getEntriesByType("paint").map(r => ({name:r.name,startTime:r.startTime})), resources:performance.getEntriesByType("resource").map(r=>({name:r.name,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize})) }));
    // Control + warm, then verify exact new module URLs in a real SW cache.
    await page.evaluate(async () => { await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready; });
    await page.reload({ waitUntil: "networkidle" }); assertTargetOrigin();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    // Cache writes are asynchronous in the existing root worker; wait for the
    // observable entries rather than assuming network-idle completed the writes.
    await page.waitForFunction(async expected => {
      const urls = new Set();
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) urls.add(request.url);
      return expected.every(url => urls.has(url));
    }, cacheAssets, { timeout: 5000 });
    const cached = await page.evaluate(async expected => {
      const urls = new Set();
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) urls.add(request.url);
      return expected.map(url => ({ url, cached: urls.has(url) }));
    }, cacheAssets);
    assert.ok(cached.every(item => item.cached), `missing offline modules: ${JSON.stringify(cached)}`);
    await page.locator("#continue-game").click();
    const navigate = async nextView => {
      const target = page.locator(`[data-view="${nextView}"]`).first();
      if (!(await target.isVisible())) await page.locator(".side-nav .nav-more").click();
      await target.click();
    };
    if (view !== "dashboard") {
      await navigate(view);
      await page.locator("#advance-week").click();
    }
    const stem = `${view}-${language}-${width}-${reduced ? "reduced" : "motion"}`;
    await inspectControls("before-decision");
    await page.screenshot({ path: `${out}/${stem}-before.png`, fullPage: true });
    await inspectDashboard("before-decision");
    await page.locator('[data-event-choice="start"]').click();
    const moment = page.locator("[data-job-start-moment]");
    assert.equal(await moment.count(), 1);
    assert.equal(await moment.isVisible(), true, "result must be visible on the selected view");
    assert.equal(await moment.evaluate(el => el.parentElement.classList.contains("workspace") && !el.closest(".management-inspector, .management-deck, [hidden], [inert]")), true, "result must stay outside hidden inspectors/ledgers");
    assert.equal(await moment.getAttribute("role"), "status");
    assert.equal(await page.evaluate(() => window.tlabI18n.getLang()), language, "actual UI language matches the matrix");
    assert.equal(await moment.locator(".job-start-moment__head strong").textContent(), {tr:"İŞ BAŞLADI",en:"JOB STARTED",pl:"PRACA ROZPOCZĘTA"}[language], "actual outcome heading is translated");
    await inspectControls("after-decision");
    await dimensions();
    const close = moment.locator("[data-outcome-close]");
    assert.equal(await close.evaluate(el => document.activeElement === el), false, "moment must not steal focus");
    if (reduced) assert.equal(await moment.locator(".job-start-moment__periods > div").first().evaluate(el => getComputedStyle(el).animationName), "none");
    await page.screenshot({ path: `${out}/${stem}-after.png`, fullPage: true });
    await inspectDashboard("after-decision");
    if (!reduced && width === 390) await page.waitForFunction(() => document.querySelector("[data-job-start-moment]").classList.contains("is-settled"), null, { timeout: 4000 });
    await close.focus(); await close.press("Escape");
    assert.equal(await close.getAttribute("aria-pressed"), "true");
    assert.equal(await close.evaluate(el => document.activeElement === el), true, "close preserves keyboard focus");
    assert.equal(await moment.getAttribute("aria-live"), "off");
    await moment.locator("summary").click(); await dimensions();
    await page.setViewportSize({ width: 320, height: 844 }); await dimensions();
    await inspectDashboard("resize-320");
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 }); await dimensions();
    await page.locator("#save-game").click();
    assert.equal(await page.locator("[data-job-start-moment][role=status]").count(), 0, "save does not reannounce");
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    assert.equal(saved.career.jobId, "market"); assert.equal(saved.career.pendingJob, null);
    const resources = await page.evaluate(() => performance.getEntriesByType("resource").map(r => ({ name: r.name, transferSize: r.transferSize, encodedBodySize: r.encodedBodySize })));
    await context.setOffline(true); await page.reload({ waitUntil: "networkidle" }); assertTargetOrigin();
    await page.locator("#continue-game").click();
    assert.equal(await page.locator("[data-job-start-moment]").count(), 0, "offline reload must not replay");
    await inspectControls("offline-reload");
    await page.screenshot({ path: `${out}/${stem}-reloaded.png`, fullPage: true });
    await inspectDashboard("offline-reload");
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
    await page.reload({ waitUntil: "networkidle" }); assertTargetOrigin(); await page.locator("#continue-game").click();
    await page.locator("#save-game").click();
    const migrated = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    assert.equal(migrated.meta.saveVersion, 6);
    assert.deepEqual(saveFacts(migrated), saveFacts(saved), "synthetic v1 retains job, money and body after explicit save");
    assert.equal(await page.locator("[data-job-start-moment]").count(), 0);
    await inspectControls("synthetic-v1-reload");
    await dimensions();
    await context.setOffline(false);
    await navigate("career"); await navigate("dashboard");
    assert.equal(await page.locator("[data-job-start-moment]").count(), 0);
    if (language === "tr" && !reduced && view === "dashboard") {
      const storageBefore = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
      let shellBaseline;
      for (const menu of ["dashboard", "inbox", "character", "calendar", "finance", "market", "career", "education", "people", "relationships", "home", "body", "history", "yearbook"]) {
        await navigate(menu);
        await page.evaluate(() => window.scrollTo(0, 0));
        const geometry = await page.evaluate(() => {
          const box = selector => {
            const node = document.querySelector(selector), rect = node.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          };
          return { header: box(".game-topbar"), sidebar: box(".side-nav"), workspace: box(".workspace"), heading: box(".workspace-head h1"), regions: box(".tc-page-regions"),
            scrollbarGutter: getComputedStyle(document.documentElement).scrollbarGutter,
            headingFont: getComputedStyle(document.querySelector(".workspace-head h1")).fontSize,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            inspector: document.querySelector(".management-inspector") ? box(".management-inspector") : null };
        });
        shellMeasurements.push({ width, menu, ...geometry });
        shellBaseline ||= geometry;
        for (const [region, dimensions] of Object.entries({ header: ["x", "y", "width", "height"], sidebar: ["x", "width"], workspace: ["x", "y", "width"], heading: ["x", "y"], regions: ["x", "width"] }))
          for (const dimension of dimensions) assert.ok(Math.abs(geometry[region][dimension] - shellBaseline[region][dimension]) <= 1, `${width}/${menu}: ${region}.${dimension} shifted`);
        if (width === 1440) assert.equal(geometry.scrollbarGutter, "stable", "Desktop reserves native scrollbar space even on short menus");
        assert.equal(geometry.headingFont, shellBaseline.headingFont, `${menu}: heading hierarchy shifted`);
        assert.ok(geometry.overflow <= 1, `${width}/${menu}: horizontal overflow`);
        if (width === 1440 && geometry.inspector) assert.equal(geometry.inspector.width, 320, `${menu}: canonical detail width`);
        await page.screenshot({ path: `${out}/shell-${width}-${menu}.png`, fullPage: false });
      }
      assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage)))), storageBefore, "Shell navigation must not mutate save data");
      await navigate("dashboard");
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    rows.push({ language, width, reduced, view, dashboardLayout, localizedControls, coldEntry, status: "PASS", cached, resources, offlineSaveFacts: saveFacts(offlineSaved), syntheticV1SaveFacts: saveFacts(migrated) });
    await context.close();
  }
  if (layoutBaseline) {
    const sample=rows.find(row=>row.language==="tr"&&row.width===1440&&!row.reduced&&row.view==="dashboard");
    assert.ok(sample,"matching candidate entry sample required");
    const before=layoutBaseline.entryCost,after=summarizeLayoutEntryCost(sample.coldEntry);
    layoutCostComparison={scope:"Single TR/1440/no-preference cold-entry sample per fresh context in the same Chromium process, same uncompressed no-store localhost server; only stylesheet differs. ResourceTiming totals, not production TLS/FMP or a speed claim. Separate 9e50404 comparison includes the earlier job-outcome change and is not this CSS fix's delta.",before,after,delta:Object.fromEntries(Object.keys(before).map(key=>[key,after[key]-before[key]]))};
  }
} catch (error) { failure = error.stack || String(error); throw error; }
finally {
  await browser?.close();
  if (server) await new Promise(done => server.close(done));
  writeFileSync(`${out}/results.json`, JSON.stringify({ origin, fingerprints, layoutBaseline, layoutCostComparison, layoutMeasurements, controlMeasurements, shellMeasurements, status: failure ? "FAIL" : "PASS", failure, expectedCases: 22, rows, performance: "Candidate cold entry only; before/after comparison remains unmeasured." }, null, 2) + "\n");
}
