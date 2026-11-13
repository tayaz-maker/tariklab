// Reproduce native-v6 compatibility fixtures with the exact released runtime.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const commit = "d695119186cad42c079a911a60c372f201b3b64b",
  expectedTree = "2350d4eb908d260fee1919e97ec27278c30bafb1";
const repo = fileURLToPath(new URL("../../../", import.meta.url)),
  output = fileURLToPath(new URL("./", import.meta.url));
const git = (...args) => execFileSync("git", args, { cwd: repo, maxBuffer: 32 * 1024 * 1024 });
assert.equal(git("rev-parse", `${commit}^{tree}`).toString().trim(), expectedTree);
const temp = mkdtempSync(join(tmpdir(), "boardworld-released6-"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const disk = () => {
  const map = new Map();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
};
try {
  const archive = git("archive", commit, "public/games/tc-sim-boardworld");
  writeFileSync(join(temp, "source.tar"), archive);
  execFileSync("tar", ["-xf", join(temp, "source.tar"), "-C", temp]);
  const source = join(temp, "public/games/tc-sim-boardworld");
  const engine = await import(pathToFileURL(join(source, "engine.mjs"))),
    writer = await import(pathToFileURL(join(source, "persistence.mjs")));
  const sourceFiles = Object.fromEntries(
    readdirSync(source)
      .filter((f) => f.endsWith(".mjs"))
      .sort()
      .map((f) => [`public/games/tc-sim-boardworld/${f}`, hash(readFileSync(join(source, f)))]),
  );
  const fixtures = [];
  const emit = (file, state, meta) => {
    assert.equal(engine.validateState(state), true);
    const store = disk();
    assert.equal(writer.saveGame(state, store).ok, true);
    const bytes = writer.exportGame(state);
    assert.equal(store.getItem(writer.SAVE_KEY), bytes);
    assert.deepEqual(writer.importGame(bytes).state, state);
    writeFileSync(join(output, file), bytes);
    fixtures.push({
      file,
      ...meta,
      version: state.version,
      day: engine.getClock(state).day,
      revision: state.revision,
      byteLength: Buffer.byteLength(bytes),
      sha256: hash(bytes),
      stateSha256: hash(JSON.stringify(state)),
    });
  };
  for (const scenario of ["newcomer", "graduate", "restart"]) {
    const options = { name: "Released6 compatibility", scenario, seed: 2026 };
    emit(`v6-fresh-${scenario}.json`, engine.createGame(options), {
      kind: "fresh released6 createGame",
      options,
      actions: [],
    });
  }
  for (const strategy of ["career", "social", "entrepreneur"]) {
    const input = `v5-${strategy}-2026-day366.json`,
      bytes = readFileSync(join(output, input), "utf8"),
      store = disk();
    store.setItem(writer.LEGACY_V5_SAVE_KEY, bytes);
    const loaded = writer.loadGame(store);
    assert.ok(loaded.state);
    assert.equal(loaded.protected, true);
    assert.equal(store.getItem(writer.ORIGINAL_V5_BACKUP_KEY), bytes);
    const actions = engine.getActions(loaded.state);
    const candidates = [
      ...actions.filter((a) => a.id === "wait:15"),
      ...actions.filter((a) => a.id !== "wait:15"),
    ];
    let chosen, result;
    for (const action of candidates) {
      const attempt = engine.resolveAction(loaded.state, action.id);
      if (attempt.ok) {
        chosen = action.id;
        result = attempt;
        break;
      }
    }
    assert.ok(result);
    assert.ok(result.state.revision > loaded.state.revision);
    emit(`v6-mature-${strategy}-day${engine.getClock(result.state).day}.json`, result.state, {
      kind: "authentic v5 day366 input promoted and advanced by frozen released6 public resolver",
      input: { file: input, sha256: hash(bytes) },
      actions: [{ id: chosen }],
      originalArchivePreserved: true,
    });
  }
  const provenance = {
    sourceCommit: commit,
    sourceTree: expectedTree,
    sourceArchiveSha256: hash(archive),
    sourceFiles,
    classification:
      "Generated authentic released-v6 runtime/writer output; not captured owner production saves and not patched synthetic state.",
    method:
      "Exact git archive of released merge. Fresh createGame plus released save/export; mature authentic v5 day366 fixtures loaded/promoted by released6 writer, followed by one valid public released6 resolveAction, then released6 save/export. No clock/cash/skill/state patches.",
    reproduce: "node scripts/fixtures/boardworld/v6-generate.mjs",
    fixtures,
  };
  writeFileSync(join(output, "v6-provenance.json"), JSON.stringify(provenance, null, 2) + "\n");
  console.log(JSON.stringify({ fixtures: fixtures.length, commit, tree: expectedTree }));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
