import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dispatch, advance, validateState, getRates, getBuildCost, getTravelEstimate, getExpansionCost, getCampaign, getTileKnowledge, getPlayerSettlements, getFaction, getMilitaryPower, getCapacity, getArmyPosition, isArmyVisible } from '../public/games/hanedanian/engine.js';
import { generateWorld, getTile, distance } from '../public/games/hanedanian/world.js';
import { TERRAINS, RESOURCES, LIMITS } from '../public/games/hanedanian/data.js';

const copy = value => JSON.parse(JSON.stringify(value));
const fixture = (opts = {}) => createGame({ seed: 'TL-CORE-QA', size: 17, aiCount: 2, ...opts });
function run(state, minutes) {
  state.settings.autoPause = false;
  state.paused = false;
  for (let remaining = minutes; remaining > 0; remaining -= 10080) advance(state, Math.min(10080, remaining));
}
function findSite(state, town = state.settlements[0]) {
  return state.world.tiles.find(tile => !tile.poi && distance(tile, town) <= 8 && state.settlements.every(other => distance(tile, other) >= 3) && !state.armies.some(a => a.mission === 'expand' && !a.returning && distance(a.to, tile) < 3));
}
function stock(town, amount = 1100) { for (const key of Object.keys(RESOURCES)) town.resources[key] = amount; }
function assertValid(state) { const result = validateState(state); assert.equal(result.ok, true, result.errors.join('; ')); }

test('world generation has deterministic geography and an independent AI stream', () => {
  const first = generateWorld('same-seed', 49), second = generateWorld('same-seed', 49), different = generateWorld('other-seed', 49);
  assert.deepEqual(first, second); assert.notDeepEqual(first.tiles, different.tiles);
  assert.equal(first.tiles.length, 2401);
  const terrains = new Set(first.tiles.map(tile => tile.terrain));
  assert.ok(terrains.size >= 7);
  for (let i = 0; i < first.tiles.length; i++) { const tile = first.tiles[i]; assert.equal(tile.x, i % 49); assert.equal(tile.y, Math.floor(i / 49)); assert.ok(TERRAINS[tile.terrain].movement > 0); }
  assert.equal(getTile(first, -1, 0), null); assert.equal(getTile(first, 49, 3), null); assert.equal(getTile(first, NaN, 3), null);
});

test('vertical slice: production → queue → scout → expansion → JSON roundtrip', () => {
  const state = fixture(), town = state.settlements[0];
  assert.equal(state.factions.length, 3); assert.equal(state.paused, true);
  assert.deepEqual(validateState(state), { ok: true, errors: [] });
  const initial = town.resources.food, rates = getRates(state, town);
  advance(state, 30); assert.equal(state.time, 0); assert.equal(town.resources.food, initial);
  assert.equal(dispatch(state, { type: 'build', settlementId: town.id, building: 'farm' }).ok, true);
  const readyAt = town.queue[0].completeAt;
  assert.equal(dispatch(state, { type: 'scout', settlementId: town.id, x: town.x + 2, y: town.y + 1 }).ok, true);
  run(state, readyAt + 10);
  assert.equal(town.buildings.farm, 3); assert.ok(getRates(state, town).food > rates.food);
  assert.ok(state.intel[`${town.x + 2},${town.y + 1}`]); assert.equal(state.campaign.scouting, 1);
  run(state, 600);
  const site = findSite(state); assert.ok(site);
  assert.equal(dispatch(state, { type: 'expand', settlementId: town.id, x: site.x, y: site.y, name: 'İkinci Yurt' }).ok, true);
  const army = state.armies.find(a => a.ownerId === 'player' && a.mission === 'expand'); assert.ok(army.arriveAt > state.time);
  assert.equal(getPlayerSettlements(state).length, 1);
  run(state, army.arriveAt - state.time);
  assert.equal(getPlayerSettlements(state).length, 2);
  assert.ok(state.settlements.find(t => t.name === 'İkinci Yurt'));
  const restored = copy(state); assertValid(restored); assert.deepEqual(restored, state);
  run(state, 137); run(restored, 137); assert.deepEqual(state, restored);
});

test('queue charges before work; repeated levels have increasing costs and sequential completion', () => {
  const state = fixture({ aiCount: 0 }), town = state.settlements[0]; stock(town);
  const first = getBuildCost(state, town, 'lumber');
  assert.equal(dispatch(state, { type: 'build', settlementId: town.id, building: 'lumber' }).ok, true);
  const second = getBuildCost(state, town, 'lumber'); assert.ok(second.wood > first.wood);
  assert.equal(dispatch(state, { type: 'build', settlementId: town.id, building: 'lumber' }).ok, true);
  assert.ok(town.queue[1].completeAt > town.queue[0].completeAt);
  const end = town.queue[1].completeAt;
  run(state, end - 1); assert.equal(town.buildings.lumber, 2);
  run(state, 1); assert.equal(town.buildings.lumber, 3); assert.equal(town.queue.length, 0); assertValid(state);
});

test('training respects barracks prerequisites, pending army caps and real elapsed time', () => {
  const state = fixture({ aiCount: 0 }), town = state.settlements[0]; stock(town);
  assert.equal(dispatch(state, { type: 'train', settlementId: town.id, unit: 'siege', count: 1 }).ok, false);
  const before = town.troops.spear;
  assert.equal(dispatch(state, { type: 'train', settlementId: town.id, unit: 'spear', count: 3 }).ok, true);
  const end = town.queue[0].completeAt;
  run(state, end - 1); assert.equal(town.troops.spear, before);
  run(state, 1); assert.equal(town.troops.spear, before + 3);
  town.troops.militia = 5000;
  assert.equal(dispatch(state, { type: 'train', settlementId: town.id, unit: 'militia', count: 1 }).ok, false);
});

test('all invalid commands are rejected before any mutation', () => {
  const state = fixture(), town = state.settlements[0], enemy = state.settlements[1], site = findSite(state);
  const commands = [null, {}, { type: 'bad' }, { type: 'setSpeed', speed: 999 }, { type: 'build', settlementId: enemy.id, building: 'farm' },
    { type: 'build', settlementId: town.id, building: '__proto__' }, { type: 'train', settlementId: town.id, unit: 'militia', count: -1 },
    { type: 'train', settlementId: town.id, unit: 'militia', count: NaN }, { type: 'train', settlementId: town.id, unit: 'militia', count: 1.2 },
    { type: 'scout', settlementId: town.id, x: 999, y: 3 }, { type: 'scout', settlementId: town.id, x: 2, y: 2, count: 100 },
    { type: 'attack', settlementId: town.id, x: enemy.x, y: enemy.y, troops: { militia: 999 } },
    { type: 'expand', settlementId: town.id, x: town.x, y: town.y }, { type: 'expand', settlementId: town.id, x: -1, y: 3 },
    { type: 'trade', settlementId: town.id, targetId: enemy.id, cargo: { food: 10 } },
    { type: 'diplomacy', factionId: enemy.ownerId, mode: 'vasal' }, { type: 'diplomacy', factionId: 'nobody', mode: 'gift' },
    { type: 'dynasty', choice: '__proto__' }, { type: 'event', choice: 'mentor' }, { type: 'victory', path: 'wealth' }, { type: 'continue' }, { type: 'recall', armyId: 'missing' }];
  for (const command of commands) { const before = JSON.stringify(state); assert.equal(dispatch(state, command).ok, false, JSON.stringify(command)); assert.equal(JSON.stringify(state), before, `Mutation on ${JSON.stringify(command)}`); }
  stock(town, 0); const before = JSON.stringify(state);
  assert.equal(dispatch(state, { type: 'expand', settlementId: town.id, x: site.x, y: site.y }).ok, false);
  assert.equal(JSON.stringify(state), before);
});

test('army ETA accounts for distance, terrain, slowest unit and commander; travel is gradual', () => {
  const state = fixture({ aiCount: 0 }), town = state.settlements[0];
  const near = { x: town.x + 2, y: town.y }, far = { x: town.x + 6, y: town.y };
  const a = getTravelEstimate(state, town, near, { scout: 1 }), b = getTravelEstimate(state, town, far, { scout: 1 });
  assert.ok(b.minutes > a.minutes);
  assert.ok(getTravelEstimate(state, town, far, { scout: 1, siege: 1 }).minutes > b.minutes);
  for (const tile of state.world.tiles) tile.terrain = 'mountain';
  const mountains = getTravelEstimate(state, town, far, { militia: 1 });
  for (const tile of state.world.tiles) tile.terrain = 'road';
  const roads = getTravelEstimate(state, town, far, { militia: 1 }); assert.ok(mountains.minutes > roads.minutes * 2);
  dispatch(state, { type: 'scout', settlementId: town.id, ...far });
  const army = state.armies[0];
  assert.deepEqual(getArmyPosition(state, army), { x: town.x, y: town.y });
  run(state, Math.floor((army.arriveAt - state.time) / 2));
  const position = getArmyPosition(state, army); assert.ok(position.x > town.x && position.x < far.x);
  assert.equal(isArmyVisible(state, army), true);
});

test('scout knowledge is private until arrival, remains a snapshot, and visibly ages', () => {
  const state = fixture(), town = state.settlements[0], enemy = state.settlements[1];
  for (const faction of state.factions) faction.nextThink = 99999;
  let knowledge = getTileKnowledge(state, enemy.x, enemy.y);
  assert.equal(knowledge.intel, null); assert.equal(knowledge.settlement.troops, undefined);
  dispatch(state, { type: 'scout', settlementId: town.id, x: enemy.x, y: enemy.y, count: 2 });
  run(state, state.armies[0].arriveAt);
  knowledge = getTileKnowledge(state, enemy.x, enemy.y);
  assert.ok(knowledge.intel); assert.equal(knowledge.stale, false);
  const observed = knowledge.intel.troops.militia; enemy.troops.militia += 20;
  assert.equal(getTileKnowledge(state, enemy.x, enemy.y).intel.troops.militia, observed);
  run(state, 361); assert.equal(getTileKnowledge(state, enemy.x, enemy.y).stale, true);
});

test('strategic points attach, produce measurable bonuses and consume travel time', () => {
  const state = fixture({ aiCount: 0 }), town = state.settlements[0], point = getTile(state.world, town.x + 2, town.y + 1);
  const initial = getRates(state, town).food;
  assert.equal(dispatch(state, { type: 'claim', settlementId: town.id, x: point.x, y: point.y, troops: { militia: 8 } }).ok, true);
  assert.equal(point.poi.ownerId, null);
  run(state, state.armies[0].arriveAt);
  assert.equal(point.poi.ownerId, 'player'); assert.equal(point.poi.settlementId, town.id);
  assert.ok(getRates(state, town).food > initial); assertValid(state);
});

test('recalling founders safely refunds cargo and influence only on their return', () => {
  const state = fixture({ aiCount: 0 }), town = state.settlements[0], site = findSite(state), initialInfluence = getFaction(state).influence;
  const cost = getExpansionCost(state);
  dispatch(state, { type: 'expand', settlementId: town.id, x: site.x, y: site.y });
  run(state, 5); const army = state.armies[0];
  assert.equal(getFaction(state).influence, initialInfluence - cost.influence);
  assert.equal(dispatch(state, { type: 'recall', armyId: army.id }).ok, true);
  assert.equal(army.returning, true);
  run(state, army.arriveAt - state.time);
  assert.equal(getFaction(state).influence, initialInfluence); assert.equal(getPlayerSettlements(state).length, 1); assertValid(state);
});

test('expansion reservation prevents colliding founders without partial spend', () => {
  const state = fixture({ aiCount: 0 }), town = state.settlements[0], site = findSite(state);
  dispatch(state, { type: 'expand', settlementId: town.id, x: site.x, y: site.y });
  stock(town); getFaction(state).influence = 100;
  const before = JSON.stringify(state);
  assert.equal(dispatch(state, { type: 'expand', settlementId: town.id, x: site.x, y: site.y }).ok, false);
  assert.equal(JSON.stringify(state), before);
});

test('combat deterministic, capitals remain recovery anchors, truce halts traveling attacks', () => {
  const state = fixture(), town = state.settlements[0], enemy = state.settlements[1];
  for (const faction of state.factions) faction.nextThink = 99999;
  town.troops.militia = 120; town.buildings.farm = 8;
  const twin = copy(state), command = { type: 'attack', settlementId: town.id, x: enemy.x, y: enemy.y, troops: { militia: 100 } };
  assert.equal(dispatch(state, command).ok, true); dispatch(twin, command);
  const eta = state.armies[0].arriveAt;
  run(state, eta); run(twin, eta); assert.deepEqual(state, twin);
  assert.equal(enemy.ownerId, 'ai-1'); assert.ok(state.campaign.battlesWon >= 1); assertValid(state);
  const truceState = fixture(), home = truceState.settlements[0], target = truceState.settlements[1];
  for (const faction of truceState.factions) faction.nextThink = 99999;
  dispatch(truceState, { type: 'attack', settlementId: home.id, x: target.x, y: target.y, troops: { militia: 10 } });
  getFaction(truceState).relations[target.ownerId].score = 30;
  assert.equal(dispatch(truceState, { type: 'diplomacy', factionId: target.ownerId, mode: 'truce' }).ok, true);
  const defenders = copy(target.troops); run(truceState, truceState.armies[0].arriveAt);
  assert.deepEqual(target.troops, defenders); assert.equal(truceState.armies[0].returning, true);
});

test('trade delivers only to friendly towns, awards real delivery volume and returns premium', () => {
  const state = fixture({ aiCount: 0 }), town = state.settlements[0], site = findSite(state);
  dispatch(state, { type: 'expand', settlementId: town.id, x: site.x, y: site.y });
  run(state, state.armies[0].arriveAt);
  const target = getPlayerSettlements(state)[1]; stock(town); target.resources.food = 0;
  assert.equal(dispatch(state, { type: 'trade', settlementId: town.id, targetId: target.id, cargo: { food: 100 } }).ok, true);
  const army = state.armies.find(a => a.mission === 'trade'), until = army.arriveAt - state.time;
  assert.equal(state.campaign.tradeVolume, 0);
  run(state, until); assert.equal(state.campaign.tradeVolume, 100); assert.ok(army.cargo.iron > 0); assert.equal(army.returning, true);
  const before = town.resources.iron; run(state, army.arriveAt - state.time); assert.ok(town.resources.iron > before); assertValid(state);
});

test('no resource goes negative and starvation pauses with a meaningful recovery report', () => {
  const state = fixture({ aiCount: 0 }), town = state.settlements[0]; town.resources.food = 0; town.troops.militia = 400;
  state.paused = false; state.settings.autoPause = true;
  const result = advance(state, 100); assert.equal(result.advanced, 1); assert.equal(state.paused, true);
  assert.equal(town.resources.food, 0); assert.equal(town.troops.militia, 399);
  assert.equal(state.reports[0].type, 'shortage'); assert.equal(state.reports[0].critical, true);
  assertValid(state);
});

test('dynasty event is actionable and XP traits affect production', () => {
  const state = fixture({ aiCount: 0 }), town = state.settlements[0];
  state.paused = false; advance(state, 2401); assert.equal(state.time, 2400); assert.ok(state.dynasty.pendingEvent); assert.equal(state.paused, true);
  assert.equal(dispatch(state, { type: 'event', choice: 'mentor' }).ok, true); assert.equal(state.dynasty.pendingEvent, null);
  state.dynasty.xp = 100; const before = getRates(state, town).food;
  assert.equal(dispatch(state, { type: 'dynasty', choice: 'stewardship' }).ok, true); assert.ok(getRates(state, town).food > before); assertValid(state);
});

test('three victory paths expose measurable requirements and gate continuation', () => {
  const state = fixture(), campaign = getCampaign(state);
  assert.deepEqual(campaign.paths.map(p => p.id), ['dominion', 'wealth', 'dynasty']);
  assert.equal(campaign.paths.some(p => p.ready), false);
  assert.equal(dispatch(state, { type: 'continue' }).ok, false);
  state.campaign.victory = 'wealth'; assert.equal(dispatch(state, { type: 'continue' }).ok, true); assert.equal(state.campaign.continued, true);
});

test('campaign remains deterministic across differently chunked ticks and JSON reload', () => {
  const one = fixture(), many = fixture();
  run(one, 4000);
  for (let index = 0; index < 40; index++) run(many, 100);
  assert.deepEqual(one, many); assertValid(one);
  const loaded = copy(many); run(loaded, 1000); run(one, 1000); assert.deepEqual(one, loaded);
});

test('seed sweep: complete maps, bounded AI growth, finite economy, active behavior and player grace', () => {
  for (const seed of ['TL-49-A', 'TL-49-B', 'TL-49-C', 'TL-49-D', 'TL-49-E', 'TL-49-F']) {
    const state = createGame({ seed }); const home = state.settlements[0];
    for (const other of state.settlements.slice(1)) assert.ok(distance(home, other) >= 12, seed);
    run(state, 3400);
    assert.equal(state.reports.some(item => item.type === 'threat'), false, `${seed}: protected start`);
    assert.ok(state.settlements.length > 9, `${seed}: AI expands`);
    assert.ok(state.settlements.slice(1).some(t => Object.values(t.buildings).some(n => n >= 3)), `${seed}: AI develops`);
    run(state, 18000);
    assertValid(state); assert.ok(state.settlements.length <= LIMITS.settlements); assert.ok(state.armies.length <= LIMITS.armies); assert.ok(state.reports.length <= LIMITS.reports);
    assert.equal(home.ownerId, 'player');
    for (const town of state.settlements) for (const amount of Object.values(town.resources)) assert.ok(Number.isFinite(amount) && amount >= 0 && amount <= getCapacity(town));
    assert.ok(getMilitaryPower(state, 'ai-1') > 0);
  }
});

test('corrupt nested saves, malicious keys and out-of-bounds markers reject safely', () => {
  const base = fixture();
  for (const malformed of [null, {}, [], { ...base, world: null }, { ...base, factions: [null] }, { ...base, settlements: [null] }, { ...base, dynasty: {} }, { ...base, armies: [null] }, { ...base, settings: { autoPause: true, markers: 'bad' } }]) assert.equal(validateState(malformed).ok, false);
  for (const mutate of [s => { s.settlements[0].resources.food = -1; }, s => { s.settlements[0].troops.scout = Infinity; }, s => { s.world.tiles[0].terrain = '__proto__'; }, s => { s.settlements[0].queue = [{ kind: 'build', building: 'bad', level: 9, completeAt: 100 }]; }, s => { s.settings.markers = [{ x: -1, y: 0 }]; }, s => { s.intel['2,2'] = null; }]) {
    const broken = copy(base); mutate(broken); assert.equal(validateState(broken).ok, false);
  }
  const markers = copy(base); markers.settings.markers = [{ x: 1, y: 1 }]; assertValid(markers);
});
