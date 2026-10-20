import { LEGACY_SHARED_THEMES, SIBLING_THEMES } from "./theme-meta.js";

export const SETTINGS_KEY = "tariklab.duel.settings.v1";
export const settingsKey = (theme) =>
  SIBLING_THEMES.includes(theme) ? `tariklab.${theme}.settings.v1` : SETTINGS_KEY;
export const HISTORY_KEY = (theme) =>
  theme === "veto-h" ? "tariklab.veto-h.campaign-history.v1" : `tariklab.${theme}.history.v1`;
export const HISTORY_CAP = 25;

export const DEFAULT_SETTINGS = {
  uiScale: 100,
  cardSize: "normal",
  tableDensity: "normal",
  aiProfile: "controlled",
  campaignStyle: "halkci",
  neighborhood: "kadikoy",
  commandDesk: "muhtira",
  motion: "on",
};

const UI_SCALES = [80, 90, 100, 110, 125];
const CARD_SIZES = ["small", "normal", "large"];
const DENSITIES = ["compact", "normal"];
const PROFILES = ["aggressive", "patient", "trapper", "gambler", "controlled"];

export function loadSettings(storage, theme) {
  try {
    const themed = theme ? storage.getItem(settingsKey(theme)) : null;
    // Unthemed reads and VETO/GETT may still hydrate from the historical shared
    // key. Any later sibling must not.
    const allowLegacy = !theme || LEGACY_SHARED_THEMES.includes(theme);
    const legacy = themed || !allowLegacy ? null : storage.getItem(SETTINGS_KEY);
    const raw = themed || legacy;
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    const settings = sanitizeSettings({ ...DEFAULT_SETTINGS, ...parsed });
    if (theme && !themed && legacy) {
      try {
        storage.setItem(settingsKey(theme), JSON.stringify(settings));
      } catch {
        /* Readable legacy settings still apply when migration cannot persist. */
      }
    }
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage, settings, theme) {
  const next = sanitizeSettings(settings);
  try {
    storage.setItem(theme ? settingsKey(theme) : SETTINGS_KEY, JSON.stringify(next));
    return { ok: true, settings: next };
  } catch {
    return { ok: false, settings: next };
  }
}

export function sanitizeSettings(s = {}) {
  const uiScale = UI_SCALES.includes(s.uiScale) ? s.uiScale : 100;
  return {
    uiScale,
    cardSize: CARD_SIZES.includes(s.cardSize) ? s.cardSize : "normal",
    tableDensity: DENSITIES.includes(s.tableDensity) ? s.tableDensity : "normal",
    aiProfile: PROFILES.includes(s.aiProfile) ? s.aiProfile : "controlled",
    campaignStyle: typeof s.campaignStyle === "string" ? s.campaignStyle : "halkci",
    neighborhood: typeof s.neighborhood === "string" ? s.neighborhood : "kadikoy",
    commandDesk: typeof s.commandDesk === "string" ? s.commandDesk : "muhtira",
    motion: s.motion === "reduced" ? "reduced" : "on",
  };
}

export function emptyHistory() {
  return {
    version: 1,
    matches: [],
    lifetime: {
      campaigns: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      longest: 0,
      shortest: 0,
      favorite: null,
      highestValue: null,
      ai: {},
      cards: {},
    },
  };
}

export function loadHistory(storage, theme) {
  try {
    const raw = storage.getItem(HISTORY_KEY(theme));
    if (!raw) return emptyHistory();
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.matches)) return emptyHistory();
    return parsed;
  } catch {
    return emptyHistory();
  }
}

export function recordMatch(storage, theme, summary) {
  const hist = loadHistory(storage, theme);
  const life = hist.lifetime;
  life.campaigns += 1;
  if (summary.winner === 0) life.wins += 1;
  else if (summary.winner === 1) life.losses += 1;
  else life.draws += 1;
  const turns = summary.turns || 0;
  if (turns) {
    life.longest = Math.max(life.longest || 0, turns);
    life.shortest = life.shortest ? Math.min(life.shortest, turns) : turns;
  }
  if (summary.aiProfile) life.ai[summary.aiProfile] = (life.ai[summary.aiProfile] || 0) + 1;
  for (const [id, n] of Object.entries(summary.cardPlays || {})) {
    life.cards[id] = (life.cards[id] || 0) + n;
  }
  if (summary.starId) {
    const prev = life.highestValue;
    if (!prev || (summary.starValue || 0) >= (prev.value || 0))
      life.highestValue = { id: summary.starId, value: summary.starValue || 0 };
  }
  const fav = Object.entries(life.cards).sort((a, b) => b[1] - a[1])[0];
  life.favorite = fav ? fav[0] : null;
  hist.matches.unshift({
    at: summary.at || Date.now(),
    turns,
    winner: summary.winner,
    aiProfile: summary.aiProfile,
    identity: summary.identity,
    starId: summary.starId,
    turning: summary.turning,
    events: (summary.events || []).slice(-80),
    opByTurn: summary.opByTurn || [],
  });
  hist.matches = hist.matches.slice(0, HISTORY_CAP);
  try {
    storage.setItem(HISTORY_KEY(theme), JSON.stringify(hist));
    return { ok: true, history: hist };
  } catch {
    return { ok: false, history: hist };
  }
}

export function mostUsedAi(history) {
  const entries = Object.entries(history?.lifetime?.ai || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}
