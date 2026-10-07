import {businessLocation,currentDistrict} from './locations.js?v=10';
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

export const businessTimeCost = action => ["start", "expand", "shrink"].includes(action) ? 2 : 1;
const usedWeek = (state, slots = 1) => state.weekly.used + slots > getWeeklyActivityLimit(state);
function recordWeek(state, id, slots = 1) {
  state.weekly.used += slots;
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
  if (state.lifetime?.death || state.events.active || usedWeek(state, businessTimeCost("start"))) return { ok: false, reason: "İş kurmak için bu hafta 2 zaman ayırmalısın." };
  return { ok: true };
}

export function startBusiness(state, id) {
  const check = businessAvailability(state, id);
  if (!check.ok) return check;
  const type = BUSINESS_TYPES[id];
  transact(state, -type.startup, `${type.label} kuruluş ve ekipman`, "business");
  state.flags.business = { id, locationId:currentDistrict(state)?.id||'', startedWeek: state.time.absoluteWeek, lastMonth: -1, months: 0, level: 1, employees: 0, debt: 0, invested: type.startup, lossMonths: 0 };
  recordWeek(state, `business:start:${id}`, businessTimeCost("start"));
  addMemory(state, `${type.label} açıldı. Kazanç garanti değil; aylık gider ve emek gerektiriyor.`, "important");
  return { ok: true, message: `${type.label} açıldı. İlk ay sonunda ciro ve gider sonucu görülecek.` };
}

export function closeBusiness(state) {
  const business = state.flags.business;
  if (!business) return { ok: false, reason: "Açık işletme yok." };
  if (state.lifetime?.death || state.events.active || usedWeek(state)) return { ok: false, reason: "Önce açık olayı bitir veya haftalık zaman ayır." };
  const type = BUSINESS_TYPES[business.id];
  if (!type) return { ok: false, reason: "Eski kayıttaki işletme türü tanınmıyor; kayıt değiştirilmedi." };
  normalizeBusiness(state);
  const sale = Math.round(business.invested * 0.25) - business.debt;
  transact(state, sale, `${type.label} ikinci el ekipman satışı`, "business");
  delete state.flags.business;
  recordWeek(state, "business:close");
  return { ok: true, message: `${type.label} kapandı; ekipmandan bir bölümü geri kazanıldı.` };
}

export function processBusinessMonth(state) {
  const business = state.flags.business;
  if (!business || !BUSINESS_TYPES[business.id]) return "";
  normalizeBusiness(state);
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
  const capacity = 2 ** (business.level - 1);
  const staffing = Math.min(1, (business.employees + 1) / capacity);
  const competition = Math.min(.25, (business.level - 1) * .025);
  const crisis = [2001,2009,2018,2020].includes(context.year) ? .2 : 0;
  const local=businessLocation(state);
  // The owner is already counted in staffing; count their productive work in turnover too.
  const revenue = Math.max(0, Math.round((type.monthly * capacity + (business.employees + 1) * 16000) * (demand + cycle + skill - strain - ramp - competition - crisis) * staffing * local.demand));
  const supply = Math.round(revenue * .25);
  const wages = business.employees * 9000;
  const rent = Math.round(Math.max(2100, type.monthly * .25) * capacity ** .8 * local.rent);
  const operations = Math.round(type.monthly * (.25 + debtPressure) * capacity);
  const interest = Math.ceil(business.debt * (.01 + context.uncertainty * .04));
  const principal = Math.min(business.debt, Math.ceil(business.debt / (business.restructured ? 48 : 24)));
  const tax = Math.round(Math.max(0, revenue-supply-wages-rent-operations-interest)*.2);
  const expenses = supply+wages+rent+operations+interest+principal+tax;
  business.debt -= principal;
  const net = revenue - expenses;
  business.lastResult = { date: state.time.date, revenue, expenses, net, supply, wages, rent, operations, interest, principal, tax };
  business.lossMonths = net < 0 ? business.lossMonths + 1 : 0;
  transact(state, net, `${type.label} aylık ciro eksi gider`, "business");
  if (business.lossMonths >= 6 && state.finances.balance < -5000) {
    const liquidation = Math.round(business.invested*.15)-business.debt;
    transact(state,liquidation,`${type.label} iflas tasfiyesi (borç dahil)`,"business");
    state.flags.lastBusinessOutcome = {date:state.time.date,outcome:"bankrupt",id:business.id};
    delete state.flags.business;
    addMemory(state,`${type.label} altı zarar ayından sonra iflas etti; kalan borç kişisel bütçede.`,"important");
  }
  adjustHealth(state, { energy: -type.effort, stress: net < 0 ? 4 : 1 });
  return `${type.label}: bu ay ${net >= 0 ? "net kazanç" : "net zarar"} ${formatPeriodMoney(Math.abs(net), economyYear(state), state.time.date)}.`;
}


export function normalizeBusiness(state) {
 const b=state.flags.business;if(!b||!BUSINESS_TYPES[b.id])return null;
 b.level=Number.isInteger(b.level)?Math.max(1,Math.min(10,b.level)):1;
 b.employees=Number.isInteger(b.employees)?Math.max(0,Math.min(512,b.employees)):0;
 for(const key of ['debt','lossMonths']) b[key]=Number.isFinite(b[key])?Math.max(0,b[key]):0;
 b.invested=Number.isFinite(b.invested)?Math.max(0,b.invested):BUSINESS_TYPES[b.id].startup;
 return b;
}
export function manageBusiness(state,action) {
 const b=normalizeBusiness(state);
 if(!b||state.lifetime?.death||state.events.active||usedWeek(state,businessTimeCost(action)))return {ok:false,reason:'İşletme veya haftalık zaman uygun değil.'};
 if(state.weekly.selectedIds.includes(`business:${action}`))return {ok:false,reason:'Bu işletme kararını bu hafta zaten verdin.'};
 const type=BUSINESS_TYPES[b.id], capacity=2**(b.level-1);
 if(action==='expand'){
  const cost=type.startup*capacity;
  if(b.level>=10||state.finances.balance<cost||b.lossMonths>=3)return {ok:false,reason:'Büyüme için sermaye ve sürdürülebilir nakit akışı gerekiyor.'};
  transact(state,-cost,'İşletme kapasite yatırımı','business');b.invested+=cost;b.level++;
 }else if(action==='hire'){
  if(b.employees>=capacity-1||state.finances.balance<9000)return {ok:false,reason:'Boş kapasite ve bir aylık ücret karşılığı gerekir.'};
  transact(state,-9000,'Çalışan işe alım ve eğitim','business');b.employees++;
 }else if(action==='shrink'){
  if(b.level<=1)return {ok:false,reason:'İşletme zaten en küçük ölçekte.'};
  const equipment=type.startup*2**(b.level-2);b.level--;
  const excess=Math.max(0,b.employees-(2**(b.level-1)-1));b.employees-=excess;
  b.invested=Math.max(type.startup,b.invested-equipment);
  const proceeds=Math.round(equipment*.25), repayment=Math.min(b.debt,proceeds);b.debt-=repayment;
  transact(state,proceeds-repayment-excess*9000,'Küçülme: ekipman satışı, borç ve çalışan ayrılış maliyeti','business');
 }else if(action==='loan'){
  if(b.debt>0||b.months<3||b.lastResult?.net<=0||!b.lastResult)return {ok:false,reason:'İşletme kredisi için üç ay, kâr ve kapalı eski kredi gerekir.'};
  const amount=Math.floor(b.invested*.10);b.debt=amount;b.restructured=false;transact(state,amount,'İşletme kredisi anaparası','business');
 }else if(action==='restructure'){
  if(!b.debt||b.restructured)return {ok:false,reason:'Yapılandırılabilir borç yok; aynı borç bir kez yapılandırılabilir.'};
  b.debt=Math.ceil(b.debt*1.08);b.restructured=true;
 }else return {ok:false,reason:'İşlem tanınmadı.'};
 recordWeek(state,`business:${action}`,businessTimeCost(action));
 return {ok:true,message:'İşletme kararı uygulandı; giderler aylık sonuçta izlenebilir.'};
}
