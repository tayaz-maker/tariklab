import test from "node:test";
import assert from "node:assert/strict";
import { SAVE_VERSION, addNpcMemory, createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { loadGame, saveGame } from "../public/games/tc-sim/js/save.js";
import { processIntimacyFollowup } from "../public/games/tc-sim/js/intimacy.js";
import {
  activateNextEvent,
  getEventDefinition,
  processDueOpenCases,
  resolveEvent,
} from "../public/games/tc-sim/js/events.js";
import {
  applyRelationshipDelta,
  becomePartner,
  canBecomePartner,
  createPersonalDebt,
  getPersonalDebt,
  getRelationship,
  hasNpcMemory,
  resolvePersonalDebt,
  scheduleSocialFollowup,
  setRomanticInterest,
} from "../public/games/tc-sim/js/social.js";

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

const fresh = () => createNewGame({ name: "3D", now: "2027-01-01T00:00:00.000Z", seed: 7 });

// resolveEvent kendi kuyruğunu aynı hafta içinde organik olarak besleyebilir (mevcut,
// 3D öncesi de var olan motor davranışı). Senaryo testlerinde bir sonraki zincir
// aşamasına geçmeden önce, gerçek oyunda olduğu gibi açık kalan olayı sonuçlandırıyoruz.
const drain = (state) => {
  while (state.events.active) {
    const definition = getEventDefinition(state.events.active.eventId);
    resolveEvent(state, definition.choices[0].id);
  }
};

// ============================== Motor eklentileri ==============================

test("3D.1 hasNpcMemory true/false eşleşmesi", () => {
  const state = fresh();
  assert.equal(hasNpcMemory(state, "mehmet", "lent_2500"), false);
  addNpcMemory(state, "mehmet", "2.500 borç aldı.", "lent_2500");
  assert.equal(hasNpcMemory(state, "mehmet", "lent_2500"), true);
  assert.equal(hasNpcMemory(state, "mehmet", "kept_secret"), false);
});

test("3D.2 tip yazılan hafızalar da 50 kayıtla sınırlıdır", () => {
  const state = fresh();
  for (let i = 0; i < 70; i += 1) addNpcMemory(state, "mehmet", `borç anısı ${i}`, "lent_2500");
  assert.equal(state.people.find((p) => p.id === "mehmet").memories.length, 50);
  assert.equal(hasNpcMemory(state, "mehmet", "lent_2500"), true);
});

test("3D.3 personal-debt case doğru NPC'yi ve tutarı korur", () => {
  const state = fresh();
  assert.equal(createPersonalDebt(state, "mehmet", 2500, 4, "lent_2500"), true);
  const debt = getPersonalDebt(state, "mehmet");
  assert.equal(debt.type, "personal-debt");
  assert.equal(debt.payload.personId, "mehmet");
  assert.equal(debt.payload.amount, 2500);
  assert.equal(debt.status, "pending");
  // Aynı kişiye ikinci bir bekleyen borç açılamaz.
  assert.equal(createPersonalDebt(state, "mehmet", 1000, 4), false);
});

test("3D.4 borç bir kez tahsil edilir ya da bağışlanır, tekrar tetiklenmez", () => {
  const state = fresh();
  createPersonalDebt(state, "mehmet", 2500, 4, "lent_2500");
  const before = state.finances.balance;
  assert.equal(resolvePersonalDebt(state, "mehmet", { collected: true }), true);
  assert.equal(state.finances.balance, before + 2500);
  assert.equal(getPersonalDebt(state, "mehmet"), null);
  assert.equal(resolvePersonalDebt(state, "mehmet", { collected: true }), false);
  assert.equal(state.finances.balance, before + 2500);
});

test("3D.5 scheduleSocialFollowup erken tetiklenmez", () => {
  const state = fresh();
  const dueWeek = state.time.absoluteWeek + 6;
  assert.equal(scheduleSocialFollowup(state, { eventId: "debt_elif_comment", dueWeek, personId: "elif" }), true);
  assert.deepEqual(processDueOpenCases(state), []);
  assert.equal(state.openCases.find((c) => c.type === "social-followup").status, "pending");
});

test("3D.6 scheduleSocialFollowup geçerli haftada tetiklenir", () => {
  const state = fresh();
  const dueWeek = state.time.absoluteWeek + 6;
  scheduleSocialFollowup(state, { eventId: "debt_elif_comment", dueWeek, personId: "elif" });
  state.time.absoluteWeek = dueWeek;
  const triggered = processDueOpenCases(state);
  assert.equal(triggered.length, 1);
  assert.equal(state.openCases[0].status, "triggered");
  assert.equal(state.events.queue.at(-1).eventId, "debt_elif_comment");
});

test("3D.7 followup event tam bir kez sonuçlanır", () => {
  const state = fresh();
  const dueWeek = state.time.absoluteWeek + 6;
  scheduleSocialFollowup(state, { eventId: "debt_elif_comment", dueWeek, personId: "elif" });
  state.time.absoluteWeek = dueWeek;
  processDueOpenCases(state);
  activateNextEvent(state);
  assert.equal(state.events.active.eventId, "debt_elif_comment");
  assert.equal(resolveEvent(state, "acknowledge").ok, true);
  assert.equal(state.openCases[0].status, "resolved");
  assert.deepEqual(processDueOpenCases(state), []);
});

test("3D.8 save/load sonrası aynı case tekrar tetiklenmez", () => {
  const state = fresh();
  const dueWeek = state.time.absoluteWeek + 2;
  scheduleSocialFollowup(state, { eventId: "debt_elif_comment", dueWeek, personId: "elif" });
  state.time.absoluteWeek = dueWeek;
  processDueOpenCases(state);
  activateNextEvent(state);
  resolveEvent(state, "acknowledge");
  const storage = new MemoryStorage();
  saveGame(storage, state);
  const loaded = loadGame(storage).state;
  assert.equal(loaded.openCases.find((c) => c.eventId === "debt_elif_comment").status, "resolved");
  assert.deepEqual(processDueOpenCases(loaded), []);
});

test("3D.9 görünürlük izolasyonu: ilgisiz NPC borcu/sırrı bilmez", () => {
  const state = fresh();
  createPersonalDebt(state, "mehmet", 2500, 4, "lent_2500");
  assert.equal(hasNpcMemory(state, "baba", "lent_2500"), false);
  assert.equal(hasNpcMemory(state, "anne", "lent_2500"), false);
  assert.equal(getPersonalDebt(state, "baba"), null);
});

test("3D.10 SOC-01 yalnız bekleyen borç ve yeterli süre geçtiğinde tetiklenebilir", () => {
  const state = fresh();
  const def = getEventDefinition("mehmet_debt_story");
  assert.equal(def.condition(state), false);
  createPersonalDebt(state, "mehmet", 2500, 4, "lent_2500");
  assert.equal(def.condition(state), false);
  state.time.absoluteWeek += 3;
  assert.equal(def.condition(state), false);
  state.time.absoluteWeek += 1;
  assert.equal(def.condition(state), true);
});

test("3D.11 aile üyesiyle romantik ilgi hiçbir zaman kurulamaz", () => {
  const state = fresh();
  assert.equal(setRomanticInterest(state, "anne"), false);
  assert.equal(setRomanticInterest(state, "baba"), false);
  assert.equal(getRelationship(state, "anne").romanceStatus, "none");
});

test("3D.12 ikinci partner engellenir", () => {
  const state = fresh();
  setRomanticInterest(state, "elif");
  applyRelationshipDelta(state, "elif", { closeness: 100, trust: 100, tension: -100 });
  assert.equal(becomePartner(state, "elif"), true);
  assert.equal(state.social.currentPartnerNpcId, "elif");
  assert.equal(canBecomePartner(state, "elif"), false);
});

test("3D.13 yetişkin bayrakları yalnız elif bağlamında set edilir, gecikmeli sonuç işlenir", () => {
  const state = fresh();
  state.events.active = { eventId: "elif_alone_at_home", occurrenceId: "test-3d13" };
  assert.equal(resolveEvent(state, "unprotected").ok, true);
  assert.equal(state.flags.sleptWithElif, true);
  assert.equal(state.flags.sleptWithAnne, undefined);
  assert.equal(state.children, undefined);
  const morning = state.openCases.find((c) => c.eventId === "elif_morning_after");
  const followup = state.flags.intimacyFollowup;
  assert.ok(morning);
  assert.equal(followup.partnerId, "elif");
  assert.equal(followup.dueWeek, state.time.absoluteWeek + 4);

  state.time.absoluteWeek = morning.dueWeek;
  processDueOpenCases(state);
  activateNextEvent(state);
  assert.equal(state.events.active.eventId, "elif_morning_after");
  resolveEvent(state, "talk");
  drain(state);

  state.time.absoluteWeek = followup.dueWeek;
  assert.match(processIntimacyFollowup(state), /Gebelik/);
  assert.equal(state.flags.intimacyFollowup, undefined);
  assert.equal(state.children, undefined);
});

test("3D.14 save v6 değişmeden kalır; bekleyen borç ve bayrak save/load'da korunur", () => {
  const state = fresh();
  createPersonalDebt(state, "mehmet", 2500, 4, "lent_2500");
  state.flags.promisedMehmetRef = true;
  const storage = new MemoryStorage();
  saveGame(storage, state);
  const loaded = loadGame(storage).state;
  assert.equal(SAVE_VERSION, 6);
  assert.equal(loaded.meta.saveVersion, 6);
  const debt = loaded.openCases.find((c) => c.type === "personal-debt");
  assert.equal(debt.payload.amount, 2500);
  assert.equal(debt.status, "pending");
  assert.equal(loaded.flags.promisedMehmetRef, true);
  assert.equal(validateState(loaded).ok, true);
});

test("3D.15 yoğunluk siperi: aynı hafta içinde ikinci bir 3D event aktifleşmez", () => {
  const state = fresh();
  state.time.absoluteWeek = 30;
  state.flags.lastSocial3DWeek = 30;
  activateNextEvent(state);
  const def = state.events.active ? getEventDefinition(state.events.active.eventId) : null;
  assert.notEqual(def?.social3D, true);
});

test("3D.15b yoğunluk siperi: aynı hafta içindeki zincirleme aktivasyon yeni 3D eventi keser", () => {
  const state = fresh();
  state.time.absoluteWeek = 30;
  state.flags.lastEventResolvedWeek = 30;
  activateNextEvent(state);
  const def = state.events.active ? getEventDefinition(state.events.active.eventId) : null;
  assert.notEqual(def?.social3D, true);
});

test("3D.16 CHN-01 halka 2, halka 1 (borç) olmadan tetiklenmez", () => {
  const state = fresh();
  const def = getEventDefinition("mehmet_debt_story");
  assert.equal(def.condition(state), false);
});

// ============================== TAGS ==============================

test("3D TAGS: v5 roundtrip sonrası kişilik/tag kilidi bozulmaz", () => {
  const state = fresh();
  const storage = new MemoryStorage();
  saveGame(storage, state);
  const loaded = loadGame(storage).state;
  const elif = loaded.people.find((p) => p.id === "elif");
  const anne = loaded.people.find((p) => p.id === "anne");
  assert.ok(elif.tags.includes("romance_available"));
  assert.equal(anne.roleId, "family");
});

// ============================== Bütünleşik senaryolar ==============================

test("Senaryo A: kişisel borç → görünürlük → yüzleşme/çözüm (CHN-01)", () => {
  const state = fresh();
  const before = state.finances.balance;
  state.events.active = { eventId: "mehmet_needs_money", occurrenceId: "a1" };
  assert.equal(resolveEvent(state, "lend_full").ok, true);
  assert.equal(state.finances.balance, before - 2500);
  assert.ok(getPersonalDebt(state, "mehmet"));
  assert.equal(hasNpcMemory(state, "mehmet", "lent_2500"), true);

  const socDef = getEventDefinition("mehmet_debt_story");
  assert.equal(socDef.condition(state), false);
  state.time.absoluteWeek += 4;
  assert.equal(socDef.condition(state), true);

  state.events.active = { eventId: "mehmet_debt_story", occurrenceId: "a2" };
  const balanceBeforeCollect = state.finances.balance;
  assert.equal(resolveEvent(state, "collect").ok, true);
  assert.equal(state.finances.balance, balanceBeforeCollect + 2500);
  assert.equal(getPersonalDebt(state, "mehmet"), null);
  drain(state);

  const followup = state.openCases.find((c) => c.eventId === "debt_elif_comment");
  assert.ok(followup);
  assert.equal(followup.status, "pending");
  state.time.absoluteWeek = followup.dueWeek;
  assert.deepEqual(processDueOpenCases(state), [followup.id]);
  activateNextEvent(state);
  assert.equal(state.events.active.eventId, "debt_elif_comment");
  assert.equal(resolveEvent(state, "acknowledge").ok, true);
  assert.equal(state.openCases.find((c) => c.id === followup.id).status, "resolved");
});

test("Senaryo B: referans sözü → gecikme → sonuç (CHN-03)", () => {
  const state = fresh();
  state.events.active = { eventId: "promise_mehmet_reference", occurrenceId: "b1" };
  assert.equal(resolveEvent(state, "promise").ok, true);
  assert.equal(state.flags.promisedMehmetRef, true);
  const outcome = state.openCases.find((c) => c.eventId === "reference_promise_outcome");
  assert.ok(outcome);

  state.time.absoluteWeek = outcome.dueWeek;
  processDueOpenCases(state);
  activateNextEvent(state);
  assert.equal(state.events.active.eventId, "reference_promise_outcome");
  const trustBefore = getRelationship(state, "mehmet").trust;
  assert.equal(resolveEvent(state, "broke").ok, true);
  assert.equal(getRelationship(state, "mehmet").trust < trustBefore, true);

  const negFollowup = state.openCases.find((c) => c.eventId === "reference_followup_negative");
  assert.ok(negFollowup);
  state.time.absoluteWeek = negFollowup.dueWeek;
  processDueOpenCases(state);
  activateNextEvent(state);
  assert.equal(state.events.active.eventId, "reference_followup_negative");
  assert.equal(resolveEvent(state, "acknowledge").ok, true);
  assert.equal(state.openCases.find((c) => c.id === negFollowup.id).status, "resolved");
});

test("Senaryo C: yetişkin ilişki → gecikmeli sonuç → sonlu çözüm (CHN-08)", () => {
  const state = fresh();
  state.events.active = { eventId: "elif_alone_at_home", occurrenceId: "c1" };
  assert.equal(resolveEvent(state, "unprotected").ok, true);
  assert.equal(state.flags.sleptWithElif, true);
  const morning = state.openCases.find((c) => c.eventId === "elif_morning_after");
  const followup = state.flags.intimacyFollowup;
  assert.ok(morning);
  assert.equal(followup.partnerId, "elif");

  state.time.absoluteWeek = morning.dueWeek;
  processDueOpenCases(state);
  activateNextEvent(state);
  assert.equal(state.events.active.eventId, "elif_morning_after");
  assert.equal(resolveEvent(state, "talk").ok, true);
  assert.equal(state.flags.talkedAboutElif, true);

  state.time.absoluteWeek = followup.dueWeek;
  assert.match(processIntimacyFollowup(state), /Gebelik/);
  assert.equal(state.flags.intimacyFollowup, undefined);
  assert.equal(state.children, undefined);
});

test("Senaryo D: sır → sonraki görünürlük/ifşa → sosyal sonuç (CHN-10)", () => {
  const state = fresh();
  state.household.homeId = "family";
  state.events.active = { eventId: "elif_stayed_over", occurrenceId: "d1" };
  assert.equal(resolveEvent(state, "secret").ok, true);
  assert.equal(state.flags.elifSleptOverSecret, true);
  assert.equal(hasNpcMemory(state, "elif", "kept_secret"), true);
  const ask = state.openCases.find((c) => c.eventId === "elif_asks_about_secret");
  assert.ok(ask);

  state.time.absoluteWeek = ask.dueWeek;
  processDueOpenCases(state);
  activateNextEvent(state);
  assert.equal(state.events.active.eventId, "elif_asks_about_secret");
  assert.equal(resolveEvent(state, "keep_secret").ok, true);
  drain(state);
  const leak = state.openCases.find((c) => c.eventId === "mehmet_learns_secret");
  assert.ok(leak);

  state.time.absoluteWeek = leak.dueWeek;
  processDueOpenCases(state);
  activateNextEvent(state);
  assert.equal(state.events.active.eventId, "mehmet_learns_secret");
  const trustBefore = getRelationship(state, "mehmet").trust;
  assert.equal(resolveEvent(state, "acknowledge").ok, true);
  assert.equal(getRelationship(state, "mehmet").trust < trustBefore, true);
});

test("Senaryo E: düğün karşılığı → uzun vadeli geri dönüş (CHN-09)", () => {
  const state = fresh();
  const before = state.finances.balance;
  state.events.active = { eventId: "cousin_wedding_gold", occurrenceId: "e1" };
  assert.equal(resolveEvent(state, "gold").ok, true);
  assert.equal(state.finances.balance, before - 3500);
  drain(state);
  const reflection = state.openCases.find((c) => c.eventId === "wedding_budget_reflection");
  assert.ok(reflection);

  state.time.absoluteWeek = reflection.dueWeek;
  processDueOpenCases(state);
  activateNextEvent(state);
  assert.equal(state.events.active.eventId, "wedding_budget_reflection");
  assert.equal(resolveEvent(state, "acknowledge").ok, true);
  drain(state);
  const reciprocity = state.openCases.find((c) => c.eventId === "wedding_reciprocity_return");
  assert.ok(reciprocity);

  state.time.absoluteWeek = reciprocity.dueWeek;
  processDueOpenCases(state);
  activateNextEvent(state);
  assert.equal(state.events.active.eventId, "wedding_reciprocity_return");
  const balanceBefore = state.finances.balance;
  assert.equal(resolveEvent(state, "acknowledge").ok, true);
  assert.equal(state.finances.balance, balanceBefore + 500);
});

test("Senaryo E-bahane: düğün bahanesiyle geçilirse karşılık zinciri hiç başlamaz", () => {
  const state = fresh();
  state.events.active = { eventId: "cousin_wedding_gold", occurrenceId: "e2" };
  assert.equal(resolveEvent(state, "excuse").ok, true);
  assert.equal(state.openCases.some((c) => c.eventId === "wedding_budget_reflection"), false);
});
