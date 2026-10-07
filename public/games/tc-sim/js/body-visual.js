import { getKnownBodyConditions } from "./body-systems.js?v=10";

// Presentation only. These regions are navigation, never inferred diagnoses.
export const BODY_REGIONS = Object.freeze([
  { id: "head", label: "Baş", metric: "stress" },
  { id: "chest", label: "Göğüs", metric: "health" },
  { id: "abdomen", label: "Karın", metric: "health" },
  { id: "back", label: "Sırt", metric: "energy" },
  { id: "arms", label: "Kollar", metric: "energy" },
  { id: "legs", label: "Bacaklar", metric: "energy" },
]);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const score = value => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
export function bodyVisualModel(state, selected = "chest") {
  const region = BODY_REGIONS.find(item => item.id === selected) || BODY_REGIONS[1];
  const metrics = [
    { id: "health", label: "Sağlık", value: score(state.health?.health) },
    { id: "energy", label: "Enerji", value: score(state.health?.energy) },
    { id: "stress", label: "Stres", value: score(state.health?.stress) },
  ].map(item => ({ ...item, tone: item.value === null ? "unknown" : item.id === "stress" ? (item.value >= 70 ? "attention" : "steady") : (item.value <= 30 ? "attention" : "steady") }));
  const attention = metrics.some(item => item.tone === "attention");
  return { region, metrics, attention, conditions: getKnownBodyConditions(state, true),
    status: metrics[0].value !== null && metrics[0].value <= 30 ? "Toparlanma öncelikli" : metrics[2].value >= 70 ? "Baskı birikiyor" : metrics[1].value !== null && metrics[1].value <= 30 ? "Enerjin düşük" : "Günlük denge" };
}

// Adult proportions; one continuous outer contour with restrained surface lines.
// No organ markers: the engine currently has no player-visible regional records.
const contour = "M120 20 C105 20 97 31 97 47 L99 64 Q102 77 110 82 L109 101 Q103 109 84 113 Q68 115 62 132 L54 164 Q49 185 46 204 L37 245 L29 265 Q24 278 26 288 L31 289 L34 277 L35 296 Q39 300 41 294 L45 279 L46 265 L54 244 Q65 218 67 204 L77 174 L80 160 Q83 181 81 202 L77 238 Q75 258 80 280 Q83 306 84 331 L84 368 Q81 392 86 417 L96 477 L97 500 L90 517 Q86 523 89 527 Q107 532 113 525 L115 508 L113 485 L115 438 Q121 409 117 383 L119 348 L120 308 L121 348 L123 383 Q119 409 125 438 L127 485 L125 508 L127 525 Q133 532 151 527 Q154 523 150 517 L143 500 L144 477 L154 417 Q159 392 156 368 L156 331 Q157 306 160 280 Q165 258 163 238 L159 202 Q157 181 160 160 L163 174 L173 204 Q175 218 186 244 L194 265 L195 279 L199 294 Q201 300 205 296 L206 277 L209 289 L214 288 Q216 278 211 265 L203 245 L194 204 Q191 185 186 164 L178 132 Q172 115 156 113 Q137 109 131 101 L130 82 Q138 77 141 64 L143 47 C143 31 135 20 120 20 Z";
const shapes = {
  head: "M94 16 H146 V105 H94 Z",
  chest: "M78 103 H162 V185 Q120 195 78 185 Z",
  abdomen: "M78 185 Q120 195 162 185 V302 H78 Z",
  back: "M78 103 H162 V302 H78 Z",
  arms: "M20 110 H78 V305 H20 Z M162 110 H220 V305 H162 Z",
  legs: "M76 302 H164 V538 H76 Z",
};
function silhouette(model) {
  const back = model.region.id === "back";
  return `<svg class="tc-body-figure" viewBox="0 0 240 550" role="group" aria-label="${back ? "Arkadan" : "Önden"} beden görünümü; bölge seçimi">
    <defs><linearGradient id="tc-body-surface" x1="0" y1="0" x2="1" y2=".25"><stop stop-color="#354d43"/><stop offset=".48" stop-color="#82978a"/><stop offset="1" stop-color="#354d43"/></linearGradient><clipPath id="tc-body-contour"><path d="${contour}"/></clipPath></defs>
    <path d="${contour}" fill="url(#tc-body-surface)" stroke="#b7c9ba" stroke-opacity=".55" stroke-width="1"/>
    <g clip-path="url(#tc-body-contour)">${BODY_REGIONS.filter(item => back ? !["chest", "abdomen"].includes(item.id) : item.id !== "back").map(item => `<path class="tc-body-region${item.id === model.region.id ? " is-selected" : ""}" d="${shapes[item.id]}" data-body-region="${item.id}" role="button" tabindex="0" aria-label="${item.label}" aria-pressed="${item.id === model.region.id}" aria-controls="tc-body-detail"><title>${item.label}</title></path>`).join("")}</g>
    <g class="tc-body-surface-lines" aria-hidden="true">${back ? `<path d="M120 100 V277 M88 128 Q104 133 112 157 L104 177 M152 128 Q136 133 128 157 L136 177 M84 254 Q102 266 116 260 M124 260 Q138 266 156 254"/>` : `<path d="M109 102 L120 116 L131 102 M83 123 Q104 124 117 137 M157 123 Q136 124 123 137 M87 159 Q103 168 116 160 M153 159 Q137 168 124 160 M120 174 V219 M117 231 Q120 234 123 231 M83 259 L112 280 M157 259 L128 280"/>`}
    <path d="M67 144 L57 194 M173 144 L183 194 M49 222 L40 261 M191 222 L200 261 M94 299 Q108 329 103 366 M146 299 Q132 329 137 366 M95 383 Q102 390 110 384 M145 383 Q138 390 130 384 M97 406 L105 473 M143 406 L135 473"/></g>
  </svg>`;
}
export function renderBodyVisual(state, { selected = "chest", risk = "", care = "", actions = "" } = {}) {
  const model = bodyVisualModel(state, selected);
  const metric = model.metrics.find(item => item.id === model.region.metric);
  return `<section class="panel tc-body-panel" aria-label="Beden durumu">
    <div class="tc-body-heading"><div><p class="panel-kicker">GENEL DURUM</p><h2>${model.status}</h2></div><span class="tc-body-status${model.attention ? " is-attention" : ""}">Oyun içi durum</span></div>
    <div class="tc-body-layout"><div class="tc-body-map">
      <div class="tc-body-facing" aria-label="Görünüm"><button type="button" data-body-region="chest" aria-pressed="${model.region.id !== "back"}">Ön</button><button type="button" data-body-region="back" aria-pressed="${model.region.id === "back"}">Arka</button></div>
      ${silhouette(model)}
      <p class="tc-body-map-hint">Bir bölge seç</p><div class="tc-body-region-list" aria-label="Vücut bölgeleri">${BODY_REGIONS.map(item => `<button type="button" id="body-region-${item.id}" data-body-region="${item.id}" aria-pressed="${item.id === model.region.id}" aria-controls="tc-body-detail">${item.label}</button>`).join("")}</div>
      <p class="tc-body-legend"><span></span> Altın vurgu: seçili bölge</p>
    </div><div class="tc-body-information">
      <div class="tc-body-metrics">${model.metrics.map(item => `<div class="tc-body-metric ${item.tone}"><div><span>${item.label}</span><strong>${item.value ?? "—"}<small> / 100</small></strong></div><div class="tc-body-meter" role="meter" aria-label="${item.label}" aria-valuemin="0" aria-valuemax="100" ${item.value === null ? 'aria-valuetext="Bilgi yok"' : `aria-valuenow="${item.value}"`}><i style="width:${item.value ?? 0}%"></i></div><small>${item.id === "stress" ? "Düşük değer daha sakin bir durumu gösterir." : item.id === "energy" ? "Günlük tempo için mevcut enerjin." : "Genel sağlık durumun."}</small></div>`).join("")}</div>
      <p class="tc-body-risk">${escape(risk)}</p>
      <section id="tc-body-detail" class="tc-body-detail" aria-labelledby="tc-body-region-title"><div aria-live="polite" aria-atomic="true"><p class="panel-kicker">SEÇİLİ BÖLGE</p><h3 id="tc-body-region-title">${model.region.label}</h3><p>Bu bölgeye özel bir sağlık kaydı bulunmuyor. Aşağıdaki bilgiler tüm bedeninle ilgilidir.</p><p class="tc-body-context">${metric.label}: <strong>${metric.value ?? "—"} / 100</strong> · Genel gösterge</p></div>
      <h4>Bu hafta kendine zaman ayır</h4><div class="tc-body-actions">${actions}</div></section>
      <section class="tc-body-known"><h3>Bilinen durumlar</h3>${model.conditions.length ? `<ul>${model.conditions.map(item => `<li><span>${escape(item.name)}</span><small class="${item.status === "resolved" ? "is-resolved" : ""}">${escape(item.outcome)}</small></li>`).join("")}</ul>` : `<p class="empty">Bilinen kalıcı bir durum yok.</p>`}${care ? `<p class="context-note">${escape(care)}</p>` : ""}</section>
      <p class="tc-body-disclaimer">Bu görünüm oyun içi durumu anlatır; tıbbi teşhis değildir. Bölge seçimi bir rahatsızlık işareti değildir.</p>
    </div></div></section>`;
}
export function bindBodyVisual(root, select) {
  root.querySelectorAll("[data-body-region]").forEach(element => {
    const choose = () => { if (BODY_REGIONS.some(region => region.id === element.dataset.bodyRegion)) select(element.dataset.bodyRegion); };
    element.addEventListener("click", choose);
    if (element.tagName?.toLowerCase() === "path") element.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(); }
    });
  });
}
