// Foundation browser evidence. Isolated contexts; no medical/user records.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { checkedAtlasOrigin, verifyAtlasBuild, summarizeAtlasEntry, atlasEntryBudgets } from "./atlas-target.mjs";
import { FOUNDATION } from "../public/atlas/yapi/content.js";

const { values } = parseArgs({ options: {
  serve: { type: "string" }, "base-url": { type: "string" }, production: { type: "boolean", default: false },
  "expected-root": { type: "string" }, label: { type: "string", default: "built" },
} });
assert.ok(/^[a-z0-9-]+$/.test(values.label), "safe artifact label required");
assert.ok(Boolean(values.serve) !== Boolean(values["base-url"]), "choose --serve or --base-url");
assert.ok(!values["base-url"] || values["expected-root"], "hosted checks require expected built files");
assert.ok(!values.production || (!values.serve && values["expected-root"]), "production requires expected built files");
const out = resolve(process.env.RUNNER_TEMP || "/workspace", "screenshots/atlas-foundation", values.label);
mkdirSync(out, { recursive: true });
const sentinels = Object.fromEntries(["tariklab.kiyi-esigi.v1", "jitem-derin-ag-v3", "tc-sim-save", "tariklab::tc-sim:1"].map(key => [key, `atlas-isolation-sentinel:${key}`]));
const rows = [];
let server, browser, origin, packageProof = null, portal = null, failure = null, activeCase = null, activePage = null, activeDiagnostics = null;
const expectedCases = 9;

function monitor(page, origin) {
  const errors = [], external = [], failures = [], requests = [], requestEvents = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", request => failures.push({ url: request.url(), error: request.failure()?.errorText }));
  // Context request events include service-worker precache requests; a portal
  // must not hide eager Atlas/Pixi downloads behind its root worker.
  page.context().on("request", request => {
    requests.push(request.url());
    requestEvents.push({ url: request.url(), resourceType: request.resourceType(), workerScriptURL: request.serviceWorker()?.url() ?? null });
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) external.push(request.url());
  });
  return { errors, external, failures, requests, requestEvents };
}

try {
  if (values.serve) {
    assert.equal(resolve(values.serve), resolve(".output/public"), "built Atlas gate must use the production output");
    // The portal is a real SSR route. A static index substitute would not prove
    // its lazy-loading behavior. This is the established built-preview path.
    origin = checkedAtlasOrigin("http://127.0.0.1:8094");
    server = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "8094", "--strictPort"], { stdio: "inherit", detached: true });
    let ready = false;
    const startupDeadline = Date.now() + 30000;
    while (Date.now() < startupDeadline) {
      if (server.exitCode !== null) break;
      try { ready = (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* bounded preview startup */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, "production preview must start within the bounded startup window");
  } else origin = checkedAtlasOrigin(values["base-url"], values.production);
  // No browser fixture starts before every released package byte is verified.
  packageProof = await verifyAtlasBuild(origin, values["expected-root"] || values.serve);
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox"] });

  // A genuinely fresh portal context must not have visited or cached the atlas.
  {
    activeCase = "portal-isolation";
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage(); activePage = page;
    const diagnostics = monitor(page, origin); activeDiagnostics = diagnostics;
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    assert.equal(new URL(page.url()).origin, origin);
    await page.locator('a[href="/atlas/3d/"]').first().waitFor({ state: "visible" });
    await page.locator('a[href="/atlas/yapi/"]').first().waitFor({ state: "visible" });
    assert.equal(diagnostics.requests.filter(url => /\/atlas\/|pixi|webgl/i.test(new URL(url).pathname)).length, 0, "portal must not download atlas, Pixi or WebGL assets");
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.viewport);
    assert.deepEqual(diagnostics.errors, []); assert.deepEqual(diagnostics.failures, []); assert.deepEqual(diagnostics.external, []);
    portal = { status: "PASS", ...dimensions, ...diagnostics, timing: await page.evaluate(() => ({ navigation: performance.getEntriesByType("navigation").map(r => ({ transferSize: r.transferSize, encodedBodySize: r.encodedBodySize, duration: r.duration })), resources: performance.getEntriesByType("resource").map(r => ({ name: r.name, transferSize: r.transferSize, encodedBodySize: r.encodedBodySize })) })) };
    await page.screenshot({ path: `${out}/portal-isolation-1440.png`, fullPage: true });
    await context.close(); activePage = null;
  }

  for (const language of ["tr", "en", "pl"]) for (const width of [1440, 390, 320]) {
    const reduced = width === 320, stem = `${language}-${width}`;
    activeCase = stem;
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, reducedMotion: reduced ? "reduce" : "no-preference" });
    const page = await context.newPage(); activePage = page;
    const diagnostics = monitor(page, origin); activeDiagnostics = diagnostics;
    const measurements = [];
    await context.addInitScript(({ origin, language, sentinels }) => {
      if (location.origin !== origin) return;
      if (!sessionStorage.getItem("atlas-browser-seeded")) {
        for (const [key, value] of Object.entries(sentinels)) localStorage.setItem(key, value);
        localStorage.setItem("tariklab.language", language);
        sessionStorage.setItem("atlas-browser-seeded", "1");
      }
      window.__atlasWebglAttempts = 0;
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (/^(?:webgl2?|experimental-webgl)$/.test(type)) { window.__atlasWebglAttempts++; return null; }
        return getContext.call(this, type, ...args);
      };
      window.__atlasSilenceCalls = [];
      HTMLMediaElement.prototype.play = function () { window.__atlasSilenceCalls.push("media.play"); return Promise.reject(new Error("Atlas must be silent")); };
      if (navigator.vibrate) navigator.vibrate = () => { window.__atlasSilenceCalls.push("vibrate"); return false; };
      if (window.speechSynthesis) window.speechSynthesis.speak = () => window.__atlasSilenceCalls.push("speech");
      for (const name of ["AudioContext", "webkitAudioContext"]) if (window[name]) window[name] = function () { window.__atlasSilenceCalls.push(name); throw new Error("Atlas must be silent"); };
      const recordReady = () => {
        if (document.querySelector('#atlas-app[data-ready="true"]') && window.__atlasReadyDomMs === undefined) {
          window.__atlasReadyDomMs = performance.now(); observer.disconnect();
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const diagram = document.querySelector("#anatomy-diagram"), detail = document.querySelector("#structure-name");
            if (diagram?.getBoundingClientRect().height > 0 && detail?.getBoundingClientRect().height > 0) window.__atlasMeaningfulViewMs = performance.now();
          }));
        }
      };
      const observer = new MutationObserver(recordReady);
      observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-ready"] });
      recordReady();
    }, { origin, language, sentinels });
    const inspect = async phase => {
      const result = await page.evaluate(() => {
        const app = document.querySelector("#atlas-app"), detail = document.querySelector("#structure-detail");
        const visible = el => Boolean(el && el.getBoundingClientRect().width && el.getBoundingClientRect().height && getComputedStyle(el).visibility !== "hidden");
        return { viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
          locale: app.dataset.locale, selected: app.dataset.selected, zoom: Number(app.dataset.zoom), variant: app.dataset.variant, view: app.dataset.view,
          structureName: document.querySelector("#structure-name")?.textContent,
          notices: ["education-note", "draft-note", "scope-note"].map(id => ({ id, text: document.getElementById(id)?.textContent, visible: visible(document.getElementById(id)) })),
          detailVisible: visible(detail), svgCount: document.querySelectorAll("#anatomy-diagram svg, svg#anatomy-diagram").length, canvasCount: document.querySelectorAll("canvas").length,
          mediaCount: document.querySelectorAll("audio, video, [autoplay]").length,
          webglAttempts: window.__atlasWebglAttempts, silenceCalls: window.__atlasSilenceCalls,
          activeAnimations: matchMedia("(prefers-reduced-motion: reduce)").matches ? document.getAnimations().filter(animation => animation.playState === "running").length : null,
        };
      });
      assert.ok(result.scroll <= result.viewport, `${phase}: horizontal overflow ${JSON.stringify(result)}`);
      assert.equal(result.locale, language); assert.equal(result.svgCount, 1); assert.equal(result.canvasCount, 0); assert.equal(result.webglAttempts, 0);
      assert.equal(result.mediaCount, 0);
      assert.deepEqual(result.silenceCalls, []);
      assert.ok(result.structureName?.trim() && result.detailVisible);
      assert.ok(result.notices.every(row => row.visible && row.text.trim().length > 20), "education, draft and limited scope must stay visible");
      for (const note of result.notices) assert.ok(note.text.includes(FOUNDATION.notices[note.id.replace("-note", "")][language]), `${note.id} must show the required draft wording`);
      if (reduced) assert.equal(result.activeAnimations, 0, "reduced motion must be static");
      measurements.push({ phase, ...result }); return result;
    };
    const atlas = page.locator('#atlas-app[data-ready="true"]');
    let rootWorkerPredecessor = null;
    if (language === "en" && width === 390) {
      // One real root-worker predecessor, not a deep old-game cache migration.
      await page.goto(`${origin}/`, { waitUntil: "networkidle" });
      await page.evaluate(async () => { await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready; });
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL === `${location.origin}/sw.js`);
      rootWorkerPredecessor = await page.evaluate(async () => {
        const cacheNames = (await caches.keys()).filter(name => name.startsWith("cete-offline-"));
        if (cacheNames.length !== 1) throw new Error(`Expected one root cache, found ${cacheNames.length}`);
        const cache = await caches.open(cacheNames[0]), path = "/__atlas-browser-root-cache-sentinel";
        await cache.put(path, new Response("root-cache-preserved"));
        return { cacheName: cacheNames[0], path, controller: navigator.serviceWorker.controller.scriptURL };
      });
      diagnostics.requests.length = 0;
      diagnostics.requestEvents.length = 0;
    }
    await page.goto(`${origin}/atlas/yapi/?lang=${language}#structure=heart`, { waitUntil: "networkidle" });
    assert.equal(new URL(page.url()).origin, origin);
    await atlas.waitFor({ state: "visible" });
    await page.waitForFunction(() => Number.isFinite(window.__atlasMeaningfulViewMs));
    const before = await inspect("first-view"); assert.equal(before.selected, "heart");
    assert.equal((await page.locator(".skip-link").textContent()).trim(), { tr: "İçeriğe geç", en: "Skip to content", pl: "Przejdź do treści" }[language], "skip link must use the selected language");
    const coldEntry = await page.evaluate(() => ({ readyDomMs: window.__atlasReadyDomMs, meaningfulViewMs: window.__atlasMeaningfulViewMs,
      navigation: performance.getEntriesByType("navigation").map(r => ({ name: r.name, startTime: r.startTime, duration: r.duration, transferSize: r.transferSize, encodedBodySize: r.encodedBodySize })),
      paints: performance.getEntriesByType("paint").map(r => ({ name: r.name, startTime: r.startTime })),
      resources: performance.getEntriesByType("resource").map(r => ({ name: r.name, initiatorType: r.initiatorType, startTime: r.startTime, responseEnd: r.responseEnd, transferSize: r.transferSize, encodedBodySize: r.encodedBodySize })) }));
    assert.ok(Number.isFinite(coldEntry.meaningfulViewMs) && coldEntry.meaningfulViewMs > 0);
    coldEntry.context = rootWorkerPredecessor ? "first Atlas entry under existing root worker; no Atlas package prewarmed" : "first entry in fresh browser context; no preexisting service worker";
    coldEntry.requestEventsThroughFirstView = [...diagnostics.requestEvents];
    activeDiagnostics.coldEntry = coldEntry;
    const entryBudget = summarizeAtlasEntry(coldEntry, width);
    await page.screenshot({ path: `${out}/${stem}-before.png`, fullPage: true });
    const alternateLocale = language === "tr" ? "en" : "tr";
    await page.locator(`button[data-locale="${alternateLocale}"]`).focus();
    await page.locator(`button[data-locale="${alternateLocale}"]`).press("Enter");
    assert.equal(await atlas.getAttribute("data-locale"), alternateLocale);
    assert.equal((await page.locator("#structure-name").textContent()).trim(), FOUNDATION.structures.find(structure => structure.id === "heart").label[alternateLocale]);
    await page.locator(`button[data-locale="${language}"]`).click();
    assert.equal(await atlas.getAttribute("data-locale"), language);

    const diagram = () => page.evaluate(async () => {
      const bodies = [...document.querySelectorAll("#anatomy-diagram .atlas-view__body")];
      const active = bodies.filter(body => body.getAttribute("display") !== "none");
      if (active.length !== 1) throw new Error(`Expected one visible anatomy body, found ${active.length}`);
      const paths = [...active[0].querySelectorAll("path")].map(path => path.getAttribute("d"));
      const bytes = new TextEncoder().encode(paths.join("|"));
      const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
      const rect = element => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      const box = active[0].getBBox(), ctm = active[0].getScreenCTM();
      if (!ctm) throw new Error("Visible body has no screen transformation");
      const points = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(ctm));
      return { variant: active[0].dataset.variant, view: active[0].dataset.view, paths: paths.length, sha256, cachedBodies: bodies.length,
        svg: rect(active[0].ownerSVGElement), mount: rect(document.querySelector(".diagram-mount")),
        body: { left: Math.min(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)), right: Math.max(...points.map(p => p.x)), bottom: Math.max(...points.map(p => p.y)) },
        layers: Object.fromEntries([...active[0].querySelectorAll(".atlas-view__layer")].map(layer => [layer.dataset.layer, layer.getAttribute("display")])),
        transform: document.querySelector(".atlas-view__viewport").getAttribute("transform") };
    });
    const assertContainedAtFit = drawn => {
      const inside = (inner, outer) => inner.left >= outer.left - 1 && inner.top >= outer.top - 1 && inner.right <= outer.right + 1 && inner.bottom <= outer.bottom + 1;
      assert.ok(drawn.svg.width > 0 && drawn.svg.height > 0 && drawn.mount.width > 0 && drawn.mount.height > 0);
      assert.ok(inside(drawn.svg, drawn.mount), `SVG extends beyond its mount at zoom 1: ${JSON.stringify(drawn)}`);
      assert.ok(inside(drawn.body, drawn.svg) && inside(drawn.body, drawn.mount), `body is clipped at zoom 1: ${JSON.stringify(drawn)}`);
    };
    const geometryStates = [await diagram()];
    assertContainedAtFit(geometryStates[0]);
    for (const variant of ["male", "female"]) {
      await page.locator(`button[data-variant="${variant}"]`).click();
      assert.equal(await atlas.getAttribute("data-variant"), variant);
      assert.equal(await page.locator(`button[data-variant="${variant}"]`).getAttribute("aria-pressed"), "true");
      const drawn = await diagram(); assert.equal(drawn.variant, variant); assert.ok(drawn.paths > 0 && drawn.cachedBodies <= 4);
      assertContainedAtFit(drawn);
      geometryStates.push(drawn);
    }
    assert.notEqual(geometryStates[0].sha256, geometryStates[1].sha256, "female/male control must change actual geometry");
    assert.equal(geometryStates[0].sha256, geometryStates[2].sha256, "returning to the same body must reuse the same geometry");
    for (const view of ["back", "front"]) {
      await page.locator(`button[data-view="${view}"]`).click();
      assert.equal(await atlas.getAttribute("data-view"), view);
      assert.equal(await page.locator(`button[data-view="${view}"]`).getAttribute("aria-pressed"), "true");
      const drawn = await diagram(); assert.equal(drawn.view, view); assertContainedAtFit(drawn); geometryStates.push(drawn);
    }
    assert.notEqual(geometryStates[2].sha256, geometryStates[3].sha256, "front/back must change the displayed geometry");
    for (const layer of ["surface", "skeleton", "organs"]) {
      const input = page.locator(`input[data-layer="${layer}"]`);
      const initial = await input.isChecked(); await input.setChecked(!initial); assert.equal(await input.isChecked(), !initial);
      assert.equal((await diagram()).layers[layer], initial ? "none" : "inline");
      await input.setChecked(initial); assert.equal(await input.isChecked(), initial);
      assert.equal((await diagram()).layers[layer], initial ? "inline" : "none");
    }
    const heart = page.locator('#structure-list [data-structure="heart"]');
    const heartName = (await heart.textContent()).trim();
    await page.locator("#structure-search").fill(heartName);
    assert.equal(await heart.isVisible(), true);
    await heart.focus(); await heart.press("Enter");
    assert.equal(await atlas.getAttribute("data-selected"), "heart");
    await page.locator("#structure-search").fill("");
    const initialTransform = (await diagram()).transform;
    await page.locator('[data-action="zoom-in"]').click(); assert.ok(Number(await atlas.getAttribute("data-zoom")) > 1);
    assert.notEqual((await diagram()).transform, initialTransform);
    await page.locator('[data-action="pan-right"]').click();
    await page.locator('[data-action="zoom-out"]').click();
    await page.locator('[data-action="reset-view"]').click(); assert.equal(Number(await atlas.getAttribute("data-zoom")), 1);
    const resetDiagram = await diagram(); assert.equal(resetDiagram.transform, initialTransform); assertContainedAtFit(resetDiagram);

    const sourceToggle = page.locator("#source-toggle"), panel = page.locator("#sources-panel");
    await sourceToggle.focus(); await sourceToggle.press("Enter");
    assert.equal(await sourceToggle.getAttribute("aria-expanded"), "true"); assert.equal(await panel.isVisible(), true);
    assert.ok(await panel.locator('[data-review="NOT_REVIEWED"]').count() > 0, "expert review must be visibly uncompleted");
    const sourcePanelText = await panel.textContent();
    assert.ok(sourcePanelText.includes(FOUNDATION.notices.education[language]), "source panel must retain the educational/non-medical notice");
    assert.ok(sourcePanelText.includes(FOUNDATION.notices.accuracy[language]), "source panel must explain the uncompleted expert-review gate");
    const sourceLinks = await panel.locator('a[href^="https://"]').evaluateAll(links => links.map(link => ({ href: link.href, text: link.textContent })));
    assert.ok(sourceLinks.length > 0 && sourceLinks.every(link => link.text.trim()), "readable factual source links required");
    const sourceRecords = [];
    for (const source of FOUNDATION.sources) {
      const record = panel.locator(`[data-source-id="${source.id}"]`), body = await record.textContent();
      assert.equal(await record.locator("a").getAttribute("href"), source.url);
      assert.ok(body.includes(source.accessedAt), `source access date must be visible: ${source.id}`);
      if (source.sourceDate) assert.ok(body.includes(source.sourceDate), `source date must be visible: ${source.id}`);
      sourceRecords.push({ id: source.id, sourceDate: source.sourceDate, accessedAt: source.accessedAt, text: body });
    }
    await page.locator("#sources-close").focus(); await page.locator("#sources-close").press("Escape");
    assert.equal(await panel.isVisible(), false); assert.equal(await sourceToggle.evaluate(el => el === document.activeElement), true);
    await sourceToggle.click(); await page.locator("#sources-close").click();
    assert.equal(await sourceToggle.evaluate(el => el === document.activeElement), true);

    const lessonStates = [await page.locator("#lesson-status").textContent()];
    for (const id of ["lungs", "kidneys"]) {
      await page.locator("#lesson-next").click();
      assert.equal(await atlas.getAttribute("data-selected"), id);
      assert.equal(await page.locator('input[data-layer="organs"]').isChecked(), true);
      lessonStates.push(await page.locator("#lesson-status").textContent());
    }
    assert.equal(new Set(lessonStates).size, 3);
    await page.locator("#lesson-prev").click(); assert.equal(await atlas.getAttribute("data-selected"), "lungs");
    const selectionTimings = await page.evaluate(async () => {
      const samples = [];
      for (const id of ["heart", "lungs", "kidneys", "liver", "stomach", "heart", "lungs", "kidneys", "liver", "stomach"]) {
        const start = performance.now();
        document.querySelector(`#structure-list [data-structure="${id}"]`).click();
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (document.querySelector("#atlas-app").dataset.selected !== id) throw new Error(`Selection did not render: ${id}`);
        samples.push({ id, milliseconds: performance.now() - start });
      }
      return samples;
    });
    const sorted = selectionTimings.map(row => row.milliseconds).sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(sorted.length * .95) - 1];
    assert.ok(p95 <= 100, `selection-to-next-frame p95 ${p95}ms exceeds 100ms budget`);
    const after = await inspect("after-controls");
    await page.screenshot({ path: `${out}/${stem}-after.png`, fullPage: true });
    if (width !== 320) {
      await page.setViewportSize({ width: 320, height: 844 });
      const resized = await inspect("resize-320"); assert.equal(resized.selected, after.selected);
      assertContainedAtFit(await diagram());
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      assert.equal((await inspect("resize-restored")).selected, after.selected);
      assertContainedAtFit(await diagram());
    }

    await page.waitForFunction(() => document.querySelector("#offline-status")?.dataset.state === "ready", null, { timeout: 15000 });
    await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.includes("/atlas/yapi/"));
    const offlineStatus = await page.locator("#offline-status").evaluate(el => ({ state: el.dataset.state, version: el.dataset.version, text: el.textContent, live: el.getAttribute("aria-live") }));
    assert.equal(offlineStatus.state, "ready"); assert.equal(offlineStatus.live, "polite");
    assert.equal(offlineStatus.version, packageProof.version, "offline status must identify the exact released package version");
    const installation = {
      scope: "Observed request events through verified offline-ready, distinct from critical document ResourceTiming. Worker events can include fetching the same URL again for integrity caching; these are not deduplicated or counted as critical route requests.",
      workerRequests: diagnostics.requestEvents.filter(event => event.workerScriptURL?.includes("/atlas/yapi/")),
      rootWorkerRequests: diagnostics.requestEvents.filter(event => event.workerScriptURL && !event.workerScriptURL.includes("/atlas/yapi/")),
      verifiedPackageBytes: packageProof.totalBytes, emittedWorkerBytes: packageProof.worker.bytes, manifestBytes: packageProof.manifest.bytes,
    };
    const offlineCache = await page.evaluate(async ({ version, files }) => {
      if (!(await caches.keys()).includes(version)) throw new Error("Exact Atlas cache missing");
      const cache = await caches.open(version);
      return Promise.all(files.map(async file => {
        const response = await cache.match(file.path);
        if (!response) return { path: file.path, cached: false };
        const bytes = await response.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
        return { path: file.path, cached: true, bytes: bytes.byteLength, sha256, exact: bytes.byteLength === file.bytes && sha256 === file.sha256 };
      }));
    }, { version: packageProof.version, files: [...packageProof.files, packageProof.manifest] });
    assert.ok(offlineCache.every(row => row.cached && row.exact), `offline package incomplete/stale: ${JSON.stringify(offlineCache.filter(row => !row.exact))}`);
    if (rootWorkerPredecessor) {
      const unchanged = await page.evaluate(async predecessor => (await caches.keys()).includes(predecessor.cacheName) && await (await (await caches.open(predecessor.cacheName)).match(predecessor.path)).text() === "root-cache-preserved", rootWorkerPredecessor);
      assert.equal(unchanged, true, "Atlas activation must preserve the predecessor root cache");
      rootWorkerPredecessor.preserved = true;
    }
    const preserved = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(sentinels));
    assert.deepEqual(preserved, sentinels, "atlas must not alter independent game saves");
    await context.setOffline(true);
    await page.goto(`${origin}/atlas/yapi/#structure=kidneys`, { waitUntil: "networkidle" });
    await atlas.waitFor({ state: "visible" });
    const reloaded = await inspect("offline-deep-link"); assert.equal(reloaded.selected, "kidneys");
    await page.reload({ waitUntil: "networkidle" }); await atlas.waitFor({ state: "visible" });
    assert.equal((await inspect("offline-reload")).selected, "kidneys");
    await page.screenshot({ path: `${out}/${stem}-offline.png`, fullPage: true });
    assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(sentinels)), sentinels);
    assert.deepEqual(diagnostics.errors, []); assert.deepEqual(diagnostics.failures, []); assert.deepEqual(diagnostics.external, []);
    assert.equal(diagnostics.requests.filter(url => /\/games\/|pixi|\.(?:glb|gltf|mp[34]|webm|wav|ogg)(?:\?|$)/i.test(url)).length, 0, "atlas must not fetch games, heavyweight models, audio/video or Pixi");
    delete diagnostics.coldEntry;
    rows.push({ language, width, reduced, status: "PASS", before, after, coldEntry, entryBudget, installation, measurements, geometryStates, lessonStates, selectionTimings, selectionP95Ms: p95, sourceLinks, sourceRecords, offlineStatus, offlineCache, rootWorkerPredecessor, gameSavesUnchanged: true, diagnostics });
    await context.close(); activePage = null;
  }
  assert.equal(rows.length, expectedCases);
} catch (error) {
  failure = error.stack || String(error);
  if (activePage) await activePage.screenshot({ path: `${out}/failure-${activeCase}.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* process already exited */ } }
  writeFileSync(`${out}/results.json`, JSON.stringify({ origin, expectedCases, budgets: atlasEntryBudgets, packageProof, portal, status: failure ? "FAIL" : "PASS", failure, activeCase, activeDiagnostics: failure ? activeDiagnostics : null, rows,
    limits: ["SVG-only foundation; no active WebGL, physical GPU or alternate renderer claimed.", "Independent anatomy expert review and Polish native-language review remain NOT_REVIEWED.", "Synthetic game-key sentinels prove isolation, not legacy game migration or deep old-cache upgrades.", "Performance: first meaningful view is an operational visible SVG/detail DOM-ready plus two-frame marker, not a standardized FMP API or physical-device guarantee. Document ResourceTiming excludes worker install transfers; separate worker request events and verified uncompressed package bytes are reported without inventing worker wire bytes."] }, null, 2) + "\n");
}
