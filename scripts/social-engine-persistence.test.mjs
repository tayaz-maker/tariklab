import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
test("SOCIAL ENGINE persistence codec and frozen migration fixture", () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--test-reporter=tap",
      "--test",
      "src/games/social-engine/tests/persistence.test.ts",
      "src/games/social-engine/tests/persistence-journal.test.ts",
    ],
    { env, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /# tests [1-9][0-9]*/, "Nested persistence tests must actually execute");
  assert.match(run.stdout, /# fail 0/);
  assert.match(run.stdout, /# skipped 0/);
});
