// Real Chromium regression proof: fixtures are seeded once before navigation;
// every subsequent game decision uses a visible UI control, never engine calls.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createStaticGameServer} from './static-game-server.mjs';
import {checkedUrl, checkedOutputPath} from './browser-guard.mjs';
import {create, applyAction} from '../public/games/next-wave.js';
import {hydrateDevlet} from '../public/games/next-wave/devlet-sim.js';

const args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const label = arg('--label', 'source');
const root = resolve(arg('--serve', 'public'));
const proofRoot = resolve(process.env.RUNNER_TEMP || '/workspace', 'screenshots');
const out = checkedOutputPath(resolve(proofRoot, 'wave1-decision', label), [proofRoot]);
await mkdir(out, {recursive: true});
const server = process.env.WAVE1_BASE ? null : createStaticGameServer(root);
if (server) await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = checkedUrl(process.env.WAVE1_BASE || `http://127.0.0.1:${server.address().port}`);
const results = [];
let browser;
let servedBefore, servedAfter;

async function servedManifest() {
  const files = ['next-wave.js', 'next-wave/devlet-content.js', 'next-wave/devlet-depth.js',
    'next-wave/devlet-sim.js', 'tc-sim-devlet/presentation.js'];
  const rows = await Promise.all(files.map(async file => {
    const response = await fetch(`${base}/games/${file}`);
    assert.equal(response.status, 200, `${file}: served module available`);
    const served = Buffer.from(await response.arrayBuffer());
    const source = await readFile(resolve('public/games', file));
    assert.ok(served.equals(source), `${file}: served output must match current source`);
    return [file, createHash('sha256').update(served).digest('hex')];
  }));
  return Object.fromEntries(rows);
}

const keyOf = game => `tariklab.nextwave.${game}.slot1`;
const copy = value => JSON.parse(JSON.stringify(value));
const part = (state, id) => state.building.parts.find(row => row.id === id).condition;
const read = (page, game) => page.evaluate(key => JSON.parse(localStorage.getItem(key)), keyOf(game));

function apartment() {
  const state = create('apartman');
  // A willing board isolates repair targeting from the existing voting rules.
  for (const resident of state.residents) resident.trust = resident.satisfaction = 90;
  return state;
}

function treasuryFixture() {
  const state = hydrateDevlet('2002', {seed: 11});
  state.actual.treasury = 0;
  state.ui.screen = 'home';
  return state;
}

function terminalFixture() {
  const state = hydrateDevlet('2002', {seed: 1});
  for (let month = 0; month < 60 && !state.flags.campaignEnd; month++) {
    applyAction('tc-sim-devlet', state, 'advance');
  }
  assert.equal(state.flags.campaignEnd, true, 'natural period reaches its terminal state');
  assert.equal(state.time.turn, 48);
  assert.equal(state.flags.contentActive?.eventId, 'dc_gv_inherit2', 'natural terminal dossier fixture');
  state.ui.screen = 'home';
  return state;
}

async function openGame(cell, game, fixture, tag) {
  const context = await browser.newContext({
    viewport: cell.viewport, deviceScaleFactor: 1,
    isMobile: cell.viewport.width < 500, hasTouch: cell.viewport.width < 500,
    reducedMotion: 'reduce',
  });
  await context.addInitScript(({game, fixture, lang}) => {
    if (!sessionStorage.getItem('wave1-decision-seeded')) {
      localStorage.setItem(`tariklab.nextwave.${game}.slot1`, JSON.stringify(fixture));
      localStorage.setItem(`tariklab.nextwave.${game}.active`, '1');
      localStorage.setItem('tariklab.language', lang);
      sessionStorage.setItem('wave1-decision-seeded', 'yes');
    }
  }, {game, fixture, lang: cell.lang});
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {if (message.type() === 'error') errors.push(`console: ${message.text()}`);});
  page.on('response', response => {
    if (new URL(response.url()).origin === new URL(base).origin && response.status() >= 400) {
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
  const handle = {context, page, errors, game, tag};
  try {
    await page.goto(`${base}/games/${game}/index.html`, {waitUntil: 'networkidle'});
    await page.locator('#menu-continue').click();
    await page.locator('#advance').waitFor();
    assert.equal(await page.evaluate(() => window.tlabI18n.getLang()), cell.lang, `${tag}: language retained`);
    assert.ok((await page.locator('main').innerText()).trim().length > 100, `${tag}: visible game content`);
    await layout(handle);
    return handle;
  } catch (error) {
    await page.screenshot({path: `${out}/${tag}-open-failure.png`, fullPage: true}).catch(() => {});
    await context.close();
    throw error;
  }
}

async function click(handle, selector) {
  const target = handle.page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  assert.equal(await target.isVisible(), true, `${handle.tag}: visible ${selector}`);
  assert.equal(await target.isEnabled(), true, `${handle.tag}: enabled ${selector}`);
  // The existing shared action gate rejects clicks less than 140 ms apart.
  await handle.page.waitForTimeout(160);
  await target.click();
}

async function reload(handle) {
  const saved = await read(handle.page, handle.game);
  await handle.page.reload({waitUntil: 'networkidle'});
  await handle.page.locator('#menu-continue').click();
  await handle.page.locator('#advance').waitFor();
  assert.deepEqual(await read(handle.page, handle.game), saved, `${handle.tag}: reload keeps the saved state`);
  return saved;
}

async function layout(handle) {
  const metrics = await handle.page.evaluate(() => ({
    width: innerWidth, documentWidth: document.documentElement.scrollWidth,
    mainWidth: document.querySelector('main').clientWidth,
    mainScroll: document.querySelector('main').scrollWidth,
  }));
  assert.ok(metrics.documentWidth <= metrics.width + 1, `${handle.tag}: document overflow ${JSON.stringify(metrics)}`);
  assert.ok(metrics.mainScroll <= metrics.mainWidth + 1, `${handle.tag}: game overflow ${JSON.stringify(metrics)}`);
  return metrics;
}

async function finish(handle, evidence) {
  const metrics = await layout(handle);
  await handle.page.screenshot({path: `${out}/${handle.tag}.png`, fullPage: true, scale: 'css'});
  assert.deepEqual(handle.errors, [], `${handle.tag}: console, runtime and same-origin resources`);
  return {...evidence, layout: metrics, errors: handle.errors, screenshot: `${handle.tag}.png`};
}

async function scenario(cell, name, work) {
  const tag = `${cell.lang}-${cell.viewport.width}-${name}`;
  const handles = [];
  const open = async (game, fixture, suffix = '') => {
    const handle = await openGame(cell, game, fixture, tag + suffix);
    handles.push(handle);
    return handle;
  };
  try {
    const evidence = await work(open);
    results.push({tag, ok: true, ...evidence});
  } catch (error) {
    for (const handle of handles) {
      await handle.page.screenshot({path: `${out}/${handle.tag}-failure.png`, fullPage: true}).catch(() => {});
    }
    results.push({tag, ok: false, error: error.stack, browserErrors: handles.flatMap(handle => handle.errors)});
  } finally {
    await Promise.all(handles.map(handle => handle.context.close()));
  }
  console.log(JSON.stringify(results.at(-1)));
}

try {
  servedBefore = await servedManifest();
  browser = await chromium.launch({headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox'],
  });
  for (const lang of ['tr', 'en', 'pl']) for (const viewport of [{width: 1280, height: 800}, {width: 390, height: 844}]) {
    const cell = {lang, viewport};
    await scenario(cell, 'devlet-zero-treasury', async open => {
      const fixture = treasuryFixture();
      const handle = await open('tc-sim-devlet', fixture);
      await click(handle, '#advance');
      const saved = await read(handle.page, handle.game);
      assert.equal(saved.time.turn, fixture.time.turn + 1);
      assert.ok(saved.actual.treasury >= 0 && saved.actual.treasury < 3,
        `zero treasury must not become starting treasury: ${saved.actual.treasury}`);
      assert.ok((await handle.page.locator('.action-feedback').innerText()).trim().length > 50, 'visible month-end outcome');
      await reload(handle);
      return finish(handle, {treasuryBefore: 0, treasuryAfter: saved.actual.treasury, turn: saved.time.turn, saveReload: true});
    });

    await scenario(cell, 'devlet-terminal', async open => {
      const fixture = terminalFixture();
      const handle = await open('tc-sim-devlet', fixture);
      const choices = handle.page.locator('[data-content]');
      assert.ok(await choices.count() > 0, 'natural terminal dossier remains visible');
      assert.equal(await handle.page.locator('[data-content]:enabled').count(), 0, 'terminal dossier cannot change the result');
      assert.equal(await handle.page.locator('#advance').isDisabled(), true, 'terminal month cannot advance');
      const saved = await read(handle.page, handle.game);
      // A physical pointer click on a disabled native button cannot dispatch a decision.
      const record = await choices.first().evaluate(node => node.closest('.desk-record')?.id);
      if (record) await click(handle, `[aria-controls="${record}"]`);
      await choices.first().scrollIntoViewIfNeeded();
      const bounds = await choices.first().boundingBox();
      assert.ok(bounds);
      await handle.page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      assert.deepEqual(await read(handle.page, handle.game), saved, 'disabled dossier pointer click leaves final state unchanged');
      if (await handle.page.locator('.inspector-close').isVisible()) await click(handle, '.inspector-close');
      await click(handle, '.compact-nav [data-screen="policy"]');
      assert.ok(await handle.page.locator('[data-policy]').count() > 0, 'policy list exists');
      assert.equal(await handle.page.locator('[data-policy]:enabled').count(), 0, 'terminal policies disabled');
      assert.deepEqual(await read(handle.page, handle.game), saved, 'terminal navigation preserves final save');
      await reload(handle);
      assert.equal(await handle.page.locator('[data-content]:enabled').count(), 0, 'terminal guard persists on reload');
      return finish(handle, {terminalTurn: saved.time.turn, dossier: saved.flags.contentActive.eventId, finalStateUnchanged: true, saveReload: true});
    });

    for (const [issue, system] of [['i5', 'su'], ['i4', 'cati']]) for (const proposal of ['cheap-patch', 'durable-maintenance']) {
      await scenario(cell, `apartman-${system}-${proposal}`, async open => {
        const fixture = apartment();
        // Put the selected real issue on the existing three-item desk without
        // removing the earlier elevator issue which originally stole the repair.
        fixture.flags.focusIssue = issue;
        const handle = await open('apartman', fixture);
        await click(handle, `[data-issue="${issue}"]`);
        await click(handle, '#meeting');
        await click(handle, `[data-proposal="${proposal}"]`);
        const saved = await read(handle.page, handle.game);
        assert.equal(saved.lastMeeting.accepted, true, 'board accepts fixture proposal');
        assert.equal(saved.lastMeeting.proposal, proposal);
        assert.equal(part(saved, system), part(fixture, system) + (proposal === 'cheap-patch' ? 5 : 12), 'selected system repaired');
        assert.equal(part(saved, 'asansor'), part(fixture, 'asansor'), 'unselected elevator unchanged');
        assert.equal(saved.issues.find(row => row.id === issue).status, 'kapali', 'selected issue resolved');
        assert.equal(saved.issues.find(row => row.id === 'i1').status, 'acik', 'unselected elevator issue remains open');
        assert.equal(saved.openCases.at(-1).system, system, 'follow-up tracks selected system');
        if (proposal === 'cheap-patch') {
          assert.equal(saved.flags.cheapSystem, system);
          assert.equal(saved.delayedEffects.find(row => row.type === 'patch-failure').system, system, 'later patch risk tracks selected system');
        }
        assert.ok((await handle.page.locator('.vote-result').innerText()).trim().length > 10, 'visible vote outcome');
        await reload(handle);
        assert.equal(await handle.page.locator('#meeting').isDisabled(), true, 'accepted decision cannot repeat this week after reload');
        return finish(handle, {issue, system, proposal, partBefore: part(fixture, system), partAfter: part(saved, system), saveReload: true});
      });
    }

    await scenario(cell, 'apartman-followup-once', async open => {
      const fixture = apartment();
      const affected = fixture.residents.find(row => !row.pays).id;
      const control = await open('apartman', fixture, '-control');
      const dueFixture = copy(fixture);
      dueFixture.openCases = [{id: 'qa-followup', kind: 'inspection', due: 2, system: 'su'}];
      const due = await open('apartman', dueFixture, '-case');
      const differences = [];
      for (const week of [2, 3, 4]) {
        await click(control, '#advance');
        await click(due, '#advance');
        const controlState = await read(control.page, control.game);
        const dueState = await read(due.page, due.game);
        assert.equal(controlState.week, week);
        assert.equal(dueState.week, week);
        const delta = dueState.residents.find(row => row.id === affected).satisfaction - controlState.residents.find(row => row.id === affected).satisfaction;
        assert.equal(delta, -6, `inspection penalty is applied once, week ${week}`);
        assert.equal(dueState.openCases.find(row => row.id === 'qa-followup').status, 'due');
        differences.push({week, satisfactionDelta: delta});
        await reload(control);
        await reload(due);
      }
      await finish(control, {role: 'paired control'});
      return finish(due, {affected, differences, saveReloadAfterEachWeek: true});
    });
  }
  servedAfter = await servedManifest();
  assert.deepEqual(servedAfter, servedBefore, 'served modules remain unchanged during the complete matrix');
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify({label, base, root, servedBefore, servedAfter, results}, null, 2));
  await browser?.close();
  if (server) await new Promise(r => server.close(r));
}
const failed = results.filter(row => !row.ok);
console.log(JSON.stringify({label, scenarios: results.length, passed: results.length - failed.length, failed: failed.length, results: `${out}/results.json`}));
if (failed.length) process.exitCode = 1;
