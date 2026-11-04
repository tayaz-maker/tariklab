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
  const oldEngine = await import(
    pathToFileURL(join(temp, "public/games/tc-sim-boardworld/engine.mjs"))
  );
  const provenance = JSON.parse(
    readFileSync("scripts/fixtures/boardworld/v6-provenance.json", "utf8"),
  );
  const fixtures = [
    ...provenance.fixtures.map((fixture) => ({ ...fixture, sourceVersion: 6 })),
    { file: "v5-fresh-newcomer.json", sourceVersion: 5, pending: true },
    { file: "v5-active-calendar.json", sourceVersion: 5 },
    { file: "v5-social-2026-day366.json", sourceVersion: 5 },
  ];
  for (const fixture of fixtures) {
    const original = readFileSync(`scripts/fixtures/boardworld/${fixture.file}`, "utf8");
    const sourceKey = fixture.sourceVersion === 6 ? gold.SAVE_KEY : gold.LEGACY_V5_SAVE_KEY;
    const map = new Map([
      [sourceKey, original],
      ["original-owner-backup", original],
      ["tariklab::tc-sim:1", "original-TC-untouched"],
    ]);
    const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
    const loaded = gold.loadGame(storage);
    assert.ok(loaded.state, fixture.file);
    // Keep a genuine unresolved event through the rollback, rather than creating
    // a synthetic state or resolving it before the old client has loaded it.
    if (fixture.pending) assert.ok(loaded.state.pendingEvents.length);
    const action = fixture.pending
      ? null
      : getActions(loaded.state).find((a) => resolveAction(loaded.state, a.id).ok);
    if (!fixture.pending) assert.ok(action, fixture.file);
    const result = action
      ? resolveAction(loaded.state, action.id)
      : { ok: true, state: loaded.state };
    assert.ok(result.ok, fixture.file);
    assert.ok(gold.saveGame(result.state, storage).ok);
    const bytes = gold.exportGame(result.state);
    assert.deepEqual(old.importGame(bytes).state, result.state);
    const oldLoaded = old.loadGame(storage).state;
    assert.deepEqual(oldLoaded, result.state);
    if (fixture.pending) assert.deepEqual(oldLoaded.pendingEvents, loaded.state.pendingEvents);
    const oldAction = oldEngine
      .getActions(oldLoaded)
      .find((a) => oldEngine.resolveAction(oldLoaded, a.id).ok);
    assert.ok(oldAction, fixture.file);
    const oldResult = oldEngine.resolveAction(oldLoaded, oldAction.id);
    assert.ok(oldResult.ok);
    assert.notDeepEqual(oldResult.state, oldLoaded);
    assert.ok(old.saveGame(oldResult.state, storage).ok);
    assert.deepEqual(old.loadGame(storage).state, oldResult.state);
    assert.deepEqual(gold.loadGame(storage).state, oldResult.state);
    assert.deepEqual(gold.importGame(old.exportGame(oldResult.state)).state, oldResult.state);
    assert.equal(map.get("original-owner-backup"), original);
    assert.equal(map.get("tariklab::tc-sim:1"), "original-TC-untouched");
    if (fixture.sourceVersion === 5) {
      assert.equal(map.get(gold.LEGACY_V5_SAVE_KEY), original);
      assert.equal(map.get(gold.ORIGINAL_V5_BACKUP_KEY), original);
    }
    results.push({
      fixture: fixture.file,
      sourceVersion: fixture.sourceVersion,
      goldAction: action?.id ?? null,
      released6Action: oldAction.id,
      pendingEventPreservedAtRollback: fixture.pending === true,
      stateSha256: hash(JSON.stringify(oldResult.state)),
      originalSha256: hash(original),
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
