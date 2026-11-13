import { packSave, unpackSave } from "./save-codec.mjs";
import { migrateState, validateState } from "./engine.mjs";

export const SAVE_KEY = "tariklab.boardworld.v6";
export const LEGACY_V5_SAVE_KEY = "tariklab.boardworld.v5";
export const LEGACY_V5_BACKUP_KEY = `${LEGACY_V5_SAVE_KEY}.backup`;
export const ORIGINAL_V5_BACKUP_KEY = `${LEGACY_V5_SAVE_KEY}.original-v5`;
export const BACKUP_KEY = `${SAVE_KEY}.backup`;
export const LEGACY_V4_SAVE_KEY = "tariklab.boardworld.v4";
export const LEGACY_V4_BACKUP_KEY = `${LEGACY_V4_SAVE_KEY}.backup`;
export const ORIGINAL_V4_BACKUP_KEY = `${LEGACY_V4_SAVE_KEY}.original-v4`;
export const LEGACY_V3_SAVE_KEY = "tariklab.boardworld.v3";
export const LEGACY_V3_BACKUP_KEY = `${LEGACY_V3_SAVE_KEY}.backup`;
export const ORIGINAL_V3_BACKUP_KEY = `${LEGACY_V3_SAVE_KEY}.original-v3`;
export const LEGACY_V2_SAVE_KEY = "tariklab.boardworld.v2";
export const LEGACY_V2_BACKUP_KEY = `${LEGACY_V2_SAVE_KEY}.backup`;
export const ORIGINAL_V2_BACKUP_KEY = `${LEGACY_V2_SAVE_KEY}.original-v2`;
export const LEGACY_SAVE_KEY = "tariklab.boardworld.v1";
export const LEGACY_BACKUP_KEY = `${LEGACY_SAVE_KEY}.backup`;
export const ORIGINAL_V1_BACKUP_KEY = `${LEGACY_SAVE_KEY}.original-v1`;
const CURRENT_VERSION = 6;
const LEGACY_SLOTS = [
  [LEGACY_V5_SAVE_KEY, [5]],
  [LEGACY_V5_BACKUP_KEY, [5]],
  [ORIGINAL_V5_BACKUP_KEY, [5]],
  [LEGACY_V4_SAVE_KEY, [4]],
  [LEGACY_V4_BACKUP_KEY, [4]],
  [ORIGINAL_V4_BACKUP_KEY, [4]],
  [LEGACY_V3_SAVE_KEY, [3]],
  [LEGACY_V3_BACKUP_KEY, [3]],
  [ORIGINAL_V3_BACKUP_KEY, [3]],
  [LEGACY_V2_SAVE_KEY, [2]],
  [LEGACY_V2_BACKUP_KEY, [2]],
  [ORIGINAL_V2_BACKUP_KEY, [2]],
  [LEGACY_SAVE_KEY, [1, 2]],
  [LEGACY_BACKUP_KEY, [1, 2]],
  [ORIGINAL_V1_BACKUP_KEY, [1]],
];
const MAX_BYTES = 2_000_000;
const FORMAT = "tc-sim-boardworld";
// Preserve the exact imported envelope outside simulation state. The original
// version is archived before canonical writes; migration itself stays pure.
const importedLegacy = new WeakMap();
// Only immutable, already-validated canonical envelope bytes are remembered.
// No parsed state is retained. Each storage keeps at most three strings (the
// two rolling slots and the latest write); an external change is a cache miss.
const canonicalValidation = new WeakMap();
// Browser transaction adapters are short-lived. Share their bounded validation
// metadata for exact immutable bytes; never cache a head, generation or state.
const browserCanonicalValidation = new Map();
function rememberCanonical(storage, bytes) {
  let recent = canonicalValidation.get(storage);
  if (!recent) canonicalValidation.set(storage, (recent = new Map()));
  recent.delete(bytes);
  recent.set(bytes, true);
  while (recent.size > 3) recent.delete(recent.keys().next().value);
}
function inspectStored(storage, bytes) {
  if (!bytes) return null;
  if (canonicalValidation.get(storage)?.has(bytes)) {
    rememberCanonical(storage, bytes);
    return { sourceVersion: CURRENT_VERSION };
  }
  const inspected = importGame(bytes);
  if (inspected.state && inspected.sourceVersion === CURRENT_VERSION)
    rememberCanonical(storage, bytes);
  return inspected;
}

// Detect accidental corruption, not a security signature: this is a local single-player save.
function checksum(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash.toString(16).padStart(8, "0");
}
function safeTree(value, depth = 0) {
  if (depth > 16) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number")
    return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
  if (typeof value === "string") return value.length <= 12000;
  if (typeof value !== "object") return false;
  if (Array.isArray(value))
    return value.length <= 2000 && value.every((v) => safeTree(v, depth + 1));
  const keys = Object.keys(value);
  if (keys.length > 500) return false;
  for (const key of keys)
    if (
      key === "__proto__" ||
      key === "prototype" ||
      key === "constructor" ||
      !safeTree(value[key], depth + 1)
    )
      return false;
  return true;
}
function valid(state) {
  try {
    return safeTree(state) && validateState(state);
  } catch {
    return false;
  }
}
function encode(state, version, compact = false) {
  const payload = JSON.stringify(compact ? packSave(state) : state);
  const encoded = JSON.stringify({
    format: compact ? `${FORMAT}-dictionary-1` : FORMAT,
    version,
    checksum: checksum(payload),
    payload,
  });
  if (encoded.length > MAX_BYTES) throw new Error("Kayıt dosyası boyut sınırını aşıyor.");
  return encoded;
}
export function exportGame(state) {
  if (!valid(state)) throw new Error("Oyun durumu doğrulanamadı; mevcut kayıt korundu.");
  const migrated = state.version < CURRENT_VERSION;
  const current = migrated ? migrateState(state) : state;
  // A current state was just validated above. Validate again only when migration
  // creates a different state; no result is cached across calls or mutations.
  if (current.version !== CURRENT_VERSION || (migrated && !valid(current)))
    throw new Error("Kayıt geçişi doğrulanamadı; mevcut kayıt korundu.");
  return encode(current, CURRENT_VERSION, true);
}
// Compact files remain separate from the v5 browser slots until v6 migration.
export function exportCompactGame(state) {
  const verified = importGame(exportGame(state));
  if (!verified.state) throw new Error("Compact export validation failed");
  return encode(verified.state, CURRENT_VERSION, true);
}
function decode(text) {
  if (typeof text !== "string" || text.length > MAX_BYTES) throw new Error("size");
  const envelope = JSON.parse(text);
  if (
    !envelope ||
    typeof envelope !== "object" ||
    Array.isArray(envelope) ||
    Object.keys(envelope).length !== 4 ||
    !Object.keys(envelope).every((key) =>
      ["format", "version", "checksum", "payload"].includes(key),
    ) ||
    ![FORMAT, `${FORMAT}-dictionary-1`].includes(envelope.format) ||
    ![1, 2, 3, 4, 5, CURRENT_VERSION].includes(envelope.version) ||
    typeof envelope.payload !== "string" ||
    envelope.checksum !== checksum(envelope.payload)
  )
    throw new Error("envelope");
  // Verify original bytes and original schema before any migration. A damaged
  // legacy record must never gain legitimacy from new-schema defaults.
  const parsed = JSON.parse(envelope.payload);
  const original = envelope.format === FORMAT ? parsed : unpackSave(parsed);
  if (!valid(original) || original.version !== envelope.version) throw new Error("state");
  const migrated = envelope.version < CURRENT_VERSION;
  const state = migrated ? migrateState(original) : original;
  if (state.version !== CURRENT_VERSION || (migrated && !valid(state)))
    throw new Error("migration");
  if (migrated) importedLegacy.set(state, { version: envelope.version, bytes: text });
  return { state, sourceVersion: envelope.version, migrated };
}
export function importGame(text) {
  try {
    const result = decode(text);
    return {
      ...result,
      message: result.migrated
        ? `Boardworld ${result.sourceVersion}.0 kaydın doğrulandı ve 6.0’a taşındı. İlerlemen korundu.`
        : "Kayıt doğrulandı ve yüklendi.",
    };
  } catch {
    return {
      state: null,
      message:
        "Bu dosya geçerli bir Boardworld kaydı değil veya sürümü desteklenmiyor. Mevcut oyunun korundu.",
    };
  }
}
export function loadGame(storage, { promote = true } = {}) {
  try {
    storage ??= globalThis.localStorage;
    const primary = storage.getItem(SAVE_KEY);
    if (primary) {
      const loaded = importGame(primary);
      if (loaded.state && loaded.sourceVersion === CURRENT_VERSION)
        return { ...loaded, sourceKey: SAVE_KEY };
    }
    const backup = storage.getItem(BACKUP_KEY);
    if (backup) {
      const restored = importGame(backup);
      if (restored.state && restored.sourceVersion === CURRENT_VERSION)
        return {
          ...restored,
          sourceKey: BACKUP_KEY,
          message: "Ana 6.0 kaydı okunamadı. Bir önceki güvenli 6.0 kaydı kurtarıldı.",
        };
    }
    let foundLegacy = false;
    for (const [key, versions] of LEGACY_SLOTS) {
      const bytes = storage.getItem(key);
      if (!bytes) continue;
      foundLegacy = true;
      const restored = importGame(bytes);
      if (restored.state && versions.includes(restored.sourceVersion)) {
        // Still-open 1.0/2.0/3.0/4.0 tabs own their old keys. Promote a validated load
        // before returning it, closing the first-load/reload overwrite window.
        const saved = promote ? saveGame(restored.state, storage) : { ok: false };
        const recovery = [
          ORIGINAL_V1_BACKUP_KEY,
          ORIGINAL_V2_BACKUP_KEY,
          ORIGINAL_V3_BACKUP_KEY,
          ORIGINAL_V4_BACKUP_KEY,
          ORIGINAL_V5_BACKUP_KEY,
        ].includes(key)
          ? `Korunan özgün ${restored.sourceVersion}.0 kaydın kurtarıldı ve 6.0’a taşındı.`
          : primary || backup
            ? "6.0 ana kaydı ve yedeği okunamadı. Eski uyumlu kayıttan kurtarıldı; son 6.0 adımların bu kopyada bulunmayabilir."
            : `Boardworld ${restored.sourceVersion}.0 kaydın doğrulandı ve 6.0’a taşındı. İlerlemen korundu.`;
        return {
          ...restored,
          sourceKey: key,
          protected: saved.ok,
          message: saved.ok
            ? recovery
            : "Uyumlu kayıt doğrulandı ve belleğe yüklendi; ayrı 6.0 kaydı yazılamadı. Eski kayıtlar değiştirilmedi. İlerlemeni korumak için dosyaya aktar.",
        };
      }
    }
    return {
      state: null,
      message:
        primary || backup || foundLegacy
          ? "Kayıt okunamadı. Dosyadan kurtarma yapabilir veya yeni hayat başlatabilirsin."
          : "",
    };
  } catch {
    return {
      state: null,
      message: "Tarayıcı kayıt alanına erişilemiyor. Oyunu dosyaya aktararak saklayabilirsin.",
    };
  }
}
function writeChecked(storage, key, text) {
  storage.setItem(key, text);
  if (storage.getItem(key) !== text) throw new Error("verification");
}
// A token is exact slot bytes, not revision: imports/new lives and equal-revision
// forks can legitimately have unrelated counters. Callers retain it across actions.
export function readSaveToken(storage = globalThis.localStorage) {
  return { primary: storage.getItem(SAVE_KEY), backup: storage.getItem(BACKUP_KEY) };
}
export function saveGame(state, storage, expectedToken) {
  try {
    storage ??= globalThis.localStorage;
    const encoded = exportGame(state);
    const previous = storage.getItem(SAVE_KEY);
    const rolling = storage.getItem(BACKUP_KEY);
    if (
      expectedToken !== undefined &&
      (!expectedToken || previous !== expectedToken.primary || rolling !== expectedToken.backup)
    )
      return {
        ok: false,
        conflict: true,
        message:
          "Başka bir sekme kaydı değiştirdi. Bu sekmedeki ilerlemeni dosyaya aktar, sonra sayfayı yenile.",
      };
    const previousResult = inspectStored(storage, previous);
    const rollingResult = inspectStored(storage, rolling);
    const canonicalExists =
      previousResult?.sourceVersion === CURRENT_VERSION ||
      rollingResult?.sourceVersion === CURRENT_VERSION;
    const originals = new Map();
    const imported = importedLegacy.get(state);
    if (imported) originals.set(imported.version, imported.bytes);
    else if ([1, 2, 3, 4, 5].includes(state.version))
      originals.set(state.version, encode(state, state.version));
    if (!canonicalExists)
      for (const [key, versions] of LEGACY_SLOTS) {
        const bytes = storage.getItem(key);
        const legacy = bytes && importGame(bytes);
        if (
          legacy?.state &&
          versions.includes(legacy.sourceVersion) &&
          !originals.has(legacy.sourceVersion)
        )
          originals.set(legacy.sourceVersion, bytes);
      }
    for (const [version, bytes] of originals) {
      const key = {
        1: ORIGINAL_V1_BACKUP_KEY,
        2: ORIGINAL_V2_BACKUP_KEY,
        3: ORIGINAL_V3_BACKUP_KEY,
        4: ORIGINAL_V4_BACKUP_KEY,
        5: ORIGINAL_V5_BACKUP_KEY,
      }[version];
      const original = storage.getItem(key);
      if (original === null) {
        writeChecked(storage, key, bytes);
      } else if (importGame(original).sourceVersion !== version) {
        throw new Error("original-backup-damaged");
      }
    }
    // Never replace a healthy recovery slot with corrupt bytes.
    if (previousResult?.sourceVersion === CURRENT_VERSION)
      writeChecked(storage, BACKUP_KEY, previous);
    writeChecked(storage, SAVE_KEY, encoded);
    rememberCanonical(storage, encoded);
    return {
      ok: true,
      token: {
        primary: encoded,
        backup: previousResult?.sourceVersion === CURRENT_VERSION ? previous : rolling,
      },
      message: "Bu tarayıcıya kaydedildi.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Otomatik kayıt yazılamadı. İlerlemeni korumak için Kayıt → Dosyaya aktar seçeneğini kullan.",
    };
  }
}

// Every browser writer and migration promotion uses one origin-wide exclusive lock.
// The synchronous primitives remain available for deterministic isolated storage tests.
export const SAVE_LOCK = "tariklab.boardworld.v6.transaction";
const LOCK_WARNING =
  "Bu tarayıcı güvenli sekmeler arası kaydı desteklemiyor. İlerlemeni dosyaya aktar; otomatik kayıt kapalı.";
const conflict = () => ({
  ok: false,
  conflict: true,
  message:
    "Başka bir sekme kaydı değiştirdi. Bu sekmedeki ilerlemeni dosyaya aktar, sonra sayfayı yenile.",
});
const RECOVERY_WARNING =
  "Farklı bir kayıt kopyası korundu. Kayıt menüsünden indirip dosyadan yükleyebilirsin; mevcut kaydın değiştirilmedi.";
const SLOT_KEYS = [SAVE_KEY, BACKUP_KEY, ...LEGACY_SLOTS.map(([key]) => key)];
const mirrorKey = (key) => key === SAVE_KEY || key === BACKUP_KEY || key.includes(".original-v");
const memoryStorage = (slots) => ({
  getItem: (key) => slots.get(key) ?? null,
  setItem: (key, value) => slots.set(key, value),
});
function unclaimedHead(head) {
  if (!head) return true;
  // Older Gold wrote this bookkeeping record on an empty first launch.
  // Never classify a damaged or previously claimed canonical save as empty.
  if (head.claimed !== undefined || head.generation !== 1) return false;
  const slots = new Map(head.slots);
  return slots.get(SAVE_KEY) === null && slots.get(BACKUP_KEY) === null;
}
// Web Locks order callbacks, but do not refresh a renderer's localStorage cache.
// The authoritative slots AND generation therefore commit in one IDB transaction.
// localStorage is only a released-v6 compatibility copy after that commit.
async function browserTransaction(storage, operation, collectArchives = false) {
  try {
    storage ??= globalThis.localStorage;
  } catch {
    /* IDB may still be readable. */
  }
  const db = await new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(`${SAVE_KEY}.transactions`, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("state");
      request.result.createObjectStore("seen");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("blocked"));
  });
  let observed;
  try {
    // Keep the last durable snapshot for a safe export-only load if the
    // write transaction aborts. Re-read and validate its generation below.
    observed = await new Promise((resolve, reject) => {
      const tx = db.transaction("state"),
        request = tx.objectStore("state").get("head");
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
    });
    let mirror;
    try {
      mirror = new Map(SLOT_KEYS.map((key) => [key, storage.getItem(key)]));
    } catch {
      if (!observed) throw new Error("initial-storage-unavailable");
      mirror = new Map();
    }
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(["state", "seen"], "readwrite", { durability: "strict" });
      const stateStore = tx.objectStore("state"),
        recoveryStore = tx.objectStore("seen");
      let result, committed;
      tx.onabort = () => reject(tx.error || new Error("aborted"));
      tx.oncomplete = () => {
        // A mirror failure cannot undo a committed save. A later load repairs it.
        try {
          if (committed)
            for (const [key, bytes] of committed.slots)
              if (mirrorKey(key)) {
                if (bytes !== null) writeChecked(storage, key, bytes);
                else if (key === SAVE_KEY || key === BACKUP_KEY) storage.removeItem(key);
              }
        } catch {
          result.mirrorFailed = true;
        }
        resolve(result);
      };
      const read = stateStore.get("head");
      read.onsuccess = () => {
        const head = read.result;
        if (head?.generation !== observed?.generation) {
          result = conflict();
          return;
        }
        const copies = recoveryStore.get("recovery");
        copies.onsuccess = () => {
          try {
            const bootstrap = unclaimedHead(head);
            const slots = new Map(bootstrap ? mirror : head.slots);
            const recoverySaves = copies.result ?? [];
            let recovered = false;
            // Every mirror slot is independent: a known/identical primary says
            // nothing about its backup or original archives. Preserve all valid
            // divergent copies before mirror repair; NEVER adopt them.
            if (head)
              for (const [key, bytes] of mirror)
                if (
                  bytes &&
                  bytes !== slots.get(key) &&
                  bytes !== slots.get(SAVE_KEY) &&
                  bytes !== slots.get(BACKUP_KEY) &&
                  importGame(bytes).state &&
                  !recoverySaves.some((copy) => copy.bytes === bytes)
                ) {
                  recoverySaves.push({ key, bytes });
                  recovered = true;
                }
            let dirty = false;
            if (collectArchives)
              for (const [key, bytes] of mirror)
                if (
                  key.includes(".original-v") &&
                  !slots.get(key) &&
                  bytes &&
                  importGame(bytes).sourceVersion === Number(key.at(-1))
                ) {
                  slots.set(key, bytes);
                  dirty = true;
                }
            const generation = head?.generation ?? 0;
            const before = new Map(slots);
            const memory = memoryStorage(slots),
              put = memory.setItem;
            canonicalValidation.set(memory, browserCanonicalValidation);
            memory.setItem = (key, bytes) => {
              dirty = true;
              put(key, bytes);
            };
            result = operation(memory, generation);
            if (result.ok === false || result.protected === false) {
              if (result.token)
                result.token = { ...readSaveToken(memoryStorage(before)), generation };
              return;
            }
            if (bootstrap && result.state) dirty = true;
            const next = generation + (dirty ? 1 : 0);
            if (!Number.isSafeInteger(next)) throw new Error("generation-overflow");
            if (dirty) {
              committed = { generation: next, claimed: true, slots: [...slots] };
              stateStore.put(committed, "head");
            } else if (!bootstrap) committed = head;
            if (recovered) recoveryStore.put(recoverySaves, "recovery");
            result.recoverySaves = recoverySaves;
            if (recoverySaves.length && (result.ok === undefined || recovered))
              result.message = result.ok
                ? `${result.message} ${RECOVERY_WARNING}`
                : RECOVERY_WARNING;
            if (result.token) result.token.generation = next;
          } catch {
            tx.abort();
          }
        };
      };
    });
  } catch (error) {
    if (observed && !unclaimedHead(observed)) error.snapshot = observed;
    throw error;
  } finally {
    db.close();
  }
}
export async function saveGameLocked(
  state,
  storage,
  expectedToken,
  locks = globalThis.navigator?.locks,
  transact = browserTransaction,
) {
  if (!locks?.request) return { ok: false, message: LOCK_WARNING };
  try {
    return await locks.request(SAVE_LOCK, () =>
      transact(storage, (memory, generation) => {
        if (expectedToken?.generation !== generation) return conflict();
        return saveGame(state, memory, expectedToken);
      }),
    );
  } catch {
    return { ok: false, message: LOCK_WARNING };
  }
}
export async function loadGameLocked(
  storage,
  locks = globalThis.navigator?.locks,
  transact = browserTransaction,
) {
  const read = (promote) => {
    const loaded = loadGame(storage, { promote });
    let token = null;
    try {
      token = readSaveToken(storage);
    } catch {
      /* Preserve exportable state. */
    }
    return { ...loaded, token, ...(!promote ? { message: LOCK_WARNING } : {}) };
  };
  if (!locks?.request) return read(false);
  try {
    return await locks.request(SAVE_LOCK, () =>
      transact(
        storage,
        (memory) => {
          const loaded = loadGame(memory);
          return { ...loaded, token: readSaveToken(memory) };
        },
        true,
      ),
    );
  } catch (error) {
    if (error.snapshot)
      return {
        ...loadGame(memoryStorage(new Map(error.snapshot.slots)), { promote: false }),
        token: null,
        message: LOCK_WARNING,
      };
    return read(false);
  }
}
