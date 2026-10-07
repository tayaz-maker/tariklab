import { syncGameDate } from "./game-date.js?v=10";
import { SAVE_VERSION, createNewGame, normalizeEducationCareer, validateState } from "./state.js?v=10";
import { getHomeById, getJobById } from "./life.js?v=10";
import { PRESENT_DAY_ERA_ID, getEraById } from "./eras.js?v=10";
import { upgradeScenarioTo2030 } from "./historical-scenarios.js?v=10";

export const SAVE_KEY = "tc-sim-save";
export const BACKUP_KEY = "tc-sim-save-backup";
export const SLOT_GAME_ID = "tc-sim";
const SLOT_COUNT = 3;

function slotKey(slot) {
  return `tariklab::${SLOT_GAME_ID}:${slot}`;
}
function backupKey(slot) {
  return `tariklab::${SLOT_GAME_ID}:${slot}:bak`;
}
function activeKey() {
  return `tariklab::${SLOT_GAME_ID}:active`;
}

export function isSlotIndex(value) {
  return value === 1 || value === 2 || value === 3;
}

export function getActiveSlot(storage) {
  const raw = Number(storage.getItem(activeKey()));
  return isSlotIndex(raw) ? raw : 1;
}

export function setActiveSlot(storage, slot) {
  if (!isSlotIndex(slot)) return false;
  storage.setItem(activeKey(), String(slot));
  return true;
}

function migrateLegacyOnce(storage) {
  const flag = `tariklab::${SLOT_GAME_ID}:legacy-migrated`;
  if (storage.getItem(flag) === "1") return;
  if (storage.getItem(slotKey(1))) {
    storage.setItem(flag, "1");
    return;
  }
  const legacy = storage.getItem(SAVE_KEY);
  if (legacy) {
    storage.setItem(slotKey(1), legacy);
    const bak = storage.getItem(BACKUP_KEY);
    if (bak) storage.setItem(backupKey(1), bak);
    setActiveSlot(storage, 1);
  }
  storage.setItem(flag, "1");
}

function currentKeys(storage) {
  migrateLegacyOnce(storage);
  const slot = getActiveSlot(storage);
  return { slot, primary: slotKey(slot), backup: backupKey(slot) };
}

function mergeLegacy(raw) {
  const base = createNewGame({
    name: raw?.player?.name || "Deniz",
    gender: raw?.player?.gender,
    profile: "balanced",
    seed: raw?.meta?.rngState || 20270101,
    now: raw?.meta?.createdAt || new Date().toISOString(),
  });
  const merged = {
    ...base,
    ...raw,
    meta: { ...base.meta, ...(raw.meta || {}), yearStartHealth: raw.meta?.yearStartHealth || null, saveVersion: 2 },
    player: { ...base.player, ...(raw.player || {}) },
    time: { ...base.time, ...(raw.time || {}) },
    finances: {
      ...base.finances,
      balance: Number.isFinite(raw?.finances?.balance)
        ? raw.finances.balance
        : base.finances.balance,
      otherMonthlyIncome: Math.max(
        0,
        (Number.isFinite(raw?.finances?.monthlyIncome) ? raw.finances.monthlyIncome : 9000) - 9000,
      ),
      otherMonthlyExpenses: Math.max(
        0,
        (Number.isFinite(raw?.finances?.monthlyExpenses) ? raw.finances.monthlyExpenses : 6500) -
          1500,
      ),
      ledger: Array.isArray(raw?.finances?.ledger) ? raw.finances.ledger : [],
    },
    career: {
      jobId: getJobById(raw?.career?.jobId)
        ? raw.career.jobId
        : raw?.career?.status === "unemployed"
          ? null
          : "market",
      pendingJob: null,
    },
    household: {
      homeId: getHomeById(raw?.household?.homeId) ? raw.household.homeId : "family",
      livingWithFamily: getHomeById(raw?.household?.homeId)
        ? raw.household.homeId === "family"
        : raw?.household?.livingWithFamily !== false,
    },
    world: { eraId: PRESENT_DAY_ERA_ID },
    health: { ...base.health, ...(raw.health || {}) },
    events: { ...base.events, ...(raw.events || {}) },
    weekly: { ...base.weekly, ...(raw.weekly || {}) },
  };
  for (const key of ["people", "memories", "openCases", "yearlyHistory"])
    if (!Array.isArray(merged[key])) merged[key] = base[key];
  if (!merged.flags || typeof merged.flags !== "object") merged.flags = {};
  if (!merged.relationships || typeof merged.relationships !== "object")
    merged.relationships = base.relationships;
  return merged;
}

function migrateV2(raw) {
  return {
    ...raw,
    meta: { ...raw.meta, saveVersion: 3 },
    world: { eraId: getEraById(raw?.world?.eraId) ? raw.world.eraId : PRESENT_DAY_ERA_ID },
  };
}

function normalizeCurrentEra(raw) {
  return {
    ...raw,
    world: {
      ...(raw.world || {}),
      eraId: getEraById(raw?.world?.eraId) ? raw.world.eraId : PRESENT_DAY_ERA_ID,
    },
  };
}

// v3 kayıtlar eğitim/kariyer alanlarını tanımıyordu. Sürüm damgası burada
// yükseltilmezse mevcut bütün kayıtlar doğrulamadan geçemez ve bozuk sayılır.
function migrateV3(raw) {
  const state = normalizeCurrentEra(raw);
  return { ...state, meta: { ...(state.meta || {}), saveVersion: 4 } };
}

function migrateV4(raw) {
  return { ...raw, meta: { ...(raw.meta || {}), saveVersion: 5 } };
}

function migrateV5(raw) {
  return { ...raw, meta: { ...(raw.meta || {}), saveVersion: SAVE_VERSION } };
}

export function migrateState(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { ok: false, error: "Kayıt nesne değil." };
  const hasTcShape = (raw.meta === undefined || (raw.meta && typeof raw.meta === "object" && !Array.isArray(raw.meta)))
    && raw.player && typeof raw.player === "object" && !Array.isArray(raw.player)
    && raw.time && typeof raw.time === "object" && !Array.isArray(raw.time)
    && raw.finances && typeof raw.finances === "object" && !Array.isArray(raw.finances);
  if (!hasTcShape || (typeof raw.meta?.gameId === "string" && !raw.meta.gameId.startsWith("tc-")))
    return { ok: false, error: "Bu kayıt TC SIM'e ait değil." };
  const version = raw.meta?.saveVersion ?? 0;
  if (!Number.isInteger(version) || version < 0 || version > SAVE_VERSION)
    return { ok: false, error: "Desteklenmeyen kayıt sürümü." };
  try {
    let state = version < 2 ? mergeLegacy(raw) : raw;
    if (state.meta.saveVersion < 3) state = migrateV2(state);
    if (state.meta.saveVersion < 4) state = migrateV3(state);
    if (state.meta.saveVersion < 5) state = migrateV4(state);
    if (state.meta.saveVersion < 6) state = migrateV5(state);
    state = normalizeCurrentEra(state);
    upgradeScenarioTo2030(state);
    // mergeLegacy() career nesnesini baştan kurduğu için deneyim haritası burada geri eklenir.
    syncGameDate(state);
    state = normalizeEducationCareer(state);
    const validation = validateState(state);
    return validation.ok
      ? { ok: true, state, migrated: version !== SAVE_VERSION }
      : { ok: false, error: validation.errors.join("; ") };
  } catch {
    return { ok: false, error: "Kayıt TC SIM biçiminde değil." };
  }
}

export function deserializeState(text) {
  if (typeof text !== "string" || !text) return { ok: false, error: "Kayıt boş." };
  try {
    return migrateState(JSON.parse(text));
  } catch {
    return { ok: false, error: "Kayıt okunamadı." };
  }
}

export function saveGame(storage, state) {
  const validation = validateState(state);
  if (!validation.ok)
    return { ok: false, message: `Kayıt doğrulanamadı: ${validation.errors.join("; ")}` };
  try {
    const keys = currentKeys(storage);
    const current = storage.getItem(keys.primary);
    if (current && deserializeState(current).ok) storage.setItem(keys.backup, current);
    const copy = structuredClone(state);
    copy.meta.updatedAt = new Date().toISOString();
    const serialized = JSON.stringify(copy);
    storage.setItem(keys.primary, serialized);
    if (keys.slot === 1) {
      storage.setItem(SAVE_KEY, serialized);
      if (current && deserializeState(current).ok) storage.setItem(BACKUP_KEY, current);
    }
    return { ok: true, message: `Slot ${keys.slot} kaydedildi.`, bytes: new Blob([serialized]).size, slot: keys.slot };
  } catch {
    return {
      ok: false,
      message: "Tarayıcı kaydı yazılamadı. Mevcut oyun açık kalmaya devam ediyor.",
    };
  }
}

export function loadGame(storage) {
  const keys = currentKeys(storage);
  const primary = deserializeState(storage.getItem(keys.primary));
  if (primary.ok)
    return {
      ...primary,
      source: "primary",
      slot: keys.slot,
      message: primary.migrated ? "Eski kayıt güncellenerek açıldı." : `Slot ${keys.slot} yüklendi.`,
    };
  const backup = deserializeState(storage.getItem(keys.backup));
  if (backup.ok)
    return { ...backup, source: "backup", slot: keys.slot, message: "Ana kayıt bozuktu; son sağlam yedek açıldı." };
  return {
    ok: false,
    source: "none",
    slot: keys.slot,
    message:
      storage.getItem(keys.primary) || storage.getItem(keys.backup)
        ? "Kayıt bozuk; yeni oyun güvenle başlatılabilir."
        : "Henüz kayıt yok.",
  };
}

export function loadSlot(storage, slot) {
  if (!isSlotIndex(slot)) return { ok: false, message: "Geçersiz slot." };
  setActiveSlot(storage, slot);
  return loadGame(storage);
}

export function clearSaves(storage) {
  try {
    const keys = currentKeys(storage);
    storage.removeItem(keys.primary);
    storage.removeItem(keys.backup);
    return true;
  } catch {
    return false;
  }
}

export function listSlots(storage) {
  migrateLegacyOnce(storage);
  return [1, 2, 3].map((slot) => {
    const loaded = deserializeState(storage.getItem(slotKey(slot)));
    return {
      slot,
      empty: !loaded.ok,
      name: loaded.ok ? loaded.state.player?.name : null,
      week: loaded.ok ? loaded.state.time?.absoluteWeek : null,
    };
  });
}
