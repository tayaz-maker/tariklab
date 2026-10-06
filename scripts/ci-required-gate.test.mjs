import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {delimiter, join} from 'node:path';
import {validateRequiredNeeds} from './ci-required-gate.mjs';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');
const workflow = yaml.load(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'));
const requiredJobs = ['changes', 'build-core', 'browser-regression', 'campaign-browser', 'campaign-balance'];
const successfulNeeds = () => Object.fromEntries(requiredJobs.map(job => [job, {result: 'success'}]));

test('all mandatory and additional declared dependencies must succeed', () => {
  assert.equal(validateRequiredNeeds(successfulNeeds()), true);
  assert.equal(validateRequiredNeeds({...successfulNeeds(), additional: {result: 'success'}}), true);
  assert.throws(() => validateRequiredNeeds({...successfulNeeds(), additional: {result: 'failure'}}), /additional/);
});

for (const result of ['failure', 'cancelled', 'skipped', 'pending', 'SUCCESS', undefined, null, true]) {
  test(`mandatory dependencies reject result ${String(result)}`, () => {
    for (const job of requiredJobs) {
      assert.throws(() => validateRequiredNeeds({...successfulNeeds(), [job]: {result}}), error => error.message.includes(job));
    }
  });
}

test('every mandatory dependency is required, including changes', () => {
  for (const job of requiredJobs) {
    const needs = successfulNeeds();
    delete needs[job];
    assert.throws(() => validateRequiredNeeds(needs), error => error.message.includes(job));
  }
});

test('invalid needs and dependency shapes fail closed', () => {
  for (const needs of [undefined, null, [], 'success', 1, {}]) {
    assert.throws(() => validateRequiredNeeds(needs));
  }
  for (const state of [null, [], 'success', {}, {outputs: {result: 'success'}}]) {
    assert.throws(() => validateRequiredNeeds({...successfulNeeds(), 'build-core': state}), /build-core/);
  }
});

test('the actual CLI succeeds only with valid successful NEEDS_JSON', () => {
  const script = fileURLToPath(new URL('./ci-required-gate.mjs', import.meta.url));
  for (const [input, expectedStatus] of [
    [JSON.stringify(successfulNeeds()), 0],
    [JSON.stringify({...successfulNeeds(), 'browser-regression': {result: 'skipped'}}), 1],
    [JSON.stringify({changes: {result: 'success'}}), 1],
    ['not-json', 1],
    [undefined, 1],
  ]) {
    const env = {...process.env};
    if (input === undefined) delete env.NEEDS_JSON;
    else env.NEEDS_JSON = input;
    const child = spawnSync(process.execPath, [script], {env, encoding: 'utf8', timeout: 5000});
    assert.ifError(child.error);
    assert.equal(child.status, expectedStatus, child.stderr);
    assert.match(expectedStatus ? child.stderr : child.stdout, expectedStatus ? /CI required gate failed:/ : /CI required gate passed:/);
  }
});

const bootstrap = [
  {uses: 'actions/checkout@v4'},
  {uses: 'actions/setup-node@v4', with: {'node-version': '22', cache: 'npm'}},
  {run: 'npm ci'},
];

test('build-core preserves all original commands, order and budgets', () => {
  assert.deepEqual(workflow.jobs['build-core'], {
    needs: 'changes',
    'runs-on': 'ubuntu-latest',
    'timeout-minutes': 25,
    steps: [
      ...bootstrap.map(step => step.uses === 'actions/checkout@v4' ? step : {...step, if: "needs.changes.outputs.docs != 'true'"}),
      {run: 'npm test', if: "needs.changes.outputs.docs != 'true'"},
      {name: 'Duel deterministic stress (500 per theme)', if: "needs.changes.outputs.duel == 'true'", 'timeout-minutes': 5, run: 'node scripts/duel-stress.mjs 500'},
      {run: 'npm run typecheck', if: "needs.changes.outputs.docs != 'true'"},
      {run: 'npm run lint', if: "needs.changes.outputs.docs != 'true'"},
      {run: 'npm run build', if: "needs.changes.outputs.docs != 'true'"},
    ],
  });
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

// Captured before the split: each hash covers the entire named step object,
// including run text, if, env, timeout, action version and artifact paths.
const originalBrowserSteps = [
  ['Install Chromium for responsive regression', '9bfc2290b4992f52fcdcdfe886c5290ae621e89580654a540ca01200839ff4d2'],
  ['Wave 1 decisions, state traces and paired evidence', 'b55df5f005cbaa7ed2ae773ee566a96eeb2faf27ff85c08515898c1c2ce0c11a'],
  ['Cete outcome moments (1440/390/320, motion, save and focus)', 'b07dfa73c06b948d0d3cc29a6a67a1811273907783814cf768e5a1b3778ef0cd'],
  ['Duel archive, save and 2.5D responsive regression', '4a4cb68a1633221df7eb929840fff436ef72c3ca1e20302fab07131dcd4618fe'],
  ['DEVLET map transition mobile regression', '3a2fede18341c7b0d1cb8be63bba2c75482601f27727821dc062a24cfe1d71fb'],
  ['Upload duel evidence', '47ba3f41bae3baa11d98818ab3be923935eef5398db395d9ea3e0dec5f9ad098'],
  ['Responsive and interaction regression (TR/EN, 16 live routes)', '6cbf5b85752f7210af9640cec08f0db3eeff640f771cdbdb7d2c9c8527827e6a'],
  ['TC SIM historical starts (1440, 390, 320 px; save, reload and 2026)', '76af8095a153e6324c07879c4a1868c3a7d26020bf214318c34a36741a357fba'],
  ['Cete outcome production smoke (both hosts)', '4e10b3f1b0c1ced99e320518dc7c2bbe6cdd9df24bfac2e034f9cbd60856dcf4'],
  ['Wave 1 production proof (both hosts)', '6f018711e0e9a4ce847f3737599effcfe86fe1883fe61c257b676ef89d9f30f1'],
  ['Upload Wave 1 outcome evidence', '7c6279724375e19099b460de32e8ab68c5216006dc633dae80a5e34e9484ddc6'],
  ['Upload Cete outcome evidence', 'bdae1dbf81cbb41d776fbd9314a2f5b37487a413322e84b91ef07b9fb2d14e9e'],
  ['Upload responsive evidence', '80742b40af056012e528facf3b56e2d2b1bff5d148306e532b9945f47b09f688'],
  ['Upload TC SIM historical evidence', '8705ccf8dcd50a2428cd921a0370ca55268b4943c9a4ee169bc55307ed231b04'],
  ['Verify deployed duel assets, archives and legacy saves', '18b26a5b27c24da5a645c850f2248fb109fb71d32c60c8e00a943cae2badd54f'],
  ['Upload production duel evidence', 'ead3bf534da008de491a4db410a4bb59708df09db1ff20e685a236d5541d6814'],
];

test('browser-regression builds independently and preserves every original browser step', () => {
  const {steps, ...job} = workflow.jobs['browser-regression'];
  assert.deepEqual(job, {needs: 'changes', 'runs-on': 'ubuntu-latest', 'timeout-minutes': 25});
  const browserNeeded = "needs.changes.outputs.browser == 'true' || github.ref == 'refs/heads/main'";
  assert.deepEqual(steps.slice(0, 4), [...bootstrap, {run: 'npm run build'}].map(step => step.uses === 'actions/checkout@v4' ? step : {...step, if: browserNeeded}));
  assert.deepEqual(steps.slice(4).map(step => step.name), originalBrowserSteps.map(([name]) => name));
  for (const [index, [name, expected]] of originalBrowserSteps.entries()) {
    let step = steps[index + 4];
    if (name === 'Wave 1 decisions, state traces and paired evidence') {
      // #110 measures Wave 1 against main; stacked #111 measures the map cache
      // against pre-cache Wave 1. Keep both reviewed pins and all other fields.
      const pins = step.run.match(/(?<=origin |git archive )[a-f0-9]{40}/g);
      assert.equal(pins?.length, 2);
      assert.equal(pins[0], pins[1], 'fetch and archive must use the same baseline');
      assert.ok(['b4ebc2babe7c754493d84421051c9531fc09215e', '53534e2f9526ad80ce296952c212fa44aaa0ada1'].includes(pins[0]));
      step = {...step, run: step.run.replaceAll(pins[0], '53534e2f9526ad80ce296952c212fa44aaa0ada1')};
    }
    if (name === 'Install Chromium for responsive regression') {
      assert.equal(step.if, browserNeeded);
      const {if: condition, ...original} = step;
      void condition;
      step = original;
    }
    if (name.startsWith('TC SIM historical starts')) {
      assert.equal(step.if, "needs.changes.outputs.tc == 'true'");
      step = {...step, if: "needs.changes.outputs.full == 'true'"};
    }
    assert.equal(digest(step), expected, `${name}: original step contract changed`);
  }
});

test('the required build gate always runs and checks every mandatory dependency', () => {
  assert.deepEqual(workflow.jobs.build, {
    if: '${{ always() }}',
    needs: requiredJobs,
    'runs-on': 'ubuntu-latest',
    'timeout-minutes': 5,
    steps: [
      {uses: 'actions/checkout@v4'},
      {uses: 'actions/setup-node@v4', with: {'node-version': '22'}},
      {
        name: 'Require every build dependency to succeed',
        env: {NEEDS_JSON: '${{ toJSON(needs) }}'},
        run: 'node scripts/ci-required-gate.mjs',
      },
    ],
  });
});

test('workflow triggers, concurrency, path routing and campaign jobs remain unchanged', () => {
  assert.equal(workflow.name, 'ci');
  assert.deepEqual(workflow.on, {push: {branches: ['main']}, pull_request: null});
  assert.deepEqual(workflow.concurrency, {group: 'ci-${{ github.event.pull_request.number || github.ref }}', 'cancel-in-progress': "${{ github.event_name == 'pull_request' }}"});
  for (const [job, expected] of Object.entries({
    changes: 'a9c282f51a5ef948511f69d2cc5b66864617a5d726810885d4ce40a9ae5fc323',
    'campaign-browser': 'a0af9ca6adc88a356e6133e0784f4f13dbaedfc70f8f8cb02a3a056344903080',
    'campaign-balance': '82e6883e6184615877525146f93ff027cbd72c87afe1762bcf1b9db24134c483',
  })) {
    const value = structuredClone(workflow.jobs[job]);
    if (job === 'changes') {
      assert.equal(value.outputs.docs, '${{ steps.route.outputs.docs }}');
      assert.equal(value.outputs.tc, '${{ steps.route.outputs.tc }}');
      delete value.outputs.docs;
      delete value.outputs.tc;
      const patch = value.steps.splice(1, 1)[0];
      assert.equal(patch.run, 'git diff --check "$BASE...$HEAD"');
    }
    if (job === 'campaign-browser') {
      for (const step of value.steps) {
        if (step.uses === 'actions/setup-node@v4' || step.run === 'npm ci' || step.name === 'Install Chromium') {
          assert.equal(step.if, "needs.changes.outputs.campaign == 'true' || github.ref == 'refs/heads/main'");
          delete step.if;
        }
      }
    }
    assert.equal(digest(value), expected, `${job}: original job contract changed`);
  }
});

test('a workflow-only change selects the full CI matrix through the routing CLI', async t => {
  const fixture = await mkdtemp(join(tmpdir(), 'ci-workflow-routing-'));
  t.after(() => rm(fixture, {recursive: true, force: true}));
  await writeFile(join(fixture, 'git'), "#!/bin/sh\nprintf '%s\\0' '.github/workflows/ci.yml'\n", {mode: 0o755});
  const output = join(fixture, 'github-output');
  const script = fileURLToPath(new URL('./ci-changes.mjs', import.meta.url));
  const child = spawnSync(process.execPath, [script, 'baseline', 'head'], {
    env: {...process.env, PATH: `${fixture}${delimiter}${process.env.PATH ?? ''}`, GITHUB_OUTPUT: output},
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(Object.fromEntries(child.stdout.trim().split('\n').map(line => line.split('='))), {
    full: 'true', docs: 'false', routes: '', browser: 'true',
    tc: 'true', devlet: 'true', duel: 'true', campaign: 'true', balance: 'true',
  });
  assert.equal(readFileSync(output, 'utf8'), child.stdout);
});

test('no job or step can ignore a failure with continue-on-error', () => {
  for (const [name, job] of Object.entries(workflow.jobs)) {
    assert.equal(Object.hasOwn(job, 'continue-on-error'), false, name);
    for (const step of job.steps ?? []) {
      assert.equal(Object.hasOwn(step, 'continue-on-error'), false, `${name}: ${step.name || step.run || step.uses}`);
    }
  }
});
