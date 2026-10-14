// Semt emlak + mahalle tezgâhı. Para ekranındaki servet mülkü ve büyük işletme durur.
import { getDistrict } from "./locations.js?v=10";
import { scheduleMoveConsequence } from "./depth3-systems.js?v=10";
import {
  addMemory,
  addNpcMemory,
  adjustHealth,
  getWeeklyActivityLimit,
  transact,
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
  const shopRaw = raw.shop;
  const shopType = SHOPS[shopRaw?.id];
  const shopQuarter = QUARTERS[shopRaw?.quarterId];
  const shop = shopType && shopQuarter && shopQuarter.shops.includes(shopRaw.id)
    ? {
        id: shopRaw.id,
        quarterId: shopQuarter.id,
        startup: whole(shopRaw.startup, shopType.startup),
        openedWeek: Number.isInteger(shopRaw.openedWeek) ? shopRaw.openedWeek : state.time?.absoluteWeek || 1,
        attentionWeek: Number.isInteger(shopRaw.attentionWeek) ? shopRaw.attentionWeek : 0,
      }
    : null;
  state.household.semt = {
    holdings: cleaned,
    shop,
    live: quarter
      ? { holdingId: liveHolding.id, quarterId: quarter.id, anneCost: quarter.anneCost, anneSlots: quarter.anneSlots }
      : null,
    lastWeek: Number.isInteger(raw.lastWeek) ? raw.lastWeek : 0,
    rentYears: Math.max(0, whole(raw.rentYears)),
  };
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
  }
  return { income, expense: type.weeklyOut, fine, net: income - type.weeklyOut - fine, note };
}

function shopAllowed(state, quarterId, shopId) {
  const quarter = QUARTERS[quarterId];
  const type = SHOPS[shopId];
  if (!quarter || !type || !quarter.shops.includes(shopId)) return { ok: false, reason: "Bu tezgâh bu mahallenin işi değil." };
  if ((state.time?.year || 0) < type.since) return { ok: false, reason: `${type.label} bu yılda yok.` };
  return { ok: true, quarter, type };
}

export function openShop(state, quarterId, shopId) {
  normalizeSemt(state);
  const check = shopAllowed(state, quarterId, shopId);
  if (!check.ok) return check;
  if (state.household.semt.shop) return { ok: false, reason: "Önce açık tezgâhı kapat veya devret." };
  const blocked = weekFree(state, "semt:open");
  if (blocked) return { ok: false, reason: blocked };
  if (state.finances.balance < check.type.startup) return { ok: false, reason: "Tezgâh sermayesi yetmiyor." };
  transact(state, -check.type.startup, `${check.quarter.name} ${check.type.label} açılışı`, "semt");
  state.household.semt.shop = {
    id: shopId,
    quarterId,
    startup: check.type.startup,
    openedWeek: state.time.absoluteWeek,
    attentionWeek: 0,
  };
  spendWeek(state, "semt:open");
  if (state.career?.jobId) adjustHealth(state, { energy: -2, stress: 2 });
  return {
    ok: true,
    message: `${check.type.label} açıldı. Bir karar hakkı gitti${state.career?.jobId ? "; işin varken enerji de bölündü" : ""}. Uğramazsan ciro düşer.`,
  };
}

export function tendShop(state) {
  normalizeSemt(state);
  const shop = state.household.semt.shop;
  if (!shop) return { ok: false, reason: "Uğrayacak tezgâhın yok." };
  const blocked = weekFree(state, "semt:tend");
  if (blocked) return { ok: false, reason: blocked };
  shop.attentionWeek = state.time.absoluteWeek;
  spendWeek(state, "semt:tend");
  if (state.career?.jobId) adjustHealth(state, { energy: -3, stress: 2 });
  return { ok: true, message: state.career?.jobId ? "Tezgâha baktın. İşin de vardı; hak ve enerji bölündü." : "Tezgâha baktın. Bu haftanın cirosu düşmez." };
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

export function closeShop(state) {
  normalizeSemt(state);
  const shop = state.household.semt.shop;
  if (!shop) return { ok: false, reason: "Açık tezgâh yok." };
  const blocked = weekFree(state, "semt:close");
  if (blocked) return { ok: false, reason: blocked };
  const proceeds = Math.round(shop.startup * 0.3);
  transact(state, proceeds, `${SHOPS[shop.id].label} kapanış`, "semt");
  state.household.semt.shop = null;
  spendWeek(state, "semt:close");
  return { ok: true, message: `Tezgâh kapandı. Geri gelen ${proceeds} TL.` };
}

export function sellShop(state) {
  normalizeSemt(state);
  const shop = state.household.semt.shop;
  if (!shop) return { ok: false, reason: "Devredilecek tezgâh yok." };
  const blocked = weekFree(state, "semt:sell-shop");
  if (blocked) return { ok: false, reason: blocked };
  const tended = shop.attentionWeek === state.time.absoluteWeek;
  const proceeds = shopProceeds(shop, tended);
  transact(state, proceeds, `${SHOPS[shop.id].label} devri`, "semt");
  state.household.semt.shop = null;
  spendWeek(state, "semt:sell-shop");
  return { ok: true, message: tended ? `Devrettin. Bu hafta baktığın için ${proceeds} TL.` : `Devrettin. Uğramadığın için ${proceeds} TL.` };
}

export function processSemtWeek(state) {
  const semt = normalizeSemt(state);
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
  if (semt.shop && semt.shop.openedWeek !== week) {
    const type = SHOPS[semt.shop.id];
    const tended = semt.shop.attentionWeek === week;
    const result = shopWeekNet(type, { tended, roll: semtRoll(state, SHOP_SALT) });
    transact(state, result.net, `${QUARTERS[semt.shop.quarterId].name} ${type.label}`, "semt");
    notes.push(`${type.label}: ${result.note}, net ${result.net} TL`);
  }
  return notes.join(" · ");
}

function button(action, value, label, detail, disabled, reason) {
  const title = reason ? ` title="${reason.replaceAll('"', "'")}"` : "";
  return `<button class="button decision wealth-action" data-semt-action="${action}" data-semt-value="${value}"${disabled ? " disabled" : ""}${title}><strong>${label}</strong><small>${detail}${reason ? ` · ${reason}` : ""}</small></button>`;
}

export function renderSemtEmlak(state, { money, escapeText }) {
  const semt = normalizeSemt(state);
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
      const reason = semt.shop ? "Önce açık tezgâhı kapat." : early ? `${type.since} öncesi yok.` : weekFree(state, "semt:open") || (state.finances.balance < type.startup ? "Sermaye yetmiyor." : "");
      return `<article class="wealth-card"><strong>${escapeText(type.label)}</strong><small>Açılış ${money(type.startup)} · haftalık ciro ${money(type.weeklyIn)} / gider ${money(type.weeklyOut)}</small><div class="wealth-actions">${button("open", `${quarter.id}:${shopId}`, "Tezgâhı aç", "1 karar · uğramazsan ciro düşer", Boolean(reason), escapeText(reason))}</div></article>`;
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
  const shop = semt.shop;
  const shopBlock = shop
    ? `<article class="wealth-card"><strong>${escapeText(SHOPS[shop.id].label)} · ${escapeText(QUARTERS[shop.quarterId].name)}</strong><small>${shop.attentionWeek === state.time.absoluteWeek ? "Bu hafta uğradın." : "Bu hafta uğramadın; ciro düşer."}</small><div class="wealth-actions">${button("tend", "shop", "Bu hafta uğra", state.career?.jobId ? "işin varken enerji de gider" : "1 karar", Boolean(weekFree(state, "semt:tend")), escapeText(weekFree(state, "semt:tend") || ""))}${button("close", "shop", "Kapat", money(Math.round(shop.startup * 0.3)), Boolean(weekFree(state, "semt:close")), escapeText(weekFree(state, "semt:close") || ""))}${button("sell-shop", "shop", "Devret", money(shopProceeds(shop, shop.attentionWeek === state.time.absoluteWeek)), Boolean(weekFree(state, "semt:sell-shop")), escapeText(weekFree(state, "semt:sell-shop") || ""))}</div></article>`
    : `<p class="context-note">Açık mahalle tezgâhın yok. Para ekranındaki büyük işletme bundan ayrı durur.</p>`;
  const manageReason = semt.holdings.some((item) => item.occupancy === "rentout") ? weekFree(state, "semt:manage") || "" : "Kiradaki dairen yok.";
  return `<section class="panel semt-emlak" id="semt-emlak"><div class="panel-head"><div><p class="eyebrow">SEMT</p><h2>Emlak ve mahalle tezgâhı</h2></div><span>${escapeText(live ? `${QUARTERS[live.quarterId].name} ${live.unitId}` : "aile evi")}</span></div><p class="context-note">Üç kurgusal mahalle: Sırt, Kıyı, Çeper. Ankara ve İzmir seçicileri duruyor. Alım, taşınma ve tezgâh birer haftalık karar hakkı yer; işin varsa aynı hak bölünür. Para tam liradır.</p><div class="semt-quarters">${quarters}</div><div class="panel-head"><div><p class="eyebrow">SENİN</p><h3>Dairelerin</h3></div></div>${holdings ? `<div class="wealth-grid">${holdings}</div>` : `<p class="context-note">Henüz daire yok.</p>`}<div class="wealth-actions">${button("manage", "rent", "Kiraları yokla", "boş haftayı azaltır", Boolean(manageReason), escapeText(manageReason))}</div><div class="panel-head"><div><p class="eyebrow">TEZGÂH</p><h3>Mahalle işi</h3></div></div>${shopBlock}</section>`;
}
