import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, stepWorld, applyCommand, canonicalState } from "../simulation/engine.ts";
import { encodeSave, SaveError } from "../persistence/codec.ts";
import {
  newJournalMeta,
  encodeJournal,
  decodeJournal,
  replayJournal,
  assertJournalBatch,
  MAX_JOURNAL_OPERATIONS,
  type JournalOperation,
  type JournalBatch,
} from "../persistence/journal.ts";
import type { Command } from "../domain/types.ts";
const cmd = (id: string, type: string, args: Record<string, unknown> = {}): Command => ({
  v: 1,
  id,
  type,
  args,
});
const isCode = (code: string) => (e: unknown) => e instanceof SaveError && e.code === code;
test("journal replays fixed ticks, paused commands and control resets into exactly the same world", async () => {
  const base = createWorld(902),
    world = structuredClone(base),
    ops: JournalOperation[] = [];
  let cursor = 0;
  const tick = (commands: Command[] = []) => {
    stepWorld(world, commands);
    ops.push({ cursor: ++cursor, type: "TICK", endingTick: world.tick, commands });
  };
  tick([cmd("j-move", "MOVE", { x: 1, y: 0, sprint: false })]);
  tick();
  world.flags.moveX = 0;
  world.flags.moveY = 0;
  world.flags.throttle = 0;
  world.flags.steer = 0;
  ops.push({ cursor: ++cursor, type: "PAUSE_CONTROL", tick: world.tick, paused: true });
  const commands = [cmd("j-speed", "SET_TIME_SPEED", { speed: 2 })];
  commands.forEach((c) => applyCommand(world, c));
  ops.push({ cursor: ++cursor, type: "APPLY_WHILE_PAUSED", tick: world.tick, commands });
  ops.push({ cursor: ++cursor, type: "PAUSE_CONTROL", tick: world.tick, paused: false });
  tick();
  const original = canonicalState(base),
    replayed = replayJournal(base, { epoch: "qa-session", cursor: 0 }, ops);
  assert.equal(canonicalState(replayed), canonicalState(world));
  assert.equal(canonicalState(base), original);
  const meta = await newJournalMeta(await encodeSave("auto", base), {
      epoch: "qa-session",
      cursor: 0,
    }),
    batch = { epoch: meta.epoch, fromCursor: 0, toCursor: cursor, operations: ops };
  const record = await encodeJournal(meta, batch);
  assert.deepEqual(await decodeJournal(meta, record), batch);
});
test("retirement freezes valid tick operations and resume uses the actual resulting tick", () => {
  const base = createWorld(903),
    world = structuredClone(base),
    ops: JournalOperation[] = [];
  for (const [index, command] of [
    cmd("retire", "RETIRE"),
    cmd("blocked", "BUY", { businessId: "market", item: "simit", quantity: 1 }),
    cmd("resume", "RESUME_CAREER"),
  ].entries()) {
    stepWorld(world, [command]);
    ops.push({ cursor: index + 1, type: "TICK", endingTick: world.tick, commands: [command] });
  }
  assert.equal(ops[0].type === "TICK" && ops[0].endingTick, 0);
  assert.equal(
    canonicalState(replayJournal(base, { epoch: "retired", cursor: 0 }, ops)),
    canonicalState(world),
  );
});
test("checksummed journal chain rejects payload, cursor, metadata and prior-hash tampering", async () => {
  const base = createWorld(904),
    head = await newJournalMeta(await encodeSave("auto", base), { epoch: "check", cursor: 0 }),
    batch: JournalBatch = {
      epoch: "check",
      fromCursor: 0,
      toCursor: 1,
      operations: [{ cursor: 1, type: "TICK", endingTick: 1, commands: [] }],
    },
    record = await encodeJournal(head, batch);
  await assert.rejects(
    decodeJournal(head, {
      ...record,
      payload: record.payload.replace('endingTick":1', 'endingTick":9'),
    }),
    isCode("CHECKSUM_MISMATCH"),
  );
  await assert.rejects(
    decodeJournal(head, { ...record, previousHash: "0".repeat(64) }),
    isCode("JOURNAL_CORRUPT"),
  );
  await assert.rejects(
    decodeJournal(head, { ...record, toCursor: 2 }),
    isCode("CHECKSUM_MISMATCH"),
  );
  await assert.rejects(encodeJournal({ ...head, cursor: 4 }, batch), isCode("WRITE_CONFLICT"));
});
test("gaps and dishonest unchanged ticks fail without mutating the source snapshot", () => {
  const base = createWorld(905),
    before = canonicalState(base);
  assert.throws(
    () =>
      replayJournal(base, { epoch: "gap", cursor: 0 }, [
        { cursor: 2, type: "TICK", endingTick: 1, commands: [] },
      ]),
    isCode("JOURNAL_CORRUPT"),
  );
  assert.throws(
    () =>
      replayJournal(base, { epoch: "gap", cursor: 0 }, [
        { cursor: 1, type: "TICK", endingTick: 9, commands: [] },
      ]),
    isCode("JOURNAL_CORRUPT"),
  );
  assert.throws(
    () =>
      replayJournal(base, { epoch: "gap", cursor: 0 }, [
        { cursor: 1, type: "TICK", endingTick: 0, commands: [] },
      ]),
    isCode("JOURNAL_CORRUPT"),
  );
  assert.equal(canonicalState(base), before);
});
test("unknown operation, unsafe JSON, invalid commands and excessive replay fail closed", () => {
  assert.throws(
    () =>
      assertJournalBatch({
        epoch: "bad",
        fromCursor: 0,
        toCursor: 1,
        operations: [{ cursor: 1, type: "BOGUS" } as unknown as JournalOperation],
      }),
    isCode("JOURNAL_CORRUPT"),
  );
  assert.throws(
    () =>
      assertJournalBatch({
        epoch: "bad",
        fromCursor: 0,
        toCursor: 1,
        operations: [
          { cursor: 1, type: "TICK", endingTick: 1, commands: [cmd("bad", "MOVE", { x: NaN })] },
        ],
      }),
    isCode("INVALID_SAVE"),
  );
  assert.throws(
    () =>
      replayJournal(
        createWorld(906),
        { epoch: "cap", cursor: 0 },
        Array.from({ length: MAX_JOURNAL_OPERATIONS + 1 }, (_, i) => ({
          cursor: i + 1,
          type: "TICK" as const,
          endingTick: i + 1,
          commands: [],
        })),
      ),
    isCode("JOURNAL_LIMIT"),
  );
});
test("checkpoint suffix replay preserves cursor continuity without repeating covered operations", () => {
  const base = createWorld(907),
    world = structuredClone(base),
    ops: JournalOperation[] = [];
  for (let i = 0; i < 20; i++) {
    const commands = i === 0 ? [cmd("walk", "MOVE", { x: 0, y: 1 })] : [];
    stepWorld(world, commands);
    ops.push({ cursor: i + 1, type: "TICK", endingTick: world.tick, commands });
  }
  const checkpoint = replayJournal(base, { epoch: "checkpoint", cursor: 0 }, ops.slice(0, 10));
  const replayed = replayJournal(checkpoint, { epoch: "checkpoint", cursor: 10 }, ops.slice(10));
  assert.equal(canonicalState(replayed), canonicalState(world));
  assert.throws(
    () => replayJournal(checkpoint, { epoch: "checkpoint", cursor: 10 }, ops),
    isCode("JOURNAL_CORRUPT"),
  );
});

test("frozen real candidate5 snapshot and command/tick tail replay exactly before schema7 migration", async () => {
  const { readFileSync } = await import("node:fs");
  const { gunzipSync } = await import("node:zlib");
  const { decodeSave, migrateState, sha256 } = await import("../persistence/codec.ts");
  const frozen = JSON.parse(
    gunzipSync(
      readFileSync(new URL("../persistence/fixtures/v6-auto-with-tail.json.gz", import.meta.url)),
    ).toString("utf8"),
  );
  const before = JSON.stringify(frozen);
  const decoded = await decodeSave(frozen.envelope);
  assert.equal(decoded.sourceState!.schemaVersion, 6);
  assert.equal(decoded.state.schemaVersion, 7);
  const point = { epoch: frozen.meta.epoch, cursor: frozen.meta.baseCursor };
  const base = await newJournalMeta(frozen.envelope, point);
  const batch = await decodeJournal(base, frozen.record);
  const historical = replayJournal(decoded.sourceState!, point, batch.operations, 6);
  assert.equal(await sha256(canonicalState(historical)), frozen.expectedCanonicalSha256);
  assert.equal(
    canonicalState(migrateState(historical)),
    canonicalState({ ...historical, schemaVersion: 7, engineVersion: "1.0.0-candidate.6" }),
  );
  assert.equal(JSON.stringify(frozen), before);
  assert.throws(
    () => replayJournal(decoded.state, point, batch.operations, 6),
    isCode("UNSUPPORTED_VERSION"),
  );
  const old = await import("../persistence/historical/candidate5/persistence/codec.ts");
  const newSave = await encodeSave("auto", decoded.state);
  await assert.rejects(
    () => old.decodeSave(newSave),
    (e) => e instanceof old.SaveError && e.code === "UNSUPPORTED_VERSION",
  );
  await assert.rejects(
    () => old.decodeSave({ ...frozen.envelope, schemaVersion: 7 }),
    (e) => e instanceof old.SaveError && e.code === "UNSUPPORTED_VERSION",
  );
});

test("historical runtime source bytes match the pinned real predecessor", async () => {
  const { readFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const root = new URL("../persistence/historical/candidate5/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("provenance.json", root), "utf8"));
  for (const [file, hash] of Object.entries(manifest.files))
    assert.equal(
      createHash("sha256")
        .update(readFileSync(new URL(file, root)))
        .digest("hex"),
      hash,
      file,
    );
});
