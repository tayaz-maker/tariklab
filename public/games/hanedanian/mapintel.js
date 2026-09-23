// Decision data the map draws: where you may settle, what is coming at you,
// and how present you are in each campaign region. Pure functions over the
// campaign state, so the map, the inspector and the tests share one rule set.
import { getPlayerSettlements, getArmyPosition, isArmyVisible, getTravelEstimate, getRates, getExpansionCost, getTileKnowledge } from './engine.js';
import { distance, getTile } from './world.js';
import { regionOf, REGION_NAMES } from './campaign.js';
import { UNITS } from './data.js';

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
    if (army.ownerId === state.playerId || army.returning || !isArmyVisible(state, army)) continue;
    nearest = Math.min(nearest, distance(getArmyPosition(state, army), tile));
  }
  for (const settlement of state.settlements) {
    if (settlement.ownerId === state.playerId) continue;
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
      buildings: { farm: 2, lumber: 1, quarry: 1, mine: 1, warehouse: 1, barracks: 1, wall: 0, market: 0, hall: 1 },
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
    relation: relation ? { score: relation.score, truce: relation.truceUntil > state.time, vasal: !!relation.vasal, name: faction?.name || '' } : null,
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
      vasal: !!relation?.vasal,
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

