import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createWorld, canonicalState, validateState } from "../simulation/engine.ts";
import { SaveRepository, DATABASE_NAME } from "../persistence/repository.ts";
import {
  assertJsonTree,
  assertSlot,
  decodeSave,
  decodeSaveText,
  encodeSave,
  migrateState,
  sha256,
  SaveError,
  type SaveEnvelope,
} from "../persistence/codec.ts";

const fresh = () => createWorld(20261103);
const rejectsCode = async (action: () => Promise<unknown>, code: string) =>
  assert.rejects(action, (error: unknown) => error instanceof SaveError && error.code === code);

test("populated world survives canonical UTF-8 SHA-256 save round-trip", async () => {
  const world = fresh();
  world.player.profile.name = "Çağrı Şen";
  world.player.name = "Çağrı Şen";
  const before = canonicalState(world),
    envelope = await encodeSave("slot-1", world);
  assert.equal(envelope.byteLength, new TextEncoder().encode(envelope.payload).byteLength);
  assert.equal(envelope.payloadSha256, await sha256(envelope.payload));
  assert.equal(envelope.encoding, "canonical-json+gzip-base64");
  const restored = await decodeSaveText(JSON.stringify(envelope));
  assert.equal(canonicalState(restored.state), before);
  assert.deepEqual(validateState(restored.state), []);
  assert.equal(restored.migrated, false);
});
test("one hundred independent codec round-trips preserve canonical state", async () => {
  const world = fresh(),
    expected = canonicalState(world);
  for (let i = 0; i < 100; i++) {
    const result = await decodeSave(await encodeSave("auto", world));
    assert.equal(canonicalState(result.state), expected);
  }
});
test("payload tampering, length mismatch and metadata disagreement fail closed", async () => {
  const envelope = await encodeSave("slot-1", fresh());
  const damaged = {
    ...envelope,
    payload: (envelope.payload[0] === "A" ? "B" : "A") + envelope.payload.slice(1),
  };
  assert.notEqual(damaged.payload, envelope.payload);
  await rejectsCode(() => decodeSave(damaged), "CHECKSUM_MISMATCH");
  await rejectsCode(
    () => decodeSave({ ...envelope, byteLength: envelope.byteLength + 1 }),
    "INVALID_SAVE",
  );
  await rejectsCode(() => decodeSave({ ...envelope, tick: envelope.tick + 1 }), "INVALID_SAVE");
  await rejectsCode(() => decodeSave({ ...envelope, format: "tc-sim" }), "INVALID_SAVE");
});
test("unknown future schema is rejected with original bytes unchanged", async () => {
  const envelope = await encodeSave("slot-1", fresh()),
    future = { ...envelope, schemaVersion: 99 },
    before = JSON.stringify(future);
  await rejectsCode(() => decodeSave(future), "UNSUPPORTED_VERSION");
  assert.equal(JSON.stringify(future), before);
  assert.throws(
    () => migrateState({ ...fresh(), schemaVersion: 99 }),
    (error: unknown) => error instanceof SaveError && error.code === "UNSUPPORTED_VERSION",
  );
});
test("v1 migration reconstructs the pre-ledger checkpoint without rewriting source", () => {
  const current = fresh();
  const ids = Object.keys(current.accounts),
    from = ids.find((id) => current.accounts[id] >= 123)!,
    to = ids.find((id) => id !== from)!;
  assert.ok(from && to);
  current.accounts[from] -= 123;
  current.accounts[to] += 123;
  current.ledger.push({
    id: "fixture-ledger-1",
    tick: current.tick,
    from,
    to,
    amount: 123,
    reason: "fixture",
  });
  const old: Record<string, unknown> = { ...current, schemaVersion: 1 };
  delete old.ledgerCheckpoint;
  delete old.notices;
  const source = JSON.stringify(old),
    migrated = migrateState(old);
  assert.equal(JSON.stringify(old), source);
  assert.equal(migrated.schemaVersion, 9);
  assert.deepEqual(migrated.accounts, current.accounts);
  assert.deepEqual(migrated.ledger, current.ledger);
  assert.equal(migrated.ledgerCheckpoint.balances[from], current.accounts[from] + 123);
  assert.equal(migrated.ledgerCheckpoint.balances[to], current.accounts[to] - 123);
  assert.equal(canonicalState(migrateState(migrated)), canonicalState(migrated));
  assert.deepEqual(validateState(migrated), []);
});
test("frozen v1 fixture migrates repeatably with unchanged bytes and finances", async () => {
  const bytes = readFileSync(new URL("../persistence/fixtures/v1-world.json.gz", import.meta.url)),
    text = gunzipSync(bytes).toString("utf8");
  const envelope = JSON.parse(text) as SaveEnvelope,
    original = JSON.parse(envelope.payload);
  const one = await decodeSaveText(text),
    two = await decodeSaveText(text);
  assert.equal(one.migrated, true);
  assert.equal(canonicalState(one.state), canonicalState(two.state));
  for (const [id, balance] of Object.entries(original.accounts))
    assert.equal(one.state.accounts[id], balance);
  for (const [id, balance] of Object.entries(one.state.accounts))
    if (!Object.hasOwn(original.accounts, id)) assert.equal(balance, 0);
  assert.deepEqual(one.state.player.inventory, original.player.inventory);
  assert.deepEqual(one.state.relations, original.relations);
  assert.deepEqual(one.state.events, original.events);
  assert.equal(gunzipSync(bytes).toString("utf8"), text);
});
test("invalid migration ledger and unsafe object trees cannot become saves", () => {
  const old: Record<string, unknown> = {
    ...fresh(),
    schemaVersion: 1,
    ledger: [{ from: "missing", to: "missing", amount: -1 }],
  };
  delete old.ledgerCheckpoint;
  assert.throws(() => migrateState(old), SaveError);
  assert.throws(() => assertJsonTree(JSON.parse('{"__proto__":{"polluted":true}}')), SaveError);
  assert.throws(() => assertJsonTree({ invalid: Infinity }), SaveError);
  assert.throws(() => assertJsonTree({ invalid: undefined }), SaveError);
  let deep: unknown = null;
  for (let i = 0; i < 60; i++) deep = { child: deep };
  assert.throws(() => assertJsonTree(deep), SaveError);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});
test("only four SOCIAL ENGINE slots are accepted and database namespace is isolated", async () => {
  assert.equal(DATABASE_NAME, "tariklab-social-engine");
  for (const id of ["slot-1", "slot-2", "slot-3", "auto"])
    assert.doesNotThrow(() => assertSlot(id));
  for (const id of ["", "tc-sim", "tariklab::racon:1", "__proto__", "slot-4"])
    assert.throws(() => assertSlot(id), SaveError);
  const repository = new SaveRepository();
  await rejectsCode(() => repository.list(), "STORAGE_UNAVAILABLE");
});
test("invalid state cannot be encoded and malformed input cannot be imported", async () => {
  const world = fresh();
  world.accounts.player = Number.NaN;
  await rejectsCode(() => encodeSave("slot-1", world), "INVALID_SAVE");
  await rejectsCode(() => decodeSaveText("{"), "INVALID_SAVE");
  await rejectsCode(() => decodeSaveText('{"format":"racon"}'), "INVALID_SAVE");
});

test("actual pre-lifecycle v2 fixture upgrades to schema4 without changing money or identity", async () => {
  const text = gunzipSync(
    readFileSync(new URL("../persistence/fixtures/v2-world.json.gz", import.meta.url)),
  ).toString("utf8");
  const original = JSON.parse(JSON.parse(text).payload),
    decoded = await decodeSaveText(text);
  assert.equal(decoded.state.schemaVersion, 9);
  assert.equal(decoded.sourceSchema, 2);
  for (const [id, balance] of Object.entries(original.accounts))
    assert.equal(decoded.state.accounts[id], balance);
  for (const [id, balance] of Object.entries(decoded.state.accounts))
    if (!Object.hasOwn(original.accounts, id)) assert.equal(balance, 0);
  for (const n of [decoded.state.player, ...decoded.state.npcs]) {
    const before =
      n.id === "player"
        ? original.player
        : original.npcs.find((old: { id: string }) => old.id === n.id);
    assert.deepEqual({ ...n, propertyIds: [] }, { ...before, propertyIds: [] });
    assert.deepEqual(
      n.propertyIds,
      decoded.state.businesses.filter((b) => b.ownerId === n.id).map((b) => b.id),
    );
  }
  assert.deepEqual(decoded.state.life.parentage, {});
  assert.deepEqual(decoded.state.life.partnerships, []);
  assert.deepEqual(decoded.state.households, original.households);
  assert.deepEqual(decoded.state.ledger, original.ledger);
  assert.equal(decoded.state.openingTotal, original.openingTotal);
  assert.deepEqual(validateState(decoded.state), []);
  assert.equal(canonicalState(migrateState(decoded.state)), canonicalState(decoded.state));
});

test("authentic schema3 lifecycle save gains schema4 systems without rewriting financial or family history", async () => {
  const source = gunzipSync(
      readFileSync(new URL("../persistence/fixtures/v3-world.json.gz", import.meta.url)),
    ).toString("utf8"),
    before = JSON.parse(JSON.parse(source).payload),
    decoded = await decodeSaveText(source),
    after = decoded.state;
  assert.equal(decoded.sourceSchema, 3);
  assert.equal(after.schemaVersion, 9);
  assert.equal(after.life.version, 2);
  for (const [id, balance] of Object.entries(before.accounts))
    assert.equal(after.accounts[id], balance);
  for (const [id, balance] of Object.entries(after.accounts))
    if (!Object.hasOwn(before.accounts, id)) assert.equal(balance, 0);
  assert.deepEqual(after.player, before.player);
  assert.deepEqual(after.npcs, before.npcs);
  assert.deepEqual(after.households, before.households);
  assert.deepEqual(after.ledger, before.ledger);
  assert.deepEqual(after.life.parentage, before.life.parentage);
  assert.deepEqual(after.life.partnerships, before.life.partnerships);
  assert.deepEqual(after.life.leases, before.life.leases);
  assert.deepEqual(after.life.births, []);
  assert.deepEqual(after.life.deaths, []);
  assert.equal(after.openingTotal, before.openingTotal);
  assert.deepEqual(validateState(after), []);
  assert.equal(canonicalState(migrateState(after)), canonicalState(after));
});

test("record packing preserves deeply frozen caller data and owns its normalized output", async () => {
  const { packRecords, unpackRecords } = await import("../persistence/records.ts");
  const world = fresh(),
    expected = canonicalState(world);
  const freeze = (value: unknown): void => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  };
  freeze(world);
  const records = packRecords(world);
  assert.equal(canonicalState(world), expected);
  assert.equal(canonicalState(unpackRecords(records)), expected);
  records.profiles["profile:player"].data.name = "Detached output";
  assert.equal(canonicalState(world), expected);
});

test("every historical fixture preserves its entire migrated world except the independent traffic pose mapping", async () => {
  const { expectedTrafficMigration } = await import("./traffic-migration-expectation.ts");
  for (const version of [1, 2, 3, 4]) {
    const fixture = JSON.parse(
      gunzipSync(
        readFileSync(new URL(`../persistence/fixtures/v${version}-world.json.gz`, import.meta.url)),
      ).toString("utf8"),
    );
    const old = await import("../persistence/historical/candidate5/persistence/codec.ts");
    const decoded =
      fixture.format === "social-engine-save"
        ? await decodeSave(fixture)
        : { state: migrateState(fixture), sourceState: old.migrateState(fixture) };
    assert.equal(
      canonicalState(decoded.state),
      canonicalState(expectedTrafficMigration(decoded.sourceState!)),
      `schema${version} whole migrated world`,
    );
  }
});
