/**
 * Deck presets: the player's real, deterministic 40-card starting list.
 *
 * A preset stores contents only (`{id, count}` entries). Draw order still comes
 * from the match seed, so the same preset plays differently every duel while the
 * contents stay exactly what the deck browser showed before the match.
 */
import { shuffle } from "./random.js";

export const DECK_SCHEMA_VERSION = 1;

/** Player-facing names and strategy blurbs, kept beside the curation weights. */
export const DECK_COPY = {
  "veto-h": {
    halkci: {
      name: { tr: "Halkçı", en: "Grassroots" },
      blurb: {
        tr: "Sahayı kalabalık tut. Ucuz kadrolarla erken alan kapla, meydanı bırakma.",
        en: "Keep the field crowded. Cheap crews take space early and hold the square.",
      },
    },
    kurumsal: {
      name: { tr: "Kurumsal", en: "Machine" },
      blurb: {
        tr: "Genel merkez disiplini. Kart çek, aradığını bul, rakibin planını sessizce boz.",
        en: "Headquarters discipline. Draw, find what you need, quietly break their plan.",
      },
    },
    agresif: {
      name: { tr: "Agresif", en: "Attack Line" },
      blurb: {
        tr: "Gündemi sen kur. Yüksek saldırı ve doğrudan OP baskısıyla erken bitir.",
        en: "Set the agenda. High attack and direct OP pressure to finish early.",
      },
    },
    savunmaci: {
      name: { tr: "Savunmacı", en: "Defensive" },
      blurb: {
        tr: "Önce zemini tut. Skandal tuzakları ve iptallerle rakibin hamlesini boşa düşür.",
        en: "Hold the ground first. Scandal traps and negations waste their turn.",
      },
    },
    kriz: {
      name: { tr: "Kriz Yönetimi", en: "Crisis Desk" },
      blurb: {
        tr: "Kaybettiğini geri al. Mezarlıktan dönüş, OP tamiri ve son dakika cevapları.",
        en: "Take back what you lost. Grave returns, OP repair and last-minute answers.",
      },
    },
  },
  "gett-oh": {
    kadikoy: {
      name: { tr: "Kadıköy", en: "Kadıköy" },
      blurb: {
        tr: "Masa kalabalık, çay sıcak. Kart akışı ve sabırla RP'ni koru, uzun geceye oyna.",
        en: "A full table and hot tea. Card flow and patience protect your RP for a long night.",
      },
    },
    usküdar: {
      name: { tr: "Üsküdar", en: "Üsküdar" },
      blurb: {
        tr: "Sözünü tut, sırtını sağlama al. Yüksek savunma ve iptallerle masayı sakin tut.",
        en: "Keep your word, cover your back. High defense and negations keep the table calm.",
      },
    },
    fatih: {
      name: { tr: "Fatih", en: "Fatih" },
      blurb: {
        tr: "Çarşı hesabı kapanır. Yok etme, borç baskısı ve doğrudan hasarla sıkıştır.",
        en: "The bazaar settles its books. Removal, debt pressure and direct damage.",
      },
    },
    besiktas: {
      name: { tr: "Beşiktaş", en: "Beşiktaş" },
      blurb: {
        tr: "Sokak haber alır. İhbar tuzakları rakibin saldırısını daha başlamadan keser.",
        en: "The street hears first. Tip-off traps cut their attack before it starts.",
      },
    },
    beyoglu: {
      name: { tr: "Beyoğlu", en: "Beyoğlu" },
      blurb: {
        tr: "Gece kuralları esnetir. Adam kapma, mezarlıktan dönüş ve beklenmedik çağrılar.",
        en: "Night bends the rules. Stealing crews, grave returns and sudden summons.",
      },
    },
  },
};

export function deckIds(theme) {
  return Object.keys(DECK_COPY[theme] || {});
}

export function deckCopy(theme, id, lang) {
  const row = DECK_COPY[theme]?.[id];
  if (!row) return { name: "—", blurb: "" };
  const key = lang === "en" ? "en" : "tr";
  return { name: row.name[key] || row.name.tr, blurb: row.blurb[key] || row.blurb.tr };
}

/** Flat id list for a preset, each entry repeated by its stored count. */
export function presetCardIds(preset) {
  return (preset?.cards || []).flatMap((entry) => Array(entry.count).fill(entry.id));
}

/**
 * Turn a preset into the prepared-deck shape `createDuel` expects.
 * The seed controls order only; contents are exactly what the preset lists.
 */
export function expandDeck(preset, pool, seed = 1) {
  const rng = { rng: seed >>> 0 };
  const byId = new Map(pool.map((c) => [c.id, c]));
  const main = shuffle(presetCardIds(preset), rng);
  const auxiliary = presetCardIds({ cards: preset?.auxiliary || [] }).filter(
    (id) => byId.get(id)?.deckLocation === "auxiliary",
  );
  return { main, auxiliary, seed: seed >>> 0, rng: rng.rng, mulligan: false };
}

/** Structural check before a preset is trusted as a real deck. */
export function isPresetShape(preset) {
  return Boolean(
    preset &&
    typeof preset.id === "string" &&
    Array.isArray(preset.cards) &&
    preset.cards.every(
      (e) => e && typeof e.id === "string" && Number.isInteger(e.count) && e.count > 0,
    ),
  );
}

export function findPreset(decks, id) {
  return (decks || []).find((d) => d.id === id) || null;
}

/** Card-type breakdown for the deck browser. */
export function deckBreakdown(preset, pool) {
  const byId = new Map(pool.map((c) => [c.id, c]));
  const counts = { unit: 0, spell: 0, trap: 0 };
  for (const id of presetCardIds(preset)) {
    const card = byId.get(id);
    if (card) counts[card.kind] = (counts[card.kind] || 0) + 1;
  }
  return counts;
}
