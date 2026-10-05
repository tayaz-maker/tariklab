// Preparation only: exported driver; deliberately does not launch a browser/server.
// The release owner may call this with an existing Playwright browser after #116.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CASES, KEY, buildFixture, decode, verifyStage } from './fixtures.mjs';
import { validateWidths, recordActualOrigin, verifyCompletedCases } from './proof-guards.mjs';

export async function runDarbeRuleBrowserProof(browser, origin, output,
  widths = [1440, 390, 320]) {
  assert.ok(browser?.newContext, 'provide an already-running Playwright Browser');
  assert.ok(output, 'provide a dedicated evidence directory');
  const runWidths = validateWidths(widths);
  const targetOrigin = new URL(origin).origin;
  const report = { status: 'RUNNING', startedAt: new Date().toISOString(), origin: targetOrigin,
    widths: runWidths, expectedCaseCount: CASES.length * runWidths.length, completedCaseCount: 0,
    scope: 'DRB-237..240 synthetic saved-state public-UI counterproof only', cases: [] };
  await mkdir(output, { recursive: true });
  try {
    for (const width of runWidths) for (const spec of CASES) {
      const fixture = buildFixture(spec);
      const evidence = resolve(output, `${spec.id}-${width}`);
      await mkdir(evidence, { recursive: true });
      const context = await browser.newContext({
        viewport: { width, height: width === 1440 ? 900 : 844 },
        reducedMotion: 'reduce', serviceWorkers: 'block',
      });
      const row = { id: spec.id, width, status: 'RUNNING', errors: [], stages: [], origins: [] };
      report.cases.push(row);
      try {
        const page = await context.newPage();
        const checkOrigin = checkpoint => recordActualOrigin(page, targetOrigin, row, checkpoint);
        page.on('pageerror', error => row.errors.push(error.message));
        page.on('console', msg => { if (msg.type() === 'error') row.errors.push(msg.text()); });
        page.on('response', response => {
          if (new URL(response.url()).origin === targetOrigin && response.status() >= 400)
            row.errors.push(`${response.status()} ${response.url()}`);
        });
        page.on('requestfailed', request => row.errors.push(`${request.url()} ${request.failure()?.errorText}`));
        // Establish origin/storage on the real static game entry in both modes.
        // SSR builds do not emit a portal root index.html into .output/public.
        await page.goto(`${targetOrigin}/games/darbe-h/`, { waitUntil: 'domcontentloaded' });
        checkOrigin('goto:fixture-origin');
        await page.locator('#app[aria-busy="true"]').waitFor({ state: 'detached' });
        // Standard persisted-save setup, not an app state/window/dispatch hook.
        await page.evaluate(({ key, raw }) => {
          localStorage.setItem(key, raw);
          localStorage.setItem('tariklab.language', 'en');
          localStorage.setItem('tariklab.duel.motion', 'off');
        }, { key: KEY, raw: fixture.raw });
        await page.goto(`${targetOrigin}/games/darbe-h/`, { waitUntil: 'domcontentloaded' });
        checkOrigin('goto:game');
        const continueGame = async (stage) => {
          checkOrigin(`continue:${stage}:before`);
          await page.getByRole('button', { name: 'Continue', exact: true }).click();
          await page.locator('.duel-table').waitFor();
          checkOrigin(`continue:${stage}:after`);
        };
        const rawSave = () => page.evaluate(key => localStorage.getItem(key), KEY);
        async function capture(stage, name = stage) {
          checkOrigin(`capture:${name}:before`);
          const raw = await rawSave();
          const state = decode(raw);
          const summary = verifyStage(state, fixture, stage);
          const overflow = await page.evaluate(() => ({
            viewport: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
          }));
          assert.ok(overflow.scroll <= overflow.viewport, `${spec.id}/${width}/${name}: horizontal overflow`);
          assert.deepEqual(row.errors, [], `${spec.id}/${width}/${name}: browser errors`);
          const backup = await page.evaluate(key => localStorage.getItem(`${key}.backup`), KEY);
          if (backup) decode(backup);
          await writeFile(resolve(evidence, `${name}.save.json`), raw + '\n');
          if (backup) await writeFile(resolve(evidence, `${name}.backup.json`), backup + '\n');
          await page.screenshot({ path: resolve(evidence, `${name}.png`), fullPage: true });
          const location = checkOrigin(`capture:${name}:after`);
          row.stages.push({ name, ...summary, overflow, actualOrigin: location.actualOrigin,
            actualURL: location.actualURL });
          return raw;
        }
        async function reloadExact(stage) {
          checkOrigin(`reload:${stage}:before`);
          const before = await rawSave();
          await page.reload({ waitUntil: 'domcontentloaded' });
          checkOrigin(`reload:${stage}:after`);
          assert.equal(await rawSave(), before, 'reload must preserve the exact serialized record');
          await continueGame(`${stage}-reloaded`);
          assert.equal(await rawSave(), before, 'Continue must not dispatch or rewrite this player-owned choice');
          await capture(stage, `${stage}-reloaded`);
        }
        await continueGame('initial');
        await capture('before');
        await page.locator('[data-pile="0:auxiliary"]').click();
        await page.locator('dialog[open]').getByRole('button', { name: fixture.name.en, exact: true }).click();
        await page.locator('dialog[open] .inspector-actions').getByRole('button', {
          name: 'Special Summon', exact: true,
        }).click();
        // Fixture validation proves a single material plan. Current UI executes
        // it directly; specialPlans has no explicit slot/ritual-enabler argument.
        await capture('summoned');
        await reloadExact('summoned');
        await page.locator(`.player-field.player .zone [data-card="${fixture.boss}"]`).click();
        const inspector = width <= 760 ? page.locator('dialog[open]') : page.locator('.inspector');
        await inspector.locator('.inspector-actions').getByRole('button', {
          name: 'Activate Effect', exact: true,
        }).click();
        await page.waitForFunction(key => {
          const raw = localStorage.getItem(key);
          return raw && JSON.parse(JSON.parse(raw).payload).choice?.player === 0;
        }, KEY);
        await capture('choice');
        await reloadExact('choice');
        // DRB-097 is the single legal target. The real UI intentionally resolves
        // the sole choice immediately when Choose is pressed (app.js selectAction).
        await page.locator('.action-dock').getByRole('button', { name: 'Choose', exact: true }).click();
        await capture('after');
        await reloadExact('after');
        row.status = 'PASS';
        report.completedCaseCount++;
      } catch (error) {
        row.status = 'FAIL'; row.failure = error.message;
        throw error;
      } finally { await context.close(); }
    }
    verifyCompletedCases(report);
    report.status = 'PASS';
    return report;
  } catch (error) {
    report.status = 'FAIL'; report.failure = error.message;
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    await writeFile(resolve(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
