import { ARCHETYPE_IDS, ARCHETYPES, DESKS } from "./decks.js";
import { applyAction, canPlay, cardOf, createMatch, legalActions, publicView } from "./engine.js";
import { AI_PROFILES, chooseAction } from "./ai.js";
import { COPY, HELP, fx, labelDesk } from "./copy.js";
import { clearSlot, deserialize, loadSlot, saveSlot, serialize, slotSummary } from "./save.js";
import { endReport } from "./report.js";
import { mulberry } from "./rng.js";
import { changes, deskProgress, previewAction, snapshot, suggestedAction } from "./briefing.js";

const root = document.querySelector("#app");
const storage = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v),
  removeItem: (k) => localStorage.removeItem(k),
};

const renderable = (children) =>
  [children]
    .flat(Infinity)
    .filter((child) => child instanceof Node || typeof child === "string" || typeof child === "number")
    .map((child) => (child instanceof Node ? child : document.createTextNode(String(child))));

function $(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") el.className = value;
    else if (key === "html") el.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
    else if (key.startsWith("aria-")) el.setAttribute(key, String(value));
    else if (value === false || value == null) continue;
    else if (key.startsWith("data-")) el.setAttribute(key, String(value));
    else if (key === "disabled" || key === "selected") {
      if (value) el.setAttribute(key, "");
    } else el.setAttribute(key, value === true ? "" : String(value));
  }
  el.append(...renderable(children));
  return el;
}

function readLang() {
  try {
    return localStorage.getItem("tariklab.language") === "en" ? "en" : "tr";
  } catch {
    return "tr";
  }
}

let lang = readLang();
let screen = "menu";
let state = null;
let selected = null;
let notice = "";
let helpOn = false;
let guided = false;
let feedback = null;
let replies = [];
let autosaveFailed = false;
const RESUME_KEY = "tariklab.ihtilal.v1.resume";
let setup = {
  you: "kalemci",
  opp: "hesapci",
  profile: "adaptive",
  seed: 1923,
  tutorial: false,
};
let busy = false;
let activeSlot = 1;
let aiTimer = null;
let aiGeneration = 0;
let modalReturnKey = null;
let renderedScreen = null;

const t = (key) => COPY[lang][key] || COPY.tr[key] || key;
const titleOf = (card) => (card?.title && (card.title[lang] || card.title.tr)) || "";
const flavorOf = (card) => (card?.flavor && (card.flavor[lang] || card.flavor.tr)) || "";

function stopAi() {
  aiGeneration += 1;
  if (aiTimer != null) clearTimeout(aiTimer);
  aiTimer = null;
  busy = false;
}

function goToMenu() {
  persistResume();
  stopAi();
  screen = "menu";
  render();
}

function persistResume() {
  if (!state) return;
  try {
    const raw = serialize(state);
    const previous = storage.getItem(RESUME_KEY);
    if (previous && deserialize(previous).ok) storage.setItem(`${RESUME_KEY}.backup`, previous);
    storage.setItem(RESUME_KEY, raw);
    autosaveFailed = false;
  }
  catch { autosaveFailed = true; }
}

function readResume() {
  try {
    const raw = storage.getItem(RESUME_KEY);
    const loaded = raw ? deserialize(raw) : null;
    if (loaded?.ok) return loaded;
    const backup = storage.getItem(`${RESUME_KEY}.backup`);
    const recovered = backup ? deserialize(backup) : null;
    return recovered?.ok ? { ...recovered, recovered: true } : loaded;
  }
  catch { return null; }
}

function resumeMatch() {
  const saved = readResume();
  if (!state && !saved?.ok) return;
  stopAi();
  if (!state) state = saved.state;
  notice = saved?.recovered ? t("recovered") : "";
  selected = null;
  feedback = null;
  replies = [];
  screen = state.result ? "report" : "play";
  render();
  pumpAi();
}

window.addEventListener("pagehide", persistResume);

window.addEventListener("storage", (event) => {
  if (event.key !== "tariklab.language") return;
  lang = readLang();
  notice = "";
  render();
});

const modalControls = (dialog) => [...dialog.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex='0']")];
const activeDialog = () => [...root.querySelectorAll('[role="dialog"]')].at(-1);

window.addEventListener("keydown", (event) => {
  const dialog = activeDialog();
  if (!dialog) return;
  if (event.key === "Escape") {
    event.preventDefault();
    if (dialog.getAttribute("data-modal") === "help") helpOn = false;
    else helpOn = false;
    render();
  } else if (event.key === "Tab") {
    const controls = modalControls(dialog);
    const first = controls[0] || dialog;
    const last = controls.at(-1) || dialog;
    const focused = document.activeElement;
    if (!controls.includes(focused) || (event.shiftKey ? focused === first : focused === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }
});

function saveControls() {
  return $("div", { class: "row" },
    $("label", {}, t("slotN"), $("select", {
      onchange: (event) => { activeSlot = Number(event.target.value); render(); },
    }, [1, 2, 3].map((n) => $("option", { value: n, selected: activeSlot === n }, `${t("slotN")} ${n}`)))),
    $("button", { class: "btn ghost", type: "button", onclick: () => saveCurrent(activeSlot) }, `${t("save")} ${activeSlot}`));
}

function topbar(extra) {
  // The TarikLab shell above this iframe already shows the back link, the
  // game title and the single TR/EN control; repeating all three during
  // actual play made the board feel like a second site header stacked on
  // the real one. When there is in-game-specific content (a menu button,
  // save-slot controls), show only that, trusting the outer shell for
  // navigation and language. At rest (no extra — the opening menu, which
  // still shows its own portal link so a direct load of this file's own
  // URL keeps a way out even without the outer shell) keep the plain
  // back link alone, dropping the redundant title and language button.
  if (extra) return $("header", { class: "topbar" }, $("div", { class: "row" }, extra));
  return $("header", { class: "topbar" }, $("a", { href: "/" }, t("back")));
}

function menu() {
  const resume = state || readResume()?.state;
  const slots = [1, 2, 3].map((n) => ({ n, summary: slotSummary(storage, n) }));
  return $(
    "div",
    { class: "shell" },
    topbar(),
    $(
      "main",
      { class: "menu" },
      $("p", { class: "kicker" }, t("kicker")),
      $("h1", { class: "display" }, t("title")),
      $("p", { class: "tagline display" }, t("tagline")),
      $("p", { class: "pitch" }, t("identity")),
      $("div", { class: "menu-brief" },
        $("b", { class: "display" }, t("objective")),
        $("p", {}, t("lockRule")),
        $("p", {}, t("turnRule"))),
      $(
        "div",
        { class: "row" },
        resume ? $("button", { class: "btn primary", type: "button", onclick: resumeMatch }, `${t("continue")} · ${t("turn")} ${resume.turn}`) : null,
        $("button", { class: `btn${resume ? "" : " primary"}`, type: "button", onclick: () => { setup.tutorial = true; startMatch(); } }, t("tutorial")),
        $("button", { class: "btn", type: "button", onclick: () => { screen = "setup"; setup.tutorial = false; render(); } }, t("newGame")),
        $("button", { class: "btn ghost", type: "button", "data-focus-key": "help", onclick: () => { helpOn = true; render(); } }, t("how")),
      ),
      $("h2", { class: "display" }, t("slots")),
      notice ? $("p", { role: "status" }, notice) : null,
      $(
        "div",
        { class: "slots" },
        slots.map((slot) =>
          $(
            "div",
            { class: "slot" },
            $("span", {}, slot.summary
              ? `${t("slotN")} ${slot.n} · ${t("turn")} ${slot.summary.turn} · ${t("isi")} ${slot.summary.heat}`
              : `${t("slotN")} ${slot.n} · ${t("empty")}`),
            $(
              "div",
              { class: "row" },
              slot.summary
                ? $("button", { class: "btn", type: "button", onclick: () => openSlot(slot.n) }, t("load"))
                : null,
              slot.summary
                ? $("button", { class: "btn ghost", type: "button", onclick: () => {
                    if (!window.confirm(`${t("deleteConfirm")} ${slot.n}?`)) return;
                    const result = clearSlot(storage, slot.n);
                    notice = result.ok ? t("deleted") : t("saveFail");
                    render();
                  } }, t("deleteSave"))
                : null,
            ),
          ),
        ),
      ),
    ),
    helpOn ? helpSheet() : null,
  );
}

function archButton(id, current, onPick, owner) {
  const a = ARCHETYPES[id];
  return $(
    "button",
    { class: `arch${current === id ? " is-on" : ""}`, type: "button", "aria-pressed": current === id, "data-focus-key": `arch-${owner}-${id}`, onclick: () => onPick(id) },
    $("b", { class: "display" }, a.title[lang] || a.title.tr),
    $("small", {}, a.pitch[lang] || a.pitch.tr),
    $("small", {}, a.weakness[lang] || a.weakness.tr),
  );
}

function setupScreen() {
  return $(
    "div",
    { class: "shell" },
    topbar($("button", { class: "link", type: "button", onclick: goToMenu }, t("menu"))),
    $(
      "main",
      { class: "menu" },
      $("p", { class: "kicker" }, t("kicker")),
      $("h1", { class: "display" }, t("pickYou")),
      $("p", { class: "pitch" }, t("setupHint")),
      $("button", { class: "btn primary", type: "button", onclick: startMatch }, t("start")),
      $("div", { class: "arch-grid" }, ARCHETYPE_IDS.map((id) => archButton(id, setup.you, (v) => { setup.you = v; render(); }, "you"))),
      $("details", { class: "setup-details" },
      $("summary", {}, t("advanced")),
      $("h2", { class: "display" }, t("pickOpp")),
      $("div", { class: "arch-grid" }, ARCHETYPE_IDS.map((id) => archButton(id, setup.opp, (v) => { setup.opp = v; render(); }, "opp"))),
      $(
        "label",
        {},
        t("profile"),
        $(
          "select",
          { onchange: (e) => { setup.profile = e.target.value; } },
          AI_PROFILES.map((p) => $("option", { value: p, selected: p === setup.profile }, COPY[lang].profiles[p])),
        ),
      ),
      $(
        "label",
        {},
        t("seed"),
        $("input", { type: "number", value: String(setup.seed), min: "1", onchange: (e) => { setup.seed = Number(e.target.value) || 1923; } }),
      ),
      ),
    ),
  );
}

function startMatch() {
  stopAi();
  state = createMatch({
    seed: setup.seed,
    playerArchetype: setup.you,
    oppArchetype: setup.opp,
    first: 0,
    aiProfile: setup.profile,
  });
  selected = null;
  screen = "play";
  guided = setup.tutorial;
  feedback = null;
  replies = [];
  notice = "";
  persistResume();
  render();
  pumpAi();
}

function openSlot(n) {
  const loaded = loadSlot(storage, n);
  if (!loaded.ok) {
    notice = loaded.error === "foreign-save" ? t("foreign") : t("corrupt");
    render();
    return;
  }
  stopAi();
  state = loaded.state;
  feedback = null;
  replies = [];
  guided = false;
  activeSlot = n;
  selected = null;
  notice = loaded.recovered ? t("recovered") : "";
  screen = state.result ? "report" : "play";
  persistResume();
  render();
  pumpAi();
}

function saveCurrent(n) {
  if (!state) return;
  const result = saveSlot(storage, n, state);
  notice = result.ok ? t("saved") : t("saveFail");
  render();
}

function cardWhy(cardId, desk) {
  if (!state) return "";
  const actor = state.phase === "karsi" ? 0 : state.turnPlayer;
  const gate = canPlay(state, actor, cardId, desk);
  const key = {
    ink: "whyInk",
    seal: "whySeal",
    phase: "whyPhase",
    "wrong-desk": "whyDesk",
    desk: "whyDesk",
    "repeat-desk": "whyRepeat",
    once: "whyOnce",
    chain: "whyChain",
    "counter-window": "whyPhase",
    plays: "whyPhase",
    "not-in-hand": "whyPhase",
  }[gate.why];
  return key ? t(key) : "";
}

function playFile(cardId, desk) {
  if (busy || !state) return;
  const actor = state.phase === "karsi" ? 1 - state.turnPlayer : state.turnPlayer;
  if (actor !== 0) return;
  const type = state.phase === "karsi" ? "counter" : "play";
  const before = snapshot(state);
  const action = { type, cardId, desk };
  const result = applyAction(state, action);
  if (!result.ok) {
    notice = cardWhy(cardId, desk) || t("whyPhase");
    render();
    return;
  }
  feedback = makeFeedback(before, action, 0);
  replies = [];
  selected = null;
  notice = "";
  guided = false;
  afterHuman();
}

function humanPass(type) {
  if (busy || !state || (type === "end-kalem" ? state.turnPlayer !== 0 || state.phase !== "kalem" : state.turnPlayer !== 1 || state.phase !== "karsi")) return;
  const before = snapshot(state);
  if (!applyAction(state, { type }).ok) return;
  feedback = makeFeedback(before, { type }, 0);
  replies = [];
  selected = null;
  afterHuman();
}

function makeFeedback(before, action, actor) {
  return { actor, action, changes: changes(before, snapshot(state)), queued: state.archive.filter(row => !before.archive.some(prev => prev.id === row.id)).map(row => ({ cardId: row.cardId, due: row.due, desk: row.desk })) };
}

function afterHuman() {
  persistResume();
  if (state.result) {
    screen = "report";
    render();
    return;
  }
  render();
  pumpAi();
}

function pumpAi() {
  if (screen !== "play" || !state || state.result || busy) return;
  const match = state;
  const generation = aiGeneration;
  const aiActs = () => {
    if (state.phase === "karsi") return 1 - state.turnPlayer === 1;
    return state.turnPlayer === 1 && state.phase === "kalem";
  };
  if (!aiActs()) return;
  busy = true;
  const step = () => {
    // A queued callback belongs to this match and must not touch a new/load session.
    if (generation !== aiGeneration || state !== match || screen !== "play") return;
    aiTimer = null;
    if (!state || state.result || !aiActs()) {
      busy = false;
      if (state?.result) screen = "report";
      render();
      return;
    }
    const actor = state.phase === "karsi" ? 1 - state.turnPlayer : state.turnPlayer;
    const view = publicView(state, actor);
    const actions = legalActions(state, actor);
    const rng = mulberry((state.meta.seed + state.turn * 997 + state.log.length * 13 + actor) >>> 0);
    const pick = chooseAction(view, actions, state.aiProfile || setup.profile, rng) || actions[actions.length - 1];
    const before = snapshot(state);
    const result = applyAction(state, pick);
    if (result.ok) {
      replies = replies.concat(makeFeedback(before, pick, actor)).slice(-3);
      persistResume();
    }
    render();
    if (aiActs() && !state.result) {
      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      aiTimer = setTimeout(step, reduce ? 0 : 220);
    } else {
      busy = false;
      if (state.result) screen = "report";
      render();
    }
  };
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  aiTimer = setTimeout(step, reduce ? 0 : 180);
}

function logLine(row) {
  const card = row.c ? cardOf(row.c) : null;
  const name = card ? titleOf(card) : "";
  const who = row.a === 0 ? t("you") : t("opp");
  const desk = row.d ? labelDesk(row.d, lang !== "en") : "";
  if (row.k === "play") return `${who}: ${name}${desk ? " → " + desk : ""}`;
  if (row.k === "counter") return `${who}: ${name} (${t("typeKarsi")})`;
  if (row.k === "lock") return `${labelDesk(row.d, lang !== "en")} · ${t("locked")}`;
  if (row.k === "artci") return `${t("archive")}: ${name}`;
  if (row.k === "end") return t("phaseEnd");
  if (row.k === "chain") return lang === "en" ? "A chain closed." : "Bir zincir kapandı.";
  if (row.k === "family") return lang === "en" ? "Family claimed" : "Aile bağlandı";
  if (row.k === "lock-tenure") return `${who}: ${t("tenure")}`;
  if (row.k === "steal-lock") return `${who}: ${desk} · ${t("stolen")}`;
  if (row.k === "unlock") return `${who}: ${desk} · ${t("unlocked")}`;
  if (row.k === "repeat-heat") return `${who}: ${desk} · ${t("repeatHeat")}`;
  if (row.k === "reshuffle") return `${who}: ${t("reshuffled")}`;
  if (row.k === "artci-overflow") return `${who}: ${name} · ${t("archiveOverflow")}`;
  return `${who}: ${t("opened")}`;
}

function fileCard(id, on) {
  const card = cardOf(id);
  if (!card) return null;
  const playable = legalActions(state, 0).some(action => action.cardId === id);
  const type = { acik: "typeAcik", artci: "typeArtci", karsi: "typeKarsi", heyet: "typeHeyet", muhurluk: "typeMuhurluk" }[card.type];
  return $("button", {
    class: `file-card${on ? " is-on" : ""}${playable ? " is-playable" : " is-unavailable"}`,
    type: "button", "aria-label": `${titleOf(card)}. ${fx(card, lang)}. ${t("cost")} ${card.cost}. ${playable ? t("available") : t("inspectOnly")}`,
    "aria-pressed": on, "data-focus-key": `card-${id}`,
    onclick: () => { selected = id; render(); root.querySelector(".action-workspace")?.scrollIntoView?.({ block: "nearest", behavior: "auto" }); },
  },
    $("span", { class: "card-type" }, t(type)),
    $("b", {}, titleOf(card)),
    $("div", { class: "fx" }, fx(card, lang)),
    $("small", {}, `${t("cost")} ${card.cost}${card.seal ? ` · ${t("muhur")} ${card.seal}` : ""}`),
    $("span", { class: "card-availability" }, playable ? t("available") : card.type === "karsi" ? t("counterOnly") : t("inspectOnly")));
}

function deltaText(delta) {
  if (delta.key === "lock") return `${labelDesk(delta.desk, lang !== "en")} · ${delta.owner == null ? t("unlocked") : `${delta.owner === 0 ? t("you") : t("opp")} ${t("locked")}`}`;
  const label = delta.key === "presence" ? labelDesk(delta.desk, lang !== "en") : t(delta.key);
  const owner = delta.owner == null ? "" : `${delta.owner === 0 ? t("you") : t("opp")} `;
  return `${owner}${label} ${delta.delta > 0 ? "+" : "−"}${Math.abs(delta.delta)}`;
}

function changeChips(rows) {
  return $("div", { class: "change-chips" }, rows.map(row => $("span", { class: `change-chip${row.key === "hukum" || row.key === "lock" ? " is-score" : ""}` }, deltaText(row))));
}

function feedbackBlock(item, compact = false) {
  const card = item.action.cardId ? cardOf(item.action.cardId) : null;
  const title = card ? `${titleOf(card)}${item.action.desk ? ` → ${labelDesk(item.action.desk, lang !== "en")}` : ""}` : item.action.type === "end-kalem" ? t("turnEnded") : t("counterPassed");
  return $("div", { class: compact ? "reply" : "action-result", "data-feedback": item.actor === 0 ? "human" : "ai" },
    $("b", {}, title),
    card ? $("p", { class: "effect-plan" }, `${item.queued.length ? t("scheduledEffect") : t("fileEffect")} ${fx(card, lang)}`) : null,
    changeChips(item.changes),
    item.queued.map(row => $("p", { class: "queued-note" }, `${t("queued")} ${t("turn")} ${row.due} · ${labelDesk(row.desk, lang !== "en")}. ${t("queuedWhy")}`)),
    !item.changes.length && !item.queued.length ? $("p", {}, t("noImmediateChange")) : null);
}

function scorePanel(view) {
  const locks = DESKS.filter(desk => view.desks[desk].lock === 0).length;
  return $("section", { class: "mission", "aria-label": t("objective") },
    $("div", { class: "mission-title" }, $("div", {}, $("span", { class: "kicker" }, t("yourRole")), $("h1", { class: "display" }, t("objective"))), $("span", { class: "round-tag" }, `${t("turn")} ${view.turn}`)),
    $("div", { class: "score-race" }, [view.me, view.opp].map((player, i) => $("div", { class: `score-player${i ? " is-opponent" : ""}` },
      $("span", {}, i ? t("opp") : t("you")), $("b", { class: "display" }, `${player.hukum} / 10`),
      $("progress", { max: "10", value: String(player.hukum), "aria-label": `${i ? t("opp") : t("you")} ${t("hukum")}` })))),
    $("p", { class: "mission-rule" }, `${t("lockRule")} ${locks >= 2 ? t("tenureActive") : t("tenureGoal")}`));
}

function actionWorkspace(view, selectedCard, humanKalem, humanKarsi) {
  const suggestion = suggestedAction(state);
  const actions = legalActions(state, 0).filter(action => action.cardId === selectedCard?.id);
  const ready = humanKalem || humanKarsi;
  const first = !state.log.some(row => row.a === 0 && (row.k === "play" || row.k === "counter"));
  const next = busy || !ready ? t("waitHint") : humanKarsi ? (suggestion ? t("counterHint") : t("noCounterHint")) : selectedCard ? t("targetHint") : suggestion ? (first ? t("firstHint") : t("chooseHint")) : t("noPlayable");
  return $("section", { class: "action-workspace", "aria-label": t("nextAction") },
    $("div", { class: "action-heading" }, $("span", { class: "kicker" }, first && guided ? t("guidedFirst") : t("nextAction")), $("b", {}, humanKarsi ? t("counterWindow") : humanKalem ? `${t("yourTurn")} · ${view.playsLeft}/2 ${t("actionsLeft")}` : t("oppTurn"))),
    $("p", { class: "next-hint" }, next),
    feedback ? $("div", { class: "inline-outcome", role: "status", "aria-live": "polite" },
      $("b", {}, `${t("lastOutcome")}: ${feedback.action.cardId ? titleOf(cardOf(feedback.action.cardId)) : feedback.action.type === "end-kalem" ? t("turnEnded") : t("counterPassed")}`),
      changeChips(feedback.changes),
      feedback.queued.map(row => $("small", {}, `${t("queued")} ${t("turn")} ${row.due} · ${labelDesk(row.desk, lang !== "en")}`))) : null,
    notice ? $("p", { class: "why", role: "status" }, notice) : null,
    selectedCard ? $("div", { class: "inspector" },
      $("h2", { class: "display" }, titleOf(selectedCard)),
      $("p", { class: "fx" }, fx(selectedCard, lang)),
      $("p", { class: "cost-line" }, `${t("cost")} ${selectedCard.cost}${selectedCard.seal ? ` · ${t("seal")} ${selectedCard.seal}` : ""}${selectedCard.delay ? ` · ${t("resolvesAt")} ${state.turn + selectedCard.delay}` : ""}`),
      actions.length ? $("div", { class: "target-actions" }, actions.map(action => {
        const preview = previewAction(state, action);
        return $("button", { type: "button", class: "btn primary play-target", disabled: busy, "data-play-desk": action.desk, onclick: () => playFile(action.cardId, action.desk) },
          $("b", {}, `${labelDesk(action.desk, lang !== "en")} · ${t("play")}`),
          $("small", {}, preview?.queued.length ? `${t("queued")} ${t("turn")} ${preview.queued[0].due}` : (preview?.changes.filter(row => row.key !== "murekkep").map(deltaText).join(" · ") || t("resolveHint"))));
      })) : $("p", { class: "why" }, cardWhy(selectedCard.id, selectedCard.desk === "any" ? state.lastPlay?.desk || DESKS[0] : selectedCard.desk) || t("inspectOnly")),
      actions.length ? $("small", { class: "preview-note" }, t("previewHint")) : null,
      $("details", {}, $("summary", {}, t("fileStory")), $("p", {}, flavorOf(selectedCard)))) :
      suggestion && ready ? $("button", { class: "btn primary suggested", type: "button", disabled: busy, "data-focus-key": "suggestion", onclick: () => { selected = suggestion.cardId; render(); } }, `${t("suggestion")} ${titleOf(cardOf(suggestion.cardId))}`) : null,
    $("div", { class: "turn-actions" },
      humanKarsi ? $("button", { class: "btn", type: "button", disabled: busy, onclick: () => humanPass("skip-karsi") }, t("skipCounter")) : null,
      humanKalem ? $("button", { class: `btn${suggestion ? " ghost" : " primary"}`, type: "button", disabled: busy, onclick: () => humanPass("end-kalem") }, t("endKalem")) : null),
    humanKalem ? $("small", { class: "turn-explainer" }, t("endTurnHint")) : null);
}

function playScreen() {
  const view = publicView(state, 0);
  const selectedCard = selected ? cardOf(selected) : null;
  const humanKalem = view.phase === "kalem" && view.turnPlayer === 0;
  const humanKarsi = view.phase === "karsi" && view.turnPlayer === 1;
  const available = legalActions(state, 0);
  return $("div", { class: "shell" },
    topbar($("div", { class: "row" },
      $("button", { class: "link", type: "button", "data-focus-key": "help", onclick: () => { helpOn = true; render(); } }, t("how")),
      $("button", { class: "link", type: "button", onclick: goToMenu }, t("menu")))),
    $("main", { class: "play" },
      scorePanel(view),
      $("section", { class: "meters", "aria-label": t("resources") },
        meter(t("murekkep"), `${view.me.murekkep}`, t("inkPurpose")),
        meter(t("muhur"), `${view.me.muhur} / ${view.opp.muhur}`, t("sealPurpose")),
        $("div", { class: `heat-meter${view.heat >= 75 ? " is-critical" : ""}` },
          $("b", {}, `${t("isi")} ${view.heat}/100`),
          $("div", { class: "heatbar", role: "meter", "aria-label": t("isi"), "aria-valuenow": view.heat, "aria-valuemin": 0, "aria-valuemax": 100 }, $("i", { style: `width:${view.heat}%` })),
          $("small", {}, t("heatPurpose")))) ,
      actionWorkspace(view, selectedCard, humanKalem, humanKarsi),
      $("section", { class: "board", "aria-label": t("desksTitle") },
        $("div", { class: "section-heading" }, $("h2", { class: "display" }, t("desksTitle")), $("span", {}, t("deskKey"))),
        $("div", { class: "desks" }, DESKS.map(desk => {
          const row = view.desks[desk], progress = deskProgress(row);
          const target = selectedCard && available.some(action => action.cardId === selectedCard.id && action.desk === desk);
          const status = row.lock === 0 ? t("yourLock") : row.lock === 1 ? t("oppLock") : progress.ready ? t("readyLock") : `${progress.needed} ${t("presenceNeeded")}`;
          return $("button", { class: `desk${row.lock != null ? " is-locked" : ""}${row.lock === 0 ? " is-yours" : ""}${target ? " is-target" : ""}`, type: "button", disabled: !target || busy,
            onclick: () => playFile(selected, desk), "aria-label": `${labelDesk(desk, lang !== "en")}. ${t("you")} ${row.presence[0]}, ${t("opp")} ${row.presence[1]}. ${status}` },
            $("span", { class: "name display" }, labelDesk(desk, lang !== "en")),
            $("span", { class: "pips" }, $("b", {}, String(row.presence[0])), $("span", {}, "/"), $("b", {}, String(row.presence[1]))),
            $("small", { class: "desk-status" }, status));
        }))),
      $("section", { class: "hand-section", "aria-label": t("hand") },
        $("div", { class: "section-heading" }, $("h2", { class: "display" }, t("hand")), $("span", {}, t("handHint"))),
        $("div", { class: "hand" }, view.me.hand.map(id => fileCard(id, selected === id)))),
      $("aside", { class: "dock" },
        $("section", { class: "feedback", role: "status", "aria-live": "polite", "aria-atomic": "true" },
          $("h2", { class: "display" }, t("lastOutcome")),
          feedback ? feedbackBlock(feedback) : $("p", { class: "pitch" }, t("feedbackEmpty")),
          replies.length ? $("details", { class: "reply-details", open: true }, $("summary", {}, t("opponentReply")), replies.map(item => feedbackBlock(item, true))) : null),
        view.me.archive.length || view.opp.archive ? $("section", { class: "archive-panel" },
          $("h2", { class: "display" }, t("scheduledTitle")),
          view.me.archive.map(row => $("p", {}, `${titleOf(cardOf(row.cardId))} → ${labelDesk(row.desk, lang !== "en")} · ${t("turn")} ${row.due}`)),
          view.opp.archive ? $("p", {}, `${t("opp")} · ${view.opp.archive} ${t("hiddenFiles")}`) : null) : null,
        $("details", { class: "ledger" }, $("summary", {}, t("log")), $("ol", {}, [...view.log].reverse().map(row => $("li", {}, `${t("turn")} ${row.t} · ${logLine(row)}`)))),
        $("details", { class: "save-panel" }, $("summary", {}, t("save")),
          $("p", { class: "save-status", role: "status" }, autosaveFailed ? t("autoSaveFail") : t("autoSaved")), saveControls()),
        autosaveFailed ? $("p", { class: "why", role: "status" }, t("autoSaveFail")) : null)),
    helpOn ? helpSheet() : null);
}

function meter(label, value, purpose) {
  return $("div", { class: "meter" }, $("span", {}, label), $("b", { class: "display" }, value), $("small", {}, purpose));
}

function helpSheet() {
  return $(
    "div",
    { class: "overlay", onclick: (e) => { if (e.target.classList.contains("overlay")) { helpOn = false; render(); } } },
    $(
      "div",
      { class: "sheet", role: "dialog", "aria-modal": true, "aria-label": t("helpTitle"), "data-modal": "help", tabindex: "-1" },
      $("h2", { class: "display", tabindex: "-1", "data-modal-primary": true }, t("helpTitle")),
      HELP[lang].map((s) => [$("h3", {}, s.title), $("p", {}, s.body)]),
      $("button", { class: "btn primary", type: "button", onclick: () => { helpOn = false; render(); } }, t("close")),
    ),
  );
}

function reportScreen() {
  const report = endReport(state, lang);
  return $(
    "div",
    { class: "shell" },
    topbar(),
    $(
      "main",
      { class: "report" },
      $("p", { class: "kicker" }, t("report")),
      $("h2", { class: "display" }, report.headline),
      $("p", { class: "report-verdict" }, report.reason),
      $("p", {}, report.comparison),
      feedback ? feedbackBlock(feedback) : null,
      $("p", {}, `${report.archetypes[0]} · ${report.archetypes[1]}`),
      $("p", {}, `${t("hukum")} ${report.meters.hukum.join(" / ")} · ${t("muhur")} ${report.meters.muhur.join(" / ")} · ${t("isi")} ${report.meters.heat} · ${t("turn")} ${report.meters.turn}`),
      $("p", {}, report.turning),
      $("div", { class: "locks" }, report.locks.map((row) => $("div", { class: "lock-row" }, `${row.name}: ${row.presence[0]} / ${row.presence[1]}${row.lock != null ? " · " + t("locked") : ""}`))),
      report.repeated.length
        ? $("p", {}, lang === "en"
          ? `Repeated files: ${report.repeated.map((r) => r.title).join(", ")}`
          : `Tekrar eden dosyalar: ${report.repeated.map((r) => r.title).join(", ")}`)
        : null,
      $("p", {}, report.alt),
      notice ? $("p", { role: "status" }, notice) : null,
      $(
        "div",
        { class: "row" },
        $("button", { class: "btn primary", type: "button", onclick: () => { screen = "setup"; render(); } }, t("again")),
        $("button", { class: "btn", type: "button", onclick: goToMenu }, t("toMenu")),
        saveControls(),
      ),
    ),
  );
}

function render() {
  const previousDialog = activeDialog();
  const focused = document.activeElement;
  const focusedIndex = previousDialog ? modalControls(previousDialog).indexOf(focused) : -1;
  document.documentElement.lang = lang;
  const view = screen === "menu" ? menu() : screen === "setup" ? setupScreen() : screen === "report" ? reportScreen() : playScreen();
  root.replaceChildren(view);
  const dialog = activeDialog();
  if (dialog) {
    if (!previousDialog) modalReturnKey = focused?.getAttribute("data-focus-key") || null;
    // Only the active overlay is interactive, including when tutorial/help overlap.
    for (const child of view.children) child.inert = child !== dialog.parentElement;
    const sameDialog = previousDialog?.getAttribute("data-modal") === dialog.getAttribute("data-modal");
    const target = (sameDialog && modalControls(dialog)[focusedIndex]) || dialog.querySelector("[data-modal-primary]") || modalControls(dialog)[0] || dialog;
    target.focus({ preventScroll: true });
  } else if (previousDialog) {
    const target = (modalReturnKey && root.querySelector(`[data-focus-key="${modalReturnKey}"]`)) || root.querySelector(".file-card") || root.querySelector("button");
    target?.focus({ preventScroll: true });
    modalReturnKey = null;
  } else if (screen === renderedScreen) {
    const focusKey = focused?.getAttribute("data-focus-key");
    if (focusKey) root.querySelector(`[data-focus-key="${focusKey}"]`)?.focus({ preventScroll: true });
  }
  if (screen !== renderedScreen) {
    window.scrollTo(0, 0);
    renderedScreen = screen;
  }
}

render();
