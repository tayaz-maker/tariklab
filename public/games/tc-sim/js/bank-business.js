import { addMemory, adjustHealth, getWeeklyActivityLimit, transact } from "./state.js?v=10";
import { getMonthlySummary } from "./life.js?v=10";
import { normalizeWealth, WEALTH_LIMITS } from "./wealth.js?v=10";

export const CREDIT_OFFERS = Object.freeze({
  small: { label: "Kısa vadeli ihtiyaç kredisi", cash: 12000, months: 12, total: 14400 },
  medium: { label: "Orta vadeli ihtiyaç kredisi", cash: 30000, months: 24, total: 39600 },
  large: { label: "Girişim sermayesi kredisi", cash: 60000, months: 36, total: 88800 },
});

export const BUSINESS_TYPES = Object.freeze({
  repair: { label: "Mahalle tamir atölyesi", since: 1980, startup: 14000, monthly: 2100, effort: 3 },
  market: { label: "Mahalle bakkalı", since: 1980, startup: 28000, monthly: 3100, effort: 4 },
  internet: { label: "İnternet kafe", since: 1996, startup: 35000, monthly: 3700, effort: 4 },
  digital: { label: "Çevrimiçi küçük mağaza", since: 2014, startup: 22000, monthly: 3400, effort: 3 },
});

const usedWeek = (state) => state.weekly.used >= getWeeklyActivityLimit(state);
function recordWeek(state, id) {
  state.weekly.used += 1;
  state.weekly.selectedIds.push(id);
}

export function creditAvailability(state, id) {
  const offer = CREDIT_OFFERS[id];
  if (!offer) return { ok: false, reason: "Kredi seçeneği bulunamadı." };
  if (state.lifetime?.death || state.events.active || usedWeek(state)) return { ok: false, reason: "Önce açık olayı bitir veya haftalık zaman ayır." };
  if (state.weekly.selectedIds.includes("bank:credit")) return { ok: false, reason: "Bu hafta kredi kararı verildi." };
  normalizeWealth(state);
  if (state.wealth.debts.length >= WEALTH_LIMITS.debts) return { ok: false, reason: "Borç sınırı dolu." };
  if (state.wealth.debts.some((debt) => debt.type === "personal")) return { ok: false, reason: "Önce mevcut ihtiyaç kredisini kapat." };
  const income = getMonthlySummary(state).income;
  const otherPayments = state.wealth.debts.reduce((sum, debt) => sum + Math.min(debt.principal, debt.monthlyPayment), 0);
  if (income < 4500 || otherPayments + Math.ceil(offer.total / offer.months) > income * 0.4)
    return { ok: false, reason: "Aylık gelir, bu geri ödeme yükünü taşımıyor." };
  return { ok: true };
}

export function takeCredit(state, id) {
  const check = creditAvailability(state, id);
  if (!check.ok) return check;
  const offer = CREDIT_OFFERS[id];
  state.wealth.debts.push({ id: `bank-${state.time.absoluteWeek}`, type: "personal", principal: offer.total,
    monthlyPayment: Math.ceil(offer.total / offer.months), linkedAssetId: null, startWeek: state.time.absoluteWeek });
  transact(state, offer.cash, `${offer.label} kullandırımı`, "debt");
  recordWeek(state, "bank:credit");
  addMemory(state, `${offer.label} alındı; aylık ödeme bütçeye girdi.`);
  return { ok: true, message: `${offer.cash.toLocaleString("tr-TR")} oyun birimi hesaba geçti; ${offer.months} ay boyunca ödeme yapılacak.` };
}

export function repayCredit(state) {
  normalizeWealth(state);
  const debt = state.wealth.debts.find((item) => item.type === "personal");
  if (!debt) return { ok: false, reason: "Kapatılacak ihtiyaç kredisi yok." };
  if (state.finances.balance < debt.principal) return { ok: false, reason: "Kalan borcu kapatmaya yeterli nakit yok." };
  if (usedWeek(state) || state.weekly.selectedIds.includes("bank:repay")) return { ok: false, reason: "Bu hafta bankaya zaman kalmadı." };
  transact(state, -debt.principal, "İhtiyaç kredisi erken kapama", "debt");
  state.wealth.debts = state.wealth.debts.filter((item) => item !== debt);
  recordWeek(state, "bank:repay");
  return { ok: true, message: "Kredi borcu kapandı; sonraki aylık ödeme kalktı." };
}

export function businessAvailability(state, id) {
  const type = BUSINESS_TYPES[id];
  if (!type) return { ok: false, reason: "İş alanı bulunamadı." };
  if (state.time.year < type.since) return { ok: false, reason: `${type.since} öncesinde bu iş alanı bu senaryoda yok.` };
  if (state.flags.business) return { ok: false, reason: "Önce mevcut işletmeyi kapat." };
  if (state.finances.balance < type.startup) return { ok: false, reason: "Kuruluş sermayesi yetersiz." };
  if (state.lifetime?.death || state.events.active || usedWeek(state)) return { ok: false, reason: "Bu hafta işe başlayamazsın." };
  return { ok: true };
}

export function startBusiness(state, id) {
  const check = businessAvailability(state, id);
  if (!check.ok) return check;
  const type = BUSINESS_TYPES[id];
  transact(state, -type.startup, `${type.label} kuruluş ve ekipman`, "business");
  state.flags.business = { id, startedWeek: state.time.absoluteWeek, lastMonth: -1, months: 0 };
  recordWeek(state, `business:start:${id}`);
  addMemory(state, `${type.label} açıldı. Kazanç garanti değil; aylık gider ve emek gerektiriyor.`, "important");
  return { ok: true, message: `${type.label} açıldı. İlk ay sonunda ciro ve gider sonucu görülecek.` };
}

export function closeBusiness(state) {
  const business = state.flags.business;
  if (!business) return { ok: false, reason: "Açık işletme yok." };
  if (usedWeek(state)) return { ok: false, reason: "Bu hafta zaman kalmadı." };
  const type = BUSINESS_TYPES[business.id];
  if (!type) return { ok: false, reason: "Eski kayıttaki işletme türü tanınmıyor; kayıt değiştirilmedi." };
  const sale = Math.round(type.startup * 0.25);
  transact(state, sale, `${type.label} ikinci el ekipman satışı`, "business");
  delete state.flags.business;
  recordWeek(state, "business:close");
  return { ok: true, message: `${type.label} kapandı; ekipmandan bir bölümü geri kazanıldı.` };
}

export function processBusinessMonth(state) {
  const business = state.flags.business;
  if (!business || !BUSINESS_TYPES[business.id]) return "";
  const month = Math.floor((state.time.absoluteWeek - 1) / 4);
  if (business.lastMonth === month) return "";
  business.lastMonth = month;
  business.months += 1;
  const type = BUSINESS_TYPES[business.id];
  const cycle = [-0.65, 0.25, -0.2, 0.4, -0.1, 0.55][(month + business.startedWeek) % 6];
  const era = business.id === "internet" ? state.time.year >= 2012 ? 0.45 : 1.25 : 1;
  const net = Math.round(type.monthly * (cycle + era - 0.45));
  transact(state, net, `${type.label} aylık ciro eksi gider`, "business");
  adjustHealth(state, { energy: -type.effort, stress: net < 0 ? 4 : 1 });
  return `${type.label}: bu ay ${net >= 0 ? "net kazanç" : "net zarar"} ${Math.abs(net).toLocaleString("tr-TR")} oyun birimi.`;
}
