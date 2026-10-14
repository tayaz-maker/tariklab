import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame } from "../public/games/tc-sim/js/state.js";
import {
  KALFA_WAGE,
  SHOPS,
  SHOP_SALT,
  closeShop,
  hireKalfa,
  openShop,
  processSemtWeek,
  sellShop,
  semtRoll,
  shopWeekNet,
} from "../public/games/tc-sim/js/quarters.js";

const fresh = () => {
  const state = createNewGame({ name: "İnce", now: "2027-01-01T00:00:00.000Z", seed: 11 });
  state.finances.balance = 900000;
  state.time.year = 2027;
  state.career.jobId = "shop_owner";
  return state;
};

const resetWeek = (state) => {
  state.weekly.used = 0;
  state.weekly.selectedIds = [];
};

test("tezgâh kapanır ve satılır; nakit tam lira döner", () => {
  const state = fresh();
  assert.equal(openShop(state, "ceper", "bakkal").ok, true);
  resetWeek(state);
  const closed = closeShop(state, "ceper:bakkal");
  assert.equal(closed.ok, true);
  assert.equal(closed.message.includes(String(Math.round(SHOPS.bakkal.startup * 0.3))), true);
  assert.equal(state.household.semt.shop, null);
  resetWeek(state);
  assert.equal(openShop(state, "kiyi", "lokanta").ok, true);
  resetWeek(state);
  const sold = sellShop(state, "kiyi:lokanta");
  assert.equal(sold.ok, true);
  assert.match(sold.message, /Sattın/);
  assert.equal(state.household.semt.shops.length, 0);
  assert.equal(state.finances.ledger.every((row) => Number.isInteger(row.amount)), true);
});

test("tek tezgâhta uğramadan denetim dosyası açılır", () => {
  const state = fresh();
  assert.equal(openShop(state, "ceper", "bakkal").ok, true);
  const opened = state.household.semt.shops[0].openedWeek;
  let file = null;
  for (let step = 1; step <= 80 && !file; step += 1) {
    state.time.absoluteWeek = opened + step;
    state.household.semt.lastWeek = 0;
    state.household.semt.shops[0].attentionWeek = 0;
    processSemtWeek(state);
    file = state.openCases.find((item) => item.type === "esnaf-dosya" && item.status === "pending");
  }
  assert.ok(file);
  assert.match(file.payload.text, /Uğramadığın hafta/);
});

test("askerlik ve tutuklamada uğranamayan tezgâhın cirosu ihmal kadar düşer", () => {
  for (const lock of ["army", "cell"]) {
    const state = fresh();
    assert.equal(openShop(state, "ceper", "bakkal").ok, true);
    const opened = state.household.semt.shops[0].openedWeek;
    state.time.absoluteWeek = opened + 1;
    if (lock === "army") state.flags.askerlik = { mode: "serving", until: state.time.absoluteWeek + 4 };
    else state.flags.risk = { detainedUntil: state.time.absoluteWeek + 2 };
    state.household.semt.shops[0].attentionWeek = state.time.absoluteWeek;
    state.household.semt.lastWeek = 0;
    const before = state.finances.balance;
    const note = processSemtWeek(state);
    const expected = shopWeekNet(SHOPS.bakkal, { tended: false, roll: semtRoll(state, SHOP_SALT) }).net;
    assert.equal(state.finances.balance - before, expected);
    assert.match(note, lock === "army" ? /askerlik|az müşteri|denetim|rekabet|iyi hafta/ : /içeride|az müşteri|denetim|rekabet|iyi hafta/);
    assert.ok(expected < shopWeekNet(SHOPS.bakkal, { tended: true, roll: semtRoll(state, SHOP_SALT) }).net);
  }
});

test("aynı mahallede aynı işin ikincisi ikisinin de cirosunu düşürür", () => {
  const state = fresh();
  assert.equal(openShop(state, "sirt", "cafe").ok, true);
  resetWeek(state);
  assert.equal(openShop(state, "sirt", "cafe").ok, true);
  const opened = state.household.semt.shops[0].openedWeek;
  state.time.absoluteWeek = opened + 1;
  state.household.semt.lastWeek = 0;
  const before = state.finances.balance;
  processSemtWeek(state);
  const cut = Math.round(SHOPS.cafe.weeklyIn * 0.15);
  const first = shopWeekNet(SHOPS.cafe, { tended: false, roll: semtRoll(state, SHOP_SALT) }).net - 400 - cut;
  const second = shopWeekNet(SHOPS.cafe, { tended: false, roll: semtRoll(state, SHOP_SALT + 97) }).net - 400 - cut;
  assert.equal(state.finances.balance - before, first + second);
  assert.ok(cut > 0);
  assert.equal(Number.isInteger(first + second), true);
});

test("kalfa maaşla uğramayı kaldırır; icra pozitif cirodan onda bir alır", () => {
  const state = fresh();
  assert.equal(openShop(state, "ceper", "bakkal").ok, true);
  const opened = state.household.semt.shops[0].openedWeek;
  state.time.absoluteWeek = opened + 1;
  resetWeek(state);
  assert.equal(hireKalfa(state).ok, true);
  state.household.semt.lastWeek = 0;
  const before = state.finances.balance;
  const note = processSemtWeek(state);
  const result = shopWeekNet(SHOPS.bakkal, { tended: true, roll: semtRoll(state, SHOP_SALT) });
  const net = Math.round(result.income * 0.9) - result.expense - result.fine;
  assert.equal(state.finances.balance - before, net - KALFA_WAGE);
  assert.match(note, /kalfa|az müşteri|denetim|rekabet|iyi hafta/);
  assert.equal(state.household.semt.shops[0].attentionWeek, 0);

  const lien = fresh();
  assert.equal(openShop(lien, "ceper", "bakkal").ok, true);
  lien.time.absoluteWeek = lien.household.semt.shops[0].openedWeek + 1;
  lien.household.semt.lastWeek = 0;
  lien.openCases.push({
    id: "icra-tezgah",
    type: "icra",
    createdWeek: 1,
    dueWeek: 40,
    status: "pending",
    payload: { owed: 5000, amount: 5000, stage: "plan" },
  });
  const cash = lien.finances.balance;
  processSemtWeek(lien);
  const raw = shopWeekNet(SHOPS.bakkal, { tended: false, roll: semtRoll(lien, SHOP_SALT) }).net;
  const cut = raw > 0 ? Math.min(5000, Math.round(raw * 0.1)) : 0;
  assert.equal(lien.finances.balance - cash, raw - cut);
  assert.equal(lien.openCases[0].payload.owed, 5000 - cut);
  assert.equal(Number.isInteger(cut), true);
});
