// Test-only branch: never changes production state outside fresh browser storage.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
const config = JSON.parse(readFileSync('scripts/closure-production.json', 'utf8'));
const origin = process.env.RELEASE_ORIGIN;
assert.ok(['https://www.tariklab.com', 'https://tariklab.tayaz29.workers.dev'].includes(origin));
assert.match(config.mergeSha, /^[a-f0-9]{40}$/);
const directory = join(process.env.RUNNER_TEMP || '/workspace', 'screenshots');
mkdirSync(directory, { recursive: true });
const hash = (data) => createHash('sha256').update(data).digest('hex');
const proof = { checkedAt: new Date().toISOString(), origin, ...config, assets: [], browser: 'not-run' };
try {
  for (const file of config.files) {
    const response = await fetch(`${origin}/${file.replace(/^public\//, '')}?release=${config.mergeSha}`);
    assert.equal(response.status, 200, `${file}: HTTP ${response.status}`);
    const actual = hash(Buffer.from(await response.arrayBuffer()));
    const expected = hash(readFileSync(file));
    proof.assets.push({ file, expected, actual });
    assert.equal(actual, expected, `${file}: production does not match the reviewed merge`);
  }
  const scripts = { racon: 'scripts/racon-map-browser.mjs', jitem: 'scripts/closure-jitem-browser.mjs', 'tc-sim': 'scripts/closure-tc-browser.mjs' };
  assert.ok(scripts[config.game]);
  proof.browser = 'running';
  const result = spawnSync(process.execPath, [scripts[config.game], '--label', `production-${process.env.RELEASE_HOST}`], { stdio: 'inherit', env: process.env, timeout: 8 * 60 * 1000 });
  assert.equal(result.status, 0, `${config.game} browser acceptance: ${result.error || result.signal || result.status}`);
  proof.browser = 'pass';
} catch (error) {
  if (proof.browser === 'running') proof.browser = 'fail';
  proof.error = String(error);
  process.exitCode = 1;
} finally {
  writeFileSync(join(directory, 'release-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
}
