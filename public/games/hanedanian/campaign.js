// Campaign rules are spatial and consumptive: no timer or stockpile can win alone.
import { RESOURCES, VICTORY_PATHS } from './data.js';
export const REGION_NAMES = ['Kuzeybatı Sedirliği','Kuzey Yolu','Kuzeydoğu Sırtları','Batı Havzası','İç Divan','Doğu Geçitleri','Güneybatı Ovası','Güney Kervanlığı','Güneydoğu Yaylası'];
export const SPECIALIZATIONS = { granary: 'İaşe merkezi', workshop: 'Üretim merkezi', exchange: 'Ticaret merkezi', fortress: 'Ordu merkezi', court: 'Siyasi merkez' };
export const PROJECT_QUOTAS = [4000, 12000, 28000];
const keys = Object.keys(RESOURCES), paths = Object.keys(VICTORY_PATHS);
export const regionOf = (state, point) => Math.min(2, Math.floor(point.y * 3 / state.world.size)) * 3 + Math.min(2, Math.floor(point.x * 3 / state.world.size));
export const emptyProgression = () => ({ version: 2, specializations: {}, projects: {}, logistics: {}, rivals: {}, finales: {}, supply: {} });
export const progressOf = state => state.campaign.progression || emptyProgression();
export const ensureProgression = state => state.campaign.progression ||= emptyProgression();
const req = (label, current, target) => ({ label, current: Math.floor(current), target, done: current >= target });
const own = state => state.settlements.filter(t => t.ownerId === state.playerId);
export function regionalStatus(state) {
  const towns = own(state), p = progressOf(state);
  const ownedPoints = state.world.tiles.filter(t => t.poi?.ownerId === state.playerId);
  return REGION_NAMES.map((name, id) => {
    const local = towns.filter(t => regionOf(state, t) === id);
    const points = ownedPoints.filter(t => regionOf(state, t) === id);
    return { id, name, towns: local, points, specialties: new Set(local.map(t => p.specializations[t.id]).filter(Boolean)) };
  });
}
export function projectRequirements(state, town, path) {
  const p = progressOf(state), region = regionOf(state, town), project = p.projects[`${path}:${region}`];
  const level = project?.level || 0, local = regionalStatus(state)[region];
  const scout = state.intel[`${town.x},${town.y}`] || Object.entries(state.intel).some(([k]) => { const [x,y] = k.split(',').map(Number); return regionOf(state, {x,y}) === region; });
  if (path === 'dynasty') local.points = state.world.tiles.filter(t=>t.poi && regionOf(state,t)===region && (t.poi.ownerId===state.playerId || state.factions.find(f=>f.id===t.poi.ownerId)?.relations[state.playerId]?.vasal));
  const special = path === 'wealth' ? 'exchange' : path === 'dominion' ? 'fortress' : 'court';
  return { region, level, quota: PROJECT_QUOTAS[level], requirements: [
    req('Konak', town.buildings.hall, 2 + level * 2),
    req(path === 'dominion' ? 'Talimgâh' : 'Kervan avlusu', town.buildings[path === 'dominion' ? 'barracks' : 'market'], 2 + level * 2),
    req('Depolar', town.buildings.warehouse, 3 + level * 2),
    req('Bölgesel keşif', scout ? 1 : 0, 1),
    req('Bölgede bağlı stratejik nokta', local.points.length, 1 + (level === 2 ? 1 : 0)),
    req(SPECIALIZATIONS[special], local.specialties.has(special) ? 1 : 0, 1),
  ] };
}
export function campaignStatus(state, base) {
  const p = progressOf(state), regions = regionalStatus(state), towns = own(state);
  const politicalPoints = r => state.world.tiles.filter(t=>t.poi && regionOf(state,t)===r.id && (t.poi.ownerId===state.playerId || state.factions.find(f=>f.id===t.poi.ownerId)?.relations[state.playerId]?.vasal)).length;
  const mature = path => regions.filter(r => (p.projects[`${path}:${r.id}`]?.level || 0) >= 3 && r.towns.some(t=>t.id===p.projects[`${path}:${r.id}`]?.townId) && (path==='dynasty'?politicalPoints(r):r.points.length) >= 2).length;
  const established = regions.filter(r => r.towns.some(t => t.buildings.hall >= 2)).length;
  const connections = Object.values(p.logistics).filter(e => e.delivered >= 1000 && towns.some(t => t.id === e.from) && towns.some(t => t.id === e.to)).length;
  const specialCount = new Set(towns.map(t => p.specializations[t.id]).filter(Boolean)).size;
  const projectLevels = Object.values(p.projects).reduce((n,x) => n + x.level, 0);
  const rivals = Object.values(p.rivals).filter(power => power >= 1200).length;
  const influence = state.factions.find(f => f.id === state.playerId).influence;
  const common = [req('Gelişmiş bölge', established, 6), req('Uzmanlık çeşidi', specialCount, 3), req('Bölgeler arası ikmal hattı', connections, 5)];
  const routeRequirements = {
    wealth: [req('Yerleşim ağı', towns.length, 8), req('III. seviye ekonomik bölge', mature('wealth'), 6), req('Kervan avlusu toplamı', towns.reduce((n,t) => n+t.buildings.market,0), 42), req('Nüfuz', influence, 280)],
    dominion: [req('Yerleşim ağı', towns.length, 8), req('III. seviye askeri bölge', mature('dominion'), 6), req('Stratejik nokta', base.points, 14), req('Büyük rakibe karşı kazanılan meydan', rivals, Math.min(3,state.factions.length-1) || 1), req('Ordu gücü', base.power, 9000), req('Nüfuz', influence, 240)],
    dynasty: [req('Yerleşim ağı', towns.length, 8), req('III. seviye siyasi bölge', mature('dynasty'), 6), req('Bağlı hanedan', base.vasals, Math.min(3,state.factions.length-1) || 1), req('Diplomasi yeteneği', state.dynasty.stats.diplomacy, 5), req('Nüfuz', influence, 400)],
  };
  const result = paths.map(id => {
    const requirements = [...common, ...routeRequirements[id]];
    const eligible = requirements.every(r => r.done);
    requirements.push(req('Bölgesel final hazırlığı', regions.filter(r => (p.finales[id]?.[r.id] || 0) >= 12000 && r.towns.some(t=>t.id===p.projects[`${id}:${r.id}`]?.townId) && (id==='dynasty'?politicalPoints(r):r.points.length) >= 2).length, 6));
    return { id, label: VICTORY_PATHS[id], eligible, requirements, ready: requirements.every(r => r.done) };
  });
  const stage = projectLevels >= 18 ? 5 : projectLevels >= 6 ? 4 : established >= 3 ? 3 : towns.length >= 2 ? 2 : 1;
  const goals = [
    [req('Yapı geliştir', state.campaign.buildingsCompleted, 1), req('Keşif', state.campaign.scouting, 1), req('İkinci yurt', towns.length, 2)],
    [req('Yerleşilen bölge', established, 3), req('Uzmanlık çeşidi', specialCount, 2), req('İkmal hattı', connections, 1)],
    [req('Bölgesel yatırım aşaması', projectLevels, 6), req('İkmal hattı', connections, 3)],
    [req('Bölgesel yatırım aşaması', projectLevels, 18), req('Gelişmiş bölge', established, 6)],
    [req('Finali tamamlanan yol', result.filter(x => x.ready).length, 1)],
  ];
  return { ...base, stage, label: ['Kuruluş','Yerel Güç','Bölgesel Güç','Büyük Hanedan','Endgame'][stage-1], goals: goals[stage-1], paths: result, regions, connections, projectLevels };
}
// Called only after engine ownership/cost guards. Failed commands leave state untouched.
export function campaignCommand(state, action, town) {
  const p = progressOf(state), path = action.path, faction = state.factions.find(f => f.id === state.playerId);
  const fail = message => ({ok:false,message});
  if (action.type === 'specialize') {
    if (!Object.hasOwn(SPECIALIZATIONS, action.specialty) || town.buildings.hall < 2) return fail('Uzmanlık için konak 2 ve geçerli bir alan gerekir.');
    if (p.specializations[town.id] === action.specialty) return fail('Yerleşim zaten bu alanda uzman.');
    if (keys.some(k => town.resources[k] < 180)) return fail('Uzmanlaşma her kaynaktan 180 ister.');
    keys.forEach(k => town.resources[k] -= 180); ensureProgression(state).specializations[town.id] = action.specialty;
    return {ok:true,message:'Uzmanlık seçildi; bölgesel yatırım koşulları güncellendi.'};
  }
  if (action.type === 'cancelSupply') { if (!p.supply[town.id]) return fail('Etkin ikmal emri yok.'); delete p.supply[town.id]; return {ok:true,message:'Yeni kervan çıkışı durduruldu; yoldaki yükler teslim edilecek.'}; }
  if (!paths.includes(path)) return fail('Geçerli bir Kurultay yolu seç.');
  const info = projectRequirements(state, town, path), id = `${path}:${info.region}`;
  if (action.type === 'project') {
    if (p.projects[id]?.active || info.level >= 3 || !info.requirements.every(r => r.done)) return fail('Önce bölgesel yatırımın yapı, keşif, nokta ve uzmanlık koşullarını tamamla.');
    if (faction.influence < 15) return fail('Yatırım fermanı 15 nüfuz ister.');
    faction.influence -= 15;
    ensureProgression(state).projects[id] = {level:info.level,active:true,townId:town.id,paid:0,imported:0};
    return {ok:true,message:'Bölgesel yatırım açıldı. Yerel katkı ve farklı bölgeden ikmal gerekir.'};
  }
  if (action.type === 'contribute') {
    const project = p.projects[id];
    if (!project?.active || project.townId !== town.id) return fail('Bu yerleşimde etkin bir bölgesel yatırım yok.');
    const quota = PROJECT_QUOTAS[project.level], amount = Math.floor(Math.min(1500, quota-project.paid, ...keys.map(k=>town.resources[k]-500)));
    if (amount <= 0) return fail('Yerel katkı tamamlandı veya kaynaklar yetersiz. İkmal hatlarını kontrol et.');
    keys.forEach(k=>town.resources[k]-=amount); project.paid += amount;
    return {ok:true,message:`Her kaynaktan ${amount} yerel yatırıma ayrıldı.`};
  }
  if (action.type === 'supplyOrder') {
    const target = state.settlements.find(t=>t.id===action.targetId && t.ownerId===state.playerId);
    if (!target || regionOf(state,target)===regionOf(state,town) || town.buildings.market < 2) return fail('Farklı bölgedeki kendi yurdunu seç; kervan avlusu 2 gerekir.');
    ensureProgression(state).supply[town.id] = {targetId:target.id,path};
    return {ok:true,message:'İkmal emri verildi. Kervanlar 500 birim güvenlik stoğunu koruyarak yatırım yükü taşır.'};
  }
  return fail('Kampanya emri geçersiz.');
}
export function completeProjects(state) {
  const p = progressOf(state);
  for (const [id, project] of Object.entries(p.projects)) {
    if (!project.active) continue;
    const town = state.settlements.find(t=>t.id===project.townId && t.ownerId===state.playerId);
    if (!town) continue;
    const quota = PROJECT_QUOTAS[project.level];
    if (project.paid >= quota && project.imported >= quota) {
      project.level++; project.active=false;
      const faction = state.factions.find(f=>f.id===state.playerId);
      faction.influence = Math.min(9999, faction.influence + 55);
      state.dynasty.xp = Math.min(1000000, state.dynasty.xp + 60);
      state.reports.unshift({id:`charter-${id}-${project.level}`,time:state.time,type:'campaign',title:'Bölgesel yatırım tamamlandı',text:`${REGION_NAMES[regionOf(state,town)]}: ${VICTORY_PATHS[id.split(':')[0]]} ${project.level}. aşama. Nüfuz +55, deneyim +60.`,critical:false});
      state.reports.length=Math.min(state.reports.length,180);
    }
  }
}
export function progressionValid(state) {
  const p=state.campaign.progression;
  if (p===undefined) return true; // additive v1 migration, originals remain loadable
  const object=x=>x && typeof x==='object' && !Array.isArray(x);
  const n=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
  if (!object(p)||p.version!==2||!['specializations','projects','logistics','rivals','finales','supply'].every(k=>object(p[k])&&Object.keys(p[k]).length<=200)) return false;
  const ids=new Set(state.settlements.map(t=>t.id));
  return Object.entries(p.specializations).every(([id,x])=>ids.has(id)&&Object.hasOwn(SPECIALIZATIONS,x)) &&
    Object.entries(p.projects).every(([id,x])=>/^(wealth|dominion|dynasty):[0-8]$/.test(id)&&object(x)&&ids.has(x.townId)&&n(x.level,3)&&typeof x.active==='boolean'&&(!x.active||x.level<3)&&n(x.paid,56000)&&n(x.imported,56000)) &&
    Object.values(p.logistics).every(x=>object(x)&&ids.has(x.from)&&ids.has(x.to)&&n(x.delivered,100000000)) &&
    Object.entries(p.rivals).every(([id,x])=>state.factions.some(f=>f.id===id&&id!==state.playerId)&&n(x,1000000)) &&
    Object.entries(p.supply).every(([id,x])=>ids.has(id)&&object(x)&&ids.has(x.targetId)&&paths.includes(x.path)) &&
    Object.entries(p.finales).every(([path,x])=>paths.includes(path)&&object(x)&&Object.entries(x).every(([region,value])=>/^[0-8]$/.test(region)&&n(value,12000)));
}
