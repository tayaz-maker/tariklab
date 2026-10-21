import { uiIcon } from "./ui-icons.js?v=10";
// Preferences are presentation-only and never enter a life save or its backup.
const KEY = "tariklab.tc-sim.ui.v2";
export function readPreferences(storage) {
  try {
    const value = JSON.parse(storage.getItem(KEY) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return { collapsed: value.collapsed === true, remember: value.remember === true,
      lastView: typeof value.lastView === "string" ? value.lastView : "dashboard",
      panels: value.panels && typeof value.panels === "object" && !Array.isArray(value.panels) ? value.panels : {} };
  } catch { return {}; }
}
export function writePreference(storage, patch) {
  try { storage.setItem(KEY, JSON.stringify({ ...readPreferences(storage), ...patch })); } catch { /* Storage denial must not prevent playing. */ }
}
const copy = {
  tr: { collapse: "Menüyü daralt", expand: "Menüyü genişlet", search: "Bölüm ara", remember: "Son ekranı hatırla", empty: "Eşleşen bölüm yok", offline: "Çevrimdışı · Bu cihazdaki kayıtla oynuyorsun.", groups: ["Para ve Yaşam", "İlişkiler", "Beden ve Sağlık", "Eğitim ve Kariyer", "Şehir ve Harita", "Kararlar", "Ayarlar"], time: "Zaman / Odak", goals: "Hedefler", save: "Kayıt", help: "Nasıl Oynanır", work: "İş ve Gelir", map: "Şehir haritası", family: "Aile ve yakınlar", decisions: "Haftalık kararlar", cases: "Bekleyen sonuçlar", close: "Menüyü kapat" },
  en: { collapse: "Collapse menu", expand: "Expand menu", search: "Find a section", remember: "Remember last screen", empty: "No matching section", offline: "Offline · Playing with the save on this device.", groups: ["Money and Living", "Relationships", "Body and Health", "Education and Career", "City and Map", "Decisions", "Settings"], time: "Time / Focus", goals: "Goals", save: "Saves", help: "How to Play", work: "Work and Income", map: "City map", family: "Family and loved ones", decisions: "Weekly decisions", cases: "Pending outcomes", close: "Close menu" },
  pl: { collapse: "Zwiń menu", expand: "Rozwiń menu", search: "Znajdź sekcję", remember: "Zapamiętaj ostatni ekran", empty: "Brak pasującej sekcji", offline: "Offline · Gra korzysta z zapisu na tym urządzeniu.", groups: ["Finanse i Życie", "Relacje", "Ciało i Zdrowie", "Edukacja i Kariera", "Miasto i Mapa", "Decyzje", "Ustawienia"], time: "Czas / Skupienie", goals: "Cele", save: "Zapisy", help: "Jak grać", work: "Praca i Dochody", map: "Mapa miasta", family: "Rodzina i bliscy", decisions: "Decyzje tygodnia", cases: "Oczekujące wyniki", close: "Zamknij menu" },
};
export function restoreLastView(storage, valid) {
  const p = readPreferences(storage);
  return p.remember && valid(p.lastView) ? p.lastView : "dashboard";
}
let disposeShell = () => {};
let returnToHelp = false;
export function resetLifeShell() { disposeShell(); }
export function bindLifeShell(root, view, language = "tr", storage = window.localStorage) {
  if (!root?.querySelector) return;
  disposeShell();
  const l = copy[language] || copy.tr, preferences = readPreferences(storage);
  writePreference(storage, { lastView: view });
  const nav = root.querySelector(".side-nav"), body = root.querySelector(".game-body"), frame = root.querySelector(".game-frame");
  if (!nav || !body || !nav.querySelector("[data-view]")) return;
  const doc = root.ownerDocument;
  const element = (tag, className, text) => { const el = doc.createElement(tag); if (className) el.className = className; if (text) el.textContent = text; return el; };
  const addIcon = (el, icon) => el.insertAdjacentHTML("afterbegin", uiIcon(icon));
  nav.classList.add("compact-nav", "life-navigation");
  const buttons = [...nav.querySelectorAll("[data-view]")];
  buttons.forEach(button => {
    button.querySelector(".nav-mark")?.remove();
    button.lastElementChild?.classList.add("nav-label");
    button.title = button.textContent.trim(); addIcon(button, button.dataset.view);
  });
  // Move the existing controls, keeping their original action handlers intact.
  const toolbar = element("div", "game-toolbar"), actions = element("div", "game-actions");
  const topbar = root.querySelector(".game-topbar"), shortcuts = root.querySelector(".top-shortcuts"), save = root.querySelector(".save-area"), week = root.querySelector(".week-control");
  if (shortcuts) { shortcuts.querySelectorAll("[data-view]").forEach(button => addIcon(button, button.dataset.view)); toolbar.append(shortcuts); }
  if (save) actions.append(save);
  if (week) actions.append(week);
  toolbar.append(actions); topbar.after(toolbar);
  topbar.querySelectorAll("[data-meta]").forEach(meta => addIcon(meta, meta.dataset.meta));
  const languages = element("div", "life-languages"); languages.setAttribute("role", "group"); languages.setAttribute("aria-label", "Language / Dil / Język");
  for (const locale of ["tr", "en", "pl"]) {
    const button = element("button", locale === language ? "is-on" : "", locale.toUpperCase());
    button.type = "button"; button.dataset.language = locale; button.setAttribute("aria-pressed", String(locale === language));
    button.addEventListener("click", () => { window.tlabI18n?.setLang?.(locale); doc.querySelector(`[data-language="${locale}"]`)?.focus({ preventScroll: true }); }); languages.append(button);
  }
  topbar.append(languages);
  // The persistent standalone host is only used on the title/setup screen.
  const languageHost = doc.querySelector("#tc-sim-language"); if (languageHost) languageHost.hidden = true;
  const toggle = element("button", "nav-more");
  toggle.type = "button"; toggle.setAttribute("aria-controls", "life-navigation-body"); addIcon(toggle, "menu");
  const content = element("div", "nav-secondary"); content.id = "life-navigation-body";
  const primary = element("div", "nav-primary");
  const makeLink = (label, icon, target, selector) => {
    const button = element("button", "nav-item"); button.type = "button"; button.title = label;
    addIcon(button, icon); button.append(element("span", "nav-label", label));
    button.dataset.uiJump = icon;
    button.addEventListener("click", () => {
      if (target === "help") { returnToHelp = "nav"; doc.querySelector("#help-open")?.click(); return; }
      if (target === "save") { doc.querySelector("#main-menu")?.click(); return; }
      const destination = buttons.find(b => b.dataset.view === target); destination?.click();
      const panel = doc.querySelector(selector || ".workspace-head h1");
      if (panel) {
        const details = panel.matches("details") ? panel : panel.querySelector("details");
        if (details) details.open = true;
        panel.scrollIntoView({ block: "start", behavior: "instant" }); panel.tabIndex = -1; panel.focus({ preventScroll: true });
      }
      if (selector) {
        doc.querySelectorAll(".side-nav .is-active").forEach(el => { el.classList.remove("is-active"); el.removeAttribute("aria-current"); });
        const selected = doc.querySelector(`[data-ui-jump="${icon}"]`); selected?.classList.add("is-active"); selected?.setAttribute("aria-current", "location");
      }
    });
    return button;
  };
  for (const id of ["dashboard", "inbox", "character", "calendar"]) primary.append(buttons.find(b => b.dataset.view === id));
  const inboxBadge = shortcuts?.querySelector('[data-view="inbox"] b')?.cloneNode(true);
  if (inboxBadge) { inboxBadge.classList.add("nav-badge"); primary.querySelector('[data-view="inbox"]').append(inboxBadge); }
  const time = makeLink(l.time, "time", "dashboard", ".week-panel");
  const timeBadge = element("b", "nav-badge", week?.querySelector("b")?.textContent); time.append(timeBadge); primary.append(time);
  primary.append(makeLink(l.goals, "goals", "dashboard", ".life-depth-panel"), makeLink(l.save, "save", "save"), makeLink(l.help, "help", "help"));
  content.append(primary);
  const groupIcons = ["finance", "relationships", "body", "education", "city", "decisions", "settings"];
  const groupViews = [["finance", "banks", "emlak", "market", "career"], ["people", "relationships"], ["body"], ["education"], ["home"], ["history", "yearbook"], []];
  const groups = [];
  groupViews.forEach((ids, index) => {
    const group = element("details", "nav-category"); group.dataset.uiPanel = `navigation:${index}`;
    group.open = preferences.panels?.[group.dataset.uiPanel] ?? (index === 0 || ids.includes(view));
    const summary = element("summary"); summary.title = l.groups[index]; addIcon(summary, groupIcons[index]); summary.append(element("span", "nav-label", l.groups[index])); summary.insertAdjacentHTML("beforeend", uiIcon("chevron"));
    group.append(summary);
    ids.forEach(id => {
      const button = buttons.find(b => b.dataset.view === id);
      if (id === "career") { button.querySelector(".nav-label").textContent = l.work; button.title = l.work; }
      if (id === "relationships") { button.querySelector(".nav-label").textContent = l.family; button.title = l.family; }
      group.append(button);
    });
    if (index === 4) group.append(makeLink(l.map, "city", "home", ".location-panel"));
    if (index === 5) group.append(makeLink(l.decisions, "decisions", "dashboard", ".week-panel"), makeLink(l.cases, "remaining", "inbox"));
    groups.push(group); content.append(group);
  });
  const remember = element("label", "life-nav-remember"), checkbox = element("input"); checkbox.type = "checkbox"; checkbox.checked = preferences.remember === true;
  checkbox.addEventListener("change", () => writePreference(storage, { remember: checkbox.checked, lastView: view }));
  remember.append(checkbox, doc.createTextNode(l.remember)); groups[6].append(remember);
  const searchLabel = element("label", "life-nav-search");
  const search = element("input"); search.type = "search"; search.autocomplete = "off"; search.placeholder = l.search; search.setAttribute("aria-label", l.search); addIcon(searchLabel, "search"); searchLabel.append(search); content.append(searchLabel);
  const empty = element("p", "empty", l.empty); empty.hidden = true; content.append(empty);
  nav.replaceChildren(toggle, content);
  const backdrop = element("button", "life-nav-backdrop"); backdrop.type = "button"; backdrop.setAttribute("aria-label", l.close); backdrop.tabIndex = -1; backdrop.hidden = true; frame.append(backdrop);
  const breakpoint = window.matchMedia("(max-width: 820px)");
  let mobile = breakpoint.matches, open = mobile ? false : !preferences.collapsed;
  const inertTargets = [toolbar, root.querySelector(".life-status"), root.querySelector(".workspace"), ...root.querySelectorAll(".management-deck"), root.querySelector(".life-languages")].filter(Boolean);
  function setOpen(next) {
    open = next; nav.dataset.layout = mobile ? "mobile" : "desktop";
    nav.classList.toggle("is-expanded", next); body.classList.toggle("life-nav-collapsed", !next && !mobile); frame.classList.toggle("life-nav-collapsed", !next && !mobile);
    doc.documentElement.classList.toggle("life-nav-open", mobile && next);
    toggle.setAttribute("aria-expanded", String(next)); toggle.setAttribute("aria-label", next ? l.collapse : l.expand); toggle.title = next ? l.collapse : l.expand;
    content.hidden = mobile && !next; backdrop.hidden = !(mobile && next);
    inertTargets.forEach(el => { el.inert = mobile && next; });
  }
  setOpen(open);
  const resizeNavigation = event => { mobile = event.matches; setOpen(mobile ? false : !readPreferences(storage).collapsed); };
  breakpoint.addEventListener("change", resizeNavigation);
  const headerObserver = new ResizeObserver(() => frame.style.setProperty("--tc-header-height", `${topbar.getBoundingClientRect().height}px`));
  headerObserver.observe(topbar);
  const onKey = event => {
    if (event.key === "Escape" && open && (mobile || nav.contains(doc.activeElement)) && !doc.querySelector('[aria-modal="true"]')) { event.preventDefault(); setOpen(false); toggle.focus(); }
    if (mobile && open && event.key === "Tab") {
      const focusable = [...nav.querySelectorAll('button, input, summary')].filter(el => el.getClientRects().length && !el.disabled);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  doc.addEventListener("keydown", onKey);
  disposeShell = () => { headerObserver.disconnect(); breakpoint.removeEventListener("change", resizeNavigation); doc.removeEventListener("keydown", onKey); doc.documentElement.classList.remove("life-nav-open"); };
  toggle.addEventListener("click", () => { setOpen(!open); if (!mobile) writePreference(storage, { collapsed: !open }); });
  backdrop.addEventListener("click", () => { setOpen(false); toggle.focus(); });
  groups.forEach(group => group.querySelector("summary").addEventListener("click", event => {
    if (!mobile && !open) { event.preventDefault(); setOpen(true); group.open = true; writePreference(storage, { collapsed: false }); }
  }));
  search.addEventListener("input", () => {
    const query = search.value.trim().toLocaleLowerCase(language); let count = 0;
    primary.querySelectorAll(".nav-item").forEach(button => { button.hidden = !button.textContent.toLocaleLowerCase(language).includes(query); if (!button.hidden) count++; });
    groups.forEach(group => {
      let matches = 0;
      group.querySelectorAll(".nav-item").forEach(button => { button.hidden = !button.textContent.toLocaleLowerCase(language).includes(query); if (!button.hidden) { matches++; count++; } });
      group.hidden = Boolean(query) && !matches; group.dataset.searchOpen = query ? "true" : "false";
      group.open = query ? matches > 0 : readPreferences(storage).panels?.[group.dataset.uiPanel] ?? (groups.indexOf(group) === 0 || group.querySelector('[aria-current="page"]') !== null);
    }); empty.hidden = !query || count > 0;
  });
  nav.addEventListener("click", event => {
    if (!event.target.closest("[data-view]")) return;
    queueMicrotask(() => { const heading = doc.querySelector(".workspace-head h1"); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); } });
  });
  root.querySelectorAll("details").forEach((panel, index) => {
    if (!panel.dataset.uiPanel) panel.dataset.uiPanel = `${view}:${panel.querySelector("summary")?.textContent.trim() || index}`;
    const key = panel.dataset.uiPanel;
    if (typeof preferences.panels?.[key] === "boolean") panel.open = preferences.panels[key];
    panel.querySelector("summary")?.addEventListener("click", () => {
      if (!panel.isConnected || panel.dataset.searchOpen === "true") return;
      writePreference(storage, { panels: Object.fromEntries(Object.entries({ ...readPreferences(storage).panels, [key]: !panel.open }).slice(-160)) });
    });
  });
  root.querySelector(".first-steps > .eyebrow")?.insertAdjacentHTML("afterbegin", uiIcon("light"));
  const economy = root.querySelector(".period-economy");
  economy?.querySelector(":scope > div")?.insertAdjacentHTML("afterbegin", uiIcon("light"));
  economy?.querySelectorAll("dl > div").forEach((el, index) => addIcon(el, ["career", "home", "cart"][index]));
  root.querySelector(".historical-strip")?.insertAdjacentHTML("beforeend", uiIcon("arrow"));
  root.querySelector("#help-open")?.addEventListener("click", () => { returnToHelp ||= "header"; });
  const modal = root.querySelector(".help-card, .event-card");
  if (modal) {
    const modalButtons = () => [...modal.querySelectorAll('button:not(:disabled), a[href], input, select, summary')].filter(el => el.getClientRects().length);
    queueMicrotask(() => modalButtons()[0]?.focus({ preventScroll: true }));
    modal.addEventListener("keydown", event => { const list = modalButtons(); if (event.key === "Tab") { if (event.shiftKey && doc.activeElement === list[0]) { event.preventDefault(); list.at(-1)?.focus(); } else if (!event.shiftKey && doc.activeElement === list.at(-1)) { event.preventDefault(); list[0]?.focus(); } } });
    root.querySelectorAll(".game-topbar, .game-toolbar, .life-status, .workspace, .side-nav, .management-deck").forEach(el => { el.inert = true; });
  } else if (returnToHelp) { const selector = returnToHelp === "nav" ? (mobile ? ".nav-more" : '[data-ui-jump="help"]') : "#help-open"; returnToHelp = false; queueMicrotask(() => doc.querySelector(selector)?.focus({ preventScroll: true })); }
  if (navigator.onLine === false) { const offline = element("p", "life-offline", l.offline); offline.setAttribute("role", "status"); topbar.after(offline); }
}
