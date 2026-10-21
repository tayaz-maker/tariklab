// Real UI acceptance. Synthetic fixtures live only in a fresh browser context;
// no account is authenticated and no existing user/browser storage is touched.
// Source: --serve public --label source
// Built:  --serve dist/client --label built
// Hosted: --base-url https://www.tariklab.com --production
//         --expected-root dist/client --expected-sha <exact-main> --label www
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { netWorth } from "../public/games/tc-sim/js/wealth.js";
import { createStaticGameServer } from "./static-game-server.mjs";
import { checkedOutcomeOrigin } from "./tc-sim-job-start-target.mjs";
import { BANK_FINGERPRINT_PATHS, requireBankCurrentMain, verifyBankCandidate } from "./tc-sim-2-banking-target.mjs";

const { chromium } = await import("playwright").catch(() => import(new URL("../../tariklab/node_modules/playwright/index.mjs", import.meta.url)));
const { values } = parseArgs({ options: {
  serve: { type: "string" }, "base-url": { type: "string" }, "expected-root": { type: "string" },
  "expected-sha": { type: "string" }, production: { type: "boolean", default: false },
  label: { type: "string", default: "source" }, out: { type: "string" },
  languages: { type: "string", default: "tr,en,pl" }, widths: { type: "string", default: "320,390,1280,1440" },
} });
assert.notEqual(Boolean(values.serve), Boolean(values["base-url"]), "Choose --serve or --base-url.");
assert.match(values.label, /^[a-z0-9-]+$/, "Artifact label must be a safe filename.");
assert.ok(!values["base-url"] || values["expected-root"], "Hosted acceptance requires exact local candidate assets.");
assert.ok(!values.production || values["expected-sha"] && !values.serve, "Production requires --expected-sha and a hosted origin.");
if (values["expected-sha"]) assert.match(values["expected-sha"], /^[a-f0-9]{40}$/);
const languages = values.languages.split(","), widths = values.widths.split(",").map(Number);
assert.ok(languages.length && languages.every(x => ["tr", "en", "pl"].includes(x)));
assert.ok(widths.length && widths.every(x => [320, 390, 1280, 1440].includes(x)));
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(values.out || resolve(root, "work/tc-sim-2-banking-browser", values.label));
mkdirSync(out, { recursive: true });
const expectedRoot = resolve(values["expected-root"] || values.serve);
const assetPaths = BANK_FINGERPRINT_PATHS;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const expected = new Map(assetPaths.map(path => [path, sha(readFileSync(resolve(expectedRoot, `.${path.split("?")[0]}`)))]));
const rows = [], fingerprints = [], observed = new Set(), responseChecks = [], responseFailures = [];
let browser, server, origin, mainBefore, mainAfter, gitVerifiedAssets = [], failure = null;
const saveKey = "tariklab::tc-sim:1";
const initial = () => {
  const state = createNewGame({ name: "Banka kabul", seed: 17, now: "2026-10-21T00:00:00.000Z" });
  state.finances.balance = 25000;
  // Only the fixture preparation adjusts the starting purse; subsequent tests
  // use actual rendered forms, their real engine and the game's real save path.
  state.finances.monthCash = null;
  state.events.active = null; state.events.queue = [];
  if (state.world.scenario) state.world.scenario.pendingEvent = null;
  assert.equal(validateState(state).ok, true);
  return state;
};
const readSave = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
const readRawSave = page => page.evaluate(key => localStorage.getItem(key), saveKey);
const account = (saved, bank) => saved.finances.banking.accounts.find(a => a.id === `bank-${bank}-personal` && !a.closed);
const form = (page, action, bank = "ziraat") => page.locator("form[data-bank-form]")
  .filter({ has: page.locator(`input[name="action"][value="${action}"]`) })
  .filter({ has: page.locator(`input[name="accountId"][value="bank-${bank}-personal"]`) });
async function navigateToBanks(page) {
  if (await page.locator("[data-bank-accounts]").isVisible().catch(() => false)) return;
  const target = page.locator('.side-nav [data-view="banks"]').first();
  if (!await target.isVisible()) {
    const toggle = page.locator(".side-nav .nav-more");
    if (await toggle.isVisible()) await toggle.click();
    for (const parent of await target.locator("xpath=ancestor::details").all()) {
      if (await parent.getAttribute("open") === null) await parent.locator(":scope > summary").click();
    }
  }
  await target.focus();
  await target.press("Enter");
  await page.locator("[data-bank-accounts]").waitFor({ state: "visible" });
  assert.equal(await page.locator('.side-nav [data-view="banks"][aria-current="page"]').count(), 1);
}
async function openBank(page, bank, keyboard = false) {
  const opening = page.locator("form.bank-open[data-bank-form]");
  await opening.locator('[name="bankId"]').selectOption(bank);
  await opening.locator('[name="kind"]').selectOption("personal");
  const submit = opening.locator('button[type="submit"]');
  if (keyboard) { await submit.focus(); await submit.press("Enter"); } else await submit.click();
  await page.locator(`[data-game-bank-account="bank-${bank}-personal"]`).waitFor({ state: "visible" });
  const saved = await readSave(page); assert.ok(account(saved, bank));
}
async function submitAmount(page, action, bank, amount, keyboard = false, targetId = null) {
  const actionForm = form(page, action, bank);
  if (targetId) await actionForm.locator('[name="targetId"]').selectOption(targetId);
  const input = actionForm.locator('[name="amount"]');
  await input.fill(String(amount));
  if (keyboard) {
    await input.press("Tab");
    assert.equal(await actionForm.locator('button[type="submit"]').evaluate(el => el === document.activeElement), true, "Amount field must tab to its submit button.");
    await page.keyboard.press("Enter");
  } else await actionForm.locator('button[type="submit"]').click();
}
async function checkLayout(page, phase) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const controls = [...document.querySelectorAll("[data-bank-accounts] input:not([type=hidden]), [data-bank-accounts] select, [data-bank-accounts] textarea, [data-bank-accounts] button")]
      .filter(el => el.getClientRects().length).map(el => ({ tag: el.tagName, name: el.name || el.textContent.trim().slice(0, 70), height: el.getBoundingClientRect().height,
        width: el.getBoundingClientRect().width, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right, fontSize: parseFloat(getComputedStyle(el).fontSize),
        labeled: el.tagName === "BUTTON" ? Boolean(el.textContent.trim()) : Boolean(el.labels?.length || el.getAttribute("aria-label")) }));
    return { width: root.clientWidth, overflow: root.scrollWidth - root.clientWidth, controls };
  });
  assert.ok(metrics.overflow <= 1, `${phase}: page overflow ${metrics.overflow}px`);
  assert.ok(metrics.controls.length > 4, `${phase}: bank controls are missing.`);
  for (const c of metrics.controls) {
    assert.ok(c.labeled, `${phase}: unlabeled ${c.tag}/${c.name}`);
    assert.ok(c.height >= 43, `${phase}: short touch target ${c.tag}/${c.name}: ${c.height}`);
    assert.ok(c.left >= -1 && c.right <= metrics.width + 1, `${phase}: clipped ${c.tag}/${c.name}`);
    if (metrics.width <= 820 && c.tag !== "BUTTON") assert.ok(c.fontSize >= 16, `${phase}: mobile input zoom risk ${c.tag}/${c.name}: ${c.fontSize}px`);
  }
  return { overflow: metrics.overflow, visibleControls: metrics.controls.length };
}
try {
  if (values.production) mainBefore = await requireBankCurrentMain(values["expected-sha"]);
  if (values["expected-sha"]) gitVerifiedAssets = await verifyBankCandidate(expectedRoot, values["expected-sha"]);
  if (values.serve) {
    server = createStaticGameServer(expectedRoot);
    await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
    origin = checkedOutcomeOrigin(`http://127.0.0.1:${server.address().port}`);
  } else origin = checkedOutcomeOrigin(values["base-url"], values.production);
  for (const [path, expectedSHA256] of expected) {
    const response = await fetch(origin + path, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, `Fingerprint status ${path}`);
    assert.match(response.headers.get("content-type") || "", path.includes(".css") ? /text\/css/ : /javascript/);
    const actual = sha(Buffer.from(await response.arrayBuffer())); assert.equal(actual, expectedSHA256, `Candidate mismatch: ${path}`);
    fingerprints.push({ path, sha256: actual });
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox"] });
  for (const language of languages) for (const width of widths) {
    const reduced = width === 320 || width === 1440, stem = `${language}-${width}`;
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: reduced ? "reduce" : "no-preference", hasTouch: width < 500 });
    const page = await context.newPage(), errors = [], requests = [];
    page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(25000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("request", request => { if (request.url().startsWith("http")) requests.push(request.url()); });
    page.on("response", response => {
      const url = new URL(response.url()), path = url.pathname + url.search;
      if (url.origin !== origin || !expected.has(path)) return;
      responseChecks.push((async () => {
        assert.equal(response.status(), 200, `Browser asset status ${path}`);
        assert.equal(sha(await response.body()), expected.get(path), `Browser loaded different asset ${path}`);
        observed.add(path);
      })().catch(error => { responseFailures.push(error.message); }));
    });
    const state = initial(), initialWorth = netWorth(state).total;
    await context.addInitScript(({ origin, saveKey, state, language }) => {
      if (location.origin !== origin) return;
      if (!localStorage.getItem("tc-sim-2-banking-fixture")) {
        localStorage.setItem(saveKey, JSON.stringify(state));
        localStorage.setItem("tariklab::tc-sim:active", "1");
        localStorage.setItem("tc-sim-2-banking-fixture", "1");
      }
      localStorage.setItem("tariklab.language", language);
    }, { origin, saveKey, state, language });
    try {
      const started = performance.now();
      await page.goto(`${origin}/games/tc-sim/index.html`, { waitUntil: "networkidle" });
      assert.equal(new URL(page.url()).origin, origin);
      await page.locator("#continue-game").click();
      await navigateToBanks(page);
      const readyMs = Math.round(performance.now() - started);
      const heading = { tr: "Banka hesapların", en: "Your bank accounts", pl: "Twoje rachunki bankowe" }[language];
      assert.equal((await page.locator("[data-bank-accounts] h2").first().innerText()).trim(), heading);
      assert.equal(await page.locator("[data-game-bank-account]").count(), 0);
      await openBank(page, "ziraat", true); await openBank(page, "isbank");
      const layout = [await checkLayout(page, "accounts open")];
      await submitAmount(page, "deposit", "ziraat", 10000, true);
      let saved = await readSave(page); assert.equal(saved.finances.balance, 15000); assert.equal(account(saved, "ziraat").balance, 10000);
      await submitAmount(page, "transfer", "ziraat", 4000, false, "bank-isbank-personal");
      saved = await readSave(page); assert.equal(account(saved, "ziraat").balance, 6000); assert.equal(account(saved, "isbank").balance, 4000);
      await submitAmount(page, "withdraw", "isbank", 1500, true);
      saved = await readSave(page); assert.equal(saved.finances.balance, 16500); assert.equal(account(saved, "isbank").balance, 2500);
      assert.equal(netWorth(saved).total, initialWorth); assert.equal(saved.weekly.used, state.weekly.used); assert.equal(saved.meta.saveVersion, 6);
      const beforeReject = await readRawSave(page);
      await submitAmount(page, "withdraw", "isbank", 3000);
      assert.equal(await readRawSave(page), beforeReject, "Rejected withdrawal must not rewrite the persisted save.");
      assert.ok((await page.locator('.result[role="status"]').first().innerText()).trim().length > 0, "Rejection must have visible feedback.");
      layout.push(await checkLayout(page, "after rejected withdrawal"));
      await page.screenshot({ path: resolve(out, `${stem}-accounts.png`), fullPage: true });
      await page.locator("[data-bank-accounts]").screenshot({ path: resolve(out, `${stem}-bank-panel.png`) });
      // Opening historical/product disclosures must leave every amount intact.
      const products = page.locator('[data-game-bank-account="bank-ziraat-personal"] .bank-products > summary');
      await products.focus(); await products.press("Enter");
      assert.equal(await products.locator("..").getAttribute("open"), "");
      layout.push(await checkLayout(page, "products keyboard expanded"));
      assert.equal(await readRawSave(page), beforeReject);
      const savedBanking = structuredClone(saved.finances.banking);
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(new URL(page.url()).origin, origin); await page.locator("#continue-game").click(); await navigateToBanks(page);
      const loaded = await readSave(page); assert.deepEqual(loaded.finances.banking, savedBanking); assert.equal(loaded.finances.balance, 16500);
      assert.equal(netWorth(loaded).total, initialWorth); assert.equal(validateState(loaded).ok, true);
      layout.push(await checkLayout(page, "reloaded"));
      assert.deepEqual(errors, []);
      const bankHosts = requests.filter(url => /(?:ziraatbank\.com|isbank\.com|garantibbva\.com)/.test(url));
      assert.deepEqual(bankHosts, [], "Game account operations must never contact real banks.");
      rows.push({ language, width, reducedMotion: reduced, readyMs, cash: loaded.finances.balance,
        accounts: loaded.finances.banking.accounts.map(a => ({ bankId: a.bankId, balance: a.balance, history: a.history.length })),
        netWorth: netWorth(loaded).total, layout, keyboard: "PASS", rejectionRollback: "PASS", reload: "PASS", status: "PASS" });
      console.log(`${stem}: PASS (${readyMs}ms)`);
    } catch (error) {
      await page.screenshot({ path: resolve(out, `${stem}-failure.png`), fullPage: true }).catch(() => {});
      rows.push({ language, width, status: "FAIL", error: error.message, consoleErrors: errors }); throw error;
    } finally { await context.close(); }
  }
  await Promise.all(responseChecks);
  assert.deepEqual(responseFailures, [], "Every browser response must match the exact expected file.");
  for (const path of expected.keys()) assert.ok(observed.has(path), `Fingerprint was not also loaded by the browser: ${path}`);
  if (values.production) mainAfter = await requireBankCurrentMain(values["expected-sha"]);
} catch (error) { failure = error.stack || String(error); }
finally {
  await Promise.allSettled(responseChecks);
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  const report = { status: failure ? "FAIL" : "PASS", label: values.label, origin, expectedMain: values["expected-sha"] || null,
    mainBefore, mainAfter, gitVerifiedAssets,
    expectedCases: languages.length * widths.length, completedCases: rows.filter(r => r.status === "PASS").length,
    fingerprints, browserVerifiedAssets: [...observed], rows, failure };
  writeFileSync(resolve(out, "results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ status: report.status, cases: report.completedCases, expectedCases: report.expectedCases, fingerprintCount: fingerprints.length, report: resolve(out, "results.json") }));
}
if (failure) { console.error(failure); process.exitCode = 1; }
