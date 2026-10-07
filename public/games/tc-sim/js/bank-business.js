import { economyYear, formatPeriodMoney, periodContext } from "./period-economy.js?v=10";
import { addMemory, adjustHealth, getWeeklyActivityLimit, transact } from "./state.js?v=10";
import { getMonthlySummary } from "./life.js?v=10";
import { normalizeWealth, WEALTH_LIMITS } from "./wealth.js?v=10";

export const CREDIT_OFFERS = Object.freeze({
  small: { label: "Kısa vadeli ihtiyaç kredisi", cash: 12000, months: 12, total: 14400 },
  medium: { label: "Orta vadeli ihtiyaç kredisi", cash: 30000, months: 24, total: 39600 },
  large: { label: "Girişim sermayesi kredisi", cash: 60000, months: 36, total: 88800 },
});

// New offers reflect observed inflation uncertainty; these are game risk
// premiums in indexed budget units, never historical nominal bank APRs.
export function creditOffer(state, id) {
  const base = CREDIT_OFFERS[id];
  if (!base) return null;
  const inflation = periodContext(state).inflation;
  const premium = inflation !== null && inflation > 0.3 ? 1.25 : 1;
  return { ...base, total: Math.round(base.cash + (base.total - base.cash) * premium) };
}

export const BUSINESS_TYPES = Object.freeze({
  repair: { label: "Mahalle tamir atölyesi", since: 1980, startup: 14000, monthly: 2100, effort: 3 },
  market: { label: "Mahalle bakkalı", since: 1980, startup: 28000, monthly: 3100, effort: 4 },
  internet: { label: "İnternet kafe", since: 1996, startup: 35000, monthly: 3700, effort: 4 },
  device: { label: "Mobil cihaz bakım servisi", since: 2008, startup: 14000, monthly: 2100, effort: 3 },
  digital: { label: "Çevrimiçi küçük mağaza", since: 2014, startup: 22000, monthly: 3400, effort: 3 },
});

const usedWeek = (state) => state.weekly.used >= getWeeklyActivityLimit(state);
function recordWeek(state, id) {
  state.weekly.used += 1;
  state.weekly.selectedIds.push(id);
}

export function creditAvailability(state, id) {
  const offer = creditOffer(state, id);
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
  const offer = creditOffer(state, id);
  state.wealth.debts.push({ id: `bank-${state.time.absoluteWeek}`, type: "personal", principal: offer.total,
    monthlyPayment: Math.ceil(offer.total / offer.months), linkedAssetId: null, startWeek: state.time.absoluteWeek });
  transact(state, offer.cash, `${offer.label} kullandırımı`, "debt");
  recordWeek(state, "bank:credit");
  addMemory(state, `${offer.label} alındı; aylık ödeme bütçeye girdi.`);
  return { ok: true, message: `${formatPeriodMoney(offer.cash, economyYear(state), state.time.date)} hesaba geçti; ${offer.months} ay boyunca ödeme yapılacak.` };
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
  if (economyYear(state) < type.since) return { ok: false, reason: `${type.since} öncesinde bu iş alanı bu senaryoda yok.` };
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
  const month = state.time.year * 12 + state.time.month;
  if (business.lastMonth === month) return "";
  business.lastMonth = month;
  business.months += 1;
  const type = BUSINESS_TYPES[business.id];
  const context = periodContext(state);
  // Reproducible local business risk, independent of global event RNG.
  const seed = ((state.meta.rngState || 1) ^ (month * 2654435761) ^ business.startedWeek) >>> 0;
  const cycle = ((Math.imul(seed ^ (seed >>> 16), 2246822507) >>> 0) / 4294967296 - 0.5) * (1.4 + context.uncertainty);
  const demand = business.id === "device" && context.year > 2025 ? 1.05
    : business.id === "internet" ? context.year < 2005 ? 1.2 : context.year < 2012 ? 1 : 0.55
    : business.id === "digital" ? context.year < 2020 ? 1.05 : context.year <= 2025 ? 0.9 : 0.8
    : business.id === "market" && context.year >= 2020 ? 0.85 : 1;
  const skill = Math.min(0.2, (state.career?.performance || 0) / 500 + (state.education?.fields?.includes("technical") ? 0.05 : 0));
  const strain = state.health.energy < 30 ? 0.25 : 0;
  const debtPressure = state.finances.arrears > 0 ? 0.2 : 0;
  const ramp = business.months <= 3 ? 0.2 : 0;
  const revenue = Math.max(0, Math.round(type.monthly * (demand + cycle + skill - strain - ramp)));
  const expenses = Math.round(type.monthly * (0.75 + debtPressure));
  const net = revenue - expenses;
  business.lastResult = { date: state.time.date, revenue, expenses, net };
  transact(state, net, `${type.label} aylık ciro eksi gider`, "business");
  adjustHealth(state, { energy: -type.effort, stress: net < 0 ? 4 : 1 });
  return `${type.label}: bu ay ${net >= 0 ? "net kazanç" : "net zarar"} ${formatPeriodMoney(Math.abs(net), economyYear(state), state.time.date)}.`;
}
