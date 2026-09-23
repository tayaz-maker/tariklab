import {
  REGIONS, applyMove, createSolo, deserializeSolo, legalMoves, previewMove,
  regionLinks, selectRegion, serializeSolo, SOLO_KEY,
} from "./solo.js";

const root = document.querySelector("#app");
const lang = () => {
  try { return localStorage.getItem("tariklab.language") === "en" ? "en" : "tr"; }
  catch { return "tr"; }
};

const COPY = {
  tr: {
    kicker: "Tek masa",
    title: "İHTİLÂL",
    pitch: "Tek kişilik masa. Havzaların yükü, güven, bilgi ve gerilim birbirine bağlıdır. Rakip koltuk yoktur.",
    note: "Bu çalışma haritası idari havzadır. Resmî sınır, gerçek kişi veya kurum kaydı değildir.",
    open: "Dosyayı aç",
    period: "Dönem",
    cap: "Kapasite",
    trust: "Güven",
    intel: "Bilgi",
    tension: "Gerilim",
    map: "Havza haritası",
    moves: "Karar",
    tut: "Tut",
    ac: "Aç",
    sustur: "Sustur",
    devret: "Devret",
    kapat: "Dönemi kapat",
    sert: "Sert tut",
    acik: "Açık tut",
    break: "Kırılma. Bu dönem ya baskıyı sıkarsın ya da kaydı açarsın. İkisi de bedelsiz değildir.",
    outcome: "Sonuç",
    delayed: "Sonraki döneme taşınır",
    now: "şimdi",
    file: "Neden bu masa",
    fileBody: "Eski iki kalemli dosya masası bu sayfanın oyunu değildir. Karar tek kişidedir: kısa rahatlama ile gecikmiş yük arasında.",
    again: "Yeni dosya",
    endings: {
      tutanak: "Tutanak kaldı. Güven ve gerilim aynı anda taşınabildi.",
      yorgun: "Yorgun düzen. Masa kapandı; ne güven ne gerilim çözüldü.",
      kirilma: "Kırılma. Gerilim havzayı taşıdı.",
      bosluk: "Boşluk. Masa duruyor, güven kalmadı.",
    },
    hints: {
      tut: "Seçili havzanın yükünü şimdi indirir. Yüksek yük ertesi dönem gerilim olarak döner.",
      ac: "Bilgi artar, güven düşer. Açılan kayıt ertesi dönem gerilimi büyütür.",
      sustur: "Gerilim iner, bilgi eksilir. İki dönem sonra bilgi açığı gelir.",
      devret: "Yükü en gergin komşudan seçili havzaya alırsın. İade ertesi dönem gelir.",
      kapat: "Bekleyen etkiler işler, kapasite yenilenir.",
      sert: "Gerilim düşer, güven de düşer.",
      acik: "Güven ve bilgi artar, gerilim de artar.",
    },
  },
  en: {
    kicker: "One desk",
    title: "İHTİLÂL",
    pitch: "A one-seat desk. Basin load, trust, information and tension are tied together. There is no opposing chair.",
    note: "This working map is an administrative basin chart. It is not an official border, a real person, or an institutional record.",
    open: "Open the file",
    period: "Period",
    cap: "Capacity",
    trust: "Trust",
    intel: "Information",
    tension: "Tension",
    map: "Basin map",
    moves: "Decision",
    tut: "Hold",
    ac: "Open",
    sustur: "Quiet",
    devret: "Shift",
    kapat: "Close the period",
    sert: "Hold hard",
    acik: "Hold open",
    break: "Fracture. This period you either tighten pressure or open the record. Neither is free.",
    outcome: "Outcome",
    delayed: "Carries into a later period",
    now: "now",
    file: "Why this desk",
    fileBody: "The old two-pen file board is not this page. The decision sits with one person: short relief against a delayed load.",
    again: "New file",
    endings: {
      tutanak: "The record held. Trust and tension were carried together.",
      yorgun: "A tired order. The desk closed with neither trust nor tension settled.",
      kirilma: "Fracture. Tension carried the basin.",
      bosluk: "A hollow desk. It still stands, and trust is gone.",
    },
    hints: {
      tut: "Lowers the selected basin now. A high load returns next period as tension.",
      ac: "Information rises, trust falls. The opened record grows tension next period.",
      sustur: "Tension falls, information thins. An information gap arrives two periods later.",
      devret: "You take load off the most strained neighbour onto the selected basin. It returns next period.",
      kapat: "Waiting effects resolve and capacity refills.",
      sert: "Tension falls, and so does trust.",
      acik: "Trust and information rise, and so does tension.",
    },
  },
};

const t = () => COPY[lang()] || COPY.tr;
let screen = "menu";
let state = null;
let last = null;

const $ = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
};

function persist() {
  try { localStorage.setItem(SOLO_KEY, serializeSolo(state)); } catch { /* private mode */ }
}

function play(id) {
  const before = state;
  const preview = previewMove(state, id);
  state = applyMove(state, id);
  last = { id, preview, trust: state.trust, tension: state.tension, intel: state.intel };
  if (state.phase === "end") screen = "report";
  persist();
  render();
  if (preview.ok === false) state = before;
}

function meters(c) {
  const cells = [
    [c.period, state.period],
    [c.cap, state.capacity],
    [c.trust, state.trust],
    [c.tension, state.tension],
  ];
  return $("div", { class: "solo-meters" }, ...cells.map(([name, n]) => $("div", {}, $("span", {}, name), $("b", {}, n))));
}

function mapSvg(c) {
  const byId = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 320 320");
  svg.setAttribute("class", "basin-map");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", c.map);
  for (const link of regionLinks()) {
    const a = byId[link.a];
    const b = byId[link.b];
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
    line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
    svg.append(line);
  }
  for (const r of REGIONS) {
    const live = state.regions.find((x) => x.id === r.id);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("role", "button");
    g.setAttribute("tabindex", "0");
    g.setAttribute("aria-label", `${r[lang()] || r.tr} ${live.strain}`);
    g.setAttribute("aria-pressed", state.selected === r.id ? "true" : "false");
    const click = () => { state = selectRegion(state, r.id); render(); };
    g.addEventListener("click", click);
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); click(); } });
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", r.x); circle.setAttribute("cy", r.y);
    circle.setAttribute("r", state.selected === r.id ? 28 : 22);
    circle.setAttribute("fill", live.strain > 55 ? "#6e2e24" : "#3d4a3a");
    circle.setAttribute("stroke", state.selected === r.id ? "#f3ead7" : "#d7a15a");
    circle.setAttribute("stroke-width", state.selected === r.id ? 3 : 1);
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", r.x); label.setAttribute("y", r.y + 4);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("fill", "#f3ead7");
    label.setAttribute("font-size", "11");
    label.textContent = `${live.strain}`;
    g.append(circle, label);
    svg.append(g);
  }
  return svg;
}

function moveButton(c, id) {
  const preview = previewMove(state, id);
  const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
  return $("button", { class: "act", type: "button", onclick: () => play(id) },
    $("b", {}, c[id] || id),
    $("span", {}, ` ${c.hints[id] || ""}`),
    preview.ok ? $("span", { class: "cost-line" }, ` ${c.trust} ${sign(preview.trust)} · ${c.tension} ${sign(preview.tension)} · ${c.intel} ${sign(preview.intel)}`) : "",
    preview.delayed ? $("span", {}, ` · ${c.delayed}`) : "");
}

function render() {
  const c = t();
  root.replaceChildren();
  const bar = $("header", { class: "solo-bar" },
    $("span", { class: "solo-kicker" }, c.kicker),
    $("button", { class: "link", type: "button", onclick: () => { screen = "menu"; state = null; render(); } }, "←"));
  if (screen === "menu") {
    root.append($("div", { class: "solo" }, bar, $("main", { class: "solo-main" },
      $("p", { class: "solo-kicker" }, c.kicker),
      $("h1", {}, c.title),
      $("p", { class: "pitch" }, c.pitch),
      $("p", { class: "menu-brief" }, c.note),
      $("button", { class: "primary", type: "button", onclick: () => {
        try {
          const saved = deserializeSolo(localStorage.getItem(SOLO_KEY));
          state = saved && saved.phase !== "end" ? saved : createSolo(Date.now() % 100000);
        } catch { state = createSolo(7); }
        screen = "play";
        last = null;
        render();
      } }, c.open),
    )));
    return;
  }
  const body = [meters(c)];
  if (state.phase !== "end") {
    body.push($("div", { class: "solo-play" },
      mapSvg(c),
      $("section", { class: "moves", "aria-label": c.moves },
        $("h2", {}, state.phase === "break" ? c.break : `${REGIONS.find((r) => r.id === state.selected)[lang()] || ""}`),
        ...legalMoves(state).map((id) => moveButton(c, id)),
      ),
    ));
  }
  if (last?.preview?.ok) {
    const p = last.preview;
    body.push($("p", { class: "outcome inline-outcome" },
      `${c.outcome}: ${c.trust} ${state.trust}, ${c.tension} ${state.tension}, ${c.intel} ${state.intel}. ${p.delayed ? c.delayed : c.now}.`));
  }
  if (screen === "report" || state.phase === "end") {
    body.push($("section", { class: "report" },
      $("h2", { class: "report-verdict" }, c.endings[state.ending] || state.ending),
      $("p", {}, `${c.period} ${state.period} · ${c.trust} ${state.trust} · ${c.tension} ${state.tension}`),
      $("button", { class: "primary", type: "button", onclick: () => {
        try { localStorage.removeItem(SOLO_KEY); } catch { /* ignore */ }
        state = createSolo((state.seed + 1) >>> 0);
        screen = "play";
        last = null;
        render();
      } }, c.again),
    ));
  }
  body.push($("details", { class: "file-fold" }, $("summary", {}, c.file), $("p", {}, c.fileBody)));
  root.append($("div", { class: "solo" }, bar, $("main", { class: "solo-main" }, ...body)));
}

render();
