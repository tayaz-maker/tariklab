/**
 * Per-theme presentation and isolation. Engine rules stay shared.
 * Unknown themes keep the historical GETT-OH! fallback so VETO/GETT
 * binaries that treated "not veto-h" as GETT do not change.
 */
export const SIBLING_THEMES = ["veto-h", "gett-oh", "darbe-h"];
export const LEGACY_SHARED_THEMES = ["veto-h", "gett-oh"];

const VETO_LABELS = {
  tr: {
    unit: "Kadro",
    spell: "Kampanya",
    trap: "Skandal",
    battle: "Tartışma",
    auxiliary: "Koalisyon Destesi",
    grave: "Atılan Kartlar",
    "end-main": "Turu Bitir",
    "set-field": "Alanı Set Et",
  },
  en: {
    unit: "Campaigner",
    spell: "Campaign",
    trap: "Scandal",
    battle: "Debate",
    auxiliary: "Coalition",
    "end-main": "End Turn",
    "set-field": "Set Field",
  },
};

const GETT_LABELS = {
  tr: {
    unit: "Adam",
    spell: "Racon",
    trap: "İhbar",
    battle: "Kapışma",
    auxiliary: "Birleşik Deste",
    grave: "Iskarta",
    "end-main": "Turu Bitir",
    "set-field": "Alanı Set Et",
  },
  en: {
    unit: "Crew",
    spell: "Racon",
    trap: "Tip-off",
    battle: "Clash",
    auxiliary: "Alliance",
    "end-main": "End Turn",
    "set-field": "Set Field",
  },
};

const DARBE_LABELS = {
  tr: {
    unit: "Görevli",
    spell: "Emirname",
    trap: "İhtar",
    battle: "Kriz",
    auxiliary: "Yedek Heyet",
    grave: "Arşiv",
    "end-main": "Turu Bitir",
    "set-field": "Alanı Set Et",
  },
  en: {
    unit: "Officer",
    spell: "Order",
    trap: "Notice",
    battle: "Crisis",
    auxiliary: "Reserve Panel",
    "end-main": "End Turn",
    "set-field": "Set Field",
  },
};

// The match rail's two theme-bound nouns. VETO-H! and GETT-OH! are frozen, so
// both keep the wording their players already see; only a theme that declares
// its own overrides it.
const FLOW_COPY_DEFAULT = {
  graveTo: { tr: "Atılan Kartlar’a", en: "the graveyard" },
  tribute: { tr: "adak", en: "a tribute" },
};

export const THEME_META = {
  "veto-h": {
    name: "VETO-H!",
    point: "OP",
    pointLong: { tr: "Oy Puanı", en: "Vote Points" },
    identityKey: "campaignStyle",
    defaultIdentity: "halkci",
    prefix: "SND",
    trapSeries: "Skandal",
    fileLabelKey: "campaignFile",
    starLabelKey: "matchStar",
    turnLabelKey: "turningPoint",
    resultLabelKey: "electionResult",
    workLabelKey: "matchStar",
    showElectionShare: true,
    showHardestWorker: false,
    hoodAccent: false,
    art: { kind: "webp", width: 576, height: 384 },
    eyebrow: { tr: "SEÇİM GECESİ · KART DÜELLOSU", en: "ELECTION NIGHT · CARD DUEL" },
    labels: VETO_LABELS,
    deckHeading: { tr: "Kampanya Destesi", en: "Campaign Deck" },
    deckIntro: {
      tr: "Burada oynayacağın 40 kartlık desteyi seçiyorsun. Her seçenek farklı bir kart listesidir.",
      en: "You are choosing the 40-card deck you will play. Each option is a different card list.",
    },
    battleEnter: { tr: "Tartışmaya Geç", en: "Enter Debate" },
    battleEnd: { tr: "Tartışmayı Bitir", en: "End Debate" },
    tributeSummon: { tr: "İstifa ile Çağır", en: "Summon by Resignation" },
    normalSummon: { tr: "Normal Çağır", en: "Normal Summon" },
    setVerb: { tr: "Set Et", en: "Set" },
    directAttack: { tr: "Açık Miting", en: "Open Rally" },
    unitAttack: { tr: "Tartış", en: "Debate" },
    activateTrap: { tr: "Skandalı Aç", en: "Reveal Scandal" },
    activateSpell: { tr: "Kampanyayı Aç", en: "Launch Campaign" },
    recordFile: { tr: "Kampanya dosyası", en: "Campaign File" },
    flowCopy: FLOW_COPY_DEFAULT,
  },
  "gett-oh": {
    name: "GETT-OH!",
    point: "RP",
    pointLong: { tr: "Racon Puanı", en: "Racon Points" },
    identityKey: "neighborhood",
    defaultIdentity: "kadikoy",
    prefix: "RCN",
    trapSeries: "İhbar",
    fileLabelKey: "nightFile",
    starLabelKey: "nightMove",
    turnLabelKey: "tableTurn",
    resultLabelKey: "postMatch",
    workLabelKey: "hardestWorker",
    showElectionShare: false,
    showHardestWorker: true,
    hoodAccent: true,
    art: { kind: "webp", width: 400, height: 300 },
    eyebrow: { tr: "İSTANBUL GECESİ · KART DÜELLOSU", en: "ISTANBUL NIGHT · CARD DUEL" },
    labels: GETT_LABELS,
    deckHeading: { tr: "Racon Destesi", en: "Racon Deck" },
    deckIntro: {
      tr: "Burada oynayacağın 40 kartlık desteyi seçiyorsun. Her semt farklı bir kart listesidir.",
      en: "You are choosing the 40-card deck you will play. Each option is a different card list.",
    },
    battleEnter: { tr: "Kapışmaya Geç", en: "Enter Clash" },
    battleEnd: { tr: "Kapışmayı Bitir", en: "End Clash" },
    tributeSummon: { tr: "Adam Yakarak Sür", en: "Tribute Crew" },
    normalSummon: { tr: "Sahaya Sür", en: "Deploy Crew" },
    setVerb: { tr: "Setle", en: "Set" },
    directAttack: { tr: "Kapıya Dayan", en: "Storm the Door" },
    unitAttack: { tr: "Kapış", en: "Clash" },
    activateTrap: { tr: "İhbarı Aç", en: "Reveal Tip-off" },
    activateSpell: { tr: "Raconu Aç", en: "Play Racon" },
    recordFile: { tr: "Gece dosyası", en: "Night File" },
    flowCopy: FLOW_COPY_DEFAULT,
  },
  "darbe-h": {
    name: "DARBE-H!",
    point: "KP",
    pointLong: { tr: "Kriz Puanı", en: "Crisis Points" },
    identityKey: "commandDesk",
    defaultIdentity: "muhtira",
    prefix: "DRB",
    trapSeries: "İhtar",
    fileLabelKey: "crisisFile",
    starLabelKey: "crisisMove",
    turnLabelKey: "deskTurn",
    resultLabelKey: "postMatch",
    workLabelKey: "matchStar",
    showElectionShare: false,
    showHardestWorker: false,
    hoodAccent: true,
    art: { kind: "svg", width: 400, height: 560 },
    eyebrow: { tr: "OLAĞANÜSTÜ MASA · KART DÜELLOSU", en: "EXTRAORDINARY DESK · CARD DUEL" },
    labels: DARBE_LABELS,
    deckHeading: { tr: "Kriz Destesi", en: "Crisis Deck" },
    deckIntro: {
      tr: "Burada oynayacağın 40 kartlık desteyi seçiyorsun. Her masa farklı bir kart listesidir.",
      en: "You are choosing the 40-card deck you will play. Each desk is a different card list.",
    },
    battleEnter: { tr: "Krize Geç", en: "Enter Crisis" },
    battleEnd: { tr: "Krizi Bitir", en: "End Crisis" },
    tributeSummon: { tr: "Paraf ile Çağır", en: "Summon by Initial" },
    normalSummon: { tr: "Masaya Al", en: "Seat at the Desk" },
    setVerb: { tr: "Set Et", en: "Set" },
    directAttack: { tr: "Açık Tebligat", en: "Open Dispatch" },
    unitAttack: { tr: "Krize Sok", en: "Press the Crisis" },
    activateTrap: { tr: "İhtarı Aç", en: "Open the Notice" },
    activateSpell: { tr: "Emirnameyi Oku", en: "Read the Order" },
    recordFile: { tr: "Kriz dosyası", en: "Crisis File" },
    flowCopy: {
      graveTo: { tr: "Arşiv’e", en: "the archive" },
      tribute: { tr: "paraf", en: "a countersignature" },
    },
  },
};

export function themeMeta(theme) {
  return THEME_META[theme] || THEME_META["gett-oh"];
}

export function identityValue(theme, settings = {}) {
  const meta = themeMeta(theme);
  return settings[meta.identityKey] || meta.defaultIdentity;
}

export function identityPatch(theme, deckId, extra = {}) {
  return { [themeMeta(theme).identityKey]: deckId, ...extra };
}

export function cardArt(theme, card) {
  const meta = themeMeta(theme);
  const ext = meta.art.kind === "svg" ? "svg" : "webp";
  return {
    src: `/games/${theme}/assets/cards/${card.id}.${ext}`,
    width: meta.art.width,
    height: meta.art.height,
  };
}

export function pickLang(value, lang) {
  if (!value || typeof value === "string") return value || "";
  return lang === "en" ? value.en || value.tr : value.tr || value.en;
}

/** The rail's theme-bound nouns, with the frozen siblings' wording as default. */
export function flowWords(theme, lang) {
  const flow = themeMeta(theme).flowCopy || FLOW_COPY_DEFAULT;
  const pick = (v) => (lang === "en" ? v.en : v.tr);
  return { graveTo: pick(flow.graveTo), tribute: pick(flow.tribute) };
}
