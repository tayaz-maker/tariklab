import { VENUES as GOLD_VENUES } from "./city.mjs";
import { getSocietyDistrictEffects } from "./society-systems.mjs";
import { underworldDistrictModifiers } from "./expansion-underworld.mjs";
import { calendarConflict, integer, REGIONS, shape } from "./expansion-world.mjs";
import { canPayHealthShift, settleHealthShift } from "./expansion-institutions.mjs";
import {
  assistLocalPatient, canPayDistrictShift, districtEconomyMetrics, economyFirmDistrict, economyLotDistrict, firmWorkday, getDistrictEmployers, settleDistrictShift,
} from "./expansion-economy.mjs";

const DAY = 1440;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
import { DISTRICTS, NEIGHBORHOODS, LOCATIONS, districtById, hubDistrict, normalizeDistrictId, routeBetween } from "./expansion-geography.mjs";
export { DISTRICTS } from "./expansion-geography.mjs";
const goldDistrict = (id) => ["kadikoy", "besiktas", "sisli"].includes(id);
export const VENUES = LOCATIONS.filter((v) => !goldDistrict(v.districtId));
const district = districtById;
const venue = (id) => VENUES.find((v) => v.id === id);
const hub = hubDistrict;
const FOOD_IDS = DISTRICTS.filter((d) => !goldDistrict(d.id)).map((d) => d.id);
const FOOD_MARKET_IDS = [...FOOD_IDS, "ankara:kizilay"];
// Each independent vendor starts with 12 meals and 1,000 TL. Restocking pays
// 30 TL per meal to an external wholesaler; no second household ledger is used.
const defaultMarket = (day) => ({ stock: 12, cash: 1000, wholesaleSpent: 0, lastDay: day });
const day = (s) => Math.floor(s.time / DAY) + 1;
const active = (s) =>
  s.expansion.family.people.some((p) => p.id === s.expansion.playerId && p.died === null);
const state = (s) =>
  (s.expansion.districts ||= {
    place: null,
    job: null,
    visits: {},
    visitDay: day(s),
    contacts: {},
  });

const foodMarket = (s, id) =>
  s.expansion.districts?.foodMarkets?.[id] ?? defaultMarket(day(s));
const canBuyMeal = (market, price) => market.stock > 0 && market.cash + price <= 1e9;

export function ensureDistrictFoodMarkets(s) {
  const data = state(s);
  return (data.foodMarkets ||= Object.fromEntries(
    FOOD_MARKET_IDS.map((id) => [id, defaultMarket(day(s))]),
  ));
}

export function buyDistrictMeal(s, id, price) {
  if (!FOOD_MARKET_IDS.includes(id)) return false;
  const market = foodMarket(s, id);
  if (!canBuyMeal(market, price)) return false;
  const markets = ensureDistrictFoodMarkets(s);
  if (!markets[id]) migrateDistricts(s);
  const vendor = markets[id] ||= market;
  vendor.stock--;
  vendor.cash += price;
  return true;
}

export function districtForLot(lotId) {
  return economyLotDistrict(lotId);
}
export function getPlace(s) {
  const regionId = s.expansion?.world.region ?? "istanbul";
  const p = s.expansion?.districts?.place;
  const id = p && district(p.districtId)?.regionId === regionId ? normalizeDistrictId(p.districtId) : regionId === "istanbul" ? s.location : hub(regionId);
  const venueId = p && district(p.districtId)?.regionId === regionId ? p.venueId : regionId === "istanbul" ? s.city?.venue || null : null;
  const location = LOCATIONS.find((v) => v.id === venueId);
  return { countryId: "tr", cityId: regionId, regionId, districtId: id, neighborhoodId: location?.neighborhoodId ?? (p?.districtId === "ankara:kizilay" || (!p && regionId === "ankara") ? "ankara:kizilay" : `${id}:game-neighborhood`), venueId };
}

export function setExpansionDistrict(s, districtId) {
  const d = district(districtId);
  s.expansion.world.region = d.regionId;
  s.city.venue = "";
  state(s).place = goldDistrict(d.id) ? null : { districtId: d.id, venueId: null };
  if (goldDistrict(d.id)) s.location = d.id;
}
// Call only after loading a copy: old market ledgers retain their balances.
export function migrateDistricts(s) {
  const x = s.expansion?.districts;
  if (!x) return;
  if (x.foodMarkets) for (const id of FOOD_IDS) x.foodMarkets[id] ||= defaultMarket(day(s));
}
export function getDistrictSimulation(s, districtId) {
  const d = district(districtId);
  if (!d || !s.expansion) return null;
  const market = s.expansion.world.regions[d.regionId];
  const modifiers = underworldDistrictModifiers(s, districtId);
  const metrics = districtEconomyMetrics(s, d.id);
  const stock = metrics.materialStock;
  const gold = s.society?.districts?.[districtId];
  const society = goldDistrict(d.id) ? getSocietyDistrictEffects(s, districtId) : {};
  const food =
    goldDistrict(d.id)
      ? (gold?.foodStock ?? 0)
      : (s.expansion.districts?.foodMarkets?.[districtId]?.stock ?? 12);
  const localIndex = {commerce: 6, services: 3, industry: 1, heritage: 2, culture: 4, residential: -3}[d.trait] || 0;
  return {
    demand: clamp(
      market.employment + localIndex + metrics.demandAdjustment + (society.demand || 0) + (modifiers.demand || 0),
      0,
      200,
    ),
    rentPressure: clamp(
      market.price + localIndex + metrics.rentAdjustment + (society.rentPressure || 0) + (modifiers.rentPressure || 0),
      0,
      200,
    ),
    foodStock: food,
    materialStock: goldDistrict(d.id) ? (gold?.materialStock ?? 0) : stock,
    jobOpenings: Math.max(0, metrics.jobOpenings),
    serviceDelay: clamp((society.serviceDelay || 0) + (modifiers.serviceDelay || 0), 0, 200),
    security: clamp(70 + (modifiers.security || 0), 0, 100),
    influence: clamp(modifiers.influence || 0, 0, 100),
  };
}
const hours = (s, v, minutes = 0) => {
  const start = s.time % DAY;
  return start >= v.hours[0] * 60 && start + minutes <= v.hours[1] * 60;
};
const careers = {
  "customer-service": { name: "Müşteri temsilcisi", traits: ["commerce", "services"],
    skill: "communication", required: 25, wage: 90, minutes: 240, energy: 11, stress: 5 },
  logistics: { name: "Lojistik görevlisi", traits: ["industry", "commerce"],
    skill: "craft", required: 25, wage: 120, minutes: 360, energy: 19, stress: 7 },
  training: { name: "Eğitim koordinatörü", traits: ["culture", "heritage"],
    skill: "knowledge", required: 30, course: "teaching", qualification: "Eğitmenlik yeterliliği gerekir.", wage: 125, minutes: 300, energy: 14, stress: 5 },
  finance: { name: "Finans görevlisi", traits: ["commerce", "services"],
    skill: "knowledge", required: 30, course: "finance", qualification: "Bütçe yeterliliği gerekir.", firmType: "digital", wage: 115, minutes: 270, energy: 12, stress: 6 },
  health: { name: "Sağlık hizmetleri destek görevlisi", municipal: true,
    skill: "knowledge", required: 30, course: "health-support", qualification: "Sağlık hizmetleri yeterliliği gerekir.", wage: 75, minutes: 240, energy: 13, stress: 6 },
};
const healthEmployer = "Belediye sağlık hizmetleri";
const municipalHealthId = (regionId) => `${regionId}:public-health`;
const baseWage = (s, region, role) => Math.floor(
  REGIONS[region].wage * s.expansion.world.regions[region].employment * (role?.wage ?? 100) / 10000,
);
const jobQuote = (firm, wage) => `${firm.name} · ücret ${wage} TL / vardiya.`;
function shiftTerms(s, p, job) {
  const role = careers[job.role];
  const skill = role?.skill ?? (job.firmId.endsWith(":repair") ? "craft"
    : job.firmId.endsWith(":digital") ? "technical" : "knowledge");
  const pay = baseWage(s, p.regionId, role) +
    Math.min(Math.floor(job.shifts / 5), Math.floor(s.player.skills[skill] / 10)) * 25;
  return { role, skill, pay, minutes: role?.minutes ?? 360 };
}
export function nextDistrictShiftAt(s) {
  const job = s.expansion.districts?.job;
  if (!job) return null;
  const p = getPlace(s), workplace = LOCATIONS.find(v => v.id === p.venueId);
  if (p.districtId !== normalizeDistrictId(job.districtId) || workplace?.kind !== (careers[job.role]?.municipal ? "institution" : "work")) return null;
  const minutes = shiftTerms(s, p, job).minutes;
  for (let offset = 0; offset < 8; offset++) {
    const currentDay = day(s) + offset;
    if (!firmWorkday(p.regionId, currentDay) || job.lastShiftDay === currentDay) continue;
    const opening = (currentDay - 1) * DAY + workplace.hours[0] * 60;
    const start = Math.max(s.time, opening);
    if (start + minutes <= (currentDay - 1) * DAY + workplace.hours[1] * 60)
      return start > s.time ? start : null;
  }
  return null;
}
const employer = (s, p, wage, role) => {
  if (role?.municipal) return canPayHealthShift(s, wage) ? {id: municipalHealthId(p.regionId), name: healthEmployer} : null;
  const firmType = role?.firmType;
  const reserve = Math.round((105 * s.expansion.world.regions[p.regionId].price) / 100);
  return getDistrictEmployers(s,p.districtId).find(({firm,vacancies,type}) =>
    (!firmType || type === firmType) && vacancies > 0 && firm.status === "open" && firm.cash >= wage + reserve * firm.workers * 4);
};
const make = (
  id,
  label,
  description,
  minutes,
  cost,
  reason,
  run = () => "Yolculuk tamamlandı.",
) => ({
  id,
  label,
  description,
  category: "world",
  pay: "total",
  minutes,
  cost,
  disabled: !!reason,
  reason,
  run,
});
const inTransit = (s) => {
  s._transit = true;
  return "Yolculuk tamamlandı.";
};
export function districtActions(s, api) {
  const p = getPlace(s);
  const actions = [];
  for (const target of DISTRICTS.filter(
    (d) => d.regionId === p.regionId && d.id !== p.districtId && !(goldDistrict(p.districtId) && goldDistrict(d.id)),
  )) {
    const route = routeBetween(s, p.venueId || p.districtId, target.id);
    const { minutes, cost } = route;
    actions.push(
      make(
        `district:travel:${target.id}`,
        `${target.name} semtine git`,
        "Toplu taşıma ile semt merkezine yolculuk.",
        minutes,
        cost,
        calendarConflict(s, minutes) || route.reason || (s.player.energy < 10 ? "Yolculuk için enerji gerekir." : ""),
        inTransit,
      ),
    );
  }
  for (const v of VENUES.filter((v) => v.districtId === p.districtId && v.id !== p.venueId)) {
    const route = routeBetween(s, p.venueId || p.districtId, v.id, { mode: "walk" });
    const minutes = route.minutes,
      used =
        s.expansion.districts?.visitDay === day(s) ? s.expansion.districts.visits[v.id] || 0 : 0;
    const reason =
      calendarConflict(s, minutes) || route.reason ||
      (!hours(s, v, minutes)
        ? "Mekân bu saatte kapalı."
        : used >= v.capacity
          ? "Mekânın günlük kapasitesi dolu."
          : s.player.energy < 5
            ? "Yolculuk için enerji gerekir."
            : "");
    actions.push(
      make(
        `district:visit:${v.id}`,
        `${v.neighborhoodId === "ankara:kizilay" ? "Kızılay · " : ""}${v.name} ziyaret et`,
        `Yürüyüş · ${String(v.hours[0]).padStart(2,"0")}:00–${String(v.hours[1]).padStart(2,"0")}:00 · günlük kapasite geçerlidir.`,
        minutes,
        0,
        reason,
        inTransit,
      ),
    );
  }
  if (venue(p.venueId)?.kind === "social") {
    const residents = (api.regionalResidents?.(s, p.regionId) || []).filter(
      (person) =>
        person.health > 0 && person.presentDistrictId === p.districtId && (!person.socialVenueId || person.socialVenueId === p.venueId),
    );
    for (const person of residents) {
      const { id, name } = person;
      const reason =
        calendarConflict(s, 45) ||
        (!hours(s, venue(p.venueId), 45)
          ? "Mekân bu saatte kapalı."
          : s.time % DAY < 18 * 60 || (s.time % DAY) + 45 > 21 * 60
            ? "Sakin burada 18:00–21:00 arasında bulunur."
            : s.expansion.districts?.contacts?.[id]?.lastDay === day(s)
              ? "Bugün zaten görüştünüz."
              : "");
      actions.push(
        make(
          `district:meet:${id}`,
          `${name} ile sohbet et`,
          "Yerel bir sakinle bağ kur; her görüşme 45 dakika sürer.",
          45,
          0,
          reason,
          () => "Mahalle sohbeti tamamlandı.",
        ),
      );
    }
  }
  const workplace = LOCATIONS.find((v) => v.id === p.venueId);
  const institution = workplace?.kind === "institution";
  const job = s.expansion.districts?.job;
  const wage = baseWage(s, p.regionId);
  const firm = employer(s, p, wage);
  if (workplace?.kind === "work" || institution) {
    const base =
      calendarConflict(s, 30) || (!hours(s, workplace, 30) ? "Mekân bu saatte kapalı." : "");
    if (!institution && (s.expansion.lifePath || venue(p.venueId))) actions.push(
      make(
        "district:apply",
        "Yerel işe başvur",
        firm ? jobQuote(firm, wage) : "İşletmeyle kalıcı sözleşme kur; ücret işverenin kasasından ödenir.",
        30,
        0,
        base ||
          (getDistrictSimulation(s, p.districtId).jobOpenings < 1
            ? "Bu semtte açık iş olanağı yok."
            : job || s.job
              ? "Zaten bir yerel sözleşmen var."
              : !firm
                ? "Ücret ayırabilen açık bir yerel işletme yok."
                : ""),
        () => "İş başvurusu tamamlandı.",
      ),
    );
    if (!job && !s.job) {
      for (const [id, role] of Object.entries(careers)) {
        if (!!role.municipal !== institution || (role.traits && !role.traits.includes(district(p.districtId).trait))) continue;
        const pay = baseWage(s, p.regionId, role);
        const hiring = employer(s, p, pay, role);
        if ((role.firmType || institution) && !hiring) continue;
        const reason = base || (s.player.skills[role.skill] < role.required
          ? (role.skill === "communication" ? "İletişim 25 gerekir."
            : role.skill === "craft" ? "Zanaat 25 gerekir." : "Bilgi 30 gerekir.")
          : role.course && !s.expansion.institutions.qualifications.some(({ course }) => course === role.course)
            ? role.qualification
            : !hiring ? "Ücret ayırabilen açık bir yerel işletme yok." : "");
        actions.push({ ...make(
          `district:apply:${id}`, role.name,
          role.firmType || institution ? jobQuote(hiring, pay) : `Ücret: ${pay} TL · Her beş vardiyada ilerleme.`,
          30, 0, reason, () => "İş başvurusu tamamlandı.",
        ), category: "work" });
      }
    }
    if (job && !!careers[job.role]?.municipal === institution) {
      const { role, pay, minutes } = shiftTerms(s, p, job);
      const why =
        calendarConflict(s, minutes) ||
        (!hours(s, workplace, minutes)
          ? "Mekân bu saatte kapalı."
          : normalizeDistrictId(job.districtId) !== p.districtId
            ? "Vardiya sözleşmendeki semtte yapılır."
            : !firmWorkday(p.regionId, day(s))
              ? "Bu işveren bugün vardiya yapmıyor."
            : job.lastShiftDay === day(s)
              ? "Bugünkü vardiyan tamamlandı."
              : institution && s.player.health < 55
                ? "Sağlık durumun bu iş için uygun değil."
              : s.player.energy < 30
                ? "Vardiya için enerji gerekir."
                : !(institution ? canPayHealthShift(s, pay) : canPayDistrictShift(s, job.firmId, pay))
                  ? "İşverenin ücret için yeterli kaynağı yok."
                  : s.bank + pay > 1e9
                    ? "Banka bakiyesi sınırına ulaştın."
                    : "");
      actions.push(
        make(
          "district:shift",
          role?.name ?? "Sözleşmeli vardiya",
          `Ücret: ${pay} TL · Her beş vardiyada ilerleme.`,
          minutes,
          0,
          why,
          () => "Vardiya tamamlandı.",
        ),
      );
      actions.push(
        make(
          "district:quit",
          "Yerel işten ayrıl",
          "Sözleşmeyi sonlandır.",
          15,
          0,
          calendarConflict(s, 15),
          () => "İş sözleşmesi sona erdi.",
        ),
      );
    }
  }
  return actions.map((a) =>
    !a.disabled && s.cash + s.bank < a.cost
      ? { ...a, disabled: true, reason: "Bu yolculuk için yeterli bakiye yok." }
      : a,
  );
}
export function adaptDistrictActions(s, actions, api) {
  const p = getPlace(s);
  const kind = venue(p.venueId)?.kind;
  return actions.map((a) => {
    if (goldDistrict(p.districtId) && a.category === "travel" && a.route && a.destination) {
      const mode = a.route.mode;
      const quote = routeBetween(s, p.venueId || p.districtId, a.venue || a.destination, {mode});
      if (!quote) return {...a, disabled:true, reason:"Bu ulaşım türüyle güzergâh yok."};
      const targetVenue = a.venue && LOCATIONS.find((v) => v.id === a.venue);
      const why = calendarConflict(s, quote.minutes) || quote.reason ||
        (mode === "walk" && s.player.energy < 20 ? "Ücretsiz güzergâh için en az 20 enerji gerekir." : "");
      return {...a, pay:"total", minutes:quote.minutes, cost:quote.cost,
        route:{...a.route,minutes:quote.minutes,cost:quote.cost,available:quote.available,reason:quote.reason,legs:quote.legs},
        description:`Ortak güzergâh · ${quote.minutes} dk · ${quote.cost} TL.${targetVenue ? ` Açık ${String(targetVenue.hours[0]).padStart(2,"0")}:00–${String(targetVenue.hours[1]).padStart(2,"0")}:00.` : ""}`, disabled:!!why, reason:why,
        run(next) {
          next.city.lastRoute={from:next.location,to:a.destination,mode,minutes:quote.minutes,cost:quote.cost,at:next.time};
          next.city.visits[a.destination]++;
          if (next.location !== a.destination) next.flags.travels++;
          if (mode === "walk" && next.location !== a.destination) api.change(next,{energy:-12});
          return "Yolculuk tamamlandı.";
        }};
    }
    let reason = "";
    if (a.id.startsWith("world:move:"))
      reason = calendarConflict(s, a.minutes + 360)
        ? "Taşınma ve dönüş süresi ajandandaki bir planla çakışıyor."
        : "";
    else if (a.id.startsWith("apply:") && s.expansion.districts?.job)
      reason = "Zaten bir yerel sözleşmen var.";
    else if (goldDistrict(p.districtId)) return a;
    else if (a.id === "world:meal" && kind !== "social")
      reason = "Yemek için mahalle buluşma yerine git.";
    else if (a.id.startsWith("institution:") && kind !== "institution")
      reason = "Bu hizmet için kamu merkezine git.";
    else if (/^economy:[^:]+:(ankara|izmir):(room|studio|apartment)$/.test(a.id)) {
      const lot = a.id.split(":").slice(-2).join(":");
      if (kind !== "housing" || districtForLot(lot) !== p.districtId)
        reason = "Konut işlemleri için ilgili semtin konut ofisine git.";
    }
    if (!reason && /^(world:meal|institution:|economy:)/.test(a.id) && kind)
      reason =
        calendarConflict(s, a.minutes) ||
        (!hours(s, venue(p.venueId), a.minutes) ? "Mekân bu saatte kapalı." : "");
    if (!reason && a.id === "world:meal") {
      const marketId = p.neighborhoodId === "ankara:kizilay" ? "ankara:kizilay" : p.districtId;
      if (s.cash + s.bank < a.cost) reason = "Yemek için yeterli bakiye yok.";
      else if (!canBuyMeal(foodMarket(s, marketId), a.cost)) reason = "Bu semtte yemek için stok yok.";
      else {
        const run = a.run;
        return {
          ...a,
          run(next) {
            buyDistrictMeal(next, marketId, a.cost);
            return run(next);
          },
        };
      }
    }
    return reason ? { ...a, disabled: true, reason } : a;
  });
}
export function afterDistrictAction(s, id, before, api) {
  delete s._transit;
  const alive = active(s);
  const oldPerson = before.expansion.playerId;
  if (s.expansion.districts && (!alive || oldPerson !== s.expansion.playerId)) {
    s.expansion.districts.job = null;
    s.expansion.districts.contacts = {};
  }
  if (!alive || oldPerson !== s.expansion.playerId)
    return /^(district:|world:move:)/.test(id) ? "Yaşam sona erdi; eylem tamamlanmadı." : undefined;
  if (id.startsWith("world:move:")) {
    const to = id.slice("world:move:".length),
      from = before.expansion.world.region;
    if (!REGIONS[to] || to === from) return;
    if (s.job) api.settleCareer(s);
    s.city.venue = "";
    s.expansion.world.region = to;
    if (to === "istanbul") s.location = hub("istanbul");
    if (s.expansion.districts) {
      s.expansion.districts.place = null;
      s.expansion.districts.job = null;
    }
    api.expansionEvent(s, "relocation", to, from);
    return;
  }
  if (!id.startsWith("district:")) return;
  const data = state(s),
    p = getPlace(before);
  if (id.startsWith("district:travel:")) {
    const destination = id.slice("district:travel:".length);
    data.place = goldDistrict(destination) ? null : { districtId: destination, venueId: null };
    if (goldDistrict(destination)) { s.location = destination; s.city.venue = ""; }
    api.change(s, { energy: -5 });
  } else if (id.startsWith("district:visit:")) {
    const destination = id.slice("district:visit:".length);
    data.place = { districtId: p.districtId, venueId: destination };
    if (data.visitDay !== day(s)) {
      data.visitDay = day(s);
      data.visits = {};
    }
    data.visits[destination] = (data.visits[destination] || 0) + 1;
    api.change(s, { energy: -2 });
  } else if (id.startsWith("district:meet:")) {
    const resident = id.slice("district:meet:".length);
    const person = api.regionalResidents(s, p.regionId).find((person) => person.id === resident);
    if (!person || person.health <= 0) return "Sakin ayrıldı; görüşme tamamlanmadı.";
    const generation = person.generation;
    const old = data.contacts[resident];
    data.contacts[resident] = {
      score: Math.min(100, (old?.generation === generation ? old.score : 0) + 5),
      lastDay: day(before),
      generation,
      name: person.name,
    };
    api.change(s, { stress: -3 });
  } else if (id === "district:apply" || id.startsWith("district:apply:")) {
    const role = id.split(":")[2];
    const wage = baseWage(before, p.regionId, careers[role]);
    const firm = employer(before, p, wage, careers[role]);
    if (firm)
      data.job = {
        personId: s.expansion.playerId,
        firmId: firm.id,
        districtId: p.districtId,
        shifts: 0,
        lastShiftDay: 0,
        ...(role ? { role } : {}),
      };
  } else if (id === "district:shift" && data.job) {
    const job = data.job,
      workDay = day(before);
    const { role, skill, pay } = shiftTerms(before, p, job);
    if (
      firmWorkday(p.regionId, workDay) &&
      s.bank + pay <= 1e9 &&
      (role?.municipal ? settleHealthShift(s, pay) : settleDistrictShift(s, job.firmId, pay))
    ) {
      job.shifts = Math.min(1000, job.shifts + 1);
      api.skill(s, skill, 1);
      job.lastShiftDay = workDay;
      s.flags.workDays++;
      api.receive(s, pay, "Yerel vardiya", "bank");
      api.change(s, { energy: -(role?.energy ?? 17), stress: role?.stress ?? 7 });
      if (role?.municipal && assistLocalPatient(s, api, p)) return "Bir sakin tedavi gördü.";
      if (role && job.shifts === 5) {
        // The first career milestone strengthens one existing, physically present coworker tie.
        const coworker = api.regionalResidents(before, p.regionId).find((person) =>
          person.employer === job.firmId && person.districtId === p.districtId && person.locationId === p.venueId &&
          data.contacts[person.id]?.generation === person.generation);
        if (coworker) {
          const contact = data.contacts[coworker.id];
          if (contact.score < 100) {
            contact.score = Math.min(100, contact.score + 2);
            return "İş arkadaşlığı güçlendi.";
          }
        }
      }
    } else return "İşveren ödeme yapamadı; vardiya tamamlanmadı.";
  } else if (id === "district:quit") data.job = null;
}
export function restockDistrictMeals(s) {
  const today = day(s);
  for (const market of Object.values(s.expansion.districts?.foodMarkets ?? {})) {
    if (market.lastDay >= today) continue;
    // Low shelves trigger a larger order only when the vendor can pay for it.
    const deliveryLimit = market.stock <= 8 ? 4 : 2;
    const units = Math.min(
      deliveryLimit * (today - market.lastDay),
      24 - market.stock,
      Math.floor(market.cash / 30),
      Math.floor((1e9 - market.wholesaleSpent) / 30),
    );
    market.stock += units;
    market.cash -= units * 30;
    market.wholesaleSpent += units * 30;
    market.lastDay = today;
  }
}

export function tickDistricts(s) {
  if (!s.expansion.districts) return;
  if (!active(s)) {
    s.expansion.districts.job = null;
    s.expansion.districts.contacts = {};
  }
  for (const [id, contact] of Object.entries(s.expansion.districts.contacts))
    if (s.expansion.economy.residents[id]?.life?.generation !== contact.generation)
      delete s.expansion.districts.contacts[id];
}
export function validateDistricts(s) {
  const x = s.expansion.districts;
  if (x === undefined) return true;
  const today = day(s);
  if (
    !x ||
    typeof x !== "object" ||
    Array.isArray(x) ||
    ![
      "contacts,job,place,visitDay,visits",
      "contacts,foodMarkets,job,place,visitDay,visits",
    ].includes(Object.keys(x).sort().join(",")) ||
    !integer(x.visitDay, 1, today) ||
    !x.visits ||
    typeof x.visits !== "object" ||
    Array.isArray(x.visits)
  )
    return false;
  if (
    x.foodMarkets !== undefined &&
    (!x.foodMarkets ||
      typeof x.foodMarkets !== "object" ||
      Array.isArray(x.foodMarkets) ||
      ![FOOD_IDS, FOOD_MARKET_IDS, ["ankara:kizilay", "ankara:cankaya", "izmir:konak", "izmir:bornova"]].some((ids) => ids.length === Object.keys(x.foodMarkets).length && ids.every((id) => Object.hasOwn(x.foodMarkets,id))) ||
      Object.values(x.foodMarkets).some((m) => !shape(m, {
        lastDay: [1, today], stock: 24, "cash wholesaleSpent": 1e9,
      }, 1)))
  )
    return false;
  if (
    !x.contacts ||
    typeof x.contacts !== "object" ||
    Array.isArray(x.contacts) ||
    Object.entries(x.contacts).some(
      ([id, n]) =>
        !s.expansion.economy.residents[id] ||
        !shape(n, { "name generation": null, score: [1, 100], lastDay: today }, 1) ||
        typeof n.name !== "string" ||
        n.name.length < 1 ||
        n.name.length > 80 ||
        !integer(n.generation, 1, Infinity) ||
        n.generation !== s.expansion.economy.residents[id].life.generation,
    )
  )
    return false;
  if (
    Object.entries(x.visits).some(
      ([id, n]) => !venue(id) || !integer(n, 1, venue(id).capacity),
    )
  )
    return false;
  if (
    x.place !== null &&
    (!x.place ||
      Object.keys(x.place).sort().join(",") !== "districtId,venueId" ||
      !district(x.place.districtId) ||
      district(x.place.districtId).regionId !== s.expansion.world.region ||
      goldDistrict(x.place.districtId) ||
      (x.place.venueId !== null && venue(x.place.venueId)?.districtId !== normalizeDistrictId(x.place.districtId)))
  )
    return false;
  const j = x.job;
  return (
    j === null ||
    (!!j &&
      Object.keys(j).sort().join(",") ===
        `districtId,firmId,lastShiftDay,personId,${Object.hasOwn(j, "role") ? "role," : ""}shifts` &&
      (!Object.hasOwn(j, "role") || (Object.hasOwn(careers, j.role) &&
        (!careers[j.role].traits || careers[j.role].traits.includes(district(j.districtId)?.trait)))) &&
      (j.role !== "finance" || (j.firmId.endsWith(":digital") && economyFirmDistrict(j.firmId) === normalizeDistrictId(j.districtId))) &&
      j.personId === s.expansion.playerId &&
      active(s) &&
      district(j.districtId)?.regionId === s.expansion.world.region &&
      j.firmId.startsWith(`${s.expansion.world.region}:`) &&
      (j.role === "health" ? j.firmId === municipalHealthId(s.expansion.world.region) &&
        LOCATIONS.some((v) => v.kind === "institution" && v.districtId === normalizeDistrictId(j.districtId)) &&
        s.expansion.institutions.qualifications.some(({course}) => course === careers.health.course)
        : !!s.expansion.economy.firms[j.firmId]) &&
      integer(j.shifts, 0, 1000) &&
      integer(j.lastShiftDay, 0, today))
  );
}
export function districtView(s) {
  const place = getPlace(s);
  const job = s.expansion.districts?.job;
  return {
    place,
    nearestInstitution: (() => {
      const choices = VENUES.filter((v) => v.kind === "institution" && district(v.districtId)?.regionId === place.regionId)
        .map((v) => ({...v, route:routeBetween(s, place.venueId || place.districtId, v.id)}))
        .filter((v) => v.route).sort((a,b) => a.route.minutes-b.route.minutes);
      const v=choices[0];
      return v ? {districtId:v.districtId,districtName:district(v.districtId).name,name:v.name,hours:v.hours,minutes:v.route.minutes,cost:v.route.cost,available:v.route.available,reason:v.route.reason} : null;
    })(),
    neighborhoods: NEIGHBORHOODS,
    districts: DISTRICTS.map((d) => ({
      ...d,
      simulation: getDistrictSimulation(s, d.id),
      venues:
        goldDistrict(d.id)
          ? GOLD_VENUES.filter((v) => v.district === d.id).map(({ id, name, kind }) => ({
              id,
              name,
              kind,
              districtId: d.id,
              neighborhoodId: `${d.id}:game-neighborhood`,
            }))
          : VENUES.filter((v) => v.districtId === d.id),
    })),
    contacts: Object.values(s.expansion.districts?.contacts || {}).map((contact) => ({
      name: contact.name,
      score: contact.score,
      lastDay: contact.lastDay,
    })),
    job: job ? { ...job, ...(job.role ? { roleName: careers[job.role].name } : {}),
      ...(job.role === "health" ? { employerName: healthEmployer } : {}) } : null,
  };
}
const translations = {
  "İş arkadaşlığı güçlendi.": ["Coworker bond grew.", "Więź w pracy się wzmocniła."],
  "Bu işveren bugün vardiya yapmıyor.": ["This employer has no shifts today.", "Ten pracodawca nie ma dziś zmian."],
  "Müşteri temsilcisi": ["Customer service representative", "Specjalista obsługi klienta"],
  "Lojistik görevlisi": ["Logistics clerk", "Pracownik logistyki"],
  "Eğitim koordinatörü": ["Training coordinator", "Koordynator szkoleń"],
  "Finans görevlisi": ["Finance clerk", "Pracownik ds. finansów"],
  "Sağlık hizmetleri destek görevlisi": ["Health services aide", "Asystent usług zdrowotnych"],
  "Belediye sağlık hizmetleri": ["Municipal health services", "Miejskie usługi zdrowotne"],
  "Sağlık hizmetleri yeterliliği gerekir.": ["Requires a health services qualification.", "Wymagane kwalifikacje w usługach zdrowotnych."],
  "Bir sakin tedavi gördü.": ["A resident received treatment.", "Mieszkaniec otrzymał leczenie."],
  "Bütçe yeterliliği gerekir.": ["Requires a budgeting qualification.", "Wymagane kwalifikacje budżetowe."],
  "İletişim 25 gerekir.": ["Requires Communication 25.", "Wymagana komunikacja 25."],
  "Zanaat 25 gerekir.": ["Requires Craft 25.", "Wymagane rzemiosło 25."],
  "Bilgi 30 gerekir.": ["Requires Knowledge 30.", "Wymagana wiedza 30."],
  "Eğitmenlik yeterliliği gerekir.": ["Requires a teaching qualification.", "Wymagane kwalifikacje trenerskie."],
  "Bu ulaşım türüyle güzergâh yok.": ["No route is available by this mode.", "Brak trasy dla tego środka transportu."],
  "Ulaşım 06:00–24:00 arasında çalışır.": ["Transit runs from 06:00 to 24:00.", "Transport kursuje od 06:00 do 24:00."],
  "Üretim atölyesi": ["Production workshop", "Warsztat produkcyjny"],
  "Ticaret merkezi": ["Trade centre", "Centrum handlowe"],
  "Kültür atölyesi": ["Cultural workshop", "Warsztat kultury"],
  "Miras atölyesi": ["Heritage workshop", "Warsztat dziedzictwa"],
  "Hizmet merkezi": ["Service centre", "Centrum usług"],
  "Yerel iş merkezi": ["Local work centre", "Lokalne centrum pracy"],
  "Konut ofisi": ["Housing office", "Biuro mieszkaniowe"],
  "İş merkezi": ["Work centre", "Centrum pracy"],
  "Kamu merkezi": ["Public services centre", "Centrum usług publicznych"],
  "Mahalle buluşma yeri": ["Community meeting place", "Miejsce spotkań"],
  "Toplu taşıma ile semt merkezine yolculuk.": [
    "Travel to the district centre by transit.",
    "Podróż komunikacją do centrum dzielnicy.",
  ],
  "Yürüyüş · açık saatler ve günlük kapasite geçerlidir.": [
    "Walk · opening hours and daily capacity apply.",
    "Spacer · obowiązują godziny otwarcia i dzienny limit.",
  ],
  "Taşınma ve dönüş süresi ajandandaki bir planla çakışıyor.": [
    "The move and return trip conflict with a calendar commitment.",
    "Przeprowadzka i podróż powrotna kolidują z planem.",
  ],
  "Bu süre ajandandaki bir planla çakışıyor.": [
    "This overlaps a calendar commitment.",
    "Ten czas koliduje z planem w kalendarzu.",
  ],
  "Bu yolculuk için yeterli bakiye yok.": [
    "Insufficient funds for this journey.",
    "Brak środków na podróż.",
  ],
  "Yemek için yeterli bakiye yok.": ["Insufficient funds for a meal.", "Brak środków na posiłek."],
  "Yolculuk için enerji gerekir.": [
    "You need energy to travel.",
    "Potrzebujesz energii na podróż.",
  ],
  "Mekân bu saatte kapalı.": ["The venue is closed at this time.", "Miejsce jest teraz zamknięte."],
  "Mekânın günlük kapasitesi dolu.": [
    "The venue has reached its daily capacity.",
    "Dzienny limit miejsc został wyczerpany.",
  ],
  "Yerel işe başvur": ["Apply for a local job", "Złóż podanie o lokalną pracę"],
  "İşletmeyle kalıcı sözleşme kur; ücret işverenin kasasından ödenir.": [
    "Sign an ongoing contract; wages come from the employer’s funds.",
    "Podpisz umowę; wynagrodzenie pochodzi ze środków pracodawcy.",
  ],
  "Zaten bir yerel sözleşmen var.": [
    "You already have a local contract.",
    "Masz już lokalną umowę.",
  ],
  "Ücret ayırabilen açık bir yerel işletme yok.": [
    "No open local firm can fund wages.",
    "Żadna otwarta firma nie może opłacić wynagrodzenia.",
  ],
  "Sözleşmeli vardiya": ["Contract shift", "Zmiana w ramach umowy"],
  "Vardiya sözleşmendeki semtte yapılır.": [
    "Your shift is in the district in your contract.",
    "Zmiana odbywa się w dzielnicy wskazanej w umowie.",
  ],
  "Bugünkü vardiyan tamamlandı.": [
    "You already worked today.",
    "Dzisiejsza zmiana jest już zakończona.",
  ],
  "Vardiya için enerji gerekir.": [
    "You need energy for a shift.",
    "Potrzebujesz energii na zmianę.",
  ],
  "İşverenin ücret için yeterli kaynağı yok.": [
    "Your employer lacks funds for wages.",
    "Pracodawca nie ma środków na wynagrodzenie.",
  ],
  "Banka bakiyesi sınırına ulaştın.": [
    "Your bank balance has reached its limit.",
    "Osiągnięto limit salda bankowego.",
  ],
  "Yerel işten ayrıl": ["Leave local job", "Odejdź z lokalnej pracy"],
  "Sözleşmeyi sonlandır.": ["End the contract.", "Zakończ umowę."],
  "Yerel sözleşme için iş merkezine git.": [
    "Visit the work centre for a local contract.",
    "Odwiedź centrum pracy, aby zawrzeć lokalną umowę.",
  ],
  "Yemek için mahalle buluşma yerine git.": [
    "Visit the community meeting place for a meal.",
    "Odwiedź miejsce spotkań, aby zjeść posiłek.",
  ],
  "Bu hizmet için kamu merkezine git.": [
    "Visit the public services centre for this service.",
    "Udaj się do centrum usług publicznych.",
  ],
  "Konut işlemleri için ilgili semtin konut ofisine git.": [
    "Visit the housing office for housing matters.",
    "Udaj się do biura mieszkaniowego.",
  ],
  "Sakin burada 18:00–21:00 arasında bulunur.": [
    "The resident is here from 18:00 to 21:00.",
    "Mieszkaniec jest tu od 18:00 do 21:00.",
  ],
  "Bugün zaten görüştünüz.": ["You already met today.", "Spotkaliście się już dzisiaj."],
  "Bu semtte yemek için stok yok.": [
    "No meal stock is available in this district.",
    "W tej dzielnicy brak zapasów na posiłek.",
  ],
  "Bu semtte açık iş olanağı yok.": [
    "There are no openings in this district.",
    "W tej dzielnicy nie ma ofert pracy.",
  ],
  "Yerel bir sakinle bağ kur; her görüşme 45 dakika sürer.": [
    "Build a relationship with a local resident; each meeting takes 45 minutes.",
    "Buduj relację z mieszkańcem; spotkanie trwa 45 minut.",
  ],
  "Mahalle sohbeti tamamlandı.": [
    "Community conversation completed.",
    "Rozmowa sąsiedzka zakończona.",
  ],
  "Yaşam sona erdi; eylem tamamlanmadı.": [
    "Life ended; the action was not completed.",
    "Życie dobiegło końca; czynność nie została ukończona.",
  ],
  "İşveren ödeme yapamadı; vardiya tamamlanmadı.": [
    "The employer could not pay; the shift was not completed.",
    "Pracodawca nie mógł zapłacić; zmiana nie została ukończona.",
  ],
  "Sakin ayrıldı; görüşme tamamlanmadı.": [
    "The resident left; the meeting was not completed.",
    "Mieszkaniec wyszedł; spotkanie nie zostało ukończone.",
  ],
  "Yolculuk tamamlandı.": ["Journey completed.", "Podróż zakończona."],
  "İş başvurusu tamamlandı.": ["Job application completed.", "Złożono podanie o pracę."],
  "Vardiya tamamlandı.": ["Shift completed.", "Zmiana zakończona."],
  "İş sözleşmesi sona erdi.": ["Employment contract ended.", "Umowa o pracę zakończona."],
};
export function localizeDistrictText(text, language) {
  if (typeof text !== "string" || !["en", "pl"].includes(language)) return text;
  const i = language === "en" ? 0 : 1;
  if (translations[text]) return translations[text][i];
  let m = /^(.+) · (mahalle kafesi|eğitim merkezi|iş merkezi|mahalle meydanı)$/.exec(text);
  if (m) {
    const kinds = {
      "mahalle kafesi": ["neighborhood café", "kawiarnia sąsiedzka"],
      "eğitim merkezi": ["learning centre", "centrum nauki"],
      "iş merkezi": ["work centre", "centrum pracy"],
      "mahalle meydanı": ["community square", "plac sąsiedzki"],
    };
    return `${m[1]} · ${kinds[m[2]][i]}`;
  }
  m = /^Ortak güzergâh · (\d+) dk · (\d+) TL\.(?: Açık (\d\d):00–(\d\d):00\.)?$/.exec(text);
  if (m) return i ? `Wspólna trasa · ${m[1]} min · ${m[2]} TL.${m[3] ? ` Otwarte ${m[3]}:00–${m[4]}:00.` : ""}` : `Shared route · ${m[1]} min · ${m[2]} TL.${m[3] ? ` Open ${m[3]}:00–${m[4]}:00.` : ""}`;
  m = /^Yürüyüş · (\d\d):00–(\d\d):00 · günlük kapasite geçerlidir\.$/.exec(text);
  if (m) return i ? `Spacer · ${m[1]}:00–${m[2]}:00 · obowiązuje dzienny limit.` : `Walk · ${m[1]}:00–${m[2]}:00 · daily capacity applies.`;
  m = /^(.+) ile sohbet et$/.exec(text);
  if (m) return i ? `Porozmawiaj z ${m[1]}` : `Talk with ${m[1]}`;
  m = /^(.+) semtine git$/.exec(text);
  if (m) return i ? `Jedź do dzielnicy ${m[1]}` : `Travel to ${m[1]}`;
  m = /^(Kızılay · )?(.+) ziyaret et$/.exec(text);
  if (m) return `${m[1] ?? ""}${i ? "Odwiedź: " : "Visit "}${localizeDistrictText(m[2], language)}`;
  m = /^(.+) · ücret (\d+) TL \/ vardiya\.$/.exec(text);
  if (m) return i ? `${m[1]} · płaca ${m[2]} TL / zmiana.` : `${m[1]} · pay ${m[2]} TL / shift.`;
  m = /^Ücret: (\d+) TL · Her beş vardiyada ilerleme\.$/.exec(text);
  if (m)
    return i
      ? `Płaca: ${m[1]} TL · Awans co pięć zmian.`
      : `Pay: ${m[1]} TL · Progress after every five shifts.`;
  return text;
}
