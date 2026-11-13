import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  importGame,
  exportGame,
  loadGame,
  saveGame,
  SAVE_KEY,
  BACKUP_KEY,
} from "../public/games/tc-sim-boardworld/persistence.mjs";
const file = (name) =>
  readFileSync(new URL(`./fixtures/boardworld/${name}`, import.meta.url), "utf8");
const provenance = JSON.parse(file("v6-provenance.json"));
const hash = (value) => createHash("sha256").update(value).digest("hex");
test("frozen native6 fixture provenance identifies the exact released runtime and authentic public action inputs", () => {
  assert.equal(provenance.sourceCommit, "d695119186cad42c079a911a60c372f201b3b64b");
  assert.equal(provenance.sourceTree, "2350d4eb908d260fee1919e97ec27278c30bafb1");
  assert.match(
    provenance.sourceFiles["public/games/tc-sim-boardworld/persistence.mjs"],
    /^[a-f0-9]{64}$/,
  );
  assert.equal(provenance.fixtures.length, 6);
  assert.equal(provenance.fixtures.filter((f) => f.input).length, 3);
  for (const fixture of provenance.fixtures) {
    const bytes = file(fixture.file);
    assert.equal(hash(bytes), fixture.sha256);
    assert.equal(Buffer.byteLength(bytes), fixture.byteLength);
    if (fixture.input) {
      assert.equal(hash(file(fixture.input.file)), fixture.input.sha256);
      assert.equal(fixture.actions.length, 1);
      assert.ok(fixture.day >= 366);
      assert.equal(fixture.originalArchivePreserved, true);
    }
  }
});
for (const fixture of provenance.fixtures)
  test(`Gold exactly loads, saves, imports and exports released6 ${fixture.file}`, () => {
    const bytes = file(fixture.file),
      imported = importGame(bytes);
    assert.ok(imported.state);
    assert.equal(imported.sourceVersion, 6);
    assert.equal(imported.migrated, false);
    assert.equal(
      hash(JSON.stringify(imported.state)),
      fixture.stateSha256,
      "decoded state equals frozen runtime state including history/RNG",
    );
    const map = new Map([
      [SAVE_KEY, bytes],
      ["tariklab::tc-sim:1", "original TC untouched"],
    ]);
    const store = {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => map.set(key, value),
    };
    assert.deepEqual(loadGame(store).state, imported.state);
    assert.equal(saveGame(imported.state, store).ok, true);
    assert.equal(map.get(BACKUP_KEY), bytes);
    assert.deepEqual(loadGame(store).state, imported.state);
    assert.deepEqual(importGame(exportGame(imported.state)).state, imported.state);
    assert.equal(map.get("tariklab::tc-sim:1"), "original TC untouched");
  });
