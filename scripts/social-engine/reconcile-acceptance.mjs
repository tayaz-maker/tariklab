/** Evidence-only release audit. Never deploys, changes a criterion, or treats missing evidence as PASS. */
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { resolve } from "node:path";
import { assessSoakCoverage } from "./soak-coverage.mjs";
import { footprintEvidence } from "./footprint-evidence.mjs";
const root = "artifacts/social-engine/";
const digest = (b) => createHash("sha256").update(b).digest("hex");
const manifestBytes = await readFile("public/games/social-engine/build-manifest.json");
const manifest = JSON.parse(manifestBytes),
  runtimeHash = digest(manifestBytes);
const rawIndex = await readFile(root + "current-receipts/index.json", "utf8").catch(() => null);
const index = rawIndex ? JSON.parse(rawIndex) : null;
const receipts = index?.manifestSha256 === runtimeHash ? index.records : {};
const seen = new Map();
function evidencePath(key) {
  const entry = receipts[key];
  if (
    entry &&
    (!/^[a-f0-9]{64}$/.test(entry.sha256) ||
      entry.path !==
        "current-receipts/" + entry.sha256 + (key === "acceptance-unit.tap" ? ".tap" : ".json"))
  )
    throw Error("Invalid content-addressed receipt " + key);
  return root + (entry?.path ?? key);
}
const read = async (key) => {
  if (index?.manifestSha256 === runtimeHash && index.incomplete?.[key]) return null;
  let bytes;
  try {
    bytes = await readFile(evidencePath(key));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  const stored = receipts[key];
  if (
    stored &&
    (!/^current-receipts\/[a-f0-9]{64}\.json$/.test(stored.path) || digest(bytes) !== stored.sha256)
  )
    throw Error("Receipt integrity mismatch: " + key);
  const report = JSON.parse(bytes);
  seen.set(key, report);
  return report;
};
const manifestHashes = new Set([runtimeHash]);
const fresh = (d) =>
  !!d && (d.manifestSha256 ?? d.build?.manifestSha256 ?? d.manifest) === runtimeHash;
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
    seed: null,
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
  const observed = seen.get(path);
  if (
    status === "UNVERIFIED" &&
    !numbers.some((n) => [46, 47, 48, 49, 50, 51, 58, 59, 60].includes(n))
  ) {
    const hash = observed?.manifestSha256 ?? observed?.build?.manifestSha256;
    if (!observed) reason = "No completed attributable receipt for this check.";
    else if (hash && hash !== runtimeHash)
      reason = `Historical manifest ${hash.slice(0, 12)}. Current manifest ${runtimeHash.slice(0, 12)} remains unverified for this check.`;
    else if (path === "acceptance-unit.json")
      reason = "Current source-bound unit assertions were not verified for this criterion.";
  }
  for (const n of numbers) {
    const row = rows.get(`SE-${String(n).padStart(3, "0")}`);
    row.checks.push({ status, reason, receipt: path, evidence: evidencePath(path), ...data });
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
const tapBytes = await readFile(evidencePath("acceptance-unit.tap")).catch(() => Buffer.alloc(0));
const tap = tapBytes.toString("utf8");
const parsedTests = [
  ...tap.matchAll(/^(ok|not ok) \d+ - (.+)\n\s+---\n\s+duration_ms: ([\d.]+)/gm),
].map((match) => ({
  name: match[2],
  status: match[1] === "ok" ? "PASS" : "FAIL",
  duration_ms: Number(match[3]),
}));
const counts = Object.fromEntries(
  ["tests", "pass", "fail", "cancelled", "skipped", "todo"].map((name) => [
    name,
    Number(tap.match(new RegExp("^# " + name + " (\\d+)$", "m"))?.[1] ?? -1),
  ]),
);
let unitFresh =
  !!unit?.sourcesUnchanged &&
  fresh(unit) &&
  !!unit.finishedAt &&
  Number.isInteger(unit.exitCode) &&
  ((unit.status === "PASS" && unit.exitCode === 0 && counts.fail === 0) ||
    (unit.status === "FAIL" && unit.exitCode !== 0 && counts.fail > 0)) &&
  unit.sourceFiles?.length > 0 &&
  digest(tapBytes) === unit.tapSha256 &&
  (!receipts["acceptance-unit.tap"] || receipts["acceptance-unit.tap"].sha256 === unit.tapSha256) &&
  counts.tests > 0 &&
  counts.pass + counts.fail === counts.tests &&
  counts.pass === parsedTests.filter((test) => test.status === "PASS").length &&
  counts.tests === parsedTests.length &&
  ["skipped", "cancelled", "todo"].every((k) => counts[k] === 0) &&
  isDeepStrictEqual(unit.counts, counts) &&
  isDeepStrictEqual(unit.tests, parsedTests);
if (unitFresh) {
  const current = [];
  async function verifyTree(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = dir + "/" + entry.name;
      if (entry.isDirectory()) await verifyTree(path);
      else current.push({ path, sha256: digest(await readFile(path)) });
    }
  }
  await verifyTree("src/games/social-engine");
  const order = (a, b) => a.path.localeCompare(b.path);
  unitFresh = isDeepStrictEqual(current.sort(order), [...unit.sourceFiles].sort(order));
}
if (unitFresh) evidencePaths.add("acceptance-unit.tap");
// These case bindings refer to the assertions in each test body. A test label containing a row ID is insufficient.
const unitCases = {
  6: [
    "SE-002 SE-004 SE-005 SE-006: one canonical adult player, validated profile and point budget",
  ],
  10: ["SE-010 SE-012: fixed movement swept collision and world limits resist 10000 held inputs"],
  11: ["SE-011: obstructed target refuses movement and connected target follows valid path"],
  12: ["SE-010 SE-012: fixed movement swept collision and world limits resist 10000 held inputs"],
  15: [
    "SE-014 SE-015 SE-017: 100 repeated interior transitions preserve one player and exact door",
  ],
  17: [
    "shared-door departures retain one physical person and a persisted six-tick admission gap",
    "30-person doorway crowd clears without lockstep admissions or duplicate people",
  ],
  20: [
    "SE-020 SE-021: every occupation pays once, changes canonical employment, overlapping shifts rejected",
  ],
  21: ["SE-021-job-schedule: replacement employment owns the actual future shift clock and pay without stale prior bookings"],
  22: [
    "SE-022 SE-023: purchase atomically balances cash, stock and inventory; invalid and duplicate commands fail",
  ],
  23: [
    "SE-022 SE-023: purchase atomically balances cash, stock and inventory; invalid and duplicate commands fail",
  ],
  24: [
    "SE-024: principal, weekly interest and payment reconcile bank assets and player liabilities",
  ],
  25: ["SE-016 SE-018 SE-025 SE-027: proximity, cooldown, knowledge and social consequences"],
  26: [
    "SE-026 SE-038 SE-039 SE-040: canonical snapshot preserves relational/economic state and resumes identical ticks",
  ],
  27: [
    "SE-016 SE-018 SE-025 SE-027: proximity, cooldown, knowledge and social consequences",
    "SE-027 SE-029: unseen assault is not automatically known to police",
  ],
  28: ["SE-028-reputation-effects: earned reputation changes actual faction eligibility and survives save reload"],
  29: [
    "SE-028 SE-029 SE-030: witnessed assault produces delayed report, evidence, pursuit and exact fine",
    "SE-027 SE-029: unseen assault is not automatically known to police",
  ],
  30: [
    "SE-028 SE-029 SE-030: witnessed assault produces delayed report, evidence, pursuit and exact fine",
  ],
  31: [
    "SE-031: combat windup/cooldown/stamina and block are deterministic independent of render grouping",
  ],
  32: [
    "SE-032 SE-033: driven car and saved driver remain on directed lanes with collision spacing",
    "integrated engine follows canonical curves under strict invariants, including stationary headings",
  ],
  34: [
    "SE-034: at least one hundred generated missions across seeded worlds have reachable funded canonical targets",
  ],
  35: [
    "SE-034 SE-035 SE-036: funded causal missions, terminal timeout and exactly once reward survive compaction",
  ],
  36: [
    "SE-036 fault injection: a missing target reference times out with escrow and parcel returned once",
  ],
  37: ["SE-037 SE-038: 100000 actual ticks retain one location and balanced accounts"],
  38: ["SE-037 SE-038: 100000 actual ticks retain one location and balanced accounts"],
  39: [
    "SE-026 SE-038 SE-039 SE-040: canonical snapshot preserves relational/economic state and resumes identical ticks",
  ],
  40: [
    "SE-026 SE-038 SE-039 SE-040: canonical snapshot preserves relational/economic state and resumes identical ticks",
  ],
};
for (const n of [
  6, 10, 11, 12, 15, 17, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38, 39,
  40,
]) {
  const names = unitCases[n] ?? [];
  const checks = names
    .map((name) => parsedTests.find((test) => test.name === name))
    .filter(Boolean);
  add(
    [n],
    unitFresh && names.length > 0 && checks.length === names.length
      ? stateFor(checks)
      : "UNVERIFIED",
    "acceptance-unit.json",
    checks.map((c) => c.name).join("; ") || "Current named test assertions were not measured.",
    {
      environment: unit?.environment,
      build_sha: unit?.build_sha,
      duration_ms: checks.reduce((total, c) => total + c.duration_ms, 0),
      scope:
        "Pure domain/property/fault tests. Each credited assertion is present in the source-verified terminal TAP.",
      ...(unitFresh && checks.length
        ? { tapSha256: unit.tapSha256, tap: evidencePath("acceptance-unit.tap") }
        : {}),
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
  const basic = [
    "SE-001",
    "SE-005",
    "SE-002,SE-004",
    "SE-007-keyboard",
    "SE-016",
    "SE-007-click,SE-009",
    "SE-013,SE-022",
    "SE-019,SE-020",
    "SE-014",
    "SE-035",
    "SE-033",
    "SE-031,SE-029,SE-030",
    "SE-040,SE-055",
    "SE-057",
  ];
  const current =
    fresh(d) && d.engine === engine && Boolean(d.finished) && Array.isArray(d.results);
  const clean = current && Array.isArray(d.errors) && d.errors.length === 0 && !d.failure;
  const suite =
    clean && basic.every((id) => d.results.some((r) => r.id === id && r.status === "PASS"))
      ? "PASS"
      : "UNVERIFIED";
  add(
    [compatibilityId],
    suite,
    path,
    current
      ? `Local ${engine} ${d.browser}: ${d.results.length} recorded critical-flow cases, ${d.errors?.length ?? "unknown"} page errors.`
      : `No completed ${engine} suite matching the current manifest.`,
    {
      environment: { browser: d?.browser, base: d?.base },
      scope: "Isolated browser profile on the local candidate URL.",
    },
  );
  if (engine !== "chromium") continue;
  const criteria = [
    [1, ["SE-001"], "Fresh browser opened the character menu."],
    [2, ["SE-002,SE-004"], "New profile created the canonical player with 1,100 NPCs."],
    [4, ["SE-002,SE-004"], "Player name, background and appearance matched the selected values."],
    [5, ["SE-005"], "Invalid name produced a form error and kept character creation open."],
    [
      7,
      ["SE-007-keyboard", "SE-007-click,SE-009"],
      "Physical D moved screen-right and real canvas clicks arrived within 0.2 world units.",
    ],
    [
      9,
      ["SE-007-click,SE-009"],
      "Canvas destination matched inverse picking at both 1440×900 and 1280×720.",
    ],
    [13, ["SE-013,SE-022"], "Market entry succeeded and an interior purchase worked."],
    [
      14,
      ["SE-014"],
      "Exit returned the player outside within 0.1 world units of the expected door.",
    ],
    [16, ["SE-016"], "The nearby named NPC accepted the greeting and a social edge was present."],
    [
      19,
      ["SE-019,SE-020"],
      "The completed retail shift raised the player balance and produced one payroll entry.",
    ],
    [
      29,
      ["SE-031,SE-029,SE-030"],
      "Assault damaged the target, created a case and triggered a wanted state.",
    ],
    [30, ["SE-031,SE-029,SE-030"], "Surrender ended the active pursuit."],
    [35, ["SE-035"], "The second quest completion was rejected and cash stayed unchanged."],
    [57, ["SE-057"], "No horizontal document overflow across 1280, 1920 and 390 pixel viewports."],
  ];
  for (const [number, ids, description] of criteria) {
    const matches = ids.map((id) => d?.results?.find((r) => r.id === id));
    const observed = clean && matches.every((r) => r?.status === "PASS");
    add(
      [number],
      observed ? "PASS" : "UNVERIFIED",
      path,
      observed ? description : "Missing or incomplete current browser case: " + ids.join(" + "),
      {
        caseIds: ids,
        scope: "Local Chromium DOM/canvas and public commands with fixed-step QA advancement.",
      },
    );
  }
  for (const [number, tag, partial] of [
    [
      22,
      "SE-022-stock-cash",
      "Inventory and buyer cash changed, but store stock and exact cash reconciliation were not asserted.",
    ],
    [
      31,
      "SE-031-stamina-block",
      "Attack damage and block inputs were exercised, but stamina and the effect of defense were not asserted.",
    ],
    [
      33,
      "SE-033-exact-position",
      "Driver and scene survived reload, but saved vehicle coordinates and lane progress were not compared.",
    ],
    [
      55,
      "SE-055-dom-hud",
      "State fields were compared after load, but rendered HUD values were not checked.",
    ],
  ]) {
    const check = d?.results?.find(
      (r) => r.status === "PASS" && (r.id === tag || r.assertions?.includes(tag)),
    );
    add(
      [number],
      clean && check ? "PASS" : "UNVERIFIED",
      path,
      clean && check
        ? `Completed explicit browser assertion ${tag}.`
        : current
          ? partial
          : "No current matching browser assertion.",
      { assertion: tag },
    );
  }
}
const ui = await read("ui-browser/results.json");
const uiFresh =
  !!ui &&
  isDeepStrictEqual(ui.manifestAtStart, manifest) &&
  isDeepStrictEqual(ui.manifestAtEnd, manifest) &&
  Number.isFinite(Date.parse(ui.generatedAt)) &&
  ["PASS", "PASS_WITH_UNVERIFIED", "FAIL"].includes(ui.status) &&
  Array.isArray(ui.results);
for (const [n, name] of [
  [3, "double submit creates one persistent player and preserves chosen profile"],
  [6, "invalid profile names and excessive attribute total are rejected through real form"],
  [42, "real save menu saves copies exports imports and deletes separate slots"],
  [57, "1280 and 1920 viewports retain reachable readable dialog controls"],
]) {
  const checks = ui?.results?.filter((c) => c.name === name) ?? [];
  add(
    [n],
    uiFresh && checks.length === 1 ? stateFor(checks) : "UNVERIFIED",
    "ui-browser/results.json",
    checks.length ? name : "Current UI evidence missing.",
    { environment: { browser: ui?.browser }, duration_ms: checks[0]?.duration_ms },
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
        "export * from './src/games/social-engine/persistence/index.ts'; export {expectedTrafficMigration} from './src/games/social-engine/tests/traffic-migration-expectation.ts'; export {newJournalMeta,encodeJournal,decodeJournal} from './src/games/social-engine/persistence/journal.ts'; export {createWorld,canonicalState,stepWorld,applyCommand} from './src/games/social-engine/simulation/engine.ts';",
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
const storageFresh =
  storage?.bundle_sha256 === digest(probe) &&
  storage.status === "PASS" &&
  storage.consoleErrors?.length === 0;
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
    : `No completed current-source 365-day receipt. Historical results cannot complete this gate.`,
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
if (/^\d{4}-\d{2}-\d{2}T[\d-]+Z$/.test(latest?.runId ?? "")) {
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
    `${minutes} continuous minutes required; fixed-tick cross-check: ${coverage.status}. Receipt status: ${fresh(perf) ? perf.status : "no current completed measurement"}.`,
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
    "A local candidate or draft PR does not verify completed applicable CI, the production deployment identity, or a live game smoke test.",
  );
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
  // Operator authorization is not an executable quality test. See DEPLOYMENT_HOLD:
  // the owner permits this release only after every gate and the traffic lock pass.
  remote_PR_CI: "UNVERIFIED",
  provider_ID_SHA_live_smoke: "UNVERIFIED",
  rollback_trial: "UNVERIFIED",
};
for (const [key, name] of [
  [
    "headless_true_tab_visibility",
    "actual background tab visibility pauses and resumes authoritative time",
  ],
  ["native_200_percent_browser_zoom", "Native browser zoom 200%"],
  [
    "keyboard_menu_visible_focus",
    "keyboard-only pause and menu navigation keep visible focus and resume",
  ],
  [
    "ui_course_certificate_office_access",
    "earned course certificate enables office job application through real building menu",
  ],
]) {
  required[key] = uiFresh
    ? stateFor(ui.results.filter((result) => result.name === name))
    : "UNVERIFIED";
}
const osEvidence = await footprintEvidence(digest(manifestBytes));
const currentFootprints = osEvidence.samples;
required.measured_process_footprint_600MiB = stateFor(
  currentFootprints.map((s) => ({ status: s.thresholdStatus })),
);
for (const path of osEvidence.paths) evidencePaths.add(path);
const rendererLife = await read("renderer-lifecycle/results.json");
const rendererProbe = (
  await build({
    stdin: {
      contents:
        "export {createRenderer} from './src/games/social-engine/rendering/renderer.ts'; export {Cache} from './node_modules/pixi.js/lib/assets/cache/Cache.mjs'; export {createWorld,projectWorld} from './src/games/social-engine/simulation/engine.ts';",
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    format: "iife",
    globalName: "RendererLifecycle",
    target: "es2022",
    write: false,
    alias: { "pixi.js": resolve("scripts/social-engine/pixi-entry.mjs") },
    define: {
      SOCIAL_ATLAS_URL: JSON.stringify(
        "/games/social-engine/" +
          manifest.playableAssets.find((a) => a.file.endsWith(".json")).file,
      ),
    },
  })
).outputFiles[0].text;
required.renderer_resource_teardown =
  rendererLife?.probeSha256 === digest(rendererProbe) &&
  rendererLife.rendererSourceSha256 ===
    digest(await readFile("src/games/social-engine/rendering/renderer.ts")) &&
  !!rendererLife.finishedAt &&
  ["PASS", "FAIL"].includes(rendererLife.status)
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

const hostedPath = "native-browser/hosted-latest.json", hosted = await read(hostedPath);
const nativeHarnessHash = digest(await readFile("scripts/social-engine/native-browser.mjs"));
if (hosted?.trials?.length === 3 && /^[0-9a-f]{40}$/.test(hosted.remoteHead ?? "") &&
    /^https:\/\/github\.com\/tayaz-maker\/tariklab\/actions\/runs\/\d+\/job\/\d+$/.test(hosted.url ?? "") &&
    hosted.trials.every((r) => fresh(r) && r.harnessSha256 === nativeHarnessHash && r.finishedAt)) {
  evidencePaths.add(hostedPath);
  const gates = [
    ["native_200_percent_browser_zoom", "Native automatic browser zoom200% with real menu controls"],
    ["headless_true_tab_visibility", "Actual background tab visibility pauses and reactivation resumes authoritative tick"],
  ];
  for (const [key, name] of gates) {
    const statuses = hosted.trials.map((trial) => ({status:
      trial.status === "FAIL" || trial.errors?.length ? "FAIL" :
      trial.results?.find((row) => row.name === name)?.status ?? "UNVERIFIED"}));
    required[key] = stateFor(statuses);
  }
  required.native_zoom_and_background = stateFor(gates.map(([key]) => ({status:required[key]})));
}

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
        "export * from './src/games/social-engine/persistence/index.ts'; export {canonicalState,stepWorld} from './src/games/social-engine/simulation/engine.ts';",
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
  late.worldTick === 180 * 14400 &&
  late.ticksBetweenSaves === 5 &&
  /^[a-f0-9]{64}$/.test(late.finalExpectedHash) &&
  late.cases.every((c) => c.samples?.length >= 20)
    ? stateFor([
        { status: late.saveIntegrityStatus },
        { status: late.latencyStatus },
        ...late.cases,
      ])
    : "UNVERIFIED";
if (required.late_save_20_roundtrips_three_engines === "PASS") {
  add(
    [26, 39, 40],
    "PASS",
    "late-save/results.json",
    `Three browser engines each verified ${late.sampleCount} changing mature-world canonical hashes through IndexedDB save/load, covering the complete relation graph.`,
    {
      environment: {
        probeSha256: late.probeSha256,
        fixtureSha256: late.fixtureSha256,
        worldTick: late.worldTick,
      },
      scope:
        "Compiled persistence/simulation probe identity matched current source. This does not complete the year or browser gameplay suite.",
    },
  );
}
for (const [name, path] of [
  ["local_deployed_route", "upgrade/rules8-route/results.json"],
  ["local_worker_smoke", "upgrade/rules8-worker/results.json"],
  ["local_portable_smoke", "portable-smoke/results.json"],
  ["legacy_district_display", "upgrade/legacy-display/results.json"],
  ["retail_and_mechanic_work_orders", "upgrade/careers/results.json"],
]) {
  const d = await read(path);
  required[name] =
    fresh(d) && d?.status === "PASS" && (!d.errors || d.errors.length === 0)
      ? "PASS"
      : "UNVERIFIED";
  evidencePaths.add(path);
}
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
// Require actual software-renderer identity, matching runtime, and overlapping test windows.
const softwareRuns = await Promise.all(["v4-browser", "journal-browser"].map((k) => read("under-load/" + k + "/results.json")));
const concurrentSoftware = softwareRuns.every((r) => fresh(r) && /swiftshader|llvmpipe|software rasterizer/i.test(r.softwareRenderer ?? "") && Number.isFinite(Date.parse(r.finishedAt))) &&
  Math.min(...softwareRuns.map((r) => Date.parse(r.finishedAt))) > Math.max(...softwareRuns.map((r) => Date.parse(r.startedAt)));
for (const [i, label, kind, oldPath, count] of [
  [0, "software_raster_parallel_combat_social", "v4-browser", "c5-history/v4-software-raster-under-load.json", 11],
  [1, "software_raster_parallel_autosave", "journal-browser", "c5-history/journal-software-raster-under-load.json", 4],
]) {
  const path = "under-load/" + kind + "/results.json", r = softwareRuns[i];
  const older = await read(oldPath);
  const statuses = [];
  if (fresh(older)) statuses.push({status:stateFor(older.results)});
  if (concurrentSoftware && r.results?.length === count)
    statuses.push({status: r.errors?.length ? "FAIL" : stateFor(r.results)});
  required[label] = stateFor(statuses);
  evidencePaths.add(path); evidencePaths.add(oldPath);
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
for (const row of rows.values()) {
  row.status = row.checks.some((c) => c.status === "FAIL")
    ? "FAIL"
    : row.checks.some((c) => c.status === "PASS")
      ? "PASS"
      : "UNVERIFIED";
  const deciding =
    row.status === "UNVERIFIED" ? row.checks : row.checks.filter((c) => c.status === row.status);
  row.evidence = [...new Set(deciding.map((c) => c.evidence))];
  row.reason = deciding.map((c) => c.reason).join(" | ") || "No current attributable evidence.";
  row.environment = deciding.map((c) => c.environment).filter(Boolean);
  row.build_sha = deciding.find((c) => c.build_sha)?.build_sha ?? null;
  row.duration_ms = deciding.reduce((sum, c) => sum + (c.duration_ms ?? 0), 0) || null;
}
const legacyLocal = await read("local-legacy-suite/results.json");
if (
  receipts["local-legacy-suite/results.json"] &&
  ["TC SIM", "Boardworld", "Racon Manager"].every(
    (name) =>
      legacyLocal?.[name]?.exit === 0 &&
      legacyLocal[name].source === index.sourceCommit &&
      legacyLocal[name].target === "production build on loopback",
  )
) {
  required.unchanged_game_browser_regressions = "PASS";
  evidencePaths.add("local-legacy-suite/results.json");
}
const evidenceManifest = [];
for (const p of evidencePaths) {
  try {
    const bytes = await readFile(evidencePath(p));
    evidenceManifest.push({ path: evidencePath(p), sha256: digest(bytes), receipt: p });
  } catch {
    // Missing evidence stays UNVERIFIED and has no fabricated hash.
  }
}
const results = [...rows.values()];
for (const row of results.filter((r) => r.status === "PASS")) {
  assert.ok(
    row.checks.some((c) => c.status === "PASS"),
    row.id + ": no passing check",
  );
  assert.ok(
    row.evidence.length &&
      row.evidence.every((path) => evidenceManifest.some((e) => e.path === path)),
    row.id + ": missing evidence bytes",
  );
  assert.doesNotMatch(row.reason, /current browser evidence missing|no attributable current test/i);
}
const report = {
  product: "SOCIAL ENGINE",
  schemaVersion: 3,
  evaluatedAt: new Date().toISOString(),
  source: "docs/social-engine/ACCEPTANCE_TESTS.md",
  localScope:
    "Development checkout and locally served Worker or portable build. No CI or production promotion follows from this file.",
  observation_snapshot: index?.manifestSha256 === runtimeHash ? (index.observations ?? {}) : {},
  incomplete_runs: index?.manifestSha256 === runtimeHash ? (index.incomplete ?? {}) : {},
  source_sha256: digest(contract),
  criteria_modified: false,
  release_decision: "BLOCKED",
  production_status: "UNVERIFIED",
  branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
  currentLocalCommit:
    index?.manifestSha256 === runtimeHash
      ? index.sourceCommit
      : execFileSync(
          "git",
          ["log", "-1", "--format=%H", "--", "public/games/social-engine/build-manifest.json"],
          { encoding: "utf8" },
        ).trim(),
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
  `Tested runtime commit: ${report.currentLocalCommit}. Runtime manifest: ${report.runtimeManifestSha256}.`,
  "",
  "Decision: **BLOCKED**. These results cover the local candidate. Human sessions, physical reference hardware, production identity and live smoke require separate evidence.",
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
      `| ${r.id} | ${r.priority} | ${r.action} → ${r.expected} | ${r.evidence.map((path) => `[${(r.checks.find((c) => c.evidence === path)?.receipt ?? path).replace("/results.json", "")}](../../${path})`).join(", ")} — ${r.reason.replaceAll("|", "/")} |`,
    );
  lines.push("");
}
lines.push(
  "The JSON matrix preserves the original preconditions, actions, expected outcomes, priorities and automation fields. Each completion points to a receipt with a SHA-256 digest. [Machine-readable matrix](../../artifacts/social-engine/results.json) · [Receipt index](../../artifacts/social-engine/current-receipts/index.json)",
  "",
  "## Other release gates",
  "",
  ...Object.entries(required).map(([gate, status]) => `- ${gate}: ${status}`),
  "",
  "Refresh the evidence from completed local runs with `node scripts/social-engine/refresh-acceptance-receipts.mjs --candidate <tested-checkout> --checks <cases-directory> --legacy <legacy-results.json>`, then run `node scripts/social-engine/reconcile-acceptance.mjs`. Both commands run from the audit checkout. The refresher checks source or manifest identity and records the original evidence bytes.",
);
await writeFile("docs/social-engine/ACCEPTANCE_MATRIX.md", lines.join("\n") + "\n");
console.log(JSON.stringify({ counts: report.counts, blocking_ids: report.blocking_ids, required }));
