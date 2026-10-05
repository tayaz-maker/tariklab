import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { createStaticGameServer } from '../../scripts/static-game-server.mjs';
import { runDarbeRuleBrowserProof } from '../darbe-rule-browser-proof/browser-driver.mjs';
import { validateTarget, expectedManifest, verifyHost } from './gate.mjs';

const [mode, requestedOrigin, outputArg] = process.argv.slice(2);
assert.ok(outputArg, 'usage: run.mjs built|production explicit-origin evidence-directory');
const origin = validateTarget(mode, requestedOrigin);
const output = resolve(outputArg);
await mkdir(output, { recursive: true });
const report = { status: 'RUNNING', browser: 'NOT_RUN', sha: process.env.GITHUB_SHA || null,
  mode, origin, expectedCaseCount: 12, completedCaseCount: 0, hashes: [] };
let server, browser;
try {
  const manifest = await expectedManifest(resolve('.output/public'));
  report.expectedManifest = manifest;
  if (mode === 'built') {
    server = createStaticGameServer(resolve('.output/public'));
    server.listen(Number(new URL(origin).port), '127.0.0.1');
    await once(server, 'listening');
  }
  await verifyHost(origin, manifest, report.hashes);
  browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox'] });
  report.browser = 'RUNNING';
  const proof = await runDarbeRuleBrowserProof(browser, origin, output);
  assert.equal(proof.expectedCaseCount, 12);
  assert.equal(proof.completedCaseCount, 12);
  assert.equal(proof.status, 'PASS');
  report.completedCaseCount = proof.completedCaseCount;
  report.browser = 'PASS'; report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = error.message;
  if (report.browser === 'RUNNING') report.browser = 'FAIL';
  process.exitCode = 1;
} finally {
  try {
    await browser?.close();
    if (server?.listening) await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));
  } catch (error) {
    report.status = 'FAIL'; report.cleanupFailure = error.message; process.exitCode = 1;
  }
  await writeFile(resolve(output, 'runner-results.json'), JSON.stringify(report, null, 2) + '\n');
}
