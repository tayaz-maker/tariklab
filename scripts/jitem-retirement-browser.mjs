// Targeted closure proof against an already-running source or production preview.
// Usage: QA_BASE=http://127.0.0.1:8081 node --experimental-strip-types scripts/jitem-retirement-browser.mjs
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {checkedUrl} from './browser-guard.mjs';
const base = checkedUrl(process.env.QA_BASE || 'http://127.0.0.1:8081');
const out = resolve(process.env.QA_OUT || 'work/jitem-retirement');
mkdirSync(out, {recursive: true});
const temp = mkdtempSync(join(tmpdir(), 'jitem-browser-save-'));
let browser;
const rows = [], errors = [];
try {
  execFileSync('tar', ['-xJf', 'docs/archives/jitem/jitem-recovery-2026-10-22.tar.xz', '-C', temp]);
  const {createGame} = await import(pathToFileURL(join(temp, 'upstream/src/game/engine.ts')).href);
  const {serialize, parseSave} = await import(pathToFileURL(join(temp, 'upstream/src/game/sim/save.ts')).href);
  const primary = JSON.stringify(serialize(createGame('saha', 71)));
  assert.ok(parseSave(primary)); assert.equal(JSON.parse(primary).schemaVersion, 5);
  const saves = {'jitem-derin-ag-v3': primary, 'jitem-derin-ag-v3:bak': primary, 'derin-ag-save-v1': primary, 'unrelated-save-proof': '{"keep":true}'};
  browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox']});
  for (const lang of ['tr', 'en', 'pl']) for (const width of [1280, 390]) {
    const context = await browser.newContext({viewport: {width, height: 844}});
    await context.addInitScript(({lang, saves}) => {
      localStorage.setItem('tariklab.language', lang);
      if (!localStorage.getItem('jitem-retirement-proof')) {
        for (const [key, value] of Object.entries(saves)) localStorage.setItem(key, value);
        localStorage.setItem('jitem-retirement-proof', '1');
      }
    }, {lang, saves});
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    console.log('CASE', lang, width);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
    const runtimeRequests = [];
    page.on('request', req => {if (/\/games\/jitem-derin-ag\/assets\//.test(req.url())) runtimeRequests.push(req.url());});
    await page.goto(base + '/oyna/jitem-derin-ag', {waitUntil: 'networkidle'});
    await page.waitForURL(base + '/'); await page.locator('#active-games').waitFor();
    assert.equal(await page.locator('a[href*="jitem-derin-ag"]').count(), 0);
    assert.equal(await page.locator('section[aria-labelledby="active-games"] a[href]').count(), 15);
    await page.waitForFunction(expected => document.documentElement.lang === expected, lang);
    assert.equal(await page.locator('iframe').count(), 0);
    assert.ok((await page.locator('body').innerText()).length > 100);
    await page.screenshot({path: join(out, `${lang}-${width}-catalog.png`)});
    await page.goto(base + '/credits.html', {waitUntil: 'networkidle'});
    assert.equal(await page.locator('main ul').first().locator('li').count(), 15);
    assert.equal(await page.locator('a[href*="jitem-derin-ag"]').count(), 0);
    await page.goto(base + '/games/jitem-derin-ag/index.html', {waitUntil: 'networkidle'});
    await page.waitForURL(base + '/'); await page.locator('#active-games').waitFor();
    for (const game of ['hanedanian', 'tc-sim']) {
      console.log('OPEN', lang, width, game);
      await page.goto(base + '/oyna/' + game, {waitUntil: 'networkidle'});
      const frame = page.frameLocator('iframe');
      await frame.locator(game === 'hanedanian' ? '[data-action="new"]' : '#show-creation-form').first().waitFor();
      assert.ok((await frame.locator('body').innerText()).length > 60);
      if (game === 'hanedanian') {
        await frame.locator('[data-action="new"]').first().click();
        await frame.locator('#new-form input[name="seed"]').fill('JITEM-RETIREMENT');
        await frame.locator('#new-form button').click();
        await frame.locator('#welcome').waitFor({state: 'hidden'});
        const gameFrame = page.frames().find(f => f.url().includes('/games/hanedanian/'));
        await gameFrame.waitForFunction(() => Number(document.querySelector('#world-map')?.dataset.drawnTiles) > 0, null, {timeout: 20000});
        await frame.locator('[data-speed="0"]').click();
        const adapter = await frame.locator('body').evaluate(async () => {
          const mod = await import('/games/shared/pixi-adapter.js');
          const pixi = await mod.loadPixi(); return {version: pixi?.VERSION, supported: mod.supportsPixi()};
        });
        assert.equal(adapter.version, '8.21.0');
      } else {
        await frame.locator('#show-creation-form').click();
        await frame.locator('#new-game-form input[name="name"]').fill('Closure QA');
        await frame.locator('#new-game-form button[type="submit"]').click();
        await frame.locator('#advance-week').waitFor();
      }
      await page.screenshot({path: join(out, `${lang}-${width}-${game}.png`)});
    }
    const after = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(saves));
    assert.deepEqual(after, saves, 'schema-5 primary, backup, legacy and unrelated saves stay byte-identical');
    assert.deepEqual(runtimeRequests, []);
    rows.push({lang, width, catalogue: 15, oldPlay: 'catalogue redirect', oldEmbed: 'catalogue redirect', hanedanian: 'new game + atlas + Pixi 8.21.0', tcSim: 'new game opened', schema5Saves: 'byte-identical', jitemRuntimeRequests: 0});
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({status: 'PASS', base, cases: rows.length, rows, errors}, null, 2));
} finally {
  writeFileSync(join(out, 'results.json'), JSON.stringify({base, rows, errors}, null, 2));
  await browser?.close(); rmSync(temp, {recursive: true, force: true});
}
