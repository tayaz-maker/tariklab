// Game-local v1 storage boundary. No state repair, migration or deletion.
import { KEY, deserialize, serialize } from "./sim.js?save=2";

export const BACKUP_KEY = `${KEY}.backup`;
export const RECOVERY_PREFIX = `${KEY}.corrupt.`;
export const RECOVERY_SLOTS = 8;

export function loadCoastSave(storage) {
  try {
    const primary = storage.getItem(KEY);
    const state = deserialize(primary);
    if (state) return { state, status: "loaded" };
    const backup = storage.getItem(BACKUP_KEY);
    const restored = deserialize(backup);
    if (restored) return { state: restored, status: "backup" };
    return { state: null, status: primary !== null || backup !== null ? "invalid" : "empty" };
  } catch {
    return { state: null, status: "unavailable" };
  }
}

function retainRaw(storage, raw) {
  let free = null;
  for (let i = 0; i < RECOVERY_SLOTS; i++) {
    const key = `${RECOVERY_PREFIX}${i}`;
    const stored = storage.getItem(key);
    if (stored === raw) return true;
    if (stored === null && free === null) free = key;
  }
  // A full recovery area is a reason to stop saving, never to evict bytes.
  if (free === null) return false;
  storage.setItem(free, raw);
  return storage.getItem(free) === raw;
}

export function saveCoastSave(storage, state) {
  try {
    const raw = serialize(state);
    if (!deserialize(raw)) return { ok: false, status: "blocked" };
    const primary = storage.getItem(KEY);
    const backup = storage.getItem(BACKUP_KEY);
    const validPrimary = deserialize(primary);
    const validBackup = deserialize(backup);
    let preserved = false;
    for (const [value, valid] of [[primary, validPrimary], [backup, validBackup]]) {
      if (value !== null && !valid) {
        if (!retainRaw(storage, value)) return { ok: false, status: "blocked" };
        preserved = true;
      }
    }
    // Keep the previous valid primary, or the recovery backup if primary
    // was corrupt. Establish the first backup before writing a new primary.
    const nextBackup = validPrimary ? primary : validBackup ? backup : raw;
    if (backup !== nextBackup) {
      storage.setItem(BACKUP_KEY, nextBackup);
      if (storage.getItem(BACKUP_KEY) !== nextBackup) return { ok: false, status: "blocked" };
    }
    // Do not overwrite a primary changed by another tab during preservation.
    if (storage.getItem(KEY) !== primary) return { ok: false, status: "blocked" };
    storage.setItem(KEY, raw);
    if (storage.getItem(KEY) !== raw) return { ok: false, status: "blocked" };
    return { ok: true, status: preserved ? "preserved" : "saved" };
  } catch {
    // Quota/security failures leave the old primary intact. Callers keep the
    // current game in memory and explain that progress has not been saved.
    return { ok: false, status: "blocked" };
  }
}
