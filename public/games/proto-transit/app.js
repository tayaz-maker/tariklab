// Coastal rhythm-network prototype: DOM layer. Rules live in sim.js.
import {
  AGREEMENTS,
  CORRIDORS,
  DAYS,
  DISTRICTS,
  DISTRICT_IDS,
  MODES,
  NEEDS,
  UPGRADES,
  WINDOWS,
} from "./data.js";
import * as S from "./sim.js";

const KEY = "tariklab.proto-transit.v1";
const root = document.getElementById("app");
const AGR = Object.fromEntries(AGREEMENTS.map((a) => [a.id, a]));
const CORR = Object.fromEntries(CORRIDORS.map((c) => [S.keyOf(c.a, c.b), c]));

const lang = () => (window.tlabI18n?.getLang?.() === "en" ? "en" : "tr");
const t = (tr, en) => (lang() === "en" ? en : tr);
const pair = (p) => (Array.isArray(p) ? t(p[0], p[1]) : p);
const h = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const dn = (d) => t(DISTRICTS[d].tr, DISTRICTS[d].en);
const mn = (m) => t(MODES[m].tr, MODES[m].en);
const wn = (w) => t(w.tr, w.en);
const corrName = (k) => `${dn(CORR[k].a)} – ${dn(CORR[k].b)}`;

let state = load();
let notice = "";
let forecast = null; // one exact forecast per render

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? S.normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function save() {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    /* Storage may be unavailable; the run still works for this visit. */
  }
}

// ---------- map ----------

const P = (d) => [DISTRICTS[d].x, DISTRICTS[d].y];

function linePath(k, mode) {
  const [x1, y1] = P(CORR[k].a),
    [x2, y2] = P(CORR[k].b);
  if (mode === "ferry") {
    const mx = (x1 + x2) / 2 + (y2 - y1) * 0.18,
      my = (y1 + y2) / 2 - (x2 - x1) * 0.18;
    return `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
  }
  if (mode === "lift") {
    const steps = 5;
    let d = `M${x1} ${y1}`;
    for (let i = 1; i <= steps; i++) {
      const xa = x1 + ((x2 - x1) * i) / steps,
        ya = y1 + ((y2 - y1) * (i - 1)) / steps,
        yb = y1 + ((y2 - y1) * i) / steps;
      d += ` L${xa} ${ya} L${xa} ${yb}`;
    }
    return d;
  }
  return `M${x1} ${y1} L${x2} ${y2}`;
}

function loadFor(s) {
  const r = s.phase === "report" ? s.report : s.phase === "plan" ? forecast : null;
  if (!r) return null;
  return r.windows[s.ui.window] || null;
}

function lineSvg(s, k, win) {
  const l = s.links[k];
  const sel = s.ui.selected === k;
  const label = `${corrName(k)}: ${l ? mn(l.mode) : t("hat yok", "no line") + " · " + CORR[k].modes.map(mn).join(", ")}`;
  const hit = `<path d="${linePath(k, l ? l.mode : "tram")}" class="hit"/>`;
  if (!l)
    return `<g class="corr ${sel ? "is-sel" : ""}" data-corr="${k}" role="button" tabindex="0" aria-label="${h(label)}">${hit}<path d="${linePath(k, CORR[k].modes[0])}" class="guide"/></g>`;
  const m = MODES[l.mode];
  const load = win && win.cap[k] ? win.load[k] / win.cap[k] : null;
  const over = win && win.overloaded.includes(k);
  const w = 2.5 + l.freq * 1.5;
  let body;
  if (l.mode === "tram")
    body = `<path d="${linePath(k, "tram")}" stroke="${m.colour}" stroke-width="${w + 4}" class="rail-outer"/><path d="${linePath(k, "tram")}" stroke="#0e1822" stroke-width="${w}"/>`;
  else if (l.mode === "ferry")
    body = `<path d="${linePath(k, "ferry")}" stroke="${m.colour}" stroke-width="${w}" stroke-dasharray="14 8" fill="none"/>`;
  else if (l.mode === "lift")
    body = `<path d="${linePath(k, "lift")}" stroke="${m.colour}" stroke-width="${w}" fill="none" stroke-linejoin="round"/>`;
  else
    body = `<path d="${linePath(k, "bridge")}" stroke="${m.colour}" stroke-width="${w + 3}" stroke-dasharray="3 3"/>`;
  const [x1, y1] = P(CORR[k].a),
    [x2, y2] = P(CORR[k].b);
  const mx = (x1 + x2) / 2,
    my = (y1 + y2) / 2;
  const marks = `${l.night ? `<circle cx="${mx + 12}" cy="${my - 12}" r="6" class="moon"/>` : ""}${l.ramp ? `<rect x="${mx - 18}" y="${my - 18}" width="10" height="10" class="ramp"/>` : ""}`;
  const loadMark =
    load == null
      ? ""
      : `<text x="${mx}" y="${my + 20}" class="load ${over ? "over" : ""}" text-anchor="middle">${Math.round(load * 100)}%</text>`;
  return `<g class="corr built ${sel ? "is-sel" : ""} ${over ? "is-over" : ""}" data-corr="${k}" role="button" tabindex="0" aria-label="${h(label + (load != null ? ` · ${Math.round(load * 100)}%` : ""))}">${hit}${body}${marks}${loadMark}</g>`;
}

function districtSvg(s, d) {
  const D = DISTRICTS[d];
  const f = s.fragility[d];
  const broken = s.broken.includes(d);
  const glyphs = Object.entries(D.attract)
    .map(([n, v]) => `<tspan class="g-${n}">${NEEDS[n].glyph.repeat(v)}</tspan>`)
    .join(" ");
  const home = D.pop ? `<tspan class="pop">${"⌂".repeat(D.pop)}</tspan>` : "";
  const w = 128,
    hh = 50;
  return `<g class="district ${broken ? "is-broken" : ""}" transform="translate(${D.x - w / 2} ${D.y - hh / 2})"><rect width="${w}" height="${hh}" rx="8"/><text x="10" y="19" class="dname">${h(dn(d))}</text><text x="10" y="37" class="glyphs">${home} ${glyphs}</text><rect x="0" y="${hh - 4}" width="${(w * f) / 100}" height="4" class="frag" style="fill:${f >= 70 ? "#e0866f" : f >= 40 ? "#d9b25f" : "#7fb3a6"}"/>${D.level ? `<text x="${w - 8}" y="19" text-anchor="end" class="lvl">${"▴".repeat(D.level)}</text>` : ""}</g>`;
}

function mapSvg(s) {
  const win = loadFor(s);
  const contours = [0, 1, 2, 3, 4]
    .map(
      (i) =>
        `<path d="M${690 + i * 22} 640 C ${760 + i * 18} ${520 - i * 30}, ${700 + i * 26} ${330 - i * 20}, ${800 + i * 20} ${120 + i * 10} S ${960} ${40 + i * 12}, 1000 ${60 + i * 16}" class="contour"/>`,
    )
    .join("");
  const ripples = [0, 1, 2, 3, 4, 5]
    .map(
      (i) => `<path d="M${40 + i * 90} ${320 + (i % 3) * 22} q 20 -6 40 0 t 40 0" class="ripple"/>`,
    )
    .join("");
  return `<svg class="map" viewBox="0 0 1000 640" role="img" aria-label="${h(t("Körfez kentinin gece haritası", "Night map of the bay city"))}">
    <rect width="1000" height="640" class="land"/>
    <path d="M0 262 C 160 250, 300 290, 450 300 C 560 308, 640 320, 700 350 C 650 380, 560 400, 450 410 C 300 420, 160 420, 0 430 Z" class="water"/>
    ${ripples}${contours}
    <path d="M620 300 C 640 280, 660 262, 700 250" class="creek"/>
    <text x="36" y="350" class="sea-label">${h(t("KÖRFEZ", "THE BAY"))}</text><text x="930" y="620" class="sea-label" text-anchor="end">${h(t("TEPELER", "HILLS"))}</text>
    ${Object.keys(CORR)
      .map((k) => lineSvg(s, k, win))
      .join("")}
    ${DISTRICT_IDS.map((d) => districtSvg(s, d)).join("")}
  </svg>`;
}

// ---------- panels ----------

function corridorPanel(s) {
  const k = s.ui.selected;
  const pick = `<label class="corr-pick">${t("Koridor", "Corridor")}<select id="corr-select"><option value="">${t("Haritadan ya da buradan seç", "Pick on the map or here")}</option>${Object.keys(
    CORR,
  )
    .map(
      (c) =>
        `<option value="${c}" ${c === k ? "selected" : ""}>${h(corrName(c))}${s.links[c] ? " · " + h(t(...MODES[s.links[c].mode].short)) : ""}</option>`,
    )
    .join("")}</select></label>`;
  if (!k)
    return `<section class="panel corr-panel">${pick}<p class="small">${t("Bir koridor seç: arazinin izin verdiği hat türlerini ve bedelini gör.", "Pick a corridor to see which line types the terrain allows and what they cost.")}</p></section>`;
  const l = s.links[k];
  let body;
  if (!l) {
    body = `<div class="modes">${CORR[k].modes
      .map((m) => {
        const c = S.canBuild(s, k, m);
        const M = MODES[m];
        return `<button type="button" data-build="${m}" ${c.ok ? "" : "disabled"}><span class="swatch" style="--c:${M.colour}"></span><b>${h(mn(m))}</b><span>${M.cost} ${t("puan", "pts")} · ${t("kapasite", "capacity")} ${M.cap} · ${t("süre", "time")} ${M.time}${M.accessible ? "" : " · " + t("basamaklı", "stairs")}</span>${c.ok ? "" : `<em>${h(pair(c.reason))}</em>`}</button>`;
      })
      .join("")}</div>`;
  } else {
    const ups = Object.entries(UPGRADES)
      .map(([u, U]) => {
        const c = S.canUpgrade(s, k, u);
        return c.ok ||
          (u === "freq" && l.mode !== "bridge") ||
          (u === "night" && l.mode !== "bridge") ||
          (u === "ramp" && l.mode === "bridge")
          ? `<button type="button" data-upgrade="${u}" ${c.ok ? "" : "disabled"}>${h(t(U.tr, U.en))} · ${U.cost} ${t("puan", "pt")}${c.ok ? "" : ` <em>${h(pair(c.reason))}</em>`}</button>`
          : "";
      })
      .join("");
    body = `<p><b>${h(mn(l.mode))}</b> · ${t("sıklık", "frequency")} ${l.freq}/${S.MAX_FREQ}${l.night ? " · " + t("gece seferi", "night service") : ""}${l.ramp ? " · " + t("rampa", "ramp") : ""}</p><div class="ups">${ups}${S.unbuild(structuredClone(s), k) ? `<button type="button" data-unbuild="1" class="ghost">${t("Bugün kurulanı geri al", "Undo today's build")}</button>` : ""}</div>`;
  }
  return `<section class="panel corr-panel" aria-live="polite">${pick}<h3>${h(corrName(k))}</h3>${body}</section>`;
}

function offerPanel(s) {
  const active = s.agreements.filter((a) => !a.done);
  const past = s.agreements.filter((a) => a.done);
  const offer = s.offer ? AGR[s.offer] : null;
  return `<section class="panel agreements"><h3>${t("Mahalle anlaşmaları", "District agreements")}</h3>
    ${offer ? `<article class="offer"><p class="eyebrow">${h(dn(offer.district))} · ${t("teklif", "offer")}</p><h4>${h(t(offer.tr[0], offer.en[0]))}</h4><p>${h(t(offer.tr[1], offer.en[1]))}</p><p class="small">${t(`Süre: ${offer.days} gün. Tutarsan +${S.KEPT_BONUS} puan ve mahallenin kırılganlığı −20; tutmazsan +30. Reddetmek +5.`, `Due in ${offer.days} days. Keep it: +${S.KEPT_BONUS} points and −20 fragility there; break it: +30. Declining: +5.`)}</p><div class="row"><button type="button" data-offer="yes" class="primary">${t("Söz ver", "Promise")}</button><button type="button" data-offer="no">${t("Reddet", "Decline")}</button></div></article>` : ""}
    ${active.length ? `<ul class="agr">${active.map((a) => `<li>${h(t(AGR[a.id].tr[0], AGR[a.id].en[0]))} · ${h(dn(AGR[a.id].district))} · ${t("son gün", "due day")} ${a.due}</li>`).join("")}</ul>` : ""}
    ${past.length ? `<ul class="agr done">${past.map((a) => `<li class="${a.kept ? "ok" : "bad"}">${a.kept ? "✓" : "✗"} ${h(t(AGR[a.id].tr[0], AGR[a.id].en[0]))}</li>`).join("")}</ul>` : ""}
    ${!offer && !active.length && !past.length ? `<p class="small">${t("Teklifler 1., 3. ve 5. günlerde gelir.", "Offers arrive on days 1, 3 and 5.")}</p>` : ""}
  </section>`;
}

function windowTabs(s) {
  return `<div class="wins" role="group" aria-label="${h(t("Ritim penceresi", "Rhythm window"))}">${WINDOWS.map((w, i) => `<button type="button" data-win="${i}" aria-pressed="${s.ui.window === i}">${h(wn(w))}</button>`).join("")}</div>`;
}

function dayRows(r) {
  return `<ul class="daywin">${r.windows
    .map((w, i) => {
      const pc = w.total ? Math.round((w.served / w.total) * 100) : 100;
      return `<li><span>${h(wn(WINDOWS[i]))}</span><span class="bar"><span style="width:${pc}%"></span></span><b>${w.served}/${w.total}</b>${w.overloaded.length ? `<em>${w.overloaded.length} ${t("dolu hat", "full lines")}</em>` : ""}</li>`;
    })
    .join("")}</ul>
    <dl class="kpi"><div><dt>${t("Ritim karşılama", "Rhythm coverage")}</dt><dd>${r.coverage}%</dd></div><div><dt>${t("Erişilebilirlik", "Accessibility")}</dt><dd>${r.access}%</dd></div><div><dt>${t("Aktarma güveni", "Transfer reliability")}</dt><dd>${r.reliability}</dd></div><div><dt>${t("Ortalama kırılganlık", "Average fragility")}</dt><dd>${r.fragility}</dd></div></dl>`;
}

function dayPanel(s) {
  if (s.phase === "end") return endPanel(s);
  if (s.phase === "report") {
    const r = s.report;
    const agr = r.agreements
      .map(
        (a) =>
          `<li class="${a.kept ? "ok" : "bad"}">${a.kept ? t("Söz tutuldu", "Promise kept") : t("Söz tutulmadı", "Promise broken")}: ${h(t(AGR[a.id].tr[0], AGR[a.id].en[0]))}</li>`,
      )
      .join("");
    const worse = DISTRICT_IDS.filter((d) => r.fragAfter[d] - r.fragBefore[d] >= 5)
      .map((d) => `${h(dn(d))} +${r.fragAfter[d] - r.fragBefore[d]}`)
      .join(", ");
    return `<section class="panel day"><h2>${t("Gün", "Day")} ${r.day} · ${t("rapor", "report")}</h2>${windowTabs(s)}${dayRows(r)}
      ${agr ? `<ul class="agr">${agr}</ul>` : ""}
      ${worse ? `<p class="bad small">${t("Kırılganlığı artanlar", "Growing fragility")}: ${worse}</p>` : ""}
      ${r.newlyBroken.length ? `<p class="bad">${t("Ağdan koptu", "Cut off")}: ${r.newlyBroken.map(dn).join(", ")}</p>` : ""}
      <p class="small">${t("Yarın", "Tomorrow")}: +${r.pointsNext} ${t("yapım puanı", "build points")}</p>
      <button type="button" class="primary wide" id="next">${s.day >= DAYS || s.broken.length >= S.MAX_BROKEN ? t("Sonucu gör", "See the result") : t("Sonraki gün", "Next day")}</button></section>`;
  }
  const p = forecast;
  const due = s.agreements.filter((a) => !a.done && a.due === s.day);
  return `<section class="panel day"><h2>${t("Günün tahmini", "Today's forecast")}</h2>
    <p class="small">${t("Tahmin, günü çalıştırınca olacak sonucun aynısıdır.", "The forecast is exactly what running the day will do.")}${s.wind[s.day - 1] ? " " + t("Bugün rüzgâr var: vapurlar sabah ve akşam yarım kapasite.", "Wind today: ferries run at half capacity morning and evening.") : ""}</p>
    ${windowTabs(s)}${dayRows(p)}
    ${due.length ? `<p class="small">${t("Bugün sonuçlanacak sözler", "Promises due today")}: ${due.map((a) => h(t(AGR[a.id].tr[0], AGR[a.id].en[0]))).join(", ")} → ${p.agreements.map((a) => (a.kept ? "✓" : "✗")).join(" ")}</p>` : ""}
    ${p.newlyBroken.length ? `<p class="bad">${t("Bu haliyle kopacak", "Will be cut off as it stands")}: ${p.newlyBroken.map(dn).join(", ")}</p>` : ""}
    ${s.offer ? `<p class="small">${t("Cevaplanmayan teklif reddedilmiş sayılır.", "An unanswered offer counts as declined.")}</p>` : ""}
    <button type="button" class="primary wide" id="run">${t("Günü çalıştır", "Run the day")}</button></section>`;
}

function endPanel(s) {
  const v = S.verdict(s);
  const m = S.summary(s);
  return `<section class="panel day end"><p class="eyebrow">${t("Altı gün tamamlandı", "Six days complete")}</p><h2>${h(t(v.tr[0], v.en[0]))}</h2><p>${h(t(v.tr[1], v.en[1]))}</p>
    <dl class="kpi"><div><dt>${t("Son gün karşılama", "Final-day coverage")}</dt><dd>${m.finalCoverage}%</dd></div><div><dt>${t("Son gün erişilebilirlik", "Final-day accessibility")}</dt><dd>${m.finalAccess}%</dd></div><div><dt>${t("Altı gün ortalaması", "Six-day average")}</dt><dd>${m.coverage}%</dd></div><div><dt>${t("Tutulan / bozulan söz", "Promises kept / broken")}</dt><dd>${m.kept} / ${m.brokenPromises}</dd></div><div><dt>${t("Kopan mahalle", "Districts cut off")}</dt><dd>${m.broken}</dd></div></dl>
    <ol class="history">${s.history.map((x) => `<li>${t("Gün", "Day")} ${x.day}: ${x.coverage}% · ${t("erişim", "access")} ${x.access}%</li>`).join("")}</ol>
    <button type="button" class="primary wide" id="restart">${t("Yeni kıyı", "New coast")}</button></section>`;
}

function districtsPanel(s) {
  return `<section class="panel districts"><h3>${t("Mahalleler", "Districts")}</h3><ul>${DISTRICT_IDS.map(
    (d) => {
      const f = s.fragility[d];
      return `<li class="${s.broken.includes(d) ? "bad" : ""}"><span>${h(dn(d))}</span><span class="bar frag"><span style="width:${f}%"></span></span><b>${f}</b></li>`;
    },
  ).join("")}</ul>
  <p class="small">${t("Kırılganlık 100 olursa mahalle ağdan kopar. Üç mahalle koparsa oyun biter.", "At 100 fragility a district cuts itself off. Three cut off ends the run.")}</p></section>`;
}

function legend() {
  return `<p class="legend">${Object.entries(MODES)
    .map(
      ([, M]) =>
        `<span><span class="swatch" style="--c:${M.colour}"></span>${h(t(...M.short))}</span>`,
    )
    .join("")}<span>⌂ ${t("konut", "homes")}</span>${Object.entries(NEEDS)
    .map(([n, N]) => `<span class="g-${n}">${N.glyph} ${h(t(N.tr, N.en))}</span>`)
    .join("")}<span>● ${t("gece seferi", "night service")}</span></p>`;
}

function help() {
  return `<details class="help"><summary>${t("Nasıl oynanır", "How to play")}</summary><div>
    <p>${t("Bir körfez kentinin günlük ritmini bağlıyorsun. Her gün dört pencereden oluşur: sabah iş ve okul, öğle bakım ve sağlık, akşam dönüş ve bakım, gece eğlence ve acil sağlık.", "You connect the daily rhythm of a bay city. Each day has four windows: morning work and school, midday care and health, evening return and care, night life and urgent health.")}</p>
    <ul><li>${t("Arazi hattı belirler: vapur yalnız suyun üstünden, asansör yalnız yokuşa, tramvay düzlüğe, yaya geçidi dereye.", "Terrain decides the line: ferries only over water, lifts only up slopes, trams on the flat, footbridges over the creek.")}</li>
    <li>${t("Gece penceresinde yalnız gece seferi olan hatlar ve yaya geçitleri çalışır.", "In the night window only lines with night service, and footbridges, run.")}</li>
    <li>${t("Bakım ve sağlık yolculuğu basamaklı bir geçitten geçiyorsa yolcuların yarısı ulaşamaz; rampa ekle.", "If a care or health trip crosses a stepped footbridge, half the travellers cannot make it; add a ramp.")}</li>
    <li>${t("Mod değiştirmek aktarma demektir; aktarma güveni düşer.", "Changing mode is a transfer; transfer reliability drops.")}</li>
    <li>${t("Klavye: 1–4 pencereyi seçer, Enter seçili koridoru açar.", "Keyboard: 1–4 pick the window, Enter opens the focused corridor.")}</li></ul></div></details>`;
}

function start() {
  root.innerHTML = `<main class="start"><div class="start-card"><p class="eyebrow">${t("PROTOTİP · ADI HENÜZ YOK", "PROTOTYPE · NOT YET NAMED")}</p>
    <h1>${t("Kıyı ritmi ağı", "Coastal rhythm network")}</h1>
    <p>${t("Bir körfez kenti, on mahalle, dört hat türü, altı gün. Sabahın işini, öğlenin bakımını, gecenin dönüşünü aynı ağla taşı; mahallelere verdiğin sözleri tut.", "A bay city, ten districts, four kinds of line, six days. Carry the morning's work, the midday's care and the night's return on one network, and keep your word to the districts.")}</p>
    <div class="row">${state ? `<button type="button" id="resume">${t("Kaldığın yerden", "Resume")}</button>` : ""}<button type="button" class="primary" id="begin">${t("Haritayı aç", "Open the map")}</button></div>
    ${help()}<p class="small"><a href="/">${t("← Oyunlar", "← Games")}</a></p></div></main>`;
}

function render() {
  document.documentElement.lang = lang();
  if (!state || state.ui.view === "start") return start();
  const s = state;
  forecast = s.phase === "plan" ? S.previewDay(s) : null;
  const tab = s.ui.tab || "map";
  const dayLabel = s.ended ? t("Bitti", "Finished") : `${t("Gün", "Day")} ${s.day}/${DAYS}`;
  const windText = s.ended ? "" : s.wind[s.day - 1] ? t("rüzgâr", "wind") : t("sakin", "calm");
  const tomorrow =
    !s.ended && s.day < DAYS
      ? s.wind[s.day]
        ? t("yarın rüzgâr", "wind tomorrow")
        : t("yarın sakin", "calm tomorrow")
      : "";
  root.innerHTML = `<main class="game" data-tab="${tab}">
    <header class="top"><a href="/" class="back">${t("← Oyunlar", "← Games")}</a><span class="day">${dayLabel}</span><span class="wx">${h(windText)}${tomorrow ? " · " + h(tomorrow) : ""}</span><div class="title"><strong>${t("Kıyı ritmi ağı", "Coastal rhythm network")}</strong><span class="proto">${t("prototip", "prototype")}</span></div><span class="pts">${t("Yapım puanı", "Build points")} <b>${s.points}</b></span><span class="lang-slot"></span><button type="button" id="menu">${t("Menü", "Menu")}</button></header>
    <nav class="tabs" role="tablist">${[
      ["map", "Harita", "Map"],
      ["day", "Gün", "Day"],
      ["book", "Defter", "Ledger"],
    ]
      .map(
        ([k, tr, en]) =>
          `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${t(tr, en)}</button>`,
      )
      .join("")}</nav>
    <p class="notice" role="status">${h(notice)}</p>
    <div class="work"><div class="col col-map"><div class="map-wrap" tabindex="0" aria-label="${h(t("Harita", "Map"))}">${mapSvg(s)}</div><p class="map-hint">${t("Haritayı yana kaydır; koridoru aşağıdaki listeden de seçebilirsin.", "Swipe the map sideways; you can also pick a corridor from the list below.")}</p>${legend()}${s.phase === "plan" ? corridorPanel(s) : ""}</div>
    <div class="col col-day">${s.phase === "plan" && s.offer ? offerPanel(s) + dayPanel(s) : dayPanel(s) + (s.phase === "plan" ? offerPanel(s) : "")}</div>
    <div class="col col-book">${districtsPanel(s)}${s.phase !== "plan" ? offerPanel(s) : ""}${help()}</div></div></main>`;
  window.tlabI18n?.mountLangToggle?.(root.querySelector(".lang-slot"));
}

function update(fn, msg = "") {
  fn();
  notice = msg;
  save();
  render();
}

root.addEventListener("click", (e) => {
  const el = e.target.closest("button, [data-corr]");
  if (!el) return;
  if (el.id === "begin") {
    state = S.createGame({ seed: (Date.now() % 100000) + 1 });
    return update(
      () => {},
      t("Harita açık. Önce bir koridor seç.", "The map is open. Pick a corridor first."),
    );
  }
  if (el.id === "resume") return update(() => (state.ui.view = "game"));
  if (!state) return;
  const s = state;
  if (el.id === "menu") return update(() => (s.ui.view = "start"));
  if (el.id === "restart") return update(() => (state = null));
  if (el.dataset.tab) return update(() => (s.ui.tab = el.dataset.tab));
  if (el.dataset.win) return update(() => (s.ui.window = Number(el.dataset.win)));
  if (el.dataset.corr) return update(() => (s.ui.selected = el.dataset.corr));
  if (el.dataset.build) {
    const ok = S.build(s, s.ui.selected, el.dataset.build);
    return update(
      () => {},
      ok
        ? t("Hat kuruldu.", "Line built.")
        : pair(S.canBuild(s, s.ui.selected, el.dataset.build).reason),
    );
  }
  if (el.dataset.upgrade) {
    const ok = S.upgrade(s, s.ui.selected, el.dataset.upgrade);
    return update(
      () => {},
      ok ? "" : pair(S.canUpgrade(s, s.ui.selected, el.dataset.upgrade).reason),
    );
  }
  if (el.dataset.unbuild)
    return update(
      () => S.unbuild(s, s.ui.selected),
      t("Geri alındı, puan iade edildi.", "Undone, points refunded."),
    );
  if (el.dataset.offer)
    return update(
      () => S.answerOffer(s, el.dataset.offer === "yes"),
      el.dataset.offer === "yes"
        ? t("Söz verildi.", "Promise made.")
        : t("Teklif reddedildi.", "Offer declined."),
    );
  if (el.id === "run") {
    S.runToday(s);
    return update(
      () => (s.ui.tab = s.ui.tab === "map" ? "day" : s.ui.tab),
      t("Gün çalıştı.", "The day ran."),
    );
  }
  if (el.id === "next") {
    S.nextDay(s);
    return update(() => (s.ui.selected = null), s.ended ? "" : t("Yeni gün.", "A new day."));
  }
});

root.addEventListener("change", (e) => {
  if (e.target.id === "corr-select" && state)
    update(() => (state.ui.selected = e.target.value || null));
});

root.addEventListener("keydown", (e) => {
  const g = e.target.closest?.("g[data-corr]");
  if (g && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    update(() => (state.ui.selected = g.dataset.corr));
  }
});

document.addEventListener("keydown", (e) => {
  if (!state || e.target.matches?.("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey)
    return;
  if (/^[1-4]$/.test(e.key)) update(() => (state.ui.window = Number(e.key) - 1));
});

window.tlabI18n?.onLang?.(render);
render();
