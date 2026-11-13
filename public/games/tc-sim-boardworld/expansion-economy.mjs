import { HOMES, NPCS } from "./content.mjs";
import { BUSINESS_TYPES } from "./deep-content.mjs";
import { closeHousehold, syncLifeHousing } from "./life-systems.mjs";
import { SOCIETY_COPY } from "./society-content.mjs";

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
const regionalResidents = ["ankara", "izmir"].flatMap((region) =>
  homes.map((home, index) => ({
    id: `resident:${region}:${index}`,
    region,
    home: home.id,
    name: ["Aydın hanesi", "Yalçın hanesi", "Koç hanesi"][index],
  })),
);
const regionalIds = new Set(regionalResidents.map(({ id }) => id));
const competitors = REGIONS.flatMap((region) =>
  BUSINESS_TYPES.map((type) => ({ id: `${region}:${type.id}`, region, type })),
);
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
const canCredit = (s, amount) => s.bank + amount <= MAX;
const npcFunds = (n) => n.cash + n.savings;
const businessRecord = (s, value, label, api) => api.record(s, label, value, "business");
const event = (s, api, type, id, detail) => api.expansionEvent?.(s, type, id, detail);
const playerProperty = (s, lot) => economy(s).properties[lot.id];
const isResident = (id) => citizens.has(id) || regionalIds.has(id);
const validOwner = (id) => id === MARKET || id === HOUSEHOLD || isResident(id);
const residentAccount = (s, id) => (citizens.has(id) ? s.deep.npcs[id] : economy(s).residents[id]);

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
  if (p.lease) {
    const tenant = residentAccount(s, p.lease.tenant);
    tenant.debt = asMoney(tenant.debt + releaseLease(s, p, api));
  }
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
  return `Tapu devredildi. Kredi kapandı; satışın net sonucu ${residual} TL.`;
}

function candidateResidents(s, lot) {
  if (lot.region === "istanbul")
    return NPCS.filter(
      ({ id }) => s.deep.npcs[id].home === lot.district && s.life.household?.memberId !== id,
    );
  return regionalResidents.filter((resident) => resident.region === lot.region);
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
    const p = playerProperty(s, lot);
    if (p.owner !== HOUSEHOLD && lot.region !== local && e.home !== lot.id) continue;
    const value = propertyValue(s, lot, p);
    const monthly = propertyRent(s, lot, p);
    const sameHome = e.home === lot.id;
    const occupied = p.lease ? "Bu konutun geçerli kira sözleşmesi var." : "";
    const away = lot.region !== local ? "İşlem için konutun bulunduğu şehre git." : "";
    const cohabiting = s.life.household ? "Önce ortak yaşam sözleşmesini açıkça kapat." : "";
    if (p.owner !== HOUSEHOLD) {
      if (sameHome) {
        add(
          `leave:${lot.id}`,
          lot.name + " · kirayı kapat",
          "Depozito önce kira borcuna sayılır.",
          "wallet",
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
      add(
        `rent:${lot.id}`,
        lot.name + " · kirala",
        `İlk kira ve depozito: ${2 * monthly} TL.`,
        "wallet",
        60,
        2 * monthly,
        away || occupied || cohabiting,
        (next) => {
          occupy(next, lot, api);
          const item = playerProperty(next, lot);
          item.lease = {
            tenant: HOUSEHOLD,
            rent: monthly,
            deposit: monthly,
            dueDay: day(next) + 30,
            arrears: 0,
            missed: 0,
          };
          payOwner(next, item.owner, monthly, api, "İlk ay konut kirası");
          event(next, api, "property.lease", lot.id, `Aylık ${monthly} TL.`);
          return `${lot.name} için konut sözleşmesi başladı.`;
        },
      );
      add(
        `buy:${lot.id}`,
        lot.name + " · satın al",
        `Tapu bedeli ${value} TL.`,
        "wallet",
        90,
        value,
        away || occupied,
        (next) => takeTitle(next, lot, value, value, api),
      );
      const down = Math.ceil(value * 0.25);
      add(
        `mortgage:${lot.id}`,
        lot.name + " · kredili satın al",
        `Peşinat ${down} TL. Aylık %0,8 faiz ve %4 anapara; üç kaçan vade tasfiye riski yaratır.`,
        "wallet",
        90,
        down,
        away || occupied || (s.debt > value / 3 ? "Mevcut borç gelir riskini aşıyor." : ""),
        (next) => takeTitle(next, lot, value, down, api),
      );
      continue;
    }
    if (!sameHome)
      add(
        `occupy:${lot.id}`,
        lot.name + " · kendi evine taşın",
        "Kira alınmaz. Bakım ve varsa konut kredisi sürer.",
        "wallet",
        60,
        300,
        away || occupied || cohabiting,
        (next) => {
          occupy(next, lot, api);
          event(next, api, "property.move", lot.id, "Hane sahibi olduğu konuta taşındı.");
          return `${lot.name} artık yaşadığın konut.`;
        },
      );
    const repairs = 80 + 15 * (100 - p.condition);
    add(
      `maintain:${lot.id}`,
      lot.name + " · bakım yap",
      `${repairs} TL ile yapı kondisyonu 18 puan artar.`,
      "wallet",
      120,
      repairs,
      away || (p.condition >= 95 ? "Konutun bakıma ihtiyacı yok." : ""),
      (next) => {
        const item = playerProperty(next, lot);
        item.condition = Math.min(100, item.condition + 18);
        return "Konut bakımı piyasa değerini ve kira kalitesini korudu.";
      },
    );
    if (p.mortgage) {
      const payment = Math.min(5000, debtor(p));
      add(
        `repay:${lot.id}`,
        lot.name + " · krediye ek ödeme",
        `${payment} TL önce faize sonra anaparaya yazılır.`,
        "wallet",
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
      add(
        `let:${lot.id}`,
        lot.name + " · kiracı al",
        `Uygun mahalle sakini ilk kira ve depozitoyu kendi bütçesinden karşılar.`,
        "wallet",
        45,
        0,
        away ||
          (!tenant || npcFunds(n) < 2 * monthly || !canCredit(s, monthly)
            ? "Ödeme yapabilen uygun kiracı yok."
            : ""),
        (next) => {
          spendNpc(residentAccount(next, tenant.id), 2 * monthly);
          playerProperty(next, lot).lease = {
            tenant: tenant.id,
            rent: monthly,
            deposit: monthly,
            dueDay: day(next) + 30,
            arrears: 0,
            missed: 0,
          };
          payOwner(next, HOUSEHOLD, monthly, api, "Kiracı · ilk ay");
          event(next, api, "property.lease", lot.id, `${tenant.name} · ${monthly} TL/ay.`);
          return `${tenant.name} konutu kiraladı; ilk kira bankana geçti, depozito sözleşmeye alındı.`;
        },
      );
    } else if (p.lease) {
      add(
        `end:${lot.id}`,
        lot.name + " · kiracı sözleşmesini bitir",
        "Depozito önce birikmiş kiradan düşer; kalanı iade edilir.",
        "wallet",
        30,
        0,
        away,
        (next) => {
          const item = playerProperty(next, lot);
          const tenant = residentAccount(next, item.lease.tenant);
          tenant.debt = asMoney(tenant.debt + releaseLease(next, item, api));
          event(next, api, "property.lease-ended", lot.id, "Kiracı konutu teslim etti.");
          return "Kira ve depozito kapatıldı.";
        },
      );
    }
    const net = saleValue(s, lot, p) - debtor(p);
    add(
      `sell:${lot.id}`,
      lot.name + " · sat",
      `İşlem gideri ve ipotekten sonra kalan ${net} TL.`,
      "wallet",
      90,
      0,
      away ||
        occupied ||
        (net < 0
          ? "Satış bedeli krediyi karşılamıyor. Önce ek ödeme yap."
          : !canCredit(s, net)
            ? "Banka bakiyesi sınırı bu satışı karşılamıyor."
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
        else {
          const outstanding = releaseLease(s, p, api);
          n.debt = asMoney(n.debt + outstanding);
        }
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
      const due = Math.min(debtor(p), m.interest + Math.max(300, Math.ceil(m.principal * 0.04)));
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
  const e = economy(s).business;
  const b = s.deep.business;
  if (!e || !b) return;
  const firm = s.living.enterprise;
  const type = BUSINESS_TYPES.find((x) => x.id === b.id);
  const wage = wageRate(s, e.region);
  const costOfHire = wage * 5;
  const away = e.region !== regionOf(s) ? "İşletmenin bulunduğu şehre git." : "";
  const labor = marketIndex(s, e.region, "employment");
  add(
    "hire",
    "Ücretli çalışan işe al",
    `Günlük ${wage} TL; ücret yalnız açık işyerinde tamamlanan vardiya için gider.`,
    "enterprise",
    30,
    0,
    away ||
      (b.status !== "active"
        ? "İşletme açık olmalı."
        : e.workers >= 3 || e.workers >= (labor > 110 ? 2 : 3)
          ? "Uygun aday yok veya ekip dolu."
          : firm.capital < costOfHire
            ? "En az beş günlük ücret işletme kasasında hazır olmalı."
            : ""),
    (next) => {
      economy(next).business.workers++;
      event(next, api, "business.hire", b.id, "Yerel emek piyasasında yeni sözleşme başladı.");
      return "Çalışan alındı; iş günlerinde stoktan sipariş hazırlayabilir.";
    },
  );
  if (e.workers)
    add(
      "dismiss",
      "Bir iş sözleşmesini bitir",
      `Kıdem ödemesi ${wage * 3} TL işletme kasasından karşılanır.`,
      "enterprise",
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
    add(
      `price:${percent}`,
      `Liste fiyatını ${price} TL yap`,
      "Rekabete göre talep ve kâr marjı değişir.",
      "enterprise",
      5,
      0,
      e.price === percent ? "Bu tarife yürürlükte." : "",
      (next) => {
        economy(next).business.price = percent;
        return "Yeni fiyat tamamlanacak hizmetlerde geçerli.";
      },
    );
  }
  for (const supplier of ["local", "cooperative"])
    add(
      `supplier:${supplier}`,
      supplier === "local" ? "Yerel tedarikçiye dön" : "Kooperatifle anlaş",
      supplier === "local"
        ? "Küçük siparişlere açık tedarik."
        : "En az altı birimde daha düşük maliyet.",
      "enterprise",
      20,
      0,
      away || (e.supplier === supplier ? "Bu tedarikçi zaten etkin." : ""),
      (next) => {
        economy(next).business.supplier = supplier;
        return "Yeni tedarik koşulları sonraki stok alımında geçerli.";
      },
    );
  add(
    "business-credit",
    "İşletme kredisi al",
    "Kasaya 3.000 TL; otuz günde bir anapara ve %1 faiz.",
    "enterprise",
    30,
    0,
    away ||
      (e.principal ||
      e.taxDue ||
      e.wageDue ||
      b.arrears ||
      b.reputation < 30 ||
      firm.capital > MAX - 3000
        ? "İtibar, mevcut borç ve işletme bakiyesi krediye uygun olmalı."
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
    add(
      "business-repay",
      `İşletme kredisinden ${payment} TL kapat`,
      "Ödeme işletme kasasından anaparaya gider.",
      "enterprise",
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
    add(
      "business-settle",
      "Ücret ve vergi birikimini kapat",
      `${obligations} TL kasa yükümlülüğü.`,
      "enterprise",
      15,
      0,
      firm.capital < obligations ? "Önce işletmeye sermaye aktar." : "",
      (next) => {
        settleBusinessArrears(next, api);
        return "Ödenen ücret ve vergi kasa defterine işlendi.";
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

function settleCompetitors(s, api) {
  const d = day(s);
  const e = economy(s);
  for (const { id, region, type } of competitors) {
    const firm = e.firms[id];
    const demand = marketIndex(s, region, "employment");
    if (firm.status === "closed") {
      if (d < firm.reopenDay || demand < 85) continue;
      // A different operator brings outside equity. The failed operator's balance is never recycled.
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
    const wages = firm.workers * wageRate(s, region);
    const overhead = wages + 65;
    const targetPrice = Math.round((type.unitPrice * localIndex) / 100);
    firm.price = Math.max(
      productionCost + 60,
      Math.round((targetPrice * 3 + firm.price + (player ? rivalPrice : targetPrice)) / 5),
    );
    const production = Math.max(
      0,
      Math.min(
        12 - firm.stock,
        firm.workers * 2,
        Math.floor((firm.cash - overhead) / productionCost),
      ),
    );
    firm.stock += production;
    firm.cash -= production * productionCost;
    firm.costs = asMoney(firm.costs + production * productionCost);
    // Households beyond the modeled agents buy from a finite regional demand pool.
    const customers = bound(
      Math.floor(demand / 31) +
        (firm.reputation >= 60 ? 1 : 0) -
        (player && rivalPrice <= firm.price ? 1 : 0) +
        ((d + type.unitCost) % 7 === 0 ? -2 : 0),
      0,
      6,
    );
    const sold = Math.min(firm.stock, customers);
    const gross = Math.min(MAX - firm.cash, sold * firm.price);
    const taxes = Math.floor(gross * 0.04);
    firm.stock -= sold;
    firm.revenue = asMoney(firm.revenue + gross);
    firm.cash += gross - taxes;
    firm.costs = asMoney(firm.costs + taxes);
    if (taxes) api.creditMunicipalTax?.(s, region, taxes);
    const paid = Math.min(overhead, firm.cash);
    firm.cash -= paid;
    firm.costs = asMoney(firm.costs + paid);
    if (paid < overhead) firm.failed++;
    else firm.failed = 0;
    if (firm.failed >= 3) {
      firm.status = "closed";
      firm.closed++;
      firm.workers = 0;
      firm.stock = 0;
      firm.reopenDay = d + 30;
      event(s, api, "business.npc-closure", id, "Giderlerini karşılayamayan işletme kapandı.");
    } else if (d % 7 === 1) {
      if (sold && demand > 104 && firm.cash > type.startup * 2 && firm.workers < 3) firm.workers++;
      else if (firm.workers > 1 && (demand < 85 || firm.cash < overhead * 5)) firm.workers--;
      firm.reputation = bound(firm.reputation + (sold ? 1 : -2), 0, 100);
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
      return blocked(action, "İşletmenin bulunduğu şehre git.");
    if (
      id === "business:pause" &&
      b.status === "paused" &&
      (e.wageDue || e.taxDue || e.missed >= 3)
    )
      return blocked(action, "Önce çalışan, vergi ve kredi yükümlülüklerini çöz.");
    if (id.startsWith("business:withdraw:") && (e.wageDue || e.taxDue || e.missed))
      return blocked(action, "Ödenmemiş yükümlülük varken kâr çekilemez.");
    if (
      id === "business:close" &&
      e.workers &&
      s.living.enterprise.capital < e.workers * wageRate(s, e.region) * 3
    )
      return blocked(action, "Kapatmadan önce personelin kıdem ödemesini karşıla.");
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
        return blocked(action, "Semt stoğu yetersiz; tedarik için bekle.");
      if (e.supplier === "cooperative" && units < 6)
        return blocked(action, "Kooperatif en az altı birimlik sipariş alır.");
      if (s.living.enterprise.capital < amount)
        return blocked(action, "Tedarik için işletme kasası yetersiz.");
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
      const score = s.living.markets[b.location].demand;
      const served = Math.min(
        s.living.enterprise.stock,
        b.clients,
        b.level + 2,
        Math.max(0, Math.floor(((b.level + 2) * score * demand) / 10000)),
      );
      const operating = served * 30;
      const revenue = Math.round(served * price * (s.player.energy < 35 ? 0.65 : 1));
      if (!served || s.living.enterprise.capital < operating)
        return blocked(action, "Bu tarife ve rekabet koşulunda ödenebilir müşteri siparişi yok.");
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

function settleRegionalResidents(s) {
  const d = day(s);
  const e = economy(s);
  for (const [index, resident] of regionalResidents.entries()) {
    const n = e.residents[resident.id];
    const market = marketIndex(s, resident.region, "employment");
    const hasHousing = Object.values(e.properties).some(
      (p) => p.owner === resident.id || p.lease?.tenant === resident.id,
    );
    const livingCost = Math.round(
      ((hasHousing ? 90 : 185) * marketIndex(s, resident.region, "price")) / 100,
    );
    if ((d + index) % 7 === 0)
      n.employment = market + (index % 3) * 8 >= 76 ? "employed" : "searching";
    if (n.employment === "employed" && (d - 2) % 7 < 5)
      n.cash = asMoney(n.cash + Math.round(((390 + (index % 3) * 75) * market) / 100));
    const paid = Math.min(npcFunds(n), livingCost);
    spendNpc(n, paid);
    n.debt = asMoney(n.debt + livingCost - paid);
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
  }
}

export function tickEconomy(s, api) {
  const e = s.expansion?.economy;
  if (!e || e.lastDay >= day(s)) return;
  e.lastDay = day(s);
  settleRegionalResidents(s);
  settleProperties(s, api);
  settleBusiness(s, api);
  settleCompetitors(s, api);
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
      };
    }),
    business,
    regions: Object.fromEntries(
      REGIONS.map((region) => {
        const firms = competitors.filter((f) => f.region === region).map(({ id }) => e.firms[id]);
        const active = firms.filter((f) => f.status === "open");
        const owned = business?.region === region && business.status === "active";
        return [
          region,
          {
            businesses: active.length + Number(owned),
            workers: active.reduce((sum, f) => sum + f.workers, 0) + (owned ? business.workers : 0),
            sales: firms.reduce((sum, f) => sum + f.revenue, 0) + (owned ? business.revenue : 0),
            averagePrice: active.length
              ? Math.round(active.reduce((sum, f) => sum + f.price, 0) / active.length)
              : 0,
          },
        ];
      }),
    ),
  };
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
  if (
    !regionalResidents.every(({ id }) => {
      const n = e.residents[id];
      return (
        exact(n, "cash savings debt employment") &&
        ["cash", "savings", "debt"].every((k) => integer(n[k])) &&
        ["employed", "searching"].includes(n.employment)
      );
    })
  )
    return false;
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
          : !p.owner.startsWith(`resident:${lot.region}:`))
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
              : !l.tenant.startsWith(`resident:${lot.region}:`)))) ||
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
      integer(f.workers, 0, 3) &&
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
  "Depozito önce kira borcuna sayılır.": [
    "The deposit covers rent arrears first.",
    "Kaucja w pierwszej kolejności pokrywa zaległy czynsz.",
  ],
  "Bu konutun geçerli kira sözleşmesi var.": [
    "This property has an active lease.",
    "Ta nieruchomość ma aktywną umowę najmu.",
  ],
  "İşlem için konutun bulunduğu şehre git.": [
    "Travel to the property's city first.",
    "Najpierw udaj się do miasta, w którym znajduje się nieruchomość.",
  ],
  "Önce ortak yaşam sözleşmesini açıkça kapat.": [
    "End the shared housing agreement first.",
    "Najpierw zakończ umowę wspólnego zamieszkania.",
  ],
  "Mevcut borç gelir riskini aşıyor.": [
    "Existing debt is too high.",
    "Obecne zadłużenie jest zbyt wysokie.",
  ],
  "Kira alınmaz. Bakım ve varsa konut kredisi sürer.": [
    "No rent is charged. Maintenance and mortgage obligations remain.",
    "Bez czynszu. Pozostają koszty utrzymania i raty kredytu.",
  ],
  "Konutun bakıma ihtiyacı yok.": [
    "The home does not need repairs.",
    "Mieszkanie nie wymaga remontu.",
  ],
  "Uygun mahalle sakini ilk kira ve depozitoyu kendi bütçesinden karşılar.": [
    "An eligible local tenant pays the first rent and deposit.",
    "Uprawniony lokalny najemca płaci pierwszy czynsz i kaucję.",
  ],
  "Ödeme yapabilen uygun kiracı yok.": [
    "No eligible tenant can afford the lease.",
    "Żaden uprawniony lokator nie może pokryć kosztów najmu.",
  ],
  "Depozito önce birikmiş kiradan düşer; kalanı iade edilir.": [
    "The deposit covers rent arrears first. Any remainder is refunded.",
    "Kaucja pokrywa zaległy czynsz. Reszta podlega zwrotowi.",
  ],
  "Satış bedeli krediyi karşılamıyor. Önce ek ödeme yap.": [
    "Sale proceeds cannot cover the loan. Make an extra payment first.",
    "Wpływy ze sprzedaży nie pokryją kredytu. Najpierw dokonaj nadpłaty.",
  ],
  "Banka bakiyesi sınırı bu satışı karşılamıyor.": [
    "Your account cannot receive the sale proceeds.",
    "Limit konta nie pozwala przyjąć wpływów ze sprzedaży.",
  ],
  "İşletmenin bulunduğu şehre git.": [
    "Travel to your business's city first.",
    "Najpierw udaj się do miasta, w którym działa firma.",
  ],
  "İşletme açık olmalı.": ["The business must be open.", "Firma musi być otwarta."],
  "Uygun aday yok veya ekip dolu.": [
    "No eligible applicants or the team is full.",
    "Brak kandydatów lub zespół jest pełny.",
  ],
  "En az beş günlük ücret işletme kasasında hazır olmalı.": [
    "Hold at least five days' wages in the business account.",
    "Firma musi mieć środki na co najmniej pięć dni wynagrodzeń.",
  ],
  "Kıdem ödemesi için kasa yetersiz.": [
    "Insufficient business funds for severance.",
    "Za mało środków firmy na odprawę.",
  ],
  "Rekabete göre talep ve kâr marjı değişir.": [
    "Competition changes demand and profit margins.",
    "Konkurencja wpływa na popyt i marżę.",
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
  "Kasaya 3.000 TL; otuz günde bir anapara ve %1 faiz.": [
    "Adds 3,000 TL to the business account. Principal and 1% interest are due every 30 days.",
    "3 000 TL na konto firmy. Kapitał i 1% odsetek płatne co 30 dni.",
  ],
  "İtibar, mevcut borç ve işletme bakiyesi krediye uygun olmalı.": [
    "Reputation, liabilities and available funds must meet the loan conditions.",
    "Reputacja, zobowiązania i saldo muszą spełniać warunki kredytu.",
  ],
  "Ödeme işletme kasasından anaparaya gider.": [
    "The business account pays down the principal.",
    "Spłata kapitału następuje z konta firmy.",
  ],
  "İşletme kasası yetersiz.": ["Insufficient business funds.", "Za mało środków firmy."],
  "Önce işletmeye sermaye aktar.": ["Add business capital first.", "Najpierw zasil konto firmy."],
  "Önce çalışan, vergi ve kredi yükümlülüklerini çöz.": [
    "Settle payroll, taxes and loan obligations first.",
    "Najpierw ureguluj płace, podatki i zobowiązania kredytowe.",
  ],
  "Ödenmemiş yükümlülük varken kâr çekilemez.": [
    "Profit withdrawals are blocked while obligations are overdue.",
    "Wypłata zysków jest zablokowana przy zaległych zobowiązaniach.",
  ],
  "Kapatmadan önce personelin kıdem ödemesini karşıla.": [
    "Cover staff severance before closing.",
    "Przed zamknięciem pokryj odprawy pracowników.",
  ],
  "Kooperatif en az altı birimlik sipariş alır.": [
    "The cooperative requires an order of at least six units.",
    "Spółdzielnia wymaga zamówienia na co najmniej sześć sztuk.",
  ],
  "Tedarik için işletme kasası yetersiz.": [
    "Insufficient business funds for supplies.",
    "Za mało środków firmy na zaopatrzenie.",
  ],
  "Bu tarife ve rekabet koşulunda ödenebilir müşteri siparişi yok.": [
    "No viable orders at this price and competition level.",
    "Brak opłacalnych zamówień przy tej cenie i poziomie konkurencji.",
  ],
  "İşletme hesabı üst sınırda.": [
    "The business account is at its limit.",
    "Konto firmy osiągnęło limit.",
  ],
};
const economyTemplates = [
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
  const [city, dwelling, action] = String(text).split(" · ");
  if (["İstanbul", "Ankara", "İzmir"].includes(city) && economyCopy[dwelling]) {
    const label =
      (language === "en" ? { İstanbul: "Istanbul", İzmir: "Izmir" }[city] : undefined) ?? city;
    return [label, economyCopy[dwelling][index], action && economyCopy[action]?.[index]]
      .filter(Boolean)
      .join(" · ");
  }
  for (const [pattern, english, polish] of economyTemplates)
    if (pattern.test(text)) return String(text).replace(pattern, index === 0 ? english : polish);
  return text;
}
