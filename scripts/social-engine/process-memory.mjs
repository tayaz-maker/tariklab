// macOS OS-level footprint sampling of this checkout's own headless soak only.
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
assert.equal(
  process.platform,
  "darwin",
  "This collector uses macOS footprint; do not relabel another metric.",
);
const latest = JSON.parse(await readFile("artifacts/social-engine/performance/latest.json"));
const out = `artifacts/social-engine/performance/${latest.runId}`;
const samples = [];
let lastMinute = -1;
while (true) {
  const report = JSON.parse(await readFile(`${out}/report.json`));
  const rows = execFileSync("ps", ["-axo", "pid=,ppid=,args="], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map((m) => ({ pid: Number(m[1]), parent: Number(m[2]), args: m[3] }));
  const owners = rows
    .filter((r) => /^(?:\S*\/)?node scripts\/social-engine\/performance\.mjs$/.test(r.args))
    .filter((r) => {
      try {
        return execFileSync("lsof", ["-a", "-p", String(r.pid), "-d", "cwd", "-Fn"], {
          encoding: "utf8",
        })
          .split("\n")
          .includes("n" + resolve("."));
      } catch {
        return false;
      }
    });
  if (owners.length !== 1 || report.status !== "RUNNING") break;
  const minute = Math.floor(report.elapsedMinutes ?? 0);
  // Keep sampling sparse:10,30,60,90,119minutes, only once per threshold.
  const threshold = [10, 30, 60, 90, 119].filter((m) => m <= minute && m > lastMinute).at(-1);
  if (threshold !== undefined) {
    const owned = new Set([owners[0].pid]);
    for (let i = 0; i < 12; i++) for (const r of rows) if (owned.has(r.parent)) owned.add(r.pid);
    const pids = rows
      .filter(
        (r) =>
          owned.has(r.pid) &&
          (r.args.includes("Google Chrome.app/") || r.args.includes("/chrome-headless-shell")),
      )
      .map((r) => r.pid);
    assert.ok(
      pids.length > 0,
      "No owned Chrome processes; never invoke footprint without explicit targets",
    );
    const rawPath = `${out}/os-footprint-${threshold}.raw.json`;
    const result = spawnSync(
      "/usr/bin/footprint",
      ["--noCategories", "-j", rawPath, ...pids.flatMap((pid) => ["-p", String(pid)])],
      { encoding: "utf8", timeout: 45000 },
    );
    const raw = result.status === 0 ? JSON.parse(await readFile(rawPath)) : null;
    const sample = {
      measuredAt: new Date().toISOString(),
      elapsedMinutes: report.elapsedMinutes,
      thresholdMinute: threshold,
      ownerHarnessPid: owners[0].pid,
      pids,
      manifestSha256: report.build.manifestSha256,
      status: raw ? "MEASURED" : "UNVERIFIED",
      totalFootprintBytes: raw?.["total footprint"] ?? null,
      totalFootprintMiB: raw ? raw["total footprint"] / 1048576 : null,
      provisionalTargetMiB: 600,
      thresholdStatus: raw
        ? raw["total footprint"] <= 600 * 1048576
          ? "PASS"
          : "FAIL"
        : "UNVERIFIED",
      exitCode: result.status,
      error: result.error?.message ?? result.stderr,
      processes:
        raw?.processes?.map((p) => ({
          pid: p.pid,
          name: p.name,
          footprintBytes: p.footprint,
          historicalProcessPeakBytes: p.auxiliary?.phys_footprint_peak,
        })) ?? [],
      scope:
        "Point-in-time OS footprint of this test's headless Chrome tree, includes browser/GPU helper overhead. Not a peak, unique GPU allocation, reference PC or JS heap metric. Never sum individual historical peaks as a simultaneous peak.",
    };
    samples.push(sample);
    lastMinute = threshold;
    await writeFile(
      `${out}/os-footprint-samples.json`,
      JSON.stringify({ runId: latest.runId, samples }, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        minute: threshold,
        MiB: sample.totalFootprintMiB,
        thresholdStatus: sample.thresholdStatus,
      }),
    );
  }
  if (lastMinute >= 119) break;
  await new Promise((r) => setTimeout(r, 60000));
}
