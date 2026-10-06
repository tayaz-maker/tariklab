import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const requiredJobs = ['changes', 'build-core', 'browser-regression', 'campaign-browser', 'campaign-balance'];

export function validateRequiredNeeds(needs) {
  if (!needs || typeof needs !== 'object' || Array.isArray(needs)) {
    throw new Error('CI dependency results must be an object');
  }
  for (const job of requiredJobs) {
    if (!Object.hasOwn(needs, job)) {
      throw new Error(`Missing required CI dependency: ${job}`);
    }
  }
  for (const [job, state] of Object.entries(needs)) {
    if (!state || typeof state !== 'object' || Array.isArray(state) || !Object.hasOwn(state, 'result')) {
      throw new Error(`Invalid CI dependency result: ${job}`);
    }
    if (state.result !== 'success') {
      throw new Error(`CI dependency ${job} did not succeed: ${String(state.result)}`);
    }
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    validateRequiredNeeds(JSON.parse(process.env.NEEDS_JSON ?? ''));
    console.log('CI required gate passed: every declared dependency succeeded');
  } catch (error) {
    console.error(`CI required gate failed: ${error.message}`);
    process.exitCode = 1;
  }
}
