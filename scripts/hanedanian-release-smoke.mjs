// Explicitly invoked release smoke against the two TarikLab hosts or a scoped
// project preview. Fresh browser contexts only; never clears existing user data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { checkedOutputPath } from './browser-guard.mjs';

const GAME = '/games/hanedanian/';
const FILES = ['index.html', 'style.css', 'app.js', 'data.js', 'world.js', 'engine.js',
  'campaign.js', 'i18n.js', 'map.js', 'map-pixi.js', 'map-factory.js', 'map-dom.js',
  'mapintel.js', 'orders.js', 'outcome-moment.js', 'save.js', 'icon.svg',
  'manifest.webmanifest'].map(name => GAME + name).concat('/games/shared/outcome-runtime.js');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--base-url', '--expected-worker-sha', '--output-dir'].includes(args[i]), `Unknown argument: ${args[i]}`);
  assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), `Missing value for ${args[i]}`);
  assert.equal(options[args[i]], undefined, `Repeated argument: ${args[i]}`);
  options[args[i]] = args[i + 1];
}
assert.ok(options['--base-url'], 'Required: --base-url https://www.tariklab.com');
assert.match(options['--expected-worker-sha'] || '', /^[a-f0-9]{64}$/i, 'Required: exact built SW SHA256 via --expected-worker-sha');
const target = new URL(options['--base-url']);
assert.equal(target.protocol, 'https:', 'Only HTTPS release hosts are allowed');
assert.equal(target.username + target.password + target.port + target.search + target.hash, '', 'No credentials, port, query or fragment');
assert.equal(target.pathname, '/', 'Provide an origin, not an arbitrary route');
assert.ok(target.hostname === 'www.tariklab.com' || target.hostname === 'tariklab.tayaz29.workers.dev'
  || target.hostname === 'astra-han-offline-redirect-fix-tariklab.tayaz29.workers.dev'
  || /^[a-f0-9]{8}-tariklab\.tayaz29\.workers\.dev$/.test(target.hostname)
  || /^cete-savaslari-[a-z0-9-]+\.vercel\.app$/.test(target.hostname), 'Host is outside the TarikLab release allowlist');
const origin = target.origin;
const expectedSHA = options['--expected-worker-sha'].toLowerCase();
const proofRoot = resolve(process.env.RUNNER_TEMP || '/workspace', 'screenshots');
const out = checkedOutputPath(resolve(options['--output-dir'] || resolve(proofRoot, `han-release-${target.hostname}`)), [proofRoot]);
const report = { startedAt: new Date().toISOString(), origin, expectedWorkerSHA256: expectedSHA,
  scope: 'Three fresh contexts: real campaign/farm/manual save/export/two reloads, exact worker and complete 19-file package. No offline claim or physical GPU claim.',
  status: 'running', browserVersion: null, cases: [], errors: [] };
let browser;

async function exportState(page) {
  await page.locator('#menu-button').click();
  await page.locator('[data-action="export"]').click();
  const state = JSON.parse(await page.locator('#export-text').inputValue()).state;
  await page.locator('#dialog').press('Escape');
  await page.locator('#dialog').waitFor({ state: 'hidden' });
  return state;
}
async function persist(page) {
  await page.locator('#menu-button').click();
  await page.locator('[data-action="manual-save"]').click();
  await page.waitForFunction(() => document.querySelector('[data-action="manual-save"]')?.disabled === false);
  await page.locator('[data-action="resume"]').click();
  await page.locator('#dialog').waitFor({ state: 'hidden' });
}
async function awaitPackage(page, version) {
  await page.waitForFunction(async ({ version, files }) => {
    const worker = navigator.serviceWorker.controller;
    if (!worker?.scriptURL.endsWith('/games/hanedanian/sw.js') || worker.state !== 'activated') return false;
    if (!(await caches.keys()).includes(version)) return false;
    const cache = await caches.open(version);
    const keys = await cache.keys();
    if (keys.length !== files.length) return false;
    return (await Promise.all(files.map(path => cache.match(path)))).every(response => response?.status === 200);
  }, { version, files: FILES }, { timeout: 30000, polling: 250 });
}
async function snapshot(page, version) {
  return page.evaluate(async ({ version, files }) => {
    const keys = await caches.keys();
    const cache = await caches.open(version);
    const requests = await cache.keys();
    const html = await cache.match('/games/hanedanian/index.html');
    const bytes = html && await html.clone().arrayBuffer();
    const htmlHash = bytes && Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    const registrations = await navigator.serviceWorker.getRegistrations();
    const fileURLs = requests.map(request => request.url);
    return { finalURL: location.href, viewport: { width: innerWidth, height: innerHeight },
      documentScrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth,
      horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      canvasCount: document.querySelectorAll('canvas').length,
      package: { version, keys: keys.filter(key => key.startsWith('hanedanian-package-')), files: fileURLs,
        missing: files.filter(path => !fileURLs.includes(new URL(path, location.origin).href)),
        html: html && { status: html.status, contentType: html.headers.get('content-type'), redirected: html.redirected, sha256: htmlHash } },
      controller: { url: navigator.serviceWorker.controller?.scriptURL, state: navigator.serviceWorker.controller?.state },
      registrations: registrations.map(r => ({ scope: r.scope, activeURL: r.active?.scriptURL, state: r.active?.state })) };
  }, { version, files: FILES });
}
async function checkpoint(page, entry, label) {
  const state = await snapshot(page, entry.buildVersion);
  entry.snapshots.push({ label, at: new Date().toISOString(), ...state });
  assert.equal(state.finalURL, entry.initialCanonicalURL, `${label}: host's initial canonical navigation URL is preserved`);
  assert.equal(state.horizontalOverflow, 0, `${label}: no horizontal overflow`);
  assert.deepEqual(state.package.keys, [entry.buildVersion], `${label}: one exact game package`);
  assert.equal(state.package.files.length, 19, `${label}: complete package`);
  assert.deepEqual(state.package.missing, [], `${label}: all package paths present`);
  assert.equal(state.package.html.status, 200, `${label}: cached HTML status`);
  assert.match(state.package.html.contentType || '', /text\/html/i, `${label}: cached HTML content type`);
  assert.equal(state.package.html.redirected, false, `${label}: normalized cached navigation`);
  await page.screenshot({ path: resolve(out, `${entry.width}-${label}.png`), fullPage: true });
  entry.screenshots.push(`${entry.width}-${label}.png`);
}
async function runCase(width, height) {
  const entry = { width, height, startedAt: new Date().toISOString(), status: 'running',
    requests: [], httpErrors: [], requestFailures: [], consoleErrors: [], pageErrors: [], navigations: [],
    snapshots: [], screenshots: [], reloads: [], contextClosed: false };
  report.cases.push(entry);
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  let page;
  try {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);
    page.on('console', message => { if (message.type() === 'error') entry.consoleErrors.push({ at: new Date().toISOString(), text: message.text() }); });
    page.on('pageerror', error => entry.pageErrors.push(String(error)));
    context.on('requestfailed', request => entry.requestFailures.push({ url: request.url(), error: request.failure()?.errorText }));
    context.on('response', response => {
      const record = { url: response.url(), status: response.status(), fromServiceWorker: response.fromServiceWorker() };
      entry.requests.push(record);
      if (record.status >= 400) entry.httpErrors.push(record);
      if (response.request().isNavigationRequest()) entry.navigations.push(record);
    });
    // Fetch exact deployed bytes independently of a game cache. No auth/bypass
    // headers, retries, redirects, response rewriting or request interception.
    const workerResponse = await context.request.get(origin + GAME + 'sw.js', { timeout: 15000, maxRedirects: 0 });
    assert.equal(workerResponse.status(), 200, 'worker source must return HTTP200');
    const contentType = workerResponse.headers()['content-type'] || '';
    assert.match(contentType, /(?:javascript|ecmascript)/i, 'worker source MIME');
    const workerBody = await workerResponse.body();
    entry.worker = { url: workerResponse.url(), status: workerResponse.status(), contentType, bytes: workerBody.length,
      sha256: sha256(workerBody), retrievedAt: new Date().toISOString() };
    assert.equal(entry.worker.sha256, expectedSHA, 'deployed worker must exactly match the candidate build');
    const version = workerBody.toString().match(/const VERSION\s*=\s*(?:\/\*[^]*?\*\/\s*)?["'](hanedanian-package-[a-f0-9]{16})["']/)?.[1];
    assert.ok(version, 'deployed worker must have an exact built package version');
    entry.buildVersion = version;
    const navigation = await page.goto(origin + GAME + 'index.html', { waitUntil: 'networkidle' });
    assert.equal(navigation.status(), 200, 'initial game HTML HTTP200');
    assert.match(navigation.headers()['content-type'] || '', /text\/html/i, 'initial HTML MIME');
    // Vercel serves index.html directly; Workers canonicalizes to the directory.
    // Both are valid same-origin entry points, but reloads must retain the one
    // the host actually selected. A third URL is never accepted.
    entry.initialCanonicalURL = page.url();
    assert.ok([origin + GAME, origin + GAME + 'index.html'].includes(entry.initialCanonicalURL),
      'initial navigation stays at the same-origin game directory or index.html');
    await page.locator('[data-action="new"]').first().click();
    const seed = `RELEASE-${width}`;
    await page.locator('#new-form input[name="seed"]').fill(seed);
    await page.locator('#new-form button').click();
    await page.locator('#welcome').waitFor({ state: 'hidden' });
    if (await page.locator('[data-guide="dismiss"]').isVisible()) await page.locator('[data-guide="dismiss"]').click();
    await page.locator('[data-speed="0"]').click();
    await awaitPackage(page, version);
    await checkpoint(page, entry, 'started');
    await page.locator('#navigation [data-view="settlement"]').click();
    await page.locator('[data-build="farm"]').click();
    await persist(page);
    const saved = await exportState(page);
    assert.equal(saved.world.seed, seed);
    assert.equal(saved.paused, true, 'campaign is paused before persistence');
    assert.equal(saved.settlements[0].queue.length, 1, 'farm command creates exactly one real job');
    assert.equal(saved.settlements[0].queue[0].building, 'farm');
    entry.saved = { seed: saved.world.seed, queue: saved.settlements[0].queue, time: saved.time,
      paused: saved.paused, exportedStateSHA256: sha256(JSON.stringify(saved)) };
    await checkpoint(page, entry, 'saved');
    for (let reload = 1; reload <= 2; reload++) {
      const response = await page.reload({ waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, `reload ${reload}: HTML HTTP200 without retry`);
      assert.match(response.headers()['content-type'] || '', /text\/html/i);
      assert.equal(response.fromServiceWorker(), true, `reload ${reload}: scoped worker actually serves navigation`);
      await page.locator('[data-load="auto"]').first().click();
      await page.locator('#welcome').waitFor({ state: 'hidden' });
      const restored = await exportState(page);
      assert.equal(restored.world.seed, saved.world.seed, `reload ${reload}: exact saved seed`);
      assert.equal(restored.paused, true, `reload ${reload}: paused state retained`);
      assert.deepEqual(restored.settlements[0].queue, saved.settlements[0].queue, `reload ${reload}: exact saved farm queue`);
      assert.equal(restored.time, saved.time, `reload ${reload}: paused clock unchanged`);
      await awaitPackage(page, version);
      await checkpoint(page, entry, `reload-${reload}`);
      entry.reloads.push({ reload, status: response.status(), fromServiceWorker: response.fromServiceWorker(),
        seed: restored.world.seed, queue: restored.settlements[0].queue, time: restored.time, finalURL: page.url() });
    }
    assert.deepEqual(entry.httpErrors, [], 'all observed online HTTP errors, including optional shared requests, must be zero');
    assert.deepEqual(entry.requestFailures, [], 'no failed online requests');
    assert.deepEqual(entry.pageErrors, [], 'no uncaught page exceptions');
    assert.deepEqual(entry.consoleErrors, [], 'no console errors; none are filtered');
    entry.status = 'passed';
  } catch (error) {
    entry.status = 'failed';
    entry.error = error.stack || String(error);
    if (page && !page.isClosed() && new URL(page.url()).protocol === 'https:') {
      try {
        await page.screenshot({ path: resolve(out, `${width}-failure.png`), timeout: 5000 });
        entry.screenshots.push(`${width}-failure.png`);
      } catch (captureError) { entry.failureCaptureError = String(captureError); }
    }
    throw error;
  } finally {
    try { await context.tracing.stop({ path: resolve(out, `${width}-trace.zip`) }); }
    finally { await context.close(); entry.contextClosed = true; entry.finishedAt = new Date().toISOString(); }
    await writeFile(resolve(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
try {
  await mkdir(out, { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] });
  report.browserVersion = browser.version();
  for (const [width, height] of [[1440, 900], [390, 844], [320, 800]]) await runCase(width, height);
  assert.equal(browser.contexts().length, 0, 'all fresh release contexts are closed');
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.errors.push(error.stack || String(error)); process.exitCode = 1; }
finally {
  await browser?.close();
  report.finishedAt = new Date().toISOString();
  await mkdir(out, { recursive: true });
  await writeFile(resolve(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ status: report.status, origin, cases: report.cases.map(c => ({ width: c.width, status: c.status, buildVersion: c.buildVersion, reloads: c.reloads.length, contextClosed: c.contextClosed })), errors: report.errors, out }));
