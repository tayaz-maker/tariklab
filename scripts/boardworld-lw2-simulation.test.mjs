import assert from "node:assert/strict";
import test from "node:test";
import { createGame, getActions, loadExpansionRuntime, resolveAction, validateState } from
  "../public/games/tc-sim-boardworld/engine.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
import { DISTRICTS, routeBetween } from "../public/games/tc-sim-boardworld/expansion-geography.mjs";
import { getDistrictSimulation } from "../public/games/tc-sim-boardworld/expansion-districts.mjs";
import {
  economyView, getDistrictEmployers, migrateEconomy, regionalMarkets, tickEconomy, validateEconomy,
  underworldOrder, fulfillUnderworldOrder, localizeEconomyText,
} from "../public/games/tc-sim-boardworld/expansion-economy.mjs";
import { creditMunicipalTax } from "../public/games/tc-sim-boardworld/expansion-institutions.mjs";
import {
  migrateUnderworld, tickUnderworld, underworldDistrictModifiers, validateUnderworld,
} from "../public/games/tc-sim-boardworld/expansion-underworld.mjs";
import { tickRegions, validateWorld } from "../public/games/tc-sim-boardworld/expansion-world.mjs";

const runtime = await loadExpansionRuntime();
const DAY = 1440;
const MILLION = 1_000_000;
const today = (s) => Math.floor(s.time / DAY) + 1;
const economy = (s) => s.expansion.economy;
const create = () => createGame({ seed: 49, scenario: "restart", expansion: true });
const active = (s) => Object.values(regionalMarkets(s, true)).flatMap(({ residents }) => residents);
const api = {
  dayOf: today,
  getDistrictSimulation,
  underworldOrder,
  fulfillUnderworldOrder,
  creditMunicipalTax,
  expansionEvent: runtime.expansionEvent,
  change() {},
  log() {},
  news() {},
};
function midnight(s) {
  s.time = today(s) * DAY;
  tickEconomy(s, api);
  if ((today(s) - s.expansion.world.startedDay) % 30 === 0)
    tickRegions(s, api, regionalMarkets(s));
  tickUnderworld(s, api);
}
function ready(s, id) {
  for (let tries = 0; tries < 28; tries++) {
    const actions = getActions(s);
    if (actions.some((a) => a.id === id && !a.disabled)) return s;
    const event = actions.find((a) => !a.disabled && a.id.startsWith("event:"));
    const rest = actions.find((a) => s.player.energy < 25 && !a.disabled &&
      ["rest", "world:rest"].includes(a.id));
    const next = resolveAction(s, event?.id ?? rest?.id ?? "wait:60");
    assert.equal(next.ok, true, next.message);
    s = next.state;
  }
  return assert.fail(`Action never available: ${id}`);
}

test("all districts have a funded employer, a finite local title, and active resident life", () => {
  const state = create();
  const original = exportGame(state);
  const residents = active(state);
  const properties = economyView(state).properties;
  assert.equal(DISTRICTS.length, 31);
  for (const { id } of DISTRICTS) {
    const employers = getDistrictEmployers(state, id);
    assert.ok(employers.some(({ firm, vacancies }) => firm.cash > 0 && vacancies > 0), id);
    assert.ok(properties.some(({ districtId, value }) => districtId === id && value > 0), id);
    if (!["kadikoy", "besiktas", "sisli"].includes(id))
      assert.ok(residents.some(({ districtId, employer }) => districtId === id && employer), id);
  }
  assert.equal(exportGame(state), original, "computed local detail has no simulation side effects");
});

test("legacy economy and organization upgrades preserve all prior accounts and do not settle", () => {
  const legacy = create();
  midnight(legacy);
  const old = economy(legacy);
  delete legacy.expansion.livingWorld;
  delete old.activity;
  for (const field of ["properties", "residents", "firms"])
    for (const id of Object.keys(old[field]))
      if (id.split(":").length !== (field === "residents" ? 3 : 2) ||
          (field === "residents" && !/^resident:(ankara|izmir):[0-2]$/.test(id)))
        delete old[field][id];
  delete legacy.expansion.underworld.territory;
  for (const chapter of Object.values(legacy.expansion.underworld.chapters)) delete chapter.ledger.outreach;
  assert.equal(validateEconomy(legacy), true);
  assert.equal(validateUnderworld(legacy), true);
  legacy.expansion.livingWorld = 2;
  assert.equal(validateEconomy(legacy), false);
  assert.equal(validateUnderworld(legacy), false);
  delete legacy.expansion.livingWorld;
  const baseline = structuredClone(legacy.expansion);
  migrateEconomy(legacy);
  migrateUnderworld(legacy);
  for (const field of ["properties", "residents", "firms"])
    for (const [id, account] of Object.entries(baseline.economy[field]))
      assert.deepEqual(economy(legacy)[field][id], account, id);
  for (const [id, chapter] of Object.entries(baseline.underworld.chapters))
    assert.deepEqual(legacy.expansion.underworld.chapters[id], {
      ...chapter, ledger: { ...chapter.ledger, outreach: 0 },
    });
  assert.deepEqual(legacy.expansion.events, baseline.events);
  const upgraded = structuredClone(legacy);
  migrateEconomy(legacy);
  migrateUnderworld(legacy);
  tickEconomy(legacy, api);
  tickUnderworld(legacy, api);
  assert.deepEqual(legacy, upgraded);
});

test("player travel changes NPC detail without transferring NPC assets or repeating NPC activity", () => {
  let state = create();
  const destination = "istanbul:umraniye";
  const id = `district:travel:${destination}`;
  state = ready(state, id);
  const before = structuredClone(economy(state));
  const resident = `resident:${destination}`;
  const external = active(state).find((row) => row.id === resident);
  assert.equal(external.locationId, null);
  state = resolveAction(state, id).state;
  // A district journey wholly inside a day changes presence detail, not the economy's midnight ledger.
  assert.deepEqual(economy(state), before);
  const local = active(state).find((row) => row.id === resident);
  for (const key of ["cash", "savings", "debt", "employer", "generation", "home", "history", "contacts"])
    assert.deepEqual(local[key], external[key], key);
  const checkpoint = importGame(exportGame(state)).state;
  assert.ok(checkpoint);
  assert.equal(validateState(checkpoint), true);
  const wait = ready(checkpoint, "wait:60");
  assert.deepEqual(resolveAction(wait, "wait:60").state,
    resolveAction(structuredClone(wait), "wait:60").state);
});

test("home actions and care follow the signed district lease through travel and reload", () => {
  const district = "istanbul:uskudar";
  const lotId = `${district}:room`;
  let state = create();
  const act = (id) => {
    const result = resolveAction(ready(state, id), id);
    assert.ok(result.ok, result.message);
    state = result.state;
  };
  act(`district:travel:${district}`);
  act(`district:visit:${district}:work`);
  act("district:apply");
  // Fund the deposit through actual shifts and keep that local contract while travelling.
  while (state.cash + state.bank < 9300) act("district:shift");
  act(`economy:rent:${lotId}`);
  const contract = structuredClone(state.expansion.districts.job);
  assert.equal(economy(state).home, lotId);
  assert.ok(getActions(state).some(({ id }) => id === "household:buy:kitchen"));
  assert.ok(!getActions(state).some(({ id }) => /^(move:|household:lease$|household:invite:)/.test(id)));

  const groceries = state.inventory.groceries;
  act("cook");
  assert.equal(state.inventory.groceries, groceries - 1);
  assert.ok(state.player.hunger > 60);
  act("district:travel:besiktas");
  for (const id of ["sleep", "cook", "household:buy:kitchen"]) {
    const action = getActions(state).find((row) => row.id === id);
    assert.equal(action.disabled, true);
    assert.match(action.reason, /Üsküdar/);
    assert.match(localizeEconomyText(action.reason, "en"), /Return home.*Üsküdar/);
    assert.match(localizeEconomyText(action.reason, "pl"), /Wróć do domu.*Üsküdar/);
    assert.equal(resolveAction(state, id).state, state);
  }
  const careSetup = structuredClone(state);
  careSetup.player.hunger = 30;
  careSetup.player.energy = 65;
  const care = resolveAction(careSetup, "flow:care");
  assert.equal(care.ok, true, care.message);
  assert.equal(care.actions[0], `district:travel:${district}`);
  assert.equal(care.actions[1], "cook");
  assert.equal(care.state.expansion.districts.place.districtId, district);
  assert.deepEqual(care.state.expansion.districts.job, contract);

  act(`district:travel:${district}`);
  assert.equal(getActions(state).find(({ id }) => id === "sleep")?.disabled, false);
  const before = state;
  act("sleep");
  assert.ok(state.time >= before.time + 480);
  assert.ok(state.player.energy > before.player.energy);
  assert.equal(economy(state).home, lotId);
  assert.deepEqual(state.expansion.districts.job, contract);
  assert.deepEqual(importGame(exportGame(state)).state, state);
});

test("routine consent binds the active property and protects its next rent boundary", () => {
  const lotId = "istanbul:uskudar:room";
  let state = ready(create(), "district:travel:istanbul:uskudar");
  state = resolveAction(state, "district:travel:istanbul:uskudar").state;
  state.bank = 30000;
  state = resolveAction(ready(state, `economy:rent:${lotId}`), `economy:rent:${lotId}`).state;
  // Place the next rent before an ordinary sleep/care window without changing the terms.
  while (state.time % DAY < 1380) {
    const result = resolveAction(ready(state, "wait:60"), "wait:60");
    assert.ok(result.ok, result.message);
    state = result.state;
  }
  state.player.energy = 42;
  state.player.hunger = 85;
  state = ready(state, "flow:care");
  const payment = economy(state).properties[lotId].lease;
  payment.dueDay = today(state) + 1;
  const baseline = state;
  const review = resolveAction(baseline, "flow:care");
  assert.ok(review.ok, review.message);
  assert.equal(review.state.time, baseline.time);
  assert.equal(review.state.flow.stop.code, "payment");
  assert.equal(review.state.bank, baseline.bank);
  assert.deepEqual(economy(review.state).properties[lotId].lease, payment);

  const consent = resolveAction(baseline, "flow:payments:authorized").state;
  assert.match(consent.flow.consent.propertyTerms, /istanbul:uskudar:room/);
  const reloaded = importGame(exportGame(consent)).state;
  const authorized = resolveAction(reloaded, "flow:care");
  assert.ok(authorized.ok);
  assert.ok(authorized.state.time > baseline.time);
  assert.equal(economy(authorized.state).properties[lotId].lease.dueDay, payment.dueDay + 30);
  assert.equal(baseline.bank - authorized.state.bank, payment.rent);

  const changed = resolveAction(consent, `economy:leave:${lotId}`);
  assert.ok(changed.ok);
  assert.equal(changed.state.flow.settlements, "review");
  assert.equal(changed.state.flow.consent, null);
});

test("impoverished residents can transfer an estate and pay down inherited debt", () => {
  const state = create();
  const id = "resident:ankara:0";
  const n = economy(state).residents[id];
  const lot = economy(state).properties["ankara:room"];
  lot.owner = id;
  Object.assign(n, { cash: 0, savings: 0, debt: 1000 });
  n.life.health = 1;
  const before = { cash: n.cash, savings: n.savings, born: n.life.born, generation: n.life.generation };
  midnight(state);
  assert.notEqual(n.life.born, before.born);
  assert.equal(n.life.generation, before.generation + 1);
  assert.ok(n.life.health > 80);
  assert.ok(n.debt >= 1000 && n.debt < 1100);
  assert.equal(n.cash, before.cash);
  assert.equal(n.savings, before.savings);
  assert.equal(lot.owner, id);
  assert.ok(economy(state).activity[id].history.some(({ kind }) => kind === "death"));
  const inheritedDebt = n.debt;
  for (let day = 0; day < 30; day++) midnight(state);
  assert.equal(n.life.generation, before.generation + 1);
  assert.ok(n.life.employer && n.cash > 0);
  assert.ok(n.debt < inheritedDebt);
  assert.equal(lot.owner, id);
  assert.equal(validateEconomy(state), true);
});

test("72 simulated years preserve bounded balances, estates, rival territory and deterministic replay", (t) => {
  const state = create();
  const clone = structuredClone(state);
  const tenure = new Set();
  const links = new Set();
  const moved = new Set();
  const visited = new Set();
  const territories = new Set();
  let gained = 0, lost = 0, adjudications = 0;
  const initialPrices = new Map(economyView(state).properties.map((lot) => [lot.id, lot.value]));
  const lastInfluence = new Set();
  let sales = 0;
  for (let day = 1; day <= 72 * 30; day++) {
    if (day === 1) for (const timeline of [state, clone]) {
      const { ankara, izmir } = timeline.expansion.world.regions;
      Object.assign(ankara, { employment: 60, price: 150 });
      Object.assign(izmir, { employment: 140, price: 65 });
      economy(timeline).firms["izmir:repair"].workers = 3;
    }
    midnight(state);
    midnight(clone);
    for (const [id, profile] of Object.entries(economy(state).activity)) {
      const resident = economy(state).residents[id];
      if (resident.life.generation > 1) tenure.add(id);
      if (Object.keys(profile.contacts).length) links.add(id);
      if (profile.history.some(({ kind }) => kind === "move")) moved.add(id);
      if (profile.trip) {
        visited.add(profile.trip.districtId);
        const route = routeBetween(state, profile.districtId, profile.trip.districtId, {
          actor: "npc", at: state.time + 17 * 60,
        });
        assert.ok(route.available && route.cost > 0);
      }
    }
    const x = state.expansion.underworld;
    const now = new Set();
    for (const [chapter, network] of Object.entries(x.territory)) {
      for (const district of Object.keys(network)) {
        now.add(`${chapter}/${district}`);
        territories.add(district);
      }
    }
    for (const edge of now) if (!lastInfluence.has(edge)) gained++;
    for (const edge of lastInfluence) if (!now.has(edge)) lost++;
    lastInfluence.clear();
    for (const edge of now) lastInfluence.add(edge);
    adjudications = Math.max(adjudications, x.cases.filter(({ decidedAt }) => decidedAt !== null).length);
    if (day % 90 !== 0) continue;
    assert.deepEqual(state.expansion, clone.expansion);
    assert.ok(validateEconomy(state) && validateUnderworld(state) && validateWorld(state));
    assert.ok(Object.values(economy(state).residents).every(({ cash, savings, debt }) =>
      [cash, savings, debt].every((amount) => amount >= 0 && amount <= 1000 * MILLION)));
    for (const meta of Object.values(economy(state).activity)) {
      assert.ok(meta.history.length <= 8);
      assert.ok(Object.keys(meta.contacts).length <= 6);
    }
    assert.ok(state.expansion.events.length <= 240);
    assert.ok(x.incidents.length <= 32 && x.memberships.length === 0);
    sales = Object.values(x.chapters).reduce((sum, chapter) => sum + chapter.ledger.sales, 0);
  }
  assert.ok(tenure.size > 15, "residents age and transfer estates");
  assert.ok(links.size > 12, "residents form independent relationships");
  assert.ok(moved.size > 0, "poor local job opportunities can cause intercity migration");
  assert.ok(visited.size > 12, "remote residents make reachable trips");
  assert.ok(territories.size > 12 && gained > 40 && lost > 40, "funded district presence expands and recedes");
  assert.ok(adjudications > 0 && sales > 0);
  assert.ok(Object.values(state.expansion.underworld.chapters).every(({ ledger }) => ledger.outreach > 0));
  assert.ok(DISTRICTS.some(({ id }) => underworldDistrictModifiers(state, id).influence > 0));
  assert.ok(economyView(state).properties.some((lot) => initialPrices.get(lot.id) !== lot.value));
  const bytes = Buffer.byteLength(JSON.stringify(state.expansion));
  assert.ok(bytes < 240000);
  t.diagnostic(JSON.stringify({
    days: 2160, districts: DISTRICTS.length, bytes, estates: tenure.size,
    socialConnections: links.size, intercityMoves: moved.size, districtsVisited: visited.size,
    territoryDistricts: territories.size, gained, lost, adjudications, sales,
  }));
  const forged = structuredClone(state);
  const chapter = Object.keys(forged.expansion.underworld.territory)[0];
  forged.expansion.underworld.territory[chapter]["ankara:sincan"] = 20;
  assert.equal(validateUnderworld(forged), false);
});
