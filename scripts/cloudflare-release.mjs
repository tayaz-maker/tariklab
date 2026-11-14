import assert from "node:assert/strict";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { requireRelease } from "./cloudflare-deploy.mjs";

export const repository = "tayaz-maker/tariklab";
export const releaseBranch = "cloudflare-production";
const workflowNames = new Map([
  [".github/workflows/ci.yml", "ci"],
  [".github/workflows/tc-job-start-outcome.yml", "tc-job-start-outcome"],
  [".github/workflows/boardworld-quality.yml", "Boardworld quality"],
]);

export function requireTrustedEvent(event) {
  const run = event.workflow_run;
  assert.equal(event.action, "completed", "Only completed workflow events can release");
  assert.equal(event.repository?.full_name, repository, "Unexpected event repository");
  assert.equal(run?.head_repository?.full_name, repository, "Untrusted workflow repository");
  assert.equal(run?.event, "push", "Only main push workflows can release");
  assert.equal(run?.head_branch, "main", "Only main push workflows can release");
  assert.equal(run?.status, "completed", "Triggering workflow is pending");
  assert.equal(run?.conclusion, "success", "Triggering workflow must pass");
  assert.ok(workflowNames.has(run?.path), "Unexpected triggering workflow path");
  assert.equal(run.name, workflowNames.get(run.path), "Unexpected triggering workflow name");
  assert.match(run.head_sha, /^[a-f0-9]{40}$/, "A full triggering SHA is required");
  assert.ok(Number.isSafeInteger(run.id) && run.id > 0, "A workflow run ID is required");
  assert.ok(
    Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0,
    "A workflow run attempt is required",
  );
  return run;
}

async function readCandidate(read, sha) {
  const responses = await Promise.all(
    [...workflowNames.keys()].map((path) =>
      read(
        `actions/workflows/${path.split("/").at(-1)}/runs?head_sha=${sha}&event=push&branch=main&per_page=100`,
      ),
    ),
  );
  const runs = responses.flatMap((response) => {
    assert.ok(Array.isArray(response.workflow_runs), "Malformed workflow response");
    assert.equal(
      response.total_count,
      response.workflow_runs.length,
      "Workflow result is incomplete; refuse to ignore newer runs",
    );
    return response.workflow_runs;
  });
  const main = (await read("branches/main")).commit.sha;
  return { sha, main, runs };
}

function readiness(candidate, trigger) {
  if (candidate.main !== candidate.sha) return "stale-main";
  const selected = [...workflowNames.keys()].map(
    (path) =>
      candidate.runs
        .filter(
          (run) =>
            run.path === path &&
            run.event === "push" &&
            run.head_branch === "main" &&
            run.head_sha === candidate.sha,
        )
        .sort((a, b) => b.id - a.id)[0],
  );
  const currentTrigger = selected.find((run) => run?.path === trigger.path);
  if (
    currentTrigger &&
    (currentTrigger.id !== trigger.id || currentTrigger.run_attempt !== trigger.run_attempt)
  )
    return "superseded-event";
  if (selected.some((run) => !run || run.status !== "completed")) return "checks-pending";
  // Reuse the exact same production policy, including failure and provenance.
  requireRelease(candidate);
  return "ready";
}

// The branch ref is a durable idempotency marker. Serialized duplicate events
// see the same SHA and do nothing; no hook credential or repeated POST is needed.
export async function advanceRelease({ event, read, update, pause = delay }) {
  const trigger = requireTrustedEvent(event);
  const sha = trigger.head_sha;
  let candidate = await readCandidate(read, sha);
  let reason = readiness(candidate, trigger);
  // Completion webhooks can arrive before the run-list API reflects completion.
  // A short bounded read-only retry absorbs that lag; long-running checks remain
  // in Actions and will send their own completion event, never occupy a CF build.
  for (let retry = 0; reason === "checks-pending" && retry < 3; retry++) {
    await pause(3000);
    candidate = await readCandidate(read, sha);
    reason = readiness(candidate, trigger);
  }
  if (reason !== "ready") return { advanced: false, reason, sha };
  const ref = `git/ref/heads/${releaseBranch}`;
  const previous = (await read(ref)).object.sha;
  assert.match(previous, /^[a-f0-9]{40}$/, "Release branch must already exist");
  if (previous === sha) return { advanced: false, reason: "already-current", sha };
  const comparison = await read(`compare/${previous}...${sha}`);
  assert.equal(comparison.status, "ahead", "Release must fast-forward; never rewind or diverge");
  assert.equal(comparison.merge_base_commit?.sha, previous, "Release tip is not an ancestor");
  // Re-read all gates and current main after the ancestry request. A rerun,
  // failure or newer main can invalidate an earlier successful observation.
  candidate = await readCandidate(read, sha);
  reason = readiness(candidate, trigger);
  if (reason !== "ready") return { advanced: false, reason, sha };
  const current = (await read(ref)).object.sha;
  if (current === sha) return { advanced: false, reason: "already-current", sha };
  assert.equal(current, previous, "Release pointer changed concurrently; refuse to overwrite it");
  assert.equal((await read("branches/main")).commit.sha, sha, "Main moved before release update");
  // force:false and branch protection are the final server-side safeguards.
  // Never retry an ambiguous write: the next event safely reads the durable ref.
  const result = await update(`git/refs/heads/${releaseBranch}`, { sha, force: false });
  assert.equal(result.object?.sha, sha, "Release update did not confirm the exact candidate");
  assert.equal((await read(ref)).object.sha, sha, "Release pointer verification failed");
  return { advanced: true, reason: "verified-main", sha, previous };
}

async function main() {
  assert.equal(process.env.GITHUB_EVENT_NAME, "workflow_run", "Requires a workflow_run event");
  assert.equal(process.env.GITHUB_REPOSITORY, repository, "Unexpected runtime repository");
  const token = process.env.GITHUB_TOKEN?.trim();
  assert.ok(token, "A scoped GitHub Actions token is required");
  const request = async (path, body) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      method: body ? "PATCH" : "GET",
      redirect: "error",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "TarikLab-verified-release",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 200, `GitHub release API HTTP ${response.status}; fail closed`);
    return response.json();
  };
  const result = await advanceRelease({
    event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")),
    read: (path) => request(path),
    update: (path, body) => request(path, body),
  });
  const summary = `Cloudflare release pointer: ${result.reason}; exact main ${result.sha}`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
