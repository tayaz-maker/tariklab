/** Verify Gold -> exact released6 reader/writer -> Gold without rewriting state. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import * as gold from "../public/games/tc-sim-boardworld/persistence.mjs";
import { resolveAction, getActions } from "../public/games/tc-sim-boardworld/engine.mjs";
const released = "d695119186cad42c079a911a60c372f201b3b64b";
const git = (...args) => execFileSync("git", args, { maxBuffer: 32 * 1024 * 1024 });
const hash = (s) => createHash("sha256").update(s).digest("hex");
const temp = mkdtempSync(join(tmpdir(), "boardworld-rollback-"));
const results = [];
try {
  assert.equal(
    git("rev-parse", `${released}^{tree}`).toString().trim(),
    "2350d4eb908d260fee1919e97ec27278c30bafb1",
  );
  const archive = git("archive", released, "public/games/tc-sim-boardworld");
  writeFileSync(join(temp, "source.tar"), archive);
  execFileSync("tar", ["-xf", join(temp, "source.tar"), "-C", temp]);
  const old = await import(
    pathToFileURL(join(temp, "public/games/tc-sim-boardworld/persistence.mjs"))
  );
  const provenance = JSON.parse(
    readFileSync("scripts/fixtures/boardworld/v6-provenance.json", "utf8"),
  );
  for (const fixture of provenance.fixtures) {
    const original = readFileSync(`scripts/fixtures/boardworld/${fixture.file}`, "utf8");
    const loaded = gold.importGame(original);
    const action = getActions(loaded.state).find((a) => resolveAction(loaded.state, a.id).ok);
    assert.ok(action, fixture.file);
    const result = resolveAction(loaded.state, action.id);
    assert.ok(result.ok, fixture.file);
    const bytes = gold.exportGame(result.state);
    assert.deepEqual(old.importGame(bytes).state, result.state);
    const map = new Map([
      [old.SAVE_KEY, bytes],
      ["original-owner-backup", original],
    ]);
    const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
    assert.deepEqual(old.loadGame(storage).state, result.state);
    assert.ok(old.saveGame(result.state, storage).ok);
    assert.deepEqual(gold.loadGame(storage).state, result.state);
    assert.equal(map.get("original-owner-backup"), original);
    assert.deepEqual(gold.importGame(old.exportGame(result.state)).state, result.state);
    results.push({
      fixture: fixture.file,
      action: action.id,
      stateSha256: hash(JSON.stringify(result.state)),
      bytes: Buffer.byteLength(bytes),
      pass: true,
    });
  }
  const report = {
    released,
    sourceArchiveSha256: hash(archive),
    goldCommit: git("rev-parse", "HEAD").toString().trim(),
    goldTrackedDiffSha256: hash(git("diff", "HEAD")),
    command: process.argv.join(" "),
    results,
    pass: true,
  };
  const output = process.argv[2];
  if (output) writeFileSync(resolve(output), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
