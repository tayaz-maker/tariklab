import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { build } from "esbuild";
import { LiveJournal } from "../ui/live-journal.ts";
import { coalesceJournalPrefix } from "../ui/journal-mailbox.ts";
import { createWorld, canonicalState, stepWorld, applyCommand } from "../simulation/engine.ts";
import {
  encodeJournal,
  decodeJournal,
  replayJournal,
  MAX_BATCH_BYTES,
  type JournalBatch,
  type JournalHandle,
  type JournalOperation,
} from "../persistence/journal.ts";
import type { WorldState } from "../domain/types.ts";

const baselineSource = execFileSync(
  "git",
  ["show", "549cff1:src/games/social-engine/ui/live-journal.ts"],
  { encoding: "utf8" },
);
const bundle = await build({
  stdin: {
    contents: baselineSource,
    resolveDir: resolve("src/games/social-engine/ui"),
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  globalName: "baseline",
  platform: "node",
  write: false,
});
const baselineContext = vm.createContext({ structuredClone, TextEncoder, performance });
vm.runInContext(bundle.outputFiles[0].text, baselineContext);
const Baseline = baselineContext.baseline.LiveJournal as typeof LiveJournal;
const turn = () => new Promise<void>((r) => setImmediate(r));
const initial = createWorld(872);
const authority = structuredClone(initial);
const operations: JournalOperation[] = [];
for (let cursor = 1; cursor <= 900; cursor++) {
  let op: JournalOperation;
  if (cursor % 10 === 1) {
    authority.flags.moveX =
      authority.flags.moveY =
      authority.flags.throttle =
      authority.flags.steer =
        0;
    op = { type: "PAUSE_CONTROL", cursor, tick: authority.tick, paused: true };
  } else if (cursor % 10 === 2) {
    const commands = [
      {
        v: 1 as const,
        id: `coalesce:${cursor}`,
        type: "MOVE",
        args: { x: 1, y: 0, sprint: false },
      },
    ];
    commands.forEach((command) => applyCommand(authority, command));
    op = { type: "APPLY_WHILE_PAUSED", cursor, tick: authority.tick, commands };
  } else if (cursor % 10 === 4) {
    stepWorld(authority);
    op = { type: "TICK", cursor, endingTick: authority.tick, commands: [] };
  } else op = { type: "PAUSE_CONTROL", cursor, tick: authority.tick, paused: false };
  operations.push(op);
}
function stateAt(cursor: number) {
  let state = initial;
  for (let from = 0; from < cursor; from += 600)
    state = replayJournal(
      state,
      { epoch: "experiment", cursor: from },
      operations.slice(from, Math.min(from + 600, cursor)),
    );
  return state;
}
const batch = (from: number, count = 10): JournalBatch => ({
  epoch: "experiment",
  fromCursor: from,
  toCursor: from + count,
  operations: structuredClone(operations.slice(from, from + count)),
});
function harness(Controller = LiveJournal) {
  let currentCursor = 0,
    revision = 0,
    head: JournalHandle | null = null;
  let base = structuredClone(initial),
    baseCursor = 0;
  const persisted: { head: JournalHandle; record: Awaited<ReturnType<typeof encodeJournal>> }[] =
    [];
  const pending: (() => void)[] = [],
    writes: number[] = [],
    errors: Error[] = [];
  const snapshots: number[] = [];
  const makeHead = (cursor: number): JournalHandle => ({
    slotId: "auto",
    epoch: "experiment",
    baseRevisionId: `r${++revision}`,
    baseCursor: cursor,
    cursor,
    lastHash: `base${revision}`,
  });
  const repository = {
    async beginJournal(
      _slot: "auto",
      state: WorldState,
      point: { cursor: number },
      expected: JournalHandle | null,
    ) {
      assert.equal(expected, null);
      base = structuredClone(state);
      baseCursor = point.cursor;
      return (head = makeHead(point.cursor));
    },
    async checkpointJournal(expected: JournalHandle, state: WorldState, point: { cursor: number }) {
      assert.deepEqual(expected, head);
      base = structuredClone(state);
      baseCursor = point.cursor;
      persisted.length = 0;
      snapshots.push(point.cursor);
      return (head = makeHead(point.cursor));
    },
    async appendJournal(expected: JournalHandle, next: JournalBatch) {
      assert.deepEqual(expected, head);
      writes.push(next.operations.length);
      await new Promise<void>((r) => pending.push(r)); // controlled delayed serial transaction
      assert.deepEqual(expected, head, "CAS remains exact after delayed write");
      const record = await encodeJournal(expected, next);
      assert.ok(record.byteLength <= MAX_BATCH_BYTES);
      assert.deepEqual(await decodeJournal(expected, record), next);
      persisted.push({ head: structuredClone(expected), record });
      return (head = { ...expected, cursor: next.toCursor, lastHash: record.hash });
    },
  };
  const controller = new Controller(
    repository,
    null,
    async () => ({
      state: stateAt(currentCursor),
      point: { epoch: "experiment", cursor: currentCursor },
    }),
    () => {},
    (e) => errors.push(e),
  );
  return {
    controller,
    writes,
    errors,
    pending,
    snapshots,
    advance: (cursor: number) => {
      currentCursor = cursor;
    },
    async release() {
      assert.ok(pending.length);
      pending.shift()!();
      for (let i = 0; i < 100 && !pending.length && controller.status().pendingOperations; i++)
        await turn();
    },
    async drain() {
      for (let n = 0; n < 200 && (pending.length || controller.status().pendingOperations); n++) {
        if (pending.length) await this.release();
        else await turn();
      }
      assert.equal(controller.status().pendingOperations, 0);
      assert.deepEqual(errors, []);
    },
    async restored() {
      let previous = makeReadHead();
      const ops: JournalOperation[] = [];
      for (const entry of persisted) {
        assert.deepEqual(entry.head, previous);
        const next = await decodeJournal(previous, entry.record);
        ops.push(...next.operations);
        previous = { ...previous, cursor: next.toCursor, lastHash: entry.record.hash };
      }
      return replayJournal(base, { epoch: "experiment", cursor: baseCursor }, ops);
    },
  };
  function makeReadHead() {
    return persisted[0]?.head ?? head!;
  }
}

test("controlled delayed writes: identical pending400-op tails require40 baseline appends versus5 coalesced, with exact hashed replay", async () => {
  const measurements = [];
  for (const [label, Controller] of [
    ["baseline", Baseline],
    ["coalesced", LiveJournal],
  ] as const) {
    const h = harness(Controller);
    await h.controller.checkpoint();
    await turn();
    for (let from = 0; from < 400; from += 10) {
      h.advance(from + 10);
      h.controller.accept(batch(from));
    }
    await h.drain();
    assert.equal(
      canonicalState(await h.restored()),
      canonicalState(
        replayJournal(initial, { epoch: "experiment", cursor: 0 }, operations.slice(0, 400)),
      ),
    );
    assert.equal(h.controller.status().handle?.cursor, 400);
    assert.equal(h.writes.length, label === "baseline" ? 40 : 5);
    measurements.push({
      label,
      appendTransactions: h.writes.length,
      operationsPerTransaction: h.writes,
      finalCursor: 400,
      exactHashedReplay: true,
    });
    await h.controller.dispose();
  }
  await mkdir("artifacts/social-engine/input-visibility-recovery", { recursive: true });
  await writeFile(
    "artifacts/social-engine/input-visibility-recovery/coalescing-controlled.json",
    JSON.stringify(
      {
        scope:
          "Controlled delayed fake-repository transaction counts only; not native IndexedDB timing or hardware performance",
        measurements,
      },
      null,
      2,
    ),
  );
});

test("overflow during an in-flight merged append checkpoints exact authority without duplicate or lost operations", async () => {
  const h = harness();
  await h.controller.checkpoint();
  await turn();
  for (let from = 0; from < 400; from += 10) {
    h.advance(from + 10);
    h.controller.accept(batch(from));
  }
  await h.release();
  assert.equal(h.writes[1], 120);
  for (let from = 400; from < 900; from += 10) {
    h.advance(from + 10);
    h.controller.accept(batch(from));
  }
  assert.equal(h.controller.status().pendingOperations, 600);
  await h.drain();
  assert.deepEqual(h.snapshots, [900]);
  assert.equal(h.controller.status().handle?.cursor, 900);
  assert.equal(canonicalState(await h.restored()), canonicalState(authority));
  await h.controller.dispose();
});

for (const bad of ["gap", "duplicate", "epoch", "internal cursor"] as const)
  test(`bad ${bad} is rejected before overflow or coalescing can conceal it`, async () => {
    const h = harness();
    await h.controller.checkpoint();
    await turn();
    h.advance(10);
    h.controller.accept(batch(0));
    const next = batch(10);
    if (bad === "gap") {
      next.fromCursor++;
      next.toCursor++;
      next.operations.forEach((op) => op.cursor++);
    }
    if (bad === "duplicate") {
      Object.assign(next, batch(0));
    }
    if (bad === "epoch") next.epoch = "other";
    if (bad === "internal cursor") next.operations[3].cursor++;
    h.controller.accept(next);
    assert.equal(h.errors.length, 1);
    assert.ok(h.controller.status().failed);
    h.pending.shift()!();
    await turn();
    await h.controller.dispose();
    assert.equal(h.writes.length, 1, "invalid operations never appended");
  });

test("coalescing respects UTF-8 byte cap, operation cap and remaining durable-tail budget", async () => {
  const large = (from: number) => {
    const b = batch(from, 1);
    b.operations = [
      {
        type: "APPLY_WHILE_PAUSED",
        tick: 0,
        cursor: from + 1,
        commands: [
          { v: 1, id: `large:${from}`, type: "UNKNOWN", args: { text: "ş".repeat(17000) } },
        ],
      },
    ];
    return b;
  };
  assert.equal(coalesceJournalPrefix([large(0), large(1)], 0).toCursor, 1);
  assert.equal(
    coalesceJournalPrefix(
      Array.from({ length: 20 }, (_, i) => batch(i * 10)),
      0,
    ).operations.length,
    120,
  );
  assert.equal(coalesceJournalPrefix([batch(580), batch(590), batch(600)], 0).toCursor, 600);
  assert.throws(() => coalesceJournalPrefix([batch(0), batch(20)], 0), /sıra/);
});
