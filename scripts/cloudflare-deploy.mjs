import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {waitForRelease} from './release-wait.mjs';
import {execFileSync, spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const repository = 'tayaz-maker/tariklab';

export function requireRelease({sha, main, runs}) {
  assert.match(sha, /^[a-f0-9]{40}$/, 'A full release SHA is required');
  assert.equal(sha, main, 'Main moved; refuse a stale production release');
  for (const path of ['.github/workflows/ci.yml', '.github/workflows/tc-job-start-outcome.yml']) {
    const run = runs.filter(r => r.path === path && r.event === 'push' && r.head_branch === 'main' && r.head_sha === sha)
      .sort((a, b) => b.id - a.id)[0];
    assert.ok(run, `Missing mandatory main workflow: ${path}`);
    assert.equal(run.status, 'completed', `${path} is pending; retry the Cloudflare build after CI finishes`);
    assert.equal(run.conclusion, 'success', `${path} must PASS before production`);
  }
}

async function github(path) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: {'Accept':'application/vnd.github+json', 'User-Agent':'TarikLab-Cloudflare-release'},
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200, 'Public GitHub release guard unavailable; fail closed');
  return response.json();
}

async function deploy() {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
  const branch = process.env.WORKERS_CI_BRANCH || execFileSync('git', ['branch', '--show-current'], {encoding:'utf8'}).trim();
  assert.equal(branch, 'main', 'Only main can publish production; branches use wrangler versions upload');
  if (process.env.WORKERS_CI_COMMIT_SHA) assert.equal(process.env.WORKERS_CI_COMMIT_SHA, sha);
  const config = JSON.parse(readFileSync('.output/server/wrangler.json', 'utf8'));
  assert.equal(config.name, 'tariklab');
  assert.equal(config.assets.binding, 'ASSETS');
  assert.equal(config.keep_vars, true, 'Preserve existing dashboard variables');
  assert.ok(config.compatibility_flags.includes('nodejs_compat'));
  const [main, runs] = await Promise.all([github('branches/main'), github(`actions/runs?head_sha=${sha}&event=push&per_page=100`)]);
  if (process.env.WORKERS_CI_BRANCH === 'main') {
    await waitForRelease({sha, main:main.commit.sha, runs:runs.workflow_runs,
      read:github, verify:requireRelease, delay});
  } else {
    requireRelease({sha, main:main.commit.sha, runs:runs.workflow_runs});
  }
  // Re-read main immediately before handing credentials to Wrangler. Native
  // Workers Builds supplies Wrangler authentication; never extract its token.
  assert.equal((await github('branches/main')).commit.sha, sha, 'Main moved during verification');
  console.log(`Publishing verified main ${sha} to existing Worker tariklab`);
  const result = spawnSync('node_modules/.bin/wrangler', ['deploy', '--config', '.output/server/wrangler.json'], {stdio:'inherit'});
  assert.equal(result.status, 0, 'Cloudflare production publication failed');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await deploy();
