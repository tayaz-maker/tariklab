import { KEY, LINKS, NODES, apply, createCoast, deserialize, legal, nodeById, preview, serialize } from "./sim.js";

const root = document.querySelector("#app");
if (window.self !== window.top) document.documentElement.classList.add("embedded");
const lang = () => {
  try { return localStorage.getItem("tariklab.language") === "en" ? "en" : "tr"; }
  catch { return "tr"; }
};
const COPY = {
  tr: {
    title: "KIYI EŞİĞİ",
    pitch: "Kurgusal bir kıyı. Hat, rıhtım, merdiven, rampa, tünel ve köprü eklemi arasında kurulur. Erişim koparsa nedeni yazılır.",
    note: "Gerçek şehir yok. Başka bir ulaşım oyunundan alınmış işaret yok.",
    open: "Kıyıyı aç",
    teach: "Nasıl oynanır: bir eşiği bağla, merdiven veya yokuşa rampa ekle, dönemi kapat. Kopuk eşik riski büyütür. Tam hat ile kısa mahalle aynı sonu vermez.",
    period: "Dönem", resource: "Kaynak", trust: "Güven", risk: "Risk", access: "Erişim",
    map: "Kıyı eşikleri",
    build: "Kur",
    problem: "Açık sorun",
    clear: "Hat şu an kopuk bir eşikten geçmiyor.",
    stair: "Merdiven eşiğinde rampa yok. Hat burada yürüyerek kopuyor.",
    slope: "Yokuş eşiğinde rampa yok. Eğim, hattın sürekliliğini kesiyor.",
    bekle: "Bekle",
    kapat: "Dönemi kapat",
    bagla: "Bağla",
    rampa: "Rampa ekle",
    again: "Yeni kıyı",
    endings: {
      surekli: "Eşikler birbirine bağlı. Erişim koptuğu yer kalmadı.",
      mahalle: "Kıyı tam değil ama mahalle rampayla yürüyor. Tam hat başka bir bedel isterdi.",
      yorgun: "Kaynak bitti ya da dönem kapandı. Kıyı hâlâ eksik.",
      kopuk: "Risk eşiği aştı. Kopuk merdiven ya da yokuş hattı taşıyamadı.",
    },
  },
  en: {
    title: "THRESHOLD COAST",
    pitch: "A fictional coast. The route is built across a pier, stair, ramp, tunnel mouth and bridge joint. If access breaks, the reason is written.",
    note: "No real city and no mark taken from another transit game.",
    open: "Open the coast",
    teach: "How to play: link a threshold, add a ramp to a stair or slope, then close the period. A broken threshold raises risk. A full route and a short neighbourhood do not end the same way.",
    period: "Period", resource: "Resource", trust: "Trust", risk: "Risk", access: "Access",
    map: "Coastal thresholds",
    build: "Build",
    problem: "Open fault",
    clear: "The route does not currently cross a broken threshold.",
    stair: "The stair has no ramp. The route breaks here for anyone who cannot climb.",
    slope: "The slope has no ramp. The grade cuts the route.",
    bekle: "Wait",
    kapat: "Close the period",
    bagla: "Link",
    rampa: "Add a ramp",
    again: "New coast",
    endings: {
      surekli: "The thresholds hold together. No break remains.",
      mahalle: "The coast is not complete, but the neighbourhood can walk it. A full route would have cost something else.",
      yorgun: "The resource ran out or the periods ended. The coast is still incomplete.",
      kopuk: "Risk crossed the limit. A broken stair or slope could not carry the route.",
    },
  },
};
const t = () => COPY[lang()] || COPY.tr;
let screen = "menu";
let state = null;

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
  try { localStorage.setItem(KEY, serialize(state)); } catch { /* private mode */ }
}

function play(move) {
  state = apply(state, move);
  if (state.phase === "end") screen = "report";
  persist();
  render();
}

function mark(n) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const on = state.line.includes(n.id);
  const box = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  box.setAttribute("x", n.x - 16); box.setAttribute("y", n.y - 14);
  box.setAttribute("width", 32); box.setAttribute("height", 22); box.setAttribute("rx", 3);
  box.setAttribute("fill", on ? "#1d3a32" : "#17211c");
  box.setAttribute("stroke", state.fault?.id === n.id ? "#e0b15a" : "#d7c7a2");
  box.setAttribute("stroke-dasharray", n.water ? "2 2" : n.slope ? "6 3" : "0");
  g.append(box);
  if (n.kind === "stair") {
    for (const step of [0, 1, 2]) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", n.x - 8); line.setAttribute("x2", n.x + 8);
      line.setAttribute("y1", n.y - 4 + step * 4); line.setAttribute("y2", n.y - 4 + step * 4);
      line.setAttribute("stroke", "#f3ead7");
      g.append(line);
    }
  }
  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", n.x); label.setAttribute("y", n.y + 22);
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("fill", "#f3ead7");
  label.setAttribute("font-size", "10");
  label.textContent = n[lang()] || n.tr;
  g.append(label);
  return g;
}

function mapSvg(c) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 320 260");
  svg.setAttribute("class", "coast-map");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", c.map);
  const water = document.createElementNS("http://www.w3.org/2000/svg", "path");
  water.setAttribute("d", "M0 168 C40 150 80 190 140 176 C190 164 230 196 320 170 L320 260 L0 260 Z");
  water.setAttribute("fill", "#12343a");
  svg.append(water);
  const by = Object.fromEntries(NODES.map((n) => [n.id, n]));
  LINKS.forEach(([a, b], index) => {
    const linked = state.line.includes(a) && state.line.includes(b);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", by[a].x); line.setAttribute("y1", by[a].y);
    line.setAttribute("x2", by[b].x); line.setAttribute("y2", by[b].y);
    line.setAttribute("class", linked ? "line-active" : "line-idle");
    line.setAttribute("stroke-width", linked ? 4 : 2);
    line.setAttribute("stroke-dasharray", linked ? "0" : (index % 2 ? "2 6" : "8 5"));
    svg.append(line);
    if (linked) {
      const twin = line.cloneNode();
      twin.setAttribute("stroke", "#2f6f62");
      twin.setAttribute("stroke-width", "1.5");
      const dx = by[b].y - by[a].y;
      const dy = by[a].x - by[b].x;
      const len = Math.hypot(dx, dy) || 1;
      twin.setAttribute("x1", by[a].x + (dx / len) * 4);
      twin.setAttribute("y1", by[a].y + (dy / len) * 4);
      twin.setAttribute("x2", by[b].x + (dx / len) * 4);
      twin.setAttribute("y2", by[b].y + (dy / len) * 4);
      svg.append(twin);
    }
  });
  for (const n of NODES) svg.append(mark(n));
  return svg;
}

function render() {
  const c = t();
  root.replaceChildren();
  if (screen === "menu") {
    root.append($("main", { class: "coast" },
      $("a", { class: "exit", href: "/" }, lang() === "en" ? "Games" : "Oyunlar"),
      $("p", { class: "kicker" }, c.title),
      $("h1", {}, c.title),
      $("p", { class: "pitch" }, c.pitch),
      $("p", {}, c.note),
      $("p", { class: "teach" }, c.teach),
      $("button", { class: "primary", type: "button", onclick: () => {
        try {
          const saved = deserialize(localStorage.getItem(KEY));
          state = saved && saved.phase !== "end" ? saved : createCoast(Date.now() % 100000);
        } catch { state = createCoast(4); }
        screen = "play";
        render();
      } }, c.open),
    ));
    return;
  }
  const fault = state.fault;
  const reason = fault ? c[fault.reason] : c.clear;
  const moves = legal(state).map((id) => {
    const look = preview(state, id);
    const name = id.startsWith("bagla:") ? `${c.bagla}: ${nodeById(id.slice(6))[lang()]}` : id.startsWith("rampa:") ? `${c.rampa}: ${nodeById(id.slice(6))[lang()]}` : c[id];
    return $("button", { class: "act", type: "button", onclick: () => play(id) }, `${name} · ${c.resource} ${look.resource} · ${c.risk} ${look.risk}`);
  });
  root.append($("main", { class: "coast" },
    $("a", { class: "exit", href: "/" }, lang() === "en" ? "Games" : "Oyunlar"),
    $("header", { class: "meters" },
      $("span", {}, `${c.period} ${state.period}`),
      $("span", {}, `${c.resource} ${state.resource}`),
      $("span", {}, `${c.trust} ${state.trust}`),
      $("span", {}, `${c.risk} ${state.risk}`),
      $("span", {}, `${c.access} ${state.access}`),
    ),
    $("div", { class: "layout" },
      mapSvg(c),
      $("section", { class: "build", "aria-label": c.build }, $("h2", {}, c.build), ...moves),
      $("section", { class: "problem" }, $("h2", {}, c.problem), $("p", { class: "fault" }, reason)),
    ),
    screen === "report" ? $("section", { class: "report" }, $("h2", {}, c.endings[state.ending] || state.ending), $("button", { class: "primary", type: "button", onclick: () => { state = createCoast(state.seed + 1); screen = "play"; persist(); render(); } }, c.again)) : null,
  ));
}

render();
