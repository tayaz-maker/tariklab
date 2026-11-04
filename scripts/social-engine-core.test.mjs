import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("SOCIAL ENGINE domain, simulation, navigation, assets and adversarial suites really execute", (t) => {
  const directory = "src/games/social-engine/tests";
  const files = readdirSync(directory)
    .filter(
      (file) =>
        file.endsWith(".test.ts") &&
        ![
          "life.test.ts",
          "life-family.test.ts",
          "persistence.test.ts",
          "persistence-journal.test.ts",
        ].includes(file),
    )
    .sort();
  for (const required of [
    "adversarial.test.ts",
    "economy.test.ts",
    "services.test.ts",
    "ledger-sparse.test.ts",
    "record-snapshot.test.ts",
    "live-journal.test.ts",
    "save-queue.test.ts",
    "recovery.test.ts",
    "mobility.test.ts",
    "traffic.test.ts",
    "justice.test.ts",
    "social.test.ts",
    "progression.test.ts",
    "worker.test.ts",
    "local-endpoint.test.ts",
    "quest-faults.test.ts",
    "world-camera.test.ts",
    "simulation-careers.test.ts",
    "simulation-events.test.ts",
    "simulation.test.ts",
    "world-assets.test.ts",
    "world-interpolation.test.ts",
    "world.test.ts",
  ])
    assert.ok(files.includes(required), `Required test file missing: ${required}`);
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--test-reporter=tap",
      "--test",
      ...files.map((file) => `${directory}/${file}`),
    ],
    { env, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  const count = Number(run.stdout.match(/# tests (\d+)/)?.[1] ?? 0);
  assert.ok(
    count >= 110,
    `Expected at least 110 real test cases, received ${count}\n${run.stdout}`,
  );
  t.diagnostic(
    `${count} real domain, gameplay, worker and renderer cases executed; lifecycle/persistence run in their dedicated wrappers.`,
  );
  assert.match(run.stdout, /# fail 0/);
  assert.match(run.stdout, /# skipped 0/);
  assert.match(run.stdout, /# cancelled 0/);
});
