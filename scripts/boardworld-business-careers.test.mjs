import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { createGame, getActions, loadExpansionRuntime, resolveAction, validateState } from
  "../public/games/tc-sim-boardworld/engine.mjs";
import { exportGame, importGame, loadExpansionLocked, saveExpansionLocked } from
  "../public/games/tc-sim-boardworld/persistence.mjs";
import { getDeepView } from "../public/games/tc-sim-boardworld/deep-life.mjs";
import { getDistrictSimulation } from "../public/games/tc-sim-boardworld/expansion-districts.mjs";
import { localizeExpansionOutcome, translateExpansionAction } from "../public/games/tc-sim-boardworld/expansion-ui.mjs";

const runtime = await loadExpansionRuntime();
const action = (s, id) => getActions(s).find((row) => row.id === id);
function act(s, id) {
  const result = resolveAction(s, id);
  assert.ok(result.ok, `${id} at ${s.time}: ${result.message}`);
  assert.ok(validateState(result.state));
  return result.state;
}
function ready(s, id) {
  for (let index = 0; index < 36; index++) {
    if (action(s, id)?.disabled === false) return s;
    const event = getActions(s).find((row) => row.category === "event" && !row.disabled);
    s = act(s, event?.id ?? "wait:60");
  }
  assert.fail(`${id}: ${action(s, id)?.reason ?? "missing"}`);
}
function workplace(district) {
  const s = createGame({ expansion: true, startingDistrict: district, lifePath: "ordinary", seed: 49 });
  Object.assign(s.player.skills, { communication: 50, knowledge: 50, craft: 50 });
  s.inventory.tools = 1;
  s.bank = 25_000;
  const visit = district.includes(":") ? `district:visit:${district}:work` : `visit:${district}-work`;
  return act(ready(s, visit), visit);
}
function open(s, sector) {
  const id = `business:start:${sector}`;
  const offer = action(s, id);
  const opened = act(s, id);
  assert.equal(opened.time - s.time, offer.minutes);
  assert.equal(s.cash + s.bank - opened.cash - opened.bank, offer.cost);
  assert.equal(opened.expansion.economy.business.sector, sector);
  s = act(opened, "business:fund:500");
  const stocked = act(s, "business:stock:6");
  assert.equal(stocked.living.enterprise.stock, 6);
  assert.ok(stocked.living.enterprise.capital < s.living.enterprise.capital);
  return stocked;
}

test("a kitchen fills the actual food vendor's stock from its own funded production", () => {
  const district = "ankara:altindag";
  let s = workplace(district);
  const offer = action(s, "business:start:kitchen");
  for (const language of ["en", "pl"]) {
    const translated = translateExpansionAction(offer, language);
    assert.notEqual(translated.label, offer.label);
    assert.notEqual(translated.description, offer.description);
  }
  s = open(s, "kitchen");
  const vendor = (state) => state.expansion.districts.foodMarkets[district];
  assert.deepEqual(vendor(s), {stock: 12, cash: 1000, wholesaleSpent: 0, lastDay: 1});
  const tooExpensive = act(s, "economy:price:120");
  assert.ok(action(tooExpensive, "business:serve").disabled);
  const unfunded = structuredClone(s);
  vendor(unfunded).cash = 0;
  assert.ok(action(unfunded, "business:serve").disabled);
  const noStock = structuredClone(s);
  noStock.living.enterprise.stock = 0;
  const noStockAction = action(noStock, "business:serve");
  assert.equal(noStockAction.reason, "Önce stok al.");
  for (const language of ["en", "pl"])
    assert.notEqual(translateExpansionAction(noStockAction, language).reason, noStockAction.reason);
  const noCapital = structuredClone(s);
  noCapital.living.enterprise.capital = 0;
  assert.equal(action(noCapital, "business:serve").reason, "Önce işletmeye sermaye aktar.");
  const original = exportGame(s);
  const delivered = act(s, "business:serve");
  const units = s.living.enterprise.stock - delivered.living.enterprise.stock;
  const revenue = delivered.deep.business.revenue;
  assert.equal(delivered.time - s.time, 90);
  assert.ok(units > 0 && revenue > 0);
  assert.equal(vendor(delivered).stock - vendor(s).stock, units);
  assert.equal(vendor(s).cash - vendor(delivered).cash, revenue);
  assert.equal(delivered.living.enterprise.capital - s.living.enterprise.capital, revenue - units * 7);
  assert.equal(s.bank, delivered.bank);
  assert.ok(action(delivered, "business:serve").disabled);
  assert.equal(exportGame(act(importGame(original).state, "business:serve")), exportGame(delivered));
  assert.equal(runtime.getExpansionView(delivered).economy.business.name, "Mahalle mutfağı");
});

test("opening a kitchen materializes default vendors once and preserves established ledgers", () => {
  const district = "ankara:altindag";
  const workplaceStock = (state) => state.expansion.districts.foodMarkets;
  const openKitchen = "business:start:kitchen";
  const fresh = workplace(district);
  assert.equal(workplaceStock(fresh), undefined);
  assert.equal(getDistrictSimulation(fresh, district).foodStock, 12);
  const first = act(fresh, openKitchen);
  assert.equal(first.cash + first.bank, fresh.cash + fresh.bank - 3200);
  assert.equal(first.living.enterprise.capital, 0);
  assert.equal(workplaceStock(first)[district].stock, getDistrictSimulation(fresh, district).foodStock);
  assert.equal(exportGame(act(importGame(exportGame(fresh)).state, openKitchen)), exportGame(first));

  const social = `district:visit:${district}:social`;
  const work = `district:visit:${district}:work`;
  const visiting = act(ready(fresh, social), social);
  const eaten = act(ready(visiting, "world:meal"), "world:meal");
  const readyToOpen = act(ready(eaten, work), work);
  assert.equal(workplaceStock(readyToOpen)[district].stock, 11);
  assert.ok(workplaceStock(readyToOpen)[district].cash > 1000);
  const existing = act(readyToOpen, openKitchen);
  assert.deepEqual(workplaceStock(existing), workplaceStock(readyToOpen));
  const closed = act(existing, "business:close");
  const reopened = act(ready(closed, openKitchen), openKitchen);
  assert.deepEqual(workplaceStock(reopened), workplaceStock(closed));
});

test("a solvent owner's withdrawal funds actual childcare without charging it as a business expense", () => {
  const id = "business:family-care";
  const day = (s) => Math.floor(s.time / 1440) + 1;
  const family = (s) => s.expansion.family;
  const book = (s) => s.deep.business;
  const cash = (s) => s.living.enterprise.capital;
  const company = (s) => s.expansion.economy.business;
  const until = (s, target) => {
    while (day(s) < target) {
      const event = getActions(s).find(row => row.category === "event" && !row.disabled);
      s = act(s, event?.id ?? "wait:60");
    }
    return s;
  };
  let s = open(workplace("ankara:altindag"), "kitchen");
  assert.equal(action(s, id), undefined);
  s = act(s, "family:adopt");
  assert.equal(action(s, id).reason, "Açık işletmede önce gerçek bir satış yap.");
  s = act(ready(s, "business:serve"), "business:serve");
  s = act(s, "business:fund:2000");
  const owner = s.expansion.playerId;
  const childId = family(s).people.find(p => p.parents.includes(owner)).id;
  const quote = action(s, id);
  for (const locale of ["en", "pl"]) {
    for (const field of ["label", "description"])
      assert.notEqual(translateExpansionAction(quote, locale)[field], quote[field]);
  }
  const paid = act(s, id);
  assert.equal(paid.time - s.time, 15);
  assert.equal(family(paid).reserve - family(s).reserve, 250);
  assert.equal(cash(s) - cash(paid), 250);
  assert.deepEqual([paid.cash, paid.bank, book(paid).costs, book(paid).revenue], [s.cash, s.bank, book(s).costs, book(s).revenue]);
  assert.deepEqual(paid.transactions.slice(-2).map(({account, amount}) => [account, amount]), [["business", -250], ["household", 250]]);
  assert.deepEqual(act(importGame(exportGame(s)).state, id), paid);

  for (const changes of [{wageDue: 1}, {taxDue: 1}, {missed: 1, principal: 600, installmentDay: 10}]) {
    const owed = structuredClone(s);
    Object.assign(company(owed), changes);
    assert.equal(action(owed, id).reason, "Önce işletmenin ödenmemiş yükümlülüklerini kapat.");
  }
  const reserved = structuredClone(s);
  Object.assign(company(reserved), {workers: 1, principal: 1000, installmentDay: 10});
  book(reserved).accruedOverhead = 30.2;
  const wage = Number(/^\d+/.exec(action(reserved, "economy:hire").description)[0]);
  const required = 250 + wage + 31 + Math.floor(book(reserved).revenue * 0.04) + 460;
  reserved.living.enterprise.capital = required - 1;
  assert.equal(action(reserved, id).reason, "Ücretler, vergi, taksit ve sabit gider için para ayır.");
  reserved.living.enterprise.capital++;
  assert.equal(action(reserved, id).disabled, false);

  const estate = structuredClone(paid);
  const founder = family(estate).people.find(p => p.id === owner);
  const sibling = family(estate).people.find(p => p.id !== owner && p.parents.some(parent => founder.parents.includes(parent)));
  founder.born = day(estate) + 1 - founder.lifespan * 30;
  for (const p of family(estate).people.filter(p => founder.parents.includes(p.id))) {
    p.born = founder.born - 24 * 30;
    p.died ??= day(estate);
  }
  const inherited = until(estate, day(estate) + 1);
  const successor = act(inherited, `family:successor:${sibling.id}`);
  assert.equal(family(successor).reserve, family(inherited).reserve);
  assert.equal(cash(successor), cash(inherited));
  assert.equal(action(successor, id), undefined);

  // Prepare a personal shortfall at an actual billing date. The ordinary
  // monthly settlement uses the existing family reserve in the paid branch.
  const shortfall = until(s, 30);
  shortfall.cash = 0;
  shortfall.bank = 0;
  const covered = until(act(ready(shortfall, id), id), 31);
  const uncovered = until(shortfall, 31);
  assert.equal(family(covered).arrears, 0);
  assert.ok(family(uncovered).arrears > 0);
  assert.equal(family(covered).people.find(p => p.id === childId).care - family(uncovered).people.find(p => p.id === childId).care, 8);

  let midnight = shortfall;
  while (midnight.time % 1440 < 1425) {
    const event = getActions(midnight).find(row => row.category === "event" && !row.disabled);
    midnight = act(midnight, event?.id ?? (midnight.time % 1440 < 1380 ? "wait:60" : "wait:15"));
  }
  assert.equal(day(midnight), 30);
  Object.assign(company(midnight), { workers: 1, principal: 1000, installmentDay: 31 });
  Object.assign(book(midnight), { accruedOverhead: 31, nextOverheadDay: 31 });
  midnight.living.enterprise.stock = 0;
  const payroll = runtime.getExpansionView(midnight).economy.business.wageRate;
  const tax = Math.floor((book(midnight).revenue - company(midnight).lastTaxRevenue) * 0.04);
  midnight.living.enterprise.capital = 250 + payroll + tax + 460 + 31;
  const blocked = resolveAction(midnight, id);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.message, "Ücretler, vergi, taksit ve sabit gider için para ayır.");
  assert.equal(blocked.state, midnight);

  midnight.living.enterprise.capital++;
  const baseline = act(midnight, "wait:15");
  const afterMidnight = act(midnight, id);
  assert.equal(day(afterMidnight), 31);
  assert.equal(cash(afterMidnight), 0);
  assert.equal(cash(baseline), 250);
  assert.equal(family(afterMidnight).reserve - family(baseline).reserve + family(baseline).arrears - family(afterMidnight).arrears, 250);
  assert.equal(book(afterMidnight).costs - book(midnight).costs, payroll + tax + 10 + 32);
  assert.deepEqual(company(afterMidnight), company(baseline));
  assert.equal(book(afterMidnight).arrears, 0);
});

test("the kitchen forecast and fixed-cost settlement use the same sector rate", () => {
  const prepared = workplace("ankara:altindag");
  prepared.inventory.book = 1;
  const kitchen = act(prepared, "business:start:kitchen");
  const teaching = act(prepared, "business:start:teaching");
  const view = getDeepView(kitchen);
  assert.equal(view.business.weeklyOverhead * 5, getDeepView(teaching).business.weeklyOverhead);
  assert.equal(view.finance.forecast.find(({ label }) => label === "İşletme sabit gideri").amount,
    -view.business.weeklyOverhead);
  const funded = act(kitchen, "business:fund:500");
  const elapsed = act(funded, "wait:60");
  const delta = elapsed.deep.business.accruedOverhead - funded.deep.business.accruedOverhead;
  assert.ok(Math.abs(delta - view.business.weeklyOverhead * 60 / 10080) < 1e-8);
  const paused = act(elapsed, "business:pause");
  const charge = Math.ceil(elapsed.deep.business.accruedOverhead);
  assert.equal(funded.living.enterprise.capital - paused.living.enterprise.capital, charge);
  assert.equal(paused.deep.business.costs - elapsed.deep.business.costs, charge);
  assert.equal(paused.deep.business.accruedOverhead, 0);
});

test("a supply workshop sells into a funded firm order and closes on its own assets", () => {
  const id = "ankara:yenimahalle:repair";
  const s = open(workplace("ankara:yenimahalle"), "supplier");
  const firm = (state) => state.expansion.economy.firms[id];
  const counterfactual = structuredClone(s);
  firm(counterfactual).cash = 0;
  assert.ok(action(counterfactual, "business:serve").disabled);
  const delivered = act(s, "business:serve");
  const units = s.living.enterprise.stock - delivered.living.enterprise.stock;
  const revenue = delivered.deep.business.revenue;
  assert.equal(delivered.time - s.time, 120);
  assert.ok(units > 0 && revenue > 0);
  assert.equal(firm(delivered).stock - firm(s).stock, units);
  assert.equal(firm(s).cash - firm(delivered).cash, revenue);
  assert.equal(firm(delivered).costs - firm(s).costs, revenue);
  assert.equal(delivered.living.enterprise.capital - s.living.enterprise.capital, revenue - units * 8);
  const closed = act(delivered, "business:close");
  assert.equal(closed.deep.business, null);
  assert.equal(closed.living.enterprise.stock, 0);
  assert.ok(closed.bank > delivered.bank);
});

test("only local business supplies are transferred from the named district firm", () => {
  const work = workplace("ankara:yenimahalle");
  const started = act(ready(work, "business:start:repair"), "business:start:repair");
  const funded = act(started, "business:fund:5000");
  const firm = (s) => s.expansion.economy.firms["ankara:yenimahalle:repair"];
  const local = act(funded, "business:stock:6");
  const payment = funded.living.enterprise.capital - local.living.enterprise.capital;
  assert.ok(payment > 0);
  assert.equal(firm(local).stock, firm(funded).stock - 6);
  assert.equal(firm(local).cash - firm(funded).cash, payment);
  assert.equal(firm(local).revenue - firm(funded).revenue, payment);
  assert.equal(local.living.enterprise.stock, funded.living.enterprise.stock + 6);
  const cooperative = act(funded, "economy:supplier:cooperative");
  const received = act(cooperative, "business:stock:6");
  assert.deepEqual(firm(received), firm(cooperative));
  assert.ok(received.living.enterprise.capital < cooperative.living.enterprise.capital);
  assert.equal(received.living.enterprise.stock, cooperative.living.enterprise.stock + 6);
});

test("district specialties require relevant qualifications and pay from the same existing employer", () => {
  let s = workplace("ankara:altindag");
  assert.ok(action(s, "district:apply:training").disabled);
  const retirement = structuredClone(s);
  retirement.expansion.family.people.find((p) => p.id === retirement.expansion.playerId).retired = true;
  assert.equal(action(retirement, "district:apply:training"), undefined);
  s.expansion.institutions.qualifications.push({ course: "teaching", day: 1 });
  const qualified = act(s, "district:apply:training");
  const job = qualified.expansion.districts.job;
  assert.equal(job.role, "training");
  assert.equal(runtime.getExpansionView(qualified).districts.job.roleName, "Eğitim koordinatörü");
  const employer = (state) => state.expansion.economy.firms[job.firmId];
  const wage = Number(/^Ücret: (\d+)/.exec(action(qualified, "district:shift").description)[1]);
  const priceIndex = qualified.expansion.world.regions.ankara.price;
  const { serviceDelay } = getDistrictSimulation(qualified, "ankara:altindag");
  const materials = 2 * Math.round(70 * priceIndex * (100 + serviceDelay / 5) / 10000);
  const shifted = act(qualified, "district:shift");
  assert.equal(shifted.time - qualified.time, 300);
  assert.equal(shifted.bank - qualified.bank, wage);
  assert.equal(employer(shifted).stock - employer(qualified).stock, 2);
  assert.equal(employer(qualified).cash - employer(shifted).cash, wage + materials);
  assert.equal(employer(shifted).costs - employer(qualified).costs, wage + materials);
  assert.equal(employer(shifted).revenue, employer(qualified).revenue);
  assert.equal(shifted.player.skills.knowledge, qualified.player.skills.knowledge + 1);
  assert.ok(action(shifted, "district:shift").disabled);
  assert.deepEqual(importGame(exportGame(shifted)).state, shifted);
  assert.deepEqual(act(importGame(exportGame(qualified)).state, "district:shift"), shifted);

  const noWage = structuredClone(qualified);
  employer(noWage).cash = wage - 1;
  assert.strictEqual(resolveAction(noWage, "district:shift").state, noWage);
  assert.ok(action(noWage, "district:shift").disabled);
  const wageOnly = structuredClone(qualified);
  employer(wageOnly).cash = wage;
  const paid = act(wageOnly, "district:shift");
  assert.equal(paid.bank - wageOnly.bank, wage);
  assert.equal(employer(paid).cash, 0);
  assert.equal(employer(paid).stock, employer(wageOnly).stock);
  assert.equal(employer(paid).costs - employer(wageOnly).costs, wage);
  const full = structuredClone(qualified);
  employer(full).stock = 12;
  const capacity = act(full, "district:shift");
  assert.equal(employer(capacity).stock, 12);
  assert.equal(employer(full).cash - employer(capacity).cash, wage);
  for (const [district, role, minutes] of [
    ["ankara:cankaya", "customer-service", 240],
    ["ankara:yenimahalle", "logistics", 360],
  ]) {
    const hired = act(workplace(district), `district:apply:${role}`);
    assert.equal(hired.expansion.districts.job.role, role);
    assert.equal(action(hired, "district:shift").minutes, minutes);
  }
});

test("a budgeting qualification opens a paid finance shift at an actual digital services firm", () => {
  const id = "district:apply:finance", firmId = "izmir:digital";
  const firms = (s) => s.expansion.economy.firms;
  const opening = workplace("izmir:bornova");
  assert.equal(action(opening, id).reason, "Bütçe yeterliliği gerekir.");
  assert.match(action(opening, id).description, /^Alsancak Dijital/);
  for (const locale of ["en", "pl"]) {
    const translated = translateExpansionAction(action(opening, id), locale);
    for (const field of ["label", "description", "reason"])
      assert.notEqual(translated[field], action(opening, id)[field]);
  }
  assert.equal(action(workplace("izmir:konak"), id), undefined);
  const shortOnFunds = structuredClone(opening);
  firms(shortOnFunds)[firmId].cash = 0;
  assert.equal(action(shortOnFunds, id), undefined);
  assert.ok(firms(shortOnFunds)["izmir:teaching"].cash > 0);

  // The program completion is prepared here so each counterfactual can share the workplace.
  const completed = structuredClone(opening);
  completed.expansion.institutions.qualifications.push({course: "finance", day: 1});
  const unskilled = structuredClone(completed);
  unskilled.player.skills.knowledge = 29;
  assert.equal(action(unskilled, id).reason, "Bilgi 30 gerekir.");
  const hired = act(completed, id);
  assert.equal(hired.time - completed.time, 30);
  assert.equal(hired.expansion.districts.job.role, "finance");
  assert.equal(hired.expansion.districts.job.firmId, firmId);
  assert.equal(runtime.getExpansionView(hired).districts.job.roleName, "Finans görevlisi");
  const mismatched = structuredClone(hired);
  mismatched.expansion.districts.job.firmId = "izmir:teaching";
  assert.equal(validateState(mismatched), false);
  const exported = exportGame(hired);
  assert.match(JSON.parse(exported).format, /-careers$/);
  const resumed = importGame(exported).state;
  assert.deepEqual(resumed, hired);
  const next = act(resumed, "district:shift");
  const wage = Number(/Ücret: (\d+) TL/.exec(action(resumed, "district:shift").description)[1]);
  assert.equal(next.time - resumed.time, 270);
  assert.equal(next.bank - resumed.bank, wage);
  const debit = firms(resumed)[firmId].cash - firms(next)[firmId].cash;
  assert.ok(debit >= wage);
  assert.equal(debit, firms(next)[firmId].costs - firms(resumed)[firmId].costs);
  assert.deepEqual(firms(next)["izmir:teaching"], firms(resumed)["izmir:teaching"]);
  assert.equal(next.player.skills.knowledge, resumed.player.skills.knowledge + 1);
  assert.equal(next.expansion.districts.job.shifts, 1);
  assert.deepEqual(act(hired, "district:shift"), next);
});

test("the municipal health career pays from its treasury and enables a real funded patient visit", () => {
  const id = "district:apply:health", center = "district:visit:ankara:altindag:institution";
  const course = "health-support", residentId = "resident:ankara:altindag";
  const treasury = (s) => s.expansion.institutions.regions.ankara;
  const patient = (s) => s.expansion.economy.residents[residentId];
  let s = createGame({scenario: "graduate", startingDistrict: "ankara:altindag", lifePath: "freeform", seed: 49});
  assert.equal(action(s, id), undefined);
  assert.equal(action(s, `institution:school:${course}`), undefined);
  s = act(ready(s, center), center);
  assert.equal(action(s, id).reason, "Sağlık hizmetleri yeterliliği gerekir.");
  const training = action(s, `institution:school:${course}`);
  for (const locale of ["en", "pl"]) {
    for (const option of [action(s, id), training])
      assert.notEqual(translateExpansionAction(option, locale).label, option.label);
    assert.notEqual(translateExpansionAction(action(s, id), locale).reason, action(s, id).reason);
  }
  const enrolled = act(s, training.id);
  assert.equal(enrolled.time - s.time, 30);
  assert.equal(s.bank + s.cash - enrolled.bank - enrolled.cash, training.cost);
  assert.match(JSON.parse(exportGame(enrolled)).format, /-careers$/);
  s = importGame(exportGame(enrolled)).state;
  assert.equal(runtime.getExpansionView(s).institutions.program.name, "Sağlık hizmetleri eğitimi");
  for (let i = 0; i < 4; i++) {
    if (i) s = act(ready(s, "world:rest"), "world:rest");
    const studying = ready(s, "institution:study");
    s = act(studying, "institution:study");
    assert.equal(s.time - studying.time, 90);
  }
  assert.ok(s.expansion.institutions.qualifications.some(q => q.course === course));
  assert.ok(s.documents.some(row => row.id === `certificate-${course}`));
  const hired = act(ready(s, id), id);
  assert.equal(hired.expansion.districts.job.firmId, "ankara:public-health");
  const shift = ready(hired, "district:shift");
  const control = structuredClone(shift);
  const quote = action(control, "district:shift");
  const wage = Number(/Ücret: (\d+) TL/.exec(quote.description)[1]);
  const decline = structuredClone(control);
  treasury(decline).treasury = wage;
  assert.equal(action(decline, "district:shift").disabled, true);
  assert.equal(resolveAction(decline, "district:shift").state, decline);
  const sickWorker = structuredClone(control);
  sickWorker.player.health = 54;
  assert.equal(action(sickWorker, "district:shift").reason, "Sağlık durumun bu iş için uygun değil.");

  // Prepare local need and a counterfactual without money for the same visit.
  patient(control).life.health = 43;
  patient(control).cash = 600;
  patient(control).savings = 0;
  const poor = structuredClone(control);
  patient(poor).cash = 459;
  const remote = poor.expansion.economy.residents["resident:ankara:mamak"];
  remote.life.health = 43;
  remote.cash = 600;
  const paidOnly = act(poor, "district:shift");
  assert.equal(paidOnly.bank - poor.bank, wage);
  assert.equal(treasury(poor).treasury - treasury(paidOnly).treasury, wage);
  assert.equal(patient(paidOnly).life.health, 43);
  assert.equal(paidOnly.expansion.economy.residents["resident:ankara:mamak"].life.health, 43);

  const result = resolveAction(control, "district:shift");
  assert.ok(result.ok, result.message);
  const treated = result.state;
  assert.equal(treated.time - control.time, 240);
  assert.equal(treated.bank - control.bank, wage);
  assert.equal(patient(treated).life.health, 67);
  const fee = patient(control).cash - patient(treated).cash;
  assert.ok(fee > 0);
  assert.equal(treasury(treated).treasury, treasury(control).treasury - wage + fee);
  assert.deepEqual(treated.expansion.economy.firms, control.expansion.economy.firms);
  for (const locale of ["en", "pl"])
    assert.notEqual(localizeExpansionOutcome(result.message, locale), result.message);
  assert.equal(result.message, "Bir sakin tedavi gördü.");
  assert.deepEqual(act(importGame(exportGame(control)).state, "district:shift"), treated);
});

test("a paid specialist milestone deepens only a known coworker tie and can unlock advice", () => {
  const district = "ankara:altindag";
  const coworker = `resident:${district}`;
  const referral = `story:referral:${coworker}`;
  let s = workplace(district);
  s.expansion.institutions.qualifications.push({ course: "teaching", day: 1 });
  s = act(s, "district:apply:training");
  for (const id of [`district:visit:${district}:social`, `district:meet:${coworker}`, `story:listen:${coworker}`])
    s = act(ready(s, id), id);
  while (s.time < 2 * 1440 + 8 * 60) {
    const event = getActions(s).find((row) => row.category === "event" && !row.disabled);
    s = act(s, event?.id ?? "wait:60");
  }
  const visit = `district:visit:${district}:work`;
  s = act(ready(s, visit), visit);
  // Prepare just the milestone and the edge of the existing relationship threshold.
  s.player.energy = 90;
  s.expansion.districts.job.shifts = 4;
  const contacts = (state) => state.expansion.districts.contacts;
  const resident = (state) => state.expansion.economy.residents[coworker].life;
  const tomorrow = (state) => {
    const nextDay = (Math.floor(state.time / 1440) + 1) * 1440;
    while (state.time < nextDay) {
      const event = getActions(state).find((row) => row.category === "event" && !row.disabled);
      state = act(state, event?.id ?? "wait:60");
    }
    return state;
  };
  contacts(s)[coworker].score = 9;
  assert.equal(action(s, referral), undefined);
  const result = resolveAction(s, "district:shift");
  assert.ok(result.ok, result.message);
  const paid = result.state;
  assert.equal(localizeExpansionOutcome(result.message, "tr"), "İş arkadaşlığı güçlendi.");
  assert.equal(localizeExpansionOutcome(result.message, "en"), "Coworker bond grew.");
  assert.equal(localizeExpansionOutcome(result.message, "pl"), "Więź w pracy się wzmocniła.");
  assert.ok(paid.bank > s.bank);
  assert.equal(contacts(paid)[coworker].score, 11);
  assert.equal(contacts(paid)[coworker].lastDay, contacts(s)[coworker].lastDay);
  const reopened = importGame(exportGame(paid)).state;
  assert.equal(contacts(reopened)[coworker].score, 11);
  assert.equal(action(reopened, referral)?.disabled, false);
  assert.equal(act(reopened, referral).player.skills.knowledge, paid.player.skills.knowledge + 2);
  assert.deepEqual(act(importGame(exportGame(s)).state, "district:shift"), paid);
  const sixthShift = act(ready(tomorrow(paid), "district:shift"), "district:shift");
  assert.equal(sixthShift.expansion.districts.job.shifts, 6);
  assert.equal(contacts(sixthShift)[coworker].score, 11);

  const absent = structuredClone(s);
  resident(absent).health = 41;
  assert.equal(contacts(act(absent, "district:shift"))[coworker].score, 9);
  const stranger = structuredClone(s);
  delete contacts(stranger)[coworker];
  assert.equal(contacts(act(stranger, "district:shift"))[coworker], undefined);
  const subsequent = structuredClone(s);
  subsequent.expansion.districts.job.shifts = 9;
  assert.equal(contacts(act(subsequent, "district:shift"))[coworker].score, 9);
  const bankrupt = structuredClone(s);
  bankrupt.expansion.economy.firms[s.expansion.districts.job.firmId].cash = 0;
  assert.strictEqual(resolveAction(bankrupt, "district:shift").state, bankrupt);
  assert.equal(contacts(bankrupt)[coworker].score, 9);

  // Let the normal midnight settlement replace the resident of a prepared insolvent household.
  const dyingResident = structuredClone(s);
  const account = dyingResident.expansion.economy.residents[coworker];
  Object.assign(account, { cash: 0, savings: 0 });
  account.life.health = 0;
  const afterReplacement = tomorrow(dyingResident);
  assert.equal(resident(afterReplacement).generation, resident(s).generation + 1);
  assert.equal(contacts(afterReplacement)[coworker], undefined);
  const nextShift = act(ready(afterReplacement, "district:shift"), "district:shift");
  assert.equal(nextShift.expansion.districts.job.shifts, 5);
  assert.equal(contacts(nextShift)[coworker], undefined);

  // An actual player succession keeps the household and removes the founder's personal tie and contract.
  let estate = act(ready(paid, "family:reserve"), "family:reserve");
  estate = act(ready(estate, "family:adopt"), "family:adopt");
  const founder = estate.expansion.family.people.find((p) => p.id === estate.expansion.playerId);
  const heir = estate.expansion.family.people.find((p) => p.parents.includes(founder.id));
  const day = Math.floor(estate.time / 1440) + 1;
  heir.born = day - 23 * 30;
  founder.born = day + 1 - founder.lifespan * 30;
  for (const entry of estate.expansion.family.people) if (founder.parents.includes(entry.id)) {
    entry.born = founder.born - 24 * 30;
    entry.died ??= day;
  }
  const inherited = act(tomorrow(estate), `family:successor:${heir.id}`);
  assert.equal(inherited.expansion.playerId, heir.id);
  assert.equal(inherited.expansion.districts.job, null);
  assert.equal(contacts(inherited)[coworker], undefined);
  assert.equal(action(inherited, referral), undefined);
});

test("regional contracts follow the employer workweek and Istanbul stays open on weekends", () => {
  const weekend = 5 * 1440 + 10 * 60;
  const reach = (s, target) => {
    while (s.time < target || s.pendingEvents.length) {
      const event = getActions(s).find((row) => row.category === "event" && !row.disabled);
      s = act(s, event?.id ?? "wait:60");
    }
    // Isolate the workday gate with a rested worker, preserving the clock and accounts.
    s.player.energy = 90;
    return s;
  };
  for (const district of ["izmir:balcova", "kadikoy"]) {
    const application = "district:apply:customer-service";
    const s = reach(act(ready(workplace(district), application), application), weekend);
    const offer = action(s, "district:shift");
    if (district === "kadikoy") {
      assert.equal(offer.disabled, false, offer.reason);
      const worked = act(s, "district:shift");
      assert.ok(worked.bank > s.bank);
    } else {
      assert.equal(offer.disabled, true);
      assert.equal(offer.reason, "Bu işveren bugün vardiya yapmıyor.");
      assert.equal(translateExpansionAction(offer, "en").reason, "This employer has no shifts today.");
      assert.equal(translateExpansionAction(offer, "pl").reason, "Ten pracodawca nie ma dziś zmian.");
      const rejected = resolveAction(s, "district:shift");
      assert.equal(rejected.ok, false);
      assert.strictEqual(rejected.state, s);
      const monday = reach(s, weekend + 2 * 1440);
      assert.equal(action(monday, "district:shift").disabled, false);
      assert.ok(act(monday, "district:shift").bank > monday.bank);
    }
  }
});

test("a refreshed Foundation client cannot overwrite the promoted depth save", async () => {
  const directory = mkdtempSync(join(tmpdir(), "boardworld-depth-legacy-"));
  try {
    const foundation = "51552c6197cafe744c5084925f13541a1a0aacf2";
    const archive = spawnSync("git", ["archive", foundation, "public/games/tc-sim-boardworld"], { maxBuffer: 8e6 });
    assert.equal(archive.status, 0, archive.stderr?.toString());
    assert.equal(spawnSync("tar", ["-x", "-C", directory], { input: archive.stdout }).status, 0);
    const old = (name) => import(pathToFileURL(join(directory, "public/games/tc-sim-boardworld", name)).href);
    const [oldEngine, oldIo] = await Promise.all([old("engine.mjs"), old("persistence.mjs")]);
    await oldEngine.loadExpansionRuntime();
    const original = workplace("ankara:yenimahalle");
    const legacyBytes = oldIo.exportGame(original);
    const oldKey = "tariklab.boardworld.v7.living-world-3";
    const depthKey = "tariklab.boardworld.v7.living-depth";
    let slots = new Map([[oldKey, legacyBytes], [`${oldKey}.backup`, legacyBytes]]);
    let generation = 0;
    const locks = { request: (_key, callback) => callback() };
    const transact = (_storage, callback) => {
      const next = new Map(slots);
      const result = callback({ getItem: (key) => next.get(key) ?? null, setItem: (key, value) => next.set(key, value) }, generation);
      if (result.ok) { slots = next; generation++; }
      if (result.token) result.token.generation = generation;
      return result;
    };
    const stale = await oldIo.loadExpansionLocked(undefined, locks, transact);
    const loaded = await loadExpansionLocked(undefined, locks, transact);
    const started = act(loaded.state, "business:start:supplier");
    const saved = await saveExpansionLocked(started, undefined, loaded.token, locks, transact);
    const depthBytes = slots.get(depthKey);
    assert.ok(saved.ok && depthBytes);
    assert.equal(slots.get(oldKey), legacyBytes);
    assert.equal(slots.get(`${depthKey}.backup`), legacyBytes);
    assert.equal(oldIo.importGame(depthBytes).state, null);
    const wrongFormat = JSON.stringify({ ...JSON.parse(depthBytes), format: JSON.parse(legacyBytes).format });
    assert.equal(importGame(wrongFormat).state, null);
    assert.ok((await oldIo.saveExpansionLocked(stale.state, undefined, stale.token, locks, transact)).conflict);
    const refreshed = await oldIo.loadExpansionLocked(undefined, locks, transact);
    const legacyNext = oldEngine.resolveAction(refreshed.state, "wait:15");
    assert.ok(legacyNext.ok);
    assert.ok((await oldIo.saveExpansionLocked(legacyNext.state, undefined, refreshed.token, locks, transact)).ok);
    assert.equal(slots.get(depthKey), depthBytes);
    const resumed = await loadExpansionLocked(undefined, locks, transact);
    assert.deepEqual(resumed.state, started);
    const closed = act(resumed.state, "business:close");
    assert.ok((await saveExpansionLocked(closed, undefined, resumed.token, locks, transact)).ok);
    assert.deepEqual((await loadExpansionLocked(undefined, locks, transact)).state, closed);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('sector management exposes employee, pricing and stock actions from the same accounts', async () => {
  const {renderSectorBusiness} = await import('../public/games/tc-sim-boardworld/expansion-ui.mjs');
  const c = {name:'Tedarik atölyesi',capital:900,stock:3,workers:1,revenue:200,costs:400,wageDue:0,taxDue:0,order:{units:2,price:70}};
  const actions = [{id:'economy:hire',category:'enterprise'}, {id:'economy:price:85',category:'enterprise'}, {id:'business:stock:3',category:'business'}, {id:'district:apply',category:'work'}];
  const html=renderSectorBusiness({economy:{business:c}},actions,a=>`[${a.id}]`,String,String,'en');
  assert.match(html,/\[economy:hire\]/); assert.match(html,/\[economy:price:85\]/);
  assert.match(html,/\[business:stock:3\]/); assert.doesNotMatch(html,/\[district:apply\]/);
  assert.match(html,/Available buyer/); assert.match(html,/70/);
});
