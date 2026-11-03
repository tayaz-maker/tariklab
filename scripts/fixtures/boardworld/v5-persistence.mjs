import { migrateState, validateState } from "../../../public/games/tc-sim-boardworld/engine.mjs";

export const SAVE_KEY = "tariklab.boardworld.v5";
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
const CURRENT_VERSION = 5;
const LEGACY_SLOTS = [
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
  return (
    Object.keys(value).length <= 500 &&
    Object.entries(value).every(
      ([k, v]) => !["__proto__", "prototype", "constructor"].includes(k) && safeTree(v, depth + 1),
    )
  );
}
function valid(state) {
  try {
    return safeTree(state) && validateState(state);
  } catch {
    return false;
  }
}
function encode(state, version) {
  const payload = JSON.stringify(state);
  const encoded = JSON.stringify({
    format: FORMAT,
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
  return encode(current, CURRENT_VERSION);
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
    envelope.format !== FORMAT ||
    ![1, 2, 3, 4, CURRENT_VERSION].includes(envelope.version) ||
    typeof envelope.payload !== "string" ||
    envelope.checksum !== checksum(envelope.payload)
  )
    throw new Error("envelope");
  // Verify original bytes and original schema before any migration. A damaged
  // legacy record must never gain legitimacy from new-schema defaults.
  const original = JSON.parse(envelope.payload);
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
        ? `Boardworld ${result.sourceVersion}.0 kaydın doğrulandı ve 5.0’a taşındı. İlerlemen korundu.`
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
export function loadGame(storage) {
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
          message: "Ana 5.0 kaydı okunamadı. Bir önceki güvenli 5.0 kaydı kurtarıldı.",
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
        const saved = saveGame(restored.state, storage);
        const recovery = [
          ORIGINAL_V1_BACKUP_KEY,
          ORIGINAL_V2_BACKUP_KEY,
          ORIGINAL_V3_BACKUP_KEY,
          ORIGINAL_V4_BACKUP_KEY,
        ].includes(key)
          ? `Korunan özgün ${restored.sourceVersion}.0 kaydın kurtarıldı ve 5.0’a taşındı.`
          : primary || backup
            ? "5.0 ana kaydı ve yedeği okunamadı. Eski uyumlu kayıttan kurtarıldı; son 5.0 adımların bu kopyada bulunmayabilir."
            : `Boardworld ${restored.sourceVersion}.0 kaydın doğrulandı ve 5.0’a taşındı. İlerlemen korundu.`;
        return {
          ...restored,
          sourceKey: key,
          protected: saved.ok,
          message: saved.ok
            ? recovery
            : "Uyumlu kayıt doğrulandı ve belleğe yüklendi; ayrı 5.0 kaydı yazılamadı. Eski kayıtlar değiştirilmedi. İlerlemeni korumak için dosyaya aktar.",
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
export function saveGame(state, storage) {
  try {
    storage ??= globalThis.localStorage;
    const encoded = exportGame(state);
    const previous = storage.getItem(SAVE_KEY);
    const previousResult = inspectStored(storage, previous);
    const rolling = storage.getItem(BACKUP_KEY);
    const rollingResult = inspectStored(storage, rolling);
    const canonicalExists =
      previousResult?.sourceVersion === CURRENT_VERSION ||
      rollingResult?.sourceVersion === CURRENT_VERSION;
    const originals = new Map();
    const imported = importedLegacy.get(state);
    if (imported) originals.set(imported.version, imported.bytes);
    else if ([1, 2, 3, 4].includes(state.version))
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
    return { ok: true, message: "Bu tarayıcıya kaydedildi." };
  } catch {
    return {
      ok: false,
      message:
        "Otomatik kayıt yazılamadı. İlerlemeni korumak için Kayıt → Dosyaya aktar seçeneğini kullan.",
    };
  }
}
