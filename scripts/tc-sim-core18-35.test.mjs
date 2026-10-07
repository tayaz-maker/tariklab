import { syncGameDate } from "../public/games/tc-sim/js/game-date.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import {
  CAREER_RISK_PERFORMANCE,
  MONEY_RELIEF_MAX,
  MONEY_RELIEF_MIN,
  acceptJobOffer,
  getCostOfLivingIndex,
  getMoneyReliefAmount,
  getMonthlySummary,
  quitJob,
} from "../public/games/tc-sim/js/life.js";
import { activateNextEvent, getEventChoiceAvailability, getEventDefinition, resolveEvent } from "../public/games/tc-sim/js/events.js";
import { advanceWeek, applyDecision, canApplyDecision, getAvailableDecisions } from "../public/games/tc-sim/js/time.js";
import { scheduleDepth2Followup } from "../public/games/tc-sim/js/depth2-systems.js";
import { loadGame, saveGame } from "../public/games/tc-sim/js/save.js";
import { runAdultCoreScenario } from "./tc-sim-longrun.mjs";

const fresh = () => createNewGame({ now: "2027-01-01T00:00:00.000Z" });

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

const roundTrip = (state) => {
  const storage = new MemoryStorage();
  assert.equal(saveGame(storage, state).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  return loaded.state;
};

let fixtureSeq = 0;

/**
 * Ölçmek istediğimiz olay dışındaki her açık olayı sonuçlandırır. Uzun
 * koşuda hayat devam ediyor; testin baktığı zincir yalnız böyle izole olur.
 */
function settleExcept(state, keepEventId) {
  let guard = 0;
  while (state.events.active && state.events.active.eventId !== keepEventId) {
    assert.ok(guard++ < 60, "olaylar sonlanmalı");
    const definition = getEventDefinition(state.events.active.eventId);
    const choice = definition.choices.find((item) => getEventChoiceAvailability(state, item.id).ok) || definition.choices[0];
    assert.equal(resolveEvent(state, choice.id).ok, true);
  }
}

/** Araya giren olayları temizleyip belirtilen sayıda gerçek hafta ilerletir. */
function tick(state, weeks = 1, keepEventId = null) {
  for (let i = 0; i < weeks; i += 1) {
    settleExcept(state, keepEventId);
    if (state.events.active) return;
    assert.equal(advanceWeek(state).ok, true);
  }
  settleExcept(state, keepEventId);
}

/** Olayı kuyruğa koyup etkinleştirir; kaynak dosya varsa onu da bağlar. */
function fire(state, eventId, sourceCaseId = null) {
  settleExcept(state, eventId);
  if (state.events.active?.eventId === eventId) return;
  state.events.queue.push({ eventId, occurrenceId: `fixture-${eventId}-${(fixtureSeq += 1)}`, sourceCaseId });
  activateNextEvent(state);
  settleExcept(state, eventId);
  assert.equal(state.events.active?.eventId, eventId, `${eventId} etkinleşmeliydi`);
}

/** Zamanı gerçek tick ile bekleyen dosyanın gününe taşır ve olayı açar. */
function waitForCase(state, kind) {
  const item = state.openCases.find((entry) => entry.payload?.kind === kind && entry.status === "pending");
  assert.ok(item, `${kind} dosyası açılmalıydı`);
  if (state.time.absoluteWeek < item.dueWeek) state.time.absoluteWeek = item.dueWeek;
  for (let guard = 0; guard < 40; guard += 1) {
    settleExcept(state, item.eventId);
    if (state.events.active?.eventId === item.eventId) return item;
    activateNextEvent(state);
    settleExcept(state, item.eventId);
    if (state.events.active?.eventId === item.eventId) return item;
    assert.equal(advanceWeek(state).ok, true);
  }
  assert.fail(`${item.eventId} gününde açılmalıydı`);
}

const reliefCase = (state) => state.openCases.find((item) => item.payload?.kind === "money_relief" && item.status === "pending") || null;
const spent = (state, reason) => state.finances.ledger.filter((item) => item.reason === reason);

/* ------------------------------------------------------------------ *
 * Geçim gideri sürüklenmesi
 * ------------------------------------------------------------------ */

test("geçim gideri sürüklenmesi türetilmiş, sınırlı ve başlangıçta nötrdür", () => {
  const s = fresh();
  assert.equal(getCostOfLivingIndex(s), 1);
  assert.equal(getMonthlySummary(s).otherExpenses, 5000);
  s.time.absoluteWeek = 241;
  syncGameDate(s);
  assert.equal(getCostOfLivingIndex(s), 1.2);
  assert.equal(getMonthlySummary(s).otherExpenses, 6000);
  s.time.absoluteWeek = 5200;
  syncGameDate(s);
  assert.equal(getCostOfLivingIndex(s), 1.5);
});

test("eski kayıt ileri bir haftada yüklendiğinde gider sıçraması ödenebilir kalır", () => {
  // Sürüklenme yalnız absoluteWeek'ten türer; kayıtta saklanmaz. Özellik
  // öncesi uzun bir kayıt 400. haftada yüklendiğinde indeks anında 1.32
  // olur. Sıçramanın ödenebilir olduğunu ölçerek kanıtlıyoruz.
  const s = fresh();
  s.time.absoluteWeek = 400;
  s.finances.balance = 20000;
  const loaded = roundTrip(s);
  assert.equal(loaded.time.absoluteWeek, 400);
  assert.equal(getCostOfLivingIndex(loaded), 1.32);
  const summary = getMonthlySummary(loaded);
  assert.equal(summary.otherExpenses, 6600);
  // Sıçrama 1600 TL'dir ve olağan bir maaşın altında kalır: ay sonu net
  // gelir hâlâ pozitif, yani eski kayıt yüklenince iflas etmez.
  assert.equal(summary.otherExpenses - 5000, 1600);
  assert.ok(summary.income - summary.expenses > 0, "eski kayıt yüklendiğinde aylık net gelir pozitif kalmalı");
  const before = loaded.finances.balance;
  tick(loaded, 4);
  assert.ok(loaded.finances.balance > before, "ay sonu eski kaydı batırmamalı");
  assert.equal(validateState(loaded).ok, true);
});

test("ay sonu sınırında kaydet/yükle maaşı ne çoğaltır ne siler", () => {
  const s = fresh();
  s.time.absoluteWeek = 4;
  syncGameDate(s);
  const before = s.finances.balance;
  const loaded = roundTrip(s);
  assert.equal(advanceWeek(loaded).ok, true);
  assert.equal(spent(loaded, "Aylık maaş").length, 1, "maaş tam bir kez yatmalı");
  const direct = fresh();
  direct.time.absoluteWeek = 4;
  syncGameDate(direct);
  assert.equal(advanceWeek(direct).ok, true);
  assert.equal(spent(direct, "Aylık maaş").length, 1);
  assert.equal(loaded.finances.balance, direct.finances.balance, "kayıt/yükleme ay sonu sonucunu değiştirmemeli");
  assert.notEqual(loaded.finances.balance, before);
});

/* ------------------------------------------------------------------ *
 * Geçici destek: tutar, tavan, geri ödeme, ödenmeme, istismar
 * ------------------------------------------------------------------ */

test("destek tutarı gerçek açıktan türer, tabanı ve tavanı vardır", () => {
  const s = fresh();
  // Maaş gideri karşılıyorken açık yoktur: uygunsuz destek doğmaz.
  assert.equal(getMoneyReliefAmount(s), 0);
  s.career.jobId = null;
  s.finances.balance = 6000;
  const small = getMoneyReliefAmount(s);
  assert.equal(small, MONEY_RELIEF_MIN, "küçük açık tabana yuvarlanır");
  s.finances.balance = 3000;
  const larger = getMoneyReliefAmount(s);
  assert.equal(larger, 3500);
  assert.ok(larger > small, "açık büyüdükçe destek de büyür");
  s.finances.balance = -50000;
  assert.equal(getMoneyReliefAmount(s), MONEY_RELIEF_MAX, "destek tavanı aşamaz");
});

test("destek yalnız gerçek açık varken ve aile bağı yeterliyken açılır", () => {
  const definition = getEventDefinition("money_relief_choice");
  const s = fresh();
  s.finances.balance = 60000;
  assert.equal(definition.condition(s), false, "para bolken destek açılmamalı");
  s.finances.balance = 1500;
  s.career.jobId = null;
  assert.equal(definition.condition(s), true);
  s.household.homeId = "studio";
  s.relationships.anne = 10;
  assert.equal(definition.condition(s), false, "aile bağı kopmuşken destek açılmamalı");
  s.relationships.anne = 60;
  assert.equal(definition.condition(s), true, "aile bağı sağlamsa adresten bağımsız açılır");
});

test("destek tam bir kez aktarılır, tutarı dosyada saklanır ve bir kez geri ödenir", () => {
  const s = fresh();
  s.career.jobId = null;
  s.finances.balance = 1500;
  const expected = getMoneyReliefAmount(s);
  assert.ok(expected >= MONEY_RELIEF_MIN);
  fire(s, "money_relief_choice");
  assert.equal(resolveEvent(s, "borrow").ok, true);
  assert.equal(spent(s, "Geçici aile desteği").length, 1, "destek tam bir kez aktarılmalı");
  assert.equal(s.finances.balance, 1500 + expected);
  const item = reliefCase(s);
  assert.ok(item, "geri ödeme dosyası açılmalı");
  assert.equal(item.payload.amount, expected);

  const beforeRepay = s.finances.balance;
  waitForCase(s, "money_relief");
  assert.equal(resolveEvent(s, "repay").ok, true);
  assert.equal(spent(s, "Geçici destek geri ödemesi").length, 1, "geri ödeme tam bir kez alınmalı");
  assert.equal(s.finances.balance, beforeRepay - expected);
  assert.equal(reliefCase(s), null, "geri ödeme sonrası açık dosya kalmamalı");
  assert.equal(s.flags.moneyReliefOpen ?? null, null);
});

test("destek almadan ve aldıktan sonra kaydet/yükle parayı çoğaltmaz", () => {
  const s = fresh();
  s.career.jobId = null;
  s.finances.balance = 1500;
  // Almadan önce yükle: yeniden yükleme destek doğurmaz.
  const beforeBorrow = roundTrip(s);
  assert.equal(beforeBorrow.finances.balance, 1500);
  assert.equal(reliefCase(beforeBorrow), null);

  fire(s, "money_relief_choice");
  assert.equal(resolveEvent(s, "borrow").ok, true);
  const borrowed = s.finances.balance;
  const amount = reliefCase(s).payload.amount;
  // Aldıktan sonra yükle: tutar da dosya da aynen döner, ikinci kez yatmaz.
  const afterBorrow = roundTrip(s);
  assert.equal(afterBorrow.finances.balance, borrowed);
  assert.equal(reliefCase(afterBorrow).payload.amount, amount);
  assert.equal(spent(afterBorrow, "Geçici aile desteği").length, 1);

  waitForCase(afterBorrow, "money_relief");
  assert.equal(resolveEvent(afterBorrow, "repay").ok, true);
  const settled = roundTrip(afterBorrow);
  assert.equal(spent(settled, "Geçici destek geri ödemesi").length, 1, "yükleme ikinci kez tahsil etmemeli");
  assert.equal(settled.finances.balance, afterBorrow.finances.balance);
  assert.equal(reliefCase(settled), null);
});

test("ödenmeyen destek bir kez ve sınırlı biçimde sonuçlanır, kapıyı uzun süre kapatır", () => {
  const s = fresh();
  s.career.jobId = null;
  s.finances.balance = 1500;
  const trustBefore = s.people.find((person) => person.id === "anne").social.trust;
  fire(s, "money_relief_choice");
  assert.equal(resolveEvent(s, "borrow").ok, true);
  const afterBorrow = s.finances.balance;
  waitForCase(s, "money_relief");
  assert.equal(resolveEvent(s, "delay").ok, true);
  assert.equal(spent(s, "Geçici destek geri ödemesi").length, 0, "ödenmediğinde tahsilat olmamalı");
  assert.equal(s.finances.balance, afterBorrow);
  assert.ok(s.people.find((person) => person.id === "anne").social.trust < trustBefore, "ödenmemenin gerçek bir bedeli olmalı");
  assert.equal(reliefCase(s), null, "dosya temizlenmeli");
  // Aynı döngüde ikinci kez ödememek mümkün değil: dosya kapandı.
  assert.equal(s.openCases.filter((item) => item.payload?.kind === "money_relief" && item.status !== "resolved").length, 0);
  // Kapı normalin çok üstünde bir süre kapalı kalır.
  const definition = getEventDefinition("money_relief_choice");
  assert.ok(s.events.cooldowns.money_relief_choice > s.time.absoluteWeek + 60, "ödenmeme sonrası bekleme normal soğumadan uzun olmalı");
  s.finances.balance = 500;
  assert.equal(definition.condition(s) && s.time.absoluteWeek >= s.events.cooldowns.money_relief_choice, false, "ödenmemenin hemen ardından yeniden borçlanılamaz");
});

test("geri ödeme penceresini kaçırmak bedelsiz bir kaçış yolu değildir", () => {
  const s = fresh();
  s.career.jobId = null;
  s.finances.balance = 1500;
  const trustBefore = s.people.find((person) => person.id === "anne").social.trust;
  fire(s, "money_relief_choice");
  assert.equal(resolveEvent(s, "borrow").ok, true);
  const item = reliefCase(s);
  s.time.absoluteWeek = item.expiresWeek + 1;
  advanceWeek(s);
  assert.equal(reliefCase(s), null);
  assert.ok(s.people.find((person) => person.id === "anne").social.trust < trustBefore, "pencereyi kaçırmak da sonuç doğurmalı");
  assert.ok(s.events.cooldowns.money_relief_choice > s.time.absoluteWeek + 60);
});

test("destek soğuma süresi içinde yeniden açılmaz, süre dolunca yeniden mümkün olur", () => {
  const s = fresh();
  const definition = getEventDefinition("money_relief_choice");
  s.career.jobId = null;
  s.finances.balance = 1500;
  fire(s, "money_relief_choice");
  assert.equal(resolveEvent(s, "borrow").ok, true);
  const cooldown = s.events.cooldowns.money_relief_choice;
  assert.ok(cooldown > s.time.absoluteWeek, "soğuma kaydedilmeli");
  // Açık dosya varken yeni destek doğmaz.
  s.finances.balance = 800;
  assert.equal(definition.condition(s), false, "açık destek dosyası varken yeniden borçlanılamaz");
  waitForCase(s, "money_relief");
  assert.equal(resolveEvent(s, "repay").ok, true);
  s.finances.balance = 800;
  assert.equal(s.time.absoluteWeek < cooldown, true);
  assert.equal(definition.condition(s), true, "koşul sağlanır ama soğuma olayı açtırmaz");
  assert.ok(s.events.cooldowns.money_relief_choice > s.time.absoluteWeek, "soğuma hâlâ yürürlükte");
  s.time.absoluteWeek = cooldown + 1;
  assert.equal(definition.condition(s), true, "soğuma dolunca meşru yeni destek yeniden mümkün olur");
});

/* ------------------------------------------------------------------ *
 * Kariyer riski: uyarı, gerçek toparlanma, gerçek işsizlik
 * ------------------------------------------------------------------ */

test("kariyer uyarısı gerçek bir gecikmeli değerlendirme açar", () => {
  const s = fresh();
  s.career.performance = 20;
  fire(s, "job_security_warning");
  assert.equal(resolveEvent(s, "push").ok, true);
  const review = s.openCases.find((item) => item.payload?.kind === "job_security");
  assert.ok(review);
  assert.equal(review.eventId, "job_security_review");
  assert.equal(review.dueWeek - review.createdWeek, 8);
  // İkinci bir uyarı ikinci dosya açmaz.
  fire(s, "job_security_warning");
  assert.equal(resolveEvent(s, "push").ok, true);
  assert.equal(s.openCases.filter((item) => item.payload?.kind === "job_security" && item.status !== "resolved").length, 1);
});

test("değerlendirmede sonucu seçim değil, o andaki gerçek performans belirler", () => {
  // Toparlanma sözü verip gerçekten toparlanamayan oyuncu yine de işini kaybeder.
  const failed = fresh();
  failed.career.performance = 12;
  fire(failed, "job_security_warning");
  assert.equal(resolveEvent(failed, "recover").ok, true);
  waitForCase(failed, "job_security");
  assert.ok(failed.career.performance <= CAREER_RISK_PERFORMANCE, "performans hâlâ eşiğin altında olmalı");
  assert.equal(resolveEvent(failed, "recover").ok, true);
  assert.equal(failed.career.jobId, null, "gerçek performans düşükse söz vermek kurtarmaz");
  assert.equal(failed.career.history.filter((item) => item.type === "involuntary_unemployment").length, 1);

  // Riski kabul eden ama performansı gerçekten iyi olan oyuncu işini korur.
  const survived = fresh();
  survived.career.performance = 20;
  survived.health.health = 20;
  fire(survived, "job_security_warning");
  assert.equal(resolveEvent(survived, "push").ok, true);
  survived.career.performance = 70;
  waitForCase(survived, "job_security");
  assert.equal(resolveEvent(survived, "accept_risk").ok, true);
  assert.notEqual(survived.career.jobId, null, "gerçek performans iyiyse riski kabul etmek işi bitirmez");
  assert.equal(survived.career.history.filter((item) => item.type === "security_review_passed").length, 1);
});

test("uyarıdan sonra gerçekten toparlanan oyuncu işini korur", () => {
  const s = fresh();
  const job = s.career.jobId;
  s.career.performance = 34;
  fire(s, "job_security_warning");
  assert.equal(resolveEvent(s, "recover").ok, true);
  assert.equal(s.career.jobId, job, "uyarının kendisi işi bitirmez");
  // Aradaki haftalar gerçek tick ile geçer; sağlıklı haftalar performansı yükseltir.
  const review = s.openCases.find((item) => item.payload?.kind === "job_security");
  while (s.time.absoluteWeek < review.dueWeek) {
    settleExcept(s, "job_security_review");
    if (s.events.active) break;
    if (canApplyDecision(s, "rest").ok) applyDecision(s, "rest");
    settleExcept(s, "job_security_review");
    if (s.events.active) break;
    assert.equal(advanceWeek(s).ok, true);
  }
  settleExcept(s, "job_security_review");
  assert.ok(s.career.performance > CAREER_RISK_PERFORMANCE, "gerçek haftalar performansı eşiğin üstüne taşımalı");
  if (!s.events.active) activateNextEvent(s);
  assert.equal(s.events.active?.eventId, "job_security_review");
  assert.equal(resolveEvent(s, "recover").ok, true);
  assert.equal(s.career.jobId, job, "toparlanan oyuncu işini korur");
  assert.equal(s.career.history.filter((item) => item.type === "involuntary_unemployment").length, 0);
  assert.equal(s.flags.jobSecurityRisk ?? null, null, "risk bayrağı temizlenmeli");
});

test("iş kaybından sonra maaş, mesai ve terfi kapanır", () => {
  const s = fresh();
  s.career.performance = 10;
  fire(s, "job_security_warning");
  assert.equal(resolveEvent(s, "push").ok, true);
  waitForCase(s, "job_security");
  assert.equal(resolveEvent(s, "accept_risk").ok, true);
  assert.equal(s.career.jobId, null);
  assert.equal(getMonthlySummary(s).salary, 0, "işsizken maaş sıfırdır");
  assert.equal(canApplyDecision(s, "overtime").ok, false, "işsizken ek mesai yapılamaz");
  assert.equal(getAvailableDecisions(s).some((item) => item.id === "overtime"), false, "işsizken ek mesai listelenmez");
  const balanceBefore = s.finances.balance;
  tick(s, 4);
  assert.equal(spent(s, "Aylık maaş").length, 0, "iş kaybından sonra maaş yatmaz");
  assert.ok(s.finances.balance < balanceBefore, "gider işlemeye devam eder");
  assert.equal(validateState(s).ok, true);
});

test("iş kaybı kaydet/yükle sonrası ikinci kez yazılmaz", () => {
  const s = fresh();
  s.career.performance = 10;
  fire(s, "job_security_warning");
  assert.equal(resolveEvent(s, "push").ok, true);
  // Bekleyen değerlendirmeyle kaydet/yükle: sonuç aynı kalmalı.
  const pending = roundTrip(s);
  assert.deepEqual(pending.openCases, s.openCases);
  waitForCase(pending, "job_security");
  assert.equal(resolveEvent(pending, "accept_risk").ok, true);
  assert.equal(pending.career.jobId, null);
  const lost = roundTrip(pending);
  assert.equal(lost.career.jobId, null);
  assert.equal(lost.career.history.filter((item) => item.type === "involuntary_unemployment").length, 1, "iş kaybı tarihçeye bir kez yazılır");
  assert.equal(lost.openCases.filter((item) => item.payload?.kind === "job_security" && item.status !== "resolved").length, 0, "bayat değerlendirme dosyası kalmaz");
  assert.equal(canApplyDecision(lost, "overtime").ok, false);
});

test("işsizlik çıkmaz sokak değildir: mevcut iş yolundan yeniden işe girilir", () => {
  const s = fresh();
  s.career.performance = 10;
  fire(s, "job_security_warning");
  assert.equal(resolveEvent(s, "push").ok, true);
  waitForCase(s, "job_security");
  assert.equal(resolveEvent(s, "accept_risk").ok, true);
  assert.equal(s.career.jobId, null);
  // Anında yedek iş yok: teklif kabul edilir, bir hafta sonra işe başlama olayı gelir.
  settleExcept(s, null);
  s.weekly = { used: 0, selectedIds: [] };
  assert.equal(acceptJobOffer(s, "market").ok, true);
  assert.equal(s.career.jobId, null, "teklif kabul etmek anında işe başlatmaz");
  assert.ok(s.career.pendingJob);
  assert.equal(advanceWeek(s).ok, true);
  settleExcept(s, "job_start");
  if (!s.events.active) activateNextEvent(s);
  settleExcept(s, "job_start");
  assert.equal(s.events.active?.eventId, "job_start");
  assert.equal(resolveEvent(s, getEventDefinition("job_start").choices[0].id).ok, true);
  assert.equal(s.career.jobId, "market");
  assert.ok(getMonthlySummary(s).salary > 0, "maaş normal yoldan yeniden başlar");
  assert.equal(canApplyDecision(s, "overtime").ok, true, "işe dönünce mesai yeniden açılır");
});

test("işsiz oyuncu terfi edemez: bayat terfi görüşmesi zararsız kapanır", () => {
  const s = fresh();
  fire(s, "career_promotion_window");
  assert.equal(resolveEvent(s, "accept").ok, true);
  const promotion = s.openCases.find((item) => item.payload?.kind === "career_promotion");
  assert.ok(promotion);
  // Görüşme beklerken iş kaybedilir: terfi görüşmesi iş güvenliği
  // değerlendirmesinden sonraya düşecek biçimde bekler.
  s.career.performance = 10;
  fire(s, "job_security_warning");
  assert.equal(resolveEvent(s, "push").ok, true);
  const security = s.openCases.find((item) => item.payload?.kind === "job_security");
  promotion.dueWeek = security.dueWeek + 4;
  promotion.expiresWeek = promotion.dueWeek + 8;
  waitForCase(s, "job_security");
  assert.equal(resolveEvent(s, "accept_risk").ok, true);
  assert.equal(s.career.jobId, null);
  waitForCase(s, "career_promotion");
  assert.equal(resolveEvent(s, "advance").ok, true);
  assert.equal(s.career.jobId, null, "işsizken terfi olmaz");
  assert.equal(s.career.history.filter((item) => item.type === "promotion").length, 0, "çelişkili terfi kaydı doğmaz");
  assert.equal(s.flags.depth2PromotionPending ?? null, null);
  assert.equal(validateState(s).ok, true);
});

test("istifa bekleyen iş güvenliği değerlendirmesini konusuz bırakır", () => {
  const s = fresh();
  s.career.performance = 20;
  fire(s, "job_security_warning");
  assert.equal(resolveEvent(s, "push").ok, true);
  assert.equal(quitJob(s).ok, true);
  assert.equal(s.career.jobId, null);
  assert.equal(s.openCases.filter((item) => item.payload?.kind === "job_security" && item.status !== "resolved").length, 0, "bayat değerlendirme kapanmalı");
  assert.equal(s.flags.jobSecurityRisk ?? null, null);
  tick(s, 12);
  assert.equal(s.career.history.filter((item) => item.type === "involuntary_unemployment").length, 0, "olmayan işten çıkarılmaz");
  assert.equal(s.career.history.filter((item) => item.type === "resigned").length, 1, "ayrılış tarihçeye bir kez yazılır");
  // Olay yine de kuyruğa düşerse zararsız kapanır.
  fire(s, "job_security_review");
  assert.equal(resolveEvent(s, "recover").ok, true);
  assert.equal(s.career.jobId, null);
  assert.equal(s.career.history.filter((item) => item.type === "involuntary_unemployment").length, 0);
});

test("iş güvenliği değerlendirmesi işsizken kuyruğa düşse de iş üretmez veya bitirmez", () => {
  const s = fresh();
  assert.equal(quitJob(s).ok, true);
  scheduleDepth2Followup(s, { eventId: "job_security_review", dueWeek: s.time.absoluteWeek + 2, kind: "job_security" });
  waitForCase(s, "job_security");
  assert.equal(resolveEvent(s, "accept_risk").ok, true);
  assert.equal(s.career.jobId, null);
  assert.equal(s.career.history.filter((item) => item.type === "involuntary_unemployment").length, 0);
  assert.equal(validateState(s).ok, true);
});

test("aynı işe hemen geri dönmek bedava bir performans sıfırlaması değildir", () => {
  const s = fresh();
  s.career.performance = 10;
  fire(s, "job_security_warning");
  assert.equal(resolveEvent(s, "push").ok, true);
  waitForCase(s, "job_security");
  assert.equal(resolveEvent(s, "accept_risk").ok, true);
  assert.equal(s.career.jobId, null);
  const lostWeek = s.time.absoluteWeek;
  settleExcept(s, null);
  s.weekly = { used: 0, selectedIds: [] };
  assert.equal(acceptJobOffer(s, "market").ok, true);
  assert.equal(advanceWeek(s).ok, true);
  settleExcept(s, "job_start");
  if (!s.events.active) activateNextEvent(s);
  settleExcept(s, "job_start");
  assert.equal(resolveEvent(s, getEventDefinition("job_start").choices[0].id).ok, true);
  assert.equal(s.career.jobId, "market");
  // Dönüş bedava değil: işsiz geçen hafta gerçek, kıdem sıfırlandı ve her
  // adım geçmişe tam bir kez yazıldı.
  assert.ok(s.time.absoluteWeek > lostWeek, "işsiz geçen zaman gerçektir");
  assert.equal(s.career.weeksInRole, 0, "kıdem sıfırlanır; terfi penceresi 20 hafta ister");
  assert.equal(s.career.history.filter((item) => item.type === "involuntary_unemployment").length, 1);
  assert.equal(s.career.history.filter((item) => item.type === "job_started").length, 1);
  assert.equal(validateState(s).ok, true);
});

test("iş güvenliği uyarısı soğuma içinde yeniden ödül üretmez", () => {
  const s = fresh();
  const definition = getEventDefinition("job_security_warning");
  s.career.performance = 20;
  fire(s, "job_security_warning");
  assert.equal(resolveEvent(s, "recover").ok, true);
  const cooldown = s.events.cooldowns.job_security_warning;
  assert.ok(cooldown > s.time.absoluteWeek, "uyarı soğuması kaydedilmeli");
  assert.equal(cooldown - s.time.absoluteWeek, definition.cooldownWeeks);
  // Koşul hâlâ sağlanıyor ama soğuma dolmadan yeniden ödül alınamaz.
  assert.equal(definition.condition(s), true);
  assert.equal(s.time.absoluteWeek < cooldown, true);
  // Zorla yeniden açılsa bile ikinci bir değerlendirme dosyası doğmaz.
  const before = { ...s.health };
  fire(s, "job_security_warning");
  assert.equal(resolveEvent(s, "recover").ok, true);
  assert.equal(s.openCases.filter((item) => item.payload?.kind === "job_security" && item.status !== "resolved").length, 1, "ikinci dosya açılmamalı");
  assert.ok(s.health.stress <= before.stress, "toparlanma seçimi stres biriktirmez");
  // Ve sonuç yine gerçek performansa bağlıdır.
  waitForCase(s, "job_security");
  assert.equal(resolveEvent(s, "recover").ok, true);
  assert.equal(s.career.jobId, null, "performans hâlâ düşükse tekrar tekrar toparlanma sözü vermek kurtarmaz");
});

/* ------------------------------------------------------------------ *
 * Uzun koşu: dört yetişkin çekirdek stratejisi
 * ------------------------------------------------------------------ */

const CHECKPOINTS = [52, 156, 260, 520];

function assertAdultCoreShape(result) {
  assert.ok(result.weeks >= 520, "520 haftalık koşu tamamlanmalı");
  assert.equal(result.valid, true);
  for (const week of CHECKPOINTS) {
    const point = result.checkpoints[week];
    assert.ok(point, `${week}. hafta kontrol noktası kaydedilmeli`);
    assert.equal(point.week, week);
    assert.ok(Number.isFinite(point.balance) && Number.isFinite(point.annualBaselineCost));
    assert.ok(point.performance >= 0 && point.performance <= 100);
    assert.ok(point.costIndex >= 1 && point.costIndex <= 1.5);
    assert.ok(point.monthlyBaselineCost > 0);
  }
  // Geçim gideri gerçekten uzun vadede yükselir.
  assert.ok(result.checkpoints[520].annualBaselineCost > result.checkpoints[52].annualBaselineCost, "yıllık temel gider zamanla artmalı");
  assert.ok(result.observed.costIndex <= 1.5);
  assert.ok(result.observed.performance <= 100);
  assert.ok(result.observed.ledger <= 120);
  assert.ok(result.observed.careerHistory <= 40);
  assert.ok(result.observed.yearFile <= 80);
  assert.ok(result.observed.memories <= 200);
  assert.ok(result.observed.npcMemories <= 50);
  assert.ok(result.observed.reliefCases <= 1);
  assert.ok(result.observed.securityCases <= 1);
}

test("kariyer odaklı 520 hafta: gerçek ilerleme, sınırlı performans, güçlü ama bağlamlı birikim", () => {
  const result = runAdultCoreScenario("career-focused");
  assertAdultCoreShape(result);
  assert.ok(result.counters.promotions + result.counters.jobSwitches >= 1, "uygunken en az bir kariyer ilerlemesi olmalı");
  assert.equal(result.counters.jobLosses, 0, "gerçek bir risk doğmadıkça iş kaybedilmez");
  assert.ok(result.final.salary > 12800, "kariyer yatırımı gerçek bir ücret artışına dönüşmeli");
  assert.ok(result.counters.overtimeWeeks > 0 && result.counters.overtimeWeeks < 520, "mesai gerçek ama sınırsız değil");
  assert.ok(result.observed.balanceLow > 0, "kariyer odaklı oyuncu ödeme gücünü korur");
});

test("dengeli 520 hafta: birikim anlamlı kalır ama kaçış hızına ulaşmaz", () => {
  const result = runAdultCoreScenario("balanced");
  assertAdultCoreShape(result);
  const final = result.checkpoints[520].savingsMultiple;
  // Sınır gözlenen kanıttan seçildi: ölçülen 3.63 yıllık geçim. Üst sınır 5.0,
  // aşağıdan 0.5: birikim gerçek olmalı (cezalandırıcı değil) ama kontrolsüz
  // büyümemeli. Büyüme hızı da yavaşlar: ilk beş yılda +2.44, ikinci beş
  // yılda +1.19 — gider indeksi birikimi gerçekten dizginliyor.
  assert.ok(final < 5, `dengeli oyuncuda kontrolsüz birikim olmamalı (${final})`);
  assert.ok(final > 0.5, `sıradan oyun kalıcı yoksulluk olmamalı (${final})`);
  const firstHalf = result.checkpoints[260].savingsMultiple - result.checkpoints[52].savingsMultiple;
  const secondHalf = final - result.checkpoints[260].savingsMultiple;
  assert.ok(secondHalf < firstHalf, "yükselen geçim gideri birikim hızını yavaşlatmalı");
  assert.ok(result.observed.balanceLow > 0, "sıradan strateji ödeme gücünü korur");
});

test("maddi sıkıntılı 520 hafta: gerçek destek döngüsü, gerçek bedel, çıkış yolu açık", () => {
  const result = runAdultCoreScenario("financially-strained");
  assertAdultCoreShape(result);
  assert.ok(result.counters.reliefBorrowed >= 1, "sıkışık oyuncu en az bir meşru destek döngüsü yaşamalı");
  assert.ok(result.counters.reliefRepaid + result.counters.reliefDefaults >= 1, "destek ya geri ödenir ya ödenmez; sonuçsuz kalmaz");
  assert.ok(result.observed.reliefAmount >= MONEY_RELIEF_MIN && result.observed.reliefAmount <= MONEY_RELIEF_MAX);
  // Zorluk gerçek: birikim düşük ve kırılgan.
  assert.ok(result.checkpoints[520].savingsMultiple < 1, "sıkışık oyuncu rahat birikime ulaşmamalı");
  // Ama kilit yok: borç uçuşa geçmiyor ve oyuncunun elinde hâlâ gerçek bir çıkış var.
  assert.ok(result.observed.balanceLow > -result.checkpoints[520].annualBaselineCost, "yoksulluk kilidi olmamalı");
  assert.equal(result.final.jobId, "market", "seçilen düşük ücretli yolda kalır");
});

test("eğitim→kariyer: diploma gerçekten yeni bir işi uygun hale getirir", () => {
  const result = runAdultCoreScenario("education-career");
  assertAdultCoreShape(result);
  const education = result.education;
  assert.ok(education.enrolledWeek > 0, "gerçek kayıt olmalı");
  assert.ok(education.enrollmentFee > 0 && education.tuitionPaid > 0, "kayıt ücreti ve aylık harç gerçekten ödenmeli");
  assert.ok(education.completedWeek > education.enrolledWeek, "program gerçek haftalarla tamamlanmalı");
  assert.equal(education.eligibleBefore, false, "diploma öncesi iş uygun olmamalı");
  assert.equal(education.eligibleAfter, true, "diploma sonrası iş uygun olmalı");
  assert.ok(education.transitionWeek >= education.completedWeek, "geçiş ancak tamamlandıktan sonra olur");
  assert.ok(education.salaryAfter > education.salaryBefore, "yeni iş gerçek bir ücret farkı getirmeli");
  assert.equal(result.final.educationLevel, "lisans");
  // Erken yıllarda harç baskısı, geç yıllarda kazanç: eğrinin şekli bunu göstermeli.
  assert.ok(result.checkpoints[52].savingsMultiple < result.checkpoints[156].savingsMultiple);
  assert.ok(result.checkpoints[520].savingsMultiple > result.checkpoints[260].savingsMultiple);
});

test("dört strateji ekonomik olarak gerçekten ayrışır ve koşular belirlenimlidir", () => {
  const career = runAdultCoreScenario("career-focused");
  const balanced = runAdultCoreScenario("balanced");
  const strained = runAdultCoreScenario("financially-strained");
  const education = runAdultCoreScenario("education-career");
  const multiple = (result) => result.checkpoints[520].savingsMultiple;
  assert.ok(multiple(career) > multiple(balanced), "kariyer odaklı, dengeliyi geçebilmeli");
  assert.ok(multiple(balanced) > multiple(strained) + 1, "sıkışık strateji belirgin biçimde ayrışmalı");
  assert.ok(multiple(education) > multiple(balanced), "eğitim yatırımı uzun vadede karşılığını vermeli");
  assert.equal(new Set([career, balanced, strained, education].map((result) => result.final.jobId)).size >= 3, true, "stratejiler farklı kariyer sonuçlarına varmalı");
  // Belirlenimlilik: aynı strateji iki kez koşturulunca aynı kontrol noktaları.
  assert.deepEqual(runAdultCoreScenario("career-focused").checkpoints, career.checkpoints);
  assert.deepEqual(runAdultCoreScenario("financially-strained").checkpoints, strained.checkpoints);
  assert.deepEqual(runAdultCoreScenario("balanced").checkpoints, balanced.checkpoints);
});
