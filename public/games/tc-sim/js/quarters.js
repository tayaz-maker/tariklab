// Semt emlak + mahalle tezgâhı. Para ekranındaki servet mülkü ve büyük işletme durur.
import { recordIcraPayment } from "./icra.js?v=10";
import { getDistrict } from "./locations.js?v=10";
import { scheduleMoveConsequence } from "./depth3-systems.js?v=10";
import {
  addMemory,
  addNpcMemory,
  adjustHealth,
  getWeeklyActivityLimit,
  transact,
  updateRelationship,
} from "./state.js?v=10";

export const QUARTERS = Object.freeze({
  sirt: {
    id: "sirt",
    name: "Sırt",
    character: "Yokuşta orta katlar, iş aksına yakın. Kahve ve küçük dükkân döner; annenin yolu kısa.",
    districtId: "sisli",
    anneCost: 40,
    anneSlots: 0,
    moveCost: 2800,
    shops: ["cafe", "berber", "kirtasiye"],
  },
  kiyi: {
    id: "kiyi",
    name: "Kıyı",
    character: "İskele ve akşam kalabalığı. Lokanta ve PS daha çok iş yapar; anneye vapur düşer.",
    districtId: "kadikoy",
    anneCost: 160,
    anneSlots: 0,
    moveCost: 2200,
    shops: ["cafe", "lokanta", "ps"],
  },
  ceper: {
    id: "ceper",
    name: "Çeper",
    character: "Sanayi yolu, alçak apartman, ucuz kira. Bakkal ayakta kalır; işe ve anneye yol uzar.",
    districtId: "avcilar",
    anneCost: 280,
    anneSlots: 1,
    moveCost: 1400,
    shops: ["bakkal", "lokanta", "berber", "ps"],
  },
});

export const UNITS = Object.freeze({
  "1+1": {
    sirt: { buy: 285000, rent: 6200, upkeep: 500 },
    kiyi: { buy: 240000, rent: 5200, upkeep: 420 },
    ceper: { buy: 150000, rent: 3300, upkeep: 280 },
  },
  "2+1": {
    sirt: { buy: 460000, rent: 9400, upkeep: 800 },
    kiyi: { buy: 390000, rent: 7900, upkeep: 680 },
    ceper: { buy: 245000, rent: 5000, upkeep: 450 },
  },
  "3+1": {
    sirt: { buy: 700000, rent: 12800, upkeep: 1100 },
    kiyi: { buy: 600000, rent: 10800, upkeep: 920 },
    ceper: { buy: 375000, rent: 6800, upkeep: 620 },
  },
});

export const SHOPS = Object.freeze({
  cafe: { label: "Kahve dükkânı", startup: 28000, weeklyIn: 1800, weeklyOut: 900, neglect: 0.55, since: 1980 },
  lokanta: { label: "Küçük lokanta", startup: 42000, weeklyIn: 2600, weeklyOut: 1400, neglect: 0.5, since: 1980 },
  bakkal: { label: "Bakkal", startup: 24000, weeklyIn: 1500, weeklyOut: 700, neglect: 0.6, since: 1980 },
  berber: { label: "Berber", startup: 16000, weeklyIn: 1100, weeklyOut: 400, neglect: 0.45, since: 1980 },
  kirtasiye: { label: "Kırtasiye", startup: 18000, weeklyIn: 1000, weeklyOut: 450, neglect: 0.5, since: 1980 },
  ps: { label: "PS / internet kafe", startup: 32000, weeklyIn: 2000, weeklyOut: 1100, neglect: 0.4, since: 1996 },
});

export const UNIT_IDS = Object.freeze(["1+1", "2+1", "3+1"]);
export const MAX_HOLDINGS = 4;
export const MAX_SHOPS = 3;
export const KALFA_WAGE = 400;
const RENT_SALT = 11;
const SHOP_SALT = 29;
export { RENT_SALT, SHOP_SALT };

export function emptySemt() {
  return { holdings: [], shop: null, live: null, lastWeek: 0, rentYears: 0 };
}

export function listing(quarterId, unitId) {
  const quarter = QUARTERS[quarterId];
  const row = UNITS[unitId]?.[quarterId];
  if (!quarter || !row) return null;
  return { quarter, unitId, ...row };
}

export const MARCH_STEP = Object.freeze({ sirt: 400, kiyi: 280, ceper: 160 });

export function steppedRent(state, quarterId, unitId) {
  const row = listing(quarterId, unitId);
  if (!row) return 0;
  const years = Math.max(0, Math.round(Number(state?.household?.semt?.rentYears) || 0));
  return row.rent + MARCH_STEP[quarterId] * years;
}

const whole = (value, fallback = 0) => (Number.isFinite(value) ? Math.round(value) : fallback);
const keyOf = (quarterId, unitId) => `${quarterId}:${unitId}`;
const homeForUnit = (unitId) => (unitId === "2+1" ? "shared" : "studio");

export function semtRoll(state, salt) {
  const week = state.time?.absoluteWeek || 1;
  const seed = ((state.meta?.rngState || 1) ^ Math.imul(week, 2246822519) ^ salt) >>> 0;
  return (Math.imul(seed ^ (seed >>> 16), 2246822507) >>> 0) / 4294967296;
}

export function normalizeSemt(state) {
  if (!state?.household) return emptySemt();
  const raw = state.household.semt && typeof state.household.semt === "object" ? state.household.semt : {};
  const holdings = [];
  const seen = new Set();
  for (const item of Array.isArray(raw.holdings) ? raw.holdings : []) {
    const offer = listing(item?.quarterId, item?.unitId);
    if (!offer || seen.has(keyOf(offer.quarter.id, offer.unitId))) continue;
    if (item.mode !== "owned" && item.mode !== "rented") continue;
    if (!["live", "rentout", "empty"].includes(item.occupancy)) continue;
    if (item.mode === "rented" && item.occupancy !== "live") continue;
    seen.add(keyOf(offer.quarter.id, offer.unitId));
    holdings.push({
      id: keyOf(offer.quarter.id, offer.unitId),
      quarterId: offer.quarter.id,
      unitId: offer.unitId,
      mode: item.mode,
      occupancy: item.occupancy,
      price: whole(item.price, offer.buy),
      monthly: whole(item.monthly, item.mode === "owned" ? offer.rent : offer.rent),
      upkeep: whole(item.upkeep, offer.upkeep),
      value: whole(item.value, item.mode === "owned" ? offer.buy : 0),
      renovated: item.renovated === true,
      acquiredWeek: Number.isInteger(item.acquiredWeek) ? item.acquiredWeek : state.time?.absoluteWeek || 1,
    });
    if (holdings.length >= MAX_HOLDINGS) break;
  }
  const liveSeen = new Set();
  const cleaned = [];
  for (const item of holdings) {
    if (item.occupancy !== "live") {
      cleaned.push(item);
      continue;
    }
    if (liveSeen.size) {
      if (item.mode === "owned") {
        item.occupancy = "empty";
        cleaned.push(item);
      }
      continue;
    }
    liveSeen.add(item.id);
    cleaned.push(item);
  }
  const liveHolding = cleaned.find((item) => item.occupancy === "live") || null;
  const quarter = liveHolding ? QUARTERS[liveHolding.quarterId] : null;
  const shopList = [];
  const shopSeen = new Set();
  const incomingShops = Array.isArray(raw.shops) ? raw.shops : raw.shop ? [raw.shop] : [];
  for (const item of incomingShops) {
    const shopType = SHOPS[item?.id];
    const shopQuarter = QUARTERS[item?.quarterId];
    if (!shopType || !shopQuarter || !shopQuarter.shops.includes(item.id)) continue;
    const n = item.n === 2 ? 2 : 1;
    const key = n === 2 ? `${shopQuarter.id}:${item.id}:2` : `${shopQuarter.id}:${item.id}`;
    if (shopSeen.has(key)) continue;
    shopSeen.add(key);
    const row = {
      id: item.id,
      quarterId: shopQuarter.id,
      startup: whole(item.startup, shopType.startup),
      openedWeek: Number.isInteger(item.openedWeek) ? item.openedWeek : state.time?.absoluteWeek || 1,
      attentionWeek: Number.isInteger(item.attentionWeek) ? item.attentionWeek : 0,
    };
    if (n === 2) row.n = 2;
    if (item.kalfa === true) row.kalfa = true;
    shopList.push(row);
    if (shopList.length >= MAX_SHOPS) break;
  }
  const shop = shopList[0] || null;
  state.household.semt = {
    holdings: cleaned,
    shop,
    live: quarter
      ? { holdingId: liveHolding.id, quarterId: quarter.id, anneCost: quarter.anneCost, anneSlots: quarter.anneSlots }
      : null,
    lastWeek: Number.isInteger(raw.lastWeek) ? raw.lastWeek : 0,
    rentYears: Math.max(0, whole(raw.rentYears)),
  };
  if (shopList.length || Array.isArray(raw.shops)) state.household.semt.shops = shopList;
  return state.household.semt;
}

function weekFree(state, id) {
  if (state.lifetime?.death) return "Bu yaşam tamamlandı.";
  if (state.events?.active) return "Önce açık olayı sonuçlandır.";
  if (state.weekly.selectedIds.includes(id)) return "Bu hafta zaten yaptın.";
  if (state.weekly.used + 1 > getWeeklyActivityLimit(state))
    return "Bu haftanın karar hakkı doldu. İşin ya da diğer kararların yeri kapattı.";
  return null;
}

function spendWeek(state, id) {
  state.weekly.used += 1;
  state.weekly.selectedIds.push(id);
}

function movedAlready(state) {
  if (state.household.location?.lastMoveWeek === state.time.absoluteWeek) return true;
  return state.weekly.selectedIds.some((id) => id === "move-location" || id === "semt:move" || String(id).startsWith("move-home:"));
}

function intercityBlock(state) {
  const from = getDistrict(state.household.location?.districtId);
  const fromCity = from?.city || "istanbul";
  if (fromCity === "istanbul") return null;
  if (state.career?.pendingJob) return "Önce bekleyen iş başlangıcını sonuçlandır.";
  if (state.career?.jobId && state.career.jobId !== "freelance_any")
    return "Mevcut işin başka şehirde. Sırta, kıyıya veya çepere geçmeden önce İş ekranından ayrılmalısın.";
  if (state.education?.active) return "Önce mevcut eğitimini tamamla veya bırak; program mahalleyle birlikte taşınmaz.";
  if (state.flags?.business) return "Büyük işletmen başka şehirde. Önce Para ekranından kapat.";
  return null;
}

function settlePreviousLive(semt, nextId) {
  semt.holdings = semt.holdings.filter((item) => {
    if (item.id === nextId || item.occupancy !== "live") return true;
    if (item.mode === "rented") return false;
    item.occupancy = "empty";
    return true;
  });
}

function applyLive(state, holding, quarter) {
  const previous = state.household.homeId;
  state.household.homeId = homeForUnit(holding.unitId);
  state.household.livingWithFamily = false;
  state.household.location = { districtId: quarter.districtId, lastMoveWeek: state.time.absoluteWeek };
  state.player.city = "İstanbul";
  state.household.semt.live = {
    holdingId: holding.id,
    quarterId: quarter.id,
    anneCost: quarter.anneCost,
    anneSlots: quarter.anneSlots,
  };
  const text = `${quarter.name} mahallesinde ${holding.unitId} düzene geçtin. İşe yol ve annenin ziyareti buna göre değişir.`;
  addMemory(state, text, "important");
  addNpcMemory(state, "anne", text, "location_move");
  scheduleMoveConsequence(state, previous, state.household.homeId);
  const job = Boolean(state.career?.jobId);
  adjustHealth(state, { energy: job ? -6 : -4, stress: job ? 3 : 1 });
}

export function clearSemtLive(state) {
  const semt = state.household?.semt;
  if (!semt) return;
  for (const item of semt.holdings || []) {
    if (item.occupancy === "live" && item.mode === "owned") item.occupancy = "empty";
  }
  semt.holdings = (semt.holdings || []).filter((item) => !(item.mode === "rented" && item.occupancy === "live"));
  semt.live = null;
}

export function liveQuarterBill(state) {
  const semt = state?.household?.semt;
  const holding = semt?.holdings?.find((item) => item.occupancy === "live" && item.id === semt.live?.holdingId);
  if (!holding) return null;
  return holding.mode === "owned" ? whole(holding.upkeep) : whole(holding.monthly);
}

export function buyHolding(state, quarterId, unitId) {
  normalizeSemt(state);
  const offer = listing(quarterId, unitId);
  if (!offer) return { ok: false, reason: "Bu daire bu mahallede yok." };
  const id = keyOf(quarterId, unitId);
  const blocked = weekFree(state, `semt:buy:${id}`);
  if (blocked) return { ok: false, reason: blocked };
  if (state.household.semt.holdings.some((item) => item.id === id)) return { ok: false, reason: "Bu daire zaten sende." };
  if (state.household.semt.holdings.length >= MAX_HOLDINGS) return { ok: false, reason: "Aynı anda dört daireden fazlasını taşıyamazsın." };
  if (state.finances.balance < offer.buy) return { ok: false, reason: "Alım için nakit yetmiyor." };
  transact(state, -offer.buy, `${offer.quarter.name} ${unitId} alımı`, "semt");
  state.household.semt.holdings.push({
    id,
    quarterId,
    unitId,
    mode: "owned",
    occupancy: "empty",
    price: offer.buy,
    monthly: offer.rent,
    upkeep: offer.upkeep,
    value: offer.buy,
    renovated: false,
    acquiredWeek: state.time.absoluteWeek,
  });
  spendWeek(state, `semt:buy:${id}`);
  return { ok: true, message: `${offer.quarter.name} ${unitId} senin. İçine geçmek, kiraya vermek veya boş bırakmak ayrı karar.` };
}

export function rentToLive(state, quarterId, unitId, options = {}) {
  normalizeSemt(state);
  const offer = listing(quarterId, unitId);
  if (!offer) return { ok: false, reason: "Bu kiralık bu mahallede yok." };
  const id = keyOf(quarterId, unitId);
  const blocked = options.freeWeek ? null : weekFree(state, "semt:move");
  if (blocked) return { ok: false, reason: blocked };
  if (movedAlready(state)) return { ok: false, reason: "Bu hafta zaten taşındın." };
  const city = intercityBlock(state);
  if (city) return { ok: false, reason: city };
  if (state.household.semt.holdings.some((item) => item.id === id && item.mode === "owned"))
    return { ok: false, reason: "Bu daire senin; kiraya değil, içine geç." };
  if (state.household.semt.live?.holdingId === id) return { ok: false, reason: "Zaten bu dairede yaşıyorsun." };
  const kept = state.household.semt.holdings.filter((item) => item.id === id || item.mode === "owned");
  if (!kept.some((item) => item.id === id) && kept.length >= MAX_HOLDINGS)
    return { ok: false, reason: "Daire sınırın dolu." };
  if (state.finances.balance < offer.quarter.moveCost) return { ok: false, reason: "Taşınma nakit istiyor." };
  transact(state, -offer.quarter.moveCost, `${offer.quarter.name} kiralık taşınma`, "semt");
  settlePreviousLive(state.household.semt, id);
  let holding = state.household.semt.holdings.find((item) => item.id === id);
  if (!holding) {
    holding = {
      id,
      quarterId,
      unitId,
      mode: "rented",
      occupancy: "live",
      price: 0,
      monthly: offer.rent,
      upkeep: offer.upkeep,
      value: 0,
      renovated: false,
      acquiredWeek: state.time.absoluteWeek,
    };
    state.household.semt.holdings.push(holding);
  }
  const monthly = steppedRent(state, quarterId, unitId);
  holding.mode = "rented";
  holding.occupancy = "live";
  holding.monthly = monthly;
  applyLive(state, holding, offer.quarter);
  if (!options.freeWeek) spendWeek(state, "semt:move");
  const anne = offer.quarter.anneSlots
    ? `Annenin ziyareti +${offer.quarter.anneCost} TL ve +${offer.quarter.anneSlots} karar.`
    : `Annenin ziyareti +${offer.quarter.anneCost} TL.`;
  return { ok: true, message: `${offer.quarter.name} ${unitId} kiradasın. Aylık kira ${monthly} TL. ${anne}` };
}

export function moveIntoHolding(state, id) {
  normalizeSemt(state);
  const holding = state.household.semt.holdings.find((item) => item.id === id);
  if (!holding) return { ok: false, reason: "Taşınacak daire yok." };
  if (holding.occupancy === "rentout") return { ok: false, reason: "Kiracı varken içine geçemezsin. Önce boşalt." };
  if (holding.occupancy === "live") return { ok: false, reason: "Zaten burada yaşıyorsun." };
  const quarter = QUARTERS[holding.quarterId];
  const blocked = weekFree(state, "semt:move");
  if (blocked) return { ok: false, reason: blocked };
  if (movedAlready(state)) return { ok: false, reason: "Bu hafta zaten taşındın." };
  const city = intercityBlock(state);
  if (city) return { ok: false, reason: city };
  if (state.finances.balance < quarter.moveCost) return { ok: false, reason: "Taşınma nakit istiyor." };
  transact(state, -quarter.moveCost, `${quarter.name} ${holding.unitId} taşınma`, "semt");
  settlePreviousLive(state.household.semt, id);
  holding.occupancy = "live";
  applyLive(state, holding, quarter);
  spendWeek(state, "semt:move");
  return { ok: true, message: `${quarter.name} ${holding.unitId} içine geçtin. Bir karar hakkı gitti.` };
}

export function sellHolding(state, id) {
  normalizeSemt(state);
  const holding = state.household.semt.holdings.find((item) => item.id === id);
  if (!holding || holding.mode !== "owned") return { ok: false, reason: "Satılacak mülkün yok." };
  if (holding.occupancy === "live") return { ok: false, reason: "Önce içinden çık. Satış oturduğun evi sessizce boşaltmaz." };
  const blocked = weekFree(state, `semt:sell:${id}`);
  if (blocked) return { ok: false, reason: blocked };
  const proceeds = whole(holding.value);
  transact(state, proceeds, `${QUARTERS[holding.quarterId].name} ${holding.unitId} satışı`, "semt");
  state.household.semt.holdings = state.household.semt.holdings.filter((item) => item !== holding);
  spendWeek(state, `semt:sell:${id}`);
  return { ok: true, message: `Satış ${proceeds} TL. Tam lira, kesir yok.` };
}

export function leaveHoldingEmpty(state, id) {
  normalizeSemt(state);
  const holding = state.household.semt.holdings.find((item) => item.id === id && item.mode === "owned");
  if (!holding) return { ok: false, reason: "Boş bırakılacak mülkün yok." };
  if (holding.occupancy === "live") return { ok: false, reason: "Oturduğun evi boşaltmak için önce başka bir kapıya geç." };
  if (holding.occupancy === "empty") return { ok: false, reason: "Daire zaten boş." };
  const blocked = weekFree(state, `semt:empty:${id}`);
  if (blocked) return { ok: false, reason: blocked };
  holding.occupancy = "empty";
  spendWeek(state, `semt:empty:${id}`);
  return { ok: true, message: "Daire boş. Kira kesildi; bakım sürer." };
}

export function letHolding(state, id) {
  normalizeSemt(state);
  const holding = state.household.semt.holdings.find((item) => item.id === id && item.mode === "owned");
  if (!holding) return { ok: false, reason: "Kiraya verilecek mülkün yok." };
  if (holding.occupancy === "live") return { ok: false, reason: "Oturduğun evi kiraya vermeden önce çıkman gerekir." };
  if (holding.occupancy === "rentout") return { ok: false, reason: "Zaten kirada." };
  const blocked = weekFree(state, `semt:let:${id}`);
  if (blocked) return { ok: false, reason: blocked };
  holding.occupancy = "rentout";
  spendWeek(state, `semt:let:${id}`);
  const weekly = Math.round((holding.monthly * 7) / 40);
  return { ok: true, message: `Kiracı aranıyor. Dolu haftada yaklaşık ${weekly} TL; boş hafta ve arıza payı var.` };
}

export function renovateHolding(state, id) {
  normalizeSemt(state);
  const holding = state.household.semt.holdings.find((item) => item.id === id && item.mode === "owned");
  if (!holding) return { ok: false, reason: "Tadilat için sahip olduğun bir daire gerekir." };
  if (holding.renovated) return { ok: false, reason: "Bu daireye küçük tadilat bir kez yapılır." };
  const cost = Math.round(holding.price * 0.08);
  const blocked = weekFree(state, `semt:reno:${id}`);
  if (blocked) return { ok: false, reason: blocked };
  if (state.finances.balance < cost) return { ok: false, reason: "Tadilat nakit istiyor." };
  transact(state, -cost, `${QUARTERS[holding.quarterId].name} küçük tadilat`, "semt");
  holding.renovated = true;
  holding.value = whole(holding.value + Math.round(holding.price * 0.06));
  holding.monthly = Math.round(holding.monthly * 1.08);
  spendWeek(state, `semt:reno:${id}`);
  return { ok: true, message: `Tadilat ${cost} TL. Değeri ve kirası bir parça yükseldi.` };
}

export function rentalWeekNet(holding, { managed, roll }) {
  const upkeep = Math.round(holding.upkeep / 4);
  const rent = Math.round((holding.monthly * 7) / 40);
  const vacantCut = managed ? 0.06 : 0.14;
  const issueCut = managed ? 0.1 : 0.22;
  if (roll < vacantCut) return { rent: 0, upkeep, repair: 0, net: -upkeep, note: "boş hafta" };
  if (roll < issueCut) {
    const repair = Math.max(200, Math.round(holding.upkeep / 2));
    return { rent: 0, upkeep, repair, net: -(upkeep + repair), note: "kiracı sorunu" };
  }
  return { rent, upkeep, repair: 0, net: rent - upkeep, note: "kira" };
}

export function shopWeekNet(type, { tended, roll }) {
  let income = tended ? type.weeklyIn : Math.round(type.weeklyIn * type.neglect);
  let fine = 0;
  let note = tended ? "baktın" : "uğramadın";
  if (roll < 0.12) {
    income = Math.round(income * 0.5);
    note = "az müşteri";
  } else if (roll < 0.18) {
    fine = 2000;
    note = "denetim";
  } else if (roll < 0.26) {
    income = Math.round(income * 0.7);
    note = "rekabet";
  } else if (roll >= 0.86) {
    income = Math.round(income * 1.25);
    note = "iyi hafta";
  }
  return { income, expense: type.weeklyOut, fine, net: income - type.weeklyOut - fine, note };
}

function shopKey(shop) {
  return shop.n === 2 ? `${shop.quarterId}:${shop.id}:2` : `${shop.quarterId}:${shop.id}`;
}

function stallLocked(state) {
  const week = state.time?.absoluteWeek || 1;
  const army = state.flags?.askerlik;
  if (army?.mode === "serving" && Number.isInteger(army.until) && week < army.until) return "Askerliktesin. Tezgâha uğrayamazsın.";
  const until = state.flags?.risk?.detainedUntil;
  if (Number.isInteger(until) && week < until) return "İçeridesin. Tezgâha uğrayamazsın.";
  return "";
}

function hasTwin(shops, shop) {
  return shops.some((other) => other !== shop && other.quarterId === shop.quarterId && other.id === shop.id);
}

function bindShops(semt) {
  semt.shop = semt.shops[0] || null;
}

function titledVenture(state) {
  return state.career?.jobId === "shop_owner" || state.career?.jobId === "startup";
}

function heldShopWeeks(state, shops) {
  if (!shops.length) return 0;
  const week = state.time?.absoluteWeek || 1;
  return week - Math.min(...shops.map((shop) => shop.openedWeek));
}

function entrepreneurBlock(state, shops) {
  if (!shops.length) return null;
  if (shops.length >= MAX_SHOPS) return "Üç tezgâh yeter. Daha fazlası bu hayatın yükü değil.";
  if (titledVenture(state)) return null;
  const held = heldShopWeeks(state, shops);
  if (shops.length === 1 && held < 4)
    return "İkinci tezgâh için dört hafta dükkân tut ya da İş'ten küçük esnaf / girişim ortağı ol.";
  if (shops.length === 2 && held < 8)
    return "Üçüncü tezgâh için sekiz hafta dükkân tut ya da İş'ten küçük esnaf / girişim ortağı ol.";
  return null;
}

function shopAllowed(state, quarterId, shopId) {
  const quarter = QUARTERS[quarterId];
  const type = SHOPS[shopId];
  if (!quarter || !type || !quarter.shops.includes(shopId)) return { ok: false, reason: "Bu tezgâh bu mahallenin işi değil." };
  if ((state.time?.year || 0) < type.since) return { ok: false, reason: `${type.label} bu yılda yok.` };
  return { ok: true, quarter, type };
}

function pickShop(state, key) {
  const shops = state.household.semt.shops || [];
  if (!shops.length) return null;
  if (!key || key === "shop") return shops[0];
  return shops.find((shop) => shopKey(shop) === key) || null;
}

export function openShop(state, quarterId, shopId) {
  normalizeSemt(state);
  const check = shopAllowed(state, quarterId, shopId);
  if (!check.ok) return check;
  const semt = state.household.semt;
  if (!Array.isArray(semt.shops)) semt.shops = [];
  const shops = semt.shops;
  const same = shops.filter((shop) => shop.quarterId === quarterId && shop.id === shopId);
  if (same.length >= 2) return { ok: false, reason: "Bu mahallede aynı işten iki tezgâh yeter." };
  const twin = same.length === 1;
  const gate = entrepreneurBlock(state, shops);
  if (gate) return { ok: false, reason: gate };
  const blocked = weekFree(state, "semt:open");
  if (blocked) return { ok: false, reason: blocked };
  if (state.finances.balance < check.type.startup) return { ok: false, reason: "Tezgâh sermayesi yetmiyor." };
  transact(state, -check.type.startup, `${check.quarter.name} ${check.type.label} açılışı`, "semt");
  const row = {
    id: shopId,
    quarterId,
    startup: check.type.startup,
    openedWeek: state.time.absoluteWeek,
    attentionWeek: 0,
  };
  if (twin) row.n = 2;
  shops.push(row);
  bindShops(state.household.semt);
  spendWeek(state, "semt:open");
  if (state.career?.jobId) adjustHealth(state, { energy: -2, stress: 2 });
  if (shops.length > 1) {
    adjustHealth(state, { energy: -2, stress: 3 });
    addMemory(state, "Her tezgâh kendi ziyaretini ister. Birini boş bırakırsan o dükkânın cirosu ayrı düşer.");
  }
  const extra = twin
    ? " Aynı mahallede aynı iş. İkisinin de cirosu düşer."
    : shops.length > 1
      ? " Her tezgâha ayrı uğraman gerekir."
      : "";
  return {
    ok: true,
    message: `${check.type.label} açıldı. Bir karar hakkı gitti${state.career?.jobId ? "; işin varken enerji de bölündü" : ""}.${extra} Uğramazsan ciro düşer.`,
  };
}

export function tendShop(state, key) {
  normalizeSemt(state);
  const shop = pickShop(state, key);
  if (!shop) return { ok: false, reason: "Uğrayacak tezgâhın yok." };
  if (shop.kalfa) return { ok: false, reason: "Kalfa bakıyor. Uğraman gerekmez." };
  const locked = stallLocked(state);
  if (locked) return { ok: false, reason: locked };
  const blocked = weekFree(state, `semt:tend:${shopKey(shop)}`);
  if (blocked) return { ok: false, reason: blocked };
  shop.attentionWeek = state.time.absoluteWeek;
  spendWeek(state, `semt:tend:${shopKey(shop)}`);
  if (state.career?.jobId) adjustHealth(state, { energy: -3, stress: 2 });
  const label = SHOPS[shop.id].label;
  return { ok: true, message: state.career?.jobId ? `${label} tezgâhına baktın. İşin de vardı; hak ve enerji bölündü.` : `${label} tezgâhına baktın. Bu haftanın cirosu düşmez.` };
}

export function manageRentals(state) {
  normalizeSemt(state);
  if (!state.household.semt.holdings.some((item) => item.occupancy === "rentout"))
    return { ok: false, reason: "Yoklanacak kiracın yok." };
  const blocked = weekFree(state, "semt:manage");
  if (blocked) return { ok: false, reason: blocked };
  spendWeek(state, "semt:manage");
  return { ok: true, message: "Kiraları yokladın. Boş hafta ihtimali bu hafta düşer; tamamen bitmez." };
}

function shopProceeds(shop, tended) {
  return Math.round(shop.startup * (tended ? 0.45 : 0.3));
}

function dropShop(state, shop) {
  const semt = state.household.semt;
  semt.shops = (semt.shops || []).filter((item) => item !== shop);
  bindShops(semt);
}

export function closeShop(state, key) {
  normalizeSemt(state);
  const shop = pickShop(state, key);
  if (!shop) return { ok: false, reason: "Açık tezgâh yok." };
  const blocked = weekFree(state, `semt:close:${shopKey(shop)}`);
  if (blocked) return { ok: false, reason: blocked };
  const proceeds = Math.round(shop.startup * 0.3);
  transact(state, proceeds, `${SHOPS[shop.id].label} kapanış`, "semt");
  dropShop(state, shop);
  spendWeek(state, `semt:close:${shopKey(shop)}`);
  return { ok: true, message: `Tezgâh kapandı. Geri gelen ${proceeds} TL.` };
}

export function sellShop(state, key) {
  normalizeSemt(state);
  const shop = pickShop(state, key);
  if (!shop) return { ok: false, reason: "Devredilecek tezgâh yok." };
  const blocked = weekFree(state, `semt:sell-shop:${shopKey(shop)}`);
  if (blocked) return { ok: false, reason: blocked };
  const tended = shop.attentionWeek === state.time.absoluteWeek;
  const proceeds = shopProceeds(shop, tended);
  transact(state, proceeds, `${SHOPS[shop.id].label} devri`, "semt");
  dropShop(state, shop);
  spendWeek(state, `semt:sell-shop:${shopKey(shop)}`);
  return { ok: true, message: tended ? `Sattın. Bu hafta baktığın için ${proceeds} TL.` : `Sattın. Uğramadığın için ${proceeds} TL.` };
}

function closeEsnafFiles(state) {
  const week = state.time?.absoluteWeek || 1;
  for (const item of state.openCases || []) {
    if (item.type === "esnaf-dosya" && item.status === "pending" && item.dueWeek <= week) item.status = "resolved";
  }
}

function noteInspection(state, shop) {
  const shops = state.household.semt.shops || [];
  const pending = (state.openCases || []).filter((item) => item.type === "esnaf-dosya" && item.status === "pending");
  const key = shopKey(shop);
  if (pending.some((item) => item.payload?.key === key) || pending.length >= 2) return;
  const label = `${QUARTERS[shop.quarterId].name} ${SHOPS[shop.id].label}`;
  const text = shops.length > 1
    ? `${label} denetim notu dosyaya geçti. Uğramadığın tezgâhın cezası diğerinden ayrı.`
    : `${label} denetim notu dosyaya geçti. Uğramadığın hafta ceza yer.`;
  state.openCases.push({
    id: `esnaf-${key}-${state.time.absoluteWeek}`,
    type: "esnaf-dosya",
    createdWeek: state.time.absoluteWeek,
    dueWeek: state.time.absoluteWeek + 3,
    status: "pending",
    payload: { key, text, playerKnown: true },
  });
  addMemory(state, text, "important");
  adjustHealth(state, { stress: 2 });
  if (shops.length > 1 && updateRelationship(state, "anne", -2)) addNpcMemory(state, "anne", "Tezgâhı boş bıraktığını duydu.", "semt");
}

export function hireKalfa(state, key) {
  normalizeSemt(state);
  const shop = pickShop(state, key);
  if (!shop) return { ok: false, reason: "Kalfa için tezgâh yok." };
  if (shop.kalfa) return { ok: false, reason: "Kalfa zaten duruyor." };
  const blocked = weekFree(state, `semt:kalfa:${shopKey(shop)}`);
  if (blocked) return { ok: false, reason: blocked };
  shop.kalfa = true;
  spendWeek(state, `semt:kalfa:${shopKey(shop)}`);
  return { ok: true, message: `Kalfa tutuldu. Haftalık ${KALFA_WAGE} TL. Uğraman gerekmez; ciro biraz düşer. Ücret çıkmazsa o hafta boş sayılır.` };
}

export function fireKalfa(state, key) {
  normalizeSemt(state);
  const shop = pickShop(state, key);
  if (!shop?.kalfa) return { ok: false, reason: "Çıkarılacak kalfa yok." };
  const blocked = weekFree(state, `semt:kalfa-off:${shopKey(shop)}`);
  if (blocked) return { ok: false, reason: blocked };
  shop.kalfa = false;
  spendWeek(state, `semt:kalfa-off:${shopKey(shop)}`);
  return { ok: true, message: "Kalfa çıktı. Tezgâh yine senin uğramanı ister." };
}

export function processSemtWeek(state) {
  const semt = normalizeSemt(state);
  closeEsnafFiles(state);
  const week = state.time.absoluteWeek;
  if (semt.lastWeek === week) return "";
  semt.lastWeek = week;
  const notes = [];
  const managed = state.weekly.selectedIds.includes("semt:manage");
  for (const holding of semt.holdings) {
    if (holding.occupancy === "live") continue;
    if (holding.mode !== "owned") continue;
    if (holding.occupancy === "rentout") {
      const result = rentalWeekNet(holding, { managed, roll: semtRoll(state, RENT_SALT + holding.acquiredWeek) });
      if (result.rent) transact(state, result.rent, `${QUARTERS[holding.quarterId].name} kira`, "semt");
      if (result.upkeep) transact(state, -result.upkeep, `${QUARTERS[holding.quarterId].name} bakım`, "semt");
      if (result.repair) transact(state, -result.repair, `${QUARTERS[holding.quarterId].name} kiracı arızası`, "semt");
      notes.push(`${QUARTERS[holding.quarterId].name} ${holding.unitId}: ${result.note}, net ${result.net} TL`);
    } else {
      const upkeep = Math.round(holding.upkeep / 4);
      if (upkeep) transact(state, -upkeep, `${QUARTERS[holding.quarterId].name} boş daire bakımı`, "semt");
    }
  }
  (semt.shops || []).forEach((shop, index) => {
    if (shop.openedWeek === week) return;
    const type = SHOPS[shop.id];
    const locked = Boolean(stallLocked(state));
    const visit = !locked && shop.attentionWeek === week;
    let kalfaPaid = false;
    if (shop.kalfa && state.finances.balance >= KALFA_WAGE) {
      transact(state, -KALFA_WAGE, `${QUARTERS[shop.quarterId].name} ${type.label} kalfa`, "semt");
      kalfaPaid = true;
    }
    const covered = visit || kalfaPaid;
    const salt = index === 0 ? SHOP_SALT : SHOP_SALT + index * 97;
    const result = shopWeekNet(type, { tended: covered, roll: semtRoll(state, salt) });
    let net = result.net;
    let note = result.note;
    if (kalfaPaid) {
      const income = Math.round(result.income * 0.9);
      net = income - result.expense - result.fine;
      if (note === "baktın") note = "kalfa";
    }
    if (locked && !kalfaPaid && note === "uğramadın") note = stallLocked(state).startsWith("Askerlik") ? "askerlik" : "içeride";
    if (semt.shops.length > 1 && !covered) {
      net -= 400;
      note = `${note}, yük`;
    }
    if (hasTwin(semt.shops, shop)) {
      net -= Math.round(type.weeklyIn * 0.15);
      note = `${note}, aynı iş`;
    }
    if (result.note === "denetim" && !covered) noteInspection(state, shop);
    if (net > 0) {
      const file = (state.openCases || []).find((row) => row.type === "icra" && row.status === "pending");
      const owed = Math.round(Number(file?.payload?.owed ?? file?.payload?.amount) || 0);
      const cut = file && owed > 0 ? Math.min(owed, Math.round(net * 0.1)) : 0;
      if (cut > 0) {
        recordIcraPayment(state, file, cut);
        net -= cut;
        note = `${note}, haciz`;
      }
    }
    transact(state, net, `${QUARTERS[shop.quarterId].name} ${type.label}`, "semt");
    notes.push(`${type.label}: ${note}, net ${net} TL`);
  });
  return notes.join(" · ");
}

function button(action, value, label, detail, disabled, reason) {
  const title = reason ? ` title="${reason.replaceAll('"', "'")}"` : "";
  return `<button class="button decision wealth-action" data-semt-action="${action}" data-semt-value="${value}"${disabled ? " disabled" : ""}${title}><strong>${label}</strong><small>${detail}${reason ? ` · ${reason}` : ""}</small></button>`;
}

export function renderSemtEmlak(state, { money, escapeText }) {
  const semt = normalizeSemt(state);
  const held = semt.shops || [];
  const live = semt.holdings.find((item) => item.occupancy === "live");
  const quarters = Object.values(QUARTERS).map((quarter) => {
    const units = UNIT_IDS.map((unitId) => {
      const offer = listing(quarter.id, unitId);
      const rentNow = steppedRent(state, quarter.id, unitId);
      const owned = semt.holdings.find((item) => item.id === keyOf(quarter.id, unitId));
      const buyReason = owned ? "Bu daire zaten sende." : weekFree(state, `semt:buy:${owned?.id || keyOf(quarter.id, unitId)}`) || (state.finances.balance < offer.buy ? "Nakit yetmiyor." : "");
      const rentReason = owned?.mode === "owned" ? "Senin dairen; kiraya değil içine geç." : live?.id === keyOf(quarter.id, unitId) ? "Zaten burada yaşıyorsun." : weekFree(state, "semt:move") || (state.finances.balance < quarter.moveCost ? "Taşınma nakit istiyor." : "");
      return `<article class="wealth-card"><strong>${escapeText(unitId)}</strong><small>Alım ${money(offer.buy)} · aylık kira ${money(rentNow)} · bakım ${money(offer.upkeep)}</small><div class="wealth-actions">${button("buy", keyOf(quarter.id, unitId), "Satın al", "1 karar · boş teslim", Boolean(buyReason), escapeText(buyReason))}${button("rent", keyOf(quarter.id, unitId), "Kiraya taşın", `${money(quarter.moveCost)} · 1 karar`, Boolean(rentReason), escapeText(rentReason))}</div></article>`;
    }).join("");
    const shops = quarter.shops.map((shopId) => {
      const type = SHOPS[shopId];
      const early = (state.time?.year || 0) < type.since;
      const twins = held.filter((shop) => shop.quarterId === quarter.id && shop.id === shopId).length;
      const gate = entrepreneurBlock(state, held);
      const reason = twins >= 2 ? "Bu mahallede aynı işten iki tezgâh var." : early ? `${type.since} öncesi yok.` : gate || weekFree(state, "semt:open") || (state.finances.balance < type.startup ? "Sermaye yetmiyor." : "");
      const openLabel = twins === 1 ? "İkinci tezgâh" : "Tezgâhı aç";
      const openDetail = twins === 1 ? "aynı iş, ciro ikisinde de düşer" : "1 karar · uğramazsan ciro düşer";
      return `<article class="wealth-card"><strong>${escapeText(type.label)}</strong><small>Açılış ${money(type.startup)} · haftalık ciro ${money(type.weeklyIn)} / gider ${money(type.weeklyOut)}</small><div class="wealth-actions">${button("open", `${quarter.id}:${shopId}`, openLabel, openDetail, Boolean(reason), escapeText(reason))}</div></article>`;
    }).join("");
    return `<article class="semt-quarter"><div class="panel-head"><div><p class="eyebrow">${escapeText(quarter.name.toLocaleUpperCase("tr"))}</p><h3>${escapeText(quarter.name)}</h3></div></div><p class="context-note">${escapeText(quarter.character)} Annenin ziyaretine +${money(quarter.anneCost)}${quarter.anneSlots ? ` ve +${quarter.anneSlots} karar` : ""}.</p><div class="wealth-grid">${units}${shops}</div></article>`;
  }).join("");
  const holdings = semt.holdings.map((item) => {
    const quarter = QUARTERS[item.quarterId];
    const status = item.occupancy === "live" ? "içinde yaşıyorsun" : item.occupancy === "rentout" ? "kirada" : "boş";
    const moveReason = item.occupancy === "live" ? "Zaten burada." : item.occupancy === "rentout" ? "Önce boşalt." : weekFree(state, "semt:move") || "";
    const letReason = item.mode !== "owned" ? "Kiralık sözleşme kiraya verilmez." : item.occupancy === "live" ? "Önce çık." : item.occupancy === "rentout" ? "Zaten kirada." : weekFree(state, `semt:let:${item.id}`) || "";
    const emptyReason = item.mode !== "owned" || item.occupancy !== "rentout" ? (item.occupancy === "live" ? "Önce başka kapıya geç." : "Kiradaki daire boşaltılır.") : weekFree(state, `semt:empty:${item.id}`) || "";
    const sellReason = item.mode !== "owned" ? "Kiralık satılmaz." : item.occupancy === "live" ? "Önce çık." : weekFree(state, `semt:sell:${item.id}`) || "";
    const renoCost = Math.round(item.price * 0.08);
    const renoReason = item.mode !== "owned" ? "Kiralığa tadilat yok." : item.renovated ? "Tadilat yapıldı." : weekFree(state, `semt:reno:${item.id}`) || (state.finances.balance < renoCost ? "Nakit yetmiyor." : "");
    return `<article class="wealth-card"><strong>${escapeText(quarter.name)} ${escapeText(item.unitId)}</strong><small>${item.mode === "owned" ? "mülk" : "kiralık"} · ${status} · değer ${money(item.value)} · aylık ${money(item.mode === "owned" && item.occupancy === "live" ? item.upkeep : item.monthly)}</small><div class="wealth-actions">${button("move", item.id, "İçine geç", `${money(quarter.moveCost)} · 1 karar`, Boolean(moveReason), escapeText(moveReason))}${button("let", item.id, "Kiraya ver", "boş hafta ve arıza var", Boolean(letReason), escapeText(letReason))}${button("empty", item.id, "Boş bırak", "kira durur", Boolean(emptyReason), escapeText(emptyReason))}${button("sell", item.id, "Sat", money(item.value), Boolean(sellReason), escapeText(sellReason))}${button("reno", item.id, "Ufak tadilat", money(renoCost), Boolean(renoReason), escapeText(renoReason))}</div></article>`;
  }).join("");
  const shopCards = held.map((shop) => {
    const key = shopKey(shop);
    const locked = stallLocked(state);
    const tended = !locked && shop.attentionWeek === state.time.absoluteWeek;
    const tendId = `semt:tend:${key}`;
    const closeId = `semt:close:${key}`;
    const sellId = `semt:sell-shop:${key}`;
    const kalfaId = shop.kalfa ? `semt:kalfa-off:${key}` : `semt:kalfa:${key}`;
    const tendReason = shop.kalfa ? "Kalfa bakıyor." : locked || weekFree(state, tendId) || "";
    const status = shop.kalfa ? "Kalfa bakıyor. Uğraman gerekmez." : tended ? "Bu hafta uğradın." : locked || "Bu hafta uğramadın; bu tezgâhın cirosu kendi düşer.";
    const twin = shop.n === 2 ? " · ikinci" : "";
    return `<article class="wealth-card"><strong>${escapeText(SHOPS[shop.id].label)}${twin} · ${escapeText(QUARTERS[shop.quarterId].name)}</strong><small>${escapeText(status)}</small><div class="wealth-actions">${button("tend", key, "Bu hafta uğra", state.career?.jobId ? "işin varken enerji de gider" : "1 karar", Boolean(tendReason), escapeText(tendReason))}${button(shop.kalfa ? "kalfa-off" : "kalfa", key, shop.kalfa ? "Kalfayı çıkar" : "Kalfa tut", shop.kalfa ? "uğrama yine sana düşer" : `${money(KALFA_WAGE)} / hafta`, Boolean(weekFree(state, kalfaId)), escapeText(weekFree(state, kalfaId) || ""))}${button("close", key, "Kapat", money(Math.round(shop.startup * 0.3)), Boolean(weekFree(state, closeId)), escapeText(weekFree(state, closeId) || ""))}${button("sell-shop", key, "Sat", money(shopProceeds(shop, tended)), Boolean(weekFree(state, sellId)), escapeText(weekFree(state, sellId) || ""))}</div></article>`;
  }).join("");
  const venture = titledVenture(state)
    ? state.career.jobId === "shop_owner"
      ? "Küçük esnaf yolundasın. Bekleme yok."
      : "Girişim ortağı yolundasın. Bekleme yok."
    : semt.shops?.length
      ? `Dükkân yaşı ${heldShopWeeks(state, held)} hafta.`
      : "İlk tezgâh sermaye ve bir karar ister.";
  const shopBlock = shopCards
    ? `<div class="wealth-grid">${shopCards}</div>`
    : `<p class="context-note">Açık mahalle tezgâhın yok. Para ekranındaki büyük işletme bundan ayrı durur.</p>`;
  const manageReason = semt.holdings.some((item) => item.occupancy === "rentout") ? weekFree(state, "semt:manage") || "" : "Kiradaki dairen yok.";
  return `<section class="panel semt-emlak" id="semt-emlak"><div class="panel-head"><div><p class="eyebrow">SEMT</p><h2>Emlak ve mahalle tezgâhı</h2></div><span>${escapeText(live ? `${QUARTERS[live.quarterId].name} ${live.unitId}` : "aile evi")}</span></div><p class="context-note">Üç kurgusal mahalle: Sırt, Kıyı, Çeper. Ankara ve İzmir de seçilebilir. Alım, taşınma ve tezgâh birer haftalık hak yer; işin varsa aynı hak bölünür. Para tam liradır.</p><div class="semt-quarters">${quarters}</div><div class="panel-head"><div><p class="eyebrow">SENİN</p><h3>Dairelerin</h3></div></div>${holdings ? `<div class="wealth-grid">${holdings}</div>` : `<p class="context-note">Henüz daire yok.</p>`}<div class="wealth-actions">${button("manage", "rent", "Kiraları yokla", "boş haftayı azaltır", Boolean(manageReason), escapeText(manageReason))}</div><div class="panel-head"><div><p class="eyebrow">GENÇ GİRİŞİMCİ</p><h3>Mahalle işi</h3></div></div><p class="context-note">Bir tezgâh herkese açık. İkinci tezgâh için dört hafta dükkân tut ya da İş'ten küçük esnaf / girişim ortağı ol. Üçten fazlası yok. Açık tezgâhı kapatabilir veya satabilirsin. Her uğrama ayrı karar hakkı yer. Uğramadığın tezgâhın cirosu kendi düşer; askerlik ve tutuklamada da düşer. Uğramadığın denetim tek tezgâhta da kısa dosya açar. Aynı mahallede aynı işin ikincisi ikisinin de cirosunu düşürür. Kalfa küçük maaşla uğramayı kaldırır. ${escapeText(venture)}</p>${shopBlock}</section>`;
}
