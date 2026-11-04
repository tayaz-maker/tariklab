/** Execute every isolated test and bind the TAP result to unchanged source bytes. */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { cpus, platform, release } from "node:os";
const out = "artifacts/social-engine";
await mkdir(out, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function sources(dir) {
  const result = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) result.push(...(await sources(path)));
    else result.push({ path, sha256: hash(await readFile(path)) });
  }
  return result;
}
const sourceFiles = await sources("src/games/social-engine");
const manifest = await readFile("public/games/social-engine/build-manifest.json");
const report = {
  status: "RUNNING",
  startedAt: new Date().toISOString(),
  build_sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  manifestSha256: hash(manifest),
  sourceDigest: JSON.parse(manifest).sourceDigest,
  sourceFiles,
  environment: { node: process.version, os: `${platform()} ${release()}`, cpu: cpus()[0]?.model },
  tests: [],
};
await writeFile(`${out}/acceptance-unit.json`, JSON.stringify(report, null, 2));
const files = (await readdir("src/games/social-engine/tests"))
  .filter((n) => n.endsWith(".test.ts"))
  .sort()
  .map((n) => `src/games/social-engine/tests/${n}`);
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const started = performance.now();
const child = spawn(
  process.execPath,
  ["--experimental-strip-types", "--test", "--test-reporter=tap", ...files],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
const stream = createWriteStream(`${out}/acceptance-unit.tap`);
child.stdout.pipe(stream, { end: false });
child.stderr.pipe(stream, { end: false });
const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("close", resolve);
});
await new Promise((resolve) => stream.end(resolve));
const tap = await readFile(`${out}/acceptance-unit.tap`, "utf8");
report.tests = [...tap.matchAll(/^(ok|not ok) \d+ - (.+)\n\s+---\n\s+duration_ms: ([\d.]+)/gm)].map(
  (m) => ({ name: m[2], status: m[1] === "ok" ? "PASS" : "FAIL", duration_ms: Number(m[3]) }),
);
report.counts = Object.fromEntries(
  ["tests", "pass", "fail", "cancelled", "skipped", "todo"].map((k) => [
    k,
    Number(tap.match(new RegExp(`^# ${k} (\\d+)`, "m"))?.[1] ?? -1),
  ]),
);
report.sourcesUnchanged =
  JSON.stringify(sourceFiles) === JSON.stringify(await sources("src/games/social-engine"));
report.status =
  exitCode === 0 &&
  report.sourcesUnchanged &&
  report.counts.tests === report.tests.length &&
  report.counts.tests > 0 &&
  ["fail", "cancelled", "skipped", "todo"].every((k) => report.counts[k] === 0)
    ? "PASS"
    : "FAIL";
report.tapSha256 = hash(tap);
report.exitCode = exitCode;
report.duration_ms = performance.now() - started;
report.finishedAt = new Date().toISOString();
await writeFile(`${out}/acceptance-unit.json`, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    status: report.status,
    counts: report.counts,
    sourcesUnchanged: report.sourcesUnchanged,
  }),
);
if (report.status !== "PASS") process.exitCode = 1;
