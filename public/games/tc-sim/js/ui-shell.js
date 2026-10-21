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
  tr: ["Bölümler", "Menüyü daralt", "Menüyü genişlet", "Bölüm ara", "Para ve yaşam", "İş ve gelişim", "İnsanlar ve ev", "Kayıtlar", "Son ekranı hatırla", "Eşleşen bölüm yok", "Çevrimdışı · Bu cihazdaki kayıtla oynuyorsun."],
  en: ["Sections", "Collapse menu", "Expand menu", "Find a section", "Money and living", "Work and growth", "People and home", "Records", "Remember last screen", "No matching section", "Offline · Playing with the save on this device."],
  pl: ["Sekcje", "Zwiń menu", "Rozwiń menu", "Znajdź sekcję", "Finanse i życie", "Praca i rozwój", "Ludzie i dom", "Zapisy", "Zapamiętaj ostatni ekran", "Brak pasującej sekcji", "Offline · Gra korzysta z zapisu na tym urządzeniu."],
};
const groups = [["finance", "banks", "emlak", "market"], ["career", "education"], ["people", "relationships", "home", "body"], ["history", "yearbook"]];

export function restoreLastView(storage, valid) {
  const p = readPreferences(storage);
  return p.remember && valid(p.lastView) ? p.lastView : "dashboard";
}

export function bindLifeShell(root, view, language = "tr", storage = window.localStorage) {
  if (!root?.querySelector) return;
  const l = copy[language] || copy.tr, preferences = readPreferences(storage);
  writePreference(storage, { lastView: view });
  const nav = root.querySelector(".side-nav"), body = root.querySelector(".game-body");
  if (!nav || !body || !nav.querySelector("[data-view]")) return;
  nav.classList.add("compact-nav", "life-navigation");
  const buttons = [...nav.querySelectorAll("[data-view]")];
  const doc = root.ownerDocument;
  const toggle = doc.createElement("button");
  toggle.type = "button"; toggle.className = "nav-more"; toggle.setAttribute("aria-controls", "life-navigation-body");
  const content = doc.createElement("div"); content.id = "life-navigation-body"; content.className = "nav-secondary";
  const searchLabel = doc.createElement("label"); searchLabel.className = "life-nav-search"; searchLabel.textContent = l[3];
  const search = doc.createElement("input"); search.type = "search"; search.autocomplete = "off"; search.placeholder = l[3]; searchLabel.append(search); content.append(searchLabel);
  groups.forEach((ids, index) => {
    const group = doc.createElement("details"); group.dataset.uiPanel = `navigation:${index}`;
    // Existing menus are initially discoverable; players choose what to fold.
    group.open = preferences.panels?.[group.dataset.uiPanel] !== false;
    const summary = doc.createElement("summary"); summary.textContent = l[index + 4]; group.append(summary);
    ids.forEach(id => { const button = buttons.find(b => b.dataset.view === id); if (button) group.append(button); });
    content.append(group);
  });
  const empty = doc.createElement("p"); empty.className = "empty"; empty.textContent = l[9]; empty.hidden = true; content.append(empty);
  const remember = doc.createElement("label"); remember.className = "life-nav-remember";
  const checkbox = doc.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = preferences.remember === true;
  checkbox.addEventListener("change", () => writePreference(storage, { remember: checkbox.checked, lastView: view }));
  remember.append(checkbox, doc.createTextNode(l[8])); content.append(remember);
  nav.append(toggle, content);
  const mobile = window.matchMedia("(max-width: 820px)").matches;
  let open = mobile ? false : !preferences.collapsed;
  function setOpen(next) {
    open = next;
    nav.classList.toggle("is-expanded", next); body.classList.toggle("life-nav-collapsed", !next && !mobile);
    toggle.setAttribute("aria-expanded", String(next)); toggle.textContent = mobile ? l[0] : next ? l[1] : l[2];
    content.hidden = !next;
  }
  setOpen(open);
  toggle.addEventListener("click", () => { setOpen(!open); if (!mobile) writePreference(storage, { collapsed: !open }); });
  search.addEventListener("input", () => {
    const query = search.value.trim().toLocaleLowerCase(language);
    let count = 0;
    content.querySelectorAll("details").forEach(group => {
      let matches = 0;
      group.querySelectorAll("[data-view]").forEach(button => {
        button.hidden = !button.textContent.toLocaleLowerCase(language).includes(query);
        if (!button.hidden) { matches += 1; count += 1; }
      });
      group.hidden = !matches;
      group.dataset.searchOpen = query ? "true" : "false";
      group.open = query ? matches > 0 : readPreferences(storage).panels?.[group.dataset.uiPanel] !== false;
    });
    empty.hidden = count > 0;
  });
  nav.addEventListener("keydown", event => {
    if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); toggle.focus(); }
  });
  nav.addEventListener("click", event => {
    if (!event.target.closest("[data-view]")) return;
    queueMicrotask(() => {
      const heading = doc.querySelector(".workspace-head h1");
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
  });
  // Stable section identities use the view and heading, never amounts or save data.
  root.querySelectorAll("details").forEach((panel, index) => {
    if (!panel.dataset.uiPanel) panel.dataset.uiPanel = `${view}:${panel.querySelector("summary")?.textContent.trim() || index}`;
    const key = panel.dataset.uiPanel;
    if (typeof preferences.panels?.[key] === "boolean") panel.open = preferences.panels[key];
    panel.querySelector("summary")?.addEventListener("click", () => {
      if (!panel.isConnected || panel.dataset.searchOpen === "true") return;
      const panels = { ...readPreferences(storage).panels, [key]: !panel.open };
      // Bound storage even if old translated headings change across releases.
      writePreference(storage, { panels: Object.fromEntries(Object.entries(panels).slice(-160)) });
    });
  });
  if (navigator.onLine === false) {
    const offline = doc.createElement("p"); offline.className = "life-offline"; offline.setAttribute("role", "status"); offline.textContent = l[10];
    root.querySelector(".game-topbar")?.after(offline);
  }
}
