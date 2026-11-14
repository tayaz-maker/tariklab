import { HOMES, NPCS } from "./content.mjs";
import { BUSINESS_TYPES } from "./deep-content.mjs";
import { closeHousehold, syncLifeHousing } from "./life-systems.mjs";
import { SOCIETY_COPY } from "./society-content.mjs";
import { REGIONS as CITIES, migratePopulation } from "./expansion-world.mjs";

const DAY = 1440;
const MAX = 1_000_000_000;
const REGIONS = ["istanbul", "ankara", "izmir"];
const HOUSEHOLD = "household";
const MARKET = "market";
const homes = HOMES.slice(1);
const citizens = new Set(NPCS.map(({ id }) => id));
const regionHomes = REGIONS.flatMap((region, regionIndex) =>
  homes.map((home, index) => ({
    id: `${region}:${home.id}`,
    name: `${["İstanbul", "Ankara", "İzmir"][regionIndex]} · ${["Oda", "Stüdyo", "Daire"][index]}`,
    region,
    anchor: home.id,
    district: home.district,
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
const regionalResidents = secondaryRegions.flatMap((region) =>
  BUSINESS_TYPES.map((type, index) => ({
    id: `resident:${region}:${index}`,
    region,
    type,
  })),
);
const regionalIds = new Set(regionalResidents.map(({ id }) => id));
const competitors = REGIONS.flatMap((region, city) =>
  BUSINESS_TYPES.map((type, index) => ({
    id: `${region}:${type.id}`,
    region,
    type,
    name: [
      ["Moda Tamir", "Pera Dijital", "Kuzguncuk Eğitim"],
      ["Çankaya Tamir", "Ostim Dijital", "Bahçeli Eğitim"],
      ["Kemeraltı Tamir", "Alsancak Dijital", "Bostanlı Eğitim"],
    ][city][index],
  })),
);
const residentAge = (life, today) => Math.floor((today - life.born) / 30);
const workday = (d) => (d - 2) % 7 < 5;
const day = (s) => Math.floor(s.time / DAY) + 1;
const regionOf = (s) => s.expansion.world.region;
const economy = (s) => s.expansion.economy;
const funds = (s) => s.bank + s.cash;
const asMoney = (amount) => Math.min(MAX, Math.max(0, Math.round(amount)));
const bound = (amount, min, max) => Math.min(max, Math.max(min, amount));
const exact = (value, keys) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const expected = keys.split(" ");
  return (
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
};
const integer = (n, low = 0, high = MAX) => Number.isSafeInteger(n) && n >= low && n <= high;

function marketIndex(s, region, key, low = 50, high = 200) {
  return bound(s.expansion.world.regions[region]?.[key] ?? 100, low, high);
}
const propertyValue = (s, lot, p) =>
  Math.round((lot.base * marketIndex(s, lot.region, "price") * (65 + p.condition * 0.35)) / 10000);
const propertyRent = (s, lot, p) =>
  Math.round((lot.rent * marketIndex(s, lot.region, "price") * (80 + p.condition * 0.2)) / 10000);
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
const isResident = (id) => citizens.has(id) || regionalIds.has(id);
const validOwner = (id) => id === MARKET || id === HOUSEHOLD || isResident(id);
const residentAccount = (s, id) => (citizens.has(id) ? s.deep.npcs[id] : economy(s).residents[id]);

function residentLife(s, resident, index = regionalResidents.indexOf(resident)) {
  const n = residentAccount(s, resident.id);
  if (n.life) return n.life;
  const employer = `${resident.region}:${resident.type.id}`;
  return {
    region: resident.region,
    employer:
      n.employment === "employed" && economy(s).firms[employer].status === "open" ? employer : "",
    born: economy(s).lastDay - (26 + ((s.seed + index * 3) % 16)) * 30,
    generation: 1,
    health: 82 + index * 2,
    skill: resident.type.required,
  };
}

function residentName(index, generation) {
  if (generation === 1) return residentNames[index];
  const first = ["Umay", "Yağız", "Aslı", "Selim", "Elif", "Arda"];
  const surname = residentNames[index].split(" ")[1];
  return `${first[(index + generation) % first.length]} ${surname}`;
}

function regionalHome(s, id) {
  return regionHomes.find((lot) => {
    const p = playerProperty(s, lot);
    return p.lease?.tenant === id || (p.owner === id && !p.lease);
  });
}

function residentProperty(s, id) {
  return regionHomes.find((lot) => playerProperty(s, lot).owner === id);
}

function staffIds(s, firmId) {
  return regionalResidents
    .filter((resident) => residentLife(s, resident).employer === firmId)
    .map(({ id }) => id);
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

function candidateResidents(s, lot) {
  if (lot.region === "istanbul")
    return NPCS.filter(
      ({ id }) => s.deep.npcs[id].home === lot.district && s.life.household?.memberId !== id,
    );
  return regionalResidents.flatMap((resident, index) => {
    const life = residentLife(s, resident, index);
    return life.region === lot.region
      ? [{ id: resident.id, name: residentName(index, life.generation) }]
      : [];
  });
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

export function initEconomy(s) {
  s.expansion.economy = {
    lastDay: day(s),
    home: "",
    properties: Object.fromEntries(
      regionHomes.map((lot) => [
        lot.id,
        { owner: MARKET, condition: 82 + ((s.seed + lot.index) % 17), mortgage: null, lease: null },
      ]),
    ),
    business: s.deep.business ? businessState(s, s.deep.business.revenue) : null,
    residents: Object.fromEntries(
      regionalResidents.map((resident, i) => [
        resident.id,
        { cash: 7000 + i * 250, savings: 6000 + i * 300, debt: 0, employment: "employed" },
      ]),
    ),
    firms: Object.fromEntries(
      competitors.map((firm, index) => [
        firm.id,
        {
          cash: 4200 + 100 * index,
          stock: 6,
          workers: 1,
          reputation: 45,
          price: firm.type.unitPrice,
          revenue: 0,
          costs: 0,
          status: "open",
          failed: 0,
          reopenDay: 0,
          closed: 0,
        },
      ]),
    ),
  };
  for (const [index, resident] of regionalResidents.entries())
    residentAccount(s, resident.id).life = residentLife(s, resident, index);
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
  for (const lot of regionHomes) {
    const propertyAction = (id, label, detail, ...terms) =>
      add(`${id}:${lot.id}`, `${lot.name} · ${label}`, detail, "wallet", ...terms);
    const p = playerProperty(s, lot);
    if (p.owner !== HOUSEHOLD && lot.region !== local && e.home !== lot.id) continue;
    const value = propertyValue(s, lot, p);
    const monthly = propertyRent(s, lot, p);
    const sameHome = e.home === lot.id;
    const occupied = p.lease ? "Konut kirada." : "";
    const away = lot.region !== local ? "Konutun şehrine git." : "";
    const cohabiting = s.life.household ? "Önce ev paylaşımını sonlandır." : "";
    if (p.owner !== HOUSEHOLD) {
      if (sameHome) {
        propertyAction(
          "leave",
          "kirayı kapat",
          "Depozito önce kira borcuna gider, kalanı iade edilir.",
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
      propertyAction(
        "buy",
        "satın al",
        `Tapu bedeli ${value} TL.`,
        90,
        value,
        away || occupied,
        (next) => takeTitle(next, lot, value, value, api),
      );
      const down = Math.ceil(value * 0.25);
      propertyAction(
        "mortgage",
        "kredili satın al",
        `Peşinat ${down} TL. Aylık %0,8 faiz ve %4 anapara; üç kaçan vade tasfiye riski yaratır.`,
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
      `${repairs} TL ile yapı kondisyonu 18 puan artar.`,
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
        `${payment} TL önce faize sonra anaparaya yazılır.`,
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
        `Kiracı ilk kirayı ve depozitoyu öder.`,
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
        "Depozito önce kira borcuna gider, kalanı iade edilir.",
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
      `İşlem gideri ve ipotekten sonra kalan ${net} TL.`,
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
    return (
      p.lease?.tenant === id ||
      (p.owner === id && !p.lease && lot.district === s.deep.npcs[id]?.home)
    );
  });
  if (!contract) return original;
  // The Gold daily bill includes food and rent. Keep food, with rent paid once by title/lease.
  return Math.max(0, original - Math.round(s.deep.npcs[id].rent / 30));
}

function businessState(s, baselineRevenue = 0) {
  return {
    region: regionOf(s),
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
      e.firms[id].status === "open" &&
      e.firms[id].cash >= wage + wageRate(s, region) * e.firms[id].workers * 4,
  );
}

function suppliers(s, e, type) {
  return e.supplier === "cooperative"
    ? Math.round((type.unitCost * 0.86 * marketIndex(s, e.region, "price")) / 100)
    : Math.round((type.unitCost * marketIndex(s, e.region, "price")) / 100);
}

function priceAdjustment(s, e, type) {
  const competitor = economy(s).firms[`${e.region}:${type.id}`];
  const benchmark = competitor.status === "open" ? competitor.price : type.unitPrice;
  const price = Math.round((type.unitPrice * e.price * marketIndex(s, e.region, "price")) / 10000);
  const demand = Math.round(
    (marketIndex(s, e.region, "employment") * benchmark) / Math.max(1, price),
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
    `Günlük ${wage} TL; ücret yalnız açık işyerinde tamamlanan vardiya için gider.`,
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
      `Kıdem ödemesi ${wage * 3} TL işletme kasasından karşılanır.`,
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
    "Kasaya 3.000 TL. Her 30 günde anapara ve %1 faiz.",
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
      "Anapara işletme kasasından ödenir.",
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
  for (const { id, region, type, name } of competitors) {
    const firm = e.firms[id];
    const demand = marketIndex(s, region, "employment");
    if (firm.status === "closed") {
      if (d < firm.reopenDay || demand < 85) continue;
      // New outside equity funds reopening. No previous cash or transactions replay.
      Object.assign(firm, {
        cash: type.startup,
        stock: 0,
        workers: 1,
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
      s.deep.business?.id === type.id &&
      s.deep.business.status === "active" &&
      s.deep.business.clients > 0;
    const rivalPrice = player ? priceAdjustment(s, e.business, type).price : type.unitPrice;
    const localIndex = marketIndex(s, region, "price");
    const productionCost = Math.round((type.unitCost * localIndex) / 100);
    const staff = staffIds(s, id);
    const shift = region === "istanbul" || workday(d);
    const scheduled = staff
      .map((employee) => e.residents[employee])
      .filter(({ life }) => shift && life.health >= 42 && residentAge(life, d) < 67);
    const untracked = shift ? firm.workers - staff.length : 0;
    const workforce = untracked + scheduled.length;
    const payroll = scheduled.map(({ life }) => residentWage(s, region, type, life.skill));
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
    const localStress = regionalResidents.filter((resident) => {
      const n = e.residents[resident.id];
      return n.life.region === region && n.debt > npcFunds(n);
    }).length;
    const customers = shift
      ? bound(
          Math.floor(demand / 31) +
            (firm.reputation >= 60 ? 1 : 0) -
            (player && rivalPrice <= firm.price ? 1 : 0) -
            Math.ceil(localStress / 2) -
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
    for (const [index, n] of scheduled.entries()) {
      const wage = Math.min(remaining, payroll[index]);
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
      else if (firm.workers > 1 && (demand < 85 || firm.cash < overhead * 5)) firm.workers--;
      firm.reputation = bound(firm.reputation + (firm.stock < 6 ? 1 : -2), 0, 100);
    }
    for (const employee of staff.slice(firm.workers)) {
      const n = e.residents[employee];
      n.life.employer = "";
      n.employment = "searching";
      event(s, api, "resident.job-loss", employee, `${name} · İş sözleşmesi sona erdi.`);
    }
  }
}

export function adaptEconomyActions(s, actions, api) {
  const e = s.expansion?.economy?.business;
  if (!e || !s.deep.business) return actions;
  const type = BUSINESS_TYPES.find((x) => x.id === s.deep.business.id);
  const b = s.deep.business;
  const blocked = (action, reason) => ({ ...action, disabled: true, reason });
  return actions.map((action) => {
    if (!action.id.startsWith("business:")) return action;
    const id = action.id;
    if (/^business:(acquire|serve|stock:|upgrade)/.test(id) && regionOf(s) !== e.region)
      return blocked(action, "İşletmenin şehrine git.");
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
      const local = e.region === "istanbul";
      const amount =
        local && action.societyCost
          ? Math.round(action.societyCost.amount * (e.supplier === "cooperative" ? 0.86 : 1))
          : units * suppliers(s, e, type);
      const reprice = [
        "Malzeme için işletme sermayesi aktar.",
        "Güncel malzeme fiyatı için işletme kasası yetersiz.",
      ];
      if (!local) reprice.push(SOCIETY_COPY.noStock);
      if (action.disabled && !reprice.includes(action.reason)) return action;
      if (local && s.society.districts[s.location].materialStock < units)
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
        e.region === "istanbul"
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
        description: `${served} müşteri, ${price} TL liste fiyatı. Stok kullanılır; ${operating} TL gider ve ${revenue} TL gelir.`,
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

function residentOffer(s, region, life) {
  let offer;
  let highestWage = 0;
  for (const firm of competitors) {
    if (firm.region !== region || life.skill < firm.type.required) continue;
    const account = economy(s).firms[firm.id];
    const wage = residentWage(s, region, firm.type, life.skill);
    if (
      account.status === "open" &&
      account.cash >= wage * 3 &&
      wage > highestWage &&
      staffIds(s, firm.id).length < account.workers
    ) {
      offer = firm;
      highestWage = wage;
    }
  }
  return offer;
}

function regionalDecision(s, api, resident, n, home) {
  const { life } = n;
  const { region } = life;
  const current = life.employer
    ? competitors.find(({ id }) => id === life.employer)
    : residentOffer(s, region, life);
  const target = secondaryRegions.find((id) => id !== region);
  const alternative = residentOffer(s, target, life);
  const title = residentProperty(s, resident.id);
  const occupied = home && playerProperty(s, home);
  const lease = occupied?.lease;
  const living = residentExpense(s, region, Boolean(home));
  const rent = lease ? Math.ceil(lease.rent / 30) : 0;
  const localWage = current ? residentWage(s, region, current.type, life.skill) : 0;
  const localMargin = (localWage * 5) / 7 - living - rent;
  const nextWage = alternative ? residentWage(s, target, alternative.type, life.skill) : 0;
  const nextMargin = (nextWage * 5) / 7 - residentExpense(s, target, false);
  const shouldMove =
    alternative &&
    nextMargin > Math.max(0, localMargin) + 32 &&
    (!life.employer || localMargin < 35) &&
    npcFunds(n) >= 620 &&
    s.expansion.world.regions[region].population > 1 &&
    !lease?.arrears &&
    !(title && playerProperty(s, title).lease);
  if (shouldMove) {
    spendNpc(n, 620);
    if (lease) releaseResidentLease(s, occupied, api);
    if (title) {
      const property = playerProperty(s, title);
      payOwner(s, resident.id, saleValue(s, title, property), api, "Konut satışı");
      property.owner = MARKET;
    }
    life.region = target;
    migratePopulation(s, region, target, 1);
    event(
      s,
      api,
      "resident.migration",
      resident.id,
      `${CITIES[region].name} → ${CITIES[target].name}`,
    );
  }
  const offer = shouldMove ? alternative : current;
  if (!offer || offer.id === life.employer) return;
  n.employment = "employed";
  life.employer = offer.id;
  event(s, api, "resident.hired", resident.id, `${offer.name} · İşe başladı.`);
}

function residentService(s, api, n, service) {
  const region = n.life.region;
  const budget = s.expansion.institutions?.regions[region];
  if (!budget) return 0;
  const fee = budget.policy === service && budget.policyUntil >= day(s) ? 90 : 180;
  const paid = api.creditMunicipalTax?.(s, region, fee) ?? 0;
  spendNpc(n, paid);
  return paid;
}

function settleRegionalResidents(s, api) {
  const d = day(s);
  const e = economy(s);
  for (const [index, resident] of regionalResidents.entries()) {
    const { id } = resident;
    const n = e.residents[id];
    const { life } = n;
    let age = residentAge(life, d);
    const home = regionalHome(s, id);
    const livingCost = residentExpense(s, life.region, Boolean(home));
    const paid = Math.min(npcFunds(n), livingCost);
    spendNpc(n, paid);
    n.debt = asMoney(n.debt + livingCost - paid);
    const lifespan = 74 + ((s.seed + index * 3) % 15);
    if (age >= lifespan) {
      // A new adult inherits the named household's account, obligations and home.
      event(
        s,
        api,
        "resident.inheritance",
        id,
        `${residentName(index, life.generation)} · Hane mirası devredildi.`,
      );
      Object.assign(life, {
        born: d - 24 * 30,
        generation: life.generation + 1,
        health: 91,
        skill: 30,
      });
      age = 24;
    }
    if (age >= 67 || !life.employer) {
      life.employer = "";
      n.employment = "searching";
    }
    if (age >= 67 && (d - 1) % 30 === 0) n.cash = asMoney(n.cash + 900);
    const aging = age > 58 ? 2 : 0;
    life.health = bound(life.health + (paid < livingCost ? -4 : 3 - aging), 0, 100);
    const decisionDay = (d + index) % 7 === 0;
    if (
      life.health < 55 &&
      decisionDay &&
      npcFunds(n) >= 460 &&
      residentService(s, api, n, "health")
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
    if (age >= 67 || !decisionDay) continue;
    if (
      n.cash >= 680 &&
      life.health >= 55 &&
      life.skill < 72 &&
      !life.employer &&
      residentService(s, api, n, "skills")
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
  // Older slots derive missing profiles before updating the settlement date.
  for (const [index, resident] of regionalResidents.entries()) {
    const n = e.residents[resident.id];
    if (!n.life) {
      n.life = residentLife(s, resident, index);
      if (!n.life.employer) n.employment = "searching";
    }
  }
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
    properties: regionHomes.map((lot) => {
      const p = playerProperty(s, lot);
      return {
        id: lot.id,
        name: lot.name,
        region: lot.region,
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
      const local = competitors.filter((firm) => firm.region === region);
      const active = local.filter(({ id }) => firms[id].status === "open");
      const owned = business?.region === region && s.deep.business?.status === "active";
      const workers = active.reduce((sum, { id }) => sum + firms[id].workers, 0);
      const jobseekers = regionalResidents.filter((resident) => {
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
            },
          ];
        });
        summary.firms = local.map(({ id, name, type }) => ({
          id,
          name,
          region,
          type: type.id,
          ...firms[id],
          employeeIds: staffIds(s, id),
        }));
      }
      return [region, summary];
    }),
  );
}

export function validateEconomy(s) {
  const e = s.expansion?.economy;
  const today = day(s);
  if (
    !exact(e, "lastDay home properties business residents firms") ||
    e.lastDay !== today ||
    !exact(e.properties, regionHomes.map(({ id }) => id).join(" ")) ||
    !exact(e.firms, competitors.map(({ id }) => id).join(" ")) ||
    !exact(e.residents, regionalResidents.map(({ id }) => id).join(" ")) ||
    !(e.home === "" || regionHomes.some(({ id }) => id === e.home))
  )
    return false;
  const profiles = regionalResidents.filter(({ id }) =>
    Object.hasOwn(e.residents[id] ?? {}, "life"),
  );
  if (profiles.length && profiles.length !== regionalResidents.length) return false;
  const staffing = new Map();
  const residentRegions = new Map();
  for (const resident of regionalResidents) {
    const n = e.residents[resident.id];
    const schema = "cash savings debt employment" + (profiles.length ? " life" : "");
    if (
      !exact(n, schema) ||
      !["cash", "savings", "debt"].every((k) => integer(n[k])) ||
      !["employed", "searching"].includes(n.employment)
    )
      return false;
    const life = n.life;
    if (profiles.length) {
      if (
        !exact(life, "region employer born generation health skill") ||
        !secondaryRegions.includes(life.region) ||
        !integer(life.born, today - 2700, today - 540) ||
        !integer(life.generation, 1, 400000) ||
        !integer(life.health, 0, 100) ||
        !integer(life.skill, 0, 100) ||
        (life.employer === "") !== (n.employment === "searching")
      )
        return false;
      if (life.employer) {
        const job = competitors.find(({ id }) => id === life.employer);
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
  }
  const tenants = new Set();
  const owners = new Set();
  for (const lot of regionHomes) {
    const p = e.properties[lot.id];
    if (
      !exact(p, "owner condition mortgage lease") ||
      !validOwner(p.owner) ||
      !integer(p.condition, 35, 100)
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
      const m = p.mortgage;
      if (
        !exact(m, "principal interest dueDay missed") ||
        p.owner !== HOUSEHOLD ||
        !integer(m.principal, 1) ||
        !integer(m.interest) ||
        !integer(m.dueDay, today + 1, today + 30) ||
        !integer(m.missed, 0, 2)
      )
        return false;
    } else if (p.mortgage !== null) return false;
    if (p.lease) {
      const l = p.lease;
      if (
        !exact(l, "tenant rent deposit dueDay arrears missed") ||
        l.tenant === p.owner ||
        !(l.tenant === HOUSEHOLD || isResident(l.tenant)) ||
        tenants.has(l.tenant) ||
        (l.tenant === HOUSEHOLD && e.home !== lot.id) ||
        (l.tenant !== HOUSEHOLD &&
          (p.owner === MARKET ||
            (citizens.has(l.tenant)
              ? lot.region !== "istanbul"
              : residentRegions.get(l.tenant) !== lot.region))) ||
        !integer(l.rent, 1, 30000) ||
        !integer(l.deposit, 0, 30000) ||
        !integer(l.dueDay, today + 1, today + 30) ||
        !integer(l.arrears) ||
        !integer(l.missed, 0, 2)
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
      !exact(
        b,
        "region price supplier workers wageDue principal installmentDay missed lastTaxRevenue taxDue taxes payrollMissed",
      ) ||
      !REGIONS.includes(b.region) ||
      ![85, 100, 120].includes(b.price) ||
      !["local", "cooperative"].includes(b.supplier) ||
      !integer(b.workers, 0, 3) ||
      !integer(b.wageDue) ||
      !integer(b.principal) ||
      !integer(b.missed, 0, 3) ||
      !integer(b.lastTaxRevenue, 0, s.deep.business.revenue) ||
      !integer(b.taxDue) ||
      !integer(b.taxes) ||
      !integer(b.payrollMissed, 0, 400000) ||
      !(b.principal ? integer(b.installmentDay, today + 1, today + 30) : b.installmentDay === 0)
    )
      return false;
  } else if (b !== null || s.deep.business) return false;
  return competitors.every(({ id }) => {
    const f = e.firms[id];
    return (
      exact(
        f,
        "cash stock workers reputation price revenue costs status failed reopenDay closed",
      ) &&
      ["cash", "revenue", "costs"].every((key) => integer(f[key])) &&
      integer(f.stock, 0, 12) &&
      integer(f.workers, staffing.get(id) ?? 0, 3) &&
      integer(f.reputation, 0, 100) &&
      integer(f.price, 1, 2000) &&
      integer(f.failed, 0, 3) &&
      integer(f.closed, 0, 400000) &&
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
  "Kiracı ilk kirayı ve depozitoyu öder.": [
    "Tenant pays first rent and deposit.",
    "Najemca płaci pierwszy czynsz i kaucję.",
  ],
  "Uygun ve ödeme gücü olan kiracı yok.": [
    "No eligible tenant can pay.",
    "Brak wypłacalnego najemcy.",
  ],
  "Depozito önce kira borcuna gider, kalanı iade edilir.": [
    "The deposit covers rent arrears first. Any remainder is refunded.",
    "Kaucja pokrywa zaległy czynsz. Reszta podlega zwrotowi.",
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
  "Kasaya 3.000 TL. Her 30 günde anapara ve %1 faiz.": [
    "Adds 3,000 TL. Principal and 1% interest every 30 days.",
    "3 000 TL do kasy. Kapitał i 1% odsetek co 30 dni.",
  ],
  "Kredi için itibar, borç ve bakiye uygun olmalı.": [
    "Loan depends on reputation, debts and balance.",
    "Kredyt zależy od reputacji, długów i salda.",
  ],
  "Anapara işletme kasasından ödenir.": [
    "Business funds pay the principal.",
    "Kapitał jest spłacany z kasy firmy.",
  ],
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
  [/^Tapu bedeli (\d+) TL\.$/, "Purchase price: $1 TL.", "Cena zakupu: $1 TL."],
  [
    /^Peşinat (\d+) TL\. Aylık %0,8 faiz ve %4 anapara; üç kaçan vade tasfiye riski yaratır\.$/,
    "Deposit: $1 TL. Monthly 0.8% interest and 4% principal. Three missed payments risk foreclosure.",
    "Wkład własny: $1 TL. Co miesiąc 0,8% odsetek i 4% kapitału. Trzy zaległości grożą przejęciem.",
  ],
  [
    /^(\d+) TL ile yapı kondisyonu 18 puan artar\.$/,
    "Spend $1 TL to raise the condition by 18 points.",
    "Wydaj $1 TL, aby poprawić stan o 18 punktów.",
  ],
  [
    /^(\d+) TL önce faize sonra anaparaya yazılır\.$/,
    "$1 TL goes toward interest first, then principal.",
    "$1 TL pokryje najpierw odsetki, a potem kapitał.",
  ],
  [
    /^İşlem gideri ve ipotekten sonra kalan (-?\d+) TL\.$/,
    "Net proceeds after costs and mortgage: $1 TL.",
    "Kwota po kosztach i spłacie hipoteki: $1 TL.",
  ],
  [
    /^Günlük (\d+) TL; ücret yalnız açık işyerinde tamamlanan vardiya için gider\.$/,
    "$1 TL per day. Wages accrue for completed shifts while open.",
    "$1 TL dziennie. Płaca nalicza się za odbyte zmiany w otwartej firmie.",
  ],
  [
    /^Kıdem ödemesi (\d+) TL işletme kasasından karşılanır\.$/,
    "$1 TL severance is paid from the business account.",
    "Odprawa w wysokości $1 TL jest wypłacana z konta firmy.",
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
    /^(\d+) müşteri, (\d+) TL liste fiyatı\. Stok kullanılır; (\d+) TL gider ve (\d+) TL gelir\.$/,
    "$1 customers at a list price of $2 TL. Stock is used, with $3 TL in costs and $4 TL in revenue.",
    "$1 klientów przy cenie $2 TL. Zużycie zapasów, koszt $3 TL i przychód $4 TL.",
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
  if (["İstanbul", "Ankara", "İzmir"].includes(city) && economyCopy[dwelling]) {
    const label =
      (language === "en" ? { İstanbul: "Istanbul", İzmir: "Izmir" }[city] : undefined) ?? city;
    return [label, economyCopy[dwelling][index], action && economyCopy[action]?.[index]]
      .filter(Boolean)
      .join(" · ");
  }
  return text;
}
