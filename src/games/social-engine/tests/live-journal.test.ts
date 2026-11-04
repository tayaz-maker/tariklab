import test from "node:test";
import assert from "node:assert/strict";
import { LiveJournal, recoveryIsNewer } from "../ui/live-journal.ts";
import { SaveError } from "../persistence/codec.ts";
import type { JournalBatch, JournalHandle, JournalPoint } from "../persistence/journal.ts";
import type { WorldState } from "../domain/types.ts";
const defer = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const settled = () => new Promise<void>((r) => setImmediate(r));
const batch = (from: number, to = from + 10): JournalBatch => ({
  epoch: "live",
  fromCursor: from,
  toCursor: to,
  operations: Array.from({ length: to - from }, (_, i) => ({
    type: "TICK",
    cursor: from + i + 1,
    endingTick: from + i + 1,
    commands: [],
  })),
});
function harness() {
  let cursor = 0,
    revision = 0;
  let durable: JournalHandle | null = null;
  const errors: Error[] = [],
    snapshots: number[] = [],
    appended: number[] = [];
  const makeHead = (point: JournalPoint): JournalHandle => ({
    slotId: "auto",
    epoch: point.epoch,
    baseRevisionId: `rev${++revision}`,
    baseCursor: point.cursor,
    cursor: point.cursor,
    lastHash: `hash${revision}`,
  });
  const repo = {
    async beginJournal(
      _slot: "auto",
      _state: WorldState,
      point: JournalPoint,
      expected: JournalHandle | null,
    ) {
      assert.deepEqual(expected, durable);
      return (durable = makeHead(point));
    },
    async checkpointJournal(handle: JournalHandle, _state: WorldState, point: JournalPoint) {
      assert.deepEqual(handle, durable);
      assert.ok(point.cursor >= handle.cursor);
      return (durable = makeHead(point));
    },
    async appendJournal(handle: JournalHandle, next: JournalBatch) {
      assert.deepEqual(handle, durable);
      assert.equal(handle.cursor, next.fromCursor);
      assert.equal(handle.epoch, next.epoch);
      appended.push(next.toCursor);
      return (durable = { ...handle, cursor: next.toCursor, lastHash: `tail${next.toCursor}` });
    },
  };
  const takeSnapshot = async () => ({
    state: { tick: cursor } as WorldState,
    point: { epoch: "live", cursor },
  });
  const live = new LiveJournal(
    repo,
    null,
    takeSnapshot,
    (s) => snapshots.push(s.point.cursor),
    (e) => errors.push(e),
  );
  return {
    live,
    repo,
    errors,
    snapshots,
    appended,
    advance: (n: number) => {
      cursor = n;
    },
  };
}
test("live journal bounds a blocked IndexedDB mailbox and compacts only with an authoritative covering snapshot", async () => {
  const h = harness(),
    gate = defer(),
    original = h.repo.beginJournal;
  h.repo.beginJournal = async (...args) => {
    await gate.promise;
    return original(...args);
  };
  const initial = h.live.checkpoint();
  await settled();
  for (let i = 0; i < 1700; i += 10) {
    h.advance(i + 10);
    h.live.accept(batch(i));
  }
  assert.equal(h.live.status().pendingOperations, 600);
  gate.resolve();
  await initial;
  await settled();
  assert.deepEqual(h.snapshots, [0, 1700]);
  assert.equal(h.live.status().handle?.cursor, 1700);
  assert.equal(h.live.status().highWater, 600);
  assert.deepEqual(h.errors, []);
  h.advance(1710);
  h.live.accept(batch(1700));
  await settled();
  assert.deepEqual(h.appended, [1710]);
  await h.live.dispose();
});
test("operations arriving during snapshot commit remain replayable after its exact cursor", async () => {
  const h = harness();
  await h.live.checkpoint();
  const gate = defer(),
    original = h.repo.checkpointJournal;
  h.repo.checkpointJournal = async (...args) => {
    await gate.promise;
    return original(...args);
  };
  h.advance(100);
  const saved = h.live.checkpoint();
  await settled();
  h.advance(110);
  h.live.accept(batch(100));
  gate.resolve();
  await saved;
  await settled();
  assert.deepEqual(h.snapshots, [0, 100]);
  assert.deepEqual(h.appended, [110]);
  assert.equal(h.live.status().handle?.baseCursor, 100);
  assert.equal(h.live.status().handle?.cursor, 110);
  await h.live.dispose();
});
test("competing-tab CAS failure disables automatic writes without retrying ownership or claiming persistence", async () => {
  const h = harness();
  await h.live.checkpoint();
  let writes = 0;
  h.repo.appendJournal = async () => {
    writes++;
    throw new SaveError("WRITE_CONFLICT", "Different tab owns current tail");
  };
  h.advance(10);
  h.live.accept(batch(0));
  await settled();
  h.advance(20);
  h.live.accept(batch(10));
  await settled();
  await assert.rejects(h.live.checkpoint(), /Different tab/);
  assert.equal(writes, 1);
  assert.equal(h.errors.length, 1);
  assert.equal(h.live.status().pendingOperations, 0);
  assert.equal(h.live.status().handle?.cursor, 0);
  await h.live.dispose();
});
test("disposing an old session waits for its in-flight write before a replacement can claim the slot", async () => {
  const h = harness(),
    gate = defer(),
    original = h.repo.beginJournal;
  h.repo.beginJournal = async (...args) => {
    await gate.promise;
    return original(...args);
  };
  const initial = h.live.checkpoint();
  await settled();
  let stopped = false;
  const close = h.live.dispose().then(() => {
    stopped = true;
  });
  await settled();
  assert.equal(stopped, false);
  gate.resolve();
  await initial;
  await close;
  assert.equal(stopped, true);
  assert.equal(h.live.status().closed, true);
  h.live.accept(batch(0));
  assert.equal(h.live.status().pendingOperations, 0);
  await assert.rejects(h.live.checkpoint(), /kapandı/);
});

test("crash recovery compares same-tick paused command cursors and the verified post-quarantine head", () => {
  const point = { epoch: "live", cursor: 20 };
  assert.equal(recoveryIsNewer(100, point, 100, { epoch: "live", cursor: 10 }), false);
  assert.equal(recoveryIsNewer(100, point, 100, { epoch: "live", cursor: 21 }), true);
  assert.equal(recoveryIsNewer(100, point, 101, { epoch: "other", cursor: 30 }), false);
  assert.equal(recoveryIsNewer(100, undefined, 100, { epoch: "live", cursor: 20 }), false);
  assert.equal(recoveryIsNewer(100, undefined, 101, { epoch: "live", cursor: 20 }), true);
});
