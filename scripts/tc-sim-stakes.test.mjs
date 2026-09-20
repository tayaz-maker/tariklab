import test from "node:test";
import assert from "node:assert/strict";
import {
  CRITICAL_HEALTH,
  SAVE_VERSION,
  WEEKLY_ACTIVITY_LIMIT,
  createNewGame,
  getWeeklyActivityLimit,
  isCriticalHealth,
  validateState,
} from "../public/games/tc-sim/js/state.js";
import {
  OVERTIME_BASE_PAY,
  applyDecision,
  canApplyDecision,
  getAvailableDecisions,
  getOvertimePay,
  getOvertimeStress,
  getRestEnergyGain,
  advanceWeek,
} from "../public/games/tc-sim/js/time.js";
import { canUseSocialAction, scheduleSocialFollowup } from "../public/games/tc-sim/js/social.js";
import { getEventDefinition, resolveEvent } from "../public/games/tc-sim/js/events.js";
import {
  HIDDEN_CASE_TYPES,
  getKnownOpenCases,
  getPlayerVisibleOpenCases,
} from "../public/games/tc-sim/js/calendar.js";
import { loadGame, saveGame } from "../public/games/tc-sim/js/save.js";

class MemoryStorage {
  data = new Map();
  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }
  setItem(key, value) {
    this.data.set(key, String(value));
  }
  removeItem(key) {
    this.data.delete(key);
  }
}

const fresh = () => createNewGame({ name: "Denge", now: "2027-01-01T00:00:00.000Z", seed: 3 });

/** Açık olay haftayı ilerletmeyi engeller; testlerde ilk seçenekle kapatılır. */
const settle = (state) => {
  let guard = 0;
  while (state.events.active && guard++ < 20) {
    const definition = getEventDefinition(state.events.active.eventId);
    resolveEvent(state, definition.choices[0].id);
  }
};

// ============================ Ek mesai ============================

test("ek mesai ilk haftalarda tam öder, aralıksız sürdükçe azalır ve dibi vardır", () => {
  assert.equal(getOvertimePay(0), OVERTIME_BASE_PAY);
  assert.equal(getOvertimePay(1), OVERTIME_BASE_PAY);
  assert.ok(getOvertimePay(2) < OVERTIME_BASE_PAY);
  assert.ok(getOvertimePay(4) < getOvertimePay(2));
  assert.equal(getOvertimePay(9), getOvertimePay(20));
  assert.equal(getOvertimePay(20), Math.round(OVERTIME_BASE_PAY * 0.5));
});

test("aralıksız ek mesai stresi de artırır ama tavanı vardır", () => {
  assert.equal(getOvertimeStress(0), getOvertimeStress(1));
  assert.ok(getOvertimeStress(4) > getOvertimeStress(0));
  assert.equal(getOvertimeStress(20), getOvertimeStress(40));
});

test("ara verilen hafta seriyi sıfırlar; mesai yeniden tam öder", () => {
  const state = fresh();
  applyDecision(state, "overtime");
  assert.equal(state.flags.overtimeStreak, 1);
  settle(state);
  advanceWeek(state);
  assert.equal(state.flags.overtimeStreak, 1, "mesai yapılan hafta seri korunur");
  settle(state);
  advanceWeek(state);
  assert.equal(state.flags.overtimeStreak, 0, "mesai yapılmayan hafta seri sıfırlanır");
  settle(state);
  const before = state.finances.balance;
  applyDecision(state, "overtime");
  assert.equal(state.finances.balance - before, OVERTIME_BASE_PAY, "ara sonrası tam ödeme");
});

test("üst üste mesai gerçekten daha az para getirir", () => {
  const state = fresh();
  const payFor = () => {
    const before = state.finances.balance;
    state.weekly = { used: 0, selectedIds: [] };
    applyDecision(state, "overtime");
    return state.finances.balance - before;
  };
  const first = payFor();
  for (let i = 0; i < 4; i += 1) payFor();
  state.weekly = { used: 0, selectedIds: [] };
  const later = payFor();
  assert.ok(later < first, `${later} < ${first} olmalı`);
});

// ============================ Dinlenme ============================

test("dinlenme yüksek streste daha az toparlar ama hep işe yarar", () => {
  assert.ok(getRestEnergyGain(0) > getRestEnergyGain(65));
  assert.ok(getRestEnergyGain(65) > getRestEnergyGain(85));
  assert.ok(getRestEnergyGain(85) > 0);
});

test("dinlenme kararı stres seviyesine göre enerji verir", () => {
  const calm = fresh();
  calm.health.stress = 10;
  calm.health.energy = 40;
  applyDecision(calm, "rest");
  const calmGain = calm.health.energy - 40;

  const tense = fresh();
  tense.health.stress = 85;
  tense.health.energy = 40;
  applyDecision(tense, "rest");
  const tenseGain = tense.health.energy - 40;

  assert.ok(calmGain > tenseGain, `sakin ${calmGain} > gergin ${tenseGain}`);
  assert.ok(tenseGain > 0);
});

// ============================ Kritik sağlık ============================

test("kritik sağlıkta haftalık karar hakkı düşer, toparlanınca geri gelir", () => {
  const state = fresh();
  assert.equal(getWeeklyActivityLimit(state), WEEKLY_ACTIVITY_LIMIT);
  state.health.health = CRITICAL_HEALTH;
  assert.equal(isCriticalHealth(state), true);
  assert.equal(getWeeklyActivityLimit(state), 3);
  state.health.health = CRITICAL_HEALTH + 10;
  assert.equal(isCriticalHealth(state), false);
  assert.equal(getWeeklyActivityLimit(state), WEEKLY_ACTIVITY_LIMIT);
});

test("sağlık 0 olan oyuncu sağlıklı oyuncu gibi davranamaz", () => {
  const healthy = fresh();
  const broken = fresh();
  broken.health.health = 0;

  assert.equal(canApplyDecision(healthy, "overtime").ok, true);
  assert.equal(canApplyDecision(broken, "overtime").ok, false);
  assert.equal(getWeeklyActivityLimit(broken) < getWeeklyActivityLimit(healthy), true);

  // Tek hakkını kullandıktan sonra ikinci bir şey yapamaz.
  assert.equal(applyDecision(broken, "rest").ok, true);
  assert.equal(canApplyDecision(broken, "exercise").ok, false);
  assert.equal(applyDecision(healthy, "rest").ok, true);
  assert.equal(canApplyDecision(healthy, "exercise").ok, true);
});

test("kritik sağlık geri dönülebilirdir: toparlama seçenekleri açık kalır", () => {
  const state = fresh();
  state.health.health = 8;
  state.finances.balance = 5000;
  assert.equal(canApplyDecision(state, "exercise").ok, true, "spor kapatılmamalı");
  assert.equal(canApplyDecision(state, "rest").ok, true, "dinlenme kapatılmamalı");
  assert.equal(applyDecision(state, "exercise").ok, true);
  assert.ok(state.health.health > 8, "sağlık geri kazanılabilir");
});

test("kritik sağlık sosyal etkileşim hakkını da daraltır", () => {
  const state = fresh();
  state.health.health = 5;
  assert.equal(applyDecision(state, "rest").ok, true);
  const check = canUseSocialAction(state, "mehmet", "meet");
  assert.equal(check.ok, false);
});

test("kritik sağlık geçmiş haftayı geçersiz kılmaz", () => {
  const state = fresh();
  assert.equal(applyDecision(state, "rest").ok, true);
  assert.equal(applyDecision(state, "exercise").ok, true);
  assert.equal(state.weekly.used, 2);
  state.health.health = 0;
  assert.equal(validateState(state).ok, true, "hakkı harcanmış hafta bozulmamalı");
  assert.equal(advanceWeek(state).ok, true);
});

// ============================ Görünürlük (UI-009) ============================

test("oyuncuya görünen açık meseleler gecikmeli sürprizleri içermez", () => {
  const state = fresh();
  scheduleSocialFollowup(state, {
    eventId: "debt_elif_comment",
    dueWeek: state.time.absoluteWeek + 6,
    personId: "elif",
  });
  state.openCases.push({
    id: "job-start-test",
    type: "job-start",
    createdWeek: state.time.absoluteWeek,
    dueWeek: state.time.absoluteWeek + 1,
    eventId: "job_start",
    status: "pending",
    payload: { jobId: "market" },
  });

  const visible = getPlayerVisibleOpenCases(state);
  assert.equal(visible.some((item) => item.type === "social-followup"), false);
  assert.equal(visible.some((item) => item.type === "job-start"), true);
  assert.equal(state.openCases.some((item) => item.type === "social-followup"), true);
});

test("gizli tür listesi tek kaynaktır ve TAKVİM ile tutarlıdır", () => {
  assert.ok(HIDDEN_CASE_TYPES.includes("social-followup"));
  const state = fresh();
  scheduleSocialFollowup(state, {
    eventId: "mehmet_learns_secret",
    dueWeek: state.time.absoluteWeek + 3,
    personId: "mehmet",
  });
  assert.equal(getKnownOpenCases(state).length, 0);
  assert.equal(getPlayerVisibleOpenCases(state).length, 0);
});

// ============================ Karar erişilebilirliği (UI-008) ============================

test("arkadaş ve aile kararları arayüzden gerçekten seçilebilir", () => {
  const state = fresh();
  const ids = getAvailableDecisions(state).map((decision) => decision.id);
  for (const id of ["family", "friend", "help-friend", "lend-friend"]) {
    assert.ok(ids.includes(id), `${id} listede olmalı`);
    assert.equal(canApplyDecision(state, id).ok, true, `${id} uygulanabilir olmalı`);
  }
});

test("tek seferlik kararlar kullanıldıktan sonra listeden düşer", () => {
  const state = fresh();
  assert.equal(applyDecision(state, "help-friend").ok, true);
  const ids = getAvailableDecisions(state).map((decision) => decision.id);
  assert.equal(ids.includes("help-friend"), false);
});

test("parası yetmeyen oyuncuya borç verme kararı gösterilmez", () => {
  const state = fresh();
  state.finances.balance = 100;
  const ids = getAvailableDecisions(state).map((decision) => decision.id);
  assert.equal(ids.includes("lend-friend"), false);
});

// ============================ Kayıt ============================

test("denge değişiklikleri kayıt sürümünü ve round-trip'i bozmaz", () => {
  const state = fresh();
  applyDecision(state, "overtime");
  advanceWeek(state);
  const storage = new MemoryStorage();
  assert.equal(saveGame(storage, state).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  assert.equal(SAVE_VERSION, 6);
  assert.equal(loaded.state.meta.saveVersion, 6);
  assert.equal(loaded.state.flags.overtimeStreak, state.flags.overtimeStreak);
  assert.equal(validateState(loaded.state).ok, true);
});
