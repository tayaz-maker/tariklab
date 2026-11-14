import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import {
  advanceRelease,
  releaseBranch,
  repository,
  requireTrustedEvent,
} from "./cloudflare-release.mjs";

const sha = "a".repeat(40);
const old = "b".repeat(40);
const newer = "c".repeat(40);
const names = ["ci", "tc-job-start-outcome", "Boardworld quality"];
const files = ["ci", "tc-job-start-outcome", "boardworld-quality"];
function fixture() {
  const runs = files.map((file, index) => ({
    id: index + 1,
    run_attempt: 1,
    path: `.github/workflows/${file}.yml`,
    name: names[index],
    event: "push",
    head_branch: "main",
    head_repository: { full_name: repository },
    head_sha: sha,
    status: "completed",
    conclusion: "success",
  }));
  const event = {
    action: "completed",
    repository: { full_name: repository },
    workflow_run: structuredClone(runs[2]),
  };
  const model = { runs, event, main: sha, tip: old, reads: [], writes: [], pause: async () => {} };
  model.read = async (path) => {
    model.reads.push(path);
    await model.beforeRead?.(path);
    if (path === "branches/main") return { commit: { sha: model.main } };
    if (path === `git/ref/heads/${releaseBranch}`) return { object: { sha: model.tip } };
    if (path.startsWith("compare/"))
      return model.comparison ?? { status: "ahead", merge_base_commit: { sha: old } };
    const file = path.match(/^actions\/workflows\/(.+)\/runs\?/)[1];
    const selected = model.runs.filter((run) => run.path === `.github/workflows/${file}`);
    return { total_count: selected.length + (model.hiddenRuns ?? 0), workflow_runs: selected };
  };
  model.update = async (path, body) => {
    model.writes.push({ path, body });
    assert.equal(path, `git/refs/heads/${releaseBranch}`);
    assert.deepEqual(body, { sha, force: false });
    model.tip = body.sha;
    if (model.writeError) throw new Error("Connection lost after sending update");
    return { object: { sha: model.tip } };
  };
  return model;
}

test("all three completion events advance once, with durable duplicate and rerun no-ops", async () => {
  const model = fixture();
  for (const run of model.runs) {
    const result = await advanceRelease({ ...model, event: { ...model.event, workflow_run: run } });
    assert.equal(result.advanced, run.id === 1);
  }
  model.runs[2].run_attempt = 2;
  const result = await advanceRelease({
    ...model,
    event: { ...model.event, workflow_run: structuredClone(model.runs[2]) },
  });
  assert.equal(result.reason, "already-current");
  assert.equal(model.writes.length, 1);
});

test("untrusted, PR, foreign-branch, wrong-workflow and malformed events fail before reading", async () => {
  for (const patch of [
    { event: "pull_request" },
    { event: "workflow_dispatch" },
    { head_branch: releaseBranch },
    { head_repository: { full_name: "attacker/tariklab" } },
    { path: ".github/workflows/untrusted.yml" },
    { name: "Pretend quality" },
    { status: "in_progress" },
    { conclusion: "failure" },
    { head_sha: "main" },
    { run_attempt: undefined },
    { id: -1 },
  ]) {
    const model = fixture();
    Object.assign(model.event.workflow_run, patch);
    await assert.rejects(advanceRelease(model));
    assert.equal(model.reads.length, 0);
    assert.equal(model.writes.length, 0);
  }
  assert.throws(() => requireTrustedEvent({ ...fixture().event, action: "requested" }));
  assert.throws(() => requireTrustedEvent({ ...fixture().event, repository: {} }));
});

test("pending, missing and stale candidates never move the pointer", async () => {
  for (const mutate of [
    (m) => (m.main = newer),
    (m) => (m.runs[0].status = "in_progress"),
    (m) => m.runs.shift(),
    (m) => (m.runs[0].event = "pull_request"),
    (m) => (m.runs[0].head_sha = newer),
    (m) => (m.runs[0].head_branch = "feature"),
  ]) {
    const model = fixture();
    mutate(model);
    assert.equal((await advanceRelease(model)).advanced, false);
    assert.equal(model.writes.length, 0);
  }
});

test("latest failures reject earlier successful runs and old attempts cannot authorize release", async () => {
  const failed = fixture();
  failed.runs.push({ ...failed.runs[0], id: 99, conclusion: "failure" });
  await assert.rejects(advanceRelease(failed), /must PASS/);
  assert.equal(failed.writes.length, 0);
  for (const patch of [{ id: 99 }, { run_attempt: 2 }]) {
    const model = fixture();
    Object.assign(model.runs[2], patch);
    assert.equal((await advanceRelease(model)).reason, "superseded-event");
    assert.equal(model.writes.length, 0);
  }
});

test("bounded read-only retries absorb completion API lag without waiting for long-running CI", async () => {
  const model = fixture();
  model.runs[0].status = "in_progress";
  let pauses = 0;
  model.pause = async (milliseconds) => {
    assert.equal(milliseconds, 3000);
    if (++pauses === 2) model.runs[0].status = "completed";
  };
  assert.equal((await advanceRelease(model)).advanced, true);
  assert.equal(pauses, 2);
  const pending = fixture();
  pending.runs[0].status = "in_progress";
  pauses = 0;
  pending.pause = async () => {
    pauses++;
  };
  assert.equal((await advanceRelease(pending)).reason, "checks-pending");
  assert.equal(pauses, 3);
  assert.equal(pending.writes.length, 0);
});

test("API errors and incomplete lists fail closed without a write", async () => {
  const incomplete = fixture();
  incomplete.hiddenRuns = 1;
  await assert.rejects(advanceRelease(incomplete), /incomplete/);
  assert.equal(incomplete.writes.length, 0);
  const unavailable = fixture();
  unavailable.beforeRead = () => {
    throw new Error("API unavailable");
  };
  await assert.rejects(advanceRelease(unavailable), /API unavailable/);
  assert.equal(unavailable.writes.length, 0);
});

test("diverged or rewound release branches cannot be force-updated", async () => {
  for (const comparison of [
    { status: "behind", merge_base_commit: { sha } },
    { status: "diverged", merge_base_commit: { sha: newer } },
    { status: "ahead", merge_base_commit: { sha: newer } },
  ]) {
    const model = fixture();
    model.comparison = comparison;
    await assert.rejects(advanceRelease(model), /fast-forward|ancestor/);
    assert.equal(model.writes.length, 0);
  }
});

test("main, checks and pointer are checked again after the ancestry read", async () => {
  for (const mutate of [
    (m) => (m.main = newer),
    (m) => (m.runs[0].status = "in_progress"),
    (m) => (m.runs[0].conclusion = "failure"),
    (m) => (m.tip = newer),
  ]) {
    const model = fixture();
    model.beforeRead = (path) => {
      if (path.startsWith("compare/")) mutate(model);
    };
    await advanceRelease(model).catch(() => undefined);
    assert.equal(model.writes.length, 0);
  }
  const finalRace = fixture();
  let mainReads = 0;
  finalRace.beforeRead = (path) => {
    if (path === "branches/main" && ++mainReads === 3) finalRace.main = newer;
  };
  await assert.rejects(advanceRelease(finalRace), /Main moved before/);
  assert.equal(finalRace.writes.length, 0);
});

test("ambiguous update is never retried and durable success prevents a second write", async () => {
  const model = fixture();
  model.writeError = true;
  await assert.rejects(advanceRelease(model), /Connection lost/);
  assert.equal(model.writes.length, 1);
  model.writeError = false;
  assert.equal((await advanceRelease(model)).reason, "already-current");
  assert.equal(model.writes.length, 1);
});

test("privileged workflow runs trusted default-branch code, serialized, with bounded permissions", () => {
  const yaml = createRequire(import.meta.url)("js-yaml");
  const workflow = yaml.load(
    readFileSync(new URL("../.github/workflows/cloudflare-release.yml", import.meta.url), "utf8"),
  );
  assert.deepEqual(workflow.on, {
    workflow_run: { workflows: names, types: ["completed"], branches: ["main"] },
  });
  assert.deepEqual(workflow.concurrency, {
    group: "cloudflare-verified-production-pointer",
    queue: "max",
  });
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(workflow.jobs.advance.permissions, { actions: "read", contents: "write" });
  assert.equal(workflow.jobs.advance.steps[0].with.ref, "${{ github.sha }}");
  assert.equal(workflow.jobs.advance.steps[0].with["persist-credentials"], false);
  assert.equal(workflow.jobs.advance.steps.length, 2);
  assert.equal(workflow.jobs.advance.steps[1].run, "node scripts/cloudflare-release.mjs");
  for (const required of ["head_repository.full_name", "head_branch", "event", "conclusion"])
    assert.ok(workflow.jobs.advance.if.includes(required));
});
