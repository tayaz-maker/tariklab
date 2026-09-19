import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, validateState } from '../public/games/hanedanian/engine.js';
import { decodeSave, encodeSave, IndexedDBAdapter, JOURNAL_KEY, planSaveWrites, SaveManager } from '../public/games/hanedanian/save.js';

const clone = value => structuredClone(value);
const game = (name = 'Sedir Hanedanı') => createGame({ seed: 'TL-SAVE-TEST', size: 17, aiCount: 2, dynastyName: name });

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
  removeItem(key) { this.data.delete(key); }
}

// Fault injection at a transaction's commit boundary. Reads and writes use
// snapshots, and a failing commit applies neither auto nor its previous backup.
class TransactionalMemoryAdapter {
  records = {};
  queue = Promise.resolve();
  failure = null;
  calls = 0;
  async init() {}
  async readAll() { await this.queue; return clone(this.records); }
  commit(slot, record) {
    const next = this.queue.then(async () => {
      this.calls++;
      const transaction = clone(this.records);
      for (const write of planSaveWrites(transaction[slot], slot, clone(record))) transaction[write.slot] = write;
      await Promise.resolve();
      if (this.failure) throw this.failure;
      this.records = transaction;
    });
    this.queue = next.catch(() => {});
    return next;
  }
}

function setup(options = {}) {
  const adapter = options.adapter || new TransactionalMemoryAdapter();
  const storage = options.storage === undefined ? new MemoryStorage() : options.storage;
  const manager = new SaveManager({ adapter, storage, now: () => 1000, ...options });
  return { manager, adapter, storage };
}

test('versioned checksum roundtrip retains complete seeded world and Unicode', () => {
  const state = createGame({ seed: 'TL-SAVE-49', size: 49, aiCount: 8, dynastyName: 'Şafak · Çınar' });
  assert.equal(state.world.tiles.length, 2401);
  assert.equal(validateState(state).ok, true);
  const raw = encodeSave(state, 42);
  const decoded = decodeSave(raw);
  assert.deepEqual(decoded.state, state);
  assert.equal(decoded.savedAt, 42);
  assert.equal(decoded.schemaVersion, 1);
  assert.match(JSON.parse(raw).checksum, /^crc32:[a-f0-9]{8}$/);
});

test('checksum is key-order independent but catches mutation of progress and metadata', () => {
  const payload = JSON.parse(encodeSave(game(), 42));
  payload.state = Object.fromEntries(Object.entries(payload.state).reverse());
  assert.equal(decodeSave(JSON.stringify(payload)).state.world.seed, 'TL-SAVE-TEST');
  payload.savedAt = 43;
  assert.throws(() => decodeSave(JSON.stringify(payload)), error => error.code === 'corrupt');
  payload.savedAt = 42;
  payload.state.time += 10;
  assert.throws(() => decodeSave(JSON.stringify(payload)), error => error.code === 'corrupt');
});

test('malformed, foreign, oversized and unsupported schema imports fail explicitly', () => {
  for (const raw of ['', '{', 'null', '[]', '{"format":"other"}', ' '.repeat(4 * 1024 * 1024 + 1)]) assert.throws(() => decodeSave(raw));
  const envelope = JSON.parse(encodeSave(game(), 42));
  envelope.formatVersion = 2;
  assert.throws(() => decodeSave(JSON.stringify(envelope)), error => error.code === 'future-version');
  envelope.formatVersion = 0;
  assert.throws(() => decodeSave(JSON.stringify(envelope)), error => error.code === 'unsupported-version');
  envelope.formatVersion = 1;
  envelope.schemaVersion = 99;
  assert.throws(() => decodeSave(JSON.stringify(envelope)), error => error.code === 'future-version');
});

test('invalid state, nonfinite values, cycles and prototype keys cannot be serialized', () => {
  assert.throws(() => encodeSave({ schemaVersion: 1 }));
  assert.throws(() => encodeSave({ ...game(), schemaVersion: 2 }), error => error.code === 'future-version');
  const nonfinite = game(); nonfinite.time = NaN;
  assert.throws(() => encodeSave(nonfinite));
  const circular = game(); circular.extra = circular;
  assert.throws(() => encodeSave(circular));
  const malicious = JSON.parse('{"schemaVersion":1,"__proto__":{"polluted":true}}');
  assert.throws(() => encodeSave(malicious));
  assert.equal({}.polluted, undefined);
});

test('autosave rotates previous atomically while manual slot remains independent', async () => {
  const { manager } = setup();
  const first = game('Birinci'), second = game('İkinci'), manual = game('Elle');
  assert.equal((await manager.init()).ok, true);
  assert.equal((await manager.save(first)).ok, true);
  assert.equal((await manager.save(manual, 'manual')).ok, true);
  assert.equal((await manager.save(second)).ok, true);
  assert.deepEqual((await manager.load()).state, second);
  assert.deepEqual((await manager.load('previous')).state, first);
  assert.deepEqual((await manager.load('manual')).state, manual);
  const slots = await manager.list();
  assert.equal(slots.auto.valid, true);
  assert.equal(slots.auto.worldSeed, first.world.seed);
  assert.equal(slots.auto.gameTime, second.time);
  assert.equal(slots.previous.valid, true);
  assert.equal(slots.manual.valid, true);
});

test('transaction failure preserves both durable snapshots and exports failed progress', async () => {
  const { manager, adapter } = setup();
  await manager.save(game('Önceki'));
  await manager.save(game('Mevcut'));
  const before = clone(adapter.records), unsaved = game('Kaydedilemeyen');
  adapter.failure = Object.assign(new Error('quota'), { name: 'QuotaExceededError', code: 22 });
  const result = await manager.save(unsaved);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'quota');
  assert.deepEqual(adapter.records, before);
  assert.equal(manager.status().unsaved, true);
  assert.deepEqual(decodeSave(manager.export()).state, unsaved);
  adapter.failure = null;
  assert.equal((await manager.save(unsaved)).ok, true);
  assert.equal(manager.status().unsaved, false);
});

test('concurrent saves capture states at invocation and cannot overwrite newest with older', async () => {
  const { manager } = setup();
  const state = game('Başlangıç');
  const original = clone(state);
  const first = manager.save(state);
  state.time += 1;
  const secondSnapshot = clone(state);
  const second = manager.save(state);
  state.time += 1;
  assert.equal((await first).ok, true);
  assert.equal((await second).ok, true);
  assert.deepEqual((await manager.load()).state, secondSnapshot);
  assert.deepEqual((await manager.load('previous')).state, original);
});

test('stale cross-tab write is rejected within transaction without rotating backup', async () => {
  const { adapter, manager } = setup({ now: () => 2000 });
  assert.equal((await manager.save(game('Yeni sekme'))).ok, true);
  const before = clone(adapter.records);
  const olderTab = new SaveManager({ adapter, storage: null, now: () => 1000 });
  const result = await olderTab.save(game('Eski sekme'));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'stale');
  assert.deepEqual(adapter.records, before);
  assert.equal(olderTab.status().unsaved, true);
});

test('corrupt auto falls back to previous and never modifies the corrupt source', async () => {
  const { manager, adapter } = setup();
  const previous = game('Sağlam yedek');
  await manager.save(previous);
  await manager.save(game('Bozulan kayıt'));
  adapter.records.auto.raw = '{broken';
  const before = clone(adapter.records);
  const loaded = await manager.load();
  assert.equal(loaded.ok, true);
  assert.equal(loaded.recovered, true);
  assert.equal(loaded.slot, 'previous');
  assert.match(loaded.message, /kurtarıldı/);
  assert.deepEqual(loaded.state, previous);
  assert.deepEqual(adapter.records, before);
  assert.equal((await manager.list()).auto.valid, false);
  await manager.save(game('Kurtarma sonrası'));
  assert.deepEqual(decodeSave(adapter.records.previous.raw).state, previous);
});

test('all corrupt slots report failure without replacing progress with a new game', async () => {
  const { manager, adapter } = setup();
  adapter.records = { auto: { slot: 'auto', raw: '{', savedAt: 1 }, previous: { slot: 'previous', raw: 'null', savedAt: 0 } };
  const before = clone(adapter.records);
  assert.equal((await manager.load()).ok, false);
  assert.deepEqual(adapter.records, before);
});

test('future schema is protected on load AND write, even with a valid older fallback', async () => {
  const { manager, adapter } = setup();
  await manager.save(game('Uyumlu'));
  await manager.save(game('Yeni sürüm'));
  const future = JSON.parse(adapter.records.auto.raw); future.schemaVersion = 2;
  adapter.records.auto.raw = JSON.stringify(future);
  const before = clone(adapter.records);
  assert.equal((await manager.load()).code, 'future-version');
  assert.equal((await manager.save(game('Yanlışlıkla sıfırlama'))).code, 'future-version');
  assert.deepEqual(adapter.records, before);
});

test('invalid import never performs any write; valid import goes to manual and returns state', async () => {
  const { manager, adapter } = setup();
  await manager.save(game('Mevcut'));
  const before = clone(adapter.records), writes = adapter.calls;
  assert.equal((await manager.import('{broken')).ok, false);
  assert.equal(adapter.calls, writes);
  assert.deepEqual(adapter.records, before);
  const imported = game('İçe aktarılan');
  const result = await manager.import(encodeSave(imported, 5));
  assert.equal(result.ok, true);
  assert.equal(result.slot, 'manual');
  assert.deepEqual(result.state, imported);
  assert.deepEqual((await manager.load('manual')).state, imported);
  assert.deepEqual(adapter.records.auto, before.auto);
});

test('newer pagehide journal survives a reload, then clears only after durable auto commit', async () => {
  const { manager, adapter, storage } = setup();
  await manager.save(game('Eski disk kaydı'));
  const latest = game('Telefon kapandı');
  assert.equal(manager.checkpoint(latest).ok, true);
  assert.ok(storage.getItem(JOURNAL_KEY));
  const reloaded = new SaveManager({ adapter, storage, now: () => 900 });
  const loaded = await reloaded.load();
  assert.equal(loaded.slot, 'journal');
  assert.equal(loaded.recovered, true);
  assert.deepEqual(loaded.state, latest);
  await reloaded.save(latest, 'manual');
  assert.ok(storage.getItem(JOURNAL_KEY), 'manual must not clear automatic recovery');
  adapter.failure = new Error('write aborted');
  assert.equal((await reloaded.save(latest)).ok, false);
  assert.ok(storage.getItem(JOURNAL_KEY), 'failed transaction must not clear recovery');
  adapter.failure = null;
  await reloaded.save(latest);
  assert.equal(storage.getItem(JOURNAL_KEY), null);
  assert.equal((await reloaded.load()).slot, 'auto');
});

test('an older or corrupt journal cannot roll back a valid durable autosave', async () => {
  const { manager, storage } = setup();
  const latest = game('Yeni disk');
  await manager.save(latest);
  storage.setItem(JOURNAL_KEY, encodeSave(game('Eski kapanış'), 4));
  assert.deepEqual((await manager.load()).state, latest);
  storage.setItem(JOURNAL_KEY, '{corrupt');
  const loaded = await manager.load();
  assert.equal(loaded.ok, true);
  assert.equal(loaded.slot, 'auto');
  assert.deepEqual(loaded.state, latest);
});

test('an older journal cannot displace a newer valid previous save during corruption recovery', async () => {
  const { manager, adapter, storage } = setup();
  const previous = game('Sağlam önceki kayıt');
  await manager.save(previous);
  await manager.save(game('Bozuk mevcut kayıt'));
  adapter.records.auto.raw = '{corrupt';
  storage.setItem(JOURNAL_KEY, encodeSave(game('Çok eski kapanış'), 4));
  const loaded = await manager.load();
  assert.equal(loaded.slot, 'previous');
  assert.deepEqual(loaded.state, previous);
});

test('IndexedDB unavailable reports failure, retains export, and can recover a journal', async () => {
  const storage = new MemoryStorage();
  const manager = new SaveManager({ adapter: new IndexedDBAdapter(null), storage, now: () => 1000 });
  assert.equal((await manager.init()).ok, false);
  const state = game('Geçici bellek');
  assert.equal((await manager.save(state)).ok, false);
  assert.equal(manager.status().available, false);
  assert.deepEqual(decodeSave(manager.export()).state, state);
  assert.equal(manager.checkpoint(state).ok, true);
  const slots = await manager.list();
  assert.equal(slots.ok, false);
  assert.equal(slots.journal.valid, true);
  const loaded = await manager.load();
  assert.equal(loaded.ok, true);
  assert.equal(loaded.slot, 'journal');
  assert.ok(loaded.warning);
  assert.deepEqual(loaded.state, state);
});

test('localStorage quota failure is visible and never reported as saved', () => {
  const { manager } = setup({ storage: { getItem: () => null, setItem: () => { throw Object.assign(new Error(), { name: 'QuotaExceededError' }); } } });
  const state = game();
  const result = manager.checkpoint(state);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'quota');
  assert.equal(manager.status().unsaved, true);
  assert.deepEqual(decodeSave(manager.export()).state, state);
});

test('legacy migration policy exports original bytes and never rewrites old HANEDAN saves', async () => {
  const { manager, storage } = setup();
  storage.setItem('tariklab::hanedan:1', '{"old": "court game"}');
  storage.setItem('tariklab::hanedan:1:bak', 'broken but preserved');
  storage.setItem('cete_hanedan_v1', 'legacy-v1');
  storage.setItem('unrelated-game', 'leave alone');
  const original = new Map(storage.data);
  assert.equal(manager.legacySaves().length, 3);
  const exported = JSON.parse(manager.exportLegacy());
  assert.equal(exported.format, 'tariklab-hanedan-legacy-backup');
  assert.deepEqual(exported.saves, manager.legacySaves());
  assert.equal((await manager.import(storage.getItem('tariklab::hanedan:1'))).ok, false);
  await manager.save(game());
  assert.deepEqual(storage.data, original);
});

test('previous slot is read-only, unknown slots fail, and empty slots do not reset data', async () => {
  const { manager, adapter } = setup();
  assert.equal((await manager.load()).code, 'empty');
  assert.equal((await manager.load('missing')).code, 'invalid-slot');
  assert.equal((await manager.save(game(), 'previous')).code, 'invalid-slot');
  assert.equal(adapter.calls, 0);
  assert.deepEqual(adapter.records, {});
});
