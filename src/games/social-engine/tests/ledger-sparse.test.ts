import test from "node:test";
import assert from "node:assert/strict";
import {
  readTransactionBits,
  writeTransactionBits,
  validTransactionBits,
  transfer,
} from "../simulation/ledger.ts";
import { createWorld, validateState } from "../simulation/engine.ts";
import { encodeSave, decodeSave } from "../persistence/codec.ts";
test("every4096bit address survives dense/sparse representation without collisions or false positives", () => {
  for (let i = 0; i < 4096; i++) {
    const value = (1n << BigInt(i)) | 1n;
    const saved = writeTransactionBits(value);
    assert.equal(validTransactionBits(saved), true);
    assert.equal(readTransactionBits(saved), value);
    assert.ok(saved.length <= 10);
  }
  for (const bad of ["b:", "b:2,1", "b:1,1", "b:4096", "b:01", "b:-1", "b:NaN", "x:1"])
    assert.equal(validTransactionBits(bad), false);
  const dense = (1n << 4096n) - 1n;
  assert.equal(readTransactionBits(writeTransactionBits(dense)), dense);
  assert.equal(readTransactionBits("10000000000000"), 0x10000000000000n);
});
test("sparse per-person tick transaction families stay compact and exact-once after ledger compaction and save reload", async () => {
  const s = createWorld(815);
  for (let i = 0; i < 3000; i++)
    assert.equal(
      transfer(s, `sparse:person${i}:2591999`, "external", "player", 1, "fixture"),
      true,
    );
  assert.ok(s.ledgerCheckpoint.count >= 1024);
  const saved = await encodeSave("slot-1", s),
    restored = (await decodeSave(saved)).state;
  const cash = restored.accounts.player;
  for (let i = 0; i < 3000; i++)
    assert.equal(
      transfer(restored, `sparse:person${i}:2591999`, "external", "player", 1, "fixture"),
      false,
    );
  assert.equal(restored.accounts.player, cash);
  assert.ok(JSON.stringify(s.flags).length < 180000);
  assert.deepEqual(validateState(restored), []);
});
