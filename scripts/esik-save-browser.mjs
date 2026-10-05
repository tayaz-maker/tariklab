// Built/production browser gate. Synthetic isolated saves, never a user profile.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { KEY, createCoast, apply, legal, serialize, deserialize } from "../public/games/esik/sim.js";
import { BACKUP_KEY, RECOVERY_PREFIX } from "../public/games/esik/save-store.js";
import { createStaticGameServer } from "./static-game-server.mjs";
import { checkedSaveOrigin, verifySaveBuild, oldFixedUrlEntries, oldSaveBaseline } from "./esik-save-target.mjs";

const { values } = parseArgs({ options: {
  serve: { type: "string" }, "base-url": { type: "string" }, production: { type: "boolean", default: false },
  "expected-root": { type: "string" }, label: { type: "string", default: "built" },
} });
assert.ok(/^[a-z0-9-]+$/.test(values.label), "safe artifact label required");
assert.ok(Boolean(values.serve) !== Boolean(values["base-url"]), "choose --serve or --base-url");
assert.ok(!values["base-url"] || values["expected-root"], "hosted checks require expected built files");
assert.ok(!values.production || (!values.serve && values["expected-root"]), "production requires expected built files");
const out = resolve(process.env.RUNNER_TEMP || "/workspace", "screenshots/esik-save-recovery", values.label);
mkdirSync(out, { recursive: true });
const validState = apply(createCoast(3), "bagla:merdiven"), validRaw = serialize(validState);
const incomplete = JSON.parse(validRaw); delete incomplete.state.ramps;
const corruptRaw = JSON.stringify(incomplete);
const rows = [];
let server, browser, origin, fingerprints = [], failure = null, activeCase = null, activePage = null, activeDiagnostics = null;
const expectedCases = 37;

try {
  if (values.serve) {
    server = createStaticGameServer(values.serve);
    await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
    origin = checkedSaveOrigin(`http://127.0.0.1:${server.address().port}`);
  } else origin = checkedSaveOrigin(values["base-url"], values.production);
  fingerprints = await verifySaveBuild(origin, values["expected-root"] || values.serve);
  const oldEntries = oldFixedUrlEntries(); // Missing pinned commit is a failure, never skipped.
  const url = `${origin}/games/esik/`;
  const moduleUrls = ["app.js", "sim.js", "save-store.js"].map(name => `${origin}/games/esik/${name}?save=2`);
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox"] });
  const matrix = ["valid", "backup", "invalid", "quota"].flatMap(scenario => ["tr", "en", "pl"].flatMap(language => [1440, 390, 320].map(width => ({ scenario, language, width, upgrade: false }))));
  matrix.push({ scenario: "backup", language: "tr", width: 390, upgrade: true });
  for (const { scenario, language, width, upgrade } of matrix) {
    const stem = `${scenario}-${language}-${width}${upgrade ? "-old-cache" : ""}`;
    activeCase = stem;
    const reduced = width === 320;
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, reducedMotion: reduced ? "reduce" : "no-preference" });
    const page = await context.newPage(), errors = [], external = [], failedRequests = [], measurements = [];
    activePage = page;
    activeDiagnostics = { errors, external, failedRequests, measurements };
    const assertOrigin = () => assert.equal(new URL(page.url()).origin, origin, "navigation must remain at the authorized origin");
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    page.on("requestfailed", request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on("request", request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) external.push(request.url()); });
    await context.addInitScript(({ origin, language, key, backupKey, scenario, validRaw, corruptRaw }) => {
      if (location.origin !== origin) return;
      if (!localStorage.getItem("esik-save-fixture-seeded")) {
        localStorage.setItem(key, scenario === "valid" ? validRaw : corruptRaw);
        if (["backup", "quota"].includes(scenario)) localStorage.setItem(backupKey, validRaw);
        localStorage.setItem("esik-save-fixture-seeded", "1");
      }
      localStorage.setItem("tariklab.language", language);
      // This P1 gate isolates storage recovery in the existing SVG renderer.
      // It does not claim active Pixi, context-loss or physical GPU coverage.
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
        return getContext.call(this, type, ...args);
      };
      window.__esikSaveWrites = [];
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (this === localStorage && String(name).startsWith(key)) {
          window.__esikSaveWrites.push({ operation: "set", name: String(name), value: String(value) });
          if (scenario === "quota") throw new DOMException("Synthetic quota boundary", "QuotaExceededError");
        }
        return set.call(this, name, value);
      };
      const remove = Storage.prototype.removeItem, clear = Storage.prototype.clear;
      Storage.prototype.removeItem = function (name) {
        if (this === localStorage && String(name).startsWith(key)) window.__esikSaveWrites.push({ operation: "remove", name: String(name) });
        return remove.call(this, name);
      };
      Storage.prototype.clear = function () {
        if (this === localStorage) window.__esikSaveWrites.push({ operation: "clear" });
        return clear.call(this);
      };
    }, { origin, language, key: KEY, backupKey: BACKUP_KEY, scenario, validRaw, corruptRaw });
    const snapshot = () => page.evaluate(key => Object.fromEntries(Object.keys(localStorage).filter(name => name.startsWith(key)).sort().map(name => [name, localStorage.getItem(name)])), KEY);
    const inspect = async phase => {
      const record = await page.evaluate(() => {
        const notice = document.querySelector("[data-save-status]");
        return { viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
          renderer: document.querySelector(".coast-map-slot")?.dataset.renderer,
          meters: [...document.querySelectorAll(".meters span")].map(el => ({ text: el.textContent, value: Number(el.textContent.match(/\d+/)?.[0]) })),
          notice: notice ? { status: notice.dataset.saveStatus, text: notice.textContent, lang: notice.lang, role: notice.getAttribute("role"), live: notice.getAttribute("aria-live"), width: notice.clientWidth, scroll: notice.scrollWidth } : null,
          actions: [...document.querySelectorAll(".act")].map(el => ({ text: el.textContent, height: el.getBoundingClientRect().height })),
        };
      });
      assert.ok(record.scroll <= record.viewport, `horizontal overflow ${phase}: ${JSON.stringify(record)}`);
      assert.equal(record.renderer, "svg", "existing no-WebGL fallback must render");
      assert.equal(record.meters.length, 5);
      assert.ok(record.actions.length > 0 && record.actions.every(action => action.height >= 44));
      if (record.notice) {
        assert.equal(record.notice.lang, language); assert.equal(record.notice.role, "status"); assert.equal(record.notice.live, "polite");
        assert.ok(record.notice.text.trim().length > 20, "readable recovery explanation required");
        assert.ok(record.notice.scroll <= record.notice.width, "recovery explanation must not be clipped horizontally");
      }
      measurements.push({ phase, ...record });
      return record;
    };
    const assertMeters = (record, state) => assert.deepEqual(record.meters.map(item => item.value), [state.period, state.resource, state.trust, state.risk, state.access]);
    const open = async () => {
      const button = page.locator(".primary");
      await button.focus(); await button.press("Enter");
      await page.locator(".build .act").first().waitFor({ state: "visible" });
    };
    const warm = async () => {
      await page.waitForFunction(async expected => {
        const urls = new Set();
        for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) urls.add(request.url);
        return expected.every(url => urls.has(url));
      }, moduleUrls, { timeout: 5000 });
    };
    await page.goto(url, { waitUntil: "networkidle" }); assertOrigin();
    const coldEntry = await page.evaluate(() => ({ navigation: performance.getEntriesByType("navigation").map(r => ({ duration: r.duration, transferSize: r.transferSize, encodedBodySize: r.encodedBodySize })), paints: performance.getEntriesByType("paint").map(r => ({ name: r.name, startTime: r.startTime })), resources: performance.getEntriesByType("resource").map(r => ({ name: r.name, transferSize: r.transferSize, encodedBodySize: r.encodedBodySize })) }));
    await page.evaluate(async () => { await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready; });
    await page.reload({ waitUntil: "networkidle" }); assertOrigin();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await warm();
    let oldCache = null;
    if (upgrade) {
      oldCache = await page.evaluate(async ({ origin, entries }) => {
        const names = (await caches.keys()).filter(name => name.startsWith("cete-offline-"));
        if (names.length !== 1) throw new Error(`Expected one active root cache, found ${names.length}`);
        const cache = await caches.open(names[0]);
        for (const request of await cache.keys()) if (new URL(request.url).pathname.startsWith("/games/esik/")) await cache.delete(request);
        for (const entry of entries) await cache.put(origin + entry.path, new Response(entry.body, { headers: { "content-type": entry.type } }));
        return { name: names[0], urls: (await cache.keys()).map(request => request.url).filter(url => new URL(url).pathname.startsWith("/games/esik/")) };
      }, { origin, entries: oldEntries });
      assert.deepEqual(oldCache.urls.sort(), oldEntries.map(entry => origin + entry.path).sort());
      await page.reload({ waitUntil: "networkidle" }); assertOrigin();
      await warm();
      const loaded = await page.evaluate(() => performance.getEntriesByType("resource").map(entry => entry.name));
      assert.ok(moduleUrls.every(url => loaded.includes(url)), "online entry must load all new query URLs despite old fixed-URL cache");
      const legacyCacheAfter = await page.evaluate(async ({ cacheName, origin, entries }) => {
        const cache = await caches.open(cacheName);
        return Promise.all(entries.filter(entry => !entry.path.endsWith("/")).map(async entry => ({ path: entry.path, unchanged: await (await cache.match(origin + entry.path)).text() === entry.body })));
      }, { cacheName: oldCache.name, origin, entries: oldEntries });
      // map-model.js still imports the unversioned sim for unchanged NODES and
      // LINKS. Stale-while-revalidate may refresh its cached bytes, but this
      // document's already-instantiated old module remains permissive. The
      // app/storage boundary must use the separate, strict query-versioned sim.
      const moduleBoundaries = await page.evaluate(async raw => {
        const legacy = await import("/games/esik/sim.js");
        const candidate = await import("/games/esik/sim.js?save=2");
        return { legacyAcceptedCorrupt: legacy.deserialize(raw) !== null, candidateRejectedCorrupt: candidate.deserialize(raw) === null };
      }, corruptRaw);
      assert.deepEqual(moduleBoundaries, { legacyAcceptedCorrupt: true, candidateRejectedCorrupt: true }, "old cached static-map import must not choose the app's save validator");
      oldCache = { ...oldCache, baseline: oldSaveBaseline, blobs: oldEntries.map(({ path, sha256 }) => ({ path, sha256 })), legacyCacheAfter, moduleBoundaries };
    }
    const before = await snapshot();
    await open();
    const opened = await inspect("open");
    assert.deepEqual(await snapshot(), before, "opening the game must not change any primary, backup or recovery bytes");
    assert.deepEqual(await page.evaluate(() => window.__esikSaveWrites), [], "opening the game must not attempt a save write");
    const initialStatus = scenario === "valid" ? null : scenario === "invalid" ? "invalid" : "backup";
    assert.equal(opened.notice?.status || null, initialStatus);
    if (scenario !== "invalid") assertMeters(opened, validState);
    await page.screenshot({ path: `${out}/${stem}-open.png`, fullPage: true });
    const move = scenario === "invalid" ? "bagla:rihtim" : "rampa:merdiven";
    const initial = scenario === "invalid" ? createCoast(1) : validState;
    const index = legal(initial).indexOf(move);
    assert.ok(index >= 0); assert.equal(await page.locator(".build .act").count(), legal(initial).length);
    const action = page.locator(".build .act").nth(index);
    await action.focus(); await action.press("Enter");
    const after = await snapshot();
    const saved = scenario === "quota" ? apply(validState, move) : deserialize(after[KEY]);
    assert.ok(saved, "legal action must create a readable v1 save, or remain explicit unsaved memory under quota failure");
    const expected = apply(scenario === "invalid" ? createCoast(saved.seed) : validState, move);
    assert.deepEqual(saved, expected, "persisted decision must exactly equal the unchanged engine's result");
    const decided = await inspect("decision"); assertMeters(decided, expected);
    assert.equal(decided.notice?.status || null, scenario === "quota" ? "blocked" : scenario === "valid" ? null : "preserved");
    if (scenario === "quota") assert.deepEqual(after, before, "quota failure must preserve primary and backup verbatim");
    else if (scenario !== "valid") {
      assert.equal(after[`${RECOVERY_PREFIX}0`], corruptRaw, "unreadable primary retained byte-for-byte");
      assert.equal(after[BACKUP_KEY], scenario === "backup" ? validRaw : after[KEY]);
    } else assert.equal(after[BACKUP_KEY], validRaw, "normal save retains the previous valid primary");
    await page.screenshot({ path: `${out}/${stem}-decision.png`, fullPage: true });
    await page.reload({ waitUntil: "networkidle" }); assertOrigin(); await open();
    assert.deepEqual(await snapshot(), after, "online reload must not mutate storage");
    assert.deepEqual(await page.evaluate(() => window.__esikSaveWrites), []);
    const reloadExpected = scenario === "quota" ? validState : expected;
    const onlineReload = await inspect("online-reload");
    assertMeters(onlineReload, reloadExpected);
    assert.equal(onlineReload.notice?.status || null, scenario === "quota" ? "backup" : null);
    await warm();
    await context.setOffline(true);
    await page.reload({ waitUntil: "networkidle" }); assertOrigin(); await open();
    assert.deepEqual(await snapshot(), after, "warm offline reload must preserve all stored bytes");
    assert.deepEqual(await page.evaluate(() => window.__esikSaveWrites), []);
    const offlineReload = await inspect("offline-reload");
    assertMeters(offlineReload, reloadExpected);
    assert.equal(offlineReload.notice?.status || null, scenario === "quota" ? "backup" : null);
    await page.screenshot({ path: `${out}/${stem}-offline.png`, fullPage: true });
    assert.deepEqual(errors, [], "console, HTTP errors and page exceptions must remain zero");
    assert.deepEqual(failedRequests, [], "browser-visible requests must be served by the warmed worker offline");
    assert.deepEqual(external, [], "no external assets or services");
    rows.push({ scenario, language, width, reduced, upgrade, status: "PASS", renderer: "forced existing SVG fallback", coldEntry, measurements, cachedModules: moduleUrls, oldCache, preservedRaw: scenario !== "valid", persisted: scenario !== "quota", saveVersion: 1, errors, failedRequests, external });
    await context.close(); activePage = null;
  }
  assert.equal(rows.length, expectedCases);
} catch (error) {
  failure = error.stack || String(error);
  if (activePage) await activePage.screenshot({ path: `${out}/failure-${activeCase}.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  if (server) await new Promise(done => server.close(done));
  writeFileSync(`${out}/results.json`, JSON.stringify({ origin, fingerprints, expectedCases, activeCase, activeDiagnostics: failure ? activeDiagnostics : null, status: failure ? "FAIL" : "PASS", failure, rows,
    limits: ["Synthetic complete v1 saves, not an affected real user's archive.", "QuotaExceededError is injected at the real browser Storage boundary; physical disk exhaustion is not simulated.", "SVG fallback only; active Pixi/context loss, physical GPU and native Polish review remain outside this save hotfix.", "Pinned legacy-cache case proves a new online entry followed by warm offline; an entirely offline old installation cannot receive new code.", "Cold resource/paint timing is captured, not a before/after performance or first-meaningful-render claim."] }, null, 2) + "\n");
}
