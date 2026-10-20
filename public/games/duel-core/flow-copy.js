/**
 * Plain-language match narration for the Oyun Akışı rail.
 *
 * The rail used to fall through to a bare "Rakip: Etki" for everything that
 * was not a battle, draw, move or phase, so cards were destroyed, banished,
 * negated or stolen with no sentence to explain it — the player saw a card
 * vanish and had to guess. Every event now reads the same way:
 *
 *     WHO  ·  DID WHAT  ·  WHAT IT MEANT
 *
 * The engine already records why a card moved (`reason` on the move event);
 * this file is what finally reads it. Nothing here decides anything — it only
 * words what the engine already did.
 */

/**
 * The two nouns the match rail borrows from the theme. The rail used to print
 * VETO-H!'s "Atılan Kartlar" and the shared "adak" for every sibling, so a
 * sibling match narrated its archive as a campaign discard pile. Callers
 * pass `words`; the defaults are what the frozen siblings already print, so
 * VETO-H! and GETT-OH! output is unchanged.
 */
const DEFAULT_WORDS = {
  tr: { graveTo: "Atılan Kartlar’a", tribute: "adak" },
  en: { graveTo: "the graveyard", tribute: "a tribute" },
};
const themeWords = (ctx) => ({ ...DEFAULT_WORDS[ctx?.lang === "en" ? "en" : "tr"], ...(ctx?.words || {}) });
const resolve = (value, words) => (typeof value === "function" ? value(words) : value);

/** Why a card left where it was, in the player's words. */
const MOVE_REASON = {
  tr: {
    tribute: (w) => `${w.tribute} olarak verildi`,
    "tribute-replacement": (w) => `${w.tribute} yerine geçti`,
    discard: "elden atıldı",
    "hand-limit": "el sınırı için atıldı",
    battle: "savaşta yenildi",
    effect: "bir kart etkisiyle gitti",
    "effect-set": "bir etkiyle set edildi",
    negated: "etkisi durduruldu",
    "summon-negated": "çağrısı durduruldu",
    activated: "kullanıldı",
    resolved: "işini bitirdi",
    special: "özel çağrıyla geldi",
    summon: "çağrıldı",
    set: "kapalı kondu",
    "field-replaced": "yeni alan kartıyla değişti",
    relocate: "yer değiştirdi",
    response: "cevap olarak açıldı",
    "ritual-rite": "ritüel bedeli oldu",
    "revealed-draw": "gösterilip çekildi",
    "end-effect": "tur sonunda kalktı",
    "equip-target-left": "bağlı olduğu kart gidince düştü",
    "control-return-no-zone": "yer kalmadığı için geri döndü",
    control: "el değiştirdi",
    "control-return": "sahibine geri döndü",
  },
  en: {
    tribute: (w) => `given as ${w.tribute}`,
    "tribute-replacement": "used in place of a tribute",
    discard: "discarded",
    "hand-limit": "discarded for the hand limit",
    battle: "lost in battle",
    effect: "removed by a card effect",
    "effect-set": "Set by an effect",
    negated: "negated",
    "summon-negated": "had its summon negated",
    activated: "used",
    resolved: "finished resolving",
    special: "Special Summoned",
    summon: "summoned",
    set: "Set face-down",
    "field-replaced": "replaced by a new field card",
    relocate: "moved",
    response: "revealed in response",
    "ritual-rite": "paid as a ritual cost",
    "revealed-draw": "revealed and drawn",
    "end-effect": "expired at the end of the turn",
    "equip-target-left": "fell off when its target left",
    "control-return-no-zone": "returned with no free zone",
    control: "changed hands",
    "control-return": "returned to its owner",
  },
};

/** What each destination means for the card. */
const DESTINATION = {
  tr: {
    units: { own: "sahaya sürdün", foe: "sahaya sürdü", note: "Artık savaşabilir." },
    support: { own: "oynadın", foe: "oynadı", note: "Destek bölgesinde duruyor." },
    hand: { own: "eline aldın", foe: "eline aldı", note: "Tekrar oynanabilir." },
    grave: (w) => ({ own: `${w.graveTo} gönderdin`, foe: `${w.graveTo} gönderdi`, note: "" }),
    banished: {
      own: "oyun dışı bıraktın",
      foe: "oyun dışı bıraktı",
      note: "Bu düelloda geri dönmez.",
    },
    deck: {
      own: "desteye geri koydun",
      foe: "destesine geri koydu",
      note: "Deste yeniden karıldı.",
    },
    auxiliary: { own: "yan desteye koydun", foe: "yan destesine koydu", note: "" },
    field: {
      own: "alan bölgesine koydun",
      foe: "alan bölgesine koydu",
      note: "Alan etkisi herkesi ilgilendirir.",
    },
  },
  en: {
    units: { own: "put onto the field", foe: "put onto the field", note: "It can battle now." },
    support: { own: "played", foe: "played", note: "It sits in the support row." },
    hand: { own: "returned to hand", foe: "returned to hand", note: "It can be played again." },
    grave: (w) => ({ own: `sent to ${w.graveTo}`, foe: `sent to ${w.graveTo}`, note: "" }),
    banished: { own: "banished", foe: "banished", note: "It will not come back this duel." },
    deck: {
      own: "returned to the deck",
      foe: "returned to the deck",
      note: "The deck was shuffled.",
    },
    auxiliary: { own: "returned to the extra deck", foe: "returned to the extra deck", note: "" },
    field: {
      own: "set as the field card",
      foe: "set as the field card",
      note: "A field card affects both sides.",
    },
  },
};

/**
 * A one-line consequence for events that otherwise said nothing.
 * `ctx` supplies the card name resolver and the theme's point word.
 */
export function eventStory(event, ctx) {
  const { lang, name, point, you, foe, mine } = ctx;
  const words = themeWords(ctx);
  const tr = lang !== "en";
  const who = mine ? you : foe;
  const label = name ? `“${name}”` : "";
  switch (event.event) {
    case "destroy":
      return tr ? `${who} ${label} kartını yok etti.` : `${who} destroyed ${label}.`;
    case "summon":
    case "auxiliary-summon":
      return tr
        ? `${who} ${label} kartını sahaya çıkardı.`
        : `${who} brought ${label} to the field.`;
    case "tribute":
      return tr ? `${label} ${words.tribute} olarak verildi.` : `${label} was given as ${words.tribute}.`;
    case "set":
      return tr
        ? `${who} bir kartı kapalı koydu. Uygun anda açılabilir.`
        : `${who} Set a card face-down. It can open at the right moment.`;
    case "set-activate":
      return tr ? `Kapalı kart açıldı: ${label}.` : `A face-down card opened: ${label}.`;
    case "flip":
      return tr ? `${label} yüzü açıldı.` : `${label} was flipped face-up.`;
    case "spell":
      return tr ? `${who} ${label} kartını kullandı.` : `${who} used ${label}.`;
    case "equip":
      return tr ? `${label} bir birime bağlandı.` : `${label} was attached to a unit.`;
    case "token":
      return tr ? `Sahaya bir jeton geldi.` : `A token appeared on the field.`;
    case "token-left":
      return tr ? `Jeton sahadan kalktı.` : `The token left the field.`;
    case "direct-declared":
      return tr
        ? `${who} doğrudan saldırı ilan etti; karşısında birim yok.`
        : `${who} declared a direct attack with nothing in the way.`;
    case "battle-kill":
      return tr ? `${label} savaşta yenildi.` : `${label} was destroyed in battle.`;
    case "summon-zone-lost":
      return tr ? `Yer kalmadığı için çağrı yapılamadı.` : `There was no free zone for the summon.`;
    case "attack-target-left":
      return tr ? `Saldırının hedefi sahadan ayrıldı.` : `The attack's target left the field.`;
    case "reveal":
      return tr ? `${who} kart gösterdi.` : `${who} revealed a card.`;
    case "look":
      return tr ? `${who} desteden kart baktı.` : `${who} looked at cards from the deck.`;
    case "grave":
      return null; // The move line already said it.
    default:
      return null;
  }
}

/** "Kartını sahaya sürdü" plus what that means, for a move event. */
export function moveStory(event, ctx) {
  const { lang, name, mine } = ctx;
  const tr = lang !== "en";
  const words = themeWords(ctx);
  const dest = resolve(DESTINATION[tr ? "tr" : "en"][event.to], words);
  const reason = resolve(MOVE_REASON[tr ? "tr" : "en"][event.reason], words);
  const who = mine ? ctx.you : ctx.foe;
  const label = name ? `“${name}”` : tr ? "bir kart" : "a card";
  if (!dest) return null;
  const verb = mine ? dest.own : dest.foe;
  const head = tr ? `${who} ${label} kartını ${verb}.` : `${who} ${verb} ${label}.`;
  // The reason is the half that stops a card simply vanishing.
  const why = reason ? (tr ? `Sebep: ${reason}.` : `Reason: ${reason}.`) : "";
  return { head, why, note: dest.note };
}

export { MOVE_REASON, DESTINATION };
