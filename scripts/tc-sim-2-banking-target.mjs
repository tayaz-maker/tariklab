import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const BANK_FINGERPRINT_PATHS = Object.freeze(["bank.css", "styles.css", ...[
  "app", "state", "save", "wealth", "bank-accounts", "bank-actions", "bank-cards", "bank-ui",
  "bank-business", "bank-record", "banks-presentation", "mortgage", "icra", "monthly-cash", "time",
].map(name => `js/${name}.js`)].map(path => `/games/tc-sim/${path}?v=10`));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

export async function requireBankCurrentMain(expectedSha, request = fetch) {
  assert.match(expectedSha || "", /^[a-f0-9]{40}$/);
  const response = await request("https://api.github.com/repos/tayaz-maker/tariklab/branches/main", {
    redirect: "error", cache: "no-store", headers: { Accept: "application/vnd.github+json", "User-Agent": "TarikLab-TC-banking-acceptance" },
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, "Current main verification unavailable.");
  const main = await response.json();
  assert.equal(main.commit?.sha, expectedSha, "Main moved; refuse stale banking production acceptance.");
  return main.commit.sha;
}

export async function verifyBankCandidate(directory, expectedSha, repository = process.cwd()) {
  assert.match(expectedSha || "", /^[a-f0-9]{40}$/);
  const git = args => execFileSync("git", args, { cwd: repository, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(git(["rev-parse", `${expectedSha}^{commit}`]).toString().trim(), expectedSha);
  const rows = [];
  for (const path of BANK_FINGERPRINT_PATHS) {
    const file = path.split("?")[0], expected = sha(git(["show", `${expectedSha}:public${file}`]));
    assert.equal(sha(await readFile(resolve(directory, `.${file}`))), expected, `Expected banking build is not exact SHA ${expectedSha}: ${path}`);
    rows.push({ path, sha256: expected });
  }
  return rows;
}
