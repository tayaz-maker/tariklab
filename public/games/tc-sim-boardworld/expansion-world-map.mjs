import { cityLinks } from "./expansion-geography.mjs";
import { REGIONS } from "./expansion-world.mjs";

// A schematic transit board. District selection only changes the inspection panel;
// travel always goes through the simulation's existing action resolver.
export function renderWorldMap({view, actions, actionCard, esc, language, selectedDistrict, localize}) {
  const l = (tr,en,pl) => ({tr,en,pl}[language] || tr);
  const {place, districts, neighborhoods} = view.districts;
  const selected = districts.find(d => d.id === selectedDistrict) || districts.find(d => d.id === place.districtId);
  const city = selected.cityId;
  const cityName = REGIONS[city].name;
  const travel = selected.id === place.districtId ? null : selected.cityId !== place.cityId
    ? actions.find(a => a.id === `world:move:${selected.cityId}`)
    : actions.find(a => a.id === `district:travel:${selected.id}` || a.id === `travel:${selected.id}`);
  const local = selected.id === place.districtId;
  const visits = local ? actions.filter(a => /^(district:)?visit:/.test(a.id) && selected.venues.some(v => a.id.endsWith(v.id))) : [];
  const group = districts.filter(d => d.cityId === city);
  // Positions and links mirror the abstract transit network, not real geography.
  const maps = {
    istanbul: [[55,48],[39,38],[30,25],[62,30],[78,25],[15,58],[27,53],[8,73],[78,45],[68,65],[80,73],[91,83],[42,10],[15,20],[6,90]],
    ankara: [[50,48],[50,23],[70,8],[27,40],[74,30],[16,60],[5,80],[62,82]],
    izmir: [[43,48],[55,18],[88,35],[65,76],[72,23],[15,40],[25,70],[25,91]],
  };
  const positions = new Map(group.map((district, index) => [district.id, maps[city][index]]));
  return `<section class="world-map" aria-label="${l('Dünya haritası','World map','Mapa świata')}"><div class="world-map-heading"><h2>${l('Dünyayı keşfet','Explore the world','Odkrywaj świat')}</h2></div><nav class="world-cities" aria-label="${l('Şehir seç','Select city','Wybierz miasto')}">${Object.entries(REGIONS).map(([id,{name}]) => `<button class="${id===city?'active':''}" data-world-district="${esc(districts.find(d=>d.cityId===id).id)}" ${id===city?'aria-current="true"':''}>${esc(name)} <small>${districts.filter(d=>d.cityId===id).length}</small></button>`).join('')}</nav><div class="world-map-layout"><div class="world-network" aria-label="${esc(cityName)}"><div class="world-network-title">${esc(cityName)}<small>${l('Şematik ulaşım panosu','Schematic transit board','Schematyczna mapa połączeń')}</small></div><div class="world-nodes"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${cityLinks(city).map(([a,b])=>{const [x1,y1]=positions.get(a), [x2,y2]=positions.get(b); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;}).join('')}</svg>${group.map((d,i)=>`<button data-world-district="${esc(d.id)}" style="left:${maps[city][i][0]}%;top:${maps[city][i][1]}%" class="world-node ${d.id===selected.id?'selected':''} ${d.id===place.districtId?'here':''}" aria-pressed="${d.id===selected.id}"><span>${String(i+1).padStart(2,'0')}</span>${esc(d.name)}${d.id===place.districtId?` <small>${l('Buradasın','You are here','Jesteś tutaj')}</small>`:''}</button>`).join('')}</div></div><aside class="world-inspector"><h3>${esc(selected.name)}</h3><h4>${l('Mahalleler ve mekânlar','Neighborhoods and places','Okolice i miejsca')}</h4><p>${(neighborhoods.filter(n=>n.districtId===selected.id).map(n=>n.fictional?l('Oyun mahallesi (kurgusal)','Game neighborhood (fictional)','Dzielnica gry (fikcyjna)'):n.name)).map(esc).join(' · ')}</p><ul>${selected.venues.map(v=>`<li>${esc(localize(v.name, language))}</li>`).join('')}</ul>${travel ? `${selected.cityId!==place.cityId?`<p>${l('Önce şehir merkezine yolculuk et; ardından ilçeni seç.','Travel to the city hub first, then select your district.','Najpierw podróżuj do centrum miasta, a potem wybierz dzielnicę.')}</p>`:''}${actionCard(travel,true)}` : ''}${visits.length ? `<h4>${l('Burada ziyaret et','Visit here','Odwiedź tutaj')}</h4><div class="action-grid">${visits.map(a=>actionCard(a,true)).join('')}</div>`:''}</aside></div></section>`;
}
