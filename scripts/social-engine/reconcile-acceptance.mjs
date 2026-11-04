/** Evidence-only release audit. Never deploys, changes a criterion, or treats missing evidence as PASS. */
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import assert from "node:assert/strict";
import { assessSoakCoverage } from "./soak-coverage.mjs";
import { footprintEvidence } from "./footprint-evidence.mjs";
const root = "artifacts/social-engine/";
const digest = (b) => createHash("sha256").update(b).digest("hex");
const read = async (p) => {
  try {
    return JSON.parse(await readFile(root + p, "utf8"));
  } catch {
    return null;
  }
};
const manifestBytes = await readFile("public/games/social-engine/build-manifest.json");
const manifest = JSON.parse(manifestBytes);
const manifestHashes = new Set([
  digest(manifestBytes),
  digest(JSON.stringify(manifest)),
  digest(JSON.stringify(manifest, null, 2)),
]);
const fresh = (d) =>
  !!d &&
  (manifestHashes.has(d.manifestSha256 ?? d.build?.manifestSha256) ||
    (JSON.stringify(d.manifestAtStart) === JSON.stringify(manifest) &&
      JSON.stringify(d.manifestAtEnd) === JSON.stringify(manifest)));
const contract = await readFile("docs/social-engine/ACCEPTANCE_TESTS.md", "utf8");
assert.equal(
  digest(contract),
  "d496f0713313e5a3e1f14a75067efaee5751729a5242f20bdcae213249442772",
  "The original acceptance contract must remain unchanged",
);
let section = "";
const rows = new Map();
for (const line of contract.split("\n")) {
  if (line.startsWith("### ")) section = line.slice(4);
  if (!line.startsWith("| SE-")) continue;
  const [id, priority, precondition, action, expected, automation] = line
    .split("|")
    .slice(1, -1)
    .map((x) => x.trim());
  rows.set(id, {
    id,
    section,
    precondition,
    action,
    expected,
    priority,
    automation,
    status: "UNVERIFIED",
    evidence: [],
    seed: 20261103,
    environment: null,
    build_sha: null,
    duration_ms: null,
    checks: [],
    owner: "SOCIAL ENGINE QA",
    retry:
      "Run the unchanged original criterion on an immutable candidate and retain its source/asset hashes.",
  });
}
assert.equal(rows.size, 60);
const evidencePaths = new Set();
function add(numbers, status, path, reason, data = {}) {
  evidencePaths.add(path);
  for (const n of numbers) {
    const row = rows.get(`SE-${String(n).padStart(3, "0")}`);
    row.checks.push({ status, reason, evidence: root + path, ...data });
  }
}
const stateFor = (checks) =>
  !checks?.length
    ? "UNVERIFIED"
    : checks.some((c) => c.status === "FAIL")
      ? "FAIL"
      : checks.every((c) => c.status === "PASS")
        ? "PASS"
        : "UNVERIFIED";
const unit = await read("acceptance-unit.json");
let unitFresh = !!unit?.sourcesUnchanged && fresh(unit) && unit.sourceFiles?.length > 0;
for (const f of unit?.sourceFiles ?? [])
  if (digest(await readFile(f.path)) !== f.sha256) unitFresh = false;
for (const n of [
  6, 10, 11, 12, 15, 17, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 38, 39, 40,
]) {
  const id = `SE-${String(n).padStart(3, "0")}`;
  const checks = unit?.tests?.filter((t) => t.name.includes(id)) ?? [];
  add(
    [n],
    unitFresh && unit.status === "PASS" ? stateFor(checks) : "UNVERIFIED",
    "acceptance-unit.json",
    checks.length
      ? checks.map((c) => c.name).join("; ")
      : "No attributable current test matched this criterion.",
    {
      environment: unit?.environment,
      build_sha: unit?.build_sha,
      duration_ms: checks.reduce((n, c) => n + c.duration_ms, 0),
      scope: "Pure domain/property/fault tests; no human-play or browser-performance claim.",
    },
  );
}
for (const [engine, compatibilityId] of [
  ["chromium", 52],
  ["firefox", 53],
  ["webkit", 54],
]) {
  const path = `browser-${engine}/results.json`,
    d = await read(path);
  const status = fresh(d)
    ? d.errors?.length || d.failure
      ? "FAIL"
      : stateFor(d.results)
    : "UNVERIFIED";
  add(
    [compatibilityId],
    status,
    path,
    `Real ${engine} critical gameplay flow; current served manifest required.`,
    {
      environment: { browser: d?.browser, base: d?.base },
      duration_ms: d?.results?.reduce((n, r) => n + (r.duration_ms ?? 0), 0),
    },
  );
  if (engine !== "chromium") continue;
  for (const n of [1, 2, 4, 5, 7, 9, 13, 14, 16, 19, 22, 29, 30, 31, 33, 35, 40, 55, 57]) {
    const checks =
      d?.results?.filter((r) =>
        (r.id.match(/SE-\d+/g) ?? []).includes(`SE-${String(n).padStart(3, "0")}`),
      ) ?? [];
    add(
      [n],
      fresh(d) ? stateFor(checks) : "UNVERIFIED",
      path,
      checks.map((c) => c.name).join("; ") || "Current browser evidence missing.",
      {
        scope:
          "Actual DOM/canvas; explicit QA fixed steps accelerate bounded fixtures, never human playtime.",
      },
    );
  }
}
const ui = await read("ui-browser/results.json");
for (const [n, text] of [
  [3, "double submit"],
  [6, "invalid profile names"],
  [42, "real save menu"],
]) {
  const checks = ui?.results?.filter((c) => c.name.includes(text)) ?? [];
  add(
    [n],
    fresh(ui) ? stateFor(checks) : "UNVERIFIED",
    "ui-browser/results.json",
    checks.map((c) => c.name).join("; ") || "Current UI evidence missing.",
    { environment: { browser: ui?.browser } },
  );
}
const focus = await read("browser-evidence/results.json");
for (const n of [8, 18, 33, 55]) {
  const checks = focus?.results?.filter((c) => c.id === `SE-${String(n).padStart(3, "0")}`) ?? [];
  add(
    [n],
    fresh(focus) ? stateFor(checks) : "UNVERIFIED",
    "browser-evidence/results.json",
    checks.map((c) => c.name).join("; ") || "Current focused browser evidence missing.",
  );
}
const probe = (
  await build({
    stdin: {
      contents:
        "export * from './src/games/social-engine/persistence/index.ts'; export {createWorld,canonicalState,stepWorld,applyCommand} from './src/games/social-engine/simulation/engine.ts';",
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
  })
).outputFiles[0].text;
const storage = await read("persistence-browser/results.json");
const storageFresh = storage?.bundle_sha256 === digest(probe);
for (const [n, patterns] of [
  [41, ["closing a tab during an active write"]],
  [42, ["export/import/copy/delete"]],
  [43, ["authentic v2", "authentic v3", "migration is atomic"]],
  [44, ["migration is atomic"]],
]) {
  const checks = storage?.checks?.filter((c) => patterns.some((p) => c.name.includes(p))) ?? [];
  add(
    [n],
    storageFresh ? stateFor(checks) : "UNVERIFIED",
    "persistence-browser/results.json",
    checks.map((c) => c.name).join("; ") || "Current IndexedDB evidence missing.",
    {
      environment: { browser: storage?.browser, probeSha256: storage?.bundle_sha256 },
      scope:
        "Real browser IndexedDB with explicit corruption, quota, abort and frozen migration fixtures.",
    },
  );
}
const features = await read("v4-browser/results.json");
const latestMigration =
  unit?.tests?.filter((t) => t.name.includes("authentic schema4 migration")) ?? [];
add(
  [43],
  unitFresh ? stateFor(latestMigration) : "UNVERIFIED",
  "acceptance-unit.json",
  "The frozen authentic schema4 save also migrates to schema6 with finance, ownership and histories preserved.",
);
for (const filename of [
  "persistence-browser",
  "persistence-browser-firefox",
  "persistence-browser-webkit",
]) {
  const path = filename + "/results.json",
    d = await read(path);
  const checks =
    d?.checks?.filter((c) => c.name.includes("authentic schema5 snapshot and nonempty journal")) ??
    [];
  add(
    [43],
    d?.bundle_sha256 === digest(probe) && checks.length === 1 ? stateFor(checks) : "UNVERIFIED",
    path,
    "An authentic compressed v5 snapshot and a nonempty command journal must both survive the upgrade to v6.",
  );
}
add(
  [45],
  fresh(features) ? stateFor(features.results.filter((r) => r.id === "SE-045")) : "UNVERIFIED",
  "v4-browser/results.json",
  "Actual legacy TC SIM save creation, SE save, byte-preserved legacy keys and legacy reload.",
);
const sim = await read("simulation-365/results.json");
let simFresh = false;
if (sim?.environment?.sourceFiles?.length) {
  const h = createHash("sha256");
  for (const f of sim.environment.sourceFiles) h.update(f).update(await readFile(f));
  simFresh = h.digest("hex") === sim.environment.sourceSha256;
}
const simStatus =
  simFresh && sim?.status === "FAIL"
    ? "FAIL"
    : simFresh &&
        sim?.status === "PASS" &&
        sim.simulatedDays === 365 &&
        sim.zeroInvariantViolations === true &&
        sim.unexplainedMoneyDifference === 0 &&
        sim.finalHash === sim.replayHash &&
        sim.finalHash === sim.resumedHash
      ? "PASS"
      : "UNVERIFIED";
add(
  [37, 46, 47, 48],
  simStatus,
  "simulation-365/results.json",
  simStatus === "PASS"
    ? `365days /5256000ticks; primary, replay and day180 resume hash ${sim.finalHash}; zero unexplained money difference.`
    : `Current365day evidence incomplete or invalid (${sim?.status ?? "missing"}, completedDays=${sim?.completedDays ?? "unknown"}).`,
  {
    environment: sim?.environment,
    build_sha: sim?.environment?.build_sha,
    duration_ms: sim?.elapsedMs,
    scope: "Pure fixed-step simulation; not renderer or human playtime.",
  },
);
const axe = await read("axe/results.json");
add(
  [56],
  fresh(axe) && axe?.status === "PASS"
    ? "PASS"
    : fresh(axe) && axe?.status === "FAIL"
      ? "FAIL"
      : "UNVERIFIED",
  "axe/results.json",
  "Actual keyboard focus/trap/restore checks and Axe scans. Incomplete canvas/contrast scans are disclosed, not full WCAG certification.",
  { scope: axe?.limitations },
);
const latest = await read("performance/latest.json");
let perf = null,
  perfPath = "performance/latest.json";
if (latest?.runId) {
  perfPath = `performance/${latest.runId}/report.json`;
  perf = await read(perfPath);
}
add(
  [49],
  "UNVERIFIED",
  perfPath,
  "The Apple M2 host is not the specified four-core reference PC. Its measured frame times cannot satisfy this precondition.",
);
for (const [n, minutes, field] of [
  [50, 60, "longTaskRatioAtMost5Percent"],
  [51, 120, "heapSlopeAtMost1MiBPerMinute"],
]) {
  const checkpoint = perf?.checkpoints?.find(
    (c) =>
      c.minute === minutes ||
      c.targetMinutes === minutes ||
      c.minutes === minutes ||
      c.thresholdMinutes === minutes,
  );
  const result = checkpoint?.measuredThresholds?.[field];
  const coverage = assessSoakCoverage(perf, minutes);
  add(
    [n],
    fresh(perf) &&
      checkpoint &&
      checkpoint.elapsedMs >= minutes * 60000 &&
      coverage.status === "VERIFIED" &&
      checkpoint.errors === 0 &&
      (n !== 51 || Number.isFinite(checkpoint.workerHeapSlopeMiBPerMinute)) &&
      typeof result === "boolean"
      ? result
        ? "PASS"
        : "FAIL"
      : "UNVERIFIED",
    perfPath,
    `${minutes} continuous minutes required; fixed-tick cross-check: ${coverage.status}. Current run: ${perf?.status ?? "missing"}.`,
    {
      environment: perf?.environment,
      coverage,
      scope:
        "Measured real-time browser workload with concurrent local tests; not reference-hardware or human playtest evidence.",
    },
  );
}
for (const n of [58, 59, 60])
  add(
    [n],
    "UNVERIFIED",
    "deployment-verification.json",
    "No remote PR/CI/provider/live proof. User requested local commits and explicitly locked merge and production.",
  );
for (const row of rows.values()) {
  row.status = stateFor(row.checks);
  row.evidence = [...new Set(row.checks.map((c) => c.evidence))];
  row.reason = row.checks.map((c) => c.reason).join(" | ") || "No current attributable evidence.";
  row.environment = row.checks.map((c) => c.environment).filter(Boolean);
  row.build_sha =
    row.checks.find((c) => c.build_sha)?.build_sha ??
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  row.duration_ms = row.checks.reduce((sum, c) => sum + (c.duration_ms ?? 0), 0) || null;
}
const engineProbe = (
  await build({
    entryPoints: ["src/games/social-engine/simulation/engine.ts"],
    bundle: true,
    format: "iife",
    globalName: "SESimulation",
    write: false,
    target: "es2022",
  })
).outputFiles[0].text;
const parity = await read("browser-determinism/results.json");
const parityStatus =
  parity?.bundleSha256 === digest(engineProbe) &&
  parity.days === 365 &&
  parity.results?.length === 3
    ? stateFor(parity.results)
    : "UNVERIFIED";
evidencePaths.add("browser-determinism/results.json");
const required = {
  isolated_unit_sources: unitFresh ? unit.status : "UNVERIFIED",
  cross_engine_365days: parityStatus,
  two_human_30_minute_sessions: "UNVERIFIED",
  reference_PC: "UNVERIFIED",
  low_end_physical_hardware: "UNVERIFIED",
  merge_authorization: "SUSPENDED_BY_USER",
  remote_PR_CI: "UNVERIFIED",
  provider_ID_SHA_live_smoke: "UNVERIFIED",
  rollback_trial: "UNVERIFIED",
};
const osEvidence = await footprintEvidence(digest(manifestBytes));
const currentFootprints = osEvidence.samples;
required.measured_process_footprint_600MiB = stateFor(
  currentFootprints.map((s) => ({ status: s.thresholdStatus })),
);
for (const path of osEvidence.paths) evidencePaths.add(path);
const rendererLife = await read("renderer-lifecycle/results.json");
required.renderer_resource_teardown =
  rendererLife?.rendererSourceSha256 ===
  digest(await readFile("src/games/social-engine/rendering/renderer.ts"))
    ? rendererLife.status
    : "UNVERIFIED";
evidencePaths.add("renderer-lifecycle/results.json");
// Contract obligations outside the original60 rows remain visible, never silently waived.
for (const [key, path] of [
  ["journal_recovery", "journal-browser/results.json"],
  ["integrated_lifecycle_mobility_social", "v4-browser/results.json"],
  ["asset_fault_recovery", "asset-faults/results.json"],
  ["local_real_worker_route", "route-browser/results.json"],
  ["bundle_and_cold_network", "startup-network/results.json"],
]) {
  const d = await read(path);
  required[key] = fresh(d) ? (d.status ?? stateFor(d.results ?? d.checks)) : "UNVERIFIED";
  evidencePaths.add(path);
}
for (const engine of ["firefox", "webkit"]) {
  const path = `persistence-browser-${engine}/results.json`,
    d = await read(path);
  required[`indexedDB_${engine}`] =
    d?.bundle_sha256 === digest(probe) ? stateFor(d.checks) : "UNVERIFIED";
  evidencePaths.add(path);
}
const theftUnits = unit?.tests?.filter((t) => t.name.startsWith("C08:")) ?? [];
required.stolen_stock_unit_invariants =
  unitFresh && theftUnits.length >= 4 ? stateFor(theftUnits) : "UNVERIFIED";
for (const engine of ["chromium", "firefox", "webkit"]) {
  const path = "property-browser-" + engine + "/results.json",
    d = await read(path);
  required["stolen_stock_and_restitution_" + engine] =
    fresh(d) && d?.browser === engine && d?.checks?.length === 4 && d?.errors?.length === 0
      ? d.status
      : fresh(d) && d.status === "FAIL"
        ? "FAIL"
        : "UNVERIFIED";
  evidencePaths.add(path);
}
for (const engine of ["chromium", "firefox", "webkit"]) {
  const path = "cold-start-" + engine + "/results.json",
    d = await read(path);
  required["cold_start_character_" + engine] =
    fresh(d) &&
    d?.engine === engine &&
    d.status === "PASS" &&
    d.checks?.length === 2 &&
    d.errors?.length === 0
      ? "PASS"
      : fresh(d) && d.status === "FAIL"
        ? "FAIL"
        : "UNVERIFIED";
  evidencePaths.add(path);
}
const nativeRepeats = await read("native-browser/stable-repeats/summary.json");
required.native_zoom_and_background =
  nativeRepeats?.runs?.length === 3 &&
  nativeRepeats.runs.every((r) => manifestHashes.has(r.manifestSha256))
    ? stateFor(nativeRepeats.runs)
    : "UNVERIFIED";
evidencePaths.add("native-browser/stable-repeats/summary.json");
const capacity = await read("capacity-10000/results.json"),
  capacitySource = createHash("sha256");
for (const dir of ["domain", "simulation"])
  for (const f of (await readdir(`src/games/social-engine/${dir}`))
    .filter((f) => f.endsWith(".ts"))
    .sort()) {
    const p = `src/games/social-engine/${dir}/${f}`;
    capacitySource.update(p).update(await readFile(p));
  }
required.synthetic_10000_citizens =
  capacity?.sourceSha256 === capacitySource.digest("hex") &&
  capacity.population === 10000 &&
  capacity.actualTicks >= 28800
    ? capacity.status
    : "UNVERIFIED";
evidencePaths.add("capacity-10000/results.json");
const eventCoverage = await read("event-reachability/results.json"),
  eventSource = createHash("sha256");
for (const p of eventCoverage?.sourceFiles ?? []) eventSource.update(p).update(await readFile(p));
required.twenty_event_branches =
  eventCoverage?.sourceFiles?.length &&
  eventCoverage.sourceSha256 === eventSource.digest("hex") &&
  eventCoverage.missing?.length === 0
    ? eventCoverage.status
    : "UNVERIFIED";
evidencePaths.add("event-reachability/results.json");
const late = await read("late-save/results.json");
const lateProbe = (
  await build({
    stdin: {
      contents:
        "export * from './src/games/social-engine/persistence/index.ts'; export {canonicalState} from './src/games/social-engine/simulation/engine.ts';",
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
  })
).outputFiles[0].text;
required.late_save_20_roundtrips_three_engines =
  late?.probeSha256 === digest(lateProbe) &&
  late.sampleCount >= 20 &&
  late.cases?.length === 3 &&
  late.fixtureSha256 === sim?.days?.find((d) => d.day === 180)?.hash
    ? stateFor([
        { status: late.saveIntegrityStatus },
        { status: late.latencyStatus },
        ...late.cases,
      ])
    : "UNVERIFIED";
evidencePaths.add("late-save/results.json");
// Keep same-code late-save failures visible when a quieter repeat is added.
const loadedHistory = await read("c5-history/late-save-concurrent-20x3.json");
if (
  loadedHistory?.probeSha256 === digest(lateProbe) &&
  loadedHistory?.capturedFileSha256 === late?.capturedFileSha256 &&
  loadedHistory.sampleCount >= 20
) {
  required.late_save_under_concurrent_load = loadedHistory.status;
  evidencePaths.add("c5-history/late-save-concurrent-20x3.json");
}
// Hardware and software renderers are different environments. Keep the observed
// same-candidate failures under concurrent software rasterization visible.
for (const [label, path] of [
  ["software_raster_parallel_combat_social", "c5-history/v4-software-raster-under-load.json"],
  ["software_raster_parallel_autosave", "c5-history/journal-software-raster-under-load.json"],
]) {
  const r = await read(path);
  required[label] = fresh(r) ? stateFor(r.results) : "UNVERIFIED";
  evidencePaths.add(path);
}
const legacyPath = "legacy-browser/final-local/summary.json";
const legacyIntegration = await read(legacyPath);
let legacyFresh = fresh(legacyIntegration) && !!legacyIntegration.evidence;
for (const [record, sha] of Object.entries(legacyIntegration?.evidence ?? {})) {
  if (digest(await readFile(root + "legacy-browser/final-local/" + record)) !== sha)
    legacyFresh = false;
}
required.unchanged_game_browser_regressions = legacyFresh ? legacyIntegration.status : "UNVERIFIED";
evidencePaths.add(legacyPath);
const regression = await read("baseline/frozen-full-regression.json");
required.full_repository_regression =
  regression?.sourcesUnchanged && fresh(regression) ? regression.status : "UNVERIFIED";
evidencePaths.add("baseline/frozen-full-regression.json");
const gaps = await read("contract-gap-audit.json");
let gapsFresh =
  gaps?.runtimeManifestSha256 === digest(manifestBytes) &&
  Object.keys(gaps.sourceHashes ?? {}).length > 0;
for (const [path, hash] of Object.entries(gaps?.sourceHashes ?? {})) {
  if (digest(await readFile(path)) !== hash) gapsFresh = false;
}
required.remaining_contract_obligations = gapsFresh ? stateFor(gaps.requirements) : "UNVERIFIED";
evidencePaths.add("contract-gap-audit.json");
const evidenceManifest = [];
for (const p of evidencePaths) {
  try {
    const bytes = await readFile(root + p);
    evidenceManifest.push({ path: root + p, sha256: digest(bytes) });
  } catch {
    // Missing evidence stays UNVERIFIED and has no fabricated hash.
  }
}
const results = [...rows.values()];
const report = {
  product: "SOCIAL ENGINE",
  schemaVersion: 2,
  evaluatedAt: new Date().toISOString(),
  source: "docs/social-engine/ACCEPTANCE_TESTS.md",
  source_sha256: digest(contract),
  criteria_modified: false,
  release_decision: "BLOCKED",
  production_status: "PRODUCTION_NOT_DEPLOYED",
  branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
  currentLocalCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  runtimeManifestSha256: digest(manifestBytes),
  sourceDigest: manifest.sourceDigest,
  counts: Object.fromEntries(
    ["PASS", "FAIL", "SKIP", "UNVERIFIED"].map((s) => [
      s,
      results.filter((r) => r.status === s).length,
    ]),
  ),
  blocking_ids: results.filter((r) => r.status !== "PASS").map((r) => r.id),
  required_evidence_status: required,
  blocking_additional_gates: Object.entries(required)
    .filter(([, status]) => status !== "PASS")
    .map(([key]) => key),
  results,
  evidence_manifest: evidenceManifest,
  note: "All original60criteria retained verbatim. PASS requires evidence for the current source or exact served assets. Missing/stale/interrupted evidence is never PASS. This audit cannot authorize deployment.",
};
await mkdir(root, { recursive: true });
await writeFile(root + "results.json", JSON.stringify(report, null, 2) + "\n");
const lines = [
  "# SOCIAL ENGINE acceptance evidence",
  "",
  `Local commit: ${report.currentLocalCommit}. Runtime manifest: ${report.runtimeManifestSha256}.`,
  "",
  "Decision: **BLOCKED — PRODUCTION_NOT_DEPLOYED**. Human tests wait at the user's request. Merge/production remain locked.",
  "",
];
for (const status of ["PASS", "FAIL", "SKIP", "UNVERIFIED"]) {
  lines.push(
    `## ${status} (${report.counts[status]})`,
    "",
    "| ID | Priority | Criterion | Evidence / reason |",
    "|---|---|---|---|",
  );
  for (const r of results.filter((r) => r.status === status))
    lines.push(
      `| ${r.id} | ${r.priority} | ${r.action} → ${r.expected} | ${r.evidence.join("; ")} — ${r.reason.replaceAll("|", "/")} |`,
    );
  lines.push("");
}
lines.push(
  "Full source identities, scopes, durations, environment and required evidence are in artifacts/social-engine/results.json.",
);
await writeFile("docs/social-engine/ACCEPTANCE_MATRIX.md", lines.join("\n") + "\n");
console.log(JSON.stringify({ counts: report.counts, blocking_ids: report.blocking_ids, required }));
