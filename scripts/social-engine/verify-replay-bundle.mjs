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
    candidate5: "persistence/historical/candidate5/simulation/engine.ts",
    candidate6: "persistence/historical/candidate6/simulation/engine.ts",
    candidate7: "persistence/historical/candidate7/simulation/engine.ts",
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
  const hash = (text) => createHash("sha256").update(text).digest("hex");
  const frozenReplays = {};
  for (const name of ["v6-auto-with-tail", "v7-auto-with-tail", "v7-auto-with-driving-tail", "v8-auto-with-tail"]) {
    const fixture = JSON.parse(
      gunzipSync(await readFile(join(base, "persistence/fixtures/" + name + ".json.gz"))),
    );
    const { sourceState, sourceSchema } = await compiled.codec.decodeSave(fixture.envelope);
    const point = fixture.point ?? { epoch: fixture.meta.epoch, cursor: fixture.meta.baseCursor };
    const handle = await compiled.journal.newJournalMeta(fixture.envelope, point);
    const batch = await compiled.journal.decodeJournal(handle, fixture.record);
    const state = compiled.journal.replayJournal(
      sourceState,
      point,
      batch.operations,
      sourceSchema,
    );
    const authority = sourceSchema === 6 ? compiled.candidate5 : sourceSchema === 7 ? compiled.candidate6 : compiled.candidate7;
    assert.deepEqual(authority.validateState(state), []);
    frozenReplays[name] = hash(authority.canonicalState(state));
    assert.equal(frozenReplays[name], fixture.expectedCanonicalSha256);
    if (fixture.expectedVehicle) {
      assert.equal(state.player.vehicleId, fixture.expectedVehicle.id);
      assert.equal(state.vehicles[0].progress, fixture.expectedVehicle.end);
      assert.deepEqual(state.player.location, fixture.expectedVehicle.location);
    }
  }
  // Interleave generations so a shared module cache or incorrect dependency
  // binding is observable. Compare full authoritative states with native imports.
  const authorities = [];
  for (const name of ["current", "candidate7", "candidate6", "candidate5"]) {
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
  assert.equal(hashes[4], hashes[5]);
  assert.equal(hashes[6], hashes[7]);
  assert.equal(new Set(hashes).size, 4);
  console.log(
    JSON.stringify({
      status: "PASS",
      frozenReplays,
      current: hashes[0],
      candidate7: hashes[2],
      candidate6: hashes[4],
      candidate5: hashes[6],
      ticks: 640,
    }),
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
