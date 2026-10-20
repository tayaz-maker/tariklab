import { AI_PROFILES } from "./ai.js";
import { NEIGHBORHOODS } from "./identities.js";
import { electionShare, formatAnalysis, opGraphSvg } from "./analyzer.js";
import { DEFAULT_SETTINGS, mostUsedAi } from "./prefs.js";
import { reasonLabel } from "./relationships.js";
import { cardArt, identityValue, pickLang, themeMeta } from "./theme-meta.js";

export function applyDisplay(settings, theme) {
  const root = document.documentElement;
  root.style.setProperty("--ui-scale", String((settings.uiScale || 100) / 100));
  root.style.setProperty(
    "--card-scale",
    settings.cardSize === "small" ? "0.86" : settings.cardSize === "large" ? "1.14" : "1",
  );
  root.style.setProperty("--gap-scale", settings.tableDensity === "compact" ? "0.72" : "1");
  document.body.dataset.cardSize = settings.cardSize || "normal";
  document.body.dataset.density = settings.tableDensity || "normal";
  document.body.dataset.motion = settings.motion === "on" ? "full" : "reduced";
  const identity = identityValue(theme, settings);
  document.body.dataset.identity = identity || "";
  const meta = themeMeta(theme);
  if (meta.hoodAccent) {
    const table = theme === "gett-oh" ? NEIGHBORHOODS : null;
    const row = table?.[settings[meta.identityKey]];
    if (row?.accent) root.style.setProperty("--hood-accent", row.accent);
  }
}

export function settingsBody($, t, settings, set) {
  const scaleBtn = (n) =>
    $(
      "button",
      {
        type: "button",
        "aria-pressed": settings.uiScale === n,
        "data-pick": `scale-${n}`,
        onclick: () => set({ uiScale: n }),
      },
      `${n}%`,
    );
  const sizeBtn = (id, label) =>
    $(
      "button",
      {
        type: "button",
        "aria-pressed": settings.cardSize === id,
        "data-pick": `size-${id}`,
        onclick: () => set({ cardSize: id }),
      },
      label,
    );
  const densBtn = (id, label) =>
    $(
      "button",
      {
        type: "button",
        "aria-pressed": settings.tableDensity === id,
        "data-pick": `density-${id}`,
        onclick: () => set({ tableDensity: id }),
      },
      label,
    );
  return [
    $(
      "div",
      { class: "settings-group" },
      $("h3", {}, t("display")),
      $("div", {}, t("uiScale")),
      $("div", { class: "scale-row" }, [80, 90, 100, 110, 125].map(scaleBtn)),
      $("div", {}, t("cardSize")),
      $(
        "div",
        { class: "chip-row" },
        sizeBtn("small", t("small")),
        sizeBtn("normal", t("normal")),
        sizeBtn("large", t("large")),
      ),
      $("div", {}, t("tableDensity")),
      $(
        "div",
        { class: "chip-row" },
        densBtn("compact", t("compact")),
        densBtn("normal", t("normal")),
      ),
    ),
    $(
      "div",
      { class: "settings-group" },
      $("h3", {}, t("gameplay")),
      $(
        "label",
        {},
        t("motion"),
        " ",
        $(
          "select",
          {
            onchange: (e) => set({ motion: e.target.value }),
          },
          $("option", { value: "on", selected: settings.motion === "on" }, t("motionOn")),
          $("option", { value: "reduced", selected: settings.motion !== "on" }, t("motionOff")),
        ),
      ),
    ),
    $(
      "div",
      { class: "settings-group" },
      $("h3", {}, t("controls")),
      $("p", { class: "shortcut-hint" }, t("shortcutHint")),
      $(
        "button",
        {
          type: "button",
          class: "ghost",
          onclick: () =>
            set({
              uiScale: DEFAULT_SETTINGS.uiScale,
              cardSize: DEFAULT_SETTINGS.cardSize,
              tableDensity: DEFAULT_SETTINGS.tableDensity,
              motion: DEFAULT_SETTINGS.motion,
            }),
        },
        t("resetDisplay"),
      ),
      typeof document.documentElement.requestFullscreen === "function"
        ? $(
            "button",
            {
              type: "button",
              onclick: () => {
                if (document.fullscreenElement) document.exitFullscreen?.();
                else document.documentElement.requestFullscreen?.();
              },
            },
            t("fullscreen"),
          )
        : null,
    ),
  ];
}

/**
 * Game-specific combo block. Each row carries the mechanical reason the two
 * cards belong together, derived from the printed definition — never a generic
 * "works well with".
 */
export function relatedBlock($, t, lang, rows, onOpen, theme = "veto-h", onMore = null) {
  if (!rows?.length) return [];
  const heading =
    theme === "veto-h"
      ? lang === "en"
        ? "Campaign Combos"
        : "Kampanya Komboları"
      : lang === "en"
          ? "Table Combos"
          : "Masa Komboları";
  return [
    $("h3", {}, heading),
    $(
      "ul",
      { class: "combo-list" },
      ...rows.map((row) => {
        const card = row.card;
        const label = card?.name ? card.name[lang] || card.name.tr || card.id : row.id;
        const reason = reasonLabel(row.why, lang);
        return $(
          "li",
          {},
          $(
            "button",
            {
              type: "button",
              class: "combo-row",
              "data-pick": `combo-${row.id}`,
              onclick: () => onOpen(card),
            },
            $("img", {
              class: "combo-art",
              src: cardArt(theme, card || { id: row.id }).src,
              alt: "",
              loading: "lazy",
              decoding: "async",
              width: 44,
              height: 30,
            }),
            $(
              "span",
              { class: "combo-text" },
              $("strong", { class: "combo-name" }, label),
              $(
                "small",
                { class: "combo-reason" },
                row.series && row.why === "series" ? `${reason} · ${row.series}` : reason,
              ),
            ),
          ),
        );
      }),
    ),
    onMore
      ? $(
          "button",
          { type: "button", class: "ghost", "data-pick": "combo-more", onclick: onMore },
          lang === "en" ? "See all" : "Tümünü Gör",
        )
      : null,
  ];
}

export function postMatchBody($, t, lang, theme, analysis, catalog, on) {
  const fmt = formatAnalysis(analysis, catalog, lang, theme);
  const meta = themeMeta(theme);
  const share = meta.showElectionShare ? electionShare(analysis) : null;
  const title = analysis.winner === 0 ? t("win") : analysis.winner === 1 ? t("lose") : t("tie");
  const starLabel = t(meta.starLabelKey);
  const turnLabel = t(meta.turnLabelKey);
  const workLabel = t(meta.workLabelKey);
  const graph = document.createElement("div");
  graph.innerHTML = opGraphSvg(analysis.opByTurn);
  return [
    $(
      "div",
      { class: "post-match" },
      $("h3", {}, t(meta.resultLabelKey)),
      $("p", {}, title),
      share
        ? $(
            "div",
            { class: "share" },
            $("span", {}, `${t("you")}: %${share.you.toFixed(1)}`),
            $("span", {}, `${t("opponent")}: %${share.opp.toFixed(1)}`),
          )
        : null,
      $("p", {}, `${t("turn")}: ${analysis.turns}`),
      $("p", {}, `${turnLabel}: ${fmt.turning}`),
      $("p", {}, `${starLabel}: ${fmt.star}`),
      meta.showHardestWorker ? $("p", {}, `${workLabel}: ${fmt.damage}`) : null,
      $(
        "p",
        {},
        `${t("aiStyle")}: ${AI_PROFILES[analysis.aiProfile || "controlled"]?.[lang === "en" ? "en" : "tr"]?.name || "—"}`,
      ),
      graph.firstChild,
      fmt.wasted?.length ? $("p", {}, `${t("wasted")}: ${fmt.wasted.join(", ")}`) : null,
      $(
        "div",
        { class: "dialog-actions" },
        $("button", { type: "button", onclick: on.analysis }, t("analysis")),
        $("button", { type: "button", onclick: on.history }, t("actionHistory")),
        $("button", { type: "button", class: "primary", onclick: on.replay }, t("replay")),
        $("button", { type: "button", onclick: on.menu }, t("menu")),
      ),
    ),
  ];
}

export function analysisBody($, t, lang, analysis, catalog) {
  const fmt = formatAnalysis(analysis, catalog, lang);
  const rows = (analysis.ranked || []).slice(0, 8).map((row) => {
    const name = catalog?.[row.id]?.name;
    const label = name ? name[lang] || name.tr || row.id : row.id;
    return $("li", {}, `${label} · ${row.value}`);
  });
  return [
    $("p", {}, `${t("turningPoint")}: ${fmt.turning}`),
    $("p", {}, `${t("matchStar")}: ${fmt.star}`),
    $("ol", {}, rows),
  ];
}

export function historyBody($, t, lang, theme, history, catalog) {
  const life = history?.lifetime || {};
  const fileTitle = t(themeMeta(theme).fileLabelKey);
  const fav = life.favorite && catalog?.[life.favorite];
  const favName = fav?.name ? fav.name[lang] || fav.name.tr : life.favorite || "—";
  const ai = mostUsedAi(history);
  const aiName = ai ? AI_PROFILES[ai]?.[lang === "en" ? "en" : "tr"]?.name : "—";
  const matches = (history?.matches || [])
    .slice(0, 12)
    .map((m) =>
      $(
        "li",
        {},
        `${t("turn")} ${m.turns} · ${m.winner === 0 ? t("win") : m.winner === 1 ? t("lose") : t("tie")} · ${AI_PROFILES[m.aiProfile]?.[lang === "en" ? "en" : "tr"]?.name || ""}`,
      ),
    );
  return [
    $("h3", {}, fileTitle),
    $(
      "p",
      {},
      `${life.campaigns || 0} ${t("campaigns")} · ${life.wins || 0} ${t("wins")} · ${life.losses || 0} ${t("losses")}`,
    ),
    $(
      "p",
      {},
      `${t("longest")}: ${life.longest || "—"} · ${t("shortest")}: ${life.shortest || "—"}`,
    ),
    $("p", {}, `${t("favorite")}: ${favName}`),
    $("p", {}, `${t("mostAi")}: ${aiName}`),
    matches.length ? $("ul", { class: "history-list" }, matches) : $("p", {}, t("noHistory")),
  ];
}

/**
 * Turn-by-turn flow, split by phase.
 *
 * Grouping only by turn made a legal sequence — set a card in Standby, play
 * another in Main 1 — read as several plays crammed into one moment, which is
 * what made the opponent look like it was breaking the rules.
 */
export function actionLogBody($, t, events, catalog, lang) {
  const grouped = [];
  for (const e of events || []) {
    const head = grouped.at(-1);
    if (!head || head.turn !== e.turn || head.phase !== e.phase)
      grouped.push({ turn: e.turn, phase: e.phase, rows: [] });
    grouped.at(-1).rows.push(e);
  }
  if (!grouped.length) return [$("p", {}, t("noHistory"))];
  return grouped.map((g) =>
    $(
      "section",
      {},
      $(
        "h3",
        {},
        `${t("turn")} ${g.turn ?? 0}`,
        g.phase ? $("span", { class: "history-phase" }, ` · ${t(g.phase)}`) : null,
      ),
      $(
        "ol",
        {},
        ...g.rows.map((e) => {
          const who = e.actor === 0 ? t("you") : t("opponent");
          const name = e.card && catalog?.[e.card]?.name;
          const label = name ? name[lang] || name.tr || name.en || e.card : e.card || "";
          const delta = e.delta?.some((n) => n !== 0) ? ` · ${e.delta[0]}/${e.delta[1]}` : "";
          const verb =
            e.type === "phase" ? (lang === "tr" ? "Aşama ilerledi" : "Phase advanced") : t(e.type);
          return $(
            "li",
            { class: "history-event" },
            $("strong", { class: "history-actor" }, who),
            $("span", {}, verb, label ? " · " : "", label ? $("strong", {}, label) : null, delta),
          );
        }),
      ),
    ),
  );
}
