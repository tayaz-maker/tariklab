// DARBE-H! card face. duel-core's cardEl keeps the outer element, its
// attributes and every interaction; this module only supplies what is drawn
// inside it. Styling lives in card-face.css, scoped to body[data-theme="darbe-h"].
const ART = (id) => `/games/darbe-h/assets/card-art/${id}.svg`;

const el = (tag, cls, ...children) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
};
const svg = (markup) => {
  const span = document.createElement("span");
  span.className = "dh-glyph";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = markup;
  return span;
};

const GLYPH = {
  unit: '<svg viewBox="0 0 16 16"><circle cx="8" cy="5" r="3"/><path d="M2 15c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6z"/></svg>',
  spell:
    '<svg viewBox="0 0 16 16"><path d="M3 1h7l3 3v11H3zm1.6 1.6v10.8h6.8V4.7L9.3 2.6z" fill-rule="evenodd"/><circle cx="8" cy="10" r="2.2"/></svg>',
  trap: '<svg viewBox="0 0 16 16"><path d="M8 1l7.5 13.5H.5zM7 6v4.4h2V6zm0 5.6v1.9h2v-1.9z" fill-rule="evenodd"/></svg>',
};

// Short, player-facing verbs for what a card does, in both languages.
export const VERB = {
  destroy: ["Yok eder", "Destroys"],
  control: ["Ele geçirir", "Takes control"],
  negate: ["Etkisiz kılar", "Negates"],
  negateResponse: ["Etkisiz kılar", "Negates"],
  targetOrBattleNegate: ["Etkisiz kılar", "Negates"],
  cancelSummonToGrave: ["Çağrıyı bozar", "Stops a summon"],
  cancelAttack: ["Saldırıyı durdurur", "Stops an attack"],
  skipBattle: ["Krizi atlatır", "Skips battle"],
  flag: ["Kısıtlar", "Restricts"],
  summon: ["Çağırır", "Summons"],
  draw: ["Kart çeker", "Draws"],
  drawSetTrap: ["Kart çeker", "Draws"],
  modifier: ["Güç değiştirir", "Changes power"],
  points: ["KP etkiler", "Moves KP"],
  look: ["Bakar", "Looks"],
  reveal: ["Açığa çıkarır", "Reveals"],
  shuffle: ["Karıştırır", "Shuffles"],
  discard: ["Attırır", "Discards"],
  token: ["Jeton koyar", "Makes a token"],
  set: ["Kurar", "Sets"],
  move: ["Taşır", "Moves"],
  trait: ["Kalıcı etki", "Lasting effect"],
};
const WHEN = {
  summon: ["Çağrılınca", "On summon"],
  destroy: ["Yok olunca", "When destroyed"],
  tribute: ["Gönderilince", "When tributed"],
  standby: ["Tur başında", "Each standby"],
  flip: ["Açılınca", "On flip"],
  grave: ["Arşivden", "From the archive"],
  spell: ["Emirnamede", "On an order"],
};
const ORDER = [
  "destroy",
  "control",
  "negate",
  "negateResponse",
  "targetOrBattleNegate",
  "cancelAttack",
  "cancelSummonToGrave",
  "skipBattle",
  "flag",
  "summon",
  "draw",
  "drawSetTrap",
  "modifier",
  "points",
  "look",
  "reveal",
  "shuffle",
  "discard",
  "token",
  "set",
  "move",
];

export function effectSummary(card) {
  const ops = [
    ...(card.effects || []).map((e) => e.op),
    ...(card.triggers || []).flatMap((t) => (t.effects || []).map((e) => e.op)),
  ];
  let op = ORDER.find((o) => ops.includes(o)) || null;
  if (!op && card.traits && Object.keys(card.traits).length) op = "trait";
  const when = (card.triggers || [])[0]?.event || null;
  return { op, when };
}

const num = (v) => (Number.isFinite(Number(v)) ? String(v) : "—");
function stat(label, now, base) {
  const cls =
    base != null && Number.isFinite(Number(now)) && Number(now) !== Number(base)
      ? Number(now) > Number(base)
        ? " up"
        : " down"
      : "";
  return el("span", `dh-stat${cls}`, el("small", "", label), el("b", "", num(now)));
}

export function cardFace({ card, down, hidden, lang, t, text }) {
  const i = lang === "en" ? 1 : 0;
  if (down || hidden) {
    // One back for every card: the existing DARBE-H! emblem on the dossier weave.
    const img = document.createElement("img");
    img.src = "/games/darbe-h/assets/emblem.svg";
    img.alt = "";
    img.decoding = "async";
    img.width = 48;
    img.height = 48;
    return [el("span", "dh-back", img)];
  }
  const kind = card.kind;
  const isUnit = kind === "unit";
  const bureau = (Array.isArray(card.series) ? card.series[0] : "") || "";
  const { op, when } = effectSummary(card);

  const head = el(
    "span",
    "dh-head",
    el("span", "dh-name", text(card.name)),
    isUnit && Number.isFinite(card.level) ? el("span", "dh-rank", "★", String(card.level)) : null,
  );
  if (isUnit && Number.isFinite(card.level))
    head.lastChild.setAttribute("aria-label", `${t("level")} ${card.level}`);

  const img = document.createElement("img");
  img.src = ART(card.id);
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  img.width = 240;
  img.height = 160;
  img.addEventListener("error", () => img.remove(), { once: true });
  const art = el(
    "span",
    "dh-art",
    img,
    el(
      "span",
      "dh-kind",
      svg(GLYPH[kind] || GLYPH.spell),
      el("span", "dh-kind-word", card.subtype === "fusion" ? t("fusion") : t(kind)),
    ),
    bureau ? el("span", "dh-bureau", bureau.slice(0, 3).toLocaleUpperCase("tr-TR")) : null,
  );
  art.setAttribute("aria-hidden", "true");

  const summary = el(
    "span",
    "dh-effect",
    when && WHEN[when] ? el("em", "", WHEN[when][i]) : null,
    op
      ? el("span", "", VERB[op][i])
      : el(
          "span",
          "dh-plain",
          isUnit ? (lang === "en" ? "No effect" : "Etkisiz görevli") : t(card.subtype || kind),
        ),
  );

  const info = isUnit
    ? el(
        "span",
        "dh-info",
        stat("ATK", card.attack ?? card.baseAttack, card.baseAttack),
        stat("DEF", card.defense ?? card.baseDefense, card.baseDefense),
      )
    : el(
        "span",
        "dh-info dh-info-type",
        el("span", "dh-subtype", t(card.subtype || kind)),
        el("span", "dh-kind-short", t(kind)),
      );

  return [head, art, summary, info];
}
