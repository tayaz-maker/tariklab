import { migrateState, validateState } from "./engine.mjs";

export const SAVE_KEY = "tariklab.boardworld.v2";
export const BACKUP_KEY = `${SAVE_KEY}.backup`;
export const LEGACY_SAVE_KEY = "tariklab.boardworld.v1";
export const LEGACY_BACKUP_KEY = `${LEGACY_SAVE_KEY}.backup`;
export const ORIGINAL_V1_BACKUP_KEY = `${LEGACY_SAVE_KEY}.original-v1`;
const MAX_BYTES = 2_000_000;
const FORMAT = "tc-sim-boardworld";
// Keep imported 1.0 bytes outside simulation state. File import saves this exact
// object before adopting it, so migration never needs to add hidden save fields.
const importedV1 = new WeakMap();

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
  const current = state.version === 1 ? migrateState(state) : state;
  if (current.version !== 2 || !valid(current))
    throw new Error("Kayıt geçişi doğrulanamadı; mevcut kayıt korundu.");
  return encode(current, 2);
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
    ![1, 2].includes(envelope.version) ||
    typeof envelope.payload !== "string" ||
    envelope.checksum !== checksum(envelope.payload)
  )
    throw new Error("envelope");
  // Verify original bytes and original schema before any migration. A damaged
  // legacy record must never gain legitimacy from new-schema defaults.
  const original = JSON.parse(envelope.payload);
  if (!valid(original) || original.version !== envelope.version) throw new Error("state");
  const state = envelope.version === 1 ? migrateState(original) : original;
  if (state.version !== 2 || !valid(state)) throw new Error("migration");
  if (envelope.version === 1) importedV1.set(state, text);
  return { state, sourceVersion: envelope.version, migrated: envelope.version === 1 };
}
export function importGame(text) {
  try {
    const result = decode(text);
    return {
      ...result,
      message: result.migrated
        ? "Boardworld 1.0 kaydın doğrulandı ve 2.0’a taşındı. İlerlemen korundu."
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
      if (loaded.state && loaded.sourceVersion === 2) return { ...loaded, sourceKey: SAVE_KEY };
    }
    const backup = storage.getItem(BACKUP_KEY);
    if (backup) {
      const restored = importGame(backup);
      if (restored.state && restored.sourceVersion === 2)
        return {
          ...restored,
          sourceKey: BACKUP_KEY,
          message: "Ana 2.0 kaydı okunamadı. Bir önceki güvenli 2.0 kaydı kurtarıldı.",
        };
    }
    const fallbackKeys = [LEGACY_SAVE_KEY, LEGACY_BACKUP_KEY, ORIGINAL_V1_BACKUP_KEY];
    let foundLegacy = false;
    for (const key of fallbackKeys) {
      const bytes = storage.getItem(key);
      if (!bytes) continue;
      foundLegacy = true;
      const restored = importGame(bytes);
      if (restored.state && (key !== ORIGINAL_V1_BACKUP_KEY || restored.sourceVersion === 1)) {
        // Old open tabs can still write their v1 key. Protect a validated legacy
        // load before returning it, including early v2 envelopes at the old key.
        const saved = saveGame(restored.state, storage);
        const recovery =
          key === ORIGINAL_V1_BACKUP_KEY
            ? "Korunan özgün 1.0 kaydın kurtarıldı ve 2.0’a taşındı."
            : primary || backup
              ? "2.0 ana kaydı ve yedeği okunamadı. Eski uyumlu kayıttan kurtarıldı; son 2.0 adımların bu kopyada bulunmayabilir."
              : restored.sourceVersion === 1
                ? "Boardworld 1.0 kaydın doğrulandı ve 2.0’a taşındı. İlerlemen korundu."
                : "Önceki 2.0 kaydın ayrı ve korunan kayıt alanına taşındı.";
        return {
          ...restored,
          sourceKey: key,
          protected: saved.ok,
          message: saved.ok
            ? recovery
            : "Uyumlu kayıt doğrulandı ve belleğe yüklendi; ayrı 2.0 kaydı yazılamadı. Eski kayıtlar değiştirilmedi. İlerlemeni korumak için dosyaya aktar.",
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
    const previousResult = previous ? importGame(previous) : null;
    const rolling = storage.getItem(BACKUP_KEY);
    const rollingResult = rolling ? importGame(rolling) : null;
    const canonicalExists =
      previousResult?.sourceVersion === 2 || rollingResult?.sourceVersion === 2;
    const oldPrimary = canonicalExists ? null : storage.getItem(LEGACY_SAVE_KEY);
    const oldBackup = canonicalExists ? null : storage.getItem(LEGACY_BACKUP_KEY);
    const legacy =
      importedV1.get(state) ||
      (state.version === 1 && encode(state, 1)) ||
      (!canonicalExists &&
        ((oldPrimary && importGame(oldPrimary).sourceVersion === 1 && oldPrimary) ||
          (oldBackup && importGame(oldBackup).sourceVersion === 1 && oldBackup)));
    if (legacy) {
      const original = storage.getItem(ORIGINAL_V1_BACKUP_KEY);
      if (original === null) {
        // Archive before the first canonical write. Legacy primary and rotating
        // slots belong to old open tabs and are never written by this version.
        writeChecked(storage, ORIGINAL_V1_BACKUP_KEY, legacy);
      } else if (importGame(original).sourceVersion !== 1) {
        throw new Error("original-v1-backup-damaged");
      }
    }
    // Never replace a healthy recovery slot with corrupt bytes.
    if (previousResult?.sourceVersion === 2) writeChecked(storage, BACKUP_KEY, previous);
    writeChecked(storage, SAVE_KEY, encoded);
    return { ok: true, message: "Bu tarayıcıya kaydedildi." };
  } catch {
    return {
      ok: false,
      message:
        "Otomatik kayıt yazılamadı. İlerlemeni korumak için Kayıt → Dosyaya aktar seçeneğini kullan.",
    };
  }
}
