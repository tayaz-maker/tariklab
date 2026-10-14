import test from "node:test";
import assert from "node:assert/strict";
import { SAVE_VERSION, createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { loadGame, saveGame } from "../public/games/tc-sim/js/save.js";
import {
  MAX_SHOPS,
  SHOPS,
  SHOP_SALT,
  closeShop,
  normalizeSemt,
  openShop,
  processSemtWeek,
  semtRoll,
  sellShop,
  shopWeekNet,
  tendShop,
} from "../public/games/tc-sim/js/quarters.js";

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

const fresh = () => {
  const state = createNewGame({ name: "Girişim", now: "2027-01-01T00:00:00.000Z", seed: 11 });
  state.finances.balance = 900000;
  state.time.year = 2027;
  return state;
};

const resetWeek = (state) => {
  state.weekly.used = 0;
  state.weekly.selectedIds = [];
};

const wholeLedger = (state) => state.finances.ledger.every((row) => Number.isInteger(row.amount));

test("ikinci tezgâh dört haftadan önce kilitli, sonra açılır; ilki durur", () => {
  const state = fresh();
  assert.equal(openShop(state, "ceper", "bakkal").ok, true);
  resetWeek(state);
  const early = openShop(state, "kiyi", "lokanta");
  assert.equal(early.ok, false);
  assert.match(early.reason, /İkinci tezgâh/);
  const opened = state.household.semt.shops[0].openedWeek;
  state.time.absoluteWeek = opened + 3;
  assert.match(openShop(state, "kiyi", "lokanta").reason, /dört hafta/);
  state.time.absoluteWeek = opened + 4;
  const second = openShop(state, "kiyi", "lokanta");
  assert.equal(second.ok, true);
  assert.equal(state.household.semt.shops.length, 2);
  assert.equal(state.household.semt.shop.id, "bakkal");
  assert.equal(state.household.semt.shop.quarterId, "ceper");
  assert.equal(state.household.semt.shops[1].id, "lokanta");
  assert.match(state.memories.at(-1).text, /kendi ziyaretini/);
  assert.equal(wholeLedger(state), true);
});

test("küçük esnaf ve girişim ortağı beklemeden ikinci tezgâhı açar; dördüncü yok", () => {
  assert.equal(MAX_SHOPS, 3);
  for (const jobId of ["shop_owner", "startup"]) {
    const state = fresh();
    state.career.jobId = jobId;
    assert.equal(openShop(state, "ceper", "bakkal").ok, true);
    resetWeek(state);
    assert.equal(openShop(state, "kiyi", "lokanta").ok, true);
    resetWeek(state);
    assert.equal(openShop(state, "sirt", "cafe").ok, true);
    resetWeek(state);
    const fourth = openShop(state, "sirt", "berber");
    assert.equal(fourth.ok, false);
    assert.match(fourth.reason, /Üç tezgâh yeter/);
    assert.equal(state.household.semt.shops.length, 3);
  }
});

test("aynı mahallede ikinci aynı iş açılır; üçüncüsü yok", () => {
  const state = fresh();
  state.career.jobId = "startup";
  assert.equal(openShop(state, "sirt", "cafe").ok, true);
  resetWeek(state);
  assert.equal(openShop(state, "sirt", "cafe").ok, true);
  assert.equal(state.household.semt.shops.filter((shop) => shop.id === "cafe").length, 2);
  assert.equal(state.household.semt.shops[1].n, 2);
  resetWeek(state);
  assert.match(openShop(state, "sirt", "cafe").reason, /iki tezgâh yeter/);
});

test("uğrama tezgâha özeldir; ihmal edilenin neti ayrı düşer, yük 400 TL", () => {
  const state = fresh();
  state.career.jobId = "shop_owner";
  assert.equal(openShop(state, "ceper", "bakkal").ok, true);
  resetWeek(state);
  assert.equal(openShop(state, "kiyi", "lokanta").ok, true);
  const opened = state.household.semt.shops[0].openedWeek;
  state.time.absoluteWeek = opened + 1;
  resetWeek(state);
  assert.equal(tendShop(state, "ceper:bakkal").ok, true);
  assert.equal(state.household.semt.shops[0].attentionWeek, state.time.absoluteWeek);
  assert.equal(state.household.semt.shops[1].attentionWeek, 0);
  assert.equal(tendShop(state, "ceper:bakkal").ok, false);
  assert.equal(tendShop(state, "kiyi:lokanta").ok, true);
  state.household.semt.shops[1].attentionWeek = 0;
  state.weekly.selectedIds = state.weekly.selectedIds.filter((id) => id !== "semt:tend:kiyi:lokanta");
  state.household.semt.lastWeek = 0;
  const mark = state.finances.ledger.length;
  const note = processSemtWeek(state);
  const rows = state.finances.ledger.slice(mark);
  assert.equal(rows.length, 2);
  const tended = shopWeekNet(SHOPS.bakkal, { tended: true, roll: semtRoll(state, SHOP_SALT) }).net;
  const ignored = shopWeekNet(SHOPS.lokanta, { tended: false, roll: semtRoll(state, SHOP_SALT + 97) }).net - 400;
  assert.equal(rows.find((row) => row.reason.includes("Bakkal")).amount, tended);
  assert.equal(rows.find((row) => row.reason.includes("Küçük lokanta")).amount, ignored);
  assert.match(note, /yük/);
  assert.equal(Number.isInteger(tended) && Number.isInteger(ignored), true);
  assert.equal(wholeLedger(state), true);
});

test("tek tezgâhta ihmal 400 TL yük bindirmez", () => {
  const state = fresh();
  assert.equal(openShop(state, "ceper", "bakkal").ok, true);
  state.time.absoluteWeek = state.household.semt.shops[0].openedWeek + 1;
  state.household.semt.lastWeek = 0;
  const before = state.finances.balance;
  processSemtWeek(state);
  const expected = shopWeekNet(SHOPS.bakkal, { tended: false, roll: semtRoll(state, SHOP_SALT) }).net;
  assert.equal(state.finances.balance - before, expected);
  assert.equal(Number.isInteger(expected), true);
});

test("bir tezgâhı kapatmak diğerini ve semt.shop işaretini bırakır", () => {
  const state = fresh();
  state.career.jobId = "shop_owner";
  assert.equal(openShop(state, "ceper", "bakkal").ok, true);
  resetWeek(state);
  assert.equal(openShop(state, "kiyi", "lokanta").ok, true);
  resetWeek(state);
  assert.equal(closeShop(state, "ceper:bakkal").ok, true);
  assert.equal(state.household.semt.shops.length, 1);
  assert.equal(state.household.semt.shops[0].id, "lokanta");
  assert.equal(state.household.semt.shop.id, "lokanta");
  resetWeek(state);
  tendShop(state);
  assert.equal(sellShop(state).ok, true);
  assert.equal(state.household.semt.shop, null);
  assert.equal(state.household.semt.shops.length, 0);
});

test("eski tek tezgâh kaydı shops dizisine iner; iki tezgâh v6 kaydı açılır", () => {
  const legacy = fresh();
  assert.equal(openShop(legacy, "ceper", "bakkal").ok, true);
  const dumped = JSON.parse(JSON.stringify(legacy));
  delete dumped.household.semt.shops;
  normalizeSemt(dumped);
  assert.equal(dumped.household.semt.shops.length, 1);
  assert.equal(dumped.household.semt.shop.id, "bakkal");
  assert.equal(dumped.meta.saveVersion, SAVE_VERSION);

  const state = fresh();
  state.career.jobId = "startup";
  assert.equal(openShop(state, "ceper", "bakkal").ok, true);
  resetWeek(state);
  assert.equal(openShop(state, "sirt", "kirtasiye").ok, true);
  const storage = new MemoryStorage();
  assert.equal(saveGame(storage, state).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true, loaded.error || loaded.message);
  assert.equal(loaded.state.meta.saveVersion, 6);
  assert.equal(loaded.state.household.semt.shops.length, 2);
  assert.equal(loaded.state.household.semt.shop.id, "bakkal");
  assert.equal(loaded.state.household.semt.shops[1].id, "kirtasiye");
  assert.equal(validateState(loaded.state).ok, true);
  assert.equal(wholeLedger(loaded.state), true);
});

test("iyi hafta, az müşteri, rekabet ve denetim aynı formülde ayrılır", () => {
  const calm = shopWeekNet(SHOPS.bakkal, { tended: true, roll: 0.5 });
  const good = shopWeekNet(SHOPS.bakkal, { tended: true, roll: 0.9 });
  const quiet = shopWeekNet(SHOPS.bakkal, { tended: true, roll: 0.05 });
  const rival = shopWeekNet(SHOPS.bakkal, { tended: false, roll: 0.2 });
  const raid = shopWeekNet(SHOPS.lokanta, { tended: false, roll: 0.15 });
  assert.equal(good.note, "iyi hafta");
  assert.equal(quiet.note, "az müşteri");
  assert.equal(rival.note, "rekabet");
  assert.equal(raid.note, "denetim");
  assert.ok(good.net > calm.net);
  assert.ok(quiet.net < calm.net);
  assert.equal(raid.fine, 2000);
  for (const row of [calm, good, quiet, rival, raid]) {
    assert.equal(Number.isInteger(row.net), true);
    assert.equal(Number.isInteger(row.income), true);
  }
});

test("iki tezgâhta olaylar ayrıdır; uğramadan denetim dosya ve anne ilişkisi açar, tek tezgâh açmaz", () => {
  const single = fresh();
  assert.equal(openShop(single, "ceper", "bakkal").ok, true);
  const openedOne = single.household.semt.shops[0].openedWeek;
  let singleRaid = false;
  for (let step = 1; step <= 80 && !singleRaid; step += 1) {
    single.time.absoluteWeek = openedOne + step;
    single.household.semt.lastWeek = 0;
    single.household.semt.shops[0].attentionWeek = 0;
    const note = processSemtWeek(single);
    if (note.includes("denetim")) singleRaid = true;
  }
  assert.equal(singleRaid, true);
  assert.equal(single.openCases.some((item) => item.type === "esnaf-dosya"), true);

  const state = fresh();
  state.career.jobId = "startup";
  const anne = state.relationships.anne;
  assert.equal(openShop(state, "ceper", "bakkal").ok, true);
  resetWeek(state);
  assert.equal(openShop(state, "kiyi", "lokanta").ok, true);
  const opened = state.household.semt.shops[0].openedWeek;
  let split = null;
  for (let step = 1; step <= 120 && !split; step += 1) {
    state.time.absoluteWeek = opened + step;
    resetWeek(state);
    state.household.semt.lastWeek = 0;
    for (const shop of state.household.semt.shops) shop.attentionWeek = 0;
    const mark = state.finances.ledger.length;
    const note = processSemtWeek(state);
    const rows = state.finances.ledger.slice(mark);
    if (rows.length !== 2) continue;
    const parts = note.split(" · ");
    if (parts.length === 2 && parts[0] !== parts[1] && note.includes("denetim")) split = { note, rows };
  }
  assert.ok(split, "iki tezgâhın denetimi hiç ayrışmadı");
  assert.notEqual(split.rows[0].amount, split.rows[1].amount);
  assert.equal(split.rows.every((row) => Number.isInteger(row.amount)), true);
  const file = state.openCases.find((item) => item.type === "esnaf-dosya" && item.status === "pending");
  assert.ok(file);
  assert.match(file.payload.text, /dosyaya geçti/);
  assert.ok(state.relationships.anne < anne);
  assert.equal(validateState(state).ok, true, validateState(state).errors?.join("; "));
  state.time.absoluteWeek = file.dueWeek;
  state.household.semt.lastWeek = 0;
  processSemtWeek(state);
  assert.equal(file.status, "resolved");
});
