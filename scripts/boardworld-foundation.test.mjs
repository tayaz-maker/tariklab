import test from "node:test";
import assert from "node:assert/strict";
import { createGame, getActions, getIntentActions, loadExpansionRuntime, resolveAction, validateState } from "../public/games/tc-sim-boardworld/engine.mjs";
import { DISTRICTS } from "../public/games/tc-sim-boardworld/expansion-geography.mjs";
import { economyHomeDistrict } from "../public/games/tc-sim-boardworld/expansion-economy.mjs";
import { getLifePathCopy, getLifePathView, LIFE_PATHS } from "../public/games/tc-sim-boardworld/expansion-life-paths.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
import { chooseLanguage } from "../public/games/tc-sim-boardworld/i18n.mjs";

const runtime = await loadExpansionRuntime();
const place = (state) => runtime.getExpansionView(state).districts.place;
const balance = (state) => state.cash + state.bank;
const fresh = (startingDistrict, lifePath = "ordinary") => createGame({ startingDistrict, lifePath, expansion: true });

function play(state, id) {
  const result = resolveAction(state, id);
  assert.ok(result.ok, `${place(state).districtId} · ${id} · ${result.message}`);
  return result.state;
}

function visit(state, venueId) {
  const action = getActions(state).find((row) => row.venue === venueId || row.id === `district:visit:${venueId}`);
  assert.ok(action, `No player action for ${venueId}`);
  return play(state, action.id);
}

function roundTrip(state) {
  const loaded = importGame(exportGame(state));
  assert.ok(loaded.state, loaded.message);
  assert.deepEqual(loaded.state, state);
  return loaded.state;
}

test("each of the 31 starting districts has a real lease, a workday, transport and a reloadable position", () => {
  assert.equal(DISTRICTS.length, 31);
  for (const { id, regionId } of DISTRICTS) {
    const original = fresh(id);
    assert.ok(validateState(original), id);
    assert.equal(original.time, 480, id);
    assert.equal(place(original).districtId, id);
    assert.equal(place(original).regionId, regionId);
    assert.equal(economyHomeDistrict(original), id);
    const lease = original.expansion.economy.properties[original.expansion.economy.home].lease;
    assert.ok(lease.rent > 0, id);
    assert.equal(lease.deposit, 0, id);
    assert.ok(getLifePathView(original).contact, id);
    assert.ok(getActions(original).some((action) => action.id === "cook" && !action.disabled), id);
    assert.ok(getActions(original).some((action) => action.id === "sleep" && !action.disabled), id);
    let state = roundTrip(original);
    const { target } = getLifePathView(state);
    state = visit(state, target.venueId);
    assert.equal(place(state).venueId, target.venueId);
    state = play(state, "district:apply");
    assert.equal(state.expansion.districts.job.districtId, id);
    assert.ok(getLifePathView(state).completed, id);
    const earned = state.bank;
    state = play(state, "district:shift");
    assert.equal(state.flags.workDays, 1, id);
    assert.ok(state.bank > earned, id);
    const trip = getActions(state).find((action) => !action.disabled &&
      (action.id.startsWith("district:travel:") || (action.category === "travel" && action.destination !== id && !action.venue)));
    assert.ok(trip && trip.cost > 0 && trip.minutes > 0, id);
    const arrived = play(state, trip.id);
    assert.notEqual(place(arrived).districtId, id);
    assert.equal(arrived.time, state.time + trip.minutes, id);
    assert.equal(balance(arrived), balance(state) - trip.cost, id);
    assert.equal(economyHomeDistrict(arrived), id);
    roundTrip(arrived);
  }
});

test("six ambitions use regular gameplay actions and changing ambition preserves the opening background", async () => {
  const newcomer = fresh("ankara:mamak", "freeform");
  assert.equal(getLifePathView(newcomer).firstActionIds.length, 0);
  assert.equal(getLifePathView(newcomer).contact, null);
  assert.equal(place(visit(newcomer, "ankara:mamak:work")).venueId, "ankara:mamak:work");
  for (const lang of ["tr", "en", "pl"]) {
    await chooseLanguage(lang);
    for (const id of LIFE_PATHS) {
      const guide = getLifePathCopy(id, lang);
      assert.ok(guide.title && guide.objective && guide.advantage && guide.drawback && guide.goal);
      if (lang !== "tr") assert.notEqual(guide.objective, getLifePathCopy(id, "tr").objective);
    }
  }
  const proprietor = fresh("ankara:mamak", "businessperson");
  assert.ok(balance(proprietor) < balance(newcomer));
  assert.equal(proprietor.deep.business, null);
  const opened = play(proprietor, "business:start:repair");
  assert.ok(balance(opened) < balance(proprietor));
  assert.equal(opened.expansion.economy.business.districtId, "ankara:mamak");
  assert.ok(getLifePathView(opened).completed);
  const reassessed = play(opened, "life-path:choose:professional");
  assert.equal(reassessed.time, opened.time);
  assert.deepEqual(reassessed.player, opened.player);
  assert.equal(balance(reassessed), balance(opened));
  assert.deepEqual(reassessed.expansion.economy, opened.expansion.economy);
  assert.deepEqual(reassessed.expansion.lifePath.completed, opened.expansion.lifePath.completed);
  const studied = play(reassessed, "practice:knowledge");
  assert.ok(studied.player.skills.knowledge > reassessed.player.skills.knowledge);
  assert.ok(getLifePathView(studied).completed);
  const backToBusiness = play(studied, "life-path:choose:businessperson");
  assert.equal(getLifePathView(roundTrip(backToBusiness)).origin, "businessperson");
  assert.ok(getLifePathView(backToBusiness).completed);
  const pending = play(fresh("kadikoy", "businessperson"), "business:start:repair");
  assert.ok(pending.pendingEvents.length);
  const revised = play(pending, "life-path:choose:freeform");
  assert.deepEqual(revised.pendingEvents, pending.pendingEvents);
  assert.equal(revised.time, pending.time);

  const professional = fresh("izmir:buca", "professional");
  assert.ok(professional.player.skills.knowledge > newcomer.player.skills.knowledge);
  assert.ok(getLifePathView(play(professional, "practice:knowledge")).completed);

  let social = fresh("izmir:karsiyaka", "social-climber");
  const acquaintance = getLifePathView(social).contact.id;
  social = play(social, "wait:60");
  social = visit(social, getLifePathView(social).target.venueId);
  while (social.time < 1080) social = play(social, "wait:15");
  const friendship = social.expansion.districts.contacts[acquaintance].score;
  social = play(social, `district:meet:${acquaintance}`);
  assert.ok(getLifePathView(social).completed);
  assert.ok(social.expansion.districts.contacts[acquaintance].score > friendship);

  let gangster = fresh("ankara:mamak", "gangster");
  assert.equal(balance(gangster), balance(newcomer));
  assert.equal(gangster.expansion.underworld?.memberships.length ?? 0, 0);
  const lead = getLifePathView(gangster);
  gangster = play(gangster, `district:travel:${lead.target.districtId}`);
  gangster = play(gangster, "wait:60");
  gangster = visit(gangster, lead.target.venueId);
  gangster = play(gangster, lead.firstActionIds[0]);
  assert.ok(getLifePathView(gangster).completed);
  assert.equal(gangster.expansion.underworld.memberships.length, 0);
  gangster = play(gangster, lead.firstActionIds[0].replace(":recruit:", ":join:"));
  assert.equal(gangster.expansion.underworld.memberships[0].rank, 0);
  assert.equal(gangster.expansion.underworld.cases.length, 0);
});

test("malformed setup is rejected and legacy expansion saves retain their original state", () => {
  assert.throws(() => fresh("bogus"), TypeError);
  assert.throws(() => fresh("kadikoy", "bogus"), TypeError);
  const original = createGame({ scenario: "restart", expansion: true });
  const restored = roundTrip(original);
  assert.equal(restored.player.scenario, "restart");
  assert.equal(place(restored).districtId, "kadikoy");
  assert.equal(restored.expansion.lifePath, undefined);
  assert.equal(restored.pendingEvents[0].id, "welcome");
});

test("the World intent filter separates current actions from their travel destinations", () => {
  const state = fresh("ankara:mamak");
  const at = (location, query = "") => getIntentActions(state, { location, query }).map(({ id }) => id);
  assert.ok(at("ankara:mamak", "bekle").includes("wait:15"));
  assert.deepEqual(at("izmir:konak", "bekle"), []);
  assert.ok(at("ankara:cankaya").includes("district:travel:ankara:cankaya"));
  assert.ok(at("izmir:konak").includes("world:move:izmir"));
  assert.ok(!at("izmir:gaziemir").includes("world:move:izmir"));
});
