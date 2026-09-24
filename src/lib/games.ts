export type CatalogGame = {
  slug: string;
  title: string;
  subtitle: string;
  status: "live" | "soon";
  href: string | null;
  icon: string;
};

export type GameCategory = "strategy" | "life" | "dossier" | "tabletop";

/**
 * Portal-only grouping. Routes, game status and each game's save namespace stay
 * owned by the game catalogue above/below; this simply gives the home screen a
 * readable first choice without filtering or hiding any playable game.
 */
export const GAME_CATEGORIES: ReadonlyArray<{ id: GameCategory; slugs: readonly string[] }> = [
  // Territory, turf and state power: you grow and hold something on a map.
  { id: "strategy", slugs: ["cete-savaslari", "hanedanian", "racon", "bukucu", "tc-sim-devlet", "esik"] },
  // One life, one building, one village, one hundred days: running people over time.
  { id: "life", slugs: ["tc-sim", "apartman", "son-kasaba", "son-100-gun"] },
  // Read the record, connect the evidence, decide.
  { id: "dossier", slugs: ["kayip-telefon", "ihtilal", "jitem-derin-ag"] },
  // Short table sessions: the three card duels and the four classic board and puzzle games.
  { id: "tabletop", slugs: ["veto-h", "gett-oh", "darbe-h", "satranc", "amiral-batti", "peg-solitaire", "labirent"] },
];

export const HTML5_SLUGS = [
  "hanedanian",
  "labirent",
  "peg-solitaire",
  "satranc",
  "amiral-batti",
  "racon",
  "tc-sim",
  "apartman",
  "son-100-gun",
  "kayip-telefon",
  "tc-sim-devlet",
  "son-kasaba",
  "veto-h",
  "gett-oh",
  "ihtilal",
  "darbe-h",
  "jitem-derin-ag",
  "esik",
] as const;

export type Html5Slug = (typeof HTML5_SLUGS)[number];

/** Public route aliases. Each game owns its save namespace and migration policy. */
export const PLAY_ALIASES: Record<string, string> = {
  hanedan: "hanedanian",
  "son-koy-manager": "son-kasaba",
};

export function canonicalPlaySlug(slug: string): string {
  return PLAY_ALIASES[slug] || slug;
}

export function isHtml5Slug(slug: string): slug is Html5Slug {
  return (HTML5_SLUGS as readonly string[]).includes(canonicalPlaySlug(slug) as Html5Slug);
}

export const GAMES: CatalogGame[] = [
  {
    slug: "cete-savaslari",
    title: "Çete Savaşları",
    subtitle: "Racon, semt, nakit TL.",
    status: "live",
    href: "/cete-savaslari",
    icon: "cete",
  },
  {
    slug: "hanedanian",
    title: "HANEDANIAN",
    subtitle: "Bir yerleşimden büyük hanedana. Haritayı oku, geleceğini kur.",
    status: "live",
    href: "/oyna/hanedanian",
    icon: "hanedan",
  },
  {
    slug: "racon",
    title: "Racon Manager",
    subtitle: "Adamlar ölür. İsim kalır.",
    status: "live",
    href: "/oyna/racon",
    icon: "racon",
  },
  {
    slug: "tc-sim",
    title: "TC SIM",
    subtitle: "Bir hayat. Haftalık kararlar, yıllarca süren sonuçlar.",
    status: "live",
    href: "/oyna/tc-sim",
    icon: "tc-sim",
  },
  {
    slug: "bukucu",
    title: "Son Mahalle Bükücü",
    subtitle: "İstanbul tapusu. Semti tutan büker. Para TL.",
    status: "live",
    href: "/games/bukucu/index.html",
    icon: "bukucu",
  },
  {
    slug: "labirent",
    title: "Labirent",
    subtitle: "Kapalı yollar, tek çıkış.",
    status: "live",
    href: "/oyna/labirent",
    icon: "labirent",
  },
  {
    slug: "peg-solitaire",
    title: "Tek Taş",
    subtitle: "Atla, bir tane bırak.",
    status: "live",
    href: "/oyna/peg-solitaire",
    icon: "tek-tas",
  },
  {
    slug: "satranc",
    title: "Satranç",
    subtitle: "Tahta, hamle, şah mat.",
    status: "live",
    href: "/oyna/satranc",
    icon: "satranc",
  },
  {
    slug: "amiral-batti",
    title: "Amiral Battı",
    subtitle: "Izgarada filo. İsabet, ıska, battı.",
    status: "live",
    href: "/oyna/amiral-batti",
    icon: "amiral",
  },
  {
    slug: "apartman",
    title: "Apartman: Apartman Yöneticisi",
    subtitle: "Bir apartman, onlarca insan, bitmeyen meseleler.",
    status: "live",
    href: "/oyna/apartman",
    icon: "apartman",
  },
  {
    slug: "kayip-telefon",
    title: "Kayıp Telefon",
    subtitle: "Bir telefon kaybolur. İçindeki hayat ortaya çıkar.",
    status: "live",
    href: "/oyna/kayip-telefon",
    icon: "kayip-telefon",
  },
  {
    slug: "son-100-gun",
    title: "Son 100 Gün",
    subtitle: "Son yüz gün. Her kararın ağırlığı artıyor.",
    status: "live",
    href: "/oyna/son-100-gun",
    icon: "son-100-gun",
  },
  {
    slug: "tc-sim-devlet",
    title: "TC SIM: DEVLET",
    subtitle: "Çok dönemli devlet simülasyonu. Kurumlar, ekonomi ve toplum 1923'ten 2030'a.",
    status: "live",
    href: "/oyna/tc-sim-devlet",
    icon: "tc-sim-devlet",
  },
  {
    slug: "son-kasaba",
    title: "SON KÖY MANAGER",
    subtitle: "Herkes gidiyor. Sen kalıp köyü ayakta tutmaya çalışıyorsun.",
    status: "live",
    href: "/oyna/son-koy-manager",
    icon: "son-kasaba",
  },
  {
    slug: "veto-h",
    title: "VETO-H!",
    subtitle: "Seçim gecesi. Kampanyanı kur, rakibinin hamlesine cevap ver.",
    status: "live",
    href: "/oyna/veto-h",
    icon: "veto-h",
  },
  {
    slug: "gett-oh",
    title: "GETT-OH!",
    subtitle: "İstanbul gecesi. Adamını sahaya sür, raconunu kartlarla koy.",
    status: "live",
    href: "/oyna/gett-oh",
    icon: "gett-oh",
  },
  {
    slug: "ihtilal",
    title: "İhtilâl",
    subtitle: "Hüküm yazılır. Arşiv unutmaz.",
    status: "live",
    href: "/oyna/ihtilal",
    icon: "ihtilal",
  },
  {
    slug: "darbe-h",
    title: "DARBE-H!",
    subtitle: "Telex düşer. Masa karar verir.",
    status: "live",
    href: "/oyna/darbe-h",
    icon: "darbe-h",
  },
  {
    slug: "jitem-derin-ag",
    title: "JITEM: Derin Ağ",
    subtitle: "1986–1996. Dosyalar susmaz. Ağ büyür.",
    status: "live",
    href: "/oyna/jitem-derin-ag",
    icon: "jitem",
  },
  {
    slug: "esik",
    title: "Kıyı Eşiği",
    subtitle: "Kurgusal kıyıda rıhtım, merdiven, rampa ve köprü. Kopuk erişimin nedeni yazılır.",
    status: "live",
    href: "/oyna/esik",
    icon: "esik",
  },
];
