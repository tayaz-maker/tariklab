import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { BANK_FINGERPRINT_PATHS, requireBankCurrentMain, verifyBankCandidate } from "./tc-sim-2-banking-target.mjs";

test("banking production rejects moved, missing and unavailable main attestations", async () => {
  const expected = "a".repeat(40), response = (status, sha) => async () => ({ status, json: async () => ({ commit: { sha } }) });
  assert.equal(await requireBankCurrentMain(expected, response(200, expected)), expected);
  await assert.rejects(requireBankCurrentMain(expected, response(200, "b".repeat(40))), /Main moved/);
  await assert.rejects(requireBankCurrentMain(expected, response(200, undefined)), /Main moved/);
  await assert.rejects(requireBankCurrentMain(expected, response(503, expected)), /verification unavailable/);
  await assert.rejects(requireBankCurrentMain("main", response(200, expected)));
});

test("all 17 banking build assets must match immutable commit blobs, not a working-tree claim", async () => {
  const root = await mkdtemp(join(tmpdir(), "tc-bank-provenance-"));
  const git = args => execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  try {
    git(["init", "-q"]);
    for (const [index, path] of BANK_FINGERPRINT_PATHS.entries()) {
      const file = join(root, "public", path.split("?")[0]);
      await mkdir(dirname(file), { recursive: true }); await writeFile(file, `accepted asset ${index}\n`);
    }
    git(["add", "public"]); git(["-c", "user.name=TC QA", "-c", "user.email=qa@example.invalid", "commit", "-qm", "Accepted fixture"]);
    const commit = git(["rev-parse", "HEAD"]), directory = join(root, "public");
    assert.equal((await verifyBankCandidate(directory, commit, root)).length, 17);
    await writeFile(join(directory, "games/tc-sim/js/app.js"), "changed after the accepted commit\n");
    await assert.rejects(verifyBankCandidate(directory, commit, root), /not exact SHA/);
    await assert.rejects(verifyBankCandidate(directory, "f".repeat(40), root));
  } finally { await rm(root, { recursive: true, force: true }); }
});
