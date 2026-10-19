import { getMonthlySummary } from "./life.js?v=10";
import { reconcileMortgageClaims, MORTGAGE_TERMS, amortizedPayment, newMortgage, normalizeMortgage, isAmortizingMortgage, debtBalance, mortgageDue, mortgageStatus, settleMortgageMonth, settleMortgagePayment, restructureMortgage, validMortgage, mortgageText } from "./mortgage.js?v=10";
import { recordBankMonth, recordBankLoan, bankCreditPolicy } from "./bank-record.js?v=10";

import { recordMonthlyCash } from "./monthly-cash.js?v=10";
import { normalizeSemt } from "./quarters.js?v=10";
import { normalizeExchange, exchangePortfolio } from './exchange.js?v=10';
import { economyYear } from "./period-economy.js?v=10";
const TIERS = {
  modest: { label: "İdare eder", monthly: 0 },
  comfortable: { label: "Rahat", monthly: 1200 },
  comfort: { label: "Evi düzgün", monthly: 3000 },
  high: { label: "Gösterişli", monthly: 6500 },
};
export const LIFESTYLE_TIERS = TIERS;
export const WEALTH_LIMITS = {
  subscriptions: 8,
  durables: 10,
  properties: 3,
  debts: 4,
  investments: 10,
};
export const CASH_FLOOR = -10000;
export const CASH_ARREARS_CAP = 300000;
export const SUBSCRIPTIONS = {
  streaming: { label: "Dizi-film üyeliği", monthly: 180, since: 2007 },
  music: { label: "Müzik üyeliği", monthly: 90, since: 2008 },
  gym: { label: "Spor salonu kartı", monthly: 650 },
  hobby: { label: "Mahalle hobi kulübü", monthly: 420 },
  cleaning: { label: "Haftalık ev temizliği", monthly: 900 },
  dating: { label: "Tanışma uygulaması", monthly: 240, since: 2009 },
};
export const DURABLES = {
  phone: { label: "Samsung Galaxy A15", price: 9000, resale: 0.42 },
  computer: { label: "Lenovo IdeaPad 3", price: 18000, resale: 0.48 },
  entertainment: { label: "Vestel 55UA", price: 12000, resale: 0.38 },
  bed: { label: "İstikbal Nuvora", price: 8500, resale: 0.3 },
  office: { label: "Bellona çalışma masası", price: 11000, resale: 0.35 },
  headphones: { label: "Sony WH-CH520", price: 2500, resale: 0.3 },
  furniture: { label: "Bellona kanepe", price: 4500, resale: 0.3 },
  appliance: { label: "Arçelik mini fırın", price: 3800, resale: 0.35 },
  bike: { label: "Salcano Explorer 28", price: 6500, resale: 0.4 },
  scooter: { label: "Mondial Drift 125", price: 28000, resale: 0.45 },
  luxury_watch: { label: "Seiko 5 Sports", price: 12000, resale: 0.3 },
};
export const VEHICLES = {
  used: { label: "Renault Symbol 1.5", price: 180000, monthly: 3200, resale: 0.68 },
  standard: { label: "Fiat Egea 1.4 Easy", price: 360000, monthly: 5200, resale: 0.7 },
  premium: { label: "Volkswagen Passat 1.6", price: 720000, monthly: 9200, resale: 0.66 },
};
// Game-budget allocation, not pump prices or statutory insurance tariffs.
// Four observed commute weeks + the fixed reserve retain the old monthly cap.
export function vehicleOperatingCosts(state) {
  const budget = VEHICLES[state.wealth?.vehicle?.tier]?.monthly || 0;
  const weeklyFuel = Math.round(budget * 0.6 / 4);
  const fixed = budget - weeklyFuel * 4;
  const insurance = Math.round(fixed / 2);
  return { budget, weeklyFuel, fixed, insurance, upkeep: fixed - insurance };
}
export function vehicleExpenseLabel(kind) {
  const lang = globalThis.window?.tlabI18n?.contentLang?.() || "tr";
  const copy = {
    fuel: { tr: "İşe gidiş yakıtı", en: "Work commute fuel", pl: "Paliwo na dojazd do pracy" },
    fixed: { tr: "Araç bakım payı", en: "Vehicle upkeep allowance", pl: "Koszty utrzymania pojazdu" },
    insurance: { tr: "Araç sigorta payı", en: "Vehicle insurance allowance", pl: "Składka ubezpieczenia pojazdu" },
  };
  return copy[kind]?.[lang] || copy[kind]?.en || "";
}
export const INVESTMENTS = {
  deposit: { label: "Mevduat", monthlyRates: [0.008, 0.009, 0.007, 0.01] },
  gold: { label: "Altın", monthlyRates: [0.018, -0.012, 0.01, 0.004, -0.006, 0.015] },
  fx: { label: "Döviz sepeti", monthlyRates: [0.012, -0.008, 0.006, 0.01, -0.004] },
  fund: { label: "Karma fon", monthlyRates: [0.014, -0.01, 0.018, -0.006, 0.009] },
  equity: { label: "Hisse sepeti", monthlyRates: [0.025, -0.025, 0.018, -0.012, 0.03, -0.02] },
  crypto: { label: "Kripto", monthlyRates: [0.08, -0.09, 0.04, -0.06, 0.05, -0.04] },
  bes: { label: "BES", monthlyRates: [0.006, 0.007, 0.005, 0.008] },
  land: { label: "Arsa payı", monthlyRates: [0.004, 0.012, -0.003, 0.009, 0.002] },
  business: { label: "Küçük işletme payı", monthlyRates: [0.02, -0.03, 0.015, -0.01, 0.01] },
  bond: { label: "Tahvil / bono", monthlyRates: [0.007, 0.006, 0.008, 0.005] },
};
export const SPENDING = {
  coffee: { label: "Bir kahve iç", cost: 180, energy: 1, stress: -2, category: "Bugün" },
  takeaway: { label: "Paket söyle", cost: 350, energy: 1, stress: -2, category: "Bugün" },
  dinner: {
    label: "Düzgün bir akşam yemeği",
    cost: 1200,
    energy: -5,
    stress: -6,
    category: "Bugün",
  },
  haircut: {
    label: "Saçını kestir",
    cost: 650,
    energy: -2,
    stress: -3,
    category: "Kendine bak",
  },
  clothing: {
    label: "Üstünü yenile",
    cost: 2200,
    energy: -4,
    stress: -3,
    category: "Kendine bak",
  },
  workwear: { label: "İş kıyafeti al", cost: 3500, energy: -4, stress: -2, category: "Kendine bak" },
  repair: {
    label: "Evde küçük onarım",
    cost: 1400,
    energy: -7,
    stress: -3,
    category: "Ev işi",
  },
  cleaning: {
    label: "Tek seferlik ev temizliği",
    cost: 900,
    energy: 3,
    stress: -4,
    category: "Ev işi",
  },
  gift: { label: "Birine hediye al", cost: 1500, energy: -3, stress: -2, category: "Hediye" },
  cafe: {
    label: "Kafe ve arkadaş buluşması",
    cost: 450,
    energy: -5,
    stress: -5,
    category: "Dışarı",
  },
  cinema: { label: "Sinema / gösteri", cost: 700, energy: -4, stress: -7, category: "Dışarı" },
  theatre: { label: "Tiyatro / stand-up", cost: 1100, energy: -6, stress: -8, category: "Dışarı" },
  concert: {
    label: "Konser / canlı müzik",
    cost: 1800,
    energy: -10,
    stress: -9,
    category: "Dışarı",
  },
  homefilm: {
    label: "Evde film ve müzik akşamı",
    cost: 220,
    energy: 1,
    stress: -5,
    category: "Evde akşam",
  },
  gaming: { label: "Oyun akşamı", cost: 250, energy: -2, stress: -6, category: "Evde akşam" },
  reading: { label: "Kitap ve sakin akşam", cost: 300, energy: 2, stress: -6, category: "Hobi" },
  hobby: { label: "Hobi dersi / atölye", cost: 750, energy: -5, stress: -8, category: "Hobi" },
  sports: { label: "Yüzme / spor etkinliği", cost: 650, energy: -8, stress: -8, category: "Hobi" },
  nightlife: {
    label: "Bar / gece hayatı",
    cost: 1800,
    energy: -14,
    stress: -7,
    category: "Gece, 18+",
  },
  romantic: {
    label: "Romantik akşam",
    cost: 2600,
    energy: -8,
    stress: -8,
    category: "Gece, 18+",
  },
  privateweekend: {
    label: "Özel hafta sonu",
    cost: 9500,
    energy: -8,
    stress: -14,
    category: "Gece, 18+",
    time: 2,
  },
  daytrip: { label: "Günübirlik gezi", cost: 2500, energy: -10, stress: -10, category: "Kaçış" },
  weekend: {
    label: "Hafta sonu kaçamağı",
    cost: 7500,
    energy: -8,
    stress: -14,
    category: "Kaçış",
    time: 2,
  },
  vacation: {
    label: "Yurt içi tatil",
    cost: 22000,
    energy: -6,
    stress: -18,
    category: "Kaçış",
    time: 2,
  },
  international: {
    label: "Yurt dışı tatil",
    cost: 65000,
    energy: -8,
    stress: -20,
    category: "Kaçış",
    time: 2,
  },
};

export const MARKET = {
  ...SPENDING,
  grocery: { label: "A101 haftalık poşet", cost: 900, energy: 2, stress: -1, category: "Mutfak" },
  phone_plan: { label: "Turkcell kontör", cost: 650, energy: 0, stress: -1, category: "Mutfak", since: 1994, until: 2009 },
  mobile_data: { label: "Turkcell hat paketi", cost: 650, energy: 0, stress: -1, category: "Hat ve ekran", since: 2010 },
  video_rental: { label: "Büfedeki kaset", cost: 220, energy: 1, stress: -5, category: "O günün işi", until: 2004 },
  dvd_rental: { label: "DVD kiralama", cost: 220, energy: 1, stress: -5, category: "O günün işi", since: 2000, until: 2013 },
  online_film: { label: "Bir film kirala", cost: 220, energy: 1, stress: -5, category: "Hat ve ekran", since: 2014 },
  remote_course: { label: "Canlı hobi dersi", cost: 750, energy: -5, stress: -8, category: "Hat ve ekran", since: 2020 },
  cheap_clothes: { label: "LC Waikiki sezonluk", cost: 800, energy: -2, stress: -1, category: "Üstün başın" },
  status_shoes: { label: "Hotiç deri ayakkabı", cost: 4800, energy: -3, stress: -4, category: "Üstün başın" },
  luxury_watch: { label: "Seiko 5 Sports", cost: 12000, energy: -2, stress: -3, category: "Üstün başın" },
  new_phone: { label: "Samsung Galaxy A15", cost: 18000, energy: -2, stress: -4, category: "Cihaz", since: 2008 },
  feature_phone: { label: "Nokia 3310", cost: 8500, energy: -2, stress: -2, category: "Cihaz", since: 1994 },
  laptop: { label: "Lenovo IdeaPad 3", cost: 22000, energy: -3, stress: -3, category: "Cihaz", since: 1990 },
  headphones: { label: "Sony WH-CH520", cost: 2500, energy: 1, stress: -3, category: "Cihaz" },
  cassette: { label: "Philips kasetçalar", cost: 950, energy: -1, stress: -3, category: "O günün işi", until: 2004 },
  newspaper: { label: "Büfeden gazete", cost: 120, energy: -1, stress: -2, category: "O günün işi" },
  internet_cafe_hour: { label: "İnternet kafede otur", cost: 300, energy: -3, stress: -3, category: "O günün işi", since: 1996 },
  furniture: { label: "Bellona kanepe", cost: 4500, energy: -5, stress: -3, category: "Eve bir şey" },
  appliance: { label: "Arçelik mini fırın", cost: 3800, energy: 2, stress: -2, category: "Eve bir şey" },
  bike: { label: "Salcano Explorer 28", cost: 6500, energy: -4, stress: -5, category: "Yol" },
  scooter: { label: "Mondial Drift 125", cost: 28000, energy: -5, stress: -4, category: "Yol" },
  car_service: { label: "Lastikçiye uğra", cost: 3200, energy: -4, stress: -2, category: "Yol" },
  dentist: { label: "Dişçiye git", cost: 4500, energy: -6, stress: -8, category: "Bedenin" },
  private_clinic: { label: "Özel muayene", cost: 2800, energy: 4, stress: -6, category: "Bedenin" },
  therapy: { label: "Terapi seansı", cost: 1600, energy: -2, stress: -10, category: "Bedenin" },
  gym_drop: { label: "Bir kez spor", cost: 250, energy: -6, stress: -4, category: "Bedenin" },
  restaurant: { label: "Restoranda ye", cost: 1800, energy: -4, stress: -6, category: "Dışarı" },
  club_night: { label: "Kulübe çık", cost: 2400, energy: -16, stress: -6, category: "Gece, 18+", adult: true },
  heavy_drink: { label: "Sert içki gecesi", cost: 1600, energy: -18, stress: -4, category: "Gece, 18+", adult: true, risk: "alcohol" },
  cannabis: { label: "Esrar", cost: 900, energy: 2, stress: -8, category: "Risk, 18+", adult: true, risk: "illegal" },
  betting: { label: "Kaçak bahse gir", cost: 1200, energy: -3, stress: 4, category: "Risk, 18+", adult: true, risk: "gambling" },
  casino: { label: "Kumar masasına otur", cost: 3500, energy: -8, stress: 6, category: "Risk, 18+", adult: true, risk: "gambling" },
  escort: { label: "Parayla buluşma", cost: 4500, energy: -6, stress: -5, category: "Gece, 18+", adult: true, risk: "sexwork" },
  family_gift: { label: "Ailene bir şey al", cost: 1200, energy: -2, stress: -3, category: "Hediye" },
  partner_gift: { label: "Partnerine hediye", cost: 1800, energy: -2, stress: -4, category: "Hediye" },
  friend_gift: { label: "Arkadaşına hediye", cost: 700, energy: -2, stress: -2, category: "Hediye" },
  pet_care: { label: "Hayvanın mama ve bakımı", cost: 800, energy: -3, stress: -3, category: "Mutfak" },
};

const integer = (v, fallback = 0) => (Number.isFinite(v) ? Math.max(0, Math.round(v)) : fallback);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tr = (a, b) => globalThis.window?.tlabI18n?.contentLang?.() === "en" ? b : a;
export const marketAvailableInYear = (state, item) => (!item.since || economyYear(state) >= item.since) && (!item.until || economyYear(state) <= item.until);
const marketUnavailableReason = (state, item) => item.since && economyYear(state) < item.since
  ? `${item.since} öncesinde bu ürün/hizmet yok.`
  : `${item.until} sonrasında bu dönem ürünü artık satılmıyor.`;
export const economyText = tr;
const tl = (n) => `₺${Math.round(n).toLocaleString("tr-TR")}`;
export const MARKET_OWNERSHIP = { new_phone: "phone", feature_phone: "phone", laptop: "computer", headphones: "headphones", furniture: "furniture", appliance: "appliance", bike: "bike", scooter: "scooter", luxury_watch: "luxury_watch" };
/** Alışveriş rafları. Kalıcı eşya (MARKET_OWNERSHIP) burada değil, Emlak'tadır. */
export const MARKET_SHELVES = [
  { id: "gunluk", label: "Bugün", categories: ["Bugün", "Kendine bak", "Ev işi", "Mutfak", "Hat ve ekran"] },
  { id: "ev", label: "Ev ve bakım", categories: ["Evde akşam", "Eve bir şey", "Bedenin", "Yol"] },
  { id: "disari", label: "Dışarı", categories: ["Dışarı", "Hobi", "Kaçış", "O günün işi"] },
  { id: "giyim", label: "Üstün başın", categories: ["Üstün başın", "Cihaz"] },
  { id: "hediye", label: "Hediye", categories: ["Hediye"] },
  { id: "gece", label: "Gece, 18+", categories: ["Gece, 18+", "Risk, 18+"] },
];
export const marketShelfId = (category) => MARKET_SHELVES.find((shelf) => shelf.categories.includes(category))?.id || "diger";
const care = { dentist: 5, private_clinic: 3, therapy: 2, gym_drop: 2, sports: 2 };
export function durableBenefit(id) {
  const descriptions = {
    phone: ["Buluşmalarda enerji maliyeti 2 azalır", "Meetups cost 2 less energy"],
    computer: ["Okuma ve hobi etkinliklerinde enerji +2", "Reading and hobby activities gain +2 energy"],
    entertainment: ["Evde film/oyunda stres 3 daha azalır", "Home films/gaming relieve 3 extra stress"],
    bed: ["Haftalık toparlanma: enerji +3", "Weekly recovery: +3 energy"],
    office: ["Haftalık toparlanma: enerji +1", "Weekly recovery: +1 energy"],
    headphones: ["Evde film/oyunda stres 1 daha azalır", "Home films/gaming relieve 1 extra stress"],
    furniture: ["Haftalık ev rahatlığı: stres −1", "Weekly home comfort: −1 stress"],
    appliance: ["Haftalık ev kolaylığı: enerji +1", "Weekly household convenience: +1 energy"],
    bike: ["Haftalık sağlık +1; aylık bakım ₺30", "Weekly health +1; monthly upkeep ₺30"],
    scooter: ["Haftalık enerji +2; aylık gider ₺250", "Weekly energy +2; monthly cost ₺250"],
    luxury_watch: ["Hediye verirken stres 1 daha azalır", "Giving gifts relieves 1 extra stress"],
  };
  return tr(...descriptions[id]);
}
export function marketPreview(state, id) {
  const item = MARKET[id], owned = new Set((state.wealth?.durables || []).map(x => x.id));
  let energy = item.energy, stress = item.stress;
  if (owned.has("phone") && ["cafe", "romantic"].includes(id)) energy += 2;
  if (owned.has("computer") && ["reading", "hobby"].includes(id)) energy += 2;
  if (["homefilm", "gaming"].includes(id)) stress -= (owned.has("entertainment") ? 3 : 0) + (owned.has("headphones") ? 1 : 0);
  if (id.includes("gift") && owned.has("luxury_watch")) stress -= 1;
  return { energy, stress, health: care[id] || (item.risk === "alcohol" ? -2 : 0), durable: MARKET_OWNERSHIP[id] || null,
    kind: MARKET_OWNERSHIP[id] ? tr("Kalıcı eşya", "Owned item") : id.includes("gift") ? tr("Hediye", "Gift") : item.risk ? tr("Riskli deneyim", "Risky experience") : care[id] || ["cleaning", "haircut", "repair", "car_service", "phone_plan"].includes(id) ? tr("Hizmet", "Service") : tr("Tüketim / deneyim", "Consumption / experience") };
}
export function marketEffectText(state, id) {
  const item = MARKET[id], p = marketPreview(state, id);
  return `${p.kind} · ${tr("Karar", "Decisions")} ${item.time || 1} · ${tr("Enerji", "Energy")} ${p.energy >= 0 ? "+" : ""}${p.energy} · ${tr("Stres", "Stress")} ${p.stress >= 0 ? "+" : ""}${p.stress}${p.health ? ` · ${tr("Sağlık", "Health")} ${p.health > 0 ? "+" : ""}${p.health}` : ""}${p.durable ? ` · ${durableBenefit(p.durable)} · ${tr("Tek sahiplik; ikinci el değeri alıştan düşüktür", "Single ownership; resale value is below purchase price")}` : ""}${id.includes("gift") ? ` · ${tr("Uygun mevcut ilişkide yakınlık +3/+4", "Existing eligible relationship +3/+4")}` : ""}${item.risk ? ` · ${tr("Risk", "Risk")}: ${tr(({alcohol:"alkol izi kalır",illegal:"yasal risk artar",gambling:"çoğu zaman az kaybedersin, ara sıra kazanırsın, büyük oynama nadir",sexwork:"mevcut ilişkide sadakat riski"})[item.risk],({alcohol:"alcohol history",illegal:"legal risk +8",gambling:"small losses are common, wins are rarer, a big swing is rare",sexwork:"infidelity risk in an existing relationship"})[item.risk])}` : ""}`;
}
export function processOwnedBenefits(state) {
  const w = state.wealth;
  if (!w || w.cooldowns.ownedBenefitsWeek === state.time.absoluteWeek) return;
  const owns = id => w.durables.some(x => x.id === id);
  const energy = Math.min(6, (owns("bed") ? 3 : 0) + (owns("office") ? 1 : 0) + (owns("appliance") ? 1 : 0) + (owns("scooter") ? 2 : 0));
  state.health.energy = clamp(state.health.energy + energy, 0, 100);
  state.health.stress = clamp(state.health.stress - (owns("furniture") ? 1 : 0), 0, 100);
  state.health.health = clamp(state.health.health + (owns("bike") ? 1 : 0), 0, 100);
  w.cooldowns.ownedBenefitsWeek = state.time.absoluteWeek;
}
export function investmentPL(position) {
  const value = position?.value || 0, basis = position?.basis || 0;
  return { value, basis, amount: value - basis, percent: basis ? (value - basis) / basis * 100 : 0 };
}
const uniqueBy = (items, key) => [...new Map(items.map((x) => [x[key], x])).values()];
export function neutralWealth() {
  return {
    lifestyle: "modest",
    lifestyleChangedWeek: null,
    subscriptions: [],
    durables: [],
    vehicle: null,
    properties: [],
    debts: [],
    investments: [],
    exchange: normalizeExchange(),
    cooldowns: {},
    lastProcessedMonth: null,
  };
}
export function normalizeWealth(state) {
  const raw = state.wealth && typeof state.wealth === "object" ? state.wealth : {};
  const base = neutralWealth();
  const now = state.time?.absoluteWeek || 1;
  const subscriptions = uniqueBy(
    (Array.isArray(raw.subscriptions) ? raw.subscriptions : [])
      .filter((x) => SUBSCRIPTIONS[x?.id])
      .map((x) => ({
        id: x.id,
        startedWeek: integer(x.startedWeek, now),
        lastBilledMonth: Number.isInteger(x.lastBilledMonth) ? x.lastBilledMonth : null,
      })),
    "id",
  ).slice(0, WEALTH_LIMITS.subscriptions);
  const durables = uniqueBy(
    (Array.isArray(raw.durables) ? raw.durables : [])
      .filter((x) => DURABLES[x?.id])
      .map((x) => ({
        id: x.id,
        price: integer(x.price, DURABLES[x.id].price),
        acquiredWeek: integer(x.acquiredWeek, now),
      })),
    "id",
  ).slice(0, WEALTH_LIMITS.durables);
  const investments = uniqueBy(
    (Array.isArray(raw.investments) ? raw.investments : [])
      .filter((x) => INVESTMENTS[x?.id])
      .map((x) => ({
        id: x.id,
        value: integer(x.value),
        basis: integer(x.basis),
        lastMonth: Number.isInteger(x.lastMonth) ? x.lastMonth : null,
      }))
      .filter((x) => x.value > 0),
    "id",
  ).slice(0, WEALTH_LIMITS.investments);
  const properties = uniqueBy(
    (Array.isArray(raw.properties) ? raw.properties : [])
      .filter(
        (x) => typeof x?.id === "string" && ["owner", "rental", "vacant"].includes(x.occupancy),
      )
      .map((x) => ({
        id: x.id,
        homeId: typeof x.homeId === "string" ? x.homeId : "apartment",
        occupancy: x.occupancy,
        purchasePrice: integer(x.purchasePrice),
        currentValue: integer(x.currentValue, x.purchasePrice),
        monthlyRent: integer(x.monthlyRent),
        maintenance: integer(x.maintenance),
        mortgageId: typeof x.mortgageId === "string" ? x.mortgageId : null,
        acquiredWeek: integer(x.acquiredWeek, now),
      })),
    "id",
  ).slice(0, WEALTH_LIMITS.properties);
  const debts = uniqueBy(
    (Array.isArray(raw.debts) ? raw.debts : [])
      .filter(
        (x) => typeof x?.id === "string" && ["mortgage", "vehicle", "personal"].includes(x.type),
      )
      .map((x) => ({
        id: x.id,
        type: x.type,
        principal: integer(x.principal),
        monthlyPayment: integer(x.monthlyPayment),
        linkedAssetId: typeof x.linkedAssetId === "string" ? x.linkedAssetId : null,
        startWeek: integer(x.startWeek, now),
        ...(x.type === "mortgage" && x.mortgage != null ? { mortgage: normalizeMortgage(x.mortgage) } : {}),
      }))
      .filter((x) => debtBalance(x) > 0),
    "id",
  ).slice(0, WEALTH_LIMITS.debts);
  state.wealth = {
    ...base,
    lifestyle: TIERS[raw.lifestyle] ? raw.lifestyle : "modest",
    lifestyleChangedWeek: Number.isInteger(raw.lifestyleChangedWeek)
      ? raw.lifestyleChangedWeek
      : null,
    subscriptions,
    durables,
    vehicle:
      raw.vehicle && VEHICLES[raw.vehicle.tier]
        ? {
            tier: raw.vehicle.tier,
            purchasePrice: integer(raw.vehicle.purchasePrice, VEHICLES[raw.vehicle.tier].price),
            currentValue: integer(raw.vehicle.currentValue),
            acquiredWeek: integer(raw.vehicle.acquiredWeek, now),
            loanId: typeof raw.vehicle.loanId === "string" ? raw.vehicle.loanId : null,
          }
        : null,
    properties,
    debts,
    investments,
    exchange: normalizeExchange(raw.exchange),
    cooldowns:
      raw.cooldowns && typeof raw.cooldowns === "object" && !Array.isArray(raw.cooldowns)
        ? Object.fromEntries(Object.entries(raw.cooldowns).filter(([, v]) => Number.isInteger(v)))
        : {},
    lastProcessedMonth: Number.isInteger(raw.lastProcessedMonth) ? raw.lastProcessedMonth : null,
  };
  return state.wealth;
}

/**
 * Zorunlu aylık giderler nakdi sonsuza dek eksiye sürüklemez. Tabanın altındaki
 * açık, mevcut finans/borç yüzeyinde sınırlı temerrüt borcuna dönüşür. Gelirle
 * yeniden artıya çıkan oyuncu borcu kademeli öder; bu yüzden yardım bedava
 * servet değildir fakat tek kötü ay da keyfi game-over üretmez.
 */
export function processCashShortfall(state) {
  if (!state?.finances || state.lifetime?.death) return null;
  const finances = state.finances;
  finances.arrears = Number.isFinite(finances.arrears)
    ? Math.max(0, Math.min(CASH_ARREARS_CAP, Math.round(finances.arrears)))
    : 0;
  finances.distressMonths = Number.isInteger(finances.distressMonths)
    ? Math.max(0, Math.min(999, finances.distressMonths))
    : 0;
  if (finances.balance < CASH_FLOOR) {
    const shortfall = Math.round(CASH_FLOOR - finances.balance);
    const room = Math.max(0, CASH_ARREARS_CAP - finances.arrears);
    const converted = Math.min(room, shortfall);
    finances.arrears += converted;
    finances.distressMonths = Math.min(999, finances.distressMonths + 1);
    // Credit only the amount actually recorded as debt; overflow remains owed in cash.
    if (converted) ledger(state, converted, "Nakit açığı temerrüt borcuna aktarıldı", "debt");
    recordBankMonth(state, "default");
    if (finances.arrears >= CASH_ARREARS_CAP) {
      state.wealth.lifestyle = "modest";
      state.wealth.subscriptions = [];
      state.flags.cashDefaultPressure = true;
    }
    return { kind: "arrears", amount: converted, arrears: finances.arrears };
  }
  // An active enforcement claim owns its source arrears. Collect only other
  // arrears here, otherwise this path and the icra installment charge twice.
  const claim = (state.openCases || []).find((item) =>
    item.type === "icra" && item.status === "pending" && item.payload?.source === "temerrut");
  const reserved = claim ? Math.max(0, Math.round(Number(
    claim.payload.sourceArrears ?? claim.payload.owed ?? claim.payload.amount,
  ) || 0)) : 0;
  const collectible = Math.max(0, finances.arrears - reserved);
  if (collectible > 0 && finances.balance > 0) {
    const payment = Math.min(
      collectible,
      finances.balance,
      Math.max(500, Math.min(3000, Math.round(finances.balance * 0.2))),
    );
    if (payment > 0) {
      ledger(state, -payment, "Temerrüt borcu geri ödemesi", "debt");
      finances.arrears -= payment;
      if (finances.arrears === 0) {
        finances.distressMonths = 0;
        delete state.flags.cashDefaultPressure;
      }
      return { kind: "recovery", amount: payment, arrears: finances.arrears };
    }
  }
  return null;
}
export function validateWealth(state) {
  const w = state.wealth;
  if (!w) return true;
  if (
    !TIERS[w.lifestyle] ||
    w.subscriptions.length > 8 ||
    w.durables.length > 10 ||
    w.properties.length > 3 ||
    w.debts.length > 4 ||
    w.investments.length > WEALTH_LIMITS.investments
  )
    return false;
  if (
    new Set(w.subscriptions.map((x) => x.id)).size !== w.subscriptions.length ||
    new Set(w.durables.map((x) => x.id)).size !== w.durables.length ||
    new Set(w.properties.map((x) => x.id)).size !== w.properties.length ||
    new Set(w.debts.map((x) => x.id)).size !== w.debts.length ||
    new Set(w.investments.map((x) => x.id)).size !== w.investments.length
  )
    return false;
  if (
    w.investments.some((x) => !INVESTMENTS[x.id] || x.value < 0 || x.basis < 0) ||
    w.debts.some((x) => x.principal < 0 || !validMortgage(x)) ||
    w.properties.some((x) => !["owner", "rental", "vacant"].includes(x.occupancy))
  )
    return false;
  return !w.vehicle || Boolean(VEHICLES[w.vehicle.tier]);
}
function ledger(state, amount, reason, category = "wealth") {
  amount = Math.round(amount);
  recordMonthlyCash(state, amount, reason, category);
  state.finances.balance += amount;
  state.finances.ledger.push({ week: state.time.absoluteWeek, amount, reason, category });
  if (state.finances.ledger.length > 120)
    state.finances.ledger.splice(0, state.finances.ledger.length - 120);
}
function weekly(state, id) {
  const capacity = wealthWeeklyCapacity(state);
  if (state.lifetime?.death) return "Bu yaşam tamamlandı.";
  if (state.events.active) return "Önce açık olayı sonuçlandır.";
  if (state.weekly.used >= capacity) return "Bu haftanın zaman ve odak bütçesi doldu.";
  if (state.weekly.selectedIds.includes(id)) return "Bu hafta zaten yapıldı.";
  return null;
}
function wealthWeeklyCapacity(state) {
  if (state.health?.health <= 15) return 3;
  const hasCommitment = Boolean(state.career?.jobId || state.education?.active ||
    state.parenthood?.children?.some((child) => state.time.absoluteWeek - child.bornWeek < 18 * 48));
  return hasCommitment ? 7 : 8;
}
function mark(state, id, cost = 1) {
  state.weekly.used += cost;
  state.weekly.selectedIds.push(id);
}
export function setLifestyle(state, id) {
  normalizeWealth(state);
  if (!TIERS[id]) return { ok: false, reason: "Bu hayat düzeni yok." };
  if (state.wealth.lifestyle === id) return { ok: false, reason: "Bu düzende yaşıyorsun." };
  if (
    TIERS[id].monthly > TIERS[state.wealth.lifestyle].monthly &&
    state.wealth.lifestyleChangedWeek &&
    state.time.absoluteWeek - state.wealth.lifestyleChangedWeek < 12
  )
    return { ok: false, reason: "Yaşam düzenini yeniden yükseltmek için 12 hafta beklemelisin." };
  const increase = Math.max(0, TIERS[id].monthly - TIERS[state.wealth.lifestyle].monthly);
  if (state.finances.balance < increase)
    return { ok: false, reason: "Yeni yaşam düzenine geçiş için yeterli paran yok." };
  if (increase) ledger(state, -increase, "Hayat düzeni değişti", "lifestyle");
  state.wealth.lifestyle = id;
  state.wealth.lifestyleChangedWeek = state.time.absoluteWeek;
  return { ok: true, message: `Hayat düzenin: ${TIERS[id].label}.` };
}
export function spendLifestyle(state, id) {
  normalizeWealth(state);
  const x = MARKET[id] || SPENDING[id];
  if (!x) return { ok: false, reason: "Harcama geçersiz." };
  if (!marketAvailableInYear(state, x)) return { ok: false, reason: marketUnavailableReason(state, x) };
  const action = `wealth-spend:${id}`,
    blocked = weekly(state, action);
  if (blocked) return { ok: false, reason: blocked };
  const time = x.time || 1;
  if (state.weekly.used + time > wealthWeeklyCapacity(state))
    return { ok: false, reason: "Bu hafta buna vaktin yok." };
  if (state.finances.balance < x.cost) return { ok: false, reason: "Yeterli paran yok." };
  const last = state.wealth.cooldowns[id] || 0;
  if (last && state.time.absoluteWeek - last < 4)
    return { ok: false, reason: "Bunu yeniden yapmak için biraz bekle." };
  const preview = marketPreview(state, id);
  const prior = preview.durable && state.wealth.durables.find(d => d.id === preview.durable);
  const phoneUpgrade = id === "new_phone" && prior?.id === "phone" && prior.price <= 9000;
  if (prior && !phoneUpgrade) return { ok: false, reason: tr("Bu eşya zaten sende; ikinci bir fayda birikmez.", "You already own this item; benefits do not stack.") };
  if (preview.durable && !prior && state.wealth.durables.length >= WEALTH_LIMITS.durables) return { ok: false, reason: tr("Eşya sınırına ulaştın.", "Owned item limit reached.") };
  const before = { cash: state.finances.balance, ...state.health };
  ledger(state, -x.cost, x.label, "market");
  state.health.energy = clamp(state.health.energy + preview.energy, 0, 100);
  state.health.stress = clamp(state.health.stress + preview.stress, 0, 100);
  state.health.health = clamp(state.health.health + preview.health, 0, 100);
  if (preview.durable) {
    if (phoneUpgrade) state.wealth.durables = state.wealth.durables.filter((item) => item !== prior);
    state.wealth.durables.push({ id: preview.durable, price: x.cost, acquiredWeek: state.time.absoluteWeek });
  }
  if (x.risk === "alcohol") {
    state.flags.alcoholWeeks = (state.flags.alcoholWeeks || 0) + 1;
  }
  if (x.risk === "illegal") {
    state.flags.illegalRisk = Math.min(100, (state.flags.illegalRisk || 0) + 8);
    state.flags.lastIllegalWeek = state.time.absoluteWeek;
  }
  let payout = null;
  if (x.risk === "gambling") {
    let seed = state.meta.rngState >>> 0 || 1;
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    state.meta.rngState = seed >>> 0 || 1;
    const roll = state.meta.rngState / 4294967296;
    const multiplier = roll < 0.70 ? 0.5 : roll < 0.82 ? 0 : roll < 0.93 ? 2 : roll < 0.98 ? 3 : 5;
    payout = Math.round(x.cost * multiplier);
    if (payout) ledger(state, payout, tr("Bahis geri dönüşü", "Gambling payout"), "market");
    state.flags.gamblingWeeks = (state.flags.gamblingWeeks || 0) + 1;
    state.health.stress = clamp(state.health.stress + Math.min(6, Math.floor(state.flags.gamblingWeeks / 3)), 0, 100);
  }
  if (x.risk === "sexwork") {
    state.flags.paidEncounterWeek = state.time.absoluteWeek;
    if (state.social?.currentPartnerNpcId) state.flags.infidelityRisk = true;
  }
  if (id === "partner_gift" && state.social?.currentPartnerNpcId) {
    const pid = state.social.currentPartnerNpcId;
    if (Number.isFinite(state.relationships[pid]))
      state.relationships[pid] = Math.min(100, state.relationships[pid] + 4);
  }
  if (id === "family_gift") {
    for (const pid of ["anne", "baba"])
      if (Number.isFinite(state.relationships[pid]))
        state.relationships[pid] = Math.min(100, state.relationships[pid] + 3);
  }
  if (["gift", "friend_gift"].includes(id) && Number.isFinite(state.relationships.mehmet)) state.relationships.mehmet = Math.min(100, state.relationships.mehmet + 3);
  state.wealth.cooldowns[id] = state.time.absoluteWeek;
  mark(state, action, time);
  const effects = { cash: state.finances.balance - before.cash, energy: state.health.energy - before.energy, stress: state.health.stress - before.stress, health: state.health.health - before.health };
  const stakeNote = payout === null ? "" : payout <= 0 ? "Hepsi gitti. " : payout < x.cost ? "Az kaybettin. " : payout >= x.cost * 3 ? "Nadiren böyle gelir. " : "Bu sefer tuttu. ";
  return { ok: true, effects, payout, message: `${x.label}. ${stakeNote}${payout !== null ? `${tr("Bahis", "Stake")}: ${tl(x.cost)} · ${tr("Geri dönüş", "Payout")}: ${tl(payout)} · ` : ""}${tr("Net", "Net")}: ${tl(effects.cash)} · ${tr("Enerji", "Energy")} ${effects.energy} · ${tr("Stres", "Stress")} ${effects.stress} · ${tr("Sağlık", "Health")} ${effects.health}${preview.durable ? ` · ${tr("Artık sende", "Now owned")}: ${durableBenefit(preview.durable)}` : ""}` };
}
export function toggleSubscription(state, id) {
  normalizeWealth(state);
  const x = SUBSCRIPTIONS[id];
  if (!x) return { ok: false, reason: "Abonelik geçersiz." };
  if (!marketAvailableInYear(state, x)) return { ok: false, reason: marketUnavailableReason(state, x) };
  const i = state.wealth.subscriptions.findIndex((s) => s.id === id);
  if (i >= 0) {
    state.wealth.subscriptions.splice(i, 1);
    return { ok: true, message: `${x.label} aboneliği kapatıldı.` };
  }
  if (state.wealth.subscriptions.length >= 8)
    return { ok: false, reason: "Abonelik sınırına ulaştın." };
  if (state.finances.balance < x.monthly)
    return { ok: false, reason: "İlk dönem ücreti için yeterli paran yok." };
  const month = Math.floor((state.time.absoluteWeek - 1) / 4);
  ledger(state, -x.monthly, `${x.label} ilk dönem aboneliği`, "subscription");
  state.wealth.subscriptions.push({
    id,
    startedWeek: state.time.absoluteWeek,
    lastBilledMonth: month,
  });
  return { ok: true, message: `${x.label} aboneliği başladı; ilk dönem ücreti işlendi.` };
}
export function buyDurable(state, id) {
  normalizeWealth(state);
  const x = DURABLES[id],
    action = `wealth-durable:${id}`;
  if (!x) return { ok: false, reason: "Ürün geçersiz." };
  const blocked = weekly(state, action);
  if (blocked) return { ok: false, reason: blocked };
  if (state.finances.balance < x.price) return { ok: false, reason: "Yeterli paran yok." };
  const old = state.wealth.durables.find((d) => d.id === id);
  if (old) return { ok: false, reason: tr("Bu eşya zaten sende.", "You already own this item.") };
  else if (state.wealth.durables.length >= 10)
    return { ok: false, reason: "Dayanıklı eşya sınırına ulaştın." };
  ledger(state, -x.price, x.label, "asset");
  state.wealth.durables = state.wealth.durables.filter((d) => d.id !== id);
  state.wealth.durables.push({ id, price: x.price, acquiredWeek: state.time.absoluteWeek });
  mark(state, action);
  return { ok: true, message: `${x.label} · −${tl(x.price)} · ${durableBenefit(id)}` };
}
export function tradeInvestment(state, id, amount) {
  normalizeWealth(state);
  const x = INVESTMENTS[id];
  amount = Math.round(amount);
  if (!x || !Number.isFinite(amount) || amount === 0)
    return { ok: false, reason: "Yatırım işlemi geçersiz." };
  const key = `investment:${state.time.absoluteWeek}:${id}`;
  if (state.wealth.cooldowns[key])
    return { ok: false, reason: "Aynı yatırım sınıfında haftada bir işlem yapabilirsin." };
  const pos = state.wealth.investments.find((p) => p.id === id);
  if (amount > 0) {
    const cost = Math.ceil(amount * 1.01);
    if (state.finances.balance < cost) return { ok: false, reason: "Yeterli paran yok." };
    if (!pos && state.wealth.investments.length >= WEALTH_LIMITS.investments)
      return { ok: false, reason: "Yatırım sınıfı sınırına ulaştın." };
    ledger(state, -cost, `${x.label} alımı ve işlem farkı`, "investment");
    if (pos) {
      pos.value += amount;
      pos.basis += cost;
    } else state.wealth.investments.push({ id, value: amount, basis: cost, lastMonth: null });
  } else {
    if (!pos || pos.value < Math.abs(amount)) return { ok: false, reason: "Satılacak tutar yok." };
    const sold = Math.abs(amount), basisSold = sold === pos.value ? pos.basis : Math.round(pos.basis * sold / pos.value);
    const proceeds = Math.floor(sold * 0.99), realized = proceeds - basisSold;
    const message = `${x.label} · ${tr("Net satış", "Net proceeds")} ${tl(proceeds)} · ${tr("İşlem farkı", "Fee")} ${tl(sold - proceeds)} · ${tr("Satılan maliyet", "Allocated basis")} ${tl(basisSold)} · ${tr("Gerçekleşmiş kâr/zarar", "Realized P/L")} ${tl(realized)}`;
    ledger(state, proceeds, message, "investment");
    pos.value -= Math.abs(amount);
    pos.basis = Math.max(0, pos.basis - basisSold);
    if (!pos.value) state.wealth.investments = state.wealth.investments.filter((p) => p !== pos);
    state.wealth.cooldowns[key] = 1;
    return { ok: true, message, proceeds, basisSold, realized };
  }
  state.wealth.cooldowns[key] = 1;
  return { ok: true, message: `${x.label} işlemi tamamlandı.` };
}
export function sellDurable(state, id) {
  normalizeWealth(state);
  const owned=state.wealth.durables.find(d=>d.id===id), action=`wealth-durable:${id}`;
  const blocked=weekly(state,action);
  if(blocked)return {ok:false,reason:blocked};
  if(!owned)return {ok:false,reason:tr("Satılacak eşya yok.","No owned item to sell.")};
  const proceeds=Math.round(owned.price*DURABLES[id].resale);
  ledger(state,proceeds,`${DURABLES[id].label} · ${tr("ikinci el satışı", "resale")}`,"asset");
  state.wealth.durables=state.wealth.durables.filter(d=>d.id!==id);mark(state,action);
  return {ok:true,message:`${tr("Net satış", "Net proceeds")}: ${tl(proceeds)} · ${tr("Kalıcı fayda sona erdi.", "Ownership benefit ended.")}`};
}
export function buyVehicle(state, tier, financed = false) {
  normalizeWealth(state);
  const x = VEHICLES[tier],
    blocked = weekly(state, "wealth-vehicle");
  if (!x) return { ok: false, reason: "Araç geçersiz." };
  if (financed && state.wealth.debts.length >= WEALTH_LIMITS.debts)
    return { ok: false, reason: "Yeni borç için kayıt sınırına ulaştın." };
  if (blocked) return { ok: false, reason: blocked };
  if (state.wealth.vehicle) return { ok: false, reason: "Önce mevcut aracı satmalısın." };
  const down = financed ? Math.ceil(x.price * 0.35) : x.price;
  if (state.finances.balance < down)
    return { ok: false, reason: "Peşinat için yeterli paran yok." };
  ledger(state, -down, `${x.label} alımı`, "vehicle");
  const id = `vehicle-${state.time.absoluteWeek}`;
  state.wealth.vehicle = {
    tier,
    purchasePrice: x.price,
    currentValue: Math.round(x.price * x.resale),
    acquiredWeek: state.time.absoluteWeek,
    loanId: financed ? `${id}-loan` : null,
  };
  if (financed)
    state.wealth.debts.push({
      id: `${id}-loan`,
      type: "vehicle",
      principal: x.price - down,
      monthlyPayment: Math.ceil((x.price - down) / 36),
      linkedAssetId: id,
      startWeek: state.time.absoluteWeek,
    });
  mark(state, "wealth-vehicle");
  return { ok: true, message: `${x.label} alındı.` };
}
export function sellVehicle(state) {
  normalizeWealth(state);
  if (!state.wealth.vehicle) return { ok: false, reason: "Satılacak araç yok." };
  const v = state.wealth.vehicle,
    debt = state.wealth.debts.find((d) => d.id === v.loanId),
    net = v.currentValue - (debt?.principal || 0);
  if (net < 0 && state.finances.balance < Math.abs(net))
    return { ok: false, reason: "Satışın borcu kapatması için nakit farkını karşılayamıyorsun." };
  ledger(state, net, "Araç satışı ve borç kapama", "vehicle");
  if (debt) state.wealth.debts = state.wealth.debts.filter((d) => d !== debt);
  state.wealth.vehicle = null;
  return { ok: true, message: "Araç satıldı; bağlı borç kapatıldı." };
}
function mortgageEligibility(state, kind) {
  const policy = bankCreditPolicy(state, "mortgage", mortgageLanguage());
  if (!policy.ok) return policy;
  const price = kind === "owner" ? 480000 : 420000;
  const principal = price - Math.ceil(price * MORTGAGE_TERMS.downPercent / 100);
  const installment = amortizedPayment(principal, MORTGAGE_TERMS.rateBps, MORTGAGE_TERMS.months);
  const summary = getMonthlySummary(state);
  // Disclosed game affordability rule, not a real lender's underwriting ratio.
  return summary.income > 0 && summary.wealth.debt + installment <= summary.income * 0.5
    ? {ok:true} : {ok:false,reason:mortgageText("affordability", mortgageLanguage())};
}
export function buyProperty(state, kind = "owner", mortgage = false) {
  normalizeWealth(state);
  if (!["owner", "rental"].includes(kind))
    return { ok: false, reason: "Konut kullanımı geçersiz." };
  if (mortgage) { const policy = mortgageEligibility(state, kind); if (!policy.ok) return policy; }
  if (mortgage && state.wealth.debts.length >= WEALTH_LIMITS.debts)
    return { ok: false, reason: "Yeni borç için kayıt sınırına ulaştın." };
  if (
    state.wealth.properties.some((p) => p.occupancy === kind) ||
    state.wealth.properties.length >= 3
  )
    return { ok: false, reason: "Bu konut türü zaten var veya mülk sınırına ulaştın." };
  const price = kind === "owner" ? 480000 : 420000,
    down = mortgage ? Math.ceil(price * 0.3) : price;
  if (state.finances.balance < down)
    return { ok: false, reason: "Peşinat için yeterli paran yok." };
  const blocked = weekly(state, "wealth-property");
  if (blocked) return { ok: false, reason: blocked };
  const id = `property-${state.time.absoluteWeek}-${kind}`,
    loanId = mortgage ? `${id}-mortgage` : null;
  ledger(state, -down, kind === "owner" ? "Ev alımı" : "Kiralık ev alımı", "property");
  state.wealth.properties.push({
    id,
    homeId: "apartment",
    occupancy: kind,
    purchasePrice: price,
    currentValue: price,
    monthlyRent: kind === "rental" ? 4200 : 0,
    maintenance: kind === "owner" ? 1000 : 850,
    mortgageId: loanId,
    acquiredWeek: state.time.absoluteWeek,
  });
  if (loanId)
    state.wealth.debts.push({
      id: loanId,
      type: "mortgage",
      principal: price - down,
      monthlyPayment: amortizedPayment(price - down, MORTGAGE_TERMS.rateBps, MORTGAGE_TERMS.months),
      mortgage: newMortgage(price - down),
      linkedAssetId: id,
      startWeek: state.time.absoluteWeek,
    });
  mark(state, "wealth-property");
  return { ok: true, message: kind === "owner" ? "Evi aldın." : "Kiraya vereceğin evi aldın." };
}
const mortgageLanguage = () => typeof window !== "undefined" ? window.tlabI18n?.getLang?.() || "tr" : "tr";
export function manageMortgage(state, id, action) {
  const check = getWealthActionAvailability(state, action, id);
  if (!check.ok) return check;
  const debt = state.wealth.debts.find(d => d.id === id);
  if (action === "mortgage-restructure") restructureMortgage(debt);
  else {
    const due = action === "mortgage-close" ? debtBalance(debt) : Math.min(5000, debtBalance(debt));
    const paid = settleMortgagePayment(debt, due);
    ledger(state, -paid, mortgageText("paid", mortgageLanguage()), "debt");
    if (!debtBalance(debt)) state.wealth.debts = state.wealth.debts.filter(d => d !== debt);
  }
  reconcileMortgageClaims(state, action === "mortgage-restructure" ? id : null);
  mark(state, `mortgage:${id}`);
  return { ok: true, message: mortgageText(action === "mortgage-restructure" ? "changed" : "paid", mortgageLanguage()) };
}

export function sellProperty(state, id) {
  normalizeWealth(state);
  const p = state.wealth.properties.find((x) => x.id === id);
  if (!p) return { ok: false, reason: "Mülk bulunamadı." };
  const debt = state.wealth.debts.find((d) => d.id === p.mortgageId),
    net = p.currentValue - (debt ? debtBalance(debt) : 0);
  if (net < 0 && state.finances.balance < Math.abs(net))
    return {
      ok: false,
      reason: "Satışın konut borcunu kapatması için nakit farkını karşılayamıyorsun.",
    };
  ledger(state, net, "Mülk satışı ve borç kapama", "property");
  state.wealth.properties = state.wealth.properties.filter((x) => x !== p);
  if (debt) state.wealth.debts = state.wealth.debts.filter((d) => d !== debt);
  reconcileMortgageClaims(state);
  return { ok: true, message: "Mülk satıldı; bağlı borç kapatıldı." };
}
export function setPropertyOccupancy(state, id, occupancy) {
  normalizeWealth(state);
  if (!["rental", "vacant"].includes(occupancy))
    return { ok: false, reason: "Kullanım durumu geçersiz." };
  const p = state.wealth.properties.find((item) => item.id === id && item.occupancy !== "owner");
  if (!p) return { ok: false, reason: "Bu mülkün kullanım durumu değiştirilemez." };
  if (p.occupancy === occupancy) return { ok: false, reason: "Mülk zaten bu durumda." };
  const action = `property-occupancy:${id}`,
    blocked = weekly(state, action);
  if (blocked) return { ok: false, reason: blocked };
  p.occupancy = occupancy;
  mark(state, action);
  return {
    ok: true,
    message:
      occupancy === "rental"
        ? "Mülk kiraya ayrıldı; gelir sonraki ay kapanışında işler."
        : "Mülk boş bırakıldı; kira geliri durdu.",
  };
}
export function getWealthMonthlySummary(state) {
  const w = normalizeWealth(state),
    rental = w.properties
      .filter((p) => p.occupancy === "rental")
      .reduce((n, p) => n + p.monthlyRent, 0),
    maintenance = w.properties.reduce((n, p) => n + p.maintenance, 0) + w.durables.reduce((n,d)=>n+(d.id==="bike"?30:d.id==="scooter"?250:0),0),
    subscriptions = w.subscriptions.reduce((n, s) => n + SUBSCRIPTIONS[s.id].monthly, 0),
    vehicle = vehicleOperatingCosts(state).budget,
    debt = w.debts.reduce((n, d) => n + mortgageDue(d), 0);
  const income = Math.round(rental);
  const expenses = Math.round(TIERS[w.lifestyle].monthly + maintenance + subscriptions + vehicle + debt);
  return {
    income,
    expenses,
    lifestyle: TIERS[w.lifestyle].monthly,
    subscriptions,
    vehicle,
    vehicleFixed: vehicleOperatingCosts(state).fixed,
    vehicleInsurance: vehicleOperatingCosts(state).insurance,
    vehicleUpkeep: vehicleOperatingCosts(state).upkeep,
    maintenance,
    debt,
    rental,
  };
}
export function processWealthMonthEnd(state) {
  normalizeWealth(state);
  const month = Math.floor((state.time.absoluteWeek - 1) / 4);
  if (state.wealth.lastProcessedMonth === month) return false;
  const s = getWealthMonthlySummary(state),
    w = state.wealth;
  const subscriptionDue = w.subscriptions
    .filter((item) => item.lastBilledMonth !== month)
    .reduce((sum, item) => sum + SUBSCRIPTIONS[item.id].monthly, 0);
  if (s.rental) ledger(state, s.rental, "Kira geliri", "property");
  if (s.vehicleInsurance) ledger(state, -s.vehicleInsurance, vehicleExpenseLabel("insurance"), "vehicle-insurance");
  for (const [amount, label] of [
    [s.lifestyle, "Hayat düzeni"],
    [subscriptionDue, "Abonelikler"],
    [s.vehicleUpkeep, vehicleExpenseLabel("fixed")],
    [s.maintenance, tr("Varlık bakımı", "Asset upkeep")],
  ])
    if (amount) ledger(state, -amount, label, "lifestyle");
  for (const item of w.subscriptions) item.lastBilledMonth = month;
  for (const d of [...w.debts]) {
    if (isAmortizingMortgage(d)) {
      const result = settleMortgageMonth(d, Math.max(0, state.finances.balance), month);
      if (result) {
        if (result.payment) ledger(state, -result.payment, mortgageText("paid", mortgageLanguage()), "debt");
        recordBankMonth(state, result.missed ? mortgageStatus(d) === "default" ? "default" : "missed" : "paid");
      }
      if (!debtBalance(d)) w.debts = w.debts.filter(x => x !== d);
      continue;
    }
    const pay = Math.min(d.principal, d.monthlyPayment);
    if (pay) {
      recordBankMonth(state, state.finances.balance >= pay ? "paid" : "missed");
      ledger(state, -pay, `${d.type === "mortgage" ? "Ev" : d.type === "vehicle" ? "Araç" : "Banka kredisi"} borcu ödemesi`, "debt");
      d.principal -= pay;
    }
    if (!d.principal) {
      if (d.type === "personal") recordBankLoan(state, "closed");
      w.debts = w.debts.filter((x) => x !== d);
    }
  }
  reconcileMortgageClaims(state);
  let valuation = 0;
  for (const p of w.investments) {
    if (p.lastMonth === month) continue;
    const rates = INVESTMENTS[p.id].monthlyRates;
    const rate = rates[month % rates.length];
    const before = p.value;
    p.value = Math.max(0, Math.round(p.value * (1 + rate)));
    p.lastMonth = month;
    valuation += p.value - before;
    ledger(state, 0, `${INVESTMENTS[p.id].label} · ${tr("Gerçekleşmemiş aylık değer değişimi (nakit değil)", "Unrealized monthly value change (not cash)")}: ${tl(p.value - before)}`, "valuation");
  }
  if (w.investments.length) ledger(state, 0, `${tr("Yatırım raporu — toplam gerçekleşmemiş aylık değişim (nakit değil)", "Investment report — total unrealized monthly change (not cash)")}: ${tl(valuation)}`, "valuation");
  for (const p of w.properties)
    p.currentValue = Math.round(p.currentValue * (1 + (month % 6 === 0 ? 0.004 : 0.001)));
  if (w.vehicle) w.vehicle.currentValue = Math.max(0, Math.round(w.vehicle.currentValue * 0.994));
  w.lastProcessedMonth = month;
  return true;
}
export function netWorth(state) {
  // Reuse the semt registry's validation/deduplication without mutating the
  // live household. Rented homes are not assets; debts remain in wealth.debts.
  const semt = normalizeSemt({ household: { semt: state.household?.semt }, time: state.time });
  const w = normalizeWealth(state),
    cash = Math.round(state.finances.balance),
    investments = w.investments.reduce((n, p) => n + p.value, 0) + exchangePortfolio(state).reduce((n,p)=>n+p.value,0),
    property = w.properties.reduce((n, p) => n + p.currentValue, 0) + semt.holdings
      .filter(p => p.mode === "owned" && !w.properties.some(asset => asset.id === p.id))
      .reduce((n, p) => n + integer(p.value), 0),
    vehicle = w.vehicle ? w.vehicle.currentValue : 0,
    durables = w.durables.reduce((n, d) => n + Math.round(d.price * DURABLES[d.id].resale), 0),
    debt = w.debts.reduce((n, d) => n + debtBalance(d), 0) + Math.max(0, Number(state.finances?.arrears) || 0);
  return {
    cash,
    investments,
    property,
    vehicle,
    durables,
    debt,
    business: Math.round((state.flags?.business?.invested || 0)*.25) - (state.flags?.business?.debt || 0),
    total: cash + investments + property + vehicle + durables - debt + Math.round((state.flags?.business?.invested || 0)*.25) - (state.flags?.business?.debt || 0),
  };
}

/** Player-facing controls read the same gates before attempting a mutation. */
export function getWealthActionAvailability(state, action, value) {
  normalizeWealth(state);
  const w = state.wealth;
  const weekBlocked = (id, time = 1) => weekly(state, id) || (state.weekly.used + time > wealthWeeklyCapacity(state) ? "Bu işlem için haftanın kalan zamanı yetmiyor." : null);
  if (action === "lifestyle") {
    if (!TIERS[value]) return { ok: false, reason: "Bu hayat düzeni yok." };
    if (w.lifestyle === value) return { ok: false, reason: "Bu düzende yaşıyorsun." };
    const increase = Math.max(0, TIERS[value].monthly - TIERS[w.lifestyle].monthly);
    if (increase && w.lifestyleChangedWeek && state.time.absoluteWeek - w.lifestyleChangedWeek < 12)
      return { ok: false, reason: "Yaşam düzenini yeniden yükseltmek için 12 hafta beklemelisin." };
    return state.finances.balance < increase ? { ok: false, reason: `Geçiş için ₺${increase.toLocaleString("tr-TR")} gerekiyor.` } : { ok: true };
  }
  if (action === "spend") {
    const item = MARKET[value] || SPENDING[value]; if (!item) return { ok: false, reason: "Harcama geçersiz." };
    if (!marketAvailableInYear(state, item)) return { ok: false, reason: marketUnavailableReason(state, item) };
    const durable = MARKET_OWNERSHIP[value];
    const prior = durable && w.durables.find(d => d.id === durable);
    const phoneUpgrade = value === "new_phone" && prior?.id === "phone" && prior.price <= 9000;
    if (prior && !phoneUpgrade) return { ok: false, reason: tr("Bu eşya zaten sende.", "You already own this item.") };
    if (durable && !prior && w.durables.length >= WEALTH_LIMITS.durables) return { ok: false, reason: tr("Eşya sınırına ulaştın.", "Owned item limit reached.") };
    const blocked = weekBlocked(`wealth-spend:${value}`, item.time || 1); if (blocked) return { ok: false, reason: blocked };
    const last = w.cooldowns[value] || 0; if (last && state.time.absoluteWeek - last < 4) return { ok: false, reason: "Bunu yeniden yapmak için biraz bekle." };
    return state.finances.balance < item.cost ? { ok: false, reason: `Bu işlem için ₺${item.cost.toLocaleString("tr-TR")} gerekiyor.` } : { ok: true };
  }
  if (action === "subscription") {
    const item = SUBSCRIPTIONS[value]; if (!item) return { ok: false, reason: "Abonelik geçersiz." };
    if (!marketAvailableInYear(state, item)) return { ok: false, reason: marketUnavailableReason(state, item) };
    if (w.subscriptions.some(entry => entry.id === value)) return { ok: true };
    if (w.subscriptions.length >= WEALTH_LIMITS.subscriptions) return { ok: false, reason: "Abonelik sınırına ulaştın." };
    return state.finances.balance < item.monthly ? { ok: false, reason: `İlk dönem için ₺${item.monthly.toLocaleString("tr-TR")} gerekiyor.` } : { ok: true };
  }
  if (action === "durable") {
    const item = DURABLES[value]; if (!item) return { ok: false, reason: "Ürün geçersiz." };
    if (w.durables.some(d => d.id === value)) return { ok: false, reason: tr("Bu eşya zaten sende.", "You already own this item.") };
    if(w.durables.length>=WEALTH_LIMITS.durables)return {ok:false,reason:tr("Eşya sınırına ulaştın.","Owned item limit reached.")};
    const blocked = weekBlocked(`wealth-durable:${value}`); if (blocked) return { ok: false, reason: blocked };
    return state.finances.balance < item.price ? { ok: false, reason: `Bu ürün için ₺${item.price.toLocaleString("tr-TR")} gerekiyor.` } : { ok: true };
  }
  if (action === "sell-durable") return w.durables.some(d=>d.id===value) ? (weekBlocked(`wealth-durable:${value}`) ? {ok:false,reason:weekBlocked(`wealth-durable:${value}`)} : {ok:true}) : {ok:false,reason:tr("Satılacak eşya yok.","No owned item to sell.")};
  if (action === "invest-buy" || action === "invest-sell" || action === "invest-sell-all") {
    const position = w.investments.find(item => item.id === value); if (!INVESTMENTS[value]) return { ok: false, reason: "Yatırım sınıfı geçersiz." };
    if (w.cooldowns[`investment:${state.time.absoluteWeek}:${value}`]) return { ok: false, reason: "Aynı yatırım sınıfında haftada bir işlem yapabilirsin." };
    if (action === "invest-buy") return state.finances.balance < 5050 ? { ok: false, reason: "Alım ve işlem farkı için ₺5.050 gerekiyor." } : { ok: true };
    if(action==="invest-sell-all")return (position?.value||0)>0 ? {ok:true} : {ok:false,reason:tr("Satılacak yatırım yok.","No investment to sell.")};
    return (position?.value || 0) < 5000 ? { ok: false, reason: "Satılabilir değer ₺5.000 altında." } : { ok: true };
  }
  if (action.startsWith("vehicle-")) {
    if (action === "vehicle-sell") return w.vehicle ? { ok: true } : { ok: false, reason: "Satılacak araç yok." };
    const item = VEHICLES[value]; if (!item) return { ok: false, reason: "Araç geçersiz." };
    if (w.vehicle) return { ok: false, reason: "Önce mevcut aracı satmalısın." };
    const blocked = weekBlocked("wealth-vehicle"); if (blocked) return { ok: false, reason: blocked };
    const financed = action === "vehicle-finance"; if (financed && w.debts.length >= WEALTH_LIMITS.debts) return { ok: false, reason: "Yeni borç için kayıt sınırına ulaştın." };
    const due = financed ? Math.ceil(item.price * .35) : item.price;
    return state.finances.balance < due ? { ok: false, reason: `Bu alım için ₺${due.toLocaleString("tr-TR")} gerekiyor.` } : { ok: true };
  }
  if (["mortgage-extra", "mortgage-close", "mortgage-restructure"].includes(action)) {
    const debt = w.debts.find(d => d.id === value && isAmortizingMortgage(d));
    if (!debt || action === "mortgage-restructure" && (!debt.mortgage.overdue || debt.mortgage.restructures))
      return { ok: false, reason: mortgageText("unavailable", mortgageLanguage()) };
    const blocked = weekBlocked(`mortgage:${value}`);
    if (blocked) return { ok: false, reason: blocked };
    const due = action === "mortgage-close" ? debtBalance(debt) : action === "mortgage-extra" ? Math.min(5000, debtBalance(debt)) : 0;
    return due > 0 && state.finances.balance < due ? { ok: false, reason: mortgageText("cash", mortgageLanguage()) } : { ok: true };
  }
  if (action === "property-sell") return w.properties.some(item => item.id === value) ? { ok: true } : { ok: false, reason: "Mülk bulunamadı." };
  if (action === "property-rent" || action === "property-vacant") {
    const property = w.properties.find(item => item.id === value && item.occupancy !== "owner");
    const occupancy = action === "property-rent" ? "rental" : "vacant";
    if (!property) return { ok: false, reason: "Bu mülkün kullanım durumu değiştirilemez." };
    if (property.occupancy === occupancy) return { ok: false, reason: "Mülk zaten bu durumda." };
    const blocked = weekBlocked(`property-occupancy:${value}`); return blocked ? { ok: false, reason: blocked } : { ok: true };
  }
  if (action === "property-owner" || action === "property-rental") {
    const kind = action === "property-owner" ? "owner" : "rental", financed = value === "mortgage";
    if (w.properties.some(item => item.occupancy === kind) || w.properties.length >= WEALTH_LIMITS.properties) return { ok: false, reason: "Bu konut türü zaten var veya mülk sınırına ulaştın." };
    if (financed) { const policy = mortgageEligibility(state, kind); if (!policy.ok) return policy; }
    if (financed && w.debts.length >= WEALTH_LIMITS.debts) return { ok: false, reason: "Yeni borç için kayıt sınırına ulaştın." };
    const blocked = weekBlocked("wealth-property"); if (blocked) return { ok: false, reason: blocked };
    const price = kind === "owner" ? 480000 : 420000, due = financed ? Math.ceil(price * .3) : price;
    return state.finances.balance < due ? { ok: false, reason: `Bu alım için ₺${due.toLocaleString("tr-TR")} gerekiyor.` } : { ok: true };
  }
  return { ok: false, reason: "İşlem kullanılamıyor." };
}

export function applyWealthAction(state, action, value) {
  const availability = getWealthActionAvailability(state, action, value);
  if (!availability.ok) return availability;
  const operations = {
    "sell-durable":()=>sellDurable(state,value),
    "invest-sell-all":()=>tradeInvestment(state,value,-(state.wealth.investments.find(p=>p.id===value)?.value||0)),
    lifestyle: () => setLifestyle(state, value), spend: () => spendLifestyle(state, value), subscription: () => toggleSubscription(state, value), durable: () => buyDurable(state, value),
    "invest-buy": () => tradeInvestment(state, value, 5000), "invest-sell": () => tradeInvestment(state, value, -5000), "vehicle-cash": () => buyVehicle(state, value, false), "vehicle-finance": () => buyVehicle(state, value, true),
    "mortgage-extra": () => manageMortgage(state, value, "mortgage-extra"), "mortgage-close": () => manageMortgage(state, value, "mortgage-close"), "mortgage-restructure": () => manageMortgage(state, value, "mortgage-restructure"),
    "vehicle-sell": () => sellVehicle(state), "property-owner": () => buyProperty(state, "owner", value === "mortgage"), "property-rental": () => buyProperty(state, "rental", value === "mortgage"),
    "property-sell": () => sellProperty(state, value), "property-rent": () => setPropertyOccupancy(state, value, "rental"), "property-vacant": () => setPropertyOccupancy(state, value, "vacant"),
  };
  return operations[action]?.() || { ok: false, reason: "İşlem kullanılamıyor." };
}
