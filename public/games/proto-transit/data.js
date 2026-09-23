// Coastal rhythm-network prototype: a fictional bay city. Every place, name,
// rule and shape here is original to TarikLab. See docs/ip/.

export const DISTRICTS = {
  liman: {
    tr: "Liman",
    en: "Harbour",
    x: 170,
    y: 190,
    level: 0,
    pop: 1,
    old: 0,
    attract: { work: 3, night: 1 },
  },
  rihtim: {
    tr: "Rıhtım",
    en: "Quay",
    x: 360,
    y: 205,
    level: 0,
    pop: 1,
    old: 0,
    attract: { night: 3, care: 1 },
  },
  carsi: {
    tr: "Eski Çarşı",
    en: "Old Market",
    x: 520,
    y: 140,
    level: 0,
    pop: 2,
    old: 1,
    attract: { care: 2, work: 1 },
  },
  dere: {
    tr: "Dere Ağzı",
    en: "Creek Mouth",
    x: 640,
    y: 250,
    level: 1,
    pop: 2,
    old: 0,
    attract: {},
  },
  sahil: {
    tr: "Sahil Evleri",
    en: "Shore Homes",
    x: 180,
    y: 480,
    level: 0,
    pop: 3,
    old: 0,
    attract: {},
  },
  tersane: {
    tr: "Tersane",
    en: "Boatyard",
    x: 380,
    y: 510,
    level: 0,
    pop: 1,
    old: 0,
    attract: { work: 3 },
  },
  kampus: {
    tr: "Kampüs",
    en: "Campus",
    x: 570,
    y: 560,
    level: 1,
    pop: 1,
    old: 0,
    attract: { school: 3, night: 1 },
  },
  bayir: {
    tr: "Bayır",
    en: "Slope",
    x: 730,
    y: 420,
    level: 1,
    pop: 3,
    old: 1,
    attract: { care: 1 },
  },
  yukari: {
    tr: "Yukarı Mahalle",
    en: "Upper Quarter",
    x: 860,
    y: 230,
    level: 2,
    pop: 3,
    old: 2,
    attract: {},
  },
  tepe: {
    tr: "Şifa Tepesi",
    en: "Healing Hill",
    x: 870,
    y: 540,
    level: 2,
    pop: 1,
    old: 0,
    attract: { health: 3, care: 1 },
  },
};
export const DISTRICT_IDS = Object.keys(DISTRICTS);

export const MODES = {
  tram: {
    tr: "Mahalle tramvayı",
    en: "Neighbourhood tram",
    short: ["Tramvay", "Tram"],
    cost: 2,
    cap: 12,
    time: 2,
    accessible: true,
    colour: "#d58a8a",
  },
  lift: {
    tr: "Yokuş asansörü",
    en: "Slope lift",
    short: ["Asansör", "Lift"],
    cost: 2,
    cap: 6,
    time: 2,
    accessible: true,
    colour: "#d9b25f",
  },
  ferry: {
    tr: "Kıyı vapuru",
    en: "Bay ferry",
    short: ["Vapur", "Ferry"],
    cost: 3,
    cap: 16,
    time: 3,
    accessible: true,
    colour: "#6fb7b0",
  },
  bridge: {
    tr: "Yaya geçidi",
    en: "Footbridge",
    short: ["Geçit", "Bridge"],
    cost: 1,
    cap: 8,
    time: 1,
    accessible: false,
    colour: "#c9ccd6",
  },
};
export const MODE_IDS = Object.keys(MODES);

/** The map grammar: which modes the terrain allows between which districts. */
export const CORRIDORS = [
  { a: "liman", b: "rihtim", modes: ["tram"] },
  { a: "rihtim", b: "carsi", modes: ["tram"] },
  { a: "carsi", b: "dere", modes: ["bridge"] },
  { a: "dere", b: "bayir", modes: ["tram"] },
  { a: "sahil", b: "tersane", modes: ["tram"] },
  { a: "tersane", b: "kampus", modes: ["tram", "bridge"] },
  { a: "kampus", b: "bayir", modes: ["tram"] },
  { a: "bayir", b: "yukari", modes: ["lift"] },
  { a: "bayir", b: "tepe", modes: ["lift"] },
  { a: "yukari", b: "tepe", modes: ["tram"] },
  { a: "dere", b: "yukari", modes: ["lift"] },
  { a: "liman", b: "sahil", modes: ["ferry"] },
  { a: "rihtim", b: "tersane", modes: ["ferry"] },
  { a: "dere", b: "kampus", modes: ["ferry"] },
];

export const NEEDS = {
  work: { tr: "İş", en: "Work", glyph: "▮" },
  school: { tr: "Eğitim", en: "School", glyph: "▲" },
  care: { tr: "Bakım", en: "Care", glyph: "◆" },
  health: { tr: "Sağlık", en: "Health", glyph: "✚" },
  night: { tr: "Gece", en: "Night", glyph: "●" },
};

/** The city's daily rhythm: which needs move in which window, and how much. */
export const WINDOWS = [
  { id: "morning", tr: "Sabah", en: "Morning", flows: { work: 30, school: 16 } },
  { id: "midday", tr: "Öğle", en: "Midday", flows: { care: 14, health: 10 } },
  { id: "evening", tr: "Akşam", en: "Evening", flows: { work: 22, care: 10 }, reverse: ["work"] },
  { id: "night", tr: "Gece", en: "Night", flows: { night: 14, health: 4 }, nightOnly: true },
];

export const DAYS = 6;

/** Offers districts make; accepted ones come due after `days`. */
export const AGREEMENTS = [
  {
    id: "night-lift",
    district: "yukari",
    days: 2,
    tr: [
      "Gece asansörü",
      "Yukarı Mahalle'nin yaşlıları gece hastaneye inemiyor. Mahalleye bağlanan bir asansöre gece seferi sözü ister misin?",
    ],
    en: [
      "Night lift",
      "Upper Quarter's elderly cannot get down to the hospital at night. Will you promise night service on a lift serving the quarter?",
    ],
    test: { kind: "nightLift", district: "yukari" },
  },
  {
    id: "morning-ferry",
    district: "sahil",
    days: 2,
    tr: [
      "Sabah vapuru",
      "Sahil Evleri işe karşı kıyıdan gidiyor. Sahil'den kalkan vapur en az iki sefer sıklığına çıkacak mı?",
    ],
    en: [
      "Morning ferry",
      "Shore Homes commute across the bay. Will a ferry from the shore run at least two frequencies?",
    ],
    test: { kind: "ferryFreq", district: "sahil", freq: 2 },
  },
  {
    id: "campus-night",
    district: "kampus",
    days: 2,
    tr: [
      "Gece dönüşü",
      "Öğrenciler Rıhtım'dan gece dönebilmek istiyor. Gece penceresinde Kampüs ile Rıhtım arasında yol açık olacak mı?",
    ],
    en: [
      "Night return",
      "Students want to get back from the Quay at night. Will a route between Campus and Quay be open in the night window?",
    ],
    test: { kind: "nightPath", a: "kampus", b: "rihtim" },
  },
  {
    id: "step-free",
    district: "tepe",
    days: 2,
    tr: [
      "Basamaksız yol",
      "Şifa Tepesi'ne gelenlerin çoğu merdiven çıkamıyor. Gün sonunda bakım ve sağlık yolculuklarının %70'i erişilebilir olacak mı?",
    ],
    en: [
      "Step-free route",
      "Most people coming to Healing Hill cannot climb stairs. Will 70% of care and health trips be step-free at the end of the day?",
    ],
    test: { kind: "access", min: 70 },
  },
  {
    id: "market-day",
    district: "carsi",
    days: 2,
    tr: [
      "Pazar günü",
      "Eski Çarşı öğle pazarını büyütüyor. Öğle penceresinde en az beş mahalleden Çarşı'ya ulaşılabilecek mi?",
    ],
    en: [
      "Market day",
      "The Old Market is growing its midday market. Will at least five districts reach it in the midday window?",
    ],
    test: { kind: "reach", district: "carsi", window: "midday", min: 5 },
  },
];

export const UPGRADES = {
  freq: { cost: 1, tr: "Sefer sıklığı +1", en: "Frequency +1" },
  night: { cost: 1, tr: "Gece seferi", en: "Night service" },
  ramp: { cost: 1, tr: "Rampa (basamaksız)", en: "Ramp (step-free)" },
};
