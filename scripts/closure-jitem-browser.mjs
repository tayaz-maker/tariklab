import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
// Same engine-generated fixture as upstream #21, canonical merge 0c1fc08.
const payload = readFileSync('scripts/fixtures/jitem-atlas-schema5.json', 'utf8').trim();
const key = 'jitem-derin-ag-v3';
const expected = JSON.parse(payload);
assert.equal(expected.schemaVersion, 5);
const origin = process.env.RELEASE_ORIGIN;
const out = join(process.env.RUNNER_TEMP || '/workspace', 'screenshots', 'jitem');
mkdirSync(out, { recursive: true });
const results = [], errors = [];
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let page;
async function layout(width) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= width + 1, JSON.stringify(dimensions));
  const box = await page.locator('.atlas-surface').boundingBox();
  assert.ok(box && box.width > 100 && box.height >= 140 && box.x >= -1 && box.x + box.width <= width + 1);
  return dimensions;
}
async function renderer(mode) {
  await page.locator(`.atlas-surface[data-renderer="${mode}"]`).waitFor();
  assert.equal(await page.locator('.atlas-surface canvas').count(), mode === 'pixi' ? 1 : 0);
}
try {
  for (const width of [1440, 390]) for (const noWebGL of [false, true]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', e => errors.push({ width, noWebGL, error: e.message }));
    page.on('console', m => { if (m.type() === 'error') errors.push({ width, noWebGL, error: m.text() }); });
    // Verify the real portal entry before testing the same-origin embedded game.
    await page.goto(`${origin}/oyna/jitem-derin-ag`, { waitUntil: 'networkidle' });
    await page.frameLocator('iframe').locator('.start-screen-shell').waitFor();
    await context.addInitScript(({ key, payload, noWebGL }) => {
      if (!localStorage.getItem('closure-jitem-fixture')) {
        localStorage.setItem(key, '{');
        localStorage.setItem(key + ':bak', payload);
        localStorage.setItem('closure-jitem-fixture', '1');
      }
      if (noWebGL) {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
          return /webgl/.test(kind) ? null : original.call(this, kind, ...args);
        };
      }
    }, { key, payload, noWebGL });
    await page.goto(`${origin}/games/jitem-derin-ag/index.html?embed=1&lang=tr`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^Devam/ }).click();
    await renderer(noWebGL ? 'svg' : 'pixi');
    assert.match(await page.locator('header').innerText(), new RegExp(`T${expected.state.turn} \\u00b7`), 'backup turn is the visible live state');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), '{', 'load does not erase corrupt primary');
    assert.equal(await page.evaluate(key => localStorage.getItem(key + ':bak'), key), payload, 'valid backup survives recovery');
    const dimensions = await layout(width);
    await page.screenshot({ path: join(out, `${width}-${noWebGL ? 'svg' : 'pixi'}-open.png`), fullPage: true });
    const readout = await page.locator('.atlas-readout').innerText();
    await page.getByRole('button', { name: 'Basit çizim', exact: true }).click();
    await renderer('svg');
    assert.equal(await page.locator('.atlas-readout').innerText(), readout, 'Pixi/SVG decision parity');
    if (!noWebGL) {
      await page.getByRole('button', { name: 'Otomatik çizim', exact: true }).click();
      await renderer('pixi');
      const lost = await page.locator('.atlas-surface canvas').evaluate(canvas => {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        const extension = gl?.getExtension('WEBGL_lose_context');
        extension?.loseContext(); return Boolean(extension);
      });
      assert.equal(lost, true);
      await renderer('svg');
    }
    await page.setViewportSize({ width: width === 390 ? 1440 : 390, height: 900 });
    await layout(width === 390 ? 1440 : 390);
    await page.setViewportSize({ width, height: 900 });
    await layout(width);
    await page.screenshot({ path: join(out, `${width}-${noWebGL ? 'no-webgl' : 'context-loss'}.png`), fullPage: true });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^Devam/ }).click();
    await renderer(noWebGL ? 'svg' : 'pixi');
    assert.match(await page.locator('header').innerText(), new RegExp(`T${expected.state.turn} \\u00b7`));
    const repaired = JSON.parse(await page.evaluate(key => localStorage.getItem(key), key));
    assert.equal(repaired.schemaVersion, 5);
    assert.deepEqual(repaired.state, expected.state, 'normal persistence safely repairs primary after recovery');
    const restored = JSON.parse(await page.evaluate(key => localStorage.getItem(key + ':bak'), key));
    assert.deepEqual(restored.state, expected.state, 'recovered game state survives reload');
    await layout(width);
    results.push({ width, noWebGL, opening: true, backupRestore: true, reload: true, fallback: true, contextLoss: !noWebGL, dimensions });
    await context.close();
  }
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push({ error: String(error) });
  if (page) await page.screenshot({ path: join(out, 'failure.png'), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(join(out, 'results.json'), JSON.stringify({ origin, results, errors }, null, 2));
  console.log(JSON.stringify({ origin, results, errors }, null, 2));
}
