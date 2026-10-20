import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitUntilReady } from "./ci-readiness.mjs";
import { builtPreviewArgs } from "./ci-built-preview.mjs";
import { waitForTcDeployment } from "./ci-wait-tc-deployment.mjs";
import { fingerprintPaths } from "./tc-sim-job-start-target.mjs";

function clock() {
  let time = 0;
  return { now: () => time, sleep: async ms => { time += ms; }, log: () => {} };
}

test("cold preview may become ready after the old ten-second internal deadline", async () => {
  const c = clock();
  await waitUntilReady(async () => c.now() >= 18000, { ...c, timeoutMs: 90000 });
  assert.equal(c.now(), 18000);
});

test("readiness has an upper bound and preserves the last real failure", async () => {
  const c = clock();
  await assert.rejects(waitUntilReady(async () => { throw new Error("HTTP 503"); }, { ...c, timeoutMs: 2500 }), /2500ms: HTTP 503/);
  assert.equal(c.now(), 2500);
});

test("server exit and over-deadline success cannot satisfy readiness", async () => {
  await assert.rejects(waitUntilReady(async () => true, { stopped: () => true }), /server exited/);
  const c = clock();
  await assert.rejects(waitUntilReady(async () => { await c.sleep(100); return true; }, { ...c, timeoutMs: 50 }), /timed out/);
});

test("built preview retains the exact Nitro Wrangler command and rejects another preset", () => {
  const metadata = { preset: "cloudflare-module", commands: { preview: "npx wrangler --cwd ./ dev" } };
  const args = builtPreviewArgs(metadata, 8087);
  assert.deepEqual(args.slice(1, 6), ["npx", "wrangler", "--cwd", "./", "dev"]);
  assert.ok(args.includes("8087"));
  assert.throws(() => builtPreviewArgs({ ...metadata, preset: "node-server" }, 8087), /unsupported/);
  assert.throws(() => builtPreviewArgs(metadata, "8087;echo"), /invalid/);
});

test("production readiness rejects stale content until every candidate fingerprint matches", async () => {
  const root = await mkdtemp(join(tmpdir(), "ci-readiness-"));
  try {
    for (const path of fingerprintPaths) {
      const file = join(root, path.split("?")[0]);
      await mkdir(join(file, ".."), { recursive: true });
      await writeFile(file, "candidate");
    }
    const c = clock();
    let count = 0;
    await waitForTcDeployment("https://tariklab.tayaz29.workers.dev", root, {
      ...c, intervalMs: 1000, timeoutMs: 5000,
      request: async () => new Response(++count === 1 ? "stale" : "candidate"),
    });
    assert.equal(count, fingerprintPaths.length + 1); // one rejected attempt, then every exact hash
    assert.equal(c.now(), 1000);
    await assert.rejects(waitForTcDeployment("https://example.com", root), /base|origin|synthetic/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
