import { HELP_SECTIONS } from "./help.js";
import {
  bootGame,
  frontMenu,
  bindFrontMenu,
  savePanel,
  bindSavePanel,
  escapeHtml as h,
  text as t,
} from "../next-wave/shared/runtime.js";
import { compactNavigation } from "../shared/compact-navigation.js";
import { createTown, normalizeTown, applyTownAction, population } from "./sim.js";
import { IDENTITIES } from "./data.js";
import { NAV, townPanel, history, help, tr, number } from "./presentation.js";
const root = document.body;
let view = "menu",
  draft = { name: "Çınarlı", context: "balanced" },
  lastState = null;
function setup(session) {
  root.innerHTML = `<main class="game-root"><section class="setup-shell town-paper village-paper"><p class="eyebrow">${t("GEÇİCİ YÖNETİM DOSYASI", "INTERIM ADMINISTRATION FILE")}</p><h1>SON KÖY MANAGER</h1><p>${t("Herkes gidiyor. Sen kalıp köyü ayakta tutmaya çalışıyorsun.", "Everyone is leaving. You stay and try to keep the village standing.")}</p><label for="town-name">${t("Köyün adı", "Village name")}</label><input id="town-name" maxlength="30" value="${h(draft.name)}"><label for="town-context">${t("Devraldığın miras", "The legacy you inherit")}</label><select id="town-context"><option value="balanced" ${draft.context === "balanced" ? "selected" : ""}>${t("Yol kavşağı · dengeli başlangıç", "Crossroads · balanced start")}</option><option value="industry" ${draft.context === "industry" ? "selected" : ""}>${t("Sanayi mirası · üretim +12, kirlilik +8, kimlik −4", "Industrial legacy · production +12, pollution +8, identity −4")}</option><option value="rural" ${draft.context === "rural" ? "selected" : ""}>${t("Tarım havzası · tarım +12, su −8, iş −3", "Farming basin · agriculture +12, water −8, jobs −3")}</option></select><div class="setup-summary"><p>900 ${t("kişi", "people")} · 160.000 TL ${t("bütçe", "budget")} · 40.000 TL ${t("borç", "debt")}</p><p>${t("24 ay · ayda 3 karar · 13 bina · farklı çıkarlar", "24 months · 3 decisions per month · 13 buildings · conflicting interests")}</p></div><div class="setup-actions"><button id="cancel-setup">${t("GERİ", "BACK")}</button><button id="confirm-start" ${draft.name.trim() ? "" : "disabled"}>${t("YÖNETİMİ DEVRAL", "TAKE OFFICE")}</button></div></section></main>`;
  root.querySelector("#town-name").addEventListener("input", (e) => {
    draft.name = e.target.value;
    root.querySelector("#confirm-start").disabled = !draft.name.trim();
  });
  root.querySelector("#town-context").addEventListener("change", (e) => {
    draft.context = e.target.value;
  });
  root.querySelector("#cancel-setup").addEventListener("click", () => {
    session.cancelNew();
    view = "menu";
    draw(session);
  });
  root.querySelector("#confirm-start").addEventListener("click", () => {
    if (draft.name.trim()) session.commitNew({ factory: () => createTown(draft) });
  });
}
function draw(session) {
  const s = session.state,
    fresh = s !== lastState;
  lastState = s;
  if (!s) {
    if (view === "setup") return setup(session);
    root.innerHTML = `<main class="game-root">${frontMenu(session, { title: "SON KÖY MANAGER", eyebrow: t("BİR KÖYÜN SON ŞANSI", "A VILLAGE'S LAST CHANCE"), pitch: t("Herkes gidiyor. Sen kalıp köyü ayakta tutmaya çalışıyorsun.", "Everyone is leaving. You stay and try to keep the village standing."), help: HELP_SECTIONS, slotSummary: (s) => `${s.name} · ${t("Ay", "Month")} ${s.month}/24 · ${population(s)} ${t("kişi", "people")}` })}</main>`;
    bindFrontMenu(root, session, {
      onNew: () => {
        draft = { name: "Çınarlı", context: "balanced" };
        view = "setup";
        draw(session);
      },
    });
    return;
  }
  view = "menu";
  const month = s.month;
  root.innerHTML = `<main class="game-root town-root"><header class="topbar"><a href="/">${t("← Oyunlar", "← Games")}</a><span class="topbar__title">SON KÖY MANAGER</span><div class="topbar__tools">${savePanel(session)}<button id="town-menu">${t("Ana menü", "Main menu")}</button></div></header><header class="town-masthead"><div><p class="eyebrow">${t("KÖY DEFTERİ", "VILLAGE LEDGER")} · ${t("AY", "MONTH")} ${s.month}/24</p><h1>${h(s.name)}</h1><p>${h(tr(IDENTITIES[s.identity]))}</p></div><div class="town-totals"><span>${t("Bütçe", "Budget")}<b>${number(s.budget)} TL</b></span><span>${t("Nüfus", "Population")}<b>${number(population(s))}</b></span><span>${t("Borç", "Debt")}<b>${number(s.debt)} TL</b></span></div></header><div class="town-layout"><nav class="town-nav" aria-label="${t("Köy bölümleri", "Village sections")}">${NAV.map((n) => `<button type="button" data-screen="${n[0]}" class="${s.ui.screen === n[0] ? "is-active" : ""}">${t(n[1], n[2])}</button>`).join("")}</nav><section class="town-content"><div class="town-action-bar"><span><b>${s.used.length}/3 ${t("karar kullanıldı", "decisions used")}</b><small>${t("Kalan haklar sonraki aya taşınmaz.", "Unused decisions do not carry over.")}</small></span><button id="town-advance" ${s.ended ? "disabled" : ""}>${s.ended ? t("KAMPANYA TAMAMLANDI", "CAMPAIGN COMPLETE") : t("AYI KAPAT", "CLOSE MONTH")}</button></div><p class="notice" role="status">${h(session.notice)}</p><div id="town-panel">${townPanel(s)}</div>${help()}</section><aside class="town-feed"><details open><summary>${t("SONUÇ AKIŞI", "CONSEQUENCE FEED")}</summary>${history(s)}</details></aside></div><footer>© 2026 TarikLab · Tarık Halil Ayaz</footer></main>`;
  root
    .querySelectorAll("[data-screen]")
    .forEach((b) => b.addEventListener("click", () => session.setUI("screen", b.dataset.screen)));
  root
    .querySelectorAll("[data-command]")
    .forEach((b) =>
      b.addEventListener("click", () => session.act(`${b.dataset.command}@${month}`)),
    );
  root.querySelector("#town-advance").addEventListener("click", () => {
    session.act(`advance@${month}`);
    root.querySelector("#town-panel")?.scrollIntoView({ block: "start" });
  });
  root.querySelector("#town-menu").addEventListener("click", () => {
    if (session.save()) window.location.reload();
  });
  bindSavePanel(root, session);
  compactNavigation(root.querySelector(".town-nav"), t("Diğer bölümler", "More sections"));
  if (fresh && document.scrollingElement) document.scrollingElement.scrollTop = 0;
}
bootGame("son-kasaba", draw, {
  create: () => createTown(),
  normalize: normalizeTown,
  applyAction: (_id, s, a) => applyTownAction(s, a),
  safe: true,
});
