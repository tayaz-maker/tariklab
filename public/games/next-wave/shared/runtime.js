import { applyAction, create, normalize } from "../../next-wave.js";
import { compactNavigation } from "../../shared/compact-navigation.js";

const NS = "tariklab.nextwave.";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Content language: Polish readers get English where no Polish is authored. */
export function language() {
  const lang = window.tlabI18n?.getLang?.();
  return lang === "en" || lang === "pl" ? "en" : "tr";
}

export function loc(tr, en) {
  if (language() !== "en") return tr;
  const I = window.tlabI18n;
  if (I?.localize) return I.localize(String(tr ?? ""), en || undefined);
  if (en) return en;
  return I ? I.phrase(String(tr ?? "")) : tr;
}

export function text(tr, en) {
  if (language() !== "en") return tr;
  return window.tlabI18n?.localize ? window.tlabI18n.localize(tr, en) : en;
}

/**
 * Structured "Nasıl oynanır" panel.
 *
 * Sections are rendered as a heading plus short paragraphs and bullets, so a
 * first-time player can find one answer without reading a wall of text. Each
 * section is `{ h: [tr, en], p: [[tr, en], …], list: [[tr, en], …] }`.
 */
export function helpSections(sections) {
  if (!Array.isArray(sections)) return `<p>${escapeHtml(sections || "")}</p>`;
  const pair = (value) => (Array.isArray(value) ? text(value[0], value[1]) : value);
  return sections
    .map((section) => {
      const paragraphs = (section.p || []).map((row) => `<p>${escapeHtml(pair(row))}</p>`).join("");
      const items = (section.list || []).map((row) => `<li>${escapeHtml(pair(row))}</li>`).join("");
      return (
        `<h3>${escapeHtml(pair(section.h))}</h3>${paragraphs}` +
        (items ? `<ul class="help-list">${items}</ul>` : "")
      );
    })
    .join("");
}

export function helpPanel(sections, title) {
  const label = Array.isArray(title) ? text(title[0], title[1]) : title;
  const summary = escapeHtml(label || text("Nasıl oynanır", "How to play"));
  return `<details class="help"><summary>${summary}</summary><div class="help-body">${helpSections(sections)}</div></details>`;
}

export function createActionGate(windowMs = 140, clock = () => performance.now()) {
  let blockedUntil = -1;
  return () => {
    const now = clock();
    if (now < blockedUntil) return false;
    blockedUntil = now + windowMs;
    return true;
  };
}

function readSlot(id, slot, normalizer = normalize, backup = false) {
  for (const suffix of backup ? ["", ".backup"] : [""]) {
    try {
      const raw = localStorage.getItem(`${NS}${id}.slot${slot}${suffix}`);
      const parsed = raw === null ? null : JSON.parse(raw);
      const state = parsed ? normalizer(id, parsed) : null;
      if (state) return state;
    } catch {
      /* Try only this slot's backup. */
    }
  }
  return null;
}

export function savePanel(session) {
  const summaries = session.slotSummaries();
  return `<details class="save-menu">
    <summary>${text("Kayıt", "Save")}</summary>
    <div class="save-popover">
      <p class="save-note">${text("Üç yerel kayıt birbirinden ayrıdır.", "Three local saves remain isolated.")}</p>
      ${summaries
        .map(
          (slot) => `<div class="save-row ${slot.active ? "is-active" : ""}">
            <button type="button" data-load-slot="${slot.number}" ${slot.filled ? "" : "disabled"}>${text("Slot", "Slot")} ${slot.number} · ${slot.filled ? text("dolu", "occupied") : text("boş", "empty")}</button>
            <button type="button" data-save-slot="${slot.number}" ${session.state ? "" : "disabled"}>${text("Kaydet", "Save")}</button>
            <button type="button" class="danger" data-delete-slot="${slot.number}" ${slot.filled ? "" : "disabled"}>${text("Sil", "Delete")}</button>
          </div>`,
        )
        .join("")}
    </div>
  </details>`;
}

export function frontMenu(session, options) {
  const selected = session.slotSummaries().find((slot) => slot.active);
  const summarize = options.summary || options.slotSummary;
  const summary = selected?.filled
    ? summarize?.(session.slotState(selected.number)) || text("Kayıt hazır.", "Save ready.")
    : text("Bu kayıt yeri boş.", "This slot is empty.");
  return `<section class="front-menu card">
    <div class="front-menu__heading">
      <p class="eyebrow">${escapeHtml(options.kicker || options.eyebrow || text("YENİ DOSYA", "NEW FILE"))}</p>
      <h1>${escapeHtml(options.title)}</h1>
      <p class="muted">${escapeHtml(options.pitch)}</p>
    </div>
    <div class="slot-picker" role="group" aria-label="${text("Kayıt yerleri", "Save slots")}">
      ${session
        .slotSummaries()
        .map(
          (
            slot,
          ) => `<button type="button" class="slot-card ${slot.active ? "is-active" : ""}" data-select-slot="${slot.number}" aria-pressed="${slot.active}">
            <strong>${text("SLOT", "SLOT")} ${slot.number}</strong>
            <span>${slot.filled ? text("DOLU", "OCCUPIED") : text("BOŞ", "EMPTY")}</span>
          </button>`,
        )
        .join("")}
    </div>
    <p class="slot-summary">${escapeHtml(summary)}</p>
    <div class="front-menu__actions">
      <button type="button" id="menu-new" class="primary">${text("YENİ OYUN", "NEW GAME")}</button>
      <button type="button" id="menu-continue" ${selected?.filled ? "" : "disabled"} title="${selected?.filled ? "" : text("Seçili slot boş.", "Selected slot is empty.")}">${text("DEVAM", "CONTINUE")}</button>
      <button type="button" id="menu-help" aria-expanded="false">${text("NASIL OYNANIR?", "HOW TO PLAY?")}</button>
      <button type="button" id="menu-delete" class="danger" ${selected?.filled ? "" : "disabled"}>${text("SİL", "DELETE")}</button>
    </div>
    <div id="menu-help-body" class="front-menu__help help-body" hidden>${helpSections(options.help || options.pitch)}</div>
    <p class="notice">${escapeHtml(session.notice)}</p>
  </section>`;
}

export function bindFrontMenu(root, session, options) {
  root.querySelectorAll("[data-select-slot]").forEach((button) => {
    button.addEventListener("click", () => session.select(Number(button.dataset.selectSlot)));
  });
  root.querySelector("#menu-new")?.addEventListener("click", () => {
    if (session.beginNew()) options.onNew();
  });
  root.querySelector("#menu-continue")?.addEventListener("click", () => session.continue());
  root.querySelector("#menu-delete")?.addEventListener("click", () => {
    const slot = session.active;
    if (window.confirm(text(`Slot ${slot} silinsin mi?`, `Delete slot ${slot}?`)))
      session.remove(slot);
  });
  root.querySelector("#menu-help")?.addEventListener("click", (event) => {
    const panel = root.querySelector("#menu-help-body");
    const open = panel.hidden;
    panel.hidden = !open;
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });
}

export function bindSavePanel(root, session) {
  root.querySelectorAll("[data-load-slot]").forEach((button) => {
    button.addEventListener("click", () => session.load(Number(button.dataset.loadSlot)));
  });
  root.querySelectorAll("[data-save-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = Number(button.dataset.saveSlot);
      const occupied = session.slotSummaries().find((entry) => entry.number === slot)?.filled;
      if (
        slot !== session.active &&
        occupied &&
        !window.confirm(
          text(
            `Slot ${slot} dolu. Üzerine yazılsın mı?`,
            `Slot ${slot} is occupied. Overwrite it?`,
          ),
        )
      )
        return;
      session.save(slot);
    });
  });
  root.querySelectorAll("[data-delete-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = Number(button.dataset.deleteSlot);
      if (window.confirm(text(`Slot ${slot} silinsin mi?`, `Delete slot ${slot}?`)))
        session.remove(slot);
    });
  });
}

export function bootGame(id, draw, engine = {}) {
  const make = engine.create || create,
    loadState = engine.normalize || normalize,
    actState = engine.applyAction || applyAction;
  const safe = Boolean(engine.safe);
  let active = 1;
  try {
    active = Math.min(3, Math.max(1, Number(localStorage.getItem(`${NS}${id}.active`)) || 1));
  } catch {
    /* Allow an in-memory game. */
  }
  let slots = [1, 2, 3].map((slot) => readSlot(id, slot, loadState, safe));
  let state = null;
  let newGameAuthorized = false;
  const enterAction = createActionGate();
  let notice = "";
  let releaseLanguage = null;

  const persist = (slot = active) => {
    if (!state) return false;
    try {
      const data = JSON.stringify(state),
        key = `${NS}${id}.slot${slot}`;
      if (safe) {
        const old = localStorage.getItem(key);
        let validOld = false;
        try {
          validOld = old && !!loadState(id, JSON.parse(old));
        } catch {
          /* Never back up corrupt data. */
        }
        if (validOld) localStorage.setItem(`${key}.backup`, old);
      }
      localStorage.setItem(key, data);
      slots[slot - 1] = JSON.parse(data);
      notice = text(`Slot ${slot} kaydedildi.`, `Saved to slot ${slot}.`);
      return true;
    } catch {
      notice = text(
        "Kayıt yazılamadı. Oyun bellekte devam ediyor; sayfayı kapatmadan tekrar kaydet.",
        "Save failed. Play continues in memory; save again before closing this page.",
      );
      return false;
    }
  };
  const rememberActive = () => {
    try {
      localStorage.setItem(`${NS}${id}.active`, String(active));
    } catch {
      /* Main save reports failures. */
    }
  };

  const render = () => {
    draw(api);
    compactNavigation(
      document.querySelector(".life-nav, .state-nav"),
      text("Diğer bölümler", "More sections"),
    );
    const host = document.querySelector("[data-lang-host]");
    if (host && window.tlabI18n) window.tlabI18n.mountLangToggle(host);
    if (language() === "en") {
      window.tlabI18n.applyPhrases?.(document.body);
    }
  };

  const guarded = (work) => {
    if (!enterAction()) {
      notice = text(
        "İşlem sürüyor; ikinci tıklama uygulanmadı.",
        "Action in progress; duplicate click ignored.",
      );
      render();
      return false;
    }
    work();
    return true;
  };

  const api = {
    id,
    get state() {
      return state;
    },
    get active() {
      return active;
    },
    get notice() {
      return notice;
    },
    clearNotice() {
      notice = "";
    },
    slotState(slot = active) {
      const value = slots[slot - 1];
      return value ? JSON.parse(JSON.stringify(value)) : null;
    },
    select(slot) {
      if (![1, 2, 3].includes(slot) || state) return false;
      active = slot;
      notice = "";
      render();
      return true;
    },
    beginNew() {
      if (state) return false;
      if (
        slots[active - 1] &&
        !window.confirm(
          text(
            `Slot ${active} dolu. Yeni oyun bu kaydın üzerine yazacak. Devam edilsin mi?`,
            `Slot ${active} is occupied. A new game will overwrite it. Continue?`,
          ),
        )
      )
        return false;
      newGameAuthorized = true;
      notice = "";
      return true;
    },
    cancelNew() {
      newGameAuthorized = false;
    },
    commitNew(options = {}) {
      if (!newGameAuthorized || state) return false;
      state = options.factory ? options.factory() : make(id);
      if (!state?.meta || state.meta.id !== id) {
        state = null;
        newGameAuthorized = false;
        notice = text("Başlangıç dosyası geçersiz.", "Invalid starting file.");
        render();
        return false;
      }
      state.meta.seed ??= 12345;
      if (options.action) actState(id, state, options.action);
      options.configure?.(state);
      slots[active - 1] = state;
      rememberActive();
      persist();
      newGameAuthorized = false;
      render();
      return true;
    },
    continue() {
      if (state || !slots[active - 1]) {
        notice = text("Seçili slot boş.", "Selected slot is empty.");
        render();
        return false;
      }
      state = JSON.parse(JSON.stringify(slots[active - 1]));
      if (safe) rememberActive();
      notice = text(`Slot ${active} yüklendi.`, `Loaded slot ${active}.`);
      render();
      return true;
    },
    act(action) {
      if (!state) {
        notice = text("Önce yeni oyun başlat.", "Start a new game first.");
        render();
        return false;
      }
      return guarded(() => {
        actState(id, state, action);
        persist();
        render();
      });
    },
    setUI(key, value) {
      if (!state) return false;
      state.ui = state.ui || {};
      state.ui[key] = value;
      persist();
      render();
      return true;
    },
    save(slot = active) {
      if (!state || ![1, 2, 3].includes(slot)) return false;
      active = slot;
      rememberActive();
      const saved = persist(slot);
      render();
      return saved;
    },
    load(slot) {
      if (![1, 2, 3].includes(slot)) return false;
      const loaded = readSlot(id, slot, loadState, safe);
      if (!loaded) {
        notice = text(
          "Kayıt boş veya bozuk; açık oyun korunuyor.",
          "Save empty or corrupt; current game preserved.",
        );
        render();
        return false;
      }
      active = slot;
      rememberActive();
      state = loaded;
      slots[slot - 1] = state;
      notice = state
        ? text(`Slot ${slot} yüklendi.`, `Loaded slot ${slot}.`)
        : text(`Slot ${slot} boş.`, `Slot ${slot} is empty.`);
      render();
    },
    remove(slot) {
      if (![1, 2, 3].includes(slot)) return false;
      try {
        localStorage.removeItem(`${NS}${id}.slot${slot}.backup`);
        localStorage.removeItem(`${NS}${id}.slot${slot}`);
      } catch {
        notice = text("Kayıt silinemedi.", "Could not delete save.");
        render();
        return false;
      }
      slots[slot - 1] = null;
      if (slot === active) state = null;
      notice = text(`Slot ${slot} silindi.`, `Deleted slot ${slot}.`);
      render();
    },
    slotSummaries() {
      return slots.map((value, index) => ({
        number: index + 1,
        filled: !!value,
        active: index + 1 === active,
      }));
    },
    render,
  };

  document.documentElement?.classList?.toggle("embedded", window.self !== window.top);
  render();
  if (window.tlabI18n) releaseLanguage = window.tlabI18n.onLang(render);
  window.addEventListener("pagehide", () => releaseLanguage?.(), { once: true });
  return api;
}
