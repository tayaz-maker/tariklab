import { validateState } from "./engine.mjs";

export const SAVE_KEY = "tariklab.boardworld.v1";
export const BACKUP_KEY = `${SAVE_KEY}.backup`;
const MAX_BYTES = 2_000_000;
const FORMAT = "tc-sim-boardworld";

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
export function exportGame(state) {
  if (!valid(state)) throw new Error("Oyun durumu doğrulanamadı; mevcut kayıt korundu.");
  const payload = JSON.stringify(state);
  const encoded = JSON.stringify({
    format: FORMAT,
    version: 1,
    checksum: checksum(payload),
    payload,
  });
  if (encoded.length > MAX_BYTES) throw new Error("Kayıt dosyası boyut sınırını aşıyor.");
  return encoded;
}
export function importGame(text) {
  try {
    if (typeof text !== "string" || text.length > MAX_BYTES) throw new Error("size");
    const envelope = JSON.parse(text);
    if (
      envelope.format !== FORMAT ||
      envelope.version !== 1 ||
      typeof envelope.payload !== "string" ||
      envelope.checksum !== checksum(envelope.payload)
    )
      throw new Error("envelope");
    const state = JSON.parse(envelope.payload);
    if (!valid(state)) throw new Error("state");
    return { state, message: "Kayıt doğrulandı ve yüklendi." };
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
          state: restored.state,
          message: "Ana kayıt okunamadı. Bir önceki güvenli kayıt kurtarıldı.",
        };
    }
    return {
      state: null,
      message:
        primary || backup
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
export function saveGame(state, storage) {
  try {
    storage ??= globalThis.localStorage;
    const encoded = exportGame(state);
    const previous = storage.getItem(SAVE_KEY);
    // Never replace a healthy recovery slot with corrupt bytes.
    if (previous && importGame(previous).state) storage.setItem(BACKUP_KEY, previous);
    storage.setItem(SAVE_KEY, encoded);
    if (storage.getItem(SAVE_KEY) !== encoded) throw new Error("verification");
    return { ok: true, message: "Bu tarayıcıya kaydedildi." };
  } catch {
    return {
      ok: false,
      message:
        "Otomatik kayıt yazılamadı. İlerlemeni korumak için Kayıt → Dosyaya aktar seçeneğini kullan.",
    };
  }
}
