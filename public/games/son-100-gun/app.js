import { SCENARIOS, SON_ACTIONS } from "../next-wave.js";
import { HELP_SECTIONS } from "./help.js";
import {
  availableSonActions,
  sonActionForecast,
  sonDeathScene,
  sonForecast,
  sonPhase,
  sonSoul,
  sonActionCost,
} from "../next-wave/son100-sim.js";
import {
  bindFrontMenu,
  bindSavePanel,
  bootGame,
  escapeHtml as h,
  frontMenu,
  loc,
  savePanel,
  text as t,
  helpPanel,
} from "../next-wave/shared/runtime.js";
// loc() expects a single Turkish string it can run through the site-wide
// phrase dictionary for English; it is not for [tr, en] pairs, which already
// carry both languages explicitly and must use text(tr, en) instead. Mixing
// the two made phase/forecast text render as "Türkçe,English" once passed
// through loc() with only one argument (loc(tr) with no en leaves the pair
// array itself as the return value, and Array#toString joins it on a comma).
const pair = (value) => (Array.isArray(value) ? t(value[0], value[1]) : loc(value));

const root = document.body;
const actionById = new Map(SON_ACTIONS.map((action) => [action.id, action]));
const signed = (n) => `${n > 0 ? "+" : ""}${n || 0}`;
const personLabel = (id) =>
  ({
    family: t("aile", "family"),
    friend: t("arkadaş", "friend"),
    work: t("iş çevresi", "work circle"),
    partner: t("partner", "partner"),
  })[id] || id;
let view = "menu";
let selectedScenario = null;

function slotSummary(state) {
  const scenario = SCENARIOS.find((item) => item.id === state.scenarioId);
  return `${state.remainingDays} ${t("gün", "days")} · ${loc(scenario?.name || state.scenarioId)} · ₺${state.resources.money} · ${t("enerji", "energy")} ${state.resources.energy}`;
}

function menu(session) {
  root.innerHTML = `<main class="game-root"><header class="topbar global-chrome"><a href="/">${t("← Oyunlar", "← Games")}</a><span data-lang-host></span></header>${frontMenu(
    session,
    {
      kicker: t("ZAMAN DOSYASI", "TIME FILE"),
      title: "SON 100 GÜN",
      pitch: t(
        "Öleceğini biliyorsun. İntihar yok. Yüz günün sonunda kesin öleceksin. O zamana kadar kimi seveceğin, kimi mahvedeceğin ve arkanda ne bırakacağın oyunun kendisi.",
        "You know you will die. There is no suicide. On day zero you die. Until then who you love, who you ruin and what you leave behind is the game.",
      ),
      summary: slotSummary,
      help: HELP_SECTIONS,
    },
  )}</main>`;
  bindFrontMenu(root, session, {
    onNew: () => {
      selectedScenario = null;
      view = "setup";
      session.render();
    },
  });
}

function paintScenarioSelection() {
  root.querySelectorAll("[data-scenario]").forEach((button) => {
    const on = button.dataset.scenario === selectedScenario;
    button.classList.toggle("is-selected", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const confirm = root.querySelector("#confirm-start");
  if (!confirm) return;
  if (selectedScenario) confirm.removeAttribute("disabled");
  else confirm.setAttribute("disabled", "");
}

function chooseScenario(id) {
  if (!SCENARIOS.some((item) => item.id === id)) return;
  selectedScenario = id;
  paintScenarioSelection();
}

function setup(session) {
  root.innerHTML = `<main class="game-root"><header class="topbar global-chrome"><a href="/">${t("← Oyunlar", "← Games")}</a><span data-lang-host></span></header><section class="setup-shell"><section class="count-head"><div class="count-number">100</div><div><p class="eyebrow">${t("SENARYONU SEÇ", "CHOOSE YOUR SCENARIO")}</p><h1>SON 100 GÜN</h1><p class="muted">${t("Başlangıç yükün sessizce seçilmez. Kartı seç, sonra 100 günü başlat.", "Your starting burden is never chosen silently. Select a card, then start the hundred days.")}</p></div></section><section class="scenario-grid" role="listbox" aria-label="${t("Senaryolar", "Scenarios")}">${SCENARIOS.map((scenario, index) => `<button type="button" class="scenario ${index < 5 ? "recommended" : ""}" data-scenario="${h(scenario.id)}" aria-pressed="false" role="option"><strong>${h(loc(scenario.name))}</strong><p>${h(loc(scenario.context || scenario.goal))}</p><small>${index < 5 ? t("ÖNERİLEN", "RECOMMENDED") + " · " : ""}${h(loc(scenario.hook || scenario.goal))} · ₺${scenario.resources.money} · ${t("enerji", "energy")} ${scenario.resources.energy} · ${t("umut", "hope")} ${scenario.resources.hope}</small></button>`).join("")}</section><div class="setup-actions"><button type="button" id="cancel-setup">${t("GERİ", "BACK")}</button><button type="button" id="confirm-start" class="primary" disabled>${t("100 GÜNÜ BAŞLAT", "START THE 100 DAYS")}</button></div></section></main>`;
  paintScenarioSelection();
  const grid = root.querySelector(".scenario-grid");
  const pick = (event) => {
    const button = event.target.closest("[data-scenario]");
    if (!button || !grid.contains(button)) return;
    event.preventDefault();
    chooseScenario(button.dataset.scenario);
  };
  grid.addEventListener("click", pick);
  grid.addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse") return;
    pick(event);
  });
  grid.addEventListener("keydown", (event) => {
    const button = event.target.closest("[data-scenario]");
    if (!button) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseScenario(button.dataset.scenario);
    }
  });
  root.querySelector("#cancel-setup").addEventListener("click", () => {
    session.cancelNew();
    selectedScenario = null;
    view = "menu";
    session.render();
  });
  root.querySelector("#confirm-start").addEventListener("click", () => {
    if (selectedScenario) session.commitNew({ action: `scenario:${selectedScenario}` });
  });
}

function relValue(state, id) {
  return state.relationships?.find((item) => item.id === id)?.value ?? 50;
}

function draw(session) {
  const state = session.state;
  if (!state) return view === "setup" ? setup(session) : menu(session);
  if (state.flags.finalReport) {
    const report = state.flags.report || {};
    const scene = sonDeathScene(state);
    root.innerHTML = `<main class="game-root"><header class="topbar global-chrome"><a href="/">${t("← Oyunlar", "← Games")}</a><div class="topbar__tools"><span data-lang-host></span>${savePanel(session)}</div></header><section class="count-head"><div class="count-number">0</div><div><p class="eyebrow">${t("ÖLÜM VE HÜKÜM", "DEATH AND VERDICT")}</p><h1>${h(loc(report.verdictTitle || t("Yüz gün bitti", "The hundred days are over")))}</h1></div></section>
      <section class="card verdict-banner"><p class="verdict-kicker">${h(loc(report.verdictKicker || ""))}</p><p class="verdict-line">${h(loc(report.verdictLine || ""))}</p><p>${h(loc(report.verdictText || ""))}</p><p class="muted">${h(loc(scene))}</p></section>
      <section class="card"><div class="stat-list"><div>${t("Nakit / borç", "Cash / debt")}<strong>₺${state.resources.money}</strong></div><div>${t("Enerji", "Energy")}<strong>${state.resources.energy}</strong></div><div>${t("Umut", "Hope")}<strong>${state.resources.hope}</strong></div><div>${t("Merhamet", "Mercy")}<strong>${report.mercy || 0}</strong></div><div>${t("Zarar", "Harm")}<strong>${report.harm || 0}</strong></div><div>${t("İman", "Faith")}<strong>${report.faith || 0}</strong></div><div>${t("Kaçan yüküm", "Missed obligations")}<strong>${(state.missed || []).length}</strong></div></div></section>
      <section class="card"><h3>${t("Arkanda kalan", "What remains")}</h3><ul class="report-list">${(report.helped || []).map((row) => `<li>${h(loc(row))}</li>`).join("")}${(report.harmed || []).map((row) => `<li>${h(loc(row))}</li>`).join("") || `<li>${t("Kimseye özel bir iz bırakmadın.", "You left no particular mark on anyone.")}</li>`}</ul><p>${t("Açık dosya", "Open files")}: ${(report.unresolved || []).map((row) => h(loc(row))).join(" · ") || t("yok", "none")}</p><h3>${t("Kriz dosyası", "Crisis dossier")}</h3><ul class="report-list">${(report.crises || []).map((row) => `<li>${h(pair(row.title || row.id))} · ${row.outcome === "prepared" ? t("hazırlık tuttu", "preparation held") : t("kriz vurdu", "crisis hit")} · ${t("öngörülen risk", "forecast risk")} %${row.risk}</li>`).join("") || `<li>${t("Kapanmış kriz zinciri yok.", "No completed crisis chain.")}</li>`}</ul><h3>${t("Hazırlık izi", "Preparation trace")}</h3><p>${["health","money","people","legal","legacy"].map((k) => `${h(k)} ${(report.preparations && report.preparations[k]) || 0}/8`).join(" · ")}</p><h3>${t("Faz izi", "Phase trace")}</h3><ul class="report-list">${(report.phases || []).map((row) => `<li>${h(row.id)} · ${t("gün", "day")} ${row.day} · ${t("kalan", "left")} ${row.left}</li>`).join("") || `<li>${t("Faz kaydı yok.", "No phase record.")}</li>`}</ul><h3>${t("İnsan hafızası", "People memory")}</h3>${(report.actors || []).map((actor) => `<p><strong>${h(personLabel(actor.id))}</strong> ${actor.trust}<br><small>${(actor.memories || []).map((m) => `${m.day}:${m.action}`).join(" · ") || t("anı yok", "no memory")}</small></p>`).join("")}<h3>${t("Dönüm noktaları", "Turning points")}</h3><ul class="report-list">${(report.turningPoints || []).map((row) => `<li>${h(row.type)} · ${h(loc(row.title || row.id || ""))}</li>`).join("") || `<li>${t("kayıt yok", "none")}</li>`}</ul><h3>${t("Dosya izleri", "File traces")}</h3><ul class="report-list">${(report.traces || []).map((row) => `<li>${h(pair(row))}</li>`).join("") || `<li>${t("Ek iz yok.", "No extra traces.")}</li>`}</ul></section>
      <details class="help"><summary>${t("Nasıl oynanır", "How to play")}</summary><p>${t("Final rapor terminaldir; yeni gün veya üçüncü aksiyon üretmez. Hüküm kayıttan hesaplanır, yenilenmez.", "The final report is terminal; it cannot create another day or third action. The verdict is computed from the save and does not reroll.")}</p></details></main>`;
    bindSavePanel(root, session);
    return;
  }

  const phase = sonPhase(state);
  const forecast = sonForecast(state);
  const soul = sonSoul(state);
  const openWindows = (state.opportunities || []).filter((item) => item.status === "open");
  const openCases = (state.openCases || []).filter((item) => item.status === "open");
  const choiceIds = availableSonActions(state);
  const today = state.day;
  const locked = state.focusRemaining <= 0;
  const prep = state.depth?.preparations || {};
  const liveChains = Object.entries(state.depth?.chains || {});
  root.innerHTML = `<main class="game-root phase-${h(phase.id)}"><header class="topbar global-chrome"><a href="/">${t("← Oyunlar", "← Games")}</a><span class="topbar__title">SON 100 GÜN</span><div class="topbar__tools"><span data-lang-host></span>${savePanel(session)}</div></header><section class="count-head"><div class="count-number">${state.remainingDays}</div><div><p class="eyebrow">${h(pair(phase.label))}</p><h1>${h(loc(SCENARIOS.find((scenario) => scenario.id === state.scenarioId)?.name || state.scenarioId))}</h1><p class="muted">${t("Kesin sonuca kalan zamanda bedenini, paranı ve geride bırakacağın insan ilişkilerini yönetiyorsun.", "In the time before the certain end, you manage your body, money and the relationships you will leave behind.")}</p></div><div class="action-counter">${t("ODAK", "FOCUS")} ${state.focusRemaining}/${state.focusMax || 8}<br><small class="muted">${t("Gün", "Day")} ${today}</small></div></section>
    <section class="hundred-grid"><aside class="card"><p class="eyebrow">${t("TAKVİM", "CALENDAR")}</p><div class="calendar-strip">${Array.from(
      { length: 7 },
      (_, offset) => {
        const day = today + offset;
        const due = state.obligations
          .filter((item) => item.status === "open" && item.due === offset)
          .map((item) => loc(item.title));
        const expiry = openWindows
          .filter((item) => item.expiresOn === day)
          .map((item) => loc(item.title));
        return `<div class="calendar-day ${offset === 0 ? "today" : ""}"><b>${day}</b><span>${h([...due, ...expiry].join(" · ") || t("boş", "open"))}</span></div>`;
      },
    ).join("")}</div></aside>
      <section class="card today-panel"><p class="eyebrow">${t("BUGÜN", "TODAY")}</p>
      <p class="phase-note">${h(pair(phase.note))}</p>
      ${forecast ? `<div class="risk-forecast"><p class="eyebrow">${t("YAKLAŞAN RİSK", "UPCOMING RISK")}</p><strong>${h(pair(forecast.title))}</strong><p>${t("Yaklaşık", "About")} ${forecast.days} ${t("gün · risk", "days · risk")} ${h(pair(forecast.band))} (%${forecast.chance}) · ${t("hazırlık", "preparation")} ${forecast.preparation}/8 · ${t("alan", "family")} ${h(forecast.family)}</p></div>` : ""}
      ${liveChains.length ? `<div class="crisis-live">${liveChains.map(([id, row]) => `<span class="stamp">${h(id)} · ${h(row.stage)}</span>`).join("")}</div>` : ""}
      ${openWindows.map((window) => `<div class="window"><strong>${h(loc(window.title))}</strong><br><small>${t("Son gün", "Last day")} ${window.expiresOn} · ${h(loc(window.text || t("kaçarsa sonuç doğar", "missing it has a consequence")))}</small></div>`).join("")}
      ${openCases.map((item) => `<div class="window case"><strong>${h(loc(item.title))}</strong><br><small>${t("Geri dönüş", "Callback")} · ${t("gün", "day")} ${item.due}</small></div>`).join("")}
      ${!openWindows.length && !openCases.length ? `<p class="muted">${t("Bugün açık pencere yok; enerjini işe, insanlara, sağlığa veya hazırlığa ayırabilirsin.", "No window is open today; you can invest your energy in work, people, health or preparation.")}</p>` : ""}
      <div class="action-grid">${choiceIds
        .map((id) => {
          const action = actionById.get(id);
          if (!action) return "";
          const preview = sonActionForecast(state, id);
          const focusCost = sonActionCost(action);
          return `<button type="button" class="action-card" data-action="${h(id)}" ${locked || state.focusRemaining < focusCost ? "disabled" : ""}><strong>${h(loc(action.label))}</strong><small>${t("Odak", "Focus")} ${focusCost} · ₺${signed(action.money)} · ${t("enerji", "energy")} ${signed(action.energy)} · ${t("umut", "hope")} ${signed(action.hope)}${preview ? ` · ${t("hazırlık", "prep")} ${h(pair(preview.label))} +${preview.gain}` : ""}</small></button>`;
        })
        .join(
          "",
        )}</div><button type="button" id="finish-day" class="day-close">${state.focusRemaining > 0 ? t(`GÜNÜ BİTİR · ${state.focusRemaining} odak dinlenmeye ayrılır`, `END DAY · ${state.focusRemaining} focus becomes recovery`) : t("YENİ GÜN", "NEW DAY")}</button></section>
      <aside class="card status-panel"><p class="eyebrow">${t("DURUM", "STATUS")}</p><div class="stat-list"><div>${t("Nakit", "Cash")}<strong>₺${state.resources.money}</strong></div><div>${t("Enerji", "Energy")}<strong>${state.resources.energy}</strong></div><div>${t("Umut", "Hope")}<strong>${state.resources.hope}</strong></div><div>${t("Aile", "Family")}<strong>${relValue(state, "family")}</strong></div><div>${t("Korku / kabul", "Fear / acceptance")}<strong>${soul.fear}/${soul.acceptance}</strong></div></div><div class="prep-meters"><p class="eyebrow">${t("HAZIRLIK", "PREPARATION")}</p>${["health","money","people","legal","legacy"].map((k) => `<div class="prep-row"><span>${h(k)}</span><meter min="0" max="8" value="${prep[k] || 0}"></meter><b>${prep[k] || 0}/8</b></div>`).join("")}</div><h3>${t("Zorunluluklar", "Obligations")}</h3>${
        state.obligations
          .filter((item) => item.status === "open")
          .map(
            (item) =>
              `<p><strong>${h(loc(item.title))}</strong><br><small>${item.due} ${t("gün ·", "days ·")} ₺${item.cost || 0}</small></p>`,
          )
          .join("") || `<p>${t("Açık yüküm yok.", "No open obligation.")}</p>`
      }</aside></section>
    <div class="recent">${state.history
      .slice(-8)
      .reverse()
      .map(
        (row) =>
          `<span>${row.type === "act" ? t("Karar", "Decision") + ": " + h(loc(row.id)) : row.type === "opportunity" ? t("Fırsat", "Window") + ": " + h(loc(row.result)) : row.type === "callback" ? t("Dosya", "File") + ": " + h(loc(row.title || row.id)) : h(loc(row.type))}</span>`,
      )
      .join(
        "",
      )}</div><p class="notice">${h(session.notice)}</p>${helpPanel(HELP_SECTIONS)}<footer class="footer">© 2026 TarikLab · Tarık Halil Ayaz</footer></main>`;
  root
    .querySelectorAll("[data-action]")
    .forEach((button) =>
      button.addEventListener("click", () => session.act(`act:${button.dataset.action}`)),
    );
  root.querySelector("#finish-day").addEventListener("click", () => session.act("advance"));
  bindSavePanel(root, session);
}

bootGame("son-100-gun", draw);
