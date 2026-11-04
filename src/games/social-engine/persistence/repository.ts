import {
  newJournalMeta,
  encodeJournal,
  decodeJournal,
  replayJournal,
  sameJournal,
  assertJournalPoint,
  MAX_JOURNAL_OPERATIONS,
  MAX_JOURNAL_BYTES,
  type JournalPoint,
  type JournalBatch,
  type JournalHandle,
  type JournalMeta,
  type StoredJournalBatch,
} from "./journal.ts";
import type { WorldState } from "../domain/types.ts";
import {
  migrateState,
  assertSlot,
  decodeSave,
  decodeSaveText,
  encodeSave,
  SaveError,
  SLOT_IDS,
  SAVE_SCHEMA,
  type DecodedSave,
  type SaveEnvelope,
} from "./codec.ts";

export const DATABASE_NAME = "tariklab-social-engine";
export const DATABASE_VERSION = 3;
export type SlotInfo = {
  slotId: string;
  revisionId: string;
  tick: number;
  updatedAt: string;
  byteLength: number;
  recovered?: boolean;
};
type SlotRecord = SlotInfo & { previousRevisionId?: string };
type ReadResult = { slot?: SlotRecord; current?: SaveEnvelope; previous?: SaveEnvelope };
type Verified = ReadResult & { valid?: DecodedSave; invalid: SaveEnvelope[] };
type Journal = {
  id: string;
  sourceSchema: number;
  targetSchema: number;
  source: SaveEnvelope;
  createdAt: string;
  steps: number[];
  targetSha256?: string;
  sourceJournal?: { meta?: JournalMeta; records: StoredJournalBatch[] };
};
const readable = (error: unknown, fallback = "Kayıt işlemi tamamlanamadı."): SaveError => {
  if (error instanceof SaveError) return error;
  return new SaveError(
    error instanceof DOMException && error.name === "QuotaExceededError"
      ? "QUOTA_EXCEEDED"
      : "WRITE_FAILED",
    error instanceof DOMException && error.name === "QuotaExceededError"
      ? "Depolama alanı dolu. Önceki kayıt korundu; dışa aktarabilirsin."
      : fallback,
  );
};
const request = <T>(value: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
const finished = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        tx.error ?? new SaveError("WRITE_FAILED", "Kayıt işlemi kesildi; önceki sürüm korundu."),
      );
    tx.onerror = () => {
      /* onabort reports the final transaction failure */
    };
  });

/** All mutations are one IDB transaction. No legacy game namespace is accessed. */
export class SaveRepository {
  private db: Promise<IDBDatabase> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private knownHeads = new Map<string, string | undefined>();
  readonly factory: IDBFactory | undefined;
  lastRecovery: string | null = null;
  lastJournalHandle: JournalHandle | null = null;
  constructor(factory: IDBFactory | undefined = globalThis.indexedDB) {
    this.factory = factory;
  }
  private open(): Promise<IDBDatabase> {
    if (!this.factory)
      return Promise.reject(
        new SaveError("STORAGE_UNAVAILABLE", "Tarayıcı kalıcı kayıt alanını açamıyor."),
      );
    if (!this.db)
      this.db = new Promise((resolve, reject) => {
        const opening = this.factory!.open(DATABASE_NAME, DATABASE_VERSION);
        let rejected = false;
        opening.onupgradeneeded = () => {
          const db = opening.result;
          for (const [name, keyPath] of [
            ["slots", "slotId"],
            ["revisions", "revisionId"],
            ["migrationJournal", "id"],
            ["quarantine", "id"],
            ["commandJournal", "id"],
            ["journalMeta", "slotId"],
          ])
            if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
        };
        opening.onsuccess = () => {
          if (rejected) {
            opening.result.close();
            return;
          }
          opening.result.onversionchange = () => {
            opening.result.close();
            this.db = null;
          };
          resolve(opening.result);
        };
        opening.onerror = () => {
          rejected = true;
          this.db = null;
          reject(new SaveError("STORAGE_UNAVAILABLE", "Tarayıcı kayıt veritabanını açamadı."));
        };
        opening.onblocked = () => {
          rejected = true;
          this.db = null;
          reject(
            new SaveError(
              "STORAGE_UNAVAILABLE",
              "Başka bir açık oyun sekmesi kayıt alanını kilitliyor.",
            ),
          );
        };
      });
    return this.db;
  }
  private serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
  async close(): Promise<void> {
    await this.queue;
    if (this.db) (await this.db).close();
    this.db = null;
  }
  private async read(slotId: string): Promise<ReadResult> {
    assertSlot(slotId);
    const db = await this.open(),
      tx = db.transaction(["slots", "revisions"], "readonly"),
      done = finished(tx);
    try {
      const slot = (await request(tx.objectStore("slots").get(slotId))) as SlotRecord | undefined;
      if (!slot) {
        await done;
        return {};
      }
      const revisions = tx.objectStore("revisions");
      const [current, previous] = await Promise.all([
        request(revisions.get(slot.revisionId)) as Promise<SaveEnvelope | undefined>,
        slot.previousRevisionId
          ? (request(revisions.get(slot.previousRevisionId)) as Promise<SaveEnvelope | undefined>)
          : Promise.resolve(undefined),
      ]);
      await done;
      return { slot, current, previous };
    } catch (error) {
      await done.catch(() => undefined);
      throw readable(error);
    }
  }
  private async verified(slotId: string): Promise<Verified> {
    const data = await this.read(slotId),
      invalid: SaveEnvelope[] = [];
    for (const envelope of [data.current, data.previous]) {
      if (!envelope) continue;
      try {
        if (envelope.slotId !== slotId)
          throw new SaveError("INVALID_SAVE", "Kayıt yuvası kimliği eşleşmiyor.");
        const valid = await decodeSave(envelope);
        return { ...data, valid, invalid };
      } catch (error) {
        // A future schema must never silently downgrade to a previous revision.
        if (error instanceof SaveError && error.code === "UNSUPPORTED_VERSION") throw error;
        invalid.push(envelope);
      }
    }
    if (data.slot)
      throw new SaveError(
        "CHECKSUM_MISMATCH",
        "Bu yuvada sağlam kayıt bulunamadı. Dosyadan içe aktar veya farklı bir yuvada başla.",
      );
    return { ...data, invalid };
  }
  private prune(store: IDBObjectStore, limit: number): void {
    const all = store.getAllKeys();
    all.onsuccess = () => {
      for (const key of all.result.slice(0, Math.max(0, all.result.length - limit)))
        store.delete(key);
    };
  }
  private async commit(
    slotId: string,
    state: WorldState,
    journal?: Journal,
    original?: Verified,
    journalContext?: { point: JournalPoint; expected: JournalHandle | null },
    recoverJournal = false,
    replacement?: { expected: JournalHandle | null; previous?: SaveEnvelope },
  ): Promise<SlotInfo> {
    assertSlot(slotId);
    const envelope = await encodeSave(slotId, state),
      expected = original ?? (await this.verified(slotId)),
      db = await this.open();
    const nextMeta = journalContext
      ? await newJournalMeta(envelope, journalContext.point)
      : undefined;
    if (this.knownHeads.has(slotId) && this.knownHeads.get(slotId) !== expected.slot?.revisionId)
      throw new SaveError("WRITE_CONFLICT", "Bu yuva başka bir sekmede değişti. Yeniden yükle.");
    const tx = db.transaction(
        ["slots", "revisions", "migrationJournal", "quarantine", "commandJournal", "journalMeta"],
        "readwrite",
      ),
      done = finished(tx);
    let conflict: SaveError | null = null;
    const info: SlotRecord = {
      slotId,
      revisionId: envelope.revisionId,
      tick: envelope.tick,
      updatedAt: envelope.createdAt,
      byteLength: envelope.byteLength,
      ...(replacement?.previous
        ? { previousRevisionId: replacement.previous.revisionId }
        : expected.valid
          ? { previousRevisionId: expected.valid.source.revisionId }
          : {}),
    };
    const abort = (error: unknown) => {
      conflict = readable(error);
      try {
        tx.abort();
      } catch {
        /* already aborted */
      }
    };
    const read = tx.objectStore("slots").get(slotId);
    read.onsuccess = () => {
      const actual = read.result as SlotRecord | undefined;
      if (actual?.revisionId !== expected.slot?.revisionId) {
        abort(new SaveError("WRITE_CONFLICT", "Kayıt başka bir sekmede değişti."));
        return;
      }
      const metaRead = tx.objectStore("journalMeta").get(slotId);
      metaRead.onsuccess = () => {
        try {
          const meta = metaRead.result as JournalMeta | undefined;
          if (journalContext && !sameJournal(meta, journalContext.expected)) {
            abort(new SaveError("WRITE_CONFLICT", "Oyun günlüğü başka bir sekmede ilerledi."));
            return;
          }
          if (replacement && !sameJournal(meta, replacement.expected)) {
            abort(
              new SaveError(
                "WRITE_CONFLICT",
                "Değiştirilecek otomatik günlük başka sekmede ilerledi.",
              ),
            );
            return;
          }
          if (slotId === "auto" && meta && !journalContext && !recoverJournal && !replacement) {
            abort(
              new SaveError(
                "WRITE_CONFLICT",
                "Etkin oyun günlüğü için işaretçili anlık kayıt gerekli.",
              ),
            );
            return;
          }
          if (
            journalContext &&
            meta &&
            journalContext.point.epoch === meta.epoch &&
            (journalContext.point.cursor < meta.cursor || state.tick < meta.currentTick)
          ) {
            abort(new SaveError("WRITE_CONFLICT", "Anlık kayıt kalıcı günlükten eski."));
            return;
          }
          const revisions = tx.objectStore("revisions");
          revisions.put(envelope);
          if (replacement?.previous) revisions.put(replacement.previous);
          tx.objectStore("slots").put(info);
          for (const old of [expected.current, expected.previous])
            if (old && old.revisionId !== info.previousRevisionId) revisions.delete(old.revisionId);
          for (const bad of expected.invalid)
            tx.objectStore("quarantine").put({
              id: `${envelope.createdAt}:${bad.revisionId}`,
              source: bad,
              reason: "invalid-revision",
              createdAt: envelope.createdAt,
            });
          if (journal)
            tx.objectStore("migrationJournal").put({ ...journal, targetSha256: envelope.sha256 });
          if (slotId === "auto" && (nextMeta || recoverJournal || replacement)) {
            const rows = tx.objectStore("commandJournal").getAll();
            rows.onsuccess = () => {
              try {
                const batches = rows.result as StoredJournalBatch[];
                if ((recoverJournal || replacement) && (meta || batches.length))
                  tx.objectStore("quarantine").put({
                    id: `${envelope.createdAt}:journal:${envelope.revisionId}`,
                    source: { meta, batches },
                    reason: replacement ? "explicit-journal-replacement" : "invalid-journal-base",
                  });
                for (const batch of batches) tx.objectStore("commandJournal").delete(batch.id);
                this.prune(tx.objectStore("quarantine"), 8);
              } catch (error) {
                abort(error);
              }
            };
            if (nextMeta) tx.objectStore("journalMeta").put(nextMeta);
            else tx.objectStore("journalMeta").delete("auto");
          }
          this.prune(tx.objectStore("quarantine"), 8);
          // Migration provenance is immutable and retained, including the original journal tail.
        } catch (error) {
          abort(error);
        }
      };
    };
    try {
      await done;
    } catch (error) {
      throw conflict ?? readable(error);
    }
    this.knownHeads.set(slotId, info.revisionId);
    if (slotId === "auto" && (nextMeta || recoverJournal || replacement))
      this.lastJournalHandle = nextMeta ?? null;
    return info;
  }
  save(slotId: string, state: WorldState): Promise<SlotInfo> {
    // Capture immediately: changes to a caller-owned object during queued saves cannot alter this revision.
    let copy: WorldState;
    try {
      copy = structuredClone(state);
    } catch {
      return Promise.reject(new SaveError("INVALID_STATE", "Dünya anlık görüntüsü alınamadı."));
    }
    return this.serial(() => this.commit(slotId, copy));
  }
  async list(): Promise<SlotInfo[]> {
    await this.queue;
    const db = await this.open(),
      tx = db.transaction("slots", "readonly"),
      done = finished(tx);
    const rows = (await request(tx.objectStore("slots").getAll())) as SlotRecord[];
    await done;
    for (const slotId of SLOT_IDS)
      if (!this.knownHeads.has(slotId))
        this.knownHeads.set(slotId, rows.find((row) => row.slotId === slotId)?.revisionId);
    return rows
      .filter((row) => (SLOT_IDS as readonly string[]).includes(row.slotId))
      .sort(
        (a, b) =>
          SLOT_IDS.indexOf(a.slotId as (typeof SLOT_IDS)[number]) -
          SLOT_IDS.indexOf(b.slotId as (typeof SLOT_IDS)[number]),
      )
      .map(({ slotId, revisionId, tick, updatedAt, byteLength, recovered }) => ({
        slotId,
        revisionId,
        tick,
        updatedAt,
        byteLength,
        ...(recovered ? { recovered } : {}),
      }));
  }
  load(slotId: string): Promise<WorldState> {
    return this.serial(() => this.restore(slotId));
  }
  private async restore(slotId: string): Promise<WorldState> {
    this.lastRecovery = null;
    const result = await this.verified(slotId);
    if (!result.valid) throw new SaveError("EMPTY_SLOT", "Bu yuvada kayıt yok.");
    if (result.valid.migrated) {
      this.knownHeads.set(slotId, result.slot?.revisionId);
      const migrateTail =
        slotId === "auto" && result.valid.source.revisionId === result.slot?.revisionId;
      const migrationJournal = this.journal(result.valid);
      if (migrateTail) {
        result.valid.state = migrateState(
          await this.restoreJournal(
            result.valid.sourceState ?? result.valid.state,
            result.valid.source,
          ),
        );
        const history = await this.readJournalData();
        if (!sameJournal(history.meta, this.lastJournalHandle))
          throw new SaveError(
            "WRITE_CONFLICT",
            "Eski günlük geçiş sırasında ilerledi; yeniden yükle.",
          );
        migrationJournal.sourceJournal = { meta: history.meta, records: history.records };
      }
      if (slotId === "auto" && !migrateTail && result.valid.sourceSchema === 6) {
        const db = await this.open();
        const tx = db.transaction("migrationJournal", "readonly"),
          done = finished(tx);
        const archive = (await request(
          tx.objectStore("migrationJournal").get(migrationJournal.id),
        )) as Journal | undefined;
        await done;
        if (
          !archive?.sourceJournal ||
          JSON.stringify(archive.source) !== JSON.stringify(result.valid.source)
        )
          throw new SaveError(
            "JOURNAL_CORRUPT",
            "Eski kurtarma günlüğü eksik veya farklı; kaynak korundu.",
          );
        result.valid.state = migrateState(
          await this.restoreJournal(
            result.valid.sourceState!,
            result.valid.source,
            archive.sourceJournal,
          ),
        );
        if ((await encodeSave(slotId, result.valid.state)).sha256 !== archive.targetSha256)
          throw new SaveError(
            "JOURNAL_CORRUPT",
            "Eski kurtarma sonucu geçiş sağlama toplamıyla eşleşmiyor.",
          );
        migrationJournal.sourceJournal = archive.sourceJournal;
      }
      await this.commit(
        slotId,
        result.valid.state,
        migrationJournal,
        result,
        undefined,
        !migrateTail,
        migrateTail ? { expected: structuredClone(this.lastJournalHandle) } : undefined,
      );
      this.lastRecovery =
        "Eski SOCIAL ENGINE kaydı doğrulanarak güncellendi; kaynak sürüm korundu.";
    } else if (result.valid.source.revisionId !== result.slot?.revisionId) {
      // Commit the verified fallback as a new current revision; its source remains previous.
      this.knownHeads.set(slotId, result.slot?.revisionId);
      try {
        await this.commit(slotId, result.valid.state, undefined, result, undefined, true);
        this.lastRecovery = "Hasarlı son kayıt karantinaya alındı; önceki sağlam sürüm kurtarıldı.";
      } catch (error) {
        // Recovery can still return verified state if storage is full. Existing revisions remain untouched.
        if (!(error instanceof SaveError) || error.code !== "QUOTA_EXCEEDED") throw error;
        this.lastRecovery =
          "Önceki sağlam kayıt yüklendi; depolama dolu olduğu için onarım yazılamadı. Dışa aktarabilirsin.";
      }
    }
    if (!result.valid.migrated && result.valid.source.revisionId === result.slot?.revisionId)
      this.knownHeads.set(slotId, result.slot?.revisionId);
    if (slotId === "auto") {
      // A migration/recovery may have promoted a new baseline. Read its actual envelope for tail anchoring.
      const current = await this.verified(slotId);
      return this.restoreJournal(result.valid.state, current.valid!.source);
    }
    return result.valid.state;
  }
  private async readJournalData(): Promise<{
    meta?: JournalMeta;
    records: StoredJournalBatch[];
    slot?: SlotRecord;
  }> {
    const db = await this.open(),
      tx = db.transaction(["journalMeta", "commandJournal", "slots"], "readonly"),
      done = finished(tx);
    const [meta, records, slot] = await Promise.all([
      request(tx.objectStore("journalMeta").get("auto")),
      request(tx.objectStore("commandJournal").getAll()),
      request(tx.objectStore("slots").get("auto")),
    ]);
    await done;
    return {
      meta: meta as JournalMeta | undefined,
      records: records as StoredJournalBatch[],
      slot: slot as SlotRecord | undefined,
    };
  }
  async inspectJournal(): Promise<JournalHandle | null> {
    await this.queue;
    const data = await this.readJournalData();
    if (data.meta) assertJournalPoint(data.meta);
    this.knownHeads.set("auto", data.slot?.revisionId);
    this.lastJournalHandle = data.meta ?? null;
    return structuredClone(this.lastJournalHandle);
  }
  beginJournal(
    slotId: "auto",
    state: WorldState,
    point: JournalPoint,
    expected: JournalHandle | null,
  ): Promise<JournalHandle> {
    if (slotId !== "auto")
      return Promise.reject(
        new SaveError("INVALID_SLOT", "Komut günlüğü yalnız otomatik yuvada kullanılır."),
      );
    const copy = structuredClone(state),
      p = structuredClone(point),
      head = structuredClone(expected);
    return this.serial(async () => {
      assertJournalPoint(p);
      await this.commit("auto", copy, undefined, undefined, { point: p, expected: head });
      return structuredClone(this.lastJournalHandle!);
    });
  }
  checkpointJournal(
    handle: JournalHandle,
    state: WorldState,
    point: JournalPoint,
  ): Promise<JournalHandle> {
    const copy = structuredClone(state),
      p = structuredClone(point),
      head = structuredClone(handle);
    return this.serial(async () => {
      assertJournalPoint(p);
      if (p.epoch !== head.epoch || p.cursor < head.cursor)
        throw new SaveError("WRITE_CONFLICT", "Günlükten eski veya başka oturumdan anlık kayıt.");
      await this.commit("auto", copy, undefined, undefined, { point: p, expected: head });
      return structuredClone(this.lastJournalHandle!);
    });
  }
  appendJournal(handle: JournalHandle, batch: JournalBatch): Promise<JournalHandle> {
    const head = structuredClone(handle),
      copy = structuredClone(batch);
    return this.serial(async () => {
      const record = await encodeJournal(head, copy),
        db = await this.open();
      const tx = db.transaction(["slots", "journalMeta", "commandJournal"], "readwrite"),
        done = finished(tx);
      let failure: SaveError | null = null,
        result: JournalMeta | undefined;
      const abort = (e: unknown) => {
        failure = readable(e);
        try {
          tx.abort();
        } catch {
          /* already aborted */
        }
      };
      const metaRead = tx.objectStore("journalMeta").get("auto");
      metaRead.onsuccess = () => {
        try {
          const meta = metaRead.result as JournalMeta | undefined;
          if (!meta || meta.baseRevisionId !== head.baseRevisionId || meta.epoch !== head.epoch) {
            abort(new SaveError("WRITE_CONFLICT", "Günlük anlık kaydı başka bir oturuma geçti."));
            return;
          }
          const existing = tx.objectStore("commandJournal").get(record.id);
          existing.onsuccess = () => {
            try {
              const prior = existing.result as StoredJournalBatch | undefined;
              if (prior && prior.hash === record.hash && meta.cursor >= record.toCursor) {
                result = meta;
                return;
              }
              if (prior || !sameJournal(meta, head)) {
                abort(
                  new SaveError(
                    "WRITE_CONFLICT",
                    "Günlükte aynı sıra başka içerikle kaydedilmiş veya ilerlemiş.",
                  ),
                );
                return;
              }
              if (
                record.toCursor - meta.baseCursor > MAX_JOURNAL_OPERATIONS ||
                meta.bytes + record.byteLength > MAX_JOURNAL_BYTES
              ) {
                abort(
                  new SaveError("JOURNAL_LIMIT", "Günlük sınırına ulaştı; anlık kayıt gerekiyor."),
                );
                return;
              }
              let tick = meta.currentTick;
              for (const op of copy.operations) {
                const next = op.type === "TICK" ? op.endingTick : op.tick;
                if (op.type === "TICK" ? next < tick || next > tick + 1 : next !== tick) {
                  abort(new SaveError("JOURNAL_CORRUPT", "Günlük saat sırası kesildi."));
                  return;
                }
                tick = next;
              }
              result = {
                ...meta,
                cursor: record.toCursor,
                lastHash: record.hash,
                currentTick: tick,
                bytes: meta.bytes + record.byteLength,
              };
              tx.objectStore("commandJournal").put(record);
              tx.objectStore("journalMeta").put(result);
            } catch (e) {
              abort(e);
            }
          };
        } catch (e) {
          abort(e);
        }
      };
      try {
        await done;
      } catch (e) {
        throw failure ?? readable(e);
      }
      if (!result) throw new SaveError("WRITE_FAILED", "Günlük yazımı sonuçlanmadı.");
      this.lastJournalHandle = result;
      return structuredClone(result);
    });
  }
  private async restoreJournal(
    snapshot: WorldState,
    envelope: SaveEnvelope,
    archive?: { meta?: JournalMeta; records: StoredJournalBatch[] },
  ): Promise<WorldState> {
    const { meta, records } = archive ?? (await this.readJournalData());
    if (!meta) {
      if (envelope.schemaVersion === 6 && records.length)
        throw new SaveError("JOURNAL_CORRUPT", "Eski günlük işaretçisi eksik; kaynak korundu.");
      this.lastJournalHandle = null;
      return snapshot;
    }
    let base: JournalMeta,
      handle: JournalMeta,
      validRecords: StoredJournalBatch[] = [],
      operations: JournalBatch["operations"] = [],
      bad = false;
    const ordered = records
      .filter((r) => r.baseRevisionId === meta.baseRevisionId && r.epoch === meta.epoch)
      .sort((a, b) => a.fromCursor - b.fromCursor);
    try {
      if (envelope.schemaVersion === 6 && ordered.length !== records.length)
        throw new SaveError("JOURNAL_CORRUPT", "Eski günlükte sahipsiz kayıt var.");
      assertJournalPoint({ epoch: meta.epoch, cursor: meta.baseCursor });
      base = await newJournalMeta(envelope, { epoch: meta.epoch, cursor: meta.baseCursor });
      if (
        meta.baseRevisionId !== envelope.revisionId ||
        meta.baseTick !== snapshot.tick ||
        meta.baseHash !== base.baseHash ||
        !Number.isSafeInteger(meta.cursor) ||
        meta.cursor < meta.baseCursor ||
        meta.cursor - meta.baseCursor > MAX_JOURNAL_OPERATIONS
      )
        throw new SaveError("JOURNAL_CORRUPT", "Günlüğün anlık kayıt bağı eşleşmiyor.");
      handle = { ...base };
      for (const record of ordered) {
        try {
          const batch = await decodeJournal(handle, record);
          if (
            batch.toCursor > meta.cursor ||
            operations.length + batch.operations.length > MAX_JOURNAL_OPERATIONS ||
            handle.bytes + record.byteLength > MAX_JOURNAL_BYTES
          )
            throw new SaveError("JOURNAL_LIMIT", "Günlük kaydı işaretçi sınırını aşıyor.");
          operations.push(...batch.operations);
          validRecords.push(record);
          handle = {
            ...handle,
            cursor: batch.toCursor,
            lastHash: record.hash,
            bytes: handle.bytes + record.byteLength,
          };
        } catch {
          bad = true;
          break;
        }
      }
      if (
        handle.cursor !== meta.cursor ||
        handle.lastHash !== meta.lastHash ||
        handle.bytes !== meta.bytes
      )
        bad = true;
    } catch {
      bad = true;
      const epoch =
        typeof meta.epoch === "string" && /^[\w:.-]{1,120}$/.test(meta.epoch)
          ? meta.epoch
          : crypto.randomUUID();
      base = await newJournalMeta(envelope, { epoch, cursor: 0 });
      handle = { ...base };
      validRecords = [];
      operations = [];
    }
    if (bad && envelope.schemaVersion === 6)
      throw new SaveError("JOURNAL_CORRUPT", "Eski günlük doğrulanamadı; kaynak korundu.");
    let state: WorldState;
    try {
      state = replayJournal(
        snapshot,
        { epoch: base.epoch, cursor: base.baseCursor },
        operations,
        envelope.schemaVersion,
      );
    } catch (error) {
      if (envelope.schemaVersion === 6) throw error;
      // Rare semantic corruption: find the longest invariant-valid whole-batch prefix, retaining its exact source.
      bad = true;
      state = structuredClone(snapshot);
      while (validRecords.length) {
        validRecords.pop();
        operations = validRecords.flatMap(
          (r) => (JSON.parse(r.payload) as JournalBatch).operations,
        );
        try {
          state = replayJournal(
            snapshot,
            { epoch: base.epoch, cursor: base.baseCursor },
            operations,
            envelope.schemaVersion,
          );
          break;
        } catch {
          /* bounded at600 operations */
        }
      }
      const last = validRecords.at(-1);
      handle = {
        ...base,
        cursor: last?.toCursor ?? base.baseCursor,
        lastHash: last?.hash ?? base.baseHash,
        bytes: validRecords.reduce((sum, r) => sum + r.byteLength, 0),
      };
    }
    handle.currentTick = state.tick;
    if (handle.currentTick !== meta.currentTick) bad = true;
    if (bad && envelope.schemaVersion === 6)
      throw new SaveError("JOURNAL_CORRUPT", "Eski günlük saati eşleşmiyor; kaynak korundu.");
    if (bad) {
      const keep = new Set(validRecords.map((r) => r.id)),
        discarded = records.filter((r) => !keep.has(r.id));
      const db = await this.open(),
        tx = db.transaction(["slots", "journalMeta", "commandJournal", "quarantine"], "readwrite"),
        done = finished(tx);
      let conflict = false;
      const current = tx.objectStore("journalMeta").get("auto");
      current.onsuccess = () => {
        try {
          if (!sameJournal(current.result as JournalMeta | undefined, meta)) {
            conflict = true;
            tx.abort();
            return;
          }
          const slot = tx.objectStore("slots").get("auto");
          slot.onsuccess = () => {
            try {
              if ((slot.result as SlotRecord | undefined)?.revisionId !== envelope.revisionId) {
                conflict = true;
                tx.abort();
                return;
              }
              tx.objectStore("quarantine").put({
                id: `${new Date().toISOString()}:command-journal:${crypto.randomUUID()}`,
                source: { meta, batches: discarded },
                reason: "invalid-command-journal",
              });
              for (const row of discarded) tx.objectStore("commandJournal").delete(row.id);
              tx.objectStore("journalMeta").put(handle);
              this.prune(tx.objectStore("quarantine"), 8);
            } catch {
              try {
                tx.abort();
              } catch {
                /* done */
              }
            }
          };
        } catch {
          try {
            tx.abort();
          } catch {
            /* done */
          }
        }
      };
      try {
        await done;
        this.lastRecovery = "Günlüğün sağlam bölümü oynatıldı; hasarlı kuyruk karantinaya alındı.";
      } catch (error) {
        if (conflict)
          throw new SaveError("WRITE_CONFLICT", "Günlük kurtarma sırasında başka sekmede değişti.");
        const readableError = readable(error);
        if (readableError.code !== "QUOTA_EXCEEDED") throw readableError;
        this.lastRecovery =
          "Günlüğün sağlam bölümü yüklendi; depolama dolu olduğu için onarım yazılamadı.";
        this.lastJournalHandle = meta;
        return state;
      }
    }
    this.lastJournalHandle = handle;
    return state;
  }
  private journal(save: DecodedSave): Journal {
    return {
      id: `${save.source.revisionId}:v${SAVE_SCHEMA}`,
      sourceSchema: save.sourceSchema,
      targetSchema: SAVE_SCHEMA,
      source: save.source,
      createdAt: new Date().toISOString(),
      steps: Array.from(
        { length: SAVE_SCHEMA - save.sourceSchema },
        (_, index) => save.sourceSchema + index,
      ),
    };
  }
  /** Intentional slot replacement retains the fully replayed prior state as its rollback revision. */
  private async replacement(
    slotId: string,
  ): Promise<{ expected: JournalHandle | null; previous?: SaveEnvelope } | undefined> {
    if (slotId !== "auto") return undefined;
    const expected = structuredClone(this.lastJournalHandle);
    const data = await this.readJournalData();
    if (!sameJournal(data.meta, expected))
      throw new SaveError(
        "WRITE_CONFLICT",
        "Otomatik günlük başka sekmede ilerledi. Yeniden yükle.",
      );
    if (!data.meta) return { expected };
    const current = await this.verified("auto");
    if (!current.valid || current.valid.migrated)
      throw new SaveError("WRITE_CONFLICT", "Otomatik kayıt önce doğrulanarak yüklenmeli.");
    const state = await this.restoreJournal(current.valid.state, current.valid.source);
    return { expected, previous: await encodeSave("auto", state) };
  }
  copy(source: string, target: string): Promise<void> {
    assertSlot(source);
    assertSlot(target);
    if (source === target)
      return Promise.reject(new SaveError("INVALID_SLOT", "Kaynak ve hedef yuva farklı olmalı."));
    return this.serial(async () => {
      const state = await this.restore(source);
      const replacement = await this.replacement(target);
      await this.commit(target, state, undefined, undefined, undefined, false, replacement);
    });
  }
  delete(slotId: string): Promise<void> {
    assertSlot(slotId);
    return this.serial(async () => {
      const db = await this.open(),
        tx = db.transaction(["slots", "revisions", "commandJournal", "journalMeta"], "readwrite"),
        done = finished(tx),
        slots = tx.objectStore("slots"),
        read = slots.get(slotId);
      let conflict: SaveError | null = null;
      read.onsuccess = () => {
        const slot = read.result as SlotRecord | undefined;
        if (this.knownHeads.has(slotId) && this.knownHeads.get(slotId) !== slot?.revisionId) {
          conflict = new SaveError(
            "WRITE_CONFLICT",
            "Bu yuva başka bir sekmede değişti. Yeniden yükle.",
          );
          tx.abort();
          return;
        }
        if (slotId === "auto") {
          const meta = tx.objectStore("journalMeta").get("auto");
          meta.onsuccess = () => {
            if (!sameJournal(meta.result as JournalMeta | undefined, this.lastJournalHandle)) {
              conflict = new SaveError(
                "WRITE_CONFLICT",
                "Otomatik günlük başka bir sekmede değişti.",
              );
              try {
                tx.abort();
              } catch {
                /* done */
              }
              return;
            }
            tx.objectStore("journalMeta").delete("auto");
            const rows = tx.objectStore("commandJournal").getAllKeys();
            rows.onsuccess = () => {
              for (const key of rows.result) tx.objectStore("commandJournal").delete(key);
            };
          };
        }
        if (slot) {
          tx.objectStore("revisions").delete(slot.revisionId);
          if (slot.previousRevisionId) tx.objectStore("revisions").delete(slot.previousRevisionId);
          slots.delete(slotId);
        }
      };
      try {
        await done;
        this.knownHeads.set(slotId, undefined);
        if (slotId === "auto") this.lastJournalHandle = null;
      } catch (error) {
        throw conflict ?? readable(error);
      }
    });
  }
  export(slotId: string): Promise<string> {
    return this.serial(async () => {
      return JSON.stringify(await encodeSave(slotId, await this.restore(slotId)));
    });
  }
  import(slotId: string, text: string): Promise<void> {
    assertSlot(slotId);
    return this.serial(async () => {
      const decoded = await decodeSaveText(text);
      const replacement = await this.replacement(slotId);
      await this.commit(
        slotId,
        decoded.state,
        decoded.migrated ? this.journal(decoded) : undefined,
        undefined,
        undefined,
        false,
        replacement,
      );
    });
  }
}
