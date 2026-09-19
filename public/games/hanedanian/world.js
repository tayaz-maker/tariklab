import { TERRAINS } from './data.js';

export function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
export function randomStream(seed) {
  let n = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return () => {
    n = (n + 0x6d2b79f5) >>> 0;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const getTile = (world, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < world.size && y < world.size ? world.tiles[y * world.size + x] : null;
function noise(x, y, salt) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const blend = t => t * t * (3 - 2 * t);
  const sample = (a, b) => hashSeed(`${salt}:${a}:${b}`) / 4294967295;
  const fx = blend(x - ix), fy = blend(y - iy);
  return (sample(ix, iy) * (1 - fx) + sample(ix + 1, iy) * fx) * (1 - fy) + (sample(ix, iy + 1) * (1 - fx) + sample(ix + 1, iy + 1) * fx) * fy;
}
export function generateWorld(seed = 'TL-SEDiR-49', size = 49) {
  if (!Number.isInteger(size) || size < 13 || size > 65) throw new RangeError('Dünya boyutu 13–65 arasında olmalı.');
  seed = String(seed).slice(0, 80);
  const random = randomStream(`${seed}:points`), tiles = [];
  const riverPhase = random() * 6.28, roadPhase = random() * 6.28;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const elevation = noise(x / 6, y / 6, `${seed}:elevation`) * 0.72 + noise(x / 2.5, y / 2.5, `${seed}:detail`) * 0.28;
    const moisture = noise(x / 5, y / 5, `${seed}:moisture`);
    const river = Math.round(size * 0.36 + Math.sin(y / 6 + riverPhase) * size * 0.1);
    const road = Math.round(size * 0.56 + Math.sin(x / 10 + roadPhase) * size * 0.08);
    let terrain = elevation > 0.64 ? 'mountain' : elevation > 0.57 ? 'ore' : moisture > 0.57 ? 'forest' : moisture < 0.3 ? 'arid' : elevation < 0.38 ? 'plain' : 'steppe';
    if (Math.abs(x - river) <= 1) terrain = 'valley';
    if (y === road) terrain = elevation > 0.6 ? 'pass' : 'road';
    const point = random() < 0.024;
    const pool = terrain === 'forest' ? ['forest', 'watchtower'] : terrain === 'mountain' ? ['quarry', 'pass'] : terrain === 'ore' ? ['iron', 'ruins'] : terrain === 'valley' || terrain === 'plain' ? ['pasture', 'ruins'] : terrain === 'road' ? ['caravanserai'] : ['watchtower', 'caravanserai', 'ruins'];
    tiles.push({ x, y, terrain, poi: point ? { id: `p-${x}-${y}`, type: pool[Math.floor(random() * pool.length)], ownerId: null, settlementId: null } : null });
  }
  const world = { seed, size, tiles };
  const center = Math.floor(size / 2);
  // Fair starting basin; all terrain is traversable, so the whole land remains connected.
  for (const [dx, dy, terrain] of [[0, 0, 'plain'], [3, 0, 'forest'], [-3, 0, 'ore'], [0, 3, 'valley'], [0, -3, 'mountain']]) {
    const tile = getTile(world, center + dx, center + dy); tile.terrain = terrain; tile.poi = null;
  }
  for (const [dx, dy, type] of [[2, 1, 'pasture'], [-2, 1, 'forest'], [1, -3, 'watchtower'], [-2, -3, 'iron']]) {
    const tile = getTile(world, center + dx, center + dy);
    tile.poi = { id: `p-${tile.x}-${tile.y}`, type, ownerId: null, settlementId: null };
  }
  return world;
}

// Straight overland corridor: every tile is land, so no teleport across water/walls.
// The actual crossed terrain determines time; roads and passes make a measurable difference.
export function sampleRoute(world, from, to) {
  const length = distance(from, to), steps = Math.max(1, Math.ceil(length * 2));
  let total = 0;
  for (let i = 0; i <= steps; i++) {
    const tile = getTile(world, Math.round(from.x + (to.x - from.x) * i / steps), Math.round(from.y + (to.y - from.y) * i / steps));
    total += TERRAINS[tile?.terrain || 'plain'].movement;
  }
  return { distance: length, terrainFactor: total / (steps + 1) };
}
