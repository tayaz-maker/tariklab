// Bounded, real-browser proof for the HANEDANIAN atlas upgrade.
// Examples:
//   node scripts/hanedanian-ultra-browser.mjs --base http://127.0.0.1:8080 --label head
//   node /path/to/head/scripts/hanedanian-ultra-browser.mjs --serve /path/to/base/public --label baseline --baseline
// On a confirmed software-only WebGL runner: --expect-renderer canvas.
// The default requires actual Pixi; a silent fallback cannot produce a false PASS.
// No CI polling, game-state injection, network interception or unattended soak.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';
import { checkedUrl, checkedOutputPath } from './browser-guard.mjs';

const args = process.argv.slice(2);
const value = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const label = value('--label', 'head');
assert.match(label, /^[a-z0-9_-]+$/i, 'label must be a safe filename');
const baseline = args.includes('--baseline');
const only = value('--only', null);
const expectedRenderer = value('--expect-renderer', 'pixi');
assert.ok(['pixi', 'canvas'].includes(expectedRenderer), 'expected renderer must be pixi or canvas');
const output = checkedOutputPath(value('--out', `/workspace/screenshots/hanedanian-ultra/${label}`), ['/workspace/screenshots', resolve(process.env.RUNNER_TEMP || '/workspace', 'screenshots')], 'proof');
await mkdir(output, { recursive: true });
const results = [], failures = [];
let server, browser, activePage;
let origin = checkedUrl(value('--base', process.env.GAME_E2E_ORIGIN || 'http://127.0.0.1:8080'));
const staticRoot = value('--serve', null);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
if (staticRoot) {
  const root = resolve(staticRoot);
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
      if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
  origin = `http://127.0.0.1:${server.address().port}`;
}

async function layout(page, scenario, phase) {
  const measure = await page.evaluate(() => ({
    width: innerWidth, scroll: document.documentElement.scrollWidth,
    content: document.body.innerText.length,
    canvasCount: document.querySelectorAll('#map-workspace canvas').length,
    terrainHosts: document.querySelectorAll('.map-terrain-host').length,
    mode: document.querySelector('#world-map')?.dataset.mapMode || 'directory',
    stockValues: [...document.querySelectorAll('.resources .resource b')].map(el => ({
      text: el.innerText, available: el.clientWidth, needed: el.scrollWidth,
    })),
  }));
  assert.ok(measure.content > 100, `${scenario}/${phase}: content rendered`);
  assert.ok(measure.scroll <= measure.width + 1, `${scenario}/${phase}: horizontal overflow ${JSON.stringify(measure)}`);
  assert.ok(measure.canvasCount <= 2 && measure.terrainHosts <= 1, `${scenario}/${phase}: orphaned terrain canvas`);
  if (!baseline && measure.width <= 450) assert.ok(measure.stockValues.every(value => value.needed <= value.available + 1), `${scenario}/${phase}: resource values overlap or clip ${JSON.stringify(measure.stockValues)}`);
  results.push({ scenario, phase, ...measure });
  return measure;
}
async function archive(page) {
  await page.locator('#menu-button').click();
  await page.locator('[data-action="export"]').click();
  const state = JSON.parse(await page.locator('#export-text').inputValue()).state;
  await page.locator('#dialog').press('Escape');
  return state;
}
async function newCampaign(page, seed) {
  const button = page.locator('[data-action="new"]').filter({ visible: true });
  if (!await button.count()) await page.locator('#menu-button').click();
  await page.locator('[data-action="new"]').filter({ visible: true }).first().click();
  await page.locator('#new-form input[name="seed"]').fill(seed);
  const begin = performance.now();
  await page.locator('#new-form button[type="submit"]').click();
  await page.locator('#welcome').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => Number(document.querySelector('#world-map')?.dataset.drawnTiles) > 0 || !!document.querySelector('.map-directory:not([hidden]) [data-atlas-tile]'));
  const firstInteractiveMs = performance.now() - begin;
  if (await page.locator('[data-guide="dismiss"]').isVisible()) await page.locator('[data-guide="dismiss"]').click();
  return firstInteractiveMs;
}
async function saveReload(page, expected, scenario) {
  await page.locator('#menu-button').click();
  await page.locator('[data-action="manual-save"]').click();
  await page.waitForFunction(() => document.querySelector('[data-action="manual-save"]')?.disabled === false);
  await page.locator('[data-action="resume"]').click();
  await page.locator('#dialog').waitFor({ state: 'hidden' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-load="auto"]').first().click();
  await page.locator('#welcome').waitFor({ state: 'hidden' });
  const actual = await archive(page);
  assert.equal(actual.world.seed, expected.world.seed, `${scenario}: reload seed`);
  assert.deepEqual(actual.settlements, expected.settlements, `${scenario}: reload resources and build queue`);
  assert.deepEqual(actual.armies, expected.armies, `${scenario}: reload pending order`);
}
async function selectScoutTile(page, directory) {
  if (directory) {
    await page.locator('[data-atlas-coordinates] [name="x"]').fill('26');
    await page.locator('[data-atlas-coordinates] [name="y"]').fill('25');
    await page.locator('[data-atlas-coordinates] button[type="submit"]').click();
  } else {
    const map = page.locator('#world-map');
    await map.press('Home'); await map.press('ArrowRight'); await map.press('ArrowRight'); await map.press('ArrowDown');
  }
  await page.locator('#inspector.has-selection').waitFor();
}
async function rendererReady(page, kind) {
  if (kind === 'dom') {
    await page.locator('.map-directory').waitFor({ state: 'visible' });
    assert.ok(await page.locator('.atlas-overview').isVisible(), 'procedural SVG overview renders without Canvas');
    assert.equal(await page.locator('#world-map').isVisible(), false, 'unavailable Canvas hidden');
  } else {
    await page.waitForFunction(() => document.querySelector('#world-map')?.dataset.atlas === 'ready');
    if (kind === 'pixi') await page.locator('.map-terrain-host canvas').waitFor();
    else assert.equal(await page.locator('.has-pixi-terrain').count(), 0, 'WebGL unavailable keeps Canvas renderer');
  }
}
async function mapInteractions(page, scenario, kind) {
  if (kind === 'dom') return;
  const canvas = page.locator('#world-map');
  await page.locator('#map-workspace [data-map="world"]').click();
  await page.waitForFunction(() => document.querySelector('#world-map')?.dataset.mapMode === 'world');
  await canvas.press('Escape');
  await page.locator('[data-region="4"]').click();
  await page.waitForFunction(() => document.querySelector('#world-map')?.dataset.mapMode === 'region');
  await page.locator('#map-workspace [data-map="in"]').click();
  await page.locator('#map-workspace [data-map="in"]').click();
  await page.locator('#map-workspace [data-map="in"]').click();
  await page.waitForFunction(() => document.querySelector('#world-map')?.dataset.mapMode === 'near');
  await rendererReady(page, kind);
  const box = await canvas.boundingBox();
  const anchor = { x: box.x + box.width * .48, y: box.y + box.height * .35 };
  const touchClient = page.viewportSize().width < 500 ? await page.context().newCDPSession(page) : null;
  const touch = async (type, points) => touchClient.send('Input.dispatchTouchEvent', {
    type, touchPoints: points.map((point, id) => ({ ...point, id, radiusX: 4, radiusY: 4, force: 1 })),
  });
  if (touchClient) {
    const oldZoom = Number(await canvas.getAttribute('data-zoom'));
    await touch('touchStart', [{ x: anchor.x - 15, y: anchor.y }, { x: anchor.x + 15, y: anchor.y }]);
    await touch('touchMove', [{ x: anchor.x - 35, y: anchor.y }, { x: anchor.x + 35, y: anchor.y }]);
    await touch('touchEnd', []);
    await page.waitForFunction(zoom => Number(document.querySelector('#world-map').dataset.zoom) > zoom, oldZoom);
  }
  const before = await canvas.getAttribute('data-center');
  const samples = [];
  for (let i = 0; i < 8; i++) {
    const end = { x: anchor.x + (i % 2 ? -30 : 40), y: anchor.y + 12 };
    if (touchClient) {
      await touch('touchStart', [anchor]); await touch('touchMove', [end]); await touch('touchEnd', []);
    } else {
      await page.mouse.move(anchor.x, anchor.y); await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 3 }); await page.mouse.up();
    }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    samples.push(Number(await canvas.getAttribute('data-render-ms')));
  }
  assert.notEqual(await canvas.getAttribute('data-center'), before, 'real drag pans map');
  assert.ok(samples.every(n => Number.isFinite(n) && n >= 0), 'render cost samples finite');
  await touchClient?.detach();
  results.push({ scenario, phase: 'pan-performance', samplesMs: samples, medianMs: [...samples].sort((a, b) => a - b)[4] });
  await page.locator('#map-legend summary').click();
  for (const layer of await page.locator('[data-layer]').all()) { await layer.uncheck(); await layer.check(); }
  await page.locator('#map-legend summary').click();
  await layout(page, scenario, 'zoom-pan-layers');
  if (!baseline) {
    await page.locator('[data-map="accessible"]').click();
    await page.locator('.map-directory').waitFor({ state: 'visible' });
    await selectScoutTile(page, true);
    await page.locator('[data-map="accessible"]').click();
    await canvas.waitFor({ state: 'visible' });
    await rendererReady(page, kind);
  }
}

try {
  const ready = await fetch(`${origin}/games/hanedanian/index.html`);
  assert.ok(ready.ok, 'HANEDANIAN server is ready');
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] });
  const kinds = baseline ? ['pixi', 'canvas'] : ['pixi', 'canvas', 'dom'];
  for (const kind of kinds) for (const width of [1440, 390, 320]) {
    const scenario = `${kind === 'pixi' ? `auto-${expectedRenderer}` : kind}-${width}`, errors = [];
    const renderer = kind === 'pixi' ? expectedRenderer : kind;
    if (only && scenario !== only) continue;
    const context = await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 844 }, isMobile: width < 500, hasTouch: width < 500, deviceScaleFactor: 1 });
    const page = await context.newPage(); activePage = page; page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    if (kind !== 'pixi') await page.addInitScript((mode) => {
      const actual = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (name, ...rest) {
        if (mode === 'dom' || String(name).startsWith('webgl')) return null;
        return actual.call(this, name, ...rest);
      };
    }, kind);
    await page.goto(`${origin}/games/hanedanian/index.html`, { waitUntil: 'domcontentloaded' });
    await page.locator('#welcome [data-action="new"]').waitFor();
    await layout(page, scenario, 'welcome');
    const firstInteractiveMs = await newCampaign(page, 'TL-ULTRA-BASELINE');
    await rendererReady(page, renderer);
    if (kind === 'pixi' && expectedRenderer === 'canvas') await page.locator('#world-map[data-renderer-fallback="software"]').waitFor({ state: 'visible' });
    results.push({ scenario, phase: 'campaign-start', firstInteractiveMs, renderer });
    await layout(page, scenario, 'campaign');
    await mapInteractions(page, scenario, renderer);
    for (const view of ['settlement', 'army', 'council', 'dynasty', 'map']) {
      await page.locator(`#navigation [data-view="${view}"]`).click();
      await layout(page, scenario, `screen-${view}`);
    }
    await page.setViewportSize({ width: width === 1440 ? 390 : 1440, height: 900 });
    await layout(page, scenario, 'resize-out');
    await page.setViewportSize({ width, height: width > 500 ? 900 : 844 });
    await layout(page, scenario, 'resize-back');
    await page.locator('#navigation [data-view="settlement"]').click();
    await page.locator('[data-build="farm"]').click();
    await page.locator('#navigation [data-view="map"]').click();
    await selectScoutTile(page, kind === 'dom');
    await layout(page, scenario, 'selected-order');
    await page.screenshot({ path: `${output}/${scenario}-decision.png`, fullPage: true });
    await page.locator('[data-action="scout"]').click();
    await page.locator('#scout-form button[type="submit"]').click();
    await page.locator('#dialog').waitFor({ state: 'hidden' });
    const expected = await archive(page);
    assert.ok(expected.settlements[0].queue.some(q => q.building === 'farm'), 'real paid construction queue');
    assert.ok(expected.armies.some(a => a.mission === 'scout'), 'real scout order dispatched');
    await saveReload(page, expected, scenario);
    await rendererReady(page, renderer);
    await layout(page, scenario, 'save-reload');
    await page.screenshot({ path: `${output}/${scenario}.png`, fullPage: true });
    await newCampaign(page, 'TL-ULTRA-RESET');
    await rendererReady(page, renderer);
    assert.equal((await archive(page)).world.seed, 'TL-ULTRA-RESET');
    await layout(page, scenario, 'new-world-reset');
    if (renderer === 'pixi' && !baseline) {
      const lost = await page.evaluate(() => {
        const terrain = document.querySelector('.map-terrain-host canvas');
        const gl = terrain?.getContext('webgl2') || terrain?.getContext('webgl');
        const extension = gl?.getExtension('WEBGL_lose_context');
        if (!extension) return false;
        extension.loseContext();
        return true;
      });
      assert.equal(lost, true, 'browser can exercise a real WebGL context loss');
      await page.locator('.map-terrain-host').waitFor({ state: 'detached' });
      await rendererReady(page, 'canvas');
      await selectScoutTile(page, false);
      await layout(page, scenario, 'context-loss-fallback');
    } else if (kind === 'pixi' && expectedRenderer === 'canvas') {
      results.push({ scenario, phase: 'context-loss-fallback', status: 'not-applicable', reason: 'Confirmed software WebGL selects Canvas; physical GPU Pixi requires its own release check.' });
    }
    assert.deepEqual(errors, [], `${scenario}: console/runtime errors`);
    results.push({ scenario, phase: 'complete', errors });
    await context.close();
    console.log(JSON.stringify({ scenario, passed: true }));
  }
  assert.ok(results.some(row => row.phase === 'complete'), 'at least one browser scenario must run');
} catch (error) {
  failures.push(String(error.stack || error));
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) await new Promise(done => server.close(done));
  await writeFile(`${output}/results.json`, JSON.stringify({ label, baseline, expectedRenderer, origin, results, failures }, null, 2));
}
console.log(JSON.stringify({ label, checks: results.length, failures, output }, null, 2));
