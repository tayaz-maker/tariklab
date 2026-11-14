import { shape, integer } from "./expansion-world.mjs";
import { HOMES, NPCS } from "./content.mjs";
import { BUSINESS_TYPES } from "./deep-content.mjs";
import { closeHousehold, syncLifeHousing } from "./life-systems.mjs";
import { SOCIETY_COPY } from "./society-content.mjs";
import { REGIONS as CITIES, migratePopulation } from "./expansion-world.mjs";
import { getDistrictSimulation, getPlace } from "./expansion-districts.mjs";
import { residentServiceQuote } from "./expansion-institutions.mjs";
import {
  DISTRICTS, LOCATIONS, cityDistricts, districtById, hubDistrict, normalizeDistrictId, routeBetween,
} from "./expansion-geography.mjs";

const DAY = 1440;
const MAX = 1_000_000_000;
const REGIONS = Object.keys(CITIES);
const HOUSEHOLD = "household";
const MARKET = "market";
const homes = HOMES.slice(1);
const citizens = new Set(NPCS.map(({ id }) => id));
const legacyHomes = REGIONS.flatMap((region, regionIndex) =>
  homes.map((home, index) => ({
    id: `${region}:${home.id}`,
    name: `${CITIES[region].name} · ${["Oda", "Stüdyo", "Daire"][index]}`,
    region,
    anchor: home.id,
    districtId: region === "istanbul" ? home.district
      : region === "ankara" ? "ankara:cankaya"
      : index === 0 ? "izmir:konak" : "izmir:bornova",
    base: ([47000, 68000, 97000][index] * [100, 79, 90][regionIndex]) / 100,
    rent: Math.round((home.rent * [76, 62, 69][regionIndex]) / 100),
    index,
  })),
);
const secondaryRegions = REGIONS.slice(1);
const residentNames = [
  "Deniz Aydın",
  "Seda Yalçın",
  "Emre Koç",
  "Defne Akın",
  "Ece Uçar",
  "Bora Kaya",
];
const legacyResidents = secondaryRegions.flatMap((region) =>
  BUSINESS_TYPES.map((type, index) => ({
    id: `resident:${region}:${index}`,
    region,
    type,
  })),
);
const legacyFirms = REGIONS.flatMap((region, city) =>
  BUSINESS_TYPES.map((type, index) => ({
    id: `${region}:${type.id}`,
    region,
    type,
    districtId: legacyHomes[city * homes.length + index].districtId,
    name: [
      ["Moda Tamir", "Pera Dijital", "Kuzguncuk Eğitim"],
      ["Çankaya Tamir", "Ostim Dijital", "Bahçeli Eğitim"],
      ["Kemeraltı Tamir", "Alsancak Dijital", "Bostanlı Eğitim"],
    ][city][index],
  })),
);
const newDistricts = DISTRICTS.filter((d) => !legacyHomes.some((lot) => lot.districtId === d.id));
const typeForTrait = { commerce: 1, services: 1, culture: 2, heritage: 2, residential: 2, industry: 0 };
const districtFirms = newDistricts.map(({ id, regionId, name, trait }) => {
  const index = typeForTrait[trait];
  const type = BUSINESS_TYPES[index];
  return {
    id: `${id}:${type.id}`, type, region: regionId, districtId: id,
    name: `${name} · ${["Onarım Atölyesi", "Dijital Hizmet", "Öğrenme Atölyesi"][index]}`,
  };
});
const districtHomes = newDistricts.map(({ id, name, regionId, trait }, index) => ({
  id: `${id}:room`, name: `${name} · Oda`, region: regionId, districtId: id, anchor: "room",
  base: (trait === "commerce" ? 52000 : trait === "residential" ? 39000 : 45000) + index * 80,
  rent: trait === "commerce" ? 3750 : trait === "residential" ? 2750 : 3200,
  index: index + 3,
}));
const districtResidents = districtFirms.map(({ districtId, region, type, id }) => ({
  id: `resident:${districtId}`, region, type, districtId, employer: id,
}));
const regionHomes = [...legacyHomes, ...districtHomes];
const regionalResidents = [...legacyResidents, ...districtResidents];
const competitors = [...legacyFirms, ...districtFirms];
const lotsById = new Map(regionHomes.map((lot) => [lot.id, lot]));
const residentIndex = new Map(regionalResidents.map((resident, index) => [resident.id, index]));
const firmsById = new Map(competitors.map((firm) => [firm.id, firm]));
const firmsInDistrict = new Map(DISTRICTS.map(({ id }) =>
  [id, competitors.filter((firm) => firm.districtId === id)]));
const lotsInDistrict = new Map(DISTRICTS.map(({ id }) =>
  [id, regionHomes.filter((lot) => lot.districtId === id)]));
const venuesByDistrict = new Map(DISTRICTS.map(({ id }) => [id, LOCATIONS.filter((v) => v.districtId === id)]));
const commercialTerms = (s, region, type) => getDistrictSimulation(s,
  economy(s).business?.districtId ?? (region === "istanbul"
    ? s.deep.business.location : firmsById.get(`${region}:${type.id}`).districtId));

export const economyLotDistrict = (id) => lotsById.get(id)?.districtId ?? null;
export const economyFirmDistrict = (id) => firmsById.get(id)?.districtId ?? null;
export const economyHomeDistrict = (s) => economyLotDistrict(s.expansion?.economy.home);

const residentAge = (life, today) => Math.floor((today - life.born) / 30);
const workday = (d) => (d - 1) % 7 < 5;
const districtIds = new Set(DISTRICTS.map(({ id }) => id));
const day = (s) => Math.floor(s.time / DAY) + 1;
const regionOf = (s) => s.expansion.world.region;
const economy = (s) => s.expansion?.economy;
const funds = (s) => s.bank + s.cash;
const asMoney = (amount) => Math.min(MAX, Math.max(0, Math.round(amount)));
const bound = (amount, min, max) => Math.min(max, Math.max(min, amount));

function marketIndex(s, region, key, low = 50, high = 200) {
  return bound(s.expansion.world.regions[region]?.[key] ?? 100, low, high);
}
const lotPressure = (s, lot) => getDistrictSimulation(s, lot.districtId).rentPressure;
const propertyValue = (s, lot, p) =>
  Math.round((lot.base * (65 + p.condition * 0.35) * lotPressure(s, lot)) / 10000);
const propertyRent = (s, lot, p) =>
  Math.round((lot.rent * (80 + p.condition * 0.2) * lotPressure(s, lot)) / 10000);
const saleValue = (s, lot, p) => Math.floor(propertyValue(s, lot, p) * 0.88);
const debtor = (p) => (p.mortgage ? p.mortgage.principal + p.mortgage.interest : 0);
const mortgageDue = (p, interest = p.mortgage.interest) =>
  Math.min(
    p.mortgage.principal + interest,
    interest + Math.max(300, Math.ceil(p.mortgage.principal * 0.04)),
  );
const repairCost = (p) => 80 + 15 * (100 - p.condition);
const leaseTerms = (s, tenant, rent) => ({
  tenant,
  rent,
  deposit: rent,
  dueDay: day(s) + 30,
  arrears: 0,
  missed: 0,
});
const canCredit = (s, amount) => s.bank + amount <= MAX;
const npcFunds = (n) => n.cash + n.savings;
const businessRecord = (s, value, label, api) => api.record(s, label, value, "business");
const event = (s, api, type, id, detail) => api.expansionEvent?.(s, type, id, detail);
const playerProperty = (s, lot) => economy(s).properties[lot.id];
const isResident = (id) => citizens.has(id) || residentIndex.has(id);
const validOwner = (id) => id === MARKET || id === HOUSEHOLD || isResident(id);
const residentAccount = (s, id) => (citizens.has(id) ? s.deep.npcs[id] : economy(s).residents[id]);

function residentLife(s, resident, index = residentIndex.get(resident.id)) {
  const n = residentAccount(s, resident.id);
  if (n.life) return n.life;
  const employer = resident.employer ?? `${resident.region}:${resident.type.id}`;
  return {
    region: resident.region,
    employer:
      n.employment === "employed" && economy(s).firms[employer].status === "open" ? employer : "",
    born: economy(s).lastDay - (26 + ((s.seed + index * 3) % 16)) * 30,
    generation: 1,
    health: 82 + (index % 6) * 2,
    skill: resident.type.required,
  };
}

function residentName(index, generation) {
  if (generation === 1 && index < residentNames.length) return residentNames[index];
  const first = ["Umay", "Yağız", "Aslı", "Selim", "Elif", "Arda", "Dilan", "Mete", "İrem"];
  const surnames = ["Aydın", "Yalçın", "Koç", "Akın", "Uçar", "Kaya", "Işık"];
  return `${first[(index + generation) % first.length]} ${surnames[index % surnames.length]}`;
}

function regionalHome(s, id) {
  return regionHomes.find((lot) => {
    const p = playerProperty(s, lot);
    return p && (p.lease?.tenant === id || (p.owner === id && !p.lease));
  });
}

function residentProperty(s, id) {
  return regionHomes.find((lot) => playerProperty(s, lot)?.owner === id);
}

function staffIds(s, firmId) {
  return regionalResidents.flatMap((resident) => {
    if (!residentAccount(s, resident.id)) return [];
    return residentLife(s, resident).employer === firmId ? [resident.id] : [];
  });
}

function playerPosition(s, firmId) {
  const job = s.expansion.districts?.job;
  if (job?.firmId !== firmId || job.personId !== s.expansion.playerId) return 0;
  return Number(Boolean(s.expansion.family?.people.some((row) =>
    row.id === job.personId && row.died === null && !row.retired)));
}

function vacancies(s, firm, workerCount) {
  const account = economy(s).firms[firm.id];
  if (account?.status !== "open") return 0;
  return Math.max(0, account.workers - workerCount - playerPosition(s, firm.id));
}

export function getDistrictEmployers(s, districtId) {
  return (firmsInDistrict.get(normalizeDistrictId(districtId)) ?? []).flatMap((entry) => {
    const firm = economy(s)?.firms[entry.id];
    return firm ? [{ ...entry, type: entry.type.id, firm, vacancies: vacancies(s, entry, staffIds(s, entry.id).length) }] : [];
  });
}

export function districtEconomyMetrics(s, districtId) {
  const id = normalizeDistrictId(districtId);
  const firms = firmsInDistrict.get(id) ?? [];
  const e = economy(s);
  let localFirms = 0, jobOpenings = 0, materialStock = 0, closing = 0;
  for (const entry of firms) {
    const firm = e?.firms[entry.id];
    if (!firm) continue;
    if (firm.status === "closed") {
      closing++;
      continue;
    }
    localFirms++;
    materialStock += firm.stock;
    jobOpenings += vacancies(s, entry, staffIds(s, entry.id).length);
  }
  const lots = lotsInDistrict.get(id) ?? [];
  let occupied = 0;
  for (const lot of lots) {
    const p = e?.properties[lot.id];
    if (p && (isResident(p.lease?.tenant) || isResident(p.owner))) occupied++;
  }
  return {
    localFirms, jobOpenings, materialStock,
    rentAdjustment: occupied * 3 - closing * 3,
    demandAdjustment: occupied * 2 - closing * 3,
  };
}

function spendNpc(n, amount) {
  const cash = Math.min(n.cash, amount);
  n.cash -= cash;
  n.savings -= amount - cash;
}

function payOwner(s, owner, amount, api, label) {
  if (owner === HOUSEHOLD) api.receive(s, Math.min(amount, MAX - s.bank), label, "bank");
  else if (isResident(owner)) {
    const n = residentAccount(s, owner);
    const room = Math.min(MAX - n.cash, amount);
    n.cash += room;
    n.savings += Math.min(MAX - n.savings, amount - room);
  }
  // Market receipts and amounts beyond safe balance limits leave the local economy.
}

function neutralHousing(s, id, api, relocate = true) {
  const current = s.housing;
  if (s.life.household) closeHousehold(s, "Konut sözleşmesi değişti", api);
  const offset = Math.min(current.deposit, current.arrears);
  if (offset) api.record(s, "Depozito · kira borcuna mahsup", -offset, "arrears");
  const refund = current.deposit - offset;
  if (refund) api.receive(s, Math.min(refund, MAX - s.bank), "Kira depozitosu iadesi", "bank");
  s.housing = { id, rent: 0, deposit: 0, arrears: current.arrears - offset, dueDay: day(s) + 30 };
  const home = HOMES.find((home) => home.id === id);
  if (relocate) {
    if (s.city.venue) s.city.venue = "";
    if (s.expansion.districts) s.expansion.districts.place = null;
    s.location = home.district;
  }
  api.document?.(
    s,
    `property-${s.revision}-${id}`,
    home.name + " · sözleşme",
    "Konut için ödeme ve tapu durumu mülkiyet defterinde tutulur.",
  );
  syncLifeHousing(s, api);
}

function releaseLease(s, p, api) {
  const lease = p.lease;
  if (!lease) return 0;
  const offset = Math.min(lease.deposit, lease.arrears);
  payOwner(s, p.owner, offset, api, "Depozito · kira borcu");
  payOwner(s, lease.tenant, lease.deposit - offset, api, "Konut depozitosu iadesi");
  p.lease = null;
  return lease.arrears - offset;
}

function releaseResidentLease(s, property, api) {
  const n = residentAccount(s, property.lease.tenant);
  n.debt = asMoney(n.debt + releaseLease(s, property, api));
}

function vacate(s, api, shelter) {
  const e = economy(s);
  if (!e.home) return;
  const p = e.properties[e.home];
  const outstanding = p.lease?.tenant === HOUSEHOLD ? releaseLease(s, p, api) : 0;
  s.housing.arrears = asMoney(s.housing.arrears + outstanding);
  const local = e.home.startsWith(regionOf(s) + ":");
  e.home = "";
  if (shelter) neutralHousing(s, "shelter", api, local);
}

function occupy(s, lot, api) {
  vacate(s, api, false);
  neutralHousing(s, lot.anchor, api);
  economy(s).home = lot.id;
  if (s.location !== lot.districtId || lot.region !== "istanbul") {
    const place = s.expansion.districts ??= { place: null, job: null, visits: {}, visitDay: day(s), contacts: {} };
    place.place = { districtId: lot.districtId, venueId: null };
  }
}

function takeTitle(s, lot, amount, down, api) {
  const p = playerProperty(s, lot);
  payOwner(s, p.owner, amount, api, "Konut satış bedeli");
  p.owner = HOUSEHOLD;
  if (down < amount)
    p.mortgage = { principal: amount - down, interest: 0, dueDay: day(s) + 30, missed: 0 };
  event(s, api, "property.purchase", lot.id, `${amount} TL; peşinat ${down} TL.`);
  return `${lot.name} hanenin mülkiyetine geçti.`;
}

function sell(s, lot, p, api, foreclosure = false) {
  const proceeds = saleValue(s, lot, p);
  if (economy(s).home === lot.id) vacate(s, api, true);
  if (p.lease) releaseResidentLease(s, p, api);
  const residual = proceeds - debtor(p);
  p.owner = MARKET;
  p.mortgage = null;
  if (residual > 0)
    api.receive(s, Math.min(residual, MAX - s.bank), "Konut satışından kalan net bedel", "bank");
  else if (residual < 0) {
    const debit = Math.min(MAX - s.debt, -residual);
    s.debt += debit;
    api.record(s, "Konut tasfiyesi · karşılanmayan borç", debit, "debt");
  }
  event(
    s,
    api,
    foreclosure ? "property.default" : "property.sale",
    lot.id,
    `Net sonuç: ${residual} TL.`,
  );
  return `Tapu devredildi, kredi kapandı. Net satış ${residual} TL.`;
}

function residentDistrict(s, resident, life, home = regionalHome(s, resident.id)) {
  const saved = economy(s).activity?.[resident.id]?.districtId ?? resident.districtId;
  if (home && home.region === life.region) return home.districtId;
  if (districtById(saved)?.regionId === life.region) return saved;
  return life.employer ? firmsById.get(life.employer)?.districtId : hubDistrict(life.region);
}

function candidateResidents(s, lot) {
  const gold = lot.region === "istanbul" && lot.index < 3
    ? NPCS.filter(({ id }) =>
        s.deep.npcs[id].home === lot.districtId && s.life.household?.memberId !== id)
    : [];
  return gold.concat(regionalResidents.flatMap((resident, index) => {
    if (!residentAccount(s, resident.id)) return [];
    const life = residentLife(s, resident, index);
    return residentDistrict(s, resident, life) === lot.districtId
      ? [{ id: resident.id, name: residentName(index, life.generation) }]
      : [];
  }));
}

function availableTenant(s, lot) {
  const leased = new Set(Object.values(economy(s).properties).map((p) => p.lease?.tenant));
  const owners = new Set(Object.values(economy(s).properties).map((p) => p.owner));
  return candidateResidents(s, lot).find(({ id }) => {
    const n = residentAccount(s, id);
    return (
      !leased.has(id) &&
      !owners.has(id) &&
      n.employment === "employed" &&
      (!n.life || n.life.employer) &&
      npcFunds(n) >= 2 * propertyRent(s, lot, playerProperty(s, lot))
    );
  });
}

function newProperty(s, lot) {
  return { owner: MARKET, condition: 82 + ((s.seed + lot.index) % 17), mortgage: null, lease: null };
}

function newFirm(firm, index) {
  return {
    cash: 4200 + 100 * index,
    stock: 6,
    workers: index < legacyFirms.length ? 2 : 3,
    reputation: 45,
    price: firm.type.unitPrice,
    revenue: 0,
    costs: 0,
    status: "open",
    failed: 0,
    reopenDay: 0,
    closed: 0,
  };
}

function newResident(index) {
  return { cash: 7000 + index * 250, savings: 6000 + index * 300, debt: 0, employment: "employed" };
}

export function initEconomy(s) {
  s.expansion.economy = {
    lastDay: day(s),
    home: "",
    properties: Object.fromEntries(legacyHomes.map((lot) => [lot.id, newProperty(s, lot)])),
    business: s.deep.business ? businessState(s, s.deep.business.revenue) : null,
    residents: Object.fromEntries(legacyResidents.map(({ id }, index) => [id, newResident(index)])),
    firms: Object.fromEntries(legacyFirms.map((firm, index) => [firm.id, newFirm(firm, index)])),
  };
  migrateEconomy(s);
}

export function migrateEconomy(s) {
  const e = s.expansion?.economy;
  if (!e || Object.hasOwn(e, "activity")) return;
  if (e.business && !e.business.districtId) {
    e.business.districtId = e.business.region === "istanbul" ? s.deep.business.location
      : firmsById.get(`${e.business.region}:${s.deep.business.id}`).districtId;
  }
  for (const lot of districtHomes) e.properties[lot.id] = newProperty(s, lot);
  districtFirms.forEach((firm, index) => { e.firms[firm.id] = newFirm(firm, index + legacyFirms.length); });
  districtResidents.forEach(({ id }, index) => { e.residents[id] = newResident(index + legacyResidents.length); });
  for (const resident of regionalResidents) {
    const n = residentAccount(s, resident.id);
    n.life ??= residentLife(s, resident);
    if (!n.life.employer) n.employment = "searching";
  }
  e.activity = Object.fromEntries(regionalResidents.map((resident) => {
    const life = residentLife(s, resident);
    return [resident.id, { districtId: residentDistrict(s, resident, life), trip: null, contacts: {}, history: [] }];
  }));
}

export function economyActions(s, api) {
  if (!s.expansion?.economy) return [];
  const e = economy(s);
  const actions = [];
  const add = (id, label, description, category, minutes, cost, reason, run) => {
    const problem = reason || (funds(s) < cost ? `${cost} TL kullanılabilir bakiye gerekir.` : "");
    actions.push({
      id: "economy:" + id,
      label,
      description,
      category,
      minutes,
      cost,
      pay: "total",
      disabled: Boolean(problem),
      reason: problem,
      run,
    });
  };
  const local = regionOf(s);
  const place = getPlace(s);
  for (const lot of regionHomes) {
    const propertyAction = (id, label, detail, ...terms) =>
      add(`${id}:${lot.id}`, `${lot.name} · ${label}`, detail, "wallet", ...terms);
    const p = playerProperty(s, lot);
    if (!p || (p.owner !== HOUSEHOLD && e.home !== lot.id &&
      (lot.region !== local || (lot.index >= 3 && place.districtId !== lot.districtId)))) continue;
    const value = propertyValue(s, lot, p);
    const monthly = propertyRent(s, lot, p);
    const sameHome = e.home === lot.id;
    const occupied = p.lease ? "Konut kirada." : "";
    const away = lot.region !== local ? "Konutun şehrine git."
      : lot.index >= 3 && place.districtId !== lot.districtId
        ? "Konutun ilçesine git." : "";
    const cohabiting = s.life.household ? "Önce ev paylaşımını sonlandır." : "";
    if (p.owner !== HOUSEHOLD) {
      if (sameHome) {
        propertyAction(
          "leave",
          "kirayı kapat",
          "Depozito kira borcuna gider, kalanı iade edilir.",
          30,
          0,
          away,
          (next) => {
            vacate(next, api, true);
            event(next, api, "property.lease-ended", lot.id, "Hane yeni bir sözleşme seçebilir.");
            return "Kira kapatıldı; geçici konuta geçtin.";
          },
        );
      }
      propertyAction(
        "rent",
        "kirala",
        `İlk kira ve depozito: ${2 * monthly} TL.`,
        60,
        2 * monthly,
        away || occupied || cohabiting,
        (next) => {
          occupy(next, lot, api);
          const item = playerProperty(next, lot);
          item.lease = leaseTerms(next, HOUSEHOLD, monthly);
          payOwner(next, item.owner, monthly, api, "İlk ay konut kirası");
          event(next, api, "property.lease", lot.id, `Aylık ${monthly} TL.`);
          return `${lot.name} için konut sözleşmesi başladı.`;
        },
      );
      propertyAction("buy", "satın al", "Tapu bedeli.", 90, value, away || occupied, (next) =>
        takeTitle(next, lot, value, value, api),
      );
      const down = Math.ceil(value * 0.25);
      propertyAction(
        "mortgage",
        "kredili satın al",
        "Bedel peşinattır. Aylık %0,8 faiz, %4 anapara. Üç ödenmeyen taksitte tasfiye riski.",
        90,
        down,
        away || occupied || (s.debt > value / 3 ? "Borç çok yüksek." : ""),
        (next) => takeTitle(next, lot, value, down, api),
      );
      continue;
    }
    if (!sameHome)
      propertyAction(
        "occupy",
        "kendi evine taşın",
        "Kira yok. Bakım ve varsa kredi ödenir.",
        60,
        300,
        away || occupied || cohabiting,
        (next) => {
          occupy(next, lot, api);
          event(next, api, "property.move", lot.id, "Hane sahibi olduğu konuta taşındı.");
          return `${lot.name} artık yaşadığın konut.`;
        },
      );
    const repairs = repairCost(p);
    propertyAction(
      "maintain",
      "bakım yap",
      "Konut kondisyonu +18.",
      120,
      repairs,
      away || (p.condition >= 95 ? "Konutun bakıma ihtiyacı yok." : ""),
      (next) => {
        const item = playerProperty(next, lot);
        item.condition = Math.min(100, item.condition + 18);
        return "Konut kondisyonu iyileşti.";
      },
    );
    if (p.mortgage) {
      const payment = Math.min(5000, debtor(p));
      propertyAction(
        "repay",
        "krediye ek ödeme",
        "Önce faiz, sonra anapara.",
        15,
        payment,
        "",
        (next) => {
          const item = playerProperty(next, lot);
          applyMortgagePayment(item, payment);
          return `Ödeme işlendi; kalan kredi ${debtor(item)} TL.`;
        },
      );
    }
    if (!p.lease && !sameHome) {
      const tenant = availableTenant(s, lot);
      const n = tenant && residentAccount(s, tenant.id);
      propertyAction(
        "let",
        "kiracı al",
        `İlk kira ve depozitoyu kiracı öder.`,
        45,
        0,
        away ||
          (!tenant || npcFunds(n) < 2 * monthly || !canCredit(s, monthly)
            ? "Uygun ve ödeme gücü olan kiracı yok."
            : ""),
        (next) => {
          spendNpc(residentAccount(next, tenant.id), 2 * monthly);
          playerProperty(next, lot).lease = leaseTerms(next, tenant.id, monthly);
          payOwner(next, HOUSEHOLD, monthly, api, "Kiracı · ilk ay");
          event(next, api, "property.lease", lot.id, `${tenant.name} · ${monthly} TL/ay.`);
          return `${tenant.name} konutu kiraladı; ilk kira bankana geçti, depozito sözleşmeye alındı.`;
        },
      );
    } else if (p.lease) {
      propertyAction(
        "end",
        "kiracı sözleşmesini bitir",
        "Depozito kira borcuna gider, kalanı iade edilir.",
        30,
        0,
        away,
        (next) => {
          const item = playerProperty(next, lot);
          releaseResidentLease(next, item, api);
          event(next, api, "property.lease-ended", lot.id, "Kiracı konutu teslim etti.");
          return "Kira ve depozito kapatıldı.";
        },
      );
    }
    const net = saleValue(s, lot, p) - debtor(p);
    propertyAction(
      "sell",
      "sat",
      `Gider ve ipotek sonrası net ${net} TL.`,
      90,
      0,
      away ||
        occupied ||
        (net < 0
          ? "Satmadan önce krediyi azalt."
          : !canCredit(s, net)
            ? "Satış banka limitini aşar."
            : ""),
      (next) => sell(next, lot, playerProperty(next, lot), api),
    );
  }
  appendBusinessActions(s, api, add);
  return actions;
}

function applyMortgagePayment(property, paid) {
  const mortgage = property.mortgage;
  const interest = Math.min(paid, mortgage.interest);
  mortgage.interest -= interest;
  mortgage.principal -= Math.min(mortgage.principal, paid - interest);
  if (!mortgage.principal && !mortgage.interest) property.mortgage = null;
}

function settleProperties(s, api) {
  const d = day(s);
  for (const lot of regionHomes) {
    const p = playerProperty(s, lot);
    if ((d + lot.index) % 7 === 0)
      p.condition = Math.max(p.owner === MARKET ? 65 : 35, p.condition - (p.lease ? 2 : 1));
    const lease = p.lease;
    if (lease && d >= lease.dueDay) {
      const n = residentAccount(s, lease.tenant);
      const due = lease.rent + lease.arrears;
      const paid = Math.min(due, lease.tenant === HOUSEHOLD ? funds(s) : npcFunds(n));
      if (lease.tenant === HOUSEHOLD) api.spend(s, paid, "Konut sözleşmesi · kira", "total");
      else spendNpc(n, paid);
      payOwner(s, p.owner, paid, api, "Konut sözleşmesi · tahsilat");
      lease.arrears = asMoney(due - paid);
      lease.missed = paid < lease.rent ? lease.missed + 1 : 0;
      lease.dueDay += 30;
      if (lease.missed >= 3) {
        if (lease.tenant === HOUSEHOLD) vacate(s, api, true);
        else releaseResidentLease(s, p, api);
        event(
          s,
          api,
          "property.eviction",
          lot.id,
          "Üç vade karşılanamadı; depozito mahsup edildi.",
        );
      }
    }
    const m = p.mortgage;
    if (m && d >= m.dueDay) {
      m.interest += Math.ceil(m.principal * 0.008);
      const due = mortgageDue(p);
      const paid = Math.min(funds(s), due);
      api.spend(s, paid, "Konut kredisi · aylık ödeme", "total");
      applyMortgagePayment(p, paid);
      if (p.mortgage) {
        m.dueDay += 30;
        m.missed = paid < due ? m.missed + 1 : 0;
        if (m.missed === 3) sell(s, lot, p, api, true);
      }
    }
    if (!p.lease && (d + lot.index * 3) % 30 === 0) {
      if (p.owner === MARKET) {
        const holdings = Object.values(economy(s).properties);
        const candidate = candidateResidents(s, lot).find(({ id }) => {
          const n = residentAccount(s, id);
          return (
            !holdings.some((item) => item.owner === id || item.lease?.tenant === id) &&
            n.debt === 0 &&
            n.savings >= propertyValue(s, lot, p) + 4000
          );
        });
        if (candidate) {
          residentAccount(s, candidate.id).savings -= propertyValue(s, lot, p);
          p.owner = candidate.id;
          event(s, api, "property.npc-purchase", lot.id, candidate.name);
        } else if (lot.index >= 3 && lot.index % 3 === 0 && d >= 45) {
          const tenant = availableTenant(s, lot);
          const rent = propertyRent(s, lot, p);
          if (tenant) {
            spendNpc(residentAccount(s, tenant.id), rent * 2);
            p.lease = leaseTerms(s, tenant.id, rent);
            event(s, api, "property.lease", lot.id, `${tenant.name} · ${rent} TL/ay.`);
          }
        }
      } else if (isResident(p.owner)) {
        const n = residentAccount(s, p.owner);
        if (n.debt > 2000 && n.cash < 2000) {
          payOwner(s, p.owner, saleValue(s, lot, p), api, "Konut satışı");
          p.owner = MARKET;
          event(s, api, "property.npc-sale", lot.id, "Borç baskısı nedeniyle satış gerçekleşti.");
        }
      }
    }
  }
}

export function economyNpcHousingCost(s, id, original) {
  if (!s.expansion?.economy) return original;
  const contract = regionHomes.find((lot) => {
    const p = playerProperty(s, lot);
    return p && (
      p.lease?.tenant === id ||
      (p.owner === id && !p.lease && lot.districtId === s.deep.npcs[id]?.home)
    );
  });
  if (!contract) return original;
  // The Gold daily bill includes food and rent. Keep food, with rent paid once by title/lease.
  return Math.max(0, original - Math.round(s.deep.npcs[id].rent / 30));
}

function businessState(s, baselineRevenue = 0) {
  return {
    region: regionOf(s),
    districtId: getPlace(s).districtId,
    price: 100,
    supplier: "local",
    workers: 0,
    wageDue: 0,
    principal: 0,
    installmentDay: 0,
    missed: 0,
    lastTaxRevenue: baselineRevenue,
    taxDue: 0,
    taxes: 0,
    payrollMissed: 0,
  };
}

function wageRate(s, region) {
  return Math.round((105 * marketIndex(s, region, "price")) / 100);
}

export function regionalShift(s, region, wage) {
  const e = economy(s);
  return competitors.find(
    ({ id, region: local }) =>
      local === region &&
      e.firms[id]?.status === "open" &&
      e.firms[id].cash >= wage + wageRate(s, region) * e.firms[id].workers * 4,
  );
}

function fundedOrder(s, firm) {
  const account = economy(s).firms[firm.id];
  if (account?.status !== "open") return null;
  const price = Math.max(
    1,
    Math.round((firm.type.unitCost * marketIndex(s, firm.region, "price") * 1.12) / 100),
  );
  const reserve = wageRate(s, firm.region) * account.workers * 4 + 65;
  const capacity = Math.max(
    0,
    Math.min(
      3,
      12 - account.stock,
      Math.floor((account.cash - reserve) / price),
      Math.floor((MAX - account.costs) / price),
    ),
  );
  return capacity ? { firmId: firm.id, name: firm.name, price, capacity } : null;
}

// Orders are a quote against the same finite stock/cash used by daily commerce.
// Fulfilment debits the buyer only; the caller transfers its own stock and credits
// the returned proceeds once. There is no second firm account.
export function underworldOrder(s, region, index = 0, districtId) {
  const local = districtId
    ? firmsInDistrict.get(normalizeDistrictId(districtId)) ?? []
    : legacyFirms.filter((firm) => firm.region === region);
  if (!local.length || !integer(index)) return null;
  for (let offset = 0; offset < local.length; offset++) {
    const order = fundedOrder(s, local[(index + offset) % local.length]);
    if (order) return order;
  }
  return null;
}

export function fulfillUnderworldOrder(s, firmId, units, price) {
  const firm = firmsById.get(firmId);
  if (!firm || !integer(units, 1, 3)) return 0;
  const quote = fundedOrder(s, firm);
  if (!quote || price !== quote.price || units > quote.capacity) return 0;
  const account = economy(s).firms[firmId];
  const amount = units * price;
  account.cash -= amount;
  account.stock += units;
  account.costs += amount;
  return amount;
}

function suppliers(s, e, type) {
  const base =
    e.supplier === "cooperative"
      ? Math.round((type.unitCost * 0.86 * marketIndex(s, e.region, "price")) / 100)
      : Math.round((type.unitCost * marketIndex(s, e.region, "price")) / 100);
  return Math.round(
    (base * (100 + commercialTerms(s, e.region, type).serviceDelay / 5)) / 100,
  );
}

function priceAdjustment(s, e, type) {
  const local = firmsInDistrict.get(e.districtId) ?? [];
  const competitor = economy(s).firms[local.find((firm) => firm.type === type)?.id ?? `${e.region}:${type.id}`];
  const benchmark = competitor?.status === "open" ? competitor.price : type.unitPrice;
  const price = Math.round((type.unitPrice * e.price * marketIndex(s, e.region, "price")) / 10000);
  const demand = Math.round(
    (benchmark * commercialTerms(s, e.region, type).demand) / Math.max(1, price),
  );
  return { price, demand: bound(demand, 45, 145) };
}

function appendBusinessActions(s, api, add) {
  const enterpriseAction = (id, label, detail, ...terms) =>
    add(id, label, detail, "enterprise", ...terms);
  const e = economy(s).business;
  const b = s.deep.business;
  if (!e || !b) return;
  const firm = s.living.enterprise;
  const type = BUSINESS_TYPES.find((x) => x.id === b.id);
  const wage = wageRate(s, e.region);
  const costOfHire = wage * 5;
  const away = e.region !== regionOf(s) ? "İşletmenin şehrine git." : "";
  const labor = marketIndex(s, e.region, "employment");
  enterpriseAction(
    "hire",
    "Ücretli çalışan işe al",
    `${wage} TL. Yalnız açık işyerinde tamamlanan vardiya ödenir.`,
    30,
    0,
    away ||
      (b.status !== "active"
        ? "İşletme açık olmalı."
        : e.workers >= 3 || e.workers >= (labor > 110 ? 2 : 3)
          ? "Uygun aday yok veya ekip dolu."
          : firm.capital < costOfHire
            ? "Kasada beş günlük ücret gerekir."
            : ""),
    (next) => {
      economy(next).business.workers++;
      event(next, api, "business.hire", b.id, "Yerel emek piyasasında yeni sözleşme başladı.");
      return "Çalışan stoktan sipariş hazırlayabilir.";
    },
  );
  if (e.workers)
    enterpriseAction(
      "dismiss",
      "Bir iş sözleşmesini bitir",
      `Kıdem: ${wage * 3} TL işletme kasasından.`,
      20,
      0,
      away || (firm.capital < wage * 3 ? "Kıdem ödemesi için kasa yetersiz." : ""),
      (next) => {
        economy(next).business.workers--;
        next.living.enterprise.capital -= wage * 3;
        next.deep.business.costs = asMoney(next.deep.business.costs + wage * 3);
        businessRecord(next, -wage * 3, "Sözleşme sonu ödemesi", api);
        event(next, api, "business.dismissal", b.id, "Sözleşme sona erdi ve kıdem ödendi.");
        return "Sözleşme ve kıdem ödemesi kapatıldı.";
      },
    );
  for (const percent of [85, 100, 120]) {
    const price = Math.round(
      (type.unitPrice * percent * marketIndex(s, e.region, "price")) / 10000,
    );
    enterpriseAction(
      `price:${percent}`,
      `Liste fiyatını ${price} TL yap`,
      "Fiyat talebi ve kârı etkiler.",
      5,
      0,
      e.price === percent ? "Bu tarife yürürlükte." : "",
      (next) => {
        economy(next).business.price = percent;
        return "Liste fiyatı güncellendi.";
      },
    );
  }
  for (const supplier of ["local", "cooperative"])
    enterpriseAction(
      `supplier:${supplier}`,
      supplier === "local" ? "Yerel tedarikçiye dön" : "Kooperatifle anlaş",
      supplier === "local"
        ? "Küçük siparişlere açık tedarik."
        : "En az altı birimde daha düşük maliyet.",
      20,
      0,
      away || (e.supplier === supplier ? "Bu tedarikçi zaten etkin." : ""),
      (next) => {
        economy(next).business.supplier = supplier;
        return "Tedarikçi değişti.";
      },
    );
  enterpriseAction(
    "business-credit",
    "İşletme kredisi al",
    "Kasaya 3.000 TL. 30 günde bir anapara ve %1 faiz.",
    30,
    0,
    away ||
      (e.principal ||
      e.taxDue ||
      e.wageDue ||
      b.arrears ||
      b.reputation < 30 ||
      firm.capital > MAX - 3000
        ? "Kredi için itibar, borç ve bakiye uygun olmalı."
        : ""),
    (next) => {
      const current = economy(next).business;
      current.principal = 3000;
      current.installmentDay = day(next) + 30;
      next.living.enterprise.capital += 3000;
      businessRecord(next, 3000, "İşletme kredisi · sermaye değil yükümlülük", api);
      event(next, api, "business.credit", b.id, "İşletme kasasına 3.000 TL kredi aktarıldı.");
      return "Kredi işletme kasasına aktarıldı.";
    },
  );
  if (e.principal) {
    const payment = Math.min(1000, e.principal);
    enterpriseAction(
      "business-repay",
      `İşletme kredisinden ${payment} TL kapat`,
      "Anapara işletme kasasından.",
      15,
      0,
      firm.capital < payment ? "İşletme kasası yetersiz." : "",
      (next) => {
        const current = economy(next).business;
        current.principal -= payment;
        if (!current.principal) {
          current.installmentDay = 0;
          current.missed = 0;
        }
        next.living.enterprise.capital -= payment;
        businessRecord(next, -payment, "İşletme kredisi · anapara ödemesi", api);
        return "Anapara azaltıldı.";
      },
    );
  }
  const obligations = e.wageDue + e.taxDue;
  if (obligations)
    enterpriseAction(
      "business-settle",
      "Ücret ve vergi birikimini kapat",
      `${obligations} TL kasa yükümlülüğü.`,
      15,
      0,
      firm.capital < obligations ? "Önce işletmeye sermaye aktar." : "",
      (next) => {
        settleBusinessArrears(next, api);
        return "Ücret ve vergi ödendi.";
      },
    );
}

function settleBusinessArrears(s, api) {
  const e = economy(s).business;
  const firm = s.living.enterprise;
  const wages = Math.min(firm.capital, e.wageDue);
  e.wageDue -= wages;
  firm.capital -= wages;
  if (wages) businessRecord(s, -wages, "Çalışanlara ücret ödemesi", api);
  const tax = Math.min(firm.capital, e.taxDue);
  e.taxDue -= tax;
  firm.capital -= tax;
  e.taxes = asMoney(e.taxes + tax);
  if (tax) {
    api.creditMunicipalTax?.(s, e.region, tax);
    businessRecord(s, -tax, "İşletme vergisi · tahsilat", api);
  }
}

export function payBusinessOverhead(s, api) {
  const b = s.deep.business;
  const firm = s.living.enterprise;
  const fee = Math.ceil(b.accruedOverhead);
  const paid = Math.min(fee, firm.capital);
  b.accruedOverhead = 0;
  b.costs = asMoney(b.costs + fee);
  firm.capital -= paid;
  if (paid) businessRecord(s, -paid, "İşletme sabit gideri", api);
  if (paid < fee) {
    b.arrears = asMoney(b.arrears + fee - paid);
    b.status = "paused";
  }
}

function settleBusiness(s, api) {
  const e = economy(s).business;
  const b = s.deep.business;
  if (!b || !e) return;
  const d = day(s);
  const firm = s.living.enterprise;
  const type = BUSINESS_TYPES.find((x) => x.id === b.id);
  if (b.status === "active" && e.workers && (d - 2) % 7 < 5) {
    const wages = wageRate(s, e.region) * e.workers;
    const { price, demand } = priceAdjustment(s, e, type);
    const sold = Math.min(
      firm.stock,
      b.clients,
      e.workers * 2,
      Math.floor((e.workers * demand) / 70),
    );
    const revenue = Math.min(sold * price, MAX - firm.capital, MAX - b.revenue);
    const operating = sold * 25;
    if (sold && revenue > operating && firm.capital >= operating) {
      firm.stock -= sold;
      firm.capital += revenue - operating;
      b.revenue += revenue;
      b.lastServiceDay = d;
      b.costs = asMoney(b.costs + operating);
      b.reputation = Math.min(100, b.reputation + 1);
      businessRecord(s, revenue - operating, "Personel vardiyası · stoktan satış", api);
    }
    e.wageDue = asMoney(e.wageDue + wages);
    b.costs = asMoney(b.costs + wages);
  }
  if ((d - 1) % 30 === 0) {
    const tax = Math.floor(Math.max(0, b.revenue - e.lastTaxRevenue) * 0.04);
    e.lastTaxRevenue = b.revenue;
    e.taxDue = asMoney(e.taxDue + tax);
    b.costs = asMoney(b.costs + tax);
  }
  settleBusinessArrears(s, api);
  if (!e.wageDue) e.payrollMissed = 0;
  else e.payrollMissed = Math.min(3, e.payrollMissed + 1);
  if (e.payrollMissed >= 3 && e.workers) {
    e.workers = 0;
    b.status = "paused";
    b.reputation = Math.max(0, b.reputation - 12);
    event(s, api, "business.layoff", b.id, "Üç gün ödenmeyen ücret nedeniyle ekip ayrıldı.");
  }
  if (e.principal && d >= e.installmentDay) {
    const interest = Math.ceil(e.principal * 0.01);
    const due = Math.min(e.principal, 450);
    const paid = Math.min(firm.capital, due + interest);
    firm.capital -= paid;
    e.principal = asMoney(e.principal + interest - paid);
    b.costs = asMoney(b.costs + interest);
    if (paid) businessRecord(s, -paid, "İşletme kredisi · aylık ödeme", api);
    e.missed = paid < due + interest ? Math.min(3, e.missed + 1) : 0;
    e.installmentDay = e.principal ? e.installmentDay + 30 : 0;
    if (e.missed >= 3 && b.status === "active") {
      b.status = "paused";
      event(s, api, "business.default", b.id, "Üç kaçan kredi vadesi nedeniyle üretim durdu.");
    }
  }
}

function residentWage(s, region, type, skill) {
  const labor = marketIndex(s, region, "employment");
  return Math.round(((100 + labor) / 2) * (2.15 + skill / 85 + (type.required - 35) / 20));
}

function settleCompetitors(s, api) {
  const d = day(s);
  const e = economy(s);
  const workersByFirm = new Map();
  const localStress = new Map();
  for (const resident of regionalResidents) {
    const n = e.residents[resident.id];
    if (n.life.employer) {
      const staff = workersByFirm.get(n.life.employer) ?? [];
      staff.push(resident.id);
      workersByFirm.set(n.life.employer, staff);
    }
    if (n.debt > npcFunds(n)) {
      const id = residentDistrict(s, resident, n.life, null);
      localStress.set(id, (localStress.get(id) ?? 0) + 1);
    }
  }
  for (const { id, region, type, name, districtId } of competitors) {
    const firm = e.firms[id];
    const terms = getDistrictSimulation(s, districtId);
    const demand = terms.demand;
    if (firm.status === "closed") {
      if (d < firm.reopenDay || demand < 85) continue;
      // New outside equity funds reopening. No previous cash or transactions replay.
      Object.assign(firm, {
        cash: type.startup,
        stock: 0,
        workers: 2,
        reputation: 35,
        failed: 0,
        revenue: 0,
        costs: 0,
        reopenDay: 0,
        status: "open",
      });
      event(s, api, "business.npc-open", id, "Yerel talep yeni bir bağımsız işletme çekti.");
    }
    const player =
      e.business?.region === region &&
      (e.business.districtId ?? firmsById.get(`${region}:${type.id}`).districtId) === districtId &&
      s.deep.business?.id === type.id &&
      s.deep.business.status === "active" &&
      s.deep.business.clients > 0;
    const rivalPrice = player ? priceAdjustment(s, e.business, type).price : type.unitPrice;
    const localIndex = marketIndex(s, region, "price");
    const productionCost = Math.round(
      (type.unitCost * localIndex * (100 + terms.serviceDelay / 5)) / 10000,
    );
    const staff = workersByFirm.get(id) ?? [];
    const shift = region === "istanbul" || workday(d);
    const scheduled = staff.flatMap((employee) => {
      const n = e.residents[employee];
      if (!shift || n.life.health < 42 || residentAge(n.life, d) >= 67) return [];
      const from = residentDistrict(s, regionalResidents[residentIndex.get(employee)], n.life);
      const route = from === districtId ? { available: true, cost: 0, minutes: 0 }
        : routeForResident(s, from, workSite(districtId), 8);
      return route?.available && route.minutes <= 100 && npcFunds(n) >= 2 * route.cost
        ? [{ n, fare: 2 * route.cost }] : [];
    });
    const untracked = shift ? Math.max(0, firm.workers - staff.length - playerPosition(s, id)) : 0;
    const workforce = untracked + scheduled.length;
    const payroll = scheduled.map(({ n }) => residentWage(s, region, type, n.life.skill));
    const overhead =
      payroll.reduce((sum, wage) => sum + wage, untracked * wageRate(s, region)) + 65;
    const targetPrice = Math.round((type.unitPrice * localIndex) / 100);
    firm.price = Math.max(
      productionCost + 60,
      Math.round((targetPrice * 3 + firm.price + (player ? rivalPrice : targetPrice)) / 5),
    );
    const production = Math.max(
      0,
      Math.min(12 - firm.stock, workforce * 2, Math.floor((firm.cash - overhead) / productionCost)),
    );
    firm.stock += production;
    firm.cash -= production * productionCost;
    firm.costs = asMoney(firm.costs + production * productionCost);
    // The untracked population provides external demand. Labor and taxes are actual transfers.
    const customers = shift
      ? bound(
          Math.floor(demand / 31) +
            (firm.reputation >= 60 ? 1 : 0) -
            (player && rivalPrice <= firm.price ? 1 : 0) -
            Math.min(2, Math.ceil((localStress.get(districtId) ?? 0) / 2)) -
            (demand < 82 ? 2 : 0),
          0,
          6,
        )
      : 0;
    const sold = Math.min(firm.stock, customers);
    const gross = Math.min(MAX - firm.cash, sold * firm.price);
    const tax = Math.floor(gross * 0.04);
    firm.stock -= sold;
    firm.revenue = asMoney(firm.revenue + gross);
    firm.cash += gross - tax;
    firm.costs = asMoney(firm.costs + tax);
    if (tax) api.creditMunicipalTax?.(s, region, tax);
    const paid = Math.min(overhead, firm.cash);
    firm.cash -= paid;
    firm.costs = asMoney(firm.costs + paid);
    let remaining = paid;
    for (const [index, { n, fare }] of scheduled.entries()) {
      const wage = Math.min(remaining, payroll[index]);
      if (fare) spendNpc(n, fare);
      n.cash = asMoney(n.cash + wage);
      remaining -= wage;
    }
    firm.failed = paid < overhead ? firm.failed + 1 : 0;
    if (firm.failed >= 3) {
      firm.status = "closed";
      firm.closed++;
      firm.workers = 0;
      firm.stock = 0;
      firm.reopenDay = d + 30;
      event(s, api, "business.npc-closure", id, "Giderlerini karşılayamayan işletme kapandı.");
    } else if (d % 7 === 1) {
      if (demand > 104 && firm.cash > type.startup * 2 && firm.workers < 3) firm.workers++;
      else if (firm.workers > playerPosition(s, id) + 1 && (demand < 85 || firm.cash < overhead * 5))
        firm.workers--;
      firm.reputation = bound(firm.reputation + (firm.stock < 6 ? 1 : -2), 0, 100);
    }
    const capacity = firm.status === "open" ? firm.workers - playerPosition(s, id) : 0;
    for (const employee of staff.slice(capacity)) {
      const n = e.residents[employee];
      n.life.employer = "";
      n.employment = "searching";
      residentEvent(s, api, regionalResidents[residentIndex.get(employee)], "job", districtId,
        `${name} · İş sözleşmesi sona erdi.`, "job-loss");
    }
  }
}

function activeHomeActions(s, actions, api) {
  const lot = lotsById.get(economy(s)?.home);
  if (!lot) return actions;
  const home = homes.find(({ id }) => id === lot.anchor);
  const furniture = s.living.household;
  const maintained = s.time < furniture.maintainedUntil;
  const isAtHome = getPlace(s).districtId === lot.districtId;
  const away = isAtHome ? "" : `Evine dön · ${lot.name}`;
  const today = day(s);
  const minute = s.time % DAY;
  return actions.flatMap((action) => {
    const id = action.id;
    // Active property contracts pay rent/title independently of the old lease.
    if (/^(?:move:|lease:renew$|household:(?:lease$|invite:))/.test(id)) return [];
    if (id === "sleep") {
      const bed = maintained && furniture.assets.includes("bed") ? 5 : 0;
      const energy = home.rest + (s.player.trait === "balanced" ? 5 : 0) + (s.flags.homeComfort || 0) + bed;
      const reason = away || (minute >= 480 && minute < 1080 && s.flags.lastSleepDay === today
        ? "Gündüz uykunu kullandın. Dinlenebilir veya akşamı bekleyebilirsin." : "");
      return [{
        ...action,
        description: `${lot.name} · Uyku enerjisi +${energy}; stres −16.`,
        disabled: Boolean(reason),
        reason,
        run(next) {
          api.change(next, { energy, stress: -16, health: next.player.hunger >= 35 ? 4 : 0 });
          next.flags.lastSleepDay = today;
          return "Dinlendin; takvim, ödemeler ve mahalle hayatı ilerledi.";
        },
      }];
    }
    if (id === "cook") {
      const kitchen = maintained && furniture.assets.includes("kitchen");
      const reason = away || (!s.inventory.groceries ? "Envanterinde erzak yok." : "");
      return [{
        ...action,
        description: `${lot.name} · Bir erzak; tokluk +${kitchen ? 70 : 65}, zanaat +1.`,
        minutes: kitchen ? 30 : 45,
        disabled: Boolean(reason),
        reason,
        run(next) {
          next.inventory.groceries--;
          api.change(next, { hunger: kitchen ? 70 : 65 });
          api.skill(next, "craft", 1);
          return "Evde yemek hazırladın; bir erzak kullanıldı.";
        },
      }];
    }
    if (id.startsWith("household:buy:") || id === "household:maintain") {
      const reason = away || (id === "household:maintain"
        ? !furniture.assets.length ? "Önce bir ev eşyası edin."
          : furniture.maintainedUntil > s.time + 7 * DAY
            ? "Bakımın son yedi gününde veya bitince yenileyebilirsin." : ""
        : "");
      return [{ ...action, disabled: Boolean(reason), reason }];
    }
    return [action];
  });
}

export function adaptEconomyActions(s, baseActions, api) {
  const actions = activeHomeActions(s, baseActions, api);
  const e = s.expansion?.economy?.business;
  if (!e || !s.deep.business) return actions;
  const type = BUSINESS_TYPES.find((x) => x.id === s.deep.business.id);
  const b = s.deep.business;
  const blocked = (action, reason) => ({ ...action, disabled: true, reason });
  return actions.map((action) => {
    if (!action.id.startsWith("business:")) return action;
    const id = action.id;
    const place = getPlace(s);
    const districtId = e.districtId ?? (e.region === "istanbul" ? b.location : firmsById.get(`${e.region}:${b.id}`).districtId);
    const localGold = e.region === "istanbul" && legacyHomes.some((lot) =>
      lot.region === "istanbul" && lot.districtId === districtId);
    if (/^business:(acquire|serve|stock:|upgrade)/.test(id)) {
      if (regionOf(s) !== e.region) return blocked(action, "İşletmenin şehrine git.");
      if (place.districtId !== districtId) return blocked(action, "İşletmenin semtine git.");
      if (!localGold && action.reason === "İşletmenin semtine git.") {
        const unavailable = b.status !== "active" ? "İşletme durmuş durumda."
          : id === "business:serve" && (!b.clients || !s.living.enterprise.stock || b.lastServiceDay === day(s) ||
              s.player.energy < 20) ? "Şu anda hizmet vardiyası yapılamıyor."
          : id === "business:acquire" && (b.lastAcquireDay === day(s) || s.living.enterprise.capital < 180 ||
              b.clients >= Math.min(8, 2 + b.level * 2, Math.max(2, Math.floor(
                getDistrictSimulation(s, districtId).demand / 16))))
            ? "Şu anda müşteri edinimi yapılamıyor." : "";
        if (unavailable) return blocked(action, unavailable);
        action = { ...action, reason: "", disabled: false };
      }
    }
    if (id === "business:pause") {
      const opening = b.status === "paused";
      if (opening && (e.wageDue || e.taxDue || e.missed >= 3))
        return blocked(action, "Önce ücret, vergi ve krediyi öde.");
      const charge = opening ? b.arrears : Math.ceil(b.accruedOverhead);
      const reason =
        opening && s.living.enterprise.capital < charge ? "İşletme kasası yetersiz." : "";
      return {
        ...action,
        cost: 0,
        description: `${charge} TL işletme kasasından. ${opening ? "Birikmiş gider." : "Karşılanmayan gider borca geçer."}`,
        disabled: Boolean(reason),
        reason,
        run(next) {
          const business = next.deep.business;
          if (opening) {
            next.living.enterprise.capital -= charge;
            if (charge) businessRecord(next, -charge, "İşletme sabit gideri", api);
            business.arrears = 0;
            business.status = "active";
            return "İşletme yeniden açıldı.";
          }
          payBusinessOverhead(next, api);
          business.status = "paused";
          return "İşletmeye ara verildi.";
        },
      };
    }
    if (id.startsWith("business:withdraw:") && (e.wageDue || e.taxDue || e.missed))
      return blocked(action, "Borç varken kâr çekilemez.");
    if (
      id === "business:close" &&
      e.workers &&
      s.living.enterprise.capital < e.workers * wageRate(s, e.region) * 3
    )
      return blocked(action, "Kapatmadan önce kıdemi öde.");
    if (id.startsWith("business:stock:")) {
      const units = Number(id.split(":")[2]);
      if (s.living.enterprise.stock + units > 24) return blocked(action, "Stok kapasitesi 24 birim.");
      const local = localGold;
      const amount =
        local && action.societyCost
          ? Math.round(
              (action.societyCost.amount *
                (e.supplier === "cooperative" ? 0.86 : 1) *
                (100 + commercialTerms(s, e.region, type).serviceDelay / 5)) /
                100,
            )
          : units * suppliers(s, e, type);
      const reprice = [
        "Malzeme için işletme sermayesi aktar.",
        "Güncel malzeme fiyatı için işletme kasası yetersiz.",
      ];
      if (!local) reprice.push(SOCIETY_COPY.noStock);
      const localSupply = !local && e.supplier === "local"
        ? getDistrictEmployers(s, districtId).filter(({ firm }) => firm.status === "open")
        : [];
      if (action.disabled && !reprice.includes(action.reason)) return action;
      if (local && s.society.districts[s.location].materialStock < units)
        return blocked(action, "Semt stoğu yetersiz.");
      if (!local && e.supplier === "local" && !localSupply.some(({ firm }) => firm.stock >= units && firm.cash <= MAX - amount))
        return blocked(action, "Semt stoğu yetersiz.");
      if (e.supplier === "cooperative" && units < 6)
        return blocked(action, "Kooperatif siparişi en az altı birim.");
      if (s.living.enterprise.capital < amount)
        return blocked(action, "Kasada tedarik parası yok.");
      return {
        ...action,
        disabled: false,
        reason: "",
        description: `${units} hizmetlik stok; ${amount} TL işletme kasasından.`,
        run(next) {
          next.living.enterprise.capital -= amount;
          next.living.enterprise.stock += units;
          next.living.enterprise.lastRestockAt = next.time;
          if (local) next.society.districts[next.location].materialStock -= units;
          else if (e.supplier === "local") {
            const id = localSupply.find(({ firm }) => firm.stock >= units && firm.cash <= MAX - amount).id;
            const vendor = economy(next).firms[id];
            vendor.stock -= units;
            vendor.cash += amount;
            vendor.revenue = asMoney(vendor.revenue + amount);
          }
          next.deep.business.costs = asMoney(next.deep.business.costs + amount);
          businessRecord(next, -amount, "İşletme stoğu · tedarikçi ödemesi", api);
          return `${units} stok alındı; ${amount} TL işletme kasasından ödendi.`;
        },
      };
    }
    if (action.disabled) return action;
    if (id === "business:serve") {
      const { price, demand } = priceAdjustment(s, e, type);
      const score =
        localGold
          ? s.living.markets[b.location].demand
          : marketIndex(s, e.region, "employment");
      const served = Math.min(
        s.living.enterprise.stock,
        b.clients,
        b.level + 2,
        Math.max(0, Math.floor(((b.level + 2) * score * demand) / 10000)),
      );
      const operating = served * 30;
      const revenue = Math.round(served * price * (s.player.energy < 35 ? 0.65 : 1));
      if (!served || s.living.enterprise.capital < operating)
        return blocked(action, "Bu fiyatla kârlı sipariş yok.");
      if (s.living.enterprise.capital + revenue - operating > MAX || b.revenue + revenue > MAX)
        return blocked(action, "İşletme hesabı üst sınırda.");
      return {
        ...action,
        description: `${served} müşteri, liste fiyatı ${price} TL. Stoktan. Gider ${operating} TL, gelir ${revenue} TL.`,
        run(next) {
          const business = next.deep.business;
          next.living.enterprise.stock -= served;
          next.living.enterprise.capital += revenue - operating;
          business.costs = asMoney(business.costs + operating);
          business.revenue += revenue;
          business.lastServiceDay = day(next);
          business.reputation = bound(
            business.reputation + (next.player.energy < 35 ? -5 : 3),
            0,
            100,
          );
          if (next.player.energy < 35) business.clients = Math.max(0, business.clients - 1);
          businessRecord(next, revenue - operating, "Müşteri hizmeti · işletme kasası", api);
          api.change(next, { energy: -18, stress: 8 });
          api.skill?.(next, type.skill, 1);
          return `${served} stok kullanıldı; işletme kasasına net ${revenue - operating} TL girdi.`;
        },
      };
    }
    return action;
  });
}

export function afterEconomyAction(s, before, api, action) {
  if (!s.expansion?.economy) return;
  const e = economy(s);
  if (action.id.startsWith("move:") && e.home) vacate(s, api, false);
  if (!before.deep.business && s.deep.business) {
    e.business = businessState(s);
    event(s, api, "business.open", s.deep.business.id, "İşletme ve tedarik defteri açıldı.");
  } else if (before.deep.business && !s.deep.business) {
    const b = economy(before).business;
    const severance = b.workers * wageRate(before, b.region) * 3;
    const tax =
      b.taxDue + Math.floor(Math.max(0, before.deep.business.revenue - b.lastTaxRevenue) * 0.04);
    const liability = b.principal + b.wageDue + severance + tax;
    const paid = Math.min(funds(s), liability);
    if (paid) api.spend(s, paid, "Tasfiye · son ücret, vergi ve kredi", "total");
    const taxPaid = Math.min(tax, Math.max(0, paid - b.wageDue - severance));
    if (taxPaid) api.creditMunicipalTax?.(s, b.region, taxPaid);
    if (paid < liability) {
      const debt = Math.min(MAX - s.debt, liability - paid);
      s.debt += debt;
      api.record(s, "Tasfiye · kalan yükümlülük", debt, "debt");
    }
    e.business = null;
    event(
      s,
      api,
      "business.close",
      before.deep.business.id,
      `Tasfiye sonrası kalan yükümlülük ${liability - paid} TL.`,
    );
  }
}

function residentExpense(s, region, home) {
  // An occupied title or active lease has its own monthly settlement.
  const price = marketIndex(s, region, "price");
  return Math.round(((home ? 66 : 179) * price) / 100);
}

function residentEvent(s, api, resident, type, districtId, detail, eventType = type) {
  const { id } = resident;
  const e = economy(s);
  const history = e.activity[id].history;
  const { generation } = e.residents[id].life;
  history.push({ kind: type, districtId, day: day(s), generation });
  if (history.length > 8) history.shift();
  if (detail) event(s, api, `resident.${eventType}`, id, detail);
}

const routeForResident = (s, from, to, hour) => routeBetween(s, from, to, {
  actor: "npc",
  at: (day(s) - 1) * DAY + hour * 60,
});
const siteOf = (id, ...kinds) => venuesByDistrict.get(id)?.find(({ kind }) => kinds.includes(kind));
const workSite = (id) => siteOf(id, "work")?.id;

function residentOffer(s, n, homeDistrict, home) {
  const { life } = n;
  const local = life.region;
  let winner = null;
  const contract = life.employer && firmsById.get(life.employer);
  const localCost = residentExpense(s, local, Boolean(home)) +
    Math.ceil((home ? playerProperty(s, home).lease?.rent ?? 0 : 0) / 30);
  const expenseByRegion = Object.fromEntries(REGIONS.map((region) => [region,
    region === local ? localCost : residentExpense(s, region, false)]));
  // The bounded public vacancy market advertises funded seats and qualifications.
  // Residents evaluate those terms against their own skills, travel and housing costs.
  for (const firm of competitors) {
    const account = economy(s).firms[firm.id];
    if (life.skill < firm.type.required || account.status !== "open") continue;
    const retained = firm === contract;
    const wage = residentWage(s, firm.region, firm.type, life.skill);
    if (!retained && (account.cash < wage * 3 || !vacancies(s, firm, staffIds(s, firm.id).length))) continue;
    const move = firm.region !== local;
    if (firm.districtId !== homeDistrict && !workSite(firm.districtId)) continue;
    const route = firm.districtId === homeDistrict
      ? { available: true, cost: 0, minutes: 0 }
      : routeForResident(s, homeDistrict, workSite(firm.districtId), 8);
    if (!route?.available || (!move && route.minutes > 100)) continue;
    const commute = move ? 0 : route.cost * 2 + Math.floor(route.minutes / 8);
    const margin = Math.floor((wage - commute) * 5 / 7) - expenseByRegion[firm.region];
    const value = margin + (retained ? 26 : 0) - (move ? 40 + Math.ceil(route.cost / 12) : 0);
    if (move && (npcFunds(n) < route.cost + 400 || s.expansion.world.regions[local].population <= 1))
      continue;
    if (!winner || winner.value < value) winner = { firm, route, move, value };
  }
  return winner;
}

function regionalDecision(s, api, resident, n, home) {
  const { life } = n;
  const districtId = residentDistrict(s, resident, life, home);
  const offer = residentOffer(s, n, districtId, home);
  if (!offer || offer.firm.id === life.employer) return;
  const activity = economy(s).activity[resident.id];
  if (offer.move) {
    const title = residentProperty(s, resident.id);
    const property = title && playerProperty(s, title);
    const occupied = home && playerProperty(s, home);
    if (property?.lease || occupied?.lease?.arrears || (life.employer && offer.value < 0)) return;
    spendNpc(n, offer.route.cost);
    if (occupied?.lease) releaseResidentLease(s, occupied, api);
    if (property) {
      payOwner(s, resident.id, saleValue(s, title, property), api, "Konut satışı");
      property.owner = MARKET;
    }
    const origin = life.region;
    life.region = offer.firm.region;
    activity.districtId = offer.firm.districtId;
    activity.trip = null;
    migratePopulation(s, origin, life.region, 1);
    residentEvent(s, api, resident, "move", activity.districtId,
      `${CITIES[origin].name} → ${CITIES[life.region].name}`, "migration");
  }
  life.employer = offer.firm.id;
  n.employment = "employed";
  residentEvent(s, api, resident, "job", offer.firm.districtId, `${offer.firm.name} · İşe başladı.`, "hired");
}

function residentService(s, api, resident, n, service, districtId) {
  const { region } = n.life;
  const eligible = (id) => service === "health"
    ? siteOf(id, "clinic", "health", "institution", "class")
    : siteOf(id, "school", "class", "institution");
  const site = eligible(districtId) ?? eligible(hubDistrict(region));
  if (!site) return false;
  const route = routeForResident(s, districtId, site.id, 10);
  if (!route?.available) return false;
  const quote = residentServiceQuote(s, region, service, site.districtId);
  if (!quote || npcFunds(n) < quote.fee + 2 * route.cost) return false;
  const paid = api.creditMunicipalTax?.(s, region, quote.fee) ?? 0;
  if (paid !== quote.fee) return false;
  spendNpc(n, paid + 2 * route.cost);
  residentEvent(s, api, resident, service === "health" ? "health" : "training", site.districtId);
  return true;
}

function linkResidents(s, id, other, today) {
  const e = economy(s);
  const contacts = e.activity[id].contacts;
  const generation = e.residents[other].life.generation;
  const prior = contacts[other];
  if (prior?.generation === generation && prior.day === today) return;
  if (!prior && Object.keys(contacts).length >= 6) {
    const leastRecent = Object.entries(contacts).reduce((a, b) => a[1].day <= b[1].day ? a : b);
    delete contacts[leastRecent[0]];
  }
  contacts[other] = {
    generation, day: today,
    score: Math.min(100, (prior?.generation === generation ? prior.score : 0) + 6),
  };
}

function residentSocialTrip(s, api, resident, n, districtId) {
  const today = day(s);
  const { id } = resident;
  const e = economy(s);
  const activity = e.activity[id];
  if (activity.trip || npcFunds(n) < 450 || n.life.health < 50) return;
  const index = residentIndex.get(id);
  const candidates = cityDistricts(n.life.region);
  const destination = candidates[(Math.floor(today / 7) + index * 5) % candidates.length].id;
  // Keep the originating district socially populated. Visitors travel only to a host district
  // with a healthy homebody, and routes use the same closing hours and fares as player travel.
  const host = regionalResidents.find((other) => other.id !== id &&
    e.residents[other.id].life.health >= 50 && !e.activity[other.id].trip &&
    residentDistrict(s, other, e.residents[other.id].life, null) === destination);
  const site = siteOf(destination, "social", "meeting");
  if (!host || !site) return;
  const route = routeForResident(s, districtId, site.id, 17);
  if (!route?.available || route.minutes > 120 || npcFunds(n) < route.cost * 2 + 200) return;
  if (destination !== districtId) {
    // The round trip is paid once. Re-entering the district only changes the view.
    spendNpc(n, 2 * route.cost);
    activity.trip = { districtId: destination, started: today, returnDay: today + 1 };
    residentEvent(s, api, resident, "journey", destination);
  }
  linkResidents(s, id, host.id, today);
  linkResidents(s, host.id, id, today);
}

function settleRegionalResidents(s, api) {
  const d = day(s);
  const e = economy(s);
  for (const [index, resident] of regionalResidents.entries()) {
    const { id } = resident;
    const n = e.residents[id];
    const { life } = n;
    let age = residentAge(life, d);
    const activity = e.activity[id];
    const home = regionalHome(s, id);
    const districtId = residentDistrict(s, resident, life, home);
    activity.districtId = districtId;
    if (activity.trip?.returnDay <= d) {
      activity.trip = null;
      residentEvent(s, api, resident, "return", districtId);
    }
    const livingCost = residentExpense(s, life.region, Boolean(home));
    const paid = Math.min(npcFunds(n), livingCost);
    spendNpc(n, paid);
    // Vendors extend at most two weeks of ordinary credit. Existing obligations
    // are kept in full, and rent arrears follow the separate lease settlement.
    n.debt += Math.min(livingCost - paid, Math.max(0, livingCost * 14 - n.debt));
    const aging = age > 58 ? 2 : 0;
    life.health = bound(life.health + (paid < livingCost ? -4 : 3 - aging), 0, 100);
    const lifespan = 74 + ((s.seed + index * 3) % 15);
    if (age >= lifespan || life.health === 0) {
      // The household title, lease, assets and liabilities pass together to its successor.
      residentEvent(s, api, resident, "death", districtId,
        `${residentName(index, life.generation)} · Hane mirası devredildi.`, "inheritance");
      const market = s.expansion.world.regions[life.region];
      if (Number.isSafeInteger(market.births) && Number.isSafeInteger(market.deaths)) {
        market.deaths++;
        market.births++;
      }
      for (const local of Object.values(e.activity)) delete local.contacts[id];
      Object.assign(activity, { contacts: {}, trip: null });
      Object.assign(life, {
        born: d - 24 * 30, generation: Math.min(400000, life.generation + 1),
        health: 91, skill: bound(life.skill, 30, resident.type.required), employer: "",
      });
      age = 24;
    }
    if (age >= 67 || !life.employer) {
      life.employer = "";
      n.employment = "searching";
    }
    if (age >= 67 && (d - 1) % 30 === 0) n.cash = asMoney(n.cash + 900);
    const decisionDay = (d + index) % 7 === 0;
    if (
      life.health < 55 &&
      decisionDay &&
      npcFunds(n) >= 460 &&
      residentService(s, api, resident, n, "health", districtId)
    )
      life.health = Math.min(100, life.health + 24);
    if (n.debt && n.cash > 900) {
      const repayment = Math.min(n.debt, n.cash - 900, 220);
      n.cash -= repayment;
      n.debt -= repayment;
    }
    if (n.cash > 4500 && n.savings < MAX) {
      const saved = Math.min(n.cash - 4500, 280, MAX - n.savings);
      n.cash -= saved;
      n.savings += saved;
    }
    if (!decisionDay) continue;
    if ((d + index) % 14 === 0) residentSocialTrip(s, api, resident, n, districtId);
    if (age >= 67 || activity.trip) continue;
    if (
      n.cash >= 680 &&
      life.health >= 55 &&
      life.skill < 72 &&
      !life.employer &&
      residentService(s, api, resident, n, "skills", districtId)
    ) {
      life.skill += 4;
      event(s, api, "resident.training", id, "Ücretli eğitim mesleki beceriyi geliştirdi.");
    }
    if (life.health >= 42) regionalDecision(s, api, resident, n, home);
  }
}

export function tickEconomy(s, api) {
  const e = s.expansion?.economy;
  if (!e || e.lastDay >= day(s)) return;
  migrateEconomy(s);
  e.lastDay = day(s);
  settleProperties(s, api);
  settleBusiness(s, api);
  settleCompetitors(s, api);
  settleRegionalResidents(s, api);
}

export function economyView(s) {
  if (!s.expansion?.economy) return null;
  const e = economy(s);
  const business =
    e.business && s.deep.business
      ? {
          ...e.business,
          name: BUSINESS_TYPES.find(({ id }) => id === s.deep.business.id).name,
          stock: s.living.enterprise.stock,
          capital: s.living.enterprise.capital,
          revenue: s.deep.business.revenue,
          costs: s.deep.business.costs,
          clients: s.deep.business.clients,
          reputation: s.deep.business.reputation,
          wageRate: wageRate(s, e.business.region),
          overhead: s.deep.business.arrears,
          status: s.deep.business.status,
        }
      : null;
  return {
    home: e.home,
    properties: regionHomes.filter((lot) => playerProperty(s, lot)).map((lot) => {
      const p = playerProperty(s, lot);
      return {
        id: lot.id,
        name: lot.name,
        region: lot.region,
        districtId: lot.districtId,
        condition: p.condition,
        value: propertyValue(s, lot, p),
        ownership: p.owner,
        tenancy: p.lease?.tenant || "",
        rent: p.lease?.rent ?? propertyRent(s, lot, p),
        mortgage: debtor(p),
        arrears: p.lease?.arrears ?? 0,
        repairCost: repairCost(p),
        leaseDueDay: p.lease?.dueDay ?? null,
        mortgageDueDay: p.mortgage?.dueDay ?? null,
        mortgagePayment: p.mortgage
          ? mortgageDue(p, p.mortgage.interest + Math.ceil(p.mortgage.principal * 0.008))
          : 0,
        rentCashFlow: p.lease
          ? p.lease.tenant === HOUSEHOLD
            ? -p.lease.rent
            : p.owner === HOUSEHOLD
              ? p.lease.rent
              : 0
          : 0,
      };
    }),
    business,
    regions: regionalMarkets(s, true),
  };
}

export function regionalMarkets(s, details = false) {
  const { business, firms, residents } = economy(s);
  return Object.fromEntries(
    REGIONS.map((region) => {
      const local = competitors.filter((firm) => firm.region === region && firms[firm.id]);
      const active = local.filter(({ id }) => firms[id].status === "open");
      const owned = business?.region === region && s.deep.business?.status === "active";
      const workers = active.reduce((sum, { id }) => sum + firms[id].workers, 0);
      const jobseekers = regionalResidents.filter((resident) => {
        if (!residents[resident.id]) return false;
        const life = residentLife(s, resident);
        return life.region === region && !life.employer && residentAge(life, day(s)) < 67;
      }).length;
      const summary = {
        businesses: active.length + Number(owned),
        workers: workers + (owned ? business.workers : 0),
        jobseekers,
        sales:
          local.reduce((sum, { id }) => sum + firms[id].revenue, 0) +
          (owned ? s.deep.business.revenue : 0),
        averagePrice: active.length
          ? Math.round(active.reduce((sum, { id }) => sum + firms[id].price, 0) / active.length)
          : 0,
      };
      if (details) {
        summary.residents = regionalResidents.flatMap((resident, index) => {
          const { id } = resident;
          if (!residents[id]) return [];
          const { cash, savings, debt } = residents[id];
          const life = residentLife(s, resident, index);
          if (life.region !== region) return [];
          const age = residentAge(life, day(s));
          const employment = age >= 67 ? "retired" : life.employer ? "employed" : "searching";
          return [
            {
              ...life,
              id,
              age,
              employment,
              cash,
              savings,
              debt,
              name: residentName(index, life.generation),
              home: regionalHome(s, id)?.id ?? "",
              ...residentPresence(s, resident, life),
              contacts: economy(s).activity?.[id]?.contacts ?? {},
              history: economy(s).activity?.[id]?.history ?? [],
            },
          ];
        });
        summary.firms = local.map(({ id, name, type, districtId }) => ({
          id,
          name,
          region,
          type: type.id,
          districtId,
          ...firms[id],
          employeeIds: staffIds(s, id),
        }));
      }
      return [region, summary];
    }),
  );
}

function residentPresence(s, resident, life) {
  const districtId = residentDistrict(s, resident, life);
  const work = life.employer && firmsById.get(life.employer);
  const minute = s.time % DAY;
  const trip = economy(s).activity?.[resident.id]?.trip;
  let presentDistrictId = districtId;
  let locationId = null;
  if (work && life.health >= 42 && economy(s).firms[work.id]?.status === "open" &&
      (life.region === "istanbul" || workday(day(s))) && minute >= 8 * 60 && minute < 16 * 60) {
    presentDistrictId = work.districtId;
    locationId = workSite(presentDistrictId);
  }
  if (trip && minute >= 17 * 60) {
    const route = routeForResident(s, districtId, siteOf(trip.districtId, "social", "meeting")?.id, 17);
    presentDistrictId = route?.available && minute >= 17 * 60 + route.minutes ? trip.districtId : null;
  }
  const legacyKizilay = resident.id === "resident:ankara:0" && presentDistrictId === "ankara:cankaya";
  const socialVenueId = legacyKizilay ? "ankara:kizilay:social"
    : siteOf(presentDistrictId, "social", "meeting")?.id ?? null;
  if (minute >= 18 * 60 && minute < 21 * 60) locationId = socialVenueId;
  return {
    districtId, presentDistrictId, socialVenueId,
    locationId: getPlace(s).districtId === presentDistrictId ? locationId ?? null : null,
  };
}

function validActivity(s, activity, id, today) {
  const e = economy(s);
  const resident = e.residents[id].life;
  if (!shape(activity, { "districtId trip contacts history": null }, 1) ||
      !districtIds.has(activity.districtId) || districtById(activity.districtId).regionId !== resident.region ||
      !shape(activity.contacts, {}) || Object.keys(activity.contacts).length > 6 ||
      !Array.isArray(activity.history) || activity.history.length > 8) return false;
  if (activity.trip !== null && (!shape(activity.trip, { districtId: null, started: [today, today], returnDay: [today + 1, today + 1] }, 1)
      || !districtIds.has(activity.trip.districtId) || activity.trip.districtId === activity.districtId ||
      districtById(activity.trip.districtId).regionId !== resident.region)) return false;
  return Object.entries(activity.contacts).every(([other, row]) => other !== id && residentIndex.has(other) &&
    shape(row, { generation: [e.residents[other]?.life?.generation, e.residents[other]?.life?.generation],
      score: [1, 100], day: [1, today] }, 1)) &&
    activity.history.every((row, index, rows) =>
      shape(row, { kind: "journey return move health training job eviction death", districtId: null, day: [rows[index - 1]?.day ?? 1, today], generation: [1, 400000] }, 1) &&
        districtIds.has(row.districtId));
}

const matchIds = (map, catalog) =>
  shape(map, { [catalog.map(({ id }) => id).join(" ")]: null }, 1);

export function validateEconomy(s) {
  const e = s.expansion?.economy;
  const today = day(s);
  const expanded = Boolean(e && Object.hasOwn(e, "activity"));
  const lots = expanded ? regionHomes : legacyHomes;
  const firms = expanded ? competitors : legacyFirms;
  const residents = expanded ? regionalResidents : legacyResidents;
  if (
    !shape(e, { lastDay: [today, today], "home properties business residents firms": null,
      ...(expanded ? { activity: null } : {}) }, 1) ||
    !matchIds(e.properties, lots) || !matchIds(e.firms, firms) || !matchIds(e.residents, residents) ||
    (s.expansion.livingWorld === 2 && !expanded) ||
    (expanded && !matchIds(e.activity, residents)) ||
    !(e.home === "" || lots.some(({ id }) => id === e.home))
  ) return false;
  const profiles = residents.filter(({ id }) =>
    Object.hasOwn(e.residents[id] ?? {}, "life"),
  );
  if ((expanded && !profiles.length) || (profiles.length && profiles.length !== residents.length))
    return false;
  const staffing = new Map(),
    residentRegions = new Map();
  for (const resident of residents) {
    const n = e.residents[resident.id];
    if (
      !shape(
        n,
        {
          "cash savings debt": MAX,
          employment: "employed searching",
          ...(profiles.length ? { life: null } : {}),
        },
        1,
      )
    )
      return false;
    const life = n.life;
    if (profiles.length) {
      if (
        !shape(
          life,
          {
            region: (expanded ? REGIONS : secondaryRegions).join(" "),
            employer: null,
            born: [today - 2700, today - 540],
            generation: [1, 400000],
            "health skill": 100,
          },
          1,
        ) ||
        (life.employer === "") !== (n.employment === "searching")
      )
        return false;
      if (life.employer) {
        const job = firmsById.get(life.employer);
        if (
          !job ||
          job.region !== life.region ||
          life.skill < job.type.required ||
          e.firms[life.employer]?.status !== "open" ||
          residentAge(life, today) >= 67
        )
          return false;
        staffing.set(life.employer, (staffing.get(life.employer) ?? 0) + 1);
      }
    }
    residentRegions.set(resident.id, life?.region ?? resident.region);
    if (expanded && !validActivity(s, e.activity[resident.id], resident.id, today)) return false;
  }
  const tenants = new Set(),
    owners = new Set();
  for (const lot of lots) {
    const p = e.properties[lot.id];
    if (
      !shape(p, { "owner mortgage lease": null, condition: [35, 100] }, 1) ||
      !validOwner(p.owner)
    )
      return false;
    if (isResident(p.owner)) {
      if (
        owners.has(p.owner) ||
        (citizens.has(p.owner)
          ? lot.region !== "istanbul"
          : residentRegions.get(p.owner) !== lot.region)
      )
        return false;
      owners.add(p.owner);
    }
    if (p.mortgage) {
      if (
        !shape(
          p.mortgage,
          { principal: [1, MAX], interest: MAX, dueDay: [today + 1, today + 30], missed: 2 },
          1,
        ) ||
        p.owner !== HOUSEHOLD
      )
        return false;
    } else if (p.mortgage !== null) return false;
    if (p.lease) {
      const l = p.lease;
      if (
        !shape(
          l,
          {
            tenant: null,
            rent: [1, 30000],
            deposit: 30000,
            dueDay: [today + 1, today + 30],
            arrears: MAX,
            missed: 2,
          },
          1,
        ) ||
        l.tenant === p.owner ||
        !(l.tenant === HOUSEHOLD || isResident(l.tenant)) ||
        tenants.has(l.tenant) ||
        (l.tenant === HOUSEHOLD && e.home !== lot.id) ||
        (l.tenant !== HOUSEHOLD &&
          ((p.owner === MARKET && (!expanded || lot.index < 3 || lot.index % 3 !== 0)) ||
            (citizens.has(l.tenant)
              ? lot.region !== "istanbul"
              : residentRegions.get(l.tenant) !== lot.region)))
      )
        return false;
      tenants.add(l.tenant);
    } else if (p.lease !== null) return false;
    if (
      e.home === lot.id &&
      (s.housing.id !== lot.anchor ||
        s.housing.rent !== 0 ||
        s.housing.deposit !== 0 ||
        !(p.owner === HOUSEHOLD ? p.lease === null : p.lease?.tenant === HOUSEHOLD))
    )
      return false;
  }
  if ([...tenants].some((id) => id !== HOUSEHOLD && owners.has(id))) return false;
  const b = e.business;
  if (b) {
    if (
      !s.deep.business ||
      !shape(
        b,
        {
          region: REGIONS.join(" "),
          ...(Object.hasOwn(b, "districtId") ? { districtId: null } : {}),
          price: null,
          supplier: "local cooperative",
          workers: 3,
          "wageDue principal taxDue taxes": MAX,
          missed: 3,
          lastTaxRevenue: [0, s.deep.business.revenue],
          payrollMissed: 400000,
          installmentDay: null,
        },
        1,
      ) ||
      (Object.hasOwn(b, "districtId") && districtById(b.districtId)?.regionId !== b.region) ||
      ![85, 100, 120].includes(b.price) ||
      (b.principal ? !integer(b.installmentDay, today + 1, today + 30) : b.installmentDay !== 0)
    )
      return false;
  } else if (b !== null || s.deep.business) return false;
  return firms.every(({ id }) => {
    const f = e.firms[id];
    return (
      shape(
        f,
        {
          "cash revenue costs": MAX,
          stock: 12,
          workers: [staffing.get(id) ?? 0, 3],
          reputation: 100,
          price: [1, 2000],
          failed: 3,
          closed: 400000,
          "status reopenDay": null,
        },
        1,
      ) &&
      (f.status === "open"
        ? f.workers > 0 && f.reopenDay === 0 && f.failed < 3
        : f.status === "closed" &&
          f.workers === 0 &&
          f.stock === 0 &&
          f.reopenDay > 0 &&
          integer(f.reopenDay, 1, today + 30))
    );
  });
}

const economyCopy = {
  "Şu anda hizmet vardiyası yapılamıyor.": ["A service shift is currently unavailable.", "Zmiana usługowa jest niedostępna."],
  "Şu anda müşteri edinimi yapılamıyor.": ["Customer outreach is currently unavailable.", "Pozyskanie klientów jest niedostępne."],
  "Onarım Atölyesi": ["Repair workshop", "Warsztat naprawczy"],
  "Dijital Hizmet": ["Digital services", "Usługi cyfrowe"],
  "Öğrenme Atölyesi": ["Learning studio", "Pracownia edukacyjna"],
  "Konutun ilçesine git.": ["Visit the property's district.", "Jedź do dzielnicy nieruchomości."],
  "Tapu bedeli.": ["Purchase price.", "Cena zakupu."],
  "Bedel peşinattır. Aylık %0,8 faiz, %4 anapara. Üç ödenmeyen taksitte tasfiye riski.": [
    "Cost is the deposit. Monthly: 0.8% interest, 4% principal. Three missed payments risk foreclosure.",
    "Koszt to wkład własny. Miesięcznie: 0,8% odsetek, 4% kapitału. Po 3 zaległościach grozi przejęcie.",
  ],
  "Konut kondisyonu +18.": ["Property condition +18.", "Stan nieruchomości +18."],
  "Önce faiz, sonra anapara.": [
    "Interest first, then principal.",
    "Najpierw odsetki, potem kapitał.",
  ],
  "Kira kapatıldı; geçici konuta geçtin.": [
    "Lease ended. You moved into temporary housing.",
    "Najem zakończony. Przenosisz się do lokalu tymczasowego.",
  ],
  "Konut kondisyonu iyileşti.": [
    "Property condition improved.",
    "Stan nieruchomości się poprawił.",
  ],
  "Kira ve depozito kapatıldı.": ["Rent and deposit settled.", "Rozliczono czynsz i kaucję."],
  "Çalışan stoktan sipariş hazırlayabilir.": [
    "The employee can fill orders from stock.",
    "Pracownik może realizować zamówienia z zapasów.",
  ],
  "Sözleşme ve kıdem ödemesi kapatıldı.": [
    "Employment ended and severance was paid.",
    "Zakończono zatrudnienie i wypłacono odprawę.",
  ],
  "Liste fiyatı güncellendi.": ["List price updated.", "Zaktualizowano cenę katalogową."],
  "Tedarikçi değişti.": ["Supplier changed.", "Zmieniono dostawcę."],
  "Kredi işletme kasasına aktarıldı.": [
    "Loan credited to the business.",
    "Kredyt wpłynął do kasy firmy.",
  ],
  "Anapara azaltıldı.": ["Loan principal reduced.", "Zmniejszono kapitał kredytu."],
  "Ücret ve vergi ödendi.": ["Wages and tax paid.", "Zapłacono płace i podatek."],
  "İşletme yeniden açıldı.": ["Business reopened.", "Wznowiono działalność."],
  "İşletmeye ara verildi.": ["Business paused.", "Wstrzymano działalność."],
  "Ücretli eğitim mesleki beceriyi geliştirdi.": [
    "Paid training improved professional skills.",
    "Płatne szkolenie rozwinęło umiejętności zawodowe.",
  ],
  "kirayı kapat": ["end lease", "zakończ najem"],
  kirala: ["rent", "wynajmij"],
  "satın al": ["buy", "kup"],
  "kredili satın al": ["buy with a mortgage", "kup na kredyt hipoteczny"],
  "kendi evine taşın": ["move into your home", "wprowadź się do własnego domu"],
  "bakım yap": ["repair", "wyremontuj"],
  "krediye ek ödeme": ["make an extra mortgage payment", "nadpłać kredyt"],
  "kiracı al": ["let to a tenant", "wynajmij lokatorowi"],
  "kiracı sözleşmesini bitir": ["end tenant contract", "zakończ umowę lokatora"],
  sat: ["sell", "sprzedaj"],
  Oda: ["Room", "Pokój"],
  Stüdyo: ["Studio", "Kawalerka"],
  Daire: ["Apartment", "Mieszkanie"],
  "Ücretli çalışan işe al": ["Hire an employee", "Zatrudnij pracownika"],
  "Bir iş sözleşmesini bitir": ["End an employment contract", "Zakończ umowę o pracę"],
  "Yerel tedarikçiye dön": ["Switch to the local supplier", "Wróć do lokalnego dostawcy"],
  "Kooperatifle anlaş": ["Sign with the cooperative", "Podpisz umowę ze spółdzielnią"],
  "İşletme kredisi al": ["Take out a business loan", "Weź kredyt firmowy"],
  "Ücret ve vergi birikimini kapat": [
    "Settle wages and taxes due",
    "Ureguluj zaległe płace i podatki",
  ],
  "Konut kirada.": ["Property is leased.", "Nieruchomość jest wynajęta."],
  "Konutun şehrine git.": ["Go to the property's city.", "Udaj się do miasta nieruchomości."],
  "Önce ev paylaşımını sonlandır.": [
    "End the shared lease first.",
    "Najpierw zakończ wspólny najem.",
  ],
  "Borç çok yüksek.": ["Existing debt is too high.", "Zadłużenie jest zbyt wysokie."],
  "Kira yok. Bakım ve varsa kredi ödenir.": [
    "No rent. Pay maintenance and any mortgage.",
    "Bez czynszu. Opłać utrzymanie i ewentualny kredyt.",
  ],
  "Konutun bakıma ihtiyacı yok.": [
    "The home does not need repairs.",
    "Mieszkanie nie wymaga remontu.",
  ],
  "İlk kira ve depozitoyu kiracı öder.": [
    "Tenant pays first rent and deposit.",
    "Najemca płaci pierwszy czynsz i kaucję.",
  ],
  "Uygun ve ödeme gücü olan kiracı yok.": [
    "No eligible tenant can pay.",
    "Brak wypłacalnego najemcy.",
  ],
  "Depozito kira borcuna gider, kalanı iade edilir.": [
    "Deposit covers rent arrears. The rest is refunded.",
    "Kaucja spłaca zaległy czynsz. Reszta wraca.",
  ],
  "Satmadan önce krediyi azalt.": [
    "Pay down the loan before selling.",
    "Spłać część kredytu przed sprzedażą.",
  ],
  "Satış banka limitini aşar.": [
    "Sale exceeds your account limit.",
    "Sprzedaż przekracza limit konta.",
  ],
  "İşletmenin şehrine git.": ["Go to your business's city.", "Udaj się do miasta firmy."],
  "İşletme açık olmalı.": ["The business must be open.", "Firma musi być otwarta."],
  "Uygun aday yok veya ekip dolu.": [
    "No eligible applicants or the team is full.",
    "Brak kandydatów lub zespół jest pełny.",
  ],
  "Kasada beş günlük ücret gerekir.": [
    "Keep five days' wages in the business account.",
    "Zapewnij pięciodniowy zapas płac w kasie firmy.",
  ],
  "Kıdem ödemesi için kasa yetersiz.": [
    "Insufficient business funds for severance.",
    "Za mało środków firmy na odprawę.",
  ],
  "Fiyat talebi ve kârı etkiler.": [
    "Price affects demand and profit.",
    "Cena wpływa na popyt i zysk.",
  ],
  "Bu tarife yürürlükte.": ["This price is already in effect.", "Ta cena już obowiązuje."],
  "Küçük siparişlere açık tedarik.": [
    "Accepts small stock orders.",
    "Dostawca przyjmuje małe zamówienia.",
  ],
  "En az altı birimde daha düşük maliyet.": [
    "Lower cost on orders of at least six units.",
    "Niższy koszt przy zamówieniu co najmniej sześciu sztuk.",
  ],
  "Bu tedarikçi zaten etkin.": [
    "This supplier is already active.",
    "Ten dostawca jest już aktywny.",
  ],
  "Kasaya 3.000 TL. 30 günde bir anapara ve %1 faiz.": [
    "3,000 TL into business funds. Principal and 1% interest every 30 days.",
    "3 000 TL do kasy. Kapitał i 1% odsetek co 30 dni.",
  ],
  "Kredi için itibar, borç ve bakiye uygun olmalı.": [
    "Loan depends on reputation, debts and balance.",
    "Kredyt zależy od reputacji, długów i salda.",
  ],
  "Anapara işletme kasasından.": ["Business funds pay the principal.", "Kapitał z kasy firmy."],
  "İşletme kasası yetersiz.": ["Insufficient business funds.", "Za mało środków firmy."],
  "Önce işletmeye sermaye aktar.": ["Add business capital first.", "Najpierw zasil konto firmy."],
  "Önce ücret, vergi ve krediyi öde.": [
    "Settle wages, taxes and loan first.",
    "Najpierw zapłać płace, podatki i kredyt.",
  ],
  "Borç varken kâr çekilemez.": [
    "Settle debts before withdrawing profit.",
    "Spłać długi przed wypłatą zysku.",
  ],
  "Kapatmadan önce kıdemi öde.": [
    "Pay severance before closing.",
    "Wypłać odprawy przed zamknięciem.",
  ],
  "Kooperatif siparişi en az altı birim.": [
    "Cooperative minimum: six units.",
    "Minimum spółdzielni: sześć sztuk.",
  ],
  "Kasada tedarik parası yok.": ["Insufficient funds for supplies.", "Za mało środków na dostawy."],
  "Bu fiyatla kârlı sipariş yok.": [
    "No viable orders at this price.",
    "Przy tej cenie brak opłacalnych zamówień.",
  ],
  "İşletme hesabı üst sınırda.": [
    "The business account is at its limit.",
    "Konto firmy osiągnęło limit.",
  ],
};
const economyTemplates = [
  [/^Evine dön · (.+)$/, "Return home · $1", "Wróć do domu · $1"],
  [
    /^(.+) · Uyku enerjisi \+(\d+); stres −16\.$/,
    "$1 · Sleeping restores $2 energy and reduces stress by 16.",
    "$1 · Sen przywraca $2 energii i obniża stres o 16.",
  ],
  [
    /^(.+) · Bir erzak; tokluk \+(\d+), zanaat \+1\.$/,
    "$1 · Uses one grocery pack. Fullness +$2, crafting +1.",
    "$1 · Zużywa jedną paczkę żywności. Sytość +$2, rzemiosło +1.",
  ],
  [/^(.+) hanenin mülkiyetine geçti\.$/, "The household now owns $1.", "Gospodarstwo nabyło $1."],
  [
    /^Tapu devredildi, kredi kapandı\. Net satış (-?\d+) TL\.$/,
    "Title transferred and loan closed. Net proceeds: $1 TL.",
    "Przeniesiono własność i zamknięto kredyt. Wpływ netto: $1 TL.",
  ],
  [/^(.+) için konut sözleşmesi başladı\.$/, "Lease started for $1.", "Rozpoczął się najem: $1."],
  [/^(.+) artık yaşadığın konut\.$/, "You now live in $1.", "Twoje nowe mieszkanie: $1."],
  [
    /^Ödeme işlendi; kalan kredi (\d+) TL\.$/,
    "Payment recorded. Loan balance: $1 TL.",
    "Zaksięgowano spłatę. Saldo kredytu: $1 TL.",
  ],
  [
    /^(.+) konutu kiraladı; ilk kira bankana geçti, depozito sözleşmeye alındı\.$/,
    "$1 moved in. First rent reached your bank and the deposit is held.",
    "$1 wynajmuje lokal. Pierwszy czynsz wpłynął na konto, a kaucja jest zabezpieczona.",
  ],
  [
    /^(\d+) stok alındı; (\d+) TL işletme kasasından ödendi\.$/,
    "Bought $1 units for $2 TL from business funds.",
    "Kupiono $1 szt. za $2 TL z kasy firmy.",
  ],
  [
    /^(\d+) stok kullanıldı; işletme kasasına net (\d+) TL girdi\.$/,
    "Used $1 units. Business received $2 TL net.",
    "Zużyto $1 szt. Wpływ netto do kasy firmy: $2 TL.",
  ],
  [
    /^(\d+) TL işletme kasasından\. Birikmiş gider\.$/,
    "$1 TL in outstanding costs from business funds.",
    "$1 TL zaległych opłat z kasy firmy.",
  ],
  [
    /^(\d+) TL işletme kasasından\. Karşılanmayan gider borca geçer\.$/,
    "$1 TL from business funds. Unpaid costs become arrears.",
    "$1 TL z kasy firmy. Nieopłacone koszty stają się zaległością.",
  ],
  [/(.+) · İş sözleşmesi sona erdi\.$/, "$1 · Employment ended.", "$1 · Umowa o pracę wygasła."],
  [/(.+) · İşe başladı\.$/, "$1 · Started a job.", "$1 · Rozpoczęto pracę."],
  [
    /(.+) · Hane mirası devredildi\.$/,
    "$1 · Household estate passed to an heir.",
    "$1 · Spadek po gospodarstwie przejął następca.",
  ],
  [
    /^(\d+) TL kullanılabilir bakiye gerekir\.$/,
    "$1 TL available funds are required.",
    "Wymagane dostępne środki: $1 TL.",
  ],
  [
    /^İlk kira ve depozito: (\d+) TL\.$/,
    "First rent and deposit: $1 TL.",
    "Pierwszy czynsz i kaucja: $1 TL.",
  ],
  [
    /^Gider ve ipotek sonrası net (-?\d+) TL\.$/,
    "Net after costs and mortgage: $1 TL.",
    "Netto po kosztach i hipotece: $1 TL.",
  ],
  [
    /^(\d+) TL\. Yalnız açık işyerinde tamamlanan vardiya ödenir\.$/,
    "$1 TL per completed shift while open.",
    "$1 TL za odbytą zmianę w otwartej firmie.",
  ],
  [
    /^Kıdem: (\d+) TL işletme kasasından\.$/,
    "Severance: $1 TL from business funds.",
    "Odprawa: $1 TL z kasy firmy.",
  ],
  [
    /^Liste fiyatını (\d+) TL yap$/,
    "Set the list price to $1 TL",
    "Ustaw cenę katalogową na $1 TL",
  ],
  [
    /^İşletme kredisinden (\d+) TL kapat$/,
    "Pay $1 TL toward the business loan",
    "Spłać $1 TL kredytu firmowego",
  ],
  [
    /^(\d+) TL kasa yükümlülüğü\.$/,
    "$1 TL payable from the business account.",
    "$1 TL do zapłaty z konta firmy.",
  ],
  [
    /^(\d+) hizmetlik stok; (\d+) TL işletme kasasından\.$/,
    "$1 units of stock, $2 TL from the business account.",
    "$1 sztuk zapasów za $2 TL z konta firmy.",
  ],
  [
    /^(\d+) müşteri, liste fiyatı (\d+) TL\. Stoktan\. Gider (\d+) TL, gelir (\d+) TL\.$/,
    "$1 customers at a list price of $2 TL. Uses stock. Cost $3 TL, revenue $4 TL.",
    "$1 klientów przy cenie katalogowej $2 TL. Z zapasów. Koszt $3 TL, przychód $4 TL.",
  ],
];

export function localizeEconomyText(text, language) {
  if (language !== "en" && language !== "pl") return text;
  const index = language === "en" ? 0 : 1;
  const value = economyCopy[text]?.[index];
  if (typeof value === "string") return value;
  for (const [pattern, english, polish] of economyTemplates)
    if (pattern.test(text))
      return String(text).replace(pattern, (_, ...captures) => {
        const replacement = index === 0 ? english : polish;
        return replacement.replace(/\$(\d+)/g, (_, group) => {
          const value = captures[Number(group) - 1];
          return regionHomes.some(({ name }) => name === value)
            ? localizeEconomyText(value, language)
            : value;
        });
      });
  const [city, dwelling, action] = String(text).split(" · ");
  if ((REGIONS.some((region) => CITIES[region].name === city) ||
    DISTRICTS.some(({ name }) => name === city)) && economyCopy[dwelling]) {
    const label =
      (language === "en" ? { İstanbul: "Istanbul", İzmir: "Izmir" }[city] : undefined) ?? city;
    return [label, economyCopy[dwelling][index], action && economyCopy[action]?.[index]]
      .filter(Boolean)
      .join(" · ");
  }
  return text;
}
