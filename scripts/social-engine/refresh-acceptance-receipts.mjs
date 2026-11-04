/** Import completed local QA receipts. This command never builds, runs tests or contacts a provider. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, rename, stat, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs, isDeepStrictEqual } from "node:util";
const { values } = parseArgs({
  options: {
    candidate: { type: "string" },
    checks: { type: "string" },
    legacy: { type: "string" },
  },
});
if (!values.candidate || !values.checks)
  throw Error(
    "Usage: node scripts/social-engine/refresh-acceptance-receipts.mjs --candidate <tested checkout> --checks <completed cases directory>",
  );
const candidate = await realpath(values.candidate),
  checks = await realpath(values.checks);
const root = "artifacts/social-engine",
  out = join(root, "current-receipts");
const manifestPath = "public/games/social-engine/build-manifest.json";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifestBytes = await readFile(manifestPath);
const manifest = sha(manifestBytes),
  manifestObject = JSON.parse(manifestBytes);
const candidateManifest = async () => sha(await readFile(join(candidate, manifestPath)));
assert.equal(await candidateManifest(), manifest, "Different compiled game manifest");
const completed = JSON.parse(await readFile(join(checks, "cases.json"), "utf8"));
assert.equal(completed.manifest, manifest, "Runner used another manifest");
const sourceCommit = execFileSync(
  "git",
  ["-C", candidate, "log", "-1", "--format=%H", "--", manifestPath],
  { encoding: "utf8" },
).trim();
const records = {},
  incomplete = {},
  observations = {};
async function bytes(path) {
  if ((await stat(path)).size > 32_000_000) throw Error("Receipt exceeds size limit");
  return readFile(path);
}
async function atomic(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temp = path + "." + process.pid + ".tmp";
  await writeFile(temp, content);
  await rename(temp, path);
}
async function capture(path, raw, source, identity) {
  const hash = sha(raw);
  const destination =
    "current-receipts/" + hash + (path === "acceptance-unit.tap" ? ".tap" : ".json");
  await atomic(join(root, destination), raw);
  records[path] = { path: destination, sha256: hash, source, identity };
}
const runs = {
  smoke: "portable-smoke/results.json",
  legacy: "upgrade/legacy-display/results.json",
  work: "upgrade/careers/results.json",
};
for (const engine of ["chromium", "firefox", "webkit"])
  for (const kind of ["browser", "property-browser", "persistence-browser"]) {
    runs[engine + "-" + kind] =
      (kind === "persistence-browser" && engine === "chromium" ? kind : kind + "-" + engine) +
      "/results.json";
  }
for (const [name, path] of Object.entries(runs)) {
  const receipt = completed.checks[name];
  if (!receipt || !Number.isInteger(receipt.exit)) continue;
  if (receipt.exit !== 0) {
    incomplete[path] = {
      check: name,
      exit: receipt.exit,
      reason: "Runner did not complete successfully",
    };
    continue;
  }
  let raw, report;
  try {
    raw = await bytes(join(checks, name + ".log"));
    report = JSON.parse(raw);
  } catch {
    incomplete[path] = { check: name, reason: "No complete JSON receipt" };
    continue;
  }
  const bound = report.manifestSha256 ?? report.manifest;
  if (typeof bound === "string" && bound !== manifest) continue;
  if (name.endsWith("-persistence-browser")) {
    if (!report.bundle_sha256 || !report.timestamp || !Array.isArray(report.checks)) continue;
  } else if (bound !== manifest) continue;
  if (
    name.endsWith("-browser") &&
    !name.includes("-property-") &&
    !name.includes("-persistence-") &&
    !report.finished
  )
    continue;
  // Nonzero process exit is preserved. A failed/incomplete harness never creates a passing receipt.
  if (receipt.exit !== 0) continue;
  await capture(path, raw, "rules8-checks/" + name + ".log", {
    manifestSha256: manifest,
    ...receipt,
  });
}
for (const path of [
  ...["chromium", "firefox", "webkit"].map((engine) => "browser-" + engine + "/results.json"),
  "upgrade/rules8-route/results.json",
  "upgrade/rules8-worker/results.json",
  "upgrade/door-route/results.json",
  "upgrade/door-worker/results.json",
  "browser-evidence/results.json",
  "ui-browser/results.json",
  "journal-browser/results.json",
  "asset-faults/results.json",
  "startup-network/results.json",
  ...["v4-browser", "journal-browser"].map((e) => "under-load/" + e + "/results.json"),
  "baseline/frozen-full-regression.json",
  "renderer-lifecycle/results.json",
  "axe/results.json",
  "v4-browser/results.json",
  "acceptance-unit.json",
  "late-save/results.json",
  "capacity-10000/results.json",
  "event-reachability/results.json",
  ...["chromium", "firefox", "webkit"].map((e) => "cold-start-" + e + "/results.json"),
  "simulation-365/results.json",
  "performance/latest.json",
]) {
  let raw, d;
  try {
    raw = await bytes(join(candidate, root, path));
    d = JSON.parse(raw);
  } catch {
    continue;
  }
  if (/^browser-(chromium|firefox|webkit)\/results\.json$/.test(path)) {
    if (
      incomplete[path] ||
      !d.finished ||
      !Array.isArray(d.results) ||
      d.manifestSha256 !== manifest ||
      path !== "browser-" + d.engine + "/results.json"
    )
      continue;
    if (records[path]) {
      const previous = JSON.parse(await readFile(join(root, records[path].path), "utf8"));
      if (!(Date.parse(d.finished) > Date.parse(previous.finished))) continue;
    }
  } else if (path.startsWith("under-load/")) {
    if (d.manifestSha256 !== manifest || !d.finishedAt || !d.results?.length || !d.softwareRenderer) continue;
  } else if (path === "acceptance-unit.json") {
    if (
      !["PASS", "FAIL"].includes(d.status) ||
      !d.finishedAt ||
      d.manifestSha256 !== manifest ||
      !d.sourcesUnchanged ||
      !Number.isInteger(d.exitCode) ||
      !d.counts ||
      !Array.isArray(d.tests) ||
      d.tests.length === 0 ||
      !d.tapSha256
    )
      continue;
    let tap;
    try {
      tap = await bytes(join(candidate, root, "acceptance-unit.tap"));
    } catch {
      continue;
    }
    if (sha(tap) !== d.tapSha256) continue;
    await capture("acceptance-unit.tap", tap, "acceptance-unit.tap", { manifestSha256: manifest });
  } else if (path === "ui-browser/results.json") {
    if (
      !isDeepStrictEqual(d.manifestAtStart, manifestObject) ||
      !isDeepStrictEqual(d.manifestAtEnd, manifestObject) ||
      !Number.isFinite(Date.parse(d.generatedAt)) ||
      !["PASS", "PASS_WITH_UNVERIFIED", "FAIL"].includes(d.status) ||
      !d.results?.length
    )
      continue;
  } else if (path === "renderer-lifecycle/results.json") {
    if (
      !["PASS", "FAIL"].includes(d.status) ||
      !d.finishedAt ||
      !d.rendererSourceSha256 ||
      !d.probeSha256 ||
      d.rendererSourceSha256 !==
        sha(await bytes(join(candidate, "src/games/social-engine/rendering/renderer.ts")))
    )
      continue;
  } else if (path === "performance/latest.json") {
    if (!/^\d{4}-\d{2}-\d{2}T[\d-]+Z$/.test(d.runId ?? "")) continue;
    const filename = `performance/${d.runId}/report.json`;
    let reportBytes, report;
    try {
      reportBytes = await bytes(join(candidate, root, filename));
      report = JSON.parse(reportBytes);
    } catch {
      continue;
    }
    if (report.build?.manifestSha256 !== manifest) continue;
    observations.soak = {
      runId: d.runId,
      status: report.status,
      elapsedMinutes: d.elapsedMinutes,
      manifestSha256: manifest,
    };
    if (report.status !== "COMPLETED") continue;
    await capture(filename, reportBytes, filename, { manifestSha256: manifest });
  } else if (path === "late-save/results.json") {
    if (
      !["PASS", "FAIL"].includes(d.status) ||
      !d.probeSha256 ||
      !d.fixtureSha256 ||
      d.cases?.length !== 3
    )
      continue;
  } else if (["capacity-10000/results.json", "event-reachability/results.json"].includes(path)) {
    // Reconciler independently recalculates the game source digest before admitting these probes.
    if (!["PASS", "FAIL"].includes(d.status) || !/^[a-f0-9]{64}$/.test(d.sourceSha256 ?? "")) continue;
  } else if (path === "simulation-365/results.json") {
    observations.year = {
      status: d.status,
      completedDays: d.completedDays ?? null,
      sourceSha256: d.environment?.sourceSha256 ?? null,
    };
    if (d.status !== "PASS" || d.simulatedDays !== 365 || !d.environment?.sourceSha256) continue;
  } else if (
    d.manifestSha256 !== manifest ||
    !["PASS", "FAIL"].includes(d.status ?? (d.finishedAt && d.results?.length ? "PASS" : null))
  )
    continue;
  const receiptKey = path.replace(/^upgrade\/door-(route|worker)\//,"upgrade/rules8-$1/");
  if (path === "upgrade/door-route/results.json" && d.manifestSha256 === manifest && d.finished && Array.isArray(d.requests) && Array.isArray(d.errors))
    await capture("route-browser/results.json", raw, path, { manifestSha256: manifest });
  await capture(receiptKey, raw, path, {
    manifestSha256:
      d.manifestSha256 === manifest || path === "ui-browser/results.json" ? manifest : null,
    sourceBoundProbe: d.probeSha256 ?? d.environment?.sourceSha256 ?? null,
  });
}
if (values.legacy) {
  const raw = await bytes(await realpath(values.legacy)),
    suites = JSON.parse(raw);
  const games = ["TC SIM", "Boardworld", "Racon Manager"];
  if (
    games.every(
      (name) =>
        suites[name]?.exit === 0 &&
        suites[name]?.source === sourceCommit &&
        suites[name]?.target === "production build on loopback",
    )
  )
    await capture("local-legacy-suite/results.json", raw, "rules8-legacy/results.json", {
      sourceCommit,
      target: "production build on loopback",
    });
}
assert.equal(await candidateManifest(), manifest, "Candidate changed while collecting");
const index = {
  schemaVersion: 1,
  manifestSha256: manifest,
  sourceCommit,
  records,
  incomplete,
  observations,
};
await atomic(join(out, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(JSON.stringify({ manifest, sourceCommit, records: Object.keys(records) }));
