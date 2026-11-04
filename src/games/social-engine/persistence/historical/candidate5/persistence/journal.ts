import type { Command, WorldState } from "../domain/types.ts";
import { applyCommand, stepWorld, validateState } from "../simulation/engine.ts";
import { assertJsonTree, SaveError, sha256, type SaveEnvelope } from "./codec.ts";
export type JournalPoint = { epoch: string; cursor: number };
export type JournalOperation =
  | { cursor: number; type: "TICK"; endingTick: number; commands: Command[] }
  | { cursor: number; type: "APPLY_WHILE_PAUSED"; tick: number; commands: Command[] }
  | { cursor: number; type: "PAUSE_CONTROL"; tick: number; paused: boolean };
export type JournalBatch = {
  epoch: string;
  fromCursor: number;
  toCursor: number;
  operations: JournalOperation[];
};
export type JournalHandle = {
  slotId: "auto";
  baseRevisionId: string;
  epoch: string;
  baseCursor: number;
  cursor: number;
  lastHash: string;
};
export type JournalMeta = JournalHandle & {
  baseTick: number;
  currentTick: number;
  baseHash: string;
  bytes: number;
};
export type StoredJournalBatch = {
  id: string;
  format: "social-engine-command-journal";
  version: 1;
  slotId: "auto";
  baseRevisionId: string;
  epoch: string;
  fromCursor: number;
  toCursor: number;
  previousHash: string;
  hash: string;
  byteLength: number;
  payload: string;
};
export const MAX_JOURNAL_OPERATIONS = 600,
  MAX_JOURNAL_BYTES = 2 * 1024 * 1024,
  MAX_BATCH_BYTES = 64 * 1024;
const integer = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;
export function assertJournalPoint(point: JournalPoint): void {
  if (
    !point ||
    typeof point.epoch !== "string" ||
    !/^[\w:.-]{1,120}$/.test(point.epoch) ||
    !integer(point.cursor)
  )
    throw new SaveError("JOURNAL_CORRUPT", "Oyun günlüğü işaretçisi geçersiz.");
}
function canonical(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([k, item]) => [k, sort(item)]),
          )
        : v;
  return JSON.stringify(sort(value));
}
export function assertJournalBatch(batch: JournalBatch): void {
  assertJsonTree(batch);
  assertJournalPoint({ epoch: batch.epoch, cursor: batch.fromCursor });
  if (
    !integer(batch.toCursor) ||
    !Array.isArray(batch.operations) ||
    batch.operations.length < 1 ||
    batch.operations.length > 128 ||
    batch.toCursor !== batch.fromCursor + batch.operations.length
  )
    throw new SaveError("JOURNAL_CORRUPT", "Oyun günlüğü sıra aralığı geçersiz.");
  for (const [index, op] of batch.operations.entries()) {
    if (!op || op.cursor !== batch.fromCursor + index + 1)
      throw new SaveError("JOURNAL_CORRUPT", "Oyun günlüğünde sıra boşluğu var.");
    if (op.type === "PAUSE_CONTROL") {
      if (!integer(op.tick) || typeof op.paused !== "boolean")
        throw new SaveError("JOURNAL_CORRUPT", "Duraklatma kaydı geçersiz.");
    } else if (op.type === "TICK" || op.type === "APPLY_WHILE_PAUSED") {
      if (
        !integer(op.type === "TICK" ? op.endingTick : op.tick) ||
        !Array.isArray(op.commands) ||
        op.commands.length > 200
      )
        throw new SaveError("JOURNAL_CORRUPT", "Komut grubu geçersiz.");
      for (const c of op.commands)
        if (
          !c ||
          c.v !== 1 ||
          typeof c.id !== "string" ||
          !/^[\w:.-]{1,120}$/.test(c.id) ||
          typeof c.type !== "string" ||
          !c.args ||
          typeof c.args !== "object" ||
          Array.isArray(c.args)
        )
          throw new SaveError("JOURNAL_CORRUPT", "Günlük komutu geçersiz.");
    } else throw new SaveError("JOURNAL_CORRUPT", "Bilinmeyen günlük işlemi.");
  }
}
export function sameJournal(
  a: JournalHandle | null | undefined,
  b: JournalHandle | null | undefined,
): boolean {
  return (
    (!a && !b) ||
    (!!a &&
      !!b &&
      a.baseRevisionId === b.baseRevisionId &&
      a.epoch === b.epoch &&
      a.baseCursor === b.baseCursor &&
      a.cursor === b.cursor &&
      a.lastHash === b.lastHash)
  );
}
export async function newJournalMeta(
  envelope: SaveEnvelope,
  point: JournalPoint,
): Promise<JournalMeta> {
  assertJournalPoint(point);
  const baseHash = await sha256(
    canonical({
      format: "social-engine-journal-base",
      revision: envelope.revisionId,
      sha256: envelope.sha256,
      epoch: point.epoch,
      cursor: point.cursor,
      tick: envelope.tick,
    }),
  );
  return {
    slotId: "auto",
    baseRevisionId: envelope.revisionId,
    epoch: point.epoch,
    baseCursor: point.cursor,
    cursor: point.cursor,
    lastHash: baseHash,
    baseHash,
    baseTick: envelope.tick,
    currentTick: envelope.tick,
    bytes: 0,
  };
}
export async function encodeJournal(
  handle: JournalHandle,
  batch: JournalBatch,
): Promise<StoredJournalBatch> {
  assertJournalBatch(batch);
  if (batch.epoch !== handle.epoch || batch.fromCursor !== handle.cursor)
    throw new SaveError("WRITE_CONFLICT", "Oyun günlüğü başka bir sıraya ilerledi.");
  const payload = canonical(batch),
    byteLength = new TextEncoder().encode(payload).byteLength;
  if (byteLength > MAX_BATCH_BYTES)
    throw new SaveError("JOURNAL_LIMIT", "Günlük grubu doldu; yeni anlık kayıt gerekiyor.");
  const record = {
    id: `${handle.baseRevisionId}:${handle.epoch}:${batch.toCursor}`,
    format: "social-engine-command-journal" as const,
    version: 1 as const,
    slotId: "auto" as const,
    baseRevisionId: handle.baseRevisionId,
    epoch: batch.epoch,
    fromCursor: batch.fromCursor,
    toCursor: batch.toCursor,
    previousHash: handle.lastHash,
    byteLength,
    payload,
  };
  return { ...record, hash: await sha256(canonical(record)) };
}
export async function decodeJournal(handle: JournalHandle, value: unknown): Promise<JournalBatch> {
  assertJsonTree(value);
  const record = value as StoredJournalBatch;
  if (
    !record ||
    record.format !== "social-engine-command-journal" ||
    record.version !== 1 ||
    record.slotId !== "auto" ||
    record.baseRevisionId !== handle.baseRevisionId ||
    record.epoch !== handle.epoch ||
    record.fromCursor !== handle.cursor ||
    record.previousHash !== handle.lastHash ||
    typeof record.payload !== "string" ||
    record.byteLength !== new TextEncoder().encode(record.payload).byteLength ||
    record.byteLength > MAX_BATCH_BYTES
  )
    throw new SaveError("JOURNAL_CORRUPT", "Günlük zinciri veya boyutu eşleşmiyor.");
  let batch: JournalBatch;
  try {
    batch = JSON.parse(record.payload);
  } catch {
    throw new SaveError("JOURNAL_CORRUPT", "Günlük okunamadı.");
  }
  const expected = await encodeJournal(handle, batch);
  if (
    expected.hash !== record.hash ||
    expected.id !== record.id ||
    batch.toCursor !== record.toCursor
  )
    throw new SaveError("CHECKSUM_MISMATCH", "Günlük sağlama toplamı doğrulanamadı.");
  return batch;
}
/** Pure deterministic replay on an owned copy. Rendering and wall-clock time are absent. */
export function replayJournal(
  snapshot: WorldState,
  point: JournalPoint,
  operations: JournalOperation[],
  sourceSchema = snapshot.schemaVersion,
): WorldState {
  assertJournalPoint(point);
  if (operations.length > MAX_JOURNAL_OPERATIONS)
    throw new SaveError("JOURNAL_LIMIT", "Günlük yeniden oynatma sınırı aşıldı.");
  const state = structuredClone(snapshot);
  // An unknown v5 command was a recorded rejection, not a future permission.
  const historical = (c: Command): Command =>
    sourceSchema <= 5 && (c.type === "TAKE_STOCK" || c.type === "RETURN_STOCK")
      ? { ...c, type: "UNKNOWN_IN_SOURCE_VERSION" }
      : c;
  let cursor = point.cursor;
  for (const op of operations) {
    assertJournalBatch({
      epoch: point.epoch,
      fromCursor: cursor,
      toCursor: cursor + 1,
      operations: [op],
    });
    if (op.type === "TICK") {
      if (op.endingTick < state.tick || op.endingTick > state.tick + 1)
        throw new SaveError("JOURNAL_CORRUPT", "Oyun günlüğünde saat boşluğu var.");
      stepWorld(state, sourceSchema <= 5 ? op.commands.map(historical) : op.commands);
      if (state.tick !== op.endingTick)
        throw new SaveError("JOURNAL_CORRUPT", "Oyun günlüğü gerçekleşen saatle eşleşmiyor.");
    } else if (op.type === "APPLY_WHILE_PAUSED") {
      if (op.tick !== state.tick)
        throw new SaveError("JOURNAL_CORRUPT", "Duraklatılmış komut saati eşleşmiyor.");
      for (const command of op.commands) applyCommand(state, historical(command));
    } else {
      if (op.tick !== state.tick)
        throw new SaveError("JOURNAL_CORRUPT", "Duraklatma saati eşleşmiyor.");
      if (op.paused) {
        state.flags.moveX = 0;
        state.flags.moveY = 0;
        state.flags.throttle = 0;
        state.flags.steer = 0;
      }
    }
    cursor = op.cursor;
  }
  const errors = validateState(state);
  if (errors.length)
    throw new SaveError(
      "INVALID_STATE",
      `Günlük sonrası dünya geçersiz: ${errors.slice(0, 4).join(", ")}`,
    );
  return state;
}
