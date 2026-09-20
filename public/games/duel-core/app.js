import { primaryTitle, cardActionTitle, dispatchPresented } from "./presentation.js";
import { buildCards } from "./card-data.js";
import { createDuel, rejection } from "./rules.js";
import { legalActions } from "./actions.js";
import { publicView } from "./projection.js";
import { chooseAction } from "./ai.js";
import { loadDuel, saveDuel } from "./save.js";
import { generateDeck } from "./deckgen.js";
import { random } from "./random.js";
import { PHASES } from "./model.js";
import { labels } from "./labels.js";
import { rejectionText } from "./rejections.js";
import { explainRejection } from "./explain.js";
import { eventStory, moveStory } from "./flow-copy.js";
import {
  markOnboardingSeen,
  onboardingSeen,
  onboardingSteps,
  resetOnboarding,
} from "./onboarding.js";
import { relatedCards } from "./relationships.js";
import {
  DECK_SCHEMA_VERSION,
  deckBreakdown,
  deckCopy,
  expandDeck,
  findPreset,
  presetCardIds,
} from "./decks.js";
import { deckListBody, renderSetup } from "./setup-flow.js";
import { duelHelpBody } from "./help-duel.js";
import { detailLine, joinText, localized, plain } from "./render-safe.js";
import { createMatchTelemetry, recordAction } from "./telemetry.js";
import { analyzeMatch } from "./analyzer.js";
import { loadSettings, saveSettings, loadHistory, recordMatch } from "./prefs.js";
import {
  applyDisplay,
  settingsBody,
  relatedBlock,
  postMatchBody,
  analysisBody,
  historyBody,
  actionLogBody,
} from "./match-ux.js";
import { cardArt, flowWords, identityPatch, identityValue, pickLang, themeMeta } from "./theme-meta.js";

/**
 * The one rule for what may become a child node.
 *
 * Conditional rendering leaves `null` in the child list wherever an optional
 * field is absent. `$` has always dropped those, but `replaceChildren` and
 * `append` stringify whatever they are handed, so a list passed to them
 * directly turned every empty slot into the literal word "null" on screen.
 * Both paths now go through here.
 */
const renderable = (children) =>
  [children]
    .flat(Infinity)
    .filter(
      (child) => child instanceof Node || typeof child === "string" || typeof child === "number",
    )
    .map((child) => (child instanceof Node ? child : document.createTextNode(String(child))));
const $ = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") el.className = value;
    else if (key.startsWith("aria-") && value != null) el.setAttribute(key, String(value));
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (value !== false && value !== null && value !== undefined)
      el.setAttribute(key, value === true ? "" : String(value));
  }
  el.append(...renderable(children));
  return el;
};
export async function startApp(theme, designs) {
  document.documentElement.classList.toggle("tlab-embedded", window.self !== window.top);
  const root = document.querySelector("#app");
  const motionLayer = $("div", { class: "duel-motion-layer", "aria-hidden": "true", inert: true });
  document.body.append(motionLayer);
  window.addEventListener("resize", () => {
    for (const animation of root.getAnimations({ subtree: true })) animation.cancel();
    motionLayer.replaceChildren();
  });
  const storage = {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  };
  let lang = "tr",
    motion = "on";
  try {
    lang = localStorage.getItem("tariklab.language") === "en" ? "en" : "tr";
    motion = localStorage.getItem("tariklab.duel.motion") || "on";
  } catch {
    /* Storage errors are reported when a duel is saved. */
  }
  let settings = loadSettings(storage, theme);
  motion = settings.motion || motion;
  applyDisplay(settings, theme);
  let state = null,
    screen = "menu",
    selected = null,
    pool = [],
    saved = null,
    notice = "",
    timer = null,
    setup = null,
    decks = [],
    lastPoints = null,
    lastRevision = -1,
    telemetry = null,
    lastAnalysis = null,
    shownResult = false,
    drag = null,
    hoverTimer = null,
    pressTimer = null;
  let historyOpen = true;
  let archiveQuery = "",
    archiveKind = "",
    archiveSeries = "",
    archiveLevel = "",
    archiveSubtype = "",
    archiveLocation = "",
    archiveStat = "",
    archiveTab = "cards",
    archiveDeckId = null,
    archivePage = 0;
  const meta = themeMeta(theme);
  const name = meta.name,
    point = meta.point;
  const themeLabels = meta.labels;
  const t = (key) =>
    typeof key === "string" ? themeLabels[lang][key] || labels[lang][key] || key : "";
  const text = (value) => localized(value, lang);
  const persistSettings = (patch = {}) => {
    settings = { ...settings, ...patch, motion };
    saveSettings(storage, settings, theme);
    applyDisplay(settings, theme);
  };
  const catalog = () => state?.catalog || Object.fromEntries(pool.map((c) => [c.id, c]));
  const rulesBody = () => [
    // The first-duel guide is replayable rather than a one-time thing the
    // player can lose by tapping Skip once, and it sits at the top: someone
    // looking for it should not have to read twelve sections to find it.
    screen === "duel"
      ? $(
          "div",
          { class: "dialog-actions coach-replay-row" },
          button(
            lang === "tr" ? "İlk Düello Rehberini Tekrar Göster" : "Replay the First-Duel Guide",
            () => {
              resetOnboarding(storage, theme);
              close();
              startCoach(true);
            },
            { "data-pick": "coach-replay" },
          ),
        )
      : null,
    duelHelpBody($, theme, lang),
  ];
  const button = (label, fn, attrs = {}) =>
    $("button", { type: "button", onclick: fn, ...attrs }, label);
  const actor = () => state?.choice?.player ?? state?.pending?.responding ?? state?.active;
  const view = () => publicView(state, 0);
  let actionCacheState = null,
    actionCache = [];
  const actions = () => {
    if (state !== actionCacheState) {
      actionCacheState = state;
      actionCache = state ? legalActions(state, 0) : [];
    }
    return actionCache;
  };
  const cname = (uid, v = view()) => {
    const c = v.cards[uid];
    return (
      text(c?.name) ||
      (c
        ? `${t("hidden")} · ${t(c.owner === 0 ? "you" : "opponent")} · ${t(c.zone === "units" ? "unit" : c.zone)} ${(c.slot ?? 0) + 1}`
        : t("hidden"))
    );
  };
  const displayError = (error) =>
    error === "storage-failed" ? t("saveError") : error === "no-save" ? t("noSave") : t("corrupt");
  const dialog = $("dialog", { "aria-labelledby": "dialog-title" });
  document.body.append(dialog);
  /**
   * Navigation semantics for every layer opened over a screen.
   *
   * `Kapat` dismisses only the layer on screen and leaves the screen beneath
   * it — and any half-finished setup — exactly as it was. `Geri` steps one
   * level up, back to the layer that opened this one. `Ana Menü` is the only
   * control that jumps to the root. Escape follows `Geri` when there is a
   * level above and only closes the layer when there is not.
   */
  let dialogBack = null;
  function close() {
    dialogBack = null;
    dialog.close();
    dialog.replaceChildren();
  }
  function show(title, body, cls = "", onBack = null) {
    const previousFocus = dialog.contains(document.activeElement)
      ? document.activeElement.dataset.pick
      : null;
    const previousScroll = dialog.querySelector(".dialog-body")?.scrollTop || 0;
    const refreshing = dialog.open && dialog.className === cls;
    if (dialog.open) dialog.close();
    dialog.className = cls;
    dialogBack = typeof onBack === "function" ? onBack : null;
    dialog.replaceChildren(
      $(
        "div",
        { class: "dialog-head" },
        dialogBack
          ? button(t("up"), () => dialogBack?.(), {
              class: "ghost dialog-up",
              "data-pick": "dialog-up",
              "aria-label": t("up"),
            })
          : null,
        $("h2", { id: "dialog-title" }, title),
        button(t("close"), close, { "aria-label": t("close"), "data-pick": "dialog-close" }),
      ),
      $("div", { class: "dialog-body" }, body),
    );
    const footer = dialog.querySelector(".dialog-body > .dialog-actions");
    if (footer) dialog.append(footer);
    dialog.showModal();
    if (refreshing && previousFocus) {
      [...dialog.querySelectorAll("[data-pick]")]
        .find((el) => el.dataset.pick === previousFocus)
        ?.focus({ preventScroll: true });
      dialog.querySelector(".dialog-body").scrollTop = previousScroll;
    }
  }
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });
  document.addEventListener("keydown", (e) => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName);
    if (e.key === "Escape") {
      selected = null;
      endDrag(true);
      if (dialog.open) {
        e.preventDefault();
        // One level per press: a card detail opened from the archive goes back
        // to the archive rather than dismissing everything at once.
        const up = dialogBack;
        if (up) up();
        else close();
      }
      if (screen === "duel") render();
      return;
    }
    if (typing || dialog.open) return;
    if (e.key === " " && screen === "duel" && state && !state.result && actor() === 0) {
      const phase = actions().find((a) => a.type === "phase");
      if (phase) {
        e.preventDefault();
        command(phase);
      }
      return;
    }
    if (e.key === "i" || e.key === "I") {
      if (selected) inspect(selected);
      return;
    }
    if (e.key === "h" || e.key === "H") {
      e.preventDefault();
      openHistory();
      return;
    }
    if ((e.key === "a" || e.key === "A") && screen === "menu") {
      screen = "archive";
      render();
      return;
    }
    if (screen === "duel" && state && actor() === 0 && /^[1-5]$/.test(e.key)) {
      const hand = view().players[0].hand;
      const uid = hand[Number(e.key) - 1];
      if (uid) selectCard(uid);
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== "tariklab.language" || !pool.length) return;
    lang = event.newValue === "en" ? "en" : "tr";
    close();
    render();
  });
  function ask(message, yes) {
    show(name, [
      $("p", {}, message),
      $(
        "div",
        { class: "dialog-actions" },
        button(t("cancel"), close),
        button(
          t("confirm"),
          () => {
            close();
            yes();
          },
          { class: "primary" },
        ),
      ),
    ]);
  }
  function save() {
    const result = saveDuel(storage, state);
    notice = result.ok ? "" : displayError(result.error);
    saved = { ok: true, state };
  }
  function command(action) {
    clearTimeout(timer);
    const oldCards = new Map(
      [...root.querySelectorAll(".zone [data-card],.hand-row [data-card]")].map((el) => [
        el.dataset.card,
        { rect: el.getBoundingClientRect(), clone: el.cloneNode(true) },
      ]),
    );
    try {
      const prev = state;
      const result = dispatchPresented(state, action);
      if (!result.ok) {
        notice = `${t("notLegal")}: ${reason(result.error)}`;
        render();
        return;
      }
      state = result.state;
      selected = null;
      if (telemetry) recordAction(telemetry, prev, state, action);
      save();
      if (state.result && !shownResult) {
        shownResult = true;
        lastAnalysis = analyzeMatch(telemetry, catalog(), lang);
        const plays = {};
        for (const [id, s] of Object.entries(telemetry?.cardStats || {})) plays[id] = s.plays || 0;
        recordMatch(storage, theme, {
          at: Date.now(),
          turns: lastAnalysis.turns,
          winner: lastAnalysis.winner,
          aiProfile: settings.aiProfile,
          identity: identityValue(theme, settings),
          starId: lastAnalysis.starId,
          starValue: lastAnalysis.starValue,
          turning: lastAnalysis.turning,
          events: lastAnalysis.events,
          opByTurn: lastAnalysis.opByTurn,
          cardPlays: plays,
        });
      }
      render();
      if (state.result) showPostMatch();
      else {
        animateTransition(oldCards);
        scheduleAI();
      }
    } catch (error) {
      notice = `${t("notLegal")}. ${error.message}`;
      render();
    }
  }
  function animateTransition(oldCards) {
    if (motion !== "on" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const v = view(),
      current = new Map(
        [...root.querySelectorAll(".zone [data-card],.hand-row [data-card]")].map((el) => [
          el.dataset.card,
          el,
        ]),
      );
    const battle = v.log.findLast((e) => e.event === "battle" && e.revision === v.revision);
    for (const [uid, el] of current) {
      const old = oldCards.get(uid),
        rect = el.getBoundingClientRect();
      if (old) {
        const dx = old.rect.x - rect.x,
          dy = old.rect.y - rect.y;
        if (Math.abs(dx) + Math.abs(dy) > 4)
          el.animate(
            [
              { transform: `translate(${dx}px,${dy}px) translateZ(2px)`, opacity: 0.7 },
              { transform: "translate(0,0) translateZ(2px)", opacity: 1 },
            ],
            { duration: 250, easing: "ease-out" },
          );
        else if (old.clone.classList.contains("face-down") !== el.classList.contains("face-down"))
          el.animate(
            [
              { transform: "scaleX(.15) translateZ(2px)", filter: "brightness(1.7)" },
              { transform: "scaleX(1) translateZ(2px)", filter: "brightness(1)" },
            ],
            { duration: 220, easing: "ease-out" },
          );
      } else {
        const from = root
          .querySelector(`[data-pile="${v.cards[uid]?.owner}:deck"]`)
          ?.getBoundingClientRect();
        const dx = from ? from.x - rect.x : 0,
          dy = from ? from.y - rect.y : -18;
        el.animate(
          [
            { transform: `translate(${dx}px,${dy}px) translateZ(2px) scale(.55)`, opacity: 0 },
            { transform: "translate(0,0) translateZ(2px) scale(1)", opacity: 1 },
          ],
          { duration: 280, easing: "ease-out" },
        );
      }
      if (battle?.attacker === uid)
        el.animate(
          [
            { transform: "translateY(0) translateZ(2px)" },
            {
              transform: `translateY(${battle.player === 0 ? -32 : 32}px) translateZ(2px) scale(1.06)`,
            },
            { transform: "translateY(0) translateZ(2px)" },
          ],
          { duration: 250, easing: "ease-in-out" },
        );
    }
    for (const [uid, old] of oldCards)
      if (!current.has(uid)) {
        const { rect } = old,
          card = v.cards[uid],
          clone = card?.name ? cardEl(card, uid, null) : old.clone;
        clone.removeAttribute("data-card");
        clone.setAttribute("aria-hidden", "true");
        clone.style.cssText = `position:fixed;pointer-events:none;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;z-index:9;`;
        motionLayer.append(clone);
        const destination = state.players[card?.owner ?? 0].banished.includes(uid)
          ? "banished"
          : "grave";
        const target = root
          .querySelector(`[data-pile="${card?.owner ?? 0}:${destination}"]`)
          ?.getBoundingClientRect();
        const dx = target ? target.x - rect.x : 24,
          dy = target ? target.y - rect.y : 35;
        const effect = clone.animate(
          [
            { opacity: 0.9, transform: "translate(0,0) scale(1)" },
            { opacity: 0.8, transform: "translate(0,0) scale(1.04)", offset: 0.25 },
            { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(.25)` },
          ],
          { duration: 320, easing: "ease-in" },
        );
        effect.onfinish = () => clone.remove();
      }
  }
  function reason(code) {
    return rejectionText(code, lang);
  }
  /**
   * The name of an action the player expected to be able to take, worded the
   * same way the enabled button would word it.
   */
  function blockedLabel(type, card, v) {
    return cardActionTitle(
      { type, card: card?.uid ?? null, tributes: [] },
      card,
      v,
      theme,
      lang,
      t(type),
    );
  }
  /** Why that action is unavailable, specific to this board where possible. */
  function whyBlocked(code, card) {
    return explainRejection(code, {
      state,
      card,
      lang,
      theme,
      point,
      label: (key) => t(key),
      unitWord: t("unit"),
    });
  }
  function scheduleAI() {
    clearTimeout(timer);
    if (screen !== "duel" || !state || state.result || actor() !== 1) return;
    timer = setTimeout(() => {
      const approved = legalActions(state, 1),
        action = chooseAction(
          publicView(state, 1),
          approved,
          telemetry?.aiProfile || settings.aiProfile || "controlled",
        );
      if (action) command(action);
      else {
        notice = t("notLegal");
        render();
      }
    }, 220);
  }
  function header() {
    // No TR/EN button here: the outer TarikLab shell above this iframe owns
    // the single visible language control, and the "storage" listener above
    // already re-renders this game the moment that outer toggle changes
    // `tariklab.language` — a second language control here was a duplicate
    // control, not a second source of truth.
    return $(
      "header",
      { class: "operations" },
      $("img", { src: `/games/${theme}/assets/emblem.svg`, alt: "" }),
      $("div", { class: "brand" }, $("strong", {}, name), $("small", {}, " · TARIKLAB")),
      button("?", () => show(t("help"), rulesBody()), { "aria-label": t("help") }),
      button(t("menu"), () => {
        clearTimeout(timer);
        screen = "menu";
        selected = null;
        render();
      }),
    );
  }
  function render() {
    root.removeAttribute("aria-busy");
    document.documentElement.lang = lang;
    document.body.dataset.theme = theme;
    document.body.dataset.screen = screen;
    document.body.dataset.motion = motion === "on" ? "full" : "reduced";
    applyDisplay(settings, theme);
    const targeting =
      screen === "duel" &&
      selected &&
      actions().some(
        (a) => a.card === selected && (a.target !== undefined || a.slot !== undefined),
      );
    document.body.dataset.targeting = targeting ? "true" : "";
    document.title = `${name} · TarikLab`;
    root.replaceChildren(
      header(),
      $("div", { class: "notice", role: "status", "aria-live": "polite" }, notice),
      screen === "archive" ? archive() : screen === "duel" ? board() : menu(),
    );
    // Measured against the freshly rendered board, so it lands beside its
    // anchor rather than where the anchor used to be.
    for (const stale of root.querySelectorAll(".coach-target"))
      stale.classList.remove("coach-target");
    const coach = coachMark();
    if (coach) {
      root.append(coach);
      coach.placeBeside?.();
    }
  }
  function menu() {
    return $(
      "main",
      { class: "menu-stage" },
      $(
        "section",
        { class: "front" },
        $("img", { class: "emblem", src: `/games/${theme}/assets/emblem.svg`, alt: "" }),
        $(
          "div",
          { class: "eyebrow" },
          pickLang(meta.eyebrow, lang),
        ),
        $("h1", {}, name),
        $("p", {}, t("deckNote")),
        $(
          "div",
          { class: "menu-buttons" },
          button(
            t("new"),
            () => {
              if (saved?.ok || saved?.error !== "no-save") ask(t("overwrite"), beginSetup);
              else beginSetup();
            },
            { class: "primary" },
          ),
          button(
            t("continue"),
            () => {
              if (saved?.ok) {
                state = saved.state;
                screen = "duel";
                shownResult = Boolean(state.result);
                telemetry =
                  telemetry ||
                  createMatchTelemetry({
                    theme,
                    seed: state.seed,
                    aiProfile: settings.aiProfile,
                    identity: identityValue(theme, settings),
                  });
                if (state.result) {
                  lastAnalysis = analyzeMatch(telemetry, catalog(), lang);
                  render();
                  showPostMatch();
                } else {
                  render();
                  scheduleAI();
                }
              } else {
                notice = displayError(saved?.error);
                render();
              }
            },
            { disabled: !saved?.ok },
          ),
          button(`${t("archive")} · ${pool.length}`, () => {
            screen = "archive";
            render();
          }),
          button(t("help"), () => show(t("help"), rulesBody())),
          button(t(meta.fileLabelKey), () => openCampaignFile()),
          button(t("settings"), openSettings),
          $("a", { href: "/", target: "_top" }, `← ${t("back")}`),
        ),
      ),
    );
  }
  function openSettings() {
    const refresh = () =>
      show(
        t("settings"),
        settingsBody($, t, settings, (patch) => {
          if (patch.motion) {
            motion = patch.motion;
            try {
              localStorage.setItem("tariklab.duel.motion", motion);
            } catch {
              /* Preference remains active for this visit. */
            }
          }
          persistSettings(patch);
          refresh();
        }),
        "settings-dialog",
      );
    refresh();
  }
  function openCampaignFile() {
    show(
      t(meta.fileLabelKey),
      historyBody($, t, lang, theme, loadHistory(storage, theme), catalog()),
    );
  }
  function openHistory() {
    const events = telemetry?.events || lastAnalysis?.events || [];
    show(t("actionHistory"), actionLogBody($, t, events, catalog(), lang));
  }
  function showPostMatch() {
    if (!lastAnalysis) lastAnalysis = analyzeMatch(telemetry, catalog(), lang);
    show(
      t("postMatch"),
      postMatchBody($, t, lang, theme, lastAnalysis, catalog(), {
        analysis: () => show(t("analysis"), analysisBody($, t, lang, lastAnalysis, catalog())),
        history: openHistory,
        replay: () => {
          close();
          beginSetup();
        },
        menu: () => {
          close();
          screen = "menu";
          render();
        },
      }),
    );
  }
  async function loadDeckPresets() {
    try {
      const response = await fetch(`/games/${theme}/decks.json`);
      if (!response.ok) throw Error(String(response.status));
      const doc = await response.json();
      if (doc?.schemaVersion !== DECK_SCHEMA_VERSION || !Array.isArray(doc.decks)) return [];
      return doc.decks;
    } catch {
      // A missing preset file must never block a duel: the seeded generator stays.
      return [];
    }
  }
  function chosenDeckId() {
    const stored = identityValue(theme, settings);
    return findPreset(decks, stored)?.id || decks[0]?.id || null;
  }
  function beginSetup() {
    // Closing the wizard with `Kapat` leaves the half-finished setup intact,
    // so coming back resumes on the step it was left on. Only `Vazgeç` and a
    // started duel clear it.
    if (setup && !setup.decks) {
      setupWizard();
      return;
    }
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    setup = {
      seed,
      rng: seed,
      first: null,
      step: 1,
      deckId: chosenDeckId(),
      aiProfile: settings.aiProfile,
      viewingDeck: false,
    };
    setupWizard();
  }
  function setupWizard() {
    // One container, re-rendered in place: the dialog never closes between
    // steps, so a tap always shows its own result without losing scroll.
    const host = $("div", { class: "setup-wizard" });
    const draw = () =>
      renderSetup(host, {
        $,
        lang,
        theme,
        pool,
        decks,
        state: setup,
        onInspectCard: (card) => archiveInspect(card, () => setupWizard()),
        onCancel: () => {
          setup = null;
          close();
        },
        onStart: () => {
          persistSettings(identityPatch(theme, setup.deckId, { aiProfile: setup.aiProfile }));
          rps();
        },
      });
    draw();
    show(lang === "tr" ? "Düellonu Kur" : "Set Up Your Duel", [host], "setup-dialog");
  }
  function previewDeck(onBack) {
    const preset = findPreset(decks, setup?.deckId);
    const cards = preset
      ? presetCardIds(preset).map((id) => pool.find((c) => c.id === id))
      : (setup?.decks?.[0]?.main || []).map((id) => pool.find((c) => c.id === id));
    const counted = new Map();
    for (const card of cards.filter(Boolean))
      counted.set(card.id, { card, count: (counted.get(card.id)?.count || 0) + 1 });
    show(
      t("preview"),
      [
        $("p", {}, t("previewNote")),
        $(
          "ul",
          { class: "deck-card-list" },
          ...[...counted.values()]
            .sort((a, b) => text(a.card.name).localeCompare(text(b.card.name), lang))
            .map(({ card, count }) =>
              $(
                "li",
                {},
                $(
                  "button",
                  {
                    type: "button",
                    class: "deck-card-row",
                    "data-pick": `deck-card-${card.id}`,
                    onclick: () => archiveInspect(card, () => previewDeck(onBack)),
                  },
                  $("span", { class: "deck-card-name" }, text(card.name)),
                  $("span", { class: "deck-card-count" }, `×${count}`),
                ),
              ),
            ),
        ),
        $(
          "div",
          { class: "dialog-actions" },
          $("button", { type: "button", "data-pick": "preview-back", onclick: onBack }, t("up")),
        ),
      ],
      "",
      onBack,
    );
  }
  function rps(message = "") {
    show(t("rps"), [
      $("p", {}, message || t("deckNote")),
      $(
        "div",
        { class: "dialog-actions" },
        ...["rock", "paper", "scissors"].map((key, i) =>
          button(t(key), () => {
            const enemy = Math.floor(random(setup) * 3),
              difference = (i - enemy + 3) % 3;
            if (!difference) {
              rps(`${t(key)} / ${t(["rock", "paper", "scissors"][enemy])}. ${t("rpsTie")}`);
              return;
            }
            if (difference === 1)
              show(t("rps"), [
                $("p", {}, t("rpsWin")),
                $(
                  "div",
                  { class: "dialog-actions" },
                  button(t("first"), () => prepare(0)),
                  button(t("second"), () => prepare(1)),
                ),
              ]);
            else prepare(1, t("rpsLose"));
          }),
        ),
      ),
    ]);
  }
  function prepare(first, message = "") {
    setup.first = first;
    setup.decks = [0, 1].map((p) => {
      const seed = (setup.seed + Math.imul(p + 1, 2654435761)) >>> 0;
      // Player 0 plays exactly the preset chosen in step 1; the opponent draws a
      // preset from the same seed so it fields a coherent deck too. Order still
      // comes from the seed, so one preset never replays the same duel.
      const preset =
        p === 0
          ? findPreset(decks, setup.deckId)
          : decks.length
            ? decks[seed % decks.length]
            : null;
      return preset ? expandDeck(preset, pool, seed) : generateDeck(pool, seed);
    });
    show(t("new"), [
      $("p", {}, message || t(first === 0 ? "first" : "second")),
      $("p", {}, t("deckNote")),
      button(t("preview"), () => previewDeck(() => prepare(first, message))),
      button(
        t("start"),
        () => {
          state = createDuel(pool, theme, setup.seed, setup.first, setup.decks);
          telemetry = createMatchTelemetry({
            theme,
            seed: setup.seed,
            aiProfile: setup.aiProfile || settings.aiProfile,
            identity: setup.deckId,
          });
          shownResult = false;
          lastAnalysis = null;
          setup = null;
          screen = "duel";
          startFirstDuelCoach = !onboardingSeen(storage, theme);
          lastPoints = null;
          close();
          save();
          render();
          if (startFirstDuelCoach) {
            startFirstDuelCoach = false;
            startCoach();
          }
          scheduleAI();
        },
        { class: "primary" },
      ),
    ]);
  }
  function cardEl(card, uid, onClick, attrs = {}) {
    const hidden = !card?.name,
      down = hidden || (card.face === "down" && ["units", "support", "field"].includes(card.zone));
    return makeCard();
    function makeCard() {
      const el = $(
        onClick ? "button" : "article",
        {
          type: onClick ? "button" : null,
          class: `playing-card ${down ? "face-down" : ""} ${card?.position === "defense" ? "defense" : ""} ${uid === selected ? "selected" : ""} ${selected && uid && actions().some((a) => a.card === selected && a.target === uid) ? "valid-target" : ""}`,
          "data-kind": card?.kind || "",
          "data-card": uid,
          "data-used": state && card?.used?.activate === state.turn ? "true" : "false",
          "data-attacked": card?.attacksUsed > 0 ? "true" : "false",
          "data-response-ready":
            state &&
            card?.owner === 0 &&
            actions().some((a) => a.type === "respond" && a.card === uid)
              ? "true"
              : "false",
          "data-position": card?.position || "",
          "aria-label": hidden ? t("hidden") : text(card.name),
          ...attrs,
        },
        hidden
          ? null
          : $(
              "span",
              { class: "card-banner" },
              $("span", { class: "card-name" }, text(card.name)),
              card.kind === "unit" && Number.isFinite(card.level)
                ? $(
                    "span",
                    { class: "card-level", "aria-label": `${t("level")} ${card.level}` },
                    "★",
                    String(card.level),
                  )
                : $(
                    "span",
                    { class: "card-level card-kind-tag" },
                    card.subtype ? t(card.subtype) : t(card.kind),
                  ),
            ),
        $(
          "span",
          { class: "card-art", "aria-hidden": "true" },
          down
            ? "◈"
            : card.id
              ? $("img", {
                  src: cardArt(theme, card).src,
                  alt: "",
                  loading: "lazy",
                  decoding: "async",
                  width: cardArt(theme, card).width,
                  height: cardArt(theme, card).height,
                })
              : "◈",
        ),
        hidden
          ? null
          : $(
              "span",
              { class: "card-stats" },
              card.kind === "unit"
                ? [
                    $(
                      "span",
                      { class: "card-atk" },
                      $("small", {}, "ATK"),
                      String(card.attack ?? card.baseAttack ?? "—"),
                    ),
                    $(
                      "span",
                      { class: "card-def" },
                      $("small", {}, "DEF"),
                      String(card.defense ?? card.baseDefense ?? "—"),
                    ),
                  ]
                : [
                    $("span", { class: "card-atk" }, t(card.kind)),
                    $("span", { class: "card-def" }, card.subtype ? t(card.subtype) : t(card.kind)),
                  ],
            ),
      );
      if (onClick) bindCardChrome(el, uid, card, onClick);
      return el;
    }
  }
  function previewInspect(uid) {
    const body = root.querySelector(".inspector-body");
    if (!body || screen !== "duel" || dialog.open) return;
    body.replaceChildren(...renderable(inspectBody(uid)));
  }
  function beginDrag(el, uid, ev) {
    if (screen !== "duel" || !state || state.result || actor() !== 0) return;
    const card = view().cards[uid];
    if (!card || card.owner !== 0) return;
    const ghost = el.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.style.width = `${el.getBoundingClientRect().width}px`;
    ghost.style.height = `${el.getBoundingClientRect().height}px`;
    ghost.style.left = `${ev.clientX - 24}px`;
    ghost.style.top = `${ev.clientY - 24}px`;
    document.body.append(ghost);
    el.classList.add("dragging");
    el.dataset.skipClick = "1";
    drag = { uid, ghost, el };
    moveDrag(ev);
  }
  function moveDrag(ev) {
    if (!drag?.ghost) return;
    drag.ghost.style.left = `${ev.clientX - 24}px`;
    drag.ghost.style.top = `${ev.clientY - 24}px`;
  }
  function endDrag(cancel) {
    if (!drag) return;
    const { uid, ghost, el } = drag;
    ghost?.remove();
    el?.classList.remove("dragging");
    const x = cancel?.clientX,
      y = cancel?.clientY;
    drag = null;
    if (cancel === true || x == null) return;
    const hit = document.elementFromPoint(x, y);
    const zone = hit?.closest?.("[data-zone]");
    const targetCard = hit?.closest?.("[data-card]");
    const list = actions().filter((a) => a.card === uid);
    let match = null;
    if (zone) {
      const [, row, slot] = zone.dataset.zone.split("-");
      const n = Number(slot);
      match = list.find(
        (a) =>
          a.slot === n &&
          (row === "units" ? ["summon", "set-unit"].includes(a.type) : a.type === "set-support"),
      );
    }
    if (!match && targetCard?.dataset.card) {
      match = list.find((a) => a.target === targetCard.dataset.card);
    }
    if (match) playAction(match);
    else if (list.length) {
      notice = t("notLegal");
      render();
    }
  }
  function bindCardChrome(el, uid, card, onClick) {
    el.addEventListener("click", (e) => {
      if (el.dataset.skipClick === "1") {
        el.dataset.skipClick = "";
        e.preventDefault();
        return;
      }
      onClick(e);
    });
    el.addEventListener("dblclick", (e) => {
      e.preventDefault();
      if (screen === "archive" && card?.id) archiveInspect(card);
      else inspect(uid);
    });
    el.addEventListener("pointerenter", () => {
      if (window.matchMedia("(hover: hover)").matches && screen === "duel") {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => previewInspect(uid), 280);
      }
    });
    el.addEventListener("pointerleave", () => clearTimeout(hoverTimer));
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const start = { x: e.clientX, y: e.clientY };
      pressTimer = setTimeout(() => {
        if (screen === "archive" && card?.id) archiveInspect(card);
        else inspect(uid);
        el.dataset.skipClick = "1";
      }, 480);
      const move = (ev) => {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 10) return;
        clearTimeout(pressTimer);
        if (!drag) beginDrag(el, uid, ev);
        else moveDrag(ev);
      };
      const up = (ev) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        clearTimeout(pressTimer);
        if (drag) endDrag(ev);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }
  function selectCard(uid) {
    selected = uid;
    render();
    if (innerWidth <= 760) inspect(uid);
  }
  function actionTitle(action, v = view()) {
    let title = cardActionTitle(action, v.cards[action.card], v, theme, lang, t(action.type));
    if (action.target !== undefined)
      title += ` · ${action.target ? cname(action.target, v) : t("direct")}`;
    if (action.enabler) title += ` · ${t("ritual")}: ${cname(action.enabler, v)}`;
    if (action.slot !== undefined) title += ` · ${t("zone")} ${action.slot + 1}`;
    const materials = action.tributes || action.materials;
    if (materials?.length)
      title += ` · ${t(action.tributes ? "tributes" : "materials")}: ${joinText(materials.map((id) => cname(id, v)))}`;
    if (action.targets?.length) title += ` · ${joinText(action.targets.map((id) => cname(id, v)))}`;
    if (action.option) title += ` · ${optionName(action.option)}`;
    return title;
  }
  function optionName(id) {
    const option = state?.choice?.options?.find((o) => o.id === id);
    if (option?.card)
      return `${cname(option.card)}${option.materials?.length ? ` · ${t("materials")}: ${joinText(option.materials.map((uid) => cname(uid)))}` : ""}`;
    if (id.startsWith("zone-")) return `${t("zone")} ${id.slice(5)}`;
    const cost = option?.effects?.find((op) => op.op === "points" && op.amount < 0)?.amount;
    return (
      {
        pay: `${lang === "tr" ? "Puan öde" : "Pay points"}${cost ? ` · ${-cost} ${point}` : ""}`,
        keep: lang === "tr" ? "Tut" : "Keep",
        destroy: lang === "tr" ? "Yok et" : "Destroy",
        discard: t("discard"),
        tribute: t("tributes"),
        set: t("set-support"),
        accept: t("confirm"),
      }[id] || t("choose")
    );
  }
  function selectAction(list) {
    if (!list.length) {
      notice = t("noActions");
      close();
      render();
      return;
    }
    if (list.length === 1) {
      confirmAction(list[0]);
      return;
    }
    let page = 0;
    function choices() {
      show(t("action"), [
        $(
          "div",
          { class: "choice-list" },
          ...list
            .slice(page * 12, page * 12 + 12)
            .map((a) => button(actionTitle(a), () => confirmAction(a))),
        ),
        $(
          "div",
          { class: "dialog-actions" },
          button(
            t("previous"),
            () => {
              page--;
              choices();
            },
            { disabled: page === 0 },
          ),
          button(
            t("next"),
            () => {
              page++;
              choices();
            },
            { disabled: (page + 1) * 12 >= list.length },
          ),
        ),
      ]);
    }
    choices();
  }
  function playAction(action) {
    close();
    if (action.type === "surrender") {
      ask(t("surrenderAsk"), () => command(action));
      return;
    }
    command(action);
  }
  function confirmAction(action) {
    playAction(action);
  }
  function inspectBody(uid, v = view()) {
    const card = v.cards[uid];
    if (!card) return [$("p", {}, t("hidden"))];
    const available = actions().filter((a) => a.card === uid),
      groups = [...new Set(available.map((a) => a.type))];
    const timingHint = card.hint && card.kind !== "unit";
    const body = [
      $("h2", { class: "inspect-name" }, text(card.name) || t("hidden")),
      cardEl({ ...card, face: card.name ? "up" : card.face }, uid, null),
      card.name
        ? $("small", {}, detailLine([plain(card.id), joinText(card.series, " / "), t(card.kind)]))
        : null,
      card.text
        ? $("h3", {}, lang === "tr" ? "Bu Kart Ne Yapar?" : "What Does This Card Do?")
        : null,
      card.text ? $("p", { class: "effect-text" }, text(card.text)) : null,
      timingHint
        ? $("h3", {}, lang === "tr" ? "Ne Zaman Kullanılır?" : "When Can You Use It?")
        : null,
      card.hint ? $("small", {}, text(card.hint)) : null,
      card.used?.activate === v.turn
        ? $(
            "p",
            { class: "used-state" },
            lang === "tr" ? "Etki bu tur kullanıldı." : "Effect used this turn.",
          )
        : null,
      card.used?.duelActivated && card.traits?.oncePerDuel
        ? $(
            "p",
            { class: "used-state" },
            lang === "tr" ? "Düelloluk hak kullanıldı." : "Once-per-duel use spent.",
          )
        : null,
      available.some((a) => a.type === "respond")
        ? $(
            "p",
            { class: "used-state" },
            lang === "tr" ? "↩ Cevap vermeye hazır." : "↩ Ready to respond.",
          )
        : null,
      card.attacksUsed > 0
        ? $(
            "p",
            { class: "used-state" },
            lang === "tr"
              ? `Bu tur ${card.attacksUsed} saldırı yaptı.`
              : `${card.attacksUsed} attack(s) made this turn.`,
          )
        : null,
      card.kind === "unit" &&
      Number.isFinite(card.baseAttack) &&
      (card.attack !== card.baseAttack || card.defense !== card.baseDefense)
        ? $(
            "p",
            { class: "stat-change" },
            `${lang === "tr" ? "Temel → Güncel" : "Base → Current"}: ATK ${card.baseAttack} → ${card.attack} · DEF ${card.baseDefense} → ${card.defense}`,
          )
        : null,
      card.rulesNote ? $("small", {}, text(card.rulesNote)) : null,
      // With no legal move the "Neden Kullanamıyorum?" block below carries the
      // explanation, so an empty heading would just be a dead row.
      groups.length ? $("h3", {}, t("action")) : null,
      $(
        "div",
        { class: "inspector-actions" },
        ...groups.map((type) =>
          button(
            cardActionTitle(
              available.find((a) => a.type === type),
              card,
              v,
              theme,
              lang,
              t(type),
            ),
            () => selectAction(available.filter((a) => a.type === type)),
            {
              class: "primary",
            },
          ),
        ),
      ),
    ];
    const blockedTypes =
      card.name && card.owner === 0
        ? (card.kind === "unit"
            ? card.zone === "hand"
              ? ["summon", "set-unit", ...(card.effects?.length ? ["activate"] : [])]
              : card.zone === "units"
                ? ["position", "attack", ...(card.effects?.length ? ["activate"] : [])]
                : []
            : card.zone === "hand"
              ? ["activate", card.subtype === "field" ? "set-field" : "set-support"]
              : card.face === "down"
                ? ["activate"]
                : []
          ).filter((type) => !groups.includes(type))
        : [];
    if (!available.length || blockedTypes.length)
      body.push($("h3", {}, lang === "tr" ? "Neden Kullanamıyorum?" : "Why Can't I Use This?"));
    // The generic line only earns its place when there is no specific reason
    // below it; with blocked actions listed it is just noise before the detail.
    if (!available.length && !blockedTypes.length)
      body.push(
        $(
          "p",
          {},
          card.name && card.owner === 1
            ? lang === "tr"
              ? "Bu kart rakibin; onun kartlarıyla hamle yapamazsın."
              : "This is the opponent's card; you cannot act with it."
            : t("noActions"),
        ),
      );
    const blocked = blockedTypes.map((type) => ({
      name: blockedLabel(type, card, v),
      why: whyBlocked(
        rejection(state, {
          type,
          player: 0,
          revision: state.revision,
          card: uid,
          slot: 0,
          target: null,
          tributes: [],
        }),
        card,
      ),
    }));
    // One shared blocker — usually the phase — is one sentence, not the same
    // sentence repeated under every action name.
    const shared = blocked.length > 1 && new Set(blocked.map((row) => row.why)).size === 1;
    const rows = shared
      ? [
          {
            name: joinText(
              blocked.map((row) => row.name),
              " · ",
            ),
            why: blocked[0].why,
          },
        ]
      : blocked;
    for (const row of rows)
      body.push(
        $(
          "div",
          { class: "blocked-action" },
          $("strong", { class: "blocked-action-name" }, row.name),
          $("small", { class: "blocked-action-why" }, row.why),
        ),
      );
    const related = card.name ? relatedCards(card, pool, 4) : [];
    body.push(
      ...relatedBlock(
        $,
        t,
        lang,
        related,
        (other) => {
          // Following a combo is a step down, so `Geri` returns to the card
          // the player was reading rather than dismissing the inspector.
          const here = () => inspect(uid);
          const live = Object.values(view().cards).find((c) => c.id === other.id && c.name);
          if (live) inspect(live.uid, here);
          else archiveInspect(other, here);
        },
        theme,
      ),
    );
    return body;
  }
  function inspect(uid, onBack = null) {
    show(t("inspector"), inspectBody(uid), "inspector-sheet", onBack);
  }
  function pile(player, key, v) {
    if (key === "deck") return;
    const ids =
      key === "auxiliary"
        ? Object.values(v.cards)
            .filter((c) => c.owner === player && c.zone === "auxiliary")
            .map((c) => c.uid)
        : key === "field"
          ? [v.players[player].field].filter(Boolean)
          : v.players[player][key];
    show(
      t(key),
      ids?.length
        ? ids.map((uid) => button(cname(uid, v), () => inspect(uid, () => pile(player, key, v))))
        : $("p", {}, t("empty")),
    );
  }
  function playerField(player, v) {
    const p = v.players[player],
      isPlayer = player === 0;
    const rows = ["units", "support"].map((row) =>
      $(
        "div",
        { class: `zones ${row === "support" ? "support-row" : ""}` },
        ...p[row].map((uid, slot) => {
          const legal =
            isPlayer &&
            selected &&
            actions().some(
              (a) =>
                a.card === selected &&
                a.slot === slot &&
                (row === "units"
                  ? ["summon", "set-unit"].includes(a.type)
                  : a.type === "set-support"),
            );
          return $(
            "div",
            {
              class: `zone ${legal || (uid && selected && actions().some((a) => a.card === selected && a.target === uid)) ? "legal valid-target" : ""}`,
              "data-zone": `${player}-${row}-${slot}`,
            },
            uid
              ? cardEl(v.cards[uid], uid, () => {
                  const attacks = selected
                    ? actions().filter((a) => a.card === selected && a.target === uid)
                    : [];
                  if (attacks.length) selectAction(attacks);
                  else selectCard(uid);
                })
              : button(
                  `${t(row === "units" ? "unit" : "support")} ${slot + 1}`,
                  () => {
                    if (legal)
                      selectAction(
                        actions().filter(
                          (a) =>
                            a.card === selected &&
                            a.slot === slot &&
                            (row === "units"
                              ? ["summon", "set-unit"].includes(a.type)
                              : a.type === "set-support"),
                        ),
                      );
                  },
                  {
                    class: "empty-zone",
                    disabled: !legal,
                    "aria-label": `${t("empty")} · ${t(row === "units" ? "unit" : "support")} ${slot + 1}`,
                  },
                ),
          );
        }),
      ),
    );
    const changed = lastPoints && lastPoints[player] !== p.points;
    return $(
      "section",
      {
        class: `player-field ${isPlayer ? "player" : "opponent"}`,
        "aria-label": t(isPlayer ? "you" : "opponent"),
      },
      $(
        "div",
        { class: "player-meter" },
        $(
          "span",
          {},
          lang === "tr"
            ? `${t(isPlayer ? "hand" : "opponentHand")} · ${p.handCount} Kart`
            : `${t(isPlayer ? "you" : "opponent")} · ${t(isPlayer ? "hand" : "opponentHand")} ${p.handCount}`,
        ),
        $(
          "strong",
          { class: changed ? "damage" : "" },
          `${p.points.toLocaleString(lang)} ${point}`,
        ),
      ),
      ...(isPlayer ? rows.slice().reverse() : rows),
      $(
        "div",
        { class: "piles" },
        $("span", { "data-pile": `${player}:deck` }, `${t("deck")} · ${p.deckCount}`),
        ...["auxiliary", "grave", "banished", "field"].map((key) =>
          button(
            `${t(key)} · ${key === "auxiliary" ? p.auxiliaryCount : key === "field" ? (p.field ? 1 : 0) : p[key].length}`,
            () => pile(player, key, v),
            { disabled: key === "auxiliary" && player === 1, "data-pile": `${player}:${key}` },
          ),
        ),
      ),
    );
  }
  const phaseFullName = {
    draw: lang === "tr" ? "Kart Çekme Aşaması" : "Draw Phase",
    standby: lang === "tr" ? "Hazırlık Aşaması" : "Standby Phase",
    main1: lang === "tr" ? "Hamle Aşaması" : "Main Phase",
    battle: lang === "tr" ? `${meta.labels.tr.battle} Aşaması` : t("battle"),
    main2: lang === "tr" ? "Hamle Aşaması" : "Main Phase",
    end: lang === "tr" ? "Tur Sonu" : "End Phase",
  };
  function logLine(e, v) {
    const who = t(e.player === 0 ? "you" : "opponent");
    if (e.event === "battle") {
      const atkName = cname(e.attacker, v),
        iAttacked = e.player === 0;
      if (lang !== "tr")
        return `${who} attacked with “${atkName}”: ${joinText(e.damage, " / ")} ${point}.`;
      if (e.damage[1] > 0)
        return iAttacked
          ? `“${atkName}” rakibine ${e.damage[1]} ${point} hasar verdi.`
          : `Rakibin “${atkName}” kartı sana ${e.damage[1]} ${point} hasar verdi.`;
      if (e.damage[0] > 0)
        return iAttacked
          ? `“${atkName}” ile saldırırken ${e.damage[0]} ${point} kaybettin.`
          : `Rakip “${atkName}” ile saldırırken ${e.damage[0]} ${point} kaybetti.`;
      return iAttacked ? `“${atkName}” ile saldırdın.` : `Rakip “${atkName}” ile saldırdı.`;
    }
    if (e.event === "draw")
      return lang === "tr"
        ? e.player === 0
          ? `${e.count} kart çektin.`
          : `Rakip ${e.count} kart çekti.`
        : `${who} drew ${e.count} card(s).`;
    if (e.event === "move") {
      const told = moveStory(e, storyCtx(e, v));
      if (told) return detailLine([told.head, told.why, told.note], " ");
      return `${who}: ${cname(e.uid, v)} → ${t(e.to === "hand" ? "hand" : e.to === "units" ? "unit" : e.to)}`;
    }
    if (e.event === "phase") {
      const label = phaseFullName[e.phase] || t(e.phase);
      return lang === "tr"
        ? e.player === 0
          ? `${label}’na geçtin.`
          : `Rakip ${label}’na geçti.`
        : `${who} moved to the ${label}.`;
    }
    if (e.event === "result") return t("finished");
    if (e.event === "targets-unavailable") return t("targetsUnavailable");
    if (e.event === "start") return lang === "tr" ? "Düello başladı." : "The duel began.";
    // Everything else used to collapse into a bare "Rakip: Etki", which is how
    // cards came to vanish with no explanation.
    const story = eventStory(e, storyCtx(e, v));
    if (story) return story;
    return `${who}: ${t(e.event === "look" ? "select" : e.event === "reveal" ? "effect" : e.event === "token" ? "summon" : "effect")}`;
  }
  /**
   * First-duel coach marks. One note at a time, anchored beside the thing it
   * describes, never covering it and never blocking a click.
   */
  let coachStep = 0,
    coachOn = false,
    startFirstDuelCoach = false;
  function startCoach(force = false) {
    if (!force && onboardingSeen(storage, theme)) return;
    coachStep = 0;
    coachOn = true;
    render();
  }
  function endCoach() {
    coachOn = false;
    markOnboardingSeen(storage, theme);
    render();
  }
  function coachMark() {
    if (!coachOn || screen !== "duel") return null;
    const steps = onboardingSteps(theme, lang, {
      unit: t("unit"),
      battle: t("battle"),
    });
    const step = steps[coachStep];
    if (!step) return null;
    const host = root.querySelector(step.anchor);
    const box = host?.getBoundingClientRect();
    const note = $(
      "div",
      {
        class: "coach-mark",
        role: "dialog",
        "aria-live": "polite",
        "aria-label": step.title,
        "data-step": step.id,
      },
      $("p", { class: "coach-step" }, `${coachStep + 1} / ${steps.length}`),
      $("h3", {}, step.title),
      $("p", { class: "coach-body" }, step.body),
      $(
        "div",
        { class: "coach-actions" },
        button(lang === "tr" ? "Geç" : "Skip", endCoach, {
          class: "ghost",
          "data-pick": "coach-skip",
        }),
        button(
          coachStep + 1 < steps.length
            ? lang === "tr"
              ? "Devam"
              : "Next"
            : lang === "tr"
              ? "Başla"
              : "Play",
          () => {
            coachStep += 1;
            if (coachStep >= steps.length) endCoach();
            else render();
          },
          { class: "primary", "data-pick": "coach-next" },
        ),
      ),
    );
    if (box) host.classList.add("coach-target");
    // Placed after it is in the document so its real height is known: guessing
    // the height ran the note off the bottom of a 390px-wide phone.
    note.placeBeside = () => {
      if (!box) return;
      const self = note.getBoundingClientRect();
      const gap = 8;
      const fitsBelow = box.bottom + gap + self.height <= innerHeight - gap;
      const top = fitsBelow ? box.bottom + gap : box.top - gap - self.height;
      note.style.top = `${Math.min(Math.max(gap, top), Math.max(gap, innerHeight - self.height - gap))}px`;
      note.style.left = `${Math.min(Math.max(gap, box.left), Math.max(gap, innerWidth - self.width - gap))}px`;
    };
    return note;
  }
  /** Everything flow-copy.js needs to word one event. */
  function storyCtx(e, v) {
    const uid = e.uid ?? e.attacker ?? e.card ?? (e.cards || [])[0];
    return {
      lang,
      point,
      you: t("you"),
      foe: t("opponent"),
      mine: e.player === 0,
      name: uid ? cname(uid, v) : "",
      words: flowWords(theme, lang),
    };
  }
  function board() {
    const v = view(),
      approved = actions(),
      phase = approved.find((a) => a.type === "phase"),
      pass = approved.find((a) => a.type === "pass");
    const logBody = $("div", { class: "turn-history" });
    let group, lastTurn;
    for (const event of v.log.slice(-40).reverse()) {
      if (lastTurn !== event.turn) {
        lastTurn = event.turn;
        group = $("section", { class: "turn-group" }, $("h3", {}, `${t("turn")} ${lastTurn ?? 0}`));
        logBody.append(group);
      }
      group.append(
        $(
          "p",
          { class: "history-event" },
          $(
            "strong",
            { class: "history-actor" },
            event.player === 0 ? t("you") : event.player === 1 ? t("opponent") : name,
          ),
          $("span", {}, logLine(event, v)),
        ),
      );
    }
    const status = v.result
      ? t(v.result.winner === null ? "tie" : v.result.winner === 0 ? "win" : "lose")
      : actor() === 1
        ? t("thinking")
        : v.choice
          ? t("choice")
          : v.pending
            ? t("response")
            : t("yourMove");
    const content = $(
      "main",
      { class: `duel-layout ${historyOpen ? "history-open" : ""}` },
      $("aside", { class: "panel ledger" }, $("h2", { class: "panel-title" }, t("log")), logBody),
      $(
        "section",
        { class: "table-workspace" },
        $(
          "div",
          {
            class: `duel-table ${v.log.at(-1)?.event === "battle" && lastRevision !== v.revision ? "battle-feedback" : ""}`,
          },
          playerField(1, v),
          $(
            "nav",
            {
              class: "phase-strip",
              "aria-label": lang === "tr" ? "Düello Aşamaları" : "Duel Phases",
            },
            ...PHASES.map((p) =>
              $(
                "span",
                {
                  class: p === v.phase ? "current" : "",
                  "aria-current": p === v.phase ? "step" : null,
                },
                t(p),
              ),
            ),
          ),
          playerField(0, v),
        ),
        $(
          "section",
          { class: "hand-deck" },
          $(
            "div",
            { class: "hand-heading" },
            $("span", { class: "eyebrow" }, `${t("hand")} · ${v.players[0].handCount}`),
            $(
              "span",
              { class: "match-identity" },
              deckCopy(theme, telemetry?.identity || chosenDeckId(), lang).name,
            ),
          ),
          $(
            "div",
            { class: "hand-row" },
            ...v.players[0].hand.map((uid) => cardEl(v.cards[uid], uid, () => selectCard(uid))),
          ),
        ),
        $(
          "div",
          { class: "action-dock" },
          $("p", { "aria-live": "polite" }, `${t("turn")} ${v.turn} · ${status}`),
          phase
            ? button(primaryTitle(v, theme, lang), () => command(phase), { class: "primary" })
            : null,
          pass ? button(t("pass"), () => command(pass)) : null,
          approved.some((a) => a.type === "end-main") &&
            (!phase || primaryTitle(v, theme, lang) !== t("end-main"))
            ? button(t("end-main"), () =>
                confirmAction(approved.find((a) => a.type === "end-main")),
              )
            : null,
          v.choice && actor() === 0
            ? button(t("choose"), () => selectAction(approved), { class: "primary" })
            : null,
          selected
            ? button(t("inspector"), () => inspect(selected), { class: "mobile-inspect" })
            : null,
          button(
            t("log"),
            () => {
              if (window.matchMedia("(min-width: 1024px)").matches) {
                historyOpen = !historyOpen;
                render();
              } else show(t("log"), logBody.cloneNode(true), "history-dialog");
            },
            { "aria-expanded": historyOpen },
          ),
          button(t("actionHistory"), openHistory),
          !v.result
            ? button(
                t("surrender"),
                () =>
                  ask(t("surrenderAsk"), () =>
                    command({ type: "surrender", player: 0, revision: state.revision }),
                  ),
                { class: "danger" },
              )
            : button(t("menu"), () => {
                screen = "menu";
                render();
              }),
        ),
      ),
      $(
        "aside",
        { class: "panel inspector" },
        $("h2", { class: "panel-title" }, t("inspector")),
        $(
          "div",
          { class: "inspector-body" },
          selected
            ? inspectBody(selected, v)
            : [
                $("p", {}, t("select")),
                $(
                  "small",
                  {},
                  lang === "tr"
                    ? "Elinden veya sahadan bir karta dokun. Ayrıntılar ve yasal işlemler burada görünür."
                    : "Tap a card in your hand or on the field. Its details and legal actions appear here.",
                ),
              ],
        ),
      ),
    );
    lastPoints = v.players.map((p) => p.points);
    lastRevision = v.revision;
    return content;
  }
  function archiveInspect(card, onBack = null, showAllCombos = false) {
    show(
      text(card.name),
      [
        cardEl(card, card.id, null),
        $("small", {}, detailLine([plain(card.id), t(card.kind), joinText(card.series, " / ")])),
        $("p", { class: "effect-text" }, text(card.text)),
        card.hint ? $("small", {}, text(card.hint)) : null,
        card.attacksUsed > 0
          ? $(
              "p",
              { class: "used-state" },
              lang === "tr"
                ? `Bu tur ${card.attacksUsed} saldırı yaptı.`
                : `${card.attacksUsed} attack(s) made this turn.`,
            )
          : null,
        card.kind === "unit" &&
        Number.isFinite(card.baseAttack) &&
        (card.attack !== card.baseAttack || card.defense !== card.baseDefense)
          ? $(
              "p",
              { class: "stat-change" },
              `${lang === "tr" ? "Temel → Güncel" : "Base → Current"}: ATK ${card.baseAttack} → ${card.attack} · DEF ${card.baseDefense} → ${card.defense}`,
            )
          : null,
        card.rulesNote ? $("small", {}, text(card.rulesNote)) : null,
        ...relatedBlock(
          $,
          t,
          lang,
          relatedCards(card, pool, showAllCombos ? 12 : 4),
          // Following a combo is a step down, so `Geri` comes back to this
          // card rather than skipping to whatever opened it.
          (next) => archiveInspect(next, () => archiveInspect(card, onBack, showAllCombos)),
          theme,
          showAllCombos ? null : () => archiveInspect(card, onBack, true),
        ),
        onBack
          ? $(
              "div",
              { class: "dialog-actions" },
              $("button", { type: "button", "data-pick": "card-back", onclick: onBack }, t("up")),
            )
          : null,
      ],
      "inspector-sheet",
      onBack,
    );
  }
  function archiveTabs() {
    const tab = (id, label) =>
      $(
        "button",
        {
          type: "button",
          "aria-pressed": archiveTab === id,
          "data-pick": `archive-tab-${id}`,
          onclick: () => {
            archiveTab = id;
            render();
          },
        },
        label,
      );
    return $(
      "div",
      { class: "archive-tabs" },
      tab("cards", lang === "tr" ? "TÜM KARTLAR" : "ALL CARDS"),
      tab("decks", lang === "tr" ? "DESTELER" : "DECKS"),
    );
  }
  function archiveDecks() {
    if (!decks.length)
      return $(
        "main",
        { class: "archive" },
        $("div", { class: "archive-head" }, $("h1", {}, t("archive"))),
        archiveTabs(),
        $("p", {}, lang === "tr" ? "Deste listesi yüklenemedi." : "Deck list unavailable."),
      );
    const preset = findPreset(decks, archiveDeckId) || decks[0];
    archiveDeckId = preset.id;
    const copy = deckCopy(theme, preset.id, lang);
    const counts = deckBreakdown(preset, pool);
    const total = presetCardIds(preset).length;
    return $(
      "main",
      { class: "archive" },
      $(
        "div",
        { class: "archive-head" },
        $("h1", {}, t("archive")),
        $("span", {}, `${decks.length} ${lang === "tr" ? "deste" : "decks"}`),
      ),
      archiveTabs(),
      $(
        "div",
        { class: "identity-grid" },
        ...decks.map((deck) => {
          const row = deckCopy(theme, deck.id, lang);
          return $(
            "button",
            {
              type: "button",
              class: "choice-chip",
              "aria-pressed": deck.id === preset.id,
              "data-pick": `archive-deck-${deck.id}`,
              onclick: () => {
                archiveDeckId = deck.id;
                render();
              },
            },
            $("strong", {}, row.name),
            $("small", {}, row.blurb),
          );
        }),
      ),
      $(
        "section",
        { class: "deck-preview" },
        $(
          "div",
          { class: "deck-browser-head" },
          $("h2", {}, copy.name),
          $(
            "span",
            { class: "deck-card-meta" },
            `${total} ${lang === "tr" ? "kart" : "cards"} · ${counts.unit} ${
              lang === "tr" ? "birim" : "units"
            } · ${counts.spell} ${lang === "tr" ? "büyü" : "spells"} · ${counts.trap} ${
              lang === "tr" ? "tuzak" : "traps"
            }`,
          ),
        ),
        $("p", { class: "deck-browser-blurb" }, copy.blurb),
        ...deckListBody($, lang, preset, pool, (card) => archiveInspect(card)),
      ),
    );
  }
  function archive() {
    if (archiveTab === "decks") return archiveDecks();
    const filtered = pool.filter(
      (c) =>
        (!archiveQuery ||
          `${text(c.name)} ${text(c.text)} ${c.id}`
            .toLocaleLowerCase(lang)
            .includes(archiveQuery.toLocaleLowerCase(lang))) &&
        (!archiveKind || c.kind === archiveKind) &&
        (!archiveSeries || c.series.includes(archiveSeries)) &&
        (!archiveLevel || String(c.level) === archiveLevel) &&
        (!archiveSubtype || c.subtype === archiveSubtype) &&
        (!archiveLocation || c.deckLocation === archiveLocation) &&
        (!archiveStat ||
          (c.kind === "unit" &&
            (archiveStat === "low"
              ? c.attack < 1500
              : archiveStat === "mid"
                ? c.attack >= 1500 && c.attack < 2500
                : c.attack >= 2500))),
    );
    const perPage = 24;
    archivePage = Math.min(archivePage, Math.max(0, Math.ceil(filtered.length / perPage) - 1));
    const select = (key, value, options, onChange) =>
      $(
        "select",
        {
          "aria-label": t(key),
          onchange: (e) => {
            onChange(e.target.value);
            archivePage = 0;
            render();
          },
        },
        $("option", { value: "" }, `${t(key)} · ${t("all")}`),
        ...options.map(([id, label]) => $("option", { value: id, selected: id === value }, label)),
      );
    return $(
      "main",
      { class: "archive" },
      $(
        "div",
        { class: "archive-head" },
        $("h1", {}, t("archive")),
        $("span", {}, `${filtered.length} / ${pool.length}`),
      ),
      archiveTabs(),
      $(
        "div",
        { class: "filters" },
        $("input", {
          type: "search",
          placeholder: t("search"),
          "aria-label": t("search"),
          value: archiveQuery,
          oninput: (e) => {
            archiveQuery = e.target.value;
            archivePage = 0;
            const cursor = e.target.selectionStart;
            render();
            const input = root.querySelector("input");
            input.focus();
            input.setSelectionRange(cursor, cursor);
          },
        }),
        select(
          "all",
          archiveKind,
          ["unit", "spell", "trap"].map((k) => [k, t(k)]),
          (v) => (archiveKind = v),
        ),
        select(
          "series",
          archiveSeries,
          [...new Set(pool.flatMap((c) => c.series))].map((s) => [s, s]),
          (v) => (archiveSeries = v),
        ),
        select(
          "subtype",
          archiveSubtype,
          [...new Set(pool.map((c) => c.subtype))].map((k) => [k, t(k)]),
          (v) => (archiveSubtype = v),
        ),
        select(
          "deckLocation",
          archiveLocation,
          [
            ["main", t("mainDeck")],
            ["auxiliary", t("auxiliary")],
          ],
          (v) => (archiveLocation = v),
        ),
        select(
          "statRange",
          archiveStat,
          [
            ["low", "ATK < 1500"],
            ["mid", "ATK 1500–2499"],
            ["high", "ATK ≥ 2500"],
          ],
          (v) => (archiveStat = v),
        ),
        select(
          "level",
          archiveLevel,
          [...new Set(pool.filter((c) => c.kind === "unit").map((c) => c.level))]
            .sort((a, b) => a - b)
            .map((n) => [String(n), String(n)]),
          (v) => (archiveLevel = v),
        ),
      ),
      $(
        "div",
        { class: "archive-grid" },
        ...filtered
          .slice(archivePage * perPage, (archivePage + 1) * perPage)
          .map((c) => cardEl(c, c.id, () => archiveInspect(c))),
      ),
      $(
        "nav",
        { class: "pagination" },
        button(
          t("previous"),
          () => {
            archivePage--;
            render();
          },
          { disabled: archivePage === 0 },
        ),
        $(
          "span",
          {},
          `${t("page")} ${archivePage + 1} / ${Math.max(1, Math.ceil(filtered.length / perPage))}`,
        ),
        button(
          t("next"),
          () => {
            archivePage++;
            render();
          },
          { disabled: (archivePage + 1) * perPage >= filtered.length },
        ),
      ),
    );
  }
  try {
    const response = await fetch(`/games/${theme}/source-cards.json`);
    if (!response.ok) throw Error(String(response.status));
    pool = buildCards(await response.json(), designs, theme);
    decks = await loadDeckPresets();
    saved = loadDuel(storage, pool, theme);
    if (saved.recovered) notice = t("recovered");
    else if (!saved.ok && saved.error !== "no-save") notice = displayError(saved.error);
    render();
  } catch (error) {
    root.removeAttribute("aria-busy");
    root.replaceChildren(
      $(
        "main",
        { class: "menu-stage" },
        $(
          "section",
          { class: "front" },
          $("h1", {}, name),
          $("p", {}, t("loadError")),
          button(t("retry"), () => location.reload()),
          $("a", { href: "/", target: "_top" }, t("back")),
        ),
      ),
    );
    console.error(error);
  }
  return { getScreen: () => screen, getState: () => state };
}
