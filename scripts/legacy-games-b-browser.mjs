// Same-origin retirement and save-preservation acceptance against dev or built preview.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { waitForHttp } from './ci-readiness.mjs';
import { chromium } from 'playwright';
import { archivedGameSlugs } from './legacy-game-inventory.mjs';
export async function legacyGamesArchiveBrowser({ origin = process.env.ARCHIVE_B_ORIGIN || 'http://127.0.0.1:8081', out = resolve(process.env.RUNNER_TEMP || '/workspace', 'screenshots/archive-b') } = {}) {
mkdirSync(out, { recursive: true });
const saves = Object.fromEntries(archivedGameSlugs.flatMap(slug => [1, 2, 3].map(slot => [`tariklab.nextwave.${slug}.slot${slot}`, JSON.stringify({ id: slug, slot, archived: 'unchanged' })])));
for (const key of ['tariklab.nextwave.tc-sim-devlet.active','tariklab.nextwave.kayip-telefon.backup','tariklab.son100.pov.v1.slot1','tlab.labirent.v1','tlab.tektas.v1','tariklab.chess.save','tariklab.amiral-batti.match','tariklab.amiral-batti.stats','tariklab.veto-h.duel','tariklab.veto-h.duel.backup','tariklab.gett-oh.duel','tariklab.gett-oh.duel.backup']) saves[key] = '{"existing":"keep byte for byte"}';
// Preserve the same real legacy duel fixtures that the old art proof resumed.
for (const theme of ['veto-h', 'gett-oh']) {
  saves[`tariklab.${theme}.duel`] = readFileSync(`scripts/fixtures/duel/${theme}-old-save.json`, 'utf8');
  saves[`tariklab.${theme}.duel.backup`] = saves[`tariklab.${theme}.duel`];
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
const results = [];
try {
  for (const lang of ['tr','en','pl']) for (const width of [390,1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(({ saves, lang }) => {
      if (!sessionStorage.getItem('archive-b-seeded')) {
        for (const [key,value] of Object.entries(saves)) localStorage.setItem(key,value);
        localStorage.setItem('tariklab.language', lang);
        sessionStorage.setItem('archive-b-seeded','1');
      }
    }, { saves, lang });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => {
      if (response.url().startsWith(origin + '/') && response.status() >= 400)
        errors.push(`${response.status()}: ${response.url()}`);
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#category-tabletop, #category-dossier').count(), 0);
    for (const slug of archivedGameSlugs) {
      assert.equal(await page.locator(`a[href="/oyna/${slug}"]`).count(),0);
      await page.goto(`${origin}/oyna/${slug}?next=https://example.org`, { waitUntil: 'networkidle' });
      assert.equal(new URL(page.url()).origin,origin);
      assert.equal(new URL(page.url()).pathname,'/');
      await page.goto(`${origin}/games/${slug}/index.html`, { waitUntil: 'networkidle' });
      await page.waitForURL(origin + '/');
      assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key,localStorage.getItem(key)])),Object.keys(saves)),saves);
    }
    await page.goto(`${origin}/credits.html`, { waitUntil: 'networkidle' });
    for (const slug of archivedGameSlugs) assert.equal(await page.locator(`a[href="/oyna/${slug}"]`).count(),0);
    await page.goto(origin, { waitUntil: 'networkidle' });
    const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, text: document.body.innerText.length }));
    assert.ok(layout.text > 100 && layout.scroll <= width+1);
    await page.screenshot({ path: `${out}/${lang}-${width}.png`, fullPage: true });
    assert.deepEqual(errors,[]);
    results.push({ lang,width,retired:9,saves:Object.keys(saves).length,errors,layout });
    await context.close();
  }
  for (const slug of archivedGameSlugs) {
    const response = await fetch(`${origin}/games/${slug}/app.js`);
    assert.equal(response.status,410);
  }
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(results,null,2));
  await browser.close();
}
assert.equal(results.length,6);
console.log(JSON.stringify({ status:'PASS',cells:6,results,out }));

return results;
}

// Exercise the shipping Worker, not the historical game files retained in public/.
export async function legacyGamesArchiveCI(out) {
  const port = '8107';
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['scripts/ci-built-preview.mjs', port], {
    stdio: 'inherit', detached: true,
  });
  try {
    await waitForHttp(origin, { timeoutMs: 90000,
      stopped: () => server.exitCode !== null || server.signalCode !== null });
    return await legacyGamesArchiveBrowser({ origin, out });
  } finally {
    try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already stopped */ }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await legacyGamesArchiveBrowser();
