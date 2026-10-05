// Local HTTP fixture only: reproduce canonical index.html redirects with the
// real game, real Service Worker, CacheStorage and IndexedDB. No production URL.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve, extname, sep} from 'node:path';
import {chromium} from 'playwright';
import {checkedOutputPath} from './browser-guard.mjs';
import {sendFixtureResponse} from './hanedanian-redirect-transport.mjs';

const BASELINE = '562831dba3b16be2a0bc8b2aec2e613eb1b80f45';
const GAME = '/games/hanedanian/';
const root = resolve('.output/public');
const proofRoot = resolve(process.env.RUNNER_TEMP || '/workspace', 'screenshots');
const out = checkedOutputPath(resolve(proofRoot, 'hanedanian-redirect'), [proofRoot]);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const baselineWorker = execFileSync('git', ['show', `${BASELINE}:public/games/hanedanian/sw.js`]);
const fixedWorker = await readFile(resolve(root, 'games/hanedanian/sw.js'));
const expectedHTML = await readFile(resolve(root, 'games/hanedanian/index.html'));
const mime = {'.js':'text/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'};
const report = {baseline: BASELINE, scope:'Local canonical-redirect fixture; no production browser requests', transport:'gzip for textual responses when Accept-Encoding permits; identical for baseline and fixed', fixtureDeviation:'The static build has no SSR portal index: / and /cete-savaslari retain measured 404s in both cases. This experiment changes transport only; it is not full-site production parity.', cases:[], errors:[]};
let browser;

async function exportState(page) {
  await page.locator('#menu-button').click();
  await page.locator('[data-action="export"]').click();
  const state = JSON.parse(await page.locator('#export-text').inputValue()).state;
  await page.locator('#dialog').press('Escape');
  return state;
}
async function resume(page) {
  await page.locator('[data-load="auto"]').first().click();
  await page.locator('#welcome').waitFor({state:'hidden'});
  return exportState(page);
}
async function persist(page) {
  await page.locator('#menu-button').click();
  await page.locator('[data-action="manual-save"]').click();
  await page.waitForFunction(() => document.querySelector('[data-action="manual-save"]')?.disabled === false);
  await page.locator('[data-action="resume"]').click();
  await page.locator('#dialog').waitFor({state:'hidden'});
}
async function snapshot(page) {
  return page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const cacheKeys = await caches.keys(), packages = [];
    for (const key of cacheKeys) {
      if (!key.startsWith('hanedanian-package-')) continue;
      const cache = await caches.open(key);
      const response = await cache.match('/games/hanedanian/index.html');
      const bytes = response && await response.clone().arrayBuffer();
      const hash = bytes && [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2,'0')).join('');
      const fileURLs = (await cache.keys()).map(request => request.url);
      packages.push({key, files:fileURLs.length, fileURLs, html:response && {url:response.url, redirected:response.redirected, type:response.type, status:response.status, statusText:response.statusText, headers:Object.fromEntries(response.headers), sha256:hash}});
    }
    return {url:location.href, controller:navigator.serviceWorker.controller?.scriptURL, controllerState:navigator.serviceWorker.controller?.state, registrations:registrations.map(r => ({scope:r.scope, active:r.active?.state, activeURL:r.active?.scriptURL, installing:r.installing?.state, installingURL:r.installing?.scriptURL, waiting:r.waiting?.state, waitingURL:r.waiting?.scriptURL})), cacheKeys, packages};
  });
}
async function runCase(label, worker) {
  const entry = {label, workerSHA256:digest(worker), requests:[], console:[], pageErrors:[], requestFailures:[], navigations:[], workerErrors:[], workerVersions:[], workerRegistrations:[], browserLog:[], status:'running'};
  report.cases.push(entry);
  const server = createServer(async (req,res) => {
    const request = {path:req.url, method:req.method, requestHeaders:{acceptEncoding:req.headers['accept-encoding'] || null, cacheControl:req.headers['cache-control'] || null, destination:req.headers['sec-fetch-dest'] || null}, startedAt:new Date().toISOString()};
    entry.requests.push(request);
    res.once('finish', () => Object.assign(request, {status:res.statusCode, headers:res.getHeaders(), finishedAt:new Date().toISOString()}));
    res.once('close', () => {request.responseFinished = res.writableFinished;});
    req.once('aborted', () => {request.aborted = true;});
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      request.path = url.pathname;
      if (url.pathname === GAME + 'index.html') {
        sendFixtureResponse(req,res,{status:307,headers:{location:GAME,'cache-control':'no-store'}},request); return;
      }
      // Keep the prior SSR-shell deviation measured: static output has no portal
      // index. Do not invent shell HTML or change a second experimental variable.
      const path = url.pathname === '/cete-savaslari' ? '/index.html' : decodeURIComponent(url.pathname);
      const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
      if (!file.startsWith(root + sep)) { sendFixtureResponse(req,res,{status:403},request); return; }
      const body = path === GAME + 'sw.js' ? worker : await readFile(file);
      sendFixtureResponse(req,res,{headers:{'content-type':mime[extname(file)] || 'application/octet-stream','cache-control':'no-store','x-redirect-fixture':'real-game'},body},request);
    } catch(error) {request.error = error.stack || String(error);sendFixtureResponse(req,res,{status:error.code === 'ENOENT' ? 404 : 500},request);}
  });
  let context, page;
  try {
    await new Promise((done, reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',done);});
    const origin = `http://127.0.0.1:${server.address().port}`;
    entry.origin = origin;
    context = await browser.newContext({viewport:{width:1440,height:960}});
    await context.tracing.start({screenshots:true,snapshots:true,sources:true});
    page = await context.newPage();
    // Read-only browser telemetry: observe worker install/redundancy failures
    // without intercepting requests or changing registration/cache behavior.
    const cdp = await context.newCDPSession(page);
    cdp.on('ServiceWorker.workerErrorReported', event => entry.workerErrors.push({at:new Date().toISOString(), ...event.errorMessage}));
    cdp.on('ServiceWorker.workerVersionUpdated', event => entry.workerVersions.push({at:new Date().toISOString(), versions:event.versions}));
    cdp.on('ServiceWorker.workerRegistrationUpdated', event => entry.workerRegistrations.push({at:new Date().toISOString(), registrations:event.registrations}));
    cdp.on('Log.entryAdded', event => entry.browserLog.push({at:new Date().toISOString(), ...event.entry}));
    await cdp.send('ServiceWorker.enable');
    await cdp.send('Log.enable');
    page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(15000);
    page.on('console', message => entry.console.push({type:message.type(),text:message.text()}));
    page.on('pageerror', error => entry.pageErrors.push(String(error)));
    page.on('requestfailed', request => entry.requestFailures.push({url:request.url(),document:request.isNavigationRequest(),error:request.failure()?.errorText}));
    page.on('response', response => {if(response.request().isNavigationRequest())entry.navigations.push({url:response.url(),status:response.status(),fromServiceWorker:response.fromServiceWorker()});});
    // The server is created here; callers cannot supply a remote browser target.
    await page.goto(origin + GAME + 'index.html');
    assert.equal(page.url(), origin + GAME, 'HTTP307 canonical entry');
    await page.locator('[data-action="new"]').first().click();
    await page.locator('#new-form input[name="seed"]').fill('REDIRECT-FIXTURE');
    await page.locator('#new-form button').click();
    await page.locator('#welcome').waitFor({state:'hidden'});
    if (await page.locator('[data-guide="dismiss"]').isVisible()) await page.locator('[data-guide="dismiss"]').click();
    await page.locator('[data-speed="0"]').click();
    await page.locator('#navigation [data-view="settlement"]').click();
    await page.locator('[data-build="farm"]').click();
    await persist(page);
    const saved = await exportState(page);
    assert.equal(saved.settlements[0].queue.length, 1);
    await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/games/hanedanian/sw.js') && navigator.serviceWorker.controller.state === 'activated', null, {timeout:30000});
    entry.beforeReload = await snapshot(page);
    assert.equal(entry.beforeReload.packages.length, 1, 'one atomically installed game version');
    const cached = entry.beforeReload.packages[0].html;
    assert.equal(cached.sha256, digest(expectedHTML), 'exact real HTML bytes cached');
    assert.equal(cached.status, 200);
    assert.equal(cached.headers['x-redirect-fixture'], 'real-game', 'headers retained');
    assert.equal(cached.redirected, label === 'baseline', 'only fixed worker normalizes redirect metadata');
    await page.screenshot({path:resolve(out, `${label}-before.png`)});
    // Flush diagnostics before navigation can replace the page with an error page.
    await writeFile(resolve(out, 'results.json'), JSON.stringify(report,null,2));
    let navigationError;
    try { await page.reload(); } catch(error) { navigationError = String(error); }
    entry.reloadError = navigationError || null;
    if (label === 'baseline') {
      assert.match(navigationError || '', /net::ERR_FAILED/, 'unchanged baseline must reproduce the reported navigation failure');
      assert.ok(entry.requestFailures.some(r => r.document && r.error === 'net::ERR_FAILED'), 'browser reports a real failed document request');
      entry.status = 'expected-baseline-failure';
      return;
    }
    assert.equal(navigationError, undefined, 'patched online reload succeeds without retry');
    assert.deepEqual((await resume(page)).settlements[0].queue, saved.settlements[0].queue, 'online reload retains actual save');
    assert.ok(entry.navigations.at(-1).fromServiceWorker, 'online reload is served by the real worker');
    await context.setOffline(true);
    await page.reload();
    const restored = await resume(page);
    assert.equal(restored.world.seed, saved.world.seed);
    assert.deepEqual(restored.settlements[0].queue, saved.settlements[0].queue, 'offline reload retains actual save');
    entry.afterOffline = await snapshot(page);
    entry.offlineReload = true;
    assert.ok(entry.navigations.at(-1).fromServiceWorker, 'offline reload uses installed cache');
    assert.deepEqual(entry.pageErrors, [], 'no uncaught game errors');
    // The optional translation layer may be unavailable offline; navigation and
    // every mandatory game package response must still succeed.
    assert.equal(entry.requestFailures.filter(r => r.document || r.url.includes(GAME)).length, 0, 'no game package or navigation failures');
    await page.screenshot({path:resolve(out, `${label}-offline.png`)});
    entry.offlineNetworkDisabled = await page.evaluate(async () => {try {await fetch('/__uncached_redirect_probe__');return false;}catch{return true;}});
    assert.equal(entry.offlineNetworkDisabled, true, 'uncached network really fails');
    entry.status = 'passed';
  } catch(error) {
    entry.error = error.stack || String(error);entry.status='failed';
    if (page && !page.isClosed()) {
      let timer;
      try {
        entry.failureSnapshot = await Promise.race([snapshot(page), new Promise((_, reject) => {timer=setTimeout(() => reject(Error('Failure snapshot exceeded 5s')),5000);})]);
      } catch(snapshotError) {entry.failureSnapshotError = String(snapshotError);}
      finally {clearTimeout(timer);}
    }
    await writeFile(resolve(out,'results.json'),JSON.stringify(report,null,2));
    throw error;
  }
  finally {
    await context?.tracing.stop({path:resolve(out, `${label}-trace.zip`)});
    await context?.close();
    await new Promise((done,reject) => {server.close(error => error ? reject(error) : done());server.closeAllConnections();});
  }
}
try {
  await mkdir(out,{recursive:true});
  browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox']});
  await runCase('baseline', baselineWorker);
  await runCase('fixed', fixedWorker);
  report.status = 'passed';
} catch(error) {report.status='failed';report.errors.push(error.stack || String(error));process.exitCode=1;}
finally {await browser?.close();await mkdir(out,{recursive:true});await writeFile(resolve(out,'results.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.map(c => ({label:c.label,status:c.status,reloadError:c.reloadError})),errors:report.errors}));
