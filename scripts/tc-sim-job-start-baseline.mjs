import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
export const TC_BASELINE = "9e50404c0573e1cf9e2dd7e623c9c8bd98b95e56";
export const TC_BASELINE_PATHS = ["public/games/tc-sim", "public/games/shared", "public/i18n", "public/favicon.ico"];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
export function archiveTcBaseline(directory, repository = process.cwd()) {
  return archiveTcSource(directory, repository, TC_BASELINE);
}
// Explicit commit parameter is used only by synthetic repository regressions;
// the production driver calls the fixed-baseline wrapper above.
export function archiveTcSource(directory, repository, commit) {
  assert.match(commit, /^[a-f0-9]{40}$/);
  const git = args => execFileSync("git", args, { cwd: repository, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  // A missing/fetched-wrong baseline fails here; no main/HEAD substitution.
  assert.equal(git(["rev-parse", `${commit}^{commit}`]).toString().trim(), commit);
  const entries = git(["ls-tree", "-r", "-z", commit, "--", ...TC_BASELINE_PATHS]).toString().split("\0").filter(Boolean).map(line => {
    const [, mode, blob, path] = line.match(/^(\d+) blob ([a-f0-9]{40})\t(.+)$/) || [];
    assert.equal(mode, "100644", "only regular source files enter the baseline archive");
    assert.ok(TC_BASELINE_PATHS.some(prefix => path === prefix || path.startsWith(prefix + "/")));
    return { path, blob };
  });
  assert.ok(entries.some(e => e.path === "public/games/tc-sim/index.html"));
  mkdirSync(directory, { recursive: false });
  const archive = git(["archive", "--format=tar", commit, ...TC_BASELINE_PATHS]);
  execFileSync("tar", ["-xf", "-", "-C", resolve(directory)], { input: archive });
  const files = entries.map(({ path, blob }) => {
    const bytes = readFileSync(resolve(directory, path));
    const actual = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    assert.equal(actual, blob, `baseline archive bytes differ: ${path}`);
    return { path, gitBlob: blob, bytes: bytes.length, sha256: sha(bytes) };
  });
  return { commit, archiveSHA256: sha(archive), files };
}
export function verifyTcStaticBuild(directory, repository = process.cwd()) {
  const files = execFileSync("git", ["ls-files", "-z", "--", ...TC_BASELINE_PATHS], { cwd: repository }).toString().split("\0").filter(Boolean);
  // New candidate modules must also be represented after checkout/build.
  for (const p of ["public/games/tc-sim/js/job-start-outcome.js", "public/games/tc-sim/js/job-start-outcome-ui.js"]) if (!files.includes(p)) files.push(p);
  return files.map(path => {
    const source = readFileSync(resolve(repository, path));
    const built = readFileSync(resolve(directory, path.replace(/^public\//, "")));
    assert.deepEqual(built, source, `TC static route is not byte-identical to source: ${path}`);
    return { path, bytes: built.length, sha256: sha(built) };
  });
}
