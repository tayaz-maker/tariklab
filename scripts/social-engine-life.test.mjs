import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
test("SOCIAL ENGINE household family education and recovery lifecycle", () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--test-reporter=tap",
      "--test",
      "src/games/social-engine/tests/life.test.ts",
      "src/games/social-engine/tests/life-family.test.ts",
    ],
    { env, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /# tests [1-9][0-9]*/);
  assert.match(result.stdout, /# fail 0/);
  assert.match(result.stdout, /# skipped 0/);
});
