import { migrateState, validateState } from "./engine.mjs";

export const SAVE_KEY = "tariklab.boardworld.v1";
export const BACKUP_KEY = `${SAVE_KEY}.backup`;
export const ORIGINAL_V1_BACKUP_KEY = `${SAVE_KEY}.original-v1`;
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
      if (loaded.state) return loaded;
    }
    const backup = storage.getItem(BACKUP_KEY);
    if (backup) {
      const restored = importGame(backup);
      if (restored.state)
        return {
          ...restored,
          message: "Ana kayıt okunamadı. Bir önceki güvenli kayıt kurtarıldı.",
        };
    }
    const originalV1 = storage.getItem(ORIGINAL_V1_BACKUP_KEY);
    if (originalV1) {
      const restored = importGame(originalV1);
      if (restored.state && restored.sourceVersion === 1)
        return {
          ...restored,
          message:
            "Ana kayıt ve son yedek okunamadı. Korunan özgün 1.0 kaydın kurtarıldı ve 2.0’a taşındı.",
        };
    }
    return {
      state: null,
      message:
        primary || backup || originalV1
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
    const legacy =
      (previousResult?.sourceVersion === 1 && previous) ||
      (rollingResult?.sourceVersion === 1 && rolling) ||
      importedV1.get(state) ||
      (state.version === 1 && encode(state, 1));
    if (legacy) {
      const original = storage.getItem(ORIGINAL_V1_BACKUP_KEY);
      if (original === null) {
        // This write and verification must finish before either existing save
        // slot can change. Never rotate or replace this first original record.
        writeChecked(storage, ORIGINAL_V1_BACKUP_KEY, legacy);
      } else if (importGame(original).sourceVersion !== 1) {
        throw new Error("original-v1-backup-damaged");
      }
    }
    // Never replace a healthy recovery slot with corrupt bytes.
    if (previousResult?.state) writeChecked(storage, BACKUP_KEY, previous);
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
