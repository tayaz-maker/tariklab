import { CITIES, DISTRICTS, PLAYABLE_REGIONS, currentDistrict } from './locations.js?v=10';
import { REGION_MAPS } from './region-map-data.js?v=10';

/** One image for the selected city; labels remain real, focusable HTML. */
export function renderRegionMap(state, selected, { escapeText }) {
 const city=selected.city, map=REGION_MAPS[city], current=currentDistrict(state);
 const language=globalThis.window?.tlabI18n?.getLang?.() || 'tr';
 const copy={
  tr:{home:'EVİN',regions:'oynanabilir bölge',choose:'Oynanabilir bölge seçimi',previous:'Önceki bölge seçenekleri',legacy:'Eski konum, konut ve iş kayıtların aynı bölge kimliğiyle korunur.',caption:'Ölçeksiz şehir çizimi · Etiketler oynanabilir bölgeleri gösterir; idari sınır değildir.',north:'K'},
  en:{home:'HOME',regions:'playable regions',choose:'Choose a playable region',previous:'Earlier region options',legacy:'Your earlier location, housing and business records keep their original region IDs.',caption:'Illustrated city, not to scale · Labels identify playable regions, not administrative boundaries.',north:'N'},
  pl:{home:'DOM',regions:'grywalnych obszarów',choose:'Wybierz grywalny obszar',previous:'Wcześniejsze obszary',legacy:'Wcześniejsze zapisy lokalizacji, mieszkań i firm zachowują identyfikatory obszarów.',caption:'Ilustracja miasta bez skali · Etykiety wskazują grywalne obszary, a nie granice administracyjne.',north:'N'},
 }[language] || {home:'HOME',regions:'playable regions',choose:'Choose a playable region',previous:'Earlier region options',legacy:'Earlier region records are preserved.',caption:'Illustrated city, not to scale.',north:'N'};
 const regions=PLAYABLE_REGIONS.filter(d=>d.city===city);
 const dots=regions.map((d,index)=>{const [x,y]=map.positions[d.id];return `<span class="region-map-dot" style="--region-x:${x}%;--region-y:${y}%" aria-hidden="true">${index+1}</span>`;}).join('');
 const buttons=regions.map((d,index)=>{const [x,y]=map.positions[d.id];return `<button class="region-map-label" style="--region-x:${x}%;--region-y:${y}%" data-location-select="${d.id}" aria-pressed="${selected.id===d.id}"><span class="region-map-number" aria-hidden="true">${index+1}</span><span>${escapeText(d.name)}</span>${current?.id===d.id?`<small>${copy.home}</small>`:''}</button>`;}).join('');
 const legacy=DISTRICTS.filter(d=>d.city===city&&!regions.some(r=>r.id===d.id));
 const previous=legacy.length?`<details class="region-map-legacy" data-i18n-skip data-pl-skip><summary>${copy.previous}</summary><div class="location-cities">${legacy.map(d=>`<button class="button button-quiet" data-location-select="${d.id}" aria-pressed="${selected.id===d.id}">${escapeText(d.name)}</button>`).join('')}</div><p class="context-note">${copy.legacy}</p></details>`:'';
 return `<figure class="region-map" data-i18n-skip data-pl-skip data-region-city="${city}" aria-label="${escapeText(CITIES[city])} · ${regions.length} ${copy.regions}"><div class="region-map-canvas"><div class="region-map-art"><img src="./assets/map/${map.file}" width="${map.width}" height="${map.height}" loading="lazy" decoding="async" alt="${escapeText(map[language === "en" ? "altEn" : language === "pl" ? "altPl" : "alt"] || map.alt)}">${dots}<span class="region-map-north" aria-hidden="true">↑ ${copy.north}</span></div><div class="region-map-labels" role="group" aria-label="${copy.choose}">${buttons}</div></div><figcaption>${copy.caption}</figcaption></figure>${previous}`;
}
