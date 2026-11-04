import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, advanceMinutes, canonicalState } from "../simulation/engine.ts";
import { packRecords, unpackRecords } from "../persistence/records.ts";
import { encodeSave, decodeSave, sha256 } from "../persistence/codec.ts";
import { RULES_VERSION } from "../domain/content.ts";
test("all persisted records have unique typed identity, schema and reconciliation tick; immutable profiles have one storage owner", () => {
  const state = createWorld(811);
  advanceMinutes(state, 20);
  const prior = canonicalState(state),
    packed = packRecords(state);
  assert.equal(canonicalState(state), prior);
  assert.equal(packed.rulesVersion, RULES_VERSION);
  assert.equal(Object.keys(packed.profiles).length, 1101);
  for (const [id, r] of Object.entries({ ...packed.records, ...packed.profiles })) {
    assert.equal(r.id, id);
    assert.equal(r.schemaVersion, 1);
    assert.equal(r.updatedTick, state.tick);
  }
  const person = packed.records["world/npcs/@n0"];
  assert.ok(person);
  assert.equal(person.data.profileRef, "profile:n0");
  assert.equal(Object.hasOwn(person.data, "name"), false);
  assert.equal(canonicalState(unpackRecords(packed)), prior);
  const p = structuredClone(packed);
  p.records["world/npcs/@n0"].data.name = "forged";
  assert.throws(() => unpackRecords(p), /competing authority/);
});
test("authenticated but invalid references, duplicate ownership, unsupported rules and record versions fail closed", async () => {
  const base = await encodeSave("slot-1", createWorld(812));
  const corruptions: ((s: ReturnType<typeof packRecords>) => void)[] = [
    (s) => {
      s.records.world.schemaVersion = 99 as 1;
    },
    (s) => {
      s.records.world.updatedTick++;
    },
    (s) => {
      s.rulesVersion = "future";
    },
    (s) => {
      s.records.world.data.player = { $ref: "missing" };
    },
    (s) => {
      s.records.world.data.player = { $ref: "world" };
    },
    (s) => {
      delete s.profiles["profile:n0"];
    },
    (s) => {
      s.profiles["profile:n0"].data.personId = "n1";
    },
    (s) => {
      s.records.extra = { ...s.records.world, id: "extra" };
    },
  ];
  for (const corrupt of corruptions) {
    const packed = packRecords(createWorld(812));
    corrupt(packed);
    const payload = JSON.stringify(packed);
    await assert.rejects(
      decodeSave({
        ...base,
        payload,
        encoding: "canonical-json",
        byteLength: new TextEncoder().encode(payload).byteLength,
        sha256: await sha256(payload),
      }),
      /Kayıt nesneleri/,
    );
  }
});
test("canonical normalized save hydration and continued ticks equal uninterrupted authority", async () => {
  const state = createWorld(813);
  advanceMinutes(state, 480);
  const saved = await encodeSave("auto", state),
    restored = (await decodeSave(saved)).state;
  advanceMinutes(state, 1440);
  advanceMinutes(restored, 1440);
  assert.equal(canonicalState(restored), canonicalState(state));
});

test("compressed normalized snapshot checks canonical bytes and rejects malformed length, checksum and expansion bounds", async () => {
  const state = createWorld(814),
    save = await encodeSave("auto", state);
  assert.equal(save.encoding, "canonical-json+gzip-base64");
  assert.ok(save.byteLength < save.decodedByteLength! / 3);
  assert.equal(canonicalState((await decodeSave(save)).state), canonicalState(state));
  await assert.rejects(
    decodeSave({ ...save, decodedByteLength: save.decodedByteLength! - 1 }),
    /boyut/,
  );
  await assert.rejects(decodeSave({ ...save, decodedByteLength: 49 * 1024 * 1024 }), /boyut/);
  await assert.rejects(decodeSave({ ...save, sha256: "0".repeat(64) }), /sağlama toplamı/);
  const payload = "%%%=";
  await assert.rejects(
    decodeSave({
      ...save,
      payload,
      byteLength: payload.length,
      payloadSha256: await sha256(payload),
    }),
    /boyut/,
  );
});
