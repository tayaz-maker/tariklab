// One-off browser QA for the HANEDANIAN PixiJS terrain layer. Not part of
// the `npm test` gate (uses a real Chromium + a live dev server) -- run
// manually. Prints a JSON verdict per scenario.
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const OUT = '/home/user/cete-savaslari/screenshots/hanedanian-pixi';

async function startCampaign(page, { seed = 'TL-QAFIXEDSEED1' } = {}) {
  await page.goto(`${BASE}/games/hanedanian/index.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(300);
  const hasNewButton = await page.evaluate(() => !!document.querySelector('[data-action="new"]'));
  if (hasNewButton) {
    await page.click('[data-action="new"]');
    await page.waitForTimeout(200);
  }
  await page.evaluate((s) => {
    const input = document.querySelector('input[name="seed"]');
    if (input) input.value = s;
  }, seed);
  const submitted = await page.evaluate(() => {
    const btn = document.querySelector('button[type="submit"]');
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!submitted) throw new Error('Could not find the campaign-start submit button');
  await page.waitForSelector('#world-map', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const g = document.getElementById('field-guide'); if (g) g.hidden = true; });
}

async function mapState(page) {
  return page.evaluate(() => {
    const workspace = document.getElementById('map-workspace');
    const overlay = document.getElementById('world-map');
    const terrainHost = workspace?.querySelector('.map-terrain-host');
    return {
      hasPixiClass: workspace?.classList.contains('has-pixi-terrain') || false,
      hasTerrainCanvas: !!terrainHost?.querySelector('canvas'),
      overlayRendererDataset: overlay?.dataset.mapMode || null,
      atlasStatus: overlay?.dataset.atlas || null,
      overlayVisible: !!overlay,
    };
  });
}

async function run() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const results = {};

  // 1. Desktop, real WebGL -- expect the Pixi swap to happen.
  {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await startCampaign(page);
    // Poke the camera so both renderers actually draw more than the initial frame.
    await page.mouse.move(700, 450);
    await page.mouse.down();
    await page.mouse.move(600, 400, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(1500); // let the deferred Pixi probe/mount finish
    await page.screenshot({ path: `${OUT}/desktop-pixi-1500ms.png` });
    results.desktopPixiEarly = await mapState(page);
    await page.waitForTimeout(4000); // give the near-mode atlas job (time-sliced) room to finish
    await page.screenshot({ path: `${OUT}/desktop-pixi.png` });
    results.desktopPixi = { ...(await mapState(page)), errors };
    await page.close();
  }

  // 2. Desktop, WebGL forced unavailable -- must stay on the Canvas 2D map.
  {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      const proto = HTMLCanvasElement.prototype;
      const real = proto.getContext;
      proto.getContext = function (kind, ...rest) {
        if (typeof kind === 'string' && kind.startsWith('webgl')) return null;
        return real.call(this, kind, ...rest);
      };
    });
    await startCampaign(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/desktop-fallback.png` });
    results.desktopFallback = { ...(await mapState(page)), errors };
    await page.close();
  }

  // 3. Mobile 390x844.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await startCampaign(page);
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    await page.screenshot({ path: `${OUT}/mobile-pixi.png` });
    results.mobilePixi = { ...(await mapState(page)), errors, horizontalOverflow: overflow };
    await page.close();
  }

  // 4. Save/reload: a camera move + selection must survive a full reload,
  //    and the Pixi swap must happen again cleanly on the fresh page load.
  {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await startCampaign(page);
    await page.waitForTimeout(1200);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.toLowerCase().includes('hanedan')).map((k) => [k, localStorage.getItem(k)]));
    results.saveReload = { ...(await mapState(page)), errors, savePresent: after.length > 0 };
    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

run().catch((err) => { console.error(err); process.exit(1); });
