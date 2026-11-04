// Exercise the optimized modules themselves. Native TypeScript unit tests do not
// pass through the build plugin, and reproducing bytes alone cannot prove replay.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import { compileRuntime } from "./compile-runtime.mjs";

const root = resolve(import.meta.dirname, "../..");
const base = join(root, "src/games/social-engine");
const inputs = Object.fromEntries(
  Object.entries({
    current: "simulation/engine.ts",
    predecessor: "persistence/historical/candidate5/simulation/engine.ts",
    codec: "persistence/codec.ts",
    journal: "persistence/journal.ts",
  }).map(([name, path]) => [name, join(base, path)]),
);
const chunks = await compileRuntime(root, "", inputs);
const dir = await mkdtemp(join(tmpdir(), "social-engine-replay-"));
try {
  await writeFile(join(dir, "package.json"), '{"type":"module"}');
  const compiled = {};
  for (const chunk of chunks) await writeFile(join(dir, chunk.fileName), chunk.code);
  for (const chunk of chunks.filter((item) => item.isEntry))
    compiled[chunk.name] = await import(pathToFileURL(join(dir, chunk.fileName)));
  const fixture = JSON.parse(
    gunzipSync(await readFile(join(base, "persistence/fixtures/v6-auto-with-tail.json.gz"))),
  );
  const { sourceState } = await compiled.codec.decodeSave(fixture.envelope);
  const point = { epoch: fixture.meta.epoch, cursor: fixture.meta.baseCursor };
  const handle = await compiled.journal.newJournalMeta(fixture.envelope, point);
  const batch = await compiled.journal.decodeJournal(handle, fixture.record);
  const replay = compiled.journal.replayJournal(sourceState, point, batch.operations, 6);
  const hash = (text) => createHash("sha256").update(text).digest("hex");
  const frozenReplay = hash(compiled.predecessor.canonicalState(replay));
  assert.equal(frozenReplay, fixture.expectedCanonicalSha256);
  // Interleave generations so a shared module cache or incorrect dependency
  // binding is observable. Compare full authoritative states with native imports.
  const authorities = [];
  for (const name of ["current", "predecessor"]) {
    const source = await import(pathToFileURL(inputs[name]));
    for (const engine of [source, compiled[name]])
      authorities.push({ engine, state: engine.createWorld(20261104) });
  }
  for (let tick = 0; tick < 640; tick++) {
    const commands =
      tick === 0 ? [{ v: 1, id: "walk", type: "MOVE_TO", args: { x: 41, y: 33 } }] : [];
    for (const { engine, state } of authorities) {
      const results = engine.stepWorld(state, commands);
      if (commands.length) assert.equal(results[0].ok, true, results[0].reason);
    }
  }
  const hashes = authorities.map(({ engine, state }) => {
    assert.deepEqual(engine.validateState(state), []);
    return hash(engine.canonicalState(state));
  });
  assert.equal(hashes[0], hashes[1]);
  assert.equal(hashes[2], hashes[3]);
  assert.notEqual(hashes[0], hashes[2]);
  console.log(
    JSON.stringify({
      status: "PASS",
      frozenReplay,
      current: hashes[0],
      predecessor: hashes[2],
      ticks: 640,
    }),
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
