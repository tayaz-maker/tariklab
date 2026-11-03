import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus, loadavg, platform, release, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { migrateState } from "../public/games/tc-sim-boardworld/engine.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";

// Run --check while other checks are active. Run the timed benchmark separately
// on an otherwise idle machine: node --expose-gc scripts/boardworld-v6-save-benchmark.mjs --out result.json
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  fixtureDir = join(root, "scripts/fixtures/boardworld"),
  provenance = JSON.parse(readFileSync(join(fixtureDir, "v5-provenance.json"), "utf8")),
  onlyCheck = process.argv.includes("--check"),
  outputIndex = process.argv.indexOf("--out"),
  output = outputIndex >= 0 ? process.argv[outputIndex + 1] : null,
  iterations = 10,
  repeats = 3,
  hash = (bytes) => createHash("sha256").update(bytes).digest("hex"),
  git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(),
  runtimePath = "public/games/tc-sim-boardworld/",
  baseline = mkdtempSync(join(tmpdir(), "boardworld-v5-save-benchmark-"));
assert.ok(outputIndex < 0 || output, "--out requires a filename");

function statistics(samples) {
  const sorted = samples.slice().sort((a, b) => a - b);
  return {
    samples: samples.length,
    medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    minMs: sorted[0],
    maxMs: sorted.at(-1),
  };
}

try {
  // The released persistence writer must use its released dependency graph,
  // rather than silently benchmarking old writer code with new validators.
  const archive = execFileSync("git", ["archive", provenance.sourceCommit, runtimePath], {
    cwd: root,
    maxBuffer: 16 * 1024 * 1024,
  });
  execFileSync("tar", ["-x", "-C", baseline], { input: archive });
  for (const [path, expected] of Object.entries(provenance.sourceFiles))
    if (path.startsWith(runtimePath))
      assert.equal(hash(readFileSync(join(baseline, path))), expected, path);
  const old = await import(pathToFileURL(join(baseline, runtimePath, "persistence.mjs")));
  const fixtures = provenance.fixtures.filter((f) => f.day === 366);
  assert.equal(fixtures.length, 6, "six authentic mature released saves are required");
  const report = {
    kind: "paired-authentic-v5-v6-save-codec",
    generatedAt: new Date().toISOString(),
    timing: !onlyCheck,
    methodology:
      "The same six authentic released day366 states, unchanged except schema version. Exact released v5 module graph versus current v6 graph. Three timed repeats of ten exports/imports per state, alternating version order. Three warmups per operation. GC before each timed batch when --expose-gc is supplied. Assertions and gzip are outside timed intervals. This isolates persistence cost; it is not new-v6 endurance or browser interaction latency.",
    baselineCommit: provenance.sourceCommit,
    currentCommit: git("rev-parse", "HEAD"),
    runtimeChanges: git("status", "--porcelain", "--", runtimePath),
    runtimeSha256: Object.fromEntries(
      ["engine.mjs", "persistence.mjs", "save-codec.mjs", "world-life.mjs"].map((name) => [
        name,
        hash(readFileSync(join(root, runtimePath, name))),
      ]),
    ),
    environment: {
      node: process.version,
      platform: platform(),
      release: release(),
      architecture: process.arch,
      cpu: cpus()[0]?.model || "unknown",
      logicalCpus: cpus().length,
      explicitGc: typeof globalThis.gc === "function",
      loadBefore: loadavg(),
    },
    repeats: onlyCheck ? 0 : repeats,
    iterationsPerRepeat: onlyCheck ? 0 : iterations,
    fixtures: [],
  };
  for (const fixture of fixtures) {
    const originalBytes = readFileSync(join(fixtureDir, fixture.file), "utf8");
    assert.equal(hash(originalBytes), fixture.sha256, fixture.file);
    const original = JSON.parse(JSON.parse(originalBytes).payload),
      originalSnapshot = structuredClone(original),
      current = migrateState(original),
      legacyBytes = old.exportGame(original),
      currentBytes = exportGame(current);
    assert.equal(legacyBytes, originalBytes.trim());
    assert.deepEqual({ ...current, version: 5 }, original);
    assert.deepEqual(old.importGame(legacyBytes).state, original);
    assert.deepEqual(importGame(currentBytes).state, current);
    const row = {
      file: fixture.file,
      fixtureSha256: fixture.sha256,
      day: fixture.day,
      revision: original.revision,
      originalFixtureBytes: Buffer.byteLength(originalBytes),
      v5: {
        serializedBytes: Buffer.byteLength(legacyBytes),
        storageUtf16Bytes: legacyBytes.length * 2,
        gzip9Bytes: gzipSync(legacyBytes, { level: 9 }).length,
      },
      v6: {
        serializedBytes: Buffer.byteLength(currentBytes),
        storageUtf16Bytes: currentBytes.length * 2,
        gzip9Bytes: gzipSync(currentBytes, { level: 9 }).length,
      },
      roundTripExact: true,
    };
    if (!onlyCheck) {
      const tasks = [
        ["v5", "export", () => old.exportGame(original)],
        ["v5", "import", () => old.importGame(legacyBytes)],
        ["v6", "export", () => exportGame(current)],
        ["v6", "import", () => importGame(currentBytes)],
      ];
      const samples = Object.fromEntries(tasks.map(([v, operation]) => [`${v}.${operation}`, []]));
      row.trials = [];
      for (const [, , run] of tasks) for (let warmup = 0; warmup < 3; warmup++) run();
      for (let repeat = 0; repeat < repeats; repeat++) {
        const trial = { repeat: repeat + 1, operations: {} };
        for (const [version, operation, run] of repeat % 2 ? tasks.slice().reverse() : tasks) {
          globalThis.gc?.();
          const measured = [];
          for (let i = 0; i < iterations; i++) {
            const started = performance.now();
            const result = run();
            measured.push(performance.now() - started);
            if (operation === "import")
              assert.deepEqual(result.state, version === "v5" ? original : current);
            else assert.equal(result, version === "v5" ? legacyBytes : currentBytes);
          }
          samples[`${version}.${operation}`].push(...measured);
          trial.operations[`${version}.${operation}`] = statistics(measured);
        }
        row.trials.push(trial);
      }
      for (const version of ["v5", "v6"])
        row[version].timing = Object.fromEntries(
          ["export", "import"].map((operation) => [
            operation,
            statistics(samples[`${version}.${operation}`]),
          ]),
        );
    }
    assert.deepEqual(original, originalSnapshot, "benchmark never mutates authentic originals");
    report.fixtures.push(row);
  }
  report.environment.loadAfter = loadavg();
  const serialized = JSON.stringify(report, null, 2) + "\n";
  if (output) writeFileSync(resolve(output), serialized);
  else process.stdout.write(serialized);
  if (output)
    console.log(
      `${report.fixtures.length} exact paired saves; ${onlyCheck ? "untimed" : "3×10 timed"}; ${resolve(output)}`,
    );
} finally {
  rmSync(baseline, { recursive: true, force: true });
}
