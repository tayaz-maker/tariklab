import { campaignStatus, campaignCommand, emptyProgression, ensureProgression, progressOf, regionOf, completeProjects, progressionValid, PROJECT_QUOTAS } from './campaign.js';
import { SCHEMA_VERSION, RESOURCES, TERRAINS, POIS, BUILDINGS, UNITS, FACTION_PRESETS, VICTORY_PATHS, LIMITS, resourceObject, troopObject } from './data.js';
import { generateWorld, getTile, distance, sampleRoute, hashSeed, randomStream } from './world.js';

const RESOURCE_KEYS = Object.keys(RESOURCES), UNIT_KEYS = Object.keys(UNITS), BUILDING_KEYS = Object.keys(BUILDINGS);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const boundedString = (value, max = 100) => typeof value === 'string' && value.length <= max;
const cleanName = (value, fallback) => typeof value === 'string' ? Array.from(value).filter(char => char.charCodeAt(0) >= 32 && char !== '<' && char !== '>').join('').trim().slice(0, 36) || fallback : fallback;
const clone = value => JSON.parse(JSON.stringify(value));
const nextId = (state, prefix) => `${prefix}-${state.nextId++}`;
const fail = message => ({ ok: false, message });
const success = message => ({ ok: true, message });
export const getFaction = (state, id = state.playerId) => state.factions.find(faction => faction.id === id);
export const getSettlementAt = (state, x, y) => state.settlements.find(town => town.x === x && town.y === y) || null;
export const getPlayerSettlements = state => state.settlements.filter(town => town.ownerId === state.playerId);
export const getCapacity = town => 600 + town.buildings.warehouse * 600;
export const getTroopCount = troops => UNIT_KEYS.reduce((total, key) => total + (troops[key] || 0), 0);
const ownSettlements = (state, id) => state.settlements.filter(town => town.ownerId === id);
const relation = (state, a, b) => getFaction(state, a)?.relations[b] || { score: 0, truceUntil: 0, vasal: false };
const friendly = (state, a, b) => a === b || relation(state, a, b).vasal || relation(state, b, a).vasal;
const atPeace = (state, a, b) => friendly(state, a, b) || relation(state, a, b).truceUntil > state.time;
const pointCache = new WeakMap();
function worldPoints(state) {
  if (!pointCache.has(state.world)) pointCache.set(state.world, state.world.tiles.filter(tile => tile.poi));
  return pointCache.get(state.world);
}
const pointsFor = (state, town) => worldPoints(state).filter(tile => tile.poi.settlementId === town.id && tile.poi.ownerId === town.ownerId);
function random(state) {
  state.randomState = (state.randomState + 0x6d2b79f5) >>> 0;
  let t = Math.imul(state.randomState ^ (state.randomState >>> 15), 1 | state.randomState);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function report(state, type, title, text, critical = false) {
  state.reports.unshift({ id: nextId(state, 'report'), time: state.time, type, title, text, critical });
  if (state.reports.length > LIMITS.reports) state.reports.length = LIMITS.reports;
  if (critical && state.settings.autoPause) state.paused = true;
}
function influence(state, ownerId, amount) {
  const faction = getFaction(state, ownerId);
  faction.influence = clamp(faction.influence + amount, 0, LIMITS.influence);
}
function milestone(state, key, title, amount = 8, xp = 10) {
  if (state.campaign.milestones.includes(key)) return;
  state.campaign.milestones.push(key);
  influence(state, state.playerId, amount);
  state.dynasty.xp = Math.min(1000000, state.dynasty.xp + xp);
  report(state, 'milestone', title, `Hanedanınız ${amount} nüfuz ve ${xp} deneyim kazandı.`);
}
function makeTown(state, ownerId, x, y, name, initial = false) {
  return { id: nextId(state, 'town'), ownerId, x, y, name, resources: resourceObject(initial ? [360, 300, 240, 180] : [140, 100, 90, 60]),
    buildings: { farm: initial ? 2 : 1, lumber: 1, quarry: 1, mine: 1, warehouse: 1, barracks: 1, wall: initial ? 1 : 0, market: initial ? 1 : 0, hall: 1 },
    troops: { ...troopObject(), militia: initial ? 14 : 0, spear: initial ? 6 : 0, archer: initial ? 4 : 0, scout: initial ? 3 : 0 }, queue: [], lastStarvation: -1000 };
}

export function createGame({ seed = 'TL-SEDIR-49', size = 49, aiCount = 8, dynastyName = 'Yazhan' } = {}) {
  if (!integer(aiCount, 0, 10)) throw new RangeError('Rakip sayısı 0–10 arasında olmalı.');
  if (size < 25 && aiCount > 4) throw new RangeError('Küçük dünyada en fazla dört rakip olmalı.');
  const world = generateWorld(seed, size), center = Math.floor(size / 2);
  const state = { schemaVersion: SCHEMA_VERSION, playerId: 'player', time: 0, paused: true, speed: 1, nextId: 1, randomState: hashSeed(`${world.seed}:ai`), world,
    factions: [{ id: 'player', name: cleanName(dynastyName, 'Yazhan'), color: '#e9c674', archetype: 'player', archetypeLabel: 'Sizin hanedanınız', influence: 35, relations: {}, nextThink: 0 }],
    settlements: [], armies: [], reports: [], intel: {}, dynasty: { name: cleanName(dynastyName, 'Yazhan'), ruler: 'Aybars', heir: 'Umay', xp: 0,
      stats: { stewardship: 1, warfare: 1, commerce: 1, diplomacy: 1, intrigue: 1 }, traits: ['Kurucu'], pendingEvent: null, nextEvent: 2400, generation: 1 },
    campaign: { progression: emptyProgression(), stage: 1, victory: null, continued: false, milestones: [], tradeVolume: 0, battlesWon: 0, scouting: 0, buildingsCompleted: 0 },
    settings: { autoPause: true } };
  state.settlements.push(makeTown(state, 'player', center, center, 'Yazhisar', true));
  const spawnRandom = randomStream(`${world.seed}:spawns`), phase = spawnRandom() * 0.6;
  for (let index = 0; index < aiCount; index++) {
    const [name, color, archetype, archetypeLabel] = FACTION_PRESETS[index], angle = phase + index / Math.max(1, aiCount) * Math.PI * 2;
    const radius = size < 25 ? size * 0.36 : size * (0.33 + spawnRandom() * 0.055);
    let x = clamp(Math.round(center + Math.cos(angle) * radius), 1, size - 2), y = clamp(Math.round(center + Math.sin(angle) * radius), 1, size - 2);
    const id = `ai-${index + 1}`;
    // Any crowded tiny-world spawn is moved deterministically to a free site.
    if (state.settlements.some(town => distance(town, { x, y }) < 3)) {
      const site = world.tiles.find(tile => state.settlements.every(town => distance(town, tile) >= 3));
      if (!site) break;
      x = site.x; y = site.y;
    }
    const tile = getTile(world, x, y); tile.poi = null;
    state.factions.push({ id, name, color, archetype, archetypeLabel, influence: 80, relations: {}, nextThink: 120 + index * 19 });
    state.settlements.push(makeTown(state, id, x, y, `${name} Yurdu`, true));
  }
  for (const a of state.factions) for (const b of state.factions) if (a !== b) a.relations[b.id] = { score: 0, truceUntil: 0, vasal: false };
  report(state, 'welcome', 'Bir yurt, bir hanedan', 'Önce tarlayı geliştir; sonra yakın yaylaya gözcü gönder. Kaynaklar yerleşiminde birikir. Harita üzerinden yeni yurtlar ve ticaret ağı kur. Zamanı sen başlatırsın.');
  return state;
}

export function getRates(state, town) {
  const rates = {}, terrain = TERRAINS[getTile(state.world, town.x, town.y).terrain];
  const stat = town.ownerId === state.playerId ? state.dynasty.stats.stewardship : 1;
  RESOURCE_KEYS.forEach((key, index) => {
    const level = town.buildings[['farm', 'lumber', 'quarry', 'mine'][index]];
    let bonus = 1;
    for (const tile of pointsFor(state, town)) if (POIS[tile.poi.type].resource === key) bonus += POIS[tile.poi.type].bonus;
    rates[key] = (0.22 + level * 0.38) * terrain.rates[index] * bonus * (1 + stat * 0.025);
  });
  const traveling = state.armies.filter(army => army.fromId === town.id && army.ownerId === town.ownerId);
  const upkeep = UNIT_KEYS.reduce((sum, key) => sum + (town.troops[key] + traveling.reduce((n, army) => n + army.troops[key], 0)) * UNITS[key].upkeep, 0);
  const specialty = progressOf(state).specializations[town.id];
  if (specialty === 'granary') { rates.food *= 1.3; rates.iron *= 0.85; }
  if (specialty === 'workshop') { rates.wood *= 1.15; rates.stone *= 1.15; rates.iron *= 1.15; rates.food *= 0.8; }
  rates.food -= upkeep;
  return { ...rates, upkeep };
}
export function getBuildCost(state, town, building) {
  if (!BUILDINGS[building]) return null;
  const level = town.buildings[building] + town.queue.filter(item => item.kind === 'build' && item.building === building).length;
  return resourceObject(BUILDINGS[building].baseCost.map(value => Math.ceil(value * 1.42 ** level)));
}
export function getExpansionCost(state, ownerId = state.playerId) {
  const count = ownSettlements(state, ownerId).length + state.armies.filter(a => a.ownerId === ownerId && a.mission === 'expand' && !a.returning).length;
  const administration = Math.max(0, count - 3) ** 2;
  return { ...resourceObject([240 + count * 70 + administration * 25, 180 + count * 60 + administration * 25, 120 + count * 50 + administration * 20, 70 + count * 35 + administration * 15]), influence: 16 + count * 5 + administration };
}
export function getTravelEstimate(state, from, to, troops = {}) {
  const route = sampleRoute(state.world, from, to);
  const active = UNIT_KEYS.filter(key => troops[key] > 0);
  const speed = active.length ? Math.min(...active.map(key => UNITS[key].speed)) : 0.85;
  const town = from.id ? from : getSettlementAt(state, from.x, from.y);
  const passBonus = town && pointsFor(state, town).some(tile => tile.poi.type === 'pass') ? 0.85 : 1;
  const command = town?.ownerId === state.playerId ? 1 + state.dynasty.stats.warfare * 0.025 : 1;
  return { ...route, minutes: Math.max(2, Math.ceil(route.distance * 12 * route.terrainFactor * passBonus / speed / command)) };
}
export function getSettlementRole(state, town) {
  if (town === ownSettlements(state, town.ownerId)[0]) return 'Başkent';
  if (town.buildings.wall >= 4) return 'Sınır kalesi';
  if (town.buildings.barracks >= 4) return 'Ordu merkezi';
  if (town.buildings.market >= 3) return 'Ticaret merkezi';
  if (town.buildings.mine >= town.buildings.farm + 1) return 'Demir merkezi';
  return 'Tarım merkezi';
}
export function getTileKnowledge(state, x, y) {
  const tile = getTile(state.world, x, y);
  if (!tile) return null;
  const town = getSettlementAt(state, x, y), intel = state.intel[`${x},${y}`] || null;
  const own = town?.ownerId === state.playerId;
  return { visibility: own ? 'own' : intel ? 'surveyed' : 'unknown', terrain: tile.terrain, poi: tile.poi,
    settlement: town ? { id: town.id, ownerId: town.ownerId, x, y, name: town.name, population: Math.round(Object.values(town.buildings).reduce((a, b) => a + b, 0) * 12 / 50) * 50 } : null,
    intel: own ? { time: state.time, resources: town.resources, buildings: town.buildings, troops: town.troops, ownerId: town.ownerId } : intel,
    intelAge: intel ? state.time - intel.time : null, stale: !!intel && state.time - intel.time > 360 };
}
export function getArmyPosition(state, army) {
  const ratio = clamp((state.time - army.departAt) / Math.max(1, army.arriveAt - army.departAt), 0, 1);
  return { x: army.from.x + (army.to.x - army.from.x) * ratio, y: army.from.y + (army.to.y - army.from.y) * ratio };
}
export function isArmyVisible(state, army) {
  if (army.ownerId === state.playerId) return true;
  const position = getArmyPosition(state, army);
  return getPlayerSettlements(state).some(town => distance(town, position) <= 7) || worldPoints(state).some(tile => tile.poi.type === 'watchtower' && tile.poi.ownerId === state.playerId && distance(tile, position) <= 12);
}
const afford = (town, cost) => RESOURCE_KEYS.every(key => town.resources[key] >= (cost[key] || 0));
const pay = (town, cost) => RESOURCE_KEYS.forEach(key => { town.resources[key] -= cost[key] || 0; });
const addResources = (town, cargo) => RESOURCE_KEYS.forEach(key => { town.resources[key] = Math.min(getCapacity(town), town.resources[key] + (cargo[key] || 0)); });
const validResources = cargo => plain(cargo) && Object.keys(cargo).every(key => RESOURCE_KEYS.includes(key)) && RESOURCE_KEYS.every(key => cargo[key] === undefined || integer(cargo[key], 0, LIMITS.resource));
const validTroops = troops => plain(troops) && Object.keys(troops).every(key => UNIT_KEYS.includes(key)) && UNIT_KEYS.every(key => troops[key] === undefined || integer(troops[key], 0, LIMITS.troops));
const availableTroops = (town, troops) => validTroops(troops) && UNIT_KEYS.every(key => (troops[key] || 0) <= town.troops[key]);
function launch(state, town, mission, to, troops = {}, extra = {}) {
  const force = { ...troopObject(), ...troops }, estimate = getTravelEstimate(state, town, to, force);
  for (const key of UNIT_KEYS) town.troops[key] -= force[key];
  const army = { id: nextId(state, 'army'), ownerId: town.ownerId, mission, fromId: town.id, from: { x: town.x, y: town.y }, to: { x: to.x, y: to.y },
    departAt: state.time, arriveAt: state.time + estimate.minutes, troops: force, cargo: resourceObject(), returning: false, ...extra };
  state.armies.push(army);
  return army;
}
function setRelation(state, a, b, update) {
  Object.assign(getFaction(state, a).relations[b], update);
  Object.assign(getFaction(state, b).relations[a], update);
}
export function getMilitaryPower(state, ownerId) {
  return ownSettlements(state, ownerId).reduce((sum, town) => sum + combatPower(town.troops, 'attack'), 0) + state.armies.filter(a => a.ownerId === ownerId).reduce((sum, army) => sum + combatPower(army.troops, 'attack'), 0);
}
export function combatPower(troops, mode = 'attack') { return UNIT_KEYS.reduce((power, key) => power + (troops[key] || 0) * UNITS[key][mode], 0); }

export function dispatch(state, action) { return execute(state, action, state.playerId); }
function execute(state, action, ownerId) {
  if (!plain(action) || typeof action.type !== 'string') return fail('Geçersiz komut.');
  const player = ownerId === state.playerId, faction = getFaction(state, ownerId);
  if (!faction) return fail('Hanedan bulunamadı.');
  if (action.type === 'setSpeed') {
    if (![0, 1, 4, 12].includes(action.speed)) return fail('Zaman hızı geçersiz.');
    state.paused = action.speed === 0;
    if (action.speed) state.speed = action.speed;
    return success(action.speed ? `Zaman ${action.speed}× ilerliyor.` : 'Dünya duraklatıldı.');
  }
  if (action.type === 'diplomacy') {
    const other = getFaction(state, action.factionId), town = ownSettlements(state, ownerId)[0];
    if (!other || other.id === ownerId || !town) return fail('Geçerli bir rakip hanedan seç.');
    const rel = relation(state, ownerId, other.id);
    if (action.mode === 'gift') {
      if (rel.score >= 100) return fail('İlişki zaten en yüksek düzeyde.');
      const cost = resourceObject([100, 100, 0, 0]);
      if (faction.influence < 4 || !afford(town, cost)) return fail('Elçi hediyesi 100 erzak, 100 kereste ve 4 nüfuz ister.');
      pay(town, cost); influence(state, ownerId, -4);
      setRelation(state, ownerId, other.id, { score: Math.min(100, rel.score + 18 + (player ? state.dynasty.stats.diplomacy : 1)) });
    } else if (action.mode === 'truce') {
      if (rel.truceUntil > state.time + 720) return fail('Mevcut ateşkesin bitmesine henüz çok var.');
      if (faction.influence < 12) return fail('Ateşkes için 12 nüfuz gerekiyor.');
      if (rel.score < 15 && getMilitaryPower(state, ownerId) < getMilitaryPower(state, other.id) * 0.75) return fail('Önce hediye ile ilişkiyi güçlendir veya savunmanı büyüt.');
      influence(state, ownerId, -12); setRelation(state, ownerId, other.id, { truceUntil: state.time + 2400 });
    } else if (action.mode === 'vasal') {
      if (rel.vasal || relation(state, other.id, ownerId).vasal) return fail('Bu hanedan zaten bağlı.');
      if (rel.score < 60 || faction.influence < 45 || ownSettlements(state, ownerId).length < 3 || getMilitaryPower(state, ownerId) < getMilitaryPower(state, other.id)) return fail('Bağlılık: ilişki 60, nüfuz 45, en az 3 yurt ve rakipten güçlü ordu gerekiyor.');
      influence(state, ownerId, -45);
      getFaction(state, other.id).relations[ownerId].vasal = true;
      setRelation(state, ownerId, other.id, { truceUntil: state.time + 1000000 });
      if (player) milestone(state, `vasal:${other.id}`, `${other.name} sancağı bağlandı`, 30, 40);
    } else return fail('Diplomasi kararı geçersiz.');
    if (player) report(state, 'diplomacy', `${other.name}: ${action.mode === 'gift' ? 'elçi kabul edildi' : action.mode === 'truce' ? 'ateşkes' : 'bağlılık'}`, action.mode === 'truce' ? '2400 oyun dakikası boyunca karşılıklı saldırı durur. Yoldaki kuvvetler de ateşkese uyar.' : 'İlişki ve anlaşma durumu Divan panelinde güncellendi.');
    return success('Diplomasi kararı uygulandı.');
  }
  if (action.type === 'dynasty') {
    if (!Object.hasOwn(state.dynasty.stats, action.choice)) return fail('Gelişim alanı geçersiz.');
    const stat = state.dynasty.stats[action.choice], cost = 30 + stat * 15;
    if (stat >= 10 || state.dynasty.xp < cost) return fail(`Bu gelişim ${cost} deneyim ister; üst sınır 10.`);
    state.dynasty.xp -= cost; state.dynasty.stats[action.choice]++;
    if (stat === 4 && state.dynasty.traits.length < 8) state.dynasty.traits.push({ stewardship: 'İmarcı', warfare: 'Serdar', commerce: 'Kervancı', diplomacy: 'Uzlaştırıcı', intrigue: 'Gölge ustası' }[action.choice]);
    return success('Reisin yeteneği gelişti.');
  }
  if (action.type === 'event') {
    if (!state.dynasty.pendingEvent || !['mentor', 'marry', 'study'].includes(action.choice)) return fail('Bekleyen bir hanedan kararı yok.');
    const choice = action.choice, town = getPlayerSettlements(state)[0];
    if (choice === 'marry' && getFaction(state).influence < 15) return fail('Siyasi evlilik için 15 nüfuz gerekiyor.');
    if (choice === 'study' && !afford(town, { food: 120, wood: 80 })) return fail('Eğitim için 120 erzak ve 80 kereste gerekiyor.');
    if (choice === 'marry') { influence(state, state.playerId, -15); for (const other of state.factions.filter(f => f.id !== state.playerId)) setRelation(state, state.playerId, other.id, { score: Math.min(100, relation(state, state.playerId, other.id).score + 15) }); }
    if (choice === 'study') { pay(town, { food: 120, wood: 80 }); state.dynasty.xp = Math.min(1000000, state.dynasty.xp + 80); }
    if (choice === 'mentor') state.dynasty.xp = Math.min(1000000, state.dynasty.xp + 30);
    state.dynasty.pendingEvent = null; state.dynasty.nextEvent = state.time + 4800;
    report(state, 'dynasty', 'Varisin yolu', choice === 'marry' ? 'Umay, hanedanlar arasında yeni bağlar kurdu. Bütün ilişkiler +15.' : choice === 'study' ? 'Varis divan hocalarıyla çalıştı. Deneyim +80.' : 'Reis bilgilerini varisine aktardı. Deneyim +30.');
    return success('Varisin kararı işlendi.');
  }
  if (action.type === 'victory') {
    const path = getCampaign(state).paths.find(item => item.id === action.path);
    if (!path?.ready || state.campaign.victory) return fail('Kurultay koşulları henüz tamamlanmadı.');
    state.campaign.victory = action.path; state.paused = true;
    report(state, 'victory', 'Büyük Kurultay toplandı', `${path.label} yolu tamamlandı. Hanedanının öyküsünü serbest devam modunda sürdürebilirsin.`, true);
    return success('Kurultay zaferinizi tanıdı.');
  }
  if (action.type === 'continue') {
    if (!state.campaign.victory) return fail('Önce bir Kurultay yolu tamamlanmalı.');
    state.campaign.continued = true; return success('Serbest devam modu açıldı. Zaman kontrolünden dünyayı ilerletebilirsin.');
  }
  if (action.type === 'recall') {
    const army = state.armies.find(item => item.id === action.armyId && item.ownerId === ownerId);
    if (!army || army.returning) return fail('Geri çağrılabilecek bir sefer yok.');
    const home = state.settlements.find(town => town.id === army.fromId && town.ownerId === ownerId) || ownSettlements(state, ownerId)[0];
    if (!home) return fail('Dönülecek yurt kalmadı.');
    const position = getArmyPosition(state, army), duration = getTravelEstimate(state, position, home, army.troops).minutes;
    army.from = position; army.to = { x: home.x, y: home.y }; army.fromId = home.id; army.departAt = state.time; army.arriveAt = state.time + duration; army.returning = true;
    return success('Sefer geri çağrıldı; birlikler yolculuk sonunda dönecek.');
  }
  const town = state.settlements.find(item => item.id === action.settlementId && item.ownerId === ownerId);
  if (!town) return fail('Kendi yerleşimlerinden birini seç.');
  if (player && ['specialize','project','contribute','supplyOrder','cancelSupply'].includes(action.type)) return campaignCommand(state, action, town);
  if (action.type === 'build') {
    if (!Object.hasOwn(BUILDINGS, action.building)) return fail('Bina türü geçersiz.');
    const def = BUILDINGS[action.building], level = town.buildings[action.building] + town.queue.filter(item => item.kind === 'build' && item.building === action.building).length;
    if (town.queue.length >= LIMITS.queue) return fail('İş kuyruğu dolu; en fazla 6 iş alınabilir.');
    if (level >= def.maxLevel) return fail('Bu yapı en yüksek seviyede.');
    const cost = getBuildCost(state, town, action.building);
    if (!afford(town, cost)) return fail('Bu gelişim için kaynak yetersiz.');
    const minutes = Math.ceil(def.minutes * (1 + level * 0.3) / (1 + town.buildings.hall * 0.06));
    const startAt = Math.max(state.time, town.queue.at(-1)?.completeAt || 0);
    pay(town, cost);
    town.queue.push({ id: nextId(state, 'job'), kind: 'build', building: action.building, level: level + 1, startAt, completeAt: startAt + minutes });
    return success(`${def.label} ${level + 1}. seviye için kuyruğa alındı.`);
  }
  if (action.type === 'demobilize') {
    if (!Object.hasOwn(UNITS, action.unit) || !integer(action.count,1,LIMITS.troops) || action.count > town.troops[action.unit]) return fail('Garnizondaki geçerli sayıda birliği terhis et.');
    town.troops[action.unit] -= action.count;
    return success('Birlikler terhis edildi; iaşe ihtiyacı azaldı. Eğitim maliyeti iade edilmez.');
  }
  if (action.type === 'train') {
    if (!Object.hasOwn(UNITS, action.unit) || !integer(action.count, 1, 100)) return fail('1–100 arasında geçerli bir birlik sayısı seç.');
    const def = UNITS[action.unit], queued = town.queue.filter(item => item.kind === 'train').reduce((sum, item) => sum + item.count, 0);
    if (town.buildings.barracks < def.barracks) return fail(`Bu birlik talimgâh ${def.barracks}. seviye ister.`);
    if (town.queue.length >= LIMITS.queue || getTroopCount(town.troops) + queued + action.count > LIMITS.troops) return fail('İş kuyruğu veya birlik sınırı dolu.');
    const cost = resourceObject(def.cost.map(value => value * action.count));
    if (!afford(town, cost)) return fail('Birlik eğitimi için kaynak yetersiz.');
    const startAt = Math.max(state.time, town.queue.at(-1)?.completeAt || 0);
    pay(town, cost);
    town.queue.push({ id: nextId(state, 'job'), kind: 'train', unit: action.unit, count: action.count, startAt, completeAt: startAt + Math.ceil(def.minutes * action.count / (1 + town.buildings.barracks * 0.1)) });
    return success(`${action.count} ${def.label} eğitim kuyruğunda.`);
  }
  if (state.armies.length >= LIMITS.armies) return fail('Dünya sefer kapasitesi dolu; dönüşleri bekle.');
  if (action.type === 'trade' || action.type === 'supply') {
    const target = state.settlements.find(item => item.id === action.targetId);
    if (!target || target === town || !friendly(state, ownerId, target.ownerId)) return fail('Kendi veya bağlı bir hanedanın başka yerleşimini seç.');
    if (town.buildings.market < 1 || !validResources(action.cargo)) return fail('Kervan avlusu ve geçerli bir yük gerekiyor.');
    const total = RESOURCE_KEYS.reduce((sum, key) => sum + (action.cargo[key] || 0), 0), capacity = getTradeCapacity(state, town);
    if (total < (action.type === 'supply' ? 4 : 10) || total > capacity || !afford(town, action.cargo)) return fail(`Kervan yükü 10–${capacity} arasında ve mevcut kaynakların içinde olmalı.`);
    if (state.armies.filter(a => a.fromId === town.id && a.mission === 'trade').length >= town.buildings.market) return fail('Kervanlar yolda; avlu seviyesini artır veya dönüşlerini bekle.');
    if (action.type === 'supply' && (!player || target.ownerId !== ownerId || regionOf(state,town) === regionOf(state,target) || !Object.hasOwn(VICTORY_PATHS, action.path))) return fail('İkmal farklı bölgedeki kendi yatırımına gitmeli.');
    pay(town, action.cargo); launch(state, town, 'trade', target, {}, { ...(action.type === 'supply' ? {supplyPath:action.path} : {}), cargo: { ...resourceObject(), ...action.cargo }, targetId: target.id });
    return success('Kervan yola çıktı. Teslim edilen yük mesafeye bağlı ticaret primi getirir.');
  }
  const tile = getTile(state.world, action.x, action.y);
  if (!tile) return fail('Harita sınırları içinde bir karo seç.');
  const target = getSettlementAt(state, tile.x, tile.y);
  if (distance(town, tile) < 0.5) return fail('Sefer hedefi çıkış yerleşiminden farklı olmalı.');
  if (action.type === 'expand') {
    const cost = getExpansionCost(state, ownerId);
    if (target || tile.poi || state.settlements.some(other => distance(other, tile) < 3) || state.armies.some(a => a.mission === 'expand' && !a.returning && distance(a.to, tile) < 3)) return fail('Yeni yurt özel noktasız, yerleşimlerden ve yoldaki kuruculardan en az 3 karo uzakta olmalı.');
    if (distance(town, tile) > 8 + town.buildings.hall * 2) return fail('Bu karo genişleme menzilinin dışında; konağı geliştir.');
    if (state.settlements.length >= LIMITS.settlements || ownSettlements(state, ownerId).length + state.armies.filter(a => a.ownerId === ownerId && a.mission === 'expand' && !a.returning).length >= LIMITS.perFaction) return fail('Yerleşim sınırına ulaşıldı.');
    if (faction.influence < cost.influence || !afford(town, cost)) return fail(`Kurucu seferi için kaynaklar ve ${cost.influence} nüfuz gerekiyor.`);
    pay(town, cost); influence(state, ownerId, -cost.influence);
    launch(state, town, 'expand', tile, {}, { cargo: resourceObject(RESOURCE_KEYS.map(key => cost[key])), influenceCost: cost.influence, name: cleanName(action.name, `${faction.name} ${ownSettlements(state, ownerId).length + 1}`) });
    return success('Kurucu kervanı yolda. Yerleşim, hedefe ulaşıldığında kurulacak.');
  }
  if (action.type === 'scout') {
    const count = action.count === undefined ? 1 : action.count;
    if (!integer(count, 1, 100) || count > town.troops.scout) return fail('Gönderilecek kadar gözcü yok.');
    launch(state, town, 'scout', tile, { scout: count }); return success('Gözcüler yolda; rapor varışta gelir ve zamanla eskir.');
  }
  if (action.type === 'attack' || action.type === 'claim') {
    if (!availableTroops(town, action.troops) || getTroopCount(action.troops) < 1 || combatPower(action.troops) < 5) return fail('Mevcut kuvvetinden geçerli bir sefer birliği seç.');
    if (action.type === 'attack' && (!target || target.ownerId === ownerId)) return fail('Saldırı için rakip yerleşimi seç.');
    const opponent = target?.ownerId || tile.poi?.ownerId;
    if (opponent && atPeace(state, ownerId, opponent)) return fail('Dost veya ateşkes yapılan hanedana saldırılamaz.');
    if (action.type === 'claim') {
      if (!tile.poi || tile.poi.ownerId === ownerId) return fail('Bağlanabilecek bir stratejik nokta seç.');
      if (distance(town, tile) > 7 || pointsFor(state, town).length >= 4) return fail('Nokta en fazla 7 karo uzakta olmalı; yurt başına en fazla 4 nokta bağlanır.');
      if (state.armies.some(a => a.mission === 'claim' && a.ownerId === ownerId && !a.returning && a.to.x === tile.x && a.to.y === tile.y)) return fail('Bu noktaya zaten bir sefer gidiyor.');
      if (faction.influence < 5) return fail('Nokta bağlamak 5 nüfuz ister.');
      influence(state, ownerId, -5);
    }
    launch(state, town, action.type, tile, action.troops);
    if (!player && opponent === state.playerId) report(state, 'threat', 'Sınırda sefer hazırlığı', `${faction.name} birlikleri ${target?.name || 'stratejik noktanıza'} doğru ilerliyor. Savunma hazırla, ateşkes yap veya erzak taşı.`, true);
    return success(`${action.type === 'claim' ? 'Stratejik nokta' : 'Saldırı'} seferi yola çıktı.`);
  }
  return fail('Bilinmeyen komut.');
}

export function getTradeCapacity(state, town) { return Math.floor(town.buildings.market * 220 * (pointsFor(state, town).some(tile => tile.poi.type === 'caravanserai') ? 1.5 : 1)); }
function returnArmy(state, army) {
  const home = state.settlements.find(town => town.id === army.fromId && town.ownerId === army.ownerId) || ownSettlements(state, army.ownerId)[0];
  if (!home) { army.remove = true; return; }
  const start = { ...army.to }, duration = getTravelEstimate(state, start, home, army.troops).minutes;
  army.fromId = home.id; army.from = start; army.to = { x: home.x, y: home.y }; army.departAt = state.time; army.arriveAt = state.time + duration; army.returning = true;
}
function casualties(troops, proportion) {
  for (const key of UNIT_KEYS) troops[key] = Math.max(0, troops[key] - Math.ceil(troops[key] * clamp(proportion, 0, 1)));
}
function resolveArmy(state, army) {
  const player = army.ownerId === state.playerId, target = getSettlementAt(state, army.to.x, army.to.y), tile = getTile(state.world, army.to.x, army.to.y);
  if (army.returning) {
    const home = state.settlements.find(town => town.id === army.fromId && town.ownerId === army.ownerId);
    if (!home) { returnArmy(state, army); return; }
    for (const key of UNIT_KEYS) home.troops[key] = Math.min(LIMITS.troops, home.troops[key] + army.troops[key]);
    addResources(home, army.cargo);
    if (army.influenceCost) influence(state, army.ownerId, army.influenceCost);
    if (player) report(state, 'return', `${home.name}: sefer döndü`, `${getTroopCount(army.troops)} birlik ve taşınan kaynaklar yerleşime ulaştı. Depo kapasitesini aşan yük kullanılamadı.`);
    army.remove = true; return;
  }
  if (army.mission === 'expand') {
    if (!target && !tile.poi && state.settlements.every(other => distance(other, tile) >= 3) && state.settlements.length < LIMITS.settlements && ownSettlements(state, army.ownerId).length < LIMITS.perFaction) {
      const town = makeTown(state, army.ownerId, tile.x, tile.y, army.name);
      state.settlements.push(town); army.remove = true;
      if (player) { milestone(state, `settled:${town.id}`, `${town.name} kuruldu`, 18, 25); report(state, 'settlement', 'Yeni yurdun hazır', `${town.name} kaynak üretmeye başladı. Kervan avlusu kurarak yerleşimlerini birbirine bağla.`, true); }
    } else { if (player) report(state, 'blocked', 'Kurucular geri dönüyor', 'Hedef artık uygun değil. İnşa yükü ve harcanan nüfuz dönüşte geri verilecek.'); returnArmy(state, army); }
    return;
  }
  if (army.mission === 'scout') {
    const opposition = target && target.ownerId !== army.ownerId ? target.troops.scout : 0;
    const survived = army.troops.scout * (player ? 2.5 + state.dynasty.stats.intrigue * 0.5 : 3) >= opposition;
    if (player && survived) {
      state.intel[`${tile.x},${tile.y}`] = { time: state.time, ownerId: target?.ownerId || tile.poi?.ownerId || null, resources: target ? clone(target.resources) : resourceObject(), buildings: target ? clone(target.buildings) : {}, troops: target ? clone(target.troops) : troopObject() };
      state.campaign.scouting++; milestone(state, 'first-scout', 'Ufuk açıldı', 10, 15);
      report(state, 'scout', `${target?.name || `${tile.x}, ${tile.y}`}: istihbarat geldi`, target ? 'Birlik, depo ve yapı bilgileri doğrulandı. 360 oyun dakikasından sonra rapor eski sayılır.' : 'Arazi ve stratejik nokta araştırıldı. Nokta korumasını harita bilgi panelinden karşılaştır.');
    } else if (player) report(state, 'scout', 'Gözcüler yakalandı', 'Hedefteki karşı gözcüler seferi durdurdu. Daha kalabalık bir gözcü birliği gönder.');
    if (!survived) army.troops.scout = 0;
    returnArmy(state, army); return;
  }
  if (army.mission === 'trade' && army.supplyPath) {
    if (player && target?.ownerId === state.playerId && target.id === army.targetId) {
      const p = ensureProgression(state), region = regionOf(state,target), project = p.projects[`${army.supplyPath}:${region}`];
      const amount = Math.floor(Math.min(...RESOURCE_KEYS.map(k=>army.cargo[k])));
      let used = 0;
      if (project?.active && project.townId === target.id) { used = Math.min(amount, PROJECT_QUOTAS[project.level]-project.imported); project.imported += used; }
      else if (project?.level === 3 && getCampaign(state).paths.find(x=>x.id===army.supplyPath)?.eligible) {
        const finale = p.finales[army.supplyPath] ||= {}; used = Math.min(amount, 12000-(finale[region]||0)); finale[region]=(finale[region]||0)+used;
      }
      if (used > 0) {
        for (const k of RESOURCE_KEYS) army.cargo[k] -= used;
        const edge = `${army.fromId}:${target.id}`, link = p.logistics[edge] ||= {from:army.fromId,to:target.id,delivered:0};
        link.delivered = Math.min(100000000,link.delivered+used*4);
      }
    }
    returnArmy(state,army); return;
  }
  if (army.mission === 'trade') {
    if (target && target.id === army.targetId && friendly(state, army.ownerId, target.ownerId)) {
      const delivered = RESOURCE_KEYS.reduce((sum, key) => sum + Math.min(army.cargo[key], Math.max(0, getCapacity(target) - target.resources[key])), 0);
      addResources(target, army.cargo);
      const home = state.settlements.find(town => town.id === army.fromId), commerce = player ? state.dynasty.stats.commerce : 1;
      const han = home && pointsFor(state, home).some(t => t.poi.type === 'caravanserai') ? 0.1 : 0;
      const bonus = Math.floor(delivered * Math.min(0.4, 0.04 + distance(army.from, army.to) * 0.012 + commerce * 0.01 + han));
      army.cargo = resourceObject([0, 0, 0, bonus]);
      if (player) {
        const previous = Math.floor(state.campaign.tradeVolume / 1000);
        state.campaign.tradeVolume = Math.min(100000000, state.campaign.tradeVolume + delivered);
        if (delivered) milestone(state, 'first-trade', 'İlk kervan ulaştı', 12, 15);
        for (let band = previous + 1; band <= Math.floor(state.campaign.tradeVolume / 1000); band++) if (band <= 200) milestone(state, `trade:${band}`, `${band * 1000} yük ticareti`, 6, 8);
        report(state, 'trade', 'Kervan teslimatı', `${target.name}: ${Math.floor(delivered)} yük teslim edildi; ${bonus} demir prim olarak dönüş yolunda. Dolu depoya sığmayan yük ticaret sayılmaz.`);
      }
    } else if (player) report(state, 'trade', 'Kervan yolu değişti', 'Hedef artık dost değil. Yük geri getiriliyor.');
    returnArmy(state, army); return;
  }
  if (army.mission === 'claim') {
    const home = state.settlements.find(town => town.id === army.fromId && town.ownerId === army.ownerId);
    if (!tile.poi || !home || tile.poi.ownerId === army.ownerId || (tile.poi.ownerId && atPeace(state, army.ownerId, tile.poi.ownerId)) || pointsFor(state, home).length >= 4) { returnArmy(state, army); return; }
    const power = combatPower(army.troops) * (player ? 1 + state.dynasty.stats.warfare * 0.035 : 1), guard = POIS[tile.poi.type].guard * (tile.poi.ownerId ? 2.4 : 1);
    const won = power > guard;
    casualties(army.troops, won ? Math.min(0.4, guard / power * 0.3) : 0.7);
    if (won) {
      tile.poi.ownerId = army.ownerId; tile.poi.settlementId = home.id;
      if (player) milestone(state, `poi:${tile.poi.id}`, `${POIS[tile.poi.type].label} bağlandı`, tile.poi.type === 'ruins' ? 15 : 8, 20);
    }
    if (player) report(state, 'claim', won ? 'Sancak dikildi' : 'Sefer geri çekildi', won ? `${POIS[tile.poi.type].label}, ${home.name} yerleşimine katkı sağlıyor. Sağ kalan birlikler dönüyor.` : `Koruma gücü ${guard}; sefer gücü ${Math.floor(power)}. Daha güçlü birlik ve güncel keşifle yeniden dene.`);
    returnArmy(state, army); return;
  }
  if (army.mission === 'attack') {
    if (!target || atPeace(state, army.ownerId, target.ownerId)) { returnArmy(state, army); return; }
    const defenderPlayer = target.ownerId === state.playerId, attackerBefore = getTroopCount(army.troops), defenderBefore = getTroopCount(target.troops);
    const offense = combatPower(army.troops) * (player ? 1 + state.dynasty.stats.warfare * 0.04 : 1);
    const wall = Math.max(0, target.buildings.wall - Math.floor(army.troops.siege / 3));
    const defense = Math.max(15, combatPower(target.troops, 'defense')) * TERRAINS[tile.terrain].defense * (1 + wall * 0.15) * (defenderPlayer ? 1 + state.dynasty.stats.warfare * 0.025 : 1);
    const won = offense > defense, oldOwner = target.ownerId;
    casualties(army.troops, won ? clamp(defense / Math.max(1, offense) * 0.55, 0.03, 0.65) : 0.68);
    casualties(target.troops, won ? 0.8 : clamp(offense / defense * 0.4, 0.02, 0.5));
    if (army.troops.siege > 0 && offense > defense * 0.6) target.buildings.wall = Math.max(0, target.buildings.wall - 1);
    let captured = false;
    if (won) {
      const carry = UNIT_KEYS.reduce((sum, key) => sum + army.troops[key] * UNITS[key].carry, 0);
      for (const key of RESOURCE_KEYS) { const amount = Math.min(Math.floor(target.resources[key] * 0.25), Math.floor(carry / 4)); target.resources[key] -= amount; army.cargo[key] += amount; }
      // Founding capitals remain recovery anchors; conquest requires siege and a non-capital.
      const capital = ownSettlements(state, oldOwner)[0];
      if (target !== capital && army.troops.siege >= 2 && ownSettlements(state, army.ownerId).length < LIMITS.perFaction) {
        target.ownerId = army.ownerId; target.troops = troopObject(); target.queue = [];
        for (const point of pointsFor(state, { ...target, ownerId: oldOwner })) { point.poi.ownerId = army.ownerId; }
        captured = true;
      }
      if (player) { if (defense >= 1200) ensureProgression(state).rivals[oldOwner] = Math.max(progressOf(state).rivals[oldOwner] || 0, Math.floor(defense)); state.campaign.battlesWon++; milestone(state, captured ? `conquest:${target.id}` : 'first-battle', captured ? 'Yeni sancak' : 'İlk zafer', captured ? 15 : 12, 30); }
    }
    setRelation(state, army.ownerId, oldOwner, { score: Math.max(-100, relation(state, army.ownerId, oldOwner).score - 15) });
    if (player || defenderPlayer) report(state, 'battle', `${target.name}: ${captured ? 'sancak değişti' : won ? 'akın sonuçlandı' : 'savunma kazandı'}`,
      `Saldırı ${Math.round(offense)} / savunma ${Math.round(defense)}. Saldıran kaybı ${attackerBefore - getTroopCount(army.troops)}; savunan kaybı ${defenderBefore - getTroopCount(target.troops)}. ${captured ? 'Yerleşim ele geçirildi.' : 'Başkentler ele geçirilemez; sefer yağma ve kayıp üretir.'}`, defenderPlayer);
    returnArmy(state, army);
  }
}

export function getCampaign(state) {
  const towns = getPlayerSettlements(state), points = worldPoints(state).filter(t => t.poi.ownerId === state.playerId).length;
  const vasals = state.factions.filter(f => f.id !== state.playerId && f.relations[state.playerId]?.vasal).length;
  const peaceful = state.factions.filter(f => f.id !== state.playerId && (f.relations[state.playerId]?.vasal || f.relations[state.playerId]?.truceUntil > state.time)).length;
  const wealth = towns.reduce((sum, town) => sum + RESOURCE_KEYS.reduce((n, key) => n + town.resources[key], 0), 0);
  const influenceNow = getFaction(state).influence, power = getMilitaryPower(state, state.playerId);
  return campaignStatus(state, { points, vasals, peaceful, wealth, power, influenceNow });
}

function thinkAI(state, faction) {
  const towns = ownSettlements(state, faction.id);
  if (!towns.length) return;
  const town = towns[Math.floor(random(state) * towns.length)], actions = (type, extras) => execute(state, { type, settlementId: town.id, ...extras }, faction.id);
  faction.nextThink = state.time + 105 + Math.floor(random(state) * 80);
  const incoming = state.armies.some(a => !a.returning && a.mission === 'attack' && a.ownerId !== faction.id && a.to.x === town.x && a.to.y === town.y);
  if (incoming) {
    const attacker = state.armies.find(a => a.mission === 'attack' && a.to.x === town.x && a.to.y === town.y && a.ownerId !== faction.id);
    if (faction.influence >= 12 && random(state) < 0.3) execute(state, { type: 'diplomacy', mode: 'truce', factionId: attacker.ownerId }, faction.id);
    actions('train', { unit: 'spear', count: 5 }); actions('build', { building: 'wall' });
  }
  // All development uses the same costs and queues as the player. No free resources.
  const rates = getRates(state, town), minResource = RESOURCE_KEYS.reduce((a, b) => town.resources[a] < town.resources[b] ? a : b);
  const choices = { food: 'farm', wood: 'lumber', stone: 'quarry', iron: 'mine' };
  let building = rates.food < 0.4 ? 'farm' : choices[minResource];
  if (RESOURCE_KEYS.some(key => town.resources[key] > getCapacity(town) * 0.85)) building = 'warehouse';
  if (state.time > 900 && town.buildings.barracks < 3 && random(state) < 0.25) building = 'barracks';
  if (faction.archetype === 'fortress' && town.buildings.wall < 4 && random(state) < 0.3) building = 'wall';
  if (town.buildings.hall < 5 && faction.influence < 40 && town.queue.length < 2) building = 'hall';
  if (town.queue.length < 2) actions('build', { building });
  const troopLimit = 55 + Math.min(110, state.time / 70);
  if (getTroopCount(town.troops) < troopLimit && town.queue.length < 3 && rates.food > 0.2) {
    const unit = town.troops.scout < 3 ? 'scout' : town.buildings.barracks >= 3 && faction.archetype === 'raider' ? 'rider' : town.buildings.barracks >= 2 && random(state) > 0.5 ? 'archer' : 'spear';
    actions('train', { unit, count: 3 + Math.floor(random(state) * 4) });
  }
  if (state.time > 800 && towns.length < Math.min(7, 1 + Math.floor(state.time / 1000)) && !state.armies.some(a => a.ownerId === faction.id && a.mission === 'expand')) {
    const candidates = state.world.tiles.filter(tile => !tile.poi && distance(tile, town) >= 3 && distance(tile, town) <= 8 && state.settlements.every(other => distance(tile, other) >= 3));
    if (candidates.length) { const site = candidates[Math.floor(random(state) * candidates.length)]; actions('expand', { x: site.x, y: site.y }); }
  }
  if (state.time > 300 && pointsFor(state, town).length < 2 && random(state) < 0.35) {
    const point = state.world.tiles.find(tile => tile.poi && !tile.poi.ownerId && distance(town, tile) <= 7);
    if (point) actions('claim', { x: point.x, y: point.y, troops: { militia: Math.floor(town.troops.militia * 0.6), spear: Math.floor(town.troops.spear * 0.4) } });
  }
  if (towns.length > 1 && random(state) < 0.4) {
    if (!town.buildings.market) actions('build', { building: 'market' });
    else {
      const target = towns.find(t => t !== town && t.resources.food < town.resources.food);
      if (target && town.resources.food > 180) actions('trade', { targetId: target.id, cargo: { food: Math.min(150, Math.floor(town.resources.food / 3)) } });
    }
  }
  const rivals = state.settlements.filter(other => other.ownerId !== faction.id && !atPeace(state, faction.id, other.ownerId));
  rivals.sort((a, b) => (combatPower(a.troops, 'defense') + distance(town, a) * 30) - (combatPower(b.troops, 'defense') + distance(town, b) * 30));
  const target = rivals[0];
  if (target && state.time > 450 && town.troops.scout && random(state) < 0.3 && !state.armies.some(a => a.fromId === town.id && a.mission === 'scout')) actions('scout', { x: target.x, y: target.y, count: 1 });
  if (target && state.time > 2400 && (target.ownerId !== state.playerId || state.time > 3600) && distance(town, target) < 20 && !state.armies.some(a => a.ownerId === faction.id && a.mission === 'attack')) {
    const troops = Object.fromEntries(UNIT_KEYS.map(key => [key, key === 'scout' ? 0 : Math.floor(town.troops[key] * 0.55)]));
    const defense = Math.max(15, combatPower(target.troops, 'defense')) * (1 + target.buildings.wall * 0.15) * TERRAINS[getTile(state.world, target.x, target.y).terrain].defense;
    if (combatPower(troops) > defense * 1.3 && random(state) < (faction.archetype === 'raider' ? 0.7 : 0.3)) actions('attack', { x: target.x, y: target.y, troops });
  }
  for (const army of state.armies.filter(a => a.ownerId === faction.id && a.mission === 'attack' && !a.returning)) {
    const opponent = getSettlementAt(state, army.to.x, army.to.y);
    if (opponent && combatPower(opponent.troops, 'defense') > combatPower(army.troops) * 1.8) execute(state, { type: 'recall', armyId: army.id }, faction.id);
  }
}

function tick(state, rateCache) {
  state.time++;
  for (const town of state.settlements) {
    const rates = rateCache.get(town.id) || getRates(state, town), capacity = getCapacity(town);
    rateCache.set(town.id, rates);
    for (const key of RESOURCE_KEYS) town.resources[key] = clamp(town.resources[key] + rates[key], 0, capacity);
    if (town.resources.food === 0 && rates.food < 0 && state.time - town.lastStarvation >= 60) {
      const unit = UNIT_KEYS.find(key => town.troops[key] > 0);
      if (unit) town.troops[unit]--;
      town.lastStarvation = state.time; rateCache.delete(town.id);
      if (town.ownerId === state.playerId) report(state, 'shortage', `${town.name}: iaşe daralıyor`, 'Erzak üretimi birlik bakımını karşılamıyor. Bir asker ayrıldı. Tarlayı geliştir veya başka yurttan erzak taşı.', true);
    }
    while (town.queue[0]?.completeAt <= state.time) {
      const item = town.queue.shift(); rateCache.delete(town.id);
      if (item.kind === 'build') {
        town.buildings[item.building] = item.level;
        if (town.ownerId === state.playerId) {
          state.campaign.buildingsCompleted++;
          milestone(state, 'first-build', 'İlk imar tamamlandı', 8, 12);
          if (item.building === 'hall') milestone(state, `hall:${town.id}:${item.level}`, `${town.name}: konak büyüdü`, 10, 15);
          if (state.campaign.buildingsCompleted % 10 === 0) milestone(state, `build:${state.campaign.buildingsCompleted}`, 'İmar ağı genişledi', 12, 20);
          report(state, 'build', `${town.name}: yapı hazır`, `${BUILDINGS[item.building].label}, seviye ${item.level}.`);
        } else if (item.building === 'hall') influence(state, town.ownerId, 10);
      } else {
        town.troops[item.unit] = Math.min(LIMITS.troops, town.troops[item.unit] + item.count);
        if (town.ownerId === state.playerId) report(state, 'train', `${town.name}: birlik hazır`, `${item.count} ${UNITS[item.unit].label} talimi tamamladı.`);
      }
    }
  }
  for (const army of [...state.armies]) if (army.arriveAt <= state.time) { resolveArmy(state, army); rateCache.clear(); }
  state.armies = state.armies.filter(army => !army.remove);
  for (const faction of state.factions) if (faction.id !== state.playerId && state.time >= faction.nextThink) thinkAI(state, faction);
  if (state.time >= state.dynasty.nextEvent && !state.dynasty.pendingEvent) {
    state.dynasty.pendingEvent = { id: nextId(state, 'event'), type: 'heir', title: 'Varis divana geliyor', text: 'Umay ilk sorumluluğunu istiyor. Mentorluk ücretsiz deneyim, eğitim daha çok deneyim, siyasi evlilik ise ilişki kazandırır.' };
    report(state, 'dynasty', 'Hanedan kararı bekliyor', 'Varisin geleceğini Hanedan bölümünde belirle. Zamanı istediğinde sürdürebilirsin.', true);
  }
  if (state.time % 60 !== 0) return;
  completeProjects(state);
  for (const [id, order] of Object.entries(progressOf(state).supply)) {
    const town = state.settlements.find(t=>t.id===id && t.ownerId===state.playerId);
    const target = state.settlements.find(t=>t.id===order.targetId && t.ownerId===state.playerId);
    if (!town || !target || state.armies.filter(a=>a.fromId===town.id&&a.mission==='trade').length >= Math.max(1,town.buildings.market-1)) continue;
    const project = progressOf(state).projects[`${order.path}:${regionOf(state,target)}`];
    const need = project?.active ? PROJECT_QUOTAS[project.level]-project.imported : project?.level===3 && getCampaign(state).paths.find(x=>x.id===order.path)?.eligible ? 12000-(progressOf(state).finales[order.path]?.[regionOf(state,target)]||0) : 0;
    const amount = Math.floor(Math.min(need, getTradeCapacity(state,town)/4, ...RESOURCE_KEYS.map(k=>(town.resources[k]-500)/2)));
    if (amount >= 1) execute(state,{type:'supply',settlementId:id,targetId:target.id,path:order.path,cargo:resourceObject(RESOURCE_KEYS.map(()=>amount))},state.playerId);
  }
  const campaign = getCampaign(state);
  if (campaign.stage > state.campaign.stage) {
    state.campaign.stage = campaign.stage;
    milestone(state, `stage:${campaign.stage}`, `${campaign.label} dönemi`, 20, 30);
    report(state, 'campaign', 'Yeni dönem açıldı', `${campaign.label}: Divan hedefleri güncellendi.`, true);
  }
}

// One gameplay minute per tick. UI owns RAF accumulation, speed and visibility suspension.
// No Date.now(), offline catch-up or hidden-tab punishment occurs in the simulation.
export function advance(state, minutes = 1) {
  if (!integer(minutes, 0, 10080)) return fail('Tek ilerletmede 0–10080 tam oyun dakikası kullanılabilir.');
  let advanced = 0;
  const rateCache = new Map();
  while (advanced < minutes && !state.paused && state.time < LIMITS.time) { tick(state, rateCache); advanced++; }
  return { ok: true, advanced, paused: state.paused };
}

export function validateState(state) {
  try { return inspectState(state); }
  catch { return { ok: false, errors: ['Kayıt içindeki alanlar okunamadı.'] }; }
}
function inspectState(state) {
  const errors = [];
  const check = (condition, message) => { if (!condition && errors.length < 40) errors.push(message); };
  if (!plain(state)) return { ok: false, errors: ['Kayıt nesnesi geçersiz.'] };
  check(state.schemaVersion === SCHEMA_VERSION, 'Kayıt şema sürümü desteklenmiyor.');
  check(state.playerId === 'player', 'Oyuncu kimliği geçersiz.');
  check(integer(state.time, 0, LIMITS.time) && integer(state.nextId, 1) && integer(state.randomState, 0, 4294967295), 'Saat veya rastgelelik durumu geçersiz.');
  check(typeof state.paused === 'boolean' && [1, 4, 12].includes(state.speed), 'Zaman kontrolü geçersiz.');
  check(plain(state.settings) && typeof state.settings.autoPause === 'boolean', 'Ayarlar geçersiz.');
  const world = state.world;
  if (!plain(world) || !integer(world.size, 13, 65) || !Array.isArray(world.tiles) || world.tiles.length !== world.size * world.size || !boundedString(world.seed, 80)) return { ok: false, errors: [...errors, 'Harita boyutu veya tohumu geçersiz.'] };
  const inBounds = point => plain(point) && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.y >= 0 && point.x < world.size && point.y < world.size;
  if (state.settings?.markers !== undefined) check(Array.isArray(state.settings.markers) && state.settings.markers.length <= 24 && state.settings.markers.every(point => inBounds(point) && integer(point.x) && integer(point.y)), 'Harita işaretleri geçersiz.');
  const counts = (obj, keys, max, ints = false) => plain(obj) && keys.every(key => Number.isFinite(obj[key]) && obj[key] >= 0 && obj[key] <= max && (!ints || Number.isInteger(obj[key])));
  const factions = Array.isArray(state.factions) ? state.factions : [];
  check(factions.length >= 1 && factions.length <= 11, 'Hanedan sayısı geçersiz.');
  const factionIds = new Set();
  for (const faction of factions) {
    if (!plain(faction)) { check(false, 'Hanedan verisi geçersiz.'); continue; }
    check(boundedString(faction.id, 30) && !factionIds.has(faction.id), 'Hanedan kimliği tekrar ediyor.'); factionIds.add(faction.id);
    check(boundedString(faction.name, 80) && boundedString(faction.color, 30) && boundedString(faction.archetype, 30), 'Hanedan adı veya türü geçersiz.');
    check(integer(faction.influence, 0, LIMITS.influence) && integer(faction.nextThink, 0, LIMITS.time + 1000) && plain(faction.relations), 'Diplomasi verisi geçersiz.');
  }
  check(factionIds.has('player'), 'Oyuncu hanedanı eksik.');
  for (const faction of factions) if (plain(faction?.relations)) for (const id of factionIds) if (id !== faction.id) {
    const rel = faction.relations[id];
    check(plain(rel) && integer(rel.score, -100, 100) && integer(rel.truceUntil, 0, LIMITS.time + 1000000) && typeof rel.vasal === 'boolean', 'İlişki kaydı geçersiz.');
  }
  const towns = Array.isArray(state.settlements) ? state.settlements : [];
  check(towns.length >= 1 && towns.length <= LIMITS.settlements, 'Yerleşim sayısı geçersiz.');
  const townIds = new Set(), sites = new Set();
  for (const town of towns) {
    if (!plain(town)) { check(false, 'Yerleşim verisi geçersiz.'); continue; }
    check(boundedString(town.id, 50) && !townIds.has(town.id) && factionIds.has(town.ownerId), 'Yerleşim kimliği/sahibi geçersiz.'); townIds.add(town.id);
    const key = `${town.x},${town.y}`;
    check(inBounds(town) && integer(town.x) && integer(town.y) && !sites.has(key), 'Yerleşim konumu geçersiz.'); sites.add(key);
    check(boundedString(town.name, 80) && integer(town.lastStarvation, -1000, LIMITS.time), 'Yerleşim adı veya iaşe saati geçersiz.');
    check(counts(town.resources, RESOURCE_KEYS, LIMITS.resource), 'Kaynaklar geçersiz.');
    check(counts(town.troops, UNIT_KEYS, LIMITS.troops, true), 'Birlik sayıları geçersiz.');
    check(plain(town.buildings) && BUILDING_KEYS.every(key => integer(town.buildings[key], 0, BUILDINGS[key].maxLevel)), 'Yapı seviyeleri geçersiz.');
    check(Array.isArray(town.queue) && town.queue.length <= LIMITS.queue, 'İş kuyruğu geçersiz.');
    let previous = state.time;
    for (const job of Array.isArray(town.queue) ? town.queue : []) {
      check(plain(job) && boundedString(job.id, 50) && integer(job.completeAt, previous, LIMITS.time + 100000), 'İş bitiş saati geçersiz.');
      if (!plain(job)) continue;
      if (job.startAt !== undefined) check(integer(job.startAt, 0, job.completeAt - 1), 'İş başlangıç saati geçersiz.');
      if (job.kind === 'build') check(Object.hasOwn(BUILDINGS, job.building) && integer(job.level, 1, BUILDINGS[job.building]?.maxLevel || 0), 'İnşaat işi geçersiz.');
      else check(job.kind === 'train' && Object.hasOwn(UNITS, job.unit) && integer(job.count, 1, 100), 'Eğitim işi geçersiz.');
      previous = job.completeAt;
    }
  }
  check(towns.some(town => town?.ownerId === 'player'), 'Oyuncu yerleşimi eksik.');
  for (let index = 0; index < world.tiles.length; index++) {
    const tile = world.tiles[index];
    check(plain(tile) && tile.x === index % world.size && tile.y === Math.floor(index / world.size) && Object.hasOwn(TERRAINS, tile.terrain), 'Arazi kaydı geçersiz.');
    if (!plain(tile)) continue;
    if (tile.poi !== null) {
      const poi = tile.poi;
      check(plain(poi) && boundedString(poi.id, 50) && Object.hasOwn(POIS, poi.type) && (poi.ownerId === null || factionIds.has(poi.ownerId)) && (poi.settlementId === null || townIds.has(poi.settlementId)), 'Stratejik nokta geçersiz.');
      if (plain(poi) && poi.settlementId) check(towns.some(town => town.id === poi.settlementId && town.ownerId === poi.ownerId), 'Noktanın bağlı yerleşimi uyuşmuyor.');
    }
  }
  check(Array.isArray(state.armies) && state.armies.length <= LIMITS.armies, 'Sefer sayısı geçersiz.');
  const armyIds = new Set();
  for (const army of Array.isArray(state.armies) ? state.armies : []) {
    if (!plain(army)) { check(false, 'Sefer verisi geçersiz.'); continue; }
    check(boundedString(army.id, 50) && !armyIds.has(army.id) && factionIds.has(army.ownerId) && townIds.has(army.fromId), 'Sefer kimliği veya çıkış yurdu geçersiz.'); armyIds.add(army.id);
    check(inBounds(army.from) && inBounds(army.to) && integer(army.departAt, 0, state.time) && integer(army.arriveAt, state.time, LIMITS.time + 100000), 'Sefer konumu veya saati geçersiz.');
    check(['expand', 'scout', 'attack', 'claim', 'trade'].includes(army.mission) && typeof army.returning === 'boolean', 'Sefer türü geçersiz.');
    check(counts(army.troops, UNIT_KEYS, LIMITS.troops, true) && counts(army.cargo, RESOURCE_KEYS, LIMITS.resource), 'Sefer yükü geçersiz.');
    if (army.supplyPath !== undefined) check(army.mission === 'trade' && Object.hasOwn(VICTORY_PATHS, army.supplyPath), 'İkmal yolu geçersiz.');
    if (army.influenceCost !== undefined) check(integer(army.influenceCost, 0, LIMITS.influence), 'Kurucu nüfuzu geçersiz.');
    if (army.mission === 'expand') check(boundedString(army.name, 80), 'Kurucu yerleşim adı geçersiz.');
  }
  check(Array.isArray(state.reports) && state.reports.length <= LIMITS.reports, 'Rapor sınırı geçersiz.');
  for (const item of Array.isArray(state.reports) ? state.reports : []) check(plain(item) && boundedString(item.id, 50) && boundedString(item.type, 40) && boundedString(item.title, 200) && boundedString(item.text, 2000) && integer(item.time, 0, state.time) && typeof item.critical === 'boolean', 'Rapor kaydı geçersiz.');
  check(plain(state.intel) && Object.keys(state.intel).length <= world.tiles.length, 'İstihbarat dizini geçersiz.');
  for (const [key, intel] of Object.entries(plain(state.intel) ? state.intel : {})) {
    const [x, y] = key.split(',').map(Number);
    check(getTile(world, x, y) && plain(intel) && integer(intel.time, 0, state.time) && (intel.ownerId === null || factionIds.has(intel.ownerId)) && counts(intel.resources, RESOURCE_KEYS, LIMITS.resource) && counts(intel.troops, UNIT_KEYS, LIMITS.troops, true) && plain(intel.buildings), 'İstihbarat kaydı geçersiz.');
  }
  const dynasty = state.dynasty;
  check(plain(dynasty) && boundedString(dynasty.name, 80) && boundedString(dynasty.ruler, 80) && boundedString(dynasty.heir, 80) && integer(dynasty.xp, 0, 1000000) && counts(dynasty.stats, ['stewardship', 'warfare', 'commerce', 'diplomacy', 'intrigue'], 10, true) && Array.isArray(dynasty.traits) && dynasty.traits.length <= 8 && dynasty.traits.every(trait => boundedString(trait, 80)) && integer(dynasty.nextEvent, 0, LIMITS.time + 4800) && integer(dynasty.generation, 1, 1000), 'Hanedan gelişimi geçersiz.');
  if (plain(dynasty) && dynasty.pendingEvent !== null) check(plain(dynasty.pendingEvent) && dynasty.pendingEvent.type === 'heir' && boundedString(dynasty.pendingEvent.title, 200) && boundedString(dynasty.pendingEvent.text, 1000), 'Varis olayı geçersiz.');
  const campaign = state.campaign;
  check(plain(campaign) && integer(campaign.stage, 1, 5) && (campaign.victory === null || Object.hasOwn(VICTORY_PATHS, campaign.victory)) && typeof campaign.continued === 'boolean' && Array.isArray(campaign.milestones) && campaign.milestones.length <= 5000 && campaign.milestones.every(item => boundedString(item, 100)) && Number.isFinite(campaign.tradeVolume) && campaign.tradeVolume >= 0 && campaign.tradeVolume <= 100000000 && integer(campaign.battlesWon, 0, 100000000) && integer(campaign.scouting, 0, 100000000) && integer(campaign.buildingsCompleted, 0, 100000000), 'Kampanya ilerlemesi geçersiz.');
  check(progressionValid(state), 'Bölgesel kampanya kaydı geçersiz.');
  return { ok: errors.length === 0, errors };
}
