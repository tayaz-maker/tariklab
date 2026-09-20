import { HELP_SECTIONS } from "./help.js";
import {
  ALT_PRESETS,
  DOCTRINES,
  PERIODS,
  hydrateDevlet,
} from "../next-wave.js";
import {
  bindFrontMenu,
  bindSavePanel,
  bootGame,
  escapeHtml as h,
  frontMenu,
  loc,
  savePanel,
  text as t,
} from "../next-wave/shared/runtime.js";
import { screenHtml, helpHtml, visibleSnapshot } from "./presentation.js";
import { arrangeStateDesk } from "./desk.js";

const axisLabel = {
  centralization: ["Merkezileşme", "Centralization"],
  localAutonomy: ["Yerel özerklik", "Local autonomy"],
  security: ["Güvenlik", "Security"],
  paternalism: ["Paternalizm", "Paternalism"],
  market: ["Piyasa", "Market"],
  socialState: ["Sosyal devlet", "Social state"],
  institutionalism: ["Kurumsallık", "Institutionalism"],
  negotiation: ["Müzakere", "Negotiation"],
  openness: ["Açıklık", "Openness"],
  nationalEconomy: ["Milli ekonomi", "National economy"],
  ru: ["Rusya", "Russia"],
  us: ["ABD", "United States"],
  eu: ["AB", "EU"],
  inflation: ["Enflasyon", "Inflation"],
  treasury: ["Hazine", "Treasury"],
  unemployment: ["İşsizlik", "Unemployment"],
  fx: ["Kur", "Exchange"],
  debt: ["Borç", "Debt"],
  industry: ["Sanayi", "Industry"],
  agri: ["Tarım", "Agriculture"],
  energy: ["Enerji", "Energy"],
  externalDep: ["Dış bağımlılık", "External dependence"],
};
const formLabel = {
  "Kışla-Devlet": "Garrison-State",
  "Bürokrasi-Devlet": "Bureaucracy-State",
  "Parti-Devlet": "Party-State",
  "Sermaye-Devlet": "Capital-State",
  "Cemaat-Devlet": "Network-State",
  "Popülist-Devlet": "Populist-State",
  "Boş Kabuk": "Empty Shell",
  "Bölgesel-Devlet": "Regional-State",
  "Piyasa-Devlet": "Market-State",
  "Güvenlik-Devlet": "Security-State",
};
const modeLabel = {
  grand: ["Büyük kampanya", "Grand campaign"],
  period: ["Dönem", "Period"],
  open: ["Hedefsiz", "Open-ended"],
  doctrine: ["Doktrin", "Doctrine"],
};
function ax(key) {
  const row = axisLabel[key];
  return row ? t(row[0], row[1]) : loc(String(key).replaceAll("_", " "));
}
function formOf(value) {
  return loc(value, formLabel[value]);
}
function modeOf(value) {
  const row = modeLabel[value];
  return row ? t(row[0], row[1]) : loc(value);
}
const root = document.body;
const nav = [
  ["home", "ANA SAYFA", "HOME"],
  ["agenda", "GÜNDEM", "AGENDA"],
  ["economy", "EKONOMİ", "ECONOMY"],
  ["policy", "POLİTİKA", "POLICY"],
  ["institutions", "KURUMLAR", "INSTITUTIONS"],
  ["society", "TOPLUM", "SOCIETY"],
  ["foreign", "DIŞ İLİŞKİLER", "FOREIGN"],
  ["regions", "BÖLGELER", "REGIONS"],
  ["files", "DOSYALAR", "FILES"],
  ["history", "GEÇMİŞ", "HISTORY"],
  ["year", "YIL DOSYASI", "YEAR FILE"],
  ["period-file", "DÖNEM DOSYASI", "PERIOD FILE"],
];
let view = "menu";
let setupDraft = { era: null, mode: null, goal: null, doctrine: null, alt: null };
const legacyPeriodScreen = "periods";
let selectedScreen = null;
let feedback = null;
let renderedState = null;
const currentScreen = state => selectedScreen || (state.ui?.screen === legacyPeriodScreen ? "period-file" : state.ui?.screen) || "home";
const renderScreen = state => screenHtml(state, { screen: currentScreen(state), formOf, feedback });

const setupReady = () =>
  Boolean(
    setupDraft.era &&
    setupDraft.mode &&
    setupDraft.doctrine &&
    (setupDraft.era !== "grand" || setupDraft.goal) &&
    (setupDraft.era !== "alternatif" || setupDraft.alt),
  );
const setupChoice = (field, value, title, detail = "") =>
  `<button type="button" class="setup-choice ${setupDraft[field] === value ? "is-picked" : ""}" data-setup-field="${field}" data-setup-value="${h(value)}"><strong>${h(title)}</strong><small>${h(detail)}</small></button>`;

function setupScreen(session) {
  const period = setupDraft.era === "grand" ? PERIODS["1923"] : PERIODS[setupDraft.era];
  const doctrine = DOCTRINES.find((item) => item.id === setupDraft.doctrine);
  const alt = ALT_PRESETS.find((item) => item.id === setupDraft.alt);
  root.innerHTML = `<main class="game-root"><header class="topbar global-chrome"><a href="/">${t("← Oyunlar", "← Games")}</a><span data-lang-host></span></header><section class="setup-shell card"><p class="eyebrow">${t("DEVLET KURULUŞ DOSYASI", "STATE INTAKE FILE")}</p><h1>TC SIM: DEVLET</h1><h2>1 · ${t("DÖNEM", "PERIOD")}</h2><div class="setup-grid">${Object.values(
    PERIODS,
  )
    .map((item) => setupChoice("era", item.id, loc(item.name), loc(item.theme)))
    .join(
      "",
    )}${setupChoice("era", "grand", "1923–2030", t("Büyük kampanya", "Grand campaign"))}</div>${setupDraft.era ? `<h2>2 · ${t("OYUN MODU", "GAME MODE")}</h2><div class="setup-grid">${setupChoice("mode", setupDraft.era === "grand" ? "grand" : "period", setupDraft.era === "grand" ? t("Büyük Kampanya", "Grand Campaign") : t("Dönem Kampanyası", "Period Campaign"), period?.name || "")}</div>` : ""}${setupDraft.era === "grand" ? `<h2>3 · ${t("HEDEF MODU", "GOAL MODE")}</h2><div class="setup-grid">${setupChoice("goal", "open", t("Hedefsiz", "Open-ended"), t("Serbest devlet aklı", "Free statecraft"))}${setupChoice("goal", "doctrine", t("Doktrin hedefli", "Doctrine target"), t("Doktrin devlet DNA'sını değiştirir", "Doctrine changes state DNA"))}</div>` : ""}${
    setupDraft.mode
      ? `<h2>4 · ${t("DOKTRİN", "DOCTRINE")}</h2><div class="setup-grid">${setupChoice("doctrine", "none", t("Doktrin yok", "No doctrine"), t("Başlangıç DNA'sını korur", "Keeps starting DNA"))}${DOCTRINES.map(
          (item) =>
            setupChoice(
              "doctrine",
              item.id,
              item.name,
              Object.entries(item.prefer)
                .map(([key, value]) => `${ax(key)} ${value > 0 ? "+" : ""}${value}`)
                .join(" · "),
            ),
        ).join("")}</div>`
      : ""
  }${setupDraft.era === "alternatif" ? `<h2>5 · ${t("ALTERNATİF PRESET", "ALTERNATIVE PRESET")}</h2><div class="setup-grid">${ALT_PRESETS.map((item) => setupChoice("alt", item.id, loc(item.name), formOf(item.form || "") || loc(item.form || ""))).join("")}</div>` : ""}${setupReady() ? `<section class="setup-summary"><p class="eyebrow">${t("DEVLET DOSYASI", "STATE FILE")}</p><h2>${h(loc(period?.name || "1923–2030"))}</h2><p>${t("Mod", "Mode")}: <b>${h(modeOf(setupDraft.mode))}</b> · ${t("Hedef", "Goal")}: <b>${h(modeOf(setupDraft.goal || "period"))}</b> · ${t("Doktrin", "Doctrine")}: <b>${h(loc(doctrine?.name || t("Yok", "None")))}</b>${alt ? ` · ${h(loc(alt.name))}` : ""}</p><p>${t("Başlangıç ekonomisi", "Starting economy")}: ${t("Enflasyon", "Inflation")} %${period?.economy?.inflation} · ${t("Hazine", "Treasury")} ${period?.economy?.treasury}</p></section>` : ""}<div class="setup-actions"><button type="button" id="cancel-setup" class="secondary">${t("GERİ", "BACK")}</button><button type="button" id="confirm-start" ${setupReady() ? "" : "disabled"}>${t("DEVLETİ DEVRAL", "TAKE THE STATE")}</button></div></section></main>`;
  root.querySelectorAll("[data-setup-field]").forEach((button) =>
    button.addEventListener("click", () => {
      const field = button.dataset.setupField;
      setupDraft[field] = button.dataset.setupValue;
      if (field === "era") {
        setupDraft.mode = setupDraft.era === "grand" ? "grand" : "period";
        setupDraft.goal = setupDraft.era === "grand" ? null : "period";
        setupDraft.doctrine = null;
        setupDraft.alt = null;
      }
      setupScreen(session);
    }),
  );
  root.querySelector("#cancel-setup").addEventListener("click", () => {
    session.cancelNew();
    view = "menu";
    draw(session);
  });
  root.querySelector("#confirm-start").addEventListener("click", () => {
    if (!setupReady()) return;
    const options = {
      campaign: setupDraft.mode === "grand",
      doctrine: setupDraft.doctrine === "none" ? undefined : setupDraft.doctrine,
      alt: setupDraft.alt || undefined,
    };
    session.commitNew({
      factory: () => hydrateDevlet(setupDraft.era === "grand" ? "1923" : setupDraft.era, options),
      configure: (state) => {
        state.scenario.mode = setupDraft.mode;
        state.scenario.goalMode = setupDraft.goal;
        state.ui.screen = "home";
      },
    });
  });
}

function draw(session) {
  const state = session.state;
  const freshState = state && state !== renderedState;
  if (state !== renderedState) {
    feedback = null;
    selectedScreen = null;
    renderedState = state;
  }
  if (!state) {
    if (view === "setup") return setupScreen(session);
    // The front screen carries the same way out as every other screen, so the
    // player is never stranded on the slot picker.
    root.innerHTML = `<main class="game-root"><header class="topbar global-chrome"><a href="/">${t("← Oyunlar", "← Games")}</a><span data-lang-host></span></header>${frontMenu(session, {
      title: "TC SIM: DEVLET",
      eyebrow: t("4000 YILLIK DEVLET AKLI", "4,000 YEARS OF STATECRAFT"),
      pitch: t(
        "Aylık gündem, iki ana karar, kurum uygulaması ve asla tam olmayan bilgi.",
        "Monthly agenda, two main decisions, institutional implementation and never-complete information.",
      ),
      help: HELP_SECTIONS,
      slotSummary: (s) =>
        `${s.time?.year || "—"}/${String(s.time?.month || 1).padStart(2, "0")} · ${h(loc(PERIODS[s.eraId]?.name || s.eraId))}`,
    })}</main>`;
    bindFrontMenu(root, session, {
      onNew: () => {
        setupDraft = { era: null, mode: null, goal: null, doctrine: null, alt: null };
        view = "setup";
        draw(session);
      },
    });
    return;
  }
  const screen = currentScreen(state);
  const capacity = state.flags.governanceCapacity || 8;
  const used = state.flags.governanceUsed || 0;
  root.innerHTML = `<main class="game-root"><header class="topbar"><a href="/">${t("← Oyunlar", "← Games")}</a><span class="topbar__title">TC SIM: DEVLET</span><div class="topbar__tools"><span data-lang-host></span>${savePanel(session)}</div></header><section class="state-head"><div><p class="eyebrow">${state.time.year}/${String(state.time.month).padStart(2, "0")} · ${h(loc(PERIODS[state.eraId]?.name || state.eraId))}</p><h1>${t("Devlet Merkezi", "State Center")}</h1></div><div class="state-metrics"><span class="pill">${t("Yönetim kapasitesi", "Administrative capacity")}: ${used}/${capacity}</span><span class="pill">${t("Sürtünme", "Friction")}: ${state.flags.bureaucraticFriction || 0}</span></div></section><section class="state-layout"><nav class="state-nav" aria-label="${t("Devlet bölümleri", "State sections")}">${nav.map((item) => `<button type="button" class="${screen === item[0] ? "is-active" : ""}" data-screen="${item[0]}">${t(item[1], item[2])}</button>`).join("")}</nav><div class="state-center">${renderScreen(state)}<div class="month-bar"><span><strong>${t("YÖNETİM KAPASİTESİ", "ADMINISTRATIVE CAPACITY")} ${used}/${capacity}</strong><br><small class="muted">${t("Her politika kurumsal kapasite tüketir; hepsini kullanmak zorunda değilsin. Kriz yükü ve düşük uygulama gücü maliyeti artırır; ayı erken kapatmak kurum yorgunluğunu ve sürtünmeyi azaltır.", "Each policy consumes institutional capacity; you do not have to spend it all. Crisis load and weak delivery raise its cost; closing early reduces fatigue and friction.")}</small></span><button type="button" id="advance" ${state.flags.campaignEnd ? "disabled" : ""}>${state.flags.campaignEnd ? t("DÖNEM KAPANDI", "PERIOD CLOSED") : t("AYI İLERLET", "ADVANCE MONTH")}</button></div></div></section><p class="notice">${h(session.notice)}</p>${helpHtml()}<footer class="footer">© 2026 TarikLab · Tarık Halil Ayaz</footer></main>`;
  root
    .querySelectorAll("[data-screen]")
    .forEach((button) =>
      button.addEventListener("click", () => { selectedScreen = button.dataset.screen; session.render(); if (document.scrollingElement) document.scrollingElement.scrollTop = 0; }),
    );
  root
    .querySelectorAll("[data-policy]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        feedback = { kind: "policy", id: button.dataset.policy };
        session.act(`policy:${button.dataset.policy}`);
      }),
    );
  root
    .querySelectorAll("[data-content]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        feedback = { kind: "content", id: button.dataset.content };
        session.act(`content:${button.dataset.content}`);
      }),
    );
  root.querySelector("[data-open-policy]")?.addEventListener("click", () => { selectedScreen = "policy"; session.render(); if (document.scrollingElement) document.scrollingElement.scrollTop = 0; });
  root.querySelector("#advance").addEventListener("click", () => {
    const previous = feedback;
    const before = visibleSnapshot(state);
    feedback = { kind: "month", before };
    if (!session.act("advance")) { feedback = previous; session.render(); }
    else {
      selectedScreen = "home";
      session.render();
      const reportDeck = root.querySelector(".action-feedback")?.closest("details");
      if (reportDeck) reportDeck.open = true;
      root.querySelector(".action-feedback")?.scrollIntoView({ block: "start" });
    }
  });
  bindSavePanel(root, session);
  arrangeStateDesk(root, screen, t);
  if (freshState && document.scrollingElement) document.scrollingElement.scrollTop = 0;
}

bootGame("tc-sim-devlet", draw);
