import { validateState } from './engine.js';

/**
 * HANEDANIAN persistence, first released schema (v1).
 *
 * IndexedDB owns the three durable slots. Updating auto and rotating its valid
 * predecessor is ONE transaction. No failed load deletes or resets data.
 * A bounded synchronous journal protects mobile pagehide; newer verified journal
 * snapshots win on the next load. Ordinary saves never block on localStorage.
 *
 * Migration policy: HANEDAN's older card/court simulation cannot represent this
 * game's world. Keep its keys untouched and offer an exact export + legacy game.
 * There is no fictitious v0 HANEDANIAN schema to migrate. Future migrations must
 * validate the original checksum, clone, migrate sequentially, then validate the
 * result, retaining the original until an atomic write commits. Unknown versions
 * currently fail explicitly, including on write, rather than silently resetting.
 *
 * The adapter is deliberately local and dependency-free. Its transactional API
 * also permits deterministic fault/concurrency tests without a browser package.
 */

export const SAVE_FORMAT = 'tariklab-hanedanian';
export const SAVE_VERSION = 1;
export const SAVE_DB = 'tariklab-hanedanian';
export const JOURNAL_KEY = 'tariklab::hanedanian:emergency:v1';
const STORE = 'saves';
const SLOTS = ['auto', 'previous', 'manual'];
const MAX_SAVE_LENGTH = 4 * 1024 * 1024;
const MAX_JOURNAL_LENGTH = 1024 * 1024;
const LEGACY_KEYS = [
  ...[1, 2, 3].flatMap(n => [`tariklab::hanedan:${n}`, `tariklab::hanedan:${n}:bak`]),
  'cete_hanedan_v2', 'cete_hanedan_v1', 'cete_hanedan_bak',
];

export class SaveError extends Error {
  constructor(code, message) { super(message); this.name = 'SaveError'; this.code = code; }
}

const fail = (code, message) => { throw new SaveError(code, message); };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Reject data JSON would silently alter (NaN, Infinity, functions, class
// instances), excessive nesting and prototype keys before cloning or loading.
function validateJSON(value) {
  const ancestors = new Set();
  let count = 0;
  function walk(item, depth) {
    if (++count > 250000 || depth > 64) fail('invalid', 'Kayıt yapısı güvenli sınırı aşıyor.');
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (typeof item !== 'object' || ancestors.has(item)) fail('invalid', 'Kayıt geçersiz bir veri türü içeriyor.');
    const proto = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && proto !== Object.prototype && proto !== null) fail('invalid', 'Kayıt yalnızca düz oyun verisi içermeli.');
    if (Array.isArray(item) && Object.keys(item).length !== item.length) fail('invalid', 'Kayıt eksik bir veri listesi içeriyor.');
    ancestors.add(item);
    for (const key of Object.keys(item)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') fail('invalid', 'Kayıt güvenli olmayan bir alan içeriyor.');
      walk(item[key], depth + 1);
    }
    ancestors.delete(item);
  }
  walk(value, 0);
}

function checkState(state) {
  if (!isObject(state) || !Number.isInteger(state.schemaVersion)) fail('invalid', 'Bu dosya bir HANEDANIAN kaydı değil.');
  if (state.schemaVersion > SAVE_VERSION) fail('future-version', 'Bu kayıt daha yeni bir HANEDANIAN sürümüne ait. Oyunu güncelle; kayıt korundu.');
  if (state.schemaVersion !== SAVE_VERSION) fail('unsupported-version', 'Bu kayıt sürümü desteklenmiyor. Orijinal kayıt korundu.');
  const verdict = validateState(state);
  if (verdict !== true && (!verdict || verdict.ok !== true)) fail('invalid', 'Kayıttaki dünya veya oyun değerleri geçersiz. Mevcut kayıt değiştirilmedi.');
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

// CRC32 is an accidental-corruption guard, not authentication or anti-cheat.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1;
  return n >>> 0;
});
function checksum(payload) {
  let crc = 0xffffffff;
  for (const byte of new TextEncoder().encode(canonical(payload))) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ crc >>> 8;
  return `crc32:${((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0')}`;
}

export function encodeSave(state, savedAt = Date.now()) {
  validateJSON(state);
  checkState(state);
  if (!Number.isSafeInteger(savedAt) || savedAt < 0) fail('invalid', 'Kayıt tarihi geçersiz.');
  const envelope = { format: SAVE_FORMAT, formatVersion: SAVE_VERSION, schemaVersion: SAVE_VERSION, savedAt, state };
  const raw = JSON.stringify({ ...envelope, checksum: checksum(envelope) });
  if (raw.length > MAX_SAVE_LENGTH) fail('too-large', 'Kayıt dosyası boyut sınırını aşıyor.');
  return raw;
}

export function decodeSave(raw) {
  if (typeof raw !== 'string' || !raw.length) fail('invalid', 'Kayıt dosyası boş veya geçersiz.');
  if (raw.length > MAX_SAVE_LENGTH) fail('too-large', 'Kayıt dosyası boyut sınırını aşıyor.');
  let envelope;
  try { envelope = JSON.parse(raw); } catch { fail('corrupt', 'Kayıt dosyası okunamıyor. Orijinal veri korundu.'); }
  validateJSON(envelope);
  if (!isObject(envelope) || envelope.format !== SAVE_FORMAT) fail('invalid', 'Bu dosya bir HANEDANIAN kaydı değil. Eski HANEDAN kayıtları eski oyunda açılır.');
  if (!Number.isInteger(envelope.formatVersion) || !Number.isInteger(envelope.schemaVersion)) fail('invalid', 'Kayıt sürüm bilgisi eksik.');
  if (envelope.formatVersion > SAVE_VERSION || envelope.schemaVersion > SAVE_VERSION) fail('future-version', 'Bu kayıt daha yeni bir HANEDANIAN sürümüne ait. Oyunu güncelle; kayıt korundu.');
  if (envelope.formatVersion !== SAVE_VERSION || envelope.schemaVersion !== SAVE_VERSION) fail('unsupported-version', 'Bu kayıt sürümü desteklenmiyor. Orijinal kayıt korundu.');
  const { checksum: storedChecksum, ...payload } = envelope;
  if (typeof storedChecksum !== 'string' || storedChecksum !== checksum(payload)) fail('corrupt', 'Kayıt bütünlük kontrolünden geçemedi. Orijinal veri korundu.');
  if (!Number.isSafeInteger(envelope.savedAt) || envelope.savedAt < 0) fail('invalid', 'Kayıt tarihi geçersiz.');
  checkState(envelope.state);
  return { state: envelope.state, savedAt: envelope.savedAt, schemaVersion: envelope.schemaVersion };
}

function decodeRecord(record) {
  if (!record) return null;
  const decoded = decodeSave(record.raw);
  if (decoded.savedAt !== record.savedAt) fail('corrupt', 'Kayıt üstbilgisi ile içeriği uyuşmuyor.');
  return decoded;
}

function preserveVersion(error) { return ['future-version', 'unsupported-version'].includes(error?.code); }

// This function runs within the adapter's atomic transaction, not before it.
export function planSaveWrites(current, slot, record) {
  let previous = null;
  if (current) {
    try { decodeRecord(current); previous = current; }
    catch (error) { if (preserveVersion(error)) throw error; }
    if (previous && previous.savedAt >= record.savedAt) fail('stale', 'Başka bir sekmede daha yeni kayıt var. Yeniden yükle veya mevcut oyunu dışa aktar.');
  }
  return slot === 'auto' && previous ? [{ ...previous, slot: 'previous' }, record] : [record];
}

function indexedDBDefault() { try { return globalThis.indexedDB; } catch { return null; } }

export class IndexedDBAdapter {
  constructor(indexedDB = indexedDBDefault()) { this.indexedDB = indexedDB; this.db = null; this.opening = null; }
  async init() {
    if (this.db) return;
    if (this.opening) return this.opening;
    if (!this.indexedDB) fail('unavailable', 'Tarayıcı kayıt alanına erişilemiyor. İlerlemeni dosya olarak dışa aktar.');
    this.opening = new Promise((resolve, reject) => {
      let finished = false;
      const finish = (error, db) => {
        if (finished) { if (db) db.close(); return; }
        finished = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else {
          this.db = db;
          db.onversionchange = () => { db.close(); this.db = null; };
          resolve();
        }
      };
      const timeout = setTimeout(() => finish(new SaveError('blocked', 'Kayıt alanı yanıt vermedi. Diğer oyun sekmelerini kapatıp tekrar dene.')), 5000);
      let request;
      try { request = this.indexedDB.open(SAVE_DB, 1); }
      catch (error) { finish(error); return; }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'slot' });
      };
      request.onsuccess = () => finish(null, request.result);
      request.onerror = () => finish(request.error);
      request.onblocked = () => finish(new SaveError('blocked', 'Kayıt alanı başka bir sekmede açık. Diğer oyun sekmelerini kapatıp tekrar dene.'));
    });
    try { await this.opening; } finally { this.opening = null; }
  }
  async readAll() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).getAll();
      transaction.oncomplete = () => resolve(Object.fromEntries(request.result.map(record => [record.slot, record])));
      transaction.onerror = transaction.onabort = () => reject(transaction.error || new SaveError('storage', 'Kayıt okunamadı.'));
    });
  }
  async commit(slot, record) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      const request = store.get(slot);
      let reason = null;
      request.onsuccess = () => {
        try { for (const write of planSaveWrites(request.result, slot, record)) store.put(write); }
        catch (error) { reason = error; transaction.abort(); }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(reason || transaction.error || new SaveError('storage', 'Kayıt işlemi tamamlanamadı.'));
    });
  }
}

function storageDefault() { try { return globalThis.localStorage; } catch { return null; } }
function resultError(error) {
  const code = typeof error?.code === 'string' ? error.code : error?.name === 'QuotaExceededError' ? 'quota' : 'storage';
  const message = error instanceof SaveError ? error.message : code === 'quota'
    ? 'Tarayıcının kayıt alanı dolu. İlerlemen henüz kaydedilmedi; dosya olarak dışa aktar.'
    : 'Kayıt alanına erişilemedi. İlerlemen henüz kaydedilmedi; dosya olarak dışa aktar.';
  return { ok: false, code, message };
}

export class SaveManager {
  constructor({ adapter = new IndexedDBAdapter(), storage = storageDefault(), now = () => Date.now() } = {}) {
    this.adapter = adapter;
    this.storage = storage;
    this.now = now;
    this.queue = Promise.resolve();
    this.lastRaw = null;
    this.timestamp = 0;
    this.info = { available: false, lastSavedAt: null, error: null, unsaved: false };
  }
  status() { return { ...this.info }; }
  async init() {
    try { await this.adapter.init(); this.info.available = true; this.info.error = null; return { ok: true }; }
    catch (error) { this.info.available = false; return this.error(error); }
  }
  error(error) { const result = resultError(error); this.info.error = result.message; return result; }
  serial(operation) {
    const next = this.queue.then(operation, operation);
    this.queue = next.catch(() => {});
    return next;
  }
  snapshot(state) {
    const timestamp = Math.max(this.now(), this.timestamp + 1);
    const raw = encodeSave(state, timestamp);
    this.timestamp = timestamp;
    this.lastRaw = raw;
    return { raw, savedAt: timestamp };
  }
  save(state, slot = 'auto') {
    let record;
    try {
      if (!['auto', 'manual'].includes(slot)) fail('invalid-slot', 'Bu kayıt yuvasına yazılamaz.');
      record = { ...this.snapshot(state), slot };
      this.info.unsaved = true;
    } catch (error) { return Promise.resolve(this.error(error)); }
    return this.serial(async () => {
      try {
        await this.adapter.commit(slot, record);
        this.info.available = true;
        this.info.lastSavedAt = record.savedAt;
        this.info.unsaved = this.lastRaw !== record.raw;
        this.info.error = null;
        if (slot === 'auto') this.clearOlderJournal(record.savedAt);
        return { ok: true, slot, savedAt: record.savedAt };
      } catch (error) { return this.error(error); }
    });
  }
  checkpoint(state) {
    try {
      const record = this.snapshot(state);
      this.info.unsaved = true;
      if (!this.storage) fail('unavailable', 'Kapanış kaydı alınamadı. İlerlemeni dosya olarak dışa aktar.');
      if (record.raw.length > MAX_JOURNAL_LENGTH) fail('too-large', 'Kapanış kaydı büyük; normal kayıt işlemini tamamlamadan sayfayı kapatma.');
      const existing = this.journal();
      if (existing.error && preserveVersion(existing.error)) throw existing.error;
      if (existing.decoded && existing.decoded.savedAt >= record.savedAt) fail('stale', 'Başka bir sekmede daha yeni kapanış kaydı var.');
      this.storage.setItem(JOURNAL_KEY, record.raw);
      return { ok: true, slot: 'journal', savedAt: record.savedAt };
    } catch (error) { return this.error(error); }
  }
  journal() {
    try {
      const raw = this.storage?.getItem(JOURNAL_KEY);
      return raw ? { raw, decoded: decodeSave(raw) } : {};
    } catch (error) { return { error }; }
  }
  clearOlderJournal(savedAt) {
    try {
      const journal = this.journal();
      if (journal.decoded && journal.decoded.savedAt <= savedAt) this.storage?.removeItem(JOURNAL_KEY);
    } catch { /* The IDB commit succeeded; a stale journal cannot supersede it. */ }
  }
  async list() {
    await this.queue;
    const result = { auto: null, previous: null, manual: null };
    let records = {}, storageError = null;
    try {
      records = await this.adapter.readAll();
      this.info.available = true;
    } catch (error) { storageError = this.error(error); this.info.available = false; }
    for (const slot of SLOTS) {
      if (!records[slot]) continue;
      try {
        const { state, savedAt } = decodeRecord(records[slot]);
        result[slot] = { slot, valid: true, savedAt, worldSeed: state.world.seed, gameTime: state.time };
      } catch (error) { result[slot] = { slot, valid: false, ...resultError(error) }; }
    }
    const journal = this.journal();
    if (journal.decoded && (!result.auto?.valid || journal.decoded.savedAt > result.auto.savedAt)) {
      const { state, savedAt } = journal.decoded;
      result.journal = { slot: 'journal', valid: true, savedAt, worldSeed: state.world.seed, gameTime: state.time };
    }
    return storageError ? { ...result, ...storageError } : result;
  }
  load(slot = 'auto') {
    return this.serial(async () => {
      try {
        if (!SLOTS.includes(slot)) fail('invalid-slot', 'Bu kayıt yuvası bulunamadı.');
        let records = {}, storageError = null;
        try { records = await this.adapter.readAll(); this.info.available = true; }
        catch (error) { storageError = error; this.info.available = false; }
        const journal = slot === 'auto' ? this.journal() : {};
        if (journal.error && preserveVersion(journal.error)) throw journal.error;
        let selected = null, currentError = null;
        if (records[slot]) {
          try { selected = { ...decodeRecord(records[slot]), raw: records[slot].raw, slot }; }
          catch (error) { if (preserveVersion(error)) throw error; currentError = error; }
        }
        if (!selected && slot === 'auto' && records.previous) {
          try { selected = { ...decodeRecord(records.previous), raw: records.previous.raw, slot: 'previous' }; }
          catch (error) { if (preserveVersion(error)) throw error; currentError ||= error; }
        }
        if (journal.decoded && (!selected || journal.decoded.savedAt > selected.savedAt)) selected = { ...journal.decoded, raw: journal.raw, slot: 'journal' };
        if (!selected) {
          if (currentError || storageError || journal.error) throw currentError || storageError || journal.error;
          return { ok: false, code: 'empty', message: 'Bu yuvada kayıt yok.' };
        }
        this.lastRaw = selected.raw;
        this.timestamp = Math.max(this.timestamp, selected.savedAt);
        this.info.lastSavedAt = selected.savedAt;
        this.info.unsaved = selected.slot === 'journal';
        const recovered = selected.slot !== slot;
        const message = selected.slot === 'previous' ? 'Son kayıt okunamadı; önceki otomatik kayıt kurtarıldı. Asıl kayıt korundu.'
          : selected.slot === 'journal' ? 'Son kapanış kaydın kurtarıldı. Kalıcı kayıt için yeniden kaydet.' : null;
        this.info.error = storageError ? resultError(storageError).message : currentError ? message : null;
        return { ok: true, state: selected.state, slot: selected.slot, savedAt: selected.savedAt, recovered, message, ...(storageError ? { warning: resultError(storageError).message } : {}) };
      } catch (error) { return this.error(error); }
    });
  }
  export(state) {
    if (state !== undefined) return encodeSave(state, Math.max(this.now(), this.timestamp));
    if (!this.lastRaw) fail('empty', 'Dışa aktarılacak oyun kaydı yok.');
    return this.lastRaw;
  }
  async import(raw, slot = 'manual') {
    try {
      const decoded = decodeSave(raw);
      const result = await this.save(decoded.state, slot);
      return result.ok ? { ...result, state: decoded.state } : result;
    } catch (error) { return this.error(error); }
  }
  legacySaves() {
    try { return LEGACY_KEYS.map(key => ({ key, raw: this.storage?.getItem(key) })).filter(entry => entry.raw !== null && entry.raw !== undefined); }
    catch (error) { this.error(error); return []; }
  }
  exportLegacy() {
    return JSON.stringify({ format: 'tariklab-hanedan-legacy-backup', exportedAt: this.now(), saves: this.legacySaves() }, null, 2);
  }
}
