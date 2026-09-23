// Decision data the map draws: where you may settle, what is coming at you,
// and how present you are in each campaign region. Pure functions over the
// campaign state, so the map, the inspector and the tests share one rule set.
import { getPlayerSettlements, getArmyPosition, isArmyVisible, getTravelEstimate } from './engine.js';
import { distance, getTile } from './world.js';
import { regionOf, REGION_NAMES } from './campaign.js';

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
