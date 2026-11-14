import test from "node:test";
import assert from "node:assert/strict";
import * as engine from "../public/games/tc-sim-boardworld/engine.mjs";
import {
  getPlace,
  getDistrictSimulation,
  districtForLot,
  districtView,
  tickDistricts,
} from "../public/games/tc-sim-boardworld/expansion-districts.mjs";
import { exportGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
await engine.loadExpansionRuntime();
function clear(s) {
  while (s.pendingEvents.length) {
    const a = engine.getActions(s).find((a) => a.category === "event" && !a.disabled);
    assert.ok(a);
    s = step(s, a.id);
  }
  return s;
}
function step(s, id) {
  const before = JSON.stringify(s),
    r = engine.resolveAction(s, id);
  assert.equal(r.ok, true, `${id}: ${r.message}`);
  assert.equal(JSON.stringify(s), before);
  assert.ok(engine.validateState(r.state));
  return r.state;
}
function ready(s, id) {
  for (let i = 0; i < 30; i++) {
    s = clear(s);
    const a = engine.getActions(s).find((a) => a.id === id);
    if (a && !a.disabled) return s;
    s = step(s, "wait:60");
  }
  assert.fail(`Never available: ${id}`);
}
test("pure lazy place, canonical lots, and real travel resolver", () => {
  let s = clear(engine.createGame({ seed: 49, expansion: true }));
  const initial = exportGame(s);
  assert.equal(s.expansion.districts, undefined);
  districtView(s);
  engine.getActions(s);
  assert.equal(exportGame(s), initial);
  assert.equal(districtForLot("istanbul:studio"), "besiktas");
  assert.equal(districtForLot("ankara:room"), "ankara:kizilay");
  assert.equal(districtForLot("izmir:apartment"), "izmir:bornova");
  s = step(s, "world:move:ankara");
  assert.equal(getPlace(s).districtId, "ankara:kizilay");
  assert.equal(s.location, "kadikoy");
  assert.equal(s.expansion.districts, undefined);
  const action = "district:travel:ankara:cankaya";
  s = ready(s, action);
  const start = s.time,
    prior = structuredClone(s);
  const result = step(s, action);
  assert.equal(result.time - start, 45);
  assert.equal(getPlace(result).districtId, "ankara:cankaya");
  assert.equal(result.location, s.location);
  assert.deepEqual(step(prior, action), result);
  assert.equal(engine.resolveAction(result, action).ok, false);
});
test("work contract draws wages from a real employer after time passes", () => {
  let s = clear(engine.createGame({ seed: 49, expansion: true }));
  s = step(s, "world:move:ankara");
  const visit = "district:visit:ankara:kizilay:work";
  s = step(ready(s, visit), visit);
  s = step(ready(s, "district:apply"), "district:apply");
  const job = s.expansion.districts.job;
  assert.equal(job.firmId, "ankara:repair");
  s = ready(s, "district:shift");
  const money = s.bank,
    cash = s.expansion.economy.firms[job.firmId].cash;
  const n = step(s, "district:shift");
  assert.ok(n.bank > money);
  assert.ok(n.expansion.economy.firms[job.firmId].cash < cash);
  assert.equal(n.expansion.districts.job.shifts, 1);
  assert.ok(n.player.skills.craft > s.player.skills.craft);
  assert.equal(engine.getActions(n).find((a) => a.id === "district:shift")?.disabled, true);
});
test("calendar conflict rejects travel without charging or moving", () => {
  let s = clear(engine.createGame({ seed: 49, expansion: true }));
  s = step(s, "wait:60");
  const clockDay = Math.floor(s.time / 1440) + 1;
  const minute = Math.ceil(((s.time % 1440) + 120) / 30) * 30;
  const draft = {
    kind: "personal",
    npcId: "",
    subjectId: "rest",
    day: clockDay,
    minute,
    venue: "kadikoy-park",
    duration: 60,
    repeat: "none",
  };
  const booked = engine.resolveAction(s, "calendar:propose", draft);
  assert.equal(booked.ok, true, booked.message);
  s = booked.state;
  const bytes = JSON.stringify(s),
    result = engine.resolveAction(s, "world:move:ankara");
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result.state), bytes);
});
test("evening conversations use bounded persistent local relationships", () => {
  let s = clear(engine.createGame({ seed: 49, expansion: true }));
  s = step(s, "world:move:ankara");
  const visit = "district:visit:ankara:kizilay:social";
  s = step(ready(s, visit), visit);
  const meet = "district:meet:resident:ankara:0";
  s = ready(s, meet);
  const n = step(s, meet);
  assert.equal(n.expansion.districts.contacts["resident:ankara:0"].score, 5);
  assert.equal(districtView(n).contacts[0].name, "Deniz Aydın");
  assert.equal(engine.getActions(n).find((a) => a.id === meet).disabled, true);
  const invalid = structuredClone(n);
  invalid.expansion.districts.contacts["resident:ankara:0"].score = 101;
  assert.equal(engine.validateState(invalid), false);
});
test("deferred district presentation localizes actions and shows names", async () => {
  const { renderLiving, localizeLivingText } =
    await import("../public/games/tc-sim-boardworld/expansion-living-ui.mjs");
  const { getExpansionView } = await import("../public/games/tc-sim-boardworld/expansion.mjs");
  let s = clear(engine.createGame({ seed: 49, expansion: true }));
  s = step(s, "world:move:ankara");
  const actions = engine.getActions(s);
  for (const language of ["tr", "en", "pl"]) {
    const html = renderLiving({
      view: getExpansionView(s),
      actions,
      language,
      esc: (x) => String(x),
      actionCard: (a) => `<button>${localizeLivingText(a.label, language)}</button>`,
    });
    assert.match(html, /Kızılay/);
    assert.doesNotMatch(html, /ankara:kizilay/);
    if (language !== "tr") assert.doesNotMatch(html, /semtine git/);
  }
});
test("food vendor transfers meals and restocks using its own funds", () => {
  let s = clear(engine.createGame({ seed: 49, expansion: true }));
  s = step(s, "world:move:ankara");
  const visit = "district:visit:ankara:kizilay:social";
  s = step(ready(s, visit), visit);
  s = ready(s, "world:meal");
  const cost = engine.getActions(s).find((a) => a.id === "world:meal").cost;
  const firmStocks = Object.fromEntries(
    Object.entries(s.expansion.economy.firms).map(([id, f]) => [id, f.stock]),
  );
  const n = step(s, "world:meal");
  const vendor = n.expansion.districts.foodMarkets["ankara:kizilay"];
  assert.equal(vendor.stock, 11);
  assert.equal(vendor.cash, 1000 + cost);
  assert.deepEqual(
    Object.fromEntries(Object.entries(n.expansion.economy.firms).map(([id, f]) => [id, f.stock])),
    firmStocks,
  );
  let next = n;
  const oldDay = Math.floor(next.time / 1440);
  while (Math.floor(next.time / 1440) === oldDay) next = step(clear(next), "wait:60");
  const restocked = next.expansion.districts.foodMarkets["ankara:kizilay"];
  assert.equal(restocked.stock, 13);
  assert.equal(restocked.cash, vendor.cash - 60);
  assert.equal(restocked.wholesaleSpent, 60);
  const replay = structuredClone(next);
  tickDistricts(replay);
  assert.deepEqual(replay.expansion.districts.foodMarkets, next.expansion.districts.foodMarkets);
  const invalid = structuredClone(next);
  invalid.expansion.districts.foodMarkets["ankara:kizilay"].stock = -1;
  assert.equal(engine.validateState(invalid), false);
});

test("Istanbul conditions retain the existing society effects and stocks", () => {
  const s = clear(engine.createGame({ seed: 49, expansion: true }));
  const before = getDistrictSimulation(s, "kadikoy");
  const modified = structuredClone(s);
  modified.society.districts.kadikoy.weeklyDelta.demand += 3;
  modified.society.districts.kadikoy.weeklyDelta.rentPressure += 4;
  modified.society.districts.kadikoy.weeklyDelta.serviceDelay += 5;
  const after = getDistrictSimulation(modified, "kadikoy");
  assert.equal(after.demand, before.demand + 3);
  assert.equal(after.rentPressure, before.rentPressure + 4);
  assert.equal(after.serviceDelay, before.serviceDelay + 5);
  assert.equal(after.foodStock, modified.society.districts.kadikoy.foodStock);
  assert.equal(after.materialStock, modified.society.districts.kadikoy.materialStock);
});

test("prepared death-boundary fixture does not complete an intercity arrival", () => {
  let s = clear(engine.createGame({ seed: 49, expansion: true }));
  while (s.time % 1440 < 20 * 60) s = step(clear(s), "wait:60");
  // Rare branch: prepare an otherwise valid founder to die at the next day tick.
  const player = s.expansion.family.people.find((p) => p.id === s.expansion.playerId);
  player.born = Math.floor(s.time / 1440) + 2 - player.lifespan * 30;
  s.expansion.family.people.find((p) => p.id === player.parents[0]).born = player.born - 24 * 30;
  assert.equal(engine.validateState(s), true);
  const result = engine.resolveAction(s, "world:move:ankara");
  assert.equal(result.ok, true);
  assert.equal(result.state.expansion.world.region, "istanbul");
  assert.equal(
    result.state.expansion.family.people.find((p) => p.id === result.state.expansion.playerId).died,
    2,
  );
  assert.match(result.message, /eylem tamamlanmadı/);
  assert.equal(result.state._transit, undefined);
  assert.equal(engine.validateState(result.state), true);
});

test("prepared long-career fixture pays shifts at the bounded progress limit", () => {
  let base = clear(engine.createGame({ seed: 49, expansion: true }));
  base = step(base, "world:move:ankara");
  const visit = "district:visit:ankara:kizilay:work";
  base = step(ready(base, visit), visit);
  base = step(ready(base, "district:apply"), "district:apply");
  base = ready(base, "district:shift");
  // Prepared rare branch: only prior progression is changed; funds and time are earned normally.
  for (const shifts of [999, 1000]) {
    const fixture = structuredClone(base);
    fixture.expansion.districts.job.shifts = shifts;
    assert.equal(engine.validateState(fixture), true);
    const beforeBank = fixture.bank;
    const employer = fixture.expansion.districts.job.firmId;
    const beforeCash = fixture.expansion.economy.firms[employer].cash;
    const result = step(fixture, "district:shift");
    const paid = result.bank - beforeBank;
    assert.ok(paid > 0);
    assert.equal(beforeCash - result.expansion.economy.firms[employer].cash, paid);
    assert.equal(result.expansion.districts.job.shifts, 1000);
    assert.equal(result.expansion.districts.job.lastShiftDay, Math.floor(fixture.time / 1440) + 1);
    assert.equal(engine.getActions(result).find((a) => a.id === "district:shift").disabled, true);
  }
});
