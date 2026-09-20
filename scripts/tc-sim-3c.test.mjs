import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, addNpcMemory, normalizeSocialState, validateState } from "../public/games/tc-sim/js/state.js";
import { migrateState, saveGame, loadGame } from "../public/games/tc-sim/js/save.js";
import { advanceWeek } from "../public/games/tc-sim/js/time.js";
import { EVENT_DEFINITIONS, processDueOpenCases, resolveEvent } from "../public/games/tc-sim/js/events.js";
import {
  applyRelationshipDelta,
  applySocialAction,
  applySocialMaintenance,
  becomePartner,
  canBecomePartner,
  canUseSocialAction,
  createSocialObligation,
  getRelationship,
  getRelationshipStage,
  resolveSocialObligation,
  setRomanticInterest,
} from "../public/games/tc-sim/js/social.js";

class Storage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

const fresh = () => createNewGame({ name: "3C", now: "2027-01-01T00:00:00.000Z", seed: 7 });
const event = (id) => EVENT_DEFINITIONS.find((item) => item.id === id);

test("3C.1 yeni state üç eksenli ilişki varsayılanları üretir", () => {
  const state = fresh();
  assert.deepEqual(Object.keys(getRelationship(state, "mehmet")), ["closeness", "trust", "tension", "lastMeaningfulContactWeek", "romanceStatus"]);
  assert.equal(validateState(state).ok, true);
});

test("3C.2 stage yakınlık, güven ve gerilimden türetilir", () => {
  const state = fresh();
  state.relationships.mehmet = 80;
  state.people.find((p) => p.id === "mehmet").social.trust = 70;
  assert.equal(getRelationshipStage(state, "mehmet"), "close");
  state.people.find((p) => p.id === "mehmet").social.tension = 60;
  assert.notEqual(getRelationshipStage(state, "mehmet"), "close");
});

test("3C.3 ilişki delta helper bütün eksenleri 0-100 aralığında tutar", () => {
  const state = fresh();
  applyRelationshipDelta(state, "mehmet", { closeness: 500, trust: -500, tension: 500 });
  assert.deepEqual(getRelationship(state, "mehmet"), { closeness: 100, trust: 0, tension: 100, lastMeaningfulContactWeek: 1, romanceStatus: "none" });
});

test("3C.4 görüşme karar hakkı tüketir ve teması günceller", () => {
  const state = fresh(); state.time.absoluteWeek = 5;
  assert.equal(applySocialAction(state, "mehmet", "meet").ok, true);
  assert.equal(state.weekly.used, 1);
  assert.equal(getRelationship(state, "mehmet").lastMeaningfulContactWeek, 5);
});

test("3C.5 aynı sosyal action aynı hafta spam edilemez", () => {
  const state = fresh(); applySocialAction(state, "mehmet", "meet");
  assert.equal(applySocialAction(state, "mehmet", "meet").ok, false);
});

test("3C.6 zaman bütçesi dolunca sosyal action reddedilir", () => {
  const state = fresh(); state.weekly = { used: 6, selectedIds: ["a", "b"] };
  assert.equal(canUseSocialAction(state, "mehmet", "meet").ok, false);
});

test("3C.7 yetersiz para sosyal action state'ini değiştirmez", () => {
  const state = fresh(); state.finances.balance = 100; const before = structuredClone(state);
  assert.equal(applySocialAction(state, "mehmet", "help").ok, false);
  assert.deepEqual(state, before);
});

test("3C.8 dertleşme yakın olmayan kişiye kapalıdır", () => {
  const state = fresh(); state.relationships.elif = 20;
  assert.equal(canUseSocialAction(state, "elif", "confide").ok, false);
});

test("3C.9 olumlu sosyal action doğru NPC hafızasına yazılır", () => {
  const state = fresh(); applySocialAction(state, "mehmet", "help");
  assert.equal(state.people.find((p) => p.id === "mehmet").memories.at(-1).type, "helped");
});

test("3C.10 NPC hafızası 50 kayıtla sınırlıdır", () => {
  const state = fresh(); for (let i = 0; i < 70; i += 1) addNpcMemory(state, "mehmet", `anı ${i}`);
  assert.equal(state.people.find((p) => p.id === "mehmet").memories.length, 50);
});

test("3C.11 decay eşikten önce çalışmaz", () => {
  const state = fresh(); state.relationships.mehmet = 80; state.people[2].social.trust = 70; state.time.absoluteWeek = 9;
  const before = state.relationships.mehmet; applySocialMaintenance(state);
  assert.equal(state.relationships.mehmet, before);
});

test("3C.12 decay anlamlı gecikmeden sonra kontrollü çalışır", () => {
  const state = fresh(); state.relationships.mehmet = 80; state.people[2].social.trust = 70; state.time.absoluteWeek = 13;
  applySocialMaintenance(state); assert.equal(state.relationships.mehmet, 79);
});

test("3C.13 decay aynı hafta yalnız bir kez uygulanır", () => {
  const state = fresh(); state.relationships.mehmet = 80; state.people[2].social.trust = 70; state.time.absoluteWeek = 13;
  applySocialMaintenance(state); const after = state.relationships.mehmet; applySocialMaintenance(state);
  assert.equal(state.relationships.mehmet, after);
});

test("3C.14 sosyal obligation bir kez oluşturulur", () => {
  const state = fresh(); assert.equal(createSocialObligation(state, "mehmet"), true); assert.equal(createSocialObligation(state, "mehmet"), false);
  assert.equal(state.openCases.filter((c) => c.type === "social-obligation").length, 1);
});

test("3C.15 söz başarıyla yalnız bir kez sonuçlanır", () => {
  const state = fresh(); createSocialObligation(state, "mehmet");
  assert.equal(resolveSocialObligation(state, "mehmet", true), true); const trust = state.people[2].social.trust;
  assert.equal(resolveSocialObligation(state, "mehmet", true), false); assert.equal(state.people[2].social.trust, trust);
});

test("3C.16 kaçırılan deadline event'e dönüşür", () => {
  const state = fresh(); createSocialObligation(state, "mehmet"); state.time.absoluteWeek = 4;
  assert.deepEqual(processDueOpenCases(state), [state.openCases[0].id]);
  assert.equal(state.openCases[0].status, "triggered");
});

test("3C.17 deadline başarısızlığı güveni bir kez düşürür", () => {
  const state = fresh(); createSocialObligation(state, "mehmet"); state.time.absoluteWeek = 4; processDueOpenCases(state);
  state.events.active = state.events.queue.shift(); const before = state.people[2].social.trust;
  resolveEvent(state, "acknowledge"); assert.equal(state.people[2].social.trust, before - 12);
  assert.equal(state.openCases[0].resolutionApplied, true);
});

test("3C.18 romantik ilgi otomatik oluşmaz", () => {
  const state = fresh(); state.relationships.elif = 90; state.people[3].social.trust = 90;
  assert.equal(getRelationshipStage(state, "elif"), "close");
});

test("3C.19 uygun NPC romantik ilgiye geçebilir", () => {
  const state = fresh(); assert.equal(setRomanticInterest(state, "elif"), true);
  assert.equal(getRelationshipStage(state, "elif"), "romantic_interest");
});

test("3C.20 aile NPC romantik yola giremez", () => {
  const state = fresh(); assert.equal(setRomanticInterest(state, "anne"), false); assert.equal(becomePartner(state, "anne"), false);
});

test("3C.21 partner geçişi açık eşikler ve karar gerektirir", () => {
  const state = fresh(); setRomanticInterest(state, "elif"); assert.equal(canBecomePartner(state, "elif"), false);
  state.relationships.elif = 75; state.people[3].social.trust = 70;
  assert.equal(becomePartner(state, "elif"), true); assert.equal(state.social.currentPartnerNpcId, "elif");
});

test("3C.22 aynı anda ikinci partner mümkün değildir", () => {
  const state = fresh(); setRomanticInterest(state, "elif"); state.relationships.elif = 75; state.people[3].social.trust = 70; becomePartner(state, "elif");
  state.people[2].tags.push("romance_available"); state.people[2].social.romanceStatus = "interest"; state.relationships.mehmet = 90; state.people[2].social.trust = 90;
  assert.equal(canBecomePartner(state, "mehmet"), false);
});

test("3C.23 v4 save Aylin/Mehmet ve eski puanları koruyarak v5'e taşınır", () => {
  const raw = fresh(); raw.meta.saveVersion = 4; raw.relationships.mehmet = 81; raw.people[2].memories.push({ week: 2, year: 2027, text: "eski" }); delete raw.social;
  for (const person of raw.people) { delete person.social; delete person.roleId; delete person.tags; delete person.available; }
  const result = migrateState(raw); assert.equal(result.ok, true); assert.equal(result.state.meta.saveVersion, 6); assert.equal(result.state.relationships.mehmet, 81); assert.equal(result.state.people[2].memories[0].text, "eski");
});

test("3C.24 bozuk ilişki alanları güvenli biçimde normalize edilir", () => {
  const state = fresh(); state.relationships.mehmet = "bozuk"; state.people[2].social = { trust: Number.NaN, tension: 900, lastMeaningfulContactWeek: -4, romanceStatus: "unknown" };
  normalizeSocialState(state); const r = getRelationship(state, "mehmet");
  assert.equal(r.closeness, 52); assert.equal(r.trust, 54); assert.equal(r.tension, 100); assert.equal(r.romanceStatus, "none"); assert.equal(validateState(state).ok, true);
});

test("3C.25 save/load açık obligation ve ilişkileri korur", () => {
  const state = fresh(); applySocialAction(state, "mehmet", "meet"); createSocialObligation(state, "mehmet"); const storage = new Storage();
  assert.equal(saveGame(storage, state).ok, true); const loaded = loadGame(storage); assert.equal(loaded.ok, true); assert.equal(loaded.state.relationships.mehmet, state.relationships.mehmet); assert.equal(loaded.state.openCases[0].type, "social-obligation");
});

test("3C.26 arkadaşlık, söz ve romantizm senaryoları birlikte geçerli state bırakır", () => {
  const state = fresh(); applySocialAction(state, "mehmet", "meet"); state.weekly = { used: 0, selectedIds: [] }; applySocialAction(state, "mehmet", "confide"); createSocialObligation(state, "mehmet"); state.weekly = { used: 0, selectedIds: [] }; applySocialAction(state, "mehmet", "fulfill_promise");
  setRomanticInterest(state, "elif"); state.relationships.elif = 75; state.people[3].social.trust = 70; becomePartner(state, "elif");
  assert.equal(validateState(state).ok, true); assert.equal(state.openCases.at(-1).status, "resolved"); assert.equal(state.social.currentPartnerNpcId, "elif");
});

test("3C.27 sosyal event koşulları ilgisiz state'te yağmur üretmez", () => {
  const state = fresh(); assert.equal(event("social_invitation").condition(state), false); assert.equal(event("social_help_request").condition(state), false); assert.equal(event("romantic_opportunity").condition(state), false);
});

test("3C.28 haftalık ilerleme sosyal bakım guard'ını korur", () => {
  const state = fresh(); state.social.engaged = true; const result = advanceWeek(state); assert.equal(result.ok, true); assert.equal(state.social.lastMaintenanceWeek, 1);
});
