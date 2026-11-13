import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  getActions,
  resolveAction,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import {
  adaptEconomyActions,
  afterEconomyAction,
  economyActions,
  economyNpcHousingCost,
  economyView,
  initEconomy,
  localizeEconomyText,
  tickEconomy,
  validateEconomy,
} from "../public/games/tc-sim-boardworld/expansion-economy.mjs";

const api = {
  record(s, label, amount, account) {
    s.transactions.push({ day: Math.floor(s.time / 1440) + 1, label, amount, account });
    s.transactions = s.transactions.slice(-160);
  },
  spend(s, amount, label, pay) {
    const bank = pay === "total" ? Math.min(amount, s.bank) : 0;
    s.bank -= bank;
    s.cash -= amount - bank;
    assert.ok(s.bank >= 0 && s.cash >= 0);
    if (bank) api.record(s, label, -bank, "bank");
    if (amount > bank) api.record(s, label, bank - amount, "cash");
  },
  receive(s, amount, label, account = "cash") {
    s[account] += amount;
    api.record(s, label, amount, account);
  },
  change(s, changes) {
    for (const [key, value] of Object.entries(changes))
      s.player[key] = Math.min(100, Math.max(0, s.player[key] + value));
  },
  document(s, id, title, text) {
    s.documents.push({ id, title, text, day: Math.floor(s.time / 1440) + 1 });
  },
  log() {},
  expansionEvent(s, type, subject, detail) {
    s.expansion.events.push({ type, subject, detail });
  },
  creditMunicipalTax(s, region, amount) {
    s.expansion.world.regions[region].treasury += amount;
    return amount;
  },
};
function fixture({ city = "istanbul", readyBusiness = false } = {}) {
  let s = createGame({ scenario: "restart", seed: 303 });
  if (readyBusiness && !s.expansion) {
    while (s.pendingEvents.length) {
      const opening = getActions(s).find((a) => a.id.startsWith("event:") && !a.disabled);
      assert.ok(opening);
      const result = resolveAction(s, opening.id);
      assert.equal(result.ok, true);
      s = result.state;
    }
    const setup = resolveAction(s, "business:start:repair");
    assert.equal(setup.ok, true, setup.message);
    s = setup.state;
  }
  // Use the released engine's state when this test runs standalone on its
  // worktree. Once integrated the real expansion coordinator initializes it.
  s.expansion ??= {};
  s.expansion.playerId ??= "player:1";
  s.expansion.world ??= { regions: {}, region: city };
  s.expansion.world.region = city;
  for (const id of ["istanbul", "ankara", "izmir"]) {
    s.expansion.world.regions[id] ??= { price: 100, employment: 100, population: 1000 };
    s.expansion.world.regions[id].treasury = 0;
  }
  s.expansion.events = [];
  s.cash = 2500;
  s.bank = 120000;
  if (readyBusiness && !s.deep.business) {
    s.deep.business = {
      id: "repair",
      location: "kadikoy",
      status: "active",
      level: 1,
      clients: 0,
      reputation: 20,
      revenue: 0,
      costs: 3600,
      lastServiceDay: 0,
      lastAcquireDay: 0,
      nextOverheadDay: 8,
      openedDay: 1,
      arrears: 0,
      accruedOverhead: 0,
    };
    s.living.enterprise = { instanceId: "repair:1", stock: 0, capital: 0, lastRestockAt: 0 };
  }
  initEconomy(s);
  return s;
}
const e = (s) => s.expansion.economy;
const p = (s, id) => e(s).properties[id];
const total = (s) => s.bank + s.cash;
function action(s, id) {
  const result = economyActions(s, api).find((a) => a.id === "economy:" + id);
  assert.ok(result, id);
  return result;
}
function run(s, id) {
  const a = action(s, id);
  assert.equal(a.disabled, false, a.reason);
  s.revision++;
  api.spend(s, a.cost, a.label, a.pay);
  a.run(s);
  assert.ok(validateEconomy(s), id);
  return a.cost;
}
function advance(s, count) {
  for (let i = 0; i < count; i++) {
    s.time += 1440;
    tickEconomy(s, api);
    assert.ok(validateEconomy(s));
  }
}
const dayOf = (s) => Math.floor(s.time / 1440) + 1;

test("regional rental replaces Gold rent and pays one lease; deposit repays missed rent", () => {
  const s = fixture({ city: "ankara" });
  const prior = total(s);
  const cost = run(s, "rent:ankara:studio");
  const lease = p(s, "ankara:studio").lease;
  assert.equal(total(s), prior + 4200 - cost);
  assert.equal(lease.rent + lease.deposit, cost);
  assert.equal(s.housing.rent, 0);
  assert.equal(s.housing.deposit, 0);
  assert.equal(s.housing.id, "studio");
  const after = total(s);
  advance(s, 30);
  assert.equal(total(s), after - lease.rent);
  tickEconomy(s, api);
  assert.equal(total(s), after - lease.rent, "same day cannot settle twice");
  s.cash = s.bank = 0;
  advance(s, 90);
  assert.equal(e(s).home, "");
  assert.equal(s.housing.id, "shelter");
  assert.equal(p(s, "ankara:studio").lease, null);
  assert.equal(s.housing.arrears, lease.rent * 2);
});

test("household title persists through successor and can be maintained, occupied and sold", () => {
  const s = fixture({ city: "izmir" });
  const before = total(s);
  const amount = run(s, "buy:izmir:room");
  assert.equal(total(s), before - amount);
  assert.equal(p(s, "izmir:room").owner, "household");
  s.expansion.playerId = "player:2";
  run(s, "occupy:izmir:room");
  assert.equal(s.housing.rent, 0);
  assert.equal(e(s).home, "izmir:room");
  const rentAction = economyActions(s, api).find(({ id }) => id === "economy:rent:izmir:room");
  assert.equal(rentAction, undefined);
  advance(s, 28);
  const condition = p(s, "izmir:room").condition;
  run(s, "maintain:izmir:room");
  assert.ok(p(s, "izmir:room").condition > condition);
  const beforeSale = total(s);
  run(s, "sell:izmir:room");
  assert.equal(e(s).home, "");
  assert.equal(p(s, "izmir:room").owner, "market");
  assert.ok(total(s) > beforeSale);
  assert.ok(total(s) < before, "buy/sell and maintenance cannot mint household money");
});

test("mortgage amortizes interest before principal and foreclosure clears title exactly once", () => {
  const s = fixture();
  s.debt = 0;
  run(s, "mortgage:istanbul:room");
  const item = p(s, "istanbul:room");
  const before = item.mortgage.principal;
  run(s, "occupy:istanbul:room");
  advance(s, 30);
  assert.equal(item.mortgage.interest, 0);
  assert.equal(item.mortgage.principal, before - Math.ceil(before * 0.04));
  const remaining = item.mortgage.principal;
  run(s, "repay:istanbul:room");
  assert.equal(item.mortgage.principal, remaining - 5000);
  s.bank = s.cash = 0;
  advance(s, 90);
  assert.equal(e(s).home, "");
  assert.equal(item.owner, "market");
  assert.equal(item.mortgage, null);
  assert.equal(s.expansion.events.filter(({ type }) => type === "property.default").length, 1);
});

test("NPC rent is debited once, including refundable deposit, and duplicate tenancy is rejected", () => {
  const s = fixture();
  const npc = s.deep.npcs.mert;
  npc.cash = 20000;
  const start = npc.cash + npc.savings;
  run(s, "buy:istanbul:room");
  const player = total(s);
  run(s, "let:istanbul:room");
  const item = p(s, "istanbul:room");
  assert.equal(item.lease.tenant, "mert");
  assert.equal(npc.cash + npc.savings, start - item.lease.rent - item.lease.deposit);
  assert.equal(total(s), player + item.lease.rent);
  assert.equal(economyNpcHousingCost(s, "mert", 180 + Math.round(npc.rent / 30)), 180);
  const tampered = structuredClone(s);
  p(tampered, "istanbul:studio").owner = "household";
  p(tampered, "istanbul:studio").lease = { ...item.lease };
  assert.equal(validateEconomy(tampered), false);
  const lease = item.lease;
  advance(s, 30);
  assert.equal(total(s), player + lease.rent * 2);
  run(s, "end:istanbul:room");
  assert.equal(npc.cash + npc.savings, start - lease.rent * 2);
  assert.equal(item.lease, null);
});

test("competitive businesses transact stock, pay staff and settle tax and loans without duplicate payouts", () => {
  const s = fixture({ readyBusiness: true });
  s.living.enterprise.stock = 12;
  s.living.enterprise.capital = 2000;
  s.deep.business.clients = 4;
  s.deep.business.reputation = 48;
  run(s, "hire");
  run(s, "supplier:cooperative");
  run(s, "price:85");
  const opening = s.living.enterprise.capital;
  run(s, "business-credit");
  assert.equal(s.living.enterprise.capital, opening + 3000);
  const beforeStock = s.living.enterprise.stock;
  advance(s, 1);
  assert.ok(s.living.enterprise.stock < beforeStock);
  assert.ok(s.deep.business.revenue > 0);
  assert.ok(s.transactions.some((x) => x.label === "Çalışanlara ücret ödemesi" && x.amount < 0));
  const cash = s.living.enterprise.capital;
  tickEconomy(s, api);
  assert.equal(s.living.enterprise.capital, cash);
  const oldDebt = e(s).business.principal;
  advance(s, 29);
  assert.ok(e(s).business.principal < oldDebt);
  assert.ok(e(s).business.taxes > 0);
  assert.ok(economyView(s).regions.istanbul.workers >= 1);
  assert.ok(economyView(s).regions.ankara.sales > 0);
});

test("insolvency pauses the firm and conserves unpaid liabilities through closure", () => {
  const s = fixture({ readyBusiness: true });
  const b = e(s).business;
  b.workers = 2;
  b.principal = 3000;
  b.installmentDay = dayOf(s) + 30;
  s.living.enterprise.capital = 0;
  advance(s, 4);
  assert.equal(b.workers, 0);
  assert.equal(s.deep.business.status, "paused");
  assert.ok(b.wageDue > 0);
  const adapted = adaptEconomyActions(s, [{ id: "business:pause", disabled: false }], api);
  assert.equal(adapted[0].disabled, true);
  const previous = structuredClone(s);
  const totalLiability = b.principal + b.wageDue;
  s.bank = s.cash = 0;
  const oldDebt = s.debt;
  s.deep.business = null;
  afterEconomyAction(s, previous, api, { id: "business:close" });
  assert.equal(s.debt, oldDebt + totalLiability);
  assert.equal(e(s).business, null);
  assert.ok(validateEconomy(s));
});

test("fresh rival states settle deterministically under both growth and prolonged low demand", () => {
  const one = fixture();
  const two = structuredClone(one);
  for (const s of [one, two]) {
    s.expansion.world.regions.istanbul.employment = 50;
    advance(s, 120);
  }
  assert.deepEqual(e(one), e(two));
  assert.deepEqual(one.expansion.events, two.expansion.events);
  assert.ok(one.expansion.world.regions.ankara.treasury > 0);
  assert.equal(validateEconomy(one), true);
  const malformed = structuredClone(one);
  p(malformed, "istanbul:room").owner = "unregistered";
  assert.equal(validateEconomy(malformed), false);
});

test("regional households finance actual leases and adverse markets can close NPC firms", () => {
  const s = fixture({ city: "ankara" });
  run(s, "buy:ankara:room");
  run(s, "let:ankara:room");
  const lease = p(s, "ankara:room").lease;
  assert.equal(lease.tenant, "resident:ankara:0");
  const resident = e(s).residents[lease.tenant];
  const initial = total(s);
  advance(s, 30);
  assert.equal(total(s), initial + lease.rent);
  assert.ok(resident.cash + resident.savings > 0);

  const rival = e(s).firms["ankara:repair"];
  Object.assign(rival, { cash: 0, stock: 0 });
  s.expansion.world.regions.ankara.employment = 50;
  advance(s, 3);
  assert.equal(rival.status, "closed");
  assert.equal(rival.workers, 0);
  assert.equal(rival.cash, 0);
  s.expansion.world.regions.ankara.employment = 125;
  advance(s, 30);
  assert.equal(rival.status, "open");
  assert.ok(rival.workers > 0);
});

test("economy labels and dynamic amounts localize without touching the Turkish source", () => {
  assert.equal(localizeEconomyText("İstanbul · Oda · kirala", "tr"), "İstanbul · Oda · kirala");
  assert.equal(localizeEconomyText("İstanbul · Oda · kirala", "en"), "Istanbul · Room · rent");
  assert.equal(localizeEconomyText("İstanbul · Oda · kirala", "pl"), "İstanbul · Pokój · wynajmij");
  assert.equal(
    localizeEconomyText("İlk kira ve depozito: 4200 TL.", "pl"),
    "Pierwszy czynsz i kaucja: 4200 TL.",
  );
  assert.equal(localizeEconomyText("Mert Aksoy", "en"), "Mert Aksoy");
});
