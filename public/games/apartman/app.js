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
let pane = "queue";

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
      kicker: t("GECE NÖBETİ", "NIGHT WATCH"),
      title: "KAPI NÖBETİ",
      pitch: t(
        "İki, dört ya da on blok. Bütçe sınırlı; her karar bütün siteye yayılır.",
        "Two, four or ten blocks. The budget is finite; every decision travels across the estate.",
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
  root.innerHTML = `<main class="game-root"><header class="topbar global-chrome"><a href="/">${t("← Oyunlar", "← Games")}</a><span data-lang-host></span></header><section class="setup-shell card"><p class="eyebrow">${t("GECE NÖBETİ", "NIGHT WATCH")}</p><h1>KAPI NÖBETİ</h1><p>${t("Aidat, bakım, güvenlik, temizlik ve komşu siyaseti aynı masada. Ölçeği seç; büyüdükçe bütçe kadar hizmet yükü ve muhalefet de artar.", "Dues, maintenance, security, cleaning and neighbour politics share one desk. Choose the scale; a larger estate brings more revenue, service load and opposition.")}</p><div class="scale-grid">${[2,4,10].map((blocks) => `<button type="button" data-scale="${blocks}" class="${siteScale === blocks ? "is-selected" : ""}"><strong>${blocks} ${t("blok", "blocks")}</strong><small>${blocks * 16} ${t("daire", "units")} · ${blocks === 2 ? t("yakın yönetim", "hands-on") : blocks === 4 ? t("kurul dengesi", "board politics") : t("profesyonel site", "professional estate")}</small></button>`).join("")}</div><div class="apt-metrics"><span class="pill">${t("Aidat ve bütçe", "Dues and budget")}</span><span class="pill">${t("Bakım ve asansör", "Maintenance and lifts")}</span><span class="pill">${t("Güvenlik ve temizlik", "Security and cleaning")}</span><span class="pill">${t("Malik / kiracı dengesi", "Owner / tenant balance")}</span></div><div class="setup-actions"><button type="button" id="cancel-setup">${t("GERİ", "BACK")}</button><button type="button" id="confirm-start" class="primary">${t("YÖNETİMİ DEVRAL", "TAKE MANAGEMENT")}</button></div></section></main>`;
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

function courtyardSvg(parts) {
  const cell = (id, x, y, w, height) => {
    const part = parts.find((item) => item.id === id);
    const condition = part ? Math.round(part.condition) : 0;
    const worn = condition < 45;
    return `<g><rect x="${x}" y="${y}" width="${w}" height="${height}" rx="4" fill="${worn ? "#3a2a22" : "#1c2a24"}" stroke="#d7c7a2" stroke-dasharray="${worn ? "4 3" : "0"}"/><text x="${x + 8}" y="${y + 18}" fill="#f3ead7" font-size="12">${h(part ? loc(part.name) : id)} ${condition}</text></g>`;
  };
  const cond = (id) => Math.round(parts.find((item) => item.id === id)?.condition || 0);
  return `<svg class="courtyard" viewBox="0 0 360 280" role="img" aria-label="${t("Avlu planı", "Courtyard plan")}">
    <rect x="8" y="8" width="344" height="264" rx="8" fill="#121614" stroke="#3a3228"/>
    ${cell("cati", 24, 20, 312, 40)}
    ${cell("asansor", 24, 72, 86, 118)}
    ${cell("su", 250, 72, 86, 118)}
    <rect x="122" y="72" width="116" height="118" rx="6" fill="#243028" stroke="#86aa91"/>
    <text x="138" y="124" fill="#e7f0df" font-size="13">${t("Avlu", "Court")}</text>
    <text x="138" y="146" fill="#cbbba4" font-size="11">${t("temizlik", "cleaning")} ${cond("temizlik")}</text>
    <text x="138" y="164" fill="#cbbba4" font-size="11">${t("güvenlik", "security")} ${cond("guvenlik")}</text>
    ${cell("elektrik", 24, 204, 100, 48)}
    ${cell("isitma", 132, 204, 100, 48)}
    ${cell("otopark", 240, 204, 96, 48)}
  </svg>`;
}

function deskIssues(open, focus) {
  const ranked = open.slice().sort((a, b) => (b.severity || 1) - (a.severity || 1) || String(a.id).localeCompare(String(b.id)));
  const top = ranked.slice(0, 3);
  if (focus && !top.some((issue) => issue.id === focus.id)) return [focus, ...top.slice(0, 2)];
  return top;
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
  const visible = deskIssues(open, focus);
  root.innerHTML = `<main class="game-root"><header class="topbar global-chrome"><a href="/">${t("← Oyunlar", "← Games")}</a><span class="topbar__title">KAPI NÖBETİ</span><div class="topbar__tools"><span data-lang-host></span>${savePanel(session)}</div></header>
    <section class="apt-head"><div><p class="eyebrow">${state.week}. ${t("HAFTA", "WEEK")} · ${h(state.progression?.phase || "yıpranmış bina")}</p><h1>${t("Gece nöbet masası", "Night watch desk")}</h1><p class="muted">${state.site?.blocks || 2} ${t("blok", "blocks")} · ${state.site?.units || 32} ${t("daire", "units")} · ${t("masada en fazla üç açık karar", "at most three open decisions on the desk")}</p></div><div class="apt-metrics"><span class="pill metric">${t("Kasa", "Cash")} ₺${money(state.finance.cash)}</span><span class="pill metric">${t("Aidat borcu", "Arrears")} ₺${money(state.finance.arrears || 0)}</span><span class="pill">${t("Bina", "Building")} ${state.building.condition}/100</span><span class="pill ${confidence < 35 ? "danger-pill" : ""}">${t("Güven", "Confidence")} ${confidence}/100</span></div></section>
    ${(state.politics?.warnings || []).map((warning) => `<p class="danger-warning">⚠ ${h(loc(warning))}</p>`).join("")}
    <nav class="desk-tabs" aria-label="${t("Masa bölümleri", "Desk sections")}"><button type="button" data-pane="queue" aria-pressed="${pane === "queue"}">${t("Kuyruk", "Queue")}</button><button type="button" data-pane="court" aria-pressed="${pane === "court"}">${t("Avlu", "Court")}</button><button type="button" data-pane="people" aria-pressed="${pane === "people"}">${t("Sakinler", "Residents")}</button></nav>
    <section class="apt-board"><aside class="card night-court" data-pane="court"><p class="eyebrow">${t("AVLU", "COURTYARD")}</p>${courtyardSvg(state.building.parts)}</aside>
      <section class="card desk" data-pane="queue"><p class="eyebrow">${t("ÜÇ KARAR", "THREE DECISIONS")} · ${open.length}</p><div class="issue-list">${
        visible
          .map((issue) => issueCard(issue, state))
          .join("") ||
        `<p>${t("Açık mesele yok; haftayı kapatabilirsin.", "No open issue; you can close the week.")}</p>`
      }</div>
        ${open.length > visible.length ? `<p class="muted">${open.length - visible.length} ${t("mesele defterde bekliyor; masa yalnız üçünü gösterir.", "issues stay in the ledger; the desk shows only three.")}</p>` : ""}
        ${focus ? `<div class="desk-actions"><button type="button" data-prepare="${h(focus.id)}" ${(state.flags.prepared || []).includes(focus.id) || (state.flags.prepared || []).length >= 2 ? "disabled" : ""}>${t("Dosyayı hazırla", "Prepare file")} · ${(state.flags.prepared || []).length}/2</button><span class="muted">${t("Toplantı gündemi", "Meeting agenda")}: ${h(loc(focus.title))}</span></div>` : ""}</section>
      <aside class="card notice-board" data-pane="people"><p class="eyebrow">${t("GÜVEN VE BORÇ", "TRUST AND DEBT")}</p><p class="muted">${t("İttifak", "Alliances")}: ${h((state.politics?.alliances || []).map((id) => allianceLabel(id, t)).join(", ") || "—")} · ${t("Muhalefet", "Opposition")}: ${state.politics?.opposition?.length || 0}</p><div class="resident-list">${(residents.length ? residents : state.residents.slice(0, 5)).map((resident) => `<div class="resident"><strong>${h(resident.name)}</strong> · ${t("güven", "trust")} ${resident.trust}<br>${h(loc(resident.personality))} · ${h(loc(resident.interest))}${resident.pays === false ? ` · ${t("aidat gecikmiş", "dues late")}` : ""}${resident.memories?.length ? `<br>${t("Hatırlıyor", "Remembers")}: ${h(memoryLabel(resident.memories.at(-1), loc, t))}` : ""}</div>`).join("")}</div></aside></section>
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
  root.querySelectorAll(".desk-tabs [data-pane]").forEach((button) =>
    button.addEventListener("click", () => {
      pane = button.dataset.pane;
      draw(session);
    }),
  );
  document.body.dataset.pane = pane;
  bindSavePanel(root, session);
}

bootGame("apartman", draw, { safe: true });
