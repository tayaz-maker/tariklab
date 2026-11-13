/* global chrome: readonly */
// chrome is supplied by the isolated extension context inside evaluate callbacks.
// Actual browser zoom/visibility through an isolated Chromium extension, no DOM visibility overrides.
// Official APIs: https://playwright.dev/docs/chrome-extensions
// https://developer.chrome.com/docs/extensions/reference/api/tabs#method-setZoom
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
// User explicitly prohibited visible windows during this task on2026-11-04.
// This native-window test may only run later on a dedicated QA display/host.
if (process.env.SE_DEDICATED_VISIBLE_QA_HOST !== "1") {
  throw new Error(
    "Visible browser tests are disabled on the user's display. Use a dedicated QA host only with its operator's authorization.",
  );
}
const out = "artifacts/social-engine/native-browser";
await mkdir(out, { recursive: true });
const scratch = await mkdtemp(path.resolve("../native-browser-"));
const ext = path.join(scratch, "extension");
await mkdir(ext);
await writeFile(
  path.join(ext, "manifest.json"),
  JSON.stringify({
    manifest_version: 3,
    name: "SOCIAL ENGINE isolated QA",
    version: "1.0",
    permissions: ["tabs"],
    background: { service_worker: "background.js" },
  }),
);
await writeFile(
  path.join(ext, "background.js"),
  "chrome.runtime.onInstalled.addListener(() => {});",
);
const manifest = await readFile("public/games/social-engine/build-manifest.json");
const report = {
  status: "UNVERIFIED",
  startedAt: new Date().toISOString(),
  harnessSha256: createHash("sha256")
    .update(await readFile(import.meta.filename))
    .digest("hex"),
  manifestSha256: createHash("sha256").update(manifest).digest("hex"),
  sourceDigest: JSON.parse(manifest).sourceDigest,
  mode: "headed Chromium, separate empty profile, actual automatic tab zoom and tab activation",
  results: [],
  errors: [],
};
let context, nativeBrowser, ownedProcess, page, extension, tabId;
let launchDiagnostic = "";
try {
  const profile = path.join(scratch, "profile");
  ownedProcess = spawn(
    chromium.executablePath(),
    [
      "--remote-debugging-port=0",
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profile}`,
      "--window-size=1600,1000",
      "--no-first-run",
      "--no-default-browser-check",
      `--disable-extensions-except=${ext}`,
      `--load-extension=${ext}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  ownedProcess.stderr.on("data", (chunk) => {
    launchDiagnostic = (launchDiagnostic + chunk.toString()).slice(-2400);
  });
  ownedProcess.on("error", (error) => { launchDiagnostic = error.message; });
  let port;
  for (let attempt = 0; attempt < 100 && !port; attempt++) {
    if (ownedProcess.exitCode !== null || ownedProcess.signalCode) break;
    try {
      port = Number(
        (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0],
      );
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (!port) {
    report.launchFailure = { code: ownedProcess.exitCode, signal: ownedProcess.signalCode, diagnostic: launchDiagnostic.replaceAll(scratch, "<QA-profile>") };
    throw Error("Isolated native browser did not start: " + JSON.stringify(report.launchFailure));
  }
  nativeBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true });
  context = nativeBrowser.contexts()[0];
  context.setDefaultTimeout(15000);
  report.noDefaults = true;
  for (let attempt = 0; attempt < 100 && !extension; attempt++) {
    for (const worker of context.serviceWorkers()) {
      const info = await worker
        .evaluate(() => ({ id: chrome.runtime.id, name: chrome.runtime.getManifest().name }))
        .catch(() => null);
      if (info?.name === "SOCIAL ENGINE isolated QA") {
        extension = worker;
        report.extension = info;
        break;
      }
    }
    if (!extension) await new Promise((r) => setTimeout(r, 100));
  }
  if (!extension) throw Error("Owned QA extension was not loaded");
  const gameURL =
    (process.env.SE_BASE || "http://127.0.0.1:8097") + "/games/social-engine/index.html?qa=1";
  tabId = await extension.evaluate(
    async (url) => (await chrome.tabs.create({ url, active: true })).id,
    gameURL,
  );
  await extension.evaluate(
    async (id) => chrome.windows.update((await chrome.tabs.get(id)).windowId, { focused: true }),
    tabId,
  );
  for (let attempt = 0; attempt < 100 && !page; attempt++) {
    page = context.pages().find((p) => p.url() === gameURL);
    if (!page) await new Promise((r) => setTimeout(r, 100));
  }
  if (!page) throw Error("Native extension-created game tab was not attached");
  // Disable focus emulation explicitly as well as requesting noDefaults on attachment.
  // false restores actual browser-tab visibility; it does not force a synthetic hidden value.
  const nativeCdp = await context.newCDPSession(page);
  await nativeCdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  report.focusEmulationDisabled = true;
  page.on("pageerror", (e) => report.errors.push(e.message));
  const name = page.getByLabel("Karakter adı");
  await name.fill("Tarayıcı Test");
  // The form accepts typing before its module is ready, but ignores Enter
  // until the real submit handler is installed and the submit button enabled.
  report.phase = "wait-for-character-form";
  await page.waitForFunction(
    () => {
      const submit = document.querySelector("#character [type=submit]");
      return submit && !submit.disabled;
    },
    null,
    { polling: 100 },
  );
  // Native no-defaults sessions can suspend RAF while a window is occluded.
  // Enter submits the focused real form without a RAF-based mouse-stability wait.
  await name.press("Enter");
  report.phase = "start-character";
  await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100, null, {
    polling: 100,
  });
  const getViewport = () =>
    page.evaluate(() => ({
      w: innerWidth,
      h: innerHeight,
      dpr: devicePixelRatio,
      hidden: document.hidden,
    }));
  const before = await getViewport();
  assert.ok(Number.isInteger(tabId));
  await extension.evaluate(async (id) => {
    await chrome.tabs.setZoomSettings(id, { mode: "automatic", scope: "per-tab" });
    await chrome.tabs.setZoom(id, 2);
  }, tabId);
  await page.waitForTimeout(600);
  const zoom = await extension.evaluate(
    async (id) => ({
      factor: await chrome.tabs.getZoom(id),
      settings: await chrome.tabs.getZoomSettings(id),
    }),
    tabId,
  );
  const after = await getViewport();
  assert.equal(zoom.factor, 2);
  assert.equal(zoom.settings.mode, "automatic");
  assert.ok(after.w <= before.w * 0.51);
  assert.ok(after.dpr >= before.dpr * 1.99);
  const menus = [];
  for (const [key, title] of [
    ["KeyM", "Mahalle haritası"],
    ["KeyI", "Çanta & karakter"],
    ["KeyP", "Telefon"],
    ["Escape", "Bir nefes al"],
  ]) {
    await page.keyboard.press(key);
    const modal = page.getByRole("dialog", { name: title, exact: true });
    await modal.waitFor();
    const box = await modal.boundingBox();
    assert.ok(
      box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= after.w + 1 &&
        box.y + box.height <= after.h + 1,
      title + " fits native zoom viewport",
    );
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden" });
    menus.push(title);
  }

  report.results.push({
    name: "Native automatic browser zoom200% with real menu controls",
    status: "PASS",
    before,
    after,
    zoom,
    menus,
  });
  try {
    await page.screenshot({ path: out + "/native-zoom-200.png", timeout: 5000 });
  } catch (e) {
    report.screenshotWarning = e.message;
  }
  await extension.evaluate(async (id) => chrome.tabs.setZoom(id, 1), tabId);
  await extension.evaluate(async (id) => {
    const tab = await chrome.tabs.update(id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  }, tabId);
  await page.bringToFront();
  await page.waitForFunction(() => document.hidden === false, null, {
    polling: 100,
    timeout: 10000,
  });

  await page.evaluate(() => {
    window.__nativeVisibility = [];
    document.addEventListener("visibilitychange", () =>
      window.__nativeVisibility.push({
        hidden: document.hidden,
        tick: window.__socialEngine.projection().tick,
      }),
    );
  });
  // Playwright itself forces every tab focused/visible by default (coreBundle CRPage initialization).
  // Disable that automation override, then let actual tab activation control document.visibilityState.
  report.phase = "background";
  const otherId = await extension.evaluate(async (id) => {
    const game = await chrome.tabs.get(id);
    const tab = await chrome.tabs.create({
      url: "about:blank",
      active: true,
      windowId: game.windowId,
    });
    return tab.id;
  }, tabId);
  report.visibilityProbe = {
    page: await getViewport(),
    tabs: await extension.evaluate(async () =>
      (await chrome.tabs.query({})).map((t) => ({
        id: t.id,
        active: t.active,
        windowId: t.windowId,
        url: t.url,
      })),
    ),
  };
  await page.waitForFunction(() => document.hidden === true, null, {
    polling: 100,
    timeout: 10000,
  });
  await page.waitForTimeout(300);
  report.phase = "paused-snapshot";
  const startObservation = await page.evaluate(() => {
    window.__pauseStart = window.__socialEngine.state();
    return { hidden: document.hidden, events: [...window.__nativeVisibility] };
  });
  assert.equal(startObservation.hidden, true);
  await new Promise((r) => setTimeout(r, 1600));
  const endObservation = await page.evaluate(() => {
    window.__pauseEnd = window.__socialEngine.state();
    return { hidden: document.hidden, events: [...window.__nativeVisibility] };
  });
  report.hiddenInterval = { startObservation, endObservation };
  assert.equal(endObservation.hidden, true);
  assert.ok(
    endObservation.events.slice(startObservation.events.length).every((e) => e.hidden),
    "Actual tab must remain hidden for the whole measured interval",
  );
  // Both snapshot requests are queued before the real tab is reactivated.
  // A browser may suspend the hidden worker; await its responses only after wake.
  report.phase = "reactivate";
  await extension.evaluate(async (id) => {
    const tab = await chrome.tabs.update(id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  }, tabId);
  await page.bringToFront();
  await page.waitForFunction(() => document.hidden === false, null, {
    polling: 100,
    timeout: 10000,
  });
  const [a, b] = await page.evaluate(() => Promise.all([window.__pauseStart, window.__pauseEnd]));
  report.pauseObservation = {
    beforeTick: a.tick,
    afterTick: b.tick,
    startObservation,
    endObservation,
  };
  assert.equal(a.tick, b.tick);
  report.pausedTicks = [a.tick, b.tick];
  report.phase = "resume-ticks";
  await page.waitForFunction((tick) => window.__socialEngine.projection().tick > tick, a.tick, {
    polling: 100,
    timeout: 10000,
  });
  const visibility = await page.evaluate(() => window.__nativeVisibility);
  assert.ok(visibility.some((e) => e.hidden) && visibility.some((e) => !e.hidden));
  await extension.evaluate(async (id) => chrome.tabs.remove(id), otherId);
  report.results.push({
    name: "Actual background tab visibility pauses and reactivation resumes authoritative tick",
    status: "PASS",
    pausedTick: a.tick,
    afterWaitTick: b.tick,
    visibility,
  });
  assert.deepEqual(report.errors, []);
  report.status = "PASS";
} catch (e) {
  report.status = "FAIL";
  report.reason = e.message;
  report.failureObservation = await page
    ?.evaluate(() => ({
      hidden: document.hidden,
      visibility: document.visibilityState,
      focused: document.hasFocus(),
      events: window.__nativeVisibility ?? [],
      tick: window.__socialEngine?.projection()?.tick,
    }))
    .catch(() => null);
  report.failureTabs = await extension
    ?.evaluate(async () =>
      (await chrome.tabs.query({})).map((t) => ({
        id: t.id,
        active: t.active,
        windowId: t.windowId,
      })),
    )
    .catch(() => null);
  report.gameTabId = tabId;
  process.exitCode = 1;
} finally {
  await nativeBrowser?.close();
  if (ownedProcess && ownedProcess.exitCode === null) ownedProcess.kill("SIGTERM");
  report.finishedAt = new Date().toISOString();
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
