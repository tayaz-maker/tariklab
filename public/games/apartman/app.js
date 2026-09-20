import { apartmanForecast, PROPOSALS, RESIDENTS } from "../next-wave.js";
import { HELP_SECTIONS } from "./help.js";
import { memoryLabel, allianceLabel, systemLabel } from "./presentation.js";
import {
  bindFrontMenu,
  bindSavePanel,
  bootGame,
  escapeHtml as h,
  frontMenu,
  loc,
  helpPanel,
  savePanel,
  text as t,
} from "../next-wave/shared/runtime.js";

const root = document.body;
const money = (n) => new Intl.NumberFormat("tr-TR").format(Math.round(n));
let view = "menu";
let siteScale = 2;

function slotSummary(state) {
  return t(
    `${state.week}. hafta · ₺${money(state.finance.cash)} kasa · ${state.issues.filter((issue) => issue.status === "acik").length} açık mesele`,
    `Week ${state.week} · ₺${money(state.finance.cash)} cash · ${state.issues.filter((issue) => issue.status === "acik").length} open issues`,
  );
}

function menu(session) {
  root.innerHTML = `<main class="game-root"><header class="topbar global-chrome"><a href="/">${t("← Oyunlar", "← Games")}</a><span data-lang-host></span></header>${frontMenu(
    session,
    {
      kicker: t("YÖNETİCİ DOSYASI", "MANAGER FILE"),
      title: "YUNUS APARTMANI",
      pitch: t(
        "Bir bina, on altı daire, bitmeyen meseleler.",
        "One building, sixteen flats, issues that never end.",
      ),
      summary: slotSummary,
      help: HELP_SECTIONS,
    },
  )}</main>`;
  bindFrontMenu(root, session, {
    onNew: () => {
      view = "setup";
      session.render();
    },
  });
}

function setup(session) {
  root.innerHTML = `<main class="game-root"><header class="topbar global-chrome"><a href="/">${t("← Oyunlar", "← Games")}</a><span data-lang-host></span></header><section class="setup-shell card"><p class="eyebrow">${t("SİTE YÖNETİM DOSYASI", "ESTATE MANAGEMENT FILE")}</p><h1>YUNUS APARTMANI</h1><p>${t("Aidat, bakım, güvenlik, temizlik ve komşu siyaseti aynı masada. Ölçeği seç; büyüdükçe bütçe kadar hizmet yükü ve muhalefet de artar.", "Dues, maintenance, security, cleaning and neighbour politics share one desk. Choose the scale; a larger estate brings more revenue, service load and opposition.")}</p><div class="scale-grid">${[2,4,10].map((blocks) => `<button type="button" data-scale="${blocks}" class="${siteScale === blocks ? "is-selected" : ""}"><strong>${blocks} ${t("blok", "blocks")}</strong><small>${blocks * 16} ${t("daire", "units")} · ${blocks === 2 ? t("yakın yönetim", "hands-on") : blocks === 4 ? t("kurul dengesi", "board politics") : t("profesyonel site", "professional estate")}</small></button>`).join("")}</div><div class="apt-metrics"><span class="pill">${t("Aidat ve bütçe", "Dues and budget")}</span><span class="pill">${t("Bakım ve asansör", "Maintenance and lifts")}</span><span class="pill">${t("Güvenlik ve temizlik", "Security and cleaning")}</span><span class="pill">${t("Malik / kiracı dengesi", "Owner / tenant balance")}</span></div><div class="setup-actions"><button type="button" id="cancel-setup">${t("GERİ", "BACK")}</button><button type="button" id="confirm-start" class="primary">${t("YÖNETİMİ DEVRAL", "TAKE MANAGEMENT")}</button></div></section></main>`;
  root.querySelectorAll("[data-scale]").forEach((button) => button.addEventListener("click", () => {
    siteScale = Number(button.dataset.scale);
    setup(session);
  }));
  root.querySelector("#cancel-setup").addEventListener("click", () => {
    session.cancelNew();
    view = "menu";
    session.render();
  });
  root.querySelector("#confirm-start").addEventListener("click", () => session.commitNew({ configure: (state) => {
    const load = siteScale === 2 ? 1 : siteScale === 4 ? 1.55 : 2.6;
    state.site = { blocks: siteScale, units: siteScale * 16, serviceLoad: load, operationalCapacity: siteScale === 2 ? 6 : siteScale === 4 ? 8 : 11 };
    state.finance.cash = Math.round(12000 * load);
    state.finance.dues = Math.round(2400 * load);
    state.finance.arrears = Math.round(1800 * load);
    state.progression.phase = siteScale === 2 ? "apartman yönetimi" : siteScale === 4 ? "site kurulu" : "profesyonel tesis yönetimi";
  }}));
}

function issueCard(issue, state) {
  const people = (issue.parties || [])
    .map((id) => RESIDENTS.find((resident) => resident.id === id)?.name)
    .filter(Boolean);
  const prepared = (state.flags.prepared || []).includes(issue.id);
  const focused = state.flags.focusIssue === issue.id;
  return `<button type="button" class="issue ${focused ? "is-focus" : ""}" data-issue="${h(issue.id)}">
    <strong>${h(loc(issue.title || issue.type))}</strong>
    <small>${h(systemLabel(issue.system, state.building.parts, loc, t))} · ${t("tahmini", "estimate")} ₺${money((issue.severity || 1) * 550)} · ${t("gecikme riski", "delay risk")} ${issue.severity || 1}/4</small>
    <small>${people.length ? h(people.join(" · ")) : t("Duyuru kutusundan geldi", "Filed through the notice box")} ${prepared ? `· ✓ ${t("hazırlandı", "prepared")}` : ""}</small>
  </button>`;
}

function draw(session) {
  const state = session.state;
  if (!state) {
    return view === "setup" ? setup(session) : menu(session);
  }

  const open = state.issues.filter((issue) => issue.status === "acik");
  const focus = open.find((issue) => issue.id === state.flags.focusIssue) || open[0];
  const residents = (focus?.parties || [])
    .map((id) => state.residents.find((resident) => resident.id === id))
    .filter(Boolean);
  const meetingDone = state.flags.meetingWeek === state.week;
  const confidence = state.politics?.confidence ?? 50;
  if (state.runSummary) {
    // Matches son-100-gun's terminal report: the save panel stays reachable
    // here too. Without it, the only exit from an ended run was "MENÜ", which
    // reloads the page into the same active slot and the same ended state -
    // a dead end with no way to load a different slot or start over.
    root.innerHTML = `<main class="game-root"><header class="topbar global-chrome"><a href="/">${t("← Oyunlar", "← Games")}</a><div class="topbar__tools"><span data-lang-host></span>${savePanel(session)}</div></header><section class="card run-summary"><p class="eyebrow">${t("YÖNETİM DOSYASI", "MANAGEMENT FILE")}</p><h1>${h(state.runSummary.result)}</h1><p>${h(state.runSummary.cause)}</p><div class="apt-metrics"><span class="pill">${state.week}. ${t("hafta", "week")}</span><span class="pill">${t("Güven", "Confidence")} ${confidence}/100</span><span class="pill">${h(state.runSummary.phase)}</span></div><h2>${t("Karar izi", "Decision trail")}</h2>${state.runSummary.decisions.map((row) => `<p>${h(row.proposal)} · ${row.accepted ? t("kabul", "passed") : t("ret", "rejected")} · ${row.yes}-${row.no}</p>`).join("")}${(state.runSummary.traces || []).length ? `<h2>${t("Hane izi", "Household trail")}</h2>${state.runSummary.traces.map((row) => `<p>${h(row)}</p>`).join("")}` : ""}<p class="muted">${t("Yeni bir yönetim için farklı bir kayıt yerini yükle.", "Load a different save slot to take on a new management.")}</p></section></main>`;
    bindSavePanel(root, session);
    return;
  }
  root.innerHTML = `<main class="game-root"><header class="topbar global-chrome"><a href="/">${t("← Oyunlar", "← Games")}</a><span class="topbar__title">APARTMAN · ${t("YÖNETİCİ DEFTERİ", "MANAGER LEDGER")}</span><div class="topbar__tools"><span data-lang-host></span>${savePanel(session)}</div></header>
    <section class="apt-head"><div><p class="eyebrow">${state.week}. ${t("HAFTA", "WEEK")} · ${h(state.progression?.phase || "yıpranmış bina")}</p><h1>${t("Site Yönetim Masası", "Estate Management Desk")}</h1><p class="muted">${state.site?.blocks || 2} ${t("blok", "blocks")} · ${state.site?.units || 32} ${t("daire", "units")} · ${t("öncelik: açık meseleyi hazırla, kurula gerçek maliyetli çözüm götür", "priority: prepare an open issue and take a costed solution to the board")}</p></div><div class="apt-metrics"><span class="pill metric">${t("Kasa", "Cash")} ₺${money(state.finance.cash)}</span><span class="pill metric">${t("Aidat", "Dues")} ₺${money(state.finance.dues)}</span><span class="pill">${t("Bina", "Building")} ${state.building.condition}/100</span><span class="pill ${confidence < 35 ? "danger-pill" : ""}">${t("Güven", "Confidence")} ${confidence}/100</span></div></section>
    ${(state.politics?.warnings || []).map((warning) => `<p class="danger-warning">⚠ ${h(loc(warning))}</p>`).join("")}
    <section class="apt-board"><aside class="card"><p class="eyebrow">${t("BİNA", "BUILDING")}</p><div class="building-list">${state.building.parts.map((part) => `<div class="building-row"><span>${h(loc(part.name))}</span><b>${Math.round(part.condition)}</b><div class="meter"><i style="--value:${part.condition}%"></i></div></div>`).join("")}</div></aside>
      <section class="card desk"><p class="eyebrow">${t("BUGÜNÜN MESELELERİ", "TODAY'S ISSUES")}</p><div class="issue-list">${
        open
          .slice(0, 6)
          .map((issue) => issueCard(issue, state))
          .join("") ||
        `<p>${t("Açık mesele yok; haftayı kapatabilirsin.", "No open issue; you can close the week.")}</p>`
      }</div>
        ${focus ? `<div class="desk-actions"><button type="button" data-prepare="${h(focus.id)}" ${(state.flags.prepared || []).includes(focus.id) || (state.flags.prepared || []).length >= 2 ? "disabled" : ""}>${t("Dosyayı hazırla", "Prepare file")} · ${(state.flags.prepared || []).length}/2</button><span class="muted">${t("Toplantı gündemi", "Meeting agenda")}: ${h(loc(focus.title))}</span></div>` : ""}</section>
      <aside class="card notice-board"><p class="eyebrow">${t("BİNA SİYASETİ", "BUILDING POLITICS")}</p><p class="muted">${t("İttifak", "Alliances")}: ${h((state.politics?.alliances || []).map((id) => allianceLabel(id, t)).join(", ") || "—")} · ${t("Muhalefet", "Opposition")}: ${state.politics?.opposition?.length || 0}</p><div class="resident-list">${(residents.length ? residents : state.residents.slice(0, 5)).map((resident) => `<div class="resident"><strong>${h(resident.name)}</strong> · ${t("güven", "trust")} ${resident.trust}<br>${h(loc(resident.personality))} · ${h(loc(resident.interest))}${resident.memories?.length ? `<br>${t("Hatırlıyor", "Remembers")}: ${h(memoryLabel(resident.memories.at(-1), loc, t))}` : ""}</div>`).join("")}</div></aside></section>
    ${state.lastMeeting ? `<section class="card vote-result"><strong>${t("Son oylama", "Last vote")}: ${state.lastMeeting.yes}-${state.lastMeeting.no}</strong> · ${state.lastMeeting.accepted ? t("Kabul", "Passed") : t("Ret", "Rejected")} · ${h(loc(PROPOSALS.find((p) => p.id === state.lastMeeting.proposal)?.label || state.lastMeeting.proposal))}</section>` : ""}
    ${
      state.activeEvent
        ? `<section class="card apt-event" data-chain="${h(state.activeEvent.chainId)}"><p class="eyebrow">${t("DEVAM EDEN MESELE", "CONTINUING MATTER")} · ${h(state.activeEvent.family || "")}</p><h2>${h(loc(state.activeEvent.title))}</h2><p>${h(loc(state.activeEvent.body))}</p><div class="desk-actions">${(state.activeEvent.choices || []).map((choice) => `<button type="button" data-event-choice="${h(state.activeEvent.chainId)}:${h(state.activeEvent.nodeId)}:${h(choice.id)}">${h(loc(choice.label))}</button>`).join("")}</div></section>`
        : ""
    }
    ${
      state.ui?.ledgerOpen
        ? `<section class="card"><p class="eyebrow">${t("YÖNETİCİ DEFTERİ", "MANAGER LEDGER")}</p>${
            state.history
              .slice(-8)
              .reverse()
              .map((row) => `<p>${h(loc(row.text || row.proposal || row.issue || row.type))}</p>`)
              .join("") || `<p>${t("Defter boş.", "Ledger is empty.")}</p>`
          }</section>`
        : ""
    }
    <div class="apt-footer-actions"><button type="button" id="history">${t("Defterden son kayıtlar", "Recent ledger")}</button><button type="button" id="meeting" class="primary" ${meetingDone || !focus ? "disabled" : ""}>${meetingDone ? t("Bu hafta toplantı yapıldı", "Meeting already held this week") : t("TOPLANTI GECESİ", "MEETING NIGHT")}</button><button type="button" id="advance">${t("HAFTAYI KAPAT", "CLOSE THE WEEK")}</button></div>
    <p class="notice">${h(session.notice)}</p>${helpPanel(HELP_SECTIONS)}<footer class="footer">© 2026 TarikLab · Tarık Halil Ayaz</footer></main>
    ${
      state.ui?.meetingOpen
        ? `<div class="meeting-scene" role="dialog" aria-modal="true" aria-labelledby="meeting-title"><section class="meeting-paper"><p class="eyebrow">${t("GÜNDEM", "AGENDA")}</p><h2 id="meeting-title">${h(loc(focus?.title || t("Apartman bütçesi", "Building budget")))}</h2><p>${t("Hazırlanan dosya", "Prepared files")}: ${(state.flags.prepared || []).length}/2 · ${t("Sakinler salonda. Her teklif başka bir bedel taşır.", "Residents are in the room. Every proposal carries a different cost.")}</p><div class="proposal-grid">${PROPOSALS.map(
            (proposal) => {
              const forecast = apartmanForecast(state, proposal);
              return `<button type="button" data-proposal="${h(proposal.id)}"><strong>${h(loc(proposal.label))}</strong><br><small>₺${money(proposal.cash || 0)} · ${t("bina", "condition")} ${proposal.condition >= 0 ? "+" : ""}${proposal.condition}</small><span class="risk-preview">${t("Mali", "Finance")}: ${forecast.bands[0]} · ${t("Sosyal", "Social")}: ${forecast.bands[1]} · ${t("Uzun", "Long")}: ${forecast.bands[2]}</span></button>`;
            },
          ).join(
            "",
          )}</div><button type="button" id="close-meeting">${t("Masaya dön", "Back to desk")}</button></section></div>`
        : ""
    }`;

  root
    .querySelectorAll("[data-issue]")
    .forEach((button) =>
      button.addEventListener("click", () => session.act(`focus:${button.dataset.issue}`)),
    );
  root
    .querySelector("[data-prepare]")
    ?.addEventListener("click", (event) =>
      session.act(`prepare:${event.currentTarget.dataset.prepare}`),
    );
  root
    .querySelector("#meeting")
    ?.addEventListener("click", () => session.setUI("meetingOpen", true));
  root
    .querySelector("#close-meeting")
    ?.addEventListener("click", () => session.setUI("meetingOpen", false));
  root.querySelectorAll("[data-proposal]").forEach((button) =>
    button.addEventListener("click", () => {
      if (session.act(`proposal:${button.dataset.proposal}`)) session.setUI("meetingOpen", false);
    }),
  );
  root.querySelectorAll("[data-event-choice]").forEach((button) =>
    button.addEventListener("click", () => session.act(`event-choice:${button.dataset.eventChoice}`)),
  );
  root.querySelector("#advance").addEventListener("click", () => session.act("advance"));
  root
    .querySelector("#history")
    .addEventListener("click", () => session.setUI("ledgerOpen", !state.ui?.ledgerOpen));
  bindSavePanel(root, session);
}

bootGame("apartman", draw, { safe: true });
