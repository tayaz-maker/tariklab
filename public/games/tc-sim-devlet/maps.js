// Strategy maps for DEVLET: Turkey's seven geographic regions and a
// diplomatic compass. Stylised but geographically legible: region outlines are
// projected from real coastline/border reference points (lon/lat to a 1000x460
// frame) and share their edges exactly. Not an administrative map.
import { escapeHtml as h, text as t } from "../next-wave/shared/runtime.js";
import {
  previewFocus,
  previewDiplomacy,
  regionNeeds,
  FOREIGN_TIES,
  DIPLOMACY,
  readGeo,
  quietMonths,
  reactionFor,
  QUIET_REACTION,
  LOW_DELIVERY,
  LOW_DELIVERY_FACTOR,
  AGREEMENT_AT,
  AGREEMENT_MONTHS,
  PRESSURE_BELOW,
} from "../next-wave/devlet-geo.js";

const P = {
  K: [262, 94], A: [265, 130], B: [225, 165], C: [290, 335], D: [630, 300],
  E: [620, 160], F: [566, 395], G: [905, 352], H: [862, 68],
};
const pts = (...list) => list.map((p) => (typeof p === "string" ? P[p] : p));
export const REGION_SHAPES = {
  marmara: pts("K", [222, 92], [183, 90], [178, 88], [150, 60], [117, 37], [90, 35], [48, 55], [35, 90], [24, 120], [30, 166], [40, 159], [28, 185], [24, 205], [56, 217], [120, 225], [185, 200], "B", "A"),
  karadeniz: pts("K", [316, 73], [400, 50], [487, 32], [520, 62], [547, 82], [627, 102], [720, 102], [761, 100], [807, 75], "H", [850, 110], [740, 150], "E", [520, 150], [400, 140], [300, 135], "A"),
  ege: pts([56, 217], [35, 250], [35, 284], [78, 277], [60, 300], [84, 315], [70, 345], [92, 372], [136, 384], [178, 399], [185, 395], [235, 360], "C", [270, 300], [250, 250], "B", [185, 200], [120, 225]),
  "ic-anadolu": pts("A", [300, 135], [400, 140], [520, 150], "E", [680, 205], [655, 265], "D", [490, 320], [420, 340], "C", [270, 300], [250, 250], "B"),
  akdeniz: pts([185, 395], [206, 428], [240, 400], [260, 382], [300, 392], [326, 405], [368, 440], [420, 425], [460, 387], [500, 403], [539, 402], [528, 435], [545, 447], "F", [578, 368], [625, 335], "D", [490, 320], [420, 340], "C", [235, 360]),
  guneydogu: pts("D", [700, 285], [760, 285], [820, 300], [870, 310], "G", [846, 353], [795, 369], [700, 385], [586, 393], "F", [578, 368], [625, 335]),
  dogu: pts("H", [908, 129], [955, 150], [979, 176], [960, 230], [954, 278], [975, 330], [979, 360], "G", [870, 310], [820, 300], [760, 285], [700, 285], "D", [655, 265], [680, 205], "E", [740, 150], [850, 110]),
};
const MARMARA_SEA = [[92, 142], [128, 124], [176, 114], [212, 116], [200, 134], [160, 146], [118, 152]];
const LABEL_AT = {
  marmara: [118, 196], karadeniz: [560, 118], ege: [150, 300], "ic-anadolu": [440, 235],
  akdeniz: [372, 385], guneydogu: [752, 336], dogu: [820, 215],
};
const REGION_NAME = {
  marmara: ["Marmara", "Marmara"], karadeniz: ["Karadeniz", "Black Sea"], ege: ["Ege", "Aegean"],
  "ic-anadolu": ["İç Anadolu", "Central Anatolia"], akdeniz: ["Akdeniz", "Mediterranean"],
  guneydogu: ["Güneydoğu Anadolu", "Southeastern Anatolia"], dogu: ["Doğu Anadolu", "Eastern Anatolia"],
};
const REGION_SHORT = { marmara: "MAR", karadeniz: "KAR", ege: "EGE", "ic-anadolu": "İÇA", akdeniz: "AKD", guneydogu: "GDA", dogu: "DAN" };
export const regionName = (id) => t(...(REGION_NAME[id] || [id, id]));
const path = (list) => `M${list.map((p) => p.join(",")).join("L")}Z`;

export const MAP_METRICS = [
  { id: "satisfaction", label: ["Memnuniyet", "Satisfaction"], read: (r) => r.satisfaction ?? 50 },
  { id: "impl", label: ["Uygulama hazırlığı", "Delivery readiness"], read: (r) => r.impl ?? 50 },
  { id: "services", label: ["Hizmet", "Services"], read: (r) => r.services ?? 50 },
  { id: "heat", label: ["Gerilim", "Tension"], read: (r) => r.heat ?? 40, inverse: true },
];
const metricOf = (id) => MAP_METRICS.find((m) => m.id === id) || MAP_METRICS[0];

/** 0 (bad) … 1 (good) on the DEVLET palette: oxblood → slate → sage. */
function tone(v, inverse) {
  const x = Math.max(0, Math.min(1, (inverse ? 100 - v : v) / 100));
  const stops = [[0, [110, 44, 40]], [0.45, [58, 70, 62]], [1, [147, 168, 120]]];
  let i = 0;
  while (i < stops.length - 2 && x > stops[i + 1][0]) i++;
  const [a, ca] = stops[i], [b, cb] = stops[i + 1];
  const k = (x - a) / (b - a);
  return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * k)).join(",")})`;
}
const n = (v) => (Number.isFinite(v) ? Math.round(v) : 0);
const signed = (v) => (v > 0 ? `+${v}` : `${v}`);

const NEED_LABEL = {
  services: ["Hizmet açığı", "Service gap"], infrastructure: ["Altyapı açığı", "Infrastructure gap"],
  satisfaction: ["Düşük memnuniyet", "Low satisfaction"], jobs: ["İş kaybı", "Job loss"],
  calm: ["Toplumsal gerilim", "Social tension"], impl: ["Zayıf uygulama", "Weak delivery"],
};

export function regionsMapHtml(s, { selected, metric }) {
  const g = readGeo(s);
  const m = metricOf(metric);
  const sel = s.regions.find((r) => r.id === selected) || null;
  // Colour spans the regions' actual spread (at least 20 points) so real
  // differences read at a glance; the legend prints the true range.
  const values = s.regions.map((r) => m.read(r));
  const lo = Math.min(...values), hi = Math.max(...values);
  const mid = (lo + hi) / 2, span = Math.max(20, hi - lo + 6);
  const shade = (v) => tone(50 + ((v - mid) / span) * 100, m.inverse);
  const shapes = s.regions
    .filter((r) => REGION_SHAPES[r.id])
    .map((r) => {
      const v = m.read(r);
      const focused = g.focus?.id === r.id;
      const label = `${regionName(r.id)}: ${t(...m.label)} ${n(v)}${focused ? ` · ${t("bu ayın önceliği", "this month's priority")}` : ""}`;
      return `<path class="geo-region${sel?.id === r.id ? " is-selected" : ""}${focused ? " is-focus" : ""}" d="${path(REGION_SHAPES[r.id])}" fill="${shade(v)}" data-region="${r.id}" tabindex="0" role="button" aria-pressed="${sel?.id === r.id}" aria-label="${h(label)}"><title>${h(label)}</title></path>`;
    })
    .join("");
  const labels = s.regions
    .filter((r) => LABEL_AT[r.id])
    .map((r) => {
      const [x, y] = LABEL_AT[r.id];
      return `<g class="geo-label" transform="translate(${x} ${y})"><text class="geo-label__name" text-anchor="middle">${h(regionName(r.id).toLocaleUpperCase(t("tr-TR", "en-GB")))}</text><text class="geo-label__short" text-anchor="middle">${REGION_SHORT[r.id]}</text><text class="geo-label__value" y="17" text-anchor="middle">${n(m.read(r))}</text>${g.focus?.id === r.id ? `<text class="geo-label__focus" y="-16" text-anchor="middle">◆ ${t("ÖNCELİK", "PRIORITY")}</text>` : ""}</g>`;
    })
    .join("");
  const [first, last] = m.inverse ? [hi, lo] : [lo, hi];
  const legend = `<div class="geo-legend" aria-hidden="true"><span>${m.inverse ? t("en gergin", "most tense") : t("en zayıf", "weakest")} ${n(first)}</span><i style="background:linear-gradient(90deg,${tone(0, false)},${tone(45, false)},${tone(100, false)})"></i><span>${m.inverse ? t("en sakin", "calmest") : t("en güçlü", "strongest")} ${n(last)}</span></div><div class="geo-chips" role="group" aria-label="${t("Bölge seç", "Select a region")}">${s.regions.filter((r) => REGION_SHAPES[r.id]).map((r) => `<button type="button" data-region="${r.id}" aria-pressed="${sel?.id === r.id}"><i style="background:${shade(m.read(r))}"></i>${h(regionName(r.id))} <b>${n(m.read(r))}</b></button>`).join("")}</div>`;
  const metrics = `<div class="geo-metrics" role="group" aria-label="${t("Harita göstergesi", "Map indicator")}">${MAP_METRICS.map((x) => `<button type="button" data-metric="${x.id}" aria-pressed="${x.id === m.id}">${t(...x.label)}</button>`).join("")}</div>`;
  const svg = `<svg class="geo-map" viewBox="0 0 1000 460" role="group" aria-label="${t("Türkiye'nin yedi coğrafi bölgesi", "Turkey's seven geographic regions")}"><defs><pattern id="geo-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#e8e3cf" stroke-opacity=".35" stroke-width="2"/></pattern><filter id="geo-glow"><feGaussianBlur stdDeviation="3"/></filter></defs><rect class="geo-sea" width="1000" height="460"/>${shapes}<path class="geo-inland-sea" d="${path(MARMARA_SEA)}"/>${s.regions.filter((r) => g.focus?.id === r.id && REGION_SHAPES[r.id]).map((r) => `<path class="geo-focus-hatch" d="${path(REGION_SHAPES[r.id])}" fill="url(#geo-hatch)"/>`).join("")}${labels}</svg>`;
  return `<section class="card geo-card"><div class="geo-head"><div><p class="eyebrow">${t("BÖLGESEL STRATEJİ HARİTASI", "REGIONAL STRATEGY MAP")}</p><h2>${t("Bölgeler", "Regions")}</h2></div>${metrics}</div><div class="geo-body">${svg}${legend}</div>${regionPanel(s, sel)}</section>`;
}

function regionPanel(s, r) {
  if (!r)
    return `<p class="geo-hint">${t("Bir bölge seç: ihtiyaçlarını, uygulama gücünü ve bu ay onu öncelik yapmanın bedelini gör.", "Select a region to see its needs, delivery strength and what making it this month's priority would cost.")}</p>`;
  const g = readGeo(s);
  const p = previewFocus(s, r.id);
  const needs = regionNeeds(r);
  const hist = (s.devletDepth?.regionalHistory || []).slice(-1)[0]?.regions?.find((x) => x.id === r.id);
  const trend = hist ? n((r.satisfaction ?? 50) - hist.satisfaction) : null;
  const row = (label, v, inverse) => `<div class="geo-row"><span>${t(...label)}</span><b>${n(v)}</b><i style="--v:${Math.max(0, Math.min(100, v))}%;--c:${tone(v, inverse)}"></i></div>`;
  const effects = Object.entries(p.gain || {})
    .map(([k, v]) => `<li><span>${t(...({ impl: ["Uygulama", "Delivery"], services: ["Hizmet", "Services"], infrastructure: ["Altyapı", "Infrastructure"], satisfaction: ["Memnuniyet", "Satisfaction"], heat: ["Gerilim", "Tension"] })[k])}</span><b class="${(k === "heat" ? v < 0 : v > 0) ? "good" : "bad"}">${signed(v)}</b></li>`)
    .join("");
  const quiet = quietMonths(s, r.id);
  const reaction = reactionFor(s, r);
  const gap = (r.services ?? 50) < 45 || (r.satisfaction ?? 50) < 45;
  const step = (label, body) => `<li><span>${label}</span>${body}</li>`;
  const chain = `<ol class="geo-chain" aria-label="${t("Öncelik zinciri", "Priority chain")}">${[
    step(t("Öncelik", "Priority"), g.focus?.id === r.id ? t("Bu ay bu bölge.", "This region, this month.") : quiet ? t(`${quiet} aydır öncelik almadı.`, `No priority for ${quiet} months.`) : t("Geçen ay öncelikti.", "Last month's priority.")),
    step(t("Kaynak / kapasite", "Resources / capacity"), (r.impl ?? 50) < LOW_DELIVERY ? t(`${p.cost} kapasite · uygulama hazırlığı ${n(r.impl)} düşük: etkinin %${Math.round(LOW_DELIVERY_FACTOR * 100)}'i hizmete döner.`, `${p.cost} capacity · delivery readiness ${n(r.impl)} is low: ${Math.round(LOW_DELIVERY_FACTOR * 100)}% of the effect becomes service.`) : t(`${p.cost} kapasite · uygulama hazırlığı ${n(r.impl)}: etki tam döner.`, `${p.cost} capacity · delivery readiness ${n(r.impl)}: the effect lands in full.`)),
    step(t("Hizmet açığı / kamu tepkisi", "Service gap / public reaction"), reaction ? t(`Tepki var: ay kapanınca gerilim +${reaction.heat}, memnuniyet ${reaction.satisfaction}, uygulama ${reaction.impl}.`, `Reaction under way: at month close tension +${reaction.heat}, satisfaction ${reaction.satisfaction}, delivery ${reaction.impl}.`) : gap ? t(`Açık var; ${Math.max(1, QUIET_REACTION - quiet - 1)} ay daha öncelik almazsa tepki başlar.`, `There is a gap; without a priority for ${Math.max(1, QUIET_REACTION - quiet - 1)} more months a reaction starts.`) : t("Belirgin açık yok.", "No clear gap.")),
    step(t("Sonraki dönem", "Next period"), t(`Öncelik verilirse gelecek ay memnuniyet +${p.later?.satisfaction ?? 1} daha${reaction ? "; tepki durur" : ""}.`, `If prioritised, satisfaction +${p.later?.satisfaction ?? 1} more next month${reaction ? "; the reaction stops" : ""}.`)),
  ].join("")}</ol>`;
  const status =
    g.focus?.id === r.id
      ? `<p class="geo-status is-set">◆ ${t("Bu ayın önceliği. Etkisi ay kapanınca uygulanır.", "This month's priority. It takes effect when the month closes.")}</p>`
      : `<button type="button" class="geo-act" data-focus="${r.id}" ${p.ok ? "" : "disabled"}>${t("Bu ay öncelik yap", "Make this month's priority")} · ${p.cost} ${t("kapasite", "capacity")}${p.ok ? "" : ` · ${h(t(...p.reason))}`}</button>`;
  return `<div class="geo-panel"><div class="geo-panel__main"><p class="eyebrow">${t("SEÇİLİ BÖLGE", "SELECTED REGION")}</p><h3>${h(regionName(r.id))}</h3><p class="geo-needs">${needs.map((x) => `<span>${t(...NEED_LABEL[x.key])}</span>`).join("")}</p>${row(["Uygulama hazırlığı", "Delivery readiness"], r.impl)}${row(["Hizmet", "Services"], r.services ?? 50)}${row(["Altyapı", "Infrastructure"], r.infrastructure ?? 50)}${row(["Memnuniyet", "Satisfaction"], r.satisfaction ?? 50)}${row(["Gerilim", "Tension"], r.heat, true)}<p class="geo-mini">${t("İşsizlik", "Unemployment")} %${n(r.unemployment)} · ${t("Ekonomik canlılık", "Activity")} ${n(r.activity)} · ${t("Göç çekimi", "Migration pull")} ${n(r.migration)}${trend !== null ? ` · ${t("Yıl içinde memnuniyet", "Satisfaction this year")} ${signed(trend)}` : ""}</p></div><div class="geo-panel__act"><p class="eyebrow">${t("BÖLGESEL ÖNCELİK", "REGIONAL PRIORITY")}</p><p>${t("Uygulama kapasitesini bu bölgeye yöneltir. Ay kapanınca:", "Directs delivery capacity to this region. When the month closes:")}</p><ul class="geo-effects">${effects}</ul><p class="geo-cost">${t(`Diğer ${p.others} bölge: memnuniyet ${p.neglect.satisfaction}, gerilim +${p.neglect.heat}.`, `The other ${p.others} regions: satisfaction ${p.neglect.satisfaction}, tension +${p.neglect.heat}.`)}${p.streak >= 3 ? ` ${t("Üst üste üçüncü ay: etki azalır.", "Third month in a row: returns diminish.")}` : ""}${p.reacting?.length ? ` ${t("Tepkisi süren bölgeler", "Regions still reacting")}: ${p.reacting.map((id) => h(regionName(id))).join(", ")}.` : ""}</p>${status}</div>${chain}</div>`;
}

// ---- Diplomatic compass ----

export const FOREIGN_LAYOUT = {
  us: [110, 110], nato: [250, 58], eu: [310, 170], gr: [250, 285], cy: [385, 360],
  ru: [560, 50], ir: [860, 230], gulf: [720, 385],
};
const FOREIGN_CODE = { us: "ABD", nato: "NATO", eu: "AB", gr: "YUN", cy: "KIB", ru: "RUS", ir: "İRN", gulf: "KÖR" };
const FOREIGN_CODE_EN = { us: "USA", nato: "NATO", eu: "EU", gr: "GRE", cy: "CYP", ru: "RUS", ir: "IRN", gulf: "GULF" };
const CENTER = [560, 230];
const KIND = {
  trade: { label: ["Ticaret görüşmesi", "Trade talks"], note: ["Ekonomik bağ; kıyı ve kapı bölgelerinde canlılık getirir.", "An economic tie; lifts activity in coastal and gateway regions."] },
  security: { label: ["Güvenlik mutabakatı", "Security accord"], note: ["Bölgesel riski azaltır; rakipler sertleşir, içeride tartışma yaratır.", "Lowers regional risk; rivals harden and it is contested at home."] },
  distance: { label: ["Mesafe koy", "Keep distance"], note: ["İçeride kenetlenme sağlar; ilişki ve ticaret zamanla soğur.", "Rallies support at home; the relation and trade cool over time."] },
};
const relBand = (v) =>
  v < 30 ? ["Gergin", "Strained"] : v < 45 ? ["Mesafeli", "Distant"] : v < 60 ? ["Dengeli", "Balanced"] : v < 75 ? ["Yakın", "Close"] : ["Çok yakın", "Very close"];

export function foreignMapHtml(s, { selected, nameOf }) {
  const g = readGeo(s);
  const pending = new Set(g.pending.map((p) => p.axis));
  const axes = Object.keys(FOREIGN_LAYOUT).filter((k) => k in (s.foreign || {}));
  const links = axes
    .map((k) => {
      const [x, y] = FOREIGN_LAYOUT[k], v = s.foreign[k];
      return `<line class="dip-link${selected === k ? " is-selected" : ""}" x1="${CENTER[0]}" y1="${CENTER[1]}" x2="${x}" y2="${y}" stroke="${tone(v)}" stroke-width="${1.5 + v / 22}" ${v < 40 ? 'stroke-dasharray="6 6"' : ""}/>`;
    })
    .join("");
  const nodes = axes
    .map((k) => {
      const [x, y] = FOREIGN_LAYOUT[k], v = s.foreign[k];
      const label = `${nameOf(k)}: ${n(v)} · ${t(...relBand(v))}${pending.has(k) ? ` · ${t("yolda bir sonuç var", "a consequence is on the way")}` : ""}`;
      return `<g class="dip-node${selected === k ? " is-selected" : ""}" data-axis="${k}" tabindex="0" role="button" aria-pressed="${selected === k}" aria-label="${h(label)}" transform="translate(${x} ${y})"><title>${h(label)}</title>${pending.has(k) ? '<circle class="dip-pending" r="34"/>' : ""}<circle class="dip-disc" r="27" fill="${tone(v)}"/><text class="dip-code" text-anchor="middle" y="5">${t(FOREIGN_CODE[k], FOREIGN_CODE_EN[k])}</text><text class="dip-value" text-anchor="middle" y="46">${n(v)}</text></g>`;
    })
    .join("");
  const turkey = Object.values(REGION_SHAPES)
    .map((shape) => `<path d="${path(shape)}"/>`)
    .join("");
  const svg = `<svg class="dip-map" viewBox="0 0 1000 440" role="group" aria-label="${t("Dış ilişkiler haritası", "Foreign relations map")}"><rect class="dip-bg" width="1000" height="440"/><g class="dip-rings"><circle cx="${CENTER[0]}" cy="${CENTER[1]}" r="120"/><circle cx="${CENTER[0]}" cy="${CENTER[1]}" r="240"/><circle cx="${CENTER[0]}" cy="${CENTER[1]}" r="360"/></g>${links}<g class="dip-home" transform="translate(${CENTER[0] - 150} ${CENTER[1] - 62}) scale(.3)">${turkey}</g><text class="dip-home-label" x="${CENTER[0]}" y="${CENTER[1] + 92}" text-anchor="middle">${t("ANKARA", "ANKARA")}</text>${nodes}</svg>`;
  return `<section class="card geo-card dip-card"><div class="geo-head"><div><p class="eyebrow">${t("DİPLOMATİK PUSULA", "DIPLOMATIC COMPASS")}</p><h2>${t("Dış ilişkiler", "Foreign relations")}</h2></div><p class="geo-note">${t("Çizgi kalınlığı ve rengi ilişki endeksini (0–100) gösterir; kesikli çizgi gergin ilişkidir. Konumlar yönü anlatır, mesafeyi değil.", "Line weight and colour show the relation index (0–100); dashed means strained. Positions show direction, not distance.")}</p></div><div class="geo-body">${svg}</div>${actorPanel(s, selected, nameOf)}</section>`;
}

function actorPanel(s, axis, nameOf) {
  if (!axis || !(axis in (s.foreign || {})))
    return `<p class="geo-hint">${t("Bir tarafı seç: ilişkiyi, bağlantılı tarafları ve girişim seçeneklerinin bedelini gör.", "Select a party to see the relation, who is tied to it and what each initiative costs.")}</p>`;
  const v = s.foreign[axis], ties = FOREIGN_TIES[axis];
  const g = readGeo(s);
  const pending = g.pending.filter((p) => p.axis === axis);
  const options = Object.keys(DIPLOMACY)
    .map((kind) => {
      const p = previewDiplomacy(s, axis, kind);
      const rel = Object.entries(p.relation || {})
        .map(([k, r]) => `<li><span>${h(nameOf(k))}</span><b class="${r.to >= r.from ? "good" : "bad"}">${n(r.from)} → ${n(r.to)}</b></li>`)
        .join("");
      const world = Object.entries(p.world || {})
        .map(([k, d]) => `${t(...({ tradeDemand: ["Dış talep", "Trade demand"], regionalRisk: ["Bölgesel risk", "Regional risk"] })[k])} ${signed(d)}`)
        .join(" · ");
      const later = p.later || {};
      const laterText = [
        later.relation ? `${t("ilişki", "relation")} ${signed(later.relation)}` : "",
        later.activity ? `${t("Marmara, Ege, Akdeniz canlılığı", "Marmara, Aegean, Mediterranean activity")} ${signed(later.activity)}` : "",
        later.regionalRisk ? `${t("bölgesel risk", "regional risk")} ${signed(later.regionalRisk)}` : "",
        later.tradeDemand ? `${t("dış talep", "trade demand")} ${signed(later.tradeDemand)}` : "",
      ].filter(Boolean).join(" · ");
      const deal = p.breach
        ? `<p class="geo-mini dip-breach">${t(`Süren anlaşmayı bozar: ilişki ${p.breach.relation}, iç gerilim +${p.breach.heat}.`, `Breaks the running agreement: relation ${p.breach.relation}, domestic tension +${p.breach.heat}.`)}</p>`
        : p.formsAgreement
          ? `<p class="geo-mini">${t(`Vadesinde ilişki ${AGREEMENT_AT}+ kalırsa ${AGREEMENT_MONTHS} aylık anlaşma olur.`, `If the relation stays ${AGREEMENT_AT}+ when it lands, a ${AGREEMENT_MONTHS}-month agreement forms.`)}</p>`
          : "";
      return `<article class="dip-option"><h4>${t(...KIND[kind].label)}</h4>${deal}<p class="muted">${t(...KIND[kind].note)}</p><ul class="geo-effects">${rel}</ul><p class="geo-mini">${world}${p.heat ? ` · ${t("İç gerilim", "Domestic tension")} ${signed(p.heat)}` : ""}</p><p class="geo-mini dip-later">${t(`${p.dueIn} ay sonra`, `In ${p.dueIn} months`)}: ${laterText}</p><button type="button" class="geo-act" data-diplo="${axis}:${kind}" ${p.ok ? "" : "disabled"}>${t("Başlat", "Launch")} · ${p.cost} ${t("kapasite", "capacity")}${p.ok ? "" : ` · ${h(t(...p.reason))}`}</button></article>`;
    })
    .join("");
  return `<div class="geo-panel dip-panel"><div class="geo-panel__main"><p class="eyebrow">${t("SEÇİLİ TARAF", "SELECTED PARTY")}</p><h3>${h(nameOf(axis))}</h3><div class="geo-row"><span>${t("İlişki endeksi", "Relation index")}</span><b>${n(v)} · ${t(...relBand(v))}</b><i style="--v:${v}%;--c:${tone(v)}"></i></div><p class="geo-mini">${ties.rivals.length ? `${t("Yakınlaşmaya tepki verenler", "React against closer ties")}: ${ties.rivals.map((k) => h(nameOf(k))).join(", ")}. ` : ""}${ties.partners.length ? `${t("Birlikte ısınanlar", "Warm alongside")}: ${ties.partners.map((k) => h(nameOf(k))).join(", ")}.` : ""}</p>${pending.length ? `<p class="geo-status is-set">${pending.map((p) => `◆ ${t(...KIND[p.kind].label)} · ${t(`${p.due - s.time.turn} ay içinde sonuç`, `result in ${p.due - s.time.turn} months`)}`).join("<br>")}</p>` : ""}${g.agreements?.[axis] && g.agreements[axis].until >= s.time.turn ? `<p class="geo-status is-set">◆ ${t(`${t(...KIND[g.agreements[axis].kind].label)} anlaşması · ${g.agreements[axis].until - s.time.turn} ay kaldı · her ay ${g.agreements[axis].kind === "trade" ? "dış talep +0,5" : "bölgesel risk −0,5"}`, `${t(...KIND[g.agreements[axis].kind].label)} agreement · ${g.agreements[axis].until - s.time.turn} months left · each month ${g.agreements[axis].kind === "trade" ? "trade demand +0.5" : "regional risk −0.5"}`)}</p>` : ""}${v < PRESSURE_BELOW ? `<p class="geo-mini dip-breach">${t(`Baskı: ilişki ${PRESSURE_BELOW}'un altında; her ay dış talep −0,5 ve iç gerilim +0,5.`, `Pressure: the relation is below ${PRESSURE_BELOW}; each month trade demand −0.5 and domestic tension +0.5.`)}</p>` : ""}<p class="geo-mini">${t("Endeks oyunun kendi ilişki ölçüsüdür; gerçek bir ülkenin tutumu hakkında iddia değildir.", "The index is the game's own relation measure, not a claim about any real country's position.")}</p></div><div class="dip-options">${options}</div></div>`;
}
