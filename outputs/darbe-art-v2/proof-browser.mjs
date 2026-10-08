// Isolated proof-viewer QA, not a duel, save, PWA, or cold-offline-load test.
// Run after build-proof.mjs with the repository's existing Playwright installation.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';
import {buildCards} from '../../public/games/duel-core/card-data.js';
import {designs} from '../../public/games/darbe-h/designs.js';
import {SCENES, renderScene} from './proof-art.mjs';

const output = resolve(process.env.RUNNER_TEMP || '/workspace/screenshots', 'darbe-art-proof');
const root = new URL('../../', import.meta.url);
const modes = ['new', 'old', 'both'];
const report = {
  scope: 'Static proof viewer only. Offline means toggles after a successful online load; no product, duel, save, PWA, or cold-network-reload acceptance.',
  matrix: {widths: [320, 390, 1440], reducedMotion: ['reduce', 'no-preference']},
  startedAt: new Date().toISOString(), cases: [], serverRequests: [], status: 'running',
};
let server, browser, context, page, activeCase, failure;
const errorText = error => error?.stack || String(error);
const dataURL = svg => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

// Browser observations are kept in the same JSON as each screenshot state.
async function observe(view, mode, expected) {
  return view.locator('html').evaluate((html, {mode, expected}) => {
    const doc = html.ownerDocument, win = doc.defaultView;
    const rect = node => { const r = node.getBoundingClientRect(); return {width: r.width, height: r.height, left: r.left, right: r.right}; };
    const variants = [...doc.querySelectorAll('[data-variant]')].filter(node => !node.hidden);
    const faces = variants.flatMap(node => [...node.querySelectorAll('.playing-card')]);
    const rules = [...doc.querySelectorAll('[data-card-rules]')].map(node => {
      const css = win.getComputedStyle(node);
      return {id: node.dataset.cardRules, text: node.textContent, ...rect(node), scrollHeight: node.scrollHeight, clientHeight: node.clientHeight, overflow: css.overflow, maxHeight: css.maxHeight, lineClamp: css.webkitLineClamp};
    });
    const cards = [...doc.querySelectorAll('[data-proof-card]')].map(node => ({id: node.dataset.proofCard, name: node.querySelector('h2').textContent, ...rect(node)}));
    const faceData = faces.map(node => ({id: node.closest('[data-proof-card]').dataset.proofCard, variant: node.closest('[data-variant]').dataset.variant, label: node.getAttribute('aria-label'), name: node.querySelector('.dh-name')?.textContent, ...rect(node)}));
    const buttons = [...doc.querySelectorAll('[data-proof-view]')].map(node => ({mode: node.dataset.proofView, pressed: node.getAttribute('aria-pressed'), ...rect(node)}));
    return {
      mode: doc.body.dataset.proofMode, expectedMode: mode, viewport: win.innerWidth,
      reducedMotion: win.matchMedia('(prefers-reduced-motion: reduce)').matches,
      documentWidth: Math.max(html.scrollWidth, doc.body.scrollWidth),
      variants: variants.map(node => ({id: node.closest('[data-proof-card]').dataset.proofCard, variant: node.dataset.variant})),
      cards, rules, faces: faceData, buttons, status: doc.getElementById('proof-status').textContent,
      animations: doc.getAnimations().length,
      interactiveFigures: doc.querySelectorAll('.proof-variant button,.proof-variant a,.proof-variant input,.proof-variant [tabindex],.proof-notes button,.proof-notes a,.proof-notes [tabindex]').length,
      expectedIDs: expected.map(card => card.id),
    };
  }, {mode, expected});
}

function verifyState(state, expected, width, reducedMotion) {
  const tag = `${width}/${reducedMotion}/${state.expectedMode}`;
  assert.equal(state.mode, state.expectedMode, tag + ': selected mode');
  assert.equal(state.viewport, width, tag + ': actual CSS viewport');
  assert.equal(state.reducedMotion, reducedMotion === 'reduce', tag + ': media preference');
  assert.ok(state.documentWidth <= width + 1, tag + ': horizontal document overflow');
  assert.deepEqual(state.cards.map(card => card.id), expected.map(card => card.id), tag + ': ten actual cards');
  assert.equal(state.rules.length, 10, tag + ': all ten rules');
  assert.equal(state.animations, 0, tag + ': static viewer has no animations');
  assert.equal(state.interactiveFigures, 0, tag + ': figures and notes are not controls');
  assert.equal(state.buttons.length, 3, tag + ': three modes');
  for (const button of state.buttons) {
    assert.equal(button.pressed, String(button.mode === state.mode), tag + ': aria-pressed');
    assert.ok(button.width >= 44 && button.height >= 44, tag + ': 44px mode control');
  }
  assert.ok(state.status.trim(), tag + ': live status text');
  for (const card of expected) {
    const shown = state.cards.find(item => item.id === card.id);
    const rules = state.rules.find(item => item.id === card.id);
    assert.equal(shown.name, card.name, tag + ': original name ' + card.id);
    assert.equal(rules.text, card.rules, tag + ': unchanged full rules ' + card.id);
    assert.ok(rules.width > 0 && rules.height > 0, tag + ': rules remain visible ' + card.id);
    assert.ok(rules.scrollHeight <= rules.clientHeight + 1, tag + ': rules are not clipped ' + card.id);
    assert.equal(rules.overflow, 'visible', tag + ': rules overflow visible ' + card.id);
    assert.equal(rules.maxHeight, 'none', tag + ': no rule height limit ' + card.id);
    assert.ok(['none', 'unset', ''].includes(rules.lineClamp), tag + ': no rule line clamp ' + card.id);
    for (const rect of [shown, rules]) assert.ok(rect.left >= -1 && rect.right <= width + 1, tag + ': content fits ' + card.id);
  }
  const expectedVariants = state.mode === 'both' ? ['old', 'new'] : [state.mode];
  assert.equal(state.variants.length, expected.length * expectedVariants.length, tag + ': visible variant count');
  assert.equal(state.faces.length, expected.length * expectedVariants.length, tag + ': actual cardFace count');
  for (const card of expected) {
    assert.deepEqual(state.variants.filter(item => item.id === card.id).map(item => item.variant).sort(), expectedVariants.toSorted(), tag + ': variants ' + card.id);
    for (const face of state.faces.filter(item => item.id === card.id)) {
      assert.equal(face.label, card.name, tag + ': original accessible face name');
      assert.equal(face.name, card.name, tag + ': original face heading');
      assert.ok(face.width > 0 && Math.abs(face.height - face.width * 86 / 59) <= 1, tag + ': original 59/86 outer card ratio ' + card.id);
    }
  }
}

async function decodeVisibleImages(view, expected, mode) {
  const decoded = [];
  // Scrolling makes production cardFace's loading=lazy images eligible without
  // rewriting their loading attribute or otherwise changing the proof document.
  for (const card of expected) {
    const entry = view.locator(`[data-proof-card="${card.id}"]`);
    const variants = mode === 'both' ? ['old', 'new'] : [mode];
    for (const variant of variants) {
      const figure = entry.locator(`[data-variant="${variant}"]`);
      await figure.scrollIntoViewIfNeeded();
      const images = figure.locator('img');
      assert.equal(await images.count(), 2, `${card.id}/${variant}: face and full scene images`);
      for (let i = 0; i < 2; i++) {
        const image = images.nth(i);
        await image.scrollIntoViewIfNeeded();
        const result = await image.evaluate(async node => {
          let timer;
          try {
            await Promise.race([node.decode(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Image decode timed out')), 10000); })]);
          } finally { clearTimeout(timer); }
          return {complete: node.complete, width: node.naturalWidth, height: node.naturalHeight, src: node.currentSrc || node.src, alt: node.alt};
        });
        assert.equal(result.complete, true, `${card.id}/${variant}: decoded`);
        assert.equal(result.width, 240, `${card.id}/${variant}: intrinsic width`);
        assert.equal(result.height, 160, `${card.id}/${variant}: intrinsic height`);
        assert.equal(result.src, card.art[variant], `${card.id}/${variant}: exact embedded SVG bytes`);
        decoded.push({id: card.id, variant, slot: i === 0 ? 'cardFace' : 'fullScene', width: result.width, height: result.height});
      }
    }
  }
  return decoded;
}

async function keyboardMode(view, key, expectedMode) {
  await view.keyboard.press(key);
  const focused = await view.locator('[data-proof-view]:focus').evaluate(node => {
    const css = getComputedStyle(node);
    return {mode: node.dataset.proofView, focusVisible: node.matches(':focus-visible'), outlineWidth: parseFloat(css.outlineWidth), outlineStyle: css.outlineStyle};
  });
  assert.equal(focused.mode, expectedMode, 'Tab follows new → old → both');
  assert.equal(focused.focusVisible, true, 'Keyboard focus is visible');
  assert.ok(focused.outlineWidth >= 2 && focused.outlineStyle !== 'none', 'Visible keyboard outline');
  await view.keyboard.press(expectedMode === 'old' ? 'Enter' : 'Space');
  assert.equal(await view.locator('body').getAttribute('data-proof-mode'), expectedMode, 'Keyboard activates mode');
  return focused;
}

function verifyNoErrors(entry) {
  assert.deepEqual(entry.serviceWorkers, [], 'No service workers in proof context');
  assert.deepEqual(entry.console, [], 'No console output in static proof');
  assert.deepEqual(entry.pageErrors, [], 'No page errors');
  assert.deepEqual(entry.externalRequests, [], 'No external network requests');
  assert.deepEqual(entry.requestFailures, [], 'No failed requests');
  assert.deepEqual(entry.httpErrors, [], 'No HTTP errors');
  assert.deepEqual(entry.unexpectedRequests, [], 'No separate asset or unexpected requests');
}

try {
  await mkdir(output, {recursive: true});
  const [index, review, source] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url)),
    readFile(new URL('./review.html', import.meta.url)),
    readFile(new URL('public/games/darbe-h/source-cards.json', root), 'utf8'),
  ]);
  // Read allowlisted bytes before starting the server; request paths can never
  // select a filesystem path, and no response headers precede a file read.
  const pages = new Map([['/index.html', index], ['/review.html', review]]);
  const byID = new Map(buildCards(JSON.parse(source), designs, 'darbe-h').map(card => [card.id, card]));
  const expected = await Promise.all(SCENES.map(async scene => {
    const card = byID.get(scene.id);
    assert.ok(card, 'Actual card definition: ' + scene.id);
    const old = await readFile(new URL(`public/games/darbe-h/assets/card-art/${scene.id}.svg`, root), 'utf8');
    return {id: card.id, name: card.name.tr, rules: card.text.tr, art: {old: dataURL(old), new: dataURL(renderScene(scene.id))}};
  }));
  assert.equal(expected.length, 10, 'Exactly ten proof cards');
  assert.equal(new Set(expected.map(card => card.id)).size, 10, 'Ten distinct actual card IDs');
  server = createServer((req, res) => {
    report.serverRequests.push({method: req.method, path: req.url});
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, {Allow: 'GET, HEAD'}); res.end(); return; }
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const bytes = pages.get(req.url);
    if (!bytes) { res.writeHead(404, {'Content-Type': 'text/plain'}); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Content-Length': bytes.length, 'Cache-Control': 'no-store'});
    res.end(req.method === 'HEAD' ? undefined : bytes);
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  report.server = {host: '127.0.0.1', port: server.address().port, allowlist: [...pages.keys(), '/favicon.ico']};
  browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
  for (const width of report.matrix.widths) {
    for (const reducedMotion of report.matrix.reducedMotion) {
      const key = `${width}-${reducedMotion}`;
      activeCase = {key, width, reducedMotion, status: 'running', states: [], console: [], pageErrors: [], externalRequests: [], unexpectedRequests: [], requestFailures: [], httpErrors: [], requests: []};
      report.cases.push(activeCase);
      // Playwright's serviceWorkers:block injects a navigator.serviceWorker getter
      // into every frame, which throws in our intentionally opaque sandbox srcdoc.
      // Keep that sandbox intact. Fresh contexts, document-only HTTP routing and
      // zero actual workers/registrations prove this static package stays worker-free.
      context = await browser.newContext({viewport: {width, height: 960}, reducedMotion});
      context.setDefaultTimeout(15000);
      context.setDefaultNavigationTimeout(20000);
      const entry = activeCase;
      entry.serviceWorkers = [];
      context.on('serviceworker', worker => entry.serviceWorkers.push(worker.url()));
      await context.route('**/*', async route => {
        const request = route.request(), url = request.url();
        if (url.startsWith('data:') || url.startsWith('blob:')) { await route.continue(); return; }
        const parsed = new URL(url);
        if (parsed.origin !== origin) { entry.externalRequests.push(url); await route.abort(); return; }
        if ((parsed.pathname !== '/favicon.ico' && (!pages.has(parsed.pathname) || request.resourceType() !== 'document')) || parsed.search) {
          entry.unexpectedRequests.push(url); await route.abort(); return;
        }
        await route.continue();
      });
      page = await context.newPage();
      page.on('console', message => entry.console.push({type: message.type(), text: message.text()}));
      page.on('pageerror', error => entry.pageErrors.push(errorText(error)));
      page.on('request', request => { if (/^https?:/.test(request.url())) entry.requests.push({url: request.url(), resourceType: request.resourceType()}); });
      page.on('requestfailed', request => entry.requestFailures.push({url: request.url(), error: request.failure()?.errorText}));
      page.on('response', response => { if (response.status() >= 400) entry.httpErrors.push({url: response.url(), status: response.status()}); });
      await page.goto(origin + '/index.html', {waitUntil: 'load'});
      await page.locator('[data-proof-card]').last().waitFor();
      entry.workerRegistrations = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
      assert.equal(entry.workerRegistrations, 0, 'Fresh static proof has no worker registration');
      entry.keyboard = [];
      for (const mode of modes) {
        if (mode === 'old') {
          await page.locator('[data-proof-view="new"]').focus();
          entry.keyboard.push(await keyboardMode(page, 'Tab', 'old'));
        } else if (mode === 'both') {
          // Scrolling screenshots does not move focus from the previous button.
          entry.keyboard.push(await keyboardMode(page, 'Tab', 'both'));
        }
        const decoded = await decodeVisibleImages(page, expected, mode);
        await page.evaluate(() => window.scrollTo(0, 0));
        const state = await observe(page, mode, expected);
        verifyState(state, expected, width, reducedMotion);
        state.phase = 'loaded'; state.decodedImages = decoded;
        state.screenshot = `${key}-${mode}.png`;
        entry.states.push(state);
        await page.screenshot({path: join(output, state.screenshot), fullPage: true});
        verifyNoErrors(entry);
      }
      await page.waitForLoadState('networkidle');
      const priorRequests = entry.requests.length;
      await context.setOffline(true);
      for (const mode of modes) {
        await page.locator(`[data-proof-view="${mode}"]`).click();
        const state = await observe(page, mode, expected);
        verifyState(state, expected, width, reducedMotion);
        state.phase = 'offline-after-load';
        // All sources were decoded above in this same context before offline.
        state.decodedImages = await decodeVisibleImages(page, expected, mode);
        if (mode === 'both') {
          await page.evaluate(() => window.scrollTo(0, 0));
          state.screenshot = `${key}-offline-both.png`;
          await page.screenshot({path: join(output, state.screenshot), fullPage: true});
        }
        entry.states.push(state);
      }
      assert.equal(entry.requests.length, priorRequests, 'Offline-after-load toggles need no HTTP request');
      entry.offlineAfterLoad = {newHTTPRequests: entry.requests.length - priorRequests, modes: [...modes]};
      verifyNoErrors(entry);

      // One optional CSS-viewport harness assertion, within the existing sixth
      // matrix case. This is not a seventh device/browser case or emulation.
      if (width === 1440 && reducedMotion === 'no-preference') {
        await context.setOffline(false);
        await page.goto(origin + '/review.html', {waitUntil: 'load'});
        const controls = await page.locator('[data-width]').evaluateAll(nodes => nodes.map(node => ({width: Number(node.dataset.width), height: node.getBoundingClientRect().height, buttonWidth: node.getBoundingClientRect().width})));
        assert.deepEqual(controls.map(control => control.width), [320, 390, 1440], 'Review width controls');
        assert.ok(controls.every(control => control.height >= 44 && control.buttonWidth >= 44), 'Review controls are at least 44px');
        await page.locator('[data-width="320"]').click();
        const frame = page.frameLocator('#review-frame');
        await frame.locator('[data-proof-card]').last().waitFor();
        const state = await observe(frame, 'new', expected);
        verifyState(state, expected, 320, reducedMotion);
        const cssWidth = await page.locator('#review-frame').evaluate(node => node.style.width);
        assert.equal(cssWidth, '320px', 'Harness sets actual iframe CSS width');
        assert.equal(await page.locator('[data-width="320"]').getAttribute('aria-pressed'), 'true', 'Harness selected width aria-pressed');
        assert.match(await page.locator('#review-status').textContent(), /İç CSS viewport: 320 px/);
        entry.reviewHarness = {scope: 'CSS iframe viewport only, not device emulation', controls, cssWidth, innerWidth: state.viewport, screenshot: 'review-css-320.png'};
        await page.screenshot({path: join(output, entry.reviewHarness.screenshot), fullPage: true});
        verifyNoErrors(entry);
      }
      entry.status = 'passed';
      await context.close(); context = null; page = null;
      console.log(`${key}: static viewer, all rules/art, controls and offline-after-load passed`);
    }
  }
  assert.equal(report.cases.length, 6, 'Exactly six viewport/motion cases');
  assert.ok(report.cases.every(entry => entry.status === 'passed'));
  report.status = 'passed';
} catch (error) {
  failure = error;
  report.status = 'failed'; report.error = errorText(error);
  if (activeCase) { activeCase.status = 'failed'; activeCase.error = errorText(error); }
  if (page && !page.isClosed()) {
    try {
      const screenshot = `${activeCase?.key || 'setup'}-failure.png`;
      await page.screenshot({path: join(output, screenshot), fullPage: true, timeout: 10000});
      if (activeCase) activeCase.failureScreenshot = screenshot;
    } catch (captureError) { report.failureScreenshotError = errorText(captureError); }
  }
} finally {
  const cleanupErrors = [];
  for (const [name, close] of [
    ['context', () => context?.close()],
    ['browser', () => browser?.close()],
    ['server', () => server?.listening ? new Promise((resolveClose, rejectClose) => { server.close(error => error ? rejectClose(error) : resolveClose()); server.closeAllConnections(); }) : undefined],
  ]) {
    try { await close(); } catch (error) { cleanupErrors.push({name, error: errorText(error)}); }
  }
  if (cleanupErrors.length) {
    report.cleanupErrors = cleanupErrors; report.status = 'failed';
    failure ||= Error('Proof QA cleanup failed');
  }
  report.finishedAt = new Date().toISOString();
  await mkdir(output, {recursive: true});
  await writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Proof QA artifact: ' + join(output, 'results.json'));
}
if (failure) throw failure;
