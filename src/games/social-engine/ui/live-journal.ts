import type { WorldState } from "../domain/types.ts";
import type { JournalBatch, JournalHandle, JournalPoint } from "../persistence/journal.ts";
import { assertJournalBatch } from "../persistence/journal.ts";
import { coalesceJournalPrefix } from "./journal-mailbox.ts";
import { SaveError } from "../persistence/codec.ts";

type Snapshot = { state: WorldState; point: JournalPoint };
/** A pause can advance the journal while authoritative game time stays fixed. */
export function recoveryIsNewer(
  knownTick: number,
  known: JournalPoint | undefined,
  restoredTick: number,
  restored: JournalPoint | null,
): boolean {
  if (known && restored) return known.epoch === restored.epoch && restored.cursor >= known.cursor;
  return restoredTick > knownTick;
}

type Repository = {
  beginJournal(
    slot: "auto",
    state: WorldState,
    point: JournalPoint,
    expected: JournalHandle | null,
  ): Promise<JournalHandle>;
  checkpointJournal(
    handle: JournalHandle,
    state: WorldState,
    point: JournalPoint,
  ): Promise<JournalHandle>;
  appendJournal(handle: JournalHandle, batch: JournalBatch): Promise<JournalHandle>;
};
/** One writer and a bounded mailbox. Overflow asks authority for a new snapshot;
 * only operations covered by its cursor are discarded. No world state is rebuilt in the UI. */
export class LiveJournal {
  private handle: JournalHandle | null = null;
  private batches: JournalBatch[] = [];
  private gapCursor = 0;
  private receivedPoint: JournalPoint | null = null;
  private running: Promise<void> | null = null;
  private closed = false;
  private failure: Error | null = null;
  private waits: { resolve: (state: WorldState) => void; reject: (error: Error) => void }[] = [];
  private highWater = 0;
  private repository: Repository;
  private expected: JournalHandle | null;
  private takeSnapshot: () => Promise<Snapshot>;
  private onSnapshot: (snapshot: Snapshot) => void;
  private onError: (error: Error) => void;
  constructor(
    repository: Repository,
    expected: JournalHandle | null,
    takeSnapshot: () => Promise<Snapshot>,
    onSnapshot: (snapshot: Snapshot) => void,
    onError: (error: Error) => void,
  ) {
    this.repository = repository;
    this.expected = expected;
    this.takeSnapshot = takeSnapshot;
    this.onSnapshot = onSnapshot;
    this.onError = onError;
  }
  status() {
    return {
      handle: this.handle,
      pendingOperations: this.batches.reduce((n, b) => n + b.operations.length, 0),
      highWater: this.highWater,
      failed: this.failure?.message ?? null,
      closed: this.closed,
    };
  }
  accept(batch: JournalBatch) {
    if (this.closed || this.failure) return;
    try {
      assertJournalBatch(batch);
      if (
        (this.handle && batch.epoch !== this.handle.epoch) ||
        (this.receivedPoint &&
          (batch.epoch !== this.receivedPoint.epoch ||
            batch.fromCursor !== this.receivedPoint.cursor))
      )
        throw new Error("Oyun günlüğünde oturum veya sıra boşluğu var.");
      this.receivedPoint = { epoch: batch.epoch, cursor: batch.toCursor };
    } catch (error) {
      this.fail(error);
      return;
    }
    this.batches.push(batch);
    let count = this.batches.reduce((n, b) => n + b.operations.length, 0);
    while (count > 600) {
      const dropped = this.batches.shift()!;
      this.gapCursor = Math.max(this.gapCursor, dropped.toCursor);
      count -= dropped.operations.length;
    }
    this.highWater = Math.max(this.highWater, count);
    this.kick();
  }
  checkpoint(): Promise<WorldState> {
    if (this.failure || this.closed)
      return Promise.reject(this.failure ?? new Error("Oyun günlüğü kapandı."));
    const promise = new Promise<WorldState>((resolve, reject) =>
      this.waits.push({ resolve, reject }),
    );
    this.kick();
    return promise;
  }
  async dispose(): Promise<void> {
    this.closed = true;
    this.batches = [];
    const error = new Error("Oyun oturumu değişti.");
    this.waits.splice(0).forEach((w) => w.reject(error));
    await this.running;
  }
  private kick() {
    if (this.running || this.closed || this.failure) return;
    this.running = this.drain().finally(() => {
      this.running = null;
      if (!this.closed && !this.failure && (this.batches.length || this.waits.length)) this.kick();
    });
  }
  private fail(error: unknown) {
    if (this.failure) return;
    this.failure = error instanceof Error ? error : new Error(String(error));
    this.batches = [];
    this.waits.splice(0).forEach((w) => w.reject(this.failure!));
    if (!this.closed) this.onError(this.failure);
  }
  private async drain() {
    try {
      while (
        !this.closed &&
        !this.failure &&
        (!this.handle || this.batches.length || this.waits.length)
      ) {
        const first = this.batches[0];
        if (
          !this.handle ||
          this.waits.length ||
          this.gapCursor > this.handle.cursor ||
          (first && first.toCursor - this.handle.baseCursor > 500)
        ) {
          const waiting = this.waits.splice(0);
          try {
            const snapshot = await this.takeSnapshot();
            if (this.closed || this.failure)
              throw this.failure ?? new Error("Oyun oturumu değişti.");
            this.handle = this.handle
              ? await this.repository.checkpointJournal(this.handle, snapshot.state, snapshot.point)
              : await this.repository.beginJournal(
                  "auto",
                  snapshot.state,
                  snapshot.point,
                  this.expected,
                );
            if (this.failure) throw this.failure;
            this.batches = this.batches.flatMap((batch) => {
              if (batch.epoch !== snapshot.point.epoch)
                throw new Error("Oyun günlüğü başka bir oturuma ait.");
              const operations = batch.operations.filter((op) => op.cursor > snapshot.point.cursor);
              return operations.length
                ? [{ ...batch, fromCursor: operations[0].cursor - 1, operations }]
                : [];
            });
            this.onSnapshot(snapshot);
            waiting.forEach((w) => w.resolve(snapshot.state));
          } catch (error) {
            waiting.forEach((w) => w.reject(error as Error));
            throw error;
          }
        } else if (first) {
          try {
            const merged = coalesceJournalPrefix(this.batches, this.handle.baseCursor);
            this.handle = await this.repository.appendJournal(this.handle, merged);
            // Overflow may evict any prefix while the merged append is in flight.
            // Remove only batches actually covered by the successfully committed cursor.
            this.batches = this.batches.filter((batch) => batch.toCursor > this.handle!.cursor);
          } catch (error) {
            if (error instanceof SaveError && error.code === "JOURNAL_LIMIT") {
              this.gapCursor = Math.max(this.gapCursor, first.toCursor);
              continue;
            }
            throw error;
          }
        }
      }
    } catch (error) {
      this.fail(error);
    }
  }
}
