// Decision data the map draws: where you may settle, what is coming at you,
// and how present you are in each campaign region. Pure functions over the
// campaign state, so the map, the inspector and the tests share one rule set.
import { getPlayerSettlements, getArmyPosition, isArmyVisible, getTravelEstimate, getRates, getExpansionCost, getTileKnowledge, getPointReassignment } from './engine.js';
import { distance, getTile } from './world.js';
import { regionOf, REGION_NAMES } from './campaign.js';
import { UNITS, TERRAINS, POIS, RESOURCES } from './data.js';

export const CLAIM_RANGE = 7;
export const MIN_SETTLEMENT_GAP = 3;
export const expansionRange = (town) => 8 + (town?.buildings?.hall || 0) * 2;

/**
 * Tiles an expansion caravan from `town` may target, by the same location
 * rules the engine enforces (resources and influence are checked separately).
 * Returns a byte per tile: 1 = valid site.
 */
export function expansionSites(state, town) {
  const size = state.world.size;
  const sites = new Uint8Array(size * size);
  if (!town) return sites;
  const range = expansionRange(town);
  const pending = state.armies.filter((a) => a.mission === 'expand' && !a.returning).map((a) => a.to);
  const minX = Math.max(0, Math.floor(town.x - range)), maxX = Math.min(size - 1, Math.ceil(town.x + range));
  const minY = Math.max(0, Math.floor(town.y - range)), maxY = Math.min(size - 1, Math.ceil(town.y + range));
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const tile = state.world.tiles[y * size + x];
      if (tile.poi) continue;
      const d = distance(town, tile);
      if (d < 0.5 || d > range) continue;
      if (state.settlements.some((s) => distance(s, tile) < MIN_SETTLEMENT_GAP)) continue;
      if (pending.some((p) => distance(p, tile) < MIN_SETTLEMENT_GAP)) continue;
      sites[y * size + x] = 1;
    }
  return sites;
}

/** Why a tile is or is not a place to settle from `town`, in the player's words. */
export function siteVerdict(state, town, x, y) {
  const tile = getTile(state.world, x, y);
  if (!town || !tile) return null;
  const range = expansionRange(town), d = distance(town, tile);
  if (tile.poi) return { ok: false, reason: 'Özel noktaya yerleşilmez; noktayı bağlayabilirsin.' };
  if (d < 0.5) return { ok: false, reason: 'Burası zaten yurdun.' };
  if (d > range) return { ok: false, reason: `Menzil dışında: ${d.toFixed(1)} / ${range} karo. Konağı geliştir.` };
  if (state.settlements.some((s) => distance(s, tile) < MIN_SETTLEMENT_GAP)) return { ok: false, reason: 'Başka bir yerleşime 3 karodan yakın.' };
  if (state.armies.some((a) => a.mission === 'expand' && !a.returning && distance(a.to, tile) < MIN_SETTLEMENT_GAP)) return { ok: false, reason: 'Yolda olan bir kafilenin hedefine çok yakın.' };
  return { ok: true, reason: `Yerleşilebilir: ${d.toFixed(1)} / ${range} karo.` };
}

/**
 * Hostile campaigns the player can see that are heading for a player
 * settlement or a point the player holds, soonest first.
 */
export function incomingThreats(state) {
  const towns = new Map(getPlayerSettlements(state).map((t) => [`${t.x},${t.y}`, t]));
  const out = [];
  for (const army of state.armies) {
    if (army.ownerId === state.playerId || army.returning) continue;
    if (army.mission !== 'attack' && army.mission !== 'claim') continue;
    if (army.rebind || protectedUntil(state, army.ownerId, army.arriveAt)) continue;
    const key = `${army.to.x},${army.to.y}`;
    const town = towns.get(key);
    const tile = getTile(state.world, army.to.x, army.to.y);
    const ownPoint = tile?.poi?.ownerId === state.playerId;
    if (!town && !ownPoint) continue;
    if (!isArmyVisible(state, army)) continue;
    out.push({
      armyId: army.id,
      ownerId: army.ownerId,
      mission: army.mission,
      position: getArmyPosition(state, army),
      target: { x: army.to.x, y: army.to.y, name: town?.name || 'Bağlı noktan' },
      arriveAt: army.arriveAt,
      minutes: Math.max(0, army.arriveAt - state.time),
    });
  }
  return out.sort((a, b) => a.arriveAt - b.arriveAt);
}

/** The player's footprint in each of the nine campaign regions. */
export function regionPresence(state) {
  const rows = REGION_NAMES.map((name, id) => ({ id, name, towns: 0, developed: 0, points: 0 }));
  for (const town of getPlayerSettlements(state)) {
    const row = rows[regionOf(state, town)];
    row.towns++;
    if (town.buildings.hall >= 2) row.developed++;
  }
  for (const tile of state.world.tiles)
    if (tile.poi?.ownerId === state.playerId) rows[regionOf(state, tile)].points++;
  return rows;
}

/** Scout route from the active settlement to a tile, for the map's guide line. */
export function scoutRoute(state, town, x, y) {
  const tile = getTile(state.world, x, y);
  if (!town || !tile || distance(town, tile) < 0.5) return null;
  const estimate = getTravelEstimate(state, town, tile, { scout: 1 });
  return { distance: estimate.distance, minutes: estimate.minutes };
}

const emptyTroops = () => Object.fromEntries(Object.keys(UNITS).map((key) => [key, 0]));
const playerRelation = (state, ownerId) => state.factions.find((f) => f.id === state.playerId)?.relations[ownerId] || null;
const linkedToPlayer = (state, ownerId) => {
  if (ownerId === state.playerId) return true;
  const forward = playerRelation(state, ownerId);
  const back = state.factions.find((f) => f.id === ownerId)?.relations[state.playerId];
  return !!(forward?.vasal || back?.vasal);
};
// Arrival resolves combat. An expiring truce must not hide a force that will
// arrive after it; friendly supply/scout traffic is never an attack warning.
const protectedUntil = (state, ownerId, time = state.time) => linkedToPlayer(state, ownerId) || (playerRelation(state, ownerId)?.truceUntil || 0) > time;

/** Exact straight corridor sampled by the movement engine, plus observed facts.
 * Fog means lack of observation, not a fabricated ambush/loss probability.
 */
export function routeBrief(state, town, x, y, troops = {}) {
  const target = getTile(state.world, x, y);
  if (!town || !target || distance(town, target) < 0.5) return null;
  const estimate = getTravelEstimate(state, town, target, troops);
  const towns = getPlayerSettlements(state);
  const points = state.world.tiles.filter(t => t.poi?.ownerId === state.playerId);
  const towers = points.filter(t => t.poi.type === 'watchtower');
  const linked = points.filter(t => t.poi.settlementId === town.id);
  const visible = tile => towns.some(t => distance(t, tile) <= 7) || towers.some(t => distance(t, tile) <= 12);
  const steps = Math.max(1, Math.ceil(estimate.distance * 2)), seen = new Set(), tiles = [];
  for (let i = 0; i <= steps; i++) {
    const tx = Math.round(town.x + (x - town.x) * i / steps), ty = Math.round(town.y + (y - town.y) * i / steps);
    const key = `${tx},${ty}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const tile = getTile(state.world, tx, ty);
    if (tile) tiles.push({ x: tx, y: ty, terrain: tile.terrain, visible: visible(tile) });
  }
  const threats = incomingThreats(state).filter(t => tiles.some(tile => distance(tile, t.position) <= 3)).map(t => ({ armyId: t.armyId, ownerId: t.ownerId, minutes: t.minutes, mission: t.mission }));
  const mark = type => { const tile = linked.find(t => t.poi.type === type); return tile ? { x: tile.x, y: tile.y, label: POIS[type].label } : null; };
  const roadTiles = tiles.filter(t => t.terrain === 'road' || t.terrain === 'pass').length;
  const riverTiles = tiles.filter(t => t.terrain === 'valley').length;
  const roughTiles = tiles.filter(t => TERRAINS[t.terrain].movement >= 1.3).length;
  const unobservedTiles = tiles.filter(t => !t.visible).length;
  const pass = mark('pass'), inn = mark('caravanserai');
  return {
    distance: estimate.distance, minutes: estimate.minutes, terrainFactor: estimate.terrainFactor,
    tiles, roadTiles, riverTiles, roughTiles, unobservedTiles, threats, pass, inn,
    summary: `${roadTiles} yol/geçit, ${riverTiles} vadi, ${roughTiles} zor arazi karosu. ${unobservedTiles ? `${unobservedTiles} karo güncel görüş dışında.` : 'Koridor güncel görüş içinde.'}${pass ? ' Bağlı geçit çıkış süresini %15 kısaltıyor.' : ''} Çatışma yalnız hedefte çözülür.`,
  };
}

/** A point's real marginal contribution to the acting town and transfer rules. */
export function pointBrief(state, town, x, y) {
  const tile = getTile(state.world, x, y);
  if (!town || !tile?.poi) return null;
  const def = POIS[tile.poi.type], verdict = getPointReassignment(state, town, tile);
  const current = state.settlements.find(t => t.id === tile.poi.settlementId);
  const linked = state.world.tiles.filter(t => t.poi?.ownerId === town.ownerId && t.poi.settlementId === town.id);
  const alreadyHere = tile.poi.ownerId === town.ownerId && tile.poi.settlementId === town.id;
  let resourceDeltaPerHour = null, currentContributionPerHour = null, benefit = def.description;
  if (def.resource) {
    const rates = getRates(state, town);
    const multiplier = 1 + linked.reduce((sum, t) => sum + (POIS[t.poi.type].resource === def.resource ? POIS[t.poi.type].bonus : 0), 0);
    const gross = rates[def.resource] + (def.resource === 'food' ? rates.upkeep : 0);
    resourceDeltaPerHour = gross / multiplier * def.bonus * 60;
    benefit = `${town.name}: saatte ${resourceDeltaPerHour.toFixed(1)} ${RESOURCES[def.resource].label.toLowerCase()} ${alreadyHere ? 'katkısı sürüyor' : 'ek üretim'}.`;
    if (current?.ownerId === state.playerId && !alreadyHere) {
      const oldRates = getRates(state, current);
      const oldMultiplier = 1 + state.world.tiles.reduce((sum, t) => sum + (t.poi?.ownerId === current.ownerId && t.poi.settlementId === current.id && POIS[t.poi.type].resource === def.resource ? POIS[t.poi.type].bonus : 0), 0);
      currentContributionPerHour = (oldRates[def.resource] + (def.resource === 'food' ? oldRates.upkeep : 0)) / oldMultiplier * def.bonus * 60;
      benefit += ` ${current.name} aynı anda saatte ${currentContributionPerHour.toFixed(1)} katkıyı kaybeder.`;
    }
  } else if (tile.poi.type === 'caravanserai') {
    const existing = linked.some(t => t !== tile && t.poi.type === 'caravanserai');
    benefit = existing ? 'Bu yurtta zaten han var; ikinci han kapasite veya prim artışı sağlamaz.' : `${town.name}: kervan başına +${town.buildings.market * 110} yük yeri; prim hesabına +10 yüzde puan (toplam üst sınır %40).${town.buildings.market ? '' : ' Kervan avlusu kurulana kadar kapasite 0.'}`;
  } else if (tile.poi.type === 'pass') {
    benefit = linked.some(t => t !== tile && t.poi.type === 'pass') ? 'Bu yurtta zaten geçit etkisi var; ikinci geçit süreyi tekrar kısaltmaz.' : `${town.name} çıkışlı yeni seferlerde süre %15 kısalır. Yoldaki seferler değişmez.`;
  } else if (tile.poi.type === 'watchtower') {
    benefit = 'Kulenin çevresindeki 12 karoda yabancı birlikler görünür. Başka yurda nakil görüş alanını büyütmez.';
  } else if (tile.poi.type === 'ruins') {
    benefit = 'İlk başarılı bağlamada 15 nüfuz ve 20 deneyim. Bağlantı nakli ödülü tekrarlamaz.';
  }
  return {
    type: tile.poi.type, label: def.label, ownerId: tile.poi.ownerId,
    currentBinding: current ? { id: current.id, name: current.name } : null,
    canReassign: verdict.ok, reason: verdict.reason, cost: { influence: 5 },
    minutes: getTravelEstimate(state, town, tile, {}).minutes,
    slots: { used: verdict.used, pending: verdict.pending, max: 4 }, benefit,
    guard: def.guard * (tile.poi.ownerId ? 2.4 : 1),
    resourceDeltaPerHour, currentContributionPerHour, resource: def.resource,
  };
}

/**
 * Decision numbers for one tile, from the acting settlement. Uses the live
 * economy (`getRates`) and the same travel estimate as an order. A tile that
 * is not yet yours is priced as a new settlement would produce; nothing is written.
 */
export function decisionBrief(state, town, x, y) {
  const tile = getTile(state.world, x, y);
  if (!town || !tile) return null;
  const scout = getTravelEstimate(state, town, tile, { scout: 1 });
  const caravan = getTravelEstimate(state, town, tile, {});
  const knowledge = getTileKnowledge(state, x, y);
  const here = incomingThreats(state).filter((t) => t.target.x === x && t.target.y === y);
  let nearest = Infinity;
  for (const army of state.armies) {
    if (army.ownerId === state.playerId || army.returning || army.rebind || !['attack', 'claim'].includes(army.mission) || protectedUntil(state, army.ownerId, army.arriveAt) || !isArmyVisible(state, army)) continue;
    nearest = Math.min(nearest, distance(getArmyPosition(state, army), tile));
  }
  for (const settlement of state.settlements) {
    if (protectedUntil(state, settlement.ownerId)) continue;
    nearest = Math.min(nearest, distance(settlement, tile));
  }
  const occupied = state.settlements.find((s) => s.x === x && s.y === y) || null;
  let rates = null;
  let projection = null;
  if (occupied?.ownerId === state.playerId) {
    rates = getRates(state, occupied);
    projection = 'live';
  } else if (!occupied && !tile.poi) {
    rates = getRates(state, {
      id: 'preview-site',
      ownerId: state.playerId,
      x, y,
      buildings: { farm: 1, lumber: 1, quarry: 1, mine: 1, warehouse: 1, barracks: 1, wall: 0, market: 0, hall: 1 },
      troops: emptyTroops(),
    });
    projection = 'ifSettled';
  }
  const hour = rates ? Object.fromEntries(Object.keys(rates).filter((k) => k !== 'upkeep').map((k) => [k, rates[k] * 60])) : null;
  const ownerId = occupied?.ownerId || tile.poi?.ownerId || null;
  const relation = ownerId && ownerId !== state.playerId ? playerRelation(state, ownerId) : null;
  const faction = ownerId ? state.factions.find((f) => f.id === ownerId) : null;
  const verdict = !occupied && !tile.poi ? siteVerdict(state, town, x, y) : null;
  return {
    distance: scout.distance,
    minutes: scout.minutes,
    caravanMinutes: caravan.minutes,
    risk: here.length ? 'acil' : nearest < 8 ? 'yakın' : 'sakin',
    nearest: Number.isFinite(nearest) ? nearest : null,
    threats: here.length,
    threatMinutes: here[0]?.minutes ?? null,
    hour,
    upkeep: rates?.upkeep ?? 0,
    projection,
    expand: verdict?.ok ? getExpansionCost(state) : null,
    verdict,
    relation: relation ? { score: relation.score, truce: relation.truceUntil > state.time, vasal: linkedToPlayer(state, ownerId), name: faction?.name || '' } : null,
    discovery: knowledge.visibility,
    stale: !!knowledge.stale,
    intelAge: knowledge.intelAge,
  };
}

/** Up to `limit` caravan targets the player can actually supply, nearest first. */
export function tradeLinks(state, origin, limit = 6) {
  if (!origin) return [];
  const links = [];
  for (const town of state.settlements) {
    if (town.id === origin.id || !linkedToPlayer(state, town.ownerId)) continue;
    const estimate = getTravelEstimate(state, origin, town, {});
    links.push({ id: town.id, name: town.name, x: town.x, y: town.y, ownerId: town.ownerId, distance: estimate.distance, minutes: estimate.minutes });
  }
  return links.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

/** One mark per rival capital: the relation the player would be deciding on. */
export function relationMarks(state) {
  const seen = new Set();
  const marks = [];
  for (const town of state.settlements) {
    if (town.ownerId === state.playerId || seen.has(town.ownerId)) continue;
    seen.add(town.ownerId);
    const relation = playerRelation(state, town.ownerId);
    const faction = state.factions.find((f) => f.id === town.ownerId);
    marks.push({
      x: town.x, y: town.y, name: faction?.name || town.name,
      score: relation?.score || 0,
      truce: (relation?.truceUntil || 0) > state.time,
      vasal: linkedToPlayer(state, town.ownerId),
    });
  }
  return marks;
}

/** The nine regions as a strategic board: presence plus threats aimed inside each. */
export function strategicOverview(state) {
  const threats = incomingThreats(state);
  return regionPresence(state).map((row) => ({
    ...row,
    threats: threats.filter((t) => regionOf(state, t.target) === row.id).length,
  }));
}
