import { CITIES, PLAYABLE_REGIONS, currentDistrict } from './locations.js?v=10';
import { REGION_MAPS } from './region-map-data.js?v=10';

/** One image for the selected city; labels remain real, focusable HTML. */
export function renderRegionMap(state, selected, { escapeText }) {
 const city=selected.city, map=REGION_MAPS[city], current=currentDistrict(state);
 const language=globalThis.window?.tlabI18n?.getLang?.() || 'tr';
 const copy={
  tr:{home:'EVİN',regions:'oynanabilir bölge',choose:'Oynanabilir bölge seçimi',previous:'Önceki bölge seçenekleri',legacy:'Eski konum, konut ve iş kayıtların aynı bölge kimliğiyle korunur.',caption:'Ölçeksiz şehir çizimi · Etiket çizgileri yaklaşık konumu gösterir; idari sınır değildir.',north:'K'},
  en:{home:'HOME',regions:'playable regions',choose:'Choose a playable region',previous:'Earlier region options',legacy:'Your earlier location, housing and business records keep their original region IDs.',caption:'Illustrated city, not to scale · Label lines show approximate locations, not administrative boundaries.',north:'N'},
  pl:{home:'DOM',regions:'grywalnych obszarów',choose:'Wybierz grywalny obszar',previous:'Wcześniejsze obszary',legacy:'Wcześniejsze zapisy lokalizacji, mieszkań i firm zachowują identyfikatory obszarów.',caption:'Ilustracja miasta bez skali · Linie etykiet wskazują przybliżone położenie, nie granice administracyjne.',north:'N'},
 }[language] || {home:'HOME',regions:'playable regions',choose:'Choose a playable region',previous:'Earlier region options',legacy:'Earlier region records are preserved.',caption:'Illustrated city, not to scale.',north:'N'};
 const regions=PLAYABLE_REGIONS.filter(d=>d.city===city);
 const buttons=regions.map(d=>{const [x,y]=map.positions[d.id],[cx,cy]=map.compactPositions[d.id];return `<button class="region-map-label" style="--region-x:${x}%;--region-y:${y}%;--compact-x:${cx}%;--compact-y:${cy}%" data-location-select="${d.id}" aria-pressed="${selected.id===d.id}" aria-controls="region-selection-info"><span>${escapeText(d.name).replace(/([–-])/g,'$1<wbr>')}</span>${current?.id===d.id?`<small>${copy.home}</small>`:''}</button>`;}).join('');
 const leaders=regions.map(d=>{const [x,y]=map.positions[d.id],[cx,cy]=map.compactPositions[d.id];return `<line class="${selected.id===d.id?'is-selected':''}" x1="${x}" y1="${y}" x2="${cx}" y2="${cy}" />`;}).join('');
 // Earlier IDs still load and price normally. Their saved home is readable;
 // the map exposes only the 23 current regions, with no duplicate selector.
 const earlierHome=current?.city===city&&!regions.some(d=>d.id===current.id)?`<span class="region-map-earlier-home">${copy.home}: ${escapeText(current.name)} · ${copy.legacy}</span>`:'';
 return `<figure class="region-map" data-i18n-skip data-pl-skip data-region-city="${city}" aria-label="${escapeText(CITIES[city])} · ${regions.length} ${copy.regions}"><div class="region-map-canvas"><div class="region-map-art"><img src="./assets/map/${map.file}" width="${map.width}" height="${map.height}" loading="lazy" decoding="async" alt="${escapeText(map[language === "en" ? "altEn" : language === "pl" ? "altPl" : "alt"] || map.alt)}"></div><svg class="region-map-leaders" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${leaders}</svg><div class="region-map-labels" role="group" aria-label="${copy.choose}">${buttons}</div></div><figcaption><span class="region-map-north" aria-hidden="true">↑ ${copy.north}</span> ${copy.caption}${earlierHome}</figcaption></figure>`;
}
