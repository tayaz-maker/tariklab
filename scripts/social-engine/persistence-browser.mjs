/** Portable entry point for the isolated real IndexedDB browser suite. */
import { spawnSync } from "node:child_process";
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const run = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "src/games/social-engine/tests/persistence-browser.ts"],
  { env, stdio: "inherit" },
);
if (run.error) throw run.error;
process.exitCode = run.status ?? 1;
