// The named game neighborhoods are fictional; district names identify real cities.
import { VENUES as GOLD_VENUES } from './city.mjs';
const rows = [
  ['istanbul','kadikoy','Kadıköy','commerce'],['istanbul','besiktas','Beşiktaş','commerce'],['istanbul','sisli','Şişli','services'],
  ['istanbul','uskudar','Üsküdar','residential'],['istanbul','umraniye','Ümraniye','industry'],['istanbul','fatih','Fatih','heritage'],['istanbul','beyoglu','Beyoğlu','culture'],['istanbul','bakirkoy','Bakırköy','services'],['istanbul','atasehir','Ataşehir','commerce'],['istanbul','maltepe','Maltepe','residential'],['istanbul','kartal','Kartal','industry'],['istanbul','pendik','Pendik','industry'],['istanbul','sariyer','Sarıyer','residential'],['istanbul','eyupsultan','Eyüpsultan','heritage'],['istanbul','beylikduzu','Beylikdüzü','residential'],
  ['ankara','cankaya','Çankaya','services'],['ankara','altindag','Altındağ','heritage'],['ankara','kecioren','Keçiören','residential'],['ankara','yenimahalle','Yenimahalle','industry'],['ankara','mamak','Mamak','residential'],['ankara','etimesgut','Etimesgut','industry'],['ankara','sincan','Sincan','industry'],['ankara','golbasi','Gölbaşı','residential'],
  ['izmir','konak','Konak','commerce'],['izmir','karsiyaka','Karşıyaka','residential'],['izmir','bornova','Bornova','services'],['izmir','buca','Buca','residential'],['izmir','bayrakli','Bayraklı','commerce'],['izmir','balcova','Balçova','services'],['izmir','karabaglar','Karabağlar','industry'],['izmir','gaziemir','Gaziemir','industry'],
];
export const DISTRICTS = rows.map(([cityId, slug, name, trait], index) => ({ id: cityId === 'istanbul' && index < 3 ? slug : `${cityId}:${slug}`, regionId: cityId, cityId, countryId: 'tr', name, trait }));
export const normalizeDistrictId = (id) => id === 'ankara:kizilay' ? 'ankara:cankaya' : id;
export const districtById = (id) => DISTRICTS.find((d) => d.id === normalizeDistrictId(id));
export const cityDistricts = (regionId) => DISTRICTS.filter((d) => d.regionId === regionId);
export const hubDistrict = (regionId) => cityDistricts(regionId)[0]?.id ?? null;
export const NEIGHBORHOODS = DISTRICTS.map((d) => ({ id: `${d.id}:game-neighborhood`, districtId: d.id, name: `${d.name} · Oyun Mahallesi`, fictional: true }));
// Kızılay is a Çankaya neighborhood: https://www.cankaya.bel.tr/rehber/muhtarlarimiz/muhtarlarimiz
NEIGHBORHOODS.push({id:'ankara:kizilay', districtId:'ankara:cankaya', name:'Kızılay', fictional:false});
const kinds = {
  housing: {name:'Konut ofisi',hours:[8,18],capacity:8},
  work: {name:'İş merkezi',hours:[7,22],capacity:12},
  institution: {name:'Kamu merkezi',hours:[8,18],capacity:8},
  social: {name:'Mahalle buluşma yeri',hours:[9,22],capacity:12},
};
const goldIds = new Set(['kadikoy','besiktas','sisli']);
export const LOCATIONS = [
  ...GOLD_VENUES.map((v) => ({...v, districtId:v.district, neighborhoodId:`${v.district}:game-neighborhood`, hours:[v.open/60,v.close/60], capacity:12})),
  ...DISTRICTS.filter((d) => !goldIds.has(d.id)).flatMap((d, _i) => {
    // The first two non-Istanbul districts retain housing/institution services;
    // other districts offer a local job and a community place plus one service.
    const types = d.id === 'ankara:cankaya' || d.id === 'izmir:konak' || d.id === 'izmir:bornova'
      ? Object.keys(kinds) : ['work','social', ['residential','industry','commerce'].includes(d.trait) ? 'housing' : 'institution'];
    const workNames = {industry:'Üretim atölyesi',commerce:'Ticaret merkezi',culture:'Kültür atölyesi',heritage:'Miras atölyesi',services:'Hizmet merkezi',residential:'Yerel iş merkezi'};
    return types.map((kind) => ({id:`${d.id}:${kind}`,districtId:d.id,neighborhoodId:`${d.id}:game-neighborhood`,kind,...kinds[kind], ...(kind === 'work' ? {name:workNames[d.trait],hours:d.trait === 'industry' ? [6,20] : [7,22]} : {})}));
  }),
  ...Object.entries(kinds).map(([kind, v]) => ({id:`ankara:kizilay:${kind}`,districtId:'ankara:cankaya',neighborhoodId:'ankara:kizilay',kind,...v})),
];
const endpoint = (id) => {
  const location = LOCATIONS.find((v) => v.id === id);
  const district = districtById(location?.districtId ?? id);
  return district ? { district, location } : null;
};
// Abstract game transit links, not a claim about actual public transport routes.
const networks = {
  istanbul: [['kadikoy','istanbul:uskudar',25],['kadikoy','istanbul:atasehir',30],['kadikoy','istanbul:maltepe',35],['istanbul:uskudar','istanbul:umraniye',25],['istanbul:umraniye','istanbul:atasehir',25],['istanbul:maltepe','istanbul:kartal',25],['istanbul:kartal','istanbul:pendik',25],['istanbul:uskudar','besiktas',35],['besiktas','sisli',20],['besiktas','istanbul:beyoglu',20],['besiktas','istanbul:sariyer',40],['sisli','istanbul:eyupsultan',35],['istanbul:beyoglu','istanbul:fatih',20],['istanbul:fatih','istanbul:bakirkoy',35],['istanbul:bakirkoy','istanbul:beylikduzu',55]],
  ankara: [['ankara:cankaya','ankara:altindag',25],['ankara:altindag','ankara:kecioren',25],['ankara:altindag','ankara:mamak',25],['ankara:cankaya','ankara:yenimahalle',30],['ankara:yenimahalle','ankara:etimesgut',30],['ankara:etimesgut','ankara:sincan',25],['ankara:cankaya','ankara:golbasi',45]],
  izmir: [['izmir:konak','izmir:karsiyaka',30],['izmir:karsiyaka','izmir:bayrakli',20],['izmir:bayrakli','izmir:bornova',20],['izmir:konak','izmir:buca',30],['izmir:konak','izmir:balcova',30],['izmir:konak','izmir:karabaglar',25],['izmir:karabaglar','izmir:gaziemir',25]],
};
const asian = new Set(['kadikoy','istanbul:uskudar','istanbul:umraniye','istanbul:atasehir','istanbul:maltepe','istanbul:kartal','istanbul:pendik']);
function shortest(city, from, to, mode) {
  const best = new Map([[from,{minutes:0,legs:[]}]]), todo = new Set(cityDistricts(city).map((d) => d.id));
  while (todo.size) {
    const current = [...todo].filter((id) => best.has(id)).sort((a,b) => best.get(a).minutes-best.get(b).minutes)[0];
    if (!current) break;
    if (current === to) return best.get(current);
    todo.delete(current);
    for (const [a,b,base] of networks[city]) {
      const next = a === current ? b : b === current ? a : null;
      if (!next || !todo.has(next) || (mode === 'walk' && city === 'istanbul' && asian.has(current) !== asian.has(next))) continue;
      const minutes = mode === 'walk' ? base * 3 : base;
      const candidate = best.get(current).minutes + minutes;
      if (candidate < (best.get(next)?.minutes ?? Infinity)) best.set(next,{minutes:candidate,legs:[...best.get(current).legs,{from:current,to:next,minutes}]});
    }
  }
  return null;
}
export function routeBetween(s, from, to, {mode='transit', at=s.time, actor='player'}={}) {
  const a=endpoint(from), b=endpoint(to);
  if (!a || !b || !Number.isSafeInteger(at) || at < 0 || !['transit','walk'].includes(mode) || !['player','npc'].includes(actor)) return null;
  const kind = a.district.cityId !== b.district.cityId ? 'city' : a.district.id !== b.district.id ? 'district' : 'local';
  const path = kind === 'district' ? shortest(a.district.cityId,a.district.id,b.district.id,mode) : null;
  const first = kind === 'city' ? shortest(a.district.cityId,a.district.id,hubDistrict(a.district.cityId),'transit') : null;
  const last = kind === 'city' ? shortest(b.district.cityId,hubDistrict(b.district.cityId),b.district.id,'transit') : null;
  const access = kind !== 'local' ? (a.location ? 15 : 0) + (b.location ? 15 : 0) : 0;
  const minutes = kind === 'city' ? 360 + first.minutes + last.minutes + access : kind === 'district' ? (path?.minutes ?? 0) + access : (from === to ? 0 : 15);
  const cost = kind === 'city' ? (a.district.cityId === 'istanbul' || b.district.cityId === 'istanbul' ? 780 : 620) + 15 * (first.legs.length + last.legs.length) : kind === 'district' && mode === 'transit' ? 20 + 15 * (path?.legs.length ?? 0) : 0;
  const legs = kind === 'city' ? [
    ...(a.location ? [{from,to:a.district.id,minutes:15}] : []), ...first.legs,
    {from:hubDistrict(a.district.cityId),to:hubDistrict(b.district.cityId),minutes:360}, ...last.legs,
    ...(b.location ? [{from:b.district.id,to,minutes:15}] : []),
  ] : kind === 'district' ? [...(a.location ? [{from,to:a.district.id,minutes:15}] : []), ...(path?.legs ?? []), ...(b.location ? [{from:b.district.id,to,minutes:15}] : [])] : from === to ? [] : [{from,to,minutes}];
  if (!Number.isSafeInteger(at + minutes)) return null;
  let reason = '';
  if ((kind === 'city' && mode === 'walk') || (kind === 'district' && !path)) reason = 'Bu ulaşım türüyle güzergâh yok.';
  else if (mode === 'transit' && kind !== 'local' && (at % 1440 < 360 || at % 1440 + minutes > 1440)) reason = 'Ulaşım 06:00–24:00 arasında çalışır.';
  else if (b.location && ((at + minutes) % 1440 < b.location.hours[0] * 60 || (at + minutes) % 1440 >= b.location.hours[1] * 60)) reason = 'Mekân bu saatte kapalı.';
  else if (actor === 'player' && (s.cash ?? 0) + (s.bank ?? 0) < cost) reason = 'Bu yolculuk için yeterli bakiye yok.';
  return {from,to,kind,minutes,cost,available:!reason,reason,mode,legs};
}
