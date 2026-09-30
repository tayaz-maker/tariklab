import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dispatch, advance, getRates, getTravelEstimate, getFaction, getPointReassignment, validateState } from '../public/games/hanedanian/engine.js';
import { getTile } from '../public/games/hanedanian/world.js';
import { pointBrief, routeBrief, incomingThreats, decisionBrief, relationMarks } from '../public/games/hanedanian/mapintel.js';
import { previewOrder } from '../public/games/hanedanian/orders.js';
import { encodeSave, decodeSave } from '../public/games/hanedanian/save.js';

function fixture() {
  const state = createGame({ seed: 'TL-ULTRA-LOGISTICS', size: 49, aiCount: 1 });
  state.settings.autoPause = false;
  state.campaign.stage = 5; // Isolate transfer cost from unrelated first-time stage rewards.
  state.factions[1].nextThink = 1000000;
  const old = state.settlements[0];
  const town = { ...structuredClone(old), id: 'town-transfer', x: old.x - 3, name: 'Demir Yurdu' };
  town.buildings.mine = 3;
  state.settlements.push(town);
  const point = getTile(state.world, old.x - 2, old.y - 3);
  point.poi.ownerId = state.playerId;
  point.poi.settlementId = old.id;
  return { state, old, town, point };
}
const action = ({ town, point }) => ({ type: 'reassign', settlementId: town.id, x: point.x, y: point.y });
function run(state, minutes) { state.paused = false; assert.equal(advance(state, minutes).advanced, minutes); }
function valid(state) { const result = validateState(state); assert.equal(result.ok, true, result.errors.join('; ')); }

test('POI contribution stays in the old town until a paid courier arrives, then moves exactly once', () => {
  const f = fixture(), { state, old, town, point } = f;
  const oldRate = getRates(state, old).iron, newRate = getRates(state, town).iron;
  const influence = getFaction(state).influence, resources = structuredClone(town.resources), troops = structuredClone(town.troops);
  const before = JSON.stringify(state), brief = pointBrief(state, town, point.x, point.y);
  const preview = previewOrder(state, action(f));
  assert.equal(JSON.stringify(state), before, 'brief and preview are read-only');
  assert.equal(brief.canReassign, true);
  assert.equal(brief.currentBinding.id, old.id);
  assert.deepEqual(preview.cost, { influence: 5 });
  assert.equal(preview.outcome.rebind, true);
  assert.equal(dispatch(state, action(f)).ok, true);
  const courier = state.armies.at(-1), arrival = courier.arriveAt;
  assert.equal(getFaction(state).influence, influence - 5);
  assert.deepEqual(town.resources, resources);
  assert.deepEqual(town.troops, troops);
  assert.equal(arrival - state.time, brief.minutes);
  assert.equal(arrival, preview.outcome.arriveAt);
  valid(state);
  run(state, arrival - 1);
  assert.equal(point.poi.settlementId, old.id);
  assert.equal(getRates(state, old).iron, oldRate);
  assert.equal(getRates(state, town).iron, newRate);
  run(state, 1);
  assert.equal(point.poi.settlementId, town.id);
  assert.ok(getRates(state, old).iron < oldRate);
  assert.ok(Math.abs((oldRate - getRates(state, old).iron) * 60 - brief.currentContributionPerHour) < 1e-10);
  assert.ok(Math.abs((getRates(state, town).iron - newRate) * 60 - brief.resourceDeltaPerHour) < 1e-10);
  assert.equal(courier.influenceCost, 0);
  assert.equal(courier.returning, true);
  run(state, courier.arriveAt - state.time);
  assert.equal(state.armies.length, 0);
  assert.equal(getFaction(state).influence, influence - 5, 'successful transfer does not refund or repeat claim rewards');
  valid(state);
});

test('duplicate, unavailable, out-of-range and capacity-reserved transfers never spend partially', () => {
  for (const setup of [
    f => { f.point.poi.ownerId = null; f.point.poi.settlementId = null; },
    f => { f.point.poi.settlementId = f.town.id; },
    f => { f.town.x = 1; },
    f => { getFaction(f.state).influence = 4; },
    f => { assert.equal(dispatch(f.state, action(f)).ok, true); },
    f => {
      const other = f.state.world.tiles.filter(t => t.poi && t !== f.point).slice(0, 4);
      for (const tile of other) { tile.poi.ownerId = f.state.playerId; tile.poi.settlementId = f.town.id; }
    },
  ]) {
    const f = fixture(); setup(f);
    const before = JSON.stringify(f.state);
    assert.equal(getPointReassignment(f.state, f.town, f.point).ok, false);
    assert.equal(pointBrief(f.state, f.town, f.point.x, f.point.y).canReassign, false);
    assert.equal(dispatch(f.state, action(f)).ok, false);
    assert.equal(JSON.stringify(f.state), before);
  }
  const f = fixture();
  const bound = f.state.world.tiles.filter(t => t.poi && t !== f.point).slice(0, 3);
  for (const tile of bound) { tile.poi.ownerId = f.state.playerId; tile.poi.settlementId = f.town.id; }
  const another = getTile(f.state.world, f.old.x + 2, f.old.y + 1);
  another.poi.ownerId = f.state.playerId; another.poi.settlementId = f.old.id;
  assert.equal(dispatch(f.state, action(f)).ok, true);
  assert.equal(dispatch(f.state, { ...action(f), x: another.x, y: another.y }).ok, false, 'courier reserves final fourth slot');
});

test('recall refunds on return only; ownership or capacity changes cancel instead of capturing', () => {
  for (const mode of ['recall', 'owner', 'capacity', 'binding', 'point-id', 'home-owner']) {
    const f = fixture(), { state, old, town, point } = f;
    const influence = getFaction(state).influence;
    assert.equal(dispatch(state, action(f)).ok, true);
    const courier = state.armies.at(-1);
    if (mode === 'recall') assert.equal(dispatch(state, { type: 'recall', armyId: courier.id }).ok, true);
    if (mode === 'owner') { point.poi.ownerId = state.factions[1].id; point.poi.settlementId = state.settlements[1].id; }
    if (mode === 'binding') point.poi.settlementId = town.id;
    if (mode === 'point-id') point.poi.id = 'different-point';
    if (mode === 'home-owner') town.ownerId = state.factions[1].id;
    if (mode === 'capacity') {
      for (const tile of state.world.tiles.filter(t => t.poi && t !== point).slice(0, 4)) { tile.poi.ownerId = state.playerId; tile.poi.settlementId = town.id; }
    }
    const expectedOwner = point.poi.ownerId, expectedBinding = point.poi.settlementId;
    assert.equal(getFaction(state).influence, influence - 5);
    run(state, courier.arriveAt - state.time);
    if (mode !== 'recall') {
      assert.equal(getFaction(state).influence, influence - 5, `${mode}: refund waits for return`);
      assert.equal(courier.returning, true);
      run(state, courier.arriveAt - state.time);
    }
    assert.equal(point.poi.ownerId, expectedOwner, mode);
    assert.equal(point.poi.settlementId, expectedBinding, mode);
    assert.equal(getFaction(state).influence, influence, `${mode}: exact refund`);
    assert.equal(state.armies.length, 0);
    run(state, 20);
    assert.equal(getFaction(state).influence, influence, `${mode}: no duplicate refund`);
    valid(state);
  }
});

test('normal claims respect the fourth slot reserved by a courier or another normal claim', () => {
  for (const first of ['reassign', 'claim']) {
    const f = fixture(), { state, town, point } = f;
    const bound = state.world.tiles.filter(t => t.poi && t !== point && Math.hypot(t.x - town.x, t.y - town.y) > 7).slice(0, 3);
    assert.equal(bound.length, 3);
    for (const tile of bound) { tile.poi.ownerId = state.playerId; tile.poi.settlementId = town.id; }
    const neutral = state.world.tiles.filter(t => t.poi && !t.poi.ownerId && Math.hypot(t.x - town.x, t.y - town.y) <= 7);
    assert.ok(neutral.length >= 2);
    const claim = (tile, count) => ({ type: 'claim', settlementId: town.id, x: tile.x, y: tile.y, troops: { spear: count } });
    assert.equal(dispatch(state, first === 'reassign' ? action(f) : claim(neutral[0], 3)).ok, true);
    const before = JSON.stringify(state);
    assert.equal(dispatch(state, claim(neutral[1], 2)).ok, false, `${first}: fourth slot is already reserved`);
    assert.equal(JSON.stringify(state), before, `${first}: no troop or influence spend`);
    assert.equal(dispatch(state, { type: 'recall', armyId: state.armies[0].id }).ok, true);
    assert.equal(dispatch(state, claim(neutral[1], 2)).ok, true, `${first}: a returning expedition releases its reservation`);
    valid(state);
  }
});

test('old saves and ordinary ongoing claims remain valid; courier save/reload resolves identically', () => {
  const f = fixture(), { state, town } = f;
  const oldSave = decodeSave(encodeSave(state, 1)).state;
  assert.equal(oldSave.schemaVersion, 1);
  assert.deepEqual(oldSave, state);
  const claim = getTile(state.world, 26, 25);
  assert.equal(dispatch(state, { type: 'claim', settlementId: town.id, x: claim.x, y: claim.y, troops: { spear: 4 } }).ok, true);
  assert.equal(state.armies[0].rebind, undefined);
  valid(decodeSave(encodeSave(state, 2)).state);
  assert.equal(dispatch(state, action(f)).ok, true);
  const restored = decodeSave(encodeSave(state, 3)).state;
  run(state, 150); run(restored, 150);
  assert.deepEqual(restored, state);
  valid(restored);
});

test('malformed courier metadata cannot convert another mission or mint a refund', () => {
  const f = fixture();
  assert.equal(dispatch(f.state, action(f)).ok, true);
  for (const mutate of [
    a => { a.rebind = false; }, a => { a.rebind = 'true'; }, a => { a.rebind = -1; },
    a => { a.mission = 'trade'; }, a => { a.influenceCost = 500; }, a => { a.influenceCost = -5; },
    a => { a.rebindFromId = 'missing'; }, a => { a.pointId = ''; },
    a => { a.troops.spear = 1; }, a => { a.cargo.iron = 1; }, a => { delete a.rebind; },
  ]) {
    const broken = structuredClone(f.state); mutate(broken.armies[0]);
    assert.equal(validateState(broken).ok, false);
    assert.throws(() => encodeSave(broken, 1));
  }
});

test('roads, pass control and watchtowers explain actual travel and sight without invented ambush odds', () => {
  const f = fixture(), { state, town, point } = f;
  const before = JSON.stringify(state);
  const route = routeBrief(state, town, 42, 30, { scout: 2 });
  const estimate = getTravelEstimate(state, town, { x: 42, y: 30 }, { scout: 2 });
  assert.equal(route.minutes, estimate.minutes);
  assert.equal(route.terrainFactor, estimate.terrainFactor);
  assert.equal(route.distance, estimate.distance);
  assert.ok(route.unobservedTiles > 0);
  assert.equal(new Set(route.tiles.map(t => `${t.x},${t.y}`)).size, route.tiles.length);
  assert.equal(JSON.stringify(state), before);
  point.poi.type = 'pass'; point.poi.settlementId = town.id;
  const faster = routeBrief(state, town, 42, 30, { scout: 2 });
  assert.ok(faster.minutes < route.minutes);
  assert.ok(faster.pass);
  assert.equal(faster.minutes, getTravelEstimate(state, town, { x: 42, y: 30 }, { scout: 2 }).minutes);
  const tower = state.world.tiles.filter(t => t.poi && t !== point).sort((a, b) => Math.hypot(a.x - 32, a.y - 28) - Math.hypot(b.x - 32, b.y - 28))[0];
  tower.poi.type = 'watchtower'; tower.poi.ownerId = state.playerId; tower.poi.settlementId = town.id;
  const observed = routeBrief(state, town, 42, 30, { scout: 2 });
  assert.ok(observed.unobservedTiles < route.unobservedTiles);
  assert.match(observed.summary, /yalnız hedefte/);
  valid(state);
});

test('threats honour bidirectional vassals, visibility and truce expiry at arrival', () => {
  const { state, old, town } = fixture(), rival = state.factions[1];
  const home = state.settlements.find(t => t.ownerId === rival.id);
  const base = { id: 'threat', ownerId: rival.id, fromId: home.id, mission: 'attack', from: { x: old.x + 2, y: old.y }, to: { x: old.x, y: old.y }, departAt: state.time, arriveAt: state.time + 30, returning: false, troops: { spear: 10 } };
  state.armies = [base];
  assert.equal(incomingThreats(state).length, 1);
  state.factions[0].relations[rival.id].truceUntil = state.time + 31;
  assert.equal(incomingThreats(state).length, 0);
  state.factions[0].relations[rival.id].truceUntil = state.time + 30;
  assert.equal(incomingThreats(state).length, 1, 'exact arrival time is no longer protected');
  rival.relations[state.playerId].vasal = true;
  assert.equal(incomingThreats(state).length, 0);
  assert.equal(relationMarks(state)[0].vasal, true, 'actual engine vassal direction is represented');
  assert.equal(decisionBrief(state, town, home.x, home.y).relation.vasal, true);
  rival.relations[state.playerId].vasal = false;
  state.factions[0].relations[rival.id].truceUntil = 0;
  base.mission = 'trade';
  assert.equal(incomingThreats(state).length, 0);
  assert.equal(decisionBrief(state, town, old.x, old.y).risk, 'sakin', 'nearby trade is not military risk');
  base.mission = 'attack'; base.from = { x: 1, y: 1 };
  assert.equal(incomingThreats(state).length, 0, 'unseen forces are not disclosed');
});

test('new-site hourly forecast uses the actual founder buildings, not the stronger starting capital', () => {
  const state = createGame({ seed: 'TL-ULTRA-FORECAST', size: 49, aiCount: 0 });
  state.settings.autoPause = false;
  const town = state.settlements[0];
  const site = state.world.tiles.find(t => !t.poi && Math.hypot(t.x - town.x, t.y - town.y) >= 3 && Math.hypot(t.x - town.x, t.y - town.y) <= 7);
  const brief = decisionBrief(state, town, site.x, site.y);
  assert.equal(brief.projection, 'ifSettled');
  assert.equal(dispatch(state, { type: 'expand', settlementId: town.id, x: site.x, y: site.y, name: 'Öngörü Yurdu' }).ok, true);
  run(state, state.armies[0].arriveAt - state.time);
  const founded = state.settlements.find(t => t.x === site.x && t.y === site.y);
  const actual = getRates(state, founded);
  for (const key of ['food', 'wood', 'stone', 'iron']) assert.equal(brief.hour[key], actual[key] * 60, key);
});
