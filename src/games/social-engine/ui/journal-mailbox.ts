import {
  MAX_BATCH_BYTES,
  MAX_JOURNAL_OPERATIONS,
  type JournalBatch,
} from "../persistence/journal.ts";

/** Merge only a prefix already waiting for one serial writer; never wait for more. */
export function coalesceJournalPrefix(batches: JournalBatch[], baseCursor: number): JournalBatch {
  const first = batches[0];
  if (!first) throw new Error("Oyun günlüğü kuyruğu boş.");
  let merged = first;
  for (const next of batches.slice(1)) {
    if (next.epoch !== merged.epoch || next.fromCursor !== merged.toCursor)
      throw new Error("Oyun günlüğünde oturum veya sıra boşluğu var.");
    if (
      merged.operations.length + next.operations.length > 128 ||
      next.toCursor - baseCursor > MAX_JOURNAL_OPERATIONS
    )
      break;
    const candidate = {
      epoch: merged.epoch,
      fromCursor: merged.fromCursor,
      toCursor: next.toCursor,
      operations: [...merged.operations, ...next.operations],
    };
    // Canonicalization sorts keys but preserves JSON UTF-8 byte length. The repository
    // still performs its own full validation, canonical encoding, hash and CAS check.
    if (new TextEncoder().encode(JSON.stringify(candidate)).byteLength > MAX_BATCH_BYTES) break;
    merged = candidate;
  }
  return merged;
}
