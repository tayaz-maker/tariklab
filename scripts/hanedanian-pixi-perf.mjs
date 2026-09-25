// Robust per-draw render-cost comparison: reads StrategyMap's own
// this.lastRenderMs (canvas.dataset.renderMs), set at the end of every
// draw() call for both renderers, over N real drag frames. Runs are
// interleaved (fallback, pixi, fallback, pixi, ...) so any warm-up/GC/CPU
// contention drift affects both conditions equally rather than biasing
// whichever runs second.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8080';
const TRIALS = 6;

async function oneTrial(browser, forceNoWebgl) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  if (forceNoWebgl) {
    await page.addInitScript(() => {
      const proto = HTMLCanvasElement.prototype;
      const real = proto.getContext;
      proto.getContext = function (kind, ...rest) {
        if (typeof kind === 'string' && kind.startsWith('webgl')) return null;
        return real.call(this, kind, ...rest);
      };
    });
  }
  await page.goto(`${BASE}/games/hanedanian/index.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const input = document.querySelector('input[name="seed"]');
    if (input) input.value = 'TL-ROBUSTPERF1';
    document.querySelector('[data-action="new"]')?.click();
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('button[type="submit"]')?.click());
  await page.waitForSelector('#world-map', { timeout: 15000 });
  await page.waitForTimeout(forceNoWebgl ? 800 : 3000);

  const samples = [];
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(700, 450);
    await page.mouse.down();
    await page.mouse.move(650 - (i % 10) * 4, 400 + (i % 5), { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(20);
    const ms = await page.evaluate(() => parseFloat(document.getElementById('world-map')?.dataset.renderMs || '0'));
    samples.push(ms);
  }
  await page.close();
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)]; // median single-draw cost
}

async function firstPaint(browser, forceNoWebgl) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  if (forceNoWebgl) {
    await page.addInitScript(() => {
      const proto = HTMLCanvasElement.prototype;
      const real = proto.getContext;
      proto.getContext = function (kind, ...rest) {
        if (typeof kind === 'string' && kind.startsWith('webgl')) return null;
        return real.call(this, kind, ...rest);
      };
    });
  }
  await page.goto(`${BASE}/games/hanedanian/index.html`, { waitUntil: 'commit' });
  const t = await page.evaluate(() => new Promise((resolve) => {
    const check = () => (document.getElementById('map-workspace') ? resolve(performance.now()) : requestAnimationFrame(check));
    check();
  }));
  await page.close();
  return t;
}

const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

const firstPaintFallback = [], firstPaintPixi = [];
for (let t = 0; t < TRIALS; t++) {
  firstPaintFallback.push(await firstPaint(browser, true));
  firstPaintPixi.push(await firstPaint(browser, false));
}

const fallback = [];
const pixi = [];
for (let t = 0; t < TRIALS; t++) {
  fallback.push(await oneTrial(browser, true));
  pixi.push(await oneTrial(browser, false));
}
await browser.close();
console.log(JSON.stringify({
  firstPaintMedianMs: { fallback: median(firstPaintFallback), pixi: median(firstPaintPixi) },
  perDrawRenderCostMedianMs: { fallback: median(fallback), pixi: median(pixi) },
  rawTrials: { fallback, pixi },
}, null, 2));
