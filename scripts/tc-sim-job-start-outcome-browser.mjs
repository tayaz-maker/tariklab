import {getMonthlyEmploymentIncome,getWeeklyLifeLoad} from '../public/games/tc-sim/js/life.js';
import {riskFight} from '../public/games/tc-sim/js/risk-layer.js';
import {settleHouseholdEvents} from './tc-sim-longrun.mjs';
import {advanceWeek} from '../public/games/tc-sim/js/time.js';
import { createSocialObligation } from "../public/games/tc-sim/js/social.js";
import { processDueOpenCases, activateNextEvent } from "../public/games/tc-sim/js/events.js";

import { createPersonalDebt } from "../public/games/tc-sim/js/social.js";
import { applyWeeklyLifeLoad } from "../public/games/tc-sim/js/life.js";
import { openIcraNotice, claimOf, payIcra } from "../public/games/tc-sim/js/icra.js";
import { recordBankMonth } from "../public/games/tc-sim/js/bank-record.js";
import { createNewGame } from "../public/games/tc-sim/js/state.js";
import { buyVehicle,buyProperty,processWealthMonthEnd } from "../public/games/tc-sim/js/wealth.js";
import { mortgageText } from "../public/games/tc-sim/js/mortgage.js";
import {cityFixture} from './tc-sim-city-fixture.mjs';
import { marriageFixture } from "./tc-sim-marriage-fixture.mjs";
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
    const cacheAssets = [...modules, `${origin}/games/tc-sim/js/bank-record.js?v=10`, `${origin}/games/tc-sim/js/banks-presentation.js?v=10`, `${origin}/i18n/expansion-en.js`, ...(language === "pl" ? [`${origin}/i18n/pl/tc-sim.json`] : [])];
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
    // Read-only bank history stays localized/reachable in the existing finance
    // panel, at each matrix width and language, without writing a save.
    const bankStorageBefore = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
    await navigate("banks");
    const bankStatus = page.locator("[data-bank-record]");
    await bankStatus.scrollIntoViewIfNeeded();
    assert.equal(await bankStatus.isVisible(), true);
    assert.match(await bankStatus.textContent(), { tr: /Banka sicili/, en: /Bank history/, pl: /Historia bankowa/ }[language]);
    assert.match(await bankStatus.textContent(), /0–100/);
    await dimensions();
    assert.equal(await page.locator('[data-view="banks"][aria-current="page"]').count(), 1);
    assert.ok(await page.locator("[data-credit]").count() > 0);
    assert.ok(await page.locator('[data-wealth-action="invest-buy"]').count() > 0);
    if (width === 1440 && !reduced) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await dimensions();
      assert.equal(await bankStatus.isVisible(), true);
      await page.screenshot({ path: `${out}/${stem}-bank-1280.png`, fullPage: true });
      await page.setViewportSize({ width, height: 900 });
    }
    await navigate("finance");
    assert.equal(await page.locator("[data-credit], [data-repay-credit], [data-exchange], [data-wealth-action^='invest-']").count(), 0, "bank transaction controls appear only in Banks");
    assert.ok(await page.locator(".wealth-summary").count() > 0, "accounting summary remains in Money");
    if (!(await page.locator('[data-view="banks"]').first().isVisible())) await page.locator(".side-nav .nav-more").click();
    await page.locator('[data-view="banks"]').first().focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("[data-bank-account]").count(), 1, "bank navigation works by keyboard");
    await page.screenshot({ path: `${out}/${stem}-bank-history.png`, fullPage: true });
    assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage)))), bankStorageBefore, "bank history presentation never writes a save");
    await navigate(view);
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
      for (const menu of ["dashboard", "inbox", "character", "calendar", "finance", "banks", "market", "career", "education", "people", "relationships", "home", "body", "history", "yearbook"]) {
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
        if (menu === "body") {
          for (const [id, label] of [["head","Baş"],["chest","Göğüs"],["abdomen","Karın"],["back","Sırt"],["arms","Kollar"],["legs","Bacaklar"]]) {
            await page.locator(`#body-region-${id}`).click();
            assert.equal(await page.locator("#tc-body-region-title").textContent(), label);
            assert.equal(await page.locator(`#body-region-${id}`).getAttribute("aria-pressed"), "true");
          }
          await page.locator('.tc-body-figure [data-body-region="head"]').focus();
          await page.keyboard.press("Enter");
          assert.equal(await page.locator("#tc-body-region-title").textContent(), "Baş");
          await page.locator("#body-region-back").click();
          assert.match(await page.locator(".tc-body-figure").getAttribute("aria-label"), /Arkadan/);
          await page.locator("#body-region-chest").click();
          assert.equal(await page.locator('.tc-body-actions [data-decision="rest"]').count(), 1);
          assert.equal(await page.locator('.tc-body-actions [data-decision="exercise"]').count(), 1);
          assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage)))), storageBefore, "Body selection never writes a save");
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: `${out}/body-interaction-${width}.png`, fullPage: true });
        }
        if (width === 1440 && menu === "career") {
          await page.locator(".desk-row").last().click();
          const detailBox = await page.locator(".management-inspector").boundingBox();
          // Sticky panels legitimately meet their parent's bottom boundary.
          // Verify reachability of the real action, not an always-visible header.
          assert.ok(detailBox && detailBox.y < 900 && detailBox.y + detailBox.height > 0, "Detail region remains reachable after selecting the last job");
          const action = page.locator(".desk-record:not([hidden]) button").last();
          await action.scrollIntoViewIfNeeded();
          const actionBox = await action.boundingBox();
          assert.ok(actionBox && actionBox.y >= 0 && actionBox.y + actionBox.height <= 901, "Selected job action is reachable within the viewport");
          shellMeasurements.at(-1).deepList = { detailBox, actionBox };
          await page.screenshot({ path: `${out}/shell-${width}-career-detail.png`, fullPage: false });
        }
      }
      assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage)))), storageBefore, "Shell navigation must not mutate save data");
      await navigate("dashboard");
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    rows.push({ language, width, reduced, view, dashboardLayout, localizedControls, coldEntry, status: "PASS", cached, resources, offlineSaveFacts: saveFacts(offlineSaved), syntheticV1SaveFacts: saveFacts(migrated) });
    await context.close();
  }
  // Isolated synthetic household save: UI entry, costs, real event dispatch and persistence.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.addInitScript(({state,key,origin}) => {
      if (location.origin !== origin || localStorage.getItem("marriage-fixture-seeded")) return;
      localStorage.setItem(key, JSON.stringify(state)); localStorage.setItem("tariklab::tc-sim:active", "1");
      localStorage.setItem("tariklab.language", "tr");localStorage.setItem("marriage-fixture-seeded", "1");
    }, {state:marriageFixture(),key,origin});
    await page.goto(url, {waitUntil:"networkidle"});
    await page.locator("#continue-game").click();
    await page.locator('.side-nav [data-view="relationships"]').click();
    await page.getByText("Evlilik bütçesini karşılaştır", {exact:true}).click();
    assert.ok((await page.locator(".option-card").allTextContents()).some(text=>text.includes("toplam geri ödeme")));
    await page.locator('[data-household-conversation="household_families"]').click();
    assert.equal(await page.locator("#event-title").textContent(), "Ailelerle aynı sofrada");
    await page.locator('[data-event-choice="informal"]').click();
    const saved = await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.ok(saved.household.wedding.familiesMet);
    assert.equal(saved.household.union.marriedSince,null);
    assert.ok(saved.weekly.selectedIds.includes("household:household_families"));
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const loaded=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.deepEqual(loaded.household.wedding,saved.household.wedding);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`${out}/marriage-interaction-1440.png`,fullPage:false});
    rows.push({view:"marriage",width:1440,status:"PASS",familiesMet:saved.household.wedding.familiesMet});
    await context.close();
  }
  // Location explorer uses the existing EV view; navigation itself must not mutate a save.
  {
    const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await context.addInitScript(({state,key,origin})=>{if(location.origin!==origin||localStorage.getItem('city-fixture-seeded'))return;localStorage.setItem(key,JSON.stringify(state));localStorage.setItem('tariklab::tc-sim:active','1');localStorage.setItem('tariklab.language','tr');localStorage.setItem('city-fixture-seeded','1');},{state:cityFixture(),key,origin});
    await page.goto(url,{waitUntil:'networkidle'});await page.locator('#continue-game').click();await page.locator('.side-nav [data-view="home"]').click();
    const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    await page.locator('[data-location-city="ankara"]').click();await page.locator('[data-location-select="batikent"]').click();
    assert.ok((await page.locator('.location-panel').textContent()).includes('Mevcut işin bu şehirde'));
    assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),before);
    await page.locator('[data-location-city="istanbul"]').click();await page.locator('[data-location-select="avcilar"]').click();
    await page.locator('[data-location-move="avcilar"][data-location-home="shared"]').click();
    assert.match(await page.locator('.result[role="status"]').last().textContent(),/Cüzdanın:.*Aylık konut giderin/);
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(saved.household.location.districtId,'avcilar');assert.equal(saved.weekly.used-before.weekly.used,2);assert.ok(saved.finances.balance<before.finances.balance);
    await page.reload({waitUntil:'networkidle'});await page.locator('#continue-game').click();await page.locator('.side-nav [data-view="home"]').click();
    assert.equal(await page.locator('[data-location-select="avcilar"]').getAttribute('aria-pressed'),'true');
    assert.ok((await page.locator('.location-panel').textContent()).includes('EVİN'));assert.deepEqual(errors,[]);
    await page.screenshot({path:`${out}/city-interaction-1440.png`,fullPage:false});rows.push({view:'city',width:1440,status:'PASS'});await context.close();
  }
  for (const language of ["tr", "en", "pl"]) for (const width of [1280, 390]) {
    const fixture = createNewGame({seed:17}); fixture.finances.balance = 1000000;
    fixture.events.active = null; fixture.events.queue = [];
    applyWeeklyLifeLoad(fixture);
    assert.ok(buyProperty(fixture, "owner", true).ok);
    fixture.time.absoluteWeek += 1; fixture.weekly = {used:0, selectedIds:[]};
    const context = await browser.newContext({viewport:{width,height:844}}), page = await context.newPage(), errors=[];
    page.on("pageerror", error => errors.push(error.message));
    await context.addInitScript(({state,key,origin,language}) => {
      if(location.origin !== origin || localStorage.getItem("mortgage-fixture")) return;
      localStorage.setItem(key,JSON.stringify(state));localStorage.setItem("tariklab::tc-sim:active","1");
      localStorage.setItem("tariklab.language",language);localStorage.setItem("mortgage-fixture","1");
    }, {state:fixture,key,origin,language});
    await page.goto(url,{waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const banks = page.locator('.side-nav [data-view="banks"]');
    if(!(await banks.isVisible())) await page.locator(".side-nav .nav-more").click();
    await banks.click();
    const panel = page.locator("[data-mortgage-panel]");
    assert.ok((await panel.innerText()).includes(mortgageText("note",language)));
    await panel.locator('[data-wealth-action="mortgage-extra"]').click();
    const saved = await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(saved.finances.balance,851000);assert.equal(saved.wealth.debts[0].principal,331000);
    assert.equal(saved.wealth.debts[0].mortgage.interestAccrued,0);assert.equal(saved.meta.saveVersion,6);
    const dimensions = await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dimensions.scroll<=dimensions.width);
    await panel.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/mortgage-${language}-${width}.png`});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const loaded = await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(loaded.finances.balance,saved.finances.balance);assert.deepEqual(loaded.wealth.debts,saved.wealth.debts);
    // Isolated historical-credit fixture: rating affects actual bank buttons,
    // without charging cash or changing the already-running mortgage.
    recordBankMonth(loaded,"default");
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:loaded,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const bankNav = page.locator('.side-nav [data-view="banks"]');
    if(!(await bankNav.isVisible())) await page.locator(".side-nav .nav-more").click();
    await bankNav.click();
    const restricted = page.locator('[data-credit="medium"]');
    assert.equal(await restricted.isDisabled(),true);assert.match(await restricted.getAttribute("title"),/40/);
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).finances.balance,key),saved.finances.balance);
    assert.deepEqual(errors,[]);rows.push({view:"mortgage",language,width,status:"PASS"});
    const careerNav=page.locator('.side-nav [data-view="career"]');
    if(!(await careerNav.isVisible())) await page.locator(".side-nav .nav-more").click();
    await careerNav.click();
    const insurance=page.locator('[data-social-insurance]');
    assert.equal(await insurance.count(),1);
    assert.ok((await insurance.innerText()).includes(["SGK / gözlenen çalışma","Social insurance / observed work","Ubezpieczenie społeczne / zaobserwowana praca"][["tr","en","pl"].indexOf(language)]));
    const insuredSave=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(insuredSave.flags.socialInsurance.coveredWeeks,1);
    const modeledDays=insuredSave.time.year>=2020 ? 8 : 0;
    assert.equal(insuredSave.flags.socialInsurance.service.days,modeledDays);
    assert.equal(await page.locator('[data-insurance-service]').count(),1);
    assert.equal(insuredSave.finances.balance,saved.finances.balance);
    const insuranceBounds=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
    assert.ok(insuranceBounds.s<=insuranceBounds.w);
    await insurance.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/social-insurance-${language}-${width}.png`});
    rows.push({view:"social-insurance",language,width,status:"PASS"});
    loaded.finances.arrears=4000; openIcraNotice(loaded,{source:"temerrut",amount:4000});
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:loaded,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    await page.locator('.side-nav [data-view="dashboard"]').click();
    const wage=page.locator('[data-decision="icra-wage"]');
    assert.ok((await wage.innerText()).includes(["Maaştan tahsilata bağla","Arrange wage collection","Ustal potrącenia z pensji"][["tr","en","pl"].indexOf(language)]));
    await wage.click();
    const ordered=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    const wageCase=ordered.openCases.find(c=>c.type==="icra"&&c.status==="pending");
    assert.equal(wageCase.payload.stage,"wage");assert.equal(wageCase.payload.wage.paid,0);
    assert.equal(ordered.finances.balance,loaded.finances.balance);assert.equal(ordered.finances.arrears,4000);
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const reloadedOrder=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(reloadedOrder.openCases.find(c=>c.type==="icra"&&c.status==="pending").payload.stage,"wage");
    const wageBounds=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
    assert.ok(wageBounds.s<=wageBounds.w);assert.deepEqual(errors,[]);
    await page.screenshot({path:`${out}/wage-order-${language}-${width}.png`});
    rows.push({view:"wage-order",language,width,status:"PASS"});
    // Restore the original independent notice for the existing objection scenario.
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:loaded,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    await page.locator('.side-nav [data-view="dashboard"]').click();
    const automatic=structuredClone(loaded);
    automatic.openCases.find(c=>c.type==="icra"&&c.status==="pending").dueWeek=automatic.time.absoluteWeek+1;
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:automatic,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    await page.locator("#advance-week").click();
    const attached=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    const attachedCase=attached.openCases.find(c=>c.type==="icra"&&c.status==="pending");
    assert.equal(attachedCase.payload.stage,"wage");assert.equal(attachedCase.payload.wage.compulsory,true);
    assert.equal(attachedCase.payload.wage.paid,0);
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const attachedReload=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(attachedReload.openCases.find(c=>c.id===attachedCase.id).payload.wage.compulsory,true);
    assert.deepEqual(errors,[]);rows.push({view:"compulsory-wage",language,width,status:"PASS"});
    await page.screenshot({path:`${out}/compulsory-wage-${language}-${width}.png`});
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:loaded,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    await page.locator('.side-nav [data-view="dashboard"]').click();
    const objection=page.locator('[data-decision="icra-object"]');
    assert.ok((await objection.innerText()).includes(["Borç dökümüne itiraz et","Dispute the debt statement","Zakwestionuj zestawienie długu"][["tr","en","pl"].indexOf(language)]));
    await objection.click();
    const reviewed=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(reviewed.finances.balance,loaded.finances.balance-300);
    assert.equal(reviewed.finances.arrears,4000);
    assert.equal(reviewed.openCases.find(c=>c.type==="icra").payload.stage,"court");
    assert.equal(await page.locator('[data-decision="icra-object"]').count(),0);
    const bounds=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
    assert.ok(bounds.s<=bounds.w);
    await page.screenshot({path:`${out}/court-review-${language}-${width}.png`});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    // The objection legitimately activates this fixture's next event. Reload
    // preserves that modal; finish it through its real choice, not the backdrop.
    assert.equal(reviewed.events.active.eventId,"family_late_night");
    assert.equal(await page.locator('.event-card[role="dialog"]').isVisible(),true);
    await page.locator('[data-event-choice="truth"]').click();
    assert.equal(await page.locator('.event-backdrop').count(),0);
    const afterEvent=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(afterEvent.events.history.at(-1).occurrenceId,reviewed.events.active.occurrenceId);
    assert.equal(afterEvent.events.history.at(-1).choiceId,"truth");
    assert.equal(afterEvent.finances.balance,reviewed.finances.balance);
    assert.equal(afterEvent.finances.arrears,4000);
    await page.locator('.side-nav [data-view="dashboard"]').click();
    assert.equal(await page.locator('[data-decision="icra-object"]').count(),0);
    await page.locator('[data-decision="icra-pay"]').click();
    const settled=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(settled.finances.balance,reviewed.finances.balance-4000);
    assert.equal(settled.finances.arrears,0);assert.equal(settled.meta.saveVersion,6);
    assert.equal(settled.openCases.find(c=>c.type==="icra").payload.review.status,"settled");
    assert.deepEqual(errors,[]);rows.push({view:"court-review",language,width,status:"PASS"});
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:loaded,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    await page.locator('.side-nav [data-view="dashboard"]').click();
    const inspect=page.locator('[data-decision="icra-evidence"]');
    assert.ok((await inspect.innerText()).includes(["Borç dosyasını incele","Inspect debt evidence","Sprawdź dokumentację długu"][["tr","en","pl"].indexOf(language)]));
    await inspect.click();
    const evidenceSave=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(evidenceSave.openCases.find(c=>c.type==="icra"&&c.status==="pending").payload.evidence.backing,4000);
    assert.equal(evidenceSave.finances.balance,loaded.finances.balance);
    assert.equal(await page.locator('[data-icra-evidence]').count(),1);
    assert.ok((await page.locator('[data-icra-evidence]').innerText()).includes(["Dosya delili","Case evidence","Dokumentacja sprawy"][["tr","en","pl"].indexOf(language)]));
    if(await page.locator('.event-backdrop').count()){
      assert.equal(evidenceSave.events.active.eventId,"family_late_night");
      await page.locator('[data-event-choice="truth"]').click();
    }
    await page.locator('[data-decision="icra-counsel"]').click();
    const counselSave=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(counselSave.finances.balance,loaded.finances.balance-500);
    assert.equal(counselSave.openCases.find(c=>c.type==="icra"&&c.status==="pending").payload.counsel.fee,500);
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const counselReload=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(counselReload.finances.balance,counselSave.finances.balance);
    assert.equal(await page.locator('[data-decision="icra-counsel"]').count(),0);
    assert.deepEqual(errors,[]);rows.push({view:"court-evidence-counsel",language,width,status:"PASS"});
    await page.screenshot({path:`${out}/court-evidence-counsel-${language}-${width}.png`});
    const forced=createNewGame({seed:17});forced.finances.balance=1000000;forced.events.active=null;forced.events.queue=[];
    assert.ok(buyProperty(forced,"owner",true).ok);
    for(let i=0;i<3;i++){forced.finances.balance=0;processWealthMonthEnd(forced);forced.time.absoluteWeek+=4;forced.weekly={used:0,selectedIds:[]};}
    forced.finances.balance=0;forced.wealth.properties[0].currentValue=100000;
    openIcraNotice(forced,{source:"mortgage",amount:forced.wealth.debts[0].principal,loanId:forced.wealth.debts[0].id});
    forced.finances.arrears=50000;
    const forcedBalance=forced.wealth.debts[0].principal+forced.wealth.debts[0].mortgage.interestDue;
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:forced,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    await page.locator('[data-decision="icra-ignore"]').click();
    const lost=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(lost.wealth.properties.length,0);assert.equal(lost.wealth.debts.length,0);
    assert.equal(lost.finances.arrears,300000);assert.equal(lost.finances.balance,-(forcedBalance-80000+50000-300000));
    assert.equal(lost.openCases.find(c=>c.type==="icra").payload.settlement.proceeds,80000);
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const reloadedLoss=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(reloadedLoss.finances.balance,lost.finances.balance);assert.equal(reloadedLoss.wealth.properties.length,0);
    assert.deepEqual(errors,[]);rows.push({view:"mortgage-enforcement",language,width,status:"PASS"});
    const friend=createNewGame({seed:17});friend.events.queue=[];
    friend.finances.balance-=1000;createPersonalDebt(friend,"mehmet",1000,4,"lent_1000");
    friend.time.absoluteWeek+=4;
    friend.events.active={eventId:"mehmet_debt_story",occurrenceId:"partial-debt-browser"};
    const friendBalance=friend.finances.balance;
    const friendTrust=friend.people.find(p=>p.id==="mehmet").social.trust;
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:friend,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const debtCopy={tr:"Sana borcum duruyor, unutmadım.",en:"I still owe you; I haven't forgotten.",pl:"Nadal jestem ci winien pieniądze."}[language];
    await page.getByText(debtCopy,{exact:false}).waitFor({state:"visible"});
    await page.locator('[data-event-choice="collect"]').click();
    const collected=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(collected.finances.balance,friendBalance+1000);
    assert.equal(collected.people.find(p=>p.id==="mehmet").social.trust,friendTrust);
    assert.ok(collected.people.find(p=>p.id==="mehmet").memories.some(m=>m.type==="debt_collected"));
    assert.equal(collected.openCases.filter(c=>c.type==="personal-debt"&&c.status!=="resolved").length,0);
    assert.equal(collected.openCases.filter(c=>c.eventId==="debt_elif_comment").length,1);
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    assert.equal(await page.locator('[data-event-choice="collect"]').count(),0);
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).finances.balance,key),friendBalance+1000);
    assert.deepEqual(errors,[]);rows.push({view:"partial-friend-debt",language,width,status:"PASS"});
    await page.screenshot({path:`${out}/partial-friend-debt-${language}-${width}.png`});await context.close();
  }
  // Existing Body action, authored recovery copy, persisted state and mobile layout.
  for (const language of ["tr", "en", "pl"]) for (const width of [1280, 390]) {
    const state=createNewGame({seed:17});state.finances.balance=10000;
    state.health.health=12;state.health.energy=80;state.health.stress=30;state.events.active=null;state.events.queue=[];
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await context.addInitScript(({state,key,origin,language})=>{
      if(location.origin!==origin||localStorage.getItem("work-recovery-fixture"))return;
      localStorage.setItem(key,JSON.stringify(state));localStorage.setItem("tariklab::tc-sim:active","1");
      localStorage.setItem("tariklab.language",language);localStorage.setItem("work-recovery-fixture","1");
    },{state,key,origin,language});
    await page.goto(url,{waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const body=page.locator('.side-nav [data-view="body"]');
    if(!(await body.isVisible()))await page.locator('.side-nav .nav-more').click();
    await body.click();await page.locator('.tc-body-actions [data-decision="body-care"]').click();
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(saved.finances.balance,9700);assert.equal(saved.body.workRecovery.untilWeek,saved.body.workRecovery.startWeek+2);
    assert.equal(saved.meta.saveVersion,6);
    await page.locator('[data-event-choice="clinic"]').click();
    const afterClinic=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(afterClinic.finances.balance,9450);
    assert.equal(afterClinic.events.active?.eventId,"job_security_warning");
    await page.locator('[data-event-choice="recover"]').click();
    await page.locator('.event-backdrop').waitFor({state:"hidden"});
    const settled=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(settled.events.active,null);assert.equal(settled.finances.balance,9450);
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    if(!(await body.isVisible()))await page.locator('.side-nav .nav-more').click();await body.click();
    const copy=["Bu bir oyun toparlanma planıdır.","This is a game recovery plan.","To model regeneracji w grze."][["tr","en","pl"].indexOf(language)];
    assert.ok((await page.locator(".workspace").innerText()).includes(copy));
    const reloaded=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.deepEqual(reloaded.body.workRecovery,saved.body.workRecovery);assert.equal(reloaded.finances.balance,9450);
    const bounds=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
    assert.ok(bounds.s<=bounds.w);assert.deepEqual(errors,[]);
    await page.screenshot({path:`${out}/work-recovery-${language}-${width}.png`});rows.push({view:"work-recovery",language,width,status:"PASS"});
    for(const kept of [true,false]) {
      const promise=createNewGame({seed:17});promise.events.active=null;promise.events.queue=[];promise.finances.balance=10000;
      createSocialObligation(promise,"mehmet");
      const promiseCase=promise.openCases.find(c=>c.type==="social-obligation");
      if(!kept){promise.time.absoluteWeek=promiseCase.dueWeek;processDueOpenCases(promise);activateNextEvent(promise);}
      await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:promise,key});
      await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
      if(kept){
        const people=page.locator('.side-nav [data-view="people"]');
        if(!(await people.isVisible()))await page.locator('.side-nav .nav-more').click();
        await people.click();await page.locator('[data-person="mehmet"]').click();
        await page.locator('[data-social-action="fulfill_promise"][data-person-id="mehmet"]').click();
      } else await page.locator('[data-event-choice="acknowledge"]').click();
      const resolvedPromise=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
      const evidence=resolvedPromise.reputation.evidence.filter(e=>e.source===promiseCase.id);
      assert.equal(evidence.length,1);assert.equal(evidence[0].circle,"friends");assert.equal(evidence[0].signal,kept?"reliable":"unreliable");
      assert.ok(resolvedPromise.people.find(p=>p.id==="mehmet").memories.some(m=>m.type===(kept?"promise_kept":"promise_broken")));
      assert.equal(resolvedPromise.finances.balance,kept?9700:10000);
      await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
      const persistedPromise=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
      assert.equal(persistedPromise.reputation.evidence.filter(e=>e.source===promiseCase.id).length,1);
      assert.equal(persistedPromise.finances.balance,resolvedPromise.finances.balance);
      assert.deepEqual(errors,[]);rows.push({view:kept?"promise-kept-reputation":"promise-broken-reputation",language,width,status:"PASS"});
    }
    const fuelState=createNewGame({seed:17});fuelState.events.active=null;fuelState.events.queue=[];
    if(fuelState.world?.scenario)fuelState.world.scenario.pendingEvent=null;
    fuelState.finances.balance=300000;fuelState.household.homeId="studio";
    fuelState.household.location={districtId:"avcilar",lastMoveWeek:0};
    assert.equal(buyVehicle(fuelState,"used",false).ok,true);
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:fuelState,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    await page.locator("#advance-week").click();
    const fuelPaid=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    const fuelRows=fuelPaid.finances.ledger.filter(r=>r.category==="vehicle-fuel");
    assert.equal(fuelRows.length,1);assert.equal(fuelRows[0].amount,-480);
    assert.equal(fuelRows[0].reason,{tr:"İşe gidiş yakıtı",en:"Work commute fuel",pl:"Paliwo na dojazd do pracy"}[language]);
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const fuelReload=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(fuelReload.finances.ledger.filter(r=>r.category==="vehicle-fuel").length,1);
    assert.equal(fuelReload.finances.balance,fuelPaid.finances.balance);
    assert.deepEqual(errors,[]);rows.push({view:"vehicle-work-fuel",language,width,status:"PASS"});
    const court=createNewGame({seed:17});court.events.active=null;court.events.queue=[];
    if(court.world?.scenario)court.world.scenario.pendingEvent=null;
    court.health.stress=60;court.finances.balance=20000;assert.equal(riskFight(court).ok,true);
    court.time.absoluteWeek=5;processDueOpenCases(court);activateNextEvent(court);
    assert.equal(court.events.active.eventId,"criminal_hearing");
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:court,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    await page.locator('[data-event-choice="review"]').click();
    const reviewed=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(reviewed.flags.criminalJustice?.records?.length||0,0);
    for(let i=0;i<2;i++){settleHouseholdEvents(reviewed);assert.equal(advanceWeek(reviewed).ok,true);}
    assert.equal(reviewed.events.active.eventId,"criminal_verdict");
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:reviewed,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    assert.ok((await page.locator('.event-backdrop').innerText()).includes(["Kavga dosyasında kesin karar","Final decision in the fight case","Ostateczne rozstrzygnięcie w sprawie bójki"][["tr","en","pl"].indexOf(language)]));
    await page.locator('[data-event-choice="acknowledge"]').click();
    const decided=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(decided.flags.criminalJustice.records.length,1);assert.equal(decided.finances.balance,reviewed.finances.balance);
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const courtReloaded=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(courtReloaded.flags.criminalJustice.records.length,1);assert.equal(courtReloaded.finances.balance,decided.finances.balance);
    const repeated=structuredClone(courtReloaded);settleHouseholdEvents(repeated);
    const firstClaim=claimOf(repeated);assert.ok(firstClaim);openIcraNotice(repeated,firstClaim);assert.equal(payIcra(repeated).ok,true);
    assert.equal(riskFight(repeated).ok,true);
    for(let i=0;i<4;i++){settleHouseholdEvents(repeated);assert.equal(advanceWeek(repeated).ok,true);}
    assert.equal(repeated.events.active.eventId,"criminal_hearing");
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:repeated,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    await page.locator('[data-event-choice="review"]').click();
    const repeatReview=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    for(let i=0;i<2;i++){settleHouseholdEvents(repeatReview);assert.equal(advanceWeek(repeatReview).ok,true);}
    assert.equal(repeatReview.events.active.eventId,"criminal_verdict");
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:repeatReview,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    await page.locator('[data-event-choice="acknowledge"]').click();
    const imprisoned=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(imprisoned.flags.criminalJustice.records.length,2);assert.equal(imprisoned.flags.criminalJustice.custody.untilWeek,imprisoned.time.absoluteWeek+2);
    assert.equal(getMonthlyEmploymentIncome(imprisoned),0);assert.equal(getWeeklyLifeLoad(imprisoned).load,0);
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const released=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    const serviceBefore=imprisoned.flags.socialInsurance?.coveredWeeks||0;
    for(let i=0;i<2;i++){settleHouseholdEvents(released);assert.equal(advanceWeek(released).ok,true);}
    assert.equal(released.flags.criminalJustice.custody,undefined);assert.equal(released.flags.criminalJustice.records.length,2);assert.ok(getMonthlyEmploymentIncome(released)>0);assert.equal(released.flags.socialInsurance?.coveredWeeks||0,serviceBefore);
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:released,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    assert.deepEqual(errors,[]);await page.screenshot({path:`${out}/sentence-release-${language}-${width}.png`});rows.push({view:"sentence-release",language,width,status:"PASS"});

    assert.deepEqual(errors,[]);await page.screenshot({path:`${out}/criminal-verdict-${language}-${width}.png`});rows.push({view:"criminal-verdict",language,width,status:"PASS"});

    const risk=createNewGame({seed:17});risk.events.active=null;risk.events.queue=[];
    risk.flags.risk={...risk.flags.risk,heat:2};if(risk.world?.scenario)risk.world.scenario.pendingEvent=null;
    await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:risk,key});
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const disengage=page.locator('[data-decision="risk-disengage"]');
    assert.ok((await disengage.innerText()).includes(["Riskli çevreden uzaklaş","Step away from risky circles","Odejdź od ryzykownego środowiska"][["tr","en","pl"].indexOf(language)]));
    await disengage.click();
    const riskSaved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(riskSaved.weekly.used,1);assert.equal(riskSaved.flags.risk.disengagement.cleanWeeks,0);
    assert.equal(riskSaved.finances.balance,risk.finances.balance);
    await page.reload({waitUntil:"networkidle"});await page.locator("#continue-game").click();
    const riskReloaded=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.deepEqual(riskReloaded.flags.risk.disengagement,riskSaved.flags.risk.disengagement);
    assert.equal(await page.locator('[data-decision="risk-disengage"]').count(),0);
    const riskBounds=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
    assert.ok(riskBounds.s<=riskBounds.w);assert.deepEqual(errors,[]);
    await page.screenshot({path:`${out}/risk-disengagement-${language}-${width}.png`});rows.push({view:"risk-disengagement",language,width,status:"PASS"});
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
  writeFileSync(`${out}/results.json`, JSON.stringify({ origin, fingerprints, layoutBaseline, layoutCostComparison, layoutMeasurements, controlMeasurements, shellMeasurements, status: failure ? "FAIL" : "PASS", failure, expectedCases: 30, rows, performance: "Candidate cold entry only; before/after comparison remains unmeasured." }, null, 2) + "\n");
}
